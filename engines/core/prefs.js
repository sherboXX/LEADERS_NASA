// Preferences shared by the experiment pages and the Application section (same origin,
// one localStorage entry). Everything here is a convenience: pages work without it.
const KEY = 'freefall.prefs.v1';
const DEFAULTS = {
  level: 'beginner',      // 'beginner' | 'advanced'
  text: 'large',          // 'large' | 'xl' (there is no smaller size)
  emoji: true,
  intro: true,            // play the steps before the lab opens
  music: true,            // quiet background music (starts on the first click)
  hide: {},               // display elements and dock tabs switched off, by key
  aiKey: '',              // the user's own OpenAI key; never leaves this browser except to OpenAI
  aiModel: 'gpt-6-luna',
};
const state = { ...DEFAULTS };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* private window */ }
if (state.text !== 'xl') state.text = 'large';
const subs = new Set();

export const prefs = state;
export function setPref(key, value) {
  state[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked */ }
  for (const fn of subs) fn(key, value);
}
export function onPrefs(fn) { subs.add(fn); return () => subs.delete(fn); }
/** Mirror level, text size and emoji choice on <html> so the stylesheet can react. */
export function applyPrefs() {
  const d = document.documentElement.dataset;
  d.level = state.level;
  d.text = state.text;
  d.emoji = state.emoji ? 'on' : 'off';
}
