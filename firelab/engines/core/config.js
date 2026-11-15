// Settings for this copy of the site.
//
// AI_PROXY: address of the shared ChatGPT proxy (tools/ai-proxy/worker.js deployed on
// Cloudflare Workers), or '' to switch it off. With it, every visitor gets ChatGPT answers
// without a key of their own. The OpenAI key stays in the Worker's settings, so this address
// is not a secret. If the Worker is deleted, the site falls back to its built-in answers.
export const AI_PROXY = 'https://freefall-ask.mohammed-mustafa0705.workers.dev/';   // switched on 2026-11-15, to be removed at the end of the day
