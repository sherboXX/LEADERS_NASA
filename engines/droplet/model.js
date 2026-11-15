// Reduced-order droplet combustion model fitted to the FLEX table (PSI-69).
// Everything here is a pure function of the conditions and of time, so a burn can be
// replayed, scrubbed and re-planned while it is running.

export const FUELS = {
  methanol: { label: 'Methanol', formula: 'CH₃OH', F0: 2.6, F1: 5.0, soot: 0, cool: false },
  heptane: { label: 'Heptane', formula: 'C₇H₁₆', F0: 3.2, F1: 7.5, soot: 1, cool: true },
  dodecane: { label: 'Dodecane', formula: 'C₁₂H₂₆', F0: 3.2, F1: 7, soot: 1, cool: true, rc: 0.08 },
};

// Apparatus timeline before ignition (seconds; ignition is t = 0).
export const SETUP = { start: -2.4, retract: -1.8, ignIn: -1.35, heat: -0.9 };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const c01 = (v) => clamp(v, 0, 1);
const ease = (x) => x * x * (3 - 2 * x);
const step = (a, b, x) => ease(c01((x - a) / (b - a)));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Burn-rate constant K (mm²/s) and extinction ratio r = d_ext/d0 from conditions alone. */
export function predict(flex, c) {
  if (c.fuel === 'dodecane') {
    // No fitted table for dodecane (CFI): constants anchored to PSI-117, where a 4.4 mm drop at
    // 1 atm lost its hot flame at 92% of its diameter and its cool flame at under 10%.
    const thin = 1 - 0.5 * c.co2 - 0.2 * c.he;
    return { k: clamp(0.42 * (1 + 2.2 * (c.o2 - 0.21)) * Math.pow(c.p, 0.1) * thin, 0.12, 1.3),
      r: clamp(0.92 / (1 + Math.exp(-(c.d0 - 2.6) / 0.35)) + 0.5 * (0.21 - c.o2) + 0.5 * c.co2 + 0.3 * c.he, 0, 0.97) };
  }
  const f = flex.fuels[c.fuel] || { tbFactor: 1.05 };
  const x = [1, c.o2, c.co2, c.he, Math.log(c.p), c.d0];
  return { k: clamp(dot(f.fitK.c, x), 0.12, 1.3), r: 1 / (1 + Math.exp(-dot(f.fitR.c, x))) };
}

/**
 * Plan a burn. `c` = { fuel, d0 (mm), o2, co2, he (mole fractions), p (atm), g (Earth g) }.
 * With `test` (a FLEX row) the measured values drive the animation and the model values
 * are kept alongside for comparison.
 */
export function makePlan(flex, c, test = null) {
  const fuel = FUELS[c.fuel];
  const f = flex.fuels[c.fuel] || { tbFactor: 1.05 };
  const g = c.g || 0;
  const m = predict(flex, c);
  // Above 0 g this is an illustrative interpolation: PSI holds no partial-gravity data.
  const kG = g > 0 ? 1 + 0.18 * Math.pow(g, 0.25) * Math.pow(c.d0, 0.75) : 1;
  // Slow airflow past the droplet (FLEX-2): the standard Frössling correction to the burn
  // rate, and less radiative extinction because the flow keeps bringing oxygen.
  const flow = c.flow || 0;
  const kF = 1 + 0.25 * Math.sqrt(flow * c.d0 / 10);
  const model = { k: m.k * kG * kF, r: m.r >= 0.93 ? m.r : m.r * (1 - 0.85 * Math.pow(g, 0.3)) * (1 - 0.5 * Math.min(flow / 5, 1)) };
  const burnTime = (k, r) => Math.max(0.25, f.tbFactor * c.d0 ** 2 * (1 - r ** 2) / k);
  model.tb = burnTime(model.k, model.r);

  let { k, r, tb } = model;
  let measured = null;
  if (test) {
    const mr = test.dx != null ? Math.min(test.dx / test.d0, 0.995) : test.end === 'C' ? 0 : null;
    measured = { k: test.k, r: mr, tb: test.tb, end: test.end };
    if (test.k) k = test.k;
    if (mr != null) r = mr;
    tb = test.tb || burnTime(k, r);
  }
  const regimeOf = (rr) => (rr >= 0.93 ? 'noburn' : rr <= 0.25 ? 'burnout'
    : fuel.cool && g < 0.05 && rr >= 0.45 ? 'radiative' : 'extinction');
  const regime = regimeOf(r);
  model.regime = regimeOf(model.r);
  const cool = regime === 'radiative';
  const kc = 0.36 * Math.pow(c.p, 0.2);
  const rc = cool ? (test && test.end === 'C' ? 0 : Math.min(fuel.rc ?? 0.33, 0.6 * r)) : r;
  const tc = cool ? c.d0 ** 2 * (r ** 2 - rc ** 2) / kc : 0;

  const scale = Math.pow(0.21 / c.o2, 0.7) * (1 + 0.6 * c.he) * (1 - 0.15 * c.co2) / (1 + 2.5 * Math.sqrt(g));
  const hot0 = clamp(0.45 + 2.6 * (c.o2 - 0.13), 0.35, 1.25) * (1 - 0.45 * c.co2) * (1 - 0.25 * c.he);
  const soot0 = fuel.soot * clamp(Math.pow(c01((c.o2 - 0.14) / 0.12), 0.8) * Math.pow(c.p, 0.6)
    * (1 - 1.4 * c.he) * (1 - 0.9 * c.co2) * Math.sqrt(c.d0 / 3) * (1 + 0.3 * g), 0, 1.3);

  return { c, fuel, g, model, measured, k, r, tb, regime, cool, kc, rc, tc, tEnd: tb + tc,
    scale, hot0, soot0, tau: 0.1 * c.d0 ** 2 / k };
}

/** Everything the scene needs at time t (s). Lengths in mm. */
export function stateAt(plan, t) {
  const { c, fuel, r, tb, cool, kc, rc, tc, regime } = plan;
  const d0 = c.d0;
  const s = { t };

  // apparatus
  s.needle = step(SETUP.retract, SETUP.retract + 0.3, t);
  s.ign = step(SETUP.ignIn, SETUP.ignIn + 0.4, t) * (1 - step(0.12, 0.6, t));
  s.coil = c01((t - SETUP.heat) / 0.75) * (1 - c01((t - 0.05) / 0.45));
  const tw = t - SETUP.retract;
  s.wobble = tw > 0 ? Math.exp(-tw / 0.3) * Math.cos(tw * 36) * 0.07 : 0;

  // droplet: d² falls linearly in each stage (the d²-law)
  let d2 = d0 * d0;
  if (t > 0 && t <= tb) d2 = d0 * d0 * (1 - (1 - r * r) * (t / tb));
  else if (t > tb && cool && t <= tb + tc) d2 = (r * d0) ** 2 - kc * (t - tb);
  else if (t > tb) d2 = ((cool ? rc : r) * d0) ** 2;
  s.d2 = Math.max(d2, 0);
  s.d = Math.sqrt(s.d2);

  s.phase = t < SETUP.retract ? 'ready' : t < 0 ? 'setup' : t < tb ? 'hot' : cool && t < tb + tc ? 'cool' : 'out';

  // hot flame
  const u = c01(t / tb);
  const fsr = fuel.F0 + (fuel.F1 - fuel.F0) * (1 - Math.exp(-Math.max(t, 0) / plan.tau));
  const dAt = t > tb ? r * d0 : s.d; // the sheet stays where it died while it fades
  s.rf = Math.max(0.5 * dAt * fsr * plan.scale * (0.35 + 0.65 * step(0, 0.3, t)), 0.62 * dAt + 0.15);
  const dying = regime === 'burnout' ? 0 : 0.7 * step(0.8, 1, u);
  s.hot = t < 0 ? 0 : plan.hot0 * step(0, 0.15, t) * (1 - dying) * (t < tb ? 1 : Math.max(0, 1 - (t - tb) / 0.3));
  if (regime === 'noburn') s.hot *= Math.exp(-t / (0.5 * tb + 0.1)) * 0.8;
  const sootFade = regime === 'radiative' ? 1 - step(0.5, 0.97, u) : 1 - step(0.86, 1, u);
  s.soot = t < 0 || t > tb ? 0 : plan.soot0 * (1 - Math.exp(-t / (0.08 * tb + 0.2))) * sootFade
    * (regime === 'noburn' ? 0.3 : 1);
  s.rs = Math.min(1.1 * s.d + 0.1, 0.72 * s.rf);
  s.flash = t >= 0 ? Math.exp(-t / 0.1) : 0;

  // cool flame (invisible to the eye; drawn enhanced) and the vapour cloud it leaves
  const tcs = t - tb;
  s.cool = cool && tcs > 0 ? step(0.1, 0.6, tcs) * (1 - step(tc - 0.4, tc + 0.3, tcs)) : 0;
  s.coolR = 0.5 * s.d * (3.8 + 1.7 * c01(tcs / Math.max(tc, 0.01))) * Math.sqrt(plan.scale) + 0.4;
  const tv = t - plan.tEnd;
  s.vapour = tv > 0 && regime !== 'burnout' ? step(0, 1.2, tv) * (1 - step(2.5, 7, tv)) * (cool ? 1 : 0.45) : 0;
  s.vapourR = (cool ? s.coolR : s.rf) * (0.9 + 0.25 * Math.max(tv, 0));

  s.light = s.hot * (0.35 + 2.2 * s.soot) + 0.08 * s.cool + 0.9 * s.flash * (t >= 0 ? 1 : 0);
  return s;
}

/** d² history for the chart: [{ t, d2, phase }]. */
export function curve(plan, n = 120) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = (plan.tEnd * i) / n;
    const s = stateAt(plan, t);
    out.push({ t, d2: s.d2, phase: t <= plan.tb ? 'hot' : 'cool' });
  }
  return out;
}

export const OUTCOME = {
  noburn: 'Does not sustain a flame',
  burnout: 'Burns up almost completely',
  extinction: 'Flame goes out, droplet left over',
  radiative: 'Radiative extinction, then a cool flame',
};

const SCALE = { o2: 0.04, co2: 0.12, he: 0.12, lnp: 0.45, d0: 0.8 };
/** Closest real tests to a set of conditions, with a rough distance (1 ≈ "one step away"). */
export function nearest(tests, c, n = 3) {
  return tests.filter((t) => t.fuel === c.fuel).map((t) => ({
    test: t,
    dist: Math.hypot((t.o2 - c.o2) / SCALE.o2, (t.co2 - c.co2) / SCALE.co2, (t.he - c.he) / SCALE.he,
      Math.log(t.p / c.p) / SCALE.lnp, (t.d0 - c.d0) / SCALE.d0),
  })).sort((a, b) => a.dist - b.dist).slice(0, n);
}

export function support(dist) {
  return dist < 1 ? 'Inside the range FLEX tested' : dist < 2.5 ? 'Close to tested conditions'
    : 'Extrapolation: no ISS test nearby';
}

const pct = (v) => `${Math.round(v * 100)}%`;
/**
 * Plain-language reading of a plan against the same droplet in ISS cabin air.
 * Returns { happened: [...], danger, action, focus }; focus is the station zone the
 * Application section flies to first ('ext' = extinguishers, 'o2' = oxygen system).
 */
export function interpret(plan, base) {
  const { c, regime, g, r } = plan;
  const dil = c.co2 > 0.005 ? ['carbon dioxide', c.co2] : c.he > 0.005 ? ['helium', c.he] : null;
  const left = pct(r ** 3);
  const happened = [];
  let danger;
  let action;
  if (regime === 'noburn') {
    happened.push(dil
      ? `With ${pct(dil[1])} ${dil[0]} at ${pct(c.o2)} oxygen the igniters light the vapour, but the flame cannot hold once they pull back.`
      : `At ${pct(c.o2)} oxygen the flame cannot hold once the igniters pull back.`);
    danger = !dil ? 'No sustained flame here, but oxygen this low is also too low for the crew to breathe.'
      : c.co2 > 0.005 ? 'The flame is beaten, but this much carbon dioxide is a hazard of its own: in a sealed cabin it is toxic far below these levels.'
        : 'The flame is beaten, but this much helium displaces the oxygen the crew needs.';
    action = dil ? 'This is how a gas extinguisher works. Use the test map to find the smallest amount that still stops the flame, then weigh it against what the crew can breathe.'
      : 'Lowering oxygen prevents fire only within what the crew can tolerate, so it cannot be the only defence.';
  } else {
    const dk = plan.k / base.k - 1;
    happened.push(`It burns at ${plan.k.toFixed(2)} mm²/s, ${Math.abs(dk) < 0.05 ? 'about the same as' : `${pct(Math.abs(dk))} ${dk > 0 ? 'faster' : 'slower'} than`} the same droplet in ISS cabin air.`);
    if (regime === 'radiative') {
      happened.push(`A droplet this large loses so much heat by radiation that the visible flame dies with ${left} of the fuel left. A cool flame then carries on for about ${Math.round(plan.tc)} s.`);
      danger = 'A fire that looks out may not be out. The cool flame is invisible to eyes and ordinary cameras, keeps making toxic gases and can flash back into a hot flame.';
      action = 'After a flame disappears, keep suppressing and keep watching gas sensors and temperature before calling it safe.';
    } else if (regime === 'burnout') {
      happened.push('The flame follows the droplet down until almost nothing is left.');
      danger = 'All the fuel burns, so its full heat and combustion gases go into the cabin air.';
      action = 'Size suppression for the atmosphere actually flown: small changes in oxygen change how fast fuel burns and how much of it burns.';
    } else {
      happened.push(c.fuel === 'methanol'
        ? `The flame goes out with ${left} of the fuel left: water made by the flame dissolves into the methanol until it stops burning.`
        : `The flame goes out with ${left} of the fuel left.`);
      danger = 'Unburned fuel is left behind as liquid and vapour, ready to light again if the air around it changes.';
      action = 'Treat a flame that went out by itself as unfinished: check for leftover fuel before restoring airflow.';
    }
    if (dil) happened.push(`The ${dil[0]} is why it dies ${base.r < r - 0.05 ? 'earlier than in plain air' : 'here'}.`);
    if (g > 0) happened.push('With gravity, buoyancy feeds the flame and stretches it into a teardrop (an illustration: PSI has no partial-gravity data yet).');
  }
  if (c.o2 >= 0.295 && c.p <= 0.75) {
    danger += ' This is the atmosphere planned for the Moon Base and pressurised rovers (30% oxygen or more at 10.2 psi or less), and FLEX has only a few tests this rich in oxygen.';
    action = 'Qualify materials and suppression at the highest oxygen level the habitat will use, and fill the gap in test data near 30% oxygen.';
  }
  const focus = dil || regime === 'noburn' || regime === 'radiative' ? 'ext' : c.o2 >= 0.28 ? 'o2' : 'ext';
  return { happened, danger, action, focus };
}

/** One line on what a change of settings did, for the toast. Empty when nothing notable changed. */
export function explainChange(a, b) {
  if (a.c.fuel !== b.c.fuel) return `${FUELS[b.c.fuel].label}: ${OUTCOME[b.regime].toLowerCase()}`;
  const parts = [];
  const dk = b.k / a.k - 1;
  if (Math.abs(dk) >= 0.04) parts.push(`Burns ${pct(Math.abs(dk))} ${dk > 0 ? 'faster' : 'slower'}`);
  if (a.regime !== b.regime) parts.push(`Now: ${OUTCOME[b.regime].toLowerCase()}`);
  else {
    const dl = b.r ** 3 - a.r ** 3;
    if (Math.abs(dl) >= 0.05) parts.push(`${pct(Math.abs(dl))} ${dl > 0 ? 'more' : 'less'} fuel left over`);
  }
  return parts.join(' · ');
}
