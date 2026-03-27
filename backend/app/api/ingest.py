from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from datetime import timedelta
from typing import List
import shutil
import os
from app.services.ingestion import ingestion_service
from app.services.rag import rag_service
from app.models.auth import AccessLevel, UserRole
from app.core.auth_utils import check_role
from app.db.models import DBUser, DBDocument
from app.db.session import get_db, SessionLocal
from sqlalchemy.orm import Session

router = APIRouter()



# Use absolute path for reliability
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[dict])
async def list_documents(
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(check_role([UserRole.INTERNAL_EMPLOYEE, UserRole.ADMINISTRATOR, UserRole.COMPLIANCE_OFFICER]))
):
    """
    Returns the real list of documents from the database.
    """
    docs = db.query(DBDocument).order_by(DBDocument.uploaded_at.desc()).all()
    print(docs)
    return [
        {
            "id": doc.id,
            "name": doc.filename,
            "level": doc.access_level,
            "dept": doc.department,
            "status": doc.status,
            "summary": doc.summary or "Awaiting AI analysis...",
            "time": (doc.uploaded_at + timedelta(hours=5, minutes=30)).strftime("%Y-%m-%d %H:%M")
        } for doc in docs
    ]

@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    access_level: AccessLevel = Form(AccessLevel.INTERNAL),
    department: str = Form("General"),
    version: str = Form("1.0"),
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(check_role([UserRole.INTERNAL_EMPLOYEE, UserRole.ADMINISTRATOR, UserRole.COMPLIANCE_OFFICER]))
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Save metadata to database
    db_doc = DBDocument(
        filename=file.filename,
        access_level=access_level,
        department=department,
        version=version,
        owner_id=current_user.id
    )
    db.add(db_doc)
    db.commit()

    # Process in background
    background_tasks.add_task(
        process_and_index, 
        file_path, 
        db_doc.id,  # Pass the ID to update later
        {
            "access_level": access_level, 
            "department": department, 
            "version": version,
            "parent_doc_id": db_doc.id # Crucial for future deletion
        }
    )
    rag_service.clear_cache()
    return {"message": f"Successfully uploaded {file.filename}.", "filename": file.filename}

async def process_and_index(file_path: str, doc_id: int, metadata: dict):
    try:
        # 1. Process and Index chunks
        chunks = ingestion_service.process_document(file_path, metadata)
        rag_service.upsert_documents(chunks)
        
        # 2. Generate Summary if possible
        all_text = " ".join([c["text"] for c in chunks[:5]]) # Use first 5 chunks for summary
        summary = ingestion_service.generate_summary(all_text)
        
        # 3. Update database record with summary
        db = SessionLocal()
        try:
            db_doc = db.query(DBDocument).filter(DBDocument.id == doc_id).first()
            if db_doc:
                db_doc.summary = summary
                db.commit()
        finally:
            db.close()
            
        print(f"Successfully indexed and summarized {file_path}")
    except Exception as e:
        print(f"Error indexing {file_path}: {str(e)}")

@router.delete("/{doc_id}")
async def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(check_role([UserRole.ADMINISTRATOR, UserRole.COMPLIANCE_OFFICER]))
):
    """Deletes a document from SQL, Qdrant, and local storage."""
    doc = db.query(DBDocument).filter(DBDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # 1. Delete from Qdrant
        rag_service.delete_by_doc_id(doc_id)
        
        # 2. Delete file from local storage
        file_path = os.path.join(UPLOAD_DIR, doc.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            
        # 3. Delete from SQL
        db.delete(doc)
        db.commit()
        
        return {"message": "Document successfully purged from all systems."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Purge failed: {str(e)}")

@router.get("/download/{doc_id}")
async def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: DBUser = Depends(check_role([UserRole.INTERNAL_EMPLOYEE, UserRole.ADMINISTRATOR, UserRole.COMPLIANCE_OFFICER]))
):
    """Downloads a document by ID."""
    doc = db.query(DBDocument).filter(DBDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File content not found on server")
        
    return FileResponse(file_path, filename=doc.filename)

