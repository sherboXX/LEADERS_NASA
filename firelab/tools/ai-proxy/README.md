# Shared ChatGPT for every visitor

`worker.js` is a small proxy for Cloudflare Workers (free plan). The site sends each question
to it, the Worker adds the OpenAI key it keeps in its own settings and asks OpenAI. Visitors
need no key, and the key never appears in the website.

The Worker only answers the site's own addresses, always uses one model, caps every answer and
allows about 20 questions per visitor every 10 minutes. A determined person could still spend
the key's credit, so give the key a budget on the OpenAI side and delete both when done.

`node tools/ai-proxy/test.mjs` checks the Worker without a key or network.

## Switch it on

1. **OpenAI** (platform.openai.com): create a new secret key for this, in a project with a
   low monthly budget (project settings, Limits).
2. **Cloudflare** (dash.cloudflare.com, free account): Workers & Pages, Create, Worker
   ("Start with Hello World"), name it `freefall-ask`, Deploy.
3. Edit code: delete everything in the editor, paste all of `worker.js`, Deploy.
4. The Worker's Settings, Variables and Secrets, Add: type **Secret**, name
   `OPENAI_API_KEY`, value: the key. Save and deploy.
5. Open the Worker's address (`https://freefall-ask.<your-account>.workers.dev`). It should
   say "Freefall guide proxy is running."
6. Put that address in `engines/core/config.js` (`AI_PROXY`) and publish the site
   (`python tools/publish.py "Shared ChatGPT on" --push`).

Optional plain variables on the Worker: `MODEL` (default `gpt-6-luna`; set one the key can
use), `MAX_TOKENS` (default 900), `ALLOWED_ORIGINS` (comma-separated; add the address if the
site moves to a custom domain).

## Switch it off

1. Cloudflare: Workers & Pages, `freefall-ask`, Settings, Delete.
2. OpenAI: revoke the key.
3. Set `AI_PROXY` back to `''` and publish. Until then the site simply falls back to its
   built-in answers.
