// Burner flames: ACME s-Flame, Flame Design, CFI-G and BRE. See core/lab.js for the spec format.
import * as model from './model.js';
import { createScene } from './scene.js';

const GRAV = [{ value: 0, label: '0 g' }, { value: 0.165, label: 'Moon' }, { value: 0.38, label: 'Mars' }, { value: 1, label: 'Earth' }];
const earth = { id: 'earth', icon: 'orbit', name: 'Same flame on Earth', level: 'med', set: { g: 1 } };
const colour = (p) => (p.sootiness > 0.5 ? 'yellow' : p.sootiness > 0.12 ? 'blue-yellow' : 'blue');

export default {
  id: 'burner',
  data: '../../data/labs.json',
  note: 'Illustrative model, not a CFD simulation. Mixture fraction and flame temperature follow the standard relations and match the ACME tables (PSI-10, PSI-159); flame size and radiative extinction are simplified.',
  camera: [5.5, 3, 21],
  defaults: { mode: 'normal', fuel: 'ethylene', mdot: 1.5, o2: 21, xf: 50, g: 0 },
  reference: { o2: 21, g: 0 },
  experiments: [
    { id: 'sflame', name: 's-Flame', psi: 'PSI-23', title: 'A ball of flame', subtitle: 'ACME s-Flame · spherical flames that grow until they go out, ISS',
      about: 'Structure and Response of Spherical Diffusion Flames fed gas through a small porous sphere to make a ball-shaped flame, and watched it grow, cool by radiation and go out.',
      scenarios: [
        { id: 'thin', icon: 'o2', name: 'Thinned ethylene', level: 'med', set: {} },
        { id: 'pure', icon: 'flame', name: 'Pure ethylene', level: 'high', set: { xf: 100 } },
        { id: 'small', icon: 'gauge', name: 'A trickle of fuel', level: 'low', set: { mdot: 0.5 } },
        { id: 'rich', icon: 'o2', name: 'Oxygen-rich air', level: 'high', set: { o2: 40 } },
        { id: 'methane', icon: 'flask', name: 'Methane', level: 'low', set: { fuel: 'methane', xf: 100 } }, earth] },
    { id: 'flamedesign', name: 'Flame Design', psi: 'PSI-10', title: 'Designing soot away', subtitle: 'ACME Flame Design · choosing the mix so that soot cannot form, ISS',
      about: 'Flame Design asked which mixes of fuel, oxygen and inert gas make a flame sooty and which keep it clean, by moving the flame relative to where soot forms.',
      defaults: { xf: 100, mdot: 1 },
      scenarios: [
        { id: 'sooty', icon: 'flame', name: 'Sooty flame', level: 'high', set: {} },
        { id: 'clean', icon: 'o2', name: 'Designed to be clean', level: 'low', set: { xf: 15, o2: 40 } },
        { id: 'inverse', icon: 'orbit', name: 'Inside-out flame', level: 'med', set: { mode: 'inverse', xf: 30, o2: 40, mdot: 4 } },
        { id: 'propane', icon: 'flask', name: 'Propane', level: 'med', set: { fuel: 'propane' } }, earth] },
    { id: 'cfig', name: 'CFI-G', psi: 'PSI-159', title: 'Inside-out flames', subtitle: 'ACME CFI-G · oxygen up to 85% flowing into fuel gas, ISS',
      about: 'Cool Flames Investigation with Gases reversed the usual flame: oxygen, up to 85%, flowed from the burner into a chamber of fuel gas. These are the most oxygen-rich microgravity tests in PSI.',
      defaults: { mode: 'inverse', fuel: 'butane', xf: 30, o2: 85, mdot: 5.6 }, camera: [3.4, 1.9, 12],
      scenarios: [
        { id: 'rich', icon: 'o2', name: '85% oxygen', level: 'high', set: {} },
        { id: 'air', icon: 'crew', name: 'Air from the burner', level: 'med', set: { o2: 21 } },
        { id: 'limit', icon: 'gauge', name: 'Too little oxygen to light', level: 'low', set: { fuel: 'ethane', o2: 12 } },
        { id: 'cool', icon: 'flame', name: 'Cool flame after the hot one', level: 'high', set: { mode: 'normal', xf: 100, o2: 21, mdot: 1.5 } }, earth] },
    { id: 'bre', name: 'BRE', psi: 'PSI-20', title: 'A stand-in for burning plastic', subtitle: 'ACME BRE · a gas burner that imitates a burning solid in still air, ISS',
      about: 'The Burning Rate Emulator fed gas through a flat disc so the flame behaved like one over a burning plastic or liquid. It asked when such a flame survives with no airflow at all.',
      defaults: { xf: 100 },
      scenarios: [
        { id: 'air', icon: 'crew', name: 'Still cabin air', level: 'low', set: {} },
        { id: 'moon', icon: 'o2', name: 'Moon Base oxygen', level: 'med', set: { o2: 30 } },
        { id: 'rich', icon: 'flame', name: '40% oxygen', level: 'high', set: { o2: 40 } },
        { id: 'weak', icon: 'gauge', name: 'A slower-burning material', level: 'low', set: { mdot: 0.7 } }, earth] },
  ],
  controls: [
    { key: 'mode', label: 'Burner gas', kind: 'seg', options: [{ value: 'normal', label: 'Fuel' }, { value: 'inverse', label: 'Oxygen' }], only: ['sflame', 'flamedesign', 'cfig'] },
    { key: 'fuel', label: 'Fuel', kind: 'pick', options: Object.entries(model.FUELS).map(([value, f]) => ({ value, label: f.label })) },
    { key: 'mdot', label: 'Gas flow', kind: 'slider', min: 0.3, max: 6, step: 0.1, fmt: (x) => `${x.toFixed(1)} mg/s` },
    { key: 'o2', label: 'Oxygen', kind: 'slider', min: 12, max: 85, step: 0.5, fmt: (x) => `${+x.toFixed(1)}%` },
    { key: 'xf', label: 'Fuel strength', kind: 'slider', min: 5, max: 100, step: 1, fmt: (x) => `${x.toFixed(0)}%` },
    { key: 'g', label: 'Gravity', kind: 'seg', options: GRAV },
  ],
  model,
  readings: [
    { icon: 'clock', label: 'Time', text: (s, p) => `${Math.max(s.t, 0).toFixed(1)} / ${p.tEnd.toFixed(1)} s` },
    { icon: 'o2', label: 'Flame size', text: (s) => (s.hot > 0.05 ? `${(2 * s.r).toFixed(0)} mm` : '–') },
    { icon: 'gauge', label: 'Temperature', text: (s) => (s.hot > 0.05 ? `${Math.round(s.temp / 10) * 10} K` : '–') },
    { icon: 'flame', label: 'Colour', text: (s, p) => (s.phase === 'hot' ? colour(p) : s.phase === 'cool' ? 'invisible' : '–') },
    { icon: 'pin', label: 'Mixture fraction', text: (s, p) => p.zst.toFixed(3), adv: true },
  ],
  phase: (s) => ({ setup: ['Igniting', 'med'], hot: ['Burning', ''], cool: ['Cool flame', 'cool'], out: ['Flame out', 'low'] }[s.phase]),
  status: (s, p) => (s.phase === 'setup' ? 'Igniter fires beside the burner' : s.phase === 'hot' ? (p.lit ? (p.dies ? 'Flame ball growing and cooling' : 'Flame ball settling') : 'A flash, but it does not catch')
    : s.phase === 'cool' ? 'Cool flame: invisible to the eye, drawn in violet' : p.lit ? (p.dies ? 'It cooled below what a flame can survive' : 'Gas shut off') : 'It would not light'),
  chip: (c) => `${+c.o2.toFixed(1)}% O₂ · fuel ${c.xf.toFixed(0)}%`,
  metric: { label: 'Flame temperature', unit: ' K', digits: 0, get: (p) => p.tad },
  chart: { title: 'Flame size, mm', unit: 'diameter', y: (s) => (s.hot > 0.02 || s.cool > 0.02 ? 2 * s.r : 0) },
  bars: (p) => [['Flame temperature, K', p.tad.toFixed(0), (p.tad - 1000) / 2300], ['Soot', colour(p), p.sootiness], ['Mixture fraction', p.zst.toFixed(2), p.zst]],
  tests: (data, exp) => data[exp.id] || [],
  outcome(p) {
    const c = p.c;
    const fuel = p.f.label.toLowerCase();
    const out = { happened: [], focus: 'o2' };
    const tint = p.sootiness > 0.5 ? 'It glows yellow with soot.' : p.sootiness > 0.12 ? 'It is blue with a yellow tinge of soot.' : 'It burns blue with no soot: this mix puts the flame where soot cannot form.';
    if (!p.lit) {
      out.title = 'It will not light'; out.glyph = 'check'; out.focus = 'ext';
      out.happened.push(`This mix of ${fuel} and ${+c.o2.toFixed(1)}% oxygen can only reach about ${Math.round(p.tad / 10) * 10} K. A flame needs roughly 1700 K to take hold.`);
      out.danger = 'That is a narrow escape, not a guarantee. A little more oxygen or a richer fuel crosses the line.';
      out.action = 'Suppression works the same way: dilute the air or cool the flame until it drops below this temperature.';
    } else if (p.regime === 'steady') {
      out.title = 'A steady ball of flame'; out.glyph = 'sphere';
      out.happened.push(`The flame settles ${Math.round(2 * p.final)} mm across at about ${Math.round(p.tad / 10) * 10} K and burns until the gas is shut off.`, tint);
      out.danger = c.g < 0.05 ? 'With no airflow at all this flame still does not go out. Switching the fans off is not enough to stop it.' : 'On Earth rising hot gas keeps feeding the flame, so it burns on.';
      out.action = c.o2 >= 28 ? 'At this oxygen level a still-air flame survives, so materials and suppression must be qualified for it.' : 'Find the gas flow or the oxygen level at which it dies; that boundary is what designers need.';
    } else {
      out.title = p.regime === 'cool' ? 'Out, then a cool flame' : 'It grows, cools and goes out'; out.glyph = p.regime === 'cool' ? 'cool' : 'wind'; out.focus = 'ext';
      out.happened.push(`The flame ball grows to ${Math.round(2 * p.final)} mm. By then it radiates away so much heat that it falls below 1130 K and dies after ${p.tOut.toFixed(1)} s.`, tint);
      if (p.regime === 'cool') out.happened.push(`A cool flame then carries on for about ${Math.round(p.cool)} s.`);
      out.danger = p.regime === 'cool' ? 'A fire that looks out may not be out. The cool flame is invisible, keeps making toxic gases and can flash back into a hot flame.'
        : 'The flame is gone but the gas keeps coming. Unburned fuel collects, ready to light again.';
      out.action = p.disc ? 'In still cabin air a small flame over a burning solid can put itself out. Raise the oxygen and see when that stops being true.'
        : 'After a flame disappears, keep watching gas sensors and temperature before calling it safe.';
    }
    if (p.disc) out.happened.push('The disc stands in for a burning plastic: the gas flow plays the part of the vapour a hot solid gives off.');
    if (c.g > 0) out.happened.push('Gravity above 0 g is an illustration: PSI has no partial-gravity data yet.');
    return out;
  },
  guide: {
    samples: ['How is it done?', 'What does more oxygen do?', 'Why does it go out?', 'How do you stop soot?', 'What is an inside-out flame?'],
    procedure: [
      'A small porous burner sits in the middle of a sealed chamber filled with a chosen gas mixture.',
      'Gas flows out through the burner: fuel into air for a normal flame, or oxygen into fuel gas for an inside-out one.',
      'An igniter lights it and pulls away.',
      'With no buoyancy the flame forms a ball around the burner and slowly grows.',
      'Cameras, radiometers and a glowing fibre record its size, colour and temperature until it goes out or the gas is shut off.',
    ],
    background: 'In still gas without gravity a flame is a sphere that grows slowly outward. As it grows it radiates more heat, cools, and can go out below about 1130 K: radiative extinction. Soot forms on the fuel side when the flame is hot and sits close to it; adding oxygen to the oxidiser and thinning the fuel moves the flame (raises the stoichiometric mixture fraction) and removes soot. Below about 1700 K the mixture will not light. CFI-G ran inverse flames with up to 85% oxygen; BRE used a flat disc to imitate burning solids. Values above 0 g are an illustration.',
    explain: [
      { keys: ['go out', 'goes out', 'extinct', 'die'], text: 'A flame ball in still gas keeps growing. The bigger it is, the more heat it radiates away, so it cools as it grows. Once it falls below about 1130 K the chemistry cannot keep up and it goes out, with gas still flowing.' },
      { keys: ['stop soot', 'no soot', 'clean', 'soot'], text: 'Soot forms on the fuel side of a hot flame. Thin the fuel with nitrogen and add oxygen to the other side, and the flame shifts to where soot cannot form: it burns blue even though it is just as hot. That is what Flame Design set out to show.' },
      { keys: ['inside-out', 'inside out', 'inverse'], text: 'Usually fuel flows into air. In an inside-out, or inverse, flame the oxygen flows from the burner into a chamber of fuel gas. CFI-G used this to burn with up to 85% oxygen, the richest microgravity tests in NASA\'s database.' },
    ],
    X: {
      o2: { label: 'oxygen, %', word: 'oxygen', unit: '%', range: [12, 85], keys: ['oxygen', ' o2', 'o₂', 'moon'], refs: [{ x: 21, label: 'air' }, { x: 30, label: 'Moon Base' }] },
      xf: { label: 'fuel strength, %', word: 'fuel strength', unit: '%', range: [5, 100], keys: ['fuel strength', 'thin', 'dilut', 'nitrogen'] },
      mdot: { label: 'gas flow, mg/s', word: 'gas flow', unit: ' mg/s', range: [0.3, 6], keys: ['gas flow', 'flow', 'more fuel'] },
      g: { label: 'gravity, g', word: 'gravity', unit: ' g', range: [0, 1], keys: ['gravity', 'earth', 'mars'], refs: [{ x: 0.165, label: 'Moon' }, { x: 0.38, label: 'Mars' }] },
    },
    Y: {
      temp: { label: 'flame temperature, K', word: 'flame temperature', unit: ' K', digits: 0, keys: ['temperature', 'hot', 'heat'], get: (p) => p.tad },
      size: { label: 'largest flame size, mm', word: 'flame size', unit: ' mm', digits: 0, keys: ['size', 'big', 'large', 'diameter'], get: (p) => (p.lit ? 2 * p.final : 0) },
      life: { label: 'how long it burns, s', word: 'burn time', unit: ' s', digits: 1, keys: ['how long', 'last', 'time'], get: (p) => (p.lit ? p.tOut : 0) },
      soot: { label: 'soot (0 = blue, 1 = yellow)', word: 'soot level', unit: '', digits: 2, keys: ['soot', 'yellow', 'colour', 'color'], get: (p) => p.sootiness },
    },
  },
  intro: (p) => [
    { glyph: 'station', title: 'Fire with nothing moving', dur: 6, seek: model.SETUP,
      text: 'A small porous burner sits in a sealed chamber. There is no fan and no gravity: nothing stirs the gas.' },
    { glyph: 'bolt', title: 'Light it', dur: 5, play: [model.SETUP, 0.8, 0.7],
      text: 'Gas seeps out through the burner and an igniter lights it.' },
    { glyph: 'sphere', title: 'A growing ball', dur: 7, play: [0.8, p.tOut * 0.7, Math.max(0.6, p.tOut / 9)],
      text: 'The flame wraps the burner as a sphere and slowly grows outward to find its oxygen.' },
    { glyph: 'gauge', title: 'Bigger means cooler', dur: 7, play: [p.tOut * 0.7, p.tEnd, Math.max(0.6, p.tOut / 9)],
      text: 'A larger flame radiates more heat away. Some cool until they go out; some settle and burn on.' },
    { glyph: 'rocket', title: 'Your turn',
      text: 'Change the oxygen, the fuel and the flow. Find what keeps a flame alive in still air, then see where that matters on the station.' },
  ],
  scene: createScene,
};
