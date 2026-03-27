import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import DocumentManager from './components/DocumentManager';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import { LogOut } from 'lucide-react';
import ComplianceDashboard from './components/ComplianceDashboard';
import PolicyFramework from './components/PolicyFramework';

function App() {
  const [activeTab, setActiveTab]           = useState('chat');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authView, setAuthView]             = useState('login');
  const [user, setUser]                     = useState(null);
  const [loading, setLoading]               = useState(true);

  // ── Session management ───────────────────────────────────────────────────
  // Each chat session gets a unique UUID. A new one is generated on login
  // or when the user clicks "New Chat".
  const [currentSessionId, setCurrentSessionId] = useState(() => crypto.randomUUID());
  const [sessions, setSessions]                 = useState([]);
  const [sessionsLoading, setSessionsLoading]   = useState(false);

  // Fetch the list of past sessions from the backend
  const refreshSessions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSessionsLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/chat/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // ── Auth check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      try {
        const response = await fetch('http://127.0.0.1:8000/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
        }
      } catch (err) {
        console.error('Auth check failed', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Fetch sessions once authenticated
  useEffect(() => {
    if (isAuthenticated) refreshSessions();
  }, [isAuthenticated, refreshSessions]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    // Fresh session on every login
    setCurrentSessionId(crypto.randomUUID());
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    setActiveTab('chat');
    setSessions([]);
    setCurrentSessionId(crypto.randomUUID());
  };

  // Called from Sidebar "New Chat" button
  const handleNewChat = () => {
    setCurrentSessionId(crypto.randomUUID());
    setActiveTab('chat');
  };

  // Called from Sidebar when user clicks a past session
  const handleSelectSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    setActiveTab('chat');
  };

  // Called from ChatWindow after a message is successfully sent
  // so the sessions list stays up-to-date
  const handleMessageSent = () => {
    refreshSessions();
  };

  // ── Loading / auth gates ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <Register onBackToLogin={() => setAuthView('login')} />;
    }
    return <Login onLogin={handleLogin} onSwitchToRegister={() => setAuthView('register')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return (
          <ChatWindow
            userRole={user?.role}
            sessionId={currentSessionId}
            onMessageSent={handleMessageSent}
          />
        );
      case 'documents':
        return <DocumentManager />;
      case 'dashboard':
        return <ComplianceDashboard />;
      case 'policies':
        return <PolicyFramework userRole={user?.role} />;
      default:
        return (
          <div className="text-white/40 text-center mt-20">
            Coming Soon: {activeTab.replace('_', ' ')}
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#080d17] text-slate-100 overflow-hidden font-inter">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={user?.role}
        sessions={sessions}
        sessionsLoading={sessionsLoading}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      <main className="flex-1 p-8 lg:p-12 overflow-y-auto custom-scrollbar relative">
        <header className="flex justify-between items-center mb-12 animate-slide-up">
          <div className="relative">
            <span className="text-[10px] font-black text-accent tracking-[0.3em] uppercase opacity-80">
              {user?.department} Knowledge Cluster
            </span>
            <div className="flex items-center gap-4 mt-1">
              <h2 className="text-3xl font-bold capitalize tracking-tight">
                {activeTab.replace('_', ' ')}
              </h2>
              <div className="h-4 w-[1px] bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-white/30 text-xs font-medium uppercase tracking-widest">
                  Network Secure
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={handleLogout}
              className="p-2 text-white/40 hover:text-red-400 transition-colors bg-white/5 rounded-xl border border-white/10 hover:border-red-500/20"
              title="Logout System"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="text-right">
                <p className="text-sm font-bold text-white leading-none">{user?.username}</p>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-tighter mt-1">
                  {user?.role.replace('_', ' ')}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple-600 border-2 border-white/20 shadow-2xl flex items-center justify-center font-bold text-xl text-white overflow-hidden relative group">
                {user?.username.charAt(0).toUpperCase()}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </div>
            </div>
          </div>
        </header>

        <div className="h-[calc(100%-100px)]">{renderContent()}</div>

        <div className="fixed -top-24 -right-24 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
      </main>
    </div>
  );
}

export default App;