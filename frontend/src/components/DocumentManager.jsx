import React, { useState } from 'react';
import { Upload, File, CheckCircle2, AlertCircle, Loader2, Database, Trash2 } from 'lucide-react';
import axios from 'axios';

const DocumentManager = () => {
  const [file, setFile] = useState(null);
  const [accessLevel, setAccessLevel] = useState('internal');
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState(null);
  const [documents, setDocuments] = useState([]);

  const fetchDocuments = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/v1/ingest/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Are you sure you want to PERMANENTLY delete this document and its AI memory?")) return;
    
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://127.0.0.1:8000/api/v1/ingest/${docId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchDocuments(); // Refresh list
    } catch (error) {
      console.error("Deletion failed:", error);
      alert("Failed to delete document.");
    }
  };

  React.useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setStatus({ type: 'info', message: 'Initiating neural indexing...' });

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('access_level', accessLevel);
    formData.append('department', 'General');
    formData.append('version', '1.0');

    try {
      await axios.post('http://127.0.0.1:8000/api/v1/ingest/upload', formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setStatus({ type: 'success', message: 'Document provisioned and indexed successfully.' });
      setFile(null);
      fetchDocuments();
    } catch (error) {
       const errorMsg = error.response?.data?.detail || 'Handshake failed. Protocol violation or unauthorized access.';
       setStatus({ type: 'error', message: errorMsg });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-12 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter mb-2">Knowledge Archival</h1>
          <p className="text-white/40 font-medium max-w-xl">
            Provision new enterprise intelligence into the vector cluster. All uploads are synchronized across regional safe-nodes.
          </p>
        </div>
        <div className="flex gap-4">
           <div className="flex items-center gap-3 px-6 py-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.1)]">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             Qdrant Cluster: Optimized
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Upload Card */}
        <div className="lg:col-span-5 glass p-10 rounded-[2.5rem] border border-white/10 space-y-8 bg-slate-900/40 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Database size={120} />
          </div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-accent/20 rounded-2xl border border-accent/30 shadow-xl shadow-accent/10">
               <Upload className="text-accent" size={24} />
            </div>
            <div>
               <h3 className="font-bold text-xl tracking-tight">System Ingest</h3>
               <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-black mt-0.5">Level 4 Authorization Required</p>
            </div>
          </div>

          <div 
            className={`group relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-500 cursor-pointer overflow-hidden ${
              file ? 'border-accent/50 bg-accent/10' : 'border-white/10 hover:border-white/20 bg-white/5'
            }`}
            onClick={() => document.getElementById('file-input').click()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <input 
              id="file-input" 
              type="file" 
              className="hidden" 
              onChange={(e) => setFile(e.target.files[0])} 
            />
            {file ? (
              <div className="text-center relative z-10 animate-scale-in">
                <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-2xl">
                   <File className="text-accent" size={40} />
                </div>
                <p className="text-lg font-bold truncate max-w-[250px] text-white">{file.name}</p>
                <p className="text-xs text-white/40 mt-1 font-bold tracking-widest uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB • READY</p>
              </div>
            ) : (
              <div className="text-center relative z-10">
                <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5 group-hover:border-white/20 transition-all">
                   <Upload className="text-white/20 group-hover:text-white/60 transition-colors" size={40} />
                </div>
                <p className="text-sm text-white/40 font-bold uppercase tracking-widest">Select Source File</p>
                <p className="text-[10px] text-white/20 mt-2">PDF, DOCX, TXT (MAX 50MB)</p>
              </div>
            )}
          </div>

          <div className="space-y-6 relative z-10">
            <div>
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mb-3 block ml-1">Sensitivity Clearance</label>
              <div className="grid grid-cols-2 gap-3">
                 {['public', 'internal', 'restricted', 'compliance'].map(level => (
                   <button
                     key={level}
                     onClick={() => setAccessLevel(level)}
                     className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                       accessLevel === level 
                         ? 'bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(63,55,201,0.2)]' 
                         : 'bg-white/5 border-white/10 text-white/30 hover:border-white/20 hover:text-white/60'
                     }`}
                   >
                     {level}
                   </button>
                 ))}
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="w-full bg-accent hover:bg-accent-dark disabled:opacity-30 h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 transition-all shadow-2xl shadow-accent/30 active:scale-[0.98]"
            >
              {isUploading ? (
                <>
                   <Loader2 className="animate-spin" size={20} />
                   Synchronizing...
                </>
              ) : (
                <>
                   <Database size={20} />
                   Commit to Index
                </>
              )}
            </button>
          </div>

          {status && (
            <div className={`p-5 rounded-2xl flex items-center gap-4 text-sm animate-slide-up relative z-10 ${
              status.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
              status.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
              'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              <div className={`p-2 rounded-lg ${
                status.type === 'success' ? 'bg-green-500/20' : 
                status.type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'
              }`}>
                {status.type === 'success' ? <CheckCircle2 size={18} /> : 
                 status.type === 'error' ? <AlertCircle size={18} /> : <Database size={18} />}
              </div>
              <p className="font-bold tracking-tight">{status.message}</p>
            </div>
          )}
        </div>

        {/* Index Stats */}
        <div className="lg:col-span-7 space-y-10">
          <div className="glass p-10 rounded-[2.5rem] border border-white/10 bg-slate-900/20">
            <div className="flex items-center justify-between mb-10">
               <div>
                  <h3 className="font-black text-xl tracking-tight uppercase tracking-[0.1em]">Ledger Activity</h3>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Real-time Ingest Monitoring</p>
               </div>
               <button className="text-[10px] font-black text-accent uppercase tracking-widest hover:underline px-4 py-2 bg-accent/10 rounded-lg">View Full Registry</button>
            </div>
            
            <div className="space-y-5">
              {documents.length === 0 ? (
                <div className="text-center py-10 opacity-20 border-2 border-dashed border-white/10 rounded-3xl uppercase tracking-widest font-black text-xs">
                  No Neural Assets Found In Index
                </div>
              ) : (
                documents.map((doc, i) => (
                  <div key={i} className="flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-300 group">
                    <div className="flex items-center gap-5 min-w-0 flex-1">
                      <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-xl shrink-0">
                        <File size={24} className="text-white/30 group-hover:text-accent transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-extrabold tracking-tight text-white/80 truncate">{doc.name}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-[9px] font-black uppercase text-white/20 tracking-widest">{doc.dept}</span>
                          <div className="w-1 h-1 rounded-full bg-white/10"></div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest ${
                            doc.level === 'public' ? 'bg-green-500/20 text-green-400' :
                            doc.level === 'restricted' ? 'bg-red-500/20 text-red-400' :
                            doc.level === 'compliance' ? 'bg-purple-500/20 text-purple-400' :
                            doc.level === 'internal' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>{doc.level}</span>
                        </div>
                        {doc.summary && (
                          <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/5 text-[11px] text-white/50 leading-relaxed italic group-hover:text-white/70 transition-colors">
                            <span className="font-black uppercase tracking-tighter mr-2 text-accent/60">Insight:</span>
                            {doc.summary}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4 flex flex-col items-end gap-3">
                      <span className="text-[10px] font-black text-green-400 flex items-center justify-end gap-2 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                        {doc.status}
                      </span>
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 hover:bg-red-500/20 text-white/20 hover:text-red-400 rounded-lg transition-all"
                        title="Delete Document"
                      >
                        <Trash2 size={16} />
                      </button>
                      <p className="text-[10px] text-white/20 font-bold uppercase mt-1 tracking-tighter">{doc.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentManager;

