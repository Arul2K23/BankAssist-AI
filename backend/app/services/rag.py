import os
import json
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer, CrossEncoder
from app.core.config import settings
from app.models.auth import ROLE_ACCESS_MAPPING, UserRole
import numpy as np
import google.auth
from unittest.mock import MagicMock

# HARD BYPASS: Force google.auth.default to return a dummy value.
try:
    google.auth.default = lambda **kwargs: (MagicMock(), "mock-project-id")
except Exception:
    pass

# ── Tuning knobs ──────────────────────────────────────────────────────────────
SIMILARITY_SCORE_THRESHOLD = 0.40   # Qdrant cosine score — below this → irrelevant
RERANKER_SCORE_THRESHOLD   = 0.05   # CrossEncoder score  — below this → irrelevant
TOP_K_RETRIEVE             = 20     # Candidates fetched before reranking
TOP_N_RERANK               = 5      # Final chunks passed to the LLM
CONTEXT_HISTORY_TURNS      = 6      # Max past messages injected into prompt
# ─────────────────────────────────────────────────────────────────────────────

# Stable Gemini model names — do NOT use "gemini-2.5-flash" or "gemini-flash-latest"
# those are unstable aliases that 404 and trigger endless rotation.
GEMINI_MODELS = [
    "gemini-2.0-flash",   # fast, free tier, stable
    "gemini-1.5-flash",   # older but extremely stable fallback
]

# Groq runs open-source models (Llama) on fast LPU hardware.
# Primary choice — much faster than Gemini on the free tier (~500 tok/s).
# Install: pip install langchain-groq
# Add to .env: GROQ_API_KEY=gsk_...
GROQ_MODELS = [
    "llama-3.3-70b-versatile",   # best quality, generous free tier
    "llama3-8b-8192",            # fastest fallback
]

NO_KNOWLEDGE_RESPONSE = (
    "BankAssist AI: I don't have enough information to answer that question. "
    "Please ensure the relevant documents have been uploaded to the Knowledge Ingest, "
    "or rephrase your question."
)


# ── LLM Router ────────────────────────────────────────────────────────────────

class LLMRouter:
    """
    Tries Groq first (fast, free). On any quota/404/503 error it rotates
    through Groq models, then falls back to Gemini and rotates through those.
    Non-quota errors (bad request, auth failure) skip immediately to the
    next provider rather than retrying.
    """

    def __init__(self, gemini_api_key: str, groq_api_key: Optional[str] = None):
        self._gemini_key = gemini_api_key
        self._groq_key   = groq_api_key
        self._groq_idx   = 0
        self._gemini_idx = 0
        self._groq_llm   = None
        self._gemini_llm = None
        self._setup()

    def _setup(self):
        # Gemini is always available
        self._gemini_llm = self._make_gemini(self._gemini_idx)

        # Groq only if key is present
        if self._groq_key:
            try:
                self._groq_llm = self._make_groq(self._groq_idx)
                print(f"DEBUG LLMRouter: Groq ready ({GROQ_MODELS[self._groq_idx]})")
            except ImportError:
                print(
                    "WARNING: langchain-groq not installed. "
                    "Run: pip install langchain-groq — using Gemini only."
                )
                self._groq_llm = None
        else:
            print("INFO LLMRouter: No GROQ_API_KEY found — using Gemini only.")

    def _make_gemini(self, idx: int):
        from langchain_google_genai import ChatGoogleGenerativeAI
        name = GEMINI_MODELS[idx]
        print(f"DEBUG LLMRouter: Gemini ready ({name})")
        return ChatGoogleGenerativeAI(
            model=name,
            google_api_key=self._gemini_key,
            temperature=0,
            convert_system_message_to_human=True,
            max_retries=1,
        )

    def _make_groq(self, idx: int):
        from langchain_groq import ChatGroq
        name = GROQ_MODELS[idx]
        return ChatGroq(
            model=name,
            api_key=self._groq_key,
            temperature=0,
            max_retries=1,
        )

    @staticmethod
    def _is_quota_error(err: str) -> bool:
        return any(code in err for code in ("429", "503")) or "quota" in err.lower()

    @staticmethod
    def _is_model_error(err: str) -> bool:
        """404 usually means the model name doesn't exist — rotate model."""
        return "404" in err

    async def ainvoke(self, prompt: str) -> str:
        """
        Provider order: Groq → Gemini.
        Within each provider, rotate models on quota / model-not-found errors.
        Skip provider entirely on non-quota errors (auth, bad request, etc.).
        """
        providers = []
        if self._groq_llm:
            providers.append(("groq",   self._groq_llm,   GROQ_MODELS,   "_groq_idx",   "_groq_llm"))
        providers.append(    ("gemini", self._gemini_llm, GEMINI_MODELS, "_gemini_idx", "_gemini_llm"))

        for pname, llm, candidates, idx_attr, llm_attr in providers:
            attempts = 0
            while attempts < len(candidates):
                try:
                    response = await llm.ainvoke(prompt)
                    return self._extract(response.content)
                except Exception as e:
                    err = str(e)
                    should_rotate = self._is_quota_error(err) or self._is_model_error(err)
                    if should_rotate and attempts + 1 < len(candidates):
                        attempts += 1
                        new_idx = (getattr(self, idx_attr) + 1) % len(candidates)
                        setattr(self, idx_attr, new_idx)
                        print(
                            f"DEBUG LLMRouter: {pname} error ({err[:60]}) "
                            f"→ rotating to {candidates[new_idx]}"
                        )
                        try:
                            new_llm = (
                                self._make_groq(new_idx)
                                if pname == "groq"
                                else self._make_gemini(new_idx)
                            )
                            setattr(self, llm_attr, new_llm)
                            llm = new_llm
                        except Exception as init_err:
                            print(f"DEBUG LLMRouter: Failed to init rotated model: {init_err}")
                            break
                        continue
                    print(f"DEBUG LLMRouter: {pname} giving up — {err[:80]}")
                    break  # Move to next provider

        raise RuntimeError("All LLM providers exhausted — check API keys and quotas.")

    @staticmethod
    def _extract(raw: Any) -> str:
        """Safely pull a plain string out of various LLM response shapes."""
        if isinstance(raw, list):
            return raw[0].get("text", str(raw)) if raw else ""
        if isinstance(raw, str):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return parsed[0].get("text", raw) if parsed else raw
            except json.JSONDecodeError:
                pass
            return raw
        return str(raw)


# ── RAG Service ───────────────────────────────────────────────────────────────

class RAGService:
    def __init__(self):
        self._initialized = False
        self.qdrant       = None
        self.local_client = None
        self.embed_model  = None
        self.reranker     = None
        self.llm_router   = None
        self.answer_cache: Dict[str, Any] = {}

    # ── Lazy init ─────────────────────────────────────────────────────────────

    def _initialize(self):
        if self._initialized:
            return

        if settings.GEMINI_API_KEY:
            os.environ["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY
            print(f"DEBUG RAG: Gemini key loaded (starts {settings.GEMINI_API_KEY[:4]}...)")

        self.qdrant       = QdrantClient(path="data/qdrant_db")
        self.local_client = (
            self.qdrant._client if hasattr(self.qdrant, "_client") else self.qdrant
        )

        self.ensure_collection()
        self.embed_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.reranker    = CrossEncoder(settings.RERANKER_MODEL)

        self.llm_router = LLMRouter(
            gemini_api_key=settings.GEMINI_API_KEY,
            groq_api_key=getattr(settings, "GROQ_API_KEY", None),
        )

        self._initialized = True
        print("DEBUG RAG: Service fully initialised.")

    # ── Collection ────────────────────────────────────────────────────────────

    def ensure_collection(self):
        collections = self.local_client.get_collections().collections
        exists = any(c.name == settings.QDRANT_COLLECTION for c in collections)
        if not exists:
            self.local_client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=models.VectorParams(
                    size=384, distance=models.Distance.COSINE
                ),
            )
            print(f"DEBUG RAG: Created Qdrant collection '{settings.QDRANT_COLLECTION}'")

    # ── Ingestion ─────────────────────────────────────────────────────────────

    def upsert_documents(self, chunks: List[Dict[str, Any]]):
        """
        chunks[i]["metadata"]["doc_id"]        → unique UUID per chunk (for Qdrant point ID)
        chunks[i]["metadata"]["parent_doc_id"] → SQL DBDocument.id (for deletion)
        """
        self._initialize()
        self.ensure_collection()

        # Qdrant point IDs must be integers or UUIDs — convert string UUIDs
        import uuid as _uuid
        points = []
        for chunk in chunks:
            raw_id = chunk["metadata"]["doc_id"]
            # Accept both plain UUID strings and integers
            try:
                point_id = str(_uuid.UUID(str(raw_id)))  # validates & normalises
            except ValueError:
                point_id = str(raw_id)

            vector = self.embed_model.encode(chunk["text"]).tolist()
            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={"text": chunk["text"], "metadata": chunk["metadata"]},
                )
            )

        self.local_client.upsert(
            collection_name=settings.QDRANT_COLLECTION, points=points
        )
        print(f"DEBUG RAG: Upserted {len(points)} chunks.")

    def delete_by_doc_id(self, doc_id: int) -> bool:
        self._initialize()
        try:
            self.local_client.delete(
                collection_name=settings.QDRANT_COLLECTION,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="metadata.parent_doc_id",
                                match=models.MatchValue(value=doc_id),
                            )
                        ]
                    )
                ),
            )
            print(f"DEBUG RAG: Deleted Qdrant chunks for parent_doc_id={doc_id}")
            return True
        except Exception as e:
            print(f"Error deleting from Qdrant: {e}")
            return False

    # ── Retrieval ─────────────────────────────────────────────────────────────

    def retrieve(
        self,
        query: str,
        user_role: UserRole,
        top_k: int = TOP_K_RETRIEVE,
        score_threshold: float = SIMILARITY_SCORE_THRESHOLD,
    ) -> List[Any]:
        """
        Vector search with a hard cosine-score cutoff.
        Anything below score_threshold is discarded before reranking —
        this prevents weakly-related chunks from reaching the LLM.
        """
        self._initialize()
        query_vector   = self.embed_model.encode(query).tolist()
        allowed_levels = ROLE_ACCESS_MAPPING.get(user_role, ["public"])

        access_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="metadata.access_level",
                    match=models.MatchAny(any=allowed_levels),
                )
            ]
        )

        try:
            results = self.local_client.search(
                collection_name=settings.QDRANT_COLLECTION,
                query_vector=query_vector,
                query_filter=access_filter,
                limit=top_k,
                score_threshold=score_threshold,
            )
            print(
                f"DEBUG RAG: {len(results)} chunks above score {score_threshold} "
                f"for '{query[:60]}'"
            )
            return results
        except Exception as e:
            print(f"Retrieval error: {e}")
            return []

    # ── Reranking ─────────────────────────────────────────────────────────────

    def rerank(
        self,
        query: str,
        results: List[Any],
        top_n: int = TOP_N_RERANK,
        score_threshold: float = RERANKER_SCORE_THRESHOLD,
    ) -> List[Any]:
        """
        CrossEncoder second relevance gate. Chunks below score_threshold
        are dropped even if they passed the cosine gate.
        """
        self._initialize()
        if not results or not self.reranker:
            return results[:top_n]

        try:
            valid = [r for r in results if hasattr(r, "payload") and r.payload]
            texts = [r.payload["text"] for r in valid]
            if not texts:
                return []

            scores        = self.reranker.predict([[query, t] for t in texts])
            scores = 1 / (1 + np.exp(-scores)) 
            scored        = [(s, r) for s, r in zip(scores, valid) if s >= score_threshold]

            if not scored:
                print(
                    f"DEBUG RAG: All reranker scores < {score_threshold} — "
                    "treating as no-knowledge."
                )
                return []

            scored.sort(key=lambda x: x[0], reverse=True)
            top = [r for _, r in scored[:top_n]]
            print(
                f"DEBUG RAG: {len(top)} chunks passed reranker "
                f"(top={scored[0][0]:.3f})"
            )
            return top

        except Exception as e:
            print(f"Rerank error: {e}")
            return results[:top_n]

    # ── Answer generation ─────────────────────────────────────────────────────

    async def generate_answer(
        self,
        query: str,
        context_chunks: List[Any],
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """
        history: list of {"role": "user"|"bot", "content": "..."} dicts,
                 most-recent last, already filtered to CONTEXT_HISTORY_TURNS.
        """
        self._initialize()

        # Cache — skip if history is present (follow-ups must never be cached
        # with the same key as the standalone question).
        cache_key = query.lower().strip()
        if not history and cache_key in self.answer_cache:
            print("DEBUG RAG: Cache hit")
            return self.answer_cache[cache_key]

        # No relevant knowledge → refuse cleanly
        if not context_chunks:
            return {"answer": NO_KNOWLEDGE_RESPONSE, "sources": []}

        # Build context block
        context_parts, sources = [], []
        for i, c in enumerate(context_chunks):
            p = c.payload
            name = p["metadata"]["source"]
            context_parts.append(f"Source {i + 1} [{name}]: {p['text']}")
            sources.append({"name": name})
        context_text = "\n\n".join(context_parts)

        # Build optional conversation history block
        history_block = ""
        if history:
            turns = []
            for msg in history[-CONTEXT_HISTORY_TURNS:]:
                role = "User" if msg["role"] == "user" else "Assistant"
                turns.append(f"{role}: {msg['content']}")
            history_block = (
                "\n\nPrevious conversation (for context only — "
                "do NOT treat as a knowledge source):\n"
                + "\n".join(turns)
            )

        prompt = f"""You are BankAssist AI, a strict Banking Operations Specialist.

STRICT RULES:
1. Answer ONLY using the Banking Context below — never use outside knowledge.
2. If the context does not contain enough information to answer the question,
   respond with exactly:
   "BankAssist AI: I don't have enough information to answer that question based on the available documents."
3. Do NOT guess, infer, or extrapolate beyond what the context explicitly states.
4. Cite every fact as [Source X] where X is the source number.{history_block}

Banking Context:
{context_text}

Question: {query}

Answer:"""

        try:
            answer_text = await self.llm_router.ainvoke(prompt)
            result = {"answer": answer_text, "sources": sources}
            # Only cache standalone questions (no history context)
            if not history:
                self.answer_cache[cache_key] = result
            return result
        except RuntimeError as e:
            # All providers exhausted
            fallback = context_parts[0] if context_parts else "No text available."
            return {
                "answer": (
                    "BANKASSIST AUTONOMOUS MODE: All AI providers at capacity. "
                    f"Direct reference:\n\n{fallback}"
                ),
                "sources": sources,
            }

    # ── Cache ─────────────────────────────────────────────────────────────────

    def clear_cache(self):
        """
        Call this after new documents are ingested so stale "I don't know"
        answers are not served from cache.
        """
        self.answer_cache.clear()
        print("DEBUG RAG: Answer cache cleared.")


rag_service = RAGService()