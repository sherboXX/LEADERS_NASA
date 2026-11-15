// Checks that every experiment is wired end to end: catalog, lab spec, Application entry.
// Run: node tools/check_site.mjs
import { readFileSync } from 'node:fs';
import { CATALOG } from '../engines/catalog.js';
globalThis.window = {};
await import('../application/experiments.js');
const apps = window.FREEFALL_EXPERIMENTS;
const zones = Object.keys(window.FREEFALL_ZONES);
const problems = [];
const specs = {};
for (const name of ['solid', 'smoke', 'jet', 'burner']) {
  const src = readFileSync(new URL(`../engines/${name}/spec.js`, import.meta.url), 'utf8');
  specs[name] = [...src.matchAll(/\{ id: '([a-z0-9]+)', name: '/g)].map((m) => m[1]);
}
const droplet = [...readFileSync(new URL('../engines/droplet/engine.js', import.meta.url), 'utf8').matchAll(/^  ([a-z0-9]+): \{ id: '\1'/gm)].map((m) => m[1]);
for (const x of CATALOG) {
  const m = x.url.match(/^lab\.html\?engine=(\w+)&exp=(\w+)$/) || x.url.match(/^(droplet)\.html\?exp=(\w+)$/);
  if (!m) { problems.push(`${x.id}: odd url ${x.url}`); continue; }
  const known = m[1] === 'droplet' ? droplet : specs[m[1]] || [];
  if (m[2] !== x.id || !known.includes(x.id)) problems.push(`${x.id}: not defined in the ${m[1]} engine`);
  const app = apps[x.id];
  if (!app) { problems.push(`${x.id}: no Application entry`); continue; }
  if (app.back !== `../${x.url}`) problems.push(`${x.id}: Application back link ${app.back}`);
  for (const i of app.items) if (!zones.includes(i.zone) || i.zone === 'cables' || !i.place || !i.head || !i.text) problems.push(`${x.id}: bad item ${i.zone}`);
}
for (const id of Object.keys(apps)) if (!CATALOG.some((x) => x.id === id)) problems.push(`${id}: Application entry without a catalog card`);
console.log(`${CATALOG.length} experiments in the catalog, ${Object.keys(apps).length} with Application entries, engines: ${Object.entries(specs).map(([k, v]) => `${k} ${v.length}`).join(', ')}, droplet ${droplet.length}`);
console.log(problems.length ? problems.join('\n') : 'all wired');
