//! pastella-cad — PASTELLA 84 v3 CAD build (Rust only).
//!
//!   cad/spec.json --> B-rep solids (truck) --> STEP AP214 (names + colours)
//!                                         \-> meshes --> mass / inertia --> URDF + STL, USDA (UsdPhysics), GLB (web)
//!                                                    \-> checks: watertight, interference, joint sweeps
//!
//! Usage: cargo run --release -- [--spec cad/spec.json] [--out cad/out] [--palette "Mint Soda"]
//! Exit code 1 when a check fails.

mod check;
mod export;
mod geom;
mod mesh;
mod model;
mod spec;

use mesh::{combine, Aabb, MassProps, Mesh};
use rayon::prelude::*;
use serde_json::json;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

fn repo_root() -> PathBuf {
    let mut d = std::env::current_dir().unwrap();
    loop {
        if d.join("cad/spec.json").exists() { return d; }
        if !d.pop() { panic!("run inside the repository (cad/spec.json not found)"); }
    }
}

fn arg(name: &str) -> Option<String> {
    let a: Vec<String> = std::env::args().collect();
    a.iter().position(|x| x == name).and_then(|i| a.get(i + 1).cloned())
}

fn r1(x: f64) -> f64 { (x * 10.0).round() / 10.0 }
fn r3(x: f64) -> f64 { (x * 1000.0).round() / 1000.0 }

fn main() {
    let t0 = Instant::now();
    let root = repo_root();
    let spec_path = arg("--spec").map(PathBuf::from).unwrap_or(root.join("cad/spec.json"));
    let out = arg("--out").map(PathBuf::from).unwrap_or(root.join("cad/out"));
    let spec: spec::Spec = serde_json::from_str(&std::fs::read_to_string(&spec_path).expect("read spec")).expect("parse spec");
    let palette = arg("--palette").unwrap_or(spec.palette.default.clone());
    let mats = spec::materials(&spec, &std::fs::read_to_string(root.join(&spec.palette.source)).expect("read colorways"), &palette)
        .unwrap_or_else(|e| { eprintln!("error: {e}"); std::process::exit(2) });

    println!("[1/5] B-rep solids from {}", spec_path.display());
    let model = model::build(&spec, &mats);
    let solid_count: usize = model.parts.iter().map(|p| p.solids.len()).sum();
    println!("      {} parts, {} solids, {} links, {} joints ({:.1}s)", model.parts.len(), solid_count, model.links.len(), model.joints.len(), t0.elapsed().as_secs_f64());

    println!("[2/5] tessellation ({} mm) and mass properties", spec.tessellation_mm);
    let tol = spec.tessellation_mm;
    let pm: Vec<(Mesh, MassProps, bool)> = model.parts.par_iter().map(|p| {
        let mut mesh = Mesh::default();
        let mut closed = true;
        for s in &p.solids {
            let (pos, tris, c) = geom::tessellate(s, tol);
            closed &= c;
            mesh.append(&Mesh { p: pos, t: tris });
        }
        let rho = mats[&p.mat].density;
        let mut mp = mesh.mass_props(rho);
        if let Some(m) = p.mass { if mp.vol > 0.0 { mp = mesh.mass_props(m / mp.vol); } }
        (mesh, mp, closed)
    }).collect();
    let tris: usize = pm.iter().map(|x| x.0.t.len()).sum();
    println!("      {tris} triangles ({:.1}s)", t0.elapsed().as_secs_f64());

    let links: Vec<export::LinkOut> = model.links.iter().map(|l| {
        let idx: Vec<usize> = (0..model.parts.len()).filter(|&i| model.parts[i].link == l.name).collect();
        let mut meshes: BTreeMap<String, Mesh> = BTreeMap::new();
        for &i in &idx { meshes.entry(model.parts[i].mat.clone()).or_default().append(&pm[i].0.map(|q| mesh::sub(q, l.origin))); }
        let mp = (!idx.is_empty()).then(|| combine(&idx.iter().map(|&i| pm[i].1).collect::<Vec<_>>()));
        export::LinkOut { name: l.name.clone(), origin: l.origin, mp, meshes }
    }).collect();

    println!("[3/5] checks: watertight, interference, joint sweeps");
    let names: Vec<String> = model.parts.iter().map(|p| p.name.clone()).collect();
    let plinks: Vec<String> = model.parts.iter().map(|p| p.link.clone()).collect();
    let open: Vec<String> = (0..pm.len()).filter(|&i| !pm[i].2 || pm[i].1.vol <= 0.0).map(|i| names[i].clone()).collect();
    let bodies: Vec<check::Body> = pm.par_iter().map(|x| check::Body::new(x.0.clone())).collect();
    let clashes = check::nominal(&names, &bodies, spec.clash_threshold_mm3);
    let sweeps = check::sweeps(&model, &names, &plinks, &bodies, spec.clash_threshold_mm3);
    let sweep_clashes: usize = sweeps.iter().map(|s| s.clashes.len()).sum();
    println!("      open meshes {}, nominal clashes {}, sweep clashes {} over {} joints ({:.1}s)", open.len(), clashes.len(), sweep_clashes, sweeps.len(), t0.elapsed().as_secs_f64());

    println!("[4/5] exports -> {}", out.display());
    std::fs::create_dir_all(out.join("web")).unwrap();
    let (step_solids, step_bytes) = export::step(&model, &mats, &spec.name, &out.join("pastella84.step")).unwrap_or_else(|e| { eprintln!("error: {e}"); std::process::exit(1) });
    export::urdf(&model, &links, &mats, &out.join("urdf")).expect("urdf");
    export::usda(&model, &links, &mats, &out.join("pastella84.usda")).expect("usda");
    let parts_out: Vec<(String, String, String, &'static str, Mesh)> = model.parts.iter().zip(&pm).map(|(p, x)| (p.name.clone(), p.link.clone(), p.mat.clone(), p.pick, x.0.clone())).collect();
    let glb_bytes = export::glb(&model, &links, &parts_out, &mats, &out.join("web/pastella84.glb")).expect("glb");

    println!("[5/5] report, web data, dimensions");
    let module = |pre: &[&str]| -> (Aabb, f64) {
        let mut bb = Aabb::empty();
        let mut m = 0.0;
        for (i, p) in model.parts.iter().enumerate() {
            if pre.iter().any(|x| p.link.starts_with(x)) { bb.merge(&pm[i].0.aabb()); m += pm[i].1.mass; }
        }
        (bb, m)
    };
    let groups: [(&str, &[&str]); 4] = [("base_unit", &["base_", "dial_", "power_"]), ("monitor", &["monitor_", "knob_"]), ("keyboard", &["keyboard_", "key_", "kb_"]), ("mouse", &["mouse_"])];
    let mut modules = serde_json::Map::new();
    let mut mod_vals = BTreeMap::new();
    for (n, pre) in groups {
        let (bb, m) = module(pre);
        let s = bb.size();
        modules.insert(n.into(), json!({"bbox_mm": [r1(s[0]), r1(s[1]), r1(s[2])], "mass_kg": r3(m)}));
        mod_vals.insert(n, (s, m));
    }
    let body = links.iter().find(|l| l.name == "monitor_body").unwrap();
    let com_vs_pivot = mesh::sub(body.mp.unwrap().com, body.origin).map(r1);
    let ok = open.is_empty() && clashes.is_empty() && sweep_clashes == 0 && step_solids == solid_count;
    let report = json!({
        "name": spec.name, "revision": spec.revision, "palette": palette, "generator": "pastella-cad (Rust, truck B-rep)",
        "counts": {"parts": model.parts.len(), "solids": solid_count, "links": model.links.len(), "joints": model.joints.len(),
                   "movable_joints": model.joints.iter().filter(|j| j.kind != "fixed").count(), "triangles": tris},
        "dims_mm": model.dims, "modules": modules, "monitor_com_vs_pivot_mm": com_vs_pivot,
        "checks": {"ok": ok, "open_meshes": open, "nominal_clashes": clashes, "sweeps": sweeps, "step_solids": step_solids,
                   "clash_threshold_mm3": spec.clash_threshold_mm3},
        "links": links.iter().filter_map(|l| l.mp.map(|mp| json!({"name": l.name, "mass_kg": mp.mass, "com_mm": mp.com, "inertia_kgmm2": mp.inertia}))).collect::<Vec<_>>(),
        "parts": model.parts.iter().zip(&pm).map(|(p, x)| json!({"name": p.name, "link": p.link, "mat": p.mat, "pick": p.pick,
                   "mass_kg": x.1.mass, "volume_mm3": r1(x.1.vol), "triangles": x.0.t.len(), "explicit_mass": p.mass.is_some()})).collect::<Vec<_>>(),
        "files": {"step": "cad/out/pastella84.step", "urdf": "cad/out/urdf/pastella84.urdf", "usda": "cad/out/pastella84.usda", "glb": "cad/out/web/pastella84.glb",
                  "step_bytes": step_bytes, "glb_bytes": glb_bytes},
    });
    std::fs::write(out.join("report.json"), serde_json::to_string_pretty(&report).unwrap()).unwrap();
    write_web(&root, &report, &model);
    write_dimensions(&root, &mod_vals, &spec);
    println!("done in {:.1}s - {}", t0.elapsed().as_secs_f64(), if ok { "all checks passed" } else { "CHECKS FAILED (see cad/out/report.json)" });
    if !ok { std::process::exit(1); }
}

/// src/js/data/cad.js — what the workbench reads (Chassis tab, CAD v3 view).
fn write_web(root: &Path, report: &serde_json::Value, model: &model::Model) {
    let web = json!({
        "revision": report["revision"], "palette": report["palette"], "glb": "cad/out/web/pastella84.glb",
        "dims": report["dims_mm"], "modules": report["modules"], "counts": report["counts"],
        "checks": {"ok": report["checks"]["ok"], "nominal": report["checks"]["nominal_clashes"].as_array().map(|a| a.len()),
                   "sweepJoints": report["checks"]["sweeps"].as_array().map(|a| a.len()),
                   "sweepClashes": report["checks"]["sweeps"].as_array().map(|a| a.iter().map(|s| s["clashes"].as_array().map(|c| c.len()).unwrap_or(0)).sum::<usize>())},
        "files": report["files"],
        "joints": model.joints.iter().filter(|j| j.kind != "fixed").map(|j| json!({"name": j.name, "type": j.kind, "child": j.child, "lower": j.lo, "upper": j.hi})).collect::<Vec<_>>(),
    });
    let js = format!("/* generated by cad/rust (pastella-cad) from cad/spec.json - do not edit; rebuild with cad/build.sh */\n(function (PX) {{\n  PX.DATA.CAD = {};\n}})(window.PX);\n",
                     serde_json::to_string_pretty(&web).unwrap().replace('\n', "\n  "));
    std::fs::write(root.join("src/js/data/cad.js"), js).unwrap();
}

fn write_dimensions(root: &Path, m: &BTreeMap<&str, (mesh::V3, f64)>, spec: &spec::Spec) {
    let row = |k: &str| { let (s, mass) = m[k]; (r1(s[0]), r1(s[2]), r1(s[1]), r3(mass)) };
    let (bw, bh, bd, bm) = row("base_unit");
    let (mw, mh, md, mm) = row("monitor");
    let (kw, kh, kd, km) = row("keyboard");
    let (sw, sh, sd, sm) = row("mouse");
    let csv = format!("module,width_mm,height_mm,depth_mm,mass_kg,shell_material,wall_mm,controls,key_parts\n\
base_unit,{bw},{bh},{bd},{bm},ABS + SPCC chassis,{},\"rotary VOL, rotary TONE, toggle power\",\"PX-80 mainboard, linear PSU, USB storage bay\"\n\
monitor_{}w,{mw},{mh},{md},{mm},ABS,{},\"BRIGHT, V-HOLD, H-SIZE knobs\",\"{}in 16:10 super-slim CRT, yoke, flyback, degauss coil, carry handle\"\n\
keyboard,{kw},{kh},{kd},{km},ABS,{},-,\"{} keys, MX-compatible, 19.05 mm pitch, 8x8 matrix, 1N4148 x49\"\n\
mouse,{sw},{sh},{sd},{sm},ABS,1.8,-,\"rubber ball {}mm, chopper rollers x2, photo-interrupters x4\"\n",
        spec.base.wall, spec.monitor.diag_in, spec.monitor.wall, spec.monitor.diag_in, spec.keyboard.wall,
        spec.keyboard.rows.iter().map(|r| r.len()).sum::<usize>(), spec.mouse.ball_d);
    std::fs::write(root.join("environments/chassis/dimensions.csv"), csv).unwrap();
}
