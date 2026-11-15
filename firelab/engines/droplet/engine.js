// FLEX droplet-combustion engine. createDropletEngine(host) builds the page in the
// Freefall console layout (see core/shell.js) and returns
// { set, run, pause, reset, seek, loadTest, benchmark, dispose }.
// The page must provide an import map for "three" and "three/addons/".
import { createShell } from '../core/shell.js';
import { createStage } from '../core/stage.js';
import { el, sliderRow, segRow, segs, createPlot, pct } from '../core/ui.js';
import { prefs } from '../core/prefs.js';
import { em } from '../core/dock.js';
import { createAsk } from '../core/ask.js';
import { playIntro } from '../core/intro.js';
import { FUELS, SETUP, OUTCOME, makePlan, stateAt, curve, nearest, support, interpret, explainChange, clamp } from './model.js';
import { systemPrompt, localAnswer, sketchSpec, introSteps } from './brain.js';
import { createScene } from './scene.js';

const PSIA = 14.696;
const HOME = [1.5, 0.8, 11.8];     // nearly head-on, like the flight camera
const GLYPH = { noburn: 'extinguisher', burnout: 'flame', extinction: 'wind', radiative: 'cool' };
const PHASE = { ready: ['Ready', 'med'], setup: ['Igniting', 'med'], hot: ['Hot flame', ''], cool: ['Cool flame', 'cool'], out: ['Flame out', 'low'] };
const PRESETS = [
  ['ISS cabin', { o2: 0.21, p: 1, dil: 'n2', x: 0 }],
  ['Moon Base', { o2: 0.3, p: 0.694, dil: 'n2', x: 0 }],
  ['CO₂ 30%', { o2: 0.21, p: 1, dil: 'co2', x: 0.3 }],
];
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const describe = (t) => `${pct(t.o2)} O₂${t.co2 ? `, ${pct(t.co2)} CO₂` : ''}${t.he ? `, ${pct(t.he)} He` : ''}, ${(t.p * PSIA).toFixed(1)} psia, ${t.d0.toFixed(1)} mm`;
const jitter = (n, k) => ((n * k) % 97) / 97 - 0.5;
const level = (x) => (x >= 0.6 ? 'var(--ember)' : x >= 0.35 ? 'var(--accent)' : 'var(--amber)');

// The three experiments that used this apparatus. FLEX is fitted to its own test table;
// FLEX-2 adds slow airflow past the droplet; CFI burns dodecane to study cool flames.
const VARIANTS = {
  flex: { id: 'flex', name: 'FLEX', psi: 'PSI-69', title: 'Droplet flames', subtitle: 'A drop of fuel burning on the Space Station · NASA FLEX', fuels: ['methanol', 'heptane'],
    about: 'FLEX burned single droplets of methanol and heptane while changing oxygen, pressure, carbon dioxide and helium, to learn how to put fires out in spacecraft.' },
  flex2: { id: 'flex2', name: 'FLEX-2', psi: 'PSI-68', title: 'Droplets in a breeze', subtitle: 'FLEX-2 · fuel droplets in slow airflow, International Space Station',
    fuels: ['heptane'], flow: true, start: { d0: 3, flow: 2 }, home: 'breeze',
    about: 'FLEX-2 extended FLEX to more realistic conditions: fuel mixtures, and droplets in a slow stream of air like cabin ventilation.',
    scenarios: [
      { id: 'still', icon: 'o2', name: 'Still air', level: 'med', set: { flow: 0 } },
      { id: 'breeze', icon: 'gauge', name: 'A slow breeze', level: 'high', set: {} },
      { id: 'fast', icon: 'flame', name: 'Faster airflow', level: 'high', set: { flow: 5 } },
      { id: 'big', icon: 'crew', name: 'Big droplet, kept alive', level: 'high', set: { d0: 4, flow: 3 } },
      { id: 'moon', icon: 'o2', name: 'Moon Base air', level: 'high', set: { o2: 0.3, p: 0.694 } },
    ] },
  cfi: { id: 'cfi', name: 'CFI', psi: 'PSI-39', title: 'Cool flames', subtitle: 'CFI · the invisible second stage of a burning droplet, International Space Station',
    fuels: ['dodecane'], start: { fuel: 'dodecane', d0: 4 }, home: 'cool',
    about: 'The Cool Flames Investigation burned large dodecane droplets to study the cool flame that carries on after the visible flame goes out, at pressures from half to five times cabin pressure.',
    scenarios: [
      { id: 'cool', icon: 'flame', name: 'Hot flame, then cool flame', level: 'high', set: {} },
      { id: 'small', icon: 'crew', name: 'Small droplet, no cool flame', level: 'med', set: { d0: 2 } },
      { id: 'high', icon: 'gauge', name: 'Three times the pressure', level: 'high', set: { p: 3 } },
      { id: 'low', icon: 'gauge', name: 'Half the pressure', level: 'med', set: { p: 0.5 } },
      { id: 'lean', icon: 'o2', name: 'Less oxygen', level: 'med', set: { o2: 0.17 } },
    ] },
};

export async function createDropletEngine(host, options = {}) {
  const X = VARIANTS[options.exp || new URLSearchParams(location.search).get('exp')] || VARIANTS.flex;
  const flex = await fetch(new URL('../../data/flex.json', import.meta.url)).then((r) => r.json());
  const tests = flex.tests.map((row) => Object.fromEntries(flex.cols.map((c, i) => [c, row[i]]))).filter((t) => t.d0 && t.p);

  const S = { fuel: 'heptane', d0: 3.6, o2: 0.21, p: 1, dil: 'n2', x: 0, g: 0, flow: 0, tether: 'fibre',
    test: null, t: SETUP.start, playing: false, speed: 1, axis: 'd0', hover: null, scenario: null, stopAt: null, rate: 1 };
  let plan; let base; let line; let near; let notes;
  const cond = () => ({ fuel: S.fuel, d0: S.d0, o2: S.o2, co2: S.dil === 'co2' ? S.x : 0, he: S.dil === 'he' ? S.x : 0, p: S.p, g: S.g, flow: S.flow });

  const AXES = {
    d0: { short: 'vs drop size', label: 'droplet, mm', get: (t) => t.d0, cur: () => S.d0, dom: [0.8, 5], ok: () => true, jit: 0 },
    co2: { short: 'vs CO₂ added', label: 'CO₂ added, %', get: (t) => t.co2 * 100, cur: () => (S.dil === 'co2' ? S.x * 100 : 0), dom: [-4, 74], ok: (t) => !t.he, jit: 2.4 },
    he: { short: 'vs helium added', label: 'helium added, %', get: (t) => t.he * 100, cur: () => (S.dil === 'he' ? S.x * 100 : 0), dom: [-3, 49], ok: (t) => !t.co2, jit: 1.6 },
    p: { short: 'vs pressure', label: 'pressure, atm', get: (t) => t.p, cur: () => S.p, dom: [0.5, 3.2], ok: () => true, jit: 0.07 },
  };

  // ---------- page ----------
  const shell = createShell(host, {
    id: X.id, title: X.title, subtitle: X.subtitle,
    navLabel: 'Scenarios to try', cardTitle: 'Live readings', cardSub: 'this burn',
    application: () => `application/index.html?exp=${X.id}&focus=${notes.focus}`,
  });
  const R = { t: shell.row('clock', 'Time'), d: shell.row('o2', 'Drop size'), f: shell.row('flame', 'Flame size'),
    k: shell.row('gauge', 'Burn rate', false, true), s: shell.row('pin', 'State', true) };

  const playBtn = el('button', { type: 'button', class: 'btn go', text: 'Ignite', onclick: () => (S.playing ? pause() : run()) });
  const say = el('span', { class: 'say', role: 'status' });
  const speed = segs({ label: 'Playback speed', value: 1, onChange: (x) => { S.speed = x; },
    options: [{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 5, label: '5×' }] });
  shell.transport.append(playBtn, el('button', { type: 'button', class: 'btn', text: 'Reset', onclick: () => restart(false) }), speed.el, say);

  const ui = {
    fuel: segRow({ label: 'Fuel', value: S.fuel, onChange: (x) => change({ fuel: x }),
      options: X.fuels.map((f) => ({ value: f, label: FUELS[f].label })) }),
    d0: sliderRow({ label: 'Drop size', min: 1, max: 5, step: 0.01, value: S.d0, format: (x) => `${x.toFixed(2)} mm`, onInput: (x) => change({ d0: x }) }),
    tether: segRow({ label: 'Support', value: S.tether, onChange: (x) => change({ tether: x, g: x === 'free' ? 0 : S.g }),
      options: [{ value: 'free', label: 'Floating' }, { value: 'fibre', label: 'On a fibre' }] }),
    o2: sliderRow({ label: 'Oxygen', min: 10, max: 40, step: 0.5, value: S.o2 * 100, format: (x) => `${+x.toFixed(1)}%`, onInput: (x) => change({ o2: x / 100 }) }),
    p: sliderRow({ label: 'Pressure', min: 7.3, max: 45.6, step: 0.1, value: S.p * PSIA, format: (x) => `${x.toFixed(1)} psia`, onInput: (x) => change({ p: x / PSIA }) }),
    dil: segRow({ label: 'Suppressant', value: S.dil, onChange: (x) => change({ dil: x, x: x === 'n2' ? 0 : S.x || 0.2 }),
      options: [{ value: 'n2', label: 'None' }, { value: 'co2', label: 'CO₂' }, { value: 'he', label: 'Helium' }] }),
    x: sliderRow({ label: 'Amount', min: 0, max: 70, step: 1, value: 0, format: (x) => `${x.toFixed(0)}%`, onInput: (x) => change({ x: x / 100 }) }),
    g: segRow({ label: 'Gravity', value: S.g, onChange: (x) => change({ g: x }),
      options: [{ value: 0, label: '0 g' }, { value: 0.165, label: 'Moon' }, { value: 0.38, label: 'Mars' }, { value: 1, label: 'Earth' }] }),
  };
  const brief = shell.tab({ id: 'result', glyph: 'report', label: 'Result', title: 'Result', cls: 'brief', order: 4 });
  const briefBody = el('div', { class: 'brief-body' });
  brief.root.append(briefBody);
  const condPanel = shell.tab({ id: 'controls', glyph: 'sliders', label: 'Controls', title: 'Change the experiment', small: 'then press Ignite', cls: 'atmo', order: 2 });
  ui.flow = sliderRow({ label: 'Airflow', min: 0, max: 5, step: 0.1, value: S.flow, format: (x) => `${x.toFixed(1)} cm/s`, onInput: (x) => change({ flow: x }) });
  ui.flow.el.hidden = !X.flow;
  ui.fuel.el.hidden = X.fuels.length < 2;
  condPanel.root.append(el('div', { class: 'rows' }, ui.fuel.el, ui.d0.el, ui.flow.el, ui.tether.el, ui.o2.el, ui.p.el, ui.dil.el, ui.x.el, ui.g.el));
  ui.tether.el.dataset.adv = '';
  if (X.id !== 'cfi') ui.p.el.dataset.adv = '';

  const chartHost = el('div', { class: 'plot scrub' });
  const chartPanel = shell.tab({ id: 'charts', glyph: 'chart', label: 'Charts', title: 'Shrinking drop', small: 'drag to scrub', area: 'bottom', order: 5 });
  chartPanel.root.append(chartHost);
  const presets = el('div', { class: 'presets' }, PRESETS.map(([name, patch]) =>
    el('button', { type: 'button', 'aria-pressed': 'false', text: name, onclick: () => change(patch) })));
  const ticksEl = el('div', { class: 'ticks' });
  const barsPanel = shell.tab({ id: 'charts', title: 'Behaviour', small: 'this burn', cls: 'bars', area: 'bottom', adv: true });
  barsPanel.root.append(presets, ticksEl);
  const mapHost = el('div', { class: 'plot pick' });
  const axisSel = el('select', { 'aria-label': 'Horizontal axis of the test map', onchange: () => { S.axis = axisSel.value; drawMap(); } },
    Object.entries(AXES).map(([k, a]) => el('option', { value: k, text: a.short })));
  const mapPanel = shell.tab({ id: 'charts', title: 'ISS tests', area: 'bottom', adv: true });
  mapPanel.small.replaceWith(axisSel);
  mapPanel.root.append(mapHost);
  if (X.id === 'cfi') mapPanel.root.remove(); // no dodecane tests in the FLEX table
  const askTab = shell.tab({ id: 'ask', glyph: 'chat', label: 'Ask', title: 'Ask the guide', small: 'ChatGPT or built-in', cls: 'ask', order: 6 });
  const guide = createAsk({
    placeholder: 'e.g. What does more oxygen do?',
    hint: 'Ask how the experiment is done, or what changing something does. I can sketch the answer.',
    samples: ['How is it done?', 'What does more oxygen do?', 'Does CO₂ put it out?', 'Why is the flame a ball?', 'What is a cool flame?'],
    system: () => systemPrompt(flex, cond(), plan, notes, prefs.level, X),
    local: (q) => localAnswer(q, { flex, c: cond(), notes }),
    sketch: (chart) => sketchSpec(flex, cond(), chart),
    act: (reply) => { if (reply.set) applySet(reply.set); if (reply.open === 'application') shell.openApplication(); },
  });
  askTab.root.append(...guide.el);

  // ---------- 3D ----------
  let stage = null;
  let scene3d = null;
  try {
    stage = createStage(shell.stageWrap, { label: '3D view of a fuel droplet burning in the FLEX apparatus',
      camera: HOME, frame: shell.frame, bounds: shell.free });
  } catch (err) {
    console.error(err);
    shell.stageWrap.append(el('p', { class: 'fl-fail', text: 'This browser could not start WebGL, so the 3D view is unavailable. The controls, charts and predictions still work.' }));
  }

  // ---------- charts ----------
  const chart = createPlot(chartHost, { xLabel: 'seconds after ignition', draw(ctx, P, col) {
    const path = (pts, stroke, dash = []) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(P.sx(p.t), P.sy(p.d2)) : ctx.moveTo(P.sx(p.t), P.sy(p.d2))));
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    };
    const d0 = plan.c.d0;
    const m = plan.model;
    if (plan.measured) path([{ t: 0, d2: d0 * d0 }, { t: m.tb, d2: (m.r * d0) ** 2 }], col('--sky'), [5, 4]);
    const hot = line.filter((p) => p.phase === 'hot');
    const cool = line.filter((p) => p.phase === 'cool');
    const end = line[line.length - 1];
    path([end, { t: P.x[1], d2: end.d2 }], col('--muted'));
    path(hot, col(plan.measured ? '--fg' : '--sky'));
    if (cool.length) path([hot[hot.length - 1], ...cool], col('--cool'));
    // legend
    let lx = P.w - P.pad.r;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '12.5px "Exo 2", Inter, system-ui, sans-serif';
    for (const [name, c] of [['cool flame', '--cool'], ['model', '--sky'], ['measured', '--fg']]) {
      if ((name === 'cool flame' && !cool.length) || (name === 'measured' && !plan.measured)) continue;
      ctx.fillStyle = col('--muted'); ctx.fillText(name, lx, P.pad.t + 6);
      lx -= ctx.measureText(name).width + 6;
      ctx.strokeStyle = col(c); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 12, P.pad.t + 6); ctx.lineTo(lx, P.pad.t + 6); ctx.stroke();
      lx -= 22;
    }
    // cursor
    const t = clamp(S.t, 0, P.x[1]);
    const s = stateAt(plan, t);
    const x = P.sx(t);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, P.pad.t); ctx.lineTo(x, P.h - P.pad.b); ctx.stroke();
    ctx.fillStyle = col(s.phase === 'cool' ? '--cool' : s.phase === 'hot' ? '--accent' : '--muted');
    ctx.beginPath(); ctx.arc(x, P.sy(s.d2), 4.5, 0, 6.2832); ctx.fill();
  } });
  let scrubbing = false;
  const scrub = (e) => { S.t = clamp(chart.P.ix(chart.P.at(e).x), 0, plan.tEnd); S.playing = false; scene3d?.snap(); };
  chart.canvas.addEventListener('pointerdown', (e) => { scrubbing = true; chart.canvas.setPointerCapture(e.pointerId); scrub(e); });
  chart.canvas.addEventListener('pointermove', (e) => { if (scrubbing) scrub(e); });
  for (const type of ['pointerup', 'pointercancel']) chart.canvas.addEventListener(type, () => { scrubbing = false; });

  let dots = [];
  const map = createPlot(mapHost, { yTicks: 4, draw(ctx, P, col) {
    const ax = AXES[S.axis];
    const x1 = P.w - P.pad.r;
    ctx.fillStyle = 'rgba(255,106,20,0.1)';
    ctx.fillRect(P.pad.l, P.sy(40), x1 - P.pad.l, P.sy(30) - P.sy(40));
    ctx.font = '12.5px "Exo 2", Inter, system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = col('--accent');
    ctx.fillText('Moon Base: 30% or more', x1 - 4, P.sy(40) + 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#c9cfd6';
    ctx.fillText('oxygen %', P.pad.l + 4, P.sy(40) + 3);
    ctx.textAlign = 'right';
    ctx.strokeStyle = col('--muted');
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(P.pad.l, P.sy(21)); ctx.lineTo(x1, P.sy(21)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#c9cfd6';
    ctx.fillText('ISS cabin air', P.pad.l + 4, P.sy(21) - 2);

    dots = [];
    ctx.lineWidth = 1;
    for (const t of tests) {
      if (t.fuel !== S.fuel || !ax.ok(t)) continue;
      const x = P.sx(ax.get(t) + jitter(t.n, 31) * ax.jit);
      const y = P.sy(t.o2 * 100 + jitter(t.n, 57) * 0.7);
      const r = t.dx != null ? Math.min(t.dx / t.d0, 1) : t.end === 'C' ? 0 : null;
      dots.push({ x, y, t });
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.2832);
      ctx.fillStyle = `rgba(236,238,241,${r == null ? 0.1 : ((1 - r) * 0.92).toFixed(2)})`; ctx.fill();
      ctx.strokeStyle = `rgba(236,238,241,${r == null ? 0.3 : 0.7})`; ctx.stroke();
    }
    for (const [t, c] of [[S.test, col('--fg')], [S.hover, col('--accent')]]) {
      const d = t && dots.find((q) => q.t === t);
      if (!d) continue;
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(d.x, d.y, 7, 0, 6.2832); ctx.stroke();
    }
    const cx = P.sx(clamp(ax.cur(), P.x[0], P.x[1]));
    const cy = P.sy(S.o2 * 100);
    ctx.strokeStyle = col('--sky'); ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(cx + dx * 5, cy + dy * 5); ctx.lineTo(cx + dx * 12, cy + dy * 12); }
    ctx.stroke();
    // bottom line, left of the axis label: what the dots mean, or the test under the pointer
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = col(S.hover ? '--fg' : '--muted');
    ctx.fillText(S.hover ? `Test ${S.hover.n}: ${describe(S.hover)}` : 'filled = burned up', P.pad.l, P.h - 15);
  } });
  map.P.y = [10, 40];
  const pick = (e, reach) => {
    const { x, y } = map.P.at(e);
    let best = null;
    let bd = reach;
    for (const d of dots) { const q = Math.hypot(d.x - x, d.y - y); if (q < bd) { bd = q; best = d.t; } }
    return best;
  };
  const hover = (t) => { if (t === S.hover) return; S.hover = t; map.P.xLabel = t ? '' : AXES[S.axis].label; map.render(); };
  map.canvas.addEventListener('pointermove', (e) => hover(pick(e, 12)));
  map.canvas.addEventListener('pointerleave', () => hover(null));
  map.canvas.addEventListener('click', (e) => { const t = pick(e, 18); if (t) loadTest(t); });
  function drawMap() {
    const ax = AXES[S.axis];
    axisSel.value = S.axis;
    map.P.x = ax.dom;
    map.P.xLabel = ax.label;
    map.render();
  }

  // ---------- panels ----------
  function renderOutcome() {
    const t = S.test;
    const meas = plan.measured;
    const fit = flex.fuels[S.fuel] || null;
    brief.small.textContent = t ? `ISS test ${t.n} · ${fmtDate(t.date)}` : 'model prediction';
    const list = tests.filter((x) => x.fuel === S.fuel);
    const stepTo = (dir) => loadTest(list[((t ? list.indexOf(t) : -1) + dir + list.length) % list.length]);
    const pickBtn = (text, fn, title) => el('button', { type: 'button', text, title, onclick: fn });
    const happened = meas?.end === 'D' ? ['On the ISS this test ended early because the droplet broke up.', ...notes.happened] : notes.happened;
    const fold = (cls, glyph, heading, text, open) => el('details', { class: `sec ${cls}`.trim(), open },
      el('summary', {}, em(glyph), heading), el('p', { text }));
    briefBody.replaceChildren(
      el('h2', {}, em(GLYPH[plan.regime]), OUTCOME[plan.regime]),
      el('div', { class: 'samples', 'data-adv': '' }, t
        ? [el('span', { text: 'A real burn on the ISS.' }), pickBtn('Previous test', () => stepTo(-1)), pickBtn('Next test', () => stepTo(1))]
        : !near.length ? [] : [el('span', { text: 'Closest real tests:' }), ...near.map((n) => pickBtn(`Test ${n.test.n}`, () => loadTest(n.test), describe(n.test)))]),
      fold('', 'search', t ? 'What happened' : 'What the model predicts', happened.join(' '), true),
      fold('problem', 'alert', 'Why it matters', notes.danger, false),
      fold('action', 'check', 'What to do', notes.action, false),
      el('button', { type: 'button', class: 'btn go wide', onclick: shell.openApplication }, em('station'), 'See it on the station'),
      el('div', { class: 'evidence', 'data-adv': '' }, [X.name, X.psi, fit ? `${fit.usable} ${FUELS[S.fuel].label.toLowerCase()} tests` : 'PSI-117'].map((s) => el('span', { text: s }))),
      el('p', { class: 'note', 'data-adv': '', text: !fit ? 'Illustrative model anchored to the cool-flame results in PSI-117 (dodecane at 1 atm), not a CFD simulation.'
        : `${meas ? 'The animation follows the measured values. ' : near.length ? `${support(near[0].dist)}. ` : ''}Simplified model fitted to FLEX${X.flow ? ', with a standard correction for airflow' : ''}, not a CFD simulation. Typical error: burn rate ±${fit.fitK.mae.toFixed(2)} mm²/s, leftover size ±${Math.round(fit.fitR.mae * 100)}% of the starting diameter.` }));
  }

  function renderBars() {
    // measured on the ISS when a real test is loaded, with the model's value beside it
    const m = plan.model;
    const meas = plan.measured;
    barsPanel.small.textContent = meas ? 'measured' : 'model';
    const rows = [
      ['Burn rate, mm²/s', (x) => x.toFixed(2), meas?.k || null, m.k, 1.1],
      ['Flame lasts, s', (x) => x.toFixed(1), meas?.tb || null, m.tb, 40],
      ['Fuel left over', (x) => pct(x), meas && meas.r != null ? meas.r ** 3 : null, m.r ** 3, 1],
    ];
    ticksEl.replaceChildren(...rows.map(([name, fmt, measured, model, max]) => {
      const x = (measured ?? model) / max;
      return el('div', {},
        el('div', { class: 'tk-h' }, el('span', { text: name }),
          el('b', {}, fmt(measured ?? model), measured != null ? el('small', { text: `  model ${fmt(model)}` }) : null)),
        el('div', { class: 'tk', style: `color:${level(x)}` }, el('i', { style: `width:${clamp(x * 100, 1, 100).toFixed(0)}%` })));
    }));
    [...presets.children].forEach((b, i) => {
      const p = PRESETS[i][1];
      b.setAttribute('aria-pressed', String(Math.abs(p.o2 - S.o2) < 0.003 && Math.abs(p.p - S.p) < 0.01 && p.dil === S.dil && Math.abs(p.x - S.x) < 0.005));
    });
  }

  function statusText(st) {
    switch (st.phase) {
      case 'ready': return 'Droplet deployed between the needles';
      case 'setup': return S.t < SETUP.ignIn ? 'Needles retract and release the droplet' : S.t < SETUP.heat ? 'Igniters move in' : 'Igniter wires heat up';
      case 'hot': return plan.regime === 'noburn' ? 'Lit, but the flame cannot hold' : 'Hot flame burning';
      case 'cool': return 'Cool flame: invisible to the eye, drawn in violet';
      default: return OUTCOME[plan.regime];
    }
  }

  // ---------- state changes ----------
  function replan() {
    plan = makePlan(flex, cond(), S.test);
    base = makePlan(flex, { ...cond(), o2: 0.21, co2: 0, he: 0, p: 1, g: 0 });
    notes = interpret(plan, base);
    line = curve(plan);
    near = nearest(tests, cond(), 3);
    chart.P.x = [0, Math.max(plan.tEnd, plan.model.tb, 1) * 1.08];
    chart.P.y = [0, Math.ceil(S.d0 * S.d0 * 1.08)];
    shell.setChip(`${(S.p * PSIA).toFixed(1)} psia · ${+(S.o2 * 100).toFixed(1)}% O₂${S.dil === 'n2' ? '' : ` · ${Math.round(S.x * 100)}% ${S.dil === 'co2' ? 'CO₂' : 'He'}`}`);
    renderOutcome();
    renderBars();
    chart.render();
    drawMap();
  }
  function change(patch, keepTest = false) {
    const before = plan;
    Object.assign(S, patch);
    if (!keepTest) S.test = null;
    S.scenario = null;
    shell.navCurrent(null);
    if (patch.dil && patch.dil !== 'n2') S.axis = patch.dil;
    if (S.dil === 'n2') S.x = 0;
    S.x = Math.max(0, Math.min(S.x, 0.98 - S.o2));
    if (S.g > 0) S.tether = 'fibre';
    ui.fuel.set(S.fuel); ui.d0.set(S.d0); ui.flow.set(S.flow); ui.tether.set(S.tether); ui.o2.set(S.o2 * 100); ui.p.set(S.p * PSIA);
    ui.dil.set(S.dil); ui.x.set(S.x * 100); ui.x.disable(S.dil === 'n2'); ui.g.set(S.g);
    replan();
    if (before && !keepTest) { const said = explainChange(before, plan); if (said) shell.toast(said); }
  }
  function restart(play) {
    S.stopAt = null;
    S.t = SETUP.start;
    S.playing = play;
    scene3d?.newDrift();
    scene3d?.snap();
  }
  function run() { S.stopAt = null; if (S.t >= plan.tEnd) restart(true); else S.playing = true; }
  function pause() { S.playing = false; }
  function loadTest(t, play = true) {
    if (!t) return;
    if (t.co2) S.axis = 'co2'; else if (t.he) S.axis = 'he'; else if (!AXES[S.axis].ok(t)) S.axis = 'd0';
    change({ fuel: t.fuel, d0: t.d0, o2: t.o2, p: t.p, dil: t.co2 ? 'co2' : t.he ? 'he' : 'n2', x: t.co2 || t.he || 0, g: 0, test: t }, true);
    restart(play);
  }

  /** Play one stretch of the burn and stop, for the intro steps. */
  function playRange(from, to, rate = 1) { S.t = from; S.stopAt = to; S.rate = rate; S.playing = true; scene3d?.snap(); }

  /** Apply settings the guide asked for ({ fuel, d0, o2 %, p psia, suppressant, amount %, gravity }). */
  function applySet(set) {
    const num = (v) => (v == null || v === '' ? NaN : +v);
    const patch = {};
    if (X.fuels.includes(set.fuel)) patch.fuel = set.fuel;
    if (Number.isFinite(num(set.d0))) patch.d0 = clamp(num(set.d0), 1, 5);
    if (Number.isFinite(num(set.o2))) patch.o2 = clamp(num(set.o2), 10, 40) / 100;
    if (Number.isFinite(num(set.p))) patch.p = clamp(num(set.p), 7.3, 45.6) / PSIA;
    const gas = { none: 'n2', co2: 'co2', helium: 'he' }[set.suppressant];
    if (gas) patch.dil = gas;
    if (Number.isFinite(num(set.amount))) patch.x = clamp(num(set.amount), 0, 70) / 100;
    if (patch.x > 0 && !gas && S.dil === 'n2') patch.dil = 'co2';
    if (patch.dil && patch.dil !== 'n2' && patch.x == null && !S.x) patch.x = 0.2;
    if (Number.isFinite(num(set.gravity))) patch.g = clamp(num(set.gravity), 0, 1);
    if (X.flow && Number.isFinite(num(set.flow))) patch.flow = clamp(num(set.flow), 0, 5);
    if (!Object.keys(patch).length) return;
    change(patch);
    restart(true);
  }

  // ---------- the steps shown before the lab opens ----------
  let intro = null;
  function startIntro() {
    if (intro) return;
    shell.dock.closeAll();
    home();
    intro = playIntro(shell.root, introSteps(plan), {
      reduce: shell.reduce,
      onStep(step) {
        if (step.cam) stage?.flyTo(step.cam, shell.reduce ? 0 : 1.8);
        if (step.play) playRange(...step.play);
        else if (step.seek != null) { S.t = step.seek; S.playing = false; S.stopAt = null; scene3d?.snap(); }
      },
      onDone() {
        intro = null;
        try { sessionStorage.setItem(`freefall.intro.${X.id}`, '1'); } catch { /* storage blocked */ }
        stage?.flyTo(HOME, shell.reduce ? 0 : 1.4);
        restart(!shell.reduce);
        shell.dock.ping('try');
      },
    });
  }

  // ---------- scenarios (left nav): one click per insight, each a real ISS test ----------
  const air = (fuel, d0, o = {}) => ({ fuel, d0, o2: 0.21, co2: 0, he: 0, p: 1, ...o });
  const closest = (c, keep = () => true) => nearest(tests.filter(keep), c, 1)[0]?.test;
  const first = tests.find((t) => t.fuel === 'heptane' && Math.abs(t.o2 - 0.21) < 0.011 && !t.co2 && !t.he
    && Math.abs(t.p - 1) < 0.05 && t.d0 > 3.3 && t.tb && t.dx / t.d0 > 0.7) || tests[0];
  const FLEX_SCENARIOS = [
    { id: 'cool', icon: 'flame', name: 'Hidden cool flame', level: 'high', run: () => loadTest(first) },
    { id: 'small', icon: 'crew', name: 'Small droplet', level: 'med', run: () => loadTest(closest(air('heptane', 2.4), (t) => !t.co2 && !t.he && t.dx != null && t.dx / t.d0 < 0.3)) },
    { id: 'moon', icon: 'o2', name: 'Moon Base air', level: 'high', run: () => loadTest(closest(air('heptane', 3, { o2: 0.3, p: 0.7 }), (t) => !t.co2 && !t.he)) },
    { id: 'co2', icon: 'ext', name: 'CO₂ extinguisher', level: 'low', run: () => loadTest(closest(air('heptane', 3, { co2: 0.3 }), (t) => t.co2 > 0.15)) },
    { id: 'he', icon: 'gauge', name: 'Helium dilution', level: 'low', run: () => loadTest(closest(air('heptane', 3, { he: 0.3 }), (t) => t.he > 0.15)) },
    { id: 'methanol', icon: 'flask', name: 'Methanol flame', level: 'med', run: () => loadTest(closest(air('methanol', 3), (t) => !t.co2 && !t.he && t.dx != null)) },
    { id: 'earth', icon: 'orbit', name: 'Earth gravity', level: 'med', run: () => { change({ g: 1 }); restart(true); } },
  ];
  const begin = { fuel: 'heptane', d0: 3.6, o2: 0.21, p: 1, dil: 'n2', x: 0, g: 0, flow: 0, ...(X.start || {}) };
  const SCENARIOS = X.scenarios ? X.scenarios.map((sc) => ({ ...sc, run: () => { change({ ...begin, ...sc.set }); restart(true); } })) : FLEX_SCENARIOS;
  /** Back to where this experiment starts. */
  function home() {
    if (X.id === 'flex') loadTest(first, false); else { change(begin); restart(false); }
    S.scenario = X.home || 'cool';
    shell.navCurrent(S.scenario);
  }
  const runScenario = (sc) => { sc.run(); S.scenario = sc.id; shell.navCurrent(sc.id); };
  shell.setNav(SCENARIOS.map((sc) => ({ ...sc, onClick: () => runScenario(sc) })));
  shell.tab({ id: 'try', glyph: 'flame', label: 'Try', area: 'nav', order: 1 });

  // ---------- frame loop ----------
  let lastT = NaN;
  let lastPhase = null;
  function tick(dt) {
    if (S.playing) {
      S.t += dt * (S.stopAt != null ? S.rate : S.t < 0 ? 1 : S.speed);
      if (S.stopAt != null && S.t >= S.stopAt) { S.t = S.stopAt; S.playing = false; S.stopAt = null; }
      if (S.t > plan.tEnd + 6) S.playing = false;
    }
    const st = stateAt(plan, S.t);
    if (st.phase !== lastPhase) {
      if (st.phase === 'out' && lastPhase && !intro) shell.dock.ping('result');
      lastPhase = st.phase;
    }
    scene3d?.draw(st, dt);
    R.t(`${clamp(S.t, 0, plan.tEnd).toFixed(1)} / ${plan.tEnd.toFixed(1)} s`);
    R.d(st.d > 0.04 ? `${st.d.toFixed(2)} mm` : '0 mm');
    R.f(st.hot > 0.04 ? `${(2 * st.rf).toFixed(1)} mm` : st.cool > 0.05 ? `${(2 * st.coolR).toFixed(1)} mm` : '–');
    R.k(st.phase === 'hot' ? `${plan.k.toFixed(2)} mm²/s` : st.phase === 'cool' ? `${plan.kc.toFixed(2)} mm²/s` : '–');
    R.s(...PHASE[st.phase]);
    const msg = statusText(st);
    if (say.textContent !== msg) { say.textContent = msg; say.dataset.phase = st.phase; }
    const lbl = S.playing ? 'Pause' : S.t <= SETUP.start + 0.01 ? 'Ignite' : S.t >= plan.tEnd ? 'Ignite again' : 'Resume';
    if (playBtn.textContent !== lbl) playBtn.textContent = lbl;
    if (S.t !== lastT) { lastT = S.t; chart.render(); }
  }

  home();
  let raf = 0;
  if (stage) {
    scene3d = createScene(stage, S, () => plan);
    scene3d.newDrift();
    stage.onFrame(tick);
    shell.onLayout(() => stage.resize());
    document.fonts?.ready.then(() => shell.layout());
  } else {
    let prev = performance.now();
    const loop = (now) => { tick(Math.min((now - prev) / 1000, 0.05)); prev = now; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
  shell.dock.action('steps', 'Steps', startIntro, 0);
  shell.settings([
    { key: 'flex.labels', label: 'Part labels in 3D', apply: (on) => stage?.showLabels(on) },
    { key: 'flex.dark', label: 'Chamber lights off while it burns', apply: (on) => scene3d?.option('dark', on) },
    { key: 'flex.noise', label: 'Camera sensor speckle', apply: (on) => scene3d?.option('noise', on) },
    { key: 'flex.spin', label: 'Slow camera drift', apply: (on) => { if (stage) stage.controls.autoRotate = on && !shell.reduce; } },
  ], [['All experiments', 'index.html'], ['How this was built', 'architecture.html']]);
  let seen = false;
  try { seen = !!sessionStorage.getItem(`freefall.intro.${X.id}`); } catch { /* storage blocked */ }
  if (prefs.intro && !seen && options.intro !== false) startIntro();
  else if (options.autoplay !== false && !shell.reduce) setTimeout(run, 900);

  return {
    set: (patch) => change(patch),
    run, pause,
    reset: () => restart(false),
    seek: (t) => { S.t = t; S.playing = false; scene3d?.snap(); },
    loadTest: (n) => loadTest(tests.find((x) => x.n === n)),
    get state() { return { ...S, plan, notes, frameMs: stage?.frameMs() }; },
    benchmark: (n) => stage?.benchmark(n),
    intro: startIntro,
    ask: (q) => guide.ask(q),
    dock: shell.dock,
    dispose() { cancelAnimationFrame(raf); stage?.dispose(); chart.destroy(); map.destroy(); shell.root.remove(); },
  };
}
