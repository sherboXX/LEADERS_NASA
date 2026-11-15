// A whole experiment page from a spec. Used by every engine except the droplet engine
// (which predates it). createLab(host, spec) builds the shell, dock tabs, controls,
// readings, result, chart, guide, intro steps and 3D scene, and runs the clock.
//
// spec = {
//   id, data?,                       engine name; optional JSON (URL relative to this file)
//   experiments: [{ id, name, psi, title, subtitle, about, defaults, scenarios, camera? }],
//   defaults,                        every model input, in the units the controls show
//   controls: [{ key, label, kind: 'slider'|'seg'|'pick', min, max, step, fmt, options, adv, only }],
//   model: { plan(c, data) -> { tEnd, regime, lapse?, ... }, at(plan, t) -> state },
//   readings: [{ icon, label, text(state, plan), adv }], phase(state, plan) -> [text, cls],
//   status(state, plan), outcome(plan, base) -> { title, glyph, happened[], danger, action, focus },
//   metric: { label, unit, digits, get(plan) },      headline number, used in toasts
//   chart (an experiment may bring its own): { title, y(state, plan), unit } or { title, sweep: { x, lines: [{ label, color, get(plan) }] } },
//   bars?(plan) -> [[name, text, fraction]], tests?(data, exp) -> [{ label, sub, set }],
//   guide: { samples, procedure, background, X, Y, explain }, intro(plan, exp) -> steps,
//   scene(stage, S, getPlan, exp) -> { draw(state, dt), snap?() }, camera, go?, note
// }
import { createShell } from './shell.js';
import { createStage } from './stage.js';
import { el, sliderRow, segRow, pickRow, segs, createPlot } from './ui.js';
import { prefs } from './prefs.js';
import { em } from './dock.js';
import { createAsk } from './ask.js';
import { playIntro } from './intro.js';
import { labPrompt, labAnswer, labSketch } from './guide.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const tone = (x) => (x >= 0.6 ? 'var(--ember)' : x >= 0.35 ? 'var(--accent)' : 'var(--amber)');

export async function createLab(host, spec, options = {}) {
  const want = options.exp || new URLSearchParams(location.search).get('exp');
  const exp = spec.experiments.find((e) => e.id === want) || spec.experiments[0];
  const data = spec.data ? await fetch(new URL(spec.data, import.meta.url)).then((r) => r.json()).catch(() => ({})) : {};
  const controls = spec.controls.filter((k) => !k.only || k.only.includes(exp.id));
  const start = { ...spec.defaults, ...exp.defaults };
  const T0 = spec.t0 ?? -1.5;
  const GO = spec.go || 'Ignite';
  const HOME = exp.camera || spec.camera;
  const CH = exp.chart || spec.chart;

  const S = { ...start, exp: exp.id, t: T0, playing: false, speed: 1, stopAt: null, rate: 1, scenario: null, test: null };
  const cond = () => ({ exp: exp.id, ...Object.fromEntries(Object.keys(spec.defaults).map((k) => [k, S[k]])) });
  const planOf = (c) => spec.model.plan(c, data);
  let plan; let base; let notes; let line;

  // ---------- page ----------
  const shell = createShell(host, { id: exp.id, title: exp.title, subtitle: exp.subtitle, navLabel: 'Scenarios to try',
    cardTitle: 'Live readings', cardSub: 'this run', application: () => `application/index.html?exp=${exp.id}&focus=${notes.focus}` });
  const readings = spec.readings.map((r) => [r, shell.row(r.icon, r.label, false, r.adv)]);
  const stateRow = shell.row('pin', 'State', true);

  const playBtn = el('button', { type: 'button', class: 'btn go', text: GO, onclick: () => (S.playing ? pause() : run()) });
  const say = el('span', { class: 'say', role: 'status' });
  const speed = segs({ label: 'Playback speed', value: 1, onChange: (x) => { S.speed = x; },
    options: [{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 5, label: '5×' }] });
  shell.transport.append(playBtn, el('button', { type: 'button', class: 'btn', text: 'Reset', onclick: () => restart(false) }), speed.el, say);

  const brief = shell.tab({ id: 'result', glyph: 'report', label: 'Result', title: 'Result', small: 'model prediction', cls: 'brief', order: 4 });
  const briefBody = el('div', { class: 'brief-body' });
  brief.root.append(briefBody);

  const condPanel = shell.tab({ id: 'controls', glyph: 'sliders', label: 'Controls', title: 'Change the experiment', small: `then press ${GO}`, cls: 'atmo', order: 2 });
  const ui = {};
  const rows = el('div', { class: 'rows' });
  if (spec.experiments.length > 1) {
    const pick = el('select', { 'aria-label': 'Experiment', onchange: () => { location.search = `?engine=${spec.id}&exp=${pick.value}`; } },
      spec.experiments.map((e) => el('option', { value: e.id, text: e.name, selected: e.id === exp.id })));
    rows.append(el('div', { class: 'r seg' }, el('span', { class: 'k', text: 'Experiment' }), pick));
  }
  for (const k of controls) {
    ui[k.key] = k.options
      ? (k.kind === 'pick' ? pickRow : segRow)({ label: k.label, value: S[k.key], options: k.options, onChange: (v) => change({ [k.key]: v }) })
      : sliderRow({ label: k.label, min: k.min, max: k.max, step: k.step, value: S[k.key], format: k.fmt, onInput: (v) => change({ [k.key]: v }) });
    if (k.adv) ui[k.key].el.dataset.adv = '';
    rows.append(ui[k.key].el);
  }
  condPanel.root.append(rows);

  const sweep = CH.sweep;
  const sweepCtl = sweep && controls.find((k) => k.key === sweep.x);
  const chartHost = el('div', { class: 'plot scrub' });
  const chartPanel = shell.tab({ id: 'charts', glyph: 'chart', label: 'Charts', title: CH.title, area: 'bottom', order: 5 });
  chartPanel.root.append(chartHost);
  const ticksEl = el('div', { class: 'ticks' });
  if (spec.bars) shell.tab({ id: 'charts', title: 'Behaviour', small: 'this run', cls: 'bars', area: 'bottom', adv: true }).root.append(ticksEl);
  const tests = spec.tests ? spec.tests(data, exp) : [];
  const testList = el('div', { class: 'tests' });
  if (tests.length) {
    shell.tab({ id: 'charts', title: 'Real tests', small: exp.psi, area: 'bottom', adv: true }).root.append(testList);
    testList.append(...tests.map((t) => el('button', { type: 'button', 'aria-current': 'false',
      onclick: (e) => { change({ ...start, ...t.set }, t); restart(true); for (const b of testList.children) b.setAttribute('aria-current', String(b === e.currentTarget)); } },
    el('span', { text: t.label }), el('small', { text: t.sub }))));
  }

  const askTab = shell.tab({ id: 'ask', glyph: 'chat', label: 'Ask', title: 'Ask the guide', small: 'ChatGPT or built-in', cls: 'ask', order: 6 });
  const guide = createAsk({
    placeholder: `e.g. ${spec.guide.samples[1] || spec.guide.samples[0]}`,
    hint: 'Ask how the experiment is done, or what changing something does. I can sketch the answer.',
    samples: spec.guide.samples,
    system: () => labPrompt(spec, exp, controls, cond(), plan, notes, prefs.level, data),
    local: (q) => labAnswer(q, { spec, exp, c: cond(), notes, data }),
    sketch: (chart) => labSketch(spec, cond(), chart, data),
    act: (reply) => { if (reply.set) applySet(reply.set); if (reply.open === 'application') shell.openApplication(); },
  });
  askTab.root.append(...guide.el);

  // ---------- 3D ----------
  let stage = null;
  let scene3d = null;
  try {
    stage = createStage(shell.stageWrap, { label: `3D view of ${exp.title}`, camera: HOME, frame: shell.frame, bounds: shell.free, ...(spec.stage || {}), ...(exp.stage || {}) });
  } catch (err) {
    console.error(err);
    shell.stageWrap.append(el('p', { class: 'fl-fail', text: 'This browser could not start WebGL, so the 3D view is unavailable. The controls, charts and predictions still work.' }));
  }

  // ---------- chart ----------
  const chart = createPlot(chartHost, { xLabel: sweep ? sweepCtl.label.toLowerCase() : 'seconds', draw(ctx, P, col) {
    const path = (pts, stroke) => {
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(P.sx(p.x), P.sy(p.y)) : ctx.moveTo(P.sx(p.x), P.sy(p.y))));
      ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    };
    line.forEach((l) => path(l.pts, col(l.color)));
    let lx = P.w - P.pad.r;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = '12.5px "Exo 2", Inter, system-ui, sans-serif';
    for (const l of [...line].reverse()) {
      ctx.fillStyle = col('--muted'); ctx.fillText(l.label, lx, P.pad.t + 6);
      lx -= ctx.measureText(l.label).width + 6;
      ctx.strokeStyle = col(l.color); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 12, P.pad.t + 6); ctx.lineTo(lx, P.pad.t + 6); ctx.stroke();
      lx -= 22;
    }
    const x = P.sx(sweep ? S[sweep.x] : clamp(S.t, 0, P.x[1]));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, P.pad.t); ctx.lineTo(x, P.h - P.pad.b); ctx.stroke();
    ctx.fillStyle = col('--accent');
    for (const l of line) { const y = sweep ? l.now : CH.y(spec.model.at(plan, clamp(S.t, 0, plan.tEnd)), plan); ctx.beginPath(); ctx.arc(x, P.sy(y), 4.5, 0, 6.2832); ctx.fill(); }
  } });
  let dragging = false;
  const drag = (e) => {
    const x = chart.P.ix(chart.P.at(e).x);
    if (sweep) { const k = sweepCtl; change({ [k.key]: clamp(Math.round(x / k.step) * k.step, k.min, k.max) }); } else { S.t = clamp(x, 0, plan.tEnd); S.playing = false; scene3d?.snap?.(); }
  };
  chart.canvas.addEventListener('pointerdown', (e) => { dragging = true; chart.canvas.setPointerCapture(e.pointerId); drag(e); });
  chart.canvas.addEventListener('pointermove', (e) => { if (dragging) drag(e); });
  for (const type of ['pointerup', 'pointercancel']) chart.canvas.addEventListener(type, () => { dragging = false; });

  function buildLine() {
    if (sweep) {
      const k = sweepCtl;
      const c = cond();
      // a line may override settings (`over`), e.g. "the same on Earth"
      line = sweep.lines.map((l) => ({ ...l, now: l.get(planOf({ ...c, ...(l.over || {}) })),
        pts: Array.from({ length: 41 }, (_, i) => { const x = k.min + ((k.max - k.min) * i) / 40; return { x, y: l.get(planOf({ ...c, ...(l.over || {}), [k.key]: x })) }; }) }));
      chart.P.x = [k.min, k.max];
    } else {
      line = [{ label: CH.unit || '', color: '--sky', pts: Array.from({ length: 121 }, (_, i) => { const t = (plan.tEnd * i) / 120; return { x: t, y: CH.y(spec.model.at(plan, t), plan) }; }) }];
      chart.P.x = [0, plan.tEnd * 1.04];
    }
    const top = Math.max(...line.flatMap((l) => l.pts.map((p) => p.y)), 1e-6) * 1.18;
    const mag = 10 ** Math.floor(Math.log10(top));
    chart.P.y = [0, Math.ceil(top / mag * 2) / 2 * mag];
  }

  // ---------- panels ----------
  function renderResult() {
    const fold = (cls, glyph, heading, text, open) => el('details', { class: `sec ${cls}`.trim(), open }, el('summary', {}, em(glyph), heading), el('p', { text }));
    brief.small.textContent = S.test ? 'a real test' : 'model prediction';
    briefBody.replaceChildren(
      el('h2', {}, em(notes.glyph), notes.title),
      fold('', 'search', 'What the model predicts', notes.happened.join(' '), true),
      fold('problem', 'alert', 'Why it matters', notes.danger, false),
      fold('action', 'check', 'What to do', notes.action, false),
      el('button', { type: 'button', class: 'btn go wide', onclick: shell.openApplication }, em('station'), 'See it on the station'),
      el('div', { class: 'evidence', 'data-adv': '' }, [exp.name, exp.psi].map((s) => el('span', { text: s }))),
      el('p', { class: 'note', 'data-adv': '', text: spec.note }));
    if (spec.bars) {
      ticksEl.replaceChildren(...spec.bars(plan).map(([name, text, x]) => el('div', {},
        el('div', { class: 'tk-h' }, el('span', { text: name }), el('b', { text })),
        el('div', { class: 'tk', style: `color:${tone(x)}` }, el('i', { style: `width:${clamp(x * 100, 1, 100).toFixed(0)}%` })))));
    }
  }

  // ---------- state changes ----------
  function replan() {
    plan = planOf(cond());
    base = planOf({ ...cond(), ...(spec.reference || {}) });
    notes = spec.outcome(plan, base);
    buildLine();
    shell.setChip(spec.chip ? spec.chip(cond()) : '');
    renderResult();
    chart.render();
  }
  function change(patch, test = null) {
    const before = plan;
    Object.assign(S, patch);
    S.test = test;
    S.scenario = null;
    shell.navCurrent(null);
    for (const k of controls) ui[k.key].set(S[k.key]);
    replan();
    if (before && !test && spec.metric) {
      const m = spec.metric;
      const a = m.get(before);
      const b = m.get(plan);
      const parts = [];
      if (Math.abs(b - a) >= 0.5 * 10 ** -m.digits) parts.push(`${m.label} ${a.toFixed(m.digits)} → ${b.toFixed(m.digits)}${m.unit}`);
      if (before.regime !== plan.regime) parts.push(`Now: ${notes.title.toLowerCase()}`);
      if (parts.length) shell.toast(parts.join(' · '));
    }
  }
  function restart(play) { S.stopAt = null; S.t = T0; S.playing = play; scene3d?.snap?.(); }
  function run() { S.stopAt = null; if (S.t >= plan.tEnd) restart(true); else S.playing = true; }
  function pause() { S.playing = false; }
  function playRange(from, to, rate = 1) { S.t = from; S.stopAt = to; S.rate = rate; S.playing = true; scene3d?.snap?.(); }
  function applySet(set) {
    const patch = {};
    for (const k of controls) {
      const v = set[k.key];
      if (v == null || v === '') continue;
      if (k.options) { const o = k.options.find((x) => String(x.value) === String(v)); if (o) patch[k.key] = o.value; } else if (Number.isFinite(+v)) patch[k.key] = clamp(+v, k.min, k.max);
    }
    if (!Object.keys(patch).length) return;
    change(patch);
    restart(true);
  }

  // ---------- scenarios and intro ----------
  const runScenario = (sc) => { change({ ...start, ...sc.set }); restart(true); S.scenario = sc.id; shell.navCurrent(sc.id); };
  shell.setNav(exp.scenarios.map((sc) => ({ ...sc, onClick: () => runScenario(sc) })));
  shell.tab({ id: 'try', glyph: 'flame', label: 'Try', area: 'nav', order: 1 });

  const seenKey = `freefall.intro.${exp.id}`;
  let intro = null;
  function startIntro() {
    if (intro) return;
    shell.dock.closeAll();
    change({ ...start });
    restart(false);
    intro = playIntro(shell.root, spec.intro(plan, exp), {
      reduce: shell.reduce,
      onStep(step) {
        if (step.cam) stage?.flyTo(step.cam, shell.reduce ? 0 : 1.8);
        if (step.play) playRange(...step.play);
        else if (step.seek != null) { S.t = step.seek; S.playing = false; S.stopAt = null; scene3d?.snap?.(); }
      },
      onDone() {
        intro = null;
        try { sessionStorage.setItem(seenKey, '1'); } catch { /* storage blocked */ }
        stage?.flyTo(HOME, shell.reduce ? 0 : 1.4);
        restart(!shell.reduce);
        shell.dock.ping('try');
      },
    });
  }

  // ---------- frame loop ----------
  let lastT = NaN;
  let lastPhase = null;
  function tick(dt) {
    if (S.playing) {
      S.t += dt * (S.stopAt != null ? S.rate : S.t < 0 ? 1 : S.speed * (plan.lapse || 1));
      if (S.stopAt != null && S.t >= S.stopAt) { S.t = S.stopAt; S.playing = false; S.stopAt = null; }
      if (S.t > plan.tEnd + 4 * (plan.lapse || 1)) S.playing = false;
    }
    const st = spec.model.at(plan, S.t);
    scene3d?.draw(st, dt);
    for (const [r, set] of readings) set(r.text(st, plan));
    stateRow(...spec.phase(st, plan));
    if (st.phase !== lastPhase) { if (st.phase === 'out' && lastPhase && !intro) shell.dock.ping('result'); lastPhase = st.phase; }
    const msg = spec.status(st, plan) + (plan.lapse > 1.5 && S.t > 0 && S.t < plan.tEnd ? ` · time-lapse ×${Math.round(plan.lapse)}` : '');
    if (say.textContent !== msg) { say.textContent = msg; say.dataset.phase = st.phase === 'out' ? 'out' : S.t < 0 ? 'setup' : 'hot'; }
    const lbl = S.playing ? 'Pause' : S.t <= T0 + 0.01 ? GO : S.t >= plan.tEnd ? `${GO} again` : 'Resume';
    if (playBtn.textContent !== lbl) playBtn.textContent = lbl;
    if (S.t !== lastT) { lastT = S.t; if (!sweep) chart.render(); }
  }

  change({});
  if (exp.scenarios[0]) { S.scenario = null; }
  let raf = 0;
  if (stage) {
    scene3d = spec.scene(stage, S, () => plan, exp);
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
    { key: `${exp.id}.labels`, label: 'Part labels in 3D', apply: (on) => stage?.showLabels(on) },
    { key: `${exp.id}.spin`, label: 'Slow camera drift', apply: (on) => { if (stage) stage.controls.autoRotate = on && !shell.reduce; } },
  ], [['All experiments', 'index.html'], ['How this was built', 'architecture.html']]);
  let seen = false;
  try { seen = !!sessionStorage.getItem(seenKey); } catch { /* storage blocked */ }
  if (prefs.intro && !seen && options.intro !== false) startIntro();
  else if (options.autoplay !== false && !shell.reduce) setTimeout(run, 900);

  return {
    set: (patch) => change(patch), run, pause, reset: () => restart(false),
    seek: (t) => { S.t = t; S.playing = false; scene3d?.snap?.(); },
    intro: startIntro, ask: (q) => guide.ask(q), dock: shell.dock,
    benchmark: (n) => stage?.benchmark(n),
    get state() { return { ...S, plan, notes, live: spec.model.at(plan, S.t) }; },
    dispose() { cancelAnimationFrame(raf); stage?.dispose(); chart.destroy(); shell.root.remove(); },
  };
}
