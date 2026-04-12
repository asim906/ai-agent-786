'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MainSidebar from '@/components/MainSidebar';
import ChatWindow from '@/components/ChatWindow';
import AISettings from '@/components/AISettings';
import QRCodePanel from '@/components/QRCodePanel';
import LeadsTable from '@/components/LeadsTable';
import BulkMessaging from '@/components/BulkMessaging';
import WebhookConfig from '@/components/WebhookConfig';
import ApiConfig from '@/components/ApiConfig';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';
import { QRCodeSVG } from 'qrcode.react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { io, Socket } from 'socket.io-client';
import { addMessage, upsertContact, getContacts } from '@/lib/db';

import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(new URLSearchParams(window.location.search).get('demo') === 'true');
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      // Redirect unauthenticated users back to home (unless demo)
      if (!u && new URLSearchParams(window.location.search).get('demo') !== 'true') {
        router.push('/');
      }
    });
  }, [router]);

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}><div className="loader"></div></div>;
  }

  return <DashboardContent user={user || { uid: 'demo', email: 'demo@pro.com' }} isDemo={isDemo} />;
}

function DashboardContent({ user, isDemo }: { user: any; isDemo: boolean }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('chat');
  const [toolView, setToolView] = useState<'menu' | 'bulk' | 'webhook' | 'api'>('menu');
  const [rightTab, setRightTab] = useState('qr');
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'needs_qr'>('connecting');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (isDemo) { setConnectionStatus('connected'); return; }

    const newSocket = io('https://whatsapp-ai-backend-production-38bd.up.railway.app');
    setSocket(newSocket);

    // ✅ KEY FIX: check_session first — don't blindly start a new one
    // This prevents the QR loop on every page refresh
    newSocket.on('connect', () => {
      console.log('[Socket] Connected — checking session status for:', user?.uid);
      newSocket.emit('check_session', { userId: user?.uid });
    });

    newSocket.on('qr', (data) => {
      if (data.userId === user?.uid) {
        console.log('[QR] Received QR code');
        setQrCode(data.qr);
        setConnectionStatus('needs_qr');
      }
    });

    newSocket.on('connection_update', (data) => {
      if (data.userId === user?.uid) {
        console.log('[Status]', data.status);
        if (data.status === 'connected') {
          setConnectionStatus('connected');
          setQrCode('');
        } else if (data.status === 'needs_qr') {
          setConnectionStatus('needs_qr');
        } else if (data.status === 'connecting') {
          setConnectionStatus('connecting');
        } else {
          // disconnected, error, logged_out
          setConnectionStatus('disconnected');
        }
      }
    });

    // ✅ Handle incoming messages from WhatsApp
    newSocket.on('message', async (data) => {
      if (data.userId !== user?.uid) return;
      console.log('[Message] Received:', data.text?.substring(0, 40));

      // 1. Save message to IndexedDB
      const msgId = `${data.jid}-${data.timestamp}`;
      await addMessage({
        id: msgId,
        userId: data.userId,
        contactJid: data.jid,
        text: data.text || '',
        fromMe: !!data.fromMe,
        timestamp: data.timestamp || Date.now(),
        aiGenerated: !!data.aiGenerated,
        type: 'text',
      });

      // 2. Upsert contact with latest message preview
      await upsertContact({
        id: `${data.userId}_${data.jid}`,
        userId: data.userId,
        jid: data.jid,
        name: data.name || data.phone || data.jid.split('@')[0],
        phone: data.phone || data.jid.split('@')[0],
        lastMessage: data.text || '',
        lastTime: data.timestamp || Date.now(),
        unread: data.fromMe ? 0 : 1,
        aiEnabled: false,
      });

      // 3. Trigger sidebar + chat window to re-fetch
      setRefreshTrigger(prev => prev + 1);
    });

    return () => { newSocket.close(); };
  }, [user, isDemo]);

  // handleRequestQR — only called when user clicks "Request QR" manually
  const handleRequestQR = () => {
    setConnectionStatus('connecting');
    socket?.emit('start_session', { userId: user?.uid });
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const handleSendMessage = (jid: string, text: string, imageBase64?: string) => {
    socket?.emit('send_message', { userId: user?.uid, jid, text, imageBase64 });
  };

  // ✅ Block dashboard until connected — show QR lock for needs_qr, connecting, disconnected
  if (!isDemo && connectionStatus !== 'connected') {
    return (
      <StrictQRLockScreen
        qrCode={qrCode}
        connectionStatus={connectionStatus}
        onRequestQR={handleRequestQR}
      />
    );
  }

  return (
    <div className="dashboard-layout fade-in flex-row w-full h-full overflow-hidden">
      
      {/* 1. Main App Navigation Sidebar */}
      <MainSidebar 
        activeTab={activeTab} 
        onTabChange={(t: string) => setActiveTab(t)} 
        onLogout={handleLogout} 
        email={user?.email || ''} 
      />

      {/* 2. Content Specific Sidebar (Contacts) */}
      {activeTab === 'chat' && (
      <Sidebar
          userId={user.uid}
          activeContact={activeContact}
          onSelectContact={c => { setActiveContact(c); }}
          refreshTrigger={refreshTrigger}
          isDemo={isDemo}
        />
      )}

      {/* 3. Main Working Area */}
      <div className="dashboard-main flex-1 flex-col relative" style={{ background: 'transparent' }}>
        <Header
          user={user as any}
          connectionStatus={connectionStatus}
          onLogout={handleLogout}
          activeTab={activeTab}
          onTabChange={setActiveTab as any}
          isDemo={isDemo}
        />

        <div className="dashboard-content flex-1 flex-row overflow-hidden w-full h-full">
            {/* Center Area (Chat or Welcome Hub) */}
            <div className="flex-1 flex-col overflow-hidden w-full h-full">
                {activeTab === 'chat' && (
                    <ChatWindow
                        userId={user.uid}
                        contact={activeContact}
                        onSendMessage={handleSendMessage}
                        refreshTrigger={refreshTrigger}
                        isDemo={isDemo}
                        onTabChange={setActiveTab as any}
                    />
                )}
                {activeTab === 'leads' && <LeadsTable userId={user.uid} refreshTrigger={refreshTrigger} isDemo={isDemo} />}
                {activeTab === 'settings' && (
                    <div className="flex-col w-full h-full" style={{ background: 'var(--bg-primary)' }}>
                        <div className="p-24 border-b" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7, 11, 20, 0.4)' }}>
                            <h2 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit' }}>Platform Settings</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>Configure global AI settings, models, and API keys for your WhatsApp integrations.</p>
                        </div>
                        <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-24">
                            <AISettings userId={user.uid} contactJid={null} contactName={null} />
                        </div>
                    </div>
                )}
                {activeTab === 'tools' && (
                    <div className="flex-col w-full h-full" style={{ background: 'var(--bg-primary)' }}>
                        <div className="p-24 border-b" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7, 11, 20, 0.4)' }}>
                            <div className="flex-row items-center gap-16">
                                {toolView !== 'menu' && (
                                    <button className="btn-ghost btn-icon" onClick={() => setToolView('menu')} style={{ fontSize: '1.5rem' }}>←</button>
                                )}
                                <div>
                                    <h2 style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'Outfit', margin: 0 }}>
                                        {toolView === 'menu' ? 'Automation Tools' : 
                                         toolView === 'bulk' ? 'Bulk Messaging' :
                                         toolView === 'webhook' ? 'Webhook Integrations' : 'API Access'}
                                    </h2>
                                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                        {toolView === 'menu' ? 'Powerful utilities to scale your WhatsApp operations.' : 'Configure your tool settings below.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-24 w-full">
                            {toolView === 'menu' && (
                                <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
                                    <div className="glass-card hover-float p-24 cursor-pointer" onClick={() => setToolView('bulk')} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚀</div>
                                        <h3 style={{ fontSize: '1.5rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: 8, marginTop: 0 }}>Bulk Messaging</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Send targeted, bulk broadcast campaigns to massive lists.</p>
                                    </div>
                                    <div className="glass-card hover-float p-24 cursor-pointer" onClick={() => setToolView('webhook')} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🪝</div>
                                        <h3 style={{ fontSize: '1.5rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: 8, marginTop: 0 }}>Webhook</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Forward incoming messages to Zapier, Make, or custom services.</p>
                                    </div>
                                    <div className="glass-card hover-float p-24 cursor-pointer" onClick={() => setToolView('api')} style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔌</div>
                                        <h3 style={{ fontSize: '1.5rem', fontFamily: 'Outfit', fontWeight: 700, marginBottom: 8, marginTop: 0 }}>API</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>Integrate our platform directly into your codebase with simple endpoints.</p>
                                    </div>
                                </div>
                            )}
                            {toolView === 'bulk' && <BulkMessaging userId={user.uid} onSend={handleSendMessage} />}
                            {toolView === 'webhook' && <WebhookConfig userId={user.uid} />}
                            {toolView === 'api' && <ApiConfig userId={user.uid} />}
                        </div>
                    </div>
                )}
                {activeTab === 'analytics' && (
                    <div className="w-full h-full overflow-hidden">
                        <AnalyticsDashboard userId={user.uid} />
                    </div>
                )}
            </div>

            {/* 4. Right Utility Panel (Definitive Merge) */}
            {activeTab === 'chat' && activeContact && (
                <aside className="right-panel glass-panel fade-in flex-col" style={{ 
                    width: 360, border: 'none', borderLeft: '1px solid var(--border)', background: 'rgba(7, 11, 20, 0.4)'
                }}>
                    <div className="p-24 border-b" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex-row items-center p-4 relative" style={{ 
                            background: 'var(--bg-active)', borderRadius: '16px'
                        }}>
                            <button onClick={() => setRightTab('qr')} className={`pill-btn flex-1 ${rightTab === 'qr' ? 'active' : ''}`}>📱 Status</button>
                            <button onClick={() => setRightTab('ai')} className={`pill-btn flex-1 ${rightTab === 'ai' ? 'active' : ''}`}>🤖 Settings</button>
                            <button onClick={() => setRightTab('info')} className={`pill-btn flex-1 ${rightTab === 'info' ? 'active' : ''}`}>ℹ️ Stats</button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-24">
                        {rightTab === 'qr' && <QRCodePanel qrCode={qrCode} connectionStatus={connectionStatus} onRequestQR={() => handleRequestQR()} />}
                        {rightTab === 'ai' && <AISettings userId={user.uid} contactJid={activeContact.jid} contactName={activeContact.name} />}
                        {rightTab === 'info' && (
                            <div className="fade-up flex-col gap-16">
                                <div className="flex-col items-center mb-24">
                                    <div className="avatar flex-col items-center justify-center mb-16" style={{ 
                                        width: 96, height: 96, fontSize: '3rem', borderRadius: '50%', fontWeight: 700,
                                        border: '4px solid var(--border)', boxShadow: 'var(--shadow-md)',
                                        background: `linear-gradient(135deg, hsl(${activeContact.name.charCodeAt(0) * 11 % 360}, 65%, 45%), transparent)`
                                    }}>{activeContact.name.trim().split(/\s+/).map((n:string)=>n[0]).join('').substring(0,2).toUpperCase()}</div>
                                    <h3 className="m-0 text-center" style={{ fontSize: '1.5rem', fontFamily: 'Outfit' }}>{activeContact.name}</h3>
                                    <p className="text-secondary font-medium m-0 mt-8 text-sm text-center">{activeContact.phone}</p>
                                </div>
                                <div className="glass-card p-16" style={{ borderLeft: '4px solid var(--accent-green)' }}>
                                    <h4 className="text-secondary m-0 mb-8 font-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence Core</h4>
                                    <div className="badge flex-row items-center justify-center font-bold" style={{ background: 'var(--accent-green)', padding: '4px 12px', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}>Agent Optimized</div>
                                </div>
                                <div className="glass-card p-16" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                                    <h4 className="text-secondary m-0 mb-8 font-bold" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Engagement Score</h4>
                                    <div className="badge flex-row items-center justify-center font-bold" style={{ background: 'var(--accent-purple)', padding: '4px 12px', borderRadius: '8px', color: '#fff', fontSize: '0.8rem' }}>98% Satisfied</div>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// STRICT QR LOCK SCREEN
// ============================================
function StrictQRLockScreen({ qrCode, connectionStatus, onRequestQR }: { qrCode: string; connectionStatus: string; onRequestQR: () => void }) {
    // Auto-request QR if we enter needs_qr state but have no QR yet
    useEffect(() => {
        if (connectionStatus === 'needs_qr' && !qrCode) {
            onRequestQR();
        }
    }, [connectionStatus]);

    const isConnecting = connectionStatus === 'connecting';
    const needsQR = connectionStatus === 'needs_qr' || connectionStatus === 'disconnected';

    const statusText = () => {
        if (connectionStatus === 'connected') return '✅ Connected successfully!';
        if (isConnecting && !qrCode) return 'Restoring session...';
        if (qrCode) return 'Waiting for QR scan...';
        return 'Preparing connection...';
    };

    const statusColor = connectionStatus === 'connected' ? 'var(--accent-green)' : 'var(--accent-blue)';

    return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100vh', background:'var(--bg-primary)' }}>
            <div className="glass-card fade-up" style={{ width:'100%', maxWidth:500, textAlign:'center', position:'relative', overflow:'hidden', padding:48 }}>
                {/* Ambient glow */}
                <div style={{ position:'absolute', top:-60, left:-60, width:220, height:220, background:'var(--accent-green)', filter:'blur(110px)', opacity:0.12, zIndex:0 }} />

                {/* Icon */}
                <div style={{ fontSize:'3rem', marginBottom:20, position:'relative', zIndex:1 }}>📱</div>

                <h2 style={{ fontSize:'2rem', fontWeight:900, fontFamily:'Outfit', marginBottom:10, position:'relative', zIndex:1 }}>Connect Your WhatsApp</h2>
                <p style={{ color:'var(--text-secondary)', fontSize:'1rem', lineHeight:1.6, marginBottom:32, position:'relative', zIndex:1 }}>Scan this QR code to continue</p>

                {/* QR Area */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:28, position:'relative', zIndex:1 }}>
                    {qrCode ? (
                        <div style={{ background:'#fff', padding:18, borderRadius:20, boxShadow:'0 8px 40px rgba(0,0,0,0.4)' }}>
                            <QRCodeSVG value={qrCode} size={240} fgColor="#000" />
                        </div>
                    ) : (
                        <div style={{ width:276, height:276, border:'2px dashed var(--border)', borderRadius:20, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
                            {isConnecting ? (
                                <>
                                    <div className="loader"></div>
                                    <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Checking session...</span>
                                </>
                            ) : (
                                <>
                                    <span style={{ fontSize:'2rem' }}>📷</span>
                                    <button onClick={onRequestQR} style={{ background:'var(--accent-green)', color:'#fff', border:'none', borderRadius:10, padding:'10px 24px', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>
                                        Generate QR Code
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Status */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:32, position:'relative', zIndex:1 }}>
                    <div className={connectionStatus !== 'connected' ? 'pulse-primary' : ''} style={{ width:10, height:10, borderRadius:'50%', background:statusColor, flexShrink:0 }} />
                    <span style={{ fontWeight:700, color:statusColor, fontSize:'0.9rem', letterSpacing:'0.3px' }}>{statusText()}</span>
                </div>

                {/* Instructions */}
                <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:16, padding:'20px 24px', textAlign:'left', border:'1px solid var(--border)', position:'relative', zIndex:1 }}>
                    <p style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>How to scan</p>
                    <ol style={{ paddingLeft:18, margin:0, color:'var(--text-secondary)', lineHeight:2.2, fontSize:'0.88rem' }}>
                        <li>Open WhatsApp on your phone</li>
                        <li>Tap on the 3-dot menu (⋮)</li>
                        <li>Go to <strong style={{ color:'#fff' }}>"Linked Devices"</strong></li>
                        <li>Tap <strong style={{ color:'#fff' }}>"Link a Device"</strong></li>
                        <li>Scan this QR code</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
