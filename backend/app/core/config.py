import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "BankAssist AI"
    API_V1_STR: str = "/api/v1"

    # ── Qdrant ────────────────────────────────────────────────────────────────
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "banking_knowledge"

    # ── AI Models ─────────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "BAAI/bge-small-en-v1.5"
    RERANKER_MODEL: str = "BAAI/bge-reranker-base"

    # Gemini (Google) — always available as fallback
    # Get key: https://aistudio.google.com/app/apikey
    GEMINI_API_KEY: str = ""

    # Groq (LPU inference, open-source models) — optional but highly recommended
    # Much faster than Gemini on the free tier (~500 tok/s vs ~50 tok/s)
    # Get key: https://console.groq.com/keys
    # Install:  pip install langchain-groq
    GROQ_API_KEY: str = ""

    # ── Chunking ──────────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 100

    # ── Security ──────────────────────────────────────────────────────────────
    # IMPORTANT: change SECRET_KEY before any real deployment
    SECRET_KEY: str = "super-secret-key-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    class Config:
        env_file = ".env"
        extra = "ignore"     # silently ignore any extra .env keys


settings = Settings()