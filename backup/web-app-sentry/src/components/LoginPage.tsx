import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Database, LogIn, AlertCircle, Eye, EyeOff, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1f1633] relative overflow-hidden">
      {/* Background ambient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Ambient glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6a5fc1] opacity-10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#c2ef4e] opacity-5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#422082] opacity-20 rounded-full blur-[150px]" />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(106, 95, 193, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(106, 95, 193, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo Section */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#6a5fc1] to-[#422082] shadow-[rgba(22,15,36,0.9)_0px_4px_20px_9px] relative">
            <Database size={36} className="text-white" />
            <div className="absolute -top-1 -right-1">
              <Sparkles size={16} className="text-[#c2ef4e]" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Matrix VC
          </h1>
          <p className="text-[#e5e7eb] text-sm font-medium uppercase tracking-[0.2px]">
            Text-to-SQL Intelligence
          </p>
        </div>

        {/* Login Form */}
        <div 
          className="rounded-[12px] p-8 relative"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(18px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 'rgba(0, 0, 0, 0.1) 0px 10px 15px -3px'
          }}
        >
          {/* Decorative corner accent */}
          <div className="absolute -top-px -left-px w-16 h-16 overflow-hidden rounded-tl-[12px]">
            <div className="absolute top-0 left-0 w-[1px] h-8 bg-gradient-to-b from-[#c2ef4e] to-transparent" />
            <div className="absolute top-0 left-0 h-[1px] w-8 bg-gradient-to-r from-[#c2ef4e] to-transparent" />
          </div>

          <h2 className="mb-6 text-lg font-semibold text-white uppercase tracking-[0.2px]">
            Sign In
          </h2>

          {error && (
            <div 
              className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(250, 127, 170, 0.15)',
                border: '1px solid rgba(250, 127, 170, 0.3)',
                color: '#fa7faa'
              }}
            >
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label 
                className="mb-2 block text-sm font-medium text-[#e5e7eb] uppercase tracking-[0.2px]"
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#e5e7eb]/50 focus:outline-none transition-all"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid #362d59',
                }}
                placeholder="Enter username"
              />
            </div>

            <div>
              <label 
                className="mb-2 block text-sm font-medium text-[#e5e7eb] uppercase tracking-[0.2px]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg px-4 py-3 pr-12 text-sm text-white placeholder:text-[#e5e7eb]/50 focus:outline-none transition-all"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid #362d59',
                  }}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#e5e7eb]/60 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3 text-sm font-bold uppercase tracking-[0.2px] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#79628c',
                border: '1px solid #584674',
                boxShadow: 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px inset',
              }}
              onMouseEnter={(e) => {
                if (!loading && username && password) {
                  e.currentTarget.style.boxShadow = 'rgba(0, 0, 0, 0.18) 0px 0.5rem 1.5rem';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'rgba(0, 0, 0, 0.1) 0px 1px 3px 0px inset';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading ? (
                <span className="animate-pulse">Signing in...</span>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </form>

          <div 
            className="mt-5 text-center text-xs py-2 px-3 rounded-lg"
            style={{
              backgroundColor: 'rgba(194, 239, 78, 0.1)',
              border: '1px solid rgba(194, 239, 78, 0.2)',
              color: '#c2ef4e'
            }}
          >
            Demo: <span className="font-mono font-semibold">admin</span> / <span className="font-mono font-semibold">admin123</span>
          </div>
        </div>

        {/* Footer text */}
        <p className="mt-8 text-center text-xs text-[#e5e7eb]/50 uppercase tracking-[0.25px]">
          Natural Language to SQL Query Engine
        </p>
      </div>
    </div>
  );
}
