import json
import traceback
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from app.services.rag import rag_service
from app.models.auth import UserRole
from app.core.auth_utils import get_current_active_user
from app.db.models import DBUser, DBAuditLog, DBChatMessage
from app.db.session import get_db
from sqlalchemy.orm import Session

router = APIRouter()

class ChatRequest(BaseModel):
    query: str

@router.get("/history", response_model=List[dict])
async def get_chat_history(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    """Retrieves the last 50 messages for the current user."""
    history = db.query(DBChatMessage).filter(DBChatMessage.user_id == current_user.id).order_by(DBChatMessage.timestamp.asc()).all()
    return [{
        "role": msg.role, 
        "content": msg.content, 
        "sources": json.loads(msg.sources) if msg.sources else ([])
    } for msg in history]

class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    error: Optional[str] = None

@router.post("/", response_model=ChatResponse)
async def chat_query(
    request: ChatRequest, 
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(get_current_active_user)
):
    try:
        # 0. Save User Message
        user_msg = DBChatMessage(user_id=current_user.id, role="user", content=request.query)
        db.add(user_msg)
        db.commit()

        # 1. Retrieve using user's actual role from DB
        results = rag_service.retrieve(request.query, current_user.role)

        
        # 2. Re-rank
        top_chunks = rag_service.rerank(request.query, results)
        
        # 3. Generate
        response = await rag_service.generate_answer(request.query, top_chunks)
        
        # Handle specific error cases/fallbacks returned from service
        if "error" in response:
            if response["error"] in ["quota_exceeded", "ai_unavailable_using_direct_extract"]:
                # Still return 200 but with the descriptive/fallback answer
                try:
                    log_entry = DBAuditLog(
                        user_id=current_user.id,
                        username=current_user.username,
                        query=request.query,
                        answer_preview=response["answer"][:200]
                    )
                    db.add(log_entry)
                    db.commit()
                except: pass
                return response
            
        try:
            log_entry = DBAuditLog(
                user_id=current_user.id,
                username=current_user.username,
                query=request.query,
                answer_preview=response["answer"][:200]
            )
            db.add(log_entry)
            db.commit()
        except: pass
        # 4. Save Bot Message with Sources
        bot_msg = DBChatMessage(
            user_id=current_user.id, 
            role="bot", 
            content=response["answer"],
            sources=json.dumps(response.get("sources", []))
        )
        db.add(bot_msg)
        db.commit()

        return response
    except Exception as e:
        print(f"ERROR in chat endpoint: {str(e)}")
        traceback.print_exc()
        
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower():
            return ChatResponse(
                answer="The AI service is currently at capacity. Please wait a minute and try again.",
                sources=[]
            )
            
        raise HTTPException(status_code=500, detail=str(e))
