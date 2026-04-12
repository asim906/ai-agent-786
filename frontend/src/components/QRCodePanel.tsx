'use client';
import { useEffect, useState } from 'react';

interface QRCodePanelProps {
  qrCode: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'needs_qr';
  onRequestQR: () => void;
}

export default function QRCodePanel({ qrCode, connectionStatus, onRequestQR }: QRCodePanelProps) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (connectionStatus !== 'connecting') return;
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(iv);
  }, [connectionStatus]);

  if (connectionStatus === 'connected') {
    return (
      <div className="fade-up">
        <div className="glass-card" style={{ padding: 32, textAlign: 'center', background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.1)' }}>
            <div className="mx-auto pulse-primary" style={{
            width: 90, height: 90, borderRadius: '24px',
            background: 'var(--accent-green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem', marginBottom: 24,
            boxShadow: '0 12px 32px rgba(34, 197, 94, 0.3)',
            }}>✓</div>
            <h3 style={{ fontSize: '1.4rem', fontFamily: 'Outfit', color: '#fff', marginBottom: 8 }}>Instance Active</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            The AI node is securely synced with your WhatsApp profile. All automation systems are operational.
            </p>
        </div>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="glass-card p-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Encryption Status</span>
                <span className="badge badge-green">End-to-End</span>
            </div>
            <div className="glass-card p-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Session Type</span>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Persistent</span>
            </div>
        </div>

        <button className="btn btn-secondary w-full" onClick={onRequestQR} style={{ marginTop: 32, padding: 14, borderRadius: 16 }}>
          🔄 Reset Instance Connection
        </button>
      </div>
    );
  }

  if (qrCode) {
    return (
      <div className="fade-up">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h3 style={{ fontSize: '1.5rem', fontFamily: 'Outfit', marginBottom: 8 }}>Device Pairing</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Securely link your account to launch the AI.</p>
        </div>

        <div className="glass-card p-16 mb-32 mx-auto" style={{ width: 220, height: 220, background: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', borderRadius: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCode}
            alt="WhatsApp QR Code"
            width={188}
            height={188}
            style={{ display: 'block' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {[
                { step: '1', icon: '📱', text: 'Open WhatsApp on your mobile' },
                { step: '2', icon: '⋮', text: 'Settings > Linked Devices' },
                { step: '3', icon: '📷', text: 'Scan the secure entry code' }
            ].map((s) => (
                <div key={s.step} className="p-14" style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ 
                        width: 28, height: 28, borderRadius: 8, background: 'var(--bg-active)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-green)'
                    }}>{s.step}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{s.text}</div>
                </div>
            ))}
        </div>

        <button className="btn btn-secondary w-full" onClick={onRequestQR} style={{ padding: 14, borderRadius: 16 }}>
          🔄 Generate New Token
        </button>
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ textAlign: 'center', paddingTop: 60 }}>
      <div className="hover-float mx-auto shimmer-text" style={{ fontSize: '6rem', marginBottom: 32, width: 'fit-content' }}>🛡️</div>
      <h3 style={{ fontSize: '1.6rem', fontFamily: 'Outfit', marginBottom: 12, fontWeight: 800 }}>Core Offline</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 40, maxWidth: 280, marginInline: 'auto' }}>
        Link your WhatsApp account to enable the intelligent automation brain and start processing messages.
      </p>
      <button className="btn btn-primary w-full" onClick={onRequestQR} style={{ padding: '16px', fontSize: '1.1rem', borderRadius: 18 }}>
        🚀 Initialize Connection
      </button>
    </div>
  );
}
