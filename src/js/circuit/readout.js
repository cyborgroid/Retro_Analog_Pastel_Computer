/* Circuit (quantum) · dispersive readout chain: resonator transmission for |0⟩/|1⟩, amplifier chain,
   IQ-plane single-shot clouds and assignment fidelity */
(function (PX) {
  'use strict';
  const { U, Q, sch } = PX, { $ } = U;
  const pow = $('#ro-pow'), tau = $('#ro-tau'), tw = $('#ro-twpa');
  pow.value = Q.roPow; tau.value = Q.roTau;
  const fmt = () => { $('#o-ro-pow').textContent = Q.roPow + ' dBm'; $('#o-ro-tau').textContent = Q.roTau.toFixed(1) + ' µs'; };
  pow.addEventListener('input', () => { Q.roPow = parseFloat(pow.value); fmt(); PX.qrecalc(); });
  tau.addEventListener('input', () => { Q.roTau = parseFloat(tau.value); fmt(); PX.qrecalc(); });
  tw.addEventListener('click', () => { Q.twpa = !Q.twpa; tw.setAttribute('aria-pressed', Q.twpa); tw.classList.toggle('on', Q.twpa); tw.textContent = Q.twpa ? 'TWPA 펌프 켜짐' : 'TWPA 펌프 꺼짐'; PX.qrecalc(); });
  fmt();

  function schematic() {
    let h = '';
    h += sch.src(30, 70, { ref: 'RO', v: '7.050 GHz', side: 'l' }) + sch.wire([[30, 56], [30, 46], [56, 46]]) + sch.gnd(30, 84);
    [[56, 104, '−20'], [116, 164, '−10'], [176, 224, '−20']].forEach(([a, b, v]) => h += sch.two('att', a, 46, b, 46, { v }));
    h += sch.wire([[104, 46], [116, 46]]) + sch.wire([[164, 46], [176, 46]]) + sch.wire([[224, 46], [416, 46]]) + sch.dot(300, 46);
    h += sch.two('cap', 300, 46, 300, 96, { ref: 'Ck', side: 'l' }) + sch.wire([[280, 96], [320, 96]]);
    h += sch.two('ind', 280, 96, 280, 150, { ref: 'Lr', side: 'l' }) + sch.two('cap', 320, 96, 320, 150, { ref: 'Cr' }) + sch.wire([[280, 150], [320, 150]]) + sch.gnd(300, 150);
    h += sch.text(300, 182, '판독 공진기 7.05 GHz', 'tiny', 'middle');
    h += sch.two('cap', 320, 120, 368, 120, { ref: 'Cg' }) + sch.wire([[368, 120], [390, 120], [390, 128]]) + sch.squid(390, 158, { ref: 'Q0' }) + sch.gnd(390, 188);
    h += sch.circ(428, 46, { ref: '아이솔' }) + sch.wire([[440, 46], [460, 46]]);
    h += sch.amp(476, 46, { ref: 'TWPA', t: 'JPA', v: '+20 dB', vid: 'ro-s-twpa' }) + sch.text(476, 92, '펌프 7.9 GHz', 'tiny', 'middle');
    h += sch.wire([[492, 46], [524, 46]]) + sch.amp(540, 46, { ref: 'HEMT', v: '+40 dB' }) + sch.wire([[556, 46], [590, 46]]);
    [['LNA +40dB', 34], ['IQ 복조', 80], ['ADC 1GS/s', 126], ['FPGA 판정', 172]].forEach(([t, y], i) => { h += `<rect class="w part" x="590" y="${y}" width="64" height="26" rx="4"/>` + sch.text(622, y + 17, t, 'tiny', 'middle'); if (i) h += sch.arrow(622, y - 20, 622, y); });
    [[50, '300K│4K'], [110, '4K│Still'], [170, 'Still│MXC'], [508, 'MXC│4K'], [572, '4K│300K']].forEach(([x, t]) => h += `<path class="w thin dash" d="M${x} 14 V206"/>` + sch.text(x, 12, t, 'tiny', 'middle'));
    h += sch.flow([[224, 46], [416, 46], [440, 46], [556, 46], [590, 46]], 'fl-ro');
    h += sch.flag(556, 46, -40, 100, 'SNR', 'ro-s-snr', 100);
    return `<svg class="schem" viewBox="0 0 660 220" role="img" aria-label="분산 판독 체인 회로도">${h}</svg>`;
  }
  $('#ro-schem').innerHTML = schematic();

  function live() {
    const H = PX.QH, e = H.qubits[0].ero;
    sch.set('ro-s-snr', H.roDead ? '신호 없음' : H.snr.toFixed(1));
    sch.set('ro-s-twpa', Q.twpa && !PX.S.faults.has('twpa') ? '+20 dB' : '꺼짐');
    sch.speed('fl-ro', H.roDead ? 0 : 0.6);
    $('#ro-n').textContent = `${H.n.toFixed(1)} / ${H.ncrit}`; $('#ro-snr').textContent = H.snr.toFixed(2);
    $('#ro-err').textContent = (e * 100).toFixed(2) + ' %'; $('#ro-chi').textContent = (2 * H.chi).toFixed(2) + ' MHz';
    const p = $('#ro-pill');
    if (H.roDead) { p.className = 'pill bad'; p.textContent = '판독 체인 고장 · 무작위 판정'; }
    else if (H.n > H.ncrit) { p.className = 'pill warn'; p.textContent = '광자 수 > n_crit · 측정 유도 전이'; }
    else if (e > 0.05) { p.className = 'pill warn'; p.textContent = 'SNR 부족 · 판정 오류 큼'; }
    else { p.className = 'pill ok'; p.textContent = `판독 충실도 ${(100 * (1 - e)).toFixed(1)} %`; }
  }
  function drawS21() {
    const { c, w, h } = U.fit($('#ro-s21')); if (w < 2) return;
    const H = PX.QH; c.fillStyle = U.css('--panel-2'); c.fillRect(0, 0, w, h);
    const k = 0.5, X = d => 30 + (d + 4) / 8 * (w - 40), Y = db => 12 + (-db) / 22 * (h - 32);
    const s21 = (d, c0) => { const x = (d - c0) / k; return 10 * Math.log10((x * x + 0.02) / (x * x + 1)); };
    c.strokeStyle = U.css('--line'); [-20, -10, 0].forEach(db => { c.beginPath(); c.moveTo(30, Y(db)); c.lineTo(w - 10, Y(db)); c.stroke(); });
    [[-H.chi, U.css('--accent'), '|0⟩'], [H.chi, U.css('--bad'), '|1⟩']].forEach(([c0, col, l], i) => {
      c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); for (let j = 0; j <= 200; j++) { const d = -4 + j / 25; j ? c.lineTo(X(d), Y(s21(d, c0))) : c.moveTo(X(d), Y(s21(d, c0))); } c.stroke();
      c.fillStyle = col; c.font = '11px "IBM Plex Mono", monospace'; c.fillText(l, X(c0) - 8, h - 4 - i * 0);
    });
    c.lineWidth = 1; c.strokeStyle = U.css('--ink'); c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(0), 8); c.lineTo(X(0), h - 18); c.stroke(); c.setLineDash([]);
    c.fillStyle = U.css('--muted'); c.font = '10px "IBM Plex Mono", monospace'; c.fillText('|S21| dB', 2, 10); c.fillText('fr ± 4 MHz', w - 70, 10); c.fillText('판독 톤', X(0) + 4, 20);
  }
  let pts = null, ptsKey = '';
  function drawIQ() {
    const { c, w, h } = U.fit($('#ro-iq')); if (w < 2) return;
    const H = PX.QH; c.fillStyle = U.css('--scr'); c.fillRect(0, 0, w, h);
    const key = H.snr.toFixed(2) + H.roDead + H.qubits[0].T1.toFixed(1);
    if (key !== ptsKey) {
      ptsKey = key; pts = [];
      const d = H.roDead ? 0 : H.snr, decay = Math.min(0.5, Q.roTau / (2 * H.qubits[0].T1));
      const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(U.TAU * v); };
      for (let i = 0; i < 500; i++) { const one = i % 2, dec = one && Math.random() < decay; const cx = one ? (dec ? (Math.random() - 0.5) * d : d / 2) : -d / 2; pts.push([cx + gauss(), gauss(), one]); }
    }
    const sc = Math.min(w, h) / Math.max(8, (H.snr || 1) + 6);
    c.strokeStyle = U.css('--scr-grid'); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    pts.forEach(([x, y, one]) => { c.fillStyle = one ? 'rgba(255,179,214,.75)' : 'rgba(159,243,204,.75)'; c.fillRect(w / 2 + x * sc - 1.5, h / 2 - y * sc - 1.5, 3, 3); });
    c.strokeStyle = U.css('--ph3'); c.setLineDash([5, 4]); c.beginPath(); c.moveTo(w / 2, 6); c.lineTo(w / 2, h - 6); c.stroke(); c.setLineDash([]);
    c.font = '15px VT323, monospace'; c.fillStyle = U.css('--ph1'); c.fillText('|0⟩ 준비', 8, 16); c.fillStyle = U.css('--ph2'); c.fillText('|1⟩ 준비', w - 70, 16); c.fillStyle = U.css('--ph3'); c.fillText('판정 임계', w / 2 + 6, h - 8);
  }
  PX.on('quantum', live); live();
  let t = 0;
  PX.addFrame('circuit', dt => { if (PX.circuitMode !== 'quantum') return; t += dt; if (t > 0.2) { t = 0; drawS21(); drawIQ(); } });
})(window.PX);
