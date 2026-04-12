'use client';
import { useState } from 'react';

export default function ApiConfig({ userId }: { userId: string }) {
    const [apiKey, setApiKey] = useState(userId + '-secret-key-' + Math.random().toString(36).substring(7));
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex-col gap-24 fade-in max-w-4xl mx-auto">
            
            {/* Secrets Panel */}
            <div className="glass-card p-32 flex-col gap-16" style={{ background: 'linear-gradient(145deg, rgba(7,11,20,0.8), rgba(15,23,42,0.9))' }}>
                <div>
                    <h3 className="m-0 font-outfit text-2xl mb-8 flex-row items-center gap-8">
                        <span style={{color: 'var(--accent-green)'}}>●</span> API Credentials
                    </h3>
                    <p className="text-secondary m-0">Use this secret key to authenticate programmatic requests to the SaaS.</p>
                </div>

                <div className="flex-col gap-8 mt-8">
                    <label className="text-sm font-bold text-secondary uppercase tracking-widest">Secret API Key</label>
                    <div className="flex-row gap-12 items-center p-12 rounded-12" style={{ background: '#000', border: '1px solid #333' }}>
                        <code className="flex-1" style={{ fontSize: '1rem', color: '#e2e8f0', fontFamily: 'monospace' }}>
                            {apiKey.substring(0, 8)}•••••••••••••••••••••
                        </code>
                        <button className="btn btn-outline btn-sm" onClick={handleCopy}>
                            {copied ? 'Copied!' : 'Copy Key'}
                        </button>
                    </div>
                    <p className="text-xs text-red-400">Never share your API key. It provides full access to send messages on behalf of your WhatsApp account.</p>
                </div>
            </div>

            {/* Documentation Panel */}
            <div className="glass-card p-0 overflow-hidden">
                <div className="p-24 border-b border-border bg-active">
                    <h3 className="m-0 font-outfit text-xl">API Documentation</h3>
                </div>

                <div className="p-24 flex-col gap-32">
                    
                    {/* Endpoint 1: Send Message */}
                    <div className="endpoint-block">
                        <div className="flex-row items-center gap-12 mb-12">
                            <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold' }}>POST</span>
                            <code style={{ fontSize: '1rem', fontWeight: 600 }}>/api/v1/messages/send</code>
                        </div>
                        <p className="text-sm text-secondary mb-16">Send a text message to any WhatsApp number.</p>
                        
                        <h4 className="text-xs font-bold text-secondary uppercase mb-8">Request Body</h4>
                        <pre style={{ background: '#000', padding: 16, borderRadius: 8, fontSize: '13px', color: '#a5b4fc', margin: 0 }}>
{JSON.stringify({
    "userId": userId,
    "apiKey": "YOUR_SECRET_KEY",
    "jid": "1234567890@s.whatsapp.net",
    "text": "Hello World from API!"
}, null, 2)}
                        </pre>
                    </div>

                    <div style={{ height: 1, background: 'var(--border)' }} />

                    {/* Endpoint 2: Get Contacts */}
                    <div className="endpoint-block">
                        <div className="flex-row items-center gap-12 mb-12">
                            <span className="badge" style={{ background: 'rgba(96, 165, 250, 0.2)', color: '#60a5fa', padding: '4px 8px', borderRadius: 4, fontWeight: 'bold' }}>GET</span>
                            <code style={{ fontSize: '1rem', fontWeight: 600 }}>/api/v1/contacts</code>
                        </div>
                        <p className="text-sm text-secondary mb-16">Retrieve all known contacts that have interacted with your account or were imported.</p>
                        
                        <h4 className="text-xs font-bold text-secondary uppercase mb-8">Query Params</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: 16 }}>
                            <tr style={{ background: 'var(--bg-active)' }}><td style={{ padding: 8 }}>userId</td><td style={{ padding: 8, color: 'var(--text-secondary)' }}>Required</td></tr>
                            <tr style={{ background: 'transparent' }}><td style={{ padding: 8 }}>apiKey</td><td style={{ padding: 8, color: 'var(--text-secondary)' }}>Required</td></tr>
                        </table>

                        <h4 className="text-xs font-bold text-secondary uppercase mb-8">Response</h4>
                        <pre style={{ background: '#000', padding: 16, borderRadius: 8, fontSize: '13px', color: '#a5b4fc', margin: 0 }}>
{JSON.stringify({
    "success": true,
    "contacts": [
        {
            "jid": "1234567890@s.whatsapp.net",
            "name": "Jane",
            "phone": "1234567890",
            "unread": 0
        }
    ]
}, null, 2)}
                        </pre>
                    </div>

                </div>
            </div>

        </div>
    );
}
