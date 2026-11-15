// Quiet background music for every page: the Freefall theme (about 1.5 minutes, looped).
// Browsers let a page make sound only after the visitor clicks, taps or presses a key, so
// the music fades in on the first such gesture (or at once if the browser already allows
// it). It is kept very low so it never competes with the lab, pauses while the tab is
// hidden, carries on from the same point on the next page, and can be switched off with the
// speaker button or in Settings; the choice is kept in prefs.music.
import { prefs, setPref, onPrefs } from './prefs.js';
import { ic } from './icons.js';

const SOURCES = [['freefall-theme.m4a', 'audio/mp4'], ['freefall-theme.mp3', 'audio/mpeg']];
const VOLUME = 0.1;        // background level: low enough to talk and read over
const FADE_IN = 3;         // seconds
const FADE_OUT = 0.8;
const SPOT = 'freefall.music.t';   // playback position, shared by the pages of one tab
const GESTURES = ['pointerdown', 'keydown', 'touchstart'];

let audio = null;
let raf = 0;
let saved = 0;
const buttons = new Set();
// Pages shown inside another page (the phone preview, the page sweep) stay silent, so two
// copies of the music never play at once.
const framed = (() => { try { return window.self !== window.top; } catch { return true; } })();

function fadeTo(target, seconds, done) {
  cancelAnimationFrame(raf);
  const from = audio.volume;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / (seconds * 1000));
    audio.volume = Math.min(1, Math.max(0, from + (target - from) * k));
    if (k < 1) raf = requestAnimationFrame(step);
    else if (done) done();
  };
  raf = requestAnimationFrame(step);
}

function save() {
  if (!audio || !(audio.currentTime > 0)) return;
  saved = audio.currentTime;
  try { sessionStorage.setItem(SPOT, String(saved)); } catch { /* storage blocked */ }
}

function play() {
  if (!audio || !prefs.music || document.hidden) return;
  if (audio.paused) audio.volume = 0;
  const p = audio.play();
  if (p) p.then(() => fadeTo(VOLUME, FADE_IN)).catch(() => { /* waits for a gesture */ });
}

function stop() {
  if (!audio) return;
  save();
  fadeTo(0, FADE_OUT, () => audio.pause());
}

function paint(b) {
  const on = !!prefs.music;
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Background music is on. Turn it off' : 'Background music is off. Turn it on');
  b.title = on ? 'Background music: on' : 'Background music: off';
  b.replaceChildren(ic(on ? 'sound' : 'mute'));
}

/** Switch the music on or off for every page (remembered in this browser). */
export function setMusic(on) { setPref('music', !!on); }

/** A speaker button that shows and toggles the music. */
export function musicButton(cls = 'ibtn') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `${cls} music-btn`;
  b.addEventListener('click', () => setMusic(!prefs.music));
  buttons.add(b);
  paint(b);
  return b;
}

/** Load the music and start it as soon as the browser allows. Safe to call more than once. */
export function startMusic() {
  if (audio || framed) return;
  audio = document.createElement('audio');
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0;
  for (const [file, type] of SOURCES) {
    const s = document.createElement('source');
    s.src = new URL(`../../audio/${file}`, import.meta.url).href;
    s.type = type;
    audio.append(s);
  }
  audio.addEventListener('loadedmetadata', () => {
    let t = 0;
    try { t = parseFloat(sessionStorage.getItem(SPOT)) || 0; } catch { /* storage blocked */ }
    if (t > 0 && t < audio.duration - 1) audio.currentTime = t;
  }, { once: true });
  audio.addEventListener('timeupdate', () => {
    if (Math.abs(audio.currentTime - saved) > 2) save();
  });
  document.body.append(audio);

  // the first click, tap or key press anywhere starts it (the speaker button handles itself)
  const kick = (e) => {
    if (e.target?.closest?.('.music-btn')) return;
    play();
  };
  for (const g of GESTURES) document.addEventListener(g, kick, { capture: true, passive: true });
  audio.addEventListener('playing', () => {
    for (const g of GESTURES) document.removeEventListener(g, kick, { capture: true });
  }, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { save(); cancelAnimationFrame(raf); audio.pause(); } else if (prefs.music) play();
  });
  addEventListener('pagehide', save);
  onPrefs((key) => {
    if (key !== 'music') return;
    for (const b of buttons) paint(b);
    if (prefs.music) play(); else stop();
  });
  play();
}
