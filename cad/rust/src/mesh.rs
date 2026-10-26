//! Triangle meshes: welding, transforms, exact polyhedral mass properties.

pub type V3 = [f64; 3];

pub fn add(a: V3, b: V3) -> V3 { [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
pub fn sub(a: V3, b: V3) -> V3 { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
pub fn scale(a: V3, k: f64) -> V3 { [a[0] * k, a[1] * k, a[2] * k] }
pub fn dot(a: V3, b: V3) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
pub fn cross(a: V3, b: V3) -> V3 { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
pub fn norm(a: V3) -> f64 { dot(a, a).sqrt() }
pub fn unit(a: V3) -> V3 { let n = norm(a); if n > 0.0 { scale(a, 1.0 / n) } else { a } }

/// Rotation of p about the axis (origin o, unit direction k) by angle a (Rodrigues).
pub fn rotate(p: V3, o: V3, k: V3, a: f64) -> V3 {
    let v = sub(p, o);
    let (c, s) = (a.cos(), a.sin());
    add(o, add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1.0 - c))))
}

#[derive(Clone, Default)]
pub struct Mesh {
    pub p: Vec<V3>,
    pub t: Vec<[u32; 3]>,
}

#[derive(Clone, Copy, Debug)]
pub struct Aabb { pub lo: V3, pub hi: V3 }

impl Aabb {
    pub fn empty() -> Aabb { Aabb { lo: [f64::MAX; 3], hi: [f64::MIN; 3] } }
    pub fn grow(&mut self, p: V3) { for i in 0..3 { self.lo[i] = self.lo[i].min(p[i]); self.hi[i] = self.hi[i].max(p[i]); } }
    pub fn merge(&mut self, o: &Aabb) { self.grow(o.lo); self.grow(o.hi); }
    pub fn overlaps(&self, o: &Aabb, tol: f64) -> bool { (0..3).all(|i| self.lo[i] < o.hi[i] - tol && o.lo[i] < self.hi[i] - tol) }
    pub fn inter(&self, o: &Aabb) -> Aabb { Aabb { lo: [0, 1, 2].map(|i| self.lo[i].max(o.lo[i])), hi: [0, 1, 2].map(|i| self.hi[i].min(o.hi[i])) } }
    pub fn size(&self) -> V3 { sub(self.hi, self.lo) }
    pub fn center(&self) -> V3 { scale(add(self.lo, self.hi), 0.5) }
}

/// Mass properties: mass (kg), centre of mass, inertia tensor about the centre (kg mm^2).
#[derive(Clone, Copy, Debug)]
pub struct MassProps { pub vol: f64, pub mass: f64, pub com: V3, pub inertia: [[f64; 3]; 3] }

impl Mesh {
    pub fn append(&mut self, o: &Mesh) {
        let base = self.p.len() as u32;
        self.p.extend_from_slice(&o.p);
        self.t.extend(o.t.iter().map(|t| [t[0] + base, t[1] + base, t[2] + base]));
    }
    pub fn map(&self, f: impl Fn(V3) -> V3) -> Mesh { Mesh { p: self.p.iter().map(|q| f(*q)).collect(), t: self.t.clone() } }
    pub fn aabb(&self) -> Aabb { let mut b = Aabb::empty(); for q in &self.p { b.grow(*q); } b }
    pub fn tri(&self, i: usize) -> [V3; 3] { let t = self.t[i]; [self.p[t[0] as usize], self.p[t[1] as usize], self.p[t[2] as usize]] }

    /// Volume integrals over the closed surface (signed tetrahedra from the origin).
    pub fn mass_props(&self, density: f64) -> MassProps {
        let (mut vol, mut m1, mut c) = (0.0, [0.0; 3], [[0.0; 3]; 3]);
        for i in 0..self.t.len() {
            let [a, b, d] = self.tri(i);
            let det = dot(a, cross(b, d));
            vol += det / 6.0;
            let s = add(add(a, b), d);
            m1 = add(m1, scale(s, det / 24.0));
            for r in 0..3 { for k in 0..3 { c[r][k] += det / 120.0 * (a[r] * a[k] + b[r] * b[k] + d[r] * d[k] + s[r] * s[k]); } }
        }
        let com = if vol.abs() > 0.0 { scale(m1, 1.0 / vol) } else { [0.0; 3] };
        for r in 0..3 { for k in 0..3 { c[r][k] -= vol * com[r] * com[k]; } }
        let tr = c[0][0] + c[1][1] + c[2][2];
        let mut inertia = [[0.0; 3]; 3];
        for r in 0..3 { for k in 0..3 { inertia[r][k] = density * ((if r == k { tr } else { 0.0 }) - c[r][k]); } }
        MassProps { vol, mass: vol * density, com, inertia }
    }
}

/// Combine mass properties (parallel-axis theorem).
pub fn combine(items: &[MassProps]) -> MassProps {
    let mass: f64 = items.iter().map(|m| m.mass).sum();
    let vol: f64 = items.iter().map(|m| m.vol).sum();
    let com = if mass > 0.0 { scale(items.iter().fold([0.0; 3], |acc, m| add(acc, scale(m.com, m.mass))), 1.0 / mass) } else { [0.0; 3] };
    let mut inertia = [[0.0; 3]; 3];
    for m in items {
        let d = sub(m.com, com);
        let dd = dot(d, d);
        for r in 0..3 { for k in 0..3 { inertia[r][k] += m.inertia[r][k] + m.mass * ((if r == k { dd } else { 0.0 }) - d[r] * d[k]); } }
    }
    MassProps { vol, mass, com, inertia }
}

/// Eigen-decomposition of a symmetric 3x3 matrix (Jacobi). Returns (values, column vectors).
pub fn eig_sym(a: [[f64; 3]; 3]) -> (V3, [[f64; 3]; 3]) {
    let mut a = a;
    let mut v = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
    for _ in 0..60 {
        let (mut p, mut q, mut big) = (0, 1, 0.0);
        for i in 0..3 { for j in i + 1..3 { if a[i][j].abs() > big { big = a[i][j].abs(); p = i; q = j; } } }
        if big < 1e-15 * (a[0][0].abs() + a[1][1].abs() + a[2][2].abs() + 1e-300) { break; }
        let th = 0.5 * (2.0 * a[p][q]).atan2(a[q][q] - a[p][p]);
        let (c, s) = (th.cos(), th.sin());
        for k in 0..3 {
            let (akp, akq) = (a[k][p], a[k][q]);
            a[k][p] = c * akp - s * akq;
            a[k][q] = s * akp + c * akq;
        }
        for k in 0..3 {
            let (apk, aqk) = (a[p][k], a[q][k]);
            a[p][k] = c * apk - s * aqk;
            a[q][k] = s * apk + c * aqk;
        }
        for k in 0..3 {
            let (vkp, vkq) = (v[k][p], v[k][q]);
            v[k][p] = c * vkp - s * vkq;
            v[k][q] = s * vkp + c * vkq;
        }
    }
    ([a[0][0], a[1][1], a[2][2]], v)
}

/// Quaternion (w, x, y, z) of a proper rotation matrix given by columns.
pub fn quat_of(m: [[f64; 3]; 3]) -> [f64; 4] {
    let mut m = m;
    let det = dot([m[0][0], m[1][0], m[2][0]], cross([m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]));
    if det < 0.0 { for r in 0..3 { m[r][0] = -m[r][0]; } }
    let t = m[0][0] + m[1][1] + m[2][2];
    let q = if t > 0.0 {
        let s = (t + 1.0).sqrt() * 2.0;
        [0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s]
    } else if m[0][0] > m[1][1] && m[0][0] > m[2][2] {
        let s = (1.0 + m[0][0] - m[1][1] - m[2][2]).sqrt() * 2.0;
        [(m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s]
    } else if m[1][1] > m[2][2] {
        let s = (1.0 + m[1][1] - m[0][0] - m[2][2]).sqrt() * 2.0;
        [(m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s]
    } else {
        let s = (1.0 + m[2][2] - m[0][0] - m[1][1]).sqrt() * 2.0;
        [(m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s]
    };
    let n = (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).sqrt();
    q.map(|x| x / n)
}

/// Shortest-arc quaternion (w, x, y, z) rotating unit vector a onto unit vector b.
pub fn quat_from_to(a: V3, b: V3) -> [f64; 4] {
    let (a, b) = (unit(a), unit(b));
    let d = dot(a, b);
    if d < -0.999999 {
        let mut ax = cross(a, [0.0, 0.0, 1.0]);
        if norm(ax) < 0.1 { ax = cross(a, [1.0, 0.0, 0.0]); }
        let ax = unit(ax);
        return [0.0, ax[0], ax[1], ax[2]];
    }
    let c = cross(a, b);
    let q = [1.0 + d, c[0], c[1], c[2]];
    let n = (q.iter().map(|x| x * x).sum::<f64>()).sqrt();
    q.map(|x| x / n)
}
