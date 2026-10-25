/* Instrument · quantum block composer → pulse sequencer.
   Gate blocks are dragged (or tapped) onto qubit wires; the circuit compiles live to a microwave pulse schedule
   and runs on the noisy hardware model. */
(function (PX) {
  'use strict';
  const { U, DATA } = PX, { $, $$ } = U;
  const COLS = 16, CW = 50, RH = 54, LX = 72, TOP = 22;
  const C = PX.composer = { n: 2, ops: [], sel: null, armed: null, shots: 1024, undo: [], result: null, stale: true, angle: Math.PI / 2, preset: 'bell' };
  const GL = { SX: '√X', RST: '|0⟩' };

  /* ---------- toolbar ---------- */
  $('#qc-preset').innerHTML = '<option value="">— 예제 회로 —</option>' + Object.entries(DATA.QPRESETS).map(([k, p]) => `<option value="${k}">${p.n}</option>`).join('');
  $('#qc-n').innerHTML = [1, 2, 3, 4, 5].map(n => `<option value="${n}">${n}</option>`).join('');
  $('#qc-shots').innerHTML = [256, 1024, 4096].map(n => `<option value="${n}"${n === 1024 ? ' selected' : ''}>${n}</option>`).join('');
  $('#qc-angle').innerHTML = DATA.ANGLES.map(([l, v]) => `<option value="${v}"${Math.abs(v - Math.PI / 2) < 1e-9 ? ' selected' : ''}>${l}</option>`).join('');
  const GROUPS = [['구동 펄스 (1큐비트)', ['H', 'X', 'Y', 'SX', 'RX', 'RY']], ['가상 Z (펄스 없음)', ['Z', 'S', 'T', 'RZ']], ['플럭스 펄스 (2큐비트)', ['CX', 'CZ', 'CP', 'SWAP']], ['판독', ['M', 'RST']]];
  $('#qc-palette').innerHTML = GROUPS.map(([t, gs]) => `<div class="qpal-grp"><span class="qpal-t">${t}</span><div class="qpal-row">${gs.map(g => `<button class="qblk bg-${DATA.GATES[g].c}" data-g="${g}" title="${DATA.GATES[g].d}" aria-pressed="false"><i></i>${GL[g] || g}</button>`).join('')}</div></div>`).join('');

  function snapshot() { C.undo.push(JSON.stringify({ n: C.n, ops: C.ops })); if (C.undo.length > 60) C.undo.shift(); }
  function changed() { C.stale = true; U.store.set('qc', { n: C.n, ops: C.ops }); compile(); render(); inspector(); staleNote(); }
  function loadPreset(k) {
    const p = DATA.QPRESETS[k]; if (!p) return; snapshot();
    C.n = p.q; C.ops = JSON.parse(JSON.stringify(p.ops)); C.sel = null; C.preset = k; $('#qc-n').value = C.n;
    $('#qc-note').textContent = p.note; changed(); run();
  }
  $('#qc-preset').addEventListener('change', e => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; });
  $('#qc-n').addEventListener('change', e => { snapshot(); C.n = +e.target.value; C.ops = C.ops.filter(o => o.q < C.n && (o.q2 == null || o.q2 < C.n)); C.sel = null; changed(); });
  $('#qc-shots').addEventListener('change', e => C.shots = +e.target.value);
  $('#qc-angle').addEventListener('change', e => { C.angle = parseFloat(e.target.value); });
  $('#qc-undo').addEventListener('click', () => { const s = C.undo.pop(); if (!s) return; const o = JSON.parse(s); C.n = o.n; C.ops = o.ops; C.sel = null; $('#qc-n').value = C.n; changed(); });
  $('#qc-clear').addEventListener('click', () => { if (!C.ops.length) return; snapshot(); C.ops = []; C.sel = null; $('#qc-note').textContent = ''; changed(); });
  $('#qc-run').addEventListener('click', () => run());
  $('#qc-to-scope').addEventListener('click', () => { PX.setInstMode('bench'); PX.applyPreset('qpulse'); });
  $('#qc-qasm-btn').addEventListener('click', e => { const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); $('#qc-qasm-box').hidden = !on; qasm(); });
  $('#qc-copy').addEventListener('click', () => {
    const t = $('#qc-qasm').textContent, msg = $('#qc-copy-msg');
    const sel = () => { const r = document.createRange(); r.selectNodeContents($('#qc-qasm')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); msg.textContent = '선택했습니다. Ctrl+C로 복사하세요.'; };
    try { navigator.clipboard.writeText(t).then(() => msg.textContent = '복사했습니다.', sel); } catch (e) { sel(); }
  });
  function qasm() { $('#qc-qasm').textContent = DATA.toQASM(C.ops, C.n); }

  /* ---------- placement rules ---------- */
  const two = g => DATA.GATES[g].kind === 'two';
  const spans = (o, q) => o.q2 != null && q > Math.min(o.q, o.q2) && q < Math.max(o.q, o.q2);
  const occ = (q, t, ex) => C.ops.some(o => o !== ex && o.t === t && (o.q === q || o.q2 === q || spans(o, q)));
  function pickTarget(q, t, ex, prefer) {
    const cands = [...Array(C.n).keys()].filter(x => x !== q);
    const ok = x => !occ(x, t, ex) && ![...Array(C.n).keys()].some(y => y > Math.min(q, x) && y < Math.max(q, x) && occ(y, t, ex));
    if (prefer != null && prefer !== q && ok(prefer)) return prefer;
    cands.sort((a, b) => (PX.qdist(q, a) - PX.qdist(q, b)) || (Math.abs(a - q) - Math.abs(b - q)));
    return cands.find(ok);
  }
  function msg(t, bad) { const m = $('#qc-msg'); m.textContent = t; m.className = 'note' + (bad ? ' bad-t' : ''); }
  function place(g, q, t) {
    if (q >= C.n || t < 0 || t >= COLS) return false;
    const victim = C.ops.find(o => o.t === t && o.q === q);
    if (two(g) && C.n < 2) { msg('2큐비트 블록은 큐비트가 2개 이상일 때 쓸 수 있습니다.', true); return false; }
    snapshot();
    if (victim) C.ops.splice(C.ops.indexOf(victim), 1);
    if (occ(q, t)) { C.undo.pop(); if (victim) C.ops.push(victim); msg('그 칸은 다른 2큐비트 블록의 연결선이 지나갑니다.', true); return false; }
    const o = { g, q, t }; if (DATA.GATES[g].p) o.th = C.angle;
    if (two(g)) { const q2 = pickTarget(q, t, null); if (q2 == null) { C.undo.pop(); if (victim) C.ops.push(victim); msg('같은 열에 비어 있는 대상 큐비트가 없습니다.', true); return false; } o.q2 = q2; }
    C.ops.push(o); C.sel = o; msg(''); changed(); return true;
  }
  function move(o, q, t) {
    if (q >= C.n || t < 0 || t >= COLS) return;
    if (occ(q, t, o)) { msg('그 칸은 이미 차 있습니다.', true); return; }
    snapshot(); const old = { q: o.q, t: o.t, q2: o.q2 };
    o.q = q; o.t = t;
    if (two(o.g)) { const q2 = pickTarget(q, t, o, old.q2); if (q2 == null) { Object.assign(o, old); C.undo.pop(); msg('대상 큐비트를 둘 칸이 없습니다.', true); return; } o.q2 = q2; }
    msg(''); changed();
  }
  function remove(o) { snapshot(); C.ops.splice(C.ops.indexOf(o), 1); if (C.sel === o) C.sel = null; changed(); }

  /* ---------- grid render ---------- */
  const rowY = q => TOP + q * RH + RH / 2, colX = t => LX + t * CW + CW / 2;
  function gateSVG(o, i) {
    const x = colX(o.t), y = rowY(o.q), G = DATA.GATES[o.g], sel = C.sel === o;
    let h = `<g class="qop${sel ? ' sel' : ''}" data-op="${i}" data-q="${o.q}" data-t="${o.t}" tabindex="0" role="button" aria-label="${o.g} Q${o.q}${o.q2 != null ? '→Q' + o.q2 : ''}">`;
    if (G.kind === 'two') {
      const y2 = rowY(o.q2); h += `<line class="qlink" x1="${x}" y1="${y}" x2="${x}" y2="${y2}"/>`;
      h += `<circle class="qdot" cx="${x}" cy="${y}" r="7"/>`;
      if (o.g === 'CX') h += `<circle class="qtgt" cx="${x}" cy="${y2}" r="13"/><path class="qtgt-x" d="M${x - 13} ${y2} H${x + 13} M${x} ${y2 - 13} V${y2 + 13}"/>`;
      else if (o.g === 'CZ') h += `<circle class="qdot" cx="${x}" cy="${y2}" r="7"/>`;
      else if (o.g === 'CP') h += `<circle class="qdot" cx="${x}" cy="${y2}" r="7"/><rect class="qbox" fill="var(--peach)" x="${x + 6}" y="${(y + y2) / 2 - 10}" width="40" height="20" rx="5"/><text class="qangle" x="${x + 26}" y="${(y + y2) / 2 + 4}" text-anchor="middle">${DATA.angleName(o.th)}</text>`;
      else if (o.g === 'SWAP') [y, y2].forEach(yy => h += `<path class="qtgt-x" d="M${x - 8} ${yy - 8} L${x + 8} ${yy + 8} M${x + 8} ${yy - 8} L${x - 8} ${yy + 8}"/>`);
      if (PX.qdist(o.q, o.q2) > 1) h += `<text class="qroute" x="${x + 9}" y="${Math.min(y, y2) + 4}" >⇆${PX.qdist(o.q, o.q2) - 1}</text>`;
      if (o.g === 'SWAP') h = h.replace('<circle class="qdot" cx="' + x + '" cy="' + y + '" r="7"/>', '');
    } else {
      h += `<rect class="qbox" fill="var(--${G.c})" x="${x - 19}" y="${y - 19}" width="38" height="38" rx="8"/>`;
      if (o.g === 'M') h += `<path class="qmeter" d="M${x - 11} ${y + 6} A12 12 0 0 1 ${x + 11} ${y + 6}"/><path class="qmeter" d="M${x} ${y + 7} L${x + 8} ${y - 6}"/>`;
      else if (G.p) h += `<text class="qg" x="${x}" y="${y - 1}" text-anchor="middle">${o.g}</text><text class="qangle" x="${x}" y="${y + 13}" text-anchor="middle">${DATA.angleName(o.th)}</text>`;
      else h += `<text class="qg" x="${x}" y="${y + 5}" text-anchor="middle">${GL[o.g] || o.g}</text>`;
    }
    if (sel) h += `<rect class="qsel" x="${x - 23}" y="${Math.min(y, o.q2 != null ? rowY(o.q2) : y) - 23}" width="46" height="${(o.q2 != null ? Math.abs(rowY(o.q2) - y) : 0) + 46}" rx="10"/>`;
    return h + '</g>';
  }
  function render() {
    const n = C.n, W = LX + COLS * CW + 14, H = TOP + n * RH + 26;
    const layers = PX.qlayers(C.ops), start = {}; let acc = 0; layers.forEach(L => { start[L.t] = acc; acc += L.dur; });
    let h = '';
    for (let t = 0; t < COLS; t++) h += `<text class="qcol" x="${colX(t)}" y="${TOP - 8}" text-anchor="middle">${t + 1}</text>`;
    for (let q = 0; q < n; q++) {
      const y = rowY(q);
      h += `<line class="qwire" x1="${LX - 6}" y1="${y}" x2="${W - 8}" y2="${y}"/><text class="qlab" x="8" y="${y + 4}">Q${q}</text><text class="qket" x="38" y="${y + 4}">|0⟩</text>`;
      for (let t = 0; t < COLS; t++) h += `<rect class="qcell${C.armed ? ' armed' : ''}" data-q="${q}" data-t="${t}" x="${LX + t * CW + 3}" y="${TOP + q * RH + 5}" width="${CW - 6}" height="${RH - 10}" rx="8"/>`;
    }
    C.ops.forEach((o, i) => h += gateSVG(o, i));
    Object.entries(start).forEach(([t, ns]) => h += `<text class="qtime" x="${colX(+t)}" y="${H - 6}" text-anchor="middle">${ns >= 1000 ? (ns / 1000).toFixed(2) + 'µ' : ns}</text>`);
    h += `<text class="qtime" x="8" y="${H - 6}">t (ns)</text>`;
    const sv = $('#qc-grid'); sv.setAttribute('viewBox', `0 0 ${W} ${H}`); sv.setAttribute('width', W); sv.setAttribute('height', H); sv.innerHTML = h;
    $('#qc-depth').textContent = `깊이 ${layers.length} · 게이트 ${C.ops.length}개 · ${acc >= 1000 ? (acc / 1000).toFixed(2) + ' µs' : acc + ' ns'}`;
  }

  /* ---------- inspector ---------- */
  function inspector() {
    const box = $('#qc-inspect'), o = C.sel;
    if (!o || !C.ops.includes(o)) {
      C.sel = null;
      box.innerHTML = `<p class="note">${C.armed ? `<b>${GL[C.armed] || C.armed}</b> 블록을 놓을 칸을 누르세요. 같은 블록을 다시 누르면 해제됩니다.` : '블록을 그리드로 끌어다 놓거나, 블록을 눌러 고른 뒤 칸을 누르세요. 놓인 블록을 누르면 여기서 설정을 바꿀 수 있고, 그리드 밖으로 끌어내면 지워집니다.'}</p>`;
      return;
    }
    const G = DATA.GATES[o.g], qs = [...Array(C.n).keys()];
    const qsel = (id, v) => `<select class="sel" id="${id}">${qs.map(q => `<option value="${q}"${q === v ? ' selected' : ''}>Q${q}</option>`).join('')}</select>`;
    const pulses = PX.qcompile([{ ...o, t: 0 }]).pulses.filter(p => p.kind !== 'acq').map(p => p.kind === 'vz' ? `${p.lane} ${p.label} (위상 프레임)` : `${p.lane} ${p.label} ${p.dur} ns`).join(' · ');
    box.innerHTML = `<div class="row between"><b>${GL[o.g] || o.g} · ${G.d}</b><button class="btn" id="qi-del">블록 지우기</button></div>
      <div class="row" style="margin-top:8px">${G.kind === 'two' ? `<label class="note">제어 ${qsel('qi-q', o.q)}</label><label class="note">대상 ${qsel('qi-q2', o.q2)}</label>` : `<label class="note">큐비트 ${qsel('qi-q', o.q)}</label>`}
      ${G.p ? `<label class="note">각도 <select class="sel" id="qi-th">${DATA.ANGLES.map(([l, v]) => `<option value="${v}"${Math.abs(v - o.th) < 1e-6 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
      <span class="note">열 ${o.t + 1}</span></div>
      <p class="note" style="margin:8px 0 0">펄스로 바꾸면: ${pulses || '—'}${o.q2 != null && PX.qdist(o.q, o.q2) > 1 ? ` · Q${o.q}–Q${o.q2}는 결합 맵에서 인접하지 않아 SWAP ${PX.qdist(o.q, o.q2) - 1}회가 왕복으로 붙습니다.` : ''}</p>`;
    $('#qi-del').addEventListener('click', () => remove(o));
    $('#qi-q').addEventListener('change', e => { const q = +e.target.value; if (q === o.q2) { snapshot(); o.q2 = o.q; o.q = q; changed(); } else move(o, q, o.t); });
    if ($('#qi-q2')) $('#qi-q2').addEventListener('change', e => { const q2 = +e.target.value; if (q2 === o.q) return; if ([...Array(C.n).keys()].some(y => (y === q2 || (y > Math.min(o.q, q2) && y < Math.max(o.q, q2))) && occ(y, o.t, o))) { msg('그 대상까지 연결선이 지나갈 칸이 비어 있지 않습니다.', true); inspector(); return; } snapshot(); o.q2 = q2; changed(); });
    if ($('#qi-th')) $('#qi-th').addEventListener('change', e => { snapshot(); o.th = parseFloat(e.target.value); changed(); });
  }

  /* ---------- pointer drag & drop (mouse + touch) ---------- */
  let drag = null;
  const cellAt = (x, y) => { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('[data-q][data-t]'); return c && $('#qc-grid').contains(c) ? { q: +c.dataset.q, t: +c.dataset.t } : null; };
  function hover(cell) { $$('#qc-grid .qcell.hot').forEach(r => r.classList.remove('hot')); if (cell) { const r = $(`#qc-grid .qcell[data-q="${cell.q}"][data-t="${cell.t}"]`); if (r) r.classList.add('hot'); } }
  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) {
      drag.moved = true; const gh = document.createElement('div'); gh.className = 'qc-ghost bg-' + DATA.GATES[drag.g].c; gh.textContent = GL[drag.g] || drag.g; document.body.appendChild(gh); drag.ghost = gh;
    }
    if (drag.moved) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; hover(cellAt(e.clientX, e.clientY)); }
  }
  function onUp(e) {
    window.removeEventListener('pointermove', onMove);
    const d = drag; drag = null; if (!d) return;
    if (d.ghost) d.ghost.remove(); hover(null);
    if (d.moved) {
      const cell = cellAt(e.clientX, e.clientY);
      if (d.kind === 'new') { if (cell) place(d.g, cell.q, cell.t); }
      else if (cell) move(d.op, cell.q, cell.t); else remove(d.op);
    } else if (d.kind === 'new') arm(C.armed === d.g ? null : d.g);
    else { C.sel = d.op; render(); inspector(); }
  }
  function startDrag(e, info) { drag = { ...info, x0: e.clientX, y0: e.clientY, moved: false }; window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp, { once: true }); }
  function arm(g) { C.armed = g; $$('#qc-palette .qblk').forEach(b => { const on = b.dataset.g === g; b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); }); render(); inspector(); }
  $('#qc-palette').addEventListener('pointerdown', e => { const b = e.target.closest('.qblk'); if (!b) return; e.preventDefault(); startDrag(e, { kind: 'new', g: b.dataset.g }); });
  $('#qc-palette').addEventListener('keydown', e => { const b = e.target.closest('.qblk'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); arm(C.armed === b.dataset.g ? null : b.dataset.g); } });
  $('#qc-grid').addEventListener('pointerdown', e => {
    const g = e.target.closest('.qop');
    if (g) { e.preventDefault(); const o = C.ops[+g.dataset.op]; startDrag(e, { kind: 'move', g: o.g, op: o }); return; }
    const c = e.target.closest('.qcell'); if (!c) return;
    if (C.armed) place(C.armed, +c.dataset.q, +c.dataset.t); else { C.sel = null; render(); inspector(); }
  });
  $('#qc-grid').addEventListener('keydown', e => { const g = e.target.closest('.qop'); if (!g) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); C.sel = C.ops[+g.dataset.op]; render(); inspector(); } });
  window.addEventListener('keydown', e => { if (e.key === 'Delete' && C.sel && PX.activeTab === 'instrument' && PX.instMode === 'quantum') { e.preventDefault(); remove(C.sel); } if (e.key === 'Escape' && C.armed) arm(null); });

  /* ---------- compile / run ---------- */
  function compile() { PX.qprog = PX.qcompile(C.ops); if (!$('#qc-qasm-box').hidden) qasm(); PX.qresults.schedule(); }
  function staleNote() { $('#qc-stale').hidden = !(C.stale && C.result); }
  function status() {
    const r = PX.qReady(), s = $('#qc-status');
    if (!r.ok) { s.className = 'pill bad'; s.textContent = '실행 불가'; $('#qc-why').textContent = r.why; }
    else if (r.why) { s.className = 'pill warn'; s.textContent = '노이즈 큼'; $('#qc-why').textContent = r.why; }
    else { s.className = 'pill ok'; s.textContent = `QPU 준비 · ${(PX.QH.T * 1000).toFixed(0)} mK`; $('#qc-why').textContent = ''; }
  }
  function run() {
    const r = PX.qReady(); status();
    if (!r.ok) { msg(r.why, true); return; }
    if (!C.ops.length) { msg('그리드에 블록을 하나 이상 놓으세요.', true); return; }
    const b = $('#qc-run'); b.disabled = true; b.textContent = '실행 중…';
    PX.qpulseRun && PX.qpulseRun();
    setTimeout(() => {
      C.result = PX.qsim.run(C.ops, C.n, C.shots); C.stale = false;
      PX.qresults.render(C.result); staleNote();
      b.disabled = false; b.textContent = '▶ QPU 실행';
      msg(`${C.result.total}샷 완료 · 이상적 결과와의 충실도 ${(C.result.fidelity * 100).toFixed(1)} %`);
      PX.logEvt && PX.logEvt(`QPU 실행 · ${C.n}Q · ${C.result.total}샷 · F ${(C.result.fidelity * 100).toFixed(1)}%`);
    }, 420);
  }
  PX.on('quantum', status); PX.on('fault', status);

  const saved = U.store.get('qc', null);
  if (saved && Array.isArray(saved.ops) && saved.n >= 1 && saved.n <= 5) { C.n = saved.n; C.ops = saved.ops; $('#qc-n').value = C.n; compile(); render(); inspector(); status(); run(); }
  else { $('#qc-n').value = 2; loadPreset('bell'); status(); }
})(window.PX);
