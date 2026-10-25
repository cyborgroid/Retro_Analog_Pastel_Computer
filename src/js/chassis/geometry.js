/* Geometry helpers for the chassis model (1 unit = 100 mm) */
(function (PX) {
  'use strict';
  const G = PX.geo = {};
  G.rrectAt = (p, cx, cy, w, h, r) => {
    const x = cx - w / 2, y = cy - h / 2;
    r = Math.max(0.002, Math.min(r, w / 2, h / 2));
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
    return p;
  };
  /* rounded box, extruded along Z, centered */
  G.rbox = (w, h, d, r = 0.06) => {
    const b = Math.min(r, w / 4, h / 4, d / 4) * 0.8, sw = w - 2 * b, sh = h - 2 * b;
    const g = new THREE.ExtrudeGeometry(G.rrectAt(new THREE.Shape(), 0, 0, sw, sh, Math.min(r, sw / 2, sh / 2) * 0.7),
      { depth: Math.max(0.002, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 5 });
    g.center(); return g;
  };
  /* gently bulged CRT face */
  G.curvedPlane = (w, h, bulge) => {
    const g = new THREE.PlaneGeometry(w, h, 28, 20), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); p.setZ(i, bulge * (1 - x * x) * (1 - y * y)); }
    g.computeVertexNormals(); return g;
  };
  G.textTex = (txt, w, h, font, fg, bg) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    String(txt).split('\n').forEach((ln, i, a) => x.fillText(ln, w / 2, h / 2 + 2 + (i - (a.length - 1) / 2) * parseInt(font, 10) * 1.1));
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  };
  G.tube = (pts, r, mat) => {
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(24, pts.length * 6), r, 8, false), mat);
  };
})(window.PX);
