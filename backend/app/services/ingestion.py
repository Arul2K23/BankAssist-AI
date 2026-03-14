import os
import uuid
from typing import List, Dict, Any
from langchain.schema import Document
from langchain_community.document_loaders import (
    PyPDFLoader, 
    UnstructuredWordDocumentLoader, 
    TextLoader,
    CSVLoader,
    UnstructuredExcelLoader,
    UnstructuredPowerPointLoader
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
from app.models.auth import AccessLevel

class IngestionService:


    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", " ", ""]
        )
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash", 
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0
        )

    def generate_summary(self, text: str) -> str:
        """Generates a 3-bullet point summary of the document text."""
        try:
            # Use only the first 5000 chars for summary to be quick
            sample = text[:5000]
            prompt = f"Summarize the following document text in exactly 2-3 concise bullet points for an enterprise database overview:\n\n{sample}"
            response = self.llm.invoke(prompt)
            return response.content
        except Exception as e:
            print(f"Summarization failed: {str(e)}")
            return "Summary generation unavailable."

    def _process_image(self, file_path: str):
        """Uses Gemini Flash 2.0 to extract text from images."""
        import base64
        from langchain_core.messages import HumanMessage
        with open(file_path, "rb") as image_file:
            image_b64 = base64.b64encode(image_file.read()).decode('utf-8')
            
        ext = os.path.splitext(file_path)[1].lower().replace(".", "")
        if ext == "jpg":
            ext = "jpeg"
            
        message = HumanMessage(
            content=[
                {"type": "text", "text": "Extract all text from this image perfectly. If there are charts, tables or diagrams, describe them in immense detail so they can be indexed in a database for searching. Start directly with the extracted text/description."},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/{ext};base64,{image_b64}"}
                }
            ]
        )
        try:
            response = self.llm.invoke([message])
            text_content = response.content
            return [Document(page_content=text_content, metadata={"source": file_path})]
        except Exception as e:
            print(f"Failed to process image {file_path}: {e}")
            return [Document(page_content="Error processing image.", metadata={"source": file_path})]

    def load_document(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()
        try:
            if ext == ".pdf":
                loader = PyPDFLoader(file_path)
            elif ext in [".doc", ".docx"]:
                loader = UnstructuredWordDocumentLoader(file_path)
            elif ext == ".csv":
                loader = CSVLoader(file_path)
            elif ext in [".xls", ".xlsx"]:
                loader = UnstructuredExcelLoader(file_path)
            elif ext in [".ppt", ".pptx"]:
                loader = UnstructuredPowerPointLoader(file_path)
            elif ext in [".png", ".jpg", ".jpeg"]:
                return self._process_image(file_path)
            else:
                loader = TextLoader(file_path)
            
            return loader.load()
        except Exception as e:
            print(f"Failed to load {file_path} with primary loader: {e}. Falling back to text.")
            return [Document(page_content=f"Error reading file: {e}", metadata={"source": file_path})]

    def process_document(self, file_path: str, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Loads, splits, and enriches document chunks with metadata.
        """
        docs = self.load_document(file_path)
        chunks = self.text_splitter.split_documents(docs)
        
        processed_chunks = []
        for i, chunk in enumerate(chunks):
            # Enrich metadata
            chunk_metadata = {
                "doc_id": str(uuid.uuid4()),
                "parent_doc_id": metadata.get("parent_doc_id"), # Link to SQL DB
                "source": os.path.basename(file_path),
                "chunk_index": i,
                "access_level": metadata.get("access_level", AccessLevel.INTERNAL),
                "department": metadata.get("department", "General"),
                "version": metadata.get("version", "1.0"),
                "timestamp": metadata.get("timestamp", ""),
            }
            
            processed_chunks.append({
                "text": chunk.page_content,
                "metadata": chunk_metadata
            })
            
        return processed_chunks

ingestion_service = IngestionService()
