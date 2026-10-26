//! B-rep construction on top of truck without boolean operations.
//!
//! Every body is assembled face by face from wires that share their edges, then the faces are
//! oriented consistently (BFS over shared edges) and closed into a solid. Holes are inner wires of
//! planar faces joined to their counterparts by ruled "tube" faces, so housings with vents,
//! stepped bezels and hollow keycaps come out as single watertight solids.

use std::collections::HashMap;
use truck_meshalgo::{analyzers::*, filters::*, tessellation::*};
use truck_modeling::*;

pub use truck_modeling::{Matrix4, Point3, Rad, Solid, Vector3};

/// A closed wire plus a polygon sampling of it (same order), used for planes and winding.
#[derive(Clone)]
pub struct Loop {
    pub wire: Wire,
    pub pts: Vec<Point3>,
}

impl Loop {
    pub fn map(&self, m: Matrix4) -> Loop {
        Loop { wire: builder::transformed(&self.wire, m), pts: self.pts.iter().map(|p| m.transform_point(*p)).collect() }
    }
}

fn arc_mid(c: Point3, r: f64, a0: f64, a1: f64) -> Point3 {
    let a = 0.5 * (a0 + a1);
    Point3::new(c.x + r * a.cos(), c.y + r * a.sin(), c.z)
}

/// Rounded rectangle (8 edges: 4 lines + 4 quarter arcs), counter-clockwise seen from +Z.
/// Edge 0 is the -Y side, 2 the +X side, 4 the +Y side, 6 the -X side.
pub fn rrect(cx: f64, cy: f64, w: f64, h: f64, r: f64, z: f64) -> Loop {
    let r = r.min(w / 2.0 - 1e-3).min(h / 2.0 - 1e-3).max(0.05);
    let (x0, x1, y0, y1) = (cx - w / 2.0, cx + w / 2.0, cy - h / 2.0, cy + h / 2.0);
    let p = |x: f64, y: f64| Point3::new(x, y, z);
    let pts = [p(x0 + r, y0), p(x1 - r, y0), p(x1, y0 + r), p(x1, y1 - r), p(x1 - r, y1), p(x0 + r, y1), p(x0, y1 - r), p(x0, y0 + r)];
    let centers = [p(x1 - r, y0 + r), p(x1 - r, y1 - r), p(x0 + r, y1 - r), p(x0 + r, y0 + r)];
    let angles = [(-0.5, 0.0), (0.0, 0.5), (0.5, 1.0), (1.0, 1.5)];
    let v: Vec<Vertex> = pts.iter().map(|q| builder::vertex(*q)).collect();
    let mut wire = Wire::new();
    let mut samp = Vec::new();
    for i in 0..4 {
        let (a0, a1) = (angles[i].0 * std::f64::consts::PI, angles[i].1 * std::f64::consts::PI);
        let mid = arc_mid(centers[i], r, a0, a1);
        wire.push_back(builder::line(&v[2 * i], &v[2 * i + 1]));
        wire.push_back(builder::circle_arc(&v[2 * i + 1], &v[(2 * i + 2) % 8], mid));
        samp.extend([pts[2 * i], pts[2 * i + 1], mid]);
    }
    Loop { wire, pts: samp }
}

/// Plain rectangle (4 lines), counter-clockwise.
pub fn rect(cx: f64, cy: f64, w: f64, h: f64, z: f64) -> Loop {
    poly(&[(cx - w / 2.0, cy - h / 2.0), (cx + w / 2.0, cy - h / 2.0), (cx + w / 2.0, cy + h / 2.0), (cx - w / 2.0, cy + h / 2.0)], z)
}

/// Circle made of `n` arcs (n = 8 lines up with `rrect` for lofts), counter-clockwise.
pub fn circle(cx: f64, cy: f64, r: f64, z: f64, n: usize) -> Loop {
    let tau = std::f64::consts::TAU;
    let start = -std::f64::consts::FRAC_PI_2 - std::f64::consts::PI / n as f64;
    let at = |a: f64| Point3::new(cx + r * a.cos(), cy + r * a.sin(), z);
    let v: Vec<Vertex> = (0..n).map(|i| builder::vertex(at(start + tau * i as f64 / n as f64))).collect();
    let mut wire = Wire::new();
    let mut samp = Vec::new();
    for i in 0..n {
        let a0 = start + tau * i as f64 / n as f64;
        let a1 = a0 + tau / n as f64;
        let mid = at(0.5 * (a0 + a1));
        wire.push_back(builder::circle_arc(&v[i], &v[(i + 1) % n], mid));
        samp.extend([at(a0), mid]);
    }
    Loop { wire, pts: samp }
}

/// Closed polygon through 2-D points (in order) at height z.
pub fn poly(pts: &[(f64, f64)], z: f64) -> Loop {
    let p: Vec<Point3> = pts.iter().map(|(x, y)| Point3::new(*x, *y, z)).collect();
    let v: Vec<Vertex> = p.iter().map(|q| builder::vertex(*q)).collect();
    let wire: Wire = (0..v.len()).map(|i| builder::line(&v[i], &v[(i + 1) % v.len()])).collect();
    Loop { wire, pts: p }
}

/// Closed path of lines and arcs at height z: each item is (start point, Some(arc mid) | None),
/// the edge runs to the next item's start.
pub fn path(items: &[((f64, f64), Option<(f64, f64)>)], z: f64) -> Loop {
    let p3 = |q: (f64, f64)| Point3::new(q.0, q.1, z);
    let v: Vec<Vertex> = items.iter().map(|it| builder::vertex(p3(it.0))).collect();
    let mut wire = Wire::new();
    let mut samp = Vec::new();
    for i in 0..items.len() {
        let j = (i + 1) % items.len();
        samp.push(p3(items[i].0));
        match items[i].1 {
            Some(mid) => { wire.push_back(builder::circle_arc(&v[i], &v[j], p3(mid))); samp.push(p3(mid)); }
            None => wire.push_back(builder::line(&v[i], &v[j])),
        }
    }
    Loop { wire, pts: samp }
}

fn newell(pts: &[Point3]) -> Vector3 {
    let mut n = Vector3::new(0.0, 0.0, 0.0);
    for i in 0..pts.len() {
        let (a, b) = (pts[i], pts[(i + 1) % pts.len()]);
        n.x += (a.y - b.y) * (a.z + b.z);
        n.y += (a.z - b.z) * (a.x + b.x);
        n.z += (a.x - b.x) * (a.y + b.y);
    }
    n
}

fn wire_pts(w: &Wire) -> Vec<Point3> { w.vertex_iter().map(|v| v.point()).collect() }

/// Planar face bounded by `outer` with `holes`; hole winding is corrected automatically.
pub fn planar_face(outer: &Wire, outer_pts: &[Point3], holes: &[&Loop]) -> Face {
    let n = newell(outer_pts).normalize();
    let e = if n.x.abs() < 0.6 { Vector3::unit_x() } else { Vector3::unit_y() };
    let u = n.cross(e).normalize();
    let v = n.cross(u);
    let o = outer_pts[0];
    let mut wires = vec![outer.clone()];
    for h in holes {
        wires.push(if newell(&h.pts).dot(n) > 0.0 { h.wire.inverse() } else { h.wire.clone() });
    }
    Face::try_new(wires, Surface::Plane(Plane::new(o, o + u, o + v))).expect("planar face")
}

pub fn plane_of(l: &Loop, holes: &[&Loop]) -> Face { planar_face(&l.wire, &l.pts, holes) }

/// Ruled faces between two loops with the same edge count (shared edges with both loops).
pub fn ruled(a: &Loop, b: &Loop) -> Vec<Face> {
    builder::try_wire_homotopy(&a.wire, &b.wire).expect("homotopy").face_iter().cloned().collect()
}

/// Orient faces consistently over shared edges, close them into a solid with positive volume.
pub fn close(mut faces: Vec<Face>, what: &str) -> Solid {
    let mut uses: HashMap<_, Vec<(usize, _)>> = HashMap::new();
    for (fi, f) in faces.iter().enumerate() {
        for w in f.boundaries() {
            for e in w.edge_iter() {
                uses.entry(e.id()).or_default().push((fi, e.front().id()));
            }
        }
    }
    let open = uses.values().filter(|u| u.len() != 2).count();
    assert!(open == 0, "{what}: {open} edges are not shared by exactly two faces");
    let mut adj: Vec<Vec<(usize, bool)>> = vec![Vec::new(); faces.len()];
    for u in uses.values() {
        let same = u[0].1 == u[1].1;
        adj[u[0].0].push((u[1].0, same));
        adj[u[1].0].push((u[0].0, same));
    }
    let mut flip: Vec<Option<bool>> = vec![None; faces.len()];
    for s in 0..faces.len() {
        if flip[s].is_some() { continue; }
        flip[s] = Some(false);
        let mut stack = vec![s];
        while let Some(f) = stack.pop() {
            for &(g, same) in &adj[f] {
                let want = flip[f].unwrap() ^ same;
                match flip[g] {
                    None => { flip[g] = Some(want); stack.push(g); }
                    Some(x) => assert!(x == want, "{what}: faces cannot be oriented consistently"),
                }
            }
        }
    }
    for (f, fl) in faces.iter_mut().zip(&flip) {
        if fl.unwrap() { f.invert(); }
    }
    let shell: Shell = faces.into_iter().collect();
    assert!(shell.shell_condition() == ShellCondition::Closed, "{what}: shell is not closed");
    let mut solid = Solid::new(vec![shell]);
    if signed_volume(&solid) < 0.0 { solid.not(); }
    solid
}

pub fn signed_volume(s: &Solid) -> f64 {
    let mut m = s.triangulation(1.0).to_polygon();
    m.put_together_same_attrs(1e-6);
    m.volume()
}

pub fn fix_sign(mut s: Solid) -> Solid {
    if signed_volume(&s) < 0.0 { s.not(); }
    s
}

/// Planar profile with holes extruded along `dir`.
pub fn prism(outer: &Loop, holes: &[Loop], dir: Vector3) -> Solid {
    let hs: Vec<&Loop> = holes.iter().collect();
    fix_sign(builder::tsweep(&plane_of(outer, &hs), dir))
}

pub fn map(s: &Solid, m: Matrix4) -> Solid { builder::transformed(s, m) }
pub fn tr(x: f64, y: f64, z: f64) -> Matrix4 { Matrix4::from_translation(Vector3::new(x, y, z)) }
pub fn rx(deg: f64) -> Matrix4 { Matrix4::from_angle_x(Rad(deg.to_radians())) }
pub fn ry(deg: f64) -> Matrix4 { Matrix4::from_angle_y(Rad(deg.to_radians())) }
pub fn rz(deg: f64) -> Matrix4 { Matrix4::from_angle_z(Rad(deg.to_radians())) }

/// Axis-aligned box centred at c.
pub fn bx(w: f64, d: f64, h: f64, c: [f64; 3]) -> Solid {
    map(&prism(&rect(0.0, 0.0, w, d, -h / 2.0), &[], Vector3::new(0.0, 0.0, h)), tr(c[0], c[1], c[2]))
}

/// Box with rounded vertical edges, centred at c.
pub fn rbx(w: f64, d: f64, h: f64, r: f64, c: [f64; 3]) -> Solid {
    map(&prism(&rrect(0.0, 0.0, w, d, r, -h / 2.0), &[], Vector3::new(0.0, 0.0, h)), tr(c[0], c[1], c[2]))
}

/// Solid of stacked coaxial cylinders along local +Z: segments (radius, z0, z1), contiguous.
pub fn turned(seg: &[(f64, f64, f64)]) -> Solid {
    let lo: Vec<Loop> = seg.iter().map(|s| circle(0.0, 0.0, s.0, s.1, 8)).collect();
    let hi: Vec<Loop> = seg.iter().map(|s| circle(0.0, 0.0, s.0, s.2, 8)).collect();
    let mut f = vec![plane_of(&lo[0], &[])];
    for k in 0..seg.len() {
        f.extend(ruled(&lo[k], &hi[k]));
        if k + 1 < seg.len() {
            f.push(if seg[k].0 > seg[k + 1].0 { plane_of(&hi[k], &[&lo[k + 1]]) } else { plane_of(&lo[k + 1], &[&hi[k]]) });
        }
    }
    f.push(plane_of(hi.last().unwrap(), &[]));
    close(f, "turned")
}

/// `turned` placed with its local +Z along a world axis ('X' | 'Y' | 'Z') at `at`.
pub fn turned_on(axis: char, seg: &[(f64, f64, f64)], at: [f64; 3]) -> Solid {
    let rot = match axis { 'X' => ry(90.0), 'Y' => rx(-90.0), _ => Matrix4::from_scale(1.0) };
    map(&turned(seg), tr(at[0], at[1], at[2]) * rot)
}

/// Annulus extruded along local +Z (rings, yokes).
pub fn ring(ro: f64, ri: f64, z0: f64, z1: f64) -> Solid {
    prism(&circle(0.0, 0.0, ro, z0, 8), &[circle(0.0, 0.0, ri, z0, 8)], Vector3::new(0.0, 0.0, z1 - z0))
}

/// Rounded-rectangle ring in local XY extruded along +Z.
pub fn rring(wo: f64, ho: f64, ro: f64, wi: f64, hi: f64, ri: f64, z0: f64, z1: f64) -> Solid {
    prism(&rrect(0.0, 0.0, wo, ho, ro, z0), &[rrect(0.0, 0.0, wi, hi, ri, z0)], Vector3::new(0.0, 0.0, z1 - z0))
}

/// Sphere of radius r centred at c.
pub fn sphere(r: f64, c: [f64; 3]) -> Solid {
    let v = builder::vertex(Point3::new(0.0, 0.0, r));
    let w: Wire = builder::rsweep(&v, Point3::origin(), Vector3::unit_x(), Rad(std::f64::consts::PI));
    let shell = builder::cone(&w, Vector3::unit_z(), Rad(std::f64::consts::TAU));
    map(&fix_sign(Solid::new(vec![shell])), tr(c[0], c[1], c[2]))
}

/// Capped loft through sections with equal edge counts.
pub fn loft(sections: &[Loop]) -> Solid {
    let mut f = vec![plane_of(&sections[0], &[])];
    for k in 0..sections.len() - 1 { f.extend(ruled(&sections[k], &sections[k + 1])); }
    f.push(plane_of(sections.last().unwrap(), &[]));
    close(f, "loft")
}

/// Hole through a wall: the same profile on the outer and inner face of the wall.
pub struct Hole { pub outer: Loop, pub inner: Loop }

/// Housing open at the bottom (z = 0), vertical walls, top plane z = top0 + slope * (y - y_front).
/// Footprint: rounded rectangle centred (cx, cy). Holes: top (plan profiles at z = 0, projected),
/// and per wall [front -Y, right +X, back +Y, left -X] profiles in (u, z) with u = x or y.
pub struct Cup {
    pub cx: f64, pub cy: f64, pub w: f64, pub d: f64, pub r: f64, pub t: f64,
    pub top0: f64, pub slope: f64,
    pub top_holes: Vec<Loop>,
    pub wall_holes: [Vec<(f64, f64, Shape2)>; 4],
}

/// 2-D profile for wall holes.
#[derive(Clone, Copy)]
pub enum Shape2 { Circle(f64), RRect(f64, f64, f64) }

impl Cup {
    fn shear(&self, dz: f64) -> Matrix4 {
        // z' = z + top0 + dz + slope * (y - y_front)
        let yf = self.cy - self.d / 2.0;
        let mut m = Matrix4::from_scale(1.0);
        m.z.y = 0.0;
        m.y.z = self.slope;
        m.w.z = self.top0 + dz - self.slope * yf;
        m
    }

    pub fn build(&self, what: &str) -> Solid {
        let (t, cosa) = (self.t, 1.0 / (1.0 + self.slope * self.slope).sqrt());
        let ob = rrect(self.cx, self.cy, self.w, self.d, self.r, 0.0);
        let ib = rrect(self.cx, self.cy, self.w - 2.0 * t, self.d - 2.0 * t, self.r - t, 0.0);
        let ot = rrect(self.cx, self.cy, self.w, self.d, self.r, 0.0).map(self.shear(0.0));
        let it = rrect(self.cx, self.cy, self.w - 2.0 * t, self.d - 2.0 * t, self.r - t, 0.0).map(self.shear(-t / cosa));
        let top: Vec<Hole> = self.top_holes.iter().map(|h| Hole { outer: h.map(self.shear(0.0)), inner: h.map(self.shear(-t / cosa)) }).collect();
        // wall planes: (normal axis, outer coord, inner coord); profiles mapped from (u, z)
        let yf = self.cy - self.d / 2.0;
        let yb = self.cy + self.d / 2.0;
        let xl = self.cx - self.w / 2.0;
        let xr = self.cx + self.w / 2.0;
        let place = |wall: usize, u: f64, z: f64, s: Shape2, off: f64| -> Loop {
            let l = match s { Shape2::Circle(r) => circle(0.0, 0.0, r, 0.0, 8), Shape2::RRect(w, h, r) => rrect(0.0, 0.0, w, h, r, 0.0) };
            // local XY profile -> wall plane
            let m = match wall {
                0 => tr(u, yf + off, z) * rx(90.0),
                1 => tr(xr - off, u, z) * rz(90.0) * rx(90.0),
                2 => tr(u, yb - off, z) * rx(90.0),
                _ => tr(xl + off, u, z) * rz(90.0) * rx(90.0),
            };
            l.map(m)
        };
        let mut walls: [Vec<Hole>; 4] = Default::default();
        for k in 0..4 {
            for &(u, z, s) in &self.wall_holes[k] { walls[k].push(Hole { outer: place(k, u, z, s, 0.0), inner: place(k, u, z, s, t) }); }
        }
        let mut faces = Vec::new();
        let side = |a: &Loop, b: &Loop, inner: bool, faces: &mut Vec<Face>| {
            for (i, f) in ruled(a, b).into_iter().enumerate() {
                let k = match i { 0 => Some(0), 2 => Some(1), 4 => Some(2), 6 => Some(3), _ => None };
                match k {
                    Some(k) if !walls[k].is_empty() => {
                        let bw = f.boundaries()[0].clone();
                        let hs: Vec<&Loop> = walls[k].iter().map(|h| if inner { &h.inner } else { &h.outer }).collect();
                        faces.push(planar_face(&bw, &wire_pts(&bw), &hs));
                    }
                    _ => faces.push(f),
                }
            }
        };
        side(&ob, &ot, false, &mut faces);
        side(&ib, &it, true, &mut faces);
        faces.push(plane_of(&ob, &[&ib]));
        faces.push(plane_of(&ot, &top.iter().map(|h| &h.outer).collect::<Vec<_>>()));
        faces.push(plane_of(&it, &top.iter().map(|h| &h.inner).collect::<Vec<_>>()));
        for h in top.iter().chain(walls.iter().flatten()) { faces.extend(ruled(&h.outer, &h.inner)); }
        close(faces, what)
    }
}

/// Open-front tapered shell along local -Z: front loop at z = 0, back loop at z = -len (closed),
/// wall t; `back_holes` are plan profiles (local XY) cut through the back plate.
pub fn tapered_shell(front: (f64, f64, f64), back: (f64, f64, f64), cy_back: f64, len: f64, t: f64, back_holes: &[Loop]) -> Solid {
    let of = rrect(0.0, 0.0, front.0, front.1, front.2, 0.0);
    let ifr = rrect(0.0, 0.0, front.0 - 2.0 * t, front.1 - 2.0 * t, front.2 - t, 0.0);
    let ob = rrect(0.0, cy_back, back.0, back.1, back.2, -len);
    let ib = rrect(0.0, cy_back, back.0 - 2.0 * t, back.1 - 2.0 * t, back.2 - t, -len + t);
    let holes: Vec<Hole> = back_holes.iter().map(|h| Hole { outer: h.map(tr(0.0, 0.0, -len)), inner: h.map(tr(0.0, 0.0, -len + t)) }).collect();
    let mut f = vec![plane_of(&of, &[&ifr])];
    f.extend(ruled(&of, &ob));
    f.extend(ruled(&ifr, &ib));
    f.push(plane_of(&ob, &holes.iter().map(|h| &h.outer).collect::<Vec<_>>()));
    f.push(plane_of(&ib, &holes.iter().map(|h| &h.inner).collect::<Vec<_>>()));
    for h in &holes { f.extend(ruled(&h.outer, &h.inner)); }
    close(f, "tapered shell")
}

/// Bezel: outer frame, stepped recess and through opening, front at z = 0, back at z = -depth.
/// Rects are (cx, cy, w, h, r) in local XY; `holes` go straight through the frame.
pub fn stepped_ring(outer: (f64, f64, f64, f64, f64), step: (f64, f64, f64, f64, f64), step_depth: f64,
                    opening: (f64, f64, f64, f64, f64), depth: f64, holes: &[Loop]) -> Solid {
    let rr = |q: (f64, f64, f64, f64, f64), z: f64| rrect(q.0, q.1, q.2, q.3, q.4, z);
    let (of, ob) = (rr(outer, 0.0), rr(outer, -depth));
    let (sf, sb) = (rr(step, 0.0), rr(step, -step_depth));
    let (o6, o15) = (rr(opening, -step_depth), rr(opening, -depth));
    let hs: Vec<Hole> = holes.iter().map(|h| Hole { outer: h.clone(), inner: h.map(tr(0.0, 0.0, -depth)) }).collect();
    let mut f = vec![plane_of(&of, &[&[&sf][..], &hs.iter().map(|h| &h.outer).collect::<Vec<_>>()[..]].concat())];
    f.extend(ruled(&of, &ob));
    f.push(plane_of(&ob, &[&[&o15][..], &hs.iter().map(|h| &h.inner).collect::<Vec<_>>()[..]].concat()));
    f.extend(ruled(&sf, &sb));
    f.push(plane_of(&sb, &[&o6]));
    f.extend(ruled(&o6, &o15));
    for h in &hs { f.extend(ruled(&h.outer, &h.inner)); }
    close(f, "bezel")
}

/// Hollow keycap (OEM-like frustum, 1.2 mm wall) with a cross-stem socket; skirt at z = 0.
pub fn keycap(bw: f64, bd: f64, height: f64) -> Solid {
    let (wall, top_t) = (1.2, 1.2);
    let ob = rrect(0.0, 0.0, bw, bd, 1.0, 0.0);
    let ot = rrect(0.0, 0.8, bw - 5.3, bd - 4.5, 2.0, height);
    let ib = rrect(0.0, 0.0, bw - 2.0 * wall, bd - 2.0 * wall, 0.5, 0.0);
    let it = rrect(0.0, 0.7, bw - 5.3 - 2.2, bd - 4.5 - 2.2, 1.0, height - top_t);
    let (zt, zb) = (height - top_t, 3.5);
    let (so_t, so_b) = (circle(0.0, 0.0, 2.8, zt, 8), circle(0.0, 0.0, 2.8, zb, 8));
    let (si_b, si_t) = (circle(0.0, 0.0, 2.1, zb, 8), circle(0.0, 0.0, 2.1, zt, 8));
    let mut f = ruled(&ob, &ot);
    f.push(plane_of(&ot, &[]));
    f.push(plane_of(&ob, &[&ib]));
    f.extend(ruled(&ib, &it));
    f.push(plane_of(&it, &[&so_t]));
    f.extend(ruled(&so_t, &so_b));
    f.push(plane_of(&so_b, &[&si_b]));
    f.extend(ruled(&si_b, &si_t));
    f.push(plane_of(&si_t, &[]));
    close(f, "keycap")
}

/// MX-style switch housing: 14 mm block below the plate (z -5..0), tapered top housing (0..6)
/// with a blind stem bore (r 2.1, 5 mm deep). The stem itself moves with the keycap.
pub fn mx_switch() -> Solid {
    let (b0, b1) = (rrect(0.0, 0.0, 14.0, 14.0, 0.5, -5.0), rrect(0.0, 0.0, 14.0, 14.0, 0.5, 0.0));
    let (h0, h1) = (rrect(0.0, 0.0, 15.6, 15.6, 1.0, 0.0), rrect(0.0, 0.0, 10.5, 10.5, 1.0, 6.0));
    let (s0, s1) = (circle(0.0, 0.0, 2.1, 6.0, 8), circle(0.0, 0.0, 2.1, 1.0, 8));
    let mut f = vec![plane_of(&b0, &[])];
    f.extend(ruled(&b0, &b1));
    f.push(plane_of(&h0, &[&b1]));
    f.extend(ruled(&h0, &h1));
    f.push(plane_of(&h1, &[&s0]));
    f.extend(ruled(&s0, &s1));
    f.push(plane_of(&s1, &[]));
    close(f, "switch")
}

/// Triangle mesh of a solid (positions in mm), welded.
pub fn tessellate(s: &Solid, tol: f64) -> (Vec<[f64; 3]>, Vec<[u32; 3]>, bool) {
    let mut m = s.triangulation(tol).to_polygon();
    m.put_together_same_attrs(1e-7).remove_degenerate_faces().remove_unused_attrs();
    let closed = m.shell_condition() == ShellCondition::Closed;
    let pos: Vec<[f64; 3]> = m.positions().iter().map(|p| [p.x, p.y, p.z]).collect();
    let tris = m.faces().triangle_iter().map(|t| [t[0].pos as u32, t[1].pos as u32, t[2].pos as u32]).collect();
    (pos, tris, closed)
}
