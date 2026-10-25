/* Circuit → microwave pulse schedule (the analog layer of quantum programming) + scope signals of the AWG outputs */
(function (PX) {
  'use strict';
  const { U, DATA } = PX;
  /* pulse: { lane:'D0'|'F0'|'M0', t0 (ns), dur (ns), kind:'gauss'|'flat'|'vz'|'acq', amp, phase, label } */
  PX.qcompile = function (circ) {
    const P = [], layers = PX.qlayers(circ); let t = 0;
    const g1 = (q, t0, amp, phase, label) => P.push({ lane: 'D' + q, t0, dur: 40, kind: 'gauss', amp, phase, label });
    const vz = (q, t0, label) => P.push({ lane: 'D' + q, t0, dur: 0, kind: 'vz', label });
    const H = (q, t0) => { vz(q, t0, 'Z90'); g1(q, t0, 0.5, 0, 'H'); vz(q, t0 + 40, 'Z90'); };
    const czp = (a, b, t0, amp = 0.6, label = 'CZ') => { P.push({ lane: 'F' + a, t0, dur: 200, kind: 'flat', amp, label: `${label} Q${a}·Q${b}` }); };
    layers.forEach(L => {
      L.ops.forEach(o => {
        const q = o.q, g = o.g;
        switch (g) {
          case 'H': H(q, t); break;
          case 'X': g1(q, t, 1, 0, 'X'); break;
          case 'Y': g1(q, t, 1, Math.PI / 2, 'Y'); break;
          case 'SX': g1(q, t, 0.5, 0, '√X'); break;
          case 'RX': g1(q, t, Math.abs(o.th) / Math.PI, o.th < 0 ? Math.PI : 0, 'RX ' + DATA.angleName(o.th)); break;
          case 'RY': g1(q, t, Math.abs(o.th) / Math.PI, Math.PI / 2 + (o.th < 0 ? Math.PI : 0), 'RY ' + DATA.angleName(o.th)); break;
          case 'Z': case 'S': case 'T': vz(q, t, g); break;
          case 'RZ': vz(q, t, 'RZ ' + DATA.angleName(o.th)); break;
          case 'CZ': czp(q, o.q2, t); break;
          case 'CP': czp(q, o.q2, t, 0.6 * Math.abs(o.th) / Math.PI, 'CP'); break;
          case 'CX': H(o.q2, t); czp(q, o.q2, t + 40); H(o.q2, t + 240); break;
          case 'SWAP': [[q, o.q2], [o.q2, q], [q, o.q2]].forEach(([c, tg], i) => { H(tg, t + i * 280); czp(c, tg, t + i * 280 + 40); H(tg, t + i * 280 + 240); }); break;
          case 'M': P.push({ lane: 'M' + q, t0: t, dur: 1000, kind: 'flat', amp: 0.45, label: '판독' }); P.push({ lane: 'M' + q, t0: t + 150, dur: 850, kind: 'acq', label: 'ADC' }); break;
          case 'RST': P.push({ lane: 'M' + q, t0: t, dur: 1000, kind: 'flat', amp: 0.45, label: '리셋 판독' }); P.push({ lane: 'D' + q, t0: t + 1060, dur: 40, kind: 'gauss', amp: 1, phase: 0, label: 'if 1: π', cond: true }); break;
        }
        if (o.q2 != null && PX.qdist(o.q, o.q2) > 1) P.push({ lane: 'F' + o.q, t0: t, dur: 0, kind: 'vz', label: `SWAP×${PX.qdist(o.q, o.q2) - 1} 라우팅` });
      });
      t += L.dur;
    });
    return { pulses: P, dur: t };
  };

  /* AWG outputs for the bench scope; the program repeats every shot (dur + 400 ns reset wait shown) */
  PX.qprog = { pulses: [], dur: 0 };
  const env = (p, tau) => {
    if (tau < p.t0 || tau > p.t0 + p.dur) return 0;
    if (p.kind === 'gauss') { const c = p.t0 + p.dur / 2, s = p.dur / 5; return p.amp * Math.exp(-((tau - c) ** 2) / (2 * s * s)); }
    if (p.kind === 'flat') { const r = 12, a = Math.min(1, (tau - p.t0) / r, (p.t0 + p.dur - tau) / r); return p.amp * a; }
    return 0;
  };
  function lane(name, ifMHz) {
    return t => {
      const prog = PX.qprog; if (!prog.dur || !PX.logicOn() || PX.S.faults.has('qcu') || PX.S.faults.has('awg')) return 0;
      const rep = prog.dur + 400, tau = U.mod(t * 1e9, rep); let v = 0;
      for (const p of prog.pulses) if (p.lane === name && (p.kind === 'gauss' || p.kind === 'flat')) { const e = env(p, tau); if (e) v += e * (ifMHz ? Math.cos(U.TAU * ifMHz * 1e-3 * tau + (p.phase || 0)) : 1); }
      return v * 0.5;
    };
  }
  Object.assign(PX.SIG, {
    qd0: { n: 'Q0 구동 AWG-I (IF 50 MHz)', f: lane('D0', 50) },
    qd1: { n: 'Q1 구동 AWG-I (IF 50 MHz)', f: lane('D1', 50) },
    qf0: { n: 'Q0 플럭스 펄스 (기저대역)', f: lane('F0', 0) },
    qm0: { n: 'Q0 판독 톤 (IF 25 MHz)', f: lane('M0', 25) }
  });
  DATA.PRESETS.qpulse = { n: '큐비트 펄스', s: ['qd0', 'qm0'], v: [0.2, 0.2], p: [1.2, -2.5], t: 200e-9, tl: 0.05, tr: 0, sl: 1, la: 'bus' };
})(window.PX);
