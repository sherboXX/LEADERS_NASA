// Flame spread over a thin solid in a flow duct (BASS, BASS-II, Saffire-I/II/III).
// A reduced-order, illustrative model: an oxygen limit that depends on airflow, gravity
// and thickness, and a spread rate above that limit. Tuned to the Saffire-II table
// (PSI-99): cotton-fibreglass at 22% O2 and 20 cm/s spreads at 2.1 to 2.6 mm/s with the
// flow in 0 g and accelerates on Earth; silicone and Nomex do not burn in 0 g; a 10 mm
// acrylic slab creeps at about 0.1 to 0.2 mm/s. Units: O2 %, psia, cm/s, mm, seconds.
export const MATERIALS = {
  cotton: { label: 'Cotton fabric', loi: 17, v0: 2.2, soot: 0.55, color: 0xd9cfb8 },
  pmma: { label: 'Acrylic (PMMA)', loi: 17.5, v0: 3, soot: 0.3, color: 0xbfd6e6 },
  silicone: { label: 'Silicone', loi: 24, v0: 0.9, soot: 0.2, color: 0xc8643c },
  nomex: { label: 'Nomex fabric', loi: 28.5, v0: 1.6, soot: 0.35, color: 0x9a9468 },
};
// Sample size in mm for each experiment (length along the flow, width).
export const SAMPLE = { bass: [100, 20], bass2: [100, 20], saffire1: [940, 400], saffire2: [290, 50], saffire3: [940, 400] };
export const SETUP = -1.5;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Lowest oxygen (%) at which the flame keeps spreading. */
export function limit(c) {
  const m = MATERIALS[c.material];
  const veff = c.v + 30 * Math.sqrt(c.g);                               // buoyancy adds its own draught
  const quench = 9 * Math.exp(-veff / 2.2);                             // too little flow: heat leaks away faster than oxygen arrives
  const blow = c.dir === 'against' ? 0.0002 * veff ** 2 : 0;            // strong head-on flow blows the flame off
  const dip = 1.6 * Math.exp(-(Math.log((veff + 0.5) / 12) ** 2) / 1.2); // gentle flow, about 10 cm/s, is the worst case
  const buoy = 3.2 * Math.sqrt(c.g);                                    // on Earth rising hot gas keeps feeding the flame
  const thick = 2.2 * Math.log10(Math.max(c.thick, 0.1) / 0.37);        // thicker material is harder to keep alight
  return { o2: m.loi + quench + blow - dip - buoy + thick, veff, quench, blow };
}

export function plan(c) {
  const m = MATERIALS[c.material];
  const [len, width] = SAMPLE[c.exp] || SAMPLE.bass;
  const lim = limit(c);
  const margin = c.o2 - lim.o2;
  const flow = c.dir === 'with' ? (0.45 + lim.veff / 36) * (1 + 5 * c.g) : 0.7 / (1 + (lim.veff / 90) ** 2);
  const rate = margin <= 0 ? 0 : m.v0 * (0.37 / c.thick) ** 0.8 * (margin / 6) ** 0.7 * flow * (c.p / 14.7) ** 0.5;
  const flame = margin <= 0 ? 0 : clamp((c.dir === 'with' ? 3 + 1.6 * lim.veff ** 0.9 : 7) * Math.sqrt(Math.min(margin, 12) / 6) * Math.sqrt(width / 20), 4, 0.6 * len);
  const regime = margin > 0 ? (rate > 8 ? 'fast' : 'spread') : lim.quench > 0.8 ? 'quench' : lim.blow > 1.2 ? 'blowoff' : 'noburn';
  const span = rate > 0 ? len / rate : 3.2;                             // seconds to burn the whole sample
  return { c, m, len, width, limit: lim.o2, margin, rate, flame, regime, veff: lim.veff,
    soot: m.soot * clamp(0.4 + margin / 10 + 0.5 * c.g, 0, 1.3), tEnd: span, lapse: Math.max(1, span / 40) };
}

/** State at time t (s after the igniter is switched off). Lengths in mm. */
export function at(p, t) {
  const burning = p.rate > 0;
  const front = burning ? clamp(p.rate * t, 0, p.len) : 0;
  const done = burning && front >= p.len;
  const flicker = burning ? step(0, 1.2, t) * (1 - step(p.tEnd - 0.04 * p.tEnd - 0.5, p.tEnd + 0.5, t)) : step(-0.3, 0.2, t) * (1 - step(0.6, 2.6, t)) * 0.55;
  return {
    t, front, burned: front / p.len,
    ign: step(SETUP, SETUP + 0.6, t) * (1 - step(0.2, 1.2, t)),
    hot: t < -0.3 ? 0 : clamp(flicker, 0, 1) * clamp(0.5 + p.margin / 10, 0.45, 1.2),
    flame: burning ? p.flame * step(0, 1.5, t) : 6 * flicker,
    phase: t < 0 ? 'setup' : (burning ? !done : t < 2.6) ? 'burn' : 'out',
  };
}
