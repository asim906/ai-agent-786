'use client';
import { useEffect, useState } from 'react';
import { getContacts } from '@/lib/db';
import { DEMO_CONTACTS } from '@/lib/mockData';

interface Contact {
  id: string; userId: string; jid: string; name: string; phone: string;
  lastMessage: string; lastTime: number; unread: number; aiEnabled: boolean;
}

interface SidebarProps {
  userId: string;
  activeContact: Contact | null;
  onSelectContact: (c: Contact) => void;
  refreshTrigger: number;
  isDemo?: boolean;
}

function timeSince(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Sidebar({ userId, activeContact, onSelectContact, refreshTrigger, isDemo }: SidebarProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
        setContacts(DEMO_CONTACTS as any);
        setLoading(false);
        return;
    }
    if (!userId) return;
    getContacts(userId).then(data => {
      setContacts(data.sort((a, b) => b.lastTime - a.lastTime));
      setLoading(false);
    });
  }, [userId, refreshTrigger, isDemo]);

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  return (
    <aside className="glass-panel flex-col" style={{ 
        width: 320, border: 'none', borderRight: '1px solid var(--border)', background: 'var(--bg-sidebar)', zIndex: 40
    }}>
      {/* Search Header */}
      <div className="p-24">
        <h3 className="mb-16 font-bold" style={{ fontSize: '1.5rem', fontFamily: 'Outfit' }}>Messages</h3>
        <div className="relative">
            <span className="absolute" style={{ left: 16, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '1.2rem' }}>🔍</span>
            <input
                type="text"
                className="input"
                placeholder="Search smart..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ 
                    paddingLeft: 46, fontSize: '0.9rem', height: 44, borderRadius: '16px'
                }}
            />
        </div>
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto px-12 pb-24">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, padding: '16px 12px', alignItems: 'center', opacity: 0.5 }}>
              <div className="skeleton" style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
                <div className="skeleton" style={{ height: 12, width: '70%' }} />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ paddingTop: 100, textAlign: 'center', color: 'var(--text-muted)' }}>
             <div style={{ fontSize: '4rem', marginBottom: 16, opacity: 0.1 }}>📭</div>
             <p style={{ fontSize: '0.9rem' }}>No conversations yet.</p>
          </div>
        ) : (
          filtered.map(contact => (
            <div
              key={contact.id}
              className={`flex-row items-center gap-14 p-16 mb-4 ${activeContact?.id === contact.id ? 'active' : ''}`}
              onClick={() => onSelectContact(contact)}
              style={{
                  cursor: 'pointer', transition: 'var(--transition)', borderRadius: '16px',
                  background: activeContact?.id === contact.id ? 'var(--bg-active)' : 'transparent',
                  border: activeContact?.id === contact.id ? '1px solid var(--border-accent)' : '1px solid transparent'
              }}
            >
              {/* Avatar */}
              <div className="avatar relative flex-shrink-0 flex items-center justify-center" style={{
                width: 48, height: 48, borderRadius: '50%', fontSize: '1.2rem', fontWeight: 700,
                background: `linear-gradient(135deg, hsl(${contact.name.charCodeAt(0) * 11 % 360}, 65%, 45%), transparent)`,
                boxShadow: activeContact?.id === contact.id ? 'var(--shadow-glow)' : 'none',
                border: activeContact?.id === contact.id ? '2px solid var(--accent-green)' : '2px solid var(--border)'
              }}>
                {contact.name.trim().split(/\s+/).map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                {contact.aiEnabled && (
                  <div title="AI Intelligence Enabled" className="absolute flex-row items-center justify-center" style={{
                    top: -4, right: -4, width: 20, height: 20, borderRadius: '8px',
                    background: 'var(--accent-purple)', border: '2px solid var(--bg-sidebar)',
                    fontSize: '10px', color: '#fff', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                  }}>🤖</div>
                )}
              </div>

              {/* Info Area */}
              <div className="flex-1 overflow-hidden" style={{ minWidth: 0 }}>
                <div className="flex-row items-center justify-between mb-4 gap-8">
                  <span className="font-semibold text-sm text-ellipsis-1 flex-1" style={{ color: activeContact?.id === contact.id ? '#fff' : 'var(--text-primary)' }}>{contact.name}</span>
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{timeSince(contact.lastTime)}</span>
                </div>
                <div className="flex-row items-center justify-between gap-12">
                  <p className="text-sm text-ellipsis-1 flex-1" style={{
                    color: activeContact?.id === contact.id ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)',
                    fontWeight: contact.unread > 0 ? 600 : 400
                  }}>
                    {contact.lastMessage}
                  </p>
                  {contact.unread > 0 && (
                    <div className="badge flex-row items-center justify-center font-bold" style={{ 
                        background: 'var(--accent-green)', color: '#fff', minWidth: 20, height: 20, 
                        borderRadius: '8px', padding: '0 6px', fontSize: '0.7rem' 
                    }}>
                        {contact.unread}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isDemo && (
          <div style={{ 
              margin: '0 12px 12px 12px', padding: '12px', borderRadius: 16, textAlign: 'center', 
              background: 'rgba(34, 197, 94, 0.05)', color: 'var(--accent-green)', 
              fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(34, 197, 94, 0.1)' 
          }}>
              🛡️ ENCRYPTED DEMO ACTIVE
          </div>
      )}
    </aside>
  );
}
