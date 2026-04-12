'use client';
import { useEffect, useState } from 'react';
import { getLeads, upsertLead, deleteLead, getSetting, setSetting } from '@/lib/db';
import { DEMO_LEADS } from '@/lib/mockData';

interface Lead {
  id: string; userId: string; contactJid: string; data: Record<string, string>; createdAt: number;
}

interface LeadsTableProps {
  userId: string;
  refreshTrigger: number;
  isDemo?: boolean;
}

const DEFAULT_COLUMNS = ['Name', 'Phone', 'Email', 'Source', 'Status', 'Interest'];

export default function LeadsTable({ userId, refreshTrigger, isDemo }: LeadsTableProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
        setLeads(DEMO_LEADS as any);
        setLoading(false);
        return;
    }
    if (!userId) return;
    getLeads(userId).then(data => {
      setLeads(data.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    });
    getSetting(userId, 'leads_columns').then(saved => {
      if (saved) setColumns(JSON.parse(saved));
    });
  }, [userId, refreshTrigger, isDemo]);

  const handleExportCSV = () => {
    const rows = [columns.join(','), ...leads.map(l => columns.map(c => `"${(l.data[c] || '').replace(/"/g, '""')}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads_export.csv'; a.click();
  };

  return (
    <div className="fade-up" style={{ padding: 40, height: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Lead Intelligence</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            Successfully captured <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{leads.length}</span> high-intent leads via WhatsApp.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleExportCSV} className="btn btn-secondary">Export to CSV</button>
            <button className="btn btn-primary" onClick={() => isDemo && alert('Demo: Real sheet sync enabled in Pro plan.')}>Sync to CRM</button>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass-card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
                <div style={{ padding: 100, textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                </div>
            ) : leads.length === 0 ? (
                <div style={{ padding: 100, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 20 }}>📋</div>
                    <h3>No leads captured yet</h3>
                    <p>When users send contact info, they'll appear here automatically.</p>
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-sidebar)', zIndex: 10 }}>
                        <tr>
                            {columns.map(col => (
                                <th key={col} style={{ 
                                    padding: '20px', borderBottom: '1px solid var(--border)', 
                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', 
                                    color: 'var(--text-secondary)', letterSpacing: '0.1em' 
                                }}>{col}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {leads.map((lead) => (
                            <tr key={lead.id} className="table-row-hover" style={{ borderBottom: '1px solid var(--border)', transition: 'var(--transition)' }}>
                                {columns.map(col => {
                                    const val = lead.data[col] || '—';
                                    const isHighlight = col === 'Status' || col === 'Source';
                                    return (
                                        <td key={col} style={{ padding: '18px 20px', fontSize: '0.88rem' }}>
                                            {isHighlight ? (
                                                <span className={`badge ${val === 'WhatsApp' ? 'badge-green' : 'badge-purple'}`} style={{ padding: '4px 12px', fontSize: '0.7rem' }}>
                                                    {val}
                                                </span>
                                            ) : val}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </div>
  );
}
