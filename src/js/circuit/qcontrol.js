/* Circuit (quantum) · microwave control chain: AWG → IQ up-conversion → cryogenic attenuation → qubit,
   flux bias tee; Rabi calibration curve and the DRAG pulse envelope */
(function (PX) {
  'use strict';
  const { U, Q, sch } = PX, { $ } = U;

  const amp = $('#qc-amp'), off = $('#qc-off');
  amp.value = Q.amp; off.value = Q.fdOffMHz;
  const fmtA = () => { $('#o-qc-amp').textContent = Q.amp.toFixed(2) + ' ×π'; $('#o-qc-off').textContent = (Q.fdOffMHz >= 0 ? '+' : '') + Q.fdOffMHz.toFixed(1) + ' MHz'; };
  amp.addEventListener('input', () => { Q.amp = parseFloat(amp.value); fmtA(); PX.qrecalc(); });
  off.addEventListener('input', () => { Q.fdOffMHz = parseFloat(off.value); fmtA(); PX.qrecalc(); });
  const drag = $('#qc-drag');
  drag.addEventListener('click', () => { Q.drag = !Q.drag; drag.setAttribute('aria-pressed', Q.drag); drag.classList.toggle('on', Q.drag); drag.textContent = Q.drag ? 'DRAG 보정 켜짐' : 'DRAG 보정 꺼짐'; PX.qrecalc(); });
  $('#qc-cal').addEventListener('click', PX.qCalibrate);
  PX.on('qcal', () => { amp.value = Q.amp; off.value = Q.fdOffMHz; fmtA(); });
  fmtA();

  function schematic() {
    let h = '';
    h += sch.box(16, 40, 84, 110, 'AWG', '2 GS/s 16bit');
    h += sch.text(94, 68, 'I', 'pinl', 'end') + sch.text(94, 104, 'Q', 'pinl', 'end') + sch.text(94, 140, 'Z', 'pinl', 'end');
    h += sch.two('lpf', 100, 64, 150, 64, { ref: 'LPF' }) + sch.two('lpf', 100, 100, 150, 100);
    h += `<rect class="w part" x="164" y="46" width="70" height="72" rx="6"/>` + sch.mixer(186, 64) + sch.mixer(186, 100) + `<circle class="w part" cx="216" cy="82" r="9"/>` + sch.text(216, 86, 'Σ', 'tiny', 'middle');
    h += sch.wire([[150, 64], [172, 64]]) + sch.wire([[150, 100], [172, 100]]) + sch.wire([[200, 64], [216, 64], [216, 73]]) + sch.wire([[200, 100], [216, 100], [216, 91]]);
    h += sch.text(199, 42, 'IQ 믹서', 'ref', 'middle') + sch.wire([[186, 114], [186, 118]]) + sch.wire([[186, 78], [186, 86]]);
    h += sch.wire([[200, 160], [200, 118]]) + sch.src(200, 174, { ref: 'LO', v: '4.950 GHz', side: 'l' }) + sch.text(206, 132, '0° / 90°', 'tiny');
    h += sch.wire([[225, 82], [242, 82]]) + sch.two('bpf', 242, 82, 292, 82, { ref: 'BPF' }) + sch.two('dcb', 292, 82, 336, 82, { ref: 'DC 블록' });
    [[356, 410, '−20', '4 K'], [426, 480, '−10', 'Still'], [496, 550, '−20', 'MXC']].forEach(([a, b, v]) => h += sch.two('att', a, 82, b, 82, { v }));
    h += sch.wire([[336, 82], [356, 82]]) + sch.wire([[410, 82], [426, 82]]) + sch.wire([[480, 82], [496, 82]]);
    h += sch.two('cap', 550, 82, 600, 82, { ref: 'Cd' }) + sch.wire([[600, 82], [630, 82], [630, 96]]) + sch.squid(630, 126) + sch.gnd(630, 156);
    h += sch.wire([[100, 136], [120, 136], [120, 206], [240, 206]]) + sch.text(250, 192, 'Bias-T', 'ref') + `<rect class="w part" x="240" y="196" width="46" height="20" rx="3"/>` + sch.text(263, 210, 'L ∥ C', 'tiny', 'middle');
    h += sch.rail(263, 196, 'DC 바이어스') + sch.wire([[286, 206], [306, 206]]) + sch.two('lpf', 306, 206, 356, 206, { ref: 'Eccosorb' }) + sch.wire([[356, 206], [496, 206]]) + sch.two('lpf', 496, 206, 550, 206, { ref: 'LPF MXC' });
    h += sch.wire([[550, 206], [598, 206], [598, 126], [608, 126]]) + sch.text(600, 120, 'M', 'ref');
    [[346, '300 K │ 4 K'], [418, '4 K │ Still'], [488, 'Still │ MXC'], [556, '']].forEach(([x, t]) => h += `<path class="w thin dash" d="M${x} 24 V226"/>` + (t ? sch.text(x, 20, t, 'tiny', 'middle') : ''));
    h += sch.flow([[225, 82], [600, 82], [630, 82]], 'fl-drive');
    h += sch.flag(242, 82, -10, -60, 'RF', 'qc-s-rf', 110) + sch.flag(630, 96, -24, 110, '큐비트', 'qc-s-q', 118);
    return `<svg class="schem" viewBox="0 0 660 240" role="img" aria-label="마이크로파 제어 체인 회로도">${h}</svg>`;
  }
  $('#qc-schem').innerHTML = schematic();

  function live() {
    const H = PX.QH;
    const fd = H.fd, theta = 180 * H.kAmp, W = Math.hypot(H.kAmp, H.delta), pmax = W ? (H.kAmp * H.kAmp) / (W * W) : 0;
    sch.set('qc-s-rf', H.driveOK ? `${fd.toFixed(3)} GHz` : '출력 없음');
    sch.set('qc-s-q', H.driveOK ? `θ ${theta.toFixed(0)}° · −50 dB` : '구동 없음');
    sch.speed('fl-drive', H.driveOK ? 0.8 * Q.amp : 0);
    $('#qc-theta').textContent = H.driveOK ? theta.toFixed(0) + '°' : '—';
    $('#qc-det').textContent = (H.det >= 0 ? '+' : '') + H.det.toFixed(1) + ' MHz';
    $('#qc-pmax').textContent = (pmax * 100).toFixed(1) + ' %';
    $('#qc-f1').textContent = (100 * (1 - H.qubits[0].p1)).toFixed(3) + ' %';
    const p = $('#qc-pill');
    if (!H.driveOK) { p.className = 'pill bad'; p.textContent = 'AWG · LO · IQ 경로 고장 (Topology)'; }
    else if (Math.abs(theta - 180) > 9 || Math.abs(H.det) > 2) { p.className = 'pill warn'; p.textContent = 'π 펄스 미보정 · 게이트 오차 큼'; }
    else { p.className = 'pill ok'; p.textContent = 'π 펄스 보정됨'; }
  }
  /* Rabi: P(|1⟩) after a pulse of amplitude a (×π), with detuning */
  function drawRabi() {
    const { c, w, h } = U.fit($('#qc-rabi')); if (w < 2) return;
    const H = PX.QH; c.fillStyle = U.css('--panel-2'); c.fillRect(0, 0, w, h);
    const X = a => 30 + a / 2 * (w - 44), Y = p => h - 20 - p * (h - 32);
    c.strokeStyle = U.css('--line'); [0, 0.5, 1].forEach(p => { c.beginPath(); c.moveTo(30, Y(p)); c.lineTo(w - 14, Y(p)); c.stroke(); });
    [0.5, 1, 1.5, 2].forEach(a => { c.beginPath(); c.moveTo(X(a), 10); c.lineTo(X(a), h - 20); c.stroke(); });
    const P = a => { const k = a / Q.ampPi * (H.driveOK ? 1 : 0), W = Math.hypot(k, H.delta); return W ? (k * k) / (W * W) * Math.sin(Math.PI / 2 * W) ** 2 : 0; };
    c.strokeStyle = U.css('--accent'); c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 160; i++) { const a = i / 80; i ? c.lineTo(X(a), Y(P(a))) : c.moveTo(X(a), Y(P(a))); } c.stroke(); c.lineWidth = 1;
    c.fillStyle = U.css('--bad'); c.beginPath(); c.arc(X(Q.amp), Y(P(Q.amp)), 5, 0, U.TAU); c.fill();
    c.fillStyle = U.css('--muted'); c.font = '11px "IBM Plex Mono", monospace';
    c.fillText('P(|1⟩)', 4, 14); ['0.5', 'π', '1.5', '2π'].forEach((t, i) => c.fillText(t, X((i + 1) / 2) - 8, h - 6)); c.fillText('펄스 진폭', w - 70, 14);
  }
  /* 40 ns Gaussian (I) with DRAG derivative (Q) */
  function drawPulse() {
    const { c, w, h } = U.fit($('#qc-pulse')); if (w < 2) return;
    c.fillStyle = U.css('--scr'); c.fillRect(0, 0, w, h);
    const X = t => 10 + t / 40 * (w - 20), Y = v => h / 2 - v * (h / 2 - 10);
    c.strokeStyle = U.css('--scr-grid'); c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    const s = 8, g = t => Math.exp(-((t - 20) ** 2) / (2 * s * s)) * Math.min(1, Q.amp);
    c.strokeStyle = U.css('--ph1'); c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 80; i++) { const t = i / 2; i ? c.lineTo(X(t), Y(g(t))) : c.moveTo(X(t), Y(g(t))); } c.stroke();
    if (Q.drag) { c.strokeStyle = U.css('--ph2'); c.setLineDash([4, 3]); c.beginPath(); for (let i = 0; i <= 80; i++) { const t = i / 2, d = -(t - 20) / (s * s) * g(t) * 4; i ? c.lineTo(X(t), Y(d)) : c.moveTo(X(t), Y(d)); } c.stroke(); c.setLineDash([]); }
    c.lineWidth = 1; c.font = '15px VT323, monospace'; c.fillStyle = U.css('--ph1'); c.fillText('I 가우시안', 8, 16); if (Q.drag) { c.fillStyle = U.css('--ph2'); c.fillText('Q DRAG (미분)', 90, 16); }
    c.fillStyle = U.css('--scr-ink'); c.fillText('40 ns', w - 44, h - 6);
  }
  PX.on('quantum', live); live();
  let t = 0;
  PX.addFrame('circuit', dt => { if (PX.circuitMode !== 'quantum') return; t += dt; if (t > 0.12) { t = 0; drawRabi(); drawPulse(); } });
})(window.PX);
