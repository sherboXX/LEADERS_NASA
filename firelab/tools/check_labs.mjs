// Runs each lab model over a grid of settings and checks for broken numbers.
// Run: node tools/check_labs.mjs
const GRIDS = {
  solid: { exp: ['bass', 'saffire1', 'saffire2'], material: ['cotton', 'pmma', 'silicone', 'nomex'], thick: [0.1, 0.37, 10], o2: [12, 21, 30, 40], p: [8, 14.7], v: [0, 2, 10, 40], dir: ['with', 'against'], g: [0, 0.165, 1] },
  smoke: { exp: ['same', 'daft'], material: ['cellulose', 'silicone', 'kapton', 'teflon', 'dust'], heat: [200, 400, 700], v: [0, 5, 30], age: [0, 300], g: [0, 1] },
  jet: { exp: ['spice', 'slice', 'efield'], fuel: ['methane', 'ethylene', 'propane', 'propylene'], mdot: [0.2, 1.5, 4.4], nozzle: [0.4, 1.6], air: [0, 30, 85], dilute: [0, 60], volt: [-10, 0, 10], g: [0, 1] },
  burner: { exp: ['sflame', 'cfig', 'bre'], mode: ['normal', 'inverse'], fuel: ['ethylene', 'methane', 'propane', 'butane', 'ethane'], mdot: [0.3, 1.5, 6], o2: [12, 21, 40, 85], xf: [5, 30, 100], g: [0, 1] },
};
function* combos(grid) {
  const keys = Object.keys(grid);
  const idx = keys.map(() => 0);
  for (;;) {
    yield Object.fromEntries(keys.map((k, i) => [k, grid[k][idx[i]]]));
    let i = 0;
    while (i < keys.length && ++idx[i] === grid[keys[i]].length) idx[i++] = 0;
    if (i === keys.length) return;
  }
}
for (const [name, grid] of Object.entries(GRIDS)) {
  let model;
  try { model = await import(`../engines/${name}/model.js`); } catch { console.log(`${name}: not built yet`); continue; }
  let n = 0; let bad = 0; const regimes = {};
  for (const c of combos(grid)) {
    const p = model.plan(c, {});
    n++;
    regimes[p.regime] = (regimes[p.regime] || 0) + 1;
    const check = (obj, where) => { for (const [k, v] of Object.entries(obj)) if (typeof v === 'number' && !Number.isFinite(v)) { if (bad++ < 4) console.log('  bad', name, where, k, JSON.stringify(c)); } };
    check(p, 'plan');
    if (!(p.tEnd > 0)) { if (bad++ < 4) console.log('  bad tEnd', JSON.stringify(c)); }
    for (let i = -4; i <= 24; i++) check(model.at(p, (p.tEnd * i) / 20), 'state');
  }
  console.log(`${name}: ${n} settings, ${bad} problems, outcomes ${JSON.stringify(regimes)}`);
}
