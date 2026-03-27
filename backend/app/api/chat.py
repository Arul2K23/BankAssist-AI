import json
import traceback
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.services.rag import rag_service
from app.core.auth_utils import get_current_active_user
from app.db.models import DBUser, DBChatMessage, DBAuditLog
from app.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter()

# ── How many past messages to send as conversation context ──────────────────
CONTEXT_WINDOW_MESSAGES = 6   # 3 user + 3 bot turns = coherent follow-ups


class ChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None   # NEW: supports multiple chat sessions


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    error: Optional[str] = None


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
            "content": msg.content,       # FIX: was json.dumps-encoded — now plain string
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
    """Returns a deduplicated list of session IDs + their first message snippet."""
    from sqlalchemy import distinct, func
    sessions = (
        db.query(
            DBChatMessage.session_id,
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
            "session_id": s.session_id,
            "started_at": s.started_at.isoformat(),
            "message_count": s.message_count,
        }
        for s in sessions
    ]


# ── Chat ─────────────────────────────────────────────────────────────────────

@router.post("/", response_model=ChatResponse)
async def chat_query(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    try:
        # ── 0. Save the user message ──────────────────────────────────────────
        user_msg = DBChatMessage(
            user_id=current_user.id,
            role="user",
            content=request.query,        # FIX: plain string, not json.dumps
            session_id=request.session_id,
        )
        db.add(user_msg)
        db.commit()

        # ── 1. Retrieve recent conversation context (multi-turn support) ───────
        # This lets the LLM handle follow-up questions like "what's its fee?"
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
        # Reverse so history is chronological; exclude the message we just saved
        conversation_history = [
            {"role": m.role, "content": m.content}
            for m in reversed(recent_history)
            if m.id != user_msg.id
        ]

        # ── 2. Vector retrieval (role-gated) ──────────────────────────────────
        results = rag_service.retrieve(request.query, current_user.role)

        # ── 3. Rerank ─────────────────────────────────────────────────────────
        top_chunks = rag_service.rerank(request.query, results)

        # ── 4. Generate (with conversation history injected) ──────────────────
        response = await rag_service.generate_answer(
            query=request.query,
            context_chunks=top_chunks,
            history=conversation_history,
        )

        # ── 5. Save bot message ───────────────────────────────────────────────
        bot_msg = DBChatMessage(
            user_id=current_user.id,
            role="bot",
            content=response["answer"],           # FIX: plain string, NOT json.dumps
            sources=json.dumps(response.get("sources", [])),
            session_id=request.session_id,
        )
        db.add(bot_msg)

        # ── 6. Audit log (was completely missing before) ──────────────────────
        audit = DBAuditLog(
            user_id=current_user.id,
            username=current_user.username,
            query=request.query,
            answer_preview=response["answer"][:200],   # first 200 chars
        )
        db.add(audit)
        db.commit()

        return response

    except Exception as e:
        print(f"ERROR in chat endpoint: {e}")
        traceback.print_exc()

        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            return ChatResponse(
                answer="The AI service is currently at capacity. Please wait a moment and try again.",
                sources=[],
            )
        raise HTTPException(status_code=500, detail=str(e))