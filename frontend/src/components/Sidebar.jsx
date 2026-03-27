import React, { useState } from 'react';
import { LayoutDashboard, MessageSquare, ShieldCheck, FileText, Plus, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatSessionDate = (isoString) => {
  if (!isoString) return 'Unknown';
  const date = new Date(isoString);
  const now   = new Date();
  const diffMs   = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)   return 'Just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffDays === 0) return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Component ─────────────────────────────────────────────────────────────────
const Sidebar = ({
  activeTab,
  setActiveTab,
  userRole,
  sessions          = [],
  sessionsLoading   = false,
  currentSessionId,
  onNewChat,
  onSelectSession,
}) => {
  const [historyExpanded, setHistoryExpanded] = useState(true);

  const menuItems = [
    {
      id:    'dashboard',
      label: 'Operations Audit',
      icon:  LayoutDashboard,
      roles: ['administrator', 'internal_employee', 'compliance_officer'],
    },
    {
      id:    'chat',
      label: 'Neural Search',
      icon:  MessageSquare,
      roles: ['administrator', 'internal_employee', 'compliance_officer', 'public'],
    },
    {
      id:    'documents',
      label: 'Knowledge Ingest',
      icon:  FileText,
      roles: ['administrator', 'internal_employee', 'compliance_officer'],
    },
    {
      id:    'policies',
      label: 'Branch SOP Vault',
      icon:  ShieldCheck,
      roles: ['administrator', 'internal_employee', 'compliance_officer'],
    },
  ];

  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(userRole));

  return (
    <div className="w-80 h-screen bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col p-8 transition-all duration-500 shadow-[20px_0_40px_rgba(0,0,0,0.3)]">

      {/* Logo */}
      <div className="flex items-center gap-4 mb-10 animate-fade-in">
        <div className="w-14 h-14 bg-gradient-to-br from-accent to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-accent/40 border border-white/20 relative overflow-hidden group">
          <ShieldCheck className="text-white relative z-10 group-hover:scale-110 transition-transform" size={28} />
          <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter text-white">
            BANK<span className="text-accent">ASSIST</span>
          </h1>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-0.5">
            Banking Operations Intelligence
          </p>
        </div>
      </div>

      {/* ── New Chat Button ─────────────────────────────────────────────── */}
      <button
        onClick={() => { onNewChat(); setActiveTab('chat'); }}
        className="w-full flex items-center justify-center gap-3 mb-6 p-3.5 rounded-2xl bg-accent/20 hover:bg-accent/30 border border-accent/30 hover:border-accent/50 text-accent hover:text-white transition-all duration-300 group shadow-lg shadow-accent/5 hover:shadow-accent/20 active:scale-[0.98]"
      >
        <div className="w-6 h-6 rounded-lg bg-accent/30 group-hover:bg-accent/50 flex items-center justify-center transition-colors">
          <Plus size={14} className="text-accent group-hover:text-white transition-colors" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.2em]">New Chat</span>
      </button>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <nav className="space-y-2">
        <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 block ml-4">
          Main Interface
        </label>

        {visibleMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-400 group relative ${
              activeTab === item.id
                ? 'bg-accent/15 text-white border border-accent/30 shadow-[0_10px_20px_rgba(63,55,201,0.1)]'
                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-4">
              <item.icon
                size={20}
                className={`${activeTab === item.id ? 'text-accent' : 'group-hover:text-white/60'} transition-colors`}
              />
              <span className={`text-sm font-bold tracking-tight ${activeTab === item.id ? 'text-white' : ''}`}>
                {item.label}
              </span>
            </div>
            {activeTab === item.id && (
              <motion.div
                layoutId="active-pill"
                className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#3f37c9]"
              />
            )}
          </button>
        ))}
      </nav>

      {/* ── Recent Sessions ─────────────────────────────────────────────── */}
      <div className="mt-6 flex-1 flex flex-col min-h-0">
        {/* Section header — collapsible */}
        <button
          onClick={() => setHistoryExpanded((v) => !v)}
          className="flex items-center justify-between mb-3 ml-1 w-full group"
        >
          <div className="flex items-center gap-2">
            <Clock size={11} className="text-white/20 group-hover:text-white/40 transition-colors" />
            <label className="text-[10px] font-black text-white/20 group-hover:text-white/40 uppercase tracking-[0.3em] cursor-pointer transition-colors">
              Recent Sessions
            </label>
          </div>
          {historyExpanded
            ? <ChevronUp size={11} className="text-white/20 group-hover:text-white/40 transition-colors" />
            : <ChevronDown size={11} className="text-white/20 group-hover:text-white/40 transition-colors" />
          }
        </button>

        <AnimatePresence>
          {historyExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                {sessionsLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={14} className="text-white/20 animate-spin" />
                  </div>
                )}

                {!sessionsLoading && sessions.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-[10px] text-white/15 font-medium">No previous sessions</p>
                  </div>
                )}

                {!sessionsLoading && sessions.map((session) => {
                  const isActive = session.session_id === currentSessionId;
                  return (
                    <button
                      key={session.session_id}
                      onClick={() => { onSelectSession(session.session_id); setActiveTab('chat'); }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                        isActive
                          ? 'bg-accent/20 border border-accent/25'
                          : 'hover:bg-white/5 border border-transparent hover:border-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Active session dot */}
                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                          isActive ? 'bg-accent shadow-[0_0_6px_#3f37c9]' : 'bg-white/15'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold truncate transition-colors ${
                            isActive ? 'text-white' : 'text-white/40 group-hover:text-white/60'
                          }`}>
                            {formatSessionDate(session.started_at)}
                          </p>
                          <p className={`text-[10px] mt-0.5 transition-colors ${
                            isActive ? 'text-accent/60' : 'text-white/20 group-hover:text-white/35'
                          }`}>
                            {session.message_count} message{session.message_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {isActive && (
                          <span className="text-[9px] font-black text-accent/60 uppercase tracking-widest mt-1 shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="mt-4 shrink-0">
        <div className="glass p-6 rounded-3xl border border-white/5 bg-white/5 group hover:bg-white/10 transition-all duration-500">
          <div className="flex items-center justify-between mb-4">
            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
              userRole === 'administrator'
                ? 'bg-red-500/20 text-red-500'
                : 'bg-accent/20 text-accent'
            }`}>
              {userRole?.replace('_', ' ')}
            </div>
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] text-white/40 font-medium leading-relaxed">
            Secure connection established via Encrypted Tunnel 7.{' '}
            <span className="text-white/60 font-bold tracking-tight italic">
              Monitoring Level: Full
            </span>
          </p>
        </div>
      </div>

    </div>
  );
};

export default Sidebar;