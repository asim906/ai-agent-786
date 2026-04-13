'use client';
import { useEffect, useState } from 'react';
import { BACKEND_URL } from '@/lib/config';
import { getSetting, setSetting, getMemory, addMemory, deleteMemory } from '@/lib/db';
import { AIModel } from '@/lib/aiService';

interface AISettingsProps {
  userId: string;
  contactJid: string | null;
  contactName: string | null;
}

interface QAItem {
  id: string; userId: string; contactJid: string; question: string; answer: string; createdAt: number;
}

const MODELS: { id: AIModel; label: string; icon: string; desc: string }[] = [
  { id: 'openai',     label: 'OpenAI',      icon: '🧠', desc: 'GPT-4o-mini — fast & smart' },
  { id: 'gemini',     label: 'Gemini',      icon: '✨', desc: 'Gemini 2.0 Flash — by Google' },
  { id: 'openrouter', label: 'OpenRouter',  icon: '🔀', desc: 'Multi-model access hub' },
];

export default function AISettings({ userId, contactJid, contactName }: AISettingsProps) {
  const [model, setModel] = useState<AIModel>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [voiceAI, setVoiceAI] = useState('off'); // off, auto
  const [ttsVoice, setTtsVoice] = useState('en-US-AndrewNeural');
  const [voices, setVoices] = useState<{id: string, label: string}[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [globalMemory, setGlobalMemory] = useState(''); 
  const [globalQA, setGlobalQA] = useState<QAItem[]>([]);
  const [contactQA, setContactQA] = useState<QAItem[]>([]);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [isGlobalMode, setIsGlobalMode] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load global settings
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      getSetting(userId, 'ai_model'),
      getSetting(userId, 'ai_api_key'),
      getSetting(userId, 'ai_system_prompt'),
      getSetting(userId, 'ai_global_memory'),
      getSetting(userId, 'voice_ai_mode'),
      getSetting(userId, 'tts_voice'),
      import('@/lib/db').then(db => db.getQAMemory(userId, 'global')),
      fetch(`${BACKEND_URL}/api/voices`).then(r => r.json()).catch(() => []),
    ]).then(([m, k, p, gm, vai, tts, gqa, vlist]) => {
      if (m) setModel(m as AIModel);
      if (k) setApiKey(k);
      if (p) setSystemPrompt(p);
      if (gm) setGlobalMemory(gm);
      if (vai) setVoiceAI(vai);
      if (tts) setTtsVoice(tts);
      setGlobalQA(gqa.sort((a, b) => b.createdAt - a.createdAt));
      setVoices(vlist);
    });
  }, [userId]);

  // Load memory for selected contact
  useEffect(() => {
    if (!userId || !contactJid) { setContactQA([]); return; }
    import('@/lib/db').then(db => db.getQAMemory(userId, contactJid)).then(data =>
      setContactQA(data.sort((a, b) => b.createdAt - a.createdAt))
    );
  }, [userId, contactJid]);

  const handleSaveSettings = async () => {
    setLoading(true);
    
    // Save to local DB
    await Promise.all([
      setSetting(userId, 'ai_model', model),
      setSetting(userId, 'ai_api_key', apiKey),
      setSetting(userId, 'ai_system_prompt', systemPrompt),
      setSetting(userId, 'ai_global_memory', globalMemory),
      setSetting(userId, 'voice_ai_mode', voiceAI),
      setSetting(userId, 'tts_voice', ttsVoice),
    ]);

    // Push to backend
    try {
      await fetch(`${BACKEND_URL}/api/settings/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_model: model,
          ai_api_key: apiKey,
          ai_system_prompt: systemPrompt,
          ai_global_memory: globalMemory
        })
      });
    } catch (err) {
      console.error('Failed to sync settings with backend', err);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setLoading(false);
  };

  const handleAddQA = async () => {
    if (!newQ.trim() || !newA.trim()) return;
    const targetJid = isGlobalMode ? 'global' : (contactJid || 'global');
    const qa: QAItem = {
      id: `qa-${Date.now()}`,
      userId,
      contactJid: targetJid,
      question: newQ.trim(),
      answer: newA.trim(),
      createdAt: Date.now(),
    };
    await import('@/lib/db').then(db => db.addQAMemory(qa));
    if (targetJid === 'global') {
      setGlobalQA(prev => [qa, ...prev]);
    } else {
      setContactQA(prev => [qa, ...prev]);
    }
    setNewQ('');
    setNewA('');
  };

  const handleDeleteQA = async (id: string, isGlobal: boolean) => {
    await import('@/lib/db').then(db => db.deleteQAMemory(id));
    if (isGlobal) {
      setGlobalQA(prev => prev.filter(q => q.id !== id));
    } else {
      setContactQA(prev => prev.filter(q => q.id !== id));
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

      {/* Model Selection */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
          AI Model
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MODELS.map(m => (
            <label
              key={m.id}
              id={`model-${m.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                background: model === m.id ? 'rgba(37,211,102,0.1)' : 'var(--bg-card)',
                border: `1px solid ${model === m.id ? 'var(--accent-green)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'var(--transition)',
              }}
            >
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={model === m.id}
                onChange={() => setModel(m.id)}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: '1.2rem' }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.desc}</div>
              </div>
              {model === m.id && <span style={{ color: 'var(--accent-green)', fontSize: '0.8rem' }}>✓</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Voice Settings */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
          Voice & Audio Settings (Free)
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-card)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Voice Reply Mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'off', label: 'Text Only' },
                { id: 'auto', label: 'Audio PTT' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setVoiceAI(opt.id)}
                  className={`btn btn-sm ${voiceAI === opt.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, fontSize: '0.7rem' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Default AI Voice</label>
            <select 
              value={ttsVoice}
              onChange={e => setTtsVoice(e.target.value)}
              className="input"
              style={{ fontSize: '0.8rem', padding: '8px 10px' }}
            >
              {voices.length > 0 ? voices.map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              )) : (
                <option value="en-US-AndrewNeural">Male (Professional)</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* API Key (Optional for OpenRouter) */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
          Service Configurations (API Key)
        </h4>
        <div style={{ position: 'relative' }}>
          <input
            id="api-key-input"
            type={showKey ? 'text' : 'password'}
            className="input"
            placeholder="OpenRouter/OpenAI API key..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            style={{ fontSize: '0.82rem', paddingRight: '40px' }}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
              color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {showKey ? '👁️' : '🔒'}
          </button>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 5 }}>
          ⚠️ Key is stored securely on the backend (not pushed to GitHub).
        </p>
      </div>

      {/* System Prompt */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
          System Prompt
        </h4>
        <textarea
          id="system-prompt-input"
          className="input"
          placeholder="e.g. You are a professional assistant for an e-commerce business. Be polite and helpful."
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={3}
          style={{ fontSize: '0.82rem' }}
        />
      </div>

      {/* Global Memory / Injected Context */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 8, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
          🧠 Injected Memory (Global)
        </h4>
        <textarea
          id="global-memory-input"
          className="input"
          placeholder="e.g. My name is Asim. I specialize in real estate automation. (AI will use this across all chats)"
          value={globalMemory}
          onChange={e => setGlobalMemory(e.target.value)}
          rows={4}
          style={{ fontSize: '0.82rem' }}
        />
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 5 }}>
          💡 This context is injected into every AI response regardless of the contact.
        </p>
      </div>

      {/* Save Button */}
      <button
        id="save-ai-settings-btn"
        className="btn btn-primary"
        onClick={handleSaveSettings}
        disabled={loading}
        style={{ width: '100%', justifyContent: 'center', marginBottom: 24 }}
      >
        {saved ? '✓ Settings Saved!' : loading ? 'Saving...' : '💾 Save Settings'}
      </button>

      {/* Memory Section (Q/A) */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            🧠 Memory Injection (Q/A)
          </h4>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <button
              className={`btn btn-sm ${isGlobalMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setIsGlobalMode(true)}
              style={{ fontSize: '0.65rem', padding: '4px 8px' }}
            >Global</button>
            <button
              className={`btn btn-sm ${!isGlobalMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setIsGlobalMode(false)}
              disabled={!contactJid}
              style={{ fontSize: '0.65rem', padding: '4px 8px' }}
            >{contactName || 'Contact'}</button>
          </div>
        </div>

        {/* Add Q/A form */}
        <div style={{ background: 'var(--bg-card)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Question / Phrase</label>
              <input
                id="qa-q-input"
                type="text"
                className="input"
                placeholder='e.g. "What is your name?"'
                value={newQ}
                onChange={e => setNewQ(e.target.value)}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Predefined Answer</label>
              <textarea
                id="qa-a-input"
                className="input"
                placeholder='e.g. "My name is Asim"'
                value={newA}
                onChange={e => setNewA(e.target.value)}
                rows={2}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <button
              id="add-qa-btn"
              className="btn btn-primary btn-sm"
              onClick={handleAddQA}
              disabled={!newQ.trim() || !newA.trim()}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              Add {isGlobalMode ? 'Global' : 'Contact'} Q/A Pair
            </button>
          </div>
        </div>

        {/* List Q/A pairs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(isGlobalMode ? globalQA : contactQA).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                No {isGlobalMode ? 'global' : 'specific'} Q/A pairs added
              </p>
            </div>
          ) : (
            (isGlobalMode ? globalQA : contactQA).map(qa => (
              <div key={qa.id} className="memory-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '10px 12px' }}>
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-purple)' }}>Q: {qa.question}</span>
                  <button
                    onClick={() => handleDeleteQA(qa.id, isGlobalMode)}
                    className="btn-ghost btn-icon"
                    style={{ padding: '2px 6px', fontSize: '0.8rem', color: '#ef4444', height: 'fit-content' }}
                  >✕</button>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                  A: {qa.answer}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
