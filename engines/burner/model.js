// Flames on a porous burner in still gas (ACME s-Flame, Flame Design, CFI-G, BRE).
// A reduced-order, illustrative model. Mixture fraction and flame temperature follow the
// standard diffusion-flame relations, tuned to the ACME tables: pure ethylene in air gives
// Zst 0.064 and about 2340 K (Flame Design, PSI-10: 0.063 and 2352 K); ethane with 12, 13.5
// and 15% oxygen gives about 1570, 1700 and 1790 K, and CFI-G saw no flame, a flash and a
// flame there (PSI-159), so the model lights above 1700 K. On top of that: the flame ball grows slowly, loses heat by
// radiation as it grows, and goes out when it cools below about 1130 K.
// Units: mg/s, percent, mm, kelvin, seconds.
export const FUELS = {
  methane: { label: 'Methane', o2: 4.0, mass: 16, soot: 0.25, cool: false },
  ethane: { label: 'Ethane', o2: 3.73, mass: 30, soot: 0.5, cool: true },
  ethylene: { label: 'Ethylene', o2: 3.43, mass: 28, soot: 1, cool: false },
  propane: { label: 'Propane', o2: 3.64, mass: 44, soot: 0.8, cool: true },
  butane: { label: 'Butane', o2: 3.58, mass: 58, soot: 0.9, cool: true },
};
export const SETUP = -1;
export const BURNER = 3.2;     // radius of the porous sphere, mm
const T_OUT = 1130;            // a flame cooler than this goes out
const T_LIGHT = 1700;          // and it will not light below this

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const step = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function plan(c) {
  const f = FUELS[c.fuel];
  const inverse = c.mode === 'inverse';        // oxygen flows from the burner into fuel gas
  const disc = c.exp === 'bre';                // BRE: a flat disc that imitates a burning solid
  const xf = c.xf / 100;
  const xo = c.o2 / 100;
  const yf = xf * f.mass / (xf * f.mass + (1 - xf) * 28);
  const yo = xo * 32 / (xo * 32 + (1 - xo) * 28);
  const zst = 1 / (1 + f.o2 * yf / yo);
  const raw = 38000 * yf * zst;                  // kelvin of heating, before dissociation flattens the hottest flames
  const tad = 300 + (raw < 1400 ? raw : 1400 + 1000 * (1 - Math.exp(-(raw - 1400) / 1000)));
  // where the flame sits: the burner gas must travel outward until it meets its match
  const share = Math.max(Math.log(1 / (inverse ? zst : 1 - zst)), 0.02);
  const size = clamp(1.33 * c.mdot / share * (disc ? 1.2 : 1), BURNER + 1.3, 60);
  const tau = size ** 2 / 100;
  const sootiness = clamp((tad - 1450 - 2600 * zst) / 600, 0, 1) * f.soot * (inverse ? 0.6 : 1);
  const cooling = 1.2 * (1 + sootiness) * (disc ? 1.35 : 1) * (1 - 0.8 * Math.min(c.g, 1));   // kelvin lost per mm² of flame radius²
  const lit = tad >= T_LIGHT;
  // radiative extinction: T = tad - cooling * r(t)² reaches T_OUT at this radius
  const rOut = Math.sqrt(Math.max(tad - T_OUT, 0) / Math.max(cooling, 1e-6));
  const dies = lit && rOut < size;
  const tOut = dies ? -tau * Math.log(1 - (rOut - BURNER) / (size - BURNER)) : 20;
  const cool = dies && f.cool && c.g < 0.05 ? clamp(6 + 0.2 * c.o2, 6, 24) : 0;
  const regime = !lit ? 'nolight' : dies ? (cool ? 'cool' : 'radiative') : 'steady';
  return { c, f, inverse, disc, zst, tad, size, tau, sootiness, cooling, lit, dies, rOut, tOut: lit ? Math.max(tOut, 0.4) : 1.2, cool, regime,
    final: dies ? rOut : size, tEnd: (lit ? Math.max(tOut, 0.4) : 1.2) + cool };
}

/** State at time t (s after the igniter fires). Lengths in mm. */
export function at(p, t) {
  const burn = Math.min(Math.max(t, 0), p.tOut);
  const r = BURNER + (p.size - BURNER) * (1 - Math.exp(-burn / p.tau));
  const temp = p.lit ? Math.max(p.tad - p.cooling * r * r, T_OUT) : 300;
  const hot = t < 0 ? 0 : !p.lit ? step(0, 0.2, t) * (1 - step(0.4, 1.2, t)) * 0.5
    : step(0, 0.4, t) * (t < p.tOut ? clamp(0.45 + (temp - T_OUT) / 1400, 0.4, 1.15) : Math.max(0, 1 - (t - p.tOut) / 0.5) * 0.45);
  const tc = t - p.tOut;
  return { t, r, temp, hot, cool: p.cool && tc > 0 ? step(0.1, 0.8, tc) * (1 - step(p.cool - 1, p.cool, tc)) : 0,
    ign: step(SETUP, SETUP + 0.4, t) * (1 - step(0.2, 0.9, t)),
    phase: t < 0 ? 'setup' : t < p.tOut ? 'hot' : p.cool && tc < p.cool ? 'cool' : 'out' };
}
