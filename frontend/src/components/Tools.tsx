'use client';
import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getContacts, getSetting, setSetting } from '@/lib/db';
import { getSocket } from '@/lib/socket';

interface Contact {
  id: string; userId: string; jid: string; name: string; phone: string;
  lastMessage: string; lastTime: number; unread: number; aiEnabled: boolean;
}

interface ToolsProps {
  userId: string;
  isDemo?: boolean;
}

export default function Tools({ userId, isDemo }: ToolsProps) {
  const [activeModule, setActiveModule] = useState<'bulk' | 'webhooks' | 'api'>('bulk');

  return (
    <div className="fade-up" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 24, padding: 40, overflowY: 'auto' }}>
      
      {/* Module Navigation (Premium Tabs) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {[
          { id: 'bulk', icon: '🚀', label: 'Bulk Messaging' },
          { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
          { id: 'api', icon: '🔑', label: 'API Keys' }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setActiveModule(m.id as any)}
            className={`btn ${activeModule === m.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '12px 24px', borderRadius: 99 }}
          >
            <span style={{ fontSize: '1.2rem', marginRight: 8 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* Module Content */}
      <div style={{ flex: 1 }}>
        {activeModule === 'bulk' && <BulkMessagingModule userId={userId} isDemo={isDemo} />}
        {activeModule === 'webhooks' && <WebhooksModule userId={userId} isDemo={isDemo} />}
        {activeModule === 'api' && <APIKeysModule userId={userId} isDemo={isDemo} />}
      </div>
    </div>
  );
}

// ─── MODULE 1: BULK MESSAGING ──────────────────────────────────────────────

function BulkMessagingModule({ userId, isDemo }: { userId: string, isDemo?: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [excelNumbers, setExcelNumbers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Record<string, 'pending' | 'sent' | 'failed'>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isDemo) return;
    getContacts(userId).then(setContacts);
  }, [userId, isDemo]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDemo) return alert('Demo: Excel parsing simulated.');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      const numbers: string[] = [];
      data.forEach(row => {
        row.forEach(cell => {
          const s = String(cell).replace(/[^\d]/g, '');
          if (s.length >= 10 && s.length <= 15) numbers.push(s);
        });
      });
      setExcelNumbers(Array.from(new Set(numbers)));
    };
    reader.readAsBinaryString(file);
  };

  const toggleContact = (jid: string) => {
    const next = new Set(selectedJids);
    if (next.has(jid)) next.delete(jid);
    else next.add(jid);
    setSelectedJids(next);
  };

  const selectAll = () => {
    if (selectedJids.size === contacts.length) setSelectedJids(new Set());
    else setSelectedJids(new Set(contacts.map(c => c.jid)));
  };

  const startSending = async () => {
    if (isDemo) return alert('Demo Mode: Sending simulated. Real mode will loop through contacts with delays.');
    if (!message.trim() || isSending) return;
    
    const targets = new Set<string>();
    contacts.filter(c => selectedJids.has(c.jid)).forEach(c => targets.add(c.jid));
    excelNumbers.forEach(n => targets.add(n.includes('@') ? n : `${n}@s.whatsapp.net`));

    const targetList = Array.from(targets);
    if (targetList.length === 0) return alert('No contacts selected');

    setIsSending(true);
    setProgress(0);
    const socket = getSocket();

    for (let i = 0; i < targetList.length; i++) {
        const jid = targetList[i];
        setStatus(prev => ({ ...prev, [jid]: 'pending' }));
        try {
            socket.emit('send_message', { userId, jid, text: message });
            setStatus(prev => ({ ...prev, [jid]: 'sent' }));
        } catch (err) {
            setStatus(prev => ({ ...prev, [jid]: 'failed' }));
        }
        setProgress(Math.round(((i + 1) / targetList.length) * 100));
        await new Promise(r => setTimeout(r, 3000));
    }
    setIsSending(false);
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32 }}>
      
      {/* Contact List Glass Card */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 600, overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Contact Selection</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedJids.size} recipients selected</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>📎 Import CSV/Excel</button>
            <input type="file" ref={fileInputRef} hidden accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
            <button className="btn btn-secondary btn-sm" onClick={selectAll}>Select All</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 10 }}>
              <tr>
                <th style={{ padding: '16px 20px', width: 40 }}></th>
                <th style={{ padding: '16px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Contact Name</th>
                <th style={{ padding: '16px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>WhatsApp ID</th>
                <th style={{ padding: '16px 20px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} onClick={() => toggleContact(c.jid)} className="table-row-hover" style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '16px 20px' }}>
                     <div style={{ 
                        width: 18, height: 18, borderRadius: 4, 
                        border: `2px solid ${selectedJids.has(c.jid) ? 'var(--accent-green)' : 'var(--border)'}`,
                        background: selectedJids.has(c.jid) ? 'var(--accent-green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                     }}>
                        {selectedJids.has(c.jid) && <span style={{ fontSize: '10px' }}>✓</span>}
                     </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.phone}</td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                     {status[c.jid] === 'sent' ? <span className="badge badge-green">Sent</span> : 
                      status[c.jid] === 'failed' ? <span className="badge badge-red">Failed</span> : <span style={{ opacity: 0.3 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Composer Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="glass-panel" style={{ padding: 24, borderRadius: 20 }}>
          <h3 style={{ marginBottom: 20 }}>Message Composer</h3>
          <textarea
            className="input"
            placeholder="Type your broadcast message..."
            style={{ width: '100%', minHeight: 200, fontSize: '1rem', background: 'rgba(0,0,0,0.2)' }}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <button 
            onClick={startSending}
            disabled={isSending || !message.trim()}
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: 24, padding: 16, fontSize: '1.1rem' }}
          >
            {isSending ? `Sending... ${progress}%` : '🚀 Send Bulk Campaign'}
          </button>
          
          {isSending && (
            <div style={{ marginTop: 20 }}>
              <div style={{ height: 6, width: '100%', background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                 <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-green)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
        </div>

        <div className="glass-card" style={{ padding: 20, border: '1px solid rgba(245, 158, 11, 0.2)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <h4 style={{ color: '#f59e0b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>⚠️ Anti-Ban Safety</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Campaigns use a **3-second sequential delay**. We recommend sending to known contacts first.
            </p>
        </div>
      </div>
    </div>
  );
}

// ─── MODULE 2: WEBHOOKS ────────────────────────────────────────────────────

function WebhooksModule({ userId, isDemo }: { userId: string, isDemo?: boolean }) {
  const [url, setUrl] = useState('');
  const [onMessage, setOnMessage] = useState(false);
  const [onLead, setOnLead] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemo) { setUrl('https://demo-hook.zapier.com/v1'); setOnLead(true); return; }
    Promise.all([
      getSetting(userId, 'webhook_url'), getSetting(userId, 'webhook_on_message'), getSetting(userId, 'webhook_on_lead'),
    ]).then(([u, m, l]) => {
      setUrl(u || ''); setOnMessage(m === 'true'); setOnLead(l === 'true');
    });
  }, [userId, isDemo]);

  const save = async () => {
    if (isDemo) return alert('Demo: Settings not saved.');
    setSaving(true);
    await Promise.all([
      setSetting(userId, 'webhook_url', url),
      setSetting(userId, 'webhook_on_message', onMessage ? 'true' : 'false'),
      setSetting(userId, 'webhook_on_lead', onLead ? 'true' : 'false'),
    ]);
    setTimeout(() => setSaving(false), 500);
  };

  return (
    <div className="fade-in glass-panel" style={{ padding: 40, maxWidth: 800, borderRadius: 24 }}>
      <h2 style={{ marginBottom: 32 }}>🔗 Automation Webhooks</h2>
      
      <div style={{ marginBottom: 40 }}>
          <label className="form-label">Webhook URL</label>
          <input className="input" style={{ marginTop: 12 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://external-api.com/webhooks" />
          <p style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Receive POST data when triggers occur.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
         <div onClick={() => setOnMessage(!onMessage)} className="glass-card" style={{ padding: 24, cursor: 'pointer', border: onMessage ? '1px solid var(--accent-green)' : '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: 4 }}>New Messages</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trigger on all incoming chats.</p>
         </div>
         <div onClick={() => setOnLead(!onLead)} className="glass-card" style={{ padding: 24, cursor: 'pointer', border: onLead ? '1px solid var(--accent-green)' : '1px solid var(--border)' }}>
            <h4 style={{ marginBottom: 4 }}>Lead Captured</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Trigger on AI Lead extraction.</p>
         </div>
      </div>

      <div style={{ background: '#0a0e17', padding: 20, borderRadius: 12, marginBottom: 32 }}>
          <h5 style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>JSON Payload Template</h5>
          <pre style={{ fontSize: '0.8rem', color: 'var(--accent-green)' }}>{`{ "sender": "PH123", "content": "..." }`}</pre>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-primary" style={{ padding: '16px 32px' }}>
          {saving ? 'Processing...' : '💾 Save Webhook Config'}
      </button>
    </div>
  );
}

// ─── MODULE 3: API KEYS ────────────────────────────────────────────────────

function APIKeysModule({ userId, isDemo }: { userId: string, isDemo?: boolean }) {
  const [key, setKey] = useState(isDemo ? 'demo_sk_7392_restricted' : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    getSetting(userId, 'app_api_key').then(k => setKey(k || ''));
  }, [userId, isDemo]);

  const save = async () => {
    if (isDemo) return;
    setSaving(true);
    await setSetting(userId, 'app_api_key', key);
    setTimeout(() => setSaving(false), 500);
  };

  return (
     <div className="fade-in glass-panel" style={{ padding: 40, maxWidth: 800, borderRadius: 24 }}>
        <h2 style={{ marginBottom: 12 }}>🔑 API Intelligence</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Automate your instance using our restricted external API.</p>

        <div style={{ marginBottom: 40 }}>
            <label className="form-label">Active API Key</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <input type="password" value={key} onChange={e => setKey(e.target.value)} className="input" />
                <button className="btn btn-secondary" onClick={() => !isDemo && setKey(Math.random().toString(36).substring(7))}>Generate</button>
            </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 40 }}>
             <div className="p-20" style={{ background: 'rgba(34, 197, 94, 0.05)', borderRadius: 16, border: '1px solid rgba(34, 197, 94, 0.1)' }}>
                <h5 style={{ color: 'var(--accent-green)', marginBottom: 10 }}>✅ RESTRICTED ACCESS</h5>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: 16 }}>
                    <li>Send Message</li>
                    <li>Read Contacts</li>
                </ul>
             </div>
             <div className="p-20" style={{ background: 'rgba(239, 68, 68, 0.05)', borderRadius: 16, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <h5 style={{ color: '#ef4444', marginBottom: 10 }}>❌ DENIED ACCESS</h5>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: 16 }}>
                    <li>System Config</li>
                    <li>User Credentials</li>
                </ul>
             </div>
        </div>

        <button onClick={save} disabled={saving} className="btn btn-primary" style={{ padding: '16px 32px' }}>
            {saving ? 'Updating...' : '💾 Save Key Config'}
        </button>
     </div>
  );
}
