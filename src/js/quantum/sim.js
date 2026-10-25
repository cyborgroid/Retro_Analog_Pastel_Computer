/* State-vector simulator (≤ 5 qubits) with a hardware-derived noise model run as quantum trajectories:
   coherent drive errors (amplitude miscalibration, detuning), depolarizing gate errors, T1 jumps, dephasing,
   thermal initial population, SWAP routing on the T-shaped coupling map, readout assignment errors. */
(function (PX) {
  'use strict';
  const { DATA } = PX;
  const SQ = Math.SQRT1_2;

  function mk(n) { const N = 1 << n, re = new Float64Array(N), im = new Float64Array(N); re[0] = 1; return { n, N, re, im }; }
  function u1(st, q, m) {
    const { N, re, im } = st, b = 1 << q, [ar, ai, br, bi, cr, ci, dr, di] = m;
    for (let i = 0; i < N; i++) {
      if (i & b) continue; const j = i | b;
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = ar * xr - ai * xi + br * yr - bi * yi; im[i] = ar * xi + ai * xr + br * yi + bi * yr;
      re[j] = cr * xr - ci * xi + dr * yr - di * yi; im[j] = cr * xi + ci * xr + dr * yi + di * yr;
    }
  }
  function cphase(st, a, b, th) { const c = Math.cos(th), s = Math.sin(th), m = (1 << a) | (1 << b); for (let i = 0; i < st.N; i++) if ((i & m) === m) { const r = st.re[i], x = st.im[i]; st.re[i] = r * c - x * s; st.im[i] = r * s + x * c; } }
  function swap(st, a, b) { const A = 1 << a, B = 1 << b; for (let i = 0; i < st.N; i++) if ((i & A) && !(i & B)) { const j = (i & ~A) | B; [st.re[i], st.re[j]] = [st.re[j], st.re[i]]; [st.im[i], st.im[j]] = [st.im[j], st.im[i]]; } }
  const MAT = {
    H: [SQ, 0, SQ, 0, SQ, 0, -SQ, 0], X: [0, 0, 1, 0, 1, 0, 0, 0], Y: [0, 0, 0, -1, 0, 1, 0, 0], Z: [1, 0, 0, 0, 0, 0, -1, 0],
    S: [1, 0, 0, 0, 0, 0, 0, 1], T: [1, 0, 0, 0, 0, 0, SQ, SQ], SX: [0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5]
  };
  const rz = th => [Math.cos(th / 2), -Math.sin(th / 2), 0, 0, 0, 0, Math.cos(th / 2), Math.sin(th / 2)];
  /* rotation by angle a about unit axis (nx,ny,nz) */
  const rotN = (nx, ny, nz, a) => { const c = Math.cos(a / 2), s = Math.sin(a / 2); return [c, -s * nz, -s * ny, -s * nx, s * ny, -s * nx, c, s * nz]; };
  const ideal = (g, th) => g === 'RX' ? rotN(1, 0, 0, th) : g === 'RY' ? rotN(0, 1, 0, th) : g === 'RZ' ? rz(th) : MAT[g];
  function p1of(st, q) { let p = 0; const b = 1 << q; for (let i = 0; i < st.N; i++) if (i & b) p += st.re[i] * st.re[i] + st.im[i] * st.im[i]; return p; }
  function collapse(st, q, bit) {
    const b = 1 << q; let norm = 0;
    for (let i = 0; i < st.N; i++) { if (((i & b) ? 1 : 0) !== bit) { st.re[i] = 0; st.im[i] = 0; } else norm += st.re[i] * st.re[i] + st.im[i] * st.im[i]; }
    const k = norm > 0 ? 1 / Math.sqrt(norm) : 0; for (let i = 0; i < st.N; i++) { st.re[i] *= k; st.im[i] *= k; }
  }
  function damp(st, q, gamma) { /* amplitude-damping trajectory step */
    const p1 = p1of(st, q), pj = gamma * p1;
    if (Math.random() < pj) { collapse(st, q, 1); u1(st, q, MAT.X); return; }
    const k = Math.sqrt(1 - gamma), b = 1 << q; let norm = 0;
    for (let i = 0; i < st.N; i++) { if (i & b) { st.re[i] *= k; st.im[i] *= k; } norm += st.re[i] * st.re[i] + st.im[i] * st.im[i]; }
    const s = 1 / Math.sqrt(norm); for (let i = 0; i < st.N; i++) { st.re[i] *= s; st.im[i] *= s; }
  }
  const pauli = (st, q) => { const r = Math.random(); u1(st, q, r < 1 / 3 ? MAT.X : r < 2 / 3 ? MAT.Y : MAT.Z); };
  function bloch(st, q) {
    const b = 1 << q; let r00 = 0, r11 = 0, xr = 0, xi = 0;
    for (let i = 0; i < st.N; i++) {
      if (i & b) continue; const j = i | b;
      r00 += st.re[i] ** 2 + st.im[i] ** 2; r11 += st.re[j] ** 2 + st.im[j] ** 2;
      xr += st.re[i] * st.re[j] + st.im[i] * st.im[j]; xi += st.im[i] * st.re[j] - st.re[i] * st.im[j]; /* ρ01 = Σ a_i a_j* */
    }
    return [2 * xr, -2 * xi, r00 - r11];
  }

  /* BFS distance on the coupling map */
  const DIST = (() => { const d = [...Array(5)].map((_, i) => [...Array(5)].map((_, j) => i === j ? 0 : 9)); DATA.QCOUPLING.forEach(([a, b]) => { d[a][b] = d[b][a] = 1; }); for (let k = 0; k < 5; k++) for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) d[i][j] = Math.min(d[i][j], d[i][k] + d[k][j]); return d; })();
  PX.qdist = (a, b) => DIST[a][b];

  const DUR = { phys: 40, vz: 0, CZ: 200, CP: 200, CX: 280, SWAP: 840, M: 1000, RST: 1200 };
  function durOf(o) { const k = DATA.GATES[o.g].kind; if (k === 'phys') return 40; if (k === 'vz') return 0; const extra = (o.q2 != null ? (DIST[o.q][o.q2] - 1) * 2 * 840 : 0); return (DUR[o.g] || 40) + extra; }
  PX.qlayers = circ => { const L = {}; circ.forEach(o => (L[o.t] = L[o.t] || []).push(o)); return Object.keys(L).map(Number).sort((a, b) => a - b).map(t => ({ t, ops: L[t], dur: Math.max(0, ...L[t].map(durOf)) })); };

  /* apply one op. hw = null → ideal */
  function apply(st, o, hw, rec) {
    const g = o.g, kind = DATA.GATES[g].kind;
    const phys = (q, phi, th) => {
      if (!hw) { u1(st, q, phi === 0 ? rotN(1, 0, 0, th) : rotN(0, 1, 0, th)); return; }
      const k = hw.kAmp, d = hw.delta, W = Math.hypot(k, d);
      if (W > 1e-9) u1(st, q, rotN(k * Math.cos(phi) / W, k * Math.sin(phi) / W, d / W, th * W));
      if (Math.random() < hw.qubits[q].p1) pauli(st, q);
    };
    const H = q => { u1(st, q, rz(Math.PI / 2)); phys(q, 0, Math.PI / 2); u1(st, q, rz(Math.PI / 2)); };
    const cz = (a, b, th = Math.PI) => {
      if (!hw || hw.fluxOK) cphase(st, a, b, th);
      if (hw) {
        const p = 1 - Math.pow(1 - Math.max(hw.qubits[a].p2, hw.qubits[b].p2), 1 + 6 * (DIST[a][b] - 1));
        if (Math.random() < p) { pauli(st, a); if (Math.random() < 0.5) pauli(st, b); }
      }
    };
    if (kind === 'vz') { u1(st, o.q, ideal(g, o.th)); return; }
    if (g === 'H') return H(o.q);
    if (g === 'X') return phys(o.q, 0, Math.PI);
    if (g === 'Y') return phys(o.q, Math.PI / 2, Math.PI);
    if (g === 'SX') return phys(o.q, 0, Math.PI / 2);
    if (g === 'RX') return phys(o.q, 0, o.th);
    if (g === 'RY') return phys(o.q, Math.PI / 2, o.th);
    if (g === 'CZ') return cz(o.q, o.q2);
    if (g === 'CP') return cz(o.q, o.q2, o.th);
    if (g === 'CX') { H(o.q2); cz(o.q, o.q2); H(o.q2); return; }
    if (g === 'SWAP') { if (!hw) { swap(st, o.q, o.q2); return; } [[o.q, o.q2], [o.q2, o.q], [o.q, o.q2]].forEach(([c, t]) => { H(t); cz(c, t); H(t); }); return; }
    if (g === 'M' || g === 'RST') {
      if (!rec) return;
      const bit = Math.random() < p1of(st, o.q) ? 1 : 0; collapse(st, o.q, bit);
      if (g === 'RST') { if (bit) u1(st, o.q, MAT.X); if (hw && Math.random() < hw.qubits[o.q].ero * 0.5) u1(st, o.q, MAT.X); }
      else rec[o.q] = bit;
    }
  }

  PX.qsim = {
    MAT, bloch,
    run(circ, n, shots = 1024) {
      const hw = PX.QH, layers = PX.qlayers(circ);
      const lastT = {}; circ.forEach(o => { [o.q, o.q2].forEach(q => { if (q != null) lastT[q] = Math.max(lastT[q] ?? -1, o.t); }); });
      let meas = [...new Set(circ.filter(o => o.g === 'M').map(o => o.q))].sort((a, b) => a - b);
      const autoMeas = !meas.length; if (autoMeas) meas = [...Array(n).keys()];
      const terminal = q => !circ.some(o => o.g === 'M' && o.q === q) || circ.filter(o => o.g === 'M' && o.q === q).every(o => o.t >= lastT[q]);
      const midCirc = meas.some(q => !terminal(q)) || circ.some(o => o.g === 'RST');
      const key = bits => meas.slice().reverse().map(q => bits[q]).join('');
      const sampleFinal = (st, rec, k, noisy, out) => {
        const probs = new Float64Array(st.N); let acc = 0; for (let i = 0; i < st.N; i++) { acc += st.re[i] ** 2 + st.im[i] ** 2; probs[i] = acc; }
        for (let s = 0; s < k; s++) {
          const r = Math.random() * acc; let idx = 0; while (idx < st.N - 1 && probs[idx] < r) idx++;
          const bits = {}; meas.forEach(q => { let b = rec[q] != null ? rec[q] : (idx >> q) & 1; if (noisy && Math.random() < hw.qubits[q].ero) b ^= 1; bits[q] = b; });
          const kk = key(bits); out[kk] = (out[kk] || 0) + 1;
        }
      };
      /* ideal state vector (measurements ignored) */
      const sv = mk(n); layers.forEach(L => L.ops.forEach(o => { if (o.g !== 'M' && o.g !== 'RST') apply(sv, o, null, null); }));
      /* ideal distribution */
      const idealCounts = {};
      if (!midCirc) { const st = mk(n); layers.forEach(L => L.ops.forEach(o => apply(st, o, null, null))); sampleFinal(st, {}, 0, false, {}); const N = st.N; for (let i = 0; i < N; i++) { const p = st.re[i] ** 2 + st.im[i] ** 2; if (p < 1e-12) continue; const bits = {}; meas.forEach(q => bits[q] = (i >> q) & 1); const kk = key(bits); idealCounts[kk] = (idealCounts[kk] || 0) + p; } }
      else { const tmp = {}; for (let r = 0; r < 600; r++) { const st = mk(n), rec = {}; layers.forEach(L => L.ops.forEach(o => apply(st, o, null, rec))); sampleFinal(st, rec, 1, false, tmp); } Object.entries(tmp).forEach(([k, v]) => idealCounts[k] = v / 600); }
      /* noisy trajectories */
      const counts = {}, T = 128, spt = Math.max(1, Math.round(shots / T)), blochN = [...Array(n)].map(() => [0, 0, 0]);
      for (let tr = 0; tr < T; tr++) {
        const st = mk(n), rec = {};
        if (hw.chipDead) { for (let s = 0; s < spt; s++) { const bits = {}; meas.forEach(q => bits[q] = Math.random() < 0.5 ? 1 : 0); const kk = key(bits); counts[kk] = (counts[kk] || 0) + 1; } continue; }
        for (let q = 0; q < n; q++) if (Math.random() < hw.pth) u1(st, q, MAT.X);
        layers.forEach(L => {
          L.ops.forEach(o => apply(st, o, hw, rec));
          const dt = L.dur / 1000;
          if (dt > 0) for (let q = 0; q < n; q++) { const Q = hw.qubits[q]; damp(st, q, 1 - Math.exp(-dt / Q.T1)); if (Math.random() < (1 - Math.exp(-dt / Q.Tphi)) / 2) u1(st, q, MAT.Z); }
        });
        for (let q = 0; q < n; q++) { const b = bloch(st, q); blochN[q][0] += b[0] / T; blochN[q][1] += b[1] / T; blochN[q][2] += b[2] / T; }
        sampleFinal(st, rec, spt, true, counts);
      }
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      let bc = 0; Object.keys({ ...counts, ...idealCounts }).forEach(k => { bc += Math.sqrt((counts[k] || 0) / total * (idealCounts[k] || 0)); });
      const dur = layers.reduce((a, L) => a + L.dur, 0);
      const swaps = circ.filter(o => o.q2 != null && DIST[o.q][o.q2] > 1).map(o => ({ a: o.q, b: o.q2, k: DIST[o.q][o.q2] - 1 }));
      const nPhys = circ.filter(o => DATA.GATES[o.g].kind === 'phys').length + circ.filter(o => o.g === 'CX').length * 2 + circ.filter(o => o.g === 'SWAP').length * 6;
      const n2 = circ.filter(o => DATA.GATES[o.g].kind === 'two').reduce((a, o) => a + (o.g === 'SWAP' ? 3 : 1) * (1 + 6 * (DIST[o.q][o.q2] - 1)), 0);
      const avg = k => hw.qubits.slice(0, n).reduce((a, q) => a + q[k], 0) / n;
      const budget = { gate1: 1 - Math.pow(1 - avg('p1'), nPhys), gate2: 1 - Math.pow(1 - avg('p2'), n2), deco: 1 - Math.exp(-dur / 1000 / avg('T1') * n * 0.5), ro: 1 - Math.pow(1 - avg('ero'), meas.length), therm: 1 - Math.pow(1 - hw.pth, n) };
      return { counts, idealCounts, total, meas, autoMeas, midCirc, sv, blochIdeal: [...Array(n)].map((_, q) => bloch(sv, q)), blochNoisy: blochN, fidelity: bc * bc, dur, swaps, layers, nPhys, n2, budget };
    }
  };
})(window.PX);
