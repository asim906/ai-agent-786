'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthError,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-select mode from URL query (?mode=signup or ?mode=login)
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('mode');
    if (m === 'signup') setMode('signup');
    else setMode('login');
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err) {
      const e = err as AuthError;
      const msg: Record<string, string> = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
      };
      setError(msg[e.code] || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-panel fade-up" style={{ 
        width: '100%', maxWidth: 460, padding: 48, borderRadius: 'var(--radius-xl)' 
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent-green), var(--accent-green-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
            boxShadow: '0 0 24px rgba(34, 197, 94, 0.4)'
          }}>💬</div>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit' }}>WA<span style={{ color: 'var(--accent-green)' }}>·AI</span></span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: '1.8rem', marginBottom: 8 }}>
              {mode === 'login' ? 'Welcome Back' : 'Get Started'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {mode === 'login' ? 'Sign in to manage your AI agent' : 'Create an account to start automating'}
            </p>
        </div>

        {/* Mode switcher */}
        <div style={{ 
          display: 'flex', background: 'var(--bg-input)', padding: 6, 
          borderRadius: 'var(--radius-md)', marginBottom: 32 
        }}>
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: mode === m ? 'var(--accent-green)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-secondary)',
                fontWeight: 600, cursor: 'pointer', transition: 'var(--transition)'
              }}
            >
              {m === 'login' ? '🔑 Sign In' : '✨ Sign Up'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ 
            padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444',
            borderRadius: 'var(--radius-md)', marginBottom: 24, fontSize: '0.85rem'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: 8 }}>Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="name@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ marginBottom: 8 }}>Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '16px', fontSize: '1rem', marginTop: 12 }}
          >
            {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div style={{ 
          marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border)', 
          textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' 
        }}>
          Secure authentication powered by Firebase. <br/> 
          <span style={{ fontSize: '0.75rem', marginTop: 8, display: 'block' }}>All project data stays 100% private.</span>
        </div>
      </div>
    </div>
  );
}
