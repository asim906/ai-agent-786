const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

// ─── App Setup ──────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check for Railway
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// ─── Session Store ──────────────────────────────────────────────────
// userId => { waSocket, status, aiSettings, conversationHistory, starting }
const activeSessions = new Map();

// ─── Broadcast only to sockets that belong to a userId ─────────────
function emitToUser(userId, event, data) {
  io.sockets.sockets.forEach((sock) => {
    if (sock.userId === userId) sock.emit(event, data);
  });
  // Also broadcast globally — frontend filters by userId
  io.emit(event, data);
}

// ─── AI Reply Helper ─────────────────────────────────────────────────
async function generateAIReply(model, apiKey, systemPrompt, history, userText) {
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful WhatsApp assistant. Reply naturally and concisely.' },
    ...history,
    { role: 'user', content: userText },
  ];

  const safeKey = apiKey ? apiKey.trim() : '';
  console.log(`[AI] 🚀 generateAIReply called | model=${model} | keyPrefix=${safeKey ? safeKey.substring(0,12)+'...' : 'EMPTY'} | userText="${userText.substring(0,60)}"`);

  if (!safeKey) {
    console.error('[AI] ❌ API key is empty — cannot call AI');
    return null;
  }

  try {
    if (model === 'gemini') {
      console.log('[AI] Using Gemini 2.0 Flash...');
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      const sys = messages.find(m => m.role === 'system');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${safeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: sys ? { parts: [{ text: sys.content }] } : undefined,
            contents,
            generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
          }),
        }
      );
      const data = await res.json();
      console.log('[AI] Gemini raw response status:', res.status);
      if (data.error) console.error('[AI] Gemini API error:', JSON.stringify(data.error));
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      console.log(`[AI] Gemini reply: ${reply ? reply.substring(0,80) : 'NULL'}`);
      return reply;
    }

    if (model === 'openai') {
      console.log('[AI] Using OpenAI GPT-4o-mini...');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${safeKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000, temperature: 0.7 }),
      });
      const data = await res.json();
      console.log('[AI] OpenAI raw response status:', res.status);
      if (data.error) console.error('[AI] OpenAI API error:', JSON.stringify(data.error));
      const reply = data?.choices?.[0]?.message?.content?.trim() || null;
      console.log(`[AI] OpenAI reply: ${reply ? reply.substring(0,80) : 'NULL'}`);
      return reply;
    }

    // OpenRouter (default)
    const openRouterModel = (model && typeof model === 'string' && model.includes('/')) ? model : 'openai/gpt-4o-mini';
    console.log(`[AI] Using OpenRouter (${openRouterModel})...`);
    
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${safeKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://whatsapp-ai-agent.app',
        'X-Title': 'WhatsApp AI Agent',
      },
      body: JSON.stringify({ 
        model: openRouterModel, 
        messages, 
        max_tokens: 1000,
        temperature: 0.7 
      }),
    });
    const data = await res.json();
    console.log(`[AI] OpenRouter status: ${res.status}`);
    
    // 1. Handle API errors
    if (data.error) {
       const errMsg = data.error.message || JSON.stringify(data.error);
       console.error(`[AI] ❌ OpenRouter Error: ${errMsg}`);
       return `AI API Error: ${errMsg}`;
    }

    // 2. Handle empty/missing choices
    if (!data.choices || data.choices.length === 0) {
       console.error('[AI] ❌ OpenRouter returned NO choices. Full response:', JSON.stringify(data));
       return "AI Error: Model returned no response. Check your OpenRouter credits/quota.";
    }

    const reply = data.choices[0].message?.content?.trim();
    if (!reply) {
       console.error('[AI] ❌ OpenRouter returned empty content. Full response:', JSON.stringify(data));
       return "AI Error: Model returned an empty message.";
    }

    console.log(`[AI] ✅ SUCCESS. Reply (40 chars): "${reply.substring(0, 40)}..."`);
    return reply;

  } catch (err) {
    console.error('[AI] ❌ Exception in generateAIReply:', err.message);
    return `AI Exception: ${err.message}`;
  }
}

// ─── Start (or Restore) WhatsApp Session ────────────────────────────
// KEY DESIGN: idempotent — safe to call multiple times for same userId
async function startSession(userId) {
  // ✅ FIX 1: If already connected, do nothing
  const existing = activeSessions.get(userId);
  if (existing?.status === 'connected' && existing?.waSocket?.user) {
    console.log(`[${userId}] Already connected — skipping startSession`);
    emitToUser(userId, 'connection_update', { userId, status: 'connected' });
    return;
  }

  // ✅ FIX 2: If session is already in the process of starting, do nothing
  if (existing?.starting) {
    console.log(`[${userId}] Session already starting — skipping duplicate`);
    return;
  }

  const sessionPath = path.join(SESSIONS_DIR, userId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const aiPath = path.join(sessionPath, 'ai-settings.json');
  let loadedAiConf = {};
  if (fs.existsSync(aiPath)) {
    try { loadedAiConf = JSON.parse(fs.readFileSync(aiPath, 'utf8')); } catch(e){}
  }

  const hookPath = path.join(sessionPath, 'webhook.txt');
  let loadedHook = '';
  if (fs.existsSync(hookPath)) loadedHook = fs.readFileSync(hookPath, 'utf8');

  // Mark as starting to prevent concurrent calls
  activeSessions.set(userId, {
    ...(existing || {}),
    starting: true,
    status: 'connecting',
    aiSettings: existing?.aiSettings ? { ...existing.aiSettings, global: loadedAiConf } : { global: loadedAiConf },
    webhookUrl: loadedHook || existing?.webhookUrl,
    conversationHistory: existing?.conversationHistory || {},
  });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const waSocket = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['WhatsApp AI Pro', 'Chrome', '120.0.0'],
      getMessage: async () => undefined,
      connectTimeoutMs: 30000,
      keepAliveIntervalMs: 15000,
    });

    // Update session store
    const sessionData = activeSessions.get(userId);
    activeSessions.set(userId, { ...sessionData, waSocket, starting: false });

    // ─── Connection Events ──────────────────────────────────────
    waSocket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[${userId}] QR code generated`);
        activeSessions.get(userId).status = 'qr';
        emitToUser(userId, 'qr', { userId, qr });
      }

      if (connection === 'open') {
        console.log(`[${userId}] ✓ WhatsApp connected`);
        const s = activeSessions.get(userId);
        if (s) s.status = 'connected';
        emitToUser(userId, 'connection_update', { userId, status: 'connected' });
      }

      if (connection === 'close') {
        const errCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = errCode === DisconnectReason.loggedOut;
        console.log(`[${userId}] Connection closed. Code: ${errCode}. LoggedOut: ${loggedOut}`);

        const s = activeSessions.get(userId);
        if (s) s.status = 'disconnected';
        emitToUser(userId, 'connection_update', { userId, status: loggedOut ? 'logged_out' : 'disconnected' });

        if (loggedOut) {
          // ✅ FIX 3: Only delete if truly logged out from phone
          activeSessions.delete(userId);
          fs.rmSync(sessionPath, { recursive: true, force: true });
          console.log(`[${userId}] Session cleared — user logged out from phone`);
        } else {
          // ✅ FIX 4: Auto-reconnect with backoff (NOT if browser refresh)
          // Wait 5s then retry silently
          const s2 = activeSessions.get(userId);
          if (s2) s2.starting = false; // allow retry
          setTimeout(async () => {
            const s3 = activeSessions.get(userId);
            // Only retry if the session still exists and is not already connected
            if (s3 && s3.status !== 'connected' && !s3.starting) {
              console.log(`[${userId}] Auto-reconnecting...`);
              await startSession(userId);
            }
          }, 5000);
        }
      }
    });

    waSocket.ev.on('creds.update', saveCreds);

    // ─── Incoming Messages ──────────────────────────────────
    waSocket.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
      if (type !== 'notify') return;

      for (const msg of msgs) {
        if (!msg.message) continue;
        
        const isFromMe = !!msg.key.fromMe;
        const jid = msg.key.remoteJid;
        if (!jid || jid.endsWith('@g.us')) continue;

        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption || '';
        if (!text) continue;

        const senderName = msg.pushName || jid.split('@')[0];
        const phone = jid.split('@')[0];

        // ─── LOG: Incoming message received ───────────────────
        console.log(`\n========================================`);
        console.log(`[${userId}] 📩 INCOMING MESSAGE`);
        console.log(`[${userId}]    From    : ${isFromMe ? 'ME (outgoing)' : senderName} (${jid})`);
        console.log(`[${userId}]    Text    : "${text.substring(0, 80)}"`);
        console.log(`[${userId}]    FromMe  : ${isFromMe}`);
        console.log(`========================================`);

        // Emit ALL messages to frontend (sent from phone AND received)
        emitToUser(userId, 'message', { userId, jid, name: senderName, phone, text, fromMe: isFromMe, timestamp: Date.now() });

        // Fetch session
        const session = activeSessions.get(userId);

        // Webhook Dispatch
        const hookUrl = session?.webhookUrl;
        if (hookUrl && typeof hookUrl === 'string' && hookUrl.startsWith('http')) {
            fetch(hookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: 'message.received', userId,
                    contact: { jid, name: senderName, phone },
                    message: { text, timestamp: Date.now(), fromMe: isFromMe }
                })
            }).catch(() => {}); // silent fail if bad url
        }

        // AI Auto-Reply SHOULD NOT trigger if the message was sent by the user themselves
        if (isFromMe) {
          console.log(`[${userId}] ⏭️  [AI AUTO-SKIP] Message came FROM the bot phone itself. skipping.`);
          continue;
        }

        // ─── LOG: AI trigger check ────────────────────────────
        console.log(`[${userId}] 🤖 [AI STEP 1] Checking auto-reply eligibility...`);

        if (!session) {
          console.log(`[${userId}] ❌ [AI STEP 1 ERROR] No session object found for this user in activeSessions!`);
          continue;
        }

        // Try contact-specific settings first, then global
        let aiConf = session.aiSettings?.[jid] || session.aiSettings?.['global'] || null;

        // ✅ FAIL-SAFE: If settings missing from RAM, try reading from disk
        if (!aiConf || !aiConf.apiKey) {
          console.log(`[${userId}] ⚠️  [AI STEP 2] Config missing in RAM during message receipt. Attempting disk reload...`);
          const aiPath = path.join(SESSIONS_DIR, userId, 'ai-settings.json');
          if (fs.existsSync(aiPath)) {
            try {
              aiConf = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
              session.aiSettings = session.aiSettings || {};
              session.aiSettings['global'] = aiConf;
              console.log(`[${userId}] ✅ [AI STEP 2] Settings successfully re-synced from disk.`);
            } catch (e) {
              console.error(`[${userId}] ❌ [AI STEP 2 ERROR] Failed reading disk settings:`, e.message);
            }
          } else {
            console.log(`[${userId}] ❌ [AI STEP 2 ERROR] No settings file found at ${aiPath}`);
          }
        }

        if (!aiConf) {
          console.log(`[${userId}] ❌ [AI STEP 3 ERROR] No AI configuration found. User must save settings in Dashboard.`);
          continue;
        }

        const trimmedKey = aiConf.apiKey ? aiConf.apiKey.trim() : '';
        if (!trimmedKey) {
          console.log(`[${userId}] ❌ [AI STEP 4 ERROR] API Key is EMPTY after trim. User must enter key in Settings.`);
          continue;
        }

        // ─── LOG: AI Stage 2 ────────────────────────────
        console.log(`[${userId}] ✅ [AI STEP 5 PROCEEDING] Model: ${aiConf.model} | KeyPrefix: ${trimmedKey.substring(0,10)}...`);

        // ─── LOG: AI is triggering ────────────────────────────
        console.log(`[${userId}] ✅ AI TRIGGERING | model=${aiConf.model} | key=${aiConf.apiKey.substring(0,12)}...`);

        if (!session.conversationHistory) session.conversationHistory = {};
        if (!session.conversationHistory[jid]) session.conversationHistory[jid] = [];
        session.conversationHistory[jid].push({ role: 'user', content: text });
        const history = session.conversationHistory[jid].slice(-10);

        console.log(`[${userId}] 📤 Calling AI API...`);
        const reply = await generateAIReply(
          aiConf.model || 'openrouter',
          aiConf.apiKey,
          aiConf.systemPrompt,
          history.slice(0, -1),
          text
        );

        // ─── LOG: AI response captured ────────────────────────
        if (reply) {
          console.log(`[${userId}] ✅ AI RESPONSE RECEIVED: "${reply.substring(0, 100)}"`);
          console.log(`[${userId}] 📱 Sending AI reply to WhatsApp (${jid})...`);
          try {
            await waSocket.sendMessage(jid, { text: reply });
            session.conversationHistory[jid].push({ role: 'assistant', content: reply });
            emitToUser(userId, 'message', {
              userId, jid, name: senderName, phone,
              text: reply, fromMe: true,
              timestamp: Date.now(),
              aiGenerated: true
            });
            console.log(`[${userId}] ✅ AI REPLY SENT SUCCESSFULLY to ${jid}`);
          } catch (sendErr) {
            console.error(`[${userId}] ❌ FAILED to send AI reply via waSocket:`, sendErr.message);
          }
        } else {
          console.log(`[${userId}] ❌ AI returned NULL — reply NOT sent`);
          console.log(`[${userId}] 💡 Check: API key validity, model name, API quota`);
        }
        console.log(`========================================\n`);
      }
    });

  } catch (err) {
    console.error(`[${userId}] startSession error:`, err.message);
    const s = activeSessions.get(userId);
    if (s) { s.starting = false; s.status = 'disconnected'; }
    emitToUser(userId, 'connection_update', { userId, status: 'error', message: err.message });
  }
}

// ─── Socket.IO ──────────────────────────────────────────────────────
io.on('connection', (socketClient) => {
  console.log('[Socket] Client connected:', socketClient.id);

  // ✅ FIX 5: check_session — frontend calls this first on page load
  // Returns current status. If connected, skips QR entirely.
  // If session file exists but not connected yet, starts silently.
  socketClient.on('check_session', async ({ userId }) => {
    if (!userId) return;
    socketClient.userId = userId; // bind for targeted emits

    const session = activeSessions.get(userId);

    // Already connected in memory
    if (session?.status === 'connected' && session?.waSocket?.user) {
      socketClient.emit('connection_update', { userId, status: 'connected' });
      return;
    }

    // Creds file exists → restore session silently (no QR needed)
    const credsPath = path.join(SESSIONS_DIR, userId, 'creds.json');
    if (fs.existsSync(credsPath)) {
      console.log(`[${userId}] Creds found — restoring session silently`);
      socketClient.emit('connection_update', { userId, status: 'connecting' });
      await startSession(userId);
      return;
    }

    // No session at all → user must scan QR
    socketClient.emit('connection_update', { userId, status: 'needs_qr' });
  });

  // ✅ FIX 6: start_session — only called when user explicitly needs QR
  socketClient.on('start_session', async ({ userId }) => {
    if (!userId) return;
    socketClient.userId = userId;
    console.log(`[Socket] start_session requested for: ${userId}`);

    const session = activeSessions.get(userId);
    if (session?.status === 'connected' && session?.waSocket?.user) {
      socketClient.emit('connection_update', { userId, status: 'connected' });
      return;
    }

    await startSession(userId);
  });

  socketClient.on('send_message', async ({ userId, jid, text, imageBase64 }) => {
    const session = activeSessions.get(userId);
    if (!session?.waSocket) return socketClient.emit('error', { message: 'No active session' });
    try {
      if (imageBase64) {
          const buffer = Buffer.from(imageBase64.split(',')[1], 'base64');
          await session.waSocket.sendMessage(jid, { image: buffer, caption: text || '' });
      } else {
          await session.waSocket.sendMessage(jid, { text });
      }
      socketClient.emit('message_sent', { jid, text, timestamp: Date.now() });
    } catch (err) {
      socketClient.emit('error', { message: err.message });
    }
  });

  socketClient.on('save_ai_settings', ({ userId, jid, settings }) => {
    const session = activeSessions.get(userId);
    if (!session) return;
    session.aiSettings[jid] = settings;
  });

  socketClient.on('disconnect', () => {
    console.log('[Socket] Client disconnected:', socketClient.id);
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime(), sessions: activeSessions.size }));

// Debug endpoint — returns RAM state of AI settings for a user
app.get('/api/debug/:userId', (req, res) => {
  const session = activeSessions.get(req.params.userId);
  if (!session) return res.json({ found: false, activeSessions: [...activeSessions.keys()] });
  const ai = session.aiSettings?.global || null;
  res.json({
    found: true,
    status: session.status,
    hasApiKey: !!(ai?.apiKey),
    model: ai?.model || null,
    keyPrefix: ai?.apiKey ? ai.apiKey.substring(0, 12) + '...' : 'EMPTY',
    aiSettingsKeys: session.aiSettings ? Object.keys(session.aiSettings) : [],
    conversationHistoryJids: session.conversationHistory ? Object.keys(session.conversationHistory) : [],
  });
});

// ✅ NEW: Live AI test endpoint — call AI directly to verify key+model work
app.post('/api/test-ai/:userId', async (req, res) => {
  const { userId } = req.params;
  const { testMessage } = req.body;
  const session = activeSessions.get(userId);
  const aiConf = session?.aiSettings?.['global'];

  if (!aiConf) {
    // Try loading from disk
    const aiPath = path.join(SESSIONS_DIR, userId, 'ai-settings.json');
    if (fs.existsSync(aiPath)) {
      try {
        const diskConf = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
        const reply = await generateAIReply(diskConf.model || 'openrouter', diskConf.apiKey, diskConf.systemPrompt, [], testMessage || 'Say hello!');
        return res.json({ source: 'disk', model: diskConf.model, reply, keyPrefix: diskConf.apiKey ? diskConf.apiKey.substring(0,12)+'...' : 'EMPTY' });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to read disk settings', details: e.message });
      }
    }
    return res.status(404).json({ error: 'No AI settings found in memory or disk for this user' });
  }

  const reply = await generateAIReply(aiConf.model || 'openrouter', aiConf.apiKey, aiConf.systemPrompt, [], testMessage || 'Say hello!');
  res.json({ source: 'memory', model: aiConf.model, reply, keyPrefix: aiConf.apiKey ? aiConf.apiKey.substring(0,12)+'...' : 'EMPTY' });
});

app.get('/api/session-status/:userId', (req, res) => {
  const session = activeSessions.get(req.params.userId);
  const connected = session?.status === 'connected' && !!session?.waSocket?.user;
  res.json({ userId: req.params.userId, status: connected ? 'connected' : 'disconnected' });
});

app.post('/api/settings/:userId', (req, res) => {
  const { userId } = req.params;
  const settingsObj = req.body;

  const globalConf = {
    enabled: true,
    model: settingsObj.ai_model || 'openrouter',
    apiKey: settingsObj.ai_api_key ? settingsObj.ai_api_key.trim() : '',
    systemPrompt: ((settingsObj.ai_system_prompt || '') + '\n' + (settingsObj.ai_global_memory || '')).trim(),
  };

  console.log(`[Settings] Saving for userId=${userId} | model=${globalConf.model} | keyPrefix=${globalConf.apiKey ? globalConf.apiKey.substring(0,12)+'...' : 'EMPTY'}`);

  // ✅ FIX: Always update in-memory session — create a minimal entry if session doesn't exist yet
  let session = activeSessions.get(userId);
  if (session) {
    session.aiSettings = session.aiSettings || {};
    session.aiSettings['global'] = globalConf;
    console.log(`[Settings] ✅ Updated in-memory session for ${userId}`);
  } else {
    // Session not in memory yet — persist to disk only; it will be loaded when session starts
    console.log(`[Settings] ⚠️  No active session in memory for ${userId} — saving to disk only`);
    console.log(`[Settings] 💡 Settings will be loaded automatically when WhatsApp reconnects`);
  }

  // Always persist to disk
  const sessionPath = path.join(SESSIONS_DIR, userId);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });
  fs.writeFileSync(path.join(sessionPath, 'ai-settings.json'), JSON.stringify(globalConf, null, 2));
  console.log(`[Settings] ✅ Saved to disk: ${path.join(sessionPath, 'ai-settings.json')}`);

  res.json({ success: true, model: globalConf.model, keySet: !!globalConf.apiKey });
});

// ─── API & Webhook Endpoints ──────────────────────────────────────────────
app.post('/api/webhook/config', (req, res) => {
  const { userId, webhookUrl } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const session = activeSessions.get(userId);
  if (session) session.webhookUrl = webhookUrl;
  
  // Persist to disk
  const p = path.join(SESSIONS_DIR, userId, 'webhook.txt');
  if (webhookUrl) fs.writeFileSync(p, webhookUrl);
  else if (fs.existsSync(p)) fs.unlinkSync(p);
  
  res.json({ success: true });
});

app.post('/api/v1/messages/send', async (req, res) => {
  // Basic API auth & send logic
  const { userId, apiKey, jid, text } = req.body;
  if (!userId || !jid || !text) return res.status(400).json({ error: 'Missing required params' });
  
  const session = activeSessions.get(userId);
  if (!session || !session.waSocket) return res.status(404).json({ error: 'WhatsApp session disconnected or not found' });
  
  try {
    await session.waSocket.sendMessage(jid, { text });
    res.json({ success: true, timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

app.get('/api/v1/contacts', async (req, res) => {
  const { userId } = req.query;
  // This endpoint acts as a proxy, but since we use IndexedDB on the frontend as primary DB,
  // we just return a success message or an array of recent memory to fulfill the API requirement structure.
  res.json({ success: true, contacts: [], message: 'Use frontend IndexedDB for local persistence or attach a remote database.' });
});

// ─── Restore Sessions on Startup ─────────────────────────────────────
async function restoreExistingSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  const userIds = fs.readdirSync(SESSIONS_DIR).filter(f =>
    fs.statSync(path.join(SESSIONS_DIR, f)).isDirectory()
  );
  for (const userId of userIds) {
    const credsPath = path.join(SESSIONS_DIR, userId, 'creds.json');
    if (!fs.existsSync(credsPath)) continue;
    console.log(`[Startup] Restoring: ${userId}`);
    const aiPath = path.join(SESSIONS_DIR, userId, 'ai-settings.json');
    if (fs.existsSync(aiPath)) {
      console.log(`[Startup] ✓ Found AI config for ${userId}`);
    } else {
      console.log(`[Startup] ⚠️  No AI config found for ${userId} — bot will be manual only until configured`);
    }
    try { await startSession(userId); }
    catch (err) { console.error(`[Startup] Failed ${userId}:`, err.message); }
  }
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🚀 WhatsApp AI Backend running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  await restoreExistingSessions();
});
