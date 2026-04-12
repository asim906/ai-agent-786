'use client';
import { useEffect, useState } from 'react';
import { getStat } from '@/lib/db';
import { DEMO_STATS } from '@/lib/mockData';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler, ArcElement,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, Filler, ArcElement
);

interface AnalyticsProps {
  userId: string;
  refreshTrigger: number;
  isDemo?: boolean;
}

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f172a', titleFont: { size: 13 }, bodyFont: { size: 12 }, padding: 12, cornerRadius: 8 } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false }, ticks: { color: '#64748b', font: { size: 10 } }, beginAtZero: true },
  },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Analytics({ userId, refreshTrigger, isDemo }: AnalyticsProps) {
  const [stats, setStats] = useState({ aiReplies: 0, leads: 0, messages: 0, contacts: 0 });

  useEffect(() => {
    if (isDemo) {
        setStats({
            aiReplies: DEMO_STATS.ai_replies,
            leads: DEMO_STATS.leads_generated,
            messages: DEMO_STATS.messages_sent,
            contacts: DEMO_STATS.contacts_seen,
        });
        return;
    }
    if (!userId) return;
    Promise.all([
      getStat(userId, 'ai_replies'),
      getStat(userId, 'leads_generated'),
      getStat(userId, 'messages_sent'),
      getStat(userId, 'contacts_seen'),
    ]).then(([aiReplies, leads, messages, contacts]) => {
      setStats({ aiReplies, leads, messages, contacts });
    });
  }, [userId, refreshTrigger, isDemo]);

  const statCards = [
    { label: 'Network Messages', value: stats.messages, icon: '💬', color: 'var(--accent-green)' },
    { label: 'AI Automations',   value: stats.aiReplies, icon: '🤖', color: 'var(--accent-purple)' },
    { label: 'Leads Pipeline',   value: stats.leads,   icon: '📋', color: 'var(--accent-blue)' },
    { label: 'Unique Contacts',  value: stats.contacts, icon: '👥', color: '#f59e0b' },
  ];

  return (
    <div className="fade-up" style={{ padding: 40, height: '100%', overflowY: 'auto' }}>
      
      <div style={{ marginBottom: 40 }}>
         <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Performance Insights</h2>
         <p style={{ color: 'var(--text-secondary)' }}>Advanced metrics and engagement analytics for your WhatsApp ecosystem.</p>
      </div>

      {/* Grid of Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 40 }}>
        {statCards.map(card => (
          <div key={card.label} className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
               <div style={{ 
                   width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                   display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
               }}>{card.icon}</div>
               <span className="badge badge-green">+12%</span>
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: card.color }}>
                {card.value.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Charts section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
          
          <div className="glass-panel" style={{ padding: 24, borderRadius: 20 }}>
              <h4 style={{ marginBottom: 24 }}>Activity Volume</h4>
              <div style={{ height: 260 }}>
                  <Line 
                    data={{
                        labels: DAYS,
                        datasets: [{
                            label: 'Messages',
                            data: [65, 59, 80, 81, 56, 55, 40],
                            borderColor: 'var(--accent-green)',
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 0
                        }]
                    }}
                    options={CHART_OPTIONS}
                  />
              </div>
          </div>

          <div className="glass-panel" style={{ padding: 24, borderRadius: 20 }}>
              <h4 style={{ marginBottom: 24 }}>AI Effectiveness</h4>
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut 
                    data={{
                        labels: ['AI Handled', 'Manual'],
                        datasets: [{
                            data: [stats.aiReplies, Math.max(0, stats.messages - stats.aiReplies)],
                            backgroundColor: ['var(--accent-purple)', 'var(--accent-green)'],
                            borderWidth: 0,
                        }]
                    }}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } },
                        cutout: '75%'
                    }}
                />
              </div>
          </div>

      </div>
    </div>
  );
}
