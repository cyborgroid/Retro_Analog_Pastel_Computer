/* Shared simulation state: every environment reads and writes this one object */
(function (PX) {
  'use strict';
  const C = PX.C = {
    CAPS: [1000, 2200, 3300, 4700, 6800, 10000],
    VSEC: 9, MAINS: 60, CPU_HZ: 3579545, H_NOM: 15734, V_NOM: 59.94, QK: 0.35, SLOT: 250e-6,
    HEATSINKS: [{ n: '없음 (45 °C/W)', r: 45 }, { n: '소형 핀 (12 °C/W)', r: 12 }, { n: '대형 압출 (4 °C/W)', r: 4 }],
    THETA_JC: 3, T_AMB: 25, T_TRIP: 125, T_RESET: 95,
    ASPECTS: { '4:3': 4 / 3, '16:10': 1.6, '16:9': 16 / 9 }
  };
  const S = PX.S = {
    power: true, bootT: 0, wasLogic: true,
    load: 1.0, capIdx: 3, heatsink: 2, tReg: 40, trip: false,
    hFreq: C.H_NOM, hSize: 1, vHold: 0, bright: 0.85, degauss: 0,
    diodes: true, latched: new Set(), held: new Set(), pressed: new Set(), detected: new Set(), ghosts: new Set(), rowHas: Array(8).fill(false),
    lastPress: -10,
    text: 'PASTELLA 84 READY.\n> HELLO PASTEL WORLD\n> ',
    mouse: { vx: 0, vy: 0, cx: 300, cy: 200, cntX: 0, cntY: 0, auto: false, drag: false, angX: 0, angY: 0 },
    explode: 0,
    faults: new Set(),
    monitor: { diag: 19, aspect: '16:10', bezel: 12 },
    psgOn: false,
    psg: { ch: [{ n: 'A', f: 523.25, v: 0.5, on: false }, { n: 'B', f: 659.25, v: 0.4, on: false }, { n: 'C', f: 783.99, v: 0.35, on: false }], noise: 0 }
  };

  PX.now = () => (performance.now() / 1000) % 1000;

  PX.calcPsu = () => {
    const C1 = C.CAPS[S.capIdx] * 1e-6, vpk = C.VSEC * Math.SQRT2 - 1.4;
    const load = S.trip ? 0.02 : S.load;
    const rip = load / (2 * C.MAINS * C1);
    const vmin = vpk - rip, vavg = vpk - Math.min(rip, vpk) / 2;
    return { C: C1, vpk, rip, vmin, vavg, load, dropout: !S.trip && vmin < 7, pd: S.trip ? 0 : Math.max(0, vavg - 5) * S.load };
  };
  PX.P = PX.calcPsu();
  PX.recalc = () => { PX.P = PX.calcPsu(); PX.emit('params'); };

  PX.hLocked = () => Math.abs(S.hFreq - C.H_NOM) <= 250;
  PX.mainsOn = () => S.power && !S.faults.has('psu');
  PX.logicOn = () => PX.mainsOn() && !S.trip;
  PX.clockOn = () => PX.logicOn() && !S.faults.has('xtal');
  PX.syncOK = () => PX.clockOn() && !S.faults.has('vdp');
  PX.cpuOK = () => PX.clockOn() && !S.faults.has('cpu') && !S.faults.has('rom');

  /* regulator junction temperature, first-order thermal model */
  PX.updateThermal = dt => {
    const hs = C.HEATSINKS[S.heatsink];
    const tgt = C.T_AMB + (PX.mainsOn() ? PX.P.pd * (C.THETA_JC + hs.r) : 0);
    S.tReg += (tgt - S.tReg) * (1 - Math.exp(-dt / 7));
    if (!S.trip && S.tReg >= C.T_TRIP) { S.trip = true; PX.recalc(); PX.emit('power'); }
    else if (S.trip && S.tReg <= C.T_RESET) { S.trip = false; PX.recalc(); PX.emit('power'); }
  };
})(window.PX);
