// The guide on the start screen. It answers general questions about fire in space and points
// to the experiments that fit. With an AI connection (an OpenAI key in Settings, or the local
// serve.py proxy) ChatGPT words the answer; otherwise the built-in answers below are used.
// Either way the links it offers come from the catalogue, never from the AI's own memory,
// and it does not quote measurements: the labs compute those from NASA data.
import { CATALOG, PILLARS } from '../catalog.js';
import { el } from './ui.js';
import { ic } from './icons.js';

const byId = Object.fromEntries(CATALOG.map((x) => [x.id, x]));

const TOPICS = [
  { words: ['why', 'different', 'gravity', 'microgravity', 'weightless', 'ball', 'sphere', 'round', 'shape', 'candle', 'teardrop', 'float', 'look'],
    answer: 'On Earth, hot gas rises and pulls fresh air in from below, so a flame stretches into a flickering teardrop. In orbit nothing rises: oxygen only drifts in slowly, so the flame becomes a dim, round ball. That changes how fires start, spread and go out.',
    ids: ['flex', 'sflame', 'cfi'] },
  { words: ['smoke', 'detector', 'detect', 'alarm', 'sensor', 'particle', 'dust', 'smell'],
    answer: 'Smoke behaves differently too. With no rising air it does not drift up to a detector by itself, and its particles can be a different size than on Earth. The smoke experiments test which kind of detector still notices it.',
    ids: ['same', 'samer', 'daft'] },
  { words: ['put out', 'extinguish', 'suppress', 'co2', 'carbon dioxide', 'helium', 'water', 'stop', 'kill'],
    answer: 'FLEX tested how gases such as carbon dioxide put out burning fuel droplets in orbit. It also found flames that look out but keep burning as invisible "cool flames", so a fire is not over just because you cannot see it.',
    ids: ['flex', 'flex2', 'cfi'] },
  { words: ['material', 'fabric', 'cloth', 'plastic', 'spread', 'cotton', 'nomex', 'silicone', 'cargo', 'sheet', 'flammab'],
    answer: 'Saffire lit large fabric and plastic samples on purpose inside empty cargo ships to see how fast fire spreads over real spacecraft materials. BASS tested how little oxygen a flame on those materials can live on.',
    ids: ['saffire1', 'saffire2', 'bass2'] },
  { words: ['oxygen', 'air', 'moon', 'mars', 'habitat', 'pressure', 'atmosphere'],
    answer: 'More oxygen makes almost everything easier to light and faster to burn. Moon and Mars habitats plan richer air at lower pressure, so the experiments on oxygen limits matter for them.',
    ids: ['bass2', 'flamedesign', 'bre'] },
  { words: ['soot', 'jet', 'gas leak', 'leak', 'electric', 'field'],
    answer: 'The gas-jet flames show how a leaking fuel line would burn in orbit: how long the flame gets, when it starts to smoke, and when air flow blows it out.',
    ids: ['spice', 'slice', 'efield'] },
  { words: ['safe', 'safety', 'crew', 'astronaut', 'danger', 'risk', 'protect'],
    answer: 'Spacecraft fire safety has three parts: prevention (materials that do not burn easily), detection (noticing smoke early) and suppression (putting the fire out). The experiments are ranked by how much each matters for keeping a crew safe.',
    ids: ['saffire1', 'same', 'flex'] },
  { words: ['what is freefall', 'what can i do', 'help', 'how does this work', 'how do i', 'start', 'freefall', 'website', 'this site'],
    answer: 'Freefall lets you run twenty NASA fire experiments from the Space Station yourself. Choose Experiments to light a flame and change the air, or Application to see where each result keeps the crew safe on the ISS.',
    ids: ['flex', 'saffire2', 'same'] },
];

// Experiment names a visitor might type. Short all-capital names are matched only in capitals,
// so the word "same" in a sentence does not open SAME.
const NAMES = CATALOG.map((x) => {
  const exact = /^[A-Z]{3,5}$/.test(x.name);
  const source = x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { x, re: new RegExp(`(^|[^A-Za-z0-9])${source}(?![A-Za-z0-9])`, exact ? '' : 'i') };
}).sort((a, b) => b.x.name.length - a.x.name.length);

const mentions = (q, word) => (word.includes(' ') ? q.includes(word) : new RegExp(`\\b${word}`).test(q));

export function homeGuide() {
  const links = el('div', { class: 'home-links' });

  const system = () => [
    'You are the guide on the start page of Freefall, a website where students and engineers run twenty NASA microgravity fire experiments from the International Space Station, rebuilt as interactive labs.',
    'Answer in plain language a student understands, in two to four short sentences. Do not invent measurements or numbers; when numbers are wanted, point to the experiment whose lab computes them from NASA data.',
    'The experiments (id: name, NASA PSI number, fire-safety pillar, what it is):',
    ...CATALOG.map((x) => `${x.id}: ${x.name}, ${x.psi}, ${PILLARS[x.pillar]}, ${x.line}`),
    'Reply with one JSON object: {"answer": string, "open": an array of up to three experiment ids from the list above that fit the question, or an empty array}.',
  ].join('\n');

  function local(question) {
    const named = NAMES.find((n) => n.re.test(question));
    if (named) {
      const { x } = named;
      return { answer: `${x.name} (${x.psi}): ${x.line} It is one of the ${PILLARS[x.pillar].toLowerCase()} experiments. Open it to run it yourself.`, open: [x.id] };
    }
    const q = question.toLowerCase();
    let best = null;
    let score = 0;
    for (const t of TOPICS) {
      const s = t.words.filter((w) => mentions(q, w)).length;
      if (s > score) { best = t; score = s; }
    }
    if (best) return { answer: best.answer, open: best.ids };
    return { answer: 'I can help with fire in space: why flames turn into balls, how smoke is detected, how fires are put out, and which materials burn. Ask about one of those, or choose Experiments to try the labs.', open: ['saffire1', 'same', 'flex'] };
  }

  function act(reply) {
    const ids = (Array.isArray(reply.open) ? reply.open : []).filter((id) => byId[id]).slice(0, 3);
    links.replaceChildren(...ids.map((id) => {
      const x = byId[id];
      return el('a', { href: x.url }, ic(x.glyph), el('span', { text: x.name }), el('small', { text: x.psi }));
    }));
  }

  return { links, system, local, act, clear: () => links.replaceChildren() };
}
