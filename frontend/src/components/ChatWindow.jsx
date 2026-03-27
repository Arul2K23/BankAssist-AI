import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, FileText, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const WELCOME_MESSAGE = {
  role: 'bot',
  text: 'Welcome. I am your AI Knowledge Assistant. How can I help you today?',
  sources: [],
};

const ChatWindow = ({ userRole, sessionId, onMessageSent }) => {
  const [messages, setMessages]   = useState([WELCOME_MESSAGE]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // ── Load history whenever sessionId changes ──────────────────────────────
  // A new UUID (new chat) → no history → show welcome message
  // An existing session UUID → fetch its messages from the backend
  const loadHistory = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token || !sessionId) return;

    setHistoryLoading(true);
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/api/v1/chat/history?session_id=${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.length > 0) {
        const formatted = response.data.map((m) => ({
          role:    m.role,
          text:    m.content,
          sources: m.sources || [],
        }));
        setMessages(formatted);
      } else {
        // No history for this session → show fresh welcome screen
        setMessages([WELCOME_MESSAGE]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      setMessages([WELCOME_MESSAGE]);
    } finally {
      setHistoryLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const token       = localStorage.getItem('token');
    const userMessage = { role: 'user', text: input, sources: [] };
    const queryText   = input;

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/v1/chat/',
        {
          query:      queryText,
          session_id: sessionId,   // ← binds this message to the current session
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessages((prev) => [
        ...prev,
        {
          role:    'bot',
          text:    response.data.answer,
          sources: response.data.sources || [],
        },
      ]);

      // Tell App to refresh the sessions list so this session shows up
      if (onMessageSent) onMessageSent();

    } catch (error) {
      console.error('Chat error:', error);
      const errText =
        error.response?.data?.detail ||
        'System synchronization error. Please verify network connectivity.';
      setMessages((prev) => [...prev, { role: 'bot', text: errText, sources: [] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full glass rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-slide-up bg-slate-900/40">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/15 rounded-2xl border border-accent/20">
            <Bot className="text-accent" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Enterprise Assistant</h2>
            <p className="text-[10px] text-accent/80 font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_#3f37c9]" />
              Active Document Inquiry Mode
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Reload session button */}
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            className="p-2 text-white/20 hover:text-white/60 transition-colors rounded-xl hover:bg-white/5 disabled:opacity-30"
            title="Reload session history"
          >
            <RotateCcw size={16} className={historyLoading ? 'animate-spin' : ''} />
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-[10px] font-bold text-accent uppercase tracking-widest">
            <ShieldCheck size={14} className="text-accent" />
            {userRole?.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* ── Messages ──────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar"
      >
        {/* History loading skeleton */}
        {historyLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={24} className="text-accent/40 animate-spin" />
              <p className="text-[11px] text-white/20 uppercase tracking-widest font-bold">
                Loading session…
              </p>
            </div>
          </div>
        )}

        {!historyLoading && (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 ${
                    msg.role === 'user'
                      ? 'bg-accent border-white/20 shadow-xl shadow-accent/20'
                      : 'bg-slate-800 border-white/10 shadow-lg'
                  }`}>
                    {msg.role === 'user'
                      ? <User size={22} className="text-white" />
                      : <Bot  size={22} className="text-accent" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-3xl shadow-xl ${
                      msg.role === 'user'
                        ? 'bg-accent text-white rounded-tr-none'
                        : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5 backdrop-blur-sm'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">
                          {msg.text}
                        </p>
                      ) : (
                        <div className="text-[15px] leading-relaxed font-medium markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Source pills */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 animate-fade-in">
                        {msg.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-white/50 hover:text-white/80 hover:bg-white/10 transition-all cursor-default"
                          >
                            <FileText size={12} className="text-accent/60" />
                            <span className="font-bold opacity-70 uppercase tracking-tighter">REF:</span>
                            {src.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Thinking indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex gap-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-white/10 flex items-center justify-center shadow-lg">
                <Loader2 size={22} className="text-accent animate-spin" />
              </div>
              <div className="px-6 py-4 rounded-3xl bg-white/5 text-white/40 text-[15px] font-medium animate-pulse border border-white/5">
                Parsing neural index for matching vectors…
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Input ─────────────────────────────────────────────────────── */}
      <div className="p-8 bg-white/5 backdrop-blur-xl border-t border-white/5">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={historyLoading}
            placeholder={
              historyLoading
                ? 'Loading session…'
                : 'Ask a question about your uploaded documents…'
            }
            className="w-full bg-slate-900/60 border border-white/10 rounded-3xl px-8 py-5 text-[15px] focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/40 transition-all placeholder:text-white/20 shadow-inner group-hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || historyLoading || !input.trim()}
            className="absolute right-3 top-2.5 bottom-2.5 bg-accent hover:bg-accent-dark disabled:opacity-30 disabled:grayscale transition-all px-6 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 group-hover:shadow-accent/20"
          >
            <Send size={20} className="mr-2" />
            <span className="font-bold text-xs uppercase tracking-widest">Transmit</span>
          </button>
        </div>

        <div className="flex justify-center gap-6 mt-5">
          <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.3em]">
            Authorized Access Protocol Enabled
          </p>
          <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.3em]">
            End-to-End Encryption Active
          </p>
        </div>
      </div>
    </div>
  );
};

// Inline SVG — no extra import needed
const ShieldCheck = ({ size, className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default ChatWindow;