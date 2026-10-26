//! pastella-cad — PASTELLA 84 CAD build (Rust only), two variants from one spec:
//!
//!   concept (cad/out)        the retro CRT design the workbench simulates
//!   build   (cad/out/build)  what can be built today: LCD, DC adapter, FDM-printed housings, bought parts
//!
//!   cad/spec.json --> B-rep solids (truck) --> STEP AP214 (names + colours)
//!                                         \-> meshes --> mass / inertia --> URDF + STL, USDA (UsdPhysics), GLB (web)
//!                                                    \-> checks: watertight, interference, joint sweeps
//!   build only:   printed groups --> union / cut / orient / split to the bed + seam joints --> print STLs,
//!                 print plan, BOM, DXF (boolmesh)
//!
//! Usage: cargo run --release -- [--spec cad/spec.json] [--palette "Mint Soda"]
//! Exit code 1 when a check fails.

mod check;
mod export;
mod fab;
mod geom;
mod mesh;
mod model;
mod spec;

use mesh::{combine, Aabb, MassProps, Mesh};
use model::{Src, Variant};
use rayon::prelude::*;
use serde_json::{json, Value};
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
    let spec: spec::Spec = serde_json::from_str(&std::fs::read_to_string(&spec_path).expect("read spec")).expect("parse spec");
    let palette = arg("--palette").unwrap_or(spec.palette.default.clone());
    let mats = spec::materials(&spec, &std::fs::read_to_string(root.join(&spec.palette.source)).expect("read colorways"), &palette)
        .unwrap_or_else(|e| { eprintln!("error: {e}"); std::process::exit(2) });

    let concept = run(&root, &spec, &mats, &palette, Variant::Concept, t0);
    let build = run(&root, &spec, &mats, &palette, Variant::Build, t0);
    write_web(&root, &concept, &build);
    write_dimensions(&root, &concept, &spec);
    let ok = concept["checks"]["ok"].as_bool().unwrap() && build["checks"]["ok"].as_bool().unwrap();
    println!("done in {:.1}s - {}", t0.elapsed().as_secs_f64(), if ok { "all checks passed" } else { "CHECKS FAILED (see cad/out/report.json, cad/out/build/report.json)" });
    if !ok { std::process::exit(1); }
}

fn run(root: &Path, spec: &spec::Spec, mats: &BTreeMap<String, spec::Material>, palette: &str, variant: Variant, t0: Instant) -> Value {
    let (tag, rel) = match variant { Variant::Concept => ("concept", "cad/out"), Variant::Build => ("build", "cad/out/build") };
    let out = root.join(rel);
    let tol = spec.tessellation_mm;
    println!("== {tag} -> {rel}");
    println!("[1/6] B-rep solids from {}", spec.name);
    let mut model = model::build(spec, mats, variant);

    // ---- build: seam joints, print pieces, BOM, DXF (needs the Cut parts, which are then dropped)
    let mut fab_json = Value::Null;
    if variant == Variant::Build {
        println!("[2/6] print plan: bed {:?} mm, seam joints, pieces", spec.build.printer.bed);
        let seams = fab::add_seam_joints(&mut model, spec, tol.max(0.2));
        let plan = fab::print_plan(&model, spec, seams, tol.max(0.2), &out.join("print"));
        std::fs::create_dir_all(out.join("fab")).unwrap();
        for (name, outline, rects, circles) in &model.sheets { fab::dxf(&out.join(format!("fab/{name}.dxf")), *outline, rects, circles).unwrap(); }
        let bom = fab::bom(&model);
        write_fab_docs(&out, &plan, &bom, spec);
        println!("      {} pieces, {} seams / {} joints, {:.0} g PLA, {:.1} h, errors {}", plan.pieces.len(), plan.seams.len(),
                 plan.seams.iter().map(|s| s.joints).sum::<usize>(), plan.total_grams, plan.total_hours, plan.errors.len());
        fab_json = json!({"plan": plan, "bom": bom.iter().map(|(c, i, n)| json!({"category": c, "item": i, "qty": n})).collect::<Vec<_>>()});
    }
    model.parts.retain(|p| !matches!(p.src, Src::Cut(_)));
    let solid_count: usize = model.parts.iter().map(|p| p.solids.len()).sum();
    println!("      {} parts, {} solids, {} links, {} joints ({:.1}s)", model.parts.len(), solid_count, model.links.len(), model.joints.len(), t0.elapsed().as_secs_f64());

    println!("[3/6] tessellation ({} mm) and mass properties", tol);
    let pla = spec.build.filament.density_g_cm3 * 1e-6;
    let pm: Vec<(Mesh, MassProps, bool)> = model.parts.par_iter().map(|p| {
        let mut mesh = Mesh::default();
        let mut closed = true;
        for s in &p.solids {
            let (pos, tris, c) = geom::tessellate(s, tol);
            closed &= c;
            mesh.append(&Mesh { p: pos, t: tris });
        }
        let rho = if p.src.printed() { pla } else { mats[&p.mat].density };
        let mut mp = mesh.mass_props(rho);
        if let Some(m) = p.mass { if mp.vol > 0.0 { mp = mesh.mass_props(m / mp.vol); } }
        (mesh, mp, closed)
    }).collect();
    let tris: usize = pm.iter().map(|x| x.0.t.len()).sum();
    let links: Vec<export::LinkOut> = model.links.iter().map(|l| {
        let idx: Vec<usize> = (0..model.parts.len()).filter(|&i| model.parts[i].link == l.name).collect();
        let mut meshes: BTreeMap<String, Mesh> = BTreeMap::new();
        for &i in &idx { meshes.entry(model.parts[i].mat.clone()).or_default().append(&pm[i].0.map(|q| mesh::sub(q, l.origin))); }
        let mp = (!idx.is_empty()).then(|| combine(&idx.iter().map(|&i| pm[i].1).collect::<Vec<_>>()));
        export::LinkOut { name: l.name.clone(), origin: l.origin, mp, meshes }
    }).collect();

    println!("[4/6] checks: watertight, interference, joint sweeps");
    let names: Vec<String> = model.parts.iter().map(|p| p.name.clone()).collect();
    let plinks: Vec<String> = model.parts.iter().map(|p| p.link.clone()).collect();
    let grp: Vec<Option<String>> = model.parts.iter().map(|p| if p.src.printed() { p.src.group().map(String::from) } else { None }).collect();
    let open: Vec<String> = (0..pm.len()).filter(|&i| !pm[i].2 || pm[i].1.vol <= 0.0).map(|i| names[i].clone()).collect();
    let bodies: Vec<check::Body> = pm.par_iter().map(|x| check::Body::new(x.0.clone())).collect();
    let clashes = check::nominal(&names, &bodies, &grp, spec.clash_threshold_mm3);
    let sweeps = check::sweeps(&model, &names, &plinks, &bodies, &grp, spec.clash_threshold_mm3);
    let sweep_clashes: usize = sweeps.iter().map(|s| s.clashes.len()).sum();
    println!("      open meshes {}, nominal clashes {}, sweep clashes {} over {} joints ({:.1}s)", open.len(), clashes.len(), sweep_clashes, sweeps.len(), t0.elapsed().as_secs_f64());

    println!("[5/6] exports");
    std::fs::create_dir_all(out.join("web")).unwrap();
    let (step_solids, step_bytes) = export::step(&model, mats, &spec.name, &out.join("pastella84.step")).unwrap_or_else(|e| { eprintln!("error: {e}"); std::process::exit(1) });
    export::urdf(&model, &links, mats, &out.join("urdf")).expect("urdf");
    export::usda(&model, &links, mats, &out.join("pastella84.usda")).expect("usda");
    let parts_out: Vec<(String, String, String, &'static str, Mesh)> = model.parts.iter().zip(&pm).map(|(p, x)| (p.name.clone(), p.link.clone(), p.mat.clone(), p.pick, x.0.clone())).collect();
    let glb_bytes = export::glb(&model, &links, &parts_out, mats, &out.join("web/pastella84.glb")).expect("glb");

    println!("[6/6] report");
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
    for (n, pre) in groups {
        let (bb, m) = module(pre);
        let s = bb.size();
        modules.insert(n.into(), json!({"bbox_mm": [r1(s[0]), r1(s[1]), r1(s[2])], "mass_kg": r3(m)}));
    }
    let body = links.iter().find(|l| l.name == "monitor_body").unwrap();
    let com_vs_pivot = mesh::sub(body.mp.unwrap().com, body.origin).map(r1);
    let fab_ok = fab_json.is_null() || fab_json["plan"]["errors"].as_array().map(|e| e.is_empty()).unwrap_or(false)
        && fab_json["plan"]["seams"].as_array().map(|s| s.iter().all(|x| x["joints"].as_u64().unwrap_or(0) > 0 || x["group"].as_str().map(|g| g.starts_with("stand") || g.starts_with('m')).unwrap_or(false))).unwrap_or(true);
    let ok = open.is_empty() && clashes.is_empty() && sweep_clashes == 0 && step_solids == solid_count && fab_ok;
    let report = json!({
        "name": spec.name, "revision": spec.revision, "variant": tag, "palette": palette, "generator": "pastella-cad (Rust, truck B-rep + boolmesh)",
        "counts": {"parts": model.parts.len(), "solids": solid_count, "links": model.links.len(), "joints": model.joints.len(),
                   "movable_joints": model.joints.iter().filter(|j| j.kind != "fixed").count(), "triangles": tris},
        "dims_mm": model.dims, "modules": modules, "monitor_com_vs_pivot_mm": com_vs_pivot,
        "checks": {"ok": ok, "open_meshes": open, "nominal_clashes": clashes, "sweeps": sweeps, "step_solids": step_solids,
                   "clash_threshold_mm3": spec.clash_threshold_mm3, "fab_ok": fab_ok},
        "links": links.iter().filter_map(|l| l.mp.map(|mp| json!({"name": l.name, "mass_kg": mp.mass, "com_mm": mp.com, "inertia_kgmm2": mp.inertia}))).collect::<Vec<_>>(),
        "parts": model.parts.iter().zip(&pm).map(|(p, x)| json!({"name": p.name, "link": p.link, "mat": p.mat, "pick": p.pick,
                   "mass_kg": x.1.mass, "volume_mm3": r1(x.1.vol), "triangles": x.0.t.len(), "explicit_mass": p.mass.is_some(),
                   "source": match &p.src { Src::Concept => "concept".to_string(), Src::Print(g) => format!("print:{g}"), Src::Fuse(g) => format!("fuse:{g}"), Src::Buy(i) => format!("buy:{i}"), Src::Cut(g) => format!("cut:{g}") }})).collect::<Vec<_>>(),
        "files": {"step": format!("{rel}/pastella84.step"), "urdf": format!("{rel}/urdf/pastella84.urdf"), "usda": format!("{rel}/pastella84.usda"), "glb": format!("{rel}/web/pastella84.glb"),
                  "step_bytes": step_bytes, "glb_bytes": glb_bytes},
        "fab": fab_json,
    });
    std::fs::write(out.join("report.json"), serde_json::to_string_pretty(&report).unwrap()).unwrap();
    println!("      {tag}: {}", if ok { "checks passed" } else { "CHECKS FAILED" });
    report
}

/// print-plan.md and bom.csv for the build variant
fn write_fab_docs(out: &Path, plan: &fab::Plan, bom: &[(String, String, usize)], spec: &spec::Spec) {
    let b = &spec.build;
    let mut md = format!("# 3D 프린팅 계획 (자동 생성)\n\n`cad/rust`가 `cad/spec.json`에서 만듭니다. 조각 STL은 `print/`에 베드 위 출력 방향으로 놓여 있습니다.\n\n\
- 프린터: {} — 베드 {} × {} × {} mm (가장자리 여유 {} mm)\n- 필라멘트: {} ({} g/cm³), 추정 {:.0} g · {:.1} 시간 · 약 {:.0}원 (kg당 {:.0}원 가정)\n\
- 열압입 인서트: {} — 구멍 Ø{} × 깊이 {} mm (출력물마다 시험 출력으로 조정)\n- 시간은 출력 부피 ÷ {} mm³/s 로 계산한 하한입니다. 실제 시간은 슬라이서 결과를 따르세요.\n\n",
        b.printer.name, b.printer.bed[0], b.printer.bed[1], b.printer.bed[2], b.printer.margin, b.filament.name, b.filament.density_g_cm3,
        plan.total_grams, plan.total_hours, plan.filament_cost_krw, b.filament.price_krw_per_kg, b.insert.spec, b.insert.hole_d, b.insert.depth, b.filament.flow_mm3_s);
    md.push_str(&format!("## 조각 {}개\n\n| 파일 | 그룹 | 크기 W × D × H (mm) | 무게 (g) | 시간 (h) | 서포트 면적 (cm²) | {} |\n|---|---|---|---:|---:|---:|---|\n",
        plan.pieces.len(), b.printer_alt.name));
    for p in &plan.pieces {
        md.push_str(&format!("| `{}` | {} | {} × {} × {} | {} | {} | {} | {} |\n", p.file, p.label, p.size_mm[0], p.size_mm[1], p.size_mm[2], p.grams, p.hours, p.support_cm2, if p.fits_alt { "가능" } else { "분할 필요" }));
    }
    md.push_str("\n## 분할 이음\n\n각 이음에는 이음선 양쪽에 M3 인서트 보스 한 쌍과 출력 연결판(38 × 9 × 3 mm, `splices__*.stl`)이 들어갑니다. 조각을 맞대고 연결판을 M3 × 8 볼트로 고정하세요. 맞댄 면에 순간접착제나 3D 펜을 함께 쓰면 더 단단합니다.\n\n| 그룹 | 분할면 법선 | 위치 (mm) | 이음 수 |\n|---|---|---:|---:|\n");
    for s in &plan.seams { md.push_str(&format!("| {} | ({:.2}, {:.2}, {:.2}) | {:.1} | {} |\n", s.group, s.plane_normal[0], s.plane_normal[1], s.plane_normal[2], s.offset_mm, s.joints)); }
    if !plan.errors.is_empty() { md.push_str("\n## 오류\n\n"); for e in &plan.errors { md.push_str(&format!("- {e}\n")); } }
    std::fs::write(out.join("print-plan.md"), md).unwrap();
    let mut csv = String::from("category,item,qty\n");
    for (c, i, n) in bom { csv.push_str(&format!("{c},\"{}\",{n}\n", i.replace('"', "\"\""))); }
    for p in &plan.pieces { csv.push_str(&format!("출력 부품,\"{} ({})\",1\n", p.file, p.label)); }
    std::fs::write(out.join("bom.csv"), csv).unwrap();
}

/// src/js/data/cad.js — what the workbench reads (Chassis tab, CAD view: build and concept variants).
fn write_web(root: &Path, concept: &Value, build: &Value) {
    let summary = |r: &Value| json!({
        "variant": r["variant"], "revision": r["revision"], "palette": r["palette"], "glb": r["files"]["glb"],
        "dims": r["dims_mm"], "modules": r["modules"], "counts": r["counts"],
        "checks": {"ok": r["checks"]["ok"], "nominal": r["checks"]["nominal_clashes"].as_array().map(|a| a.len()),
                   "sweepJoints": r["checks"]["sweeps"].as_array().map(|a| a.len()),
                   "sweepClashes": r["checks"]["sweeps"].as_array().map(|a| a.iter().map(|s| s["clashes"].as_array().map(|c| c.len()).unwrap_or(0)).sum::<usize>())},
        "files": r["files"],
        "print": if r["fab"].is_null() { Value::Null } else { json!({"pieces": r["fab"]["plan"]["pieces"].as_array().map(|a| a.len()),
            "grams": r["fab"]["plan"]["total_grams"], "hours": r["fab"]["plan"]["total_hours"], "costKrw": r["fab"]["plan"]["filament_cost_krw"],
            "joints": r["fab"]["plan"]["seams"].as_array().map(|a| a.iter().map(|s| s["joints"].as_u64().unwrap_or(0)).sum::<u64>()),
            "bomLines": r["fab"]["bom"].as_array().map(|a| a.len())}) },
    });
    let web = json!({ "default": "build", "build": summary(build), "concept": summary(concept) });
    let js = format!("/* generated by cad/rust (pastella-cad) from cad/spec.json - do not edit; rebuild with cad/build.sh */\n(function (PX) {{\n  PX.DATA.CAD = {};\n}})(window.PX);\n",
                     serde_json::to_string_pretty(&web).unwrap().replace('\n', "\n  "));
    std::fs::write(root.join("src/js/data/cad.js"), js).unwrap();
}

fn write_dimensions(root: &Path, r: &Value, spec: &spec::Spec) {
    let row = |k: &str| { let m = &r["modules"][k]; let b = m["bbox_mm"].as_array().unwrap(); (b[0].as_f64().unwrap(), b[2].as_f64().unwrap(), b[1].as_f64().unwrap(), m["mass_kg"].as_f64().unwrap()) };
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
