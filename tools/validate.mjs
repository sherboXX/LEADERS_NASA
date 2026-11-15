// Compares every model with the NASA measurements it can be compared with, and prints the
// figures quoted in docs/VALIDATION.md. Run: node tools/validate.mjs
import { readFileSync } from 'node:fs';
import { makePlan } from '../engines/droplet/model.js';
import * as solid from '../engines/solid/model.js';
import * as burner from '../engines/burner/model.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url)));
const flex = read('flex');
const labs = read('labs');
const pct = (a, b) => `${a} of ${b} (${Math.round((100 * a) / b)}%)`;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// --- Droplet: FLEX, PSI-69 -------------------------------------------------------------
console.log(`DROPLET · FLEX table ${flex.source.psi}, built ${flex.generated}`);
const all = flex.tests.map((r) => Object.fromEntries(flex.cols.map((c, i) => [c, r[i]])));
const tests = all.filter((t) => t.d0 && t.p);
console.log(`  tests in the table ${all.length}, usable ${tests.length}`);
for (const [name, f] of Object.entries(flex.fuels)) {
  console.log(`  ${name}: ${f.usable} usable of ${f.n} · burn-rate fit R2 ${f.fitK.r2}, mean error ${f.fitK.mae} mm2/s over ${f.fitK.n} tests`
    + ` · leftover-size fit R2 ${f.fitR.r2} over ${f.fitR.n} tests · median burn-time error ${Math.round(f.tbErrMedian * 100)}%`);
}
const table = {};
let same = 0;
for (const t of tests) {
  const p = makePlan(flex, { fuel: t.fuel, d0: t.d0, o2: t.o2, co2: t.co2, he: t.he, p: t.p, g: 0 }, t);
  const key = `${p.regime} -> ${p.model.regime}`;
  table[key] = (table[key] || 0) + 1;
  if (p.regime === p.model.regime) same++;
}
console.log(`  how the burn ends, measured -> model: same in ${pct(same, tests.length)}`);
for (const [k, n] of Object.entries(table).sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${n}`);

// --- Solid: Saffire-II, nine samples ------------------------------------------------------
console.log('\nSOLID · Saffire-II samples (measured outcome is the text NASA logged)');
for (const s of labs.saffire2) {
  const p = solid.plan({ exp: 'saffire2', ...s.set });
  console.log(`  ${s.label} | measured ${s.sub} | model: ${p.regime}, ${p.rate.toFixed(2)} mm/s`);
}

// --- Burner: Flame Design (PSI-10) and CFI-G (PSI-159) --------------------------------------
const zErr = [];
const tErr = [];
for (const s of labs.flamedesign) {
  const m = /Zst ([\d.]+) · (\d+) K/.exec(s.sub);
  if (!m) continue;
  const p = burner.plan({ exp: 'flamedesign', ...s.set });
  zErr.push(Math.abs(p.zst - +m[1]));
  tErr.push(Math.abs(p.tad - +m[2]));
}
console.log(`\nBURNER · Flame Design, ${zErr.length} tests with tabulated values`);
console.log(`  mixture fraction Zst: mean error ${mean(zErr).toFixed(3)}, worst ${Math.max(...zErr).toFixed(3)}`);
console.log(`  flame temperature: mean error ${Math.round(mean(tErr))} K, worst ${Math.round(Math.max(...tErr))} K`);
let litSame = 0;
let litN = 0;
const litTable = {};
for (const s of labs.cfig) {
  const m = /lit: (yes|no)/.exec(s.sub);
  if (!m) continue;
  const p = burner.plan({ exp: 'cfig', ...s.set });
  litN++;
  const key = `${m[1]} -> ${p.lit ? 'yes' : 'no'}`;
  litTable[key] = (litTable[key] || 0) + 1;
  if ((m[1] === 'yes') === !!p.lit) litSame++;
}
console.log(`BURNER · CFI-G, did it light, measured -> model: same in ${pct(litSame, litN)} ${JSON.stringify(litTable)}`);
for (const o2 of [21, 30, 40]) {
  const p = burner.plan({ exp: 'bre', mode: 'normal', fuel: 'ethylene', xf: 100, mdot: 1.5, o2, g: 0 });
  console.log(`BURNER · BRE ethylene at ${o2}% oxygen: ${p.regime}`);
}

console.log(`\nJET · SPICE: ${labs.spice.length} logged test conditions, no measured outcome in the table (trends only)`);
console.log('SMOKE · SAME, DAFT: no table to compare with (trends only)');
