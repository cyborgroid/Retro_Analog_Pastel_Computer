/* One WebGL renderer shared by the Chassis and Assembly tabs: the canvas moves between hosts */
(function (PX) {
  'use strict';
  const { U, S } = PX;
  const V = PX.viewer = { ok: undefined, mode: 'chassis', host: null, camTween: null, sel: null, clipOn: false, night: false, wire: false };

  V.init = function () {
    if (V.ok !== undefined) return V.ok;
    if (!window.THREE || !THREE.OrbitControls) { V.ok = false; return false; }
    const r = V.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.outputEncoding = THREE.sRGBEncoding;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.localClippingEnabled = true;
    const sc = V.scene = new THREE.Scene();
    const cam = V.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120); cam.position.set(7.4, 5.2, 9.4);
    const ctl = V.controls = new THREE.OrbitControls(cam, r.domElement);
    ctl.target.set(0, 1.6, 0.3); ctl.enableDamping = true; ctl.dampingFactor = 0.08; ctl.minDistance = 2.5; ctl.maxDistance = 26; ctl.maxPolarAngle = Math.PI * 0.495; ctl.autoRotateSpeed = 1.4;
    V.hemi = new THREE.HemisphereLight(0xffffff, 0xb9aedb, 0.5); sc.add(V.hemi);
    const key = V.key = new THREE.DirectionalLight(0xfff3ea, 1.05); key.position.set(5, 10, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); key.shadow.bias = -0.0004; sc.add(key);
    V.fill = new THREE.DirectionalLight(0xdfe6ff, 0.35); V.fill.position.set(-7, 4, -3); sc.add(V.fill);
    V.rim = new THREE.DirectionalLight(0xffe0ef, 0.25); V.rim.position.set(0, 5, -9); sc.add(V.rim);
    V.glow = new THREE.PointLight(0xc9b8ff, 0, 7, 2); sc.add(V.glow);
    PX.model.build(sc);
    V.plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    V.helper = new THREE.BoxHelper(new THREE.Object3D(), 0x6449d0); V.helper.visible = false; sc.add(V.helper);

    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
    const visible = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
    r.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; r.domElement.style.cursor = 'grabbing'; });
    r.domElement.addEventListener('pointerup', e => {
      r.domElement.style.cursor = 'grab';
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const b = r.domElement.getBoundingClientRect(); ptr.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(ptr, cam);
      const hit = ray.intersectObjects(sc.children, true).find(h => h.object.userData.pick && visible(h.object) && !(V.clipOn && h.point.x > V.plane.constant));
      if (!hit) { V.helper.visible = false; V.sel = null; return; }
      V.sel = hit.object; V.helper.setFromObject(hit.object); V.helper.visible = true; PX.emit('pick', hit.object.userData.pick);
    });
    V.ro = new ResizeObserver(() => V.resize());
    PX.on('monitor-built', () => { V.refreshMaterials(); V.helper.visible = false; V.sel = null; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => PX.model.relabel());
    V.ok = true; PX.emit('viewer-ready'); return true;
  };

  V.attach = function (host, mode) {
    V.mode = mode;
    if (!V.init()) { if (!host.querySelector('.vp-fail')) host.innerHTML = '<p class="vp-fail">3D 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인한 뒤 새로고침하세요.</p>'; return false; }
    if (V.host !== host) { host.appendChild(V.renderer.domElement); V.host = host; V.ro.disconnect(); V.ro.observe(host); }
    V.resize(); return true;
  };
  V.resize = () => {
    if (!V.host) return; const w = V.host.clientWidth, h = V.host.clientHeight; if (!w || !h) return;
    V.renderer.setSize(w, h, false); V.camera.aspect = w / h; V.camera.updateProjectionMatrix();
  };
  V.tween = (p, t, dur = 0.9) => { if (!V.ok) return; V.camTween = { k: 0, dur, p0: V.camera.position.clone(), t0: V.controls.target.clone(), p1: new THREE.Vector3(...p), t1: new THREE.Vector3(...t) }; };

  V.refreshMaterials = () => {
    if (!V.ok) return;
    const planes = V.clipOn ? [V.plane] : [];
    V.scene.traverse(o => {
      if (!o.isMesh || o.userData.noClip) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if ((m.clippingPlanes || []).length !== planes.length) { m.clippingPlanes = planes; m.needsUpdate = true; }
        if (!(m.isMeshBasicMaterial && m.map) && m.wireframe !== V.wire) m.wireframe = V.wire;
      });
    });
  };
  V.setClip = (on, x) => { V.plane.constant = x; if (on !== V.clipOn) { V.clipOn = on; V.refreshMaterials(); } };
  V.setWire = on => { V.wire = on; V.refreshMaterials(); };
  V.setNight = on => { V.night = on; };

  V.render = function (dt, t) {
    if (!V.ok || !V.host) return;
    if (V.camTween) { const c = V.camTween; c.k = Math.min(1, c.k + dt / c.dur); const e = U.easeInOut(c.k); V.camera.position.lerpVectors(c.p0, c.p1, e); V.controls.target.lerpVectors(c.t0, c.t1, e); if (c.k >= 1) V.camTween = null; }
    const asm = V.mode === 'assembly';
    PX.model.apply(asm ? 0 : S.explode, asm ? PX.assembly.progress : PX.model.stepCount);
    PX.model.tick(dt, t);
    const d = PX.model.dims, lit = PX.mainsOn() && !(asm && PX.assembly.progress < PX.model.stepCount);
    V.glow.position.set(0, 1.13 + d.cy, -0.85 + 0.62 + 1.4);
    const n = V.night ? 1 : 0;
    V.hemi.intensity = U.lerp(V.hemi.intensity, 0.5 - 0.38 * n, 0.1); V.key.intensity = U.lerp(V.key.intensity, 1.05 - 0.85 * n, 0.1);
    V.fill.intensity = U.lerp(V.fill.intensity, 0.35 - 0.25 * n, 0.1); V.rim.intensity = U.lerp(V.rim.intensity, 0.25 + 0.25 * n, 0.1);
    V.glow.intensity = U.lerp(V.glow.intensity, lit ? (0.25 + 1.4 * n) * S.bright : 0, 0.15);
    if (PX.cad) PX.cad.sync(V.mode);
    if (V.sel && V.helper.visible) V.helper.setFromObject(V.sel);
    V.controls.update(); V.renderer.render(V.scene, V.camera);
  };
})(window.PX);
