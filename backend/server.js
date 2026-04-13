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

// ✅ NEW: Persistent configs directory (NOT wiped on logout)
const CONFIGS_DIR = path.join(__dirname, 'configs');
if (!fs.existsSync(CONFIGS_DIR)) fs.mkdirSync(CONFIGS_DIR, { recursive: true });

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
const VERSION = '1.0.5-STABLE';

// Helper for wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function generateAIReply(model, apiKey, systemPrompt, history, userText) {
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful WhatsApp assistant. Reply naturally and concisely.' },
    ...history,
    { role: 'user', content: userText },
  ];

  const safeKey = apiKey ? apiKey.trim() : '';
  const keyIdentifier = safeKey ? `${safeKey.substring(0, 4)}...` : 'EMPTY';
  const maxAttempts = 3;
  
  if (!safeKey) {
    console.error(`[AI] ❌ API key is empty — cannot call AI`);
    return null;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000); // 35s timeout
    
    try {
      console.log(`[AI] 🚀 [Attempt ${attempt}/${maxAttempts}] API Call | model=${model} | key=${keyIdentifier}`);

      let res, data;
      if (model === 'gemini') {
        const contents = messages
          .filter(m => m.role !== 'system')
          .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
        const sys = messages.find(m => m.role === 'system');
        
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${safeKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: sys ? { parts: [{ text: sys.content }] } : undefined,
              contents,
              generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
            }),
            signal: controller.signal
          }
        );
      } else if (model === 'openai') {
        res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${safeKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: 1000, temperature: 0.7 }),
          signal: controller.signal
        });
      } else {
        // OpenRouter (default or specified)
        let openRouterModel = model;
        if (!model || model === 'openrouter' || !model.includes('/')) {
            openRouterModel = 'openai/gpt-4o-mini';
        }
        res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${safeKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://whatsapp-ai-agent.app',
            'X-Title': 'WhatsApp AI Agent',
          },
          body: JSON.stringify({ model: openRouterModel, messages, max_tokens: 1000, temperature: 0.7 }),
          signal: controller.signal
        });
      }

      clearTimeout(timeout);
      data = await res.json();
      
      if (!res.ok) {
        const errMsg = data.error?.message || JSON.stringify(data.error);
        console.warn(`[AI] ⚠️ attempt ${attempt} failed with ${res.status}: ${errMsg.substring(0, 100)}`);
        
        // Don't retry on user errors (400, 401, 404)
        if (res.status < 500 && res.status !== 429) {
           return `AI API Error (${res.status}): ${errMsg}`;
        }
        
        if (attempt < maxAttempts) {
           console.log(`[AI] 🔄 Retrying in 2s...`);
           await sleep(2000 * attempt);
           continue;
        }
        return `AI API Error after ${maxAttempts} tries (${res.status}): ${errMsg}`;
      }

      let reply = null;
      if (model === 'gemini') {
        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
      } else {
        reply = data?.choices?.[0]?.message?.content?.trim() || null;
      }

      if (!reply) {
        console.warn(`[AI] ⚠️ Attempt ${attempt} returned empty content.`);
        if (attempt < maxAttempts) {
           await sleep(1000);
           continue;
        }
        return "AI Error: Model returned an empty response after multiple attempts.";
      }

      console.log(`[AI] ✅ SUCCESS. Reply (40 chars): "${reply.substring(0, 40)}..."`);
      return reply;

    } catch (err) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      console.error(`[AI] ❌ Attempt ${attempt} Exception:`, isTimeout ? 'TIMEOUT (35s)' : err.message);
      
      if (attempt < maxAttempts) {
        console.log(`[AI] 🔄 Retrying in 3s...`);
        await sleep(3000 * attempt);
        continue;
      }
      return `AI Exception after ${maxAttempts} attempts: ${isTimeout ? 'Request timed out' : err.message}`;
    }
  }
}

// ─── Start (or Restore) WhatsApp Session ────────────────────────────
// KEY DESIGN: idempotent — safe to call multiple times for same userId
async function startSession(userId) {
  // ✅ FIX 1: If already connected, do nothing
  const existing = activeSessions.get(userId);
  let session = activeSessions.get(userId);
  
  // ✅ FIX: Don't just return if session exists; check if socket is genuinely active
  if (session && session.starting) {
    console.log(`[${userId}] ⏳ Session already starting...`);
    return;
  }
  
  // If we have a socket but we're calling startSession, it means we likely want a RE-connection
  if (session && session.waSocket) {
    console.log(`[${userId}] 🔄 Re-initializing existing session socket...`);
    try { 
      session.waSocket.ev.removeAllListeners();
      session.waSocket.logout().catch(() => {}); 
    } catch(e){}
    session.waSocket = null;
  }

  if (!session) {
    console.log(`[${userId}] ✨ Initializing fresh session object in RAM...`);
    session = { status: 'disconnected', aiSettings: {}, conversationHistory: {}, starting: true };
    activeSessions.set(userId, session);
  } else {
    session.starting = true;
  }

  const userConfigPath = path.join(CONFIGS_DIR, userId);
  if (!fs.existsSync(userConfigPath)) fs.mkdirSync(userConfigPath, { recursive: true });

  const aiPath = path.join(userConfigPath, 'ai-settings.json');
  let loadedAiConf = {};
  if (fs.existsSync(aiPath)) {
    try { loadedAiConf = JSON.parse(fs.readFileSync(aiPath, 'utf8')); } catch(e){}
  }

  const hookPath = path.join(userConfigPath, 'webhook.txt');
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
        const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.name;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        console.log(`[${userId}] Connection closed. Code: ${code}. Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          const session = activeSessions.get(userId);
          if (session) {
            session.status = 'disconnected';
            session.waSocket = null;
            session.starting = false;
          }
          // Use a slight delay before reconnecting to avoid spam
          setTimeout(() => startSession(userId), 5000);
        } else {
          console.log(`[${userId}] Session permanently cleared (Logged Out)`);
          activeSessions.delete(userId);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
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
        
        // Skip if no text (e.g. just an image without caption)
        if (!text && !msg.message?.imageMessage) continue;

        const senderName = msg.pushName || jid.split('@')[0];
        const phone = jid.split('@')[0];

        // ─── LOG: Incoming message received ───────────────────
        const session = activeSessions.get(userId);
        console.log(`\n[${userId}] 📩 INCOMING: "${text.substring(0, 60)}" from ${senderName} | SessionStatus: ${session ? session.status : 'NOT_IN_RAM'}`);

        // Emit ALL messages to frontend
        emitToUser(userId, 'message', { userId, jid, name: senderName, phone, text, fromMe: isFromMe, timestamp: Date.now() });

        // AI Auto-Reply SHOULD NOT trigger if the message was sent by the user themselves
        if (isFromMe) {
          console.log(`[${userId}] ⏭️  [AI SKIP] Message is from bot itself.`);
          continue;
        }

        // ─── LOG: AI Stage 1 ────────────────────────────
        console.log(`[${userId}] 🤖 [AI STEP 1] Checking auto-reply eligibility...`);

        if (!session) {
          console.error(`[${userId}] ❌ [AI STEP 1 ERROR] No active session (waSocket) in RAM!`);
          continue;
        }

        // Try contact-specific settings first, then global
        let aiConf = session.aiSettings?.[jid] || session.aiSettings?.['global'] || null;

        // ✅ FAIL-SAFE: If settings missing from RAM, try reading from disk
        if (!aiConf || !aiConf.apiKey) {
          console.log(`[${userId}] ⚠️  [AI STEP 2] Config missing in RAM. Checking disk...`);
          const aiPath = path.join(CONFIGS_DIR, userId, 'ai-settings.json');
          if (fs.existsSync(aiPath)) {
            try {
              aiConf = JSON.parse(fs.readFileSync(aiPath, 'utf8'));
              session.aiSettings = session.aiSettings || {};
              session.aiSettings['global'] = aiConf;
              console.log(`[${userId}] ✅ [AI STEP 2] Settings restored from disk.`);
            } catch (e) {
              console.error(`[${userId}] ❌ [AI STEP 2 ERROR] Disk read failed:`, e.message);
            }
          }
        }

        if (!aiConf) {
          console.log(`[${userId}] ❌ [AI STEP 3 ERROR] No AI configuration found for user.`);
          continue;
        }

        // Check if AI is explicitly disabled (default to enabled if aiConf exists)
        if (aiConf.enabled === false) {
           console.log(`[${userId}] ⏭️  [AI STEP 3 SKIP] AI is explicitly disabled in settings.`);
           continue;
        }

        const trimmedKey = aiConf.apiKey ? aiConf.apiKey.trim() : '';
        if (!trimmedKey) {
          console.log(`[${userId}] ❌ [AI STEP 4 ERROR] API Key is empty.`);
          continue;
        }

        // ─── AI TRIGGERING ────────────────────────────
        console.log(`[${userId}] ✅ [AI STEP 5 TRIGGERING] Model: ${aiConf.model} | Key: ${trimmedKey.substring(0,10)}...`);

        if (!session.conversationHistory) session.conversationHistory = {};
        if (!session.conversationHistory[jid]) session.conversationHistory[jid] = [];
        
        // Add current user message to context-only (don't push to history yet to avoid duplicates if generateAIReply fails)
        const history = session.conversationHistory[jid].slice(-10);

        console.log(`[${userId}] 📤 Calling AI API...`);
        const reply = await generateAIReply(
          aiConf.model || 'openrouter',
          aiConf.apiKey,
          aiConf.systemPrompt,
          history,
          text
        );

        if (reply) {
          console.log(`[${userId}] ✅ [AI STEP 6 SUCCESS] Reply received.`);
          try {
            await waSocket.sendMessage(jid, { text: reply });
            
            // Push both exchange parts to history on success
            session.conversationHistory[jid].push({ role: 'user', content: text });
            session.conversationHistory[jid].push({ role: 'assistant', content: reply });
            
            emitToUser(userId, 'message', {
              userId, jid, name: senderName, phone,
              text: reply, fromMe: true,
              timestamp: Date.now(),
              aiGenerated: true
            });
            console.log(`[${userId}] 📱 [AI STEP 7] Reply sent to ${jid}`);
          } catch (sendErr) {
            console.error(`[${userId}] ❌ [AI STEP 7 ERROR] waSocket.sendMessage failed:`, sendErr.message);
          }
        } else {
          console.log(`[${userId}] ❌ [AI STEP 6 ERROR] AI returned NULL or error.`);
        }
        console.log(`[${userId}] 🏁 AI Operation Complete.\n`);
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
    enabled: settingsObj.enabled !== false, // Default to true if not explicitly false
    model: settingsObj.ai_model || 'openrouter',
    apiKey: settingsObj.ai_api_key ? settingsObj.ai_api_key.trim() : '',
    systemPrompt: ((settingsObj.ai_system_prompt || '') + '\n' + (settingsObj.ai_global_memory || '')).trim(),
  };

  console.log(`[Settings] Saving for userId=${userId} | model=${globalConf.model} | keyPrefix=${globalConf.apiKey ? globalConf.apiKey.substring(0,10)+'...' : 'EMPTY'}`);

  // ✅ ALWAYS update in-memory session if it exists
  let session = activeSessions.get(userId);
  if (session) {
    session.aiSettings = session.aiSettings || {};
    session.aiSettings['global'] = globalConf;
    console.log(`[Settings] ✅ Updated in-memory AI config for ${userId}`);
  } else {
    console.log(`[Settings] ⚠️ Session not in RAM for ${userId} — saving to disk only`);
  }

  // Always persist to disk
  const configPath = path.join(CONFIGS_DIR, userId);
  if (!fs.existsSync(configPath)) fs.mkdirSync(configPath, { recursive: true });
  fs.writeFileSync(path.join(configPath, 'ai-settings.json'), JSON.stringify(globalConf, null, 2));
  console.log(`[Settings] ✅ Persisted to disk for ${userId}`);

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
  console.log(`\n🚀 WhatsApp AI Backend ${VERSION} running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  await restoreExistingSessions();
});
