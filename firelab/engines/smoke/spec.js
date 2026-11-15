// Smoke and smoke detectors: SAME, SAME-R, DAFT and DAFT-2. See core/lab.js for the spec format.
import * as model from './model.js';
import { createScene } from './scene.js';

const GRAV = [{ value: 0, label: '0 g' }, { value: 0.165, label: 'Moon' }, { value: 0.38, label: 'Mars' }, { value: 1, label: 'Earth' }];
const pct = (x) => `${Math.round(x)}%`;
const SMOKE = [{ value: 'cellulose', label: 'Wick' }, { value: 'silicone', label: 'Silicone' }, { value: 'kapton', label: 'Kapton' }, { value: 'teflon', label: 'Teflon' }];
const same = [
  { id: 'wick', icon: 'flame', name: 'Smouldering lamp wick', level: 'high', set: {} },
  { id: 'teflon', icon: 'gauge', name: 'Overheated Teflon wire', level: 'high', set: { material: 'teflon', heat: 620 } },
  { id: 'kapton', icon: 'flask', name: 'Kapton film', level: 'med', set: { material: 'kapton', heat: 680 } },
  { id: 'off', icon: 'crew', name: 'Fans switched off', level: 'high', set: { v: 0 } },
  { id: 'aged', icon: 'clock', name: 'Smoke left to age', level: 'med', set: { material: 'teflon', heat: 620, age: 560 } },
  { id: 'earth', icon: 'orbit', name: 'Same smoke on Earth', level: 'low', set: { v: 0, g: 1 } },
];
const daft = [
  { id: 'dust', icon: 'pin', name: 'Cabin dust', level: 'med', set: {} },
  { id: 'wick', icon: 'flame', name: 'Lamp wick smoke', level: 'high', set: { material: 'cellulose', heat: 420 } },
  { id: 'off', icon: 'crew', name: 'No airflow', level: 'high', set: { material: 'cellulose', heat: 420, v: 0 } },
];
const lines = [{ label: 'light scattering', color: '--amber', get: (p) => p.scatter }, { label: 'ionisation', color: '--sky', get: (p) => p.ion }];

export default {
  id: 'smoke',
  go: 'Heat',
  t0: model.SETUP,
  note: 'Illustrative model, not a measurement. Particle sizes and detector responses follow the trends reported by SAME; exact values depend on the sample and hardware.',
  camera: [16, 18, 128],
  stage: { far: 900, maxDistance: 340, minDistance: 40 },
  defaults: { material: 'cellulose', heat: 420, v: 10, age: 0, g: 0 },
  reference: { v: 10, age: 0, g: 0 },
  experiments: [
    { id: 'same', name: 'SAME', psi: 'PSI-102', title: 'Smoke in orbit', subtitle: 'SAME · what smoke from overheated spacecraft materials looks like to a detector, ISS',
      about: 'The Smoke Aerosol Measurement Experiment overheated Teflon, Kapton, silicone and lamp wick and measured the smoke particles, to learn what a spacecraft smoke detector must be able to see.',
      scenarios: same, chart: { title: 'Detector signal, % (alarm at 30)', sweep: { x: 'age', lines } } },
    { id: 'samer', name: 'SAME-R', psi: 'PSI-101', title: 'Smoke, measured again', subtitle: 'SAME-R · the reflight with better particle sizing, ISS',
      about: 'SAME-R repeated the smoke measurements with improved instruments and added sampling of the particles for microscopes on the ground.',
      scenarios: same, chart: { title: 'Detector signal, % (alarm at 30)', sweep: { x: 'age', lines } } },
    { id: 'daft', name: 'DAFT', psi: 'PSI-47', title: 'Counting dust', subtitle: 'DAFT · testing the particle counter on station air, ISS',
      about: 'The Dust and Aerosol Measurement Feasibility Test checked that a commercial particle counter and a dust monitor work in orbit, using the station\'s own air and dust.',
      defaults: { material: 'dust' }, scenarios: daft },
    { id: 'daft2', name: 'DAFT-2', psi: 'PSI-47', title: 'Counting dust, again', subtitle: 'DAFT-2 · the follow-up instrument check, ISS',
      about: 'DAFT-2 continued the instrument tests of DAFT so the same counters could later measure smoke in SAME.',
      defaults: { material: 'dust' }, scenarios: daft },
  ],
  controls: [
    { key: 'material', label: 'Material', kind: 'seg', options: SMOKE, only: ['same', 'samer'] },
    { key: 'material', label: 'Source', kind: 'seg', options: [{ value: 'dust', label: 'Cabin dust' }, { value: 'cellulose', label: 'Wick smoke' }], only: ['daft', 'daft2'] },
    { key: 'heat', label: 'Heated to', kind: 'slider', min: 150, max: 700, step: 10, fmt: (x) => `${x.toFixed(0)} °C` },
    { key: 'v', label: 'Airflow', kind: 'slider', min: 0, max: 30, step: 0.5, fmt: (x) => `${+x.toFixed(1)} cm/s` },
    { key: 'age', label: 'Ageing', kind: 'slider', min: 0, max: 600, step: 10, fmt: (x) => `${x.toFixed(0)} s`, adv: true },
    { key: 'g', label: 'Gravity', kind: 'seg', options: GRAV },
  ],
  model,
  readings: [
    { icon: 'clock', label: 'Time', text: (s, p) => `${Math.max(s.t, 0).toFixed(0)} / ${p.tEnd.toFixed(0)} s` },
    { icon: 'o2', label: 'Particle size', text: (s, p) => (s.emit > 0.02 ? `${p.d.toFixed(0)} nm` : '–') },
    { icon: 'gauge', label: 'Ionisation', text: (s) => pct(s.ion) },
    { icon: 'gauge', label: 'Light scattering', text: (s) => pct(s.scatter) },
    { icon: 'pin', label: 'Particle count', text: (s, p) => (s.here > 0.05 ? `${(p.count * s.here).toExponential(1)} /cm³` : '–'), adv: true },
    { icon: 'pin', label: 'Mass', text: (s, p) => (s.here > 0.05 ? `${(p.mass * s.here).toFixed(2)} mg/m³` : '–'), adv: true },
  ],
  phase: (s) => (s.phase === 'setup' ? ['Heating', 'med'] : s.ionAlarm || s.scatterAlarm ? ['Alarm', ''] : s.emit > 0.02 ? ['Smoking', 'med'] : ['Clear', 'low']),
  status: (s, p) => (s.phase === 'setup' ? 'Heater switching on' : s.emit < 0.02 ? (p.drive > 0 ? 'Warming up' : 'Too cool to smoke') : s.here < 0.05 ? (p.arrives ? 'Smoke drifting toward the detectors' : 'Smoke stays where it is made')
    : s.ionAlarm && s.scatterAlarm ? 'Both detectors alarm' : s.ionAlarm ? 'Only the ionisation detector alarms' : s.scatterAlarm ? 'Only the light-scattering detector alarms' : 'Smoke at the detectors, no alarm'),
  chip: (c) => `${+c.v.toFixed(1)} cm/s · ${c.g === 0 ? '0 g' : `${c.g} g`}`,
  metric: { label: 'Particle size', unit: ' nm', digits: 0, get: (p) => p.d },
  chart: { title: 'Detector signal, % (alarm at 30)', sweep: { x: 'v', lines } },
  bars: (p) => [['Ionisation signal, %', p.ion.toFixed(0), p.ion / 100], ['Light scattering, %', p.scatter.toFixed(0), p.scatter / 100], ['Particle size, nm', p.d.toFixed(0), p.d / 600]],
  outcome(p) {
    const c = p.c;
    const what = p.m.label.toLowerCase();
    const reach = p.arrives ? `It reaches the detectors about ${Math.round(p.arrive)} s after heating starts.` : '';
    const size = `The particles are about ${p.d.toFixed(0)} nm across.`;
    const out = { happened: [], focus: 'smoke' };
    if (p.regime === 'none') {
      out.title = 'Hot, but no smoke yet'; out.glyph = 'check';
      out.happened.push(`At ${c.heat} °C the ${what} is not hot enough to smoke. It starts near ${p.m.on} °C.`);
      out.danger = 'Overheating can go on for a long time before any smoke appears, so smoke detectors cannot be the only warning.';
      out.action = 'Add temperature and gas sensing close to likely hot spots.';
    } else if (p.regime === 'stuck') {
      out.title = 'The smoke goes nowhere'; out.glyph = 'wind'; out.focus = 'vent';
      out.happened.push('The material is smoking, but with no airflow and no gravity the smoke stays in a ball around it. Neither detector sees anything.');
      out.danger = 'A fire can grow while the detectors stay silent. On Earth the same smoke would rise to the ceiling in seconds.';
      out.action = 'Keep air moving toward the detectors, and put detectors next to likely ignition sources, not only in return ducts.';
    } else if (p.regime === 'both') {
      out.title = 'Both detectors alarm'; out.glyph = 'alert';
      out.happened.push(size, reach);
      out.danger = 'This smoke is easy to detect, but only once it has travelled: the alarm comes that many seconds after the overheating began.';
      out.action = 'Shorten the path from likely sources to a detector, and keep the airflow toward it.';
    } else if (p.regime === 'ion') {
      out.title = 'Only one detector notices'; out.glyph = 'alert';
      out.happened.push(`${size} That is too small to scatter much light, so only the ionisation detector alarms.`, reach);
      out.danger = 'A light-scattering detector, the kind used on the station, would miss this smoke.';
      out.action = 'Use both sensing methods, or let the smoke age: larger particles scatter far more light.';
    } else if (p.regime === 'scatter') {
      out.title = 'Only one detector notices'; out.glyph = 'alert';
      out.happened.push(`${size} There are few of them, so the ionisation detector stays quiet while the light-scattering one alarms.`, reach);
      out.danger = p.dusty ? 'Ordinary cabin dust looks like smoke to a light-scattering detector. That means false alarms, and crews who stop trusting them.'
        : 'An ionisation detector, the kind flown on the Shuttle, would miss this smoke.';
      out.action = p.dusty ? 'Filter large particles out before the sensor, and confirm an alarm with a second measurement.' : 'Use both sensing methods so one covers what the other misses.';
    } else {
      out.title = 'Too little smoke to alarm'; out.glyph = 'search';
      out.happened.push(`${size} Smoke reaches the detectors, but neither signal passes the alarm level.`, reach);
      out.danger = 'A slow, smouldering source can sit below the alarm level for a long time.';
      out.action = 'Pair smoke detection with gas sensors for carbon monoxide and acid gases.';
    }
    if (c.g > 0) out.happened.push('Gravity above 0 g is an illustration: PSI has no partial-gravity data yet.');
    return out;
  },
  guide: {
    samples: ['How is it done?', 'What if the fans stop?', 'What does ageing do?', 'Why two detectors?', 'Why is Earth different?'],
    procedure: [
      'A small sample of spacecraft material is wrapped in a heater wire inside a closed duct.',
      'The heater warms it until it smoulders and gives off smoke, without a flame.',
      'A fan carries the smoke along the duct; some tests hold it in a chamber first so it can age.',
      'Instruments count the particles, weigh them and measure their size.',
      'Two smoke detectors, one ionisation and one light-scattering, record how strongly each responds.',
    ],
    background: 'Smoke particles from overheated spacecraft materials are a few tens to a few hundred nanometres across, and each material makes its own size. Ionisation detectors respond to many small particles; light-scattering detectors respond to fewer, larger ones. Particles grow as smoke ages or lingers in slow flow. Without gravity smoke does not rise, so it only reaches a detector if ventilation carries it there. DAFT tested the particle counter and dust monitor on cabin air before SAME used them. Values above 0 g are an illustration.',
    explain: [
      { keys: ['two detectors', 'why two', 'which detector', 'ionisation', 'ionization', 'scatter'], text: 'An ionisation detector counts how many particles interrupt a tiny electric current, so it is good at lots of very small particles. A light-scattering detector watches for light bounced off particles, which large ones do far better. Fresh Teflon smoke is tiny, so only the first notices; aged or dusty air trips only the second.' },
      { keys: ['fans stop', 'fan off', 'fans off', 'no airflow', 'still air', 'ventilation off'], text: 'On Earth hot smoke rises to a ceiling detector by itself. In orbit nothing rises: with the fans off the smoke stays in a ball around its source and no detector sees it. Set Airflow to 0 to watch.' },
      { keys: ['earth different', 'why is earth', 'on earth'], text: 'On Earth buoyancy lifts smoke to the ceiling within seconds, which is why detectors sit there. In orbit there is no ceiling in that sense: smoke goes only where the ventilation pushes it.' },
    ],
    X: {
      v: { label: 'airflow, cm/s', word: 'airflow', unit: ' cm/s', range: [0, 30], keys: ['airflow', 'air flow', 'fan', 'ventilation', 'flow'] },
      age: { label: 'ageing time, s', word: 'ageing time', unit: ' s', range: [0, 600], keys: ['age', 'ageing', 'aging', 'older', 'time'] },
      heat: { label: 'temperature, °C', word: 'temperature', unit: ' °C', range: [200, 700], keys: ['heat', 'hot', 'temperature', 'warm'] },
      g: { label: 'gravity, g', word: 'gravity', unit: ' g', range: [0, 1], keys: ['gravity', 'earth', 'moon', 'mars'], refs: [{ x: 0.165, label: 'Moon' }, { x: 0.38, label: 'Mars' }] },
    },
    Y: {
      scatter: { label: 'light-scattering signal, %', word: 'light-scattering signal', unit: '%', digits: 0, keys: ['scatter', 'photo', 'light'], get: (p) => p.scatter },
      ion: { label: 'ionisation signal, %', word: 'ionisation signal', unit: '%', digits: 0, keys: ['ionis', 'ioniz'], get: (p) => p.ion },
      d: { label: 'particle size, nm', word: 'particle size', unit: ' nm', digits: 0, keys: ['size', 'big', 'small', 'diameter'], get: (p) => p.d },
      wait: { label: 'time for smoke to arrive, s', word: 'arrival time', unit: ' s', digits: 0, keys: ['how long', 'arrive', 'reach', 'delay'], get: (p) => Math.min(p.arrive, 120) },
    },
  },
  intro: (p) => [
    { glyph: 'station', title: 'A fire starts as smoke', dur: 6, seek: model.SETUP,
      text: 'Most spacecraft fires begin with something overheating, long before any flame. The first warning is smoke.' },
    { glyph: 'bolt', title: 'Overheat a sample', dur: 6, play: [model.SETUP, p.start + 3, 1],
      text: 'A heater wire warms a piece of real spacecraft material until it starts to smoke.' },
    { glyph: 'wind', title: 'The smoke has to travel', dur: 7, play: [p.start + 3, Math.min(p.arrive, p.tEnd - 4), Math.max(1, p.tEnd / 16)],
      text: 'Nothing rises in orbit. The smoke only moves if the fans carry it down the duct.' },
    { glyph: 'alert', title: 'Two detectors, two answers', dur: 7, play: [Math.min(p.arrive, p.tEnd - 4), p.tEnd, Math.max(1, p.tEnd / 16)],
      text: 'One detector counts small particles, the other watches for light scattered by large ones. They do not always agree.' },
    { glyph: 'rocket', title: 'Your turn',
      text: 'Change the material, the heat and the airflow. Find the smoke a detector misses, then see where that matters on the station.' },
  ],
  scene: createScene,
};
