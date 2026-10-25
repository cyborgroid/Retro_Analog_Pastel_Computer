/* Boot: tabs, status strip, power switch, main loop */
(function (PX) {
  'use strict';
  const { U, S, C, DATA } = PX, { $, $$ } = U;
  const TABS = ['topology', 'circuit', 'chassis', 'assembly', 'instrument'];
  PX.activeTab = 'chassis';

  PX.show = function (tab) {
    if (!TABS.includes(tab)) tab = 'chassis';
    PX.activeTab = tab;
    TABS.forEach(t => { $('#' + t).hidden = t !== tab; const b = $('#tab-' + t); b.setAttribute('aria-selected', t === tab); b.tabIndex = t === tab ? 0 : -1; });
    try { history.replaceState(null, '', '#' + tab); } catch (e) { }
    U.store.set('tab', tab);
    if (PX.onShow && PX.onShow[tab]) PX.onShow[tab]();
  };
  $$('.tab').forEach(b => {
    b.addEventListener('click', () => PX.show(b.dataset.tab));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.indexOf(b.dataset.tab), n = TABS[U.mod(i + (e.key === 'ArrowRight' ? 1 : -1), TABS.length)];
      PX.show(n); $('#tab-' + n).focus();
    });
  });

  function status() {
    const l5 = $('#led-5v'), lh = $('#led-h'), lt = $('#led-t');
    if (!PX.logicOn()) { l5.className = 'led' + (PX.mainsOn() ? ' bad' : ''); $('#st-5v').textContent = S.trip ? '+5V TRIP' : '+5V 0.00'; }
    else { l5.className = 'led ' + (PX.P.dropout ? 'bad' : 'ok'); $('#st-5v').textContent = PX.P.dropout ? '+5V DROP' : '+5V 5.00'; }
    if (!PX.syncOK()) { lh.className = 'led' + (PX.mainsOn() ? ' warn' : ''); $('#st-h').textContent = 'NO SYNC'; }
    else { lh.className = 'led ' + (PX.hLocked() ? (Math.abs(S.vHold) > 0.25 ? 'warn' : 'ok') : 'bad'); $('#st-h').textContent = PX.hLocked() ? 'H-LOCK' : 'H-SLIP'; }
    lt.className = 'led ' + (S.trip ? 'bad' : S.tReg > 100 ? 'warn' : 'ok'); $('#st-t').textContent = '7805 ' + Math.round(S.tReg) + '°C';
    $('#led-kb').className = 'led ' + (S.ghosts.size ? 'bad' : S.detected.size ? 'ok' : '');
    $('#st-kb').textContent = 'KEY ' + (S.detected.size ? [...S.detected].slice(0, 4).map(k => DATA.SHORT[k] || k).join('+') : '—');
    $('#st-ms').textContent = `X ${S.mouse.cntX} · Y ${S.mouse.cntY}`;
    const f = $('#st-fault'); f.hidden = !S.faults.size; f.textContent = `FAULT ×${S.faults.size}`;
  }
  $('#pwr').addEventListener('click', e => {
    S.power = !S.power; e.currentTarget.setAttribute('aria-pressed', S.power);
    if (S.power) S.degauss = 1;
    PX.emit('power');
  });

  let last = performance.now(), st = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    PX.updateThermal(dt);
    const logic = PX.cpuOK();
    if (logic && !S.wasLogic) { S.bootT = 0; PX.recomputeKeys(); }
    S.wasLogic = logic;
    if (logic) S.bootT += dt;
    S.degauss = Math.max(0, S.degauss - dt * 0.7);
    (PX._frames['*'] || []).forEach(f => f(dt, t));
    if (['chassis', 'circuit', 'assembly'].includes(PX.activeTab)) PX.screen.compose(dt, t, PX.screenForcedOff && PX.screenForcedOff());
    (PX._frames[PX.activeTab] || []).forEach(f => f(dt, t));
    st += dt; if (st > 0.25) { st = 0; status(); }
    requestAnimationFrame(frame);
  }

  PX.on('power', () => { PX.recalc(); status(); });
  PX.on('fault', status);
  let start = (location.hash || '').slice(1);
  if (!TABS.includes(start)) start = U.store.get('tab', 'chassis');
  PX.show(TABS.includes(start) ? start : 'chassis');
  S.bootT = 10;
  status();
  requestAnimationFrame(frame);
})(window.PX);
