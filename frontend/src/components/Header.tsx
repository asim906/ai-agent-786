'use client';

interface HeaderProps {
  user: { email: string; photoURL?: string };
  connectionStatus: string;
  onLogout: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDemo?: boolean;
}

export default function Header({ user, connectionStatus, onLogout, activeTab, onTabChange, isDemo }: HeaderProps) {
  return (
    <header className="flex-row items-center justify-between px-24 py-16" style={{ 
      borderBottom: '1px solid var(--border)',
      background: 'rgba(7, 11, 20, 0.4)', backdropFilter: 'blur(20px)', zIndex: 10
    }}>
      <div className="flex-row items-center gap-16">
        <h2 style={{ fontSize: '1.25rem', fontFamily: 'Outfit', fontWeight: 700, textTransform: 'capitalize' }}>
            {activeTab === 'chat' ? 'Conversations' : activeTab}
        </h2>
        <div className="flex-row items-center gap-8 px-12 py-8" style={{ 
            borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
            <div className={connectionStatus === 'connected' ? 'pulse-primary' : ''} style={{ 
                width: 8, height: 8, borderRadius: '50%', 
                background: connectionStatus === 'connected' ? 'var(--accent-green)' : '#ef4444' 
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: connectionStatus === 'connected' ? 'var(--accent-green)' : '#ef4444', letterSpacing: '0.5px' }}>
                {connectionStatus === 'connected' ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
        </div>
      </div>

      <div className="flex-row items-center gap-16">
        {isDemo && (
            <div className="badge badge-purple" style={{ fontSize: '0.7rem', fontWeight: 800 }}>PRO PLAN</div>
        )}
        <div className="flex-row items-center gap-12 px-12 py-8" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.email?.split('@')[0]}</span>
            <div className="avatar" style={{ width: 32, height: 32, background: 'var(--bg-active)', fontSize: '0.8rem' }}>
                {user.email?.[0].toUpperCase()}
            </div>
        </div>
      </div>
    </header>
  );
}
