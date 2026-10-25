/* Schematic symbol library (SVG strings). Two-terminal parts are placed between two points;
   multi-terminal parts document their pin coordinates next to each function. */
(function (PX) {
  'use strict';
  const f = n => Math.round(n * 10) / 10;
  const S = PX.sch = {};

  /* bodies drawn along +x, centred, nominal length 40 */
  const BODY = {
    res: () => `<path class="w" d="M-20 0 L-15 0 L-12.5 -6 L-7.5 6 L-2.5 -6 L2.5 6 L7.5 -6 L12.5 6 L15 0 L20 0"/>`,
    pot: () => BODY.res() + `<path class="w" d="M-12 10 L12 -10"/><path class="fillink" d="M12 -10 l-7 1 l4 5 z"/>`,
    cap: () => `<path class="w" d="M-20 0 H-3 M3 0 H20 M-3 -9 V9 M3 -9 V9"/>`,
    ecap: (o, a) => `<path class="w" d="M-20 0 H-3 M5 0 H20 M-3 -9 V9 M7 -9 Q1 0 7 9"/><text class="pin" x="-12" y="-5" transform="rotate(${-a} -12 -8)">+</text>`,
    diode: () => `<path class="w" d="M-20 0 H-7 M7 0 H20"/><path class="w fillink" d="M-7 -7 L7 0 L-7 7 Z"/><path class="w" d="M7 -7 V7"/>`,
    led: () => BODY.diode() + `<path class="w thin" d="M0 -10 l6 -7 M6 -10 l6 -7"/><path class="fillink" d="M6 -17 l-4 1 l2 2z M12 -17 l-4 1 l2 2z"/>`,
    ind: () => `<path class="w" d="M-20 0 H-14 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 7 0 a3.5 3.5 0 0 1 7 0 H20"/>`,
    vind: () => BODY.ind() + `<path class="w" d="M-12 9 L12 -11"/><path class="fillink" d="M12 -11 l-7 1 l4 5 z"/>`,
    fuse: () => `<path class="w" d="M-20 0 H20"/><rect class="w nofill" x="-11" y="-5" width="22" height="10" rx="2"/>`,
    sw: () => `<path class="w" d="M-20 0 H-9 M9 0 H20 M-7 -1 L9 -10"/><circle class="w nofill" cx="-8" cy="0" r="2"/><circle class="w nofill" cx="9" cy="0" r="2"/>`,
    jj: () => `<path class="w" d="M-20 0 H-7 M7 0 H20"/><rect class="w nofill" x="-7" y="-7" width="14" height="14"/><path class="w" d="M-7 -7 L7 7 M7 -7 L-7 7"/>`,
    att: (o, a) => `<path class="w" d="M-20 0 H-13 M13 0 H20"/><rect class="w part" x="-13" y="-9" width="26" height="18" rx="2"/><text class="tiny" text-anchor="middle" transform="rotate(${-a}) translate(0 3)">${o.v || 'dB'}</text>`,
    lpf: (o, a) => `<path class="w" d="M-20 0 H-13 M13 0 H20"/><rect class="w part" x="-13" y="-10" width="26" height="20" rx="2"/><g transform="rotate(${-a})"><path class="w thin" d="M-8 -3 h7 q3 0 4 3 l4 6 M-8 4 q2 -3 4 0 t4 0 t4 0"/></g>`,
    bpf: (o, a) => `<path class="w" d="M-20 0 H-13 M13 0 H20"/><rect class="w part" x="-13" y="-10" width="26" height="20" rx="2"/><g transform="rotate(${-a})"><path class="w thin" d="M-9 2 q4 -10 9 -10 q5 0 9 10 M-8 6 q2 -3 4 0 t4 0 t4 0"/></g>`,
    tline: (o, a) => `<path class="w" d="M-20 0 H-15 M15 0 H20"/><rect class="w part" x="-15" y="-5" width="30" height="10" rx="5"/><text class="tiny" text-anchor="middle" transform="rotate(${-a}) translate(0 -9)">${o.v || ''}</text>`,
    dcb: () => `<path class="w" d="M-20 0 H-3 M3 0 H20 M-3 -7 V7 M3 -7 V7"/><rect class="w nofill dash" x="-9" y="-11" width="18" height="22" rx="3"/>`
  };

  /* two-terminal part between (x1,y1) and (x2,y2). o: {ref, v, vid, side:'l'|'r', cls} */
  S.two = function (kind, x1, y1, x2, y2, o = {}) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), a = Math.atan2(dy, dx) * 180 / Math.PI;
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, vert = Math.abs(dy) > Math.abs(dx);
    let s = `<g class="${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''} transform="translate(${f(cx)} ${f(cy)}) rotate(${f(a)})">`;
    if (L > 40) s += `<path class="w" d="M${f(-L / 2)} 0 H-20 M20 0 H${f(L / 2)}"/>`;
    s += BODY[kind](o, a) + '</g>';
    const left = o.side === 'l';
    if (o.ref) s += vert ? `<text class="ref" x="${f(cx + (left ? -13 : 13))}" y="${f(cy - 3)}" text-anchor="${left ? 'end' : 'start'}">${o.ref}</text>` : `<text class="ref" x="${f(cx)}" y="${f(cy - 13)}" text-anchor="middle">${o.ref}</text>`;
    if (o.v && kind !== 'att' && kind !== 'tline') s += vert ? `<text class="val" ${o.vid ? `id="${o.vid}"` : ''} x="${f(cx + (left ? -13 : 13))}" y="${f(cy + 10)}" text-anchor="${left ? 'end' : 'start'}">${o.v}</text>` : `<text class="val" ${o.vid ? `id="${o.vid}"` : ''} x="${f(cx)}" y="${f(cy + 21)}" text-anchor="middle">${o.v}</text>`;
    return s;
  };

  S.wire = (pts, cls = '', id = '') => `<path class="w ${cls}" ${id ? `id="${id}"` : ''} d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join(' L')}"/>`;
  /* animated conventional-current overlay; speed set later via style.animationDuration */
  S.flow = (pts, id) => `<path class="flow" id="${id}" d="M${pts.map(p => f(p[0]) + ' ' + f(p[1])).join(' L')}"/>`;
  S.dot = (x, y) => `<circle class="dot" cx="${x}" cy="${y}" r="2.6"/>`;
  S.gnd = (x, y) => `<path class="w" d="M${x} ${y} v6 M${x - 9} ${y + 6} h18 M${x - 6} ${y + 10} h12 M${x - 3} ${y + 14} h6"/>`;
  S.rail = (x, y, label) => `<path class="w" d="M${x} ${y} v-8 M${x - 8} ${y - 8} h16"/><text class="lab" x="${x}" y="${y - 12}" text-anchor="middle">${label}</text>`;
  S.text = (x, y, t, cls = 'lab', anchor = 'start', id = '') => `<text class="${cls}" ${id ? `id="${id}"` : ''} x="${x}" y="${y}" text-anchor="${anchor}">${t}</text>`;
  /* live probe flag: test-point tag at the end of a leader from node (x,y) offset by (dx,dy); value updated by id */
  S.flag = (x, y, dx, dy, tp, id, w = 96) => {
    const ex = x + dx, ey = y + dy, x0 = dx >= 0 ? ex : ex - w;
    return `<g class="flag"><path class="w thin dash" d="M${x} ${y} L${ex} ${ey}"/><circle class="dot" cx="${x}" cy="${y}" r="2.2"/><rect x="${x0}" y="${ey - 10}" width="${w}" height="20" rx="10"/><text class="flag-tp" x="${x0 + 9}" y="${ey + 4}">${tp}</text><text class="flag-v" id="${id}" x="${x0 + w - 8}" y="${ey + 4}" text-anchor="end">—</text></g>`;
  };
  S.box = (x, y, w, h, title, sub, cls = '') => `<g class="${cls}"><rect class="w part" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>${title ? `<text class="ic" x="${x + w / 2}" y="${y + h / 2 + (sub ? -2 : 4)}" text-anchor="middle">${title}</text>` : ''}${sub ? `<text class="tiny" x="${x + w / 2}" y="${y + h / 2 + 11}" text-anchor="middle">${sub}</text>` : ''}</g>`;
  /* pin label inside an IC box */
  S.pin = (x, y, n, label, side) => {
    const L = side === 'l' ? [x - 10, x] : side === 'r' ? [x, x + 10] : null;
    if (L) return `<path class="w" d="M${L[0]} ${y} H${L[1]}"/><text class="pinno" x="${side === 'l' ? x - 6 : x + 6}" y="${y - 3}" text-anchor="middle">${n}</text><text class="pinl" x="${side === 'l' ? x + 4 : x - 4}" y="${y + 3}" text-anchor="${side === 'l' ? 'start' : 'end'}">${label}</text>`;
    const V = side === 't' ? [y - 10, y] : [y, y + 10];
    return `<path class="w" d="M${x} ${V[0]} V${V[1]}"/><text class="pinno" x="${x + 3}" y="${side === 't' ? y - 4 : y + 9}">${n}</text><text class="pinl" x="${x}" y="${side === 't' ? y + 10 : y - 4}" text-anchor="middle">${label}</text>`;
  };

  /* NPN: base (x-18,y) · collector (x+8,y-22) · emitter (x+8,y+22). o.photo adds incoming light arrows */
  S.npn = (x, y, o = {}) => `<circle class="w part" cx="${x + 2}" cy="${y}" r="14"/><path class="w" d="${o.photo ? '' : `M${x - 18} ${y} H${x - 4} `}M${x - 4} ${y - 9} V${y + 9} M${x - 4} ${y - 4} L${x + 8} ${y - 13} V${y - 22} M${x - 4} ${y + 4} L${x + 8} ${y + 13} V${y + 22}"/><path class="fillink" d="M${x + 8} ${y + 13} l-7 -1 l3 -5z"/>`
    + (o.photo ? `<path class="w thin" d="M${x - 26} ${y - 22} l10 9 M${x - 20} ${y - 26} l10 9"/><path class="fillink" d="M${x - 16} ${y - 13} l-4 0 l2 -3z M${x - 10} ${y - 17} l-4 0 l2 -3z"/>` : '')
    + (o.ref ? `<text class="ref" x="${x + 20}" y="${y - 2}">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x + 20}" y="${y + 10}">${o.v}</text>` : '');
  /* transformer: P1 (x-12,y-24) P2 (x-12,y+24) S1 (x+12,y-24) S2 (x+12,y+24) */
  S.xfmr = (x, y, o = {}) => {
    const coil = (cx, sweep) => `<path class="w" d="M${cx} ${y - 24} v4 a4 4 0 0 ${sweep} 0 8 a4 4 0 0 ${sweep} 0 8 a4 4 0 0 ${sweep} 0 8 a4 4 0 0 ${sweep} 0 8 a4 4 0 0 ${sweep} 0 8 v4"/>`;
    return coil(x - 12, 1) + coil(x + 12, 0) + `<path class="w" d="M${x - 2} ${y - 22} V${y + 22} M${x + 2} ${y - 22} V${y + 22}"/>`
      + `<circle class="dot" cx="${x - 18}" cy="${y - 18}" r="1.8"/><circle class="dot" cx="${x + 18}" cy="${y - 18}" r="1.8"/>`
      + (o.ref ? `<text class="ref" x="${x}" y="${y + 40}" text-anchor="middle">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x}" y="${y + 51}" text-anchor="middle">${o.v}</text>` : '');
  };
  /* bridge rectifier: AC1 top (x,y-s) · AC2 bottom (x,y+s) · + right (x+s,y) · − left (x-s,y) */
  S.bridge = (x, y, s = 28, o = {}) => {
    const T = [x, y - s], R = [x + s, y], B = [x, y + s], L = [x - s, y];
    const d = (p, q) => { const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, a = Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI; return `<g transform="translate(${mx} ${my}) rotate(${f(a)})"><path class="fillink" d="M-5 -5 L5 0 L-5 5Z"/><path class="w" d="M5 -5 V5"/></g>`; };
    return `<path class="w" d="M${L} L${T} L${R} L${B} Z"/>` + d(L, T) + d(T, R) + d(L, B) + d(B, R)
      + `<text class="tiny" x="${x + s + 4}" y="${y - 4}">+</text><text class="tiny" x="${x - s - 10}" y="${y - 4}">−</text>`
      + (o.ref ? `<text class="ref" x="${x}" y="${y + s + 16}" text-anchor="middle">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x}" y="${y + s + 27}" text-anchor="middle">${o.v}</text>` : '');
  };
  /* amplifier triangle: in (x-16,y) · out (x+16,y) */
  S.amp = (x, y, o = {}) => `<path class="w part" d="M${x - 16} ${y - 16} L${x + 16} ${y} L${x - 16} ${y + 16} Z"/>`
    + (o.t ? `<text class="tiny" x="${x - 6}" y="${y + 3}" text-anchor="middle">${o.t}</text>` : '')
    + (o.ref ? `<text class="ref" x="${x}" y="${y - 20}" text-anchor="middle">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x}" y="${y + 29}" text-anchor="middle" ${o.vid ? `id="${o.vid}"` : ''}>${o.v}</text>` : '');
  /* op-amp style (LM386): +in (x-16,y+8) · −in (x-16,y-8) · out (x+16,y) */
  S.opamp = (x, y, o = {}) => S.amp(x, y, o) + `<text class="pin" x="${x - 13}" y="${y - 5}">−</text><text class="pin" x="${x - 13}" y="${y + 11}">+</text>`;
  /* Schmitt inverter: in (x-14,y) · out (x+18,y) */
  S.inv = (x, y, o = {}) => `<path class="w part" d="M${x - 14} ${y - 11} L${x + 9} ${y} L${x - 14} ${y + 11} Z"/><circle class="w part" cx="${x + 12}" cy="${y}" r="3"/><path class="w thin" d="M${x - 10} ${y + 3} h4 v-6 h4 M${x - 8} ${y + 3} h4 v-6 h4"/><path class="w" d="M${x + 15} ${y} h3"/>`
    + (o.ref ? `<text class="ref" x="${x - 2}" y="${y - 15}" text-anchor="middle">${o.ref}</text>` : '');
  /* IQ mixer: L (x-14,y) · R (x+14,y) · LO (x,y+14) */
  S.mixer = (x, y, o = {}) => `<circle class="w part" cx="${x}" cy="${y}" r="14"/><path class="w" d="M${x - 10} ${y - 10} L${x + 10} ${y + 10} M${x + 10} ${y - 10} L${x - 10} ${y + 10}"/>`
    + (o.ref ? `<text class="ref" x="${x}" y="${y - 19}" text-anchor="middle">${o.ref}</text>` : '');
  /* sine source: top (x,y-14) · bottom (x,y+14) */
  S.src = (x, y, o = {}) => `<circle class="w part" cx="${x}" cy="${y}" r="14"/><path class="w" d="M${x - 8} ${y} q4 -9 8 0 t8 0"/>`
    + (o.ref ? `<text class="ref" x="${x + (o.side === 'l' ? -19 : 19)}" y="${y - 2}" text-anchor="${o.side === 'l' ? 'end' : 'start'}">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x + (o.side === 'l' ? -19 : 19)}" y="${y + 10}" text-anchor="${o.side === 'l' ? 'end' : 'start'}">${o.v}</text>` : '');
  /* circulator: L (x-12,y) · R (x+12,y) · B (x,y+12) */
  S.circ = (x, y, o = {}) => `<circle class="w part" cx="${x}" cy="${y}" r="12"/><path class="w thin" d="M${x - 6} ${y - 4} A7 7 0 1 1 ${x - 4} ${y + 6}"/><path class="fillink" d="M${x - 4} ${y + 6} l-1 -5 l4 2z"/>`
    + (o.ref ? `<text class="ref" x="${x}" y="${y - 16}" text-anchor="middle">${o.ref}</text>` : '');
  /* speaker: terminals (x-10,y-6) (x-10,y+6) */
  S.speaker = (x, y, o = {}) => `<rect class="w part" x="${x - 6}" y="${y - 9}" width="8" height="18"/><path class="w part" d="M${x + 2} ${y - 9} L${x + 14} ${y - 18} V${y + 18} L${x + 2} ${y + 9}"/><path class="w" d="M${x - 10} ${y - 6} H${x - 6} M${x - 10} ${y + 6} H${x - 6}"/>`
    + (o.ref ? `<text class="ref" x="${x + 4}" y="${y + 32}" text-anchor="middle">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x + 4}" y="${y + 43}" text-anchor="middle">${o.v}</text>` : '');
  /* SQUID: two Josephson junctions in a loop. top (x,y-30) · bottom (x,y+30); loop half-width 16 */
  S.squid = (x, y, o = {}) => `<path class="w" d="M${x} ${y - 30} V${y - 20} M${x - 16} ${y - 20} H${x + 16} M${x - 16} ${y + 20} H${x + 16} M${x} ${y + 20} V${y + 30}"/>`
    + S.two('jj', x - 16, y - 20, x - 16, y + 20) + S.two('jj', x + 16, y - 20, x + 16, y + 20)
    + `<text class="tiny" x="${x}" y="${y + 4}" text-anchor="middle">Φ</text>`
    + (o.ref ? `<text class="ref" x="${x + 24}" y="${y - 2}">${o.ref}</text>` : '') + (o.v ? `<text class="val" x="${x + 24}" y="${y + 10}" ${o.vid ? `id="${o.vid}"` : ''}>${o.v}</text>` : '');
  /* chopper wheel slice between an LED and a photo-transistor */
  S.chopper = (x, y, id) => `<g ${id ? `id="${id}"` : ''}><rect class="chop" x="${x - 4}" y="${y - 26}" width="8" height="52" rx="2"/>${[...Array(5)].map((_, i) => `<rect class="chop-slot" x="${x - 4}" y="${y - 22 + i * 10}" width="8" height="5"/>`).join('')}</g>`;
  S.arrow = (x1, y1, x2, y2, cls = '') => { const a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI; return `<path class="w thin ${cls}" d="M${x1} ${y1} L${x2} ${y2}"/><path class="fillink ${cls}" transform="translate(${x2} ${y2}) rotate(${f(a)})" d="M0 0 l-7 -3.5 v7z"/>`; };

  /* helper: set an SVG text by id if present */
  S.set = (id, txt) => { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; };
  /* helper: conventional current animation speed (amps → seconds per dash cycle) */
  S.speed = (id, amps) => { const el = document.getElementById(id); if (!el) return; const a = Math.abs(amps); el.style.animationDuration = a < 1e-3 ? '0s' : Math.max(0.15, 1.2 / Math.sqrt(a)).toFixed(2) + 's'; el.style.opacity = a < 1e-3 ? 0 : 1; };
})(window.PX);
