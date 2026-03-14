from fastapi import APIRouter
from app.api import ingest, chat, auth, admin

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(ingest.router, prefix="/ingest", tags=["Ingestion"])
router.include_router(chat.router, prefix="/chat", tags=["Chat"])
router.include_router(admin.router, prefix="/admin", tags=["Admin"])
