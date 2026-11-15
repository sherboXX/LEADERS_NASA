// Smoke from overheated materials and how two kinds of detector respond to it
// (SAME, SAME-R; DAFT and DAFT-2 used the same instruments on cabin dust).
// A reduced-order, illustrative model built on what SAME reported: each material makes
// its own particle size; slow flow and ageing let particles grow; an ionisation detector
// responds to many small particles, a light-scattering detector to fewer large ones; and
// with no airflow in orbit the smoke never travels to the detector at all.
// Units: degrees C, cm/s, seconds, nanometres.
export const MATERIALS = {
  cellulose: { label: 'Lamp wick', on: 260, d: 230, yield: 1.0, color: 0xcfc5ae },
  silicone: { label: 'Silicone', on: 380, d: 170, yield: 0.8, color: 0xc8643c },
  kapton: { label: 'Kapton', on: 560, d: 120, yield: 0.5, color: 0xc79a2e },
  teflon: { label: 'Teflon', on: 480, d: 75, yield: 0.6, color: 0xe9edf2 },
  dust: { label: 'Cabin dust', on: 0, d: 2400, yield: 0.006, color: 0x9a8f7c },
};
export const DISTANCE = 60;   // cm from the sample to the detectors
export const ALARM = 30;      // % of full signal that trips a detector
export const SETUP = -1;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function plan(c) {
  const m = MATERIALS[c.material];
  const dusty = c.material === 'dust';
  const drive = dusty ? 1 : clamp((c.heat - m.on) / 160, 0, 1.6);             // how hard the material is smoking
  const carry = c.v + 40 * c.g;                                               // cm/s toward the detectors: fan plus buoyant rise
  const linger = 1 + 0.7 / (1 + carry / 4);                                   // slow flow keeps particles in the hot zone, so they grow
  const fresh = m.d * linger * (1 + 0.25 * drive) * (1 - 0.2 * c.g);
  const grow = dusty ? 1 : (1 + drive * m.yield * c.age / 90) ** (1 / 3);     // coagulation while the smoke ages
  const d = fresh * grow;                                                     // count-mean diameter, nm
  const n = drive * m.yield / grow ** 3;                                      // relative number of particles
  const arrives = carry >= 0.5 && drive > 0;
  // ionisation responds to number x diameter; light scattering climbs steeply with size
  const ion = arrives ? 100 * (1 - Math.exp(-n * d / 85)) : 0;
  const scatter = arrives ? 100 * (1 - Math.exp(-n * (d / 140) ** 5)) : 0;      // small particles scatter very little light
  const start = dusty ? 0.5 : 2 + 3 * clamp(m.on / Math.max(c.heat, 1), 0, 1.5);
  const travel = arrives ? DISTANCE / carry : 9999;                            // 9999 s stands for 'never'
  const tEnd = clamp(arrives ? start + travel + 14 : 30, 16, 120);
  const regime = drive <= 0 ? 'none' : !arrives ? 'stuck' : ion >= ALARM && scatter >= ALARM ? 'both'
    : ion >= ALARM ? 'ion' : scatter >= ALARM ? 'scatter' : 'weak';
  return { c, m, dusty, drive, carry, d, n, ion, scatter, start, travel, arrives, arrive: start + travel, tEnd, regime,
    count: n * (dusty ? 9e2 : 6e5), mass: n * (d / 200) ** 3 * (dusty ? 0.5 : 2.5), lapse: Math.max(1, tEnd / 40) };
}

/** State at time t (s after the heater is switched on). */
export function at(p, t) {
  const emit = t < p.start ? 0 : p.drive * step(p.start, p.start + 2, t);
  const here = p.arrives ? step(p.arrive, p.arrive + 6, t) : 0;
  const ion = p.ion * here;
  const scatter = p.scatter * here;
  return { t, emit, here, ion, scatter, heat: step(SETUP, 1.5, t), cloud: clamp((t - p.start) / 12, 0, 1) * p.drive,
    ionAlarm: ion >= ALARM, scatterAlarm: scatter >= ALARM,
    phase: t < 0 ? 'setup' : t < p.tEnd ? 'burn' : 'out' };
}
