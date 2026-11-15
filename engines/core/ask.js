// The guide: a question box. It answers through ChatGPT (OpenAI API) when a key is
// available, and through the page's own local answerer otherwise, so it always works.
// The AI never supplies chart data: it names what to plot and the page computes it from
// its fitted model and draws it with core/sketch.js.
//
// Where the key comes from, in order:
//   1. Settings > AI guide (stored in this browser, sent straight to api.openai.com)
//   2. tools/serve.py, which keeps the key on the computer and answers POST /api/ask
import { el } from './ui.js';
import { prefs } from './prefs.js';
import { animateSketch } from './sketch.js';
import { ic } from './icons.js';

const OPENAI = 'https://api.openai.com/v1/chat/completions';
let proxy = null; // null = not tried yet, true = serve.py answers, false = not there
let denied = null; // the key source OpenAI rejected, so it is not tried again until it changes

function parse(text) {
  try { return JSON.parse(text); } catch { /* not pure JSON */ }
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* give up */ } }
  return { answer: text.trim() };
}

const source = () => prefs.aiKey || 'server';
export const hasAI = () => denied !== source() && (!!prefs.aiKey || proxy !== false);

/** Parsed JSON reply, or null when no AI service is reachable. Throws on API errors. */
export async function askAI(system, question, history = []) {
  const body = { model: prefs.aiModel || 'gpt-6-luna', response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }] };
  if (denied === source()) return null;
  const send = (url, auth, payload) => fetch(url, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(payload) });
  let res;
  let url = OPENAI;
  let auth = { Authorization: `Bearer ${prefs.aiKey}` };
  if (prefs.aiKey) {
    res = await send(url, auth, body);
  } else {
    // tools/serve.py only ever runs on this computer; a hosted copy of the site has no server to ask
    if (proxy === null && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) proxy = false;
    if (proxy === false) return null;
    url = new URL('/api/ask', location.origin);
    auth = {};
    res = await send(url, auth, body).catch(() => null);
    if (!res || [404, 405, 501, 503].includes(res.status)) { proxy = false; return null; }
    proxy = true;
  }
  if (res.status === 400) { // a model without JSON mode: ask again in plain text
    const { response_format: _, ...plain } = body;
    res = await send(url, auth, plain);
  }
  if (res.status === 401) denied = source();
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'the API key was rejected' : res.status === 429 ? 'the API quota is used up'
      : res.status === 404 ? `the model "${body.model}" was not found` : `the AI service answered ${res.status}`);
  }
  const data = await res.json();
  return parse(data.choices?.[0]?.message?.content || '');
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
