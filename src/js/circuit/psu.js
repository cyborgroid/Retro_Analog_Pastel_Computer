/* Circuit · linear power supply: load, C1, heat sink, regulator temperature and thermal shutdown */
(function (PX) {
  'use strict';
  const { U, S, C } = PX, { $ } = U;

  PX.bindRange = function (id, out, fn, fmt, after) {
    const el = $('#' + id), o = $('#' + out);
    const go = () => { const v = parseFloat(el.value); fn(v); o.textContent = fmt(v); (after || PX.recalc)(); };
    el.addEventListener('input', go); fn(parseFloat(el.value)); o.textContent = fmt(parseFloat(el.value));
    return el;
  };
  PX.bindRange('s-load', 'o-load', v => S.load = v, v => v.toFixed(2) + ' A');
  PX.bindRange('s-cap', 'o-cap', v => S.capIdx = v, v => C.CAPS[v] + ' µF');
  const hs = $('#s-hs-sink');
  hs.innerHTML = C.HEATSINKS.map((h, i) => `<option value="${i}">${h.n}</option>`).join(''); hs.value = S.heatsink;
  hs.addEventListener('change', () => { S.heatsink = +hs.value; PX.recalc(); });

  function render() {
    const P = PX.P;
    $('#r-vpk').textContent = P.vpk.toFixed(2) + ' V';
    $('#r-rip').textContent = Math.min(P.rip, P.vpk).toFixed(2) + ' V';
    $('#r-vmin').textContent = Math.max(0, P.vmin).toFixed(2) + ' V';
    $('#r-pd').textContent = P.pd.toFixed(1) + ' W';
    $('#sch-c1').textContent = 'C1 ' + C.CAPS[S.capIdx] + 'µF';
    $('#sch-load').textContent = S.load.toFixed(1) + 'A';
    const pp = $('#psu-pill');
    if (S.trip) { pp.className = 'pill bad'; pp.textContent = '열 차단 · +5V 꺼짐'; }
    else if (P.dropout) { pp.className = 'pill bad'; pp.textContent = '드롭아웃 · +5V 불안정'; }
    else if (P.vmin < 7.6) { pp.className = 'pill warn'; pp.textContent = '여유 전압 부족'; }
    else { pp.className = 'pill ok'; pp.textContent = '정상 레귤레이션'; }
  }
  function thermo() {
    const T = S.tReg, steady = C.T_AMB + PX.P.pd * (C.THETA_JC + C.HEATSINKS[S.heatsink].r);
    $('#thermo-fill').style.width = U.clamp(T / 150 * 100, 0, 100) + '%';
    $('#r-temp').textContent = T.toFixed(0) + ' °C';
    $('#r-tss').textContent = S.trip ? '냉각 중 → 95 °C에서 재기동' : '정상상태 ' + steady.toFixed(0) + ' °C' + (steady >= C.T_TRIP ? ' · 차단 예상' : '');
  }
  PX.on('params', render); PX.on('power', render);
  render();
  PX.addFrame('circuit', (dt, t) => {
    thermo();
    PX.drawMini($('#mini-psu'), [{ f: PX.SIG.psu_raw.f, col: U.css('--ph1'), label: 'C1' }, { f: PX.SIG.psu_5v.f, col: U.css('--ph2'), label: '+5V', lx: 30 }], PX.now(), 0.03, 0, 13);
  });
})(window.PX);
