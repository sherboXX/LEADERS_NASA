// Sanity check of the droplet model against every usable FLEX test. Run: node tools/check_model.mjs
import { readFileSync } from 'node:fs';
import { makePlan, stateAt, curve, nearest, interpret, predict, SETUP } from '../engines/droplet/model.js';
const flex = JSON.parse(readFileSync(new URL('../data/flex.json', import.meta.url)));
const tests = flex.tests.map((r) => Object.fromEntries(flex.cols.map((c, i) => [c, r[i]]))).filter((t) => t.d0 && t.p);
let bad = 0; const reg = {}; const mreg = {};
for (const t of tests) {
  const c = { fuel: t.fuel, d0: t.d0, o2: t.o2, co2: t.co2, he: t.he, p: t.p, g: 0 };
  for (const plan of [makePlan(flex, c, t), makePlan(flex, c), makePlan(flex, { ...c, g: 1 })]) {
    for (let x = SETUP.start; x < plan.tEnd + 8; x += 0.05) {
      const s = stateAt(plan, x);
      for (const [k, v] of Object.entries(s)) if (typeof v === 'number' && !Number.isFinite(v)) { bad++; if (bad < 5) console.log('NaN', t.n, k, x); }
      if (s.rf < 0 || s.d < 0 || s.hot < 0 || s.soot < 0) { bad++; if (bad < 5) console.log('neg', t.n, x, s); }
    }
    if (!(plan.tEnd > 0) || curve(plan).some((p) => !Number.isFinite(p.d2))) { bad++; console.log('plan', t.n, plan.tEnd); }
  }
  const p = makePlan(flex, c, t); reg[p.regime] = (reg[p.regime] || 0) + 1; mreg[p.model.regime] = (mreg[p.model.regime] || 0) + 1;
}
console.log('tests', tests.length, 'problems', bad, '\n measured regimes', reg, '\n model regimes   ', mreg);
const show = (c, t) => { const p = makePlan(flex, c, t); const s = stateAt(p, 0.35 * p.tb);
  console.log(`${c.fuel} d0=${c.d0} O2=${c.o2} CO2=${c.co2} He=${c.he} P=${c.p} g=${c.g}: K=${p.k.toFixed(2)} r=${p.r.toFixed(2)} tb=${p.tb.toFixed(1)}s ${p.regime} tc=${p.tc.toFixed(1)} | at 35%: d=${s.d.toFixed(2)} flameDia=${(2 * s.rf).toFixed(1)}mm hot=${s.hot.toFixed(2)} soot=${s.soot.toFixed(2)} rs=${s.rs.toFixed(1)}`); return p; };
const air = (fuel, d0, o = {}) => ({ fuel, d0, o2: 0.21, co2: 0, he: 0, p: 1, g: 0, ...o });
show(air('heptane', 3.6)); show(air('heptane', 2.0)); show(air('heptane', 3.6, { g: 1 })); show(air('heptane', 3.6, { g: 0.165 }));
show(air('heptane', 3.6, { o2: 0.30, p: 0.694 })); show(air('heptane', 3.0, { co2: 0.3 })); show(air('heptane', 3.0, { o2: 0.15 }));
show(air('methanol', 3.0)); show(air('methanol', 3.0, { he: 0.4, o2: 0.14 })); show(air('methanol', 3.0, { o2: 0.34 }));
const c = air('heptane', 3.6); console.log('nearest', nearest(tests, c).map((n) => `#${n.test.n} ${n.dist.toFixed(2)}`).join(', '));
for (const cc of [c, air('heptane', 3, { co2: 0.3 }), air('methanol', 3, { o2: 0.3, p: 0.694 }), air('heptane', 3.6, { g: 1 }), air('methanol', 3, { he: 0.4, o2: 0.14 })])
  { const n = interpret(makePlan(flex, cc), makePlan(flex, air(cc.fuel, cc.d0))); console.log('-', n.focus, '|', n.happened.join(' '), '| DANGER:', n.danger, '| DO:', n.action); }
