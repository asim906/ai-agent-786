'use client';
import { useState, useEffect } from 'react';
import { BACKEND_URL } from '@/lib/config';

export default function WebhookConfig({ userId }: { userId: string }) {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // Mock loading from backend or local storage for now
        const savedUrl = localStorage.getItem(`webhook_${userId}`);
        if (savedUrl) setWebhookUrl(savedUrl);
    }, [userId]);

    const handleSave = () => {
        // Save locally for frontend
        localStorage.setItem(`webhook_${userId}`, webhookUrl);
        // Dispatch to backend API
        fetch(`${BACKEND_URL}/api/webhook/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, webhookUrl })
        }).catch(err => console.error('Failed to save webhook config', err));

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="flex-col gap-24 fade-in max-w-3xl mx-auto">
            
            <div className="glass-card p-32">
                <h3 className="m-0 font-outfit text-2xl mb-8">Incoming Messages Webhook</h3>
                <p className="text-secondary mb-24">
                    Forward incoming WhatsApp messages instantly to your custom URL. Great for connecting to Zapier, Make, or your custom server.
                </p>

                <div className="flex-col gap-8 mb-24">
                    <label className="text-sm font-bold text-secondary uppercase tracking-widest">Target URL Endpoint</label>
                    <div className="flex-row gap-12">
                        <input 
                            type="url" 
                            className="input flex-1" 
                            placeholder="https://your-server.com/webhook"
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={handleSave}>
                            {saved ? '✓ Saved' : 'Save Endpoint'}
                        </button>
                    </div>
                </div>

                <div className="p-16 rounded-12" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
                    <h4 className="m-0 text-sm text-secondary mb-12">Incoming Payload Format (POST)</h4>
                    <pre style={{ background: '#000', padding: 16, borderRadius: 8, fontSize: '13px', color: '#a5b4fc', overflowX: 'auto', margin: 0 }}>
{JSON.stringify({
    "event": "message.received",
    "userId": "your_user_id",
    "contact": {
        "jid": "1234567890@s.whatsapp.net",
        "name": "John Doe",
        "phone": "1234567890"
    },
    "message": {
        "text": "Hello, how are you?",
        "timestamp": 1698765432100
    }
}, null, 2)}
                    </pre>
                </div>
            </div>

            <div className="glass-card p-32" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
                <h3 className="m-0 font-outfit text-xl mb-8">Send Message via Webhook Trigger</h3>
                <p className="text-secondary mb-24">
                    To send a message via Webhook/API from an external system, make a POST request to our outbound endpoint.
                </p>
                <div className="p-16 rounded-12" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)' }}>
                    <h4 className="m-0 text-sm text-secondary mb-12">cURL Example</h4>
                    <pre style={{ background: '#000', padding: 16, borderRadius: 8, fontSize: '13px', color: '#34d399', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
{`curl -X POST ${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/v1/messages/send \\
-H "Content-Type: application/json" \\
-d '{
    "userId": "${userId}",
    "jid": "1234567890@s.whatsapp.net",
    "text": "Hello from Make/Zapier!"
}'`}
                    </pre>
                </div>
            </div>

        </div>
    );
}
