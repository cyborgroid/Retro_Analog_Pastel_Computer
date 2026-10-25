/* Instrument · analog multimeter with needle inertia (DCV / ACV) and bench notes */
(function (PX) {
  'use strict';
  const { U, S, C, DATA } = PX, { $, $$ } = U;
  const meter = { probe: '5v', mode: 'dc', ang: 0, vel: 0, val: 0 };
  function avg(f, period) { const t = PX.now(); let s = 0; const n = 48; for (let i = 0; i < n; i++) s += f(t + i / n * period); return s / n; }
  function rmsAC(f, period) { const t = PX.now(); let s = 0, q = 0; const n = 64; for (let i = 0; i < n; i++) { const v = f(t + i / n * period); s += v; q += v * v; } const m = s / n; return Math.sqrt(Math.max(0, q / n - m * m)); }
  function value() {
    if (!PX.mainsOn()) return 0;
    const T = 1 / (2 * C.MAINS);
    if (meter.mode === 'ac') {
      if (meter.probe === '5v') return rmsAC(PX.SIG.psu_5v.f, T);
      if (meter.probe === 'c1') return rmsAC(PX.SIG.psu_raw.f, T);
      return 0.004 + Math.random() * 0.002;
    }
    switch (meter.probe) {
      case '5v': return avg(PX.SIG.psu_5v.f, T);
      case 'c1': return avg(PX.SIG.psu_raw.f, T);
      case '12v': return 12.02 - 0.04 * S.load + (Math.random() - .5) * 0.02;
      case 'm12v': return -11.94 + (Math.random() - .5) * 0.02;
    }
    return 0;
  }
  $('#meter-probes').innerHTML = DATA.PROBES.map(([k, n]) => `<button class="btn${k === meter.probe ? ' on' : ''}" data-m="${k}">${n}</button>`).join('');
  $('#meter-probes').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; meter.probe = b.dataset.m; $$('#meter-probes .btn').forEach(x => x.classList.toggle('on', x === b)); });
  $('#meter-mode').addEventListener('click', e => { const b = e.target.closest('[data-mm]'); if (!b) return; meter.mode = b.dataset.mm; $$('#meter-mode button').forEach(x => x.setAttribute('aria-pressed', x === b)); });

  function draw(dt) {
    const { c, w, h } = U.fit($('#meter')); if (w < 2) return;
    const full = meter.mode === 'ac' ? 2 : 20;
    const v = value(); meter.val = U.lerp(meter.val, v, 0.2);
    const target = U.clamp(Math.abs(meter.val) / full, 0, 1.03);
    const acc = (target - meter.ang) * 90 - meter.vel * 11; meter.vel += acc * dt; meter.ang += meter.vel * dt;
    c.fillStyle = '#2f2b3d'; c.fillRect(0, 0, w, h);
    const fx = w * 0.05, fy = h * 0.06, fw = w * 0.9, fh = h * 0.72;
    c.fillStyle = '#fff6dc'; c.beginPath(); c.roundRect ? c.roundRect(fx, fy, fw, fh, 10) : c.rect(fx, fy, fw, fh); c.fill();
    const cx = w / 2, cy = fy + fh * 1.05, R = fh * 0.86, a0 = -Math.PI / 2 - 0.85, a1 = -Math.PI / 2 + 0.85;
    c.strokeStyle = '#3a3550'; c.lineWidth = 1.2; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    c.strokeStyle = '#cbc2e6'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R - 12, a0, a1); c.stroke();
    if (meter.mode === 'dc') { c.strokeStyle = '#f07aa0'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R - 12, a0 + (a1 - a0) * 0.245, a0 + (a1 - a0) * 0.255); c.stroke(); }
    c.fillStyle = '#3a3550'; c.textAlign = 'center'; c.font = `${Math.max(11, w * 0.04)}px "IBM Plex Mono", monospace`;
    for (let i = 0; i <= 20; i++) {
      const a = a0 + (a1 - a0) * i / 20, l = i % 5 === 0 ? 14 : 7; c.strokeStyle = '#3a3550'; c.lineWidth = i % 5 === 0 ? 1.6 : 1;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.lineTo(cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l)); c.stroke();
      if (i % 5 === 0) c.fillText(String(full * i / 20), cx + Math.cos(a) * (R + 26), cy + Math.sin(a) * (R + 26) + 4);
    }
    c.font = `${Math.max(10, w * 0.034)}px "IBM Plex Mono", monospace`; c.fillText(meter.mode === 'ac' ? 'AC V rms' : 'DC V', cx, fy + fh * 0.62);
    c.fillStyle = '#7a7290'; c.fillText('PASTELLA PM-20', cx, fy + fh * 0.78);
    const na = a0 + (a1 - a0) * U.clamp(meter.ang, -0.02, 1.04);
    c.save(); c.beginPath(); c.rect(fx, fy, fw, fh); c.clip();
    c.strokeStyle = '#d94a74'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(na) * (R + 12), cy + Math.sin(na) * (R + 12)); c.stroke(); c.restore();
    c.fillStyle = '#3a3550'; c.beginPath(); c.arc(cx, fy + fh, 9, Math.PI, 0); c.fill();
    c.fillStyle = '#ffe39a'; c.font = `${Math.max(16, w * 0.075)}px VT323, monospace`; c.textAlign = 'left';
    c.fillText((meter.val < 0 ? '−' : ' ') + Math.abs(meter.val).toFixed(3) + ' V', fx + 4, h * 0.95);
    c.textAlign = 'right'; c.fillStyle = meter.val < 0 ? '#ffb3d6' : '#8d9bb8'; c.fillText(meter.val < 0 ? 'POL −' : 'POL +', fx + fw - 4, h * 0.95); c.textAlign = 'left';
  }
  function notes() {
    const P = PX.P, rows = [
      ['C1 리플', Math.min(P.rip, P.vpk).toFixed(2) + ' Vpp @ 120 Hz'],
      ['+5V 상태', !PX.mainsOn() ? '전원 꺼짐' : S.trip ? '열 차단' : P.dropout ? '드롭아웃' : '레귤레이션 정상'],
      ['7805 온도', S.tReg.toFixed(0) + ' °C · ' + C.HEATSINKS[S.heatsink].n],
      ['수평 동기', !PX.syncOK() ? '동기 신호 없음' : PX.hLocked() ? '고정 15.734 kHz' : '이탈 ' + (S.hFreq / 1000).toFixed(3) + ' kHz'],
      ['수직', (C.V_NOM + S.vHold).toFixed(2) + ' Hz'],
      ['키 스캔', '2 ms 주기 · 감지 ' + S.detected.size + '개'],
      ['마우스 XA', U.fmtHz(Math.abs(S.mouse.vx) * C.QK)],
      ['주입된 고장', S.faults.size ? [...S.faults].map(f => DATA.NODES[f].t).join(', ') : '없음']
    ];
    $('#inst-notes').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }
  notes();
  let nt = 0;
  PX.addFrame('instrument', dt => { draw(dt); nt += dt; if (nt > 0.25) { nt = 0; notes(); } });
})(window.PX);
