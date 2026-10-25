/* Instrument ranges and probe presets — mirrored in environments/instrument/scope-presets.json */
(function (PX) {
  const D = PX.DATA;
  D.TB = [100e-9, 200e-9, 500e-9, 1e-6, 2e-6, 5e-6, 10e-6, 20e-6, 50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3, 10e-3, 20e-3, 50e-3];
  D.VD = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
  /* s: sources, v: V/div, p: position (div), t: time/div, tl: trigger level, tr: trigger channel, sl: slope (+1 rising, -1 falling) */
  D.PRESETS = {
    psu: { n: '전원 리플', s: ['psu_raw', 'psu_5v'], v: [2, 2], p: [-3, -4], t: 5e-3, tl: 10, tr: 0, sl: 1, la: 'bus' },
    hdef: { n: '수평 편향', s: ['hdef', 'hsync'], v: [0.5, 5], p: [1.5, -3.5], t: 20e-6, tl: 2.5, tr: 1, sl: 1, la: 'bus' },
    video: { n: '비디오 라인', s: ['video', 'hsync'], v: [0.2, 5], p: [-1.5, -3.75], t: 10e-6, tl: 0.1, tr: 0, sl: 1, la: 'bus' },
    vdef: { n: '수직 편향', s: ['vdef', 'off'], v: [0.5, 1], p: [0, 0], t: 5e-3, tl: 0, tr: 0, sl: 1, la: 'bus' },
    clk: { n: 'CPU 클럭', s: ['clk', 'off'], v: [2, 2], p: [-1.25, 0], t: 100e-9, tl: 2.5, tr: 0, sl: 1, la: 'bus' },
    kb: { n: '키보드 스캔', s: ['row0', 'col'], v: [5, 5], p: [0.5, -3], t: 500e-6, tl: 2.5, tr: 0, sl: 1, la: 'kb' },
    bounce: { n: '키 바운스', s: ['sw', 'off'], v: [2, 2], p: [-1.25, 0], t: 500e-6, tl: 2.5, tr: 0, sl: -1, la: 'kb', single: true },
    mouse: { n: '마우스 직교', s: ['xa', 'xb'], v: [5, 5], p: [0.5, -3], t: 5e-3, tl: 2.5, tr: 0, sl: 1, la: 'mouse', auto: true },
    psg: { n: 'PSG 오디오', s: ['psg', 'off'], v: [0.5, 1], p: [0, 0], t: 1e-3, tl: 0, tr: 0, sl: 1, la: 'bus', psg: true },
    bus: { n: 'CPU 버스', s: ['clk', 'off'], v: [2, 2], p: [-1.25, 0], t: 200e-9, tl: 2.5, tr: 0, sl: 1, la: 'bus' }
  };
  D.PROBES = [['5v', '+5V 레일'], ['12v', '+12V 레일'], ['m12v', '−12V 레일'], ['c1', 'C1 (정류)']];
  D.LA_MODES = { bus: 'CPU 버스 사이클', kb: '키보드 스캔', mouse: '마우스 직교' };
  D.CYC = [['M1', 4, 'M1 OPCODE FETCH'], ['MR', 3, 'MEM READ'], ['M1', 4, 'M1 OPCODE FETCH'], ['MW', 3, 'MEM WRITE'], ['M1', 4, 'M1 FETCH'], ['IO', 4, 'I/O OUT']];
})(window.PX);
