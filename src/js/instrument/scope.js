/* Instrument · 2-channel phosphor oscilloscope: knobs, trigger slope, single shot, XY mode, probe presets */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX, { $, $$, clamp } = U;
  const { TB, VD, PRESETS } = DATA;
  const POS = [...Array(33)].map((_, i) => -4 + i * 0.25);
  const TL = [...Array(181)].map((_, i) => Math.round((-2 + i * 0.1) * 10) / 10);
  const sc = PX.scopeState = { run: true, single: false, armed: false, xy: false, src: ['psu_raw', 'psu_5v'], vdiv: [2, 2], pos: [-3, -4], tdiv: 5e-3, tl: 10, trig: 0, slope: 1, frozen: null, buf: null, bufDt: 0 };
  const K = {};

  ['ch1-src', 'ch2-src'].forEach((id, ch) => {
    const sel = $('#' + id);
    sel.innerHTML = Object.entries(PX.SIG).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
    sel.value = sc.src[ch]; sel.addEventListener('change', () => { sc.src[ch] = sel.value; });
  });
  K.v1 = PX.knob($('#k-v1'), { label: 'V/div', values: VD, index: VD.indexOf(2), fmt: U.fmtV, onChange: v => sc.vdiv[0] = v });
  K.p1 = PX.knob($('#k-p1'), { label: 'pos', values: POS, index: POS.indexOf(-3), px: 6, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2), onChange: v => sc.pos[0] = v });
  K.v2 = PX.knob($('#k-v2'), { label: 'V/div', values: VD, index: VD.indexOf(2), fmt: U.fmtV, onChange: v => sc.vdiv[1] = v });
  K.p2 = PX.knob($('#k-p2'), { label: 'pos', values: POS, index: POS.indexOf(-4), px: 6, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2), onChange: v => sc.pos[1] = v });
  K.t = PX.knob($('#k-t'), { label: 'time/div', values: TB, index: TB.indexOf(5e-3), fmt: U.fmtT, onChange: v => sc.tdiv = v });
  K.tl = PX.knob($('#k-tl'), { label: 'level', values: TL, index: TL.indexOf(10), px: 3, fmt: v => v.toFixed(1) + ' V', onChange: v => sc.tl = v });

  const runB = $('#run'), sglB = $('#single'), xyB = $('#xy'), slB = $('#slope');
  function setRun(on) { sc.run = on; sc.single = false; runB.textContent = on ? 'RUN' : 'STOP'; runB.classList.toggle('on', !on); sglB.classList.remove('on'); }
  runB.addEventListener('click', () => setRun(!sc.run));
  function arm() { sc.single = true; sc.armed = true; sc.run = true; sglB.classList.add('on'); sglB.textContent = 'ARMED'; runB.textContent = 'RUN'; runB.classList.remove('on'); }
  sglB.addEventListener('click', arm);
  xyB.addEventListener('click', () => { sc.xy = !sc.xy; xyB.classList.toggle('on', sc.xy); });
  function setSlope(s) { sc.slope = s; slB.textContent = s > 0 ? '↑ 상승' : '↓ 하강'; }
  slB.addEventListener('click', () => setSlope(-sc.slope));
  function setTrg(i) { sc.trig = i; $('#trg1').classList.toggle('on', i === 0); $('#trg2').classList.toggle('on', i === 1); }
  $('#trg1').addEventListener('click', () => setTrg(0)); $('#trg2').addEventListener('click', () => setTrg(1));

  $('#scope-presets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button class="btn" data-p="${k}">${p.n}</button>`).join('');
  $('#scope-presets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) PX.applyPreset(b.dataset.p); });
  PX.applyPreset = function (k) {
    const p = PRESETS[k] || PRESETS.clk;
    sc.src = [...p.s]; $('#ch1-src').value = p.s[0]; $('#ch2-src').value = p.s[1];
    K.v1.setVal(p.v[0]); K.v2.setVal(p.v[1]); K.p1.setVal(p.p[0]); K.p2.setVal(p.p[1]); K.t.setVal(p.t); K.tl.setVal(p.tl);
    setTrg(p.tr); setSlope(p.sl || 1); sc.xy = false; xyB.classList.remove('on');
    if (p.single) arm(); else setRun(true);
    if (p.auto) PX.setAutoMouse(true);
    if (p.psg) PX.setPsgChannel(0, true);
    PX.setLA && PX.setLA(p.la);
    $$('#scope-presets .btn').forEach(b => b.classList.toggle('on', b.dataset.p === k));
    $('#scope-hint').textContent = k === 'bounce' ? '키보드의 아무 키나 누르면 접점 바운스가 한 번 캡처됩니다.' : k === 'psg' ? 'PSG 채널 A를 켰습니다. Circuit 탭에서 음정과 볼륨을 바꿔 보세요.' : k === 'mouse' ? '마우스 자동 이동을 켰습니다. 방향이 바뀌면 A/B 위상이 뒤집힙니다.' : '';
  };

  /* trigger search runs backwards over the recent past so single-shot catches events that already happened */
  function findTrig(fn, level, end, win, slope) {
    const span = Math.min(Math.max(win * 4, 2e-6), 0.06), steps = 3000, st = span / steps, start = end - span;
    let prev = fn(start), found = null;
    for (let i = 1; i <= steps; i++) {
      const t = start + i * st, v = fn(t);
      if ((slope > 0 && prev < level && v >= level) || (slope < 0 && prev > level && v <= level)) {
        let a = t - st, b = t;
        for (let k = 0; k < 22; k++) { const m = (a + b) / 2, vm = fn(m); if (slope > 0 ? vm < level : vm > level) a = m; else b = m; }
        found = b; if (t > end - span / 2) break;
      }
      prev = v;
    }
    return found;
  }

  let trigd = false;
  function draw() {
    const cv = $('#scope'); const { c, w, h } = U.fit(cv); if (w < 2) return;
    const win = 10 * sc.tdiv, N = Math.round(Math.min(1400, w * 1.6));
    c.fillStyle = 'rgba(27,31,46,.55)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = U.css('--scr-grid'); c.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { c.beginPath(); c.moveTo(Math.round(i * w / 10) + .5, 0); c.lineTo(Math.round(i * w / 10) + .5, h); c.stroke(); }
    for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(0, Math.round(i * h / 8) + .5); c.lineTo(w, Math.round(i * h / 8) + .5); c.stroke(); }
    c.strokeStyle = 'rgba(141,155,184,.5)';
    for (let i = 0; i < 50; i++) { const x = i * w / 50; c.beginPath(); c.moveTo(x, h / 2 - 3); c.lineTo(x, h / 2 + 3); c.stroke(); }
    for (let i = 0; i < 40; i++) { const y = i * h / 40; c.beginPath(); c.moveTo(w / 2 - 3, y); c.lineTo(w / 2 + 3, y); c.stroke(); }

    let t0;
    if (sc.run) {
      const now = PX.now(), src = sc.src[sc.trig];
      const tt = src === 'off' ? null : findTrig(PX.SIG[src].f, sc.tl, now - win * 0.9, win, sc.slope);
      trigd = tt != null;
      if (sc.single) {
        if (trigd && sc.armed && (now - tt) < 0.5) { t0 = tt - win * 0.1; sc.frozen = t0; setRun(false); sglB.textContent = 'SINGLE'; }
        else t0 = now - win;
      } else t0 = trigd ? tt - win * 0.1 : now - win;
      if (sc.run) sc.frozen = t0;
    } else t0 = sc.frozen != null ? sc.frozen : PX.now() - win;

    const cols = [U.css('--ph1'), U.css('--ph2')], stats = [], bufs = [];
    for (let ch = 0; ch < 2; ch++) {
      if (sc.src[ch] === 'off') { stats.push(null); bufs.push(null); continue; }
      const f = PX.SIG[sc.src[ch]].f, vals = new Float32Array(N + 1);
      for (let i = 0; i <= N; i++) vals[i] = f(t0 + i / N * win);
      bufs.push(vals);
      let mn = Infinity, mx = -Infinity, sum = 0, sq = 0;
      for (let i = 0; i <= N; i++) { const v = vals[i]; mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; sq += v * v; }
      const mid = (mn + mx) / 2, cross = [];
      for (let i = 1; i <= N; i++) if (vals[i - 1] < mid && vals[i] >= mid && mx - mn > 0.05) cross.push(i / N * win);
      const avg = sum / (N + 1);
      stats.push({ vpp: mx - mn, avg, rms: Math.sqrt(Math.max(0, sq / (N + 1) - avg * avg)), f: cross.length > 1 ? (cross.length - 1) / (cross[cross.length - 1] - cross[0]) : null });
    }
    sc.buf = bufs[0]; sc.bufDt = win / N;
    if (sc.xy && bufs[0] && bufs[1]) {
      c.strokeStyle = U.css('--ph3'); c.lineWidth = 1.5; c.shadowColor = c.strokeStyle; c.shadowBlur = 8; c.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = clamp(w / 2 + (bufs[0][i] / sc.vdiv[0] + sc.pos[0]) * w / 10, -2, w + 2), y = clamp(h / 2 - (bufs[1][i] / sc.vdiv[1] + sc.pos[1]) * h / 8, -2, h + 2);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke(); c.shadowBlur = 0;
    } else {
      bufs.forEach((vals, ch) => {
        if (!vals) return;
        const vd = sc.vdiv[ch], ps = sc.pos[ch];
        c.strokeStyle = cols[ch]; c.lineWidth = 1.7; c.shadowColor = cols[ch]; c.shadowBlur = 8; c.beginPath();
        for (let i = 0; i <= N; i++) { const y = clamp(h / 2 - (vals[i] / vd + ps) * h / 8, -2, h + 2); i ? c.lineTo(i / N * w, y) : c.moveTo(0, y); }
        c.stroke(); c.shadowBlur = 0;
        c.fillStyle = cols[ch]; const gy = h / 2 - ps * h / 8; c.beginPath(); c.moveTo(0, gy - 5); c.lineTo(8, gy); c.lineTo(0, gy + 5); c.fill();
      });
      if (sc.src[sc.trig] !== 'off') {
        const ty = h / 2 - (sc.tl / sc.vdiv[sc.trig] + sc.pos[sc.trig]) * h / 8;
        c.fillStyle = U.css('--ph3'); c.beginPath(); c.moveTo(w, ty - 5); c.lineTo(w - 8, ty); c.lineTo(w, ty + 5); c.fill();
        c.beginPath(); c.moveTo(w * 0.1 - 5, 0); c.lineTo(w * 0.1 + 5, 0); c.lineTo(w * 0.1, 8); c.fill();
      }
    }
    const state = sc.single && sc.run ? 'ARMED' : sc.run ? (trigd ? "TRIG'D" : 'AUTO') : 'STOP';
    $('#scope-read').innerHTML = stats.map((st, i) => st
      ? `<span class="c${i + 1}">CH${i + 1} ${U.fmtV(sc.vdiv[i])}/div · Vpp ${st.vpp.toFixed(st.vpp < 1 ? 3 : 2)} · avg ${st.avg.toFixed(2)} · rms~ ${st.rms.toFixed(st.rms < 1 ? 3 : 2)} · ${st.f ? U.fmtHz(st.f) : '— Hz'}</span>`
      : `<span class="c${i + 1}">CH${i + 1} OFF</span>`).join('')
      + `<span>${sc.xy ? 'XY MODE' : U.fmtT(sc.tdiv) + '/div'}</span><span class="tr">${state} · CH${sc.trig + 1} ${sc.slope > 0 ? '↑' : '↓'} ${sc.tl.toFixed(1)} V</span>`;
  }
  PX.addFrame('instrument', draw);
})(window.PX);
