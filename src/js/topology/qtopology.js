/* Topology · quantum subsystem: room-temperature control rack → dilution refrigerator → QPU → readout chain,
   coupling map with live per-qubit health, fault injection on quantum nodes */
(function (PX) {
  'use strict';
  const { U, S, DATA, Q } = PX, { $, $$, lerp } = U;
  const N = DATA.QNODES;
  const STAGE_Y = [120, 175, 235, 295, 350, 405];
  const cx = id => N[id].x + N[id].w / 2, cy = id => N[id].y + N[id].h / 2;
  const PATHS = {
    host: [[0, 70], [40, 70]],
    qbi_qcu: [[130, 100], [130, 140]],
    qcu_awg: [[130, 210], [130, 260]],
    qcu_lo: [[220, 200], [240, 200], [240, 230], [340, 230], [340, 260]],
    awg_iq: [[130, 320], [130, 340], [230, 340], [230, 398], [260, 398]],
    lo_iq: [[340, 320], [340, 370]],
    drive: [[420, 398], [480, 398], [480, 96], [600, 96], [600, 452]],
    flux: [[220, 300], [236, 300], [236, 352], [500, 352], [500, 104], [650, 104], [650, 452]],
    ro: [[810, 492], [880, 492], [880, 68], [420, 68]],
    rt_adc: [[340, 96], [340, 140]],
    adc_qcu: [[260, 168], [220, 168]],
    cryo: [[220, 398], [236, 398], [236, 470], [530, 470]]
  };
  const path = pts => 'M' + pts.map(p => p.join(',')).join(' L');
  let sel = 'qpu';

  function build() {
    let h = `<defs><pattern id="qhatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="var(--panel-2)"/><rect width="3.5" height="9" fill="var(--bad)" opacity=".55"/></pattern>
      <linearGradient id="fridge-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9e6" stop-opacity=".35"/><stop offset="1" stop-color="#b3dcf6" stop-opacity=".55"/></linearGradient></defs>`;
    h += `<rect id="fridge-bg" x="520" y="112" width="440" height="436" rx="18" fill="url(#fridge-g)" stroke="var(--line)" stroke-width="1.5"/>`;
    h += `<text class="lbl" x="940" y="134" text-anchor="end">희석 냉동기 (진공 캔 내부)</text>`;
    STAGE_Y.forEach((y, i) => {
      h += `<rect x="540" y="${y - 3}" width="400" height="6" rx="3" fill="#e9c98f" opacity=".85"/>`;
      h += `<text class="lbl" x="548" y="${y - 7}">${DATA.QSTAGES[i][0]}</text><text class="lbl qtemp" id="qst-${i}" x="760" y="${y - 7}" text-anchor="end">—</text>`;
    });
    h += `<rect x="560" y="440" width="270" height="102" rx="10" fill="none" stroke="var(--muted)" stroke-dasharray="4 4"/><text class="lbl" x="566" y="538">자기 차폐 캔 · 샘플 박스</text>`;
    Object.entries(PATHS).forEach(([k, p]) => {
      const cls = k === 'drive' ? 'qline drive' : k === 'flux' ? 'qline flux' : k === 'ro' ? 'qline ro' : k === 'cryo' ? 'edge dashline' : 'edge';
      h += `<path class="${cls}" d="${path(p)}"/>`;
    });
    h += `<text class="lbl" x="4" y="62">PX-80 버스</text>`;
    const box = (x, y, t, cls) => `<rect class="${cls}" x="${x - 15}" y="${y - 9}" width="30" height="18" rx="3"/><text class="lbl tinyb" x="${x}" y="${y + 4}" text-anchor="middle">${t}</text>`;
    [[235, '−20'], [295, '−10'], [405, '−20']].forEach(([y, t]) => h += box(600, y, t, 'qatt'));
    [[235, 'LPF'], [405, 'LPF']].forEach(([y, t]) => h += box(650, y, t, 'qatt'));
    h += `<circle cx="880" cy="440" r="10" class="qatt"/><path d="M874 437 a6 6 0 1 1 3 8" fill="none" stroke="var(--on-pastel)"/><text class="lbl" x="896" y="444">아이솔레이터</text>`;
    h += `<text class="lbl" x="486" y="250" transform="rotate(-90 486 250)">구동 (XY)</text><text class="lbl" x="506" y="250" transform="rotate(-90 506 250)">플럭스 (Z)</text><text class="lbl" x="896" y="320" transform="rotate(-90 896 320)">판독 출력</text>`;
    Object.entries(N).forEach(([id, n]) => {
      h += `<g class="node" data-q="${id}" tabindex="0" role="button" aria-label="${n.title}">
        <rect class="box" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="var(--${n.c})"/>
        <rect id="qhatch-${id}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="url(#qhatch)" style="display:none"/>
        <rect class="fault" id="qwarn-${id}" x="${n.x}" y="${n.y + 8}" width="5" height="${n.h - 16}" rx="2" style="display:none"/>
        <text class="t1" x="${n.x + 14}" y="${n.y + n.h / 2 - 2}">${n.t}</text><text class="t2" x="${n.x + 14}" y="${n.y + n.h / 2 + 15}">${n.s}</text>
        <text class="ftag" id="qftag-${id}" x="${n.x + n.w - 10}" y="${n.y + 16}" text-anchor="end" style="display:none">FAULT</text></g>`;
    });
    h += '<g id="qpackets"></g>';
    const sv = $('#qtopo'); sv.innerHTML = h;
    sv.addEventListener('click', e => { const g = e.target.closest('.node'); if (g) select(g.dataset.q); });
    sv.addEventListener('keydown', e => { const g = e.target.closest('.node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); select(g.dataset.q); } });

    let m = '';
    DATA.QCOUPLING.forEach(([a, b], i) => { const [x1, y1] = DATA.QPOS[a], [x2, y2] = DATA.QPOS[b]; m += `<line class="cpl" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="lbl" id="qcz-${i}" x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 - 6}">—</text>`; });
    const LBL = [[60, 104, 'middle'], [160, 22, 'middle'], [260, 104, 'middle'], [190, 156, 'start'], [190, 246, 'start']];
    DATA.QPOS.forEach(([x, y], q) => { const [lx, ly, an] = LBL[q]; m += `<circle class="qb" id="qb-${q}" cx="${x}" cy="${y}" r="22"/><text class="qbt" x="${x}" y="${y + 5}" text-anchor="middle">Q${q}</text><text class="lbl" x="${lx}" y="${ly}" text-anchor="${an}"><tspan id="qbf-${q}" x="${lx}">—</tspan><tspan id="qbi-${q}" x="${lx}" dy="13">—</tspan></text>`; });
    $('#qmap').innerHTML = m;
    select('qpu');
  }

  function select(id) {
    sel = id; const n = N[id];
    $$('#qtopo .node').forEach(g => g.classList.toggle('sel', g.dataset.q === id));
    $('#qnode-title').textContent = n.title; $('#qnode-sub').textContent = n.sub;
    $('#qnode-kv').innerHTML = n.kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#qnode-fault-text').textContent = '고장 시 증상: ' + n.fault;
    syncBtn();
  }
  function syncBtn() { const b = $('#qnode-fault'), on = S.faults.has(sel); b.setAttribute('aria-pressed', on); b.textContent = on ? '고장 복구' : '고장 주입'; }
  $('#qnode-fault').addEventListener('click', () => {
    if (S.faults.has(sel)) S.faults.delete(sel); else S.faults.add(sel);
    PX.logEvt && PX.logEvt((S.faults.has(sel) ? 'FAULT ' : 'REPAIR ') + N[sel].t, S.faults.has(sel));
    PX.emit('fault');
  });
  $('#qnode-run').addEventListener('click', () => { PX.show('instrument'); PX.setInstMode && PX.setInstMode('quantum'); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  function update() {
    const H = PX.QH;
    DATA.QSTAGES.forEach((s, i) => { const T = PX.stageT(i); const el = $('#qst-' + i); if (el) el.textContent = T >= 1 ? T.toFixed(T >= 10 ? 0 : 1) + ' K' : (T * 1000).toFixed(0) + ' mK'; });
    const warm = H.T > 0.05;
    $('#fridge-bg').setAttribute('stroke', warm ? 'var(--bad)' : 'var(--line)');
    const warn = { cryoctl: warm, qpu: warm || Math.abs(H.det) > 3, twpa: !Q.twpa, lo: Math.abs(H.det) > 3 };
    Object.keys(N).forEach(k => {
      const f = S.faults.has(k);
      $('#qhatch-' + k).style.display = f ? '' : 'none'; $('#qftag-' + k).style.display = f ? '' : 'none';
      $('#qwarn-' + k).style.display = !f && warn[k] ? '' : 'none';
    });
    H.qubits.forEach((q, i) => {
      const health = U.clamp(q.T1 / 90, 0, 1);
      const c = $('#qb-' + i); c.style.fill = health > 0.6 ? 'var(--mint)' : health > 0.2 ? 'var(--butter)' : 'var(--rose)';
      $('#qbf-' + i).textContent = `${q.f01.toFixed(3)} GHz`;
      $('#qbi-' + i).textContent = `T1 ${q.T1 >= 1 ? q.T1.toFixed(0) : q.T1.toFixed(2)}µs · RO ${(100 * (1 - q.ero)).toFixed(1)}%`;
    });
    DATA.QCOUPLING.forEach(([a, b], i) => { $('#qcz-' + i).textContent = `CZ ${(100 * (1 - Math.max(H.qubits[a].p2, H.qubits[b].p2))).toFixed(1)}%`; });
    const st = $('#qstatus'), r = PX.qReady();
    if (!r.ok) { st.className = 'pill bad'; st.textContent = '실행 불가'; }
    else if (warm) { st.className = 'pill warn'; st.textContent = `혼합실 ${(H.T * 1000).toFixed(0)} mK · 열잡음`; }
    else { st.className = 'pill ok'; st.textContent = `실행 가능 · ${(H.T * 1000).toFixed(0)} mK`; }
    syncBtn();
  }

  /* packets along the quantum chain when a circuit runs */
  const packets = [];
  function pulse(key, col) {
    if (PX.activeTab !== 'topology') return;
    const pts = PATHS[key]; let len = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); len += l; }
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); el.setAttribute('r', 6); el.setAttribute('fill', col); el.setAttribute('stroke', 'var(--panel)'); el.setAttribute('stroke-width', 2);
    $('#qpackets').appendChild(el); packets.push({ el, pts, segs, len, d: 0, speed: len / 0.9 });
  }
  PX.qpulseRun = () => { [['host', 'var(--accent)'], ['qbi_qcu', 'var(--accent)'], ['qcu_awg', '#e46a8f'], ['awg_iq', '#e46a8f'], ['drive', '#e46a8f'], ['flux', '#e7a83a'], ['ro', '#5b8fd8'], ['adc_qcu', '#5b8fd8']].forEach(([k, c], i) => setTimeout(() => pulse(k, c), i * 120)); };
  PX.addFrame('topology', dt => {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]; p.d += p.speed * dt;
      if (p.d >= p.len) { p.el.remove(); packets.splice(i, 1); continue; }
      let d = p.d, k = 0; while (k < p.segs.length && d > p.segs[k]) { d -= p.segs[k]; k++; }
      const a = p.pts[k], b = p.pts[k + 1] || a, u = p.segs[k] ? d / p.segs[k] : 0;
      p.el.setAttribute('cx', lerp(a[0], b[0], u)); p.el.setAttribute('cy', lerp(a[1], b[1], u));
    }
  });
  let rt = 0;
  PX.addFrame('*', dt => { rt += dt; if (rt > 2.5 && PX.activeTab === 'topology' && PX.qReady().ok) { rt = 0; pulse('drive', '#e46a8f'); setTimeout(() => pulse('ro', '#5b8fd8'), 400); } });

  build(); update();
  PX.on('quantum', update); PX.on('fault', update);
})(window.PX);
