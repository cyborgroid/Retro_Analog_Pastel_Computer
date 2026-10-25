/* Instrument · spectrum analyzer: Hann-windowed 1024-point FFT of the scope's CH1 record */
(function (PX) {
  'use strict';
  const { U } = PX, { $ } = U;
  const NF = 1024;
  const re = new Float64Array(NF), im = new Float64Array(NF), hann = new Float64Array(NF);
  for (let i = 0; i < NF; i++) hann[i] = 0.5 - 0.5 * Math.cos(U.TAU * i / (NF - 1));
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -U.TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  const smooth = new Float64Array(NF / 2).fill(-100);
  PX.addFrame('instrument', () => {
    const cv = $('#fft'); const { c, w, h } = U.fit(cv); if (w < 2) return;
    const sc = PX.scopeState, buf = sc.buf;
    c.fillStyle = U.css('--scr'); c.fillRect(0, 0, w, h);
    const L = 44, B = 22, pw = w - L - 10, ph = h - B - 10;
    c.strokeStyle = U.css('--scr-grid'); c.lineWidth = 1; c.fillStyle = U.css('--scr-ink'); c.font = '14px VT323, monospace';
    for (let db = 0; db >= -80; db -= 20) { const y = 10 + (-db / 80) * ph; c.beginPath(); c.moveTo(L, y + .5); c.lineTo(L + pw, y + .5); c.stroke(); c.fillText(db + ' dB', 4, y + 4); }
    if (!buf) { c.fillText('CH1 신호를 선택하세요', L + 10, h / 2); return; }
    const n = buf.length; let mean = 0; for (let i = 0; i < n; i++) mean += buf[i]; mean /= n;
    for (let i = 0; i < NF; i++) { const v = buf[Math.min(n - 1, Math.floor(i / NF * n))]; re[i] = ((isFinite(v) ? v : 0) - mean) * hann[i]; im[i] = 0; }
    fft(re, im);
    const fs = 1 / (sc.bufDt * n / NF), fmax = fs / 2;
    let peak = 1, pk = 0;
    const mags = new Float64Array(NF / 2);
    for (let k = 1; k < NF / 2; k++) { const m = Math.hypot(re[k], im[k]) / (NF / 4); mags[k] = m; if (m > mags[pk] || pk === 0) { pk = k; } }
    peak = Math.max(1e-9, mags[pk]);
    for (let k = 1; k < NF / 2; k++) { const db = 20 * Math.log10(Math.max(1e-6, mags[k] / Math.max(peak, 0.05))); smooth[k] = smooth[k] * 0.6 + db * 0.4; }
    const grad = c.createLinearGradient(0, 10, 0, 10 + ph); grad.addColorStop(0, 'rgba(255,179,214,.55)'); grad.addColorStop(1, 'rgba(182,200,255,.05)');
    c.beginPath(); c.moveTo(L, 10 + ph);
    for (let k = 1; k < NF / 2; k++) { const x = L + k / (NF / 2) * pw, y = 10 + U.clamp(-smooth[k] / 80, 0, 1) * ph; c.lineTo(x, y); }
    c.lineTo(L + pw, 10 + ph); c.closePath(); c.fillStyle = grad; c.fill();
    c.strokeStyle = U.css('--ph2'); c.lineWidth = 1.4; c.beginPath();
    for (let k = 1; k < NF / 2; k++) { const x = L + k / (NF / 2) * pw, y = 10 + U.clamp(-smooth[k] / 80, 0, 1) * ph; k === 1 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
    c.fillStyle = U.css('--scr-ink');
    for (let i = 0; i <= 5; i++) { const x = L + i / 5 * pw; c.fillText(U.fmtHz(fmax * i / 5), Math.min(x, w - 70), h - 5); }
    if (peak > 0.02) { const px = L + pk / (NF / 2) * pw; c.fillStyle = U.css('--ph3'); c.fillRect(px - 1, 10, 2, ph); c.fillText('PEAK ' + U.fmtHz(pk * fs / NF), Math.min(px + 6, w - 120), 24); }
    $('#fft-info').textContent = `CH1 · ${PX.SIG[sc.src[0]].n} · 1024-pt Hann · 분해능 ${U.fmtHz(fs / NF)}`;
  });
})(window.PX);
