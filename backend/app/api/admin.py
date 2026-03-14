from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta
from app.db.session import get_db
from app.db.models import DBUser, DBAuditLog, DBDocument
from app.models.auth import UserRole
from app.core.auth_utils import check_role

router = APIRouter()

@router.get("/audit-logs", response_model=List[dict])
async def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(check_role([UserRole.ADMINISTRATOR, UserRole.COMPLIANCE_OFFICER]))
):
    """Returns all system audit logs for compliance review."""
    logs = db.query(DBAuditLog).order_by(DBAuditLog.timestamp.desc()).limit(100).all()
    return [
        {
            "id": log.id,
            "username": log.username,
            "query": log.query,
            "answer": log.answer_preview,
            "time": (log.timestamp + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d %H:%M:%S")
        } for log in logs
    ]

@router.get("/stats")
async def get_system_stats(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(check_role([UserRole.ADMINISTRATOR]))
):
    """Returns high-level system usage statistics."""
    doc_count = db.query(DBDocument).count()
    user_count = db.query(DBUser).count()
    query_count = db.query(DBAuditLog).count()
    
    return {
        "total_documents": doc_count,
        "total_users": user_count,
        "total_queries": query_count
    }
