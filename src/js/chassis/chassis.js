/* Chassis environment UI: colorways, wide-monitor parameters, exploded view, section, lighting, BOM */
(function (PX) {
  'use strict';
  const { U, S, C, DATA } = PX, { $, $$ } = U;
  const V = PX.viewer;
  // first visit: the colourway learned from reference photos (tools/refs/palette.py); a stored choice wins
  const learned = Math.max(0, DATA.palettes.findIndex(p => p.n === 'Archive Pastel'));
  let palIdx = U.clamp(U.store.get('pal', learned) | 0, 0, DATA.palettes.length - 1);
  PX.palette = { ...DATA.palettes[palIdx] };
  const saved = U.store.get('monitor', null);
  if (saved && C.ASPECTS[saved.aspect]) { Object.assign(S.monitor, saved); PX.screen.resize(C.ASPECTS[S.monitor.aspect]); }

  /* colorways */
  $('#presets').innerHTML = DATA.palettes.map((p, i) => `<button class="sw-btn" data-i="${i}" aria-pressed="${i === palIdx}" aria-label="${p.n}" title="${p.n}"><span style="background:${p.base}"></span><span style="background:${p.keyB}"></span><span style="background:${p.trim}"></span></button>`).join('');
  $('#presets').addEventListener('click', e => {
    const b = e.target.closest('.sw-btn'); if (!b) return;
    palIdx = +b.dataset.i; PX.palette = { ...DATA.palettes[palIdx] };
    $$('#presets .sw-btn').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#preset-name').textContent = PX.palette.n;
    DATA.roles.forEach(([k]) => $('#col-' + k).value = PX.palette[k]); PX.model.setPalette(PX.palette); PX.emit('palette', PX.palette); U.store.set('pal', palIdx);
  });
  $('#preset-name').textContent = PX.palette.n;
  $('#part-colors').innerHTML = DATA.roles.map(([k, n]) => `<label>${n}<input type="color" id="col-${k}" value="${PX.palette[k]}"></label>`).join('');
  DATA.roles.forEach(([k]) => $('#col-' + k).addEventListener('input', e => { PX.palette[k] = e.target.value; $('#preset-name').textContent = DATA.palettes[palIdx].n + ' · 커스텀'; PX.model.setPalette(PX.palette); PX.emit('palette', PX.palette); }));

  /* monitor parameters */
  const MPRE = [['클래식 14"', { diag: 14, aspect: '4:3', bezel: 30 }], ['와이드 19"', { diag: 19, aspect: '16:10', bezel: 12 }], ['시네마 22"', { diag: 22, aspect: '16:9', bezel: 8 }]];
  $('#mon-presets').innerHTML = MPRE.map(([n], i) => `<button class="btn" data-mp="${i}">${n}</button>`).join('');
  $('#mon-aspect').innerHTML = Object.keys(C.ASPECTS).map(a => `<button data-a="${a}" aria-pressed="${a === S.monitor.aspect}">${a}</button>`).join('');
  const diag = $('#mon-diag'), bez = $('#mon-bezel');
  diag.value = S.monitor.diag; bez.value = S.monitor.bezel;
  let pending = false;
  function applyMonitor(next) {
    const aspectChanged = next.aspect && next.aspect !== S.monitor.aspect;
    Object.assign(S.monitor, next); U.store.set('monitor', S.monitor);
    if (aspectChanged) PX.screen.resize(C.ASPECTS[S.monitor.aspect]);
    diag.value = S.monitor.diag; bez.value = S.monitor.bezel;
    $$('#mon-aspect button').forEach(b => b.setAttribute('aria-pressed', b.dataset.a === S.monitor.aspect));
    if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; PX.model.rebuildMonitor(); renderMonitor(); PX.emit('monitor'); }); }
    renderMonitorText();
  }
  diag.addEventListener('input', () => applyMonitor({ diag: +diag.value }));
  bez.addEventListener('input', () => applyMonitor({ bezel: +bez.value }));
  $('#mon-aspect').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) applyMonitor({ aspect: b.dataset.a }); });
  $('#mon-presets').addEventListener('click', e => { const b = e.target.closest('[data-mp]'); if (b) applyMonitor({ ...MPRE[+b.dataset.mp][1] }); });

  /* same formulas as model.buildMonitor, in millimetres */
  function dimsFromState() {
    const m = S.monitor, a = C.ASPECTS[m.aspect], w = m.diag * 25.4 * a / Math.hypot(a, 1), h = w / a, bt = m.bezel, gap = 2, chin = 20;
    const W = w + 2 * (bt + gap), H = h + 2 * (bt + gap) + chin;
    return { w, h, W, H, Htot: H + 30, D: 15 + 62 + 0.3 * h, ratio: w * h / (W * H), bt };
  }
  function renderMonitorText() {
    const d = dimsFromState();
    $('#o-diag').textContent = S.monitor.diag + '"'; $('#o-bezel').textContent = S.monitor.bezel + ' mm';
    $('#mon-kv').innerHTML = [['화면 (가시 영역)', `${Math.round(d.w)} × ${Math.round(d.h)} mm`], ['외형 W × H', `${Math.round(d.W)} × ${Math.round(d.Htot)} mm (스탠드 포함)`], ['깊이 (슬림 넥)', `${Math.round(d.D)} mm`], ['화면 점유율', `${Math.round(d.ratio * 100)} %`]]
      .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const sk = $('#mon-sketch'), s = 200 / 520;
    const ow = d.W * s, oh = d.H * s, x0 = (220 - ow) / 2, y0 = 6;
    const sw_ = d.w * s, sh_ = d.h * s, sx = x0 + (ow - sw_) / 2, sy = y0 + (d.bt + 2) * s;
    sk.setAttribute('viewBox', `0 0 220 ${Math.ceil(Math.max(oh, 120) + 30)}`);
    sk.innerHTML = `<defs><linearGradient id="skg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cbbaff"/><stop offset="1" stop-color="#b4ecd6"/></linearGradient></defs>
      <rect x="${x0}" y="${y0}" width="${ow}" height="${oh}" rx="6" fill="var(--sky)" stroke="var(--on-pastel)" stroke-width="1.2"/>
      <rect x="${sx}" y="${sy}" width="${sw_}" height="${sh_}" rx="3" fill="url(#skg)"/>
      <circle cx="${x0 + ow - 14}" cy="${y0 + oh - (d.bt + 20) * s / 2}" r="2.5" fill="var(--on-pastel)"/>
      <text x="110" y="${Math.max(oh, 120) + 24}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="currentColor">${S.monitor.diag}" ${S.monitor.aspect} · 폭 ${Math.round(d.W)} mm · 화면 ${Math.round(d.ratio * 100)}%</text>`;
  }
  function renderMonitor() { renderBOM(); }
  /* with the CAD v3 view on, dimensions and masses come from the Rust build (W x H x D, mm) */
  const CADROW = { '본체': 'base_unit', '키보드': 'keyboard', '볼 마우스': 'mouse' };
  const cadDims = m => { const b = m.bbox_mm; return [`${Math.round(b[0])} × ${Math.round(b[2])} × ${Math.round(b[1])}`, m.mass_kg.toFixed(2) + ' kg']; };
  function renderBOM() {
    const d = dimsFromState(), kg = (6.5 + S.monitor.diag * S.monitor.diag * 0.012).toFixed(1);
    const C = PX.cad && PX.cad.current() ? PX.cad.current().modules : null;
    if (C) {
      const m = cadDims(C.monitor);
      const real = PX.cad.mode === 'build';
      $('#bom').innerHTML = DATA.BOM.map(r => r[0] === 'MONITOR' ? [real ? 'LCD 모니터' : 'CRT 모니터', m[0], m[1], real ? 'PLA 출력 2.5t, 베젤 21 mm' : 'ABS 2.5t, 베젤 12 mm', 'BRIGHT · V-HOLD · H-SIZE 노브', real ? '19" 16:10 LCD (M190PW01 V8), 컨트롤러 보드, 패널 클립 8개' : '19" 16:10 슈퍼슬림 CRT, 손잡이, 틸트 로커']
        : CADROW[r[0]] ? [r[0], ...cadDims(C[CADROW[r[0]]]), r[3], r[4], r[5]] : r)
        .map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join('');
      return;
    }
    $('#bom').innerHTML = DATA.BOM.map(r => r[0] === 'MONITOR'
      ? ['CRT 모니터', `${Math.round(d.W)} × ${Math.round(d.Htot)} × ${Math.round(d.D)}`, kg + ' kg', `ABS 2.5t, 베젤 ${S.monitor.bezel} mm`, 'BRIGHT · V-HOLD · H-SIZE 노브', `${S.monitor.diag}" ${S.monitor.aspect} 슬림 CRT, 편향 요크, 플라이백`]
      : r).map(r => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td></tr>`).join('');
  }
  renderMonitorText(); renderBOM();

  /* explode */
  $('#explode').addEventListener('input', e => { const v = parseFloat(e.target.value); S.explode = U.easeInOut(v); $('#o-explode').textContent = Math.round(v * 100) + ' %'; });

  /* view options */
  const clipBtn = $('#clip'), clipX = $('#clip-x');
  clipBtn.addEventListener('click', () => { const on = clipBtn.getAttribute('aria-pressed') !== 'true'; clipBtn.setAttribute('aria-pressed', on); clipBtn.classList.toggle('on', on); V.setClip(on, parseFloat(clipX.value)); });
  clipX.addEventListener('input', () => { $('#o-clip').textContent = Math.round(parseFloat(clipX.value) * 100) + ' mm'; if (V.ok) V.setClip(V.clipOn, parseFloat(clipX.value)); });
  $('#night').addEventListener('click', e => { const on = !V.night; V.setNight(on); e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.classList.toggle('on', on); });
  $('#finish').addEventListener('input', e => { const r = parseFloat(e.target.value); PX.model.setFinish(r); PX.emit('finish', r); $('#o-finish').textContent = r < 0.3 ? '유광' : r < 0.6 ? '반광' : '무광'; });
  $('#wire').addEventListener('click', e => { if (!V.ok) return; const on = !V.wire; V.setWire(on); e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.classList.toggle('on', on); });
  $('#spin').addEventListener('click', e => { if (!V.ok) return; V.controls.autoRotate = !V.controls.autoRotate; e.currentTarget.setAttribute('aria-pressed', V.controls.autoRotate); e.currentTarget.classList.toggle('on', V.controls.autoRotate); });
  $('#degauss-3d').addEventListener('click', () => PX.degauss());
  const CAMS = { iso: [[7.4, 5.2, 9.4], [0, 1.6, 0.3]], front: [[0, 2.6, 12.5], [0, 2.0, 0.3]], side: [[12.5, 2.8, 0.4], [0, 1.6, 0.3]], top: [[0.01, 15, 1.2], [0, 0, 0.3]], screen: [[0.6, 2.9, 4.6], [0, 2.6, -0.6]] };
  $$('[data-cam]').forEach(b => b.addEventListener('click', () => { const [p, t] = CAMS[b.dataset.cam]; V.tween(p, t); }));

  /* picks */
  PX.on('pick', id => {
    const p = DATA.PICKS[id]; if (!p) return;
    $('#pick-title').textContent = p.t; $('#pick-desc').textContent = p.d;
    $('#pick-kv').innerHTML = p.kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $$('.vp-pick').forEach(el => el.textContent = '선택: ' + p.t);
  });
  PX.on('keys', () => PX.model.updateKeys && PX.model.scene && PX.model.updateKeys());
  PX.on('monitor-built', () => { renderMonitor(); });
  PX.on('cad', renderBOM);

  PX.addFrame('chassis', (dt, t) => V.render(dt, t));
  PX.onShow = PX.onShow || {};
  PX.onShow.chassis = () => V.attach($('#viewport'), 'chassis');
})(window.PX);
