import React, { useState, useEffect } from 'react';
import { Shield, Search, BookOpen, ExternalLink, Filter, ChevronRight } from 'lucide-react';
import axios from 'axios';

const PolicyFramework = ({ userRole }) => {
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const handleDownload = async (docId, fileName) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/v1/ingest/download/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download document", error);
      alert("Failed to download document from secure vault.");
    }
  };

  useEffect(() => {
    const fetchDocs = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/v1/ingest/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDocuments(response.data);
      } catch (error) {
        console.error("Failed to fetch policies:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.dept.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-[500px]">
      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in p-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase tracking-[0.1em]">Branch SOP Vault</h2>
          <p className="text-xs text-white/30 uppercase font-bold tracking-widest mt-1">Authorized Banking Regulatory Assets</p>
        </div>
        
        <div className="relative group w-full lg:w-96">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-white/20 group-hover:text-accent transition-colors" />
          </div>
          <input
            type="text"
            placeholder="SEARCH POLICIES OR DEPARTMENTS..."
            className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest text-white placeholder:text-white/10 focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full py-20 text-center glass rounded-[2.5rem] border border-dashed border-white/10">
             <Shield className="mx-auto text-white/5 mb-4" size={48} />
             <p className="text-xs font-black text-white/20 uppercase tracking-[0.2em]">No matching regulatory assets found</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div key={doc.id} className="glass p-8 rounded-[2.5rem] border border-white/5 bg-slate-900/40 hover:bg-slate-900/60 hover:border-white/20 transition-all duration-500 group relative overflow-hidden h-full flex flex-col">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <BookOpen size={60} />
              </div>
              
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 bg-accent/10 rounded-2xl group-hover:scale-110 transition-transform duration-500 border border-accent/20">
                  <Shield className="text-accent" size={24} />
                </div>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-tighter ${
                  doc.level === 'public' ? 'text-green-400 bg-green-500/10' :
                  doc.level === 'compliance' ? 'text-purple-400 bg-purple-500/10' :
                  'text-blue-400 bg-blue-500/10'
                }`}>
                  {doc.level}_ACCESS
                </span>
              </div>

              <h4 className="text-base font-black text-white group-hover:text-accent transition-colors leading-tight mb-2 uppercase tracking-tight line-clamp-2">
                {doc.name}
              </h4>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-6">{doc.dept} • VERSION 1.0</p>
              
              <div className="space-y-4 mt-auto">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:border-white/10 transition-all">
                  <p className="text-[10px] text-accent/60 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Filter size={10} /> AI_INSIGHT
                  </p>
                  <p className="text-[11px] text-white/40 leading-relaxed italic line-clamp-3">
                    "{doc.summary}"
                  </p>
                </div>
                
                <button 
                  onClick={() => handleDownload(doc.id, doc.name)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 text-white/60 hover:text-white group/btn"
                >
                  Reference Asset <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PolicyFramework;
