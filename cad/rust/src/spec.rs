//! cad/spec.json — the single design source shared by the Rust build and the C# validator.

use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Deserialize, Clone)]
pub struct Spec {
    pub name: String,
    pub revision: String,
    pub palette: PaletteRef,
    pub tessellation_mm: f64,
    pub clash_threshold_mm3: f64,
    pub base: Base,
    pub monitor: Monitor,
    pub keyboard: Keyboard,
    pub mouse: Mouse,
    pub materials: BTreeMap<String, MaterialSpec>,
    pub density_kg_per_mm3: BTreeMap<String, f64>,
}

#[derive(Deserialize, Clone)]
pub struct PaletteRef { pub source: String, pub default: String }

#[derive(Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct Base { pub W: f64, pub D: f64, pub H_tray: f64, pub H_lid: f64, pub feet_h: f64, pub wall: f64, pub corner_r: f64, pub y: f64 }

#[derive(Deserialize, Clone)]
pub struct Monitor {
    pub diag_in: f64, pub aspect: f64, pub bezel: f64, pub gap: f64, pub chin: f64, pub stand_h: f64,
    pub bezel_depth: f64, pub recess_step: f64, pub recess_depth: f64, pub depth_per_diag_mm: f64,
    pub front_y: f64, pub wall: f64, pub tilt_deg: [f64; 2], pub swivel_deg: [f64; 2],
    pub tube_mass_kg: f64, pub yoke_mass_kg: f64, pub flyback_mass_kg: f64, pub degauss_mass_kg: f64,
}

#[derive(Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct Keyboard {
    pub pitch: f64, pub W: f64, pub D: f64, pub h_front: f64, pub h_rear: f64, pub y: f64, pub wall: f64,
    pub margin_front: f64, pub plate_t: f64, pub plate_below_top: f64, pub travel: f64,
    pub rows: Vec<Vec<String>>, pub wide_u: BTreeMap<String, f64>, pub switch_mass_kg: f64,
}

#[derive(Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct Mouse { pub W: f64, pub D: f64, pub H: f64, pub x: f64, pub y: f64, pub ball_d: f64, pub ball_mass_kg: f64 }

#[derive(Deserialize, Clone)]
pub struct MaterialSpec { pub color: String, pub roughness: f64, pub metallic: f64, pub opacity: f64, pub density: String }

/// Resolved render + physical material.
#[derive(Clone, Debug, serde::Serialize)]
pub struct Material { pub rgb: [f64; 3], pub roughness: f64, pub metallic: f64, pub opacity: f64, pub density: f64 }

#[derive(Deserialize)]
struct Colorways { palettes: Vec<BTreeMap<String, String>> }

fn hex(h: &str) -> [f64; 3] {
    let h = h.trim_start_matches('#');
    [0, 2, 4].map(|i| u8::from_str_radix(&h[i..i + 2], 16).expect("hex colour") as f64 / 255.0)
}

/// Resolve "palette:role" / "palette:role*k" / "#rrggbb" against the chosen colourway.
pub fn materials(spec: &Spec, colorways_json: &str, palette: &str) -> Result<BTreeMap<String, Material>, String> {
    let cw: Colorways = serde_json::from_str(colorways_json).map_err(|e| e.to_string())?;
    let pal = cw.palettes.iter().find(|p| p.get("n").map(|n| n == palette).unwrap_or(false))
        .ok_or_else(|| format!("unknown palette '{palette}' (choose: {})", cw.palettes.iter().filter_map(|p| p.get("n").cloned()).collect::<Vec<_>>().join(", ")))?;
    let mut out = BTreeMap::new();
    for (name, m) in &spec.materials {
        let rgb = if let Some(rest) = m.color.strip_prefix("palette:") {
            let (role, k) = match rest.split_once('*') { Some((r, k)) => (r, k.parse::<f64>().map_err(|e| e.to_string())?), None => (rest, 1.0) };
            let c = hex(pal.get(role).ok_or_else(|| format!("palette has no role '{role}'"))?);
            c.map(|x| (x * k).clamp(0.0, 1.0))
        } else { hex(&m.color) };
        let density = *spec.density_kg_per_mm3.get(&m.density).ok_or_else(|| format!("no density '{}'", m.density))?;
        out.insert(name.clone(), Material { rgb, roughness: m.roughness, metallic: m.metallic, opacity: m.opacity, density });
    }
    Ok(out)
}
