/* Instrument · quantum results: shot histogram vs ideal, Bloch spheres (ideal vs noisy), state vector with phase disks,
   error budget, and the compiled pulse schedule (the analog view of the program) */
(function (PX) {
  'use strict';
  const { U, DATA } = PX, { $ } = U;
  const R = PX.qresults = {};
  let last = null;

  function hist(res) {
    const { c, w, h } = U.fit($('#qc-hist')); if (w < 2) return;
    c.fillStyle = U.css('--panel-2'); c.fillRect(0, 0, w, h);
    if (!res) { c.fillStyle = U.css('--muted'); c.font = '13px "IBM Plex Sans KR", sans-serif'; c.fillText('▶ QPU 실행을 누르면 결과가 나옵니다.', 16, h / 2); return; }
    const m = res.meas.length, keys = [...Array(1 << m).keys()].map(i => i.toString(2).padStart(m, '0'));
    const shown = m <= 5 ? keys : keys.filter(k => res.counts[k] || res.idealCounts[k] > 0.001);
    const L = 40, B = m > 3 ? 46 : 26, pw = w - L - 10, ph = h - B - 14, bw = pw / shown.length;
    const vals = shown.map(k => [(res.counts[k] || 0) / res.total, res.idealCounts[k] || 0]);
    const top = Math.min(1, Math.max(0.25, ...vals.flat()) * 1.15);
    c.font = '11px "IBM Plex Mono", monospace';
    for (let i = 0; i <= 4; i++) { const v = top * i / 4, y = 10 + ph - v / top * ph; c.strokeStyle = U.css('--line'); c.beginPath(); c.moveTo(L, y); c.lineTo(w - 8, y); c.stroke(); c.fillStyle = U.css('--muted'); c.fillText(Math.round(v * 100) + '%', 2, y + 4); }
    shown.forEach((k, i) => {
      const [mv, iv] = vals[i], x = L + i * bw, bh = mv / top * ph;
      c.fillStyle = U.css('--lav'); c.fillRect(x + bw * 0.15, 10 + ph - bh, bw * 0.7, bh);
      c.strokeStyle = U.css('--on-pastel'); c.lineWidth = 1; c.strokeRect(x + bw * 0.15 + .5, 10 + ph - bh + .5, bw * 0.7 - 1, Math.max(0, bh - 1));
      if (iv > 0) { const y = 10 + ph - iv / top * ph; c.strokeStyle = U.css('--accent'); c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + bw * 0.08, y); c.lineTo(x + bw * 0.92, y); c.stroke(); c.lineWidth = 1; }
      c.save(); c.fillStyle = U.css('--ink'); c.translate(x + bw / 2, h - B + 14);
      if (m > 3) { c.rotate(-Math.PI / 3); c.textAlign = 'right'; c.fillText(k, 6, 4); } else { c.textAlign = 'center'; c.fillText(k, 0, 0); }
      c.restore();
      if (mv > 0.04 && bw > 34) { c.fillStyle = U.css('--ink'); c.textAlign = 'center'; c.fillText((mv * 100).toFixed(1), x + bw / 2, 10 + ph - bh - 4); c.textAlign = 'left'; }
    });
  }
  function legend(res) {
    $('#qc-legend').innerHTML = res ? `<span><i class="sw bg-lav"></i>측정 (${res.total}샷)</span><span><i class="sw ln"></i>이상적 확률</span><span class="note">비트 순서 ${res.meas.slice().reverse().map(q => 'Q' + q).join(' ')}${res.autoMeas ? ' · 측정 블록이 없어 끝에서 전체 측정' : ''}</span>` : '';
  }

  function bloch(res) {
    const host = $('#qc-bloch'), n = res ? res.blochIdeal.length : 0;
    if (host.children.length !== n) host.innerHTML = [...Array(n)].map((_, q) => `<figure><canvas id="bl-${q}"></canvas><figcaption id="blc-${q}">Q${q}</figcaption></figure>`).join('') || '<p class="note">실행하면 큐비트마다 블로흐 구가 나옵니다.</p>';
    for (let q = 0; q < n; q++) {
      const { c, w, h } = U.fit($('#bl-' + q)); if (w < 2) continue;
      const cx = w / 2, cy = h / 2 + 4, Rr = Math.min(w, h) * 0.38;
      const P = (x, y, z) => [cx + Rr * (0.94 * y - 0.42 * x), cy - Rr * (0.94 * z - 0.3 * x)];
      c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(cx - Rr * 0.3, cy - Rr * 0.4, Rr * 0.1, cx, cy, Rr); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, U.css('--sky'));
      c.fillStyle = g; c.beginPath(); c.arc(cx, cy, Rr, 0, U.TAU); c.fill(); c.strokeStyle = U.css('--on-pastel'); c.globalAlpha = .55; c.stroke();
      c.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * U.TAU, [x, y] = P(Math.cos(a), Math.sin(a), 0); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      [[[0, 0, -1], [0, 0, 1]], [[-1, 0, 0], [1, 0, 0]], [[0, -1, 0], [0, 1, 0]]].forEach(([a, b]) => { const p = P(...a), r = P(...b); c.setLineDash([2, 3]); c.beginPath(); c.moveTo(...p); c.lineTo(...r); c.stroke(); c.setLineDash([]); });
      c.globalAlpha = 1; c.fillStyle = U.css('--on-pastel'); c.font = '11px "IBM Plex Mono", monospace';
      c.fillText('|0⟩', ...P(0, 0, 1.22).map((v, i) => v - (i ? 0 : 9))); c.fillText('|1⟩', ...P(0, 0, -1.38).map((v, i) => v - (i ? 0 : 9))); c.fillText('x', ...P(1.3, 0, 0)); c.fillText('y', ...P(0, 1.18, 0));
      const arrow = (v, col, dash) => { const [x, y] = P(...v), o = P(0, 0, 0); c.strokeStyle = col; c.lineWidth = 2.5; c.setLineDash(dash ? [4, 3] : []); c.beginPath(); c.moveTo(...o); c.lineTo(x, y); c.stroke(); c.setLineDash([]); c.fillStyle = col; c.beginPath(); c.arc(x, y, dash ? 3 : 4.5, 0, U.TAU); c.fill(); c.lineWidth = 1; };
      const bi = res.blochIdeal[q], bn = res.blochNoisy[q];
      arrow(bi, U.css('--accent'), true); arrow(bn, '#d94a74', false);
      const r = Math.hypot(...bn), th = Math.acos(U.clamp(bi[2] / (Math.hypot(...bi) || 1), -1, 1)) * 180 / Math.PI, ph = Math.atan2(bi[1], bi[0]) * 180 / Math.PI;
      $('#blc-' + q).textContent = `Q${q} · θ ${th.toFixed(0)}° φ ${ph.toFixed(0)}° · 순도 |r| ${r.toFixed(2)}`;
    }
  }

  function sv(res) {
    const host = $('#qc-sv'); if (!res) { host.innerHTML = ''; return; }
    const st = res.sv, n = st.n, rows = [];
    for (let i = 0; i < st.N; i++) { const p = st.re[i] ** 2 + st.im[i] ** 2; if (p > 1e-4) rows.push([i, p, Math.atan2(st.im[i], st.re[i])]); }
    host.innerHTML = `<table class="svt"><thead><tr><th>기저 |${[...Array(n)].map((_, q) => 'q' + (n - 1 - q)).join('')}⟩</th><th>진폭</th><th>확률</th><th>위상</th></tr></thead><tbody>` + rows.slice(0, 32).map(([i, p, a]) => {
      const deg = a * 180 / Math.PI, hue = U.mod(deg, 360);
      return `<tr><td class="num">|${i.toString(2).padStart(n, '0')}⟩</td><td class="num">${Math.sqrt(p).toFixed(3)}∠${deg.toFixed(0)}°</td><td><span class="pbar"><i style="width:${(p * 100).toFixed(1)}%"></i></span> <span class="num">${(p * 100).toFixed(1)}%</span></td>
        <td><svg width="22" height="22" viewBox="-11 -11 22 22"><circle r="9" fill="hsl(${hue} 70% 82%)" stroke="var(--on-pastel)"/><line x1="0" y1="0" x2="${(8 * Math.cos(a)).toFixed(1)}" y2="${(-8 * Math.sin(a)).toFixed(1)}" stroke="var(--on-pastel)" stroke-width="2"/></svg></td></tr>`;
    }).join('') + '</tbody></table>' + (res.midCirc ? '<p class="note">중간 측정·리셋이 있는 회로라 측정을 무시한 상태벡터를 보여 줍니다.</p>' : '');
  }

  function budget(res) {
    const H = PX.QH, host = $('#qc-budget');
    if (!res) { host.innerHTML = ''; return; }
    const B = res.budget, rows = [['1Q 구동 펄스', B.gate1, `${res.nPhys}개 × ${(H.qubits[0].p1 * 100).toFixed(3)}%`], ['2Q 플럭스 게이트', B.gate2, `${res.n2.toFixed(0)}개 등가${res.swaps.length ? ' (라우팅 SWAP 포함)' : ''}`], ['결맞음 손실 (T1/T2)', B.deco, `${res.dur} ns 동안`], ['판독 오류', B.ro, `${res.meas.length}큐비트 × ${(H.qubits[0].ero * 100).toFixed(2)}%`], ['열적 들뜸', B.therm, `${(H.T * 1000).toFixed(0)} mK`]];
    const mx = Math.max(0.05, ...rows.map(r => r[1]));
    host.innerHTML = rows.map(([n, v, d]) => `<div class="bud"><span>${n}</span><span class="pbar"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${v > 0.1 ? 'var(--rose)' : v > 0.02 ? 'var(--butter)' : 'var(--mint)'}"></i></span><span class="num">${(v * 100).toFixed(2)}%</span><small>${d}</small></div>`).join('')
      + `<dl class="kv" style="margin-top:10px"><dt>측정 충실도</dt><dd>${(res.fidelity * 100).toFixed(2)} % (이상적 분포 대비)</dd><dt>구동 보정</dt><dd>진폭 ${H.kAmp.toFixed(2)}×π · 이조 ${H.det.toFixed(1)} MHz</dd><dt>판독 SNR</dt><dd>${H.snr.toFixed(1)}${H.roDead ? ' (체인 고장)' : ''}</dd>${res.swaps.length ? `<dt>라우팅</dt><dd>${res.swaps.map(s => `Q${s.a}–Q${s.b} SWAP×${s.k}`).join(', ')}</dd>` : ''}</dl>`;
  }

  /* pulse schedule: lanes D (drive), F (flux), M (readout) per qubit */
  R.schedule = function () {
    const cv = $('#qc-sched'); if (!cv) return;
    const prog = PX.qprog, n = PX.composer ? PX.composer.n : 2;
    const lanes = []; for (let q = 0; q < n; q++) { lanes.push('D' + q); if (prog.pulses.some(p => p.lane === 'F' + q)) lanes.push('F' + q); if (prog.pulses.some(p => p.lane === 'M' + q)) lanes.push('M' + q); }
    const LH = 30, Hh = lanes.length * LH + 30; cv.style.height = Hh + 'px';
    const { c, w, h } = U.fit(cv); if (w < 2) return;
    c.fillStyle = U.css('--scr'); c.fillRect(0, 0, w, h);
    const L = 44, dur = Math.max(100, prog.dur), X = t => L + t / dur * (w - L - 12);
    const step = [20, 50, 100, 200, 500, 1000, 2000, 5000].find(s => dur / s <= 10) || 10000;
    c.font = '13px VT323, monospace';
    for (let t = 0; t <= dur; t += step) { c.strokeStyle = U.css('--scr-grid'); c.beginPath(); c.moveTo(X(t), 4); c.lineTo(X(t), h - 18); c.stroke(); c.fillStyle = U.css('--scr-ink'); c.fillText(t >= 1000 ? (t / 1000) + 'µs' : t + 'ns', X(t) + 2, h - 5); }
    const col = { D: U.css('--ph1'), F: U.css('--ph3'), M: U.css('--ph2') };
    lanes.forEach((ln, i) => {
      const y0 = 8 + i * LH + LH * 0.72, amp = LH * 0.55, k = ln[0];
      c.fillStyle = col[k]; c.fillText(ln, 6, y0 - 4);
      c.strokeStyle = 'rgba(141,155,184,.35)'; c.beginPath(); c.moveTo(L, y0); c.lineTo(w - 10, y0); c.stroke();
      prog.pulses.filter(p => p.lane === ln).forEach(p => {
        if (p.kind === 'vz') { c.fillStyle = U.css('--ph4'); c.beginPath(); c.arc(X(p.t0), y0 - amp * 0.5, 3.5, 0, U.TAU); c.fill(); if (/SWAP/.test(p.label)) c.fillText(p.label, X(p.t0) + 5, y0 - amp * 0.4); return; }
        if (p.kind === 'acq') { c.strokeStyle = col.M; c.setLineDash([3, 3]); c.strokeRect(X(p.t0), y0 - amp - 2, X(p.t0 + p.dur) - X(p.t0), amp + 4); c.setLineDash([]); return; }
        c.beginPath(); c.moveTo(X(p.t0), y0);
        for (let s = 0; s <= 40; s++) { const t = p.t0 + p.dur * s / 40; let e; if (p.kind === 'gauss') e = Math.exp(-((t - p.t0 - p.dur / 2) ** 2) / (2 * (p.dur / 5) ** 2)); else e = Math.min(1, (t - p.t0) / 12, (p.t0 + p.dur - t) / 12); c.lineTo(X(t), y0 - Math.max(0, e) * amp * Math.min(1, p.amp + 0.15)); }
        c.lineTo(X(p.t0 + p.dur), y0); c.closePath();
        c.globalAlpha = p.cond ? 0.35 : 0.55; c.fillStyle = col[k]; c.fill(); c.globalAlpha = 1; c.strokeStyle = col[k]; c.stroke();
        if (X(p.t0 + p.dur) - X(p.t0) > 26 || p.kind === 'gauss') { c.fillStyle = U.css('--scr-ink'); c.fillText(p.label, X(p.t0), y0 - amp - 3); }
      });
    });
    $('#qc-sched-info').textContent = `총 ${prog.dur >= 1000 ? (prog.dur / 1000).toFixed(2) + ' µs' : prog.dur + ' ns'} · 구동 = LO 4.950 GHz + IF 50 MHz · 보라 점 = 가상 Z(위상 프레임만 회전, 펄스 없음) · 점선 상자 = ADC 적분 창`;
  };

  R.render = function (res) { last = res; hist(res); legend(res); bloch(res); sv(res); budget(res); };
  let t = 0;
  PX.addFrame('instrument', dt => { if (PX.instMode !== 'quantum') return; t += dt; if (t > 0.5) { t = 0; hist(last); if (last) bloch(last); R.schedule(); } });
})(window.PX);
