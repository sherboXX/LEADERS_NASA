// The guide: a question box. It answers through ChatGPT (OpenAI API) when a key is
// available, and through the page's own local answerer otherwise, so it always works.
// The AI never supplies chart data: it names what to plot and the page computes it from
// its fitted model and draws it with core/sketch.js.
//
// Where answers come from, in order (the first that works):
//   1. a key pasted in Settings > AI guide (kept in this browser, sent straight to OpenAI)
//   2. the site's shared ChatGPT: tools/ai-proxy/worker.js on Cloudflare, whose address is
//      AI_PROXY in config.js (empty when it is switched off); its key stays on Cloudflare
//   3. tools/serve.py on this computer, which keeps a local key and answers POST /api/ask
//   4. otherwise the page's built-in answers
import { el } from './ui.js';
import { prefs } from './prefs.js';
import { animateSketch } from './sketch.js';
import { ic } from './icons.js';
import { AI_PROXY } from './config.js';

const OPENAI = 'https://api.openai.com/v1/chat/completions';
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);   // serve.py never runs on a hosted copy
const TIMEOUT = 30000;
// Routes found missing (no server here, proxy deleted) or whose key OpenAI rejected; they are
// skipped until the page is reloaded or a different key is pasted.
const off = new Set();

function parse(text) {
  try { return JSON.parse(text); } catch { /* not pure JSON */ }
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* give up */ } }
  return { answer: text.trim() };
}

function routes() {
  return [
    prefs.aiKey && { id: `key:${prefs.aiKey.slice(-8)}`, name: 'your API key', url: OPENAI, auth: { Authorization: `Bearer ${prefs.aiKey}` } },
    AI_PROXY && { id: 'shared', name: "the site's ChatGPT key", url: AI_PROXY, auth: {} },
    LOCAL && { id: 'local', name: 'the key on this computer', url: new URL('/api/ask', location.origin).href, auth: {} },
  ].filter((r) => r && !off.has(r.id));
}
export const hasAI = () => routes().length > 0;

async function send(route, payload) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT);
  try {
    return await fetch(route.url, { method: 'POST', signal: stop.signal,
      headers: { 'Content-Type': 'application/json', ...route.auth }, body: JSON.stringify(payload) });
  } finally {
    clearTimeout(timer);
  }
}

/** Parsed JSON reply, or null when no AI service is reachable. Throws with a short reason when
 *  one was reachable but could not answer (the page then uses its built-in answer). */
export async function askAI(system, question, history = []) {
  const body = { model: prefs.aiModel || 'gpt-6-luna', response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }] };
  let reason = '';
  for (const route of routes()) {
    let res;
    try {
      res = await send(route, body);
      if (res.status === 400) { // a model without JSON mode: ask again in plain text
        const { response_format: _, ...plain } = body;
        res = await send(route, plain);
      }
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('ChatGPT took too long');
      off.add(route.id);   // not reachable: no server here, or the proxy is gone
      continue;
    }
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text === 'string') return parse(text);
      reason = 'the AI service sent an empty answer';
      continue;
    }
    const proxy = route.id === 'shared' || route.id === 'local';
    if (proxy && [403, 404, 405, 501, 503].includes(res.status)) {
      off.add(route.id);   // a proxy that is switched off, or has no key behind it
      if (route.id === 'shared' && res.status === 503) reason = "the site's ChatGPT has no key yet";
      continue;
    }
    if (res.status === 401) { off.add(route.id); reason = `${route.name} was rejected`; continue; }
    reason = res.status === 429 ? 'too many questions right now'
      : res.status === 404 ? `the model "${body.model}" was not found` : `the AI service answered ${res.status}`;
  }
  if (reason) throw new Error(reason);
  return null;
}

/**
 * @param system  () => system prompt (facts about the page's current state)
 * @param local   (question) => { answer, steps?, chart?, set? } without any AI
 * @param sketch  (chart) => sketch spec or null
 * @param act     (reply) => apply reply.set / reply.open
 * @param onAsk   (question) => called as soon as a question is asked
 * Returns { el: nodes to put in a panel, ask(question) }.
 */
export function createAsk({ placeholder, samples = [], hint, system, local, sketch, act, onAsk }) {
  const input = el('input', { type: 'text', 'aria-label': 'Your question', placeholder, autocomplete: 'off' });
  const answer = el('div', { class: 'answer', 'aria-live': 'polite' }, el('div', { class: 'route', text: 'Guide ready' }), hint);
  const history = [];
  async function ask(question) {
    const q = question.trim();
    if (!q) return;
    onAsk?.(q);
    answer.classList.add('busy');
    answer.replaceChildren(el('div', { class: 'route', text: 'Thinking…' }), q);
    let reply = null;
    let note = '';
    try { reply = await askAI(system(), q, history.slice(-4)); } catch (err) { note = ` · ChatGPT is off: ${err.message}`; }
    const fromAI = !!reply && typeof reply.answer === 'string';
    if (!fromAI) reply = local(q);
    history.push({ role: 'user', content: q }, { role: 'assistant', content: reply.answer });
    answer.classList.remove('busy');
    answer.replaceChildren(el('div', { class: 'route' }, ic(fromAI ? 'spark' : 'book', 'em'), fromAI ? 'ChatGPT' : `Built-in guide${note}`), reply.answer);
    if (Array.isArray(reply.steps) && reply.steps.length) answer.append(el('ol', {}, reply.steps.map((s) => el('li', { text: String(s) }))));
    const spec = reply.chart && sketch ? sketch(reply.chart) : null;
    if (spec) {
      const canvas = el('canvas', { role: 'img', 'aria-label': `Chart: ${spec.title}` });
      answer.append(canvas, el('p', { class: 'note', text: 'Drawn from the model fitted to real ISS tests, not by the AI.' }));
      animateSketch(canvas, spec);
    }
    act?.(reply);
  }
  const form = el('form', { autocomplete: 'off', onsubmit: (e) => { e.preventDefault(); const q = input.value; input.value = ''; ask(q); } },
    input, el('button', { type: 'submit', text: 'Ask' }));
  const chips = el('div', { class: 'samples' }, samples.map((s) => el('button', { type: 'button', text: s, onclick: () => ask(s) })));
  return { el: [form, chips, answer], ask };
}
