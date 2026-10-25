/* Circuit · 8x8 key matrix: diode isolation, ghost keys, physical keyboard input, typing into NOTE.TXT */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX, { $, $$, mod } = U;
  const { KEYS, MATRIX, GRID, SHORT } = DATA;
  const MX = { x0: 62, y0: 56, dx: 50, dy: 44 };

  function typeKey(k) {
    if (k === 'SHIFT') return;
    if (k === 'BKSP') { if (!S.text.endsWith('> ')) S.text = S.text.slice(0, -1); }
    else if (k === 'ENTER') S.text += '\n> ';
    else S.text += (k === 'SPACE' ? ' ' : k);
    const lines = S.text.split('\n'); if (lines.length > 14) S.text = lines.slice(-14).join('\n');
  }
  PX.typeLine = s => { S.text += s; const lines = S.text.split('\n'); if (lines.length > 14) S.text = lines.slice(-14).join('\n'); };
  const kbcLive = () => PX.cpuOK() && !S.faults.has('pio') && !S.faults.has('kbd') && PX.screen.booted();

  function recompute() {
    const pressed = new Set([...S.latched, ...S.held]), det = new Set(), gh = new Set();
    if (S.diodes) pressed.forEach(k => det.add(k));
    else {
      const par = [...Array(16).keys()]; const f = x => par[x] === x ? x : (par[x] = f(par[x]));
      pressed.forEach(k => { const m = MATRIX[k]; par[f(m.r)] = f(8 + m.c); });
      KEYS.forEach(k => { const m = MATRIX[k]; if (f(m.r) === f(8 + m.c)) { det.add(k); if (!pressed.has(k)) gh.add(k); } });
    }
    const fresh = KEYS.filter(k => det.has(k) && !S.detected.has(k));
    if (fresh.length) S.lastPress = PX.now();
    fresh.forEach(k => {
      if (kbcLive()) {
        typeKey(k); PX.audio.blip(DATA.keyFreq(k));
        PX.logEvt && PX.logEvt(`KBC /INT · ${MATRIX[k].r}:${MATRIX[k].c} '${SHORT[k] || k}'${gh.has(k) ? ' (ghost)' : ''}`);
        PX.pulse && PX.pulse('kbd', 'pio', '#e7a83a');
      }
    });
    S.pressed = pressed; S.detected = det; S.ghosts = gh;
    S.rowHas = [...Array(8)].map((_, r) => GRID[r].some(k => k && det.has(k)));
    renderMatrix(); PX.emit('keys');
  }
  PX.recomputeKeys = recompute;

  function labelFromEvent(e) {
    if (e.key === ' ') return 'SPACE'; if (e.key === 'Enter') return 'ENTER'; if (e.key === 'Backspace') return 'BKSP'; if (e.key === 'Shift') return 'SHIFT';
    if (e.key.length === 1) { const u = e.key.toUpperCase(); if (MATRIX[u]) return u; if (DATA.SHIFTED[e.key]) return DATA.SHIFTED[e.key]; }
    return null;
  }
  const isField = el => el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  window.addEventListener('keydown', e => {
    const ae = document.activeElement;
    if (isField(ae) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (ae && ['slider', 'tab'].includes(ae.getAttribute('role')) && e.key.startsWith('Arrow')) return;
    const k = labelFromEvent(e); if (!k) return;
    if ((k === 'SPACE' || k === 'ENTER') && ae && (ae.tagName === 'BUTTON' || ae.getAttribute('role') === 'button')) return;
    e.preventDefault();
    if (e.repeat) { if (kbcLive()) typeKey(k); return; }
    S.held.add(k); recompute();
  });
  window.addEventListener('keyup', e => { const k = labelFromEvent(e); if (k && S.held.delete(k)) recompute(); });
  window.addEventListener('blur', () => { if (S.held.size) { S.held.clear(); recompute(); } });

  function build() {
    const sv = $('#matrix'); let h = '';
    for (let r = 0; r < 8; r++) h += `<line class="ln" id="mr${r}" x1="34" y1="${MX.y0 + r * MX.dy}" x2="${MX.x0 + 7 * MX.dx + 28}" y2="${MX.y0 + r * MX.dy}"/><text class="lab" id="mrl${r}" x="6" y="${MX.y0 + r * MX.dy + 4}">R${r}</text>`;
    for (let c = 0; c < 8; c++) h += `<line class="ln" id="mc${c}" x1="${MX.x0 + c * MX.dx}" y1="26" x2="${MX.x0 + c * MX.dx}" y2="${MX.y0 + 7 * MX.dy + 24}"/><text class="lab" x="${MX.x0 + c * MX.dx - 8}" y="16">C${c}</text><circle id="mcl${c}" cx="${MX.x0 + c * MX.dx}" cy="${MX.y0 + 7 * MX.dy + 38}" r="5" fill="var(--line)"/>`;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const k = GRID[r][c]; if (!k) continue;
      h += `<g class="sw" data-k="${k}" tabindex="0" role="button" aria-label="키 ${k}"><rect id="ms-${KEYS.indexOf(k)}" x="${MX.x0 + c * MX.dx - 19}" y="${MX.y0 + r * MX.dy - 13}" width="38" height="26" rx="6" fill="var(--panel-2)"/><text x="${MX.x0 + c * MX.dx}" y="${MX.y0 + r * MX.dy + 4}" text-anchor="middle">${SHORT[k] || k}</text></g>`;
    }
    h += `<text class="lab" x="${MX.x0 - 22}" y="${MX.y0 + 7 * MX.dy + 42}">SENSE</text>`;
    sv.innerHTML = h;
    sv.addEventListener('click', e => { const g = e.target.closest('.sw'); if (g) toggle(g.dataset.k); });
    sv.addEventListener('keydown', e => { const g = e.target.closest('.sw'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); toggle(g.dataset.k); } });
  }
  function toggle(k) { if (S.latched.has(k)) S.latched.delete(k); else S.latched.add(k); recompute(); }
  function renderMatrix() {
    KEYS.forEach((k, i) => {
      const el = $('#ms-' + i); if (!el) return;
      el.setAttribute('fill', S.ghosts.has(k) ? 'var(--rose)' : S.pressed.has(k) ? 'var(--mint)' : 'var(--panel-2)');
      el.setAttribute('stroke-dasharray', S.ghosts.has(k) ? '3 2' : '');
    });
    $('#kb-det').textContent = S.detected.size ? [...S.detected].map(k => SHORT[k] || k).join(' ') : '—';
    $('#kb-ghost').textContent = S.ghosts.size ? [...S.ghosts].map(k => SHORT[k] || k).join(' ') : '—';
    const p = $('#kb-pill'); p.className = 'pill ' + (S.ghosts.size ? 'bad' : 'ok'); p.textContent = S.ghosts.size ? `유령 키 ${S.ghosts.size}개 감지` : '유령 키 없음';
  }
  let scan = 0;
  PX.addFrame('circuit', dt => {
    const live = PX.clockOn() && !S.faults.has('pio');
    if (live) scan = mod(scan + dt * 5, 8);
    const r = Math.floor(scan);
    for (let i = 0; i < 8; i++) { $('#mr' + i).classList.toggle('on', live && i === r); $('#mrl' + i).classList.toggle('on', live && i === r); }
    for (let c = 0; c < 8; c++) { const k = GRID[r][c]; const on = live && k && S.detected.has(k); $('#mcl' + c).setAttribute('fill', on ? 'var(--accent)' : 'var(--line)'); $('#mc' + c).classList.toggle('on', !!on); }
    PX.drawMini($('#mini-kb'), [{ f: PX.SIG.sw.f, col: U.css('--ph3'), label: '접점 (최근 입력)' }], S.lastPress - 0.0004, 0.004, -0.5, 5.5);
  });

  build();
  $('#diodes').addEventListener('click', e => {
    S.diodes = !S.diodes; const b = e.currentTarget; b.setAttribute('aria-pressed', S.diodes); b.classList.toggle('on', S.diodes);
    b.textContent = S.diodes ? '다이오드 장착' : '다이오드 제거됨'; recompute();
  });
  $('#kb-clear').addEventListener('click', () => { S.latched.clear(); recompute(); });
  $('#kb-demo').addEventListener('click', () => { if (S.diodes) $('#diodes').click(); S.latched = new Set(['1', '2', '0']); recompute(); });
  recompute();
})(window.PX);
