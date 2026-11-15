// The steps shown before the lab opens: a caption card over the live 3D scene that walks
// through how the experiment is done, like a short video. Steps advance by themselves;
// Back, Next and Skip are always there.
import { el } from './ui.js';
import { ic } from './icons.js';

/**
 * steps = [{ glyph, title, text, dur (seconds; the last step waits for the button) }]
 * onStep(step, index) drives the scene; onDone() opens the lab.
 */
export function playIntro(app, steps, { onStep, onDone, reduce = false }) {
  let i = 0;
  let timer = 0;
  const big = el('span', { class: 'big', 'aria-hidden': 'true' });
  const count = el('small');
  const title = el('h2');
  const text = el('p');
  const fill = el('i');
  const dots = el('div', { class: 'dots' }, steps.map(() => el('i')));
  const back = el('button', { type: 'button', class: 'btn', text: 'Back', onclick: () => show(i - 1) });
  const next = el('button', { type: 'button', class: 'btn go', onclick: () => (i === steps.length - 1 ? finish() : show(i + 1)) });
  const skip = el('button', { type: 'button', class: 'btn', text: 'Skip', onclick: finish });
  const card = el('section', { class: 'intro glass', 'aria-label': 'How the experiment is done' },
    el('div', { class: 'step' }, big, el('div', {}, count, title)),
    el('div', { 'aria-live': 'polite' }, text),
    el('div', { class: 'bar' }, fill),
    el('div', { class: 'row' }, dots, skip, back, next));

  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[i];
    const last = i === steps.length - 1;
    big.replaceChildren(ic(s.glyph));
    count.textContent = `Step ${i + 1} of ${steps.length}`;
    title.textContent = s.title;
    text.textContent = s.text;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
    back.disabled = i === 0;
    next.textContent = last ? 'Open the lab' : 'Next';
    skip.hidden = last;
    clearTimeout(timer);
    fill.classList.remove('run');
    if (!last && !reduce) {
      const dur = s.dur || 6;
      void fill.offsetWidth; // restart the progress bar
      fill.style.setProperty('--dur', `${dur}s`);
      fill.classList.add('run');
      timer = setTimeout(() => show(i + 1), dur * 1000);
    }
    onStep(s, i);
  }
  function finish() {
    clearTimeout(timer);
    app.classList.remove('intro-on');
    card.remove();
    onDone();
  }
  app.classList.add('intro-on');
  app.append(card);
  show(0);
  next.focus({ preventScroll: true });
  return { finish };
}
