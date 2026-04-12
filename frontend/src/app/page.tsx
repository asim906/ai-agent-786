'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function WelcomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.push('/dashboard');
      else setChecking(false);
    });
    return () => unsub();
  }, [router]);

  if (checking) return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
      <div className="loader"></div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowY: 'auto' }}>

      {/* ── Ambient Glow Background ── */}
      <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'-10%', left:'-5%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(16,185,129,0.1), transparent 65%)' }} />
        <div style={{ position:'absolute', bottom:'-5%', right:'0%', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle, rgba(59,130,246,0.07), transparent 65%)' }} />
      </div>

      {/* ── Navbar ── */}
      <nav style={{
        position:'sticky', top:0, zIndex:50,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 6%', height:70,
        background:'rgba(7,11,20,0.85)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--border)'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,var(--accent-green),var(--accent-green-dark))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', boxShadow:'0 0 20px rgba(16,185,129,0.35)' }}>💬</div>
          <span style={{ fontSize:'1.3rem', fontWeight:800, fontFamily:'Outfit' }}>WA<span style={{ color:'var(--accent-green)' }}>·AI</span></span>
        </div>
        <div style={{ display:'flex', gap:12 }}>
          <button id="nav-login" onClick={() => router.push('/auth?mode=login')} className="btn btn-ghost" style={{ fontSize:'0.9rem', padding:'8px 22px' }}>Login</button>
          <button id="nav-signup" onClick={() => router.push('/auth?mode=signup')} className="btn btn-primary" style={{ fontSize:'0.9rem', padding:'8px 22px' }}>Sign Up Free</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position:'relative', zIndex:1, padding:'120px 6% 80px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' }}>
        <div className="fade-up" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:99, padding:'6px 18px', marginBottom:32 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent-green)', display:'inline-block' }} className="pulse-primary"></span>
          <span style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--accent-green)', letterSpacing:'0.12em', textTransform:'uppercase' }}>AI-Powered WhatsApp Automation</span>
        </div>

        <h1 className="fade-up" style={{ fontSize:'clamp(2.6rem,5.5vw,4.8rem)', fontWeight:900, fontFamily:'Outfit', lineHeight:1.1, maxWidth:850, marginBottom:24 }}>
          Your WhatsApp.<br/>
          <span style={{ background:'linear-gradient(90deg,var(--accent-green),#34d399,#059669)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Fully Automated.</span>
        </h1>

        <p className="fade-up" style={{ fontSize:'1.1rem', color:'var(--text-secondary)', maxWidth:580, lineHeight:1.8, marginBottom:52 }}>
          Connect your WhatsApp, train an AI agent, and automate customer replies, lead extraction, and bulk campaigns — all in one professional dashboard.
        </p>

        {/* ── 3 CTA Buttons ── */}
        <div id="hero-cta" className="fade-up" style={{ display:'flex', gap:16, flexWrap:'wrap', justifyContent:'center' }}>
          <button
            id="btn-signup"
            onClick={() => router.push('/auth?mode=signup')}
            className="btn btn-primary"
            style={{ padding:'15px 40px', fontSize:'1rem', fontWeight:700, borderRadius:14, boxShadow:'0 8px 32px rgba(16,185,129,0.28)' }}
          >
            🚀 Get Started — Free
          </button>
          <button
            id="btn-login"
            onClick={() => router.push('/auth?mode=login')}
            className="btn btn-ghost"
            style={{ padding:'15px 32px', fontSize:'1rem', fontWeight:600, borderRadius:14 }}
          >
            🔑 Login
          </button>
          <button
            id="btn-demo"
            onClick={() => router.push('/dashboard?demo=true')}
            className="btn btn-secondary"
            style={{ padding:'15px 32px', fontSize:'1rem', fontWeight:600, borderRadius:14 }}
          >
            🔮 View Demo
          </button>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{ position:'relative', zIndex:1, padding:'60px 6% 100px' }}>
        <h2 style={{ textAlign:'center', fontSize:'2rem', fontWeight:800, fontFamily:'Outfit', marginBottom:52 }}>Enterprise-Grade Features</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:24 }}>
          {[
            { icon:'🤖', title:'AI Auto-Reply', text:'Train your agent with your context. AI handles conversations 24/7 automatically.', color:'var(--accent-green)' },
            { icon:'🔗', title:'Quick QR Connect', text:'Link your WhatsApp in seconds by scanning a QR code from any phone.', color:'var(--accent-blue)' },
            { icon:'🚀', title:'Bulk Campaigns', text:'Send targeted broadcasts with intelligent anti-ban sequential delay protection.', color:'var(--accent-purple)' },
            { icon:'📋', title:'Lead Extraction', text:'Automatically extract names, emails, and phone numbers from conversations.', color:'#f59e0b' },
          ].map((f, i) => (
            <div key={i} className="glass-card fade-up" style={{ padding:36, animationDelay:`${i*0.08}s`, borderTop:`3px solid ${f.color}` }}>
              <div style={{ fontSize:'2.2rem', marginBottom:18 }}>{f.icon}</div>
              <h3 style={{ fontSize:'1.15rem', fontWeight:700, marginBottom:10 }}>{f.title}</h3>
              <p style={{ color:'var(--text-secondary)', lineHeight:1.65, fontSize:'0.9rem' }}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ position:'relative', zIndex:1, padding:'80px 6%', background:'rgba(255,255,255,0.015)', borderTop:'1px solid var(--border)', borderBottom:'1px solid var(--border)' }}>
        <h2 style={{ textAlign:'center', fontSize:'2rem', fontWeight:800, fontFamily:'Outfit', marginBottom:64 }}>Go Live in 3 Steps</h2>
        <div style={{ display:'flex', flexWrap:'wrap', gap:48, justifyContent:'center', maxWidth:900, margin:'0 auto' }}>
          {[
            { n:'01', title:'Create Account', text:'Sign up free with your email. No credit card required.' },
            { n:'02', title:'Connect WhatsApp', text:'After login, scan the QR code with your phone to link WhatsApp.' },
            { n:'03', title:'Automate & Grow', text:'Configure AI, set up campaigns, and let automation do the work.' },
          ].map((s, i) => (
            <div key={i} style={{ flex:'1 1 240px', display:'flex', alignItems:'flex-start', gap:20 }}>
              <div style={{ fontSize:'2.6rem', fontWeight:900, color:'var(--accent-green)', opacity:0.35, lineHeight:1, flexShrink:0, fontFamily:'Outfit' }}>{s.n}</div>
              <div>
                <h3 style={{ fontSize:'1.15rem', fontWeight:700, marginBottom:8 }}>{s.title}</h3>
                <p style={{ color:'var(--text-secondary)', lineHeight:1.6, fontSize:'0.9rem' }}>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ position:'relative', zIndex:1, padding:'100px 6%', textAlign:'center' }}>
        <h2 style={{ fontSize:'2.6rem', fontWeight:900, fontFamily:'Outfit', marginBottom:16 }}>Ready to Automate?</h2>
        <p style={{ color:'var(--text-secondary)', fontSize:'1.05rem', marginBottom:44 }}>Start free today. No credit card. Cancel anytime.</p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <button id="cta-start" onClick={() => router.push('/auth?mode=signup')} className="btn btn-primary" style={{ padding:'17px 48px', fontSize:'1.05rem', fontWeight:700, borderRadius:14, boxShadow:'0 8px 40px rgba(16,185,129,0.28)' }}>
            Start for Free →
          </button>
          <button id="cta-demo" onClick={() => router.push('/dashboard?demo=true')} className="btn btn-ghost" style={{ padding:'17px 32px', fontSize:'1.05rem', fontWeight:600, borderRadius:14 }}>
            View Demo
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position:'relative', zIndex:1, padding:'40px 6%', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16, color:'var(--text-muted)', fontSize:'0.82rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:22, height:22, borderRadius:6, background:'var(--accent-green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem' }}>💬</div>
          <span style={{ fontWeight:700, color:'#fff' }}>WA·AI</span>
          <span style={{ marginLeft:6 }}>© 2026 All rights reserved.</span>
        </div>
        <div style={{ display:'flex', gap:20 }}>
          <span style={{ cursor:'pointer', opacity:0.7 }}>Privacy Policy</span>
          <span style={{ cursor:'pointer', opacity:0.7 }}>Terms of Service</span>
        </div>
      </footer>
    </div>
  );
}
