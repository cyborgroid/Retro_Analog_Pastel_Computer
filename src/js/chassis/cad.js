/* CAD v3 view: the Rust build output (cad/out/web/pastella84.glb + src/js/data/cad.js) in the Chassis viewer.
   Needs HTTP (./run.sh); under file:// the web v2 model stays. */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX, { $, $$ } = U;
  const CAD = DATA.CAD, V = PX.viewer;
  const cad = PX.cad = { root: null, state: 'idle', enabled: U.store.get('cad-mode', 'cad') === 'cad', keys: [], links: {}, mats: {} };
  const KEY_ID = { '-': 'minus', '=': 'equal', '[': 'lbracket', ']': 'rbracket', ';': 'semicolon', "'": 'quote', ',': 'comma', '.': 'period', '/': 'slash' };
  const PAL_MATS = ['base', 'tray', 'monitor', 'keyboard', 'keyA', 'keyB', 'mouse', 'trim'];

  function load() {
    if (!CAD || cad.state !== 'idle') return;
    if (!window.THREE || !THREE.GLTFLoader || location.protocol === 'file:') { cad.state = 'unavailable'; render(); return; }
    cad.state = 'loading'; render();
    new THREE.GLTFLoader().load(CAD.glb, gltf => {
      const root = cad.root = gltf.scene;
      root.scale.setScalar(10);                       // glTF metres -> 1 unit = 100 mm, same axes as the workbench
      root.traverse(o => {
        if (o.isMesh) { o.castShadow = o.receiveShadow = true; cad.mats[o.material.name] = o.material; }
        else if (o.userData.link) cad.links[o.userData.link] = { o, q0: o.quaternion.clone(), p0: o.position.clone(), j: o.userData.joint };
      });
      DATA.KEYS.forEach(k => { const l = cad.links['key_' + (KEY_ID[k] || k.toLowerCase())]; if (l) cad.keys.push([k, l]); });
      V.scene.add(root); cad.state = 'ready';
      screen(); setPalette(PX.palette); V.refreshMaterials(); render();
    }, undefined, err => { cad.state = 'error'; cad.err = String((err && err.message) || err); render(); });
  }

  /* live CRT picture on the screen part (planar UVs over its front face) */
  function screen() {
    if (!cad.root || !PX.model.scrTex) return;
    const m = cad.root.getObjectByName('crt_screen'); if (!m) return;
    const g = m.geometry; g.computeBoundingBox();
    const b = g.boundingBox, p = g.attributes.position, uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { uv[2 * i] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x); uv[2 * i + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    m.material = new THREE.MeshBasicMaterial({ map: PX.model.scrTex, toneMapped: false });
  }

  function setPalette(pal) {
    if (!cad.root || !pal) return;
    PAL_MATS.forEach(n => {
      const m = cad.mats[n]; if (!m) return;
      const c = new THREE.Color(pal[n === 'tray' ? 'base' : n]);
      if (n === 'tray') c.multiplyScalar(0.88);
      m.color.copy(c.convertSRGBToLinear());
    });
  }

  function turn(name, ang) { const l = cad.links[name]; if (l && l.j) l.o.quaternion.copy(l.q0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...l.j.axis), ang)); }

  /* called by the viewer every frame: which model is shown, joint poses from the shared state */
  cad.sync = mode => {
    const on = cad.enabled && cad.state === 'ready' && mode === 'chassis';
    if (cad.root) cad.root.visible = on;
    if (PX.model.root) PX.model.root.visible = !on;
    if (!on) return;
    cad.keys.forEach(([k, l]) => l.o.position.copy(l.p0).addScaledVector(new THREE.Vector3(...l.j.axis), S.pressed.has(k) ? l.j.upper : 0));
    turn('power_toggle', S.power ? 0.35 : -0.35);
    turn('dial_vol', S.psgOn ? -0.7 : 0.9);
    turn('knob_bright', (S.bright - 0.6) * 3); turn('knob_vhold', S.vHold * 0.8); turn('knob_hsize', (S.hSize - 0.92) * 10);
  };

  function render() {
    $$('#cad-mode button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.m === 'cad') === cad.enabled));
    if (!CAD) { $('#cad-kv').innerHTML = '<dt>상태</dt><dd>src/js/data/cad.js 없음 — ./cad/build.sh 실행</dd>'; return; }
    const st = { idle: '대기', loading: 'GLB 불러오는 중…', ready: '표시 중', unavailable: 'file:// 에서는 불가 — ./run.sh 로 열기', error: '불러오기 실패: ' + (cad.err || '') }[cad.state];
    const M = CAD.modules, mm = b => b.bbox_mm.map(Math.round).join(' × '), C = CAD.checks;
    $('#cad-kv').innerHTML = [
      ['상태', st],
      ['구성', `부품 ${CAD.counts.parts} · 링크 ${CAD.counts.links} · 관절 ${CAD.counts.joints} (가동 ${CAD.counts.movable_joints})`],
      ['본체', `${mm(M.base_unit)} mm · ${M.base_unit.mass_kg.toFixed(2)} kg`],
      ['모니터', `${mm(M.monitor)} mm · ${M.monitor.mass_kg.toFixed(2)} kg`],
      ['키보드', `${mm(M.keyboard)} mm · ${M.keyboard.mass_kg.toFixed(2)} kg`],
      ['마우스', `${mm(M.mouse)} mm · ${M.mouse.mass_kg.toFixed(3)} kg`],
      ['검사', `${C.ok ? '통과' : '실패'} · 간섭 ${C.nominal} · 관절 스윕 ${C.sweepJoints}개 중 충돌 ${C.sweepClashes}`],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#cad-files').innerHTML = [['STEP', CAD.files.step], ['URDF', CAD.files.urdf], ['USDA', CAD.files.usda], ['GLB', CAD.files.glb], ['report', 'cad/out/report.json'], ['C# 검증', 'cad/out/validation.md']]
      .map(([n, f]) => `<a class="btn" href="${f}" download>${n}</a>`).join('');
    PX.emit('cad');
  }

  $('#cad-mode').addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    cad.enabled = b.dataset.m === 'cad'; U.store.set('cad-mode', b.dataset.m); render();
  });
  PX.on('viewer-ready', load);
  PX.on('palette', setPalette);
  PX.on('finish', r => PAL_MATS.forEach(n => { if (cad.mats[n]) cad.mats[n].roughness = r; }));
  PX.on('monitor-built', screen);
  render();
})(window.PX);
