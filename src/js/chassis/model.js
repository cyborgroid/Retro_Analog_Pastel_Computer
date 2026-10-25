/* The 3D computer. Every part is registered with:
   - exp:  exploded-view offset (Chassis tab)
   - step: assembly step id + 'from' offset it flies in from (Assembly tab)
   The wide monitor is parametric (diagonal, aspect, bezel) and rebuilt on change. */
(function (PX) {
  'use strict';
  const { U, S, C, DATA } = PX, TAU = U.TAU, G = PX.geo;
  const model = PX.model = { parts: [], M: {}, KEY3D: {}, groups: {}, dims: {}, stepCount: DATA.steps.length, scrTex: null };
  const stepNo = {}; DATA.steps.forEach((s, i) => stepNo[s.id] = i + 1);
  model.stepNo = stepNo;
  let scene = null;

  function reg(o, opt = {}) {
    model.parts.push({ o, base: o.position.clone(), exp: opt.exp ? new THREE.Vector3(...opt.exp) : null, step: opt.step ? stepNo[opt.step] : 0, from: new THREE.Vector3(...(opt.from || [0, 1.2, 0])), owner: opt.owner || 'main' });
    return o;
  }
  const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.02 }, o));
  function mesh(g, m, pick, cast = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; if (pick) o.userData.pick = pick; return o; }
  function label(txt, w, h, font, pick, fg = '#4a4458') {
    const tex = G.textTex(txt, 512, Math.max(32, Math.round(512 * h / w)), font, fg);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    if (pick) m.userData.pick = pick; m.userData.label = { txt, font, fg, w, h }; return m;
  }

  function materials(pal) {
    const M = model.M;
    DATA.roles.forEach(([k]) => M[k] = std(pal[k]));
    M.desk = std(pal.desk, { roughness: 0.95 }); M.dark = std('#4a4458', { roughness: 0.7 }); M.slot = std('#2a2633', { roughness: 0.8 });
    M.pcb = std('#9fdcc4', { roughness: 0.6 }); M.chip = std('#34303f', { roughness: 0.45 }); M.metal = std('#c9c3d6', { metalness: 0.6, roughness: 0.35 });
    M.steel = std('#d7d3df', { metalness: 0.5, roughness: 0.45 });
    M.glass = new THREE.MeshStandardMaterial({ color: 0x5b5577, transparent: true, opacity: 0.42, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    M.copper = std('#e9b38c', { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }); M.rubber = std('#8c84a2', { roughness: 0.9 }); M.cable = std('#cfc8de', { roughness: 0.7 });
    M.ribbon = std('#dfe1f0', { roughness: 0.6 }); M.wire = std('#f2a3bb', { roughness: 0.6 }); M.fdd = std('#9790a8'); M.cap = std('#b6a6ef');
    M.led = new THREE.MeshStandardMaterial({ color: 0x7ff0b8, emissive: 0x5fe0a0, emissiveIntensity: 1.2 });
    M.ledA = new THREE.MeshStandardMaterial({ color: 0xffd27f, emissive: 0xffb347, emissiveIntensity: 0 });
  }

  /* ---------- base unit ---------- */
  function buildBase() {
    const M = model.M, g = new THREE.Group(); g.position.set(0, 0, -0.7); scene.add(g); model.groups.base = g;
    const tray = mesh(G.rbox(4.4, 0.3, 3.4, 0.06), M.base, 'tray'); tray.position.y = 0.16; g.add(tray); reg(tray, { step: 'tray', from: [0, 1.4, 0] });
    [[-1.9, 1.4], [1.9, 1.4], [-1.9, -1.4], [1.9, -1.4]].forEach(([x, z], i) => { const f = mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 16), M.rubber, 'tray'); f.position.set(x, 0.0, z); g.add(f); reg(f, { step: 'tray', from: [0, 2.0 + i * 0.1, 0] }); });

    const SO = [[-1.75, 1.25], [0, 1.25], [1.75, 1.25], [-1.75, -1.25], [0, -1.25], [1.75, -1.25]];
    const fr = new THREE.Group(); g.add(fr);
    const plate = mesh(new THREE.BoxGeometry(4.15, 0.03, 3.15), M.steel, 'frame'); plate.position.y = 0.325; fr.add(plate);
    SO.forEach(([x, z]) => { const s = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), M.metal, 'frame'); s.position.set(x, 0.37, z); fr.add(s); });
    const lug = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.1), M.metal, 'frame'); lug.position.set(2.0, 0.38, -1.45); fr.add(lug);
    reg(fr, { step: 'frame', from: [0, 1.6, 0] });

    const mb = new THREE.Group(); g.add(mb);
    const pcb = mesh(new THREE.BoxGeometry(3.9, 0.04, 3.0), M.pcb, 'mainboard'); pcb.position.y = 0.42; mb.add(pcb);
    for (let i = 0; i < 9; i++) { const tr = mesh(new THREE.BoxGeometry(2.6, 0.002, 0.012), M.copper, 'mainboard', false); tr.position.set(-0.2, 0.441, -1.2 + i * 0.28); mb.add(tr); }
    reg(mb, { step: 'mainboard', from: [0, 1.8, 0] });
    SO.forEach(([x, z], i) => { const s = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), M.metal, 'screw'); s.position.set(x, 0.455, z); g.add(s); reg(s, { step: 'mainboard', from: [0, 1.0 + i * 0.12, 0] }); });

    const ICS = [['PX-80', 0.92, 0.3, 0.1, 0.45], ['ROM', 0.7, 0.28, 0.15, 0.95], ['VDP', 0.92, 0.3, -1.2, -0.4], ['PIO', 0.92, 0.3, 0.1, -0.15], ['PSG', 0.6, 0.28, -1.2, -1.0]];
    ICS.forEach(([n, w, d, x, z], i) => {
      const ch = mesh(new THREE.BoxGeometry(w, 0.07, d), M.chip, 'ics'); ch.position.set(x, 0.475, z);
      const lb = label(n, w * 0.7, d * 0.5, 'bold 120px "IBM Plex Mono", monospace', 'ics', '#f2eefc'); lb.rotation.x = -Math.PI / 2; lb.position.y = 0.036; ch.add(lb);
      g.add(ch); reg(ch, { step: 'ics', from: [0, 0.9 + i * 0.08, 0] });
    });
    for (let i = 0; i < 8; i++) { const r = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.42), M.chip, 'ics'); r.position.set(-0.25 + i * 0.15, 0.47, -0.95); g.add(r); reg(r, { step: 'ics', from: [0, 1.3 + i * 0.05, 0] }); }
    const xt = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 12), M.metal, 'ics'); xt.rotation.z = Math.PI / 2; xt.position.set(0.75, 0.49, 0.45); g.add(xt); reg(xt, { step: 'ics', from: [0, 1.8, 0] });

    const ps = new THREE.Group(); g.add(ps);
    const hb = mesh(new THREE.BoxGeometry(1.0, 0.1, 0.9), M.metal, 'psu'); hb.position.set(1.45, 0.49, -0.95); ps.add(hb);
    for (let i = 0; i < 7; i++) { const f = mesh(new THREE.BoxGeometry(0.035, 0.34, 0.9), M.metal, 'psu'); f.position.set(1.0 + i * 0.15, 0.71, -0.95); ps.add(f); }
    [1.1, 1.45, 1.8].forEach(x => { const rg = mesh(new THREE.BoxGeometry(0.12, 0.18, 0.05), M.chip, 'psu'); rg.position.set(x, 0.64, -0.47); ps.add(rg); });
    const core = mesh(new THREE.BoxGeometry(0.56, 0.44, 0.42), M.dark, 'psu'); core.position.set(1.45, 0.66, 0.05); ps.add(core);
    const coil = mesh(new THREE.BoxGeometry(0.6, 0.28, 0.3), M.copper, 'psu'); coil.position.set(1.45, 0.66, 0.05); ps.add(coil);
    const c1 = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.42, 20), M.cap, 'psu'); c1.position.set(0.72, 0.65, -1.22); ps.add(c1);
    reg(ps, { step: 'psu', from: [0, 1.7, 0] });

    const fd = new THREE.Group(); g.add(fd);
    const fb = mesh(new THREE.BoxGeometry(1.2, 0.3, 1.5), M.fdd, 'floppy'); fb.position.set(-1.2, 0.6, 0.85); fd.add(fb);
    const ff = mesh(new THREE.BoxGeometry(1.2, 0.3, 0.04), M.dark, 'floppy'); ff.position.set(-1.2, 0.6, 1.62); fd.add(ff);
    reg(fd, { step: 'fdd', from: [0, 0, 2.8] });

    const hn = new THREE.Group(); g.add(hn);
    const rb = mesh(new THREE.BoxGeometry(0.45, 0.012, 0.6), M.ribbon, 'harness'); rb.position.set(-0.95, 0.455, -0.2); hn.add(rb);
    const rs = mesh(new THREE.BoxGeometry(0.03, 0.014, 0.6), M.wire, 'harness'); rs.position.set(-1.16, 0.457, -0.2); hn.add(rs);
    const w1 = G.tube([[1.15, 0.62, -0.25], [0.7, 0.56, -0.25], [0.3, 0.5, -0.05], [-0.05, 0.47, 0.15]], 0.018, M.wire); w1.userData.pick = 'harness'; hn.add(w1);
    const w2 = G.tube([[1.2, 0.62, 0.3], [0.4, 0.62, 0.45], [-0.3, 0.66, 0.3], [-0.7, 0.66, 0.15]], 0.018, M.wire); w2.userData.pick = 'harness'; hn.add(w2);
    const spk = mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.08, 24), M.dark, 'harness'); spk.position.set(-1.75, 0.5, -1.05); hn.add(spk);
    reg(hn, { step: 'harness', from: [0, 1.0, 0] });

    const lid = new THREE.Group(); lid.position.set(0, 0.73, 0); g.add(lid);
    reg(lid, { step: 'lid', from: [0, 2.4, 0], exp: [0, 2.0, 0] });
    lid.add(mesh(G.rbox(4.4, 0.8, 3.4, 0.1), M.base, 'lid'));
    const fz = 1.705;
    const slot = mesh(new THREE.BoxGeometry(0.95, 0.06, 0.04), M.slot, 'floppy'); slot.position.set(-1.2, -0.13, fz); lid.add(slot);
    const ej = mesh(new THREE.BoxGeometry(0.16, 0.07, 0.04), M.trim, 'floppy'); ej.position.set(-0.52, -0.21, fz); lid.add(ej);
    const ledF = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.02), M.ledA); ledF.position.set(-1.78, -0.21, fz); lid.add(ledF);
    const brand = label('PASTELLA 84', 1.1, 0.18, '64px Righteous, sans-serif', 'lid'); brand.position.set(-1.2, 0.17, fz + 0.02); lid.add(brand);
    model.dials = [];
    [0.5, 1.0].forEach((x, i) => {
      const d = new THREE.Group(); d.position.set(x, 0, fz + 0.01);
      const body = mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.1, 32), M.trim, 'lid'); body.rotation.x = Math.PI / 2; d.add(body);
      const ind = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.02), M.dark, 'lid'); ind.position.set(0, 0.08, 0.06); d.add(ind);
      lid.add(d); model.dials.push(d);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.24, 40, 1, -Math.PI * 0.25, Math.PI * 1.5), M.dark); ring.position.set(x, 0, fz + 0.002); lid.add(ring);
      const lb = label(i ? 'TONE' : 'VOL', 0.3, 0.07, '48px "IBM Plex Mono", monospace', 'lid'); lb.position.set(x, -0.3, fz + 0.01); lid.add(lb);
    });
    const tg = mesh(new THREE.BoxGeometry(0.16, 0.24, 0.04), M.dark, 'lid'); tg.position.set(1.6, 0, fz); lid.add(tg);
    const lever = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 10), M.metal, 'lid'); lever.position.set(1.6, 0.04, fz + 0.08); lever.rotation.x = 1.1; lid.add(lever); model.lever = lever;
    const ledB = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), M.led); ledB.position.set(1.95, 0.1, fz); lid.add(ledB);
    for (let i = 0; i < 14; i++) { const v = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.9), M.slot, 'lid', false); v.position.set(0.75 + i * 0.1, 0.4, -0.9); lid.add(v); }
    for (let i = 0; i < 6; i++) { const v = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.03), M.slot, 'lid', false); v.position.set(-1.75, 0.4, -0.85 - i * 0.08); lid.add(v); }
  }

  /* ---------- parametric wide monitor ---------- */
  function buildMonitor() {
    const M = model.M;
    if (model.groups.mon) {
      scene.remove(model.groups.mon); if (model.groups.monCable) scene.remove(model.groups.monCable);
      [model.groups.mon, model.groups.monCable].forEach(r => r && r.traverse(o => { if (o.geometry) o.geometry.dispose(); }));
      model.parts = model.parts.filter(p => p.owner !== 'monitor');
      if (model.scrTex) model.scrTex.dispose();
    }
    const m = S.monitor, a = C.ASPECTS[m.aspect];
    const w = m.diag * 0.254 * a / Math.hypot(a, 1), h = w / a, bt = m.bezel / 100, gap = 0.02, chin = 0.2;
    const W = w + 2 * (bt + gap), H = h + 2 * (bt + gap) + chin;
    const standH = 0.3, y0 = standH + H / 2, cy = standH + chin + bt + gap + h / 2, zF = 0.62, bd = 0.15, sd = 0.62 + h * 0.3;
    model.dims = { w, h, W, H, D: bd + sd, standH, cy, diag: m.diag, aspect: m.aspect, bezel: m.bezel, ratio: (w * h) / (W * H) };
    const O = { owner: 'monitor' };
    const mon = new THREE.Group(); mon.position.set(0, 1.13, -0.85); scene.add(mon); model.groups.mon = mon;
    reg(mon, { ...O, exp: [0, 1.6, -0.7] });

    const neckZ = zF - bd - sd * 0.42;
    const standG = new THREE.Group(); mon.add(standG);
    const st = mesh(G.rbox(Math.min(2.4, W * 0.5), 0.1, 1.4, 0.05), M.monitor, 'stand'); st.position.set(0, 0.05, neckZ); standG.add(st);
    const nk = mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 32), M.monitor, 'stand'); nk.position.set(0, 0.2, neckZ); standG.add(nk);
    reg(standG, { ...O, step: 'stand', from: [0, 1.4, 0] });

    const front = new THREE.Group(); mon.add(front);
    const sh = G.rrectAt(new THREE.Shape(), 0, 0, W, H, Math.min(0.14, bt + 0.06));
    sh.holes.push(G.rrectAt(new THREE.Path(), 0, cy - y0, w + 2 * gap, h + 2 * gap, 0.06));
    const bg = new THREE.ExtrudeGeometry(sh, { depth: bd - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3, curveSegments: 8 });
    bg.translate(0, 0, -(bd - 0.04) / 2);
    const bez = mesh(bg, M.monitor, 'bezel'); bez.position.set(0, y0, zF - bd / 2); front.add(bez);
    model.scrTex = new THREE.CanvasTexture(PX.screen.out); model.scrTex.encoding = THREE.sRGBEncoding; model.scrTex.anisotropy = 4;
    const screen = new THREE.Mesh(G.curvedPlane(w, h, 0.05), new THREE.MeshBasicMaterial({ map: model.scrTex, toneMapped: false }));
    screen.position.set(0, cy, zF - bd + 0.03); screen.userData.pick = 'screen'; front.add(screen); model.screenMesh = screen;
    const sur = new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * gap + 0.03, h + 2 * gap + 0.03), M.slot); sur.position.set(0, cy, zF - bd + 0.012); front.add(sur);
    const ky = standH + (bt + chin) / 2 + 0.01;
    model.monKnobs = [];
    for (let i = 0; i < 3; i++) { const k = mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.06, 24), M.trim, 'bezel'); k.rotation.x = Math.PI / 2; k.position.set(W / 2 - 0.2 - i * 0.16, ky, zF + 0.02); front.add(k); model.monKnobs.push(k); }
    const ledM = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), M.led); ledM.position.set(-W / 2 + 0.16, ky, zF + 0.005); front.add(ledM);
    const br = label('PASTELLA', 0.62, 0.1, '60px Righteous, sans-serif', 'bezel'); br.position.set(0, ky, zF + 0.004); front.add(br);
    reg(front, { ...O, step: 'bezel', from: [0, 0, 1.8] });

    const prof = [[1, 0], [0.98, -0.07], [0.78, -0.28], [0.32, -0.6], [0.11, -0.74], [0.09, -0.98], [0.05, -1.03]].map(([r, z]) => new THREE.Vector2(r, z * sd));
    const tube = mesh(new THREE.LatheGeometry(prof, 48), M.glass, 'tube', false);
    tube.rotation.x = Math.PI / 2; tube.scale.set(w / 2 * 1.02, 1, h / 2 * 1.02); tube.position.set(0, cy, zF - bd + 0.005); mon.add(tube);
    reg(tube, { ...O, step: 'tube', from: [0, 0, -2.8] });

    const yk = new THREE.Group(); yk.position.set(0, cy, zF - bd - 0.66 * sd); mon.add(yk);
    const fun = mesh(new THREE.CylinderGeometry(0.4, 1, 1, 32, 1, true), M.copper, 'yoke'); fun.rotation.x = -Math.PI / 2; fun.scale.set(0.36 * w / 2, 0.14 * sd, 0.36 * h / 2); yk.add(fun);
    const ring = mesh(new THREE.TorusGeometry(1, 0.18, 10, 32), M.copper, 'yoke'); ring.scale.set(0.15 * w / 2, 0.15 * h / 2, 0.15 * w / 2); ring.position.z = -0.08 * sd; yk.add(ring);
    const nb = mesh(new THREE.BoxGeometry(0.32, 0.32, 0.03), M.pcb, 'neckboard'); nb.position.z = -0.36 * sd; yk.add(nb);
    reg(yk, { ...O, step: 'yoke', from: [0, 0, -1.8] });

    const fbG = new THREE.Group(); mon.add(fbG);
    const fbx = mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), M.dark, 'flyback'); fbx.position.set(W * 0.28, cy - h * 0.28, zF - bd - sd * 0.55); fbG.add(fbx);
    const fbc = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 16), M.chip, 'flyback'); fbc.position.set(W * 0.28, cy - h * 0.28 + 0.23, zF - bd - sd * 0.55); fbG.add(fbc);
    const hv = G.tube([[W * 0.28, cy - h * 0.28 + 0.29, zF - bd - sd * 0.55], [W * 0.3, cy + h * 0.1, zF - bd - sd * 0.45], [w * 0.28, cy + h * 0.22, zF - bd - sd * 0.2]], 0.022, M.wire); hv.userData.pick = 'flyback'; fbG.add(hv);
    const dg = mesh(new THREE.TorusGeometry(1, 0.012, 8, 72), M.copper, 'degauss'); dg.scale.set(w / 2 * 0.97, h / 2 * 0.97, 1); dg.position.set(0, cy, zF - bd - 0.06); fbG.add(dg);
    reg(fbG, { ...O, step: 'flyback', from: [0, 1.4, -0.6] });

    const shG = new THREE.BoxGeometry(W - 0.06, H - 0.06, sd); const sp = shG.attributes.position;
    for (let i = 0; i < sp.count; i++) if (sp.getZ(i) < 0) { sp.setX(i, sp.getX(i) * 0.6); sp.setY(i, sp.getY(i) * 0.6 + (cy - y0) * 0.6); }
    shG.computeVertexNormals();
    const shell = mesh(shG, M.monitor, 'shell'); shell.position.set(0, y0, zF - bd - sd / 2 + 0.02); mon.add(shell);
    for (let i = 0; i < 16; i++) { const v = mesh(new THREE.BoxGeometry((W - 0.06) * 0.44, 0.022, 0.02), M.slot, 'shell', false); v.position.set(0, (cy - y0) * 0.6 + (H - 0.06) * 0.27 - i * (H - 0.06) * 0.035, -sd / 2 - 0.005); shell.add(v); }
    const plateL = label(`PASTELLA PM-${m.diag}W\n${m.diag}" ${m.aspect} CRT · 220V 60Hz 65W`, 0.9, 0.22, '40px "IBM Plex Mono", monospace', 'shell'); plateL.rotation.y = Math.PI; plateL.position.set(0, (cy - y0) * 0.6 - (H - 0.06) * 0.24, -sd / 2 - 0.012); shell.add(plateL);
    reg(shell, { ...O, step: 'shell', from: [0, 0, -2.6], exp: [0, 0, -2.2] });

    const bz = 1.13 + y0 + (cy - y0) * 0.6 - 0.3, bzz = -0.85 + zF - bd - sd;
    const cab = G.tube([[0.25, bz, bzz], [0.4, bz - 0.4, bzz - 0.25], [0.6, 0.75, -2.3], [0.7, 0.55, -2.42]], 0.028, M.cable); cab.userData.pick = 'cable'; cab.castShadow = true;
    scene.add(cab); model.groups.monCable = cab; reg(cab, { ...O, step: 'cables', from: [0, 0.6, -0.4] });
    model.ledM = ledM;
    PX.emit('monitor-built');
  }

  /* ---------- keyboard ---------- */
  function buildKeyboard() {
    const M = model.M, kb = new THREE.Group(); kb.position.set(0, 0, 2.25); scene.add(kb);
    const ks = new THREE.Shape(); ks.moveTo(-0.85, 0); ks.lineTo(0.85, 0); ks.lineTo(0.85, 0.38); ks.lineTo(-0.85, 0.2); ks.closePath();
    const kg = new THREE.ExtrudeGeometry(ks, { depth: 4.5, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }); kg.translate(0, 0, -2.25); kg.rotateY(Math.PI / 2);
    const kc = mesh(kg, M.keyboard, 'kbcase'); kb.add(kc); reg(kc, { step: 'kbcase', from: [0, 1.3, 0] });
    const deck = new THREE.Group(); deck.position.set(0, 0.3, 0); deck.rotation.x = Math.atan2(0.18, 1.7); kb.add(deck);
    const pc = document.createElement('canvas'); pc.width = 512; pc.height = 192;
    { const x = pc.getContext('2d'); x.fillStyle = '#a7e0c8'; x.fillRect(0, 0, 512, 192); x.strokeStyle = '#e9b38c'; x.lineWidth = 2;
      for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(10, 14 + i * 23); x.lineTo(502, 14 + i * 23); x.stroke(); }
      x.strokeStyle = '#d58fa8'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(20 + i * 36, 6); x.lineTo(20 + i * 36, 186); x.stroke(); }
      x.fillStyle = '#3a3550'; for (let r = 0; r < 7; r++) for (let c = 0; c < 13; c++) x.fillRect(26 + c * 36, 18 + r * 23, 8, 3);
      x.font = '16px "IBM Plex Mono", monospace'; x.fillText('PX-KB MATRIX 8x8 · 1N4148 x49  REV.B', 150, 186); }
    const pt = new THREE.CanvasTexture(pc); pt.encoding = THREE.sRGBEncoding;
    const kp = mesh(new THREE.BoxGeometry(4.25, 0.03, 1.55), [M.pcb, M.pcb, new THREE.MeshStandardMaterial({ map: pt, roughness: 0.6 }), M.pcb, M.pcb, M.pcb], 'kbpcb'); deck.add(kp);
    reg(kp, { step: 'kbcase', from: [0, 2.0, 0] });
    const caps = new THREE.Group(); deck.add(caps); reg(caps, { exp: [0, 1.1, 0] });
    const U_ = 0.31;
    DATA.KEY_ROWS.forEach((row, r) => {
      const rowG = new THREE.Group(); caps.add(rowG);
      const widths = row.map(k => DATA.WIDE[k] || 1), tot = widths.reduce((a, b) => a + b, 0) * U_; let x = -tot / 2;
      row.forEach((k, i) => {
        const wu = widths[i] * U_, g = new THREE.Group(); g.position.set(x + wu / 2, 0.1, -0.62 + r * U_);
        g.add(mesh(G.rbox(wu - 0.05, 0.13, U_ - 0.05, 0.04), DATA.WIDE[k] ? M.keyB : M.keyA, 'keycap'));
        const t = DATA.SHORT[k] || k, big = t.length === 1;
        const lab = label(t, big ? 0.2 : Math.min(wu - 0.09, 0.26), big ? 0.2 : 0.11, (big ? '300px' : '150px') + ' "IBM Plex Mono", monospace', 'keycap');
        lab.rotation.x = -Math.PI / 2; lab.position.y = 0.068; g.add(lab);
        rowG.add(g); model.KEY3D[k] = { g, y0: 0.1 }; x += wu;
      });
      reg(rowG, { step: 'keycaps', from: [0, 0.7 + r * 0.32, 0] });
    });
  }

  /* ---------- ball mouse ---------- */
  function buildMouse() {
    const M = model.M, ms = new THREE.Group(); ms.position.set(3.35, 0, 2.35); ms.rotation.y = -0.12; scene.add(ms);
    const bp = mesh(G.rbox(0.62, 0.06, 1.0, 0.03), std('#b8afca'), 'mshell'); bp.position.y = 0.03; ms.add(bp); reg(bp, { step: 'mouse-int', from: [0, 0.9, 0] });
    const ball = mesh(new THREE.SphereGeometry(0.11, 24, 16), M.rubber, 'ball'); ball.position.set(0, 0.13, 0); ms.add(ball); reg(ball, { step: 'mouse-int', from: [0, 1.5, 0] });
    const encX = new THREE.Group(); encX.position.set(0.17, 0.13, 0); ms.add(encX); reg(encX, { step: 'mouse-int', from: [0.8, 0.6, 0] });
    const encY = new THREE.Group(); encY.position.set(0, 0.13, -0.17); ms.add(encY); reg(encY, { step: 'mouse-int', from: [0, 0.6, -0.8] });
    [encX, encY].forEach((e, i) => {
      const inner = new THREE.Group(); e.add(inner); e.userData.spin = inner;
      inner.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 10), M.metal, 'encoder'));
      const wh = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 12), M.trim, 'encoder'); wh.position.y = 0.14; inner.add(wh);
      if (i === 0) e.rotation.x = Math.PI / 2; else e.rotation.z = Math.PI / 2;
    });
    const shellG = new THREE.Group(); ms.add(shellG);
    const sh = mesh(new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI / 2), M.mouse, 'mshell'); sh.scale.set(0.31, 0.27, 0.5); sh.position.y = 0.06; shellG.add(sh);
    const seam = mesh(new THREE.BoxGeometry(0.012, 0.01, 0.26), M.dark, 'mshell', false); seam.position.set(0, 0.305, 0.25); seam.rotation.x = 0.26; shellG.add(seam);
    reg(shellG, { step: 'mouse-shell', from: [0, 1.3, 0], exp: [0, 0.9, 0] });
    model.ball = ball; model.encX = encX; model.encY = encY;
  }

  function buildCables() {
    const M = model.M;
    const mc = G.tube([[3.3, 0.05, 1.86], [3.45, 0.03, 1.35], [3.1, 0.03, 0.7], [2.6, 0.03, 0.3], [2.22, 0.2, 0.1]], 0.026, M.cable); mc.userData.pick = 'cable'; mc.castShadow = true; scene.add(mc); reg(mc, { step: 'cables', from: [0, 0.6, 0] });
    const coil = []; for (let i = 0; i <= 60; i++) { const u = i / 60; coil.push([-1.4 + Math.sin(u * TAU * 5) * 0.06, 0.08 + Math.cos(u * TAU * 5) * 0.04, 1.42 - u * 0.36]); }
    coil.push([-1.4, 0.2, 1.0]);
    const kc = G.tube(coil, 0.026, M.cable); kc.userData.pick = 'cable'; kc.castShadow = true; scene.add(kc); reg(kc, { step: 'cables', from: [0, 0.6, 0.3] });
  }

  model.build = function (sc) {
    scene = sc; model.scene = sc;
    materials(PX.palette);
    const desk = new THREE.Mesh(new THREE.CircleGeometry(12, 72), model.M.desk); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; desk.userData.noClip = true; sc.add(desk);
    buildBase(); buildKeyboard(); buildMouse(); buildCables(); buildMonitor();
    model.updateKeys();
  };
  model.rebuildMonitor = () => { if (scene) buildMonitor(); };

  model.apply = function (explode, progress) {
    for (const p of model.parts) {
      const pos = p.o.position.copy(p.base);
      if (p.exp) pos.addScaledVector(p.exp, explode);
      if (p.step) { const k = U.clamp(progress - (p.step - 1), 0, 1); p.o.visible = k > 0; if (k < 1) pos.addScaledVector(p.from, 1 - U.easeOutCubic(k)); }
    }
  };
  model.setPalette = pal => { if (!scene) return; DATA.roles.forEach(([k]) => model.M[k].color.set(pal[k])); model.M.desk.color.set(pal.desk); };
  model.setFinish = r => { if (!scene) return; DATA.roles.forEach(([k]) => { model.M[k].roughness = r; model.M[k].metalness = r < 0.3 ? 0.06 : 0.02; }); };
  model.updateKeys = () => { DATA.KEYS.forEach(k => { const o = model.KEY3D[k]; if (o) o.g.position.y = S.pressed.has(k) ? o.y0 - 0.06 : o.y0; }); };
  model.relabel = () => {
    if (!scene) return;
    scene.traverse(o => { const L = o.userData && o.userData.label; if (!L) return; const old = o.material.map; o.material.map = G.textTex(L.txt, 512, Math.max(32, Math.round(512 * L.h / L.w)), L.font, L.fg); o.material.needsUpdate = true; if (old) old.dispose(); });
  };
  model.tick = function (dt, t) {
    const m = S.mouse;
    if (model.ball) { model.ball.rotation.z -= m.vx * dt * 0.02; model.ball.rotation.x += m.vy * dt * 0.02; model.encX.userData.spin.rotation.y -= m.vx * dt * 0.03; model.encY.userData.spin.rotation.y += m.vy * dt * 0.03; }
    if (model.monKnobs) { model.monKnobs[0].rotation.y = (S.bright - 0.6) * 3; model.monKnobs[1].rotation.y = S.vHold * 0.8; model.monKnobs[2].rotation.y = (S.hSize - 0.92) * 10; }
    if (model.dials) { model.dials[0].rotation.z = 0.9 - (S.psgOn ? 1.6 : 0); model.dials[1].rotation.z = -0.3; }
    if (model.lever) model.lever.rotation.x = S.power ? 1.1 : 2.0;
    const M = model.M, on = PX.logicOn();
    M.led.emissiveIntensity = on ? (PX.P.dropout ? (Math.sin(t * TAU * 7.5) > 0 ? 1.4 : 0.1) : 1.2) : 0;
    M.led.color.set(on ? 0x7ff0b8 : (PX.mainsOn() ? 0xffb3c8 : 0x6d6680));
    M.ledA.emissiveIntensity = on && S.bootT < 3.6 && Math.floor(t * 6) % 2 ? 1.6 : 0;
    if (model.scrTex && PX.screen.dirty) { model.scrTex.needsUpdate = true; PX.screen.dirty = false; }
  };
})(window.PX);
