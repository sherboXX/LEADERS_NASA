// Connects the Freefall Fire Console (the Application section) to the rest of the site
// without changing the console's own code. It:
//   1. removes what the team took out (the Wiring zone),
//   2. turns every console panel into a dock tab that starts minimised,
//   3. adds Settings (shared with the experiment pages),
//   4. sends the console's Ask box through ChatGPT when a key is available,
//   5. with ?exp=<id>, shows where that experiment applies: it waits on the station
//      exterior, flies inside to the place, and adds the finding to the briefing.
// It drives the console only through the address hash, which the console already follows.
import { el } from '../engines/core/ui.js';
import { prefs } from '../engines/core/prefs.js';
import { createDock, buildSettings, em } from '../engines/core/dock.js';
import { ic } from '../engines/core/icons.js';
import { askAI, hasAI, createAsk } from '../engines/core/ask.js';
import { homeGuide } from '../engines/core/home.js';
import { startMusic, musicButton } from '../engines/core/music.js';

const $ = (s) => document.querySelector(s);
const query = new URLSearchParams(location.search);
const exp = (window.FREEFALL_EXPERIMENTS || {})[query.get('exp')];
const ZONES = window.FREEFALL_ZONES || {};
const ORDER = ['vent', 'smoke', 'cables', 'battery', 'o2', 'quarters', 'ext', 'rack']; // the console's own order
const REMOVED = ['cables'];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const current = () => location.hash.slice(1);
const brief = $('#brief');

// ---------- 1. removed zones ----------
const navButtons = [...document.querySelectorAll('#nav button')];
for (const id of REMOVED) navButtons[ORDER.indexOf(id)]?.remove();
for (const tag of document.querySelectorAll('#tags .tag')) if (tag.textContent.trim() === 'Wiring') tag.classList.add('xp-gone');
for (const b of document.querySelectorAll('#samples button')) if (/burning plastic/i.test(b.textContent)) b.remove();

// the brand leads back to the list of experiments, as it does on the experiment pages
const brand = $('.brand');
brand.title = 'All experiments';
brand.addEventListener('click', () => { location.href = '../index.html#experiments'; });
if (!exp) $('.tabs').prepend(el('button', { type: 'button', class: 'xp-tab', text: '‹ All experiments', onclick: () => { location.href = '../index.html#experiments'; } }));

// ---------- 2. dock ----------
const dock = createDock($('.app'), 'app');
dock.add({ id: 'places', glyph: 'pin', label: 'Places', panels: [$('#nav')], order: 1 });
dock.add({ id: 'brief', glyph: 'report', label: 'Briefing', panels: [$('.brief')], order: 2 });
dock.add({ id: 'air', glyph: 'wind', label: 'Air', panels: [$('.atmo')], order: 3 });
dock.add({ id: 'ask', glyph: 'chat', label: 'Ask', panels: [$('.ask')], order: 4 });
dock.add({ id: 'stats', glyph: 'bars', label: 'Stats', panels: [$('.center')], order: 5, adv: true });
dock.add({ id: 'charts', glyph: 'chart', label: 'Charts', panels: [$('.bottom')], order: 6, adv: true });
$('.ask .ph small').textContent = 'ChatGPT or built-in';

// ---------- 3. settings ----------
const settings = buildSettings({ dock, scope: 'app', links: [['How this was built', '../architecture.html']], displays: [
  { key: 'app.title', label: 'Title', apply: (on) => { $('.title').hidden = !on; } },
  { key: 'app.tags', label: 'Place tags in 3D', apply: (on) => { $('#tags').classList.toggle('xp-notags', !on); } },
  { key: 'app.chip', label: 'Atmosphere read-out', apply: (on) => { $('#atmo-chip').hidden = !on; } },
  { key: 'app.vignette', label: 'Darkened edges', apply: (on) => { $('.vignette').hidden = !on; } },
] });
$('.right').append(settings);
$('.top .tools')?.append(musicButton());
startMusic();
dock.add({ id: 'settings', glyph: 'gear', label: 'Settings', panels: [settings], order: 9 });

// ---------- 4. the Ask box through ChatGPT ----------
function systemPrompt() {
  return [
    'You are the guide inside Freefall\'s station view: a 3D International Space Station that shows where NASA microgravity fire research matters. Users are students as well as engineers.',
    `Reader level: ${prefs.level}. ${prefs.level === 'beginner' ? 'Use everyday words, at most 60 words.' : 'Be precise and technical, at most 110 words.'} Plain text only, no markdown.`,
    `Places on the station, as id: facts.\n${Object.entries(ZONES).filter(([id]) => !REMOVED.includes(id)).map(([id, z]) => `${id}: ${z.name}. ${z.facts}`).join('\n')}`,
    exp ? `The user arrived from the ${exp.name} experiment (${exp.title}). What it found, by place:\n${exp.items.map((i) => `${i.zone} (${i.kind}): ${i.head}. ${i.text}`).join('\n')}` : '',
    `Cabin air now: ${$('#atmo-chip').textContent}.${current() ? ` The camera is at "${current()}".` : ''}`,
    'Reply with one JSON object: {"answer": string, "zone": one of the ids above, or null}. Set "zone" to the place that best fits the question; the app flies the camera there. Use only the facts given here.',
  ].filter(Boolean).join('\n');
}
const form = $('#ask-form');
const input = $('#q');
const answer = $('#answer');
let passing = false;
document.addEventListener('submit', (e) => {
  if (e.target !== form || passing || !hasAI()) return; // no AI: the console's own keyword answers
  const q = input.value.trim();
  if (!q) return;
  e.preventDefault();
  e.stopPropagation();
  input.value = '';
  answer.replaceChildren(el('div', { class: 'route', text: 'Thinking…' }), q);
  const fallback = () => { passing = true; input.value = q; form.requestSubmit(); passing = false; };
  askAI(systemPrompt(), q).then((reply) => {
    if (!reply || typeof reply.answer !== 'string') { fallback(); return; }
    const zone = ZONES[reply.zone] && !REMOVED.includes(reply.zone) ? reply.zone : null;
    answer.replaceChildren(el('div', { class: 'route' }, ic('spark', 'em'), zone ? `ChatGPT · flying to ${ZONES[zone].name}` : 'ChatGPT'), reply.answer);
    if (zone) location.hash = zone;
  }).catch(fallback);
}, true);

// ---------- 5. where an experiment applies ----------
const KIND = { danger: ['alert', 'Danger'], application: ['check', 'Application'], site: ['flask', 'Ran here'] };
const HEADING = { danger: 'danger here', application: 'how it is used here', site: 'where it ran' };
let chips = [];
let call = null;
let callText = null;
if (exp) {
  const zones = [...new Set(exp.items.map((i) => i.zone))].filter((z) => !REMOVED.includes(z));
  const first = zones.includes(query.get('focus')) ? query.get('focus') : zones[0];
  $('.tabs').prepend(el('button', { type: 'button', class: 'xp-tab', text: `‹ ${exp.name} experiment`, onclick: () => { location.href = exp.back; } }));
  chips = zones.map((zone) => {
    const item = exp.items.find((i) => i.zone === zone);
    return el('button', { type: 'button', class: 'xp-chip', 'data-zone': zone, onclick: () => { location.hash = zone; } }, em(KIND[item.kind][0]), item.place);
  });
  $('.title').append(el('div', { class: 'xp-places' }, el('span', { text: `${exp.name} matters at` }), chips));
  callText = el('span');
  call = el('div', { class: 'xp-call glass', role: 'status', hidden: true }, callText,
    el('button', { type: 'button', class: 'btn', text: 'Read more', onclick: () => dock.toggle('brief', true) }));
  $('.stage-wrap').append(call);
  for (const zone of zones) navButtons[ORDER.indexOf(zone)]?.classList.add('xp-on');

  // arrive at the spacecraft first, then fly inside
  if (!current()) {
    const loading = $('#loading');
    const wait = setInterval(() => {
      if (!loading.hidden) return;
      clearInterval(wait);
      setTimeout(() => { if (!current()) location.hash = first; }, reduce ? 0 : 1800);
    }, 200);
  }
}

function paint() {
  for (const row of brief.querySelectorAll('.r')) if (row.textContent.includes('Wiring')) row.remove();
  if (!exp) return;
  const zone = current();
  for (const chip of chips) chip.setAttribute('aria-current', String(chip.dataset.zone === zone));
  const items = exp.items.filter((i) => i.zone === zone);
  call.hidden = !items.length;
  if (items.length) {
    const [glyph, kind] = KIND[items[0].kind];
    callText.replaceChildren(em(glyph), el('b', { text: `${kind}: ` }), `${items[0].head}.`);
  }
  const title = brief.querySelector('h2');
  if (!items.length || !title || brief.querySelector('.xp-sec')) return;
  title.after(...items.map((i) => el('div', { class: `sec xp-sec ${i.kind === 'danger' ? 'problem' : i.kind === 'application' ? 'action' : ''}`.trim() },
    el('h3', { text: `${exp.name}: ${HEADING[i.kind]}` }), el('p', {}, el('b', { text: `${i.head}. ` }), i.text))));
}
new MutationObserver(paint).observe(brief, { childList: true });
addEventListener('hashchange', () => setTimeout(paint, 0));
paint();

// ---------- 6. start mode: the first screen of the site ----------
// The site opens here with ?start: the station to turn with the mouse or a finger, the guide's
// chat box in front, and two tabs. Experiments opens the list of labs; Application takes the
// chat away and shows the whole console.
if (query.has('start') && !exp) {
  const app = $('.app');
  app.classList.add('xp-startmode');
  const guide = homeGuide('../');
  const ask = createAsk({
    placeholder: 'Ask about fire in space',
    samples: ['Why is fire a ball in space?', 'How is smoke detected in orbit?', 'How do you put out a fire in space?'],
    system: guide.system,
    local: guide.local,
    act: guide.act,
    onAsk: () => { guide.clear(); reply.classList.add('used'); start.classList.add('asked'); },
  });
  const [askForm, askChips, reply] = ask.el;
  const enter = el('button', { type: 'button' }, ic('station'), 'Application');
  const start = el('section', { class: 'xp-start', 'aria-label': 'Ask about fire in space' },
    el('h1', { text: 'Fire behaves differently in space.' }),
    el('div', { class: 'xp-chat glass' }, askForm, askChips, reply, guide.links),
    el('nav', { class: 'xp-start-tabs', 'aria-label': 'Go to' },
      el('a', { href: '../index.html#experiments' }, ic('flask'), 'Experiments'), enter),
    el('p', { class: 'xp-hint', text: 'Drag to turn the station' }));
  app.append(start);
  enter.addEventListener('click', () => {
    app.classList.remove('xp-startmode');
    start.remove();
    history.replaceState(null, '', location.pathname + location.hash);   // a reload now stays in the console
  });
}
