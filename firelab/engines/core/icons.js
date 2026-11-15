// Freefall's own icon set: two-tone vector drawings on a 24 x 24 grid. Lines take the
// text colour; the filled accent is NASA blue (.a), NASA red (.h, for hot things) or
// violet (.v, for the cool flame). No emoji anywhere in the interface.
const ICONS = {
  // dock and panels
  steps: '<rect x="3" y="5" width="18" height="14" rx="3"/><path class="a" d="M10 9v6l5.2-3z"/>',
  flame: '<path d="M12 3c1 3.6 5.5 5.6 5.5 10.2a5.5 5.5 0 0 1-11 0c0-2.6 1.6-3.8 2.2-6 1.6.8 2.6 2 2.8 3.6.6-2 .8-4.8.5-7.8z"/><path class="h" d="M12 13.4c.9 1.1 2 1.9 2 3.2a2 2 0 0 1-4 0c0-1.3 1.1-2.1 2-3.2z"/>',
  sliders: '<path d="M4 7h8.5M17.5 7H20M4 12h2.5M11.5 12H20M4 17h10.5M19.5 17h.5"/><circle class="a" cx="15" cy="7" r="2.3"/><circle class="a" cx="9" cy="12" r="2.3"/><circle class="a" cx="17" cy="17" r="2.3"/>',
  gauge: '<path d="M4.6 16.5a8 8 0 1 1 14.8 0M7.5 20h9"/><path d="M12 14l4.2-5.2"/><circle class="a" cx="12" cy="14" r="2"/>',
  report: '<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path class="a" d="M9 2.8h6v3.6H9z"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  chart: '<path d="M4 4v16h16"/><path d="M7 15.5l3.5-4.2 3 2.6L19 7"/><circle class="a" cx="19" cy="7" r="2"/>',
  chat: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><circle class="a" cx="8.5" cy="11" r="1.2"/><circle class="a" cx="12" cy="11" r="1.2"/><circle class="a" cx="15.5" cy="11" r="1.2"/>',
  gear: '<circle cx="12" cy="12" r="5.6"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/><circle class="a" cx="12" cy="12" r="2.2"/>',
  pin: '<path d="M12 21.2s-6.5-5.7-6.5-11.2a6.5 6.5 0 0 1 13 0c0 5.5-6.5 11.2-6.5 11.2z"/><circle class="a" cx="12" cy="10" r="2.5"/>',
  wind: '<path d="M3.5 8.5h9.8a2.6 2.6 0 1 0-2.6-2.6M3.5 12.5h14a2.6 2.6 0 1 1-2.6 2.6M3.5 16.5h6.5"/><circle class="a" cx="19.5" cy="8.5" r="1.5"/>',
  bars: '<path d="M4 20.5h16"/><rect x="5" y="11" width="3.6" height="9.5" rx="1"/><rect class="a" x="10.2" y="5" width="3.6" height="15.5" rx="1"/><rect x="15.4" y="13.5" width="3.6" height="7" rx="1"/>',
  // outcomes and findings
  extinguisher: '<rect x="8" y="9" width="8" height="12" rx="3"/><path d="M10.5 9V6h3v3M13.5 6h3.3l2.2 2.2"/><path class="h" d="M8 13h8v3.2H8z"/>',
  sphere: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="6.2" stroke-dasharray="1 3.3"/><circle class="a" cx="12" cy="12" r="3.6"/>',
  cool: '<circle cx="12" cy="12" r="8.6" stroke-dasharray="2.2 3"/><circle class="v" cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.6"/><path d="m20.2 20.2-4.4-4.4"/><circle class="a" cx="11" cy="11" r="2.5"/>',
  alert: '<path d="M12 3.6 21.4 20H2.6z"/><path d="M12 10v4.6"/><circle class="h" cx="12" cy="17.3" r="1.25"/>',
  check: '<circle cx="12" cy="12" r="8.6"/><path d="m8 12.4 2.8 2.8 5.4-5.6"/>',
  flask: '<path d="M9.5 3h5M10.5 3v5.6l-5 9a2 2 0 0 0 1.8 2.9h9.4a2 2 0 0 0 1.8-2.9l-5-9V3"/><path class="a" d="M8.2 15.6h7.6l1.5 2.7a.8.8 0 0 1-.7 1.2H7.4a.8.8 0 0 1-.7-1.2z"/>',
  // the steps
  station: '<rect x="9.5" y="9" width="5" height="6.5" rx="1.2"/><rect class="a" x="2.4" y="9.8" width="5.2" height="4.8" rx="0.8"/><rect class="a" x="16.4" y="9.8" width="5.2" height="4.8" rx="0.8"/><path d="M7.6 12.2h1.9M14.5 12.2h1.9M12 9V6.4M9.9 4.6a3 3 0 0 1 4.2 0M12 15.5v2.6"/>',
  drop: '<path d="M12 3.4s6.2 6.4 6.2 10.8a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.4 12 3.4z"/><circle class="a" cx="12" cy="14.4" r="2.5"/>',
  release: '<path d="M9 12H3M3 12l2.6-2.6M3 12l2.6 2.6M15 12h6M21 12l-2.6-2.6M21 12l-2.6 2.6"/><circle class="a" cx="12" cy="12" r="2.5"/>',
  bolt: '<path class="h" d="M13 2.6 5.2 13.4H11l-1 8 7.8-10.8H12z"/><path d="M13 2.6 5.2 13.4H11l-1 8 7.8-10.8H12z"/>',
  rocket: '<path d="M12 2.8c3 2.3 4.5 5.4 4.5 9v4.4h-9v-4.4c0-3.6 1.5-6.7 4.5-9z"/><path d="M7.5 13.5 5 16.6v2.6l2.5-1.5M16.5 13.5l2.5 3.1v2.6l-2.5-1.5"/><circle class="a" cx="12" cy="9.6" r="1.9"/><path class="h" d="M10.2 17.6h3.6L12 21.6z"/>',
  // the guide
  spark: '<path d="M11 3.2l1.9 5.4 5.4 1.9-5.4 1.9L11 17.8l-1.9-5.4-5.4-1.9 5.4-1.9z"/><path class="a" d="M18.4 14.6l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  book: '<path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v13H7.5A2.5 2.5 0 0 1 5 17.5z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H19"/><path class="a" d="M12.4 4.5H16v6.2l-1.8-1.5-1.8 1.5z"/>',
};

/** An icon as an <svg> element. Unknown names fall back to the sphere. */
export function ic(name, cls = '') {
  const holder = document.createElement('template');
  holder.innerHTML = `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.sphere}</svg>`;
  return holder.content.firstChild;
}
