'use client';

interface MainSidebarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  onLogout: () => void;
  email?: string;
}

const NAV_ITEMS = [
  { id: 'chat',      icon: '💬', label: 'Chat' },
  { id: 'tools',     icon: '🛠️', label: 'Tools' },
  { id: 'leads',     icon: '📋', label: 'Leads' },
  { id: 'analytics', icon: '📊', label: 'Analytics' },
  { id: 'settings',  icon: '⚙️', label: 'Settings' },
];

export default function MainSidebar({ activeTab, onTabChange, onLogout, email }: MainSidebarProps) {
  return (
    <aside className="glass-panel flex-col items-center flex-shrink-0" style={{ 
      width: 86, height: '100vh', padding: '32px 0', borderRight: '1px solid var(--border)',
      background: 'var(--bg-sidebar)', zIndex: 50, position: 'relative'
    }}>
      {/* App Logo - High-end Branding Merge */}
      <div 
        onClick={() => onTabChange('chat')}
        className="flex-col items-center justify-center hover-float mb-24"
        style={{
          width: 48, height: 48, borderRadius: '16px',
          background: 'linear-gradient(135deg, var(--accent-green), var(--accent-green-dark))',
          fontSize: '1.5rem',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)', cursor: 'pointer',
          transition: 'var(--transition)'
        }}
      >💬</div>

      {/* Nav Items - Professional 16px vertical rhythm */}
      <div className="flex-1 flex-col items-center gap-16 w-full mt-16">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex-row items-center justify-center relative ${activeTab === item.id ? 'active' : ''}`}
            style={{
              width: 56, height: 56, borderRadius: '16px', fontSize: '1.5rem',
              border: 'none', cursor: 'pointer',
              background: activeTab === item.id ? 'var(--bg-active)' : 'transparent',
              transition: 'var(--transition)',
              color: activeTab === item.id ? 'var(--accent-green)' : 'var(--text-secondary)'
            }}
            title={item.label}
          >
            {activeTab === item.id && (
                <div className="absolute" style={{ 
                    left: -15, top: '25%', bottom: '25%', width: 4, 
                    background: 'var(--accent-green)', borderRadius: '0 6px 6px 0',
                    boxShadow: 'var(--shadow-glow)'
                }} />
            )}
            <span style={{ 
                opacity: activeTab === item.id ? 1 : 0.6,
                transform: activeTab === item.id ? 'scale(1.1)' : 'scale(1)',
                transition: 'var(--transition)'
            }}>{item.icon}</span>
          </button>
        ))}
      </div>

      {/* Profile & Logout - Bottom Panel */}
      <div className="flex flex-col items-center gap-6 w-full">
          <div style={{ position: 'relative' }}>
              <div className="avatar flex items-center justify-center" style={{ 
                  width: 44, height: 44, background: 'rgba(255,255,255,0.05)', border: '2px solid var(--border)',
                  fontSize: '1rem', fontWeight: 700, borderRadius: 14
              }}>
                  {email ? email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ 
                  position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, 
                  borderRadius: '50%', background: 'var(--accent-green)', border: '3px solid var(--bg-sidebar)' 
              }} />
          </div>

          <button 
            onClick={onLogout}
            className="btn-ghost"
            style={{ 
                width: 52, height: 52, borderRadius: 16, fontSize: '1.3rem', 
                color: 'rgba(239, 68, 68, 0.6)', transition: 'var(--transition)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer'
            }}
            title="Sign Out"
            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'}
          >
            ⏻
          </button>
      </div>
    </aside>
  );
}
