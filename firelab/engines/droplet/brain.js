// What the guide knows about the droplet experiment: the procedure, the intro steps, the
// system prompt for ChatGPT, a local answerer for when no AI is available, and the sweeps
// behind every sketch. Every number comes from the FLEX-fitted model in model.js.
import { makePlan, stateAt, OUTCOME, SETUP } from './model.js';

const PSIA = 14.696;

export const PROCEDURE = [
  'Two needles place a drop of fuel, 1 to 5 mm across, in the middle of a sealed chamber on the ISS.',
  'The chamber is filled with the test air: oxygen and nitrogen, sometimes with carbon dioxide or helium added.',
  'The needles pull back fast and leave the drop floating, or held on a thin fibre.',
  'Two hot-wire igniters move in, light the fuel vapour and pull away.',
  'Cameras record the shrinking drop and its flame until the flame goes out.',
  'From the pictures come the burn rate, how long the flame lasted and how much fuel was left.',
];

/** The steps played before the lab opens. `play` = [from, to, speed] in burn seconds. */
export function introSteps(plan) {
  const tb = plan.tb;
  const mid = Math.min(4, tb * 0.5);
  return [
    { glyph: 'station', title: 'A lab in orbit', dur: 6, cam: [9, 5, 24], seek: SETUP.start,
      text: 'This experiment ran on the International Space Station, inside a sealed chamber. Up here nothing falls, and hot air does not rise.' },
    { glyph: 'drop', title: 'Place a drop of fuel', dur: 5, cam: [2.2, 1.1, 7], seek: SETUP.start,
      text: 'Two needles hold a drop of fuel smaller than a pea, right in the middle of the chamber.' },
    { glyph: 'release', title: 'Let it float', dur: 5, play: [SETUP.start, SETUP.ignIn, 0.6],
      text: 'The needles snap back. The drop stays where it is, floating.' },
    { glyph: 'bolt', title: 'Light it', dur: 5, play: [SETUP.ignIn, 0.7, 0.7],
      text: 'Two hot wires move in, glow, and set the fuel vapour alight.' },
    { glyph: 'sphere', title: 'A ball of fire', dur: 6, cam: [3.4, 1.85, 11.3], play: [0.7, mid, 1],
      text: 'With no up or down, the flame is a sphere. Oxygen can only drift in slowly, so it burns gently.' },
    { glyph: 'gauge', title: 'Measure it', dur: 5, play: [mid, tb - 0.4, 2],
      text: 'Cameras watch the drop shrink. How fast it shrinks tells us how fast the fuel burns.' },
    { glyph: 'cool', title: 'The surprise', dur: 7, play: [tb - 0.4, tb + 9, 2],
      text: plan.cool ? 'The flame goes out, yet the drop keeps shrinking. An invisible cool flame is still burning. FLEX discovered it.'
        : 'In the end the flame goes out by itself, often with fuel still left.' },
    { glyph: 'rocket', title: 'Your turn',
      text: 'Change the air, add an extinguisher gas, switch gravity on. Then see where it matters on the station.' },
  ];
}

// What can go on the axes of a sketch. `c` = { fuel, d0, o2, co2, he, p, g } (model units).
const X = {
  o2: { label: 'oxygen in the air, %', word: 'oxygen', unit: '%', range: [12, 36], cur: (c) => c.o2 * 100, set: (c, v) => ({ ...c, o2: v / 100 }),
    refs: [{ x: 21, label: 'ISS' }, { x: 30, label: 'Moon Base' }] },
  co2: { label: 'carbon dioxide added, %', word: 'carbon dioxide', unit: '%', range: [0, 60], cur: (c) => c.co2 * 100, set: (c, v) => ({ ...c, co2: v / 100, he: 0 }) },
  he: { label: 'helium added, %', word: 'helium', unit: '%', range: [0, 45], cur: (c) => c.he * 100, set: (c, v) => ({ ...c, he: v / 100, co2: 0 }) },
  p: { label: 'pressure, psia', word: 'pressure', unit: ' psia', range: [10, 45], cur: (c) => c.p * PSIA, set: (c, v) => ({ ...c, p: v / PSIA }),
    refs: [{ x: 14.7, label: 'ISS' }] },
  d0: { label: 'starting drop size, mm', word: 'drop size', unit: ' mm', range: [1.2, 4.8], cur: (c) => c.d0, set: (c, v) => ({ ...c, d0: v }) },
  flow: { label: 'airflow past the drop, cm/s', word: 'airflow', unit: ' cm/s', range: [0, 5], cur: (c) => c.flow || 0, set: (c, v) => ({ ...c, flow: v }) },
  g: { label: 'gravity, g', word: 'gravity', unit: ' g', range: [0, 1], cur: (c) => c.g, set: (c, v) => ({ ...c, g: v }),
    refs: [{ x: 0.165, label: 'Moon' }, { x: 0.38, label: 'Mars' }] },
};
const Y = {
  k: { label: 'burn rate, mm²/s', word: 'burn rate', unit: ' mm²/s', digits: 2, get: (p) => p.model.k },
  tb: { label: 'how long the flame lasts, s', word: 'flame time', unit: ' s', digits: 1, get: (p) => p.model.tb },
  left: { label: 'fuel left when the flame dies, %', word: 'leftover fuel', unit: '%', digits: 0, get: (p) => p.model.r ** 3 * 100 },
  flame: { label: 'flame size, mm', word: 'flame size', unit: ' mm', digits: 0, get: (p) => 2 * stateAt(p, 0.35 * p.tb).rf },
};
const at = (flex, c, x, v) => makePlan(flex, X[x].set(c, v));

/** Sweep one setting through its range with the others held: the data behind a sketch. */
export function sketchSpec(flex, c, chart) {
  const xd = X[chart?.x];
  if (!xd) return null;
  const y = Y[chart.y] ? chart.y : 'k';
  const yd = Y[y];
  const [a, b] = xd.range;
  const points = Array.from({ length: 37 }, (_, i) => { const x = a + ((b - a) * i) / 36; return { x, y: yd.get(at(flex, c, chart.x, x)) }; });
  const cx = Math.min(b, Math.max(a, xd.cur(c)));
  const cy = yd.get(at(flex, c, chart.x, cx));
  return { x: chart.x, y, points, xLabel: xd.label, yLabel: yd.label, refs: xd.refs || [],
    mark: { x: cx, y: cy, text: `now ${cy.toFixed(yd.digits)}${yd.unit}` }, title: `${yd.word} against ${xd.word}` };
}

function sensitivities(flex, c) {
  return Object.entries(X).map(([key, xd]) => {
    const [a, b] = xd.range;
    const lo = at(flex, c, key, a).model;
    const hi = at(flex, c, key, b).model;
    return `${key} = ${xd.label}, ${a} to ${b}: burn rate ${lo.k.toFixed(2)} to ${hi.k.toFixed(2)} mm2/s; flame time ${lo.tb.toFixed(1)} to ${hi.tb.toFixed(1)} s; fuel left ${(lo.r ** 3 * 100).toFixed(0)} to ${(hi.r ** 3 * 100).toFixed(0)}%; outcome "${OUTCOME[lo.regime]}" to "${OUTCOME[hi.regime]}"`;
  }).join('\n');
}

/** Everything ChatGPT is allowed to know, rebuilt for the current settings on each question. */
export function systemPrompt(flex, c, plan, notes, level, X = {}) {
  const m = plan.model;
  const meas = plan.measured;
  const fitted = flex.fuels[c.fuel] ? `a model fitted to ${flex.fuels[c.fuel].usable} real ISS tests` : 'an illustrative model anchored to published CFI results';
  return [
    'You are the guide inside Freefall, an interactive simulator of NASA\'s FLEX droplet-combustion experiment on the International Space Station. Users are students as well as engineers.',
    `Reader level: ${level}. ${level === 'beginner' ? 'Use everyday words and short sentences, at most 60 words.' : 'Be precise and technical, at most 110 words.'} Plain text only, no markdown.`,
    `Procedure: ${PROCEDURE.map((s, i) => `${i + 1}) ${s}`).join(' ')}`,
    `${X.about ? `This page is ${X.name}: ${X.about} ` : ''}Current settings: fuel ${c.fuel}; drop ${c.d0.toFixed(2)} mm; oxygen ${(c.o2 * 100).toFixed(1)}%; carbon dioxide ${(c.co2 * 100).toFixed(0)}%; helium ${(c.he * 100).toFixed(0)}%; pressure ${(c.p * PSIA).toFixed(1)} psia; gravity ${c.g} g; airflow past the drop ${(c.flow || 0).toFixed(1)} cm/s.`,
    `Result at these settings, from ${fitted}: ${OUTCOME[plan.regime]}; burn rate ${m.k.toFixed(2)} mm2/s; visible flame lasts ${m.tb.toFixed(1)} s; ${(m.r ** 3 * 100).toFixed(0)}% of the fuel is left.${meas ? ` This is a real FLEX test: measured burn rate ${meas.k ?? 'not recorded'} mm2/s, flame time ${meas.tb ?? 'not recorded'} s.` : ''}`,
    `Why it matters for fire safety: ${notes.danger} ${notes.action}`,
    `How each setting changes the result, computed by the app with the other settings held:\n${sensitivities(flex, c)}`,
    'Background: in microgravity hot gas does not rise, so the flame is a sphere fed by slow diffusion. Large heptane droplets lose their visible flame through radiative heat loss and carry on as an invisible cool flame, which FLEX discovered. Carbon dioxide and helium suppress the flame. Methanol flames are dim blue with no soot. Values above 0 g are an illustration, because NASA has no partial-gravity combustion data yet.',
    'Reply with one JSON object: {"answer": string, "steps": array of strings or null (only when asked how the experiment is done), "chart": {"x": "o2"|"co2"|"he"|"p"|"d0"|"g"|"flow", "y": "k"|"tb"|"left"|"flame"} or null, "set": object or null, "open": "application" or null}.',
    '"set" may hold any of: "fuel" ("methanol" or "heptane"), "d0" (mm), "o2" (percent), "p" (psia), "suppressant" ("none", "co2" or "helium"), "amount" (percent), "gravity" (g), "flow" (cm/s of air past the drop, FLEX-2 only). Use it only when the user asks to change or try something.',
    'Give a "chart" whenever the question is about how a result depends on a setting. The app draws it from its own model, so never list data points. Use "open" when the user asks where this matters on the station. Use only numbers given above.',
  ].join('\n');
}

const has = (q, ...words) => words.some((w) => q.includes(w));
const EXPLAIN = {
  cool: 'A cool flame burns at only a few hundred degrees, so it gives off almost no light. In FLEX, big heptane drops lost their bright flame and kept burning this way. That is why a fire in space that looks out may not be out.',
  ball: 'On Earth hot gas rises, pulls fresh air in from below and stretches the flame into a teardrop. In orbit nothing rises, so the flame sits around the drop as a ball and gets oxygen only by slow diffusion. Switch gravity to Earth to compare.',
};

/** Answers without any AI: keyword rules over the same model and sweeps. */
export function localAnswer(question, { flex, c, notes }) {
  const q = ` ${question.toLowerCase()} `;
  if (has(q, 'cool flame', 'invisible', 'violet', 'purple')) return { answer: EXPLAIN.cool };
  if (has(q, 'ball', 'sphere', 'round', 'shape', 'teardrop')) return { answer: EXPLAIN.ball };
  const x = has(q, 'co2', 'co₂', 'carbon', 'extinguish', 'put it out', 'put out') ? 'co2' : has(q, 'helium') ? 'he'
    : has(q, 'oxygen', ' o2', 'o₂', 'moon base') ? 'o2' : has(q, 'pressure', 'psi') ? 'p'
      : has(q, 'size', 'diameter', 'bigger', 'smaller', 'larger', 'big drop', 'small drop') ? 'd0'
        : has(q, 'gravity', 'earth', 'moon', 'mars') ? 'g' : has(q, 'airflow', 'air flow', 'breeze', 'wind') ? 'flow' : null;
  if (x) {
    const y = has(q, 'how long', 'last', 'duration') ? 'tb' : has(q, 'left', 'remain', 'unburn', 'put it out', 'put out', 'extinguish') ? 'left'
      : has(q, 'flame size', 'how big', 'bigger flame') ? 'flame' : 'k';
    const spec = sketchSpec(flex, c, { x, y });
    const first = spec.points[0];
    const last = spec.points[spec.points.length - 1];
    const yd = Y[y];
    const f = (v) => `${v.toFixed(yd.digits)}${yd.unit}`;
    const dir = last.y > first.y * 1.03 ? 'rises' : last.y < first.y * 0.97 ? 'falls' : 'hardly changes';
    return { chart: { x, y }, answer: `With everything else held, the ${yd.word} ${dir} from ${f(first.y)} to ${f(last.y)} as ${X[x].word} goes from ${first.x} to ${last.x}${X[x].unit}. At your setting it is ${f(spec.mark.y)}.` };
  }
  if (has(q, 'procedure', 'step', 'how is', 'how was', 'how do', 'how does the experiment', 'done', 'work')) {
    return { answer: 'This is how each FLEX test was run:', steps: PROCEDURE };
  }
  if (has(q, 'where', 'station', 'apply', 'application', 'spacecraft', 'iss')) {
    return { answer: 'Press Application at the top. The station opens and the camera flies to the place where this result matters: the extinguishers, the oxygen system or the rack where FLEX ran.' };
  }
  if (has(q, 'danger', 'safe', 'risk', 'matter', 'important', 'why')) return { answer: `${notes.danger} ${notes.action}` };
  return { answer: `${notes.happened.join(' ')} Try asking what more oxygen does, whether carbon dioxide puts it out, or how the experiment is done.` };
}
