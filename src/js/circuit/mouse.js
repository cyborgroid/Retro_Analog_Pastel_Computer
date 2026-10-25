/* Circuit · ball mouse: drag pad → ball → chopper wheels → quadrature A/B → counter and CRT cursor */
(function (PX) {
  'use strict';
  const { U, S, C } = PX, { $, $$, clamp, lerp, TAU } = U;
  let lastLog = 0;
  PX.moveMouse = function (dx, dy) {
    const m = S.mouse;
    if (S.faults.has('mouse')) return;
    m.angX += dx * C.QK * TAU * 0.02; m.angY += dy * C.QK * TAU * 0.02;
    if (!PX.logicOn() || S.faults.has('pio')) return;
    m.cx = clamp(m.cx + dx * 1.1, 2, PX.screen.W - 4); m.cy = clamp(m.cy + dy * 1.1, 24, PX.screen.H - 4);
    m.cntX += Math.round(dx * C.QK * 4); m.cntY += Math.round(dy * C.QK * 4);
    const now = performance.now();
    if (now - lastLog > 700 && Math.abs(dx) + Math.abs(dy) > 2) { lastLog = now; PX.logEvt && PX.logEvt(`MOUSE Δ ${dx > 0 ? '+' : ''}${Math.round(dx)},${dy > 0 ? '+' : ''}${Math.round(dy)}`); PX.pulse && PX.pulse('mouse', 'pio', '#e46a8f'); }
  };
  PX.setAutoMouse = on => { S.mouse.auto = on; const b = $('#m-auto'); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); };

  const pad = $('#pad'); let last = null;
  pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); last = { x: e.clientX, y: e.clientY, t: performance.now() }; S.mouse.drag = true; });
  pad.addEventListener('pointermove', e => {
    if (!last) return; const now = performance.now(), dt = Math.max(1, now - last.t) / 1000;
    const dx = e.clientX - last.x, dy = e.clientY - last.y; PX.moveMouse(dx, dy);
    S.mouse.vx = lerp(S.mouse.vx, dx / dt, 0.5); S.mouse.vy = lerp(S.mouse.vy, dy / dt, 0.5); last = { x: e.clientX, y: e.clientY, t: now };
  });
  const end = () => { last = null; S.mouse.drag = false; };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  $('#m-auto').addEventListener('click', () => PX.setAutoMouse(!S.mouse.auto));

  function wheel(id) {
    let h = '<circle cx="50" cy="46" r="34" fill="var(--butter)" stroke="var(--on-pastel)" stroke-width="1.4"/><g class="spin">';
    for (let i = 0; i < 12; i++) h += `<rect x="47" y="15" width="6" height="12" rx="1.5" fill="var(--on-pastel)" transform="rotate(${i * 30} 50 46)"/>`;
    h += '</g><circle cx="50" cy="46" r="6" fill="var(--on-pastel)"/><rect x="80" y="16" width="10" height="20" rx="2" fill="var(--rose)" stroke="var(--on-pastel)"/>';
    $('#' + id).innerHTML = h;
  }
  wheel('encx'); wheel('ency');
  $('#ballspots').innerHTML = Array(7).fill('<circle class="spot" r="4" fill="var(--on-pastel)" opacity=".55"/>').join('');

  /* photo-interrupter channels: IR LED → chopper slot → photo-transistor → 74HC14 Schmitt → PIO */
  const sch = PX.sch;
  function schematic() {
    let h = '';
    [['A', 'XA', 55, 1], ['B', 'XB', 145, 3]].forEach(([ch, out, y, n]) => {
      h += sch.rail(30, y - 20, '+5V') + sch.wire([[30, y - 20], [30, y]]);
      h += sch.two('res', 30, y, 90, y, { ref: 'R' + n, v: '220Ω' });
      h += `<g id="ms-led-${ch}">` + sch.two('led', 90, y, 140, y, { ref: 'D' + n, v: 'IR 940nm' }) + `</g>`;
      h += sch.wire([[140, y], [150, y], [150, y + 10]]) + sch.gnd(150, y + 10);
      h += sch.chopper(172, y, 'ms-chop-' + ch);
      h += sch.npn(205, y, { photo: true, ref: 'Q' + n, v: 'PT' }) + sch.gnd(213, y + 22);
      h += sch.wire([[213, y - 22], [213, y - 28], [250, y - 28]]) + sch.dot(240, y - 28);
      h += sch.two('res', 250, y - 28, 310, y - 28, { ref: 'R' + (n + 1), v: '10kΩ' }) + sch.rail(310, y - 28, '+5V');
      h += sch.wire([[240, y - 28], [240, y], [332, y]]);
      h += sch.inv(346, y, { ref: 'U5' + (ch === 'A' ? 'a' : 'b') + ' 74HC14' }) + sch.wire([[364, y], [400, y]]);
      h += sch.text(406, y + 4, out + ' = —', 'lab', 'start', 'ms-out-' + ch) + sch.text(406, y + 18, '→ PIO ' + (ch === 'A' ? 'PA0' : 'PA1'), 'tiny');
    });
    h += sch.text(520, 92, '초퍼 슬롯이 빛을 통과시키면', 'tiny') + sch.text(520, 104, 'PT 도통 → 74HC14 입력 L', 'tiny') + sch.text(520, 116, '→ 출력 H (1)', 'tiny');
    return `<svg class="schem" viewBox="0 0 660 190" role="img" aria-label="포토인터럽터 회로도">${h}</svg>`;
  }
  $('#ms-schem').innerHTML = schematic();

  /* physics runs every frame regardless of tab */
  PX.addFrame('*', (dt, t) => {
    const m = S.mouse;
    if (m.auto && !m.drag) { const vx = 260 * Math.sin(t * 1.3), vy = 170 * Math.cos(t * 0.9); m.vx = vx; m.vy = vy; PX.moveMouse(vx * dt, vy * dt); }
    else if (!m.drag) { const k = Math.exp(-dt * 7); m.vx *= k; m.vy *= k; if (Math.abs(m.vx) < 0.5) m.vx = 0; if (Math.abs(m.vy) < 0.5) m.vy = 0; }
  });
  PX.addFrame('circuit', () => {
    if (PX.circuitMode !== 'classic') return;
    const m = S.mouse;
    $('#encx .spin').setAttribute('transform', `rotate(${m.angX * 57.3} 50 46)`);
    $('#ency .spin').setAttribute('transform', `rotate(${m.angY * 57.3} 50 46)`);
    $$('#ballspots .spot').forEach((s, i) => {
      const a = i * 0.9 + m.angX * 0.35, b = i * 1.7 + m.angY * 0.35;
      const x = Math.sin(a) * Math.cos(b), y = Math.sin(b), z = Math.cos(a) * Math.cos(b);
      s.setAttribute('cx', 50 + x * 28); s.setAttribute('cy', 46 + y * 28); s.setAttribute('opacity', z > 0 ? 0.55 * z + 0.1 : 0);
    });
    const tt = PX.now();
    [['xa', 'x', 'a'], ['xb', 'x', 'b'], ['ya', 'y', 'a'], ['yb', 'y', 'b']].forEach(([id, ax, w]) => $('#q-' + id).classList.toggle('on', PX.quad(ax, w, tt) > 2.5));
    $('#m-cnt').textContent = `X ${m.cntX} · Y ${m.cntY}`;
    const lit = PX.logicOn() && !S.faults.has('mouse');
    ['A', 'B'].forEach(ch => {
      const v = PX.quad('x', ch === 'A' ? 'a' : 'b', tt) > 2.5;
      const led = $('#ms-led-' + ch); if (led) led.classList.toggle('lit', lit);
      const ck = $('#ms-chop-' + ch); if (ck) ck.classList.toggle('open', lit && v);
      sch.set('ms-out-' + ch, `X${ch} = ${lit ? (v ? '1 (H)' : '0 (L)') : '—'}`);
    });
    const dirs = [];
    if (Math.abs(m.vx) > 8) dirs.push(m.vx > 0 ? '→ 오른쪽 (A 선행)' : '← 왼쪽 (B 선행)');
    if (Math.abs(m.vy) > 8) dirs.push(m.vy > 0 ? '↓ 아래' : '↑ 위');
    $('#m-dir').textContent = S.faults.has('mouse') ? '엔코더 고장' : dirs.join(' · ') || '정지';
    PX.drawMini($('#mini-ms'), [{ f: x => PX.quad('x', 'a', x) + 6.5, col: U.css('--ph1'), label: 'XA' }, { f: x => PX.quad('x', 'b', x), col: U.css('--ph2'), label: 'XB', lx: 30 }], tt, 0.05, -0.5, 12);
  });
})(window.PX);
