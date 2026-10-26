//! Mesh interference (overlap volume) and joint-range sweeps.

use crate::mesh::*;
use crate::model::{Joint, Model};
use rayon::prelude::*;
use std::collections::{BTreeSet, HashMap};

/// A closed mesh with an acceleration grid for +X ray parity tests.
pub struct Body {
    pub mesh: Mesh,
    pub bb: Aabb,
    bins: Vec<Vec<u32>>,
    n: usize,
}

impl Body {
    pub fn new(mesh: Mesh) -> Body {
        let bb = mesh.aabb();
        let n = 48;
        let mut bins = vec![Vec::new(); n * n];
        let s = bb.size();
        for i in 0..mesh.t.len() {
            let t = mesh.tri(i);
            let (mut lo, mut hi) = ([f64::MAX; 2], [f64::MIN; 2]);
            for p in t { for k in 0..2 { lo[k] = lo[k].min(p[k + 1]); hi[k] = hi[k].max(p[k + 1]); } }
            let c = |v: f64, k: usize| (((v - bb.lo[k + 1]) / s[k + 1].max(1e-9)) * n as f64).floor().clamp(0.0, n as f64 - 1.0) as usize;
            for a in c(lo[0], 0)..=c(hi[0], 0) { for b in c(lo[1], 1)..=c(hi[1], 1) { bins[a * n + b].push(i as u32); } }
        }
        Body { mesh, bb, bins, n }
    }

    /// Ray parity along +X.
    pub fn contains(&self, p: V3) -> bool {
        if (0..3).any(|k| p[k] < self.bb.lo[k] || p[k] > self.bb.hi[k]) { return false; }
        let s = self.bb.size();
        let a = (((p[1] - self.bb.lo[1]) / s[1].max(1e-9)) * self.n as f64).floor().clamp(0.0, self.n as f64 - 1.0) as usize;
        let b = (((p[2] - self.bb.lo[2]) / s[2].max(1e-9)) * self.n as f64).floor().clamp(0.0, self.n as f64 - 1.0) as usize;
        let mut hits = 0;
        for &i in &self.bins[a * self.n + b] {
            let [t0, t1, t2] = self.mesh.tri(i as usize);
            // barycentric in the YZ projection
            let d = (t1[1] - t0[1]) * (t2[2] - t0[2]) - (t2[1] - t0[1]) * (t1[2] - t0[2]);
            if d.abs() < 1e-14 { continue; }
            let l1 = ((p[1] - t0[1]) * (t2[2] - t0[2]) - (t2[1] - t0[1]) * (p[2] - t0[2])) / d;
            let l2 = ((t1[1] - t0[1]) * (p[2] - t0[2]) - (p[1] - t0[1]) * (t1[2] - t0[2])) / d;
            if l1 < 0.0 || l2 < 0.0 || l1 + l2 > 1.0 { continue; }
            let x = t0[0] + l1 * (t1[0] - t0[0]) + l2 * (t2[0] - t0[0]);
            if x > p[0] { hits += 1; }
        }
        hits % 2 == 1
    }
}

fn tri_bb(t: &[V3; 3]) -> Aabb { let mut b = Aabb::empty(); for p in t { b.grow(*p); } b }

/// True when two triangles penetrate (touching contact is not penetration).
fn tri_tri(a: &[V3; 3], b: &[V3; 3]) -> bool {
    let ea = [sub(a[1], a[0]), sub(a[2], a[1]), sub(a[0], a[2])];
    let eb = [sub(b[1], b[0]), sub(b[2], b[1]), sub(b[0], b[2])];
    let mut axes = vec![cross(ea[0], ea[1]), cross(eb[0], eb[1])];
    for x in &ea { for y in &eb { axes.push(cross(*x, *y)); } }
    for l in axes {
        let ln = norm(l);
        if ln < 1e-12 { continue; }
        let pa = a.map(|p| dot(p, l));
        let pb = b.map(|p| dot(p, l));
        let (a0, a1) = (pa.iter().cloned().fold(f64::MAX, f64::min), pa.iter().cloned().fold(f64::MIN, f64::max));
        let (b0, b1) = (pb.iter().cloned().fold(f64::MAX, f64::min), pb.iter().cloned().fold(f64::MIN, f64::max));
        let e = 2e-4 * ln;
        if a1 <= b0 + e || b1 <= a0 + e { return false; }
    }
    true
}

/// Estimated overlap volume (mm^3) of two closed bodies.
pub fn overlap(a: &Body, b: &Body) -> f64 {
    if !a.bb.overlaps(&b.bb, 0.01) { return 0.0; }
    let ob = a.bb.inter(&b.bb);
    let near = |m: &Mesh| -> Vec<usize> { (0..m.t.len()).filter(|&i| tri_bb(&m.tri(i)).overlaps(&ob, -1e-6)).collect() };
    let (ta, tb) = (near(&a.mesh), near(&b.mesh));
    // uniform grid over the overlap box for b's triangles
    let s = ob.size();
    let n = 24usize;
    let cell = |v: f64, k: usize| (((v - ob.lo[k]) / s[k].max(1e-9)) * n as f64).floor().clamp(0.0, n as f64 - 1.0) as usize;
    let mut grid: HashMap<(usize, usize, usize), Vec<usize>> = HashMap::new();
    for &j in &tb {
        let bb = tri_bb(&b.mesh.tri(j));
        for x in cell(bb.lo[0], 0)..=cell(bb.hi[0], 0) { for y in cell(bb.lo[1], 1)..=cell(bb.hi[1], 1) { for z in cell(bb.lo[2], 2)..=cell(bb.hi[2], 2) {
            grid.entry((x, y, z)).or_default().push(j);
        } } }
    }
    let mut region = Aabb::empty();
    let mut crossing = false;
    for &i in &ta {
        let t = a.mesh.tri(i);
        let bb = tri_bb(&t);
        let mut seen = BTreeSet::new();
        for x in cell(bb.lo[0], 0)..=cell(bb.hi[0], 0) { for y in cell(bb.lo[1], 1)..=cell(bb.hi[1], 1) { for z in cell(bb.lo[2], 2)..=cell(bb.hi[2], 2) {
            if let Some(js) = grid.get(&(x, y, z)) {
                for &j in js {
                    if !seen.insert(j) { continue; }
                    let u = b.mesh.tri(j);
                    if tri_tri(&t, &u) { crossing = true; region.merge(&bb); region.merge(&tri_bb(&u)); }
                }
            }
        } } }
    }
    if !crossing {
        // no surface crossing: either disjoint or one body nested inside the other
        // probe points just inside x (centroids pushed 0.01 mm against the outward normal), majority vote
        let inside = |x: &Body, y: &Body| -> bool {
            if !(0..3).all(|k| x.bb.lo[k] >= y.bb.lo[k] - 1e-6 && x.bb.hi[k] <= y.bb.hi[k] + 1e-6) { return false; }
            let n = x.mesh.t.len();
            let probes: Vec<bool> = (0..7).map(|s| {
                let t = x.mesh.tri(s * n / 7);
                let c = scale(add(add(t[0], t[1]), t[2]), 1.0 / 3.0);
                y.contains(sub(c, scale(unit(cross(sub(t[1], t[0]), sub(t[2], t[0]))), 0.01)))
            }).collect();
            probes.iter().filter(|&&b| b).count() >= 4
        };
        if inside(a, b) { return a.mesh.mass_props(1.0).vol; }
        if inside(b, a) { return b.mesh.mass_props(1.0).vol; }
        return 0.0;
    }
    let r = region.inter(&ob);
    let rs = r.size();
    let vol = rs[0].max(1e-3) * rs[1].max(1e-3) * rs[2].max(1e-3);
    let step = (vol / 300_000.0).cbrt().max(0.05);
    let cnt = |k: usize| ((rs[k] / step).ceil() as usize).max(1);
    let (nx, ny, nz) = (cnt(0), cnt(1), cnt(2));
    let mut hits = 0usize;
    for ix in 0..nx { for iy in 0..ny { for iz in 0..nz {
        // irrational offsets keep sample rays off mesh edges
        let p = [r.lo[0] + (ix as f64 + 0.5) * rs[0] / nx as f64,
                 r.lo[1] + (iy as f64 + 0.4142135) * rs[1] / ny as f64,
                 r.lo[2] + (iz as f64 + 0.7320508) * rs[2] / nz as f64];
        if a.contains(p) && b.contains(p) { hits += 1; }
    } } }
    hits as f64 * (rs[0] / nx as f64) * (rs[1] / ny as f64) * (rs[2] / nz as f64)
}

#[derive(serde::Serialize, Clone)]
pub struct Clash { pub a: String, pub b: String, pub mm3: f64 }

#[derive(serde::Serialize)]
pub struct SweepResult { pub joint: String, pub kind: String, pub poses: Vec<f64>, pub clashes: Vec<(f64, Clash)> }

/// All part pairs at the nominal pose.
pub fn nominal(names: &[String], bodies: &[Body], threshold: f64) -> Vec<Clash> {
    let pairs: Vec<(usize, usize)> = (0..bodies.len()).flat_map(|i| (i + 1..bodies.len()).map(move |j| (i, j)))
        .filter(|&(i, j)| bodies[i].bb.overlaps(&bodies[j].bb, 0.01)).collect();
    let mut out: Vec<Clash> = pairs.par_iter().filter_map(|&(i, j)| {
        let v = overlap(&bodies[i], &bodies[j]);
        (v > threshold).then(|| Clash { a: names[i].clone(), b: names[j].clone(), mm3: (v * 10.0).round() / 10.0 })
    }).collect();
    out.sort_by(|x, y| y.mm3.partial_cmp(&x.mm3).unwrap());
    out
}

fn subtree(model: &Model, root: &str) -> BTreeSet<String> {
    let mut s = BTreeSet::from([root.to_string()]);
    loop {
        let before = s.len();
        for j in &model.joints { if s.contains(&j.parent) { s.insert(j.child.clone()); } }
        if s.len() == before { return s; }
    }
}

fn poses(j: &Joint) -> Vec<f64> {
    match j.kind {
        "revolute" => vec![j.lo, j.hi],
        "prismatic" => vec![j.hi],
        "continuous" => vec![std::f64::consts::FRAC_PI_2, std::f64::consts::PI, 1.5 * std::f64::consts::PI],
        _ => vec![],
    }
}

/// Move each joint to its limits (others nominal) and test the moving subtree against the rest.
pub fn sweeps(model: &Model, names: &[String], links: &[String], bodies: &[Body], threshold: f64) -> Vec<SweepResult> {
    let origin = |l: &str| model.links.iter().find(|x| x.name == l).unwrap().origin;
    model.joints.par_iter().filter(|j| j.kind != "fixed").map(|j| {
        let sub = subtree(model, &j.child);
        let moving: Vec<usize> = (0..bodies.len()).filter(|&i| sub.contains(&links[i])).collect();
        let fixed: Vec<usize> = (0..bodies.len()).filter(|&i| !sub.contains(&links[i])).collect();
        let o = origin(&j.child);
        let mut clashes = vec![];
        for q in poses(j) {
            let f = |p: V3| if j.kind == "prismatic" { add(p, scale(j.axis, q * 1000.0)) } else { rotate(p, o, j.axis, q) };
            for &i in &moving {
                let mb = Body::new(bodies[i].mesh.map(f));
                for &k in &fixed {
                    if !mb.bb.overlaps(&bodies[k].bb, 0.01) { continue; }
                    let v = overlap(&mb, &bodies[k]);
                    if v > threshold { clashes.push((q, Clash { a: names[i].clone(), b: names[k].clone(), mm3: (v * 10.0).round() / 10.0 })); }
                }
            }
        }
        SweepResult { joint: j.name.clone(), kind: j.kind.into(), poses: poses(j), clashes }
    }).collect()
}
