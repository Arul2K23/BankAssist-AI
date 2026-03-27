class LLMRouter:
    """
    Manages a primary (Groq) and fallback (Gemini) LLM provider.
    Rotates within each provider's model list before switching providers.
    """
 
    def __init__(self, gemini_api_key: str, groq_api_key: Optional[str] = None):
        self.gemini_api_key = gemini_api_key
        self.groq_api_key = groq_api_key
        self._groq_idx = 0
        self._gemini_idx = 0
        self._groq_llm = None
        self._gemini_llm = None
        self._setup()
 
    def _setup(self):
        # Gemini — always available
        from langchain_google_genai import ChatGoogleGenerativeAI
        self._gemini_llm = self._make_gemini(self._gemini_idx)
 
        # Groq — only if key is provided
        if self.groq_api_key:
            try:
                from langchain_groq import ChatGroq
                self._groq_llm = ChatGroq(
                    model=GROQ_MODEL_CANDIDATES[self._groq_idx],
                    api_key=self.groq_api_key,
                    temperature=0,
                    max_retries=1,
                )
                print(f"DEBUG: Groq initialised with {GROQ_MODEL_CANDIDATES[self._groq_idx]}")
            except ImportError:
                print("WARNING: langchain-groq not installed. Run: pip install langchain-groq")
                self._groq_llm = None
        else:
            print("INFO: No GROQ_API_KEY — using Gemini only.")
 
    def _make_gemini(self, idx: int):
        from langchain_google_genai import ChatGoogleGenerativeAI
        model = GEMINI_MODEL_CANDIDATES[idx]
        print(f"DEBUG: Gemini initialised with {model}")
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=self.gemini_api_key,
            temperature=0,
            convert_system_message_to_human=True,
            max_retries=1,
        )
 
    async def ainvoke(self, prompt: str) -> str:
        """
        Try Groq first (fast). On quota/404 errors, rotate within Groq then
        fall back to Gemini, rotating within Gemini models as needed.
        """
        providers = []
        if self._groq_llm:
            providers.append(("groq", self._groq_llm, GROQ_MODEL_CANDIDATES, "_groq_idx"))
        providers.append(("gemini", self._gemini_llm, GEMINI_MODEL_CANDIDATES, "_gemini_idx"))
 
        for provider_name, llm, candidates, idx_attr in providers:
            attempts = 0
            while attempts < len(candidates):
                try:
                    response = await llm.ainvoke(prompt)
                    return self._extract(response.content)
                except Exception as e:
                    err = str(e)
                    is_quota = any(code in err for code in ("429", "404", "503")) or "quota" in err.lower()
                    if is_quota:
                        attempts += 1
                        current_idx = getattr(self, idx_attr)
                        next_idx = (current_idx + 1) % len(candidates)
                        setattr(self, idx_attr, next_idx)
                        print(f"DEBUG: {provider_name} quota hit → rotating to {candidates[next_idx]}")
                        if provider_name == "groq":
                            from langchain_groq import ChatGroq
                            self._groq_llm = ChatGroq(
                                model=candidates[next_idx],
                                api_key=self.groq_api_key,
                                temperature=0,
                                max_retries=1,
                            )
                            llm = self._groq_llm
                        else:
                            self._gemini_llm = self._make_gemini(next_idx)
                            llm = self._gemini_llm
                        continue
                    print(f"DEBUG: {provider_name} non-quota error: {err[:120]}")
                    break  # Non-quota error → skip to next provider
 
        raise RuntimeError("All LLM providers exhausted.")
    @staticmethod
    def _extract(raw) -> str:
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