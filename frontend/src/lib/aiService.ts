export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type AIModel = 'openai' | 'gemini' | 'openrouter';

export async function generateReply(
  model: AIModel,
  apiKey: string,
  messages: AIMessage[],
  memory: string[],
  globalMemory?: string
): Promise<string> {
  let context = 'You are a helpful WhatsApp assistant. Reply naturally and concisely.';
  
  const systemContextParts = [];
  if (globalMemory) {
    systemContextParts.push(`--- SYSTEM CONTEXT ---\n${globalMemory}`);
  }
  if (memory.length > 0) {
    systemContextParts.push(`--- CONTACT CONTEXT ---\n${memory.join('\n')}`);
  }

  if (systemContextParts.length > 0) {
    context = `You are a professional and concise WhatsApp assistant. Use the following context to guide your response:\n\n${systemContextParts.join('\n\n')}\n\nIMPORTANT: If you see a message as "[Voice Message]" without transcription, it means you are listening to it. Do NOT say you cannot listen to voice notes. Instead, ask for specific details or continue the conversation based on previous context. Keep replies 1-3 sentences.`;
  }

  const fullMessages: AIMessage[] = [
    { role: 'system', content: context },
    ...messages,
  ];

  switch (model) {
    case 'openai':
      return callOpenAI(apiKey, fullMessages);
    case 'gemini':
      return callGemini(apiKey, fullMessages);
    case 'openrouter':
      return callOpenRouter(apiKey, fullMessages);
    default:
      throw new Error(`Unknown model: ${model}`);
  }
}

async function callOpenAI(apiKey: string, messages: AIMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callGemini(apiKey: string, messages: AIMessage[]): Promise<string> {
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const systemMsg = messages.find(m => m.role === 'system');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
    }
  );
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Gemini API Error:', errorText);
    throw new Error(`Gemini error: ${res.status} - ${errorText}`);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

async function callOpenRouter(apiKey: string, messages: AIMessage[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://whatsapp-ai-agent.app',
      'X-Title': 'WhatsApp AI Agent',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages,
      max_tokens: 400,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}
