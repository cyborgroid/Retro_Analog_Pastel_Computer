/* Quantum hardware model: transmon physics, dilution refrigerator, control and readout chain → error rates.
   Every number the composer's noise model uses comes from here, so Circuit-tab knobs change results. */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX;
  const Q = PX.Q = {
    EJ: 14.0, EC: 0.26, flux: 0,           // GHz, GHz, Φ/Φ0 (global flux coil)
    fdOffMHz: 0, amp: 1.0, ampPi: 1.0, drag: true,
    roPow: -125, roTau: 1.0, twpa: true,   // dBm at device, µs
    cool: 1, cooling: true                 // 0 = room temperature, 1 = base temperature
  };
  PX.qf01 = (flux = Q.flux, EJ = Q.EJ, EC = Q.EC) => Math.max(0, Math.sqrt(8 * EJ * Math.abs(Math.cos(Math.PI * flux)) * EC) - EC);
  Q.fdCal = PX.qf01(0);                     // drive frequency found by the last calibration (GHz)

  PX.stageT = i => { const [, base, s, d] = DATA.QSTAGES[i]; if (!d) return base; const k = U.clamp((Q.cool - s) / d, 0, 1); return base * Math.pow(300 / base, 1 - k); };
  const erfc = x => { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? y : 2 - y; };
  PX.erfc = erfc;

  PX.calcQ = function () {
    const F = S.faults, T = PX.stageT(5);
    const f01 = PX.qf01(), alpha = -Q.EC, fd = Q.fdCal + Q.fdOffMHz / 1000, det = (f01 - fd) * 1000;
    const pth = 1 / (1 + Math.exp(0.048 * Math.max(f01, 0.1) / T));                // thermal excited population
    const qp = 1 + 4e6 * Math.exp(-2.1 / T);                                         // quasiparticle T1 suppression (Al gap ≈ 2.1 K)
    const sens = Math.abs(Math.sin(Math.PI * Q.flux));                               // flux-noise sensitivity, 0 at the sweet spot
    const chipDead = F.has('qpu');
    const qubits = [0, 1, 2, 3, 4].map(i => {
      const T1 = chipDead ? 0.002 : 90 * DATA.QOFFS.t1[i] / qp;
      const Tphi = chipDead ? 0.002 : 120 / (1 + 40 * sens) / Math.sqrt(qp);
      const T2 = 1 / (1 / (2 * T1) + 1 / Tphi);
      return { f01: f01 + DATA.QOFFS.f[i] * (f01 / 5.136), T1, T2, Tphi };
    });
    const driveOK = !F.has('awg') && !F.has('lo') && !F.has('iq') && !F.has('qcu');
    const fluxOK = !F.has('awg') && !F.has('qcu');
    const kAmp = driveOK ? Q.amp / Q.ampPi : 0, delta = det / 12.5;                  // Rabi rate of a 40 ns π pulse = 12.5 MHz
    const tg = 0.04, tg2 = 0.2;
    const leak = (Q.drag ? 0.0004 : 0.009) * kAmp * kAmp;
    qubits.forEach((q, i) => {
      q.p1 = Math.min(0.5, tg / 3 * (1 / q.T1 + 1 / q.T2) + leak);
      q.p2 = Math.min(0.75, 0.004 + 5 * tg2 / 3 * (1 / q.T1 + 1 / q.T2));
    });
    /* dispersive readout */
    const n = Math.pow(10, (Q.roPow + 130) / 10), ncrit = 91;
    let gain = (Q.twpa && !F.has('twpa')) ? 1 : 0.3; if (F.has('hemt')) gain *= 0.05;
    const snr = 3 * Math.sqrt(n * Q.roTau) * gain;
    const eSep = 0.5 * erfc(snr / (2 * Math.SQRT2)), eMist = n > ncrit ? 0.3 * (1 - Math.exp(-(n - ncrit) / ncrit)) : 0;
    const roDead = F.has('adc') || F.has('rtamp') || F.has('qcu');
    qubits.forEach((q, i) => { q.ero = roDead ? 0.5 : Math.min(0.5, eSep * DATA.QOFFS.ro[i] + Q.roTau / (2 * q.T1) + eMist); });
    const chi = 0.625 * (0.26 / Math.max(0.05, Q.EC));                                   // MHz, from g = 100 MHz, Δ ≈ −1.9 GHz
    return { T, f01, alpha, fd, det, pth, qp, sens, qubits, driveOK, fluxOK, kAmp, delta, leak, n, ncrit, snr, eSep, eMist, gain, chi, chipDead, roDead, tg, tg2 };
  };

  PX.qReady = () => {
    if (!PX.cpuOK()) return { ok: false, why: '호스트 컴퓨터(PX-80)가 동작하지 않습니다. 전원과 CPU·ROM·XTAL 고장을 확인하세요.' };
    if (S.faults.has('qbi')) return { ok: false, why: 'Q-Bus 인터페이스 고장: 회로를 QCU로 보낼 수 없습니다.' };
    if (S.faults.has('qcu')) return { ok: false, why: 'QCU 시퀀서 고장: 펄스를 재생할 수 없습니다.' };
    return { ok: true, why: PX.stageT(5) > 0.05 ? '혼합실이 50 mK보다 뜨거워 결과가 열잡음에 묻힙니다.' : '' };
  };

  PX.QH = PX.calcQ();
  PX.qrecalc = () => { PX.QH = PX.calcQ(); PX.emit('quantum'); };
  PX.on('fault', PX.qrecalc); PX.on('power', PX.qrecalc);
  let acc = 0;
  PX.addFrame('*', dt => {
    const warm = !Q.cooling || S.faults.has('cryoctl');
    const before = Q.cool;
    Q.cool = U.clamp(Q.cool + (warm ? -dt / 25 : dt / 40), 0, 1);
    acc += dt;
    if (Q.cool !== before && acc > 0.2) { acc = 0; PX.qrecalc(); }
  });
})(window.PX);
