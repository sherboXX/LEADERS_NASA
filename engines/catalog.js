// Every experiment in Freefall: where it lives, what it is in one line, which part of
// fire safety it serves, and how directly it bears on crew fire safety (0 to 100).
// The relevance ranking follows the challenge brief: solid-material flammability (BASS,
// Saffire), detection (SAME) and suppression (FLEX) come first; BRE, CFI-G and E-FIELD are
// singled out next; the remaining combustion studies are relevant but less directly.
const lab = (engine, id) => `lab.html?engine=${engine}&exp=${id}`;
const drop = (id) => `droplet.html?exp=${id}`;

export const PILLARS = { prevent: 'Prevention', detect: 'Detection', suppress: 'Suppression' };

export const CATALOG = [
  { id: 'saffire1', name: 'Saffire-I', psi: 'PSI-98', glyph: 'flame', pillar: 'prevent', score: 96, url: lab('solid', 'saffire1'), line: 'A fire the size of a person, lit on purpose in a cargo ship.' },
  { id: 'saffire2', name: 'Saffire-II', psi: 'PSI-99', glyph: 'flame', pillar: 'prevent', score: 95, url: lab('solid', 'saffire2'), line: 'Nine real spacecraft materials: which ones burn in orbit?' },
  { id: 'bass2', name: 'BASS-II', psi: 'PSI-25', glyph: 'gauge', pillar: 'prevent', score: 93, url: lab('solid', 'bass2'), line: 'How little oxygen can a flame on plastic live on?' },
  { id: 'same', name: 'SAME', psi: 'PSI-102', glyph: 'wind', pillar: 'detect', score: 92, url: lab('smoke', 'same'), line: 'What smoke looks like to a detector when nothing rises.' },
  { id: 'flex', name: 'FLEX', psi: 'PSI-69', glyph: 'extinguisher', pillar: 'suppress', score: 91, url: drop('flex'), line: 'Putting out a burning droplet with carbon dioxide and helium.' },
  { id: 'saffire3', name: 'Saffire-III', psi: 'PSI-100', glyph: 'flame', pillar: 'prevent', score: 90, url: lab('solid', 'saffire3'), line: 'The big sheet again, with faster air.' },
  { id: 'bass', name: 'BASS', psi: 'PSI-26', glyph: 'flame', pillar: 'prevent', score: 89, url: lab('solid', 'bass'), line: 'Small samples of fabric and plastic in a gentle breeze.' },
  { id: 'samer', name: 'SAME-R', psi: 'PSI-101', glyph: 'wind', pillar: 'detect', score: 88, url: lab('smoke', 'samer'), line: 'Smoke measured again, with sharper instruments.' },
  { id: 'bre', name: 'BRE', psi: 'PSI-20', glyph: 'sphere', pillar: 'prevent', score: 82, url: lab('burner', 'bre'), line: 'A gas burner that stands in for burning plastic in still air.' },
  { id: 'cfig', name: 'CFI-G', psi: 'PSI-159', glyph: 'drop', pillar: 'prevent', score: 78, url: lab('burner', 'cfig'), line: 'Inside-out flames with up to 85% oxygen.' },
  { id: 'cfi', name: 'CFI', psi: 'PSI-39', glyph: 'cool', pillar: 'suppress', score: 76, url: drop('cfi'), line: 'The invisible cool flame that burns on after the fire looks out.' },
  { id: 'flex2', name: 'FLEX-2', psi: 'PSI-68', glyph: 'drop', pillar: 'suppress', score: 72, url: drop('flex2'), line: 'Droplets in a slow breeze, like cabin ventilation.' },
  { id: 'efield', name: 'E-FIELD Flames', psi: 'PSI-22', glyph: 'bolt', pillar: 'prevent', score: 66, url: lab('jet', 'efield'), line: 'An electric field stands in for the pull of gravity.' },
  { id: 'spice', name: 'SPICE', psi: 'PSI-107', glyph: 'chart', pillar: 'detect', score: 62, url: lab('jet', 'spice'), line: 'How big a flame gets before it starts to smoke.' },
  { id: 'sflame', name: 's-Flame', psi: 'PSI-23', glyph: 'sphere', pillar: 'suppress', score: 58, url: lab('burner', 'sflame'), line: 'A ball of flame that grows until it puts itself out.' },
  { id: 'flamedesign', name: 'Flame Design', psi: 'PSI-10', glyph: 'flask', pillar: 'detect', score: 55, url: lab('burner', 'flamedesign'), line: 'Choosing the mix so a flame makes no soot.' },
  { id: 'slice', name: 'SLICE', psi: 'PSI-106', glyph: 'wind', pillar: 'suppress', score: 52, url: lab('jet', 'slice'), line: 'Thinning the fuel until the flame lifts off and blows out.' },
  { id: 'cld', name: 'CLD Flame', psi: 'PSI-21', glyph: 'flame', pillar: 'detect', score: 50, url: lab('jet', 'cld'), line: 'One flame, from thick soot to almost nothing.' },
  { id: 'daft', name: 'DAFT', psi: 'PSI-47', glyph: 'search', pillar: 'detect', score: 42, url: lab('smoke', 'daft'), line: 'Proving a particle counter works in orbit, on cabin dust.' },
  { id: 'daft2', name: 'DAFT-2', psi: 'PSI-47', glyph: 'search', pillar: 'detect', score: 40, url: lab('smoke', 'daft2'), line: 'The follow-up check before measuring real smoke.' },
];
