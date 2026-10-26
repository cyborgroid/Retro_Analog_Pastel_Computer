/* CAD view: the Rust build output in the Chassis viewer — the real build (LCD, printed parts) or the CRT concept
   (cad/out/build/web/*.glb, cad/out/web/*.glb, src/js/data/cad.js). Needs HTTP (./run.sh); under file:// the web v2 model stays. */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX, { $, $$ } = U;
  const CAD = DATA.CAD, V = PX.viewer;
  const MODES = ['build', 'concept', 'web'];
  const saved = U.store.get('cad-mode', CAD ? CAD.default : 'web');
  const cad = PX.cad = { mode: MODES.includes(saved) ? saved : 'build', v: {} };
  Object.defineProperty(cad, 'enabled', { get: () => cad.mode !== 'web' && !!CAD });
  cad.current = () => (CAD && cad.mode !== 'web' ? CAD[cad.mode] : null);
  const KEY_ID = { '-': 'minus', '=': 'equal', '[': 'lbracket', ']': 'rbracket', ';': 'semicolon', "'": 'quote', ',': 'comma', '.': 'period', '/': 'slash' };
  const PAL_MATS = ['base', 'tray', 'monitor', 'keyboard', 'keyA', 'keyB', 'mouse', 'trim'];
  const slot = m => (cad.v[m] = cad.v[m] || { root: null, state: 'idle', keys: [], links: {}, mats: {} });

  function load(m) {
    const d = CAD && CAD[m], s = slot(m);
    if (!d || s.state !== 'idle' || !V.ok) return;
    if (!window.THREE || !THREE.GLTFLoader || location.protocol === 'file:') { s.state = 'unavailable'; render(); return; }
    s.state = 'loading'; render();
    new THREE.GLTFLoader().load(d.glb, gltf => {
      const root = s.root = gltf.scene;
      root.scale.setScalar(10);                       // glTF metres -> 1 unit = 100 mm, same axes as the workbench
      root.traverse(o => {
        if (o.isMesh) { o.castShadow = o.receiveShadow = true; s.mats[o.material.name] = o.material; }
        else if (o.userData.link) s.links[o.userData.link] = { o, q0: o.quaternion.clone(), p0: o.position.clone(), j: o.userData.joint };
      });
      DATA.KEYS.forEach(k => { const l = s.links['key_' + (KEY_ID[k] || k.toLowerCase())]; if (l) s.keys.push([k, l]); });
      root.visible = false; V.scene.add(root); s.state = 'ready';
      screen(s); setPalette(PX.palette); V.refreshMaterials(); render();
    }, undefined, err => { s.state = 'error'; s.err = String((err && err.message) || err); render(); });
  }

  /* live CRT / LCD picture on the screen part (planar UVs over its front face) */
  function screen(s) {
    if (!s.root || !PX.model.scrTex) return;
    const m = s.root.getObjectByName('crt_screen'); if (!m) return;
    const g = m.geometry; g.computeBoundingBox();
    const b = g.boundingBox, p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[2 * i] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x); uv[2 * i + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.material = new THREE.MeshBasicMaterial({ map: PX.model.scrTex, toneMapped: false });
  }

  function setPalette(pal) {
    if (!pal) return;
    Object.values(cad.v).forEach(s => PAL_MATS.forEach(n => {
      const m = s.mats[n]; if (!m) return;
      const c = new THREE.Color(pal[n === 'tray' ? 'base' : n]);
      if (n === 'tray') c.multiplyScalar(0.88);
      m.color.copy(c.convertSRGBToLinear());
    }));
  }

  function turn(s, name, ang) { const l = s.links[name]; if (l && l.j) l.o.quaternion.copy(l.q0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...l.j.axis), ang)); }

  /* called by the viewer every frame: which model is shown, joint poses from the shared state */
  cad.sync = mode => {
    const act = cad.enabled && mode === 'chassis' ? cad.v[cad.mode] : null;
    const on = !!(act && act.state === 'ready');
    Object.entries(cad.v).forEach(([m, s]) => { if (s.root) s.root.visible = on && m === cad.mode; });
    if (PX.model.root) PX.model.root.visible = !on;
    if (!on) return;
    act.keys.forEach(([k, l]) => l.o.position.copy(l.p0).addScaledVector(new THREE.Vector3(...l.j.axis), S.pressed.has(k) ? l.j.upper : 0));
    turn(act, 'power_toggle', S.power ? 0.35 : -0.35);
    turn(act, 'dial_vol', S.psgOn ? -0.7 : 0.9);
    turn(act, 'knob_bright', (S.bright - 0.6) * 3); turn(act, 'knob_vhold', S.vHold * 0.8); turn(act, 'knob_hsize', (S.hSize - 0.92) * 10);
  };

  function render() {
    $$('#cad-mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === cad.mode));
    if (!CAD) { $('#cad-kv').innerHTML = '<dt>상태</dt><dd>src/js/data/cad.js 없음 — ./cad/build.sh 실행</dd>'; $('#cad-files').innerHTML = ''; PX.emit('cad'); return; }
    const d = cad.current();
    if (!d) { $('#cad-kv').innerHTML = '<dt>모델</dt><dd>three.js로 그린 이전 모델 (분해도 · 파라메트릭 모니터 사용 가능)</dd>'; $('#cad-files').innerHTML = ''; PX.emit('cad'); return; }
    const s = slot(cad.mode);
    const st = { idle: '대기', loading: 'GLB 불러오는 중…', ready: '표시 중', unavailable: 'file:// 에서는 불가 — ./run.sh 로 열기', error: '불러오기 실패: ' + (s.err || '') }[s.state];
    const M = d.modules, mm = b => b.bbox_mm.map(Math.round).join(' × '), C = d.checks, P = d.print;
    const rows = [
      ['상태', st],
      ['구성', `부품 ${d.counts.parts} · 링크 ${d.counts.links} · 관절 ${d.counts.joints} (가동 ${d.counts.movable_joints})`],
      ['본체', `${mm(M.base_unit)} mm · ${M.base_unit.mass_kg.toFixed(2)} kg`],
      ['모니터', `${mm(M.monitor)} mm · ${M.monitor.mass_kg.toFixed(2)} kg`],
      ['키보드', `${mm(M.keyboard)} mm · ${M.keyboard.mass_kg.toFixed(2)} kg`],
      ['마우스', `${mm(M.mouse)} mm · ${M.mouse.mass_kg.toFixed(3)} kg`],
      ['검사', `${C.ok ? '통과' : '실패'} · 간섭 ${C.nominal} · 관절 스윕 ${C.sweepJoints}개 중 충돌 ${C.sweepClashes}`],
    ];
    if (P) rows.push(['3D 출력', `조각 ${P.pieces}개 · PLA ${(P.grams / 1000).toFixed(2)} kg · 약 ${Math.round(P.hours)} 시간 · 필라멘트 약 ${Math.round(P.costKrw / 1000)}천 원`],
                     ['분할 이음', `${P.joints}곳 (인서트 보스 + 연결판) · 구매 목록 ${P.bomLines}줄`]);
    $('#cad-kv').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const dir = d.files.step.replace(/\/pastella84\.step$/, '');
    const files = [['STEP', d.files.step], ['URDF', d.files.urdf], ['USDA', d.files.usda], ['GLB', d.files.glb], ['report', dir + '/report.json']];
    if (P) files.push(['출력 계획', dir + '/print-plan.md'], ['BOM', dir + '/bom.csv'], ['플레이트 DXF', dir + '/fab/kb_plate.dxf'], ['출력 STL', dir + '/print/']);
    files.push(['C# 검증', 'cad/out/validation.md']);
    $('#cad-files').innerHTML = files.map(([n, f]) => `<a class="btn" href="${f}"${f.endsWith('/') ? ' target="_blank"' : ' download'}>${n}</a>`).join('');
    PX.emit('cad');
  }

  $('#cad-mode').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    cad.mode = b.dataset.m; U.store.set('cad-mode', cad.mode);
    if (cad.mode !== 'web') load(cad.mode);
    render();
  });
  PX.on('viewer-ready', () => { if (cad.mode !== 'web') load(cad.mode); });
  PX.on('palette', setPalette);
  PX.on('finish', r => Object.values(cad.v).forEach(s => PAL_MATS.forEach(n => { if (s.mats[n]) s.mats[n].roughness = r; })));
  PX.on('monitor-built', () => Object.values(cad.v).forEach(screen));
  render();
})(window.PX);
