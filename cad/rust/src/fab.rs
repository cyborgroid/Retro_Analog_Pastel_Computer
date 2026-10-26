//! FDM printing plan for the build variant.
//!
//! Printed groups (`Src::Print` + `Src::Fuse` parts) are united with mesh booleans (boolmesh), cut by
//! `Src::Cut` parts, turned into their print orientation and split into pieces that fit the printer
//! bed. Every split seam gets joints placed automatically on the inside surface: a pair of M3 insert
//! bosses straddling the seam and a printed splice plate screwed across them. Each piece is written
//! as an STL already lying on the bed, with size, support area, filament and time estimates.

use crate::check::{overlap, Body};
use crate::geom::*;
use crate::mesh::*;
use crate::model::{Model, Src};
use crate::spec::Spec;
use boolmesh::prelude::*;
use rayon::prelude::*;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::Path;

/// rotation as rows: print = R * world
type R3 = [[f64; 3]; 3];
const I3: R3 = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
fn rot_x(deg: f64) -> R3 { let (c, s) = (deg.to_radians().cos(), deg.to_radians().sin()); [[1.0, 0.0, 0.0], [0.0, c, -s], [0.0, s, c]] }
fn rot_y(deg: f64) -> R3 { let (c, s) = (deg.to_radians().cos(), deg.to_radians().sin()); [[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]] }
fn apply(r: &R3, p: V3) -> V3 { [dot(r[0], p), dot(r[1], p), dot(r[2], p)] }
fn apply_t(r: &R3, p: V3) -> V3 { [r[0][0] * p[0] + r[1][0] * p[1] + r[2][0] * p[2], r[0][1] * p[0] + r[1][1] * p[1] + r[2][1] * p[2], r[0][2] * p[0] + r[1][2] * p[1] + r[2][2] * p[2]] }

#[derive(Clone, Copy)]
enum Hint { Center, Dir(V3), NoJoints }
#[derive(Clone, Copy)]
enum Kind { Housing(Hint), Items }

fn rules(s: &Spec) -> Vec<(&'static str, R3, Kind, &'static str)> {
    let th = (s.keyboard.h_rear - s.keyboard.h_front).atan2(s.keyboard.D).to_degrees();
    vec![
        ("tray", I3, Kind::Housing(Hint::Center), "본체 하부 트레이 (바닥면이 베드)"),
        ("lid", rot_x(180.0), Kind::Housing(Hint::Center), "본체 상판 (윗면이 베드)"),
        ("bezel", rot_x(90.0), Kind::Housing(Hint::Dir([0.0, 1.0, 0.0])), "모니터 베젤 (앞면이 베드)"),
        ("shell", rot_x(90.0), Kind::Housing(Hint::Center), "모니터 후면 셸 (앞 테두리가 베드)"),
        ("cover", rot_x(-90.0), Kind::Housing(Hint::Dir([0.0, -1.0, 0.0])), "모니터 뒤 덮개 (바깥면이 베드)"),
        ("kbcase", rot_x(180.0 - th), Kind::Housing(Hint::Center), "키보드 케이스 (경사 윗면이 베드)"),
        ("kbbottom", I3, Kind::Housing(Hint::Dir([0.0, 0.0, 1.0])), "키보드 하판"),
        ("stand_base", I3, Kind::Housing(Hint::NoJoints), "모니터 스탠드 받침"),
        ("stand_swivel", I3, Kind::Housing(Hint::NoJoints), "틸트 크래들 (평평한 바닥이 베드)"),
        ("mbase", I3, Kind::Housing(Hint::NoJoints), "마우스 바닥판 + 스위치 기둥"),
        ("mbody", rot_x(180.0), Kind::Housing(Hint::NoJoints), "마우스 몸체 (윗면이 베드)"),
        ("mbutton", I3, Kind::Housing(Hint::NoJoints), "마우스 버튼"),
        ("trim", rot_x(90.0), Kind::Items, "배지 · 스트라이프 · 소형 트림"),
        ("handle", I3, Kind::Items, "모니터 손잡이 (나사 고정)"),
        ("stand_neck", I3, Kind::Items, "스위블 목 (베어링 ↔ 크래들)"),
        ("knobs", rot_x(90.0), Kind::Items, "다이얼 · 노브 (앞면이 베드)"),
        ("clips", rot_x(-90.0), Kind::Items, "LCD 패널 클립 (립이 베드)"),
        ("kbfeet", I3, Kind::Items, "키보드 접이식 다리"),
        ("splices", I3, Kind::Items, "분할 이음 연결판"),
    ]
}

// ------------------------------------------------------------------ mesh booleans
fn to_bm(m: &Mesh) -> Result<Manifold, String> {
    let pos: Vec<f64> = m.p.iter().flat_map(|p| p.iter().copied()).collect();
    let idx: Vec<usize> = m.t.iter().flat_map(|t| t.iter().map(|&i| i as usize)).collect();
    Manifold::new(&pos, &idx)
}
fn from_bm(m: &Manifold) -> Mesh {
    let p: Vec<V3> = m.ps.iter().map(|v| [v.x, v.y, v.z]).collect();
    let tails: Vec<u32> = m.hs.iter().map(|h| h.tail as u32).collect();
    Mesh { p, t: tails.chunks(3).map(|c| [c[0], c[1], c[2]]).collect() }
}
fn boolean(a: &Mesh, b: &Mesh, op: OpType) -> Result<Mesh, String> {
    if a.t.is_empty() { return Ok(if matches!(op, OpType::Add) { b.clone() } else { a.clone() }); }
    let (ma, mb) = (to_bm(a)?, to_bm(b)?);
    compute_boolean(&ma, &mb, op).map(|r| from_bm(&r))
}
fn volume(m: &Mesh) -> f64 { m.mass_props(1.0).vol }

/// Axis-aligned box in the print frame, returned in world coordinates.
fn box_world(r: &R3, lo: V3, hi: V3) -> Mesh {
    let c = |i: usize| -> V3 { [if i & 1 == 1 { hi[0] } else { lo[0] }, if i & 2 == 2 { hi[1] } else { lo[1] }, if i & 4 == 4 { hi[2] } else { lo[2] }] };
    let f = [[0, 2, 1], [1, 2, 3], [4, 5, 6], [5, 7, 6], [0, 1, 4], [1, 5, 4], [2, 6, 3], [3, 6, 7], [0, 4, 2], [2, 4, 6], [1, 3, 5], [3, 7, 5]];
    Mesh { p: (0..8).map(|i| apply_t(r, c(i))).collect(), t: f.iter().map(|t| [t[0], t[1], t[2]]).collect() }
}

fn solid_mesh(s: &Solid, tol: f64) -> Mesh { let (p, t, _) = tessellate(s, tol); Mesh { p, t } }

// ------------------------------------------------------------------ report types
#[derive(Serialize, Clone)]
pub struct Piece {
    pub file: String, pub group: String, pub label: String, pub size_mm: [f64; 3], pub fits: bool, pub fits_alt: bool,
    pub volume_cm3: f64, pub grams: f64, pub hours: f64, pub support_cm2: f64,
}
#[derive(Serialize, Default)]
pub struct Plan {
    pub printer: String, pub bed_mm: [f64; 3], pub pieces: Vec<Piece>, pub seams: Vec<SeamOut>, pub errors: Vec<String>,
    pub total_grams: f64, pub total_hours: f64, pub filament_cost_krw: f64,
}
#[derive(Serialize, Clone)]
pub struct SeamOut { pub group: String, pub plane_normal: V3, pub offset_mm: f64, pub joints: usize }

/// Place seam joints for every printed housing that does not fit the bed. Adds bosses (Fuse) and
/// splice plates (Print "splices") to the model; returns (group, plane normal, offset) seams.
pub fn add_seam_joints(model: &mut Model, s: &Spec, tol: f64) -> Vec<SeamOut> {
    let bed = s.build.printer.bed;
    let usable = [bed[0] - 2.0 * s.build.printer.margin, bed[1] - 2.0 * s.build.printer.margin];
    let ins = &s.build.insert;
    // bodies of every physical part (for clearance tests)
    let metas: Vec<(String, Option<String>, bool)> = model.parts.iter().map(|p| (p.name.clone(), p.src.group().map(String::from), matches!(p.src, Src::Cut(_)))).collect();
    let bodies: Vec<Option<Body>> = model.parts.par_iter().map(|p| {
        if matches!(p.src, Src::Cut(_)) { return None; }
        let mut m = Mesh::default();
        for so in &p.solids { m.append(&solid_mesh(so, 0.5)); }
        Some(Body::new(m))
    }).collect();
    let mut seams = vec![];
    let mut new_parts = vec![];
    let mut placed: Vec<Body> = vec![];
    for (g, r, kind, _) in rules(s) {
        let Kind::Housing(hint) = kind else { continue };
        let members: Vec<usize> = (0..model.parts.len()).filter(|&i| matches!(&model.parts[i].src, Src::Print(x) | Src::Fuse(x) if x == g)).collect();
        if members.is_empty() { continue; }
        let mut gm = Mesh::default();
        for &i in &members { for so in &model.parts[i].solids { gm = boolean(&gm, &solid_mesh(so, tol), OpType::Add).unwrap_or(gm); } }
        let pr = gm.map(|p| apply(&r, p));
        let bb = pr.aabb();
        let sz = bb.size();
        let n = [(sz[0] / usable[0]).ceil().max(1.0) as usize, (sz[1] / usable[1]).ceil().max(1.0) as usize];
        let mut planes = vec![];
        for ax in 0..2 { for k in 1..n[ax] {
            let mut e = [0.0; 3]; e[ax] = 1.0;
            planes.push((apply_t(&r, e), bb.lo[ax] + sz[ax] * k as f64 / n[ax] as f64));
        } }
        if planes.is_empty() { continue; }
        let gbody = Body::new(gm.clone());
        let gcenter = gm.aabb().center();
        let link = model.parts[members[0]].link.clone();
        let mat = model.parts[members[0]].mat.clone();
        for (pi, (u, d)) in planes.iter().enumerate() {
            let mut chosen: Vec<V3> = vec![];
            if let Hint::NoJoints = hint { seams.push(SeamOut { group: g.into(), plane_normal: *u, offset_mm: *d, joints: 0 }); continue; }
            // candidate points: samples along the plane / mesh intersection on suitable inside faces
            let mut cand: Vec<(f64, V3, V3)> = vec![];
            let pc = scale(*u, *d);
            let (e1, e2) = { let a = if u[0].abs() < 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] }; let e1 = unit(cross(*u, a)); (e1, cross(*u, e1)) };
            for ti in 0..gm.t.len() {
                let t = gm.tri(ti);
                let sd = t.map(|p| dot(p, *u) - d);
                if !(sd.iter().any(|&x| x > 0.0) && sd.iter().any(|&x| x < 0.0)) { continue; }
                let nrm = unit(cross(sub(t[1], t[0]), sub(t[2], t[0])));
                if dot(nrm, *u).abs() > 0.35 { continue; }
                let ok = match hint { Hint::Center => dot(nrm, sub(gcenter, t[0])) > 0.0, Hint::Dir(v) => dot(nrm, v) > 0.9, Hint::NoJoints => false };
                if !ok { continue; }
                let mut pts = vec![];
                for k in 0..3 { let (a, b) = (k, (k + 1) % 3); if (sd[a] > 0.0) != (sd[b] > 0.0) { let f = sd[a] / (sd[a] - sd[b]); pts.push(add(t[a], scale(sub(t[b], t[a]), f))); } }
                if pts.len() != 2 { continue; }
                let len = norm(sub(pts[1], pts[0]));
                let steps = (len / 8.0).ceil().max(1.0) as usize;
                for k in 0..steps {
                    let q = add(pts[0], scale(sub(pts[1], pts[0]), (k as f64 + 0.5) / steps as f64));
                    let rel = sub(q, pc);
                    cand.push((dot(rel, e2).atan2(dot(rel, e1)), q, nrm));
                }
            }
            cand.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
            let mut k_joint = 0;
            for (_, q, nrm) in cand {
                if chosen.iter().any(|c| norm(sub(*c, q)) < s.build.joint_spacing) { continue; }
                if planes.iter().enumerate().any(|(pj, (u2, d2))| pj != pi && (dot(q, *u2) - d2).abs() < 25.0) { continue; }
                let ut = unit(sub(*u, scale(nrm, dot(*u, nrm))));
                let centers = [add(q, scale(ut, 13.0)), add(q, scale(ut, -13.0))];
                // solid wall under both bosses
                let vt = cross(nrm, ut);
                let under_ok = centers.iter().all(|c| (0..9).all(|k| {
                    let a = k as f64 * std::f64::consts::TAU / 8.0;
                    let off = if k == 8 { [0.0; 3] } else { add(scale(ut, 5.5 * a.cos()), scale(vt, 5.5 * a.sin())) };
                    gbody.contains(sub(add(*c, off), scale(nrm, 0.8)))
                }));
                if !under_ok { continue; }
                // geometry of this joint
                let boss_len = 8.0;
                let mk_boss = |c: V3| map(&boss(ins.boss_d / 2.0, ins.hole_d / 2.0, boss_len + 1.0, ins.depth), frame(sub(c, nrm), nrm, ut));
                let plate = map(&prism(&rect(0.0, 0.0, 38.0, 9.0, 0.0), &[circle(13.0, 0.0, s.build.screw_clear_d / 2.0, 0.0, 8), circle(-13.0, 0.0, s.build.screw_clear_d / 2.0, 0.0, 8)], Vector3::new(0.0, 0.0, 3.0)),
                                frame(add(q, scale(nrm, boss_len)), nrm, ut));
                let free = |c: V3| map(&turned(&[(ins.boss_d / 2.0, 0.6, boss_len)]), frame(c, nrm, ut));   // boss above the surface
                let test: Vec<Body> = vec![Body::new(solid_mesh(&free(centers[0]), 0.5)), Body::new(solid_mesh(&free(centers[1]), 0.5)), Body::new(solid_mesh(&plate, 0.5))];
                if test.iter().any(|t| overlap(t, &gbody) > 0.05) { continue; }
                let clash = test.iter().any(|t| bodies.iter().enumerate().any(|(bi, b)| {
                    let Some(b) = b else { return false };
                    if metas[bi].1.as_deref() == Some(g) || metas[bi].2 { return false; }
                    t.bb.overlaps(&b.bb, 0.0) && overlap(t, b) > 0.05
                }));
                if clash || test.iter().any(|t| placed.iter().any(|b| t.bb.overlaps(&b.bb, 0.0) && overlap(t, b) > 0.05)) { continue; }
                placed.extend(test);
                chosen.push(q);
                let base = format!("seam_{g}_{pi}_{k_joint}");
                new_parts.push((format!("{base}_boss_a"), link.clone(), mat.clone(), vec![mk_boss(centers[0])], Src::Fuse(g.into())));
                new_parts.push((format!("{base}_boss_b"), link.clone(), mat.clone(), vec![mk_boss(centers[1])], Src::Fuse(g.into())));
                new_parts.push((format!("{base}_plate"), link.clone(), mat.clone(), vec![plate], Src::Print("splices".into())));
                k_joint += 1;
            }
            seams.push(SeamOut { group: g.into(), plane_normal: *u, offset_mm: *d, joints: k_joint });
        }
    }
    let joints: usize = seams.iter().map(|s| s.joints).sum();
    for (name, link, mat, solids, src) in new_parts { model.add_src(&name, &link, &mat, "frame", solids, None, src); }
    model.hw("M3 열압입 인서트 (OD 4.6 × L 5.7)", 2 * joints);
    model.hw("M3 × 8 볼트 (분할 이음 연결판)", 2 * joints);
    seams
}

/// Unite, cut, orient, split and write every printed group. STLs go to `dir`.
pub fn print_plan(model: &Model, s: &Spec, seams: Vec<SeamOut>, tol: f64, dir: &Path) -> Plan {
    let b = &s.build;
    let bed = b.printer.bed;
    let usable = [bed[0] - 2.0 * b.printer.margin, bed[1] - 2.0 * b.printer.margin];
    let alt = b.printer_alt.bed;
    let alt_use = [alt[0] - 2.0 * b.printer_alt.margin, alt[1] - 2.0 * b.printer_alt.margin, alt[2]];
    std::fs::create_dir_all(dir).unwrap();
    for e in std::fs::read_dir(dir).unwrap().flatten() { if e.path().extension().map(|x| x == "stl").unwrap_or(false) { let _ = std::fs::remove_file(e.path()); } }
    let mut plan = Plan { printer: b.printer.name.clone(), bed_mm: bed, seams, ..Default::default() };
    let jobs: Vec<(String, R3, Kind, String, Vec<usize>, Vec<usize>)> = rules(s).into_iter().map(|(g, r, k, label)| {
        let members: Vec<usize> = (0..model.parts.len()).filter(|&i| matches!(&model.parts[i].src, Src::Print(x) | Src::Fuse(x) if x == g)).collect();
        let cuts: Vec<usize> = (0..model.parts.len()).filter(|&i| matches!(&model.parts[i].src, Src::Cut(x) if x == g)).collect();
        (g.to_string(), r, k, label.to_string(), members, cuts)
    }).filter(|j| !j.4.is_empty()).collect();
    let results: Vec<(Vec<Piece>, Vec<String>)> = jobs.par_iter().map(|(g, r, kind, label, members, cuts)| {
        let mut pieces = vec![];
        let mut errors = vec![];
        let emit = |m: &Mesh, name: String, rr: &R3| -> (Piece, Option<String>) {
            let pm = m.map(|p| apply(rr, p));
            let bb = pm.aabb();
            let c = bb.center();
            let placed = pm.map(|p| [p[0] - c[0], p[1] - c[1], p[2] - bb.lo[2]]);
            let sz = bb.size();
            let mut support = 0.0;
            for i in 0..placed.t.len() {
                let t = placed.tri(i);
                let n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
                let a = norm(n) / 2.0;
                if a > 0.0 && n[2] / (2.0 * a) < -0.707 && t.iter().map(|p| p[2]).fold(f64::MAX, f64::min) > 0.4 { support += a; }
            }
            let vol = volume(&placed);
            let fits = sz[0] <= usable[0] + 1e-6 && sz[1] <= usable[1] + 1e-6 && sz[2] <= bed[2];
            let fits_alt = (sz[0] <= alt_use[0] && sz[1] <= alt_use[1] || sz[1] <= alt_use[0] && sz[0] <= alt_use[1]) && sz[2] <= alt_use[2];
            let err = (!fits).then(|| format!("{name}: {:.0} × {:.0} × {:.0} mm does not fit the bed", sz[0], sz[1], sz[2]));
            crate::export::stl(&dir.join(format!("{name}.stl")), &placed, 1.0).unwrap();
            let grams = vol / 1000.0 * b.filament.density_g_cm3;
            (Piece { file: format!("{name}.stl"), group: g.clone(), label: label.clone(), size_mm: sz.map(|x| (x * 10.0).round() / 10.0),
                     fits, fits_alt, volume_cm3: (vol / 100.0).round() / 10.0, grams: (grams * 10.0).round() / 10.0,
                     hours: (vol / b.filament.flow_mm3_s / 3600.0 * 100.0).round() / 100.0, support_cm2: (support / 10.0).round() / 10.0 }, err)
        };
        match kind {
            Kind::Items => {
                // every part is its own print; pick the flattest axis-aligned orientation (preferred one first)
                for &i in members {
                    let mut m = Mesh::default();
                    for so in &model.parts[i].solids { m = boolean(&m, &solid_mesh(so, tol), OpType::Add).unwrap_or(m); }
                    let cands = [*r, I3, rot_x(90.0), rot_x(-90.0), rot_x(180.0), rot_y(90.0), rot_y(-90.0)];
                    let h = |rr: &R3| m.map(|p| apply(rr, p)).aabb().size()[2];
                    let hmin = cands.iter().map(h).fold(f64::MAX, f64::min);
                    let best = cands.iter().find(|rr| h(rr) <= hmin + 0.5).unwrap();
                    let (p, e) = emit(&m, format!("{g}__{}", model.parts[i].name), best);
                    pieces.push(p); errors.extend(e);
                }
            }
            Kind::Housing(_) => {
                let mut gm = Mesh::default();
                for &i in members { for so in &model.parts[i].solids {
                    match boolean(&gm, &solid_mesh(so, tol), OpType::Add) { Ok(x) => gm = x, Err(e) => errors.push(format!("{g}: union with {} failed: {e}", model.parts[i].name)) }
                } }
                for &i in cuts { for so in &model.parts[i].solids {
                    match boolean(&gm, &solid_mesh(so, tol), OpType::Subtract) { Ok(x) => gm = x, Err(e) => errors.push(format!("{g}: cut {} failed: {e}", model.parts[i].name)) }
                } }
                let pr = gm.map(|p| apply(r, p));
                let bb = pr.aabb();
                let sz = bb.size();
                let n = [(sz[0] / usable[0]).ceil().max(1.0) as usize, (sz[1] / usable[1]).ceil().max(1.0) as usize];
                let total = volume(&gm);
                let mut sum = 0.0;
                for ix in 0..n[0] { for iy in 0..n[1] {
                    let lo = [bb.lo[0] + sz[0] * ix as f64 / n[0] as f64 - if ix == 0 { 5.0 } else { 0.0 }, bb.lo[1] + sz[1] * iy as f64 / n[1] as f64 - if iy == 0 { 5.0 } else { 0.0 }, bb.lo[2] - 5.0];
                    let hi = [bb.lo[0] + sz[0] * (ix + 1) as f64 / n[0] as f64 + if ix + 1 == n[0] { 5.0 } else { 0.0 }, bb.lo[1] + sz[1] * (iy + 1) as f64 / n[1] as f64 + if iy + 1 == n[1] { 5.0 } else { 0.0 }, bb.hi[2] + 5.0];
                    let piece = if n == [1, 1] { gm.clone() } else {
                        match boolean(&gm, &box_world(r, lo, hi), OpType::Intersect) { Ok(x) => x, Err(e) => { errors.push(format!("{g}: split failed: {e}")); continue } }
                    };
                    sum += volume(&piece);
                    let name = if n == [1, 1] { g.clone() } else { format!("{g}_{}{}", (b'a' + ix as u8) as char, iy + 1) };
                    let (p, e) = emit(&piece, name, r);
                    pieces.push(p); errors.extend(e);
                } }
                if (sum - total).abs() > 1e-3 * total { errors.push(format!("{g}: pieces hold {sum:.0} of {total:.0} mm3")); }
            }
        }
        (pieces, errors)
    }).collect();
    for (p, e) in results { plan.pieces.extend(p); plan.errors.extend(e); }
    plan.pieces.sort_by(|a, b| a.file.cmp(&b.file));
    plan.total_grams = (plan.pieces.iter().map(|p| p.grams).sum::<f64>()).round();
    plan.total_hours = (plan.pieces.iter().map(|p| p.hours).sum::<f64>() * 10.0).round() / 10.0;
    plan.filament_cost_krw = (plan.total_grams / 1000.0 * b.filament.price_krw_per_kg / 100.0).round() * 100.0;
    plan
}

/// Bill of materials: bought parts (counted per part), hardware, printed pieces.
pub fn bom(model: &Model) -> Vec<(String, String, usize)> {
    let mut buy: BTreeMap<String, usize> = BTreeMap::new();
    for p in &model.parts {
        if let Src::Buy(item) = &p.src {
            if p.name.ends_with("_stem") || p.name == "crt_screen" { continue; }   // same purchase as the switch / panel
            let e = buy.entry(item.clone()).or_default();
            if item.contains("실장 부품") || item.contains("PCB") || item.contains("플레이트") { *e = 1; } else { *e += 1; }
        }
    }
    let mut out: Vec<(String, String, usize)> = buy.into_iter().map(|(k, v)| ("구매 부품".into(), k, v)).collect();
    out.extend(model.hardware.iter().map(|(k, v)| ("체결 · 기타".to_string(), k.clone(), *v)));
    out
}

/// Minimal DXF (R12, mm) with closed polylines for rectangles and circles.
pub fn dxf(path: &Path, outline: (f64, f64), rects: &[(f64, f64, f64, f64)], circles: &[(f64, f64, f64)]) -> std::io::Result<()> {
    let mut s = String::from("0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n");
    let mut rect = |cx: f64, cy: f64, w: f64, h: f64, layer: &str| {
        s.push_str(&format!("0\nPOLYLINE\n8\n{layer}\n66\n1\n70\n1\n"));
        for (x, y) in [(cx - w / 2.0, cy - h / 2.0), (cx + w / 2.0, cy - h / 2.0), (cx + w / 2.0, cy + h / 2.0), (cx - w / 2.0, cy + h / 2.0)] {
            s.push_str(&format!("0\nVERTEX\n8\n{layer}\n10\n{x:.3}\n20\n{y:.3}\n30\n0\n"));
        }
        s.push_str("0\nSEQEND\n");
    };
    rect(0.0, 0.0, outline.0, outline.1, "OUTLINE");
    for &(x, y, w, h) in rects { rect(x, y, w, h, "CUTOUT"); }
    for &(x, y, r) in circles { s.push_str(&format!("0\nCIRCLE\n8\nHOLES\n10\n{x:.3}\n20\n{y:.3}\n30\n0\n40\n{r:.3}\n")); }
    s.push_str("0\nENDSEC\n0\nEOF\n");
    std::fs::write(path, s)
}
