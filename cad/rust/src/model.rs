//! PASTELLA 84 geometry, links and joints from spec.json (mm, kg), in two variants:
//!   Concept — the retro CRT design the workbench simulates.
//!   Build   — what can be built today: LCD panel instead of the CRT, external DC adapter, FDM-printed
//!             housings with M3 heat-set inserts, and store-bought parts (`Src::Buy`).
//! Design features learned from reference photos are marked [ref: ...].

use crate::geom::*;
use crate::mesh::{MassProps, Mesh, V3};
use crate::spec::{Material, Spec};
use std::collections::BTreeMap;
use truck_modeling::Transform;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Variant { Concept, Build }

/// Where a part comes from in the real build.
#[derive(Clone, PartialEq, Debug)]
pub enum Src {
    Concept,
    /// printed; parts sharing a group are printed as one body
    Print(String),
    /// printed as part of another group's body (bosses, ribs, tabs)
    Fuse(String),
    /// bought; the string is the BOM line
    Buy(String),
    /// removed from a printed group (blind insert holes, screw clearance); not a physical part
    Cut(String),
}

impl Src {
    pub fn group(&self) -> Option<&str> { match self { Src::Print(g) | Src::Fuse(g) | Src::Cut(g) => Some(g), _ => None } }
    pub fn printed(&self) -> bool { matches!(self, Src::Print(_) | Src::Fuse(_)) }
}

pub struct Part { pub name: String, pub link: String, pub mat: String, pub pick: &'static str, pub solids: Vec<Solid>, pub mass: Option<f64>, pub src: Src }
pub struct Link { pub name: String, pub origin: V3 }
#[derive(Clone)]
pub struct Joint { pub name: String, pub kind: &'static str, pub parent: String, pub child: String, pub axis: V3, pub lo: f64, pub hi: f64, pub effort: f64, pub vel: f64 }

pub struct Model {
    pub variant: Variant,
    pub parts: Vec<Part>,
    pub links: Vec<Link>,
    pub joints: Vec<Joint>,
    pub dims: BTreeMap<String, serde_json::Value>,
    /// screws, inserts and other hardware that is counted, not modelled
    pub hardware: BTreeMap<String, usize>,
    /// flat parts for laser / PCB fabs: (name, outline w x h, rect cut-outs (cx, cy, w, h), circles (cx, cy, r))
    pub sheets: Vec<(String, (f64, f64), Vec<(f64, f64, f64, f64)>, Vec<(f64, f64, f64)>)>,
    /// source assigned to parts added next (build variant)
    cur: Src,
}

impl Model {
    fn add(&mut self, name: &str, link: &str, mat: &str, pick: &'static str, s: Solid) { self.add_m(name, link, mat, pick, s, None) }
    fn add_m(&mut self, name: &str, link: &str, mat: &str, pick: &'static str, s: Solid, mass: Option<f64>) {
        let src = if self.variant == Variant::Concept { Src::Concept } else { self.cur.clone() };
        self.parts.push(Part { name: name.into(), link: link.into(), mat: mat.into(), pick, solids: vec![s], mass, src });
    }
    /// add with an explicit source (concept parts always stay `Src::Concept`)
    #[allow(clippy::too_many_arguments)]
    pub fn add_src(&mut self, name: &str, link: &str, mat: &str, pick: &'static str, solids: Vec<Solid>, mass: Option<f64>, src: Src) {
        let src = if self.variant == Variant::Concept { Src::Concept } else { src };
        self.parts.push(Part { name: name.into(), link: link.into(), mat: mat.into(), pick, solids, mass, src });
    }
    fn print(&mut self, g: &str) { self.cur = Src::Print(g.into()); }
    fn buy(&mut self, item: &str) { self.cur = Src::Buy(item.into()); }
    pub fn hw(&mut self, item: &str, n: usize) { *self.hardware.entry(item.into()).or_default() += n; }
    fn link(&mut self, name: &str, o: V3) { self.links.push(Link { name: name.into(), origin: o }) }
    #[allow(clippy::too_many_arguments)]
    fn joint(&mut self, name: &str, kind: &'static str, parent: &str, child: &str, axis: V3, lo: f64, hi: f64, effort: f64, vel: f64) {
        let n = (axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]).sqrt();
        self.joints.push(Joint { name: name.into(), kind, parent: parent.into(), child: child.into(), axis: axis.map(|a| a / n), lo, hi, effort, vel });
    }
    fn fixed(&mut self, name: &str, parent: &str, child: &str) { self.joint(name, "fixed", parent, child, [1.0, 0.0, 0.0], 0.0, 0.0, 0.0, 0.0) }
    fn dim(&mut self, k: &str, v: f64) { self.dims.insert(k.into(), serde_json::json!((v * 10.0).round() / 10.0)); }
    fn build_v(&self) -> bool { self.variant == Variant::Build }

    /// heat-set insert boss fused to a printed group: from the surface point `p` along `n` (into the
    /// cavity) for `len` mm, embedded 1 mm behind `p`; the insert hole opens at the free end
    #[allow(clippy::too_many_arguments)]
    pub fn insert_boss(&mut self, name: &str, link: &str, mat: &str, group: &str, p: V3, n: V3, len: f64, s: &Spec) {
        let ins = &s.build.insert;
        let b = boss(ins.boss_d / 2.0, ins.hole_d / 2.0, len + 1.0, ins.depth);
        let o = [p[0] - n[0], p[1] - n[1], p[2] - n[2]];
        self.add_src(name, link, mat, "frame", vec![map(&b, frame(o, n, side(n)))], None, Src::Fuse(group.into()));
        self.hw("M3 열압입 인서트 (OD 4.6 × L 5.7)", 1);
    }
    /// blind insert hole cut into a solid printed wall: opening at `p`, going along -n
    fn insert_hole(&mut self, name: &str, link: &str, group: &str, p: V3, n: V3, s: &Spec) {
        let ins = &s.build.insert;
        let c = turned(&[(ins.hole_d / 2.0, -0.5, ins.depth)]);
        self.add_src(name, link, "dark", "frame", vec![map(&c, frame(p, [-n[0], -n[1], -n[2]], side(n)))], None, Src::Cut(group.into()));
        self.hw("M3 열압입 인서트 (OD 4.6 × L 5.7)", 1);
    }
    /// screw clearance hole cut into a printed group along `n` through `p`
    #[allow(clippy::too_many_arguments)]
    fn clear_hole(&mut self, name: &str, link: &str, group: &str, p: V3, n: V3, len: f64, s: &Spec) {
        let c = turned(&[(s.build.screw_clear_d / 2.0, -len / 2.0, len / 2.0)]);
        self.add_src(name, link, "dark", "frame", vec![map(&c, frame(p, n, side(n)))], None, Src::Cut(group.into()));
    }
}

fn side(n: V3) -> V3 { if n[0].abs() < 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] } }

pub fn part_mass_props(p: &Part, mats: &BTreeMap<String, Material>, tol: f64) -> (Mesh, MassProps) {
    let mut mesh = Mesh::default();
    for s in &p.solids {
        let (pos, tris, _) = tessellate(s, tol);
        mesh.append(&Mesh { p: pos, t: tris });
    }
    let rho = mats[&p.mat].density;
    let mp = mesh.mass_props(rho);
    let mp = match p.mass { Some(m) if mp.vol > 0.0 => mesh.mass_props(m / mp.vol), _ => mp };
    (mesh, mp)
}

const LID_FRONT: usize = 0;
const RIGHT: usize = 1;
const BACK: usize = 2;
const LEFT: usize = 3;

pub fn build(spec: &Spec, mats: &BTreeMap<String, Material>, variant: Variant) -> Model {
    let mut m = Model { variant, parts: vec![], links: vec![], joints: vec![], dims: BTreeMap::new(), hardware: BTreeMap::new(), sheets: vec![], cur: Src::Concept };
    m.link("desk", [0.0; 3]);
    let z_top = base(&mut m, spec);
    monitor(&mut m, spec, mats, z_top);
    keyboard(&mut m, spec);
    mouse(&mut m, spec);
    m.fixed("desk_to_base", "desk", "base_tray");
    m.fixed("base_tray_to_internal", "base_tray", "base_internal");
    m.fixed("base_tray_to_lid", "base_tray", "base_lid");
    m.fixed("lid_to_monitor_stand", "base_lid", "monitor_stand");
    m.fixed("desk_to_keyboard", "desk", "keyboard_case");
    m.fixed("desk_to_mouse", "desk", "mouse_base");
    m
}

// ============================================================ base unit
fn base(m: &mut Model, s: &Spec) -> f64 {
    let b = &s.base;
    let bv = m.build_v();
    let (w, d, t, y0) = (b.W, b.D, b.wall, b.y);
    let (z_tray0, z_lid0) = (b.feet_h, b.feet_h + b.H_tray);
    let z_top = z_lid0 + b.H_lid;
    m.link("base_tray", [0.0, y0, 0.0]);
    m.link("base_internal", [0.0, y0, z_lid0]);
    m.link("base_lid", [0.0, y0, z_lid0]);

    // tray: a lid-type cup flipped over -> closed floor at z = feet, open top  [ref: MSX two-tone, darker lower half]
    m.print("tray");
    let tray = Cup { cx: 0.0, cy: y0, w, d, r: b.corner_r - 2.0, t, top0: b.H_tray, slope: 0.0, top_holes: vec![], wall_holes: Default::default() }.build("tray");
    m.add("tray", "base_tray", "tray", "tray", map(&tray, tr(0.0, 0.0, z_lid0) * ry(180.0)));
    m.buy("고무발 Ø17 × 3 mm (점착식)");
    for (i, (x, y)) in [(-190.0, -140.0), (190.0, -140.0), (-190.0, 140.0), (190.0, 140.0)].iter().enumerate() {
        m.add(&format!("foot_{i}"), "base_tray", "rubber", "tray", turned_on('Z', &[(8.5, 0.0, b.feet_h)], [*x, y0 + y, 0.0]));
    }

    let zf = z_tray0 + t;
    let mb_holes = [(-175.0, -125.0), (0.0, -125.0), (175.0, -125.0), (-175.0, 125.0), (0.0, 125.0), (175.0, 125.0)];
    if !bv {
        // SPCC frame and standoffs
        m.add("frame_plate", "base_internal", "steel", "frame", bx(415.0, 315.0, 1.0, [0.0, y0, zf + 0.5]));
        for (i, (x, y)) in mb_holes.iter().enumerate() {
            m.add(&format!("standoff_{i}"), "base_internal", "alu", "frame", turned_on('Z', &[(4.0, 0.0, 6.0)], [*x, y0 + y, zf + 1.0]));
        }
    } else {
        // printed floor bosses with inserts carry the mainboard directly (no sheet-metal frame)
        for (i, (x, y)) in mb_holes.iter().enumerate() {
            m.insert_boss(&format!("mb_boss_{i}"), "base_tray", "tray", "tray", [*x, y0 + y, zf], [0.0, 0.0, 1.0], 7.0, s);
        }
        m.hw("M3 × 6 볼트 (메인보드)", 6);
        // lid <-> tray: four corner screw columns, screwed from under the tray into lid inserts
        for (i, (sx, sy)) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)].iter().enumerate() {
            let (x, y) = (sx * (w / 2.0 - 7.5), y0 + sy * (d / 2.0 - 7.5));
            m.add_src(&format!("tray_column_{i}"), "base_tray", "tray", "tray", vec![map(&ring(4.5, s.build.screw_clear_d / 2.0, zf - 1.0, z_lid0), tr(x, y, 0.0))], None, Src::Fuse("tray".into()));
            m.clear_hole(&format!("tray_column_hole_{i}"), "base_tray", "tray", [x, y, z_tray0 + t / 2.0], [0.0, 0.0, 1.0], t + 2.0, s);
            m.insert_boss(&format!("lid_corner_boss_{i}"), "base_lid", "base", "lid", [x, y, z_lid0 + 11.0], [0.0, 0.0, -1.0], 11.0, s);
        }
        m.hw("M3 × 35 볼트 (트레이 → 상판)", 4);
    }
    let zp = zf + 7.0;
    m.buy("메인보드 PCB 390 × 300 mm 2층 (JLCPCB 등 주문 제작)");
    m.add("mainboard", "base_internal", "pcb", "mainboard", bx(390.0, 300.0, 1.6, [0.0, y0, zp + 0.8]));
    let zc = zp + 1.6;
    m.buy("메인보드 실장 부품 (Z80 · EEPROM · SRAM · Pico × 2 · CH376S · 74HC)");
    for (n, iw, id, x, y) in [("cpu", 52.0, 15.0, 10.0, -45.0), ("rom", 37.0, 15.0, 15.0, -95.0), ("sram0", 37.0, 15.0, -120.0, 40.0), ("sram1", 37.0, 15.0, -120.0, 80.0),
                               ("pico_video", 51.0, 21.0, 10.0, 15.0), ("pico_sound", 51.0, 21.0, -120.0, 105.0), ("ch376s", 30.0, 25.0, -35.0, -40.0)] {
        m.add(&format!("ic_{n}"), "base_internal", "chip", "ics", bx(iw, id, 5.0, [x, y0 + y, zc + 2.5]));
    }
    for i in 0..8 {
        m.add(&format!("ic_logic_{i}"), "base_internal", "chip", "ics", bx(7.0, 19.5, 4.5, [-25.0 + i as f64 * 15.0, y0 + 95.0, zc + 2.25]));
    }
    m.add("xtal", "base_internal", "alu", "ics", turned_on('X', &[(5.0, -5.5, 5.5)], [75.0, y0 - 45.0, zc + 5.5]));
    if !bv {
        // linear PSU: finned heatsink (comb profile extruded along Y), regulators, EI transformer, C1
        let mut comb = vec![(95.0, 0.0), (195.0, 0.0), (195.0, 4.0)];
        for i in (0..7).rev() {
            let xc = 100.0 + 15.0 * i as f64;
            comb.extend([(xc + 1.5, 4.0), (xc + 1.5, 34.0), (xc - 1.5, 34.0), (xc - 1.5, 4.0)]);
        }
        comb.push((95.0, 4.0));
        let hs = prism(&poly(&comb, 0.0), &[], Vector3::new(0.0, 0.0, 90.0));
        m.add("heatsink", "base_internal", "alu", "psu", map(&hs, tr(0.0, y0 + 95.0 + 45.0, zc) * rx(90.0)));
        for (i, x) in [110.0, 145.0, 180.0].iter().enumerate() {
            m.add(&format!("regulator_{i}"), "base_internal", "chip", "psu", bx(10.0, 4.5, 15.0, [*x, y0 + 47.0, zc + 7.5]));
        }
        m.add_m("transformer", "base_internal", "steel", "psu", bx(56.0, 42.0, 44.0, [145.0, y0 - 5.0, zc + 22.0]), Some(1.25));
        m.add_m("c1_4700uF", "base_internal", "trim", "psu", turned_on('Z', &[(14.0, 0.0, 42.0)], [72.0, y0 + 122.0, zc]), Some(0.045));
    } else {
        // mains stays outside the plastic case: 12 V DC adapter -> panel-mount jack -> 5 V buck module
        let bk = &s.build.psu.buck;
        m.buy("LM2596 강압 모듈 (12 V → 5 V 3 A)");
        m.add_m("buck_module", "base_internal", "pcb", "psu", bx(bk[0], bk[1], bk[2], [145.0, y0 + 40.0, zc + bk[2] / 2.0]), Some(0.02));
        m.buy("DC 잭 5.5 × 2.1 mm 패널 장착형");
        m.add_m("dc_jack", "base_internal", "dark", "psu",
                turned_on('Y', &[(5.5, d / 2.0 - t - 14.0, d / 2.0), (7.0, d / 2.0, d / 2.0 + 2.0)], [150.0, y0, z_lid0 + 20.0]), Some(0.01));
    }
    m.buy("Gotek USB 플로피 에뮬레이터 (FlashFloppy, 3.5\" 규격)");
    m.add_m("usb_bay", "base_internal", "steel", "floppy", bx(102.0, 150.0, 26.0, [-120.0, y0 - 83.0, zc + 13.0]), Some(0.32));
    m.buy("스피커 57 mm 8 Ω 0.5 W");
    m.add_m("speaker", "base_internal", "dark", "harness", turned_on('Z', &[(28.0, 0.0, 8.0)], [-175.0, y0 + 105.0, z_top - t - 12.5]), Some(0.09));

    // lid: one watertight shell with vents, speaker perforation, front controls and side slots
    let mut top_holes: Vec<Loop> = (0..14).map(|i| rrect(75.0 + 10.0 * i as f64, y0 + 90.0, 5.0, 90.0, 2.4, 0.0)).collect();
    for r in 0..6 { for c in 0..7 {   // [ref: Bandai Pippin round-hole speaker grille]
        top_holes.push(circle(-175.0 + (c as f64 - 3.0) * 7.0, y0 + 105.0 + (r as f64 - 2.5) * 7.0, 1.6, 0.0, 8));
    } }
    let zm = b.H_lid / 2.0; // front controls centre height inside the lid
    let mut walls: [Vec<(f64, f64, Shape2)>; 4] = Default::default();
    walls[LID_FRONT] = vec![(-120.0, zm - 13.0, Shape2::RRect(95.0, 7.0, 1.5)), (50.0, zm, Shape2::Circle(4.0)), (100.0, zm, Shape2::Circle(4.0)),
                            (160.0, zm, Shape2::RRect(12.0, 20.0, 1.0)), (195.0, zm + 10.0, Shape2::Circle(2.6))];
    for side in [RIGHT, LEFT] {    // [ref: Apple IIc "Snow White" horizontal grooves, here as vent slots]
        for k in 0..5 { for j in [-100.0, 0.0, 100.0] {
            walls[side].push((y0 + j, 22.0 + 8.0 * k as f64, Shape2::RRect(80.0, 2.5, 1.2)));
        } }
    }
    if bv { walls[BACK].push((150.0, 20.0, Shape2::Circle(5.6))); }   // DC jack
    m.print("lid");
    let lid = Cup { cx: 0.0, cy: y0, w, d, r: b.corner_r, t, top0: b.H_lid, slope: 0.0, top_holes, wall_holes: walls }.build("lid");
    m.add("lid", "base_lid", "base", "lid", map(&lid, tr(0.0, 0.0, z_lid0)));
    let fy = y0 - d / 2.0;
    let zcf = z_lid0 + zm;
    m.print("trim");
    m.add("usb_bay_bezel", "base_lid", "dark", "floppy", bx(92.0, 1.2, 5.0, [-120.0, fy + 1.0, zcf - 13.0]));
    m.add("eject_button", "base_lid", "trim", "floppy", bx(16.0, 3.0, 7.0, [-52.0, fy - 1.5, zcf - 21.0]));
    m.buy("LED 5 mm 녹색 + 홀더");
    m.add("led_power", "base_lid", "led", "lid", turned_on('Y', &[(2.5, -3.0, 1.0)], [195.0, fy, zcf + 10.0]));
    m.print("trim");
    m.add("brand_badge", "base_lid", "dark", "lid", bx(110.0, 0.8, 14.0, [-100.0, fy - 0.4, zcf + 17.0]));
    for i in 0..4 {   // [ref: Sega SC-3000 / Apple rainbow stripes, pastel]
        m.add(&format!("stripe_{i}"), "base_lid", &format!("stripe{}", i + 1), "lid", bx(40.0, 0.8, 3.2, [-185.0, fy - 0.4, zcf + 23.0 - i as f64 * 4.2]));
    }
    for (n, x) in [("vol", 50.0), ("tone", 100.0)] {
        let l = format!("dial_{n}");
        m.link(&l, [x, fy, zcf]);
        if !bv {
            m.add(&format!("{l}_knob"), &l, "trim", "lid", turned_on('Y', &[(17.0, -10.0, 0.0), (3.0, 0.0, 14.0)], [x, fy, zcf]));
        } else {
            // printed knob with a 6 mm shaft bore on a 16 mm potentiometer behind the front wall
            m.print("knobs");
            m.add(&format!("{l}_knob"), &l, "trim", "lid", map(&boss(17.0, 3.1, 10.0, 8.0), tr(x, fy - 10.0, zcf) * rx(-90.0)));
            m.add_src(&format!("{l}_pot"), "base_lid", "alu", "lid", vec![turned_on('Y', &[(3.0, -8.0, t), (8.5, t, t + 9.0)], [x, fy, zcf])],
                      Some(0.012), Src::Buy("가변저항 16 mm B10K (6 mm 축)".into()));
        }
        m.add(&format!("{l}_mark"), &l, "dark", "lid", bx(2.4, 0.8, 8.0, [x, fy - 10.4, zcf + 9.0]));
        m.joint(&format!("{l}_joint"), "continuous", "base_lid", &l, [0.0, -1.0, 0.0], 0.0, 0.0, 0.2, 6.0);
    }
    // toggle: escutcheon plate with a lever slot, pivot behind the plate (inside the lid cut-out)
    m.print("trim");
    let plate = prism(&rect(0.0, 0.0, 16.0, 24.0, 0.0), &[rrect(0.0, 0.0, 8.0, 16.0, 2.0, 0.0)], Vector3::new(0.0, 0.0, 2.0));
    m.add("toggle_plate", "base_lid", "dark", "lid", map(&plate, tr(160.0, fy - 2.0, zcf) * rx(-90.0)));
    m.link("power_toggle", [160.0, fy, zcf]);
    m.buy("토글 스위치 MTS-102 (전원)");
    let lever = map(&turned(&[(2.6, 0.0, 20.5)]), tr(160.0, fy, zcf) * rx(60.0));
    m.add("toggle_lever", "power_toggle", "alu", "lid", lever);
    m.joint("power_toggle_joint", "revolute", "base_lid", "power_toggle", [1.0, 0.0, 0.0], -0.35, 0.35, 0.5, 4.0);
    m.dim("base_W", w); m.dim("base_D", d); m.dim("base_H", z_top);
    z_top
}

// ============================================================ monitor
fn monitor(m: &mut Model, s: &Spec, mats: &BTreeMap<String, Material>, z_lid_top: f64) {
    let p = &s.monitor;
    let bv = m.build_v();
    let a = p.aspect;
    let w = p.diag_in * 25.4 * a / (a * a + 1.0).sqrt();
    let h = w / a;
    // build: a real panel needs a border wide enough to screw clips beside its outline
    let (bt, gap, chin) = (if bv { s.build.monitor_bezel } else { p.bezel }, p.gap, p.chin);
    let (wm, hm) = (w + 2.0 * (bt + gap), h + 2.0 * (bt + gap) + chin);
    let depth = p.bezel_depth + p.depth_per_diag_mm * p.diag_in * 25.4;   // 125-degree super-slim CRT silhouette
    let (yf, yb) = (p.front_y, p.front_y + depth);
    let z0 = z_lid_top + p.stand_h;
    let zc = z0 + hm / 2.0;
    let zs = z0 + chin + bt + gap + h / 2.0;
    let body = "monitor_body";
    let front = tr(0.0, yf, 0.0) * rx(90.0);   // local XY (y = world z) -> front plane, local -Z -> +Y
    let ybz = yf + p.bezel_depth;               // bezel back face

    // bezel with stepped picture-frame recess  [ref: Macintosh Color Classic]
    let zk = z0 + (bt + chin) / 2.0 + 1.0;
    let knob_x: Vec<f64> = (0..3).map(|i| wm / 2.0 - 20.0 - 16.0 * i as f64).collect();
    let (led_r, knob_r) = if bv { (1.6, 3.5) } else { (2.05, 1.6) };   // build: 3 mm LED, EC11 encoder shafts
    let mut holes = vec![circle(-wm / 2.0 + 16.0, zk, led_r, 0.0, 8)];
    holes.extend(knob_x.iter().map(|x| circle(*x, zk, knob_r, 0.0, 8)));
    m.print("bezel");
    let bez = stepped_ring((0.0, zc, wm, hm, 14.0),
                           (0.0, zs, w + 2.0 * gap + 2.0 * p.recess_step, h + 2.0 * gap + 2.0 * p.recess_step, 6.0), p.recess_depth,
                           (0.0, zs, w + 2.0 * gap, h + 2.0 * gap, 3.0), p.bezel_depth, &holes);
    m.add("bezel", body, "monitor", "bezel", map(&bez, front));

    // rear shell: flat bottom, top tapering to a 60 % x 70 % back  [ref: iMac G3 / Color Classic flat base]
    let (bw_, bh_) = (wm * 0.6, hm * 0.7);
    let cy_back = bh_ / 2.0 - hm / 2.0;
    let zb = z0 + bh_ / 2.0;
    // carry handle on the back  [ref: Canon Cat, Sharp X68000, iMac G3 handles]
    let handle = map(&prism(&poly(&[(-56.0, 0.0), (-44.0, 0.0), (-44.0, 26.0), (44.0, 26.0), (44.0, 0.0), (56.0, 0.0), (56.0, 34.0), (-56.0, 34.0)], 0.0), &[], Vector3::new(0.0, 0.0, 24.0)),
                     tr(0.0, yb, zb + 50.0));
    let vents = |at: f64| -> Vec<Loop> { (0..16).map(|i| rrect(0.0, at + cy_back + bh_ * 0.32 - i as f64 * bh_ * 0.04, bw_ * 0.44, 3.0, 1.4, 0.0)).collect() };
    if !bv {
        let shell = tapered_shell((wm, hm, 14.0), (bw_, bh_, 9.0), cy_back, depth - p.bezel_depth, p.wall, &vents(0.0), 0.0, false);
        m.add("rear_shell", body, "monitor", "shell", map(&shell, tr(0.0, ybz, zc) * rx(90.0)));
        m.add("carry_handle", body, "monitor", "shell", handle);
    } else {
        // open-back shell with a 45 mm straight front section (room for the panel and its clips),
        // and a separate back cover: no unsupported roof when printing, access for assembly
        let t = p.wall;
        m.print("shell");
        let shell = tapered_shell((wm, hm, 14.0), (bw_, bh_, 9.0), cy_back, depth - p.bezel_depth - t, t, &[], 45.0, true);
        m.add("rear_shell", body, "monitor", "shell", map(&shell, tr(0.0, ybz, zc) * rx(90.0)));
        m.print("cover");
        let cover = prism(&rrect(0.0, 0.0, bw_, bh_, 9.0, 0.0), &vents(-cy_back), Vector3::new(0.0, 0.0, t));
        m.add("back_cover", body, "monitor", "shell", map(&cover, tr(0.0, yb, zb) * rx(90.0)));
        // handle printed on its own (no bridge over the grip) and screwed on from inside the cover
        m.add_src("carry_handle", body, "monitor", "shell", vec![handle], None, Src::Print("handle".into()));
        for (i, x) in [-50.0, 50.0].iter().enumerate() {
            m.insert_hole(&format!("handle_insert_{i}"), body, "handle", [*x, yb, zb + 62.0], [0.0, -1.0, 0.0], s);
            m.clear_hole(&format!("handle_hole_{i}"), body, "cover", [*x, yb - t / 2.0, zb + 62.0], [0.0, 1.0, 0.0], t + 2.0, s);
        }
        m.hw("M3 × 8 볼트 (손잡이)", 2);
        // cover screws: corner bosses inside the shell back, clearance holes in the cover
        let (ax, az) = (bw_ / 2.0 - 9.0 + 2.1, bh_ / 2.0 - 9.0 + 2.1);
        for (i, (sx, sz)) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)].iter().enumerate() {
            let (x, z) = (sx * ax, zb + sz * az);
            m.insert_boss(&format!("cover_boss_{i}"), body, "monitor", "shell", [x, yb - t - 8.0, z], [0.0, 1.0, 0.0], 8.0, s);
            m.clear_hole(&format!("cover_hole_{i}"), body, "cover", [x, yb - t / 2.0, z], [0.0, 1.0, 0.0], t + 2.0, s);
        }
        m.hw("M3 × 8 볼트 (뒤 덮개)", 4);
    }

    if !bv {
        let ys = yf + p.bezel_depth + 0.1;
        m.add("screen_mask", body, "slot", "bezel", map(&rring(w + 2.0 * gap + 16.0, h + 2.0 * gap + 16.0, 12.0, w + 2.0 * gap + 0.4, h + 2.0 * gap + 0.4, 6.0, 0.0, 1.0), tr(0.0, ys, zs) * rx(-90.0)));
        // CRT envelope: faceplate, funnel, neck (glass mass of a 19" tube)
        let yg = yf + p.recess_depth + 4.0;
        let tube = loft(&[rrect(0.0, 0.0, w + 2.0, h + 2.0, 12.0, 0.0), rrect(0.0, 0.0, w * 0.92, h * 0.92, 30.0, -0.10 * depth),
                          rrect(0.0, 0.0, w * 0.32, h * 0.32, 40.0, -0.42 * depth), circle(0.0, 0.0, 14.5, -0.62 * depth, 8), circle(0.0, 0.0, 14.5, -0.92 * depth, 8)]);
        m.add_m("crt_tube", body, "glass", "tube", map(&tube, tr(0.0, yg, zs) * rx(90.0)), Some(p.tube_mass_kg));
        m.add_m("crt_screen", body, "screen", "screen", bx(w, 0.5, h, [0.0, yg - 0.35, zs]), Some(0.001));
        let yk = yg + 0.62 * depth;
        m.add_m("deflection_yoke", body, "copper", "yoke", map(&ring(46.0, 15.0, 0.0, 45.0), tr(0.0, yk, zs) * rx(-90.0)), Some(p.yoke_mass_kg));
        m.add("neck_board", body, "pcb", "neckboard", bx(60.0, 1.6, 60.0, [0.0, yg + 0.92 * depth + 1.5, zs]));
        m.add_m("flyback", body, "dark", "flyback", bx(32.0, 30.0, 34.0, [wm * 0.26, yg + 0.5 * depth, zs - h * 0.28]), Some(p.flyback_mass_kg));
        m.add("chassis_board", body, "pcb", "neckboard", bx(wm * 0.62, 120.0, 1.6, [0.0, yg + 0.42 * depth, z0 + p.wall + 4.8]));
        m.add_m("degauss_coil", body, "copper", "degauss", map(&rring(w + 15.0, h + 15.0, 18.0, w + 5.0, h + 5.0, 13.0, 0.0, 5.0), tr(0.0, yf + p.bezel_depth + 2.0, zs) * rx(-90.0)), Some(p.degauss_mass_kg));
        m.add("led_monitor", body, "led", "bezel", turned_on('Y', &[(2.0, -2.5, 0.5)], [-wm / 2.0 + 16.0, yf, zk]));
    } else {
        let pn = &s.build.panel;
        let (pw, ph, pd) = (pn.outline[0], pn.outline[1], pn.outline[2]);
        m.add_src("lcd_panel", body, "chip", "screen", vec![bx(pw, pd, ph, [0.0, ybz + pd / 2.0, zs])], Some(pn.mass_kg), Src::Buy(pn.part.clone()));
        m.dim("panel_active_w", pn.active[0]); m.dim("panel_active_h", pn.active[1]);   // visible opening is w x h (+ 2 x gap)
        m.add_src("crt_screen", body, "screen", "screen", vec![bx(w, 0.5, h, [0.0, ybz - 0.35, zs])], Some(0.001), Src::Buy(pn.part.clone()));
        // panel clips: printed L-clips screwed into inserts in the bezel back, lips over the panel edges
        let side_x = (pw / 2.0 + (wm / 2.0 - p.wall)) / 2.0;      // middle of the strip beside the panel
        let top_z = zs + (ph / 2.0 + (hm / 2.0 - p.wall - (zs - zc))) / 2.0;
        // positions keep clear of the print seams through the bezel centre lines (x = 0, z = zc)
        let clips: [(&str, f64, f64, f64, f64, [f64; 3]); 8] = [
            ("left_up", -side_x, zs + 60.0, 9.0, 18.0, [1.0, 0.0, 0.0]), ("left_down", -side_x, zs - 60.0, 9.0, 18.0, [1.0, 0.0, 0.0]),
            ("right_up", side_x, zs + 60.0, 9.0, 18.0, [-1.0, 0.0, 0.0]), ("right_down", side_x, zs - 60.0, 9.0, 18.0, [-1.0, 0.0, 0.0]),
            ("top_l", -170.0, top_z, 20.0, 8.0, [0.0, 0.0, -1.0]), ("top_r", 170.0, top_z, 20.0, 8.0, [0.0, 0.0, -1.0]),
            ("bottom_l", -120.0, zs - ph / 2.0 - 5.0, 20.0, 8.0, [0.0, 0.0, 1.0]), ("bottom_r", 120.0, zs - ph / 2.0 - 5.0, 20.0, 8.0, [0.0, 0.0, 1.0])];
        for (n, x, z, fw, fh, dir) in clips {
            let foot = prism(&rect(0.0, 0.0, fw, fh, 0.0), &[circle(0.0, 0.0, s.build.screw_clear_d / 2.0, 0.0, 8)], Vector3::new(0.0, 0.0, pd + 3.0));
            let foot = map(&foot, tr(x, ybz, z) * rx(-90.0));
            // lip: reaches over the panel edge, behind the panel
            let (lx, lz, lw, lh) = if dir[0] != 0.0 { (x + dir[0] * (fw / 2.0 + 3.0), z, 7.0, fh) } else { (x, z + dir[2] * (fh / 2.0 + 3.0), fw, 7.0) };
            let lip = bx(lw, 3.0, lh, [lx, ybz + pd + 1.5, lz]);
            m.add_src(&format!("panel_clip_{n}"), body, "monitor", "bezel", vec![foot, lip], None, Src::Print("clips".into()));
            m.insert_hole(&format!("panel_clip_insert_{n}"), body, "bezel", [x, ybz, z], [0.0, 1.0, 0.0], s);
        }
        m.hw("M3 × 25 볼트 (패널 클립)", 8);
        // bezel <-> shell: two blocks on the bezel back screwed from under the flat shell floor, and top tongues
        for (i, x) in [-140.0, 140.0].iter().enumerate() {
            m.add_src(&format!("bezel_block_{i}"), body, "monitor", "bezel", vec![bx(10.0, 14.0, 14.0, [*x, ybz + 7.0 - 0.5, z0 + p.wall + 7.0 + 0.2])], None, Src::Fuse("bezel".into()));
            m.insert_hole(&format!("bezel_block_insert_{i}"), body, "bezel", [*x, ybz + 7.0, z0 + p.wall + 0.2], [0.0, 0.0, -1.0], s);
            m.clear_hole(&format!("shell_floor_hole_{i}"), body, "shell", [*x, ybz + 7.0, z0 + p.wall / 2.0], [0.0, 0.0, 1.0], p.wall + 2.0, s);
        }
        m.hw("M3 × 10 볼트 (셸 바닥 → 베젤)", 2);
        let tongue_z = zc + hm / 2.0 - p.wall - 1.3;
        for (i, x) in [-90.0, 90.0].iter().enumerate() {
            m.add_src(&format!("bezel_tongue_{i}"), body, "monitor", "bezel", vec![bx(120.0, 9.0, 2.0, [*x, ybz + 4.0, tongue_z])], None, Src::Fuse("bezel".into()));
        }
        // LCD controller board on floor bosses behind the panel
        let lb = &s.build.lcd_board;
        let (lw, ld, lh) = (lb.envelope[0], lb.envelope[1], lb.envelope[2]);
        let ly = ybz + pd + 30.0 + ld / 2.0;
        for (i, (sx, sy)) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)].iter().enumerate() {
            m.insert_boss(&format!("lcd_board_boss_{i}"), body, "monitor", "shell", [sx * (lw / 2.0 - 5.0), ly + sy * (ld / 2.0 - 5.0), z0 + p.wall], [0.0, 0.0, 1.0], 6.0, s);
        }
        m.hw("M3 × 6 볼트 (LCD 컨트롤러 보드)", 4);
        m.add_src("lcd_board", body, "pcb", "neckboard", vec![bx(lw, ld, lh, [0.0, ly, z0 + p.wall + 6.0 + lh / 2.0])], Some(lb.mass_kg), Src::Buy(lb.part.clone()));
        m.add_src("led_monitor", body, "led", "bezel", vec![turned_on('Y', &[(1.5, -1.0, 5.0)], [-wm / 2.0 + 16.0, yf, zk])], None, Src::Buy("LED 3 mm 녹색".into()));
        m.hw("12 V 5 A DC 어댑터 (KC 인증) — 모니터 · 본체 공용 분배", 1);
    }
    m.print("trim");
    m.add("brand_badge_monitor", body, "dark", "bezel", bx(62.0, 0.8, 10.0, [0.0, yf - 0.4, zk]));
    for (i, n) in ["bright", "vhold", "hsize"].iter().enumerate() {
        let l = format!("knob_{n}");
        m.link(&l, [knob_x[i], yf, zk]);
        if !bv {
            m.add(&format!("{l}_cap"), &l, "trim", "bezel", turned_on('Y', &[(5.5, -6.0, 0.0), (1.5, 0.0, 10.0)], [knob_x[i], yf, zk]));
        } else {
            m.print("knobs");
            m.add(&format!("{l}_cap"), &l, "trim", "bezel", map(&boss(5.5, 3.1, 6.0, 5.0), tr(knob_x[i], yf - 6.0, zk) * rx(-90.0)));
            m.add_src(&format!("{l}_encoder"), body, "chip", "bezel",
                      vec![turned_on('Y', &[(3.0, -5.0, p.bezel_depth)], [knob_x[i], yf, zk]), bx(12.5, 6.5, 12.0, [knob_x[i], ybz + 3.25, zk])],
                      Some(0.008), Src::Buy("EC11 로터리 엔코더 (6 mm 축) → 컨트롤러 키패드".into()));
        }
        m.joint(&format!("{l}_joint"), "continuous", body, &l, [0.0, -1.0, 0.0], 0.0, 0.0, 0.05, 6.0);
    }

    // tilt / swivel stand, pivot under the body's centre of mass
    let mps: Vec<MassProps> = m.parts.iter().filter(|q| (q.link == body || q.link.starts_with("knob_")) && !matches!(q.src, Src::Cut(_)))
        .map(|q| part_mass_props(q, mats, 0.6).1).collect();
    let y_piv = crate::mesh::combine(&mps).com[1];
    // tilt axis 20 mm above the flat bottom: a convex rocker (R40) on the body turns inside a
    // concentric concave cradle (R40.5) on the swivel, so nothing sweeps into the stand
    let z_ax = z0 + 20.0;
    let yz = tr(0.0, y_piv, z_ax) * rz(90.0) * rx(90.0);   // profile (y, z) about the axis, extruded along X
    let (rr, rc) = (40.0, 40.5);
    let chord = (rr * rr - 20.0f64.powi(2)).sqrt();
    let rocker = path(&[((-chord, -20.0), Some((0.0, -rr))), ((chord, -20.0), None)], -60.0);
    let edge = (rc * rc - 32.0f64.powi(2)).sqrt();
    let cradle = path(&[((-45.0, -50.0), None), ((45.0, -50.0), None), ((45.0, -32.0), None), ((edge, -32.0), Some((0.0, -rc))), ((-edge, -32.0), None), ((-45.0, -32.0), None)], -80.0);
    m.add_src("tilt_rocker", body, "monitor", "stand", vec![map(&prism(&rocker, &[], Vector3::new(0.0, 0.0, 120.0)), yz)], None, Src::Fuse("shell".into()));
    // build: a 75 mm lazy-susan bearing between the base and the swivel
    let sw0 = if bv { 16.0 } else { 8.0 };
    m.link("monitor_stand", [0.0, y_piv, z_lid_top]);
    m.link("monitor_swivel", [0.0, y_piv, z_lid_top + sw0]);
    m.link(body, [0.0, y_piv, z_ax]);
    m.print("stand_base");
    m.add("stand_base", "monitor_stand", "monitor", "stand", rbx(220.0, 150.0, 8.0, 20.0, [0.0, y_piv, z_lid_top + 4.0]));
    if bv {
        m.add_src("swivel_bearing", "monitor_stand", "steel", "stand", vec![rbx(75.0, 75.0, 8.0, 3.0, [0.0, y_piv, z_lid_top + 12.0])], Some(0.12),
                  Src::Buy("레이지수잔 베어링 75 mm (턴테이블)".into()));
        m.hw("M3 × 6 볼트 + 너트 (베어링)", 8);
    }
    m.print(if bv { "stand_neck" } else { "stand_swivel" });
    m.add("stand_neck", "monitor_swivel", "monitor", "stand", turned_on('Z', &[(36.0, 0.0, z_ax - 50.0 - z_lid_top - sw0)], [0.0, y_piv, z_lid_top + sw0]));
    m.print("stand_swivel");
    m.add("tilt_cradle", "monitor_swivel", "monitor", "stand", map(&prism(&cradle, &[], Vector3::new(0.0, 0.0, 160.0)), yz));
    m.joint("monitor_swivel_joint", "revolute", "monitor_stand", "monitor_swivel", [0.0, 0.0, 1.0], p.swivel_deg[0].to_radians(), p.swivel_deg[1].to_radians(), 5.0, 1.0);
    m.joint("monitor_tilt_joint", "revolute", "monitor_swivel", body, [1.0, 0.0, 0.0], p.tilt_deg[0].to_radians(), p.tilt_deg[1].to_radians(), 20.0, 0.5);
    for (k, v) in [("screen_w", w), ("screen_h", h), ("monitor_W", wm), ("monitor_H", hm), ("monitor_D", depth), ("monitor_pivot_y", y_piv)] { m.dim(k, v); }
}

// ============================================================ keyboard
fn keyboard(m: &mut Model, s: &Spec) {
    let k = &s.keyboard;
    let bv = m.build_v();
    let pch = k.pitch;
    let (yf_, yb_) = (k.y - k.D / 2.0, k.y + k.D / 2.0);
    let th = (k.h_rear - k.h_front).atan2(k.D);
    let rows = k.rows.len() as f64;
    let vc = k.margin_front + rows * pch / 2.0;
    let deck = tr(0.0, yf_ + vc * th.cos(), k.h_front + vc * th.sin()) * rx(th.to_degrees());
    let at = |u: f64, v: f64, n: f64| -> V3 { let q = deck.transform_point(Point3::new(u, v, n)); [q.x, q.y, q.z] };
    let dir = |u: f64, v: f64, n: f64| -> V3 { let q = deck.transform_vector(Vector3::new(u, v, n)); [q.x, q.y, q.z] };
    let wu = |c: &str| *k.wide_u.get(c).unwrap_or(&1.0);
    let widest = k.rows.iter().map(|r| r.iter().map(|c| wu(c)).sum::<f64>()).fold(0.0, f64::max) * pch;
    m.link("keyboard_case", [0.0, k.y, 0.0]);

    // wedge case, open bottom, key well  [ref: Commodore 64C, MSX wedge housings]
    m.print("kbcase");
    let well = rrect(0.0, yf_ + vc * th.cos(), widest + 3.0, (rows * pch + 3.0) * th.cos(), 2.0, 0.0);
    let case = Cup { cx: 0.0, cy: k.y, w: k.W, d: k.D, r: 8.0, t: k.wall, top0: k.h_front, slope: th.tan(), top_holes: vec![well], wall_holes: Default::default() }.build("keyboard case");
    m.add("keyboard_case", "keyboard_case", "keyboard", "kbcase", case);
    m.print("trim");
    for i in 0..4 {
        m.add(&format!("kb_stripe_{i}"), "keyboard_case", &format!("stripe{}", i + 1), "kbcase",
              map(&bx(36.0, 3.0, 0.8, [-widest / 2.0 + 18.0, rows * pch / 2.0 + 8.0 + i as f64 * 4.2, 0.4]), deck));
    }
    // switch plate (+ 6.25u stabiliser cut-outs); build: 1.5 mm FR4 ordered from a PCB fab, larger with 4 screw holes
    let pt = -k.plate_below_top;
    let mut keys = vec![];
    let mut cut = vec![];
    let mut sheet_rects = vec![];
    for (r, row) in k.rows.iter().enumerate() {
        let tot: f64 = row.iter().map(|c| wu(c)).sum::<f64>() * pch;
        let mut x = -tot / 2.0;
        for c in row {
            let kw = wu(c) * pch;
            let (u, v) = (x + kw / 2.0, (rows / 2.0 - r as f64 - 0.5) * pch);
            keys.push((c.clone(), u, v, wu(c)));
            cut.push(rect(u, v, 14.0, 14.0, 0.0));
            sheet_rects.push((u, v, 14.0, 14.0));
            if wu(c) >= 2.0 { for sx in [-50.0, 50.0] { cut.push(rect(u + sx, v - 1.0, 7.0, 12.0, 0.0)); sheet_rects.push((u + sx, v - 1.0, 7.0, 12.0)); } }
            x += kw;
        }
    }
    let (pmx, pmy) = (widest / 2.0 + 6.0, rows * pch / 2.0 + 6.0);
    let margin = if bv { 20.0 } else { 12.0 };
    if bv {
        let holes: Vec<(f64, f64, f64)> = [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)].iter().map(|(sx, sy)| (sx * pmx, sy * pmy, 1.35)).collect();
        for h in &holes { cut.push(circle(h.0, h.1, h.2, 0.0, 8)); }
        m.sheets.push(("kb_plate".into(), (widest + margin, rows * pch + margin), sheet_rects.clone(), holes));
    }
    let plate = prism(&rect(0.0, 0.0, widest + margin, rows * pch + margin, 0.0), &cut, Vector3::new(0.0, 0.0, k.plate_t));
    let pmat = if bv { "pcb" } else { "steel" };
    m.add_src("kb_plate", "keyboard_case", pmat, "kbpcb", vec![map(&plate, deck * tr(0.0, 0.0, pt - k.plate_t))], None,
              Src::Buy("스위치 플레이트 FR4 1.5t (PCB 업체 주문, cad/out/build/fab/kb_plate.dxf)".into()));
    m.buy("키보드 매트릭스 PCB (주문 제작) 또는 핸드와이어링 + 1N4148 × 49");
    m.add("kb_pcb", "keyboard_case", "pcb", "kbpcb", map(&bx(widest, rows * pch, 1.6, [0.0, 0.0, pt - 5.8]), deck));
    if bv {
        // plate screws: short bosses under the top wall (M2.5 self-tapping)
        for (i, (sx, sy)) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)].iter().enumerate() {
            let b = boss(3.5, 1.1, 5.0, 4.0);
            let o = at(sx * pmx, sy * pmy, -1.0);
            m.add_src(&format!("kb_plate_boss_{i}"), "keyboard_case", "keyboard", "kbcase", vec![map(&b, frame(o, dir(0.0, 0.0, -1.0), [1.0, 0.0, 0.0]))], None, Src::Fuse("kbcase".into()));
        }
        m.hw("M2.5 × 6 태핑 나사 (스위치 플레이트)", 4);
        m.hw("6.25u 플레이트 마운트 스태빌라이저", 1);
        // bottom plate and four columns from the top wall down to it
        let cx = k.W / 2.0 - k.wall - 3.5;
        let mut bholes = vec![];
        for (i, (sx, y)) in [(-1.0, yf_ + 20.0), (1.0, yf_ + 20.0), (-1.0, yb_ - 20.0), (1.0, yb_ - 20.0)].iter().enumerate() {
            let x = sx * cx;
            let z_ceil = k.h_front + th.tan() * (y - yf_) - k.wall / th.cos();
            m.insert_boss(&format!("kb_column_{i}"), "keyboard_case", "keyboard", "kbcase", [x, *y, z_ceil + 0.5], [0.0, 0.0, -1.0], z_ceil + 0.5 - 2.0, s);
            bholes.push(circle(x, *y, s.build.screw_clear_d / 2.0, 0.0, 8));
        }
        for side in [-1.0, 1.0] { bholes.push(rrect(side * (k.W / 2.0 - 40.0), yb_ - 21.0, 42.0, 28.0, 2.0, 0.0)); }
        let bottom = prism(&rrect(0.0, k.y, k.W - 2.0 * k.wall - 0.4, k.D - 2.0 * k.wall - 0.4, 6.0, 0.0), &bholes, Vector3::new(0.0, 0.0, 2.0));
        m.add_src("kb_bottom", "keyboard_case", "tray", "kbcase", vec![bottom], None, Src::Print("kbbottom".into()));
        m.hw("M3 × 6 볼트 (키보드 하판)", 4);
    }
    m.print("kbfeet");
    for side in [-1.0, 1.0] {   // flip-out feet  [ref: C64C / MSX rear feet]
        let xf = side * (k.W / 2.0 - 40.0);
        let l = if side < 0.0 { "kb_foot_l" } else { "kb_foot_r" };
        m.link(l, [xf, yb_ - 8.0, 0.0]);
        m.add(l, l, "tray", "kbcase", bx(40.0, 26.0, 5.0, [xf, yb_ - 21.0, 2.7]));
        m.joint(&format!("{l}_joint"), "revolute", "keyboard_case", l, [1.0, 0.0, 0.0], 0.0, 95f64.to_radians(), 1.0, 2.0);
    }
    let sw = mx_switch();
    let down = dir(0.0, 0.0, -1.0);
    for (c, u, v, kwu) in keys {
        let id = format!("key_{}", key_id(&c));
        m.buy("MX 호환 스위치 (Gateron / Cherry)");
        m.add_m(&format!("{id}_switch"), "keyboard_case", "switch", "kbpcb", map(&sw, deck * tr(u, v, pt)), Some(k.switch_mass_kg));
        let cap = keycap(kwu * pch - 0.85, pch - 0.85, 9.0);
        m.link(&id, at(u, v, pt + 6.5));
        let mat = if k.wide_u.contains_key(&c) { "keyB" } else { "keyA" };   // [ref: MSX / Canon Cat accent keys]
        m.buy(&format!("키캡 PBT {}u", kwu));
        m.add(&format!("{id}_cap"), &id, mat, "keycap", map(&cap, deck * tr(u, v, pt + 6.5)));
        // the stem is the switch slider: it rides with the keycap into the housing bore
        m.add_src(&format!("{id}_stem"), &id, "switch", "kbpcb", vec![map(&turned(&[(2.0, 6.0, 11.6)]), deck * tr(u, v, pt))], Some(0.0005),
                  Src::Buy("MX 호환 스위치 (Gateron / Cherry)".into()));
        m.joint(&format!("{id}_joint"), "prismatic", "keyboard_case", &id, down, 0.0, k.travel / 1000.0, 0.6, 0.5);
    }
    m.dim("keyboard_W", k.W); m.dim("keyboard_D", k.D); m.dim("keyboard_tilt_deg", th.to_degrees());
}

fn key_id(c: &str) -> String {
    match c { "-" => "minus", "=" => "equal", "[" => "lbracket", "]" => "rbracket", ";" => "semicolon", "'" => "quote",
              "," => "comma", "." => "period", "/" => "slash", _ => return c.to_lowercase() }.into()
}

// ============================================================ mouse  [ref: Apple M0100 - separate button plate]
fn mouse(m: &mut Model, s: &Spec) {
    let p = &s.mouse;
    let bv = m.build_v();
    let (x0, y0) = (p.x, p.y);
    let r = p.ball_d / 2.0;
    let (bx_, by_) = (x0, y0 + 15.0);
    let (sx0, sy0) = (x0, y0 + 5.0);   // build: optical sensor centre
    let sw_y = y0 - 34.0;              // build: micro switch under the button
    m.link("mouse_base", [x0, y0, 0.0]);
    m.print("mbase");
    let base_holes = if !bv { vec![circle(bx_, by_, 13.0, 0.0, 8)] } else {
        let mut h = vec![rrect(sx0, sy0, 12.0, 10.0, 1.5, 0.0), circle(sx0 - 12.0, sy0, 1.1, 0.0, 8), circle(sx0 + 12.0, sy0, 1.1, 0.0, 8)];
        for (cx, cy) in mouse_columns(p) { h.push(circle(cx, cy, s.build.screw_clear_d / 2.0, 0.0, 8)); }
        h
    };
    let base = prism(&rrect(x0, y0, p.W, p.D, 10.0, 0.0), &base_holes, Vector3::new(0.0, 0.0, 3.0));
    m.add("mouse_base", "mouse_base", "tray", "mshell", base);
    let (oy, ow, od) = (y0 - p.D / 2.0 + 24.0, 52.0, 36.0);
    m.print("mbody");
    let body = Cup { cx: x0, cy: y0, w: p.W, d: p.D, r: 10.0, t: 1.8, top0: p.H - 3.0, slope: 0.0,
                     top_holes: vec![rrect(x0, oy, ow, od, 3.0, 0.0)], wall_holes: Default::default() }.build("mouse body");
    m.add("mouse_shell", "mouse_base", "mouse", "mshell", map(&body, tr(0.0, 0.0, 3.0)));
    let hinge_y = oy + (od - 1.0) / 2.0;
    m.link("mouse_button", [x0, hinge_y, p.H - 3.0]);
    m.print("mbutton");
    m.add("mouse_button", "mouse_button", "trim", "mshell", prism(&rrect(x0, oy, ow - 1.0, od - 1.0, 2.5, p.H - 3.0), &[], Vector3::new(0.0, 0.0, 4.0)));
    // build: button travel ends on the micro switch (0.5 mm gap at rest)
    let hi = if bv { (0.45 / (hinge_y - sw_y)).atan() } else { 3f64.to_radians() };
    m.joint("mouse_button_joint", "revolute", "mouse_base", "mouse_button", [1.0, 0.0, 0.0], 0.0, hi, 0.3, 2.0);
    if !bv {
        m.link("mouse_ball", [bx_, by_, r + 0.3]);
        m.add_m("mouse_ball", "mouse_ball", "rubber", "ball", sphere(r, [bx_, by_, r + 0.3]), Some(p.ball_mass_kg));
        m.joint("mouse_ball_joint", "continuous", "mouse_base", "mouse_ball", [1.0, 0.0, 0.0], 0.0, 0.0, 0.1, 20.0);
        let seg = [(2.5, -12.0, -10.6), (5.0, -10.6, -9.4), (2.5, -9.4, 12.0)];
        for (n, axis, pos, ax) in [("x", 'Y', [bx_ + r + 3.0, by_ - 4.0, r + 0.3], [0.0, 1.0, 0.0]), ("y", 'X', [bx_ - 4.0, by_ + r + 3.0, r + 0.3], [1.0, 0.0, 0.0])] {
            let l = format!("mouse_roller_{n}");
            m.link(&l, pos);
            m.add(&l, &l, "alu", "encoder", turned_on(axis, &seg, pos));
            m.joint(&format!("{l}_joint"), "continuous", "mouse_base", &l, ax, 0.0, 0.0, 0.01, 60.0);
        }
    } else {
        // optical sensor module (lens in the base window), micro switch on a printed post under the button
        let ss = &s.build.mouse_sensor.size;
        m.add_src("mouse_sensor", "mouse_base", "pcb", "encoder",
                  vec![bx(ss[0], ss[1], 1.6, [sx0, sy0, 3.0 + ss[2] - 0.8]), bx(10.0, 8.0, 6.0, [sx0, sy0, 3.5])], Some(0.006),
                  Src::Buy(s.build.mouse_sensor.part.clone()));
        m.hw("M2 × 6 볼트 (센서 모듈)", 2);
        let ms = &s.build.mouse_switch.size;
        let post_top = p.H - 3.0 - 0.5 - ms[2];
        m.add_src("mouse_switch_post", "mouse_base", "tray", "mshell", vec![bx(14.0, 8.0, post_top - 2.0, [x0, sw_y, 2.0 + (post_top - 2.0) / 2.0])], None, Src::Fuse("mbase".into()));
        m.add_src("mouse_switch", "mouse_base", "chip", "mshell", vec![bx(ms[0], ms[1], ms[2], [x0, sw_y, post_top + ms[2] / 2.0])], Some(0.002),
                  Src::Buy(s.build.mouse_switch.part.clone()));
        for (i, (cx, cy)) in mouse_columns(p).into_iter().enumerate() {
            m.insert_boss(&format!("mouse_column_{i}"), "mouse_base", "mouse", "mbody", [cx, cy, p.H - 1.8 + 0.5], [0.0, 0.0, -1.0], p.H - 1.8 + 0.5 - 3.0, s);
        }
        m.hw("M3 × 6 볼트 (마우스 바닥)", 4);
        m.hw("RP2040 Zero + USB 케이블 (센서 → USB 변환)", 1);
    }
}

/// screw columns in the mouse body: two in the back corners, two mid-side (clear of the button opening)
fn mouse_columns(p: &crate::spec::Mouse) -> Vec<(f64, f64)> {
    let (x0, y0) = (p.x, p.y);
    vec![(x0 - 24.7, y0 + p.D / 2.0 - 6.3), (x0 + 24.7, y0 + p.D / 2.0 - 6.3), (x0 - (p.W / 2.0 - 5.3), y0), (x0 + (p.W / 2.0 - 5.3), y0)]
}
