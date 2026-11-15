// Dock of tabs, pop-up panels, the settings panel and toasts. Shared by the experiment
// pages (core/shell.js) and the Application section (application/bridge.js).
// Every panel starts minimised; its tab in the dock pops it open.
import { el, segs } from './ui.js';
import { prefs, setPref, onPrefs, applyPrefs } from './prefs.js';
import { ic } from './icons.js';

const wide = matchMedia('(min-width: 1101px)');
/** A Freefall icon (see icons.js) sized to sit in a line of text. */
export const em = (name) => ic(name, 'em');

export function createDock(app, scope) {
  applyPrefs();
  const bar = el('nav', { class: 'dock glass', 'aria-label': 'Panels' });
  app.append(bar);
  const tabs = new Map();
  const listeners = [];
  const emit = (id) => { for (const fn of listeners) fn(id); };
  const off = (t) => !!prefs.hide[`${scope}.tab.${t.id}`] || (t.adv && prefs.level !== 'advanced');
  function sync(t) {
    t.btn.hidden = off(t);
    const open = t.open && !t.btn.hidden;
    t.btn.setAttribute('aria-expanded', String(open));
    for (const p of t.panels) p.hidden = !open;
  }
  function toggle(id, on) {
    const t = tabs.get(id);
    if (!t) return;
    t.open = on ?? !t.open;
    t.btn.classList.remove('ping');
    sync(t);
    if (t.open) {
      t.onOpen?.();
      if (!wide.matches) t.panels[0]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    emit(id);
  }
  function button(glyph, label, order) {
    const btn = el('button', { type: 'button', title: label, style: `--o:${order}` }, em(glyph), el('span', { text: label }));
    bar.append(btn);
    return btn;
  }
  const api = {
    el: bar,
    /** Tab that shows or hides panels. Calling it again with the same id adds panels to it. */
    add({ id, glyph, label, panels = [], order = 5, adv = false, onOpen }) {
      let t = tabs.get(id);
      if (!t) {
        t = { id, glyph, label, adv, panels: [], open: false, onOpen, btn: button(glyph, label, order) };
        t.btn.addEventListener('click', () => toggle(id));
        tabs.set(id, t);
      }
      for (const p of panels) {
        t.panels.push(p);
        p.classList.add('pop');
        const head = p.matches('.glass') && p.querySelector(':scope > .ph');
        if (head) {
          head.append(el('button', { type: 'button', class: 'min', 'aria-label': `Minimise ${t.label}`, title: 'Minimise', text: '–',
            onclick: () => toggle(id, false) }));
        }
      }
      sync(t);
      return t;
    },
    /** Button that runs something instead of opening a panel. */
    action(glyph, label, fn, order = 0) { button(glyph, label, order).addEventListener('click', fn); },
    toggle,
    closeAll() { for (const t of tabs.values()) if (t.open) toggle(t.id, false); },
    isOpen(id) { const t = tabs.get(id); return !!t && t.open && !t.btn.hidden; },
    ping(id) { const t = tabs.get(id); if (t && !t.open) t.btn.classList.add('ping'); },
    onChange: (fn) => listeners.push(fn),
    tabs: () => [...tabs.values()],
  };
  onPrefs(() => { applyPrefs(); for (const t of tabs.values()) sync(t); emit(null); });
  return api;
}

/**
 * Settings panel. `displays` = [{ key, label, apply(on) }] are things on screen that can
 * be switched off; every dock tab can be switched off too. Call after all tabs exist.
 */
export function buildSettings({ dock, scope, displays = [], links = [] }) {
  const hide = (key, isOff) => setPref('hide', { ...prefs.hide, [key]: isOff });
  const check = (label, on, set, adv) => {
    const input = el('input', { type: 'checkbox' });
    input.checked = on;
    input.addEventListener('change', () => set(input.checked));
    return el('label', { class: 'r', 'data-adv': adv ? '' : null }, el('span', { class: 'k' }, label), input);
  };
  const choice = (label, key, options) => el('div', { class: 'r seg' }, el('span', { class: 'k', text: label }),
    segs({ label, options, value: prefs[key], onChange: (v) => setPref(key, v) }).el);
  const field = (label, key, attrs) => {
    const input = el('input', { ...attrs, 'aria-label': label });
    input.value = prefs[key] || '';
    input.addEventListener('change', () => setPref(key, input.value.trim()));
    return el('div', { class: 'r field' }, el('span', { class: 'k', text: label }), input);
  };
  const rows = el('div', { class: 'rows' },
    el('h4', { text: 'Who is exploring?' }),
    choice('Level', 'level', [{ value: 'beginner', label: 'Beginner' }, { value: 'advanced', label: 'Advanced' }]),
    choice('Text', 'text', [{ value: 'large', label: 'Large' }, { value: 'xl', label: 'Extra large' }]),
    el('h4', { text: 'On screen' }),
    displays.map((d) => check(d.label, !prefs.hide[d.key], (on) => { hide(d.key, !on); d.apply(on); })),
    check('Icons', prefs.emoji, (on) => setPref('emoji', on)),
    check('Play the steps when the page opens', prefs.intro, (on) => setPref('intro', on)),
    el('h4', { text: 'Tabs in the dock' }),
    dock.tabs().filter((t) => t.id !== 'settings').map((t) => check([em(t.glyph), t.label], !prefs.hide[`${scope}.tab.${t.id}`],
      (on) => hide(`${scope}.tab.${t.id}`, !on), t.adv)),
    el('h4', { text: 'AI guide (ChatGPT)' }),
    field('API key', 'aiKey', { type: 'password', placeholder: 'sk-… (optional)', autocomplete: 'off', spellcheck: 'false' }),
    field('Model', 'aiModel', { type: 'text', placeholder: 'gpt-6-luna', spellcheck: 'false' }),
    el('p', { class: 'note', text: 'Your key is stored in this browser only and sent only to OpenAI. Leave it empty to use the built-in guide.' }),
    links.length ? el('p', { class: 'links' }, links.map(([text, href]) => el('a', { href, text }))) : null);
  for (const d of displays) d.apply(!prefs.hide[d.key]);
  return el('section', { class: 'glass settings' },
    el('div', { class: 'ph' }, el('span', {}, em('gear'), 'Settings'), el('small', { text: 'saved in this browser' })), rows);
}

let toastTimer = 0;
/** One short message at the top of `host`; a new one replaces the old. */
export function toast(host, text) {
  let node = host.querySelector(':scope > .toast');
  if (!text) { node?.remove(); return; }
  if (!node) { node = el('div', { class: 'toast glass', role: 'status' }); host.append(node); }
  node.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 4200);
}
