/* Circuit · linear power supply: schematic with live test points and current flow, real-board (PCB) view,
   load / C1 / heat sink controls, regulator temperature and thermal shutdown */
(function (PX) {
  'use strict';
  const { U, S, C, sch } = PX, { $, $$ } = U;

  PX.bindRange = function (id, out, fn, fmt, after) {
    const el = $('#' + id), o = $('#' + out);
    const go = () => { const v = parseFloat(el.value); fn(v); o.textContent = fmt(v); (after || PX.recalc)(); };
    el.addEventListener('input', go); fn(parseFloat(el.value)); o.textContent = fmt(parseFloat(el.value));
    return el;
  };
  PX.bindRange('s-load', 'o-load', v => S.load = v, v => v.toFixed(2) + ' A');
  PX.bindRange('s-cap', 'o-cap', v => S.capIdx = v, v => C.CAPS[v] + ' µF');
  const hs = $('#s-hs-sink');
  hs.innerHTML = C.HEATSINKS.map((h, i) => `<option value="${i}">${h.n}</option>`).join(''); hs.value = S.heatsink;
  hs.addEventListener('change', () => { S.heatsink = +hs.value; PX.recalc(); });

  /* ---------- schematic ---------- */
  function schematic() {
    const G = 196; let h = '';
    h += sch.src(36, 110, { ref: 'J1', v: '220V~ 60Hz', side: 'l' });
    h += sch.wire([[36, 96], [36, 50], [52, 50]]) + sch.two('fuse', 52, 50, 100, 50, { ref: 'F1', v: 'T500mA' }) + sch.two('sw', 100, 50, 140, 50, { ref: 'S1', v: 'POWER' });
    h += sch.wire([[140, 50], [148, 50], [148, 86]]) + sch.wire([[36, 124], [36, 170], [148, 170], [148, 134]]);
    h += sch.xfmr(160, 110, { ref: 'T1', v: '220V : 9V 30VA' });
    h += sch.wire([[172, 86], [172, 60], [250, 60], [250, 82]]) + sch.wire([[172, 134], [172, 160], [250, 160], [250, 138]]);
    h += sch.bridge(250, 110, 28, { ref: 'BR1', v: 'KBP206' });
    h += sch.wire([[222, 110], [205, 110], [205, G]]);
    h += sch.wire([[278, 110], [410, 110]]) + sch.dot(320, 110) + sch.dot(368, 110);
    h += sch.two('ecap', 320, 110, 320, G, { ref: 'C1', v: '4700µF', vid: 'sch-c1v' });
    h += sch.two('cap', 368, 110, 368, G, { ref: 'C3', v: '0.33µ' });
    h += `<rect class="w nofill dash" x="402" y="74" width="96" height="70" rx="6"/><text class="tiny" x="494" y="70" text-anchor="end">HS1 방열판</text>`;
    h += `<g id="sch-u1">` + sch.box(410, 88, 80, 44, '7805', 'U1 L7805CV') + `</g>`;
    h += sch.text(414, 106, 'IN', 'pinl') + sch.text(486, 106, 'OUT', 'pinl', 'end') + sch.text(450, 129, 'GND', 'pinl', 'middle');
    h += sch.text(410, 174, '—', 'val', 'start', 'sch-u1t');
    h += sch.wire([[450, 132], [450, G]]);
    h += sch.wire([[490, 110], [640, 110]]) + sch.dot(520, 110) + sch.dot(560, 110) + sch.dot(600, 110);
    h += sch.two('cap', 520, 110, 520, G, { ref: 'C2', v: '0.1µF' });
    h += sch.two('ecap', 560, 110, 560, G, { ref: 'C4', v: '100µF' });
    h += sch.two('res', 600, 110, 600, 150, { ref: 'R1', v: '330Ω' }) + `<g id="sch-led">` + sch.two('led', 600, 150, 600, G, { ref: 'D5', v: 'PWR' }) + `</g>`;
    h += sch.two('res', 640, 110, 640, G, {});
    h += sch.wire([[205, G], [640, G]]) + sch.gnd(420, G) + sch.text(530, 104, '+5V', 'lab');
    h += sch.text(286, 104, 'VRAW', 'lab');
    h += sch.flow([[278, 110], [410, 110]], 'fl-psu1') + sch.flow([[490, 110], [640, 110], [640, G]], 'fl-psu2') + sch.flow([[640, G], [205, G], [205, 110], [222, 110]], 'fl-psu3') + sch.flow([[600, 110], [600, G]], 'fl-psu4');
    h += sch.flag(320, 110, -48, -46, 'TP1', 'sch-tp1', 118) + sch.flag(520, 110, 8, -42, 'TP2', 'sch-tp2', 92) + sch.flag(640, 150, -26, 36, 'RL 부하', 'sch-il', 104);
    return `<svg class="schem" viewBox="0 0 660 230" role="img" aria-label="선형 전원부 회로도">${h}</svg>`;
  }

  /* ---------- real board (top view) ---------- */
  function board() {
    const band = (x, y, cols) => cols.map((c, i) => `<rect x="${x + 6 + i * 6}" y="${y - 5}" width="3.4" height="10" fill="${c}"/>`).join('');
    let h = `<defs>
      <linearGradient id="pcb-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b9ead6"/><stop offset="1" stop-color="#9fdcc4"/></linearGradient>
      <linearGradient id="cu-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3c9a4"/><stop offset="1" stop-color="#d9a07a"/></linearGradient>
      <linearGradient id="al-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9e6f0"/><stop offset=".5" stop-color="#c9c3d6"/><stop offset="1" stop-color="#e9e6f0"/></linearGradient>
      <radialGradient id="cap-top" cx=".4" cy=".35"><stop offset="0" stop-color="#f2f0f7"/><stop offset="1" stop-color="#bdb6cc"/></radialGradient>
      <radialGradient id="led-g" cx=".4" cy=".35"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#9ff3cc"/><stop offset="1" stop-color="#4fbf8f"/></radialGradient>
      <linearGradient id="core-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e889e"/><stop offset="1" stop-color="#6f6980"/></linearGradient>
      <linearGradient id="wind-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9935f"/><stop offset=".5" stop-color="#f3c9a4"/><stop offset="1" stop-color="#d9935f"/></linearGradient>
    </defs>`;
    h += `<rect x="6" y="6" width="648" height="248" rx="14" fill="url(#pcb-g)" stroke="#6fb99a" stroke-width="2"/>`;
    [[22, 22], [638, 22], [22, 238], [638, 238]].forEach(([x, y]) => h += `<circle cx="${x}" cy="${y}" r="8" fill="#f6f4fa" stroke="#e9b38c" stroke-width="3"/>`);
    /* copper traces */
    const tr = (d, w = 7) => `<path d="${d}" fill="none" stroke="url(#cu-g)" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    h += tr('M232 118 H300 V128 H360 V140 H440') + tr('M232 158 H260 V210 H600') + tr('M470 140 H520 V120 H612', 8) + tr('M455 160 V210', 6);
    h += tr('M140 120 H190 V122 H200', 4) + tr('M140 150 H190 V156 H200', 4);
    h += sch.flow([[232, 118], [300, 118], [300, 128], [360, 128], [360, 140], [440, 140]], 'fl-pcb1') + sch.flow([[470, 140], [520, 140], [520, 120], [612, 120]], 'fl-pcb2') + sch.flow([[600, 210], [260, 210], [260, 158], [232, 158]], 'fl-pcb3');
    /* J1 inlet + F1 fuse */
    h += `<rect x="14" y="98" width="46" height="72" rx="6" fill="#4a4458"/><rect x="22" y="110" width="30" height="48" rx="4" fill="#2a2633"/>${[120, 134, 148].map(y => `<rect x="30" y="${y}" width="14" height="5" rx="1" fill="#d7d3df"/>`).join('')}<text class="pcb-silk" x="37" y="186" text-anchor="middle">J1 220V~</text>`;
    h += `<rect x="70" y="58" width="56" height="18" rx="3" fill="#d7d3df"/><rect x="78" y="61" width="40" height="12" rx="6" fill="rgba(255,255,255,.75)" stroke="#9f95bb"/><path d="M80 67 q10 -4 20 0 t16 0" stroke="#8c84a2" fill="none"/><text class="pcb-silk" x="98" y="52" text-anchor="middle">F1 T500mA</text>`;
    h += `<path d="M60 112 C90 112 80 70 70 68 M126 67 C150 67 150 105 140 120" stroke="#f2a3bb" stroke-width="4" fill="none"/><path d="M60 156 C90 156 120 150 140 150" stroke="#5b5577" stroke-width="4" fill="none"/>`;
    /* T1 transformer */
    h += `<rect x="134" y="92" width="64" height="88" rx="4" fill="url(#core-g)"/>${[...Array(10)].map((_, i) => `<rect x="134" y="${96 + i * 8}" width="64" height="1" fill="rgba(255,255,255,.18)"/>`).join('')}<rect x="146" y="104" width="40" height="64" rx="6" fill="url(#wind-g)"/><rect x="150" y="128" width="32" height="14" rx="2" fill="#fbf7ff"/><text x="166" y="138" text-anchor="middle" font-size="9" font-family="IBM Plex Mono" fill="#3a3550">9V 30VA</text><text class="pcb-silk" x="166" y="196" text-anchor="middle">T1</text>`;
    h += `<path d="M198 122 H206" stroke="#ffe39a" stroke-width="4"/><path d="M198 156 H206" stroke="#ffe39a" stroke-width="4"/>`;
    /* BR1 */
    h += `<rect x="206" y="112" width="30" height="52" rx="3" fill="#34303f"/><text x="221" y="132" text-anchor="middle" font-size="7" font-family="IBM Plex Mono" fill="#e8e3f6" transform="rotate(-90 221 132)">KBP206</text><text class="pcb-silk" x="221" y="180" text-anchor="middle">BR1</text><text x="240" y="122" font-size="9" fill="#3a3550">+</text><text x="240" y="162" font-size="9" fill="#3a3550">−</text>`;
    /* C1 electrolytic (top view) */
    h += `<circle cx="300" cy="80" r="34" fill="#b6a6ef" stroke="#8a79cc" stroke-width="2"/><path d="M300 46 A34 34 0 0 1 334 80 L322 80 A22 22 0 0 0 300 58 Z" fill="#e8e1ff"/><text x="314" y="64" font-size="10" fill="#6a59b8">−</text><circle cx="300" cy="80" r="22" fill="url(#cap-top)"/><path d="M290 70 L310 90 M310 70 L290 90 M300 66 V94" stroke="#9f95bb" stroke-width="1.5"/>`;
    h += `<text x="300" y="128" text-anchor="middle" font-size="9" font-family="IBM Plex Mono" fill="#3a3550" id="pcb-c1">4700µF 25V</text><text class="pcb-silk" x="262" y="44">C1</text>`;
    /* C3 film */
    h += `<rect x="352" y="112" width="24" height="12" rx="3" fill="#ffe39a" stroke="#c9a34a"/><text class="pcb-silk" x="364" y="106" text-anchor="middle">C3</text>`;
    /* heatsink + U1 */
    h += `<g id="pcb-hs"><rect x="420" y="40" width="80" height="86" rx="3" fill="url(#al-g)" stroke="#9f95bb"/>${[...Array(9)].map((_, i) => `<rect x="${424 + i * 8.6}" y="40" width="3" height="86" fill="rgba(90,80,120,.22)"/>`).join('')}<rect id="pcb-heat" x="420" y="40" width="80" height="86" rx="3" fill="#ff7d9c" opacity="0"/></g>`;
    h += `<rect x="436" y="78" width="48" height="16" rx="2" fill="#d7d3df"/><circle cx="460" cy="86" r="5" fill="#9f95bb"/><rect x="436" y="94" width="48" height="34" rx="2" fill="#2f2b3d"/><text x="460" y="108" text-anchor="middle" font-size="8.5" font-family="IBM Plex Mono" fill="#e8e3f6">L7805CV</text><text x="460" y="120" text-anchor="middle" font-size="7" font-family="IBM Plex Mono" fill="#a59fb8" id="pcb-u1t">40°C</text>`;
    h += [446, 460, 474].map(x => `<rect x="${x - 2}" y="128" width="4" height="22" fill="#c9c3d6"/>`).join('') + `<text class="pcb-silk" x="508" y="58">U1</text><text class="pcb-silk" x="508" y="72">HS1</text>`;
    /* C2 ceramic, C4 electrolytic */
    h += `<ellipse cx="520" cy="160" rx="10" ry="7" fill="#b3dcf6" stroke="#6fa8cf"/><text x="520" y="163" text-anchor="middle" font-size="6" fill="#3a3550">104</text><text class="pcb-silk" x="520" y="182" text-anchor="middle">C2</text>`;
    h += `<circle cx="560" cy="160" r="13" fill="#cdbdff" stroke="#8a79cc"/><circle cx="560" cy="160" r="8" fill="url(#cap-top)"/><text class="pcb-silk" x="560" y="186" text-anchor="middle">C4</text>`;
    /* R1 + LED */
    h += `<path d="M560 66 H578 M622 66 H632" stroke="#c9c3d6" stroke-width="2"/><rect x="578" y="60" width="44" height="12" rx="6" fill="#f3e2c4" stroke="#c9a77a"/>${band(578, 66, ['#f0a050', '#f0a050', '#8b5a3c', '#d4af37'])}<text class="pcb-silk" x="600" y="54" text-anchor="middle">R1 330Ω</text>`;
    h += `<circle id="pcb-led-glow" cx="600" cy="96" r="22" fill="#9ff3cc" opacity=".0"/><circle cx="600" cy="96" r="9" fill="url(#led-g)" stroke="#4fbf8f"/><text class="pcb-silk" x="616" y="100">D5</text>`;
    /* J2 output terminal */
    h += `<rect x="604" y="190" width="40" height="40" rx="4" fill="#b3dcf6" stroke="#6fa8cf"/><circle cx="614" cy="210" r="6" fill="#d7d3df" stroke="#8c84a2"/><circle cx="634" cy="210" r="6" fill="#d7d3df" stroke="#8c84a2"/><path d="M610 210 h8 M630 210 h8" stroke="#8c84a2"/><text class="pcb-silk" x="624" y="186" text-anchor="middle">J2 +5V GND</text>`;
    h += `<text class="pcb-silk" x="30" y="240">PASTELLA PSU-84 REV.C · 9V/5V 3A</text><text class="pcb-silk" x="370" y="240" id="pcb-il">I = 1.00 A</text>`;
    return `<svg class="schem pcb" viewBox="0 0 660 260" role="img" aria-label="전원부 실물 보드">${h}</svg>`;
  }

  let view = U.store.get('psu-view', 'sch');
  function setView(v) {
    view = v; U.store.set('psu-view', v);
    $('#psu-schem').innerHTML = v === 'sch' ? schematic() : board();
    $$('#psu-view button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
    live(true);
  }
  $('#psu-view').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });

  function render() {
    const P = PX.P;
    $('#r-vpk').textContent = P.vpk.toFixed(2) + ' V';
    $('#r-rip').textContent = Math.min(P.rip, P.vpk).toFixed(2) + ' V';
    $('#r-vmin').textContent = Math.max(0, P.vmin).toFixed(2) + ' V';
    $('#r-pd').textContent = P.pd.toFixed(1) + ' W';
    const pp = $('#psu-pill');
    if (!PX.mainsOn()) { pp.className = 'pill warn'; pp.textContent = '전원 꺼짐'; }
    else if (S.trip) { pp.className = 'pill bad'; pp.textContent = '열 차단 · +5V 꺼짐'; }
    else if (P.dropout) { pp.className = 'pill bad'; pp.textContent = '드롭아웃 · +5V 불안정'; }
    else if (P.vmin < 7.6) { pp.className = 'pill warn'; pp.textContent = '여유 전압 부족'; }
    else { pp.className = 'pill ok'; pp.textContent = '정상 레귤레이션'; }
    live(true);
  }
  /* live labels on the drawing */
  let lt = 0;
  function live(force) {
    const P = PX.P, on = PX.mainsOn(), logic = PX.logicOn();
    const v5 = !logic ? 0 : P.dropout ? Math.max(0, P.vmin - 2) : 5, I = logic ? S.load : 0;
    if (view === 'sch') {
      sch.set('sch-tp1', on ? `${P.vavg.toFixed(1)}V ~${Math.min(P.rip, P.vpk).toFixed(2)}Vpp` : '0 V');
      sch.set('sch-tp2', `${v5.toFixed(2)} V`);
      sch.set('sch-il', `${I.toFixed(2)} A`);
      sch.set('sch-c1v', C.CAPS[S.capIdx] + 'µF');
      sch.set('sch-u1t', `Tj ${S.tReg.toFixed(0)}°C · ${P.pd.toFixed(1)}W`);
      const u = $('#sch-u1'); if (u) u.classList.toggle('hot', S.tReg > 100);
      const led = $('#sch-led'); if (led) led.classList.toggle('lit', v5 > 3);
      sch.speed('fl-psu1', I); sch.speed('fl-psu2', I); sch.speed('fl-psu3', I); sch.speed('fl-psu4', v5 > 3 ? 0.01 : 0);
    } else {
      sch.set('pcb-c1', C.CAPS[S.capIdx] + 'µF 25V'); sch.set('pcb-u1t', S.tReg.toFixed(0) + '°C'); sch.set('pcb-il', `I = ${I.toFixed(2)} A · +5V ${v5.toFixed(2)} V`);
      const heat = $('#pcb-heat'); if (heat) heat.setAttribute('opacity', U.clamp((S.tReg - 45) / 110, 0, 0.6).toFixed(2));
      const g = $('#pcb-led-glow'); if (g) g.setAttribute('opacity', v5 > 3 ? '0.55' : '0');
      sch.speed('fl-pcb1', I); sch.speed('fl-pcb2', I); sch.speed('fl-pcb3', I);
    }
  }
  function thermo() {
    const T = S.tReg, steady = C.T_AMB + PX.P.pd * (C.THETA_JC + C.HEATSINKS[S.heatsink].r);
    $('#thermo-fill').style.width = U.clamp(T / 150 * 100, 0, 100) + '%';
    $('#r-temp').textContent = T.toFixed(0) + ' °C';
    $('#r-tss').textContent = S.trip ? '냉각 중 → 95 °C에서 재기동' : '정상상태 ' + steady.toFixed(0) + ' °C' + (steady >= C.T_TRIP ? ' · 차단 예상' : '');
  }
  PX.on('params', render); PX.on('power', render);
  setView(view); render();
  PX.addFrame('circuit', dt => {
    if (PX.circuitMode !== 'classic') return;
    thermo(); lt += dt; if (lt > 0.2) { lt = 0; live(); }
    PX.drawMini($('#mini-psu'), [{ f: PX.SIG.psu_raw.f, col: U.css('--ph1'), label: 'TP1 C1' }, { f: PX.SIG.psu_5v.f, col: U.css('--ph2'), label: 'TP2 +5V', lx: 62 }], PX.now(), 0.03, 0, 13);
  });
})(window.PX);
