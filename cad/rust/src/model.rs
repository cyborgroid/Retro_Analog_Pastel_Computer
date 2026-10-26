//! PASTELLA 84 v3 geometry, links and joints from spec.json (mm, kg).
//! Design features learned from reference photos are marked [ref: ...].

use crate::geom::*;
use crate::mesh::{MassProps, Mesh, V3};
use crate::spec::{Material, Spec};
use truck_modeling::Transform;
use std::collections::BTreeMap;

pub struct Part { pub name: String, pub link: String, pub mat: String, pub pick: &'static str, pub solids: Vec<Solid>, pub mass: Option<f64> }
pub struct Link { pub name: String, pub origin: V3 }
#[derive(Clone)]
pub struct Joint { pub name: String, pub kind: &'static str, pub parent: String, pub child: String, pub axis: V3, pub lo: f64, pub hi: f64, pub effort: f64, pub vel: f64 }

pub struct Model {
    pub parts: Vec<Part>,
    pub links: Vec<Link>,
    pub joints: Vec<Joint>,
    pub dims: BTreeMap<String, serde_json::Value>,
}

impl Model {
    fn add(&mut self, name: &str, link: &str, mat: &str, pick: &'static str, s: Solid) { self.add_m(name, link, mat, pick, s, None) }
    fn add_m(&mut self, name: &str, link: &str, mat: &str, pick: &'static str, s: Solid, mass: Option<f64>) {
        self.parts.push(Part { name: name.into(), link: link.into(), mat: mat.into(), pick, solids: vec![s], mass });
    }
    fn link(&mut self, name: &str, o: V3) { self.links.push(Link { name: name.into(), origin: o }) }
    #[allow(clippy::too_many_arguments)]
    fn joint(&mut self, name: &str, kind: &'static str, parent: &str, child: &str, axis: V3, lo: f64, hi: f64, effort: f64, vel: f64) {
        let n = (axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]).sqrt();
        self.joints.push(Joint { name: name.into(), kind, parent: parent.into(), child: child.into(), axis: axis.map(|a| a / n), lo, hi, effort, vel });
    }
    fn fixed(&mut self, name: &str, parent: &str, child: &str) { self.joint(name, "fixed", parent, child, [1.0, 0.0, 0.0], 0.0, 0.0, 0.0, 0.0) }
    fn dim(&mut self, k: &str, v: f64) { self.dims.insert(k.into(), serde_json::json!((v * 10.0).round() / 10.0)); }
}

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
const LEFT: usize = 3;

pub fn build(spec: &Spec, mats: &BTreeMap<String, Material>) -> Model {
    let mut m = Model { parts: vec![], links: vec![], joints: vec![], dims: BTreeMap::new() };
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
    let (w, d, t, y0) = (b.W, b.D, b.wall, b.y);
    let (z_tray0, z_lid0) = (b.feet_h, b.feet_h + b.H_tray);
    let z_top = z_lid0 + b.H_lid;
    m.link("base_tray", [0.0, y0, 0.0]);
    m.link("base_internal", [0.0, y0, z_lid0]);
    m.link("base_lid", [0.0, y0, z_lid0]);

    // tray: a lid-type cup flipped over -> closed floor at z = feet, open top  [ref: MSX two-tone, darker lower half]
    let tray = Cup { cx: 0.0, cy: y0, w, d, r: b.corner_r - 2.0, t, top0: b.H_tray, slope: 0.0, top_holes: vec![], wall_holes: Default::default() }.build("tray");
    m.add("tray", "base_tray", "tray", "tray", map(&tray, tr(0.0, 0.0, z_lid0) * ry(180.0)));
    for (i, (x, y)) in [(-190.0, -140.0), (190.0, -140.0), (-190.0, 140.0), (190.0, 140.0)].iter().enumerate() {
        m.add(&format!("foot_{i}"), "base_tray", "rubber", "tray", turned_on('Z', &[(8.5, 0.0, b.feet_h)], [*x, y0 + y, 0.0]));
    }

    // SPCC frame, standoffs, mainboard, ICs
    let zf = z_tray0 + t;
    m.add("frame_plate", "base_internal", "steel", "frame", bx(415.0, 315.0, 1.0, [0.0, y0, zf + 0.5]));
    for (i, (x, y)) in [(-175.0, -125.0), (0.0, -125.0), (175.0, -125.0), (-175.0, 125.0), (0.0, 125.0), (175.0, 125.0)].iter().enumerate() {
        m.add(&format!("standoff_{i}"), "base_internal", "alu", "frame", turned_on('Z', &[(4.0, 0.0, 6.0)], [*x, y0 + y, zf + 1.0]));
    }
    let zp = zf + 7.0;
    m.add("mainboard", "base_internal", "pcb", "mainboard", bx(390.0, 300.0, 1.6, [0.0, y0, zp + 0.8]));
    let zc = zp + 1.6;
    for (n, iw, id, x, y) in [("cpu", 52.0, 15.0, 10.0, -45.0), ("rom", 37.0, 15.0, 15.0, -95.0), ("sram0", 37.0, 15.0, -120.0, 40.0), ("sram1", 37.0, 15.0, -120.0, 80.0),
                               ("pico_video", 51.0, 21.0, 10.0, 15.0), ("pico_sound", 51.0, 21.0, -120.0, 105.0), ("ch376s", 30.0, 25.0, -35.0, -40.0)] {
        m.add(&format!("ic_{n}"), "base_internal", "chip", "ics", bx(iw, id, 5.0, [x, y0 + y, zc + 2.5]));
    }
    for i in 0..8 {
        m.add(&format!("ic_logic_{i}"), "base_internal", "chip", "ics", bx(7.0, 19.5, 4.5, [-25.0 + i as f64 * 15.0, y0 + 95.0, zc + 2.25]));
    }
    m.add("xtal", "base_internal", "alu", "ics", turned_on('X', &[(5.0, -5.5, 5.5)], [75.0, y0 - 45.0, zc + 5.5]));
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
    m.add_m("usb_bay", "base_internal", "steel", "floppy", bx(102.0, 150.0, 26.0, [-120.0, y0 - 83.0, zc + 13.0]), Some(0.32));
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
    let lid = Cup { cx: 0.0, cy: y0, w, d, r: b.corner_r, t, top0: b.H_lid, slope: 0.0, top_holes, wall_holes: walls }.build("lid");
    m.add("lid", "base_lid", "base", "lid", map(&lid, tr(0.0, 0.0, z_lid0)));
    let fy = y0 - d / 2.0;
    let zcf = z_lid0 + zm;
    m.add("usb_bay_bezel", "base_lid", "dark", "floppy", bx(92.0, 1.2, 5.0, [-120.0, fy + 1.0, zcf - 13.0]));
    m.add("eject_button", "base_lid", "trim", "floppy", bx(16.0, 3.0, 7.0, [-52.0, fy - 1.5, zcf - 21.0]));
    m.add("led_power", "base_lid", "led", "lid", turned_on('Y', &[(2.5, -3.0, 1.0)], [195.0, fy, zcf + 10.0]));
    m.add("brand_badge", "base_lid", "dark", "lid", bx(110.0, 0.8, 14.0, [-100.0, fy - 0.4, zcf + 17.0]));
    for i in 0..4 {   // [ref: Sega SC-3000 / Apple rainbow stripes, pastel]
        m.add(&format!("stripe_{i}"), "base_lid", &format!("stripe{}", i + 1), "lid", bx(40.0, 0.8, 3.2, [-185.0, fy - 0.4, zcf + 23.0 - i as f64 * 4.2]));
    }
    for (n, x) in [("vol", 50.0), ("tone", 100.0)] {
        let l = format!("dial_{n}");
        m.link(&l, [x, fy, zcf]);
        m.add(&format!("{l}_knob"), &l, "trim", "lid", turned_on('Y', &[(17.0, -10.0, 0.0), (3.0, 0.0, 14.0)], [x, fy, zcf]));
        m.add(&format!("{l}_mark"), &l, "dark", "lid", bx(2.4, 0.8, 8.0, [x, fy - 10.4, zcf + 9.0]));
        m.joint(&format!("{l}_joint"), "continuous", "base_lid", &l, [0.0, -1.0, 0.0], 0.0, 0.0, 0.2, 6.0);
    }
    // toggle: escutcheon plate with a lever slot, pivot behind the plate (inside the lid cut-out)
    let plate = prism(&rect(0.0, 0.0, 16.0, 24.0, 0.0), &[rrect(0.0, 0.0, 8.0, 16.0, 2.0, 0.0)], Vector3::new(0.0, 0.0, 2.0));
    m.add("toggle_plate", "base_lid", "dark", "lid", map(&plate, tr(160.0, fy - 2.0, zcf) * rx(-90.0)));
    m.link("power_toggle", [160.0, fy, zcf]);
    let lever = map(&turned(&[(2.6, 0.0, 20.5)]), tr(160.0, fy, zcf) * rx(60.0));
    m.add("toggle_lever", "power_toggle", "alu", "lid", lever);
    m.joint("power_toggle_joint", "revolute", "base_lid", "power_toggle", [1.0, 0.0, 0.0], -0.35, 0.35, 0.5, 4.0);
    m.dim("base_W", w); m.dim("base_D", d); m.dim("base_H", z_top);
    z_top
}

// ============================================================ monitor
fn monitor(m: &mut Model, s: &Spec, mats: &BTreeMap<String, Material>, z_lid_top: f64) {
    let p = &s.monitor;
    let a = p.aspect;
    let w = p.diag_in * 25.4 * a / (a * a + 1.0).sqrt();
    let h = w / a;
    let (bt, gap, chin) = (p.bezel, p.gap, p.chin);
    let (wm, hm) = (w + 2.0 * (bt + gap), h + 2.0 * (bt + gap) + chin);
    let depth = p.bezel_depth + p.depth_per_diag_mm * p.diag_in * 25.4;   // 125-degree super-slim CRT
    let (yf, yb) = (p.front_y, p.front_y + depth);
    let z0 = z_lid_top + p.stand_h;
    let zc = z0 + hm / 2.0;
    let zs = z0 + chin + bt + gap + h / 2.0;
    let body = "monitor_body";
    let front = tr(0.0, yf, 0.0) * rx(90.0);   // local XY (y = world z) -> front plane, local -Z -> +Y

    // bezel with stepped picture-frame recess  [ref: Macintosh Color Classic]
    let zk = z0 + (bt + chin) / 2.0 + 1.0;
    let knob_x: Vec<f64> = (0..3).map(|i| wm / 2.0 - 20.0 - 16.0 * i as f64).collect();
    let mut holes = vec![circle(-wm / 2.0 + 16.0, zk, 2.05, 0.0, 8)];
    holes.extend(knob_x.iter().map(|x| circle(*x, zk, 1.6, 0.0, 8)));
    let bez = stepped_ring((0.0, zc, wm, hm, 14.0),
                           (0.0, zs, w + 2.0 * gap + 2.0 * p.recess_step, h + 2.0 * gap + 2.0 * p.recess_step, 6.0), p.recess_depth,
                           (0.0, zs, w + 2.0 * gap, h + 2.0 * gap, 3.0), p.bezel_depth, &holes);
    m.add("bezel", body, "monitor", "bezel", map(&bez, front));

    // rear shell: flat bottom, top tapering to a 60 % x 70 % back  [ref: iMac G3 / Color Classic flat base]
    let (bw_, bh_) = (wm * 0.6, hm * 0.7);
    let cy_back = bh_ / 2.0 - hm / 2.0;
    let len = depth - p.bezel_depth;
    let vents: Vec<Loop> = (0..16).map(|i| rrect(0.0, cy_back + bh_ * 0.32 - i as f64 * bh_ * 0.04, bw_ * 0.44, 3.0, 1.4, 0.0)).collect();
    let shell = tapered_shell((wm, hm, 14.0), (bw_, bh_, 9.0), cy_back, len, p.wall, &vents);
    m.add("rear_shell", body, "monitor", "shell", map(&shell, tr(0.0, yf + p.bezel_depth, zc) * rx(90.0)));
    // screwed-on carry handle on the back  [ref: Canon Cat, Sharp X68000, iMac G3 handles]
    let zb = z0 + bh_ / 2.0;
    let handle = prism(&poly(&[(-56.0, 0.0), (-44.0, 0.0), (-44.0, 26.0), (44.0, 26.0), (44.0, 0.0), (56.0, 0.0), (56.0, 34.0), (-56.0, 34.0)], 0.0), &[], Vector3::new(0.0, 0.0, 24.0));
    m.add("carry_handle", body, "monitor", "shell", map(&handle, tr(0.0, yb, zb + 50.0)));

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
    m.add("brand_badge_monitor", body, "dark", "bezel", bx(62.0, 0.8, 10.0, [0.0, yf - 0.4, zk]));
    for (i, n) in ["bright", "vhold", "hsize"].iter().enumerate() {
        let l = format!("knob_{n}");
        m.link(&l, [knob_x[i], yf, zk]);
        m.add(&format!("{l}_cap"), &l, "trim", "bezel", turned_on('Y', &[(5.5, -6.0, 0.0), (1.5, 0.0, 10.0)], [knob_x[i], yf, zk]));
        m.joint(&format!("{l}_joint"), "continuous", body, &l, [0.0, -1.0, 0.0], 0.0, 0.0, 0.05, 6.0);
    }

    // tilt / swivel stand, pivot under the body's centre of mass
    let mps: Vec<MassProps> = m.parts.iter().filter(|q| q.link == body || q.link.starts_with("knob_")).map(|q| part_mass_props(q, mats, 0.6).1).collect();
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
    m.add("tilt_rocker", body, "monitor", "stand", map(&prism(&rocker, &[], Vector3::new(0.0, 0.0, 120.0)), yz));
    m.link("monitor_stand", [0.0, y_piv, z_lid_top]);
    m.link("monitor_swivel", [0.0, y_piv, z_lid_top + 8.0]);
    m.link(body, [0.0, y_piv, z_ax]);
    m.add("stand_base", "monitor_stand", "monitor", "stand", rbx(220.0, 150.0, 8.0, 20.0, [0.0, y_piv, z_lid_top + 4.0]));
    m.add("stand_neck", "monitor_swivel", "monitor", "stand", turned_on('Z', &[(36.0, 0.0, z_ax - 50.0 - z_lid_top - 8.0)], [0.0, y_piv, z_lid_top + 8.0]));
    m.add("tilt_cradle", "monitor_swivel", "monitor", "stand", map(&prism(&cradle, &[], Vector3::new(0.0, 0.0, 160.0)), yz));
    m.joint("monitor_swivel_joint", "revolute", "monitor_stand", "monitor_swivel", [0.0, 0.0, 1.0], p.swivel_deg[0].to_radians(), p.swivel_deg[1].to_radians(), 5.0, 1.0);
    m.joint("monitor_tilt_joint", "revolute", "monitor_swivel", body, [1.0, 0.0, 0.0], p.tilt_deg[0].to_radians(), p.tilt_deg[1].to_radians(), 20.0, 0.5);
    for (k, v) in [("screen_w", w), ("screen_h", h), ("monitor_W", wm), ("monitor_H", hm), ("monitor_D", depth), ("monitor_pivot_y", y_piv)] { m.dim(k, v); }
}

// ============================================================ keyboard
fn keyboard(m: &mut Model, s: &Spec) {
    let k = &s.keyboard;
    let pch = k.pitch;
    let (yf_, yb_) = (k.y - k.D / 2.0, k.y + k.D / 2.0);
    let th = (k.h_rear - k.h_front).atan2(k.D);
    let rows = k.rows.len() as f64;
    let vc = k.margin_front + rows * pch / 2.0;
    let deck = tr(0.0, yf_ + vc * th.cos(), k.h_front + vc * th.sin()) * rx(th.to_degrees());
    let at = |u: f64, v: f64, n: f64| -> V3 { let q = deck.transform_point(Point3::new(u, v, n)); [q.x, q.y, q.z] };
    let wu = |c: &str| *k.wide_u.get(c).unwrap_or(&1.0);
    let widest = k.rows.iter().map(|r| r.iter().map(|c| wu(c)).sum::<f64>()).fold(0.0, f64::max) * pch;
    m.link("keyboard_case", [0.0, k.y, 0.0]);

    // wedge case, open bottom, key well  [ref: Commodore 64C, MSX wedge housings]
    let well = rrect(0.0, yf_ + vc * th.cos(), widest + 3.0, (rows * pch + 3.0) * th.cos(), 2.0, 0.0);
    let case = Cup { cx: 0.0, cy: k.y, w: k.W, d: k.D, r: 8.0, t: k.wall, top0: k.h_front, slope: th.tan(), top_holes: vec![well], wall_holes: Default::default() }.build("keyboard case");
    m.add("keyboard_case", "keyboard_case", "keyboard", "kbcase", case);
    for i in 0..4 {
        m.add(&format!("kb_stripe_{i}"), "keyboard_case", &format!("stripe{}", i + 1), "kbcase",
              map(&bx(36.0, 3.0, 0.8, [-widest / 2.0 + 18.0, rows * pch / 2.0 + 8.0 + i as f64 * 4.2, 0.4]), deck));
    }
    // 1.5 mm steel plate with 14 mm MX cut-outs (+ 6.25u stabiliser), PCB, switches, hollow keycaps
    let pt = -k.plate_below_top;
    let mut keys = vec![];
    let mut cut = vec![];
    for (r, row) in k.rows.iter().enumerate() {
        let tot: f64 = row.iter().map(|c| wu(c)).sum::<f64>() * pch;
        let mut x = -tot / 2.0;
        for c in row {
            let kw = wu(c) * pch;
            let (u, v) = (x + kw / 2.0, (rows / 2.0 - r as f64 - 0.5) * pch);
            keys.push((c.clone(), u, v, wu(c)));
            cut.push(rect(u, v, 14.0, 14.0, 0.0));
            if wu(c) >= 2.0 { for sx in [-50.0, 50.0] { cut.push(rect(u + sx, v - 1.0, 7.0, 12.0, 0.0)); } }
            x += kw;
        }
    }
    let plate = prism(&rect(0.0, 0.0, widest + 12.0, rows * pch + 12.0, 0.0), &cut, Vector3::new(0.0, 0.0, k.plate_t));
    m.add("kb_plate", "keyboard_case", "steel", "kbpcb", map(&plate, deck * tr(0.0, 0.0, pt - k.plate_t)));
    m.add("kb_pcb", "keyboard_case", "pcb", "kbpcb", map(&bx(widest, rows * pch, 1.6, [0.0, 0.0, pt - 5.8]), deck));
    for side in [-1.0, 1.0] {   // flip-out feet  [ref: C64C / MSX rear feet]
        let xf = side * (k.W / 2.0 - 40.0);
        let l = if side < 0.0 { "kb_foot_l" } else { "kb_foot_r" };
        m.link(l, [xf, yb_ - 8.0, 0.0]);
        m.add(l, l, "tray", "kbcase", bx(40.0, 26.0, 5.0, [xf, yb_ - 21.0, 2.7]));
        m.joint(&format!("{l}_joint"), "revolute", "keyboard_case", l, [1.0, 0.0, 0.0], 0.0, 95f64.to_radians(), 1.0, 2.0);
    }
    let sw = mx_switch();
    let down = { let q = deck.transform_vector(Vector3::new(0.0, 0.0, -1.0)); [q.x, q.y, q.z] };
    for (c, u, v, kwu) in keys {
        let id = format!("key_{}", key_id(&c));
        m.add_m(&format!("{id}_switch"), "keyboard_case", "switch", "kbpcb", map(&sw, deck * tr(u, v, pt)), Some(k.switch_mass_kg));
        let cap = keycap(kwu * pch - 0.85, pch - 0.85, 9.0);
        m.link(&id, at(u, v, pt + 6.5));
        let mat = if k.wide_u.contains_key(&c) { "keyB" } else { "keyA" };   // [ref: MSX / Canon Cat accent keys]
        m.add(&format!("{id}_cap"), &id, mat, "keycap", map(&cap, deck * tr(u, v, pt + 6.5)));
        // the stem is the switch slider: it rides with the keycap into the housing bore
        m.add_m(&format!("{id}_stem"), &id, "switch", "kbpcb", map(&turned(&[(2.0, 6.0, 11.6)]), deck * tr(u, v, pt)), Some(0.0005));
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
    let (x0, y0) = (p.x, p.y);
    let r = p.ball_d / 2.0;
    let (bx_, by_) = (x0, y0 + 15.0);
    m.link("mouse_base", [x0, y0, 0.0]);
    let base = prism(&rrect(x0, y0, p.W, p.D, 10.0, 0.0), &[circle(bx_, by_, 13.0, 0.0, 8)], Vector3::new(0.0, 0.0, 3.0));
    m.add("mouse_base", "mouse_base", "tray", "mshell", base);
    let (oy, ow, od) = (y0 - p.D / 2.0 + 24.0, 52.0, 36.0);
    let body = Cup { cx: x0, cy: y0, w: p.W, d: p.D, r: 10.0, t: 1.8, top0: p.H - 3.0, slope: 0.0,
                     top_holes: vec![rrect(x0, oy, ow, od, 3.0, 0.0)], wall_holes: Default::default() }.build("mouse body");
    m.add("mouse_shell", "mouse_base", "mouse", "mshell", map(&body, tr(0.0, 0.0, 3.0)));
    m.link("mouse_button", [x0, oy + (od - 1.0) / 2.0, p.H - 3.0]);
    m.add("mouse_button", "mouse_button", "trim", "mshell", prism(&rrect(x0, oy, ow - 1.0, od - 1.0, 2.5, p.H - 3.0), &[], Vector3::new(0.0, 0.0, 4.0)));
    m.joint("mouse_button_joint", "revolute", "mouse_base", "mouse_button", [1.0, 0.0, 0.0], 0.0, 3f64.to_radians(), 0.3, 2.0);
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
}
