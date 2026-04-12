import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface WASchema extends DBSchema {
  contacts: {
    key: string;
    value: {
      id: string;
      userId: string;
      jid: string;
      name: string;
      phone: string;
      lastMessage: string;
      lastTime: number;
      unread: number;
      aiEnabled: boolean;
      avatar?: string;
    };
    indexes: { 'by-userId': string };
  };
  messages: {
    key: string;
    value: {
      id: string;
      userId: string;
      contactJid: string;
      text: string;
      type?: 'text' | 'audio' | 'image';
      fromMe: boolean;
      timestamp: number;
      aiGenerated: boolean;
      transcription?: string;
      extractedText?: string;
      audioUrl?: string;
      imageUrl?: string;
    };
    indexes: { 'by-contact': string };
  };
  memory: {
    key: string;
    value: {
      id: string;
      userId: string;
      contactJid: string;
      content: string;
      createdAt: number;
    };
    indexes: { 'by-contact': string };
  };
  qa_memory: {
    key: string;
    value: {
      id: string;
      userId: string;
      contactJid: string;
      question: string;
      answer: string;
      createdAt: number;
    };
    indexes: { 'by-contact': string };
  };
  leads: {
    key: string;
    value: {
      id: string;
      userId: string;
      contactJid: string;
      data: Record<string, string>;
      createdAt: number;
    };
    indexes: { 'by-userId': string };
  };
  settings: {
    key: string;
    value: {
      key: string;
      userId: string;
      value: string;
    };
  };
  stats: {
    key: string;
    value: {
      key: string;
      userId: string;
      count: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<WASchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WASchema>('whatsapp-ai-db', 6, {
      upgrade(db, oldVersion) {
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', { keyPath: 'id' });
          contactStore.createIndex('by-userId', 'userId');
        }
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-contact', 'contactJid');
        }
        if (!db.objectStoreNames.contains('memory')) {
          const memoryStore = db.createObjectStore('memory', { keyPath: 'id' });
          memoryStore.createIndex('by-contact', 'contactJid');
        }
        if (!db.objectStoreNames.contains('qa_memory')) {
          const qaStore = db.createObjectStore('qa_memory', { keyPath: 'id' });
          qaStore.createIndex('by-contact', 'contactJid');
        }
        if (!db.objectStoreNames.contains('leads')) {
          const leadsStore = db.createObjectStore('leads', { keyPath: 'id' });
          leadsStore.createIndex('by-userId', 'userId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'key' });
        }

        // Migration logic
        if (oldVersion < 6) {
          // No structural change needed for existing stores, 
          // but version bump ensures schema compatibility for new fields.
        }
      },
    });
  }
  return dbPromise;
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(userId: string) {
  const db = await getDB();
  return db.getAllFromIndex('contacts', 'by-userId', userId);
}

export async function upsertContact(contact: WASchema['contacts']['value']) {
  const db = await getDB();
  await db.put('contacts', contact);
}

export async function getContact(id: string) {
  const db = await getDB();
  return db.get('contacts', id);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(userId: string, contactJid: string) {
  const db = await getDB();
  const all = await db.getAllFromIndex('messages', 'by-contact', contactJid);
  return all
    .filter(m => m.userId === userId)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-20);
}

export async function addMessage(msg: WASchema['messages']['value']) {
  const db = await getDB();
  await db.put('messages', msg);
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export async function getMemory(userId: string, contactJid: string) {
  const db = await getDB();
  const all = await db.getAllFromIndex('memory', 'by-contact', contactJid);
  return all.filter(m => m.userId === userId);
}

export async function addMemory(mem: WASchema['memory']['value']) {
  const db = await getDB();
  await db.put('memory', mem);
}

export async function deleteMemory(id: string) {
  const db = await getDB();
  await db.delete('memory', id);
}

// ─── QA Memory ───────────────────────────────────────────────────────────────

export async function getQAMemory(userId: string, contactJid: string) {
  const db = await getDB();
  const all = await db.getAllFromIndex('qa_memory', 'by-contact', contactJid);
  return all.filter(m => m.userId === userId);
}

export async function addQAMemory(qa: WASchema['qa_memory']['value']) {
  const db = await getDB();
  await db.put('qa_memory', qa);
}

export async function deleteQAMemory(id: string) {
  const db = await getDB();
  await db.delete('qa_memory', id);
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function getLeads(userId: string) {
  const db = await getDB();
  return db.getAllFromIndex('leads', 'by-userId', userId);
}

export async function upsertLead(lead: WASchema['leads']['value']) {
  const db = await getDB();
  await db.put('leads', lead);
}

export async function deleteLead(id: string) {
  const db = await getDB();
  await db.delete('leads', id);
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.get('settings', `${userId}:${key}`);
  return row?.value ?? null;
}

export async function setSetting(userId: string, key: string, value: string) {
  const db = await getDB();
  await db.put('settings', { key: `${userId}:${key}`, userId, value });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function incrementStat(userId: string, key: string) {
  const db = await getDB();
  const statKey = `${userId}:${key}`;
  const existing = await db.get('stats', statKey);
  await db.put('stats', { key: statKey, userId, count: (existing?.count ?? 0) + 1 });
}

export async function getStat(userId: string, key: string): Promise<number> {
  const db = await getDB();
  const row = await db.get('stats', `${userId}:${key}`);
  return row?.count ?? 0;
}
