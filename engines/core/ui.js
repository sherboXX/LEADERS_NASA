// Small DOM and canvas helpers shared by every engine. No framework.
let counter = 0;
const uid = () => `fl-${++counter}`;

export function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, val] of Object.entries(props)) {
    if (val == null || val === false) continue;
    if (k === 'class') node.className = val;
    else if (k === 'text') node.textContent = val;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), val);
    else node.setAttribute(k, val === true ? '' : val);
  }
  node.append(...kids.flat().filter((c) => c != null && c !== false));
  return node;
}

/** Console-style row holding a range input: label, slider, live value. */
export function sliderRow({ label, min, max, step, value, format = String, onInput }) {
  const id = uid();
  const out = el('output', { for: id });
  const input = el('input', { type: 'range', id, min, max, step });
  const root = el('label', { class: 'r', for: id }, el('span', { class: 'k', text: label }), input, out);
  function set(x) { input.value = x; out.textContent = format(x); }
  input.addEventListener('input', () => { set(+input.value); onInput(+input.value); });
  set(value);
  return { el: root, set, disable(off) { input.disabled = off; root.classList.toggle('is-off', off); } };
}

/** Radio group drawn as a segmented control. */
export function segs({ label, options, value, onChange }) {
  const name = uid();
  const root = el('div', { class: 'segs', role: 'radiogroup', 'aria-label': label });
  for (const o of options) {
    const id = uid();
    root.append(el('input', { type: 'radio', name, id, value: String(o.value), onchange: () => onChange(o.value) }),
      el('label', { for: id, text: o.label }));
  }
  const set = (x) => { for (const i of root.querySelectorAll('input')) i.checked = i.value === String(x); };
  set(value);
  return { el: root, set };
}

/** Console-style row holding a segmented control. */
export function segRow(cfg) {
  const s = segs(cfg);
  return { el: el('div', { class: 'r seg' }, el('span', { class: 'k', text: cfg.label }), s.el), set: s.set };
}

/** Console-style row holding a drop-down, for choices too many for a segmented control. */
export function pickRow({ label, options, value, onChange }) {
  const select = el('select', { 'aria-label': label, onchange: () => onChange(options[select.selectedIndex].value) },
    options.map((o) => el('option', { text: o.label })));
  const set = (x) => { select.selectedIndex = Math.max(0, options.findIndex((o) => String(o.value) === String(x))); };
  set(value);
  return { el: el('div', { class: 'r seg' }, el('span', { class: 'k', text: label }), select), set };
}

function ticks(a, b, n) {
  const raw = (b - a) / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const stepSize = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let x = Math.ceil(a / stepSize - 1e-9) * stepSize; x <= b + 1e-9; x += stepSize) out.push(+x.toFixed(8));
  return out;
}

/**
 * Canvas plot with axes. `draw(ctx, P, color)` paints the data; P maps data to pixels
 * with P.sx / P.sy and back with P.ix / P.iy. Colours come from the page's CSS variables.
 */
export function createPlot(host, { draw, xLabel = '', pad = { l: 40, r: 12, t: 8, b: 36 }, xTicks = 5, yTicks = 4 }) {
  const canvas = el('canvas');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(host);
  const color = (name) => style.getPropertyValue(name).trim();
  const P = { w: 0, h: 0, x: [0, 1], y: [0, 1], pad, xLabel };
  const iw = () => P.w - pad.l - pad.r;
  const ih = () => P.h - pad.t - pad.b;
  P.sx = (x) => pad.l + ((x - P.x[0]) / (P.x[1] - P.x[0])) * iw();
  P.sy = (y) => P.h - pad.b - ((y - P.y[0]) / (P.y[1] - P.y[0])) * ih();
  P.ix = (px) => P.x[0] + ((px - pad.l) / iw()) * (P.x[1] - P.x[0]);
  P.iy = (py) => P.y[0] + ((P.h - pad.b - py) / ih()) * (P.y[1] - P.y[0]);
  P.at = (evt) => { const r = canvas.getBoundingClientRect(); return { x: evt.clientX - r.left, y: evt.clientY - r.top }; };

  function render() {
    if (P.w < 40 || P.h < 40) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, P.w, P.h);
    ctx.font = '13px "Exo 2", Inter, system-ui, sans-serif';
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.fillStyle = '#c9cfd6';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (const y of ticks(P.y[0], P.y[1], yTicks)) {
      const py = Math.round(P.sy(y)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, py); ctx.lineTo(P.w - pad.r, py); ctx.stroke();
      ctx.fillText(String(y), pad.l - 6, py);
    }
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    for (const x of ticks(P.x[0], P.x[1], xTicks)) ctx.fillText(String(x), P.sx(x), P.h - pad.b + 5);
    ctx.textAlign = 'right';
    ctx.fillStyle = color('--muted');
    ctx.fillText(P.xLabel, P.w - pad.r, P.h - 15);
    ctx.save();
    draw(ctx, P, color);
    ctx.restore();
  }

  const ro = new ResizeObserver(() => {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    P.w = Math.round(r.width);
    P.h = Math.round(r.height);
    canvas.width = P.w * dpr;
    canvas.height = P.h * dpr;
    render();
  });
  ro.observe(host);
  document.fonts?.ready.then(render);
  return { P, canvas, render, color, destroy: () => ro.disconnect() };
}

export const pct = (x, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const lerp = (a, b, t) => a + (b - a) * t;
