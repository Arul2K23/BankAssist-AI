import React, { useState } from 'react';
import { Lock, User, Users, Building, ArrowLeft, ShieldPlus } from 'lucide-react';


const Register = ({ onBackToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'external_customer',
    department: 'General'
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const roles = [
    { label: 'External Customer', value: 'external_customer' },
    { label: 'Customer Support', value: 'customer_support_agent' },
    { label: 'Internal Employee', value: 'internal_employee' },
    { label: 'Compliance Officer', value: 'compliance_officer' },
    { label: 'System Admin', value: 'administrator' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Registration failed');
      }

      setSuccess(true);
      setTimeout(() => onBackToLogin(), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6 text-center">
        <div className="glass p-10 rounded-3xl border border-blue-500/20 max-w-sm animate-fade-in">
           <div className="p-4 bg-green-500/20 rounded-full w-fit mx-auto mb-6">
              <ShieldPlus className="w-10 h-10 text-green-400" />
           </div>
           <h2 className="text-2xl font-bold mb-2">Registration Successful</h2>
           <p className="text-white/40">Your credentials have been provisioned. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6 lg:p-12">
      <div className="w-full max-w-lg animate-fade-in">
        <button 
          onClick={onBackToLogin}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to standard login
        </button>

        <div className="text-left mb-8">
          <h1 className="text-4xl font-bold tracking-tight">Request <span className="gradient-text">Console Access</span></h1>
          <p className="text-white/40 mt-2">Provision new enterprise credentials</p>
        </div>

        <div className="glass p-8 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2 ml-1">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="User ID"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-2 ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2 ml-1">Assigned Role</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />

                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer"
                >
                  {roles.map(r => <option key={r.value} value={r.value} className="bg-slate-900">{r.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2 ml-1">Department</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  placeholder="e.g. Retail Banking"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl transition-all border border-white/10 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Provisioning...' : 'Complete Registration'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
