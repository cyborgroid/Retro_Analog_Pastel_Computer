//! Writers: STEP (names + colours), URDF + STL, USDA (UsdPhysics), GLB (web), web data, CSV.

use crate::mesh::*;
use crate::model::Model;
use crate::spec::Material;
use std::collections::BTreeMap;
use std::fmt::Write as _;
use std::path::Path;

/// Per-link data in the link frame.
pub struct LinkOut {
    pub name: String,
    pub origin: V3,
    pub mp: Option<MassProps>,
    /// material -> mesh (mm, link frame)
    pub meshes: BTreeMap<String, Mesh>,
}

fn f(x: f64) -> String {
    let s = format!("{:.6}", x);
    let s = s.trim_end_matches('0').trim_end_matches('.').to_string();
    if s == "-0" || s.is_empty() { "0".into() } else { s }
}
fn v3(a: V3) -> String { format!("{} {} {}", f(a[0]), f(a[1]), f(a[2])) }
fn tup(a: V3) -> String { format!("({}, {}, {})", f(a[0]), f(a[1]), f(a[2])) }

// ------------------------------------------------------------------ STEP
/// truck writes one product with unnamed solids; add AP214 schema, product/solid names and colours.
pub fn step(model: &Model, mats: &BTreeMap<String, Material>, spec_name: &str, path: &Path) -> Result<(usize, usize), String> {
    use truck_stepio::out;
    let comp: Vec<_> = model.parts.iter().flat_map(|p| p.solids.iter().map(|s| s.compress())).collect();
    let names: Vec<(String, String)> = model.parts.iter().flat_map(|p| p.solids.iter().enumerate().map(move |(i, _)| {
        (if p.solids.len() > 1 { format!("{}_{i}", p.name) } else { p.name.clone() }, p.mat.clone())
    })).collect();
    let header = out::StepHeaderDescriptor {
        file_name: "pastella84.step".into(),
        authors: vec!["pastella-cad".into()],
        organization_system: "pastella-cad (truck)".into(),
        ..Default::default()
    };
    let raw = out::CompleteStepDisplay::new(out::StepModels::from_iter(comp.iter()), header).to_string();
    let mut text = String::with_capacity(raw.len() + names.len() * 600);
    let mut ids = vec![];
    let mut k = 0;
    let mut max_id = 0usize;
    for line in raw.lines() {
        if let Some(rest) = line.strip_prefix('#') {
            if let Some((id, _)) = rest.split_once(' ') { if let Ok(n) = id.parse::<usize>() { max_id = max_id.max(n); } }
        }
        let mut l = line.to_string();
        if l.starts_with("FILE_SCHEMA(") { l = "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));".into(); }
        if l.starts_with("FILE_DESCRIPTION(") { l = format!("FILE_DESCRIPTION(('{spec_name} v3 assembly, mm, Z up'), '2;1');"); }
        if l.starts_with("FILE_NAME(") { l = "FILE_NAME('pastella84.step', '', ('pastella-cad'), (''), 'truck 0.6', 'pastella-cad', '');".into(); }
        if l.contains("= PRODUCT('',") { l = l.replacen("PRODUCT('','',''", "PRODUCT('PASTELLA84','PASTELLA 84 v3','retro analog pastel computer'", 1); }
        if l.contains("= MANIFOLD_SOLID_BREP('',") {
            let id: usize = l[1..l.find(' ').unwrap()].parse().unwrap();
            l = l.replacen("MANIFOLD_SOLID_BREP(''", &format!("MANIFOLD_SOLID_BREP('{}'", names[k].0), 1);
            ids.push((id, names[k].1.clone()));
            k += 1;
        }
        if l == "ENDSEC;" && text.contains("\nDATA;") && !ids.is_empty() && !text.contains("MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION") {
            // colours: one style chain per material, one STYLED_ITEM per solid
            let ctx_id = raw.lines().find(|x| x.contains("ADVANCED_BREP_SHAPE_REPRESENTATION")).and_then(|x| x.rsplit('#').next())
                .map(|x| x.trim_end_matches(");").to_string()).unwrap_or_default();
            let mut n = max_id;
            let mut style = BTreeMap::new();
            let mut items = vec![];
            for (sid, mat) in &ids {
                let psa = *style.entry(mat.clone()).or_insert_with(|| {
                    let c = mats[mat].rgb;
                    let b = n + 1;
                    let _ = writeln!(text, "#{} = COLOUR_RGB('{mat}', {}, {}, {});", b, f(c[0]), f(c[1]), f(c[2]));
                    let _ = writeln!(text, "#{} = FILL_AREA_STYLE_COLOUR('', #{});", b + 1, b);
                    let _ = writeln!(text, "#{} = FILL_AREA_STYLE('', (#{}));", b + 2, b + 1);
                    let _ = writeln!(text, "#{} = SURFACE_STYLE_FILL_AREA(#{});", b + 3, b + 2);
                    let _ = writeln!(text, "#{} = SURFACE_SIDE_STYLE('', (#{}));", b + 4, b + 3);
                    let _ = writeln!(text, "#{} = SURFACE_STYLE_USAGE(.BOTH., #{});", b + 5, b + 4);
                    let _ = writeln!(text, "#{} = PRESENTATION_STYLE_ASSIGNMENT((#{}));", b + 6, b + 5);
                    n += 7;
                    b + 6
                });
                n += 1;
                let _ = writeln!(text, "#{n} = STYLED_ITEM('color', (#{psa}), #{sid});");
                items.push(format!("#{n}"));
            }
            n += 1;
            let _ = writeln!(text, "#{n} = MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION('', ({}), #{ctx_id});", items.join(", "));
        }
        text.push_str(&l);
        text.push('\n');
    }
    if k != names.len() { return Err(format!("STEP: expected {} solids, wrote {k}", names.len())); }
    ruststep::parser::parse(&text).map_err(|e| format!("STEP re-parse failed: {e:?}"))?;
    std::fs::write(path, &text).map_err(|e| e.to_string())?;
    Ok((k, text.len()))
}

// ------------------------------------------------------------------ STL / URDF
pub fn stl(path: &Path, m: &Mesh, k: f64) -> std::io::Result<()> {
    let mut b = Vec::with_capacity(84 + m.t.len() * 50);
    let mut head = b"PASTELLA84 v3 pastella-cad".to_vec();
    head.resize(80, b' ');
    b.extend(head);
    b.extend((m.t.len() as u32).to_le_bytes());
    for i in 0..m.t.len() {
        let t = m.tri(i);
        let n = unit(cross(sub(t[1], t[0]), sub(t[2], t[0])));
        for x in n { b.extend((x as f32).to_le_bytes()); }
        for p in t { for x in p { b.extend(((x * k) as f32).to_le_bytes()); } }
        b.extend([0u8, 0]);
    }
    std::fs::write(path, b)
}

pub fn urdf(model: &Model, links: &[LinkOut], mats: &BTreeMap<String, Material>, dir: &Path) -> std::io::Result<String> {
    std::fs::create_dir_all(dir.join("meshes"))?;
    let mut u = String::from("<?xml version=\"1.0\"?>\n<!-- generated by cad/rust (pastella-cad) from cad/spec.json - do not edit -->\n<robot name=\"pastella84\">\n");
    for (n, m) in mats {
        let _ = writeln!(u, "  <material name=\"{n}\"><color rgba=\"{} {}\"/></material>", v3(m.rgb), f(m.opacity));
    }
    for l in links {
        let _ = writeln!(u, "  <link name=\"{}\">", l.name);
        if let Some(mp) = &l.mp {
            let c = scale(sub(mp.com, l.origin), 1e-3);
            let i = mp.inertia.map(|r| r.map(|x| x * 1e-6));
            let _ = writeln!(u, "    <inertial><origin xyz=\"{}\" rpy=\"0 0 0\"/><mass value=\"{}\"/><inertia ixx=\"{:e}\" ixy=\"{:e}\" ixz=\"{:e}\" iyy=\"{:e}\" iyz=\"{:e}\" izz=\"{:e}\"/></inertial>",
                v3(c), f(mp.mass), i[0][0], i[0][1], i[0][2], i[1][1], i[1][2], i[2][2]);
        }
        let mut bb = Aabb::empty();
        for (mat, mesh) in &l.meshes {
            let file = format!("{}__{mat}.stl", l.name);
            stl(&dir.join("meshes").join(&file), mesh, 1e-3)?;
            bb.merge(&mesh.aabb());
            let _ = writeln!(u, "    <visual name=\"{}_{mat}\"><geometry><mesh filename=\"meshes/{file}\"/></geometry><material name=\"{mat}\"/></visual>", l.name);
        }
        if !l.meshes.is_empty() {
            let _ = writeln!(u, "    <collision><origin xyz=\"{}\"/><geometry><box size=\"{}\"/></geometry></collision>", v3(scale(bb.center(), 1e-3)), v3(scale(bb.size(), 1e-3).map(|x| x.max(1e-4))));
        }
        u.push_str("  </link>\n");
    }
    let origin = |n: &str| links.iter().find(|l| l.name == n).unwrap().origin;
    for j in &model.joints {
        let o = scale(sub(origin(&j.child), origin(&j.parent)), 1e-3);
        let _ = writeln!(u, "  <joint name=\"{}\" type=\"{}\"><parent link=\"{}\"/><child link=\"{}\"/><origin xyz=\"{}\" rpy=\"0 0 0\"/>", j.name, j.kind, j.parent, j.child, v3(o));
        if j.kind != "fixed" {
            let _ = writeln!(u, "    <axis xyz=\"{}\"/>", v3(j.axis));
            let lim = if j.kind == "revolute" || j.kind == "prismatic" { format!("lower=\"{}\" upper=\"{}\" ", f(j.lo), f(j.hi)) } else { String::new() };
            let _ = writeln!(u, "    <limit {lim}effort=\"{}\" velocity=\"{}\"/><dynamics damping=\"0.01\" friction=\"0\"/>", f(j.effort), f(j.vel));
        }
        u.push_str("  </joint>\n");
    }
    u.push_str("</robot>\n");
    std::fs::write(dir.join("pastella84.urdf"), &u)?;
    Ok(u)
}

// ------------------------------------------------------------------ USDA
pub fn usda(model: &Model, links: &[LinkOut], mats: &BTreeMap<String, Material>, path: &Path) -> std::io::Result<()> {
    let mut s = String::from("#usda 1.0\n(\n    defaultPrim = \"Pastella84\"\n    doc = \"PASTELLA 84 v3 - generated by cad/rust (pastella-cad) from cad/spec.json\"\n    kilogramsPerUnit = 1\n    metersPerUnit = 1\n    upAxis = \"Z\"\n)\n\n");
    s.push_str("def PhysicsScene \"PhysicsScene\"\n{\n    vector3f physics:gravityDirection = (0, 0, -1)\n    float physics:gravityMagnitude = 9.81\n}\n\n");
    s.push_str("def Xform \"Pastella84\"\n{\n    def Scope \"Looks\"\n    {\n");
    for (n, m) in mats {
        let _ = write!(s, "        def Material \"{n}\"\n        {{\n            token outputs:surface.connect = </Pastella84/Looks/{n}/Surface.outputs:surface>\n\n            def Shader \"Surface\"\n            {{\n                uniform token info:id = \"UsdPreviewSurface\"\n                color3f inputs:diffuseColor = {}\n                float inputs:metallic = {}\n                float inputs:opacity = {}\n                float inputs:roughness = {}\n", tup(m.rgb), f(m.metallic), f(m.opacity), f(m.roughness));
        if n == "led" { let _ = writeln!(s, "                color3f inputs:emissiveColor = {}", tup(m.rgb)); }
        s.push_str("                token outputs:surface\n            }\n        }\n");
    }
    s.push_str("    }\n");
    for l in links {
        let api = if l.mp.is_some() { " (\n        prepend apiSchemas = [\"PhysicsRigidBodyAPI\", \"PhysicsMassAPI\"]\n    )" } else { "" };
        let _ = write!(s, "\n    def Xform \"{}\"{api}\n    {{\n        double3 xformOp:translate = {}\n        uniform token[] xformOpOrder = [\"xformOp:translate\"]\n", l.name, tup(scale(l.origin, 1e-3)));
        if let Some(mp) = &l.mp {
            let (vals, vecs) = eig_sym(mp.inertia.map(|r| r.map(|x| x * 1e-6)));
            let q = quat_of(vecs);
            let _ = write!(s, "        float physics:mass = {}\n        point3f physics:centerOfMass = {}\n        float3 physics:diagonalInertia = {}\n        quatf physics:principalAxes = ({}, {}, {}, {})\n",
                f(mp.mass), tup(scale(sub(mp.com, l.origin), 1e-3)), format!("({:e}, {:e}, {:e})", vals[0].max(1e-12), vals[1].max(1e-12), vals[2].max(1e-12)), f(q[0]), f(q[1]), f(q[2]), f(q[3]));
        }
        let mut bb = Aabb::empty();
        for (mat, m) in &l.meshes {
            bb.merge(&m.aabb());
            let mb = m.aabb();
            let _ = write!(s, "\n        def Mesh \"{mat}\" (\n            prepend apiSchemas = [\"MaterialBindingAPI\"]\n        )\n        {{\n            float3[] extent = [{}, {}]\n            int[] faceVertexCounts = [", tup(scale(mb.lo, 1e-3)), tup(scale(mb.hi, 1e-3)));
            s.push_str(&vec!["3"; m.t.len()].join(", "));
            s.push_str("]\n            int[] faceVertexIndices = [");
            s.push_str(&m.t.iter().map(|t| format!("{}, {}, {}", t[0], t[1], t[2])).collect::<Vec<_>>().join(", "));
            s.push_str("]\n            rel material:binding = </Pastella84/Looks/");
            s.push_str(mat);
            s.push_str(">\n            point3f[] points = [");
            s.push_str(&m.p.iter().map(|p| tup(scale(*p, 1e-3))).collect::<Vec<_>>().join(", "));
            s.push_str("]\n            uniform token subdivisionScheme = \"none\"\n        }\n");
        }
        if l.mp.is_some() && !l.meshes.is_empty() {
            let _ = write!(s, "\n        def Cube \"collision\" (\n            prepend apiSchemas = [\"PhysicsCollisionAPI\"]\n        )\n        {{\n            uniform token purpose = \"guide\"\n            double size = 1\n            double3 xformOp:translate = {}\n            float3 xformOp:scale = {}\n            uniform token[] xformOpOrder = [\"xformOp:translate\", \"xformOp:scale\"]\n        }}\n",
                tup(scale(bb.center(), 1e-3)), tup(scale(bb.size(), 1e-3).map(|x| x.max(1e-4))));
        }
        s.push_str("    }\n");
    }
    s.push_str("\n    def Scope \"joints\"\n    {\n");
    let origin = |n: &str| links.iter().find(|l| l.name == n).unwrap().origin;
    for j in &model.joints {
        let ty = match j.kind { "fixed" => "PhysicsFixedJoint", "prismatic" => "PhysicsPrismaticJoint", _ => "PhysicsRevoluteJoint" };
        // the three world-fixed roots carry the articulation (fixed-base trees)
        let api = if j.parent == "desk" { " (\n            prepend apiSchemas = [\"PhysicsArticulationRootAPI\"]\n        )" } else { "" };
        let _ = write!(s, "        def {ty} \"{}\"{api}\n        {{\n", j.name);
        if j.parent != "desk" { let _ = writeln!(s, "            rel physics:body0 = </Pastella84/{}>", j.parent); }
        let _ = writeln!(s, "            rel physics:body1 = </Pastella84/{}>", j.child);
        let _ = writeln!(s, "            point3f physics:localPos0 = {}", tup(scale(sub(origin(&j.child), origin(&j.parent)), 1e-3)));
        s.push_str("            point3f physics:localPos1 = (0, 0, 0)\n");
        if j.kind != "fixed" {
            let q = quat_from_to([1.0, 0.0, 0.0], j.axis);
            let qs = format!("({}, {}, {}, {})", f(q[0]), f(q[1]), f(q[2]), f(q[3]));
            let _ = writeln!(s, "            quatf physics:localRot0 = {qs}\n            quatf physics:localRot1 = {qs}\n            uniform token physics:axis = \"X\"");
            match j.kind {
                "revolute" => { let _ = writeln!(s, "            float physics:lowerLimit = {}\n            float physics:upperLimit = {}", f(j.lo.to_degrees()), f(j.hi.to_degrees())); }
                "prismatic" => { let _ = writeln!(s, "            float physics:lowerLimit = {}\n            float physics:upperLimit = {}", f(j.lo), f(j.hi)); }
                _ => {}
            }
        }
        s.push_str("        }\n");
    }
    s.push_str("    }\n}\n");
    std::fs::write(path, s)
}

// ------------------------------------------------------------------ GLB (web)
fn to_gl(p: V3) -> [f32; 3] { gl_dir(scale(p, 1e-3)) }
fn gl_dir(p: V3) -> [f32; 3] { [p[0] as f32, p[2] as f32, -p[1] as f32] }
fn srgb_to_linear(c: f64) -> f64 { if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) } }

/// Split vertices at creases (> 35 degrees) and give them smoothed normals.
fn shade(m: &Mesh) -> (Vec<[f32; 3]>, Vec<[f32; 3]>, Vec<u32>) {
    let fnorm: Vec<V3> = (0..m.t.len()).map(|i| { let t = m.tri(i); unit(cross(sub(t[1], t[0]), sub(t[2], t[0]))) }).collect();
    let mut inc: Vec<Vec<usize>> = vec![vec![]; m.p.len()];
    for (i, t) in m.t.iter().enumerate() { for &v in t { inc[v as usize].push(i); } }
    let cos_lim = 35f64.to_radians().cos();
    let (mut pos, mut nor, mut idx) = (vec![], vec![], vec![]);
    let mut map: std::collections::HashMap<(u32, [i32; 3]), u32> = std::collections::HashMap::new();
    for (i, t) in m.t.iter().enumerate() {
        for &v in t {
            let n = unit(inc[v as usize].iter().filter(|&&g| dot(fnorm[g], fnorm[i]) > cos_lim).fold([0.0; 3], |a, &g| add(a, fnorm[g])));
            let key = (v, n.map(|x| (x * 64.0).round() as i32));
            let id = *map.entry(key).or_insert_with(|| { pos.push(to_gl(m.p[v as usize])); let g = gl_dir(n); let l = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]).sqrt().max(1e-9); nor.push(g.map(|x| x / l)); (pos.len() - 1) as u32 });
            idx.push(id);
        }
    }
    (pos, nor, idx)
}

pub fn glb(model: &Model, links: &[LinkOut], parts: &[(String, String, String, &'static str, Mesh)], mats: &BTreeMap<String, Material>, path: &Path) -> std::io::Result<usize> {
    use serde_json::json;
    let mut bin: Vec<u8> = vec![];
    let (mut views, mut accs, mut meshes, mut nodes) = (vec![], vec![], vec![], vec![]);
    let mat_names: Vec<&String> = mats.keys().collect();
    let materials: Vec<_> = mats.iter().map(|(n, m)| {
        let c = m.rgb.map(srgb_to_linear);
        let mut o = json!({"name": n, "pbrMetallicRoughness": {"baseColorFactor": [c[0], c[1], c[2], m.opacity], "metallicFactor": m.metallic, "roughnessFactor": m.roughness}, "doubleSided": m.opacity < 1.0});
        if m.opacity < 1.0 { o["alphaMode"] = json!("BLEND"); }
        if n == "led" { o["emissiveFactor"] = json!([c[0], c[1], c[2]]); }
        o
    }).collect();
    let push = |bytes: &[u8], target: Option<u32>, bin: &mut Vec<u8>, views: &mut Vec<serde_json::Value>| -> usize {
        while bin.len() % 4 != 0 { bin.push(0); }
        let off = bin.len();
        bin.extend_from_slice(bytes);
        let mut v = json!({"buffer": 0, "byteOffset": off, "byteLength": bytes.len()});
        if let Some(t) = target { v["target"] = json!(t); }
        views.push(v);
        views.len() - 1
    };
    let link_idx: BTreeMap<&str, usize> = links.iter().enumerate().map(|(i, l)| (l.name.as_str(), i)).collect();
    let mut link_children: Vec<Vec<usize>> = vec![vec![]; links.len()];
    for (name, link, mat, pick, mesh) in parts {
        let lo = links[link_idx[link.as_str()]].origin;
        let (p, n, ix) = shade(&mesh.map(|q| sub(q, lo)));
        let (mut mn, mut mx) = ([f32::MAX; 3], [f32::MIN; 3]);
        for q in &p { for k in 0..3 { mn[k] = mn[k].min(q[k]); mx[k] = mx[k].max(q[k]); } }
        let pb: Vec<u8> = p.iter().flat_map(|q| q.iter().flat_map(|x| x.to_le_bytes())).collect();
        let nb: Vec<u8> = n.iter().flat_map(|q| q.iter().flat_map(|x| x.to_le_bytes())).collect();
        let ib: Vec<u8> = ix.iter().flat_map(|x| x.to_le_bytes()).collect();
        let vp = push(&pb, Some(34962), &mut bin, &mut views);
        let vn = push(&nb, Some(34962), &mut bin, &mut views);
        let vi = push(&ib, Some(34963), &mut bin, &mut views);
        accs.push(json!({"bufferView": vp, "componentType": 5126, "count": p.len(), "type": "VEC3", "min": mn, "max": mx}));
        accs.push(json!({"bufferView": vn, "componentType": 5126, "count": n.len(), "type": "VEC3"}));
        accs.push(json!({"bufferView": vi, "componentType": 5125, "count": ix.len(), "type": "SCALAR"}));
        let a = accs.len();
        meshes.push(json!({"name": name, "primitives": [{"attributes": {"POSITION": a - 3, "NORMAL": a - 2}, "indices": a - 1, "material": mat_names.iter().position(|m| *m == mat).unwrap()}]}));
        nodes.push(json!({"name": name, "mesh": meshes.len() - 1, "extras": {"pick": pick, "link": link, "mat": mat}}));
        link_children[link_idx[link.as_str()]].push(nodes.len() - 1);
    }
    // link nodes: tree from joints, translation relative to the parent link
    let parent: BTreeMap<&str, &crate::model::Joint> = model.joints.iter().map(|j| (j.child.as_str(), j)).collect();
    let first_link_node = nodes.len();
    for (i, l) in links.iter().enumerate() {
        let rel = match parent.get(l.name.as_str()) { Some(j) => sub(l.origin, links[link_idx[j.parent.as_str()]].origin), None => l.origin };
        let mut extras = json!({"link": l.name});
        if let Some(j) = parent.get(l.name.as_str()) {
            extras["joint"] = json!({"name": j.name, "type": j.kind, "axis": gl_dir(j.axis), "lower": j.lo, "upper": j.hi});
        }
        let mut node = json!({"name": format!("link:{}", l.name), "translation": to_gl(rel), "extras": extras});
        let mut ch = link_children[i].clone();
        for c in links.iter().filter(|c| parent.get(c.name.as_str()).map(|j| j.parent == l.name).unwrap_or(false)) {
            ch.push(first_link_node + link_idx[c.name.as_str()]);
        }
        if !ch.is_empty() { node["children"] = json!(ch); }
        nodes.push(node);
    }
    let root = first_link_node + link_idx["desk"];
    let doc = json!({
        "asset": {"version": "2.0", "generator": "pastella-cad (cad/rust)"},
        "scene": 0, "scenes": [{"name": "PASTELLA84_v3", "nodes": [root]}],
        "nodes": nodes, "meshes": meshes, "materials": materials, "accessors": accs, "bufferViews": views,
        "buffers": [{"byteLength": bin.len()}],
    });
    while bin.len() % 4 != 0 { bin.push(0); }
    let mut js = serde_json::to_vec(&doc).unwrap();
    while js.len() % 4 != 0 { js.push(b' '); }
    let mut out = vec![];
    out.extend(b"glTF");
    out.extend(2u32.to_le_bytes());
    out.extend(((12 + 8 + js.len() + 8 + bin.len()) as u32).to_le_bytes());
    out.extend((js.len() as u32).to_le_bytes());
    out.extend(b"JSON");
    out.extend(&js);
    out.extend((bin.len() as u32).to_le_bytes());
    out.extend(b"BIN\0");
    out.extend(&bin);
    std::fs::write(path, &out)?;
    Ok(out.len())
}
