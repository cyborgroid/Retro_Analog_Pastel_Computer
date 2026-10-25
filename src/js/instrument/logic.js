/* Instrument · 8-channel logic analyzer: Z80-style bus cycles, key scan, mouse quadrature */
(function (PX) {
  'use strict';
  const { U, S, C, DATA } = PX, { $, $$, mod } = U;
  const CYC = DATA.CYC, CYC_T = CYC.reduce((a, c) => a + c[1], 0);
  function busAt(T) {
    const n = mod(Math.floor(T), CYC_T), half = mod(T, 1) >= 0.5; let acc = 0, cy = CYC[0], k = 0;
    for (const c of CYC) { if (n < acc + c[1]) { cy = c; k = n - acc; break; } acc += c[1]; }
    const r = { M1: 1, MREQ: 1, IORQ: 1, RD: 1, WR: 1, RFSH: 1 }, ty = cy[0];
    if (ty === 'M1') { if (k <= 1) r.M1 = 0; if ((k === 0 && half) || k === 1) { r.MREQ = 0; r.RD = 0; } if (k >= 2) r.RFSH = 0; if ((k === 2 && half) || (k === 3 && !half)) r.MREQ = 0; }
    if (ty === 'MR' && ((k === 0 && half) || k === 1 || (k === 2 && !half))) { r.MREQ = 0; r.RD = 0; }
    if (ty === 'MW') { if ((k === 0 && half) || k === 1 || (k === 2 && !half)) r.MREQ = 0; if ((k === 1 && half) || (k === 2 && !half)) r.WR = 0; }
    if (ty === 'IO' && (k === 1 || k === 2)) { r.IORQ = 0; r.WR = 0; }
    return r;
  }
  let mode = 'bus';
  $('#la-modes').innerHTML = Object.entries(DATA.LA_MODES).map(([k, n]) => `<button class="btn" data-la="${k}">${n}</button>`).join('');
  $('#la-modes').addEventListener('click', e => { const b = e.target.closest('[data-la]'); if (b) PX.setLA(b.dataset.la); });
  PX.setLA = m => { mode = m; $$('#la-modes .btn').forEach(b => b.classList.toggle('on', b.dataset.la === m)); };
  PX.setLA('bus');

  PX.addFrame('instrument', () => {
    const { c, w, h } = U.fit($('#la')); if (w < 2) return;
    c.fillStyle = U.css('--scr'); c.fillRect(0, 0, w, h);
    const lw = Math.min(90, w * 0.2), pw = w - lw - 10; let chans = [], win, tStart, ann = [];
    const now = PX.now(), cpu = PX.cpuOK();
    if (mode === 'bus') {
      win = CYC_T / C.CPU_HZ; tStart = Math.floor(now * C.CPU_HZ / CYC_T) * CYC_T / C.CPU_HZ;
      const b = name => t => cpu ? busAt(t * C.CPU_HZ)[name] : 1;
      chans = [['CLK', t => PX.clockOn() && mod(t * C.CPU_HZ, 1) < 0.5 ? 1 : 0], ['/M1', b('M1')], ['/MREQ', b('MREQ')], ['/IORQ', b('IORQ')], ['/RD', b('RD')], ['/WR', b('WR')], ['/RFSH', b('RFSH')]];
      if (cpu) { let acc = 0; CYC.forEach(cy => { ann.push([acc / CYC_T, (acc + cy[1]) / CYC_T, cy[2]]); acc += cy[1]; }); }
    } else if (mode === 'kb') {
      win = 8 * C.SLOT * 1.25; tStart = Math.floor(now / (8 * C.SLOT)) * 8 * C.SLOT;
      chans = [0, 1, 2, 3, 4, 5, 6].map(r => ['ROW' + r, t => PX.kbRow(r, t) > 2.5 ? 1 : 0]); chans.push(['COL*', t => PX.kbCol(t) > 2.5 ? 1 : 0]);
    } else {
      win = 0.04; tStart = now - win;
      chans = [['XA', t => PX.quad('x', 'a', t) > 2.5 ? 1 : 0], ['XB', t => PX.quad('x', 'b', t) > 2.5 ? 1 : 0], ['YA', t => PX.quad('y', 'a', t) > 2.5 ? 1 : 0], ['YB', t => PX.quad('y', 'b', t) > 2.5 ? 1 : 0]];
    }
    if (!PX.logicOn()) chans = chans.map(([n]) => [n, () => 0]);
    const top = ann.length ? 26 : 12, rowH = (h - top - 18) / chans.length, cols = [U.css('--ph1'), U.css('--ph2'), U.css('--ph3'), U.css('--ph4')];
    c.strokeStyle = U.css('--scr-grid'); c.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const x = lw + i * pw / 10; c.beginPath(); c.moveTo(x + .5, top - 4); c.lineTo(x + .5, h - 16); c.stroke(); }
    c.font = '16px VT323, monospace';
    ann.forEach(([a, b, txt], i) => { c.fillStyle = i % 2 ? 'rgba(205,189,255,.08)' : 'rgba(174,232,208,.08)'; c.fillRect(lw + a * pw, top - 4, (b - a) * pw, h - top - 12); c.fillStyle = U.css('--scr-ink'); c.fillText(txt, lw + a * pw + 4, 16); });
    const N = Math.round(pw * 2);
    chans.forEach(([name, f], i) => {
      const y0 = top + i * rowH + rowH * 0.8, amp = rowH * 0.55; c.fillStyle = cols[i % 4]; c.fillText(name, 8, y0 - amp * 0.25);
      c.strokeStyle = cols[i % 4]; c.lineWidth = 1.5; c.beginPath(); let pv = null;
      for (let k = 0; k <= N; k++) { const v = f(tStart + k / N * win), x = lw + k / N * pw, y = y0 - v * amp; if (pv === null) c.moveTo(x, y); else if (v !== pv) { c.lineTo(x, y0 - pv * amp); c.lineTo(x, y); } pv = v; }
      c.lineTo(lw + pw, y0 - pv * amp); c.stroke();
    });
    c.fillStyle = U.css('--scr-ink'); c.fillText(`${U.fmtT(win / 10)}/div · ${DATA.LA_MODES[mode]}${!cpu && mode === 'bus' && PX.logicOn() ? ' · CPU 정지' : ''}`, lw, h - 2);
  });
})(window.PX);
