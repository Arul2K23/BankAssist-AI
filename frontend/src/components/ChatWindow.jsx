import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, FileText, Info } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ChatWindow = ({ userRole }) => {
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Welcome. I am your AI Knowledge Assistant. How can I help you today?", sources: [] }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/v1/chat/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.data.length > 0) {
          const formatted = response.data.map(m => ({
            role: m.role,
            text: m.content,
            sources: m.sources || []
          }));
          setMessages(formatted);
        }
      } catch (error) {
        console.error("Failed to load history:", error);
      }
    };
    fetchHistory();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const token = localStorage.getItem('token');
    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/v1/chat/', 
        { query: input },
        { 
          headers: { 
            'Authorization': `Bearer ${token}` 
          } 
        }
      );

      const botMessage = {
        role: 'bot',
        text: response.data.answer,
        sources: response.data.sources || []
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg = error.response?.data?.detail || "System synchronization error. Please verify network connectivity.";
      setMessages(prev => [...prev, { role: 'bot', text: errorMsg, sources: [] }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-slide-up bg-slate-900/40">
      {/* Header */}
      <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-accent/15 rounded-2xl border border-accent/20">
            <Bot className="text-accent" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Enterprise Assistant</h2>
            <p className="text-[10px] text-accent/80 font-black uppercase tracking-[0.2em] flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_#3f37c9]"></span>
              Active Document Inquiry Mode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-[10px] font-bold text-accent uppercase tracking-widest">
          <ShieldCheck size={14} className="text-accent" />
          {userRole?.replace('_', ' ')}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar"
      >
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 ${
                  msg.role === 'user' 
                    ? 'bg-accent border-white/20 shadow-xl shadow-accent/20' 
                    : 'bg-slate-800 border-white/10 shadow-lg'
                }`}>
                  {msg.role === 'user' ? <User size={22} className="text-white" /> : <Bot size={22} className="text-accent" />}
                </div>
                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-6 py-4 rounded-3xl shadow-xl ${
                    msg.role === 'user' 
                      ? 'bg-accent text-white rounded-tr-none' 
                      : 'bg-white/10 text-white/90 rounded-tl-none border border-white/5 backdrop-blur-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>
                    ) : (
                      <div className="text-[15px] leading-relaxed font-medium markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 animate-fade-in">
                      {msg.sources.map((src, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-white/50 hover:text-white/80 hover:bg-white/10 transition-all cursor-default">
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
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-5">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-white/10 flex items-center justify-center shadow-lg">
                <Loader2 size={22} className="text-accent animate-spin" />
              </div>
              <div className="px-6 py-4 rounded-3xl bg-white/5 text-white/40 text-[15px] font-medium animate-pulse border border-white/5">
                Parsing neural index for matching vectors...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-8 bg-white/5 backdrop-blur-xl border-t border-white/5">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question about your uploaded documents..."
            className="w-full bg-slate-900/60 border border-white/10 rounded-3xl px-8 py-5 text-[15px] focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent/40 transition-all placeholder:text-white/20 shadow-inner group-hover:border-white/20"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
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

