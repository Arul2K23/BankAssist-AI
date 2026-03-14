# BankAssist AI: System Walkthrough & Module Documentation

This document provides a detailed explanation of the **BankAssist AI** modules and instructions for operating the system.

## 1. Module Overview

### 1.1 Ingestion Pipeline (`backend/app/services/ingestion.py`)
- **Responsibility**: Converts raw enterprise documents into searchable knowledge.
- **Key Features**:
    - **Multi-Loader Support**: Handles PDF, Word, and Text files.
    - **Recursive Chunking**: Splits text into 500-token chunks with 100-token overlap to maintain context.
    - **Metadata Enrichment**: Attaches `access_level`, `department`, and `timestamp` to every chunk for RBAC.

### 1.2 RAG Service (`backend/app/services/rag.py`)
- **Responsibility**: Orchestrates the AI lifecycle (Embedding -> Retrieval -> Re-ranking -> Generation).
- **Key Features**:
    - **BGE Embeddings**: Uses `bge-small-en-v1.5` for high-performance semantic representation.
    - **RBAC Filtering**: Filters Qdrant results based on the user's role before they ever reach the LLM.
    - **Hybrid Retrieval**: Combines vector similarity with metadata constraints.
    - **State-of-the-art Re-ranking**: Uses `bge-reranker-base` to ensure the top 5 chunks are truly the most relevant.
    - **Gemini-Powered Generation**: Uses Gemini 1.5 Flash with a strict grounding prompt to eliminate hallucinations.

### 1.3 RBAC System (`backend/app/models/auth.py`)
- **Responsibility**: Defines the security boundaries of the system.
- **Roles**:
    - `administrator`: Full access.
    - `compliance_officer`: Access to all docs including restricted files.
    - `internal_employee`: Standard operational knowledge.
    - `customer_support_agent`: Customer-facing and internal support docs.
    - `external_customer`: Only public-facing documentation.

### 1.4 Premium Frontend (`frontend/src/`)
- **Responsibility**: Provides a high-end user experience for bank employees and admins.
- **Features**:
    - **Glassmorphism UI**: Modern, sleek interface with blur effects and banking-blue accents.
    - **Dynamic Role Switching**: Allows testing of RBAC boundaries in real-time.
    - **Citation View**: Transparently shows which documents informed the AI's answer.

## 2. Security Controls
- **Zero-Leaking Retrieval**: The system prevents unauthorized documents from entering the LLM context via mandatory metadata filters in the vector database.
- **Audit Logs**: (Placeholder) Every request is traceable to a user ID and role.
- **Grounded Prompting**: The LLM is forced to respond with "Insufficient information available" if the retrieved context does not contain the answer.

## 3. Deployment Instructions

### Prerequisites
- Docker & Docker Compose
- Gemini API Key

### Running the System
1. **Configure Environment**:
   Update the `.env` file with your `GEMINI_API_KEY`.
2. **Launch Stack**:
   ```bash
   docker-compose up --build
   ```
3. **Access Interfaces**:
   - **Frontend**: `http://localhost:5173`
   - **API Docs**: `http://localhost:8000/docs`
   - **Qdrant Dashboard**: `http://localhost:6333/dashboard`

## 4. Example Code Snippet: RBAC Filter
```python
# app/services/rag.py
allowed_levels = ROLE_ACCESS_MAPPING.get(user_role, ["public"])
access_filter = models.Filter(
    must=[
        models.FieldCondition(
            key="metadata.access_level",
            match=models.MatchAny(any=allowed_levels)
        )
    ]
)
results = self.qdrant.search(
    collection_name=settings.QDRANT_COLLECTION,
    query_vector=query_vector,
    query_filter=access_filter,
    limit=top_k
)
```
