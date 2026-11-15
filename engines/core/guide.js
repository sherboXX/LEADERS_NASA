// The guide for any lab built with core/lab.js: sweeps for sketches, a local answerer,
// and the system prompt for ChatGPT. Everything is derived from the lab's spec, so a new
// engine only has to list what can be plotted (guide.X, guide.Y) and what it knows.
//
// guide.X[id] = { label, word, unit, range: [a, b], keys: [...], refs?, key? (state key, default id) }
// guide.Y[id] = { label, word, unit, digits, keys: [...], get: (plan) => number }
const has = (q, words = []) => words.some((w) => q.includes(w));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Sweep one setting through its range, others held: the data behind a sketch. */
export function labSketch(spec, c, chart, data) {
  const X = spec.guide.X[chart?.x];
  if (!X) return null;
  const y = spec.guide.Y[chart.y] ? chart.y : Object.keys(spec.guide.Y)[0];
  const Y = spec.guide.Y[y];
  const key = X.key || chart.x;
  const [a, b] = X.range;
  const at = (v) => Y.get(spec.model.plan({ ...c, [key]: v }, data));
  const points = Array.from({ length: 37 }, (_, i) => { const x = a + ((b - a) * i) / 36; return { x, y: at(x) }; });
  const cx = clamp(+c[key] || 0, a, b);
  const cy = at(cx);
  return { x: chart.x, y, points, xLabel: X.label, yLabel: Y.label, refs: X.refs || [],
    mark: { x: cx, y: cy, text: `now ${cy.toFixed(Y.digits)}${Y.unit}` }, title: `${Y.word} against ${X.word}` };
}

/** Answers without any AI: keyword rules over the same model and sweeps. */
export function labAnswer(question, { spec, exp, c, notes, data }) {
  const g = spec.guide;
  const q = ` ${question.toLowerCase()} `;
  for (const e of g.explain || []) if (has(q, e.keys)) return { answer: e.text };
  const x = Object.keys(g.X).find((id) => has(q, g.X[id].keys));
  if (x) {
    const y = Object.keys(g.Y).find((id) => has(q, g.Y[id].keys)) || Object.keys(g.Y)[0];
    const sk = labSketch(spec, c, { x, y }, data);
    const Y = g.Y[y];
    const f = (v) => `${v.toFixed(Y.digits)}${Y.unit}`;
    const first = sk.points[0];
    const last = sk.points[sk.points.length - 1];
    const dir = last.y > first.y * 1.03 + 1e-9 ? 'rises' : last.y < first.y * 0.97 - 1e-9 ? 'falls' : 'hardly changes';
    return { chart: { x, y }, answer: `With everything else held, the ${Y.word} ${dir} from ${f(first.y)} to ${f(last.y)} as ${g.X[x].word} goes from ${first.x} to ${last.x}${g.X[x].unit}. At your setting it is ${f(sk.mark.y)}.` };
  }
  if (has(q, ['procedure', 'step', 'how is', 'how was', 'how do', 'how does the experiment', 'done', 'work'])) {
    return { answer: `This is how ${exp.name} was run:`, steps: g.procedure };
  }
  if (has(q, ['where', 'station', 'apply', 'application', 'spacecraft', 'iss'])) {
    return { answer: 'Press Application at the top. The station opens and the camera flies to the places where this result matters.' };
  }
  if (has(q, ['danger', 'safe', 'risk', 'matter', 'important', 'why'])) return { answer: `${notes.danger} ${notes.action}` };
  return { answer: `${notes.happened.join(' ')} Try asking: "${g.samples[1] || g.samples[0]}"` };
}

/** Everything ChatGPT is allowed to know, rebuilt for the current settings on each question. */
export function labPrompt(spec, exp, controls, c, plan, notes, level, data) {
  const g = spec.guide;
  const shown = (k) => (k.options ? (k.options.find((o) => String(o.value) === String(c[k.key])) || {}).label : k.fmt(c[k.key]));
  const ys = Object.entries(g.Y);
  const sens = Object.entries(g.X).map(([id, X]) => {
    const key = X.key || id;
    const [a, b] = X.range;
    const lo = spec.model.plan({ ...c, [key]: a }, data);
    const hi = spec.model.plan({ ...c, [key]: b }, data);
    return `${id} = ${X.label}, ${a} to ${b}: ${ys.slice(0, 3).map(([, Y]) => `${Y.word} ${Y.get(lo).toFixed(Y.digits)} to ${Y.get(hi).toFixed(Y.digits)}${Y.unit}`).join('; ')}`;
  }).join('\n');
  const settable = controls.map((k) => `"${k.key}" (${k.label}: ${k.options ? k.options.map((o) => JSON.stringify(o.value)).join(' or ') : `${k.min} to ${k.max}`})`).join(', ');
  return [
    `You are the guide inside Freefall, an interactive simulator of NASA microgravity fire experiments. This page is ${exp.name}: ${exp.about} Users are students as well as engineers.`,
    `Reader level: ${level}. ${level === 'beginner' ? 'Use everyday words and short sentences, at most 60 words.' : 'Be precise and technical, at most 110 words.'} Plain text only, no markdown.`,
    `Procedure: ${g.procedure.map((s, i) => `${i + 1}) ${s}`).join(' ')}`,
    `Current settings: ${controls.map((k) => `${k.label} ${shown(k)}`).join('; ')}.`,
    `Result at these settings (simplified model, labelled as an illustration): ${notes.title}; ${ys.map(([, Y]) => `${Y.word} ${Y.get(plan).toFixed(Y.digits)}${Y.unit}`).join('; ')}.`,
    `Why it matters for fire safety: ${notes.danger} ${notes.action}`,
    `How each setting changes the result, computed by the app with the other settings held:\n${sens}`,
    `Background: ${g.background}`,
    `Reply with one JSON object: {"answer": string, "steps": array of strings or null (only when asked how the experiment is done), "chart": {"x": ${Object.keys(g.X).map((k) => `"${k}"`).join('|')}, "y": ${ys.map(([k]) => `"${k}"`).join('|')}} or null, "set": object or null, "open": "application" or null}.`,
    `"set" may hold any of: ${settable}. Use it only when the user asks to change or try something.`,
    'Give a "chart" whenever the question is about how a result depends on a setting. The app draws it from its own model, so never list data points. Use "open" when the user asks where this matters on the station. Use only numbers given above.',
  ].join('\n');
}
