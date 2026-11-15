// Freefall guide proxy: gives every visitor of the site ChatGPT answers without a key of
// their own. It runs on Cloudflare Workers (free plan). The OpenAI key is stored there as the
// secret OPENAI_API_KEY and never leaves Cloudflare: this file holds no secret and can be
// public. If the Worker is deleted, the site falls back to its built-in answers by itself.
//
// Limits, so a public address cannot run up a bill:
//   - only the site's own addresses may call it (ALLOWED_ORIGINS)
//   - one model, chosen here (MODEL), whatever the page asks for
//   - short answers (MAX_TOKENS), small requests, a few messages
//   - about 20 questions per visitor every 10 minutes
// The real safety net is a budget on the OpenAI project the key belongs to.
//
// Settings (in Cloudflare: the Worker > Settings > Variables and Secrets):
//   OPENAI_API_KEY   secret, required
//   MODEL            optional, default below
//   MAX_TOKENS       optional, default 900
//   ALLOWED_ORIGINS  optional, comma-separated, default below

const OPENAI = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-6-luna';
const DEFAULT_ORIGINS = ['https://sherboxx.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const MAX_BODY = 64 * 1024;          // bytes per request
const MAX_MESSAGES = 12;             // system prompt, a little history, the question
const MAX_CHARS = 48000;             // all message text together
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 20;               // questions per visitor address per window
const seen = new Map();              // address -> [window start, count], per Worker instance

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

function reply(status, data, headers = {}) {
  const text = typeof data === 'string';
  return new Response(text ? data : JSON.stringify(data), { status, headers: {
    'Content-Type': text ? 'text/plain; charset=utf-8' : 'application/json', 'Cache-Control': 'no-store', ...headers } });
}

export function limited(address, now = Date.now()) {
  const entry = seen.get(address);
  if (!entry || now - entry[0] > WINDOW_MS) seen.set(address, [now, 1]);
  else if (++entry[1] > PER_WINDOW) return true;
  if (seen.size > 5000) for (const [k, v] of seen) if (now - v[0] > WINDOW_MS) seen.delete(k);
  return false;
}

/** The request OpenAI receives: only the messages, the JSON switch, our model and our cap. */
export function clean(body, env = {}) {
  const messages = body && body.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES) return null;
  let chars = 0;
  for (const m of messages) {
    if (!m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return null;
    chars += m.content.length;
  }
  if (chars > MAX_CHARS) return null;
  const out = {
    model: env.MODEL || DEFAULT_MODEL,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_completion_tokens: Math.min(Math.max(Number(env.MAX_TOKENS) || 900, 100), 4000),
  };
  if (body.response_format && body.response_format.type === 'json_object') out.response_format = { type: 'json_object' };
  return out;
}

export default {
  async fetch(request, env) {
    if (request.method === 'GET') return reply(200, 'Freefall guide proxy is running.');
    const origins = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : DEFAULT_ORIGINS).map((s) => s.trim()).filter(Boolean);
    const origin = request.headers.get('Origin') || '';
    if (!origins.includes(origin)) return reply(403, { error: 'This address only answers the Freefall site.' });
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { error: 'POST only.' }, headers);
    if (!env.OPENAI_API_KEY) return reply(503, { error: 'The proxy has no OpenAI key yet.' }, headers);
    if (limited(request.headers.get('CF-Connecting-IP') || 'unknown')) {
      return reply(429, { error: 'Too many questions. Try again in a few minutes.' }, headers);
    }
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return reply(413, { error: 'Request too large.' }, headers);
    const text = await request.text();
    if (text.length > MAX_BODY) return reply(413, { error: 'Request too large.' }, headers);
    let body;
    try { body = JSON.parse(text); } catch { return reply(400, { error: 'Not JSON.' }, headers); }
    const payload = clean(body, env);
    if (!payload) return reply(400, { error: 'Unexpected request.' }, headers);

    let res;
    try {
      res = await fetch(OPENAI, { method: 'POST', body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` } });
    } catch {
      return reply(502, { error: 'OpenAI could not be reached.' }, headers);
    }
    // OpenAI's own error text can quote part of the key, so only the status is passed on
    if (!res.ok) return reply(res.status, { error: `OpenAI answered ${res.status}.` }, headers);
    const data = await res.json().catch(() => null);
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== 'string') return reply(502, { error: 'Empty answer from OpenAI.' }, headers);
    return reply(200, { choices: [{ message: { content } }] }, headers);
  },
};
