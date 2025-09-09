export const config = { runtime: 'edge' };

function mapToGeminiContents(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => typeof m?.content === 'string' && m.content.trim().length > 0)
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }]
    }));
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server is not configured with GEMINI_API_KEY' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const { messages, model } = await req.json();
    const contents = mapToGeminiContents(messages);
    if (!contents.length) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const targetModel = model || 'models/gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`;

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(text || JSON.stringify({ error: 'Upstream error' }), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
    }
    const data = await upstream.json();
    const reply = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';

    return new Response(JSON.stringify({ reply, raw: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Unexpected error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


