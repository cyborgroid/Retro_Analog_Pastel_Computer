/* Circuit (quantum) · transmon qubit: lumped-element schematic, chip layout view, potential well with energy levels,
   flux tuning curve, calibration */
(function (PX) {
  'use strict';
  const { U, S, Q, sch } = PX, { $, $$ } = U;

  PX.qCalibrate = () => { Q.fdCal = PX.qf01(); Q.fdOffMHz = 0; Q.amp = Q.ampPi; PX.qrecalc(); PX.emit('qcal'); PX.logEvt && PX.logEvt(`QPU 재보정 · fd = ${Q.fdCal.toFixed(4)} GHz · π 진폭 1.00`); };

  function bindQ(id, out, key, fmt) {
    const el = $('#' + id), o = $('#' + out);
    el.value = Q[key]; o.textContent = fmt(Q[key]);
    el.addEventListener('input', () => { Q[key] = parseFloat(el.value); o.textContent = fmt(Q[key]); PX.qrecalc(); });
    PX.on('qcal', () => { el.value = Q[key]; o.textContent = fmt(Q[key]); });
  }
  bindQ('q-flux', 'o-q-flux', 'flux', v => (v >= 0 ? '+' : '') + v.toFixed(3) + ' Φ₀');
  bindQ('q-ej', 'o-q-ej', 'EJ', v => v.toFixed(1) + ' GHz');
  bindQ('q-ec', 'o-q-ec', 'EC', v => (v * 1000).toFixed(0) + ' MHz');
  $('#q-cal').addEventListener('click', PX.qCalibrate);

  function schematic() {
    const G = 206; let h = '';
    h += sch.text(8, 66, 'XY 구동', 'lab') + sch.text(8, 78, '(제어 체인)', 'tiny') + sch.wire([[56, 70], [70, 70]]);
    h += sch.two('cap', 70, 70, 120, 70, { ref: 'Cd', v: '0.1 fF' }) + sch.wire([[120, 70], [270, 70]]) + sch.dot(180, 70) + sch.dot(240, 70);
    h += sch.wire([[180, 70], [180, 100]]) + sch.squid(180, 130, { ref: 'SQUID', v: 'EJ —', vid: 'q-s-ej' }) + sch.wire([[180, 160], [180, G]]);
    h += sch.text(8, 126, 'Z 플럭스', 'lab') + sch.wire([[56, 130], [76, 130]]) + sch.two('ind', 76, 130, 124, 130, { ref: 'Lfl' }) + sch.wire([[124, 130], [140, 130]]) + sch.gnd(140, 130);
    h += sch.text(150, 118, 'M', 'ref') + `<path class="w thin dash" d="M128 122 Q145 112 160 120"/>`;
    h += sch.two('cap', 240, 70, 240, G, { ref: 'CΣ', v: 'EC —', vid: 'q-s-ec' });
    h += sch.two('cap', 270, 70, 320, 70, { ref: 'Cg', v: 'g 100 MHz' });
    h += sch.two('tline', 320, 70, 440, 70, { v: 'λ/4 CPW' }) + sch.text(380, 96, 'fr —', 'val', 'middle', 'q-s-fr');
    h += sch.wire([[440, 70], [452, 70]]) + sch.gnd(452, 70);
    h += sch.two('cap', 345, 70, 345, 150, { ref: 'Ck', v: 'κ 1 MHz', side: 'l' });
    h += sch.wire([[290, 150], [470, 150]]) + sch.arrow(456, 150, 476, 150) + sch.text(292, 168, '피드라인 (판독 IN → OUT)', 'tiny');
    h += sch.wire([[120, G], [250, G]]) + sch.gnd(200, G);
    h += sch.flag(180, 70, -20, -42, 'f01', 'q-s-f01', 124);
    h += `<rect class="w nofill dash" x="482" y="30" width="170" height="168" rx="8"/>`;
    ['트랜스몬 해밀토니안', 'H = 4EC(n − ng)²', '      − EJ(Φ)·cos φ', 'EJ(Φ) = EJmax·|cos πΦ/Φ₀|', 'f01 ≈ √(8·EJ·EC) − EC', 'α ≈ −EC (비조화성)', 'χ ≈ g²/Δ · α/(Δ+α)'].forEach((t, i) => h += sch.text(492, 52 + i * 21, t, i ? 'tiny mono' : 'ref'));
    return `<svg class="schem" viewBox="0 0 660 230" role="img" aria-label="트랜스몬 회로도">${h}</svg>`;
  }

  /* chip layout (top view): Xmon crosses, readout meanders, flux/XY lines, wire-bond pads */
  const XQ = [[150, 160], [290, 160], [430, 160], [290, 262], [150, 262]];
  function chip() {
    const sub = '#efe7ff', nb = '#d9d5e4', gap = 9;
    const cpw = (d, w = 4) => `<path d="${d}" fill="none" stroke="${sub}" stroke-width="${w + gap}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${nb}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let h = `<rect x="4" y="4" width="652" height="332" rx="10" fill="${nb}" stroke="#b9b3c9" stroke-width="2"/>`;
    h += `<pattern id="nbtex" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${nb}"/><circle cx="3" cy="3" r=".6" fill="#c9c3d6"/></pattern><rect x="4" y="4" width="652" height="332" rx="10" fill="url(#nbtex)" opacity=".7"/>`;
    const pads = [[30, 50, 'RO IN'], [630, 50, 'RO OUT'], [30, 160, 'XY0'], [30, 262, 'XY4'], [290, 318, 'Z3'], [150, 318, 'Z4'], [430, 318, 'Z2'], [520, 230, 'XY2']];
    h += cpw('M30 50 H630', 6);
    XQ.forEach(([x, y], i) => {
      const top = y - 36, mx = x + 18;
      const yTop = 50;
      if (i < 3) h += cpw(`M${mx} ${yTop} V${yTop + 16} h-26 v10 h26 v10 h-26 v10 h26 v10 h-26 v10 h26 V${top - 6}`, 3);
      else { const lx = i === 3 ? 360 : 80; h += cpw(`M${lx} ${yTop} V${y - 60} h-14 v10 h14 v10 h-14 v10 h14 V${y - 22} H${x - 34}`, 3); }
      h += `<path d="M${x - 34} ${y} H${x + 34} M${x} ${y - 34} V${y + 34}" stroke="${sub}" stroke-width="26" stroke-linecap="round"/><path class="xmon" id="xmon-${i}" d="M${x - 30} ${y} H${x + 30} M${x} ${y - 30} V${y + 30}" stroke-width="14" stroke-linecap="round" fill="none"/>`;
      h += `<rect x="${x - 7}" y="${y + 36}" width="14" height="9" fill="none" stroke="#6b5fa8" stroke-width="2"/><rect x="${x - 9}" y="${y + 38}" width="4" height="4" fill="#3a3550"/><rect x="${x + 5}" y="${y + 38}" width="4" height="4" fill="#3a3550"/>`;
      h += `<text class="chip-l" x="${x + 22}" y="${y - 22}">Q${i}</text>`;
    });
    h += cpw(`M30 160 H${XQ[0][0] - 46}`, 3) + cpw(`M30 262 H${XQ[4][0] - 46}`, 3) + cpw(`M520 230 H${XQ[2][0] + 20} V${XQ[2][1] + 46}`, 3);
    [[290, 3], [150, 4], [430, 2]].forEach(([x, i]) => h += cpw(`M${x} 318 V${XQ[i][1] + 52}`, 3));
    [[0, 1], [1, 2], [1, 3], [3, 4]].forEach(([a, b]) => { const [x1, y1] = XQ[a], [x2, y2] = XQ[b]; h += cpw(x1 === x2 ? `M${x1 + 12} ${Math.min(y1, y2) + 40} V${Math.max(y1, y2) - 40}` : `M${Math.min(x1, x2) + 40} ${y1 + 12} H${Math.max(x1, x2) - 40}`, 4); });
    pads.forEach(([x, y, t]) => h += `<rect x="${x - 16}" y="${y - 14}" width="32" height="28" rx="3" fill="#f3d9a0" stroke="#c9a34a"/><text class="chip-l" x="${x}" y="${y + (y > 300 ? -18 : 26)}" text-anchor="middle">${t}</text>`);
    h += `<circle cx="572" cy="128" r="62" fill="#fbf9ff" stroke="#6b5fa8" stroke-width="2"/><path d="M${XQ[2][0] + 8} ${XQ[2][1] + 42} L514 152" stroke="#6b5fa8" stroke-dasharray="3 3"/>`;
    h += `<rect x="540" y="98" width="64" height="56" fill="none" stroke="#9f95bb" stroke-width="8"/><rect x="532" y="118" width="16" height="16" fill="#3a3550"/><rect x="596" y="118" width="16" height="16" fill="#3a3550"/><text class="chip-l" x="572" y="131" text-anchor="middle">Φ</text>`;
    h += `<text class="chip-l" x="572" y="176" text-anchor="middle">Al/AlOx/Al 접합 ×2</text><text class="chip-l" x="572" y="86" text-anchor="middle">SQUID 확대</text>`;
    h += `<text class="chip-l" x="20" y="326">사파이어 기판 위 Nb 접지면 · 7 × 4 mm</text><path d="M560 318 h80" stroke="#3a3550" stroke-width="3"/><text class="chip-l" x="600" y="312" text-anchor="middle">1 mm</text>`;
    return `<svg class="schem chip" viewBox="0 0 660 340" role="img" aria-label="5큐비트 칩 실물 배치도">${h}</svg>`;
  }

  let view = U.store.get('q-view', 'sch');
  function setView(v) { view = v; U.store.set('q-view', v); $('#q-schem').innerHTML = v === 'sch' ? schematic() : chip(); $$('#q-view button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v)); live(); }
  $('#q-view').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });

  function live() {
    const H = PX.QH, q0 = H.qubits[0];
    const EJ = Q.EJ * Math.abs(Math.cos(Math.PI * Q.flux));
    sch.set('q-s-ej', `EJ ${EJ.toFixed(1)} GHz`); sch.set('q-s-ec', `EC ${(Q.EC * 1000).toFixed(0)} MHz`);
    sch.set('q-s-f01', `${H.f01.toFixed(3)} GHz`); sch.set('q-s-fr', `fr 7.050 GHz · χ ${H.chi.toFixed(2)} MHz`);
    $('#q-f01').textContent = H.f01.toFixed(3) + ' GHz'; $('#q-alpha').textContent = (H.alpha * 1000).toFixed(0) + ' MHz';
    $('#q-det').textContent = (H.det >= 0 ? '+' : '') + H.det.toFixed(1) + ' MHz';
    $('#q-t1').textContent = (q0.T1 >= 1 ? q0.T1.toFixed(0) : q0.T1.toFixed(2)) + ' µs'; $('#q-t2').textContent = (q0.T2 >= 1 ? q0.T2.toFixed(0) : q0.T2.toFixed(2)) + ' µs';
    $('#q-ratio').textContent = (EJ / Q.EC).toFixed(0);
    const p = $('#q-pill');
    if (EJ / Q.EC < 20) { p.className = 'pill warn'; p.textContent = 'EJ/EC < 20 · 전하 잡음에 민감'; }
    else if (Math.abs(H.det) > 3) { p.className = 'pill bad'; p.textContent = `구동 주파수와 ${Math.abs(H.det).toFixed(1)} MHz 어긋남 · 재보정 필요`; }
    else if (H.sens > 0.05) { p.className = 'pill warn'; p.textContent = '스윗 스폿 이탈 · 플럭스 잡음으로 T2 감소'; }
    else { p.className = 'pill ok'; p.textContent = '스윗 스폿 · 보정됨'; }
    if (view === 'chip') H.qubits.forEach((q, i) => { const el = $('#xmon-' + i); if (el) el.style.stroke = q.T1 > 50 ? '#9fdcc4' : q.T1 > 10 ? '#ffe39a' : '#f9bfd0'; });
  }

  /* transmon potential −EJ cos φ (vs harmonic) with the first four levels */
  function drawLevels() {
    const { c, w, h } = U.fit($('#q-levels')); if (w < 2) return;
    const ink = U.css('--ink'), mut = U.css('--muted'), line = U.css('--line');
    c.fillStyle = U.css('--panel-2'); c.fillRect(0, 0, w, h);
    const EJ = Math.max(0.5, Q.EJ * Math.abs(Math.cos(Math.PI * Q.flux))), EC = Q.EC, f01 = PX.QH.f01, a = -EC;
    const E = n => n * f01 + a * n * (n - 1) / 2 + Math.sqrt(8 * EJ * EC) / 2;
    const Emax = E(3) * 1.25, X = ph => w / 2 + ph / Math.PI * (w / 2 - 14), Y = e => h - 20 - e / Emax * (h - 34);
    c.strokeStyle = line; c.setLineDash([4, 4]); c.beginPath(); for (let i = 0; i <= 100; i++) { const ph = -Math.PI + i / 50 * Math.PI, e = EJ * ph * ph / 2; i ? c.lineTo(X(ph), Y(e)) : c.moveTo(X(ph), Y(e)); } c.stroke(); c.setLineDash([]);
    c.strokeStyle = U.css('--accent'); c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 100; i++) { const ph = -Math.PI + i / 50 * Math.PI, e = EJ * (1 - Math.cos(ph)); i ? c.lineTo(X(ph), Y(e)) : c.moveTo(X(ph), Y(e)); } c.stroke(); c.lineWidth = 1;
    const cols = [U.css('--mint'), U.css('--sky'), U.css('--peach'), U.css('--rose')];
    for (let n = 0; n < 4; n++) {
      const e = E(n), ph = Math.acos(Math.max(-1, 1 - e / EJ)), x1 = X(-ph), x2 = X(ph), y = Y(e);
      c.strokeStyle = cols[n]; c.lineWidth = 3; c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke(); c.lineWidth = 1;
      c.fillStyle = ink; c.font = '12px "IBM Plex Mono", monospace'; c.fillText(`|${n}⟩`, x2 + 6, y + 4);
    }
    c.fillStyle = mut; c.font = '11px "IBM Plex Mono", monospace';
    c.fillText(`f01 ${f01.toFixed(3)} GHz`, 8, 16); c.fillText(`f12 ${(f01 + a).toFixed(3)} GHz`, 8, 30); c.fillText('φ (위상)', w - 64, h - 6); c.fillText('점선 = 조화 진동자', 8, h - 6);
  }
  /* f01 vs flux, with the calibrated drive frequency */
  function drawTune() {
    const { c, w, h } = U.fit($('#q-tune')); if (w < 2) return;
    c.fillStyle = U.css('--panel-2'); c.fillRect(0, 0, w, h);
    const fmax = PX.qf01(0) + 0.3, fmin = Math.max(0, PX.qf01(0.42) - 0.3);
    const X = p => 30 + (p + 0.5) * (w - 44), Y = f => h - 22 - (f - fmin) / (fmax - fmin) * (h - 36);
    c.strokeStyle = U.css('--line'); for (let i = 0; i <= 4; i++) { const x = X(-0.5 + i / 4); c.beginPath(); c.moveTo(x, 8); c.lineTo(x, h - 22); c.stroke(); }
    c.strokeStyle = U.css('--accent'); c.lineWidth = 2; c.beginPath();
    for (let i = 0; i <= 120; i++) { const p = -0.5 + i / 120, f = PX.qf01(p); i ? c.lineTo(X(p), Y(f)) : c.moveTo(X(p), Y(f)); } c.stroke(); c.lineWidth = 1;
    const fd = PX.QH.fd; c.strokeStyle = U.css('--bad'); c.setLineDash([5, 4]); c.beginPath(); c.moveTo(30, Y(fd)); c.lineTo(w - 14, Y(fd)); c.stroke(); c.setLineDash([]);
    c.fillStyle = U.css('--bad'); c.font = '11px "IBM Plex Mono", monospace'; c.fillText(`구동 fd ${fd.toFixed(3)}`, w - 130, Y(fd) - 5);
    c.fillStyle = U.css('--ink'); c.beginPath(); c.arc(X(Q.flux), Y(PX.QH.f01), 5, 0, U.TAU); c.fill();
    c.fillStyle = U.css('--muted'); ['−½', '−¼', '0', '¼', '½'].forEach((t, i) => c.fillText(t, X(-0.5 + i / 4) - 5, h - 8)); c.fillText('Φ/Φ₀', w - 40, h - 8);
    c.fillText(`${fmax.toFixed(1)} GHz`, 2, 16);
  }
  setView(view);
  PX.on('quantum', live);
  let t = 0;
  PX.addFrame('circuit', dt => { if (PX.circuitMode !== 'quantum') return; t += dt; if (t > 0.1) { t = 0; drawLevels(); drawTune(); } });
})(window.PX);
