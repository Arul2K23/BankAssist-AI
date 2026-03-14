import React from 'react';
import { LayoutDashboard, MessageSquare, ShieldCheck, FileText, Settings, LogOut, User } from 'lucide-react';
import { motion } from 'framer-motion';

const Sidebar = ({ activeTab, setActiveTab, userRole }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Operations Audit', icon: LayoutDashboard, restricted: true },
    { id: 'chat', label: 'Neural Search', icon: MessageSquare },
    { id: 'documents', label: 'Knowledge Ingest', icon: FileText, restricted: true },
    { id: 'policies', label: 'Branch SOP Vault', icon: ShieldCheck },
  ];

  return (
    <div className="w-80 h-screen bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col p-8 transition-all duration-500 shadow-[20px_0_40px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-4 mb-16 animate-fade-in">
        <div className="w-14 h-14 bg-gradient-to-br from-accent to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-accent/40 border border-white/20 relative overflow-hidden group">
          <ShieldCheck className="text-white relative z-10 group-hover:scale-110 transition-transform" size={28} />
          <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
        </div>
        <div>
           <h1 className="text-2xl font-black tracking-tighter text-white">BANK<span className="text-accent">ASSIST</span></h1>
           <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-0.5">Banking Operations Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 space-y-3">
        <label className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-6 block ml-4">Main Interface</label>
        {menuItems.map(item => {
          const isRestricted = item.restricted && !['administrator', 'internal_employee', 'compliance_officer'].includes(userRole);
          
          return (
            <button
              key={item.id}
              onClick={() => !isRestricted && setActiveTab(item.id)}
              disabled={isRestricted}
              className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-400 group relative ${
                activeTab === item.id 
                  ? 'bg-accent/15 text-white border border-accent/30 shadow-[0_10px_20px_rgba(63,55,201,0.1)]' 
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              } ${isRestricted ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
            >
              <div className="flex items-center gap-4">
                <item.icon size={20} className={`${activeTab === item.id ? 'text-accent' : 'group-hover:text-white/60'} transition-colors`} />
                <span className={`text-sm font-bold tracking-tight ${activeTab === item.id ? 'text-white' : ''}`}>{item.label}</span>
              </div>
              
              {activeTab === item.id && (
                <motion.div 
                  layoutId="active-pill"
                  className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_#3f37c9]"
                />
              )}
              
              {isRestricted && (
                <Lock size={12} className="text-white/40" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="glass p-6 rounded-3xl border border-white/5 bg-white/5 group hover:bg-white/10 transition-all duration-500">
           <div className="flex items-center justify-between mb-4">
              <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                userRole === 'administrator' ? 'bg-red-500/20 text-red-500' : 'bg-accent/20 text-accent'
              }`}>
                {userRole?.replace('_', ' ')}
              </div>
              <div className="flex gap-1">
                 <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
              </div>
           </div>
           <p className="text-[10px] text-white/40 font-medium leading-relaxed">
             Secure connection established via Encrypted Tunnel 7. <br/>
             <span className="text-white/60 font-bold tracking-tight italic">Monitoring Level: Full</span>
           </p>
        </div>
      </div>
    </div>
  );
};

const Lock = ({ size, className }) => (
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
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default Sidebar;

