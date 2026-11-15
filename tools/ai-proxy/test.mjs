// Checks the guide proxy without a real key or any network: OpenAI is replaced by a stub.
// Run: node tools/ai-proxy/test.mjs
import worker, { clean } from './worker.js';

const SITE = 'https://sherboxx.github.io';
const env = { OPENAI_API_KEY: 'not-a-real-key' };
let sent = null;
globalThis.fetch = async (url, init) => {
  sent = { url, headers: init.headers, body: JSON.parse(init.body) };
  if (sent.body.messages.some((m) => m.content === 'trigger-401')) return new Response('{"error":{"message":"Incorrect API key provided: sk-...abcd"}}', { status: 401 });
  return new Response(JSON.stringify({ id: 'x', usage: { total_tokens: 9 }, choices: [{ message: { content: '{"answer":"ok"}' } }] }), { status: 200 });
};
const call = (method, { origin = SITE, body, ip = '1.1.1.1', e = env } = {}) => worker.fetch(new Request('https://proxy.example/', {
  method, headers: { ...(origin ? { Origin: origin } : {}), 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
  body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), e);
const ask = { model: 'gpt-expensive', max_tokens: 99999, n: 5, tools: [{}], response_format: { type: 'json_object' },
  messages: [{ role: 'system', content: 'You are the guide.' }, { role: 'user', content: 'Why is fire a ball?' }] };

let failed = 0;
const check = (name, ok) => { if (!ok) failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

let r = await call('GET', { origin: null });
check('GET says it is running', r.status === 200 && (await r.text()).includes('running'));
r = await call('OPTIONS');
check('preflight from the site: 204 with CORS', r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === SITE);
r = await call('POST', { origin: 'https://evil.example', body: ask });
check('another website is refused, without CORS', r.status === 403 && !r.headers.get('Access-Control-Allow-Origin'));
r = await call('POST', { origin: null, body: ask });
check('a request with no Origin is refused', r.status === 403);
r = await call('POST', { body: ask, e: {} });
check('no key set: 503', r.status === 503);
r = await call('POST', { body: ask, ip: '2.2.2.2' });
const data = await r.json();
check('a good question is answered', r.status === 200 && data.choices[0].message.content === '{"answer":"ok"}');
check('the answer carries CORS for the site', r.headers.get('Access-Control-Allow-Origin') === SITE);
check('OpenAI gets the key from the secret', sent.headers.Authorization === 'Bearer not-a-real-key');
check('our model, not the page\'s', sent.body.model === 'gpt-6-luna');
check('answer length is capped', sent.body.max_completion_tokens === 900 && !('max_tokens' in sent.body));
check('extra fields are dropped', !('n' in sent.body) && !('tools' in sent.body));
check('JSON mode is passed on', sent.body.response_format?.type === 'json_object');
check('usage and ids are not passed back', !('usage' in data) && !('id' in data));
check('MODEL setting is used', clean(ask, { MODEL: 'gpt-x' }).model === 'gpt-x');
r = await call('POST', { body: '{not json', ip: '3.3.3.3' });
check('broken JSON: 400', r.status === 400);
r = await call('POST', { body: { messages: Array.from({ length: 13 }, () => ({ role: 'user', content: 'x' })) }, ip: '3.3.3.3' });
check('too many messages: 400', r.status === 400);
r = await call('POST', { body: { messages: [{ role: 'tool', content: 'x' }] }, ip: '3.3.3.3' });
check('unknown role: 400', r.status === 400);
r = await call('POST', { body: { messages: [{ role: 'user', content: 'x'.repeat(70000) }] }, ip: '3.3.3.3' });
check('huge request: 413', r.status === 413);
r = await call('POST', { body: { messages: [{ role: 'user', content: 'trigger-401' }] }, ip: '4.4.4.4' });
const err = await r.text();
check('OpenAI rejecting the key gives 401 without its message', r.status === 401 && !err.includes('sk-'));
let last = 0;
for (let i = 0; i < 21; i++) last = (await call('POST', { body: ask, ip: '5.5.5.5' })).status;
check('the 21st question in 10 minutes from one visitor: 429', last === 429);
check('another visitor is still answered', (await call('POST', { body: ask, ip: '6.6.6.6' })).status === 200);

console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
