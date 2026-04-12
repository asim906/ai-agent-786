export const DEMO_CONTACTS = [
  {
    id: 'demo-1',
    userId: 'demo',
    jid: '1234567890@s.whatsapp.net',
    name: 'John Doe (Client)',
    phone: '1234567890',
    lastMessage: 'Hello, I need help with my order!',
    lastTime: Date.now() - 1000 * 60 * 5,
    unread: 2,
    aiEnabled: true,
  },
  {
    id: 'demo-2',
    userId: 'demo',
    jid: '0987654321@s.whatsapp.net',
    name: 'Sarah Smith',
    phone: '0987654321',
    lastMessage: 'Thanks for the quick reply!',
    lastTime: Date.now() - 1000 * 60 * 30,
    unread: 0,
    aiEnabled: false,
  },
  {
    id: 'demo-3',
    userId: 'demo',
    jid: '1122334455@s.whatsapp.net',
    name: 'Mike Johnson (Lead)',
    phone: '1122334455',
    lastMessage: 'What are your pricing plans?',
    lastTime: Date.now() - 1000 * 60 * 60 * 2,
    unread: 0,
    aiEnabled: true,
  },
];

export const DEMO_MESSAGES = [
  {
    id: 'msg-1',
    userId: 'demo',
    contactJid: '1234567890@s.whatsapp.net',
    text: 'Hello, I need help with my order!',
    fromMe: false,
    timestamp: Date.now() - 1000 * 60 * 10,
    aiGenerated: false,
  },
  {
    id: 'msg-2',
    userId: 'demo',
    contactJid: '1234567890@s.whatsapp.net',
    text: 'Hello John! I would be happy to help. Can you please provide your order ID?',
    fromMe: true,
    timestamp: Date.now() - 1000 * 60 * 9,
    aiGenerated: true,
  },
  {
    id: 'msg-3',
    userId: 'demo',
    contactJid: '1234567890@s.whatsapp.net',
    text: 'Sure, it is #ORD-4567',
    fromMe: false,
    timestamp: Date.now() - 1000 * 60 * 5,
    aiGenerated: false,
  },
];

export const DEMO_LEADS = [
  {
    id: 'lead-1',
    userId: 'demo',
    contactJid: '1122334455@s.whatsapp.net',
    data: {
      Name: 'Mike Johnson',
      Phone: '1122334455',
      Email: 'mike@company.com',
      Interest: 'Annual Plan',
      Source: 'WhatsApp Chat',
    },
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'lead-2',
    userId: 'demo',
    contactJid: '9988776655@s.whatsapp.net',
    data: {
      Name: 'Alice Brown',
      Phone: '9988776655',
      Email: 'alice@gmail.com',
      Interest: 'Enterprise Solution',
      Source: 'Lead Form',
    },
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

export const DEMO_STATS = {
  contacts_seen: 142,
  messages_sent: 2840,
  leads_generated: 24,
  ai_replies: 1980,
};
