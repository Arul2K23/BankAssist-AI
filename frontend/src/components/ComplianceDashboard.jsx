import React, { useState, useEffect } from 'react';
import { ShieldCheck, History, Activity, Database, Users, MessageSquare } from 'lucide-react';
import axios from 'axios';

const ComplianceDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      try {
        const [logsRes, statsRes] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/v1/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('http://127.0.0.1:8000/api/v1/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setLogs(logsRes.data);
        setStats(statsRes.data);
      } catch (error) {
        console.error("Admin access denied or server error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[600px]">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <ShieldCheck size={48} className="text-accent" />
        <p className="text-xs font-black uppercase tracking-[0.3em] text-white/40">Securing Admin Tunnel...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-fade-in p-2">
      <div className="flex items-center justify-between">
         <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase tracking-[0.1em]">Operations Audit</h2>
            <p className="text-xs text-white/30 uppercase font-bold tracking-widest mt-1">Branch Oversight & Regulatory Monitoring</p>
         </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-6">
          <div className="glass p-8 rounded-[2rem] border border-white/5 bg-slate-900/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Database size={60} />
            </div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Neural Assets</p>
            <h4 className="text-4xl font-black text-white">{stats.total_documents}</h4>
            <p className="text-[9px] text-accent font-bold mt-2 uppercase">Indexed Documents</p>
          </div>
          <div className="glass p-8 rounded-[2rem] border border-white/5 bg-slate-900/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users size={60} />
            </div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Personnel</p>
            <h4 className="text-4xl font-black text-white">{stats.total_users}</h4>
            <p className="text-[9px] text-green-400 font-bold mt-2 uppercase">Authorized Profiles</p>
          </div>
          <div className="glass p-8 rounded-[2rem] border border-white/5 bg-slate-900/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <MessageSquare size={60} />
            </div>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Neural Queries</p>
            <h4 className="text-4xl font-black text-white">{stats.total_queries}</h4>
            <p className="text-[9px] text-purple-400 font-bold mt-2 uppercase">Total Interactions</p>
          </div>
        </div>
      )}

      <div className="glass p-8 rounded-[2.5rem] border border-white/10 bg-slate-900/20">
        <div className="flex items-center gap-3 mb-8">
          <History className="text-accent" size={20} />
          <h3 className="font-black text-lg uppercase tracking-widest">Real-time Audit Stream</h3>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 scrollbar-thin">
          {logs.map((log) => (
            <div key={log.id} className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-[10px] font-black text-accent">
                    {log.username.substring(0,2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-xs font-black text-white">{log.username}</span>
                    <span className="text-[10px] text-white/20 ml-2 font-bold">{log.time}</span>
                  </div>
                </div>
                <div className="text-[9px] font-black px-2 py-0.5 bg-green-500/10 text-green-400 rounded uppercase tracking-tighter">SECURE_LOG</div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-white/60 font-medium">
                  <span className="text-accent/60 mr-2 font-black uppercase text-[9px]">Query:</span>
                  {log.query}
                </p>
                <p className="text-[11px] text-white/30 italic leading-relaxed">
                  <span className="text-white/20 mr-2 font-black uppercase text-[9px]">Neural Resp:</span>
                  {log.answer}...
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
