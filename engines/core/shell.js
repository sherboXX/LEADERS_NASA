// Page shell shared by every engine, in the look of the Freefall Fire Console: a
// full-bleed 3D stage, a top bar (brand, Experiment / Application tabs), a title, and a
// dock of tabs. Every panel starts minimised and pops open from its tab:
//   left  = scenarios      right = readings, result, controls, guide, settings
//   bottom = charts        over the stage = the play bar
import { el } from './ui.js';
import { createDock, buildSettings, toast, em } from './dock.js';
import { startMusic, musicButton } from './music.js';

// Line icons (same drawing style as the console).
const SYMBOLS = {
  o2: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  ext: '<rect x="8" y="8" width="8" height="13" rx="3"/><path d="M10 8V5h4v3M14 5h4l2 2"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7 15h10"/>',
  flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 3 4 1-2 1-5 1-8z"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
  crew: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
let spriteReady = false;
function ensureSprite() {
  if (spriteReady) return;
  spriteReady = true;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${
    Object.entries(SYMBOLS).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${d}</symbol>`).join('')}</svg>`;
  document.body.prepend(holder.firstChild);
}
export function icon(name) {
  const holder = document.createElement('span');
  holder.innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  return holder.firstChild;
}

const LEVELS = { high: 'High', med: 'Medium', low: 'Low' };

/**
 * @param id           short name of the experiment, used for saved settings ('flex')
 * @param application  () => URL of the Application section for the current state
 */
export function createShell(host, { id, title, subtitle, navLabel, cardTitle, cardSub, application }) {
  ensureSprite();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 1101px)');

  const fade = el('div', { class: 'fade on' });
  const vignette = el('div', { class: 'vignette' });
  const transport = el('div', { class: 'transport glass' });
  const stageWrap = el('div', { class: 'stage-wrap' }, vignette, transport, fade);
  const chip = el('span', { class: 'status' });
  const gear = el('button', { class: 'ibtn', type: 'button', 'aria-label': 'Settings', title: 'Settings' }, icon('gear'));
  const tools = el('div', { class: 'tools' }, chip, musicButton(), gear);
  startMusic();
  const tabApp = el('button', { type: 'button', 'aria-pressed': 'false', text: 'Application' });
  const nav = el('nav', { class: 'nav glass', 'aria-label': navLabel });
  const cardRows = el('div', { class: 'rows' });
  const titleEl = el('div', { class: 'title' }, el('h1', { text: title }), el('p', { text: subtitle }));
  const right = el('aside', { class: 'right' });
  const bottom = el('section', { class: 'bottom' });
  const root = el('div', { class: 'app' }, stageWrap,
    el('div', { class: 'hud' },
      el('header', { class: 'top' },
        el('a', { class: 'brand', href: 'index.html', title: 'All experiments' }, 'FREE', el('span', { text: 'FALL' })),
        el('nav', { class: 'tabs', 'aria-label': 'Section' },
          el('button', { type: 'button', 'aria-pressed': 'true', text: 'Experiment' }), tabApp),
        tools),
      titleEl, nav, right, bottom));
  host.append(root);
  const dock = createDock(root, id);
  const AREA = { right, bottom };

  // fade in on arrival, fade out before leaving for the Application section
  const reveal = () => fade.classList.remove('on');
  requestAnimationFrame(() => requestAnimationFrame(reveal));
  addEventListener('pageshow', reveal);
  const openApplication = () => { fade.classList.add('on'); setTimeout(() => { location.href = application(); }, reduce ? 0 : 380); };
  tabApp.addEventListener('click', openApplication);

  // The area no open panel covers, in stage pixels (null when the page is stacked).
  const shown = (n) => !n.hidden && n.getClientRects().length > 0;
  const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z')) || 1;
  function free() {
    if (!wide.matches) return null;
    const s = stageWrap.getBoundingClientRect();
    const x0 = (shown(nav) ? nav.getBoundingClientRect().right : dock.el.getBoundingClientRect().right) - s.left;
    const x1 = ([...right.children].some(shown) ? right.getBoundingClientRect().left : s.right) - s.left;
    const y0 = (shown(titleEl) ? titleEl.getBoundingClientRect().bottom : s.top + 60) - s.top;
    const yb = ([...bottom.children].some(shown) ? bottom.getBoundingClientRect().top : s.bottom - 8) - s.top;
    return { x0, x1, y0, y1: yb - 64 * zoom(), yb };
  }
  const layoutFns = [];
  function layout() {
    const f = free();
    const z = zoom();
    stageWrap.style.setProperty('--cx', f ? `${Math.round((f.x0 + f.x1) / 2)}px` : '50%');   // centre of the free area, in real pixels
    stageWrap.style.setProperty('--cy', f ? `${Math.round((f.y0 + f.y1) / 2)}px` : '50%');
    stageWrap.style.setProperty('--tx', f ? `${Math.round((f.x0 + f.x1) / 2 / z)}px` : '50%');
    stageWrap.style.setProperty('--tb', f ? `${Math.round((stageWrap.clientHeight - f.yb + 14) / z)}px` : '8px');
    for (const fn of layoutFns) fn();
  }
  dock.onChange(layout);
  addEventListener('resize', layout);

  function tab({ id: tabId, glyph, label, title: heading, small = '', cls = '', area = 'right', adv = false, order, onOpen }) {
    if (area === 'nav') { dock.add({ id: tabId, glyph, label, panels: [nav], order, onOpen }); return { root: nav }; }
    const smallEl = el('small', { text: small });
    const head = el('div', { class: 'ph' }, el('span', {}, glyph ? em(glyph) : null, heading), smallEl);
    const panel = el('section', { class: `glass ${cls}`.trim(), 'data-adv': adv ? '' : null }, head);
    AREA[area].append(panel);
    dock.add({ id: tabId, glyph, label, panels: [panel], order, onOpen });
    return { root: panel, head, small: smallEl };
  }
  tab({ id: 'readings', glyph: 'gauge', label: 'Readings', title: cardTitle, small: cardSub, order: 3 }).root.append(cardRows);

  return {
    root, stageWrap, transport, reduce, openApplication, dock, tab, free, layout,
    frame() { const f = free(); return f && { cx: (f.x0 + f.x1) / 2, cy: (f.y0 + f.y1) / 2 }; },
    onLayout: (fn) => layoutFns.push(fn),
    toast: (text) => toast(stageWrap, text),
    setChip: (text) => { if (chip.textContent !== text) chip.textContent = text; },
    /** Left nav: [{ id, icon, name, level, onClick }]. */
    setNav(items) {
      nav.replaceChildren(...items.map((it) => {
        const b = el('button', { type: 'button', 'aria-current': 'false', 'data-id': it.id },
          el('span', { class: 'ic' }, icon(it.icon)), el('span', { text: it.name }),
          el('span', { class: `lv ${it.level}`, title: `${LEVELS[it.level]} fire risk` }));
        b.addEventListener('click', it.onClick);
        return b;
      }));
    },
    navCurrent(navId) { for (const b of nav.children) b.setAttribute('aria-current', String(b.dataset.id === navId)); },
    /** Row in the readings card; returns a setter. `pill` rows show a coloured badge. */
    row(iconName, key, pill = false, adv = false) {
      const v = el('span', { class: pill ? 'pill' : 'v' });
      cardRows.append(el('div', { class: 'r', 'data-adv': adv ? '' : null }, el('span', { class: 'k' }, icon(iconName), key), el('span'), v));
      return (text, cls) => {
        if (v.textContent !== text) v.textContent = text;
        if (pill && cls !== undefined && v.className !== `pill ${cls}`.trim()) v.className = `pill ${cls}`.trim();
      };
    },
    /** Add the settings tab. Call last, once every other tab exists. */
    settings(displays = [], links = []) {
      const base = [
        { key: `${id}.title`, label: 'Title', apply: (on) => { titleEl.hidden = !on; } },
        { key: `${id}.chip`, label: 'Atmosphere read-out', apply: (on) => { chip.hidden = !on; } },
        { key: `${id}.play`, label: 'Play bar', apply: (on) => { transport.hidden = !on; } },
        { key: `${id}.vignette`, label: 'Darkened edges', apply: (on) => { vignette.hidden = !on; } },
      ];
      const panel = buildSettings({ dock, scope: id, displays: [...base, ...displays], links });
      right.append(panel);
      dock.add({ id: 'settings', glyph: 'gear', label: 'Settings', panels: [panel], order: 9 });
      gear.addEventListener('click', () => dock.toggle('settings'));
      layout();
    },
  };
}
