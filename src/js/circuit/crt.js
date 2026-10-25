/* Circuit · CRT horizontal deflection: real horizontal-output-stage schematic with live readings,
   analog dials, degauss, live picture preview */
(function (PX) {
  'use strict';
  const { U, S, C, sch } = PX, { $ } = U;
  PX.bindRange('s-hf', 'o-hf', v => S.hFreq = v, v => (v / 1000).toFixed(3) + ' kHz');
  PX.bindRange('s-hsz', 'o-hsz', v => S.hSize = v, v => Math.round(v * 100) + ' %');
  PX.bindRange('s-vh', 'o-vh', v => S.vHold = v, v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' Hz');
  PX.bindRange('s-br', 'o-br', v => S.bright = v, v => Math.round(v * 100) + ' %');
  $('#crt-reset').addEventListener('click', () => {
    [['s-hf', C.H_NOM], ['s-hsz', 1], ['s-vh', 0], ['s-br', 0.85]].forEach(([id, v]) => { const el = $('#' + id); el.value = v; el.dispatchEvent(new Event('input')); });
  });
  PX.degauss = () => { if (PX.mainsOn()) { S.degauss = 1; PX.audio.blip(60, 0.6); } };
  $('#crt-degauss').addEventListener('click', PX.degauss);

  /* horizontal output stage: H-OSC/PLL → driver → HOT → yoke + flyback */
  function schematic() {
    const G = 200; let h = '';
    h += sch.text(8, 76, 'H-SYNC', 'lab') + sch.text(8, 88, '(VDP)', 'tiny') + sch.wire([[50, 80], [60, 80]]);
    h += sch.box(60, 56, 90, 66, 'H-OSC/PLL', 'U2 TDA2595');
    h += sch.text(64, 84, 'SYNC', 'pinl') + sch.text(146, 94, 'OUT', 'pinl', 'end') + sch.text(105, 119, 'FREQ', 'pinl', 'middle');
    h += sch.two('pot', 105, 122, 105, G, { ref: 'VR1', v: 'H-FREQ', vid: 'crt-s-f' });
    h += sch.two('res', 150, 90, 210, 90, { ref: 'R2', v: '1kΩ' }) + sch.wire([[210, 90], [222, 90], [222, 150], [232, 150]]);
    h += sch.npn(250, 150, { ref: 'Q1', v: '2SC1815' }) + sch.wire([[258, 172], [258, G]]);
    h += sch.rail(278, 50, '+12V') + sch.wire([[278, 50], [278, 66]]);
    h += sch.xfmr(290, 90, {}) + sch.text(308, 94, 'T2', 'ref');
    h += sch.wire([[278, 114], [278, 124], [258, 124], [258, 128]]);
    h += sch.wire([[302, 66], [338, 66], [338, 150], [352, 150]]) + sch.wire([[302, 114], [316, 114], [316, G]]);
    h += sch.npn(370, 150, { ref: 'Q2' }) + sch.text(384, 100, 'HOT 2SC5144', 'val') + sch.wire([[378, 172], [378, G]]);
    h += sch.wire([[378, 128], [378, 108], [580, 108]]) + sch.dot(410, 108) + sch.dot(458, 108) + sch.dot(470, 108);
    h += sch.two('diode', 410, G, 410, 108, { ref: 'D1', v: '댐퍼' });
    h += sch.two('cap', 458, 108, 458, G, { ref: 'Cr', v: '8.2nF' });
    h += sch.rail(470, 30, '+110V B+') + sch.wire([[470, 30], [470, 36]]);
    h += sch.xfmr(482, 60, {}) + sch.text(530, 96, 'T3 플라이백', 'ref', 'start');
    h += sch.wire([[470, 84], [470, 108]]);
    h += sch.two('diode', 494, 36, 560, 36, { ref: 'D2', v: 'HV' }) + sch.wire([[560, 36], [574, 36]]) + sch.text(578, 32, 'ANODE', 'lab') + sch.text(578, 46, '—', 'val', 'start', 'crt-s-hv');
    h += sch.gnd(494, 84);
    h += sch.two('vind', 520, 108, 580, 108, { ref: 'Lw', v: 'H-SIZE', vid: 'crt-s-hs' });
    h += sch.wire([[580, 108], [610, 108]]) + sch.two('ind', 610, 108, 610, 156, { ref: 'Ly', v: '요크' }) + sch.two('cap', 610, 156, 610, G, { ref: 'Cs', v: '0.47µF S' });
    h += sch.wire([[105, G], [610, G]]) + sch.gnd(340, G);
    h += sch.flow([[378, 108], [580, 108], [610, 108], [610, G]], 'fl-yoke');
    h += sch.flag(50, 80, 0, -46, 'TP5', 'crt-s-sync', 104) + sch.flag(378, 118, -70, -60, 'Vce', 'crt-s-vce', 92) + sch.flag(610, 132, -18, 52, 'Iy', 'crt-s-iy', 80);
    return `<svg class="schem" viewBox="0 0 660 240" role="img" aria-label="수평 출력단 회로도">${h}</svg>`;
  }
  $('#crt-schem').innerHTML = schematic();

  const prev = $('#crt-prev');
  function sizePrev() { prev.width = PX.screen.W; prev.height = PX.screen.H; prev.style.aspectRatio = PX.screen.W + '/' + PX.screen.H; }
  PX.screen.onResize(sizePrev); sizePrev();

  function live() {
    const run = PX.mainsOn() && !S.faults.has('crt'), sync = PX.syncOK(), lock = PX.hLocked() && sync;
    sch.set('crt-s-f', (S.hFreq / 1000).toFixed(3) + ' kHz');
    sch.set('crt-s-sync', sync ? '15.734 kHz' : '없음');
    sch.set('crt-s-vce', run ? (1.1 * (0.92 + 0.08 * S.hSize)).toFixed(2) + ' kVp' : '0 V');
    sch.set('crt-s-hv', run ? (11 * (0.96 + 0.04 * S.hSize) * (lock ? 1 : 0.97)).toFixed(1) + ' kV' : '0 kV');
    sch.set('crt-s-hs', 'H-SIZE ' + Math.round(S.hSize * 100) + '%');
    sch.set('crt-s-iy', run ? (2.4 * S.hSize).toFixed(1) + ' App' : '0 A');
    sch.speed('fl-yoke', run ? 1.5 * S.hSize : 0);
  }
  function render() {
    const cp = $('#crt-pill');
    if (!PX.hLocked()) { cp.className = 'pill bad'; cp.textContent = `수평 동기 이탈 (Δ${Math.round(S.hFreq - C.H_NOM)} Hz)`; }
    else if (Math.abs(S.vHold) > 0.25) { cp.className = 'pill warn'; cp.textContent = '수직 롤링'; }
    else { cp.className = 'pill ok'; cp.textContent = '수평 동기 고정'; }
    $('#crt-size').textContent = `${S.monitor.diag}" ${S.monitor.aspect} · 베젤 ${S.monitor.bezel} mm`;
    live();
  }
  PX.on('params', render); PX.on('monitor', render); PX.on('power', render); PX.on('fault', render); render();
  let lt = 0;
  PX.addFrame('circuit', dt => {
    if (PX.circuitMode !== 'classic') return;
    prev.getContext('2d').drawImage(PX.screen.out, 0, 0);
    lt += dt; if (lt > 0.25) { lt = 0; live(); }
    PX.drawMini($('#mini-crt'), [{ f: PX.SIG.hdef.f, col: U.css('--ph1'), label: 'Iy (Ly)' }, { f: tt => PX.SIG.hsync.f(tt) / 5 - 2.4, col: U.css('--ph2'), label: 'TP5 H-SYNC', lx: 62 }], PX.now(), 160e-6, -2.6, 1.3);
  });
})(window.PX);
