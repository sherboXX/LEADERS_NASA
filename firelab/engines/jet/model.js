// Gas-jet flames in a coflow duct (SPICE, SLICE, ACME CLD Flame, ACME E-FIELD Flames).
// A reduced-order, illustrative model from standard laminar-flame results: flame length
// grows with fuel flow (Roper), a flame that outgrows its smoke point lets soot escape,
// thinning the fuel with nitrogen weakens the flame until airflow lifts it off and blows
// it out, and an electric field pulls on the flame's ions much as buoyancy would.
// Units: mg/s, mm, cm/s, percent, kV, seconds.
export const FUELS = {
  methane: { label: 'Methane', len: 26, smoke: 900, speed: 0.38, density: 0.66 },
  ethylene: { label: 'Ethylene', len: 23, smoke: 30, speed: 0.68, density: 1.15 },
  propane: { label: 'Propane', len: 24, smoke: 46, speed: 0.42, density: 1.83 },
  propylene: { label: 'Propylene', len: 23, smoke: 13, speed: 0.44, density: 1.75 },
};
export const SETUP = -1;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function plan(c) {
  const f = FUELS[c.fuel];
  const dil = c.dilute / 100;
  const pull = clamp(c.g + 0.5 * (c.volt || 0) / 10, -0.6, 1.5);       // buoyancy plus the electric field's pull on the ions
  const up = Math.max(pull, 0);
  const hc = c.mdot * (1 - dil);                                      // hydrocarbon actually delivered, mg/s
  const length = Math.max(f.len * hc * (1 + 0.3 * dil) * (1 - 0.28 * Math.min(up, 1)) * (1 - 0.25 * Math.min(-Math.min(pull, 0), 0.6)) / (1 + c.air / 400), 1.5);
  const width = (5 + 4.5 * Math.sqrt(c.mdot)) * (1 - 0.35 * Math.min(up, 1)) * (1 + 0.5 * Math.max(-pull, 0)) / (1 + c.air / 70);
  const jet = c.mdot / f.density / (Math.PI * (c.nozzle / 2) ** 2) * 100;   // cm/s at the nozzle
  // soot escapes when the flame is longer than its smoke point
  const smokePoint = f.smoke * (1 + c.air / 25) * (0.8 / c.nozzle) ** 0.2 * (1 + 1.6 * Math.min(up, 1)) * (1 + 3 * dil);
  const sootiness = clamp(length / smokePoint, 0, 2);
  // stability: flow speed against how fast the diluted flame can burn back toward the nozzle
  const strength = f.speed * (1 - dil) ** 1.7;
  const push = (c.air / 100 + 0.004 * jet / 100) / (2.2 * strength);
  const lift = push <= 1 ? 0 : 6 * (push - 1) * (1 + c.nozzle);
  const regime = push >= 3 ? 'blowout' : push > 1 ? 'lifted' : sootiness >= 1 ? 'smoking' : sootiness >= 0.3 ? 'sooty' : 'blue';
  return { c, f, pull, length, width, jet, smokePoint, sootiness, push, lift, regime,
    soot: regime === 'blowout' ? 0 : clamp((sootiness - 0.15) * 1.3, 0, 1.2) * (push > 1 ? 0.5 : 1), smoke: clamp(sootiness - 1, 0, 1), tEnd: regime === 'blowout' ? 4 : 12 };
}

/** State at time t (s after the igniter fires). Lengths in mm. */
export function at(p, t) {
  const gone = p.regime === 'blowout';
  const grow = step(0, 1.2, t);
  const hot = t < 0 ? 0 : gone ? step(0, 0.3, t) * (1 - step(0.8, 2.2, t)) : grow;
  return { t, hot, length: p.length * (0.25 + 0.75 * grow), width: p.width * (0.5 + 0.5 * grow),
    lift: gone ? 30 * step(0.4, 2.2, t) : p.lift * grow, ign: step(SETUP, SETUP + 0.4, t) * (1 - step(0.2, 0.9, t)),
    phase: t < 0 ? 'setup' : hot > 0.02 || t < 0.4 ? 'burn' : 'out' };
}
