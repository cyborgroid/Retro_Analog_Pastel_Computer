/* Topology environment: block graph, power layer, bus packets, fault injection, memory map, clock tree */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX, { $, $$, lerp } = U;
  const NODES = DATA.NODES, BUSX = 400;
  const portR = n => { const N = NODES[n]; return [N.x + N.w, N.y + N.h / 2]; };
  const portL = n => { const N = NODES[n]; return [N.x, N.y + N.h / 2]; };
  const BUS_SIDE = ['rom', 'ram', 'vdp', 'fdc', 'psg'];

  function pathFor(a, b) {
    if (a === 'cpu' && BUS_SIDE.includes(b)) { const p = portR('cpu'), q = portL(b); return [p, [BUSX, p[1]], [BUSX, q[1]], q]; }
    if (BUS_SIDE.includes(a) && b === 'cpu') return pathFor('cpu', a).reverse();
    if (a === 'pio' && b === 'cpu') { const p = portR('pio'), q = portR('cpu'); return [p, [BUSX, p[1]], [BUSX, q[1]], q]; }
    if (a === 'cpu' && b === 'pio') return pathFor('pio', 'cpu').reverse();
    if (a === 'vdp' && b === 'crt') return [portR('vdp'), [705, 283], portL('crt')];
    if (a === 'fdc' && b === 'fdd') return [portR('fdc'), portL('fdd')];
    if (a === 'psg' && b === 'spk') return [portR('psg'), portL('spk')];
    if (a === 'xtal' && b === 'cpu') { const N = NODES.xtal; return [[N.x + 60, N.y + N.h], [N.x + 60, NODES.cpu.y]]; }
    if (a === 'kbd' && b === 'pio') { const N = NODES.kbd; return [[N.x + N.w / 2, N.y], [N.x + N.w / 2, NODES.pio.y + NODES.pio.h]]; }
    if (a === 'mouse' && b === 'pio') { const N = NODES.mouse; return [[N.x + N.w / 2 - 20, N.y], [N.x + N.w / 2 - 20, NODES.pio.y + NODES.pio.h]]; }
    return [portR(a), portL(b)];
  }

  let sel = 'cpu', layer = 'sig';
  function build() {
    const sv = $('#topo'); let h = '';
    h += `<defs><pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="var(--panel-2)"/><rect width="3.5" height="9" fill="var(--bad)" opacity=".55"/></pattern></defs>`;
    h += '<g id="sig-layer">';
    h += `<rect class="bus" x="${BUSX - 9}" y="30" width="18" height="510" rx="9"/>`;
    h += `<text class="lbl" x="${BUSX + 16}" y="560">D0–D7 · A0–A15 · /MREQ /IORQ /RD /WR</text>`;
    BUS_SIDE.forEach(b => { const p = pathFor('cpu', b); h += `<path class="edge" d="M${p[2]} L${p[3]}"/>`; });
    { const p = pathFor('pio', 'cpu'); h += `<path class="edge" d="M${p[0]} L${p[1]}"/>`; }
    h += `<path class="edge" d="M${portR('cpu')} L${BUSX},${portR('cpu')[1]}" style="stroke-width:5"/>`;
    [['vdp', 'crt', 'VIDEO · SYNC'], ['fdc', 'fdd', '34P'], ['psg', 'spk', 'AUDIO'], ['xtal', 'cpu', 'CLK'], ['kbd', 'pio', 'DIN-5'], ['mouse', 'pio', 'DE-9']].forEach(([a, b, l]) => {
      const p = pathFor(a, b); h += `<path class="edge sig" d="M${p.map(q => q.join(',')).join(' L')}"/>`;
      const m0 = p[0], m1 = p[1]; h += `<text class="lbl" x="${(m0[0] + m1[0]) / 2 + 6}" y="${(m0[1] + m1[1]) / 2 - 6}">${l}</text>`;
    });
    h += '</g>';
    h += '<g id="pwr-layer" style="display:none">';
    const rails = { '+5V': '#e7a83a', '+12V': '#e46a8f', '−12V': '#5b8fd8' };
    const pn = NODES.psu, px = pn.x + 40, py = pn.y + pn.h;
    [['cpu', '+5V'], ['rom', '+5V'], ['ram', '+5V'], ['vdp', '+5V'], ['fdc', '+5V'], ['pio', '+5V'], ['kbd', '+5V'], ['mouse', '+5V'], ['psg', '−12V'], ['crt', '+12V'], ['fdd', '+12V'], ['xtal', '+5V'], ['spk', '−12V']].forEach(([n, r], i) => {
      const N = NODES[n], tx = N.x + N.w - 14 - (i % 3) * 6, ty = N.y, off = (i % 5) * 6;
      h += `<path class="pwr" stroke="${rails[r]}" d="M${px + off},${py} C${px + off},${py + 80} ${tx},${ty - 70} ${tx},${ty}"/>`;
    });
    Object.entries(rails).forEach(([r, c], i) => { h += `<rect x="${700 + i * 92}" y="566" width="14" height="5" fill="${c}"/><text class="lbl" x="${718 + i * 92}" y="572">${r}</text>`; });
    h += '</g>';
    Object.entries(NODES).forEach(([id, N]) => {
      h += `<g class="node" data-n="${id}" tabindex="0" role="button" aria-label="${N.title}">
        <rect class="box" x="${N.x}" y="${N.y}" width="${N.w}" height="${N.h}" rx="12" fill="var(--${N.c})"/>
        <rect id="hatch-${id}" x="${N.x}" y="${N.y}" width="${N.w}" height="${N.h}" rx="12" fill="url(#hatch)" style="display:none"/>
        <rect class="fault" id="warn-${id}" x="${N.x}" y="${N.y + 8}" width="5" height="${N.h - 16}" rx="2" style="display:none"/>
        <text class="t1" x="${N.x + 16}" y="${N.y + N.h / 2 - 2}">${N.t}</text><text class="t2" x="${N.x + 16}" y="${N.y + N.h / 2 + 16}">${N.s}</text>
        <text class="ftag" id="ftag-${id}" x="${N.x + N.w - 12}" y="${N.y + 18}" text-anchor="end" style="display:none">FAULT</text></g>`;
    });
    h += '<g id="packets"></g>';
    sv.innerHTML = h;
    sv.addEventListener('click', e => { const g = e.target.closest('.node'); if (g) select(g.dataset.n); });
    sv.addEventListener('keydown', e => { const g = e.target.closest('.node'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); select(g.dataset.n); } });

    /* memory map, io ports, clock tree */
    $('#memmap').innerHTML = DATA.MEMMAP.map(m => `<div class="bg-${m.c}" style="flex:${m.to - m.from + 1}">${m.n}<br>${U.hex(m.from)}–${U.hex(m.to)}</div>`).join('');
    $('#ioports').innerHTML = DATA.IOPORTS.map(([p, n]) => `<dt>${p}</dt><dd>${n}</dd>`).join('');
    $('#clocks').innerHTML = DATA.CLOCKS.map(([d, n, root]) => `<li class="${root ? 'root' : ''}" style="--d:${d}">${n}</li>`).join('');
    select('cpu');
  }

  function select(id) {
    sel = id; const N = NODES[id];
    $$('#topo .node').forEach(g => g.classList.toggle('sel', g.dataset.n === id));
    $('#node-title').textContent = N.title; $('#node-sub').textContent = N.sub;
    $('#node-kv').innerHTML = N.kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#node-fault-text').textContent = '고장 시 증상: ' + N.fault;
    syncFaultBtn();
  }
  function syncFaultBtn() {
    const b = $('#node-fault'), on = S.faults.has(sel);
    b.setAttribute('aria-pressed', on); b.textContent = on ? '고장 복구' : '고장 주입';
  }
  function toggleFault(id) {
    if (S.faults.has(id)) S.faults.delete(id); else S.faults.add(id);
    logEvt((S.faults.has(id) ? 'FAULT ' : 'REPAIR ') + NODES[id].t, S.faults.has(id));
    PX.emit('fault'); PX.emit('power');
  }
  PX.toggleFault = toggleFault;

  function setLayer(l) {
    layer = l; $('#sig-layer').style.display = l === 'sig' ? '' : 'none'; $('#pwr-layer').style.display = l === 'pwr' ? '' : 'none'; $('#packets').style.display = l === 'sig' ? '' : 'none';
    [['sig', '#layer-sig'], ['pwr', '#layer-pwr']].forEach(([k, s]) => { $(s).classList.toggle('on', l === k); $(s).setAttribute('aria-pressed', l === k); });
  }

  function updateFaults() {
    const warn = { psu: PX.mainsOn() && (PX.P.dropout || S.trip), crt: PX.mainsOn() && (!PX.hLocked() || Math.abs(S.vHold) > 0.25), kbd: S.ghosts.size > 0 };
    Object.keys(NODES).forEach(k => {
      const f = S.faults.has(k);
      $('#hatch-' + k).style.display = f ? '' : 'none'; $('#ftag-' + k).style.display = f ? '' : 'none';
      $('#warn-' + k).style.display = !f && warn[k] ? '' : 'none';
    });
    const n = S.faults.size;
    $('#fault-count').textContent = n ? `고장 ${n}건 주입됨` : '고장 없음';
    $('#fault-count').className = 'pill ' + (n ? 'bad' : 'ok');
    syncFaultBtn();
  }

  /* packets */
  const packets = [];
  function pulse(a, b, col) {
    if (PX.activeTab !== 'topology' || layer !== 'sig') return;
    const pts = pathFor(a, b); let len = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); len += l; }
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    el.setAttribute('r', 6); el.setAttribute('fill', col || 'var(--accent)'); el.setAttribute('stroke', 'var(--panel)'); el.setAttribute('stroke-width', '2');
    $('#packets').appendChild(el); packets.push({ el, pts, segs, len, d: 0, speed: len / 0.7 });
  }
  PX.pulse = pulse;
  function animPackets(dt) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]; p.d += p.speed * dt;
      if (p.d >= p.len) { p.el.remove(); packets.splice(i, 1); continue; }
      let d = p.d, k = 0; while (k < p.segs.length && d > p.segs[k]) { d -= p.segs[k]; k++; }
      const a = p.pts[k], b = p.pts[k + 1] || a, u = p.segs[k] ? d / p.segs[k] : 0;
      p.el.setAttribute('cx', lerp(a[0], b[0], u)); p.el.setAttribute('cy', lerp(a[1], b[1], u));
    }
  }
  function clearPackets() { packets.forEach(p => p.el.remove()); packets.length = 0; }

  const t0 = performance.now();
  function logEvt(txt, err) {
    const ul = $('#log'); if (!ul) return;
    const li = document.createElement('li'); if (err) li.className = 'err';
    li.innerHTML = `<time>${((performance.now() - t0) / 1000).toFixed(2)}s</time><span></span>`; li.lastChild.textContent = txt;
    ul.prepend(li); while (ul.children.length > 40) ul.lastChild.remove();
  }
  PX.logEvt = logEvt;

  let progI = 0, progT = 0, vidT = 0, clkT = 0, haltLogged = false;
  function runProgram(dt) {
    if (!PX.logicOn()) return;
    progT += dt; vidT += dt; clkT += dt;
    if (!PX.cpuOK()) { if (!haltLogged) { logEvt('CPU 정지 · 버스 트랜잭션 없음', true); haltLogged = true; } }
    else haltLogged = false;
    if (progT > 0.9 && PX.cpuOK()) {
      progT = 0;
      const [a, b, txt] = DATA.PROGRAM[progI++ % DATA.PROGRAM.length];
      const s = txt.replace('%A', U.hex(0x0100 + Math.floor(Math.random() * 0x3000))).replace('%B', U.hex(0x8000 + Math.floor(Math.random() * 0x7000))).replace('%R', U.hex(Math.floor(Math.random() * 128), 2));
      if (S.faults.has(b)) { logEvt(`BUS ERROR · ${NODES[b].t} 응답 없음`, true); pulse(a, b, 'var(--bad)'); }
      else {
        const toCpu = b === 'rom' || /RD|IN/.test(txt);
        pulse(toCpu ? b : a, toCpu ? a : b, toCpu ? 'var(--accent)' : '#e46a8f'); logEvt(s);
      }
    }
    if (vidT > 0.35 && PX.syncOK()) { vidT = 0; pulse('vdp', 'crt', '#5b8fd8'); }
    if (clkT > 0.6 && PX.clockOn()) { clkT = 0; pulse('xtal', 'cpu', '#e7a83a'); }
  }

  build();
  $('#layer-sig').addEventListener('click', () => setLayer('sig'));
  $('#layer-pwr').addEventListener('click', () => setLayer('pwr'));
  $('#node-probe').addEventListener('click', () => { PX.show('instrument'); PX.applyPreset(NODES[sel].probe); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#node-fault').addEventListener('click', () => toggleFault(sel));
  $('#fault-clear').addEventListener('click', () => { if (!S.faults.size) return; S.faults.clear(); logEvt('모든 고장 복구'); PX.emit('fault'); PX.emit('power'); });
  PX.on('fault', updateFaults); PX.on('params', updateFaults); PX.on('keys', updateFaults); PX.on('power', updateFaults);
  PX.addFrame('topology', dt => animPackets(dt));
  PX.addFrame('*', dt => { runProgram(dt); if (PX.activeTab !== 'topology' && packets.length) clearPackets(); });
  updateFaults();
})(window.PX);
