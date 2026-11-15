// Flame spread over solids: BASS, BASS-II and Saffire-I/II/III. See core/lab.js for the spec format.
import * as model from './model.js';
import { createScene } from './scene.js';

const time = (s) => (s < 90 ? `${Math.round(s)} s` : `${(s / 60).toFixed(s < 600 ? 1 : 0)} min`);
const rate = (v) => v.toFixed(v < 1 ? 2 : 1);
const GRAV = [{ value: 0, label: '0 g' }, { value: 0.165, label: 'Moon' }, { value: 0.38, label: 'Mars' }, { value: 1, label: 'Earth' }];

const scenes = (extra = []) => [
  { id: 'cabin', icon: 'flame', name: 'Cabin air, gentle breeze', level: 'high', set: {} },
  { id: 'off', icon: 'gauge', name: 'Fans switched off', level: 'low', set: { v: 0 } },
  { id: 'moon', icon: 'o2', name: 'Moon Base air', level: 'high', set: { o2: 30, p: 10.2 } },
  { id: 'nomex', icon: 'crew', name: 'Fire-resistant Nomex', level: 'med', set: { material: 'nomex' } },
  { id: 'nomex30', icon: 'o2', name: 'Nomex at 30% oxygen', level: 'high', set: { material: 'nomex', o2: 30, p: 10.2 } },
  ...extra,
  { id: 'earth', icon: 'orbit', name: 'Same sheet on Earth', level: 'med', set: { g: 1, dir: 'with' } },
];
const big = { camera: [80, 14, 270], stage: { far: 1600, maxDistance: 700, minDistance: 40 } };

export default {
  id: 'solid',
  data: '../../data/labs.json',
  note: 'Illustrative model, not a CFD simulation. Tuned to the Saffire-II results (PSI-99) and published flammability trends; real values depend on the exact sample and hardware.',
  camera: [10, 2, 36],
  defaults: { material: 'cotton', thick: 0.37, o2: 21, p: 14.7, v: 10, dir: 'with', g: 0 },
  reference: { o2: 21, p: 14.7, g: 0 },
  experiments: [
    { id: 'bass', name: 'BASS', psi: 'PSI-26', title: 'Burning solids', subtitle: 'BASS · small samples in the Microgravity Science Glovebox, ISS',
      about: 'Burning and Suppression of Solids burned small fabric and plastic samples in a fan-driven flow duct to see how airflow feeds or starves a flame.',
      defaults: { dir: 'against' }, scenarios: scenes() },
    { id: 'bass2', name: 'BASS-II', psi: 'PSI-25', title: 'Finding the limit', subtitle: 'BASS-II · how little oxygen a flame can live on, ISS',
      about: 'BASS-II lowered the oxygen step by step (13.6 to 22.2%) to find where flames on acrylic and fabric go out.',
      defaults: { dir: 'against', o2: 19 },
      scenarios: scenes([{ id: 'limit', icon: 'gauge', name: 'Close to the limit', level: 'med', set: { o2: 16.5 } }, { id: 'film', icon: 'flask', name: 'Thin acrylic film', level: 'high', set: { material: 'pmma', thick: 0.2 } }]) },
    { id: 'saffire1', name: 'Saffire-I', psi: 'PSI-98', title: 'A fire the size of a person', subtitle: 'Saffire-I · a 94 cm fabric sheet burned in a Cygnus cargo ship',
      about: 'Saffire-I was the first large fire lit on purpose in space: a 40 by 94 cm cotton-fibreglass sheet burned in an empty Cygnus after it left the station.',
      defaults: { v: 20 }, scenarios: scenes([{ id: 'against', icon: 'gauge', name: 'Lit from the far end', level: 'med', set: { dir: 'against' } }]), ...big },
    { id: 'saffire2', name: 'Saffire-II', psi: 'PSI-99', title: 'Nine materials', subtitle: 'Saffire-II · nine strips of real spacecraft materials, Cygnus',
      about: 'Saffire-II burned nine 5 by 29 cm samples (silicone, cotton-fibreglass, acrylic, Nomex) to compare each one in orbit with the same test on Earth.',
      defaults: { v: 20, o2: 22 }, camera: [26, 5, 88], stage: { far: 700, maxDistance: 260, minDistance: 14 },
      scenarios: scenes([{ id: 'sil', icon: 'flask', name: 'Silicone strip', level: 'low', set: { material: 'silicone', thick: 0.27 } }, { id: 'slab', icon: 'clock', name: 'Thick acrylic slab', level: 'med', set: { material: 'pmma', thick: 10 } }]) },
    { id: 'saffire3', name: 'Saffire-III', psi: 'PSI-100', title: 'The big sheet, faster air', subtitle: 'Saffire-III · the large sheet again at a higher airflow, Cygnus',
      about: 'Saffire-III repeated the large-sheet burn of Saffire-I with faster airflow to see how the flame responds.',
      defaults: { v: 25 }, scenarios: scenes([{ id: 'against', icon: 'gauge', name: 'Lit from the far end', level: 'med', set: { dir: 'against' } }]), ...big },
  ],
  controls: [
    { key: 'material', label: 'Material', kind: 'seg', options: [{ value: 'cotton', label: 'Cotton' }, { value: 'pmma', label: 'Acrylic' }, { value: 'silicone', label: 'Silicone' }, { value: 'nomex', label: 'Nomex' }] },
    { key: 'thick', label: 'Thickness', kind: 'slider', min: 0.1, max: 10, step: 0.01, fmt: (x) => `${x.toFixed(2)} mm`, adv: true },
    { key: 'o2', label: 'Oxygen', kind: 'slider', min: 12, max: 40, step: 0.5, fmt: (x) => `${+x.toFixed(1)}%` },
    { key: 'p', label: 'Pressure', kind: 'slider', min: 8, max: 15, step: 0.1, fmt: (x) => `${x.toFixed(1)} psia`, adv: true },
    { key: 'v', label: 'Airflow', kind: 'slider', min: 0, max: 40, step: 0.5, fmt: (x) => `${+x.toFixed(1)} cm/s` },
    { key: 'dir', label: 'Flame goes', kind: 'seg', options: [{ value: 'with', label: 'With the air' }, { value: 'against', label: 'Against it' }] },
    { key: 'g', label: 'Gravity', kind: 'seg', options: GRAV },
  ],
  model,
  readings: [
    { icon: 'clock', label: 'Time', text: (s, p) => `${Math.max(s.t, 0).toFixed(0)} / ${p.tEnd.toFixed(0)} s` },
    { icon: 'gauge', label: 'Spread rate', text: (s, p) => (s.phase === 'burn' && p.rate ? `${rate(p.rate)} mm/s` : '–') },
    { icon: 'flame', label: 'Flame length', text: (s) => (s.hot > 0.05 ? `${s.flame.toFixed(0)} mm` : '–') },
    { icon: 'pin', label: 'Burned', text: (s) => `${Math.round(s.burned * 100)}%` },
    { icon: 'o2', label: 'Oxygen limit', text: (s, p) => `${p.limit.toFixed(1)}%`, adv: true },
  ],
  phase: (s) => (s.phase === 'setup' ? ['Igniting', 'med'] : s.phase === 'burn' ? ['Burning', ''] : ['Flame out', 'low']),
  status: (s, p) => (s.phase === 'setup' ? 'Igniter wire heats the edge of the sample' : s.phase === 'burn' ? (p.rate ? 'Flame spreading along the sample' : 'Lit, but it cannot keep going') : p.rate ? 'The whole sample has burned' : 'The flame went out by itself'),
  chip: (c) => `${c.p.toFixed(1)} psia · ${+c.o2.toFixed(1)}% O₂ · ${+c.v.toFixed(1)} cm/s`,
  metric: { label: 'Spread rate', unit: ' mm/s', digits: 2, get: (p) => p.rate },
  chart: { title: 'Spread rate, mm/s', sweep: { x: 'o2', lines: [
    { label: 'on Earth', color: '--muted', over: { g: 1, dir: 'with' }, get: (p) => p.rate },
    { label: 'your settings', color: '--sky', get: (p) => p.rate }] } },
  bars: (p) => [['Spread rate, mm/s', rate(p.rate), p.rate / 6], ['Flame length, mm', p.flame.toFixed(0), p.flame / (0.5 * p.len)],
    ['Oxygen to spare, %', p.margin > 0 ? p.margin.toFixed(1) : '0', p.margin / 14]],
  tests: (data, exp) => data[exp.id] || [],
  outcome(p) {
    const c = p.c;
    const what = p.m.label.toLowerCase();
    const air = c.v < 0.5 ? 'still air' : `${+c.v.toFixed(1)} cm/s of airflow`;
    const out = { happened: [], focus: 'quarters' };
    if (p.rate > 0) {
      out.title = p.regime === 'fast' ? 'The flame races along' : 'The flame spreads steadily';
      out.glyph = 'flame';
      out.happened.push(`The ${what} burns ${c.dir === 'with' ? 'with' : 'against'} the airflow at ${rate(p.rate)} mm/s, so the ${Math.round(p.len / 10)} cm sample is gone in about ${time(p.tEnd)}.`,
        `In ${air} it would keep burning down to ${p.limit.toFixed(1)}% oxygen.`);
      out.danger = c.g < 0.05 ? 'In orbit a flame like this does not flicker out. It creeps along at a steady pace for as long as the fans keep feeding it air.'
        : 'On Earth rising hot gas drags the flame upward, faster and faster.';
      out.action = c.g < 0.05 ? 'Stop the airflow first: without ventilation the flame is starved of oxygen. Try 0 cm/s here.'
        : 'Compare with 0 g. The same material behaves differently in orbit, so ground tests alone are not enough.';
      if (c.o2 >= 29.5) { out.danger += ' At Moon Base oxygen levels even materials rated fire-resistant on Earth can burn.'; out.focus = 'o2'; }
    } else if (p.regime === 'quench') {
      out.title = 'Starved of air';
      out.glyph = 'wind';
      out.happened.push(`With only ${air}, too little oxygen reaches the flame and it goes out once the igniter is off.`);
      out.danger = 'It is not safe yet. The material is still hot, and the flame comes back as soon as air moves again.';
      out.action = 'This is why the first response to a fire on the station is to switch ventilation off, and why it stays off until the area has cooled.';
      out.focus = 'vent';
    } else {
      out.title = p.regime === 'blowoff' ? 'Blown off by the airflow' : 'It will not stay alight';
      out.glyph = 'check';
      out.happened.push(`At ${+c.o2.toFixed(1)}% oxygen the ${what} goes out when the igniter stops. In ${air} it needs at least ${p.limit.toFixed(1)}%.`);
      out.danger = p.limit <= 34 ? `That margin is thin. A habitat at 30 to 34% oxygen would be ${p.limit <= 30 ? 'above' : 'close to'} this limit, and the same material would burn.`
        : 'This material has a wide safety margin, even in oxygen-rich habitats.';
      out.action = 'Qualify materials at the highest oxygen level the habitat will use, not at the 21% of today\'s station.';
      out.focus = 'o2';
    }
    if (c.g > 0) out.happened.push('Gravity above 0 g is an illustration: PSI has no partial-gravity data yet.');
    return out;
  },
  guide: {
    samples: ['How is it done?', 'What does more oxygen do?', 'What if the fans stop?', 'Is Nomex safe on the Moon?', 'Why is Earth different?'],
    procedure: [
      'A strip of material is held upright in a small wind tunnel (a flow duct).',
      'A fan pushes air past it at a chosen speed, from a few millimetres to tens of centimetres per second.',
      'A hot wire lights one edge, then switches off.',
      'Cameras follow the flame front as it moves along the sample; sensors record oxygen and temperature.',
      'The test is repeated with other materials, airflows and oxygen levels to map where the flame lives and dies.',
    ],
    background: 'Without gravity hot gas does not rise, so a flame gets fresh oxygen only from forced airflow. Flames spread fastest at gentle flows near 10 cm/s, die when the flow stops, and can blow off in strong head-on flow. More oxygen makes every material easier to burn. Saffire-II found cotton-fibreglass spreading at about 2 mm/s in orbit while silicone and Nomex did not burn at 22% oxygen. Values above 0 g are an illustration.',
    explain: [
      { keys: ['nomex'], text: 'Nomex is a fire-resistant fabric: in cabin air it goes out by itself. At about 30% oxygen, the level planned for the Moon Base, the model has it burning. Try the "Nomex at 30% oxygen" scenario.' },
      { keys: ['fans stop', 'fan off', 'fans off', 'ventilation off', 'no airflow', 'still air'], text: 'In orbit a flame gets oxygen only from moving air. Stop the fans and it starves within seconds, which is why switching ventilation off is the first step in the station\'s fire response. Set Airflow to 0 to see it.' },
      { keys: ['earth different', 'why is earth', 'on earth'], text: 'On Earth hot gas rises and pulls fresh air in, so a flame feeds itself and races upward. In orbit there is no "up": the flame depends on the fans and spreads at a slow, steady pace.' },
    ],
    X: {
      o2: { label: 'oxygen, %', word: 'oxygen', unit: '%', range: [14, 38], keys: ['oxygen', ' o2', 'o₂', 'moon'], refs: [{ x: 21, label: 'ISS' }, { x: 30, label: 'Moon Base' }] },
      v: { label: 'airflow, cm/s', word: 'airflow', unit: ' cm/s', range: [0, 40], keys: ['airflow', 'air flow', 'fan', 'breeze', 'wind', 'ventilation', 'flow'] },
      thick: { label: 'thickness, mm', word: 'thickness', unit: ' mm', range: [0.1, 5], keys: ['thick', 'thin'] },
      p: { label: 'pressure, psia', word: 'pressure', unit: ' psia', range: [8, 15], keys: ['pressure', 'psi'] },
      g: { label: 'gravity, g', word: 'gravity', unit: ' g', range: [0, 1], keys: ['gravity', 'earth', 'mars'], refs: [{ x: 0.165, label: 'Moon' }, { x: 0.38, label: 'Mars' }] },
    },
    Y: {
      rate: { label: 'spread rate, mm/s', word: 'spread rate', unit: ' mm/s', digits: 2, keys: ['fast', 'spread', 'rate', 'speed'], get: (p) => p.rate },
      limit: { label: 'lowest oxygen that burns, %', word: 'oxygen limit', unit: '%', digits: 1, keys: ['limit', 'safe', 'go out', 'put out', 'stop'], get: (p) => p.limit },
      flame: { label: 'flame length, mm', word: 'flame length', unit: ' mm', digits: 0, keys: ['flame length', 'how long is the flame', 'how big'], get: (p) => p.flame },
    },
  },
  intro: (p) => [
    { glyph: 'station', title: 'A wind tunnel in orbit', dur: 6, seek: model.SETUP,
      text: 'A strip of material stands in a small duct. A fan pushes air past it, slowly, the way cabin ventilation does.' },
    { glyph: 'bolt', title: 'Light one edge', dur: 5, play: [model.SETUP, 0.8, 0.7],
      text: 'A hot wire touches the edge of the sample, then switches off.' },
    { glyph: 'flame', title: 'Watch the flame travel', dur: 7, play: [0.8, p.tEnd * 0.45, Math.max(1, p.tEnd / 14)],
      text: 'With no "up", the flame does not leap. It creeps along at a steady pace and leaves char behind.' },
    { glyph: 'wind', title: 'The air decides', dur: 6, play: [p.tEnd * 0.45, p.tEnd * 0.8, Math.max(1, p.tEnd / 14)],
      text: 'The flame lives on the air the fan brings. More air, more oxygen: it spreads. No air: it starves.' },
    { glyph: 'rocket', title: 'Your turn',
      text: 'Change the material, the oxygen and the airflow. Find where the flame stops, then see where that matters on the station.' },
  ],
  scene: createScene,
};
