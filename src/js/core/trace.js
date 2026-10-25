/* Small phosphor trace used by Circuit cards */
(function (PX) {
  'use strict';
  const { U } = PX;
  PX.drawMini = function (cv, traces, t0, win, vmin, vmax) {
    const { c, w, h } = U.fit(cv); if (w < 2) return;
    c.fillStyle = U.css('--scr'); c.fillRect(0, 0, w, h);
    c.strokeStyle = U.css('--scr-grid'); c.lineWidth = 1;
    for (let i = 1; i < 10; i++) { c.beginPath(); c.moveTo(i * w / 10 + .5, 0); c.lineTo(i * w / 10 + .5, h); c.stroke(); }
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, i * h / 4 + .5); c.lineTo(w, i * h / 4 + .5); c.stroke(); }
    traces.forEach(tr => {
      c.strokeStyle = tr.col; c.lineWidth = 1.6; c.shadowColor = tr.col; c.shadowBlur = 6; c.beginPath();
      const N = Math.round(w * 1.5);
      for (let i = 0; i <= N; i++) { const v = tr.f(t0 + i / N * win); const y = h - ((v - vmin) / (vmax - vmin)) * h * 0.86 - h * 0.07; i ? c.lineTo(i / N * w, y) : c.moveTo(0, y); }
      c.stroke(); c.shadowBlur = 0;
      if (tr.label) { c.fillStyle = tr.col; c.font = '15px VT323, monospace'; c.fillText(tr.label, 6 + (tr.lx || 0), 15); }
    });
    if (traces.winLabel !== false) { c.fillStyle = U.css('--scr-ink'); c.font = '14px VT323, monospace'; c.textAlign = 'right'; c.fillText(U.fmtT(win / 10) + '/div', w - 6, h - 6); c.textAlign = 'left'; }
  };
})(window.PX);
