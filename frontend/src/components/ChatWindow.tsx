'use client';
import { useEffect, useState, useRef } from 'react';
import { getMessages, addMessage } from '@/lib/db';
import { DEMO_MESSAGES } from '@/lib/mockData';

interface Message {
  id: string; userId: string; contactJid: string; text: string;
  fromMe: boolean; timestamp: number; aiGenerated: boolean;
  type?: 'text' | 'audio' | 'image'; extractedText?: string;
  audioUrl?: string; imageUrl?: string; transcription?: string;
}

interface ChatWindowProps {
  userId: string;
  contact: { jid: string; name: string; phone: string } | null;
  onSendMessage: (jid: string, text: string, imageBase64?: string) => void;
  refreshTrigger: number;
  isDemo?: boolean;
  onTabChange?: (tab: string) => void;
}

export default function ChatWindow({ userId, contact, onSendMessage, refreshTrigger, isDemo, onTabChange }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contact) return;
    if (isDemo) {
        setMessages(DEMO_MESSAGES.filter(m => m.contactJid === contact.jid) as any);
        return;
    }
    setLoading(true);
    getMessages(userId, contact.jid).then(data => {
      setMessages(data);
      setLoading(false);
    });
  }, [userId, contact, refreshTrigger, isDemo]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        if (evt.target?.result) setPreviewImage(evt.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const cancelImagePreview = () => {
    setPreviewImage(null);
    setInput('');
  };

  const handleSend = () => {
    if (!contact || (!input.trim() && !previewImage)) return;
    onSendMessage(contact.jid, input, previewImage || undefined);
    
    const newMsg: Message = {
      id: `local-${Date.now()}`,
      userId,
      contactJid: contact.jid,
      text: input,
      fromMe: true,
      timestamp: Date.now(),
      aiGenerated: false,
      type: previewImage ? 'image' : 'text',
      imageUrl: previewImage || undefined
    };
    if (!isDemo) addMessage(newMsg);
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setPreviewImage(null);

    // Simulate AI behavior for Demo
    if (isDemo) {
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            const aiMsg: Message = {
                id: `demo-ai-${Date.now()}`,
                userId,
                contactJid: contact.jid,
                text: "That sounds like a great plan! I've updated your preferences and notified the team. Is there anything else I can help you with?",
                fromMe: false,
                timestamp: Date.now(),
                aiGenerated: true,
            };
            setMessages(prev => [...prev, aiMsg]);
        }, 3000);
    }
  };

  if (!contact) {
    return <WelcomeHub isDemo={isDemo} onTabChange={onTabChange} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent' }}>
      
      {/* Header Info */}
      <div className="flex-row items-center justify-between p-16" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(7,11,20,0.2)', backdropFilter: 'blur(10px)' }}>
         <div className="flex-row items-center gap-16">
            <div className="avatar flex-shrink-0" style={{ 
                width: 44, height: 44, borderRadius: '50%', fontSize: '1.2rem',
                background: `linear-gradient(135deg, hsl(${contact.name.charCodeAt(0) * 11 % 360}, 65%, 45%), transparent)`,
                border: '1px solid rgba(255,255,255,0.1)'
            }}>{contact.name.trim().split(/\s+/).map((n: string) => n[0]).join('').substring(0,2).toUpperCase()}</div>
            <div className="flex-col justify-center">
                <h4 className="font-bold m-0" style={{ fontSize: '1.1rem', fontFamily: 'Outfit' }}>{contact.name}</h4>
                <p className="flex-row items-center gap-8 m-0 text-xs" style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> Online
                </p>
            </div>
         </div>
         <div className="flex-row gap-12">
            <button className="btn-ghost flex-row items-center justify-center" title="Search Chat" style={{ width: 40, height: 40, borderRadius: '12px' }}>🔍</button>
            <button className="btn-ghost flex-row items-center justify-center" title="Chat Settings" style={{ width: 40, height: 40, borderRadius: '12px' }}>⚙️</button>
         </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-24 flex-col gap-24">
        {messages.map((m, idx) => {
          // @ts-ignore
          if (m.isSystem) {
             return (
               <div key={m.id} className="fade-in flex-row justify-center py-8">
                 <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    maxWidth: '85%'
                 }}>
                   {m.text}
                 </div>
               </div>
             );
          }

          return (
            <div key={m.id} className={`fade-up flex-row ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
              <div className="flex-col" style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: m.fromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.fromMe ? 'var(--bg-active)' : 'rgba(255,255,255,0.03)',
                border: m.fromMe ? '1px solid var(--border-accent)' : '1px solid rgba(255,255,255,0.05)',
                boxShadow: m.aiGenerated ? '0 8px 32px rgba(139, 92, 246, 0.15)' : 'none'
              }}>
              {m.imageUrl && (
                  <img src={m.imageUrl} alt="attachment" style={{ width: '100%', borderRadius: 12, marginBottom: m.text ? 8 : 0 }} />
              )}
              {m.text && <div style={{ lineHeight: 1.5, fontSize: '0.95rem' }}>{m.text}</div>}
              
              <div className="flex-row items-center justify-end gap-8 mt-8" style={{ opacity: 0.6, fontSize: '0.7rem', fontWeight: 500 }}>
                {m.aiGenerated && (
                    <span className="font-bold" style={{ 
                        color: 'var(--accent-purple)', background: 'rgba(139, 92, 246, 0.1)', 
                        padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase'
                    }}>🤖 AI Assisted</span>
                )}
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {m.fromMe && <span style={{ color: 'var(--accent-green)' }}>✓✓</span>}
              </div>
            </div>
          );
        })}

        {isTyping && (
            <div className="fade-in flex-row justify-start">
                <div className="typing-indicator flex-row items-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '12px 16px' }}>
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                </div>
            </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Field - Floating Glass Look */}
      <div className="px-24 pb-24 relative w-full flex-row" style={{ zIndex: previewImage ? 5 : 10 }}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{display:'none'}} />
        <div className="flex-row items-center gap-12 w-full p-8" style={{ 
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)', borderRadius: '24px', boxShadow: 'var(--shadow-md)'
        }}>
          <button onClick={() => fileInputRef.current?.click()} className="btn-ghost flex-row items-center justify-center flex-shrink-0" style={{ width: 44, height: 44, borderRadius: '16px', fontSize: '1.2rem' }}>📎</button>
          <input
            type="text"
            className="input flex-1"
            placeholder="Write a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            style={{ background: 'transparent', border: 'none', boxShadow: 'none', height: 44, padding: '0 12px' }}
          />
          <button onClick={handleSend} disabled={!input.trim() && !previewImage} className="btn btn-primary flex-shrink-0 flex-row items-center justify-center" style={{ width: 44, height: 44, borderRadius: '16px', padding: 0 }}>
            ✈️
          </button>
        </div>
      </div>

      {/* Image Preview Modal UI */}
      {previewImage && (
          <div className="fade-in flex-col items-center justify-center w-full h-full absolute top-0 left-0" style={{ zIndex: 100, background: 'var(--bg-sidebar)', backdropFilter: 'blur(16px)' }}>
              <div className="glass-card flex-col overflow-hidden" style={{ width: '90%', maxWidth: 450, padding: 0 }}>
                  <div className="flex-row items-center justify-between p-16" style={{ borderBottom: '1px solid var(--border)' }}>
                      <h3 className="m-0 font-outfit text-lg">Send Image</h3>
                      <button onClick={cancelImagePreview} className="btn-ghost" style={{ padding: '4px 8px', borderRadius: 8 }}>❌</button>
                  </div>
                  <div className="p-24 flex-col items-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 12, objectFit: 'contain' }} />
                  </div>
                  <div className="p-16 flex-row items-center gap-12" style={{ borderTop: '1px solid var(--border)' }}>
                      <input 
                          type="text" 
                          autoFocus
                          className="input flex-1" 
                          placeholder="Add a caption..." 
                          value={input} 
                          onChange={e => setInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSend()}
                      />
                      <button className="btn btn-primary" onClick={handleSend}>✈️ Send</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

function WelcomeHub({ isDemo, onTabChange }: { isDemo?: boolean, onTabChange?: (tab: string) => void }) {
    return (
        <div className="fade-up" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, textAlign: 'center' }}>
            <div className="hover-float" style={{ 
                width: 120, height: 120, borderRadius: 32, 
                background: 'linear-gradient(135deg, var(--accent-green), var(--accent-green-dark))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem',
                boxShadow: '0 20px 60px rgba(16, 185, 129, 0.2)', marginBottom: 40
            }}>💬</div>

            <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: 16 }}>Welcome back.</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 500, lineHeight: 1.6, marginBottom: 48 }}>
                Your AI-powered WhatsApp ecosystem is active. Pick a conversation to start automating or choose a quick action below.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, width: '100%', maxWidth: 800 }}>
                {[
                    { id: 'connect', action: 'settings', icon: '🔗', title: 'Device Link', text: 'Scan QR to connect status.', color: 'var(--accent-green)' },
                    { id: 'campaign', action: 'tools', icon: '🚀', title: 'Bulk Campaign', text: 'Send messages to hundreds.', color: 'var(--accent-blue)' },
                    { id: 'ai', action: 'tools', icon: '🤖', title: 'AI Training', text: 'Refine agent responses.', color: 'var(--accent-purple)' }
                ].map(card => (
                    <div 
                        key={card.id} 
                        onClick={() => onTabChange && onTabChange(card.action)}
                        className="glass-card hover-float" 
                        style={{ padding: 24, textAlign: 'left', cursor: 'pointer' }}
                    >
                        <div style={{ fontSize: '1.8rem', marginBottom: 16 }}>{card.icon}</div>
                        <h4 style={{ marginBottom: 6, fontSize: '1.1rem' }}>{card.title}</h4>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{card.text}</p>
                    </div>
                ))}
            </div>

            {isDemo && (
                <div className="badge flex-row items-center justify-center font-bold" style={{ marginTop: 40, background: 'var(--accent-green)', padding: '8px 16px', borderRadius: '12px', color: '#fff' }}>
                    🛡️ Enterprise Demo Mode Active
                </div>
            )}
        </div>
    );
}
