/* Analytic signal models. Each f(t) returns volts at absolute time t (seconds, PX.now() base) */
(function (PX) {
  'use strict';
  const { U, S, C } = PX, { TAU, mod, clamp } = U;
  const LUMA = [0.95, 0.86, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3];

  function kbRow(r, t) { if (!PX.clockOn() || S.faults.has('pio')) return PX.logicOn() ? 5 : 0; return Math.floor(mod(t, 8 * C.SLOT) / C.SLOT) === r ? 0 : 5; }
  function kbCol(t) { if (!PX.logicOn()) return 0; if (!PX.clockOn() || S.faults.has('pio') || S.faults.has('kbd')) return 5; const r = Math.floor(mod(t, 8 * C.SLOT) / C.SLOT); return S.rowHas[r] ? 0 : 5; }
  function quad(axis, which, t) {
    if (!PX.logicOn() || S.faults.has('mouse')) return 0;
    const m = S.mouse, v = axis === 'x' ? m.vx : m.vy, f = Math.abs(v) * C.QK;
    let th = f < 0.5 ? (axis === 'x' ? m.angX : m.angY) : TAU * f * t;
    const sg = f < 0.5 ? 1 : Math.sign(v);
    if (which === 'b') th -= sg * Math.PI / 2;
    return Math.sin(th) >= 0 ? 5 : 0;
  }
  /* key switch contact with bounce after the last press */
  function sw(t) {
    if (!PX.logicOn()) return 0;
    const d = t - S.lastPress;
    if (d >= 0 && d < 0.0032) { const k = U.hash(Math.floor(d / 45e-6) + 977); return k > d / 0.0032 ? 5 * (0.75 + 0.25 * k) : 0.15 * k; }
    return S.pressed.size ? 0.05 : 5;
  }
  function psg(t) {
    if (!PX.clockOn() || S.faults.has('psg')) return 0;
    let v = 0;
    S.psg.ch.forEach(ch => { if (ch.on) v += ch.v * (Math.sin(TAU * ch.f * t) >= 0 ? 1 : -1); });
    if (S.psg.noise > 0) v += S.psg.noise * (U.hash(Math.floor(t * 22000)) * 2 - 1);
    return v;
  }
  PX.kbRow = kbRow; PX.kbCol = kbCol; PX.quad = quad;

  PX.SIG = {
    psu_raw: { n: 'C1 정류 전압', f: t => { if (!PX.mainsOn()) return 0; const P = PX.P, T = 1 / (2 * C.MAINS), tau = mod(t - T / 2, T); return Math.max(0, P.vpk - (P.load / P.C) * tau, P.vpk * Math.abs(Math.sin(TAU * C.MAINS * t))); } },
    psu_5v: { n: '+5V 레귤레이터 출력', f: t => { if (!PX.logicOn()) return 0; const v = PX.SIG.psu_raw.f(t); return (v < 7 ? Math.max(0, v - 2) : 5) + (Math.random() - .5) * 0.012 + 0.004 * Math.sin(TAU * C.MAINS * 2 * t); } },
    hdef: { n: '수평 편향 (요크)', f: t => { if (!PX.mainsOn() || S.faults.has('crt')) return 0; const f = PX.hLocked() && PX.syncOK() ? C.H_NOM : S.hFreq, p = mod(t * f + 0.86, 1); return S.hSize * (p < 0.84 ? -1 + 2 * p / 0.84 : 1 - 2 * (p - 0.84) / 0.16); } },
    hsync: { n: 'H-SYNC (TTL)', f: t => { if (!PX.syncOK()) return PX.logicOn() ? 5 : 0; return mod(t * C.H_NOM, 1) * 1e6 / C.H_NOM < 4.7 ? 0 : 5; } },
    vdef: { n: '수직 편향', f: t => { if (!PX.mainsOn() || S.faults.has('crt')) return 0; const p = mod(t * (C.V_NOM + S.vHold), 1); return 0.9 * (p < 0.94 ? -1 + 2 * p / 0.94 : 1 - 2 * (p - 0.94) / 0.06); } },
    video: { n: '컴포지트 비디오', f: t => { if (!PX.syncOK()) return 0; const u = mod(t * C.H_NOM, 1) * 1e6 / C.H_NOM; if (u < 4.7) return 0; if (u < 10.9 || u > 62) return 0.3; const b = clamp(Math.floor((u - 10.9) / (51.1 / 8)), 0, 7); return 0.3 + 0.7 * S.bright * LUMA[b] + (Math.random() - .5) * 0.02; } },
    clk: { n: 'CPU 클럭 3.58 MHz', f: t => PX.clockOn() && mod(t * C.CPU_HZ, 1) < 0.5 ? 5 : 0 },
    row0: { n: 'KB ROW0 스캔', f: t => kbRow(0, t) },
    row1: { n: 'KB ROW1 스캔', f: t => kbRow(1, t) },
    col: { n: 'KB COL 감지', f: t => kbCol(t) },
    sw: { n: '키 스위치 접점', f: sw },
    xa: { n: '마우스 XA', f: t => quad('x', 'a', t) },
    xb: { n: '마우스 XB', f: t => quad('x', 'b', t) },
    ya: { n: '마우스 YA', f: t => quad('y', 'a', t) },
    yb: { n: '마우스 YB', f: t => quad('y', 'b', t) },
    psg: { n: 'PSG 오디오 출력', f: psg },
    off: { n: '— 끄기 —', f: () => NaN }
  };
})(window.PX);
