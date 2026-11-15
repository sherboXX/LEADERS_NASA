// Checks the guide's local answers, sketch data and system prompt. Run: node tools/check_guide.mjs
import { readFileSync } from 'node:fs';
import { makePlan, interpret, explainChange } from '../engines/droplet/model.js';
import { localAnswer, sketchSpec, systemPrompt, introSteps } from '../engines/droplet/brain.js';
const flex = JSON.parse(readFileSync(new URL('../data/flex.json', import.meta.url)));
const c = { fuel: 'heptane', d0: 3.6, o2: 0.21, co2: 0, he: 0, p: 1, g: 0 };
const plan = makePlan(flex, c);
const notes = interpret(plan, plan);
let bad = 0;
for (const x of ['o2', 'co2', 'he', 'p', 'd0', 'g']) for (const y of ['k', 'tb', 'left', 'flame']) {
  const s = sketchSpec(flex, c, { x, y });
  if (!s || s.points.length !== 37 || s.points.some((p) => !Number.isFinite(p.y)) || !Number.isFinite(s.mark.y)) { bad++; console.log('bad sketch', x, y); }
}
console.log('sketches checked, problems:', bad, '| unknown axis ->', sketchSpec(flex, c, { x: 'zzz' }));
for (const q of ['What does more oxygen do?', 'Does CO₂ put it out?', 'How is it done?', 'Why is the flame a ball?', 'What is a cool flame?', 'how long does it last with helium', 'is it dangerous?', 'hello']) {
  const r = localAnswer(q, { flex, c, notes });
  console.log(`Q: ${q}\n   chart=${JSON.stringify(r.chart || null)} steps=${r.steps ? r.steps.length : 0} :: ${r.answer.slice(0, 150)}`);
}
const sp = systemPrompt(flex, c, plan, notes, 'beginner');
console.log('system prompt chars:', sp.length, '| lines:', sp.split('\n').length);
console.log('intro steps:', introSteps(plan).map((s) => s.title).join(' > '));
console.log('change:', explainChange(plan, makePlan(flex, { ...c, o2: 0.3 })), '|', explainChange(plan, makePlan(flex, { ...c, co2: 0.3 })), '|', JSON.stringify(explainChange(plan, makePlan(flex, { ...c, d0: 3.61 }))));
