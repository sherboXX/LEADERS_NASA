// Gas-jet flames: SPICE, SLICE, ACME CLD Flame and ACME E-FIELD Flames. See core/lab.js for the spec format.
import * as model from './model.js';
import { createScene } from './scene.js';

const GRAV = [{ value: 0, label: '0 g' }, { value: 0.165, label: 'Moon' }, { value: 0.38, label: 'Mars' }, { value: 1, label: 'Earth' }];
const earth = { id: 'earth', icon: 'orbit', name: 'Same flame on Earth', level: 'med', set: { g: 1 } };
const lengthLines = [{ label: 'smoke point', color: '--amber', get: (p) => Math.min(p.smokePoint, 140) }, { label: 'flame length', color: '--sky', get: (p) => p.length }];

export default {
  id: 'jet',
  data: '../../data/labs.json',
  note: 'Illustrative model, not a CFD simulation. Built from standard laminar-flame relations and the trends SPICE, SLICE and ACME reported; real flames depend on the exact burner.',
  camera: [10, 9, 58],
  stage: { maxDistance: 110, minDistance: 10 },
  defaults: { fuel: 'propylene', mdot: 1.5, nozzle: 0.8, air: 20, dilute: 0, volt: 0, g: 0 },
  reference: { g: 0, volt: 0 },
  experiments: [
    { id: 'spice', name: 'SPICE', psi: 'PSI-107', title: 'When a flame starts to smoke', subtitle: 'SPICE · the smoke point of gas flames in a gentle airflow, ISS',
      about: 'The Smoke Point In Co-flow Experiment found how long a gas flame can grow in orbit before soot escapes from its tip, for several fuels, nozzle sizes and airflows.',
      scenarios: [
        { id: 'blue', icon: 'o2', name: 'Small clean flame', level: 'low', set: { fuel: 'propane', mdot: 0.6, air: 30 } },
        { id: 'point', icon: 'gauge', name: 'Just under the smoke point', level: 'med', set: { mdot: 0.9 } },
        { id: 'smoke', icon: 'flame', name: 'Smoking flame', level: 'high', set: { mdot: 2.8, air: 10 } },
        { id: 'air', icon: 'crew', name: 'More air, less smoke', level: 'med', set: { mdot: 2.8, air: 80 } }, earth] },
    { id: 'slice', name: 'SLICE', psi: 'PSI-106', title: 'Lifting a flame off', subtitle: 'SLICE · how thinned fuel and airflow detach a flame, ISS',
      about: 'The Structure and Liftoff In Combustion Experiment thinned methane and ethylene with nitrogen and raised the airflow until the flame lifted off its nozzle and blew out.',
      defaults: { fuel: 'methane', mdot: 1.5 }, chart: { title: 'Lift-off height, mm', sweep: { x: 'dilute', lines: [{ label: 'lift-off', color: '--sky', get: (p) => (p.regime === 'blowout' ? 0 : p.lift) }] } },
      scenarios: [
        { id: 'on', icon: 'flame', name: 'Attached flame', level: 'med', set: {} },
        { id: 'thin', icon: 'flask', name: 'Fuel thinned with nitrogen', level: 'low', set: { dilute: 45 } },
        { id: 'lift', icon: 'gauge', name: 'Lifted flame', level: 'med', set: { dilute: 62, air: 30 } },
        { id: 'out', icon: 'ext', name: 'Blown out', level: 'low', set: { dilute: 68, air: 70 } }, earth] },
    { id: 'cld', name: 'CLD Flame', psi: 'PSI-21', title: 'From sooty to blue', subtitle: 'ACME CLD Flame · coflow flames from thick soot to near extinction, ISS',
      about: 'The Coflow Laminar Diffusion Flame experiment burned methane and ethylene from sooty to very dilute, to test computer models of soot and of flames close to going out.',
      defaults: { fuel: 'ethylene', mdot: 2 },
      scenarios: [
        { id: 'soot', icon: 'flame', name: 'Sooty ethylene', level: 'high', set: {} },
        { id: 'blue', icon: 'o2', name: 'Thinned until blue', level: 'low', set: { dilute: 62 } },
        { id: 'methane', icon: 'flask', name: 'Methane', level: 'low', set: { fuel: 'methane' } }, earth] },
    { id: 'efield', name: 'E-FIELD Flames', psi: 'PSI-22', title: 'Pulling on a flame', subtitle: 'ACME E-FIELD Flames · an electric field stands in for gravity, ISS',
      about: 'E-FIELD Flames put a charged mesh above the flame. The field pulls on the ions that every flame contains, which tugs the hot gas much as buoyancy would.',
      defaults: { fuel: 'methane', mdot: 1.5 }, chart: { title: 'Flame size, mm', sweep: { x: 'volt', lines: [{ label: 'width', color: '--amber', get: (p) => p.width }, { label: 'length', color: '--sky', get: (p) => p.length }] } },
      scenarios: [
        { id: 'none', icon: 'o2', name: 'No field', level: 'low', set: {} },
        { id: 'up', icon: 'gauge', name: 'Field pulls upward', level: 'med', set: { volt: 10 } },
        { id: 'down', icon: 'gauge', name: 'Field pushes down', level: 'med', set: { volt: -10 } },
        { id: 'moon', icon: 'orbit', name: 'A pull like the Moon', level: 'med', set: { volt: 3.3 } }, earth] },
  ],
  controls: [
    { key: 'fuel', label: 'Fuel', kind: 'pick', options: Object.entries(model.FUELS).map(([value, f]) => ({ value, label: f.label })) },
    { key: 'mdot', label: 'Fuel flow', kind: 'slider', min: 0.2, max: 4.4, step: 0.1, fmt: (x) => `${x.toFixed(1)} mg/s` },
    { key: 'air', label: 'Airflow', kind: 'slider', min: 0, max: 85, step: 1, fmt: (x) => `${x.toFixed(0)} cm/s` },
    { key: 'dilute', label: 'Nitrogen', kind: 'slider', min: 0, max: 70, step: 1, fmt: (x) => `${x.toFixed(0)}%` },
    { key: 'volt', label: 'Field', kind: 'slider', min: -10, max: 10, step: 0.5, fmt: (x) => `${x > 0 ? '+' : ''}${x.toFixed(1)} kV`, only: ['efield'] },
    { key: 'nozzle', label: 'Nozzle', kind: 'seg', options: [{ value: 0.4, label: '0.4 mm' }, { value: 0.8, label: '0.8' }, { value: 1.6, label: '1.6' }], adv: true },
    { key: 'g', label: 'Gravity', kind: 'seg', options: GRAV },
  ],
  model,
  readings: [
    { icon: 'flame', label: 'Flame length', text: (s) => (s.hot > 0.05 ? `${s.length.toFixed(0)} mm` : '–') },
    { icon: 'o2', label: 'Flame width', text: (s) => (s.hot > 0.05 ? `${s.width.toFixed(0)} mm` : '–') },
    { icon: 'gauge', label: 'Smoke point', text: (s, p) => (p.smokePoint > 300 ? 'none' : `${p.smokePoint.toFixed(0)} mm`) },
    { icon: 'pin', label: 'Lift-off', text: (s) => `${s.lift.toFixed(0)} mm`, adv: true },
    { icon: 'gauge', label: 'Jet speed', text: (s, p) => `${(p.jet / 100).toFixed(1)} m/s`, adv: true },
  ],
  phase: (s, p) => (s.phase === 'setup' ? ['Igniting', 'med'] : s.phase === 'out' ? ['Blown out', 'low']
    : { blue: ['Blue flame', 'low'], sooty: ['Sooty', 'med'], smoking: ['Smoking', ''], lifted: ['Lifted', 'med'], blowout: ['Lifting', 'med'] }[p.regime]),
  status: (s, p) => (s.phase === 'setup' ? 'Igniter fires at the nozzle' : s.phase === 'out' ? 'The airflow carried the flame away'
    : { blue: 'A clean blue flame', sooty: 'Yellow with soot, tip closed', smoking: 'Soot is escaping from the tip', lifted: 'Burning above the nozzle', blowout: 'The flame cannot hold on' }[p.regime]),
  chip: (c) => `${c.mdot.toFixed(1)} mg/s · air ${c.air.toFixed(0)} cm/s`,
  metric: { label: 'Flame length', unit: ' mm', digits: 0, get: (p) => p.length },
  chart: { title: 'Flame length, mm', sweep: { x: 'mdot', lines: lengthLines } },
  bars: (p) => [['Flame length, mm', p.length.toFixed(0), p.length / 100], ['Length ÷ smoke point', p.sootiness.toFixed(2), p.sootiness / 1.5], ['Push from the airflow', p.push.toFixed(2), p.push / 3]],
  tests: (data, exp) => data[exp.id] || [],
  outcome(p) {
    const c = p.c;
    const fuel = p.f.label.toLowerCase();
    const out = { happened: [], focus: 'smoke' };
    const size = `The ${fuel} flame is ${p.length.toFixed(0)} mm long and ${p.width.toFixed(0)} mm wide.`;
    if (p.regime === 'blowout') {
      out.title = 'Blown out'; out.glyph = 'wind'; out.focus = 'vent';
      out.happened.push(`With ${c.dilute}% nitrogen in the fuel the flame burns too slowly to hold against ${c.air} cm/s of air. It lifts and is carried away.`);
      out.danger = 'A weak flame can be blown out, but the fuel keeps flowing. Unburned gas then spreads through the cabin.';
      out.action = 'Stop the fuel, not only the flame. Use airflow to remove a flame only when the source is shut off.';
    } else if (p.regime === 'lifted') {
      out.title = 'The flame lifts off'; out.glyph = 'wind'; out.focus = 'vent';
      out.happened.push(`${size} It burns ${p.lift.toFixed(0)} mm above the nozzle, where the gas has slowed enough for it to hold.`);
      out.danger = 'A lifted flame is one step from blowing out or snapping back. It is the edge of stable burning.';
      out.action = 'These limits tell engineers how much airflow or dilution a small gas flame can survive.';
    } else if (p.regime === 'smoking') {
      out.title = 'The flame is smoking'; out.glyph = 'alert';
      out.happened.push(size, `That is longer than its smoke point of ${p.smokePoint.toFixed(0)} mm, so soot breaks out through the tip.`);
      out.danger = 'In orbit soot has longer to form, so flames smoke at sizes that burn clean on Earth. Soot is what smoke detectors see, and it fouls filters and electronics.';
      out.action = 'More airflow raises the smoke point. Try the airflow slider, and compare with Earth gravity.';
    } else if (p.regime === 'sooty') {
      out.title = 'Yellow, but holding its soot'; out.glyph = 'flame';
      out.happened.push(size, `It glows yellow with soot but stays under its smoke point of ${p.smokePoint.toFixed(0)} mm, so the soot burns up inside.`);
      out.danger = 'A little more fuel and this flame starts to smoke. Soot also makes a flame radiate more heat to its surroundings.';
      out.action = 'Measurements like these calibrate the soot models used to design spacecraft fire detection.';
    } else {
      out.title = 'A clean blue flame'; out.glyph = 'sphere'; out.focus = 'rack';
      out.happened.push(size, 'There is too little soot to see, so it burns blue and dim.');
      out.danger = 'Blue flames are faint. In a bright cabin a small one is easy to miss by eye and by camera.';
      out.action = 'Do not rely on seeing a flame. Use sensors for heat and combustion gases.';
    }
    if (c.volt) out.happened.push(`The ${Math.abs(c.volt)} kV field ${c.volt > 0 ? 'pulls the flame upward, as gravity would' : 'pushes the flame down and spreads it out'}.`);
    if (c.g > 0) out.happened.push('Gravity above 0 g is an illustration: PSI has no partial-gravity data yet.');
    return out;
  },
  guide: {
    samples: ['How is it done?', 'What makes it smoke?', 'What does more air do?', 'What does nitrogen do?', 'Why is Earth different?'],
    procedure: [
      'Fuel gas flows up through a thin nozzle in the middle of a small duct.',
      'A fan pushes air up the duct around the nozzle, at a chosen speed.',
      'An igniter lights the gas, then moves away.',
      'The crew or controllers change the fuel flow, the airflow or the mix, a step at a time.',
      'Cameras record the flame\'s length, shape and colour, and whether soot escapes from the tip.',
    ],
    background: 'A gas-jet flame gets longer as fuel flow rises. Past a certain length, the smoke point, soot escapes from the tip. In orbit smoke points are much shorter than on Earth because soot has longer to form; more airflow raises them. Thinning the fuel with nitrogen weakens the flame until airflow lifts it off the nozzle and blows it out. An electric field pulls on the flame\'s ions and can stand in for buoyancy. Values above 0 g are an illustration.',
    explain: [
      { keys: ['smoke point', 'makes it smoke', 'why smoke', 'soot'], text: 'Soot forms inside the flame and normally burns up before it reaches the tip. Make the flame long enough and some escapes: that length is the smoke point. In orbit soot lingers longer, so the smoke point is much shorter than on Earth.' },
      { keys: ['electric', 'field', 'voltage'], text: 'Every flame contains charged particles. A charged mesh above the flame pulls on them, and they drag the hot gas along. That tug works like buoyancy, so the field can imitate partial gravity inside the station.' },
      { keys: ['earth different', 'why is earth', 'on earth'], text: 'On Earth hot gas rises and speeds up, which stretches the flame thin and sweeps soot through it quickly. In orbit the flame is wider, slower and sootier.' },
    ],
    X: {
      mdot: { label: 'fuel flow, mg/s', word: 'fuel flow', unit: ' mg/s', range: [0.2, 4.4], keys: ['fuel flow', 'more fuel', 'flow rate'] },
      air: { label: 'airflow, cm/s', word: 'airflow', unit: ' cm/s', range: [0, 85], keys: ['airflow', 'more air', 'air flow', 'fan', 'coflow'] },
      dilute: { label: 'nitrogen in the fuel, %', word: 'nitrogen', unit: '%', range: [0, 70], keys: ['nitrogen', 'dilut', 'thin'] },
      volt: { label: 'field, kV', word: 'field', unit: ' kV', range: [-10, 10], keys: ['kv', 'volt'] },
      g: { label: 'gravity, g', word: 'gravity', unit: ' g', range: [0, 1], keys: ['gravity', 'earth', 'moon', 'mars'], refs: [{ x: 0.165, label: 'Moon' }, { x: 0.38, label: 'Mars' }] },
    },
    Y: {
      length: { label: 'flame length, mm', word: 'flame length', unit: ' mm', digits: 0, keys: ['length', 'long', 'tall', 'size'], get: (p) => p.length },
      soot: { label: 'length ÷ smoke point (1 = smoking)', word: 'smoke ratio', unit: '', digits: 2, keys: ['smok', 'soot'], get: (p) => p.sootiness },
      lift: { label: 'lift-off height, mm', word: 'lift-off height', unit: ' mm', digits: 0, keys: ['lift', 'blow', 'detach'], get: (p) => (p.regime === 'blowout' ? 0 : p.lift) },
      width: { label: 'flame width, mm', word: 'flame width', unit: ' mm', digits: 0, keys: ['width', 'wide'], get: (p) => p.width },
    },
  },
  intro: () => [
    { glyph: 'station', title: 'A candle with a dial', dur: 6, seek: model.SETUP,
      text: 'Gas flows up through a thin nozzle while a fan pushes air past it. Both can be set precisely.' },
    { glyph: 'bolt', title: 'Light the gas', dur: 5, play: [model.SETUP, 1.6, 0.7],
      text: 'An igniter lights the fuel and swings away. The flame settles within a second.' },
    { glyph: 'flame', title: 'Read the flame', dur: 7, play: [1.6, 8, 1],
      text: 'Its length, shape and colour tell the story: blue is clean, yellow is soot, and a dark streak from the tip is smoke.' },
    { glyph: 'wind', title: 'Push it to the limit', dur: 6, seek: 8,
      text: 'More fuel makes it smoke. Thinner fuel and faster air lift it off the nozzle, and then blow it out.' },
    { glyph: 'rocket', title: 'Your turn',
      text: 'Change the fuel, the flows and gravity. Find the smoke point, then see where that matters on the station.' },
  ],
  scene: createScene,
};
