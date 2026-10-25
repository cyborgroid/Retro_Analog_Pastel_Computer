/* Circuit · CRT deflection dials, degauss, live picture preview */
(function (PX) {
  'use strict';
  const { U, S, C } = PX, { $ } = U;
  PX.bindRange('s-hf', 'o-hf', v => S.hFreq = v, v => (v / 1000).toFixed(3) + ' kHz');
  PX.bindRange('s-hsz', 'o-hsz', v => S.hSize = v, v => Math.round(v * 100) + ' %');
  PX.bindRange('s-vh', 'o-vh', v => S.vHold = v, v => (v >= 0 ? '+' : '') + v.toFixed(2) + ' Hz');
  PX.bindRange('s-br', 'o-br', v => S.bright = v, v => Math.round(v * 100) + ' %');
  $('#crt-reset').addEventListener('click', () => {
    [['s-hf', C.H_NOM], ['s-hsz', 1], ['s-vh', 0], ['s-br', 0.85]].forEach(([id, v]) => { const el = $('#' + id); el.value = v; el.dispatchEvent(new Event('input')); });
  });
  PX.degauss = () => { if (PX.mainsOn()) { S.degauss = 1; PX.audio.blip(60, 0.6); } };
  $('#crt-degauss').addEventListener('click', PX.degauss);

  const prev = $('#crt-prev');
  function sizePrev() { prev.width = PX.screen.W; prev.height = PX.screen.H; prev.style.aspectRatio = PX.screen.W + '/' + PX.screen.H; }
  PX.screen.onResize(sizePrev); sizePrev();

  function render() {
    const cp = $('#crt-pill');
    if (!PX.hLocked()) { cp.className = 'pill bad'; cp.textContent = `수평 동기 이탈 (Δ${Math.round(S.hFreq - C.H_NOM)} Hz)`; }
    else if (Math.abs(S.vHold) > 0.25) { cp.className = 'pill warn'; cp.textContent = '수직 롤링'; }
    else { cp.className = 'pill ok'; cp.textContent = '수평 동기 고정'; }
    $('#crt-size').textContent = `${S.monitor.diag}" ${S.monitor.aspect} · 베젤 ${S.monitor.bezel} mm`;
  }
  PX.on('params', render); PX.on('monitor', render); render();
  PX.addFrame('circuit', (dt, t) => {
    prev.getContext('2d').drawImage(PX.screen.out, 0, 0);
    PX.drawMini($('#mini-crt'), [{ f: PX.SIG.hdef.f, col: U.css('--ph1'), label: 'H-DEF' }, { f: tt => PX.SIG.hsync.f(tt) / 5 - 2.4, col: U.css('--ph2'), label: 'H-SYNC', lx: 52 }], PX.now(), 160e-6, -2.6, 1.3);
  });
})(window.PX);
