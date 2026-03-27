import json
import traceback
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from app.services.rag import rag_service
from app.core.auth_utils import get_current_active_user
from app.db.models import DBUser, DBChatMessage, DBAuditLog
from app.db.session import get_db, SessionLocal
from sqlalchemy.orm import Session

router = APIRouter()

# ── How many past messages to send as conversation context ──────────────────
CONTEXT_WINDOW_MESSAGES = 6   # 3 user + 3 bot turns = coherent follow-ups

# ── Audit sampling rate (0.0 – 1.0) ─────────────────────────────────────────
# At scale, logging every message creates a write bottleneck.
# We sample a fraction of ordinary queries; errors and compliance roles are
# always logged regardless of this value.
import random
AUDIT_SAMPLE_RATE = 0.10        # log 10 % of regular queries
COMPLIANCE_ROLES  = {"compliance_officer", "administrator"}


class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    error: Optional[str] = None


# ── Background audit writer ──────────────────────────────────────────────────

def _write_audit_log(user_id: int, username: str, query: str, answer_preview: str):
    """
    Runs in a BackgroundTask so it never adds latency to the HTTP response.
    Opens its own DB session to avoid sharing the request-scoped session
    across thread boundaries.
    """
    db = SessionLocal()
    try:
        audit = DBAuditLog(
            user_id=user_id,
            username=username,
            query=query,
            answer_preview=answer_preview[:200],
        )
        db.add(audit)
        db.commit()
    except Exception as exc:
        print(f"WARN audit_log write failed: {exc}")
    finally:
        db.close()


def _should_audit(role: str, error: bool = False) -> bool:
    """
    Always audit:
      - Errors / exceptions
      - Compliance / admin roles (regulatory requirement)
    Sample everything else at AUDIT_SAMPLE_RATE.
    """
    if error or str(role) in COMPLIANCE_ROLES:
        return True
    return random.random() < AUDIT_SAMPLE_RATE


# ── History ──────────────────────────────────────────────────────────────────

@router.get("/history", response_model=List[dict])
async def get_chat_history(
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    Returns the last 50 messages for the current user.
    If session_id is provided, returns messages for that session only.
    """
    query = db.query(DBChatMessage).filter(DBChatMessage.user_id == current_user.id)
    if session_id:
        query = query.filter(DBChatMessage.session_id == session_id)
    history = query.order_by(DBChatMessage.timestamp.asc()).limit(50).all()
    return [
        {
            "role": msg.role,
            "content": msg.content,
            "sources": json.loads(msg.sources) if msg.sources else [],
            "session_id": msg.session_id,
            "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
        }
        for msg in history
    ]


@router.get("/sessions", response_model=List[dict])
async def get_sessions(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """
    Returns one row per session_id, with the AI-generated title.

    ROOT CAUSE FIX: Previously we GROUP BY (session_id, session_title).
    Since only the FIRST message has a non-NULL session_title and all others
    are NULL, that produced TWO groups per session — one with the real title
    (1 row) and one with NULL (all remaining rows). The Python dedup then
    picked whichever came first, which was usually the NULL group.

    Fix: GROUP BY session_id only, and use MAX(session_title) to collapse
    all rows into one — MAX() ignores NULLs in every major SQL engine, so
    it reliably returns the one non-NULL title row.
    """
    from sqlalchemy import func

    sessions = (
        db.query(
            DBChatMessage.session_id,
            func.max(DBChatMessage.session_title).label("title"),
            func.min(DBChatMessage.timestamp).label("started_at"),
            func.count(DBChatMessage.id).label("message_count"),
        )
        .filter(
            DBChatMessage.user_id == current_user.id,
            DBChatMessage.session_id.isnot(None),
        )
        .group_by(DBChatMessage.session_id)
        .order_by(func.min(DBChatMessage.timestamp).desc())
        .limit(20)
        .all()
    )

    return [
        {
            "session_id":    s.session_id,
            "title":         s.title or "Untitled Session",
            "started_at":    s.started_at.isoformat(),
            "message_count": s.message_count,
        }
        for s in sessions
    ]


# ── Chat ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ChatResponse)
async def chat_query(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    try:
        # ── 0. Determine whether this is the first message of the session ─────
        is_first_message = False
        session_title: Optional[str] = None

        if request.session_id:
            existing = (
                db.query(DBChatMessage)
                .filter(
                    DBChatMessage.user_id == current_user.id,
                    DBChatMessage.session_id == request.session_id,
                )
                .first()
            )
            is_first_message = existing is None

        # ── 1. Generate session title on first message (non-blocking LLM call) ─
        # We await it here so the title is ready before we save the row.
        if is_first_message and request.session_id:
            session_title = await rag_service.generate_session_title(request.query)

        # ── 2. Save the user message ──────────────────────────────────────────
        user_msg = DBChatMessage(
            user_id=current_user.id,
            role="user",
            content=request.query,
            session_id=request.session_id,
            # Store the title on the first user message row so it can be
            # retrieved without a separate sessions table.
            session_title=session_title if is_first_message else None,
        )
        db.add(user_msg)
        db.commit()

        # ── 3. Retrieve recent conversation context (multi-turn support) ───────
        recent_history = (
            db.query(DBChatMessage)
            .filter(
                DBChatMessage.user_id == current_user.id,
                DBChatMessage.session_id == request.session_id,
            )
            .order_by(DBChatMessage.timestamp.desc())
            .limit(CONTEXT_WINDOW_MESSAGES)
            .all()
        )
        conversation_history = [
            {"role": m.role, "content": m.content}
            for m in reversed(recent_history)
            if m.id != user_msg.id
        ]

        # ── 4. Vector retrieval (role-gated) ──────────────────────────────────
        results = rag_service.retrieve(request.query, current_user.role)

        # ── 5. Rerank ─────────────────────────────────────────────────────────
        top_chunks = rag_service.rerank(request.query, results)

        # ── 6. Generate (with conversation history injected) ──────────────────
        response = await rag_service.generate_answer(
            query=request.query,
            context_chunks=top_chunks,
            history=conversation_history,
        )

        # ── 7. Save bot message ───────────────────────────────────────────────
        bot_msg = DBChatMessage(
            user_id=current_user.id,
            role="bot",
            content=response["answer"],
            sources=json.dumps(response.get("sources", [])),
            session_id=request.session_id,
        )
        db.add(bot_msg)
        db.commit()

        # ── 8. Sampled async audit log ────────────────────────────────────────
        # Moves the DB write off the critical path entirely. Compliance roles
        # and errors are always logged; ordinary queries are sampled.
        if _should_audit(current_user.role):
            background_tasks.add_task(
                _write_audit_log,
                current_user.id,
                current_user.username,
                request.query,
                response["answer"],
            )

        return response

    except Exception as e:
        print(f"ERROR in chat endpoint: {e}")
        traceback.print_exc()

        # Always audit exceptions regardless of role / sample rate
        background_tasks.add_task(
            _write_audit_log,
            current_user.id,
            current_user.username,
            request.query,
            f"[ERROR] {str(e)}",
        )

        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            return ChatResponse(
                answer="The AI service is currently at capacity. Please wait a moment and try again.",
                sources=[],
            )
        raise HTTPException(status_code=500, detail=str(e))