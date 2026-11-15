// Draws the guide's charts in the house style. The numbers always come from the page's
// own model (the AI only says what to plot); this file's whole job is to make them look good.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function nice(lo, hi, n = 4) {
  const raw = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

/**
 * spec = { points: [{x, y}], xLabel, yLabel, refs: [{x, label}], mark: {x, y, text} }
 * progress 0..1 reveals the curve from left to right.
 */
export function drawSketch(canvas, spec, progress = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const box = canvas.getBoundingClientRect(); // on-screen size, so text stays sharp when the page is zoomed
  const w = Math.round(box.width);
  const h = Math.round(box.height);
  if (w < 60 || h < 60) return;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const pad = { l: 46, r: 16, t: 36, b: 38 };
  const pts = spec.points;
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x;
  let y0 = Math.min(...pts.map((p) => p.y));
  let y1 = Math.max(...pts.map((p) => p.y));
  const span = y1 - y0 || Math.abs(y1) || 1;
  y0 = y0 > 0 && y0 < 0.7 * y1 ? 0 : y0 - span * 0.12;
  y1 += span * 0.22;
  const sx = (x) => pad.l + ((x - x0) / (x1 - x0)) * (w - pad.l - pad.r);
  const sy = (y) => h - pad.b - ((y - y0) / (y1 - y0)) * (h - pad.t - pad.b);

  // quiet grid and axes
  g.font = '13px "Exo 2", Inter, system-ui, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  g.setLineDash([2, 5]);
  for (const v of nice(y0, y1)) {
    const y = Math.round(sy(v)) + 0.5;
    g.strokeStyle = 'rgba(255,255,255,0.09)';
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke();
    g.fillStyle = '#93a0b4';
    g.fillText(String(v), pad.l - 7, y);
  }
  g.setLineDash([]);
  g.textAlign = 'center';
  g.textBaseline = 'top';
  for (const v of nice(x0, x1, 5)) g.fillText(String(v), sx(v), h - pad.b + 6);
  g.textAlign = 'right';
  g.fillStyle = '#c9d2df';
  g.fillText(spec.xLabel, w - pad.r, h - 16);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = '600 14px Oxanium, Poppins, system-ui, sans-serif';
  g.fillStyle = '#e6ebf2';
  g.fillText(spec.yLabel, 10, 16);

  // reference lines (ISS, Moon Base, ...)
  g.font = '12.5px "Exo 2", Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  for (const r of spec.refs || []) {
    if (r.x <= x0 || r.x >= x1) continue;
    const x = Math.round(sx(r.x)) + 0.5;
    g.strokeStyle = 'rgba(255,255,255,0.3)';
    g.setLineDash([3, 4]);
    g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, h - pad.b); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#93a0b4';
    g.fillText(r.label, x, pad.t - 5);
  }

  // the curve: soft fill, glowing line that runs from NASA blue to NASA red
  const trace = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(sx(p.x), sy(p.y)) : g.moveTo(sx(p.x), sy(p.y)))); };
  g.save();
  g.beginPath();
  g.rect(0, 0, pad.l + (w - pad.l - pad.r) * progress, h);
  g.clip();
  trace();
  g.lineTo(sx(x1), h - pad.b); g.lineTo(sx(x0), h - pad.b); g.closePath();
  const fill = g.createLinearGradient(0, pad.t, 0, h - pad.b);
  fill.addColorStop(0, 'rgba(79,157,255,0.36)');
  fill.addColorStop(1, 'rgba(79,157,255,0)');
  g.fillStyle = fill;
  g.fill();
  const stroke = g.createLinearGradient(pad.l, 0, w - pad.r, 0);
  stroke.addColorStop(0, '#4f9dff');
  stroke.addColorStop(1, '#fc3d21');
  trace();
  g.strokeStyle = stroke;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.shadowColor = 'rgba(79,157,255,0.75)';
  g.shadowBlur = 12;
  g.stroke();
  g.restore();

  // where the user's current setting sits
  const m = spec.mark;
  if (m && progress >= 1 && m.x >= x0 && m.x <= x1) {
    const x = sx(m.x);
    const y = sy(m.y);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.beginPath(); g.arc(x, y, 10, 0, 6.2832); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(x, y, 4.5, 0, 6.2832); g.fill();
    g.font = '600 13px "Exo 2", Inter, system-ui, sans-serif';
    const tw = g.measureText(m.text).width + 16;
    const bx = Math.min(Math.max(x - tw / 2, pad.l), w - pad.r - tw);
    const by = y - 34 > pad.t - 6 ? y - 34 : y + 14;
    g.fillStyle = 'rgba(9,14,24,0.92)';
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 1;
    g.beginPath(); g.roundRect(bx, by, tw, 21, 10.5); g.fill(); g.stroke();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(m.text, bx + tw / 2, by + 11);
  }
}

/** Draw with a left-to-right reveal, and keep it sharp when the panel is resized. */
export function animateSketch(canvas, spec) {
  new ResizeObserver(() => drawSketch(canvas, spec, 1)).observe(canvas);
  if (reduce) return;
  let start = 0;
  const step = (now) => {
    start ||= now;
    const t = Math.min(1, (now - start) / 700);
    drawSketch(canvas, spec, 1 - (1 - t) ** 3);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
