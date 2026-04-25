import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight, Zap, Shield, TrendingUp, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

const features = [
  { icon: Zap,        label: 'AI Restocking',      desc: 'Predict reorders before stockouts happen' },
  { icon: Shield,     label: 'Anomaly Detection',   desc: 'Catch unusual movements in real-time'     },
  { icon: Globe,      label: 'Multi-Warehouse',     desc: 'Unified view across all locations'        },
  { icon: TrendingUp, label: 'Smart Analytics',     desc: 'Insights powered by machine learning'     },
];

const demoUsers = [
  { role: 'Admin',   email: 'admin@inveniq.com',   color: 'from-violet-500 to-indigo-500' },
  { role: 'Manager', email: 'manager@inveniq.com', color: 'from-cyan-500 to-blue-500'    },
  { role: 'Staff',   email: 'staff@inveniq.com',   color: 'from-emerald-500 to-teal-500' },
  { role: 'Viewer',  email: 'viewer@inveniq.com',  color: 'from-amber-500 to-orange-500' },
];

export default function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [focused, setFocused]           = useState('');
  const { login }    = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome to InvenIQ!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-primary-900 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.3)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(6,182,212,0.2)_0%,_transparent_60%)]" />

        {/* Animated orbs */}
        <div className="absolute top-24 left-16 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-32 right-8 w-96 h-96 bg-accent-500/15 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">InvenIQ</h1>
              <p className="text-primary-300 text-xs font-medium tracking-widest uppercase">Inventory Intelligence</p>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Smarter inventory,<br />
              <span className="bg-gradient-to-r from-accent-300 to-primary-300 bg-clip-text text-transparent">
                powered by AI.
              </span>
            </h2>
            <p className="text-primary-200/80 text-lg leading-relaxed max-w-md">
              Real-time visibility across every warehouse, every product, every movement — all in one place.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label}
                className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 hover:border-white/20 rounded-2xl p-4 transition-all duration-300 cursor-default">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-400/30 to-accent-400/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon className="w-4 h-4 text-accent-300" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1">{label}</h3>
                <p className="text-primary-300/70 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between">
          <p className="text-primary-400/60 text-xs">© 2025 InvenIQ · All rights reserved</p>
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`h-1 rounded-full bg-primary-400/40 ${i === 0 ? 'w-6' : 'w-2'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-slate-950 relative overflow-hidden">
        {/* Subtle bg glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">InvenIQ</h1>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-slate-400">Sign in to your workspace</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Email address</label>
              <div className={`relative rounded-xl transition-all duration-200 ${focused === 'email' ? 'ring-2 ring-primary-500/50' : ''}`}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                  placeholder="you@company.com"
                  autoFocus
                  className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600
                             focus:outline-none focus:border-primary-500/60 transition-colors text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className={`relative rounded-xl transition-all duration-200 ${focused === 'password' ? 'ring-2 ring-primary-500/50' : ''}`}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder:text-slate-600
                             focus:outline-none focus:border-primary-500/60 transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm text-white
                         bg-gradient-to-r from-primary-600 to-primary-500
                         hover:from-primary-500 hover:to-accent-500
                         disabled:opacity-60 disabled:cursor-not-allowed
                         transition-all duration-300 shadow-lg shadow-primary-500/20
                         hover:shadow-primary-500/40 hover:scale-[1.01] active:scale-[0.99]
                         flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-7">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-600 font-medium uppercase tracking-wider">Demo accounts</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Demo credentials */}
          <div className="grid grid-cols-2 gap-2.5">
            {demoUsers.map(({ role, email: em, color }) => (
              <button
                key={role}
                onClick={() => { setEmail(em); setPassword('Admin@123'); }}
                className="group relative flex flex-col items-start p-3.5 rounded-xl bg-slate-900 border border-slate-800
                           hover:border-slate-700 hover:bg-slate-800/80 transition-all duration-200 text-left overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r ${color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <span className={`text-xs font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent mb-0.5`}>{role}</span>
                <span className="text-[11px] text-slate-500 truncate w-full">{em}</span>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-600 mt-3">Password for all: <span className="text-slate-500 font-mono">Admin@123</span></p>
        </div>
      </div>
    </div>
  );
}
