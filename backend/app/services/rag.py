import os
from typing import List, Dict, Any
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer, CrossEncoder
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
from app.models.auth import ROLE_ACCESS_MAPPING, UserRole

import google.auth
from unittest.mock import MagicMock

# HARD BYPASS: Force google.auth.default to return a dummy value.
try:
    google.auth.default = lambda **kwargs: (MagicMock(), "mock-project-id")
except Exception:
    pass

class RAGService:
    def __init__(self):
        self._initialized = False
        self.qdrant = None
        self.local_client = None
        self.embed_model = None
        self.llm = None
        self.answer_cache = {}
        self.reranker = None
        self.model_candidates = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"]
        self.current_model_idx = 0
        
    def _initialize(self):
        if self._initialized:
            return
            
        if settings.GEMINI_API_KEY:
            print(f"DEBUG: Gemini API Key loaded (starts with {settings.GEMINI_API_KEY[:4]}...)")
            os.environ["GOOGLE_API_KEY"] = settings.GEMINI_API_KEY
        
        self.qdrant = QdrantClient(path="data/qdrant_db")
        self.local_client = self.qdrant._client if hasattr(self.qdrant, "_client") else self.qdrant
        
        self.ensure_collection()
        self.embed_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        
        self._init_llm()
        
        self.reranker = CrossEncoder(settings.RERANKER_MODEL)
        self._initialized = True

    def _init_llm(self):
        model_name = self.model_candidates[self.current_model_idx]
        print(f"DEBUG: Initializing LLM with model: {model_name}")
        self.llm = ChatGoogleGenerativeAI(
            model=model_name, 
            google_api_key=settings.GEMINI_API_KEY,
            temperature=0,
            convert_system_message_to_human=True,
            max_retries=1
        )

    def ensure_collection(self):
        collections = self.local_client.get_collections().collections
        exists = any(c.name == settings.QDRANT_COLLECTION for c in collections)
        if not exists:
            self.local_client.create_collection(
                collection_name=settings.QDRANT_COLLECTION,
                vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE)
            )

    def upsert_documents(self, chunks: List[Dict[str, Any]]):
        self._initialize()
        self.ensure_collection()
        points = []
        for chunk in chunks:
            vector = self.embed_model.encode(chunk["text"]).tolist()
            points.append(models.PointStruct(
                id=chunk["metadata"]["doc_id"],
                vector=vector,
                payload={"text": chunk["text"], "metadata": chunk["metadata"]}
            ))
        self.local_client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)

    def delete_by_doc_id(self, doc_id: int):
        self._initialize()
        try:
            self.local_client.delete(
                collection_name=settings.QDRANT_COLLECTION,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[models.FieldCondition(key="metadata.parent_doc_id", match=models.MatchValue(value=doc_id))]
                    )
                ),
            )
            return True
        except Exception as e:
            print(f"Error deleting from Qdrant: {str(e)}")
            return False

    def retrieve(self, query: str, user_role: UserRole, top_k: int = 10):
        self._initialize()
        query_vector = self.embed_model.encode(query).tolist()
        allowed_levels = ROLE_ACCESS_MAPPING.get(user_role, ["public"])
        
        access_filter = models.Filter(
            must=[models.FieldCondition(key="metadata.access_level", match=models.MatchAny(any=allowed_levels))]
        )
        
        try:
            results = self.local_client.search(
                collection_name=settings.QDRANT_COLLECTION,
                query_vector=query_vector,
                query_filter=access_filter,
                limit=top_k * 2
            )
            return results
        except Exception as e:
            print(f"Retrieval error: {str(e)}")
            return []

    def rerank(self, query: str, results, top_n: int = 4):
        self._initialize()
        if not results or not self.reranker:
            return results[:top_n]
        try:
            valid_results = [r for r in results if hasattr(r, 'payload') and r.payload]
            texts = [r.payload["text"] for r in valid_results]
            if not texts:
                return results[:top_n]
            pairs = [[query, txt] for txt in texts]
            scores = self.reranker.predict(pairs)
            scored_results = sorted(zip(scores, valid_results), key=lambda x: x[0], reverse=True)
            return [x[1] for x in scored_results[:top_n]]
        except Exception as e:
            print(f"Rerank error: {str(e)}")
            return results[:top_n]

    async def generate_answer(self, query: str, context_chunks: List[Any]):
        self._initialize()
        cache_key = query.lower().strip()
        if cache_key in self.answer_cache:
            print("JATAYU_DEBUG: Serving from Semantic Cache")
            return self.answer_cache[cache_key]

        if not context_chunks:
            return {"answer": "BankAssist AI: I don't see any relevant documents in my neural memory. Please upload files to the Knowledge Ingest.", "sources": []}
        
        context_parts = []
        sources = []
        for i, c in enumerate(context_chunks):
            p = c.payload
            source_name = p['metadata']['source']
            context_parts.append(f"Source {i+1} [{source_name}]: {p['text']}")
            sources.append({"name": source_name})

        context_text = "\n\n".join(context_parts)
        prompt = f"""You are BankAssist AI, an expert Banking Operations Specialist. 
Answer the question using the provided Banking Policy Context ONLY. 
Cite sources clearly as [Source X].

Banking Context:
{context_text}

Question: {query}
"""
        attempts = 0
        while attempts < len(self.model_candidates):
            try:
                response = await self.llm.ainvoke(prompt)
                raw_content = response.content
                answer_text = ""

                # 1. If it's already a standard list of dictionaries
                if isinstance(raw_content, list):
                    answer_text = raw_content[0].get('text', str(raw_content))

                # 2. If it's a string, we need to check if it's hidden JSON
                elif isinstance(raw_content, str):
                    try:
                        # Try to parse it as JSON
                        parsed_content = json.loads(raw_content)
                        if isinstance(parsed_content, list):
                            answer_text = parsed_content[0].get('text', raw_content)
                        else:
                            answer_text = raw_content
                    except json.JSONDecodeError:
                        # It's just a normal string, safe to use!
                        answer_text = raw_content

                # Fallback for anything weird
                else:
                    answer_text = str(raw_content)
                result = {"answer": answer_text, "sources": sources}
                self.answer_cache[cache_key] = result
                return result
            except Exception as e:
                attempts += 1
                if "429" in str(e) or "quota" in str(e).lower() or "404" in str(e):
                    if attempts >= len(self.model_candidates):
                        break
                    print("DEBUG: Cache miss or quota issue. Rotating model...")
                    self.current_model_idx = (self.current_model_idx + 1) % len(self.model_candidates)
                    self._init_llm()
                    continue
                break

        # Final Fallback
        fallback_text = context_parts[0] if context_parts else "No direct text available."
        return {
            "answer": f"BANKASSIST AUTONOMOUS MODE: AI API at capacity. Direct reference: \n\n{fallback_text}",
            "sources": sources
        }

rag_service = RAGService()
