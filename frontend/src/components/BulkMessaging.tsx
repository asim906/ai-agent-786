'use client';
import { useState, useEffect, useRef } from 'react';
import * as xlsx from 'xlsx';
import { getContacts, upsertContact } from '@/lib/db';

export default function BulkMessaging({ userId, onSend }: { userId: string, onSend: (jid: string, text: string) => void }) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getContacts(userId).then(data => setContacts(data));
  }, [userId]);

  const handleFileUpload = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = xlsx.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = xlsx.utils.sheet_to_json(ws);
      
      let newCount = 0;
      const newContacts = [...contacts];
      
      for (const row of data as any[]) {
        // try to find a phone number column
        const phoneKey = Object.keys(row).find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('number') || k.toLowerCase().includes('contact'));
        if (phoneKey && row[phoneKey]) {
          let rawNum = String(row[phoneKey]).replace(/\D/g, '');
          if (rawNum.length > 5) {
            const jid = `${rawNum}@s.whatsapp.net`;
            const name = row['Name'] || row['name'] || `User ${rawNum}`;
            
            // Check if already exists
            if (!newContacts.find(c => c.jid === jid)) {
                const newC = { id: `${userId}_${jid}`, userId, jid, name, phone: rawNum, lastMessage: '', lastTime: Date.now(), unread: 0, aiEnabled: false };
                newContacts.push(newC);
                await upsertContact(newC);
                newCount++;
            }
          }
        }
      }
      setContacts(newContacts);
      alert(`Imported ${newCount} new contacts!`);
    };
    reader.readAsBinaryString(file);
  };

  const handleSelectAll = (e: any) => {
    if (e.target.checked) setSelected(new Set(contacts.map(c => c.jid)));
    else setSelected(new Set());
  };

  const toggleSelect = (jid: string) => {
    const next = new Set(selected);
    if (next.has(jid)) next.delete(jid);
    else next.add(jid);
    setSelected(next);
  };

  const startSending = async () => {
    if (selected.size === 0 || !message.trim()) return alert("Select contacts and write a message.");
    setIsSending(true);
    setProgress(0);
    
    let count = 0;
    const arr = Array.from(selected);
    for (const jid of arr) {
      onSend(jid, message);
      count++;
      setProgress(Math.round((count / arr.length) * 100));
      // Staggered delay to prevent bans
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }
    
    alert("Bulk message campaign completed!");
    setIsSending(false);
  };

  return (
    <div className="flex-col gap-24 fade-in">
      {/* Upload & Compose Area */}
      <div className="glass-card p-24" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '24px' }}>
         <div className="flex-col gap-16">
            <h3 className="m-0 font-outfit text-xl">Import Target List</h3>
            <p className="text-sm text-secondary m-0">Upload an Excel (.xlsx) file containing contacts. Ensure there is a column named 'Phone' or 'Number'.</p>
            <input type="file" accept=".xlsx, .xls, .csv" ref={fileInputRef} onChange={handleFileUpload} style={{display:'none'}} />
            <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
              📄 Upload Excel / CSV
            </button>
            
            <div className="mt-16 stats-box p-16" style={{ background: 'var(--bg-active)', borderRadius: '12px' }}>
                <div className="text-sm text-secondary">Total Contacts Available</div>
                <div className="text-2xl font-bold">{contacts.length}</div>
            </div>
         </div>

         <div className="flex-col gap-16">
            <h3 className="m-0 font-outfit text-xl">Campaign Message</h3>
            <textarea 
               className="input flex-1" 
               placeholder="Write your broadcast message here..."
               value={message}
               onChange={e => setMessage(e.target.value)}
               style={{ minHeight: '120px', resize: 'vertical' }}
            />
            <div className="flex-row items-center justify-between">
                <span className="text-sm text-secondary">{selected.size} recipients selected</span>
                <button 
                  className="btn btn-primary" 
                  onClick={startSending} 
                  disabled={isSending || selected.size === 0 || !message.trim()}
                >
                    {isSending ? `Sending... ${progress}%` : '🚀 Blast Messages'}
                </button>
            </div>
            {isSending && (
                <div style={{ width: '100%', height: 4, background: 'var(--bg-active)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-green)', transition: 'width 0.3s' }} />
                </div>
            )}
         </div>
      </div>

      {/* Contacts Table */}
      <div className="glass-card p-0 overflow-hidden flex-col">
        <div className="p-16 border-b flex-row items-center justify-between border-border" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3 className="m-0 font-outfit text-lg">Select Recipients</h3>
            <div className="flex-row items-center gap-8">
                <input type="checkbox" id="selectAll" onChange={handleSelectAll} checked={contacts.length > 0 && selected.size === contacts.length} />
                <label htmlFor="selectAll" className="text-sm cursor-pointer">Select All ({contacts.length})</label>
            </div>
        </div>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'var(--bg-active)' }}>
                    <tr>
                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', width: 40 }}>Action</th>
                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Name</th>
                        <th style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>Phone/JID</th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.length === 0 ? (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No contacts found. Please upload a sheet.</td></tr>
                    ) : contacts.map(c => (
                        <tr key={c.jid} style={{ background: selected.has(c.jid) ? 'rgba(37,211,102,0.05)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px 16px' }}>
                                <input type="checkbox" checked={selected.has(c.jid)} onChange={() => toggleSelect(c.jid)} />
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{c.name}</td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9em' }}>{c.phone || c.jid}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
