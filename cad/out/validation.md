# CAD 출력 검증 결과 (C# Pastella.Validate)

`cad/rust`가 만든 산출물을 C#에서 다시 읽어 서로 교차 검증한 결과입니다. 자동 생성 파일입니다.

**결과: 모두 통과**

## concept · report.json

- [x] Rust self-checks passed (watertight, interference, joint sweeps)

## concept · URDF tree

- [x] link names unique
- [x] joint names unique
- [x] joints reference existing links
- [x] single root 'desk' (found: desk)
- [x] every non-root link has exactly one parent
- [x] tree reaches every link (acyclic)

## concept · URDF physics

- [x] 69 massive links: mass > 0, inertia PD + triangle inequality
- [x] 63 movable joints: unit axes, ordered limits

## concept · URDF meshes (binary STL)

- [x] 148 STL files, 62498 triangles: exist, finite, watertight

## concept · URDF vs spec.json

- [x] one prismatic joint per key (49 / 49)
- [x] key travel = 4 mm
- [x] monitor tilt limits = spec.tilt_deg
- [x] monitor swivel limits = spec.swivel_deg
- [x] monitor body carries the 9.4 kg CRT

## concept · USDA vs URDF

- [x] stage: upAxis Z, metersPerUnit 1, kilogramsPerUnit 1
- [x] same rigid bodies (69 / 69)
- [x] masses agree (worst relative difference 0.0E+000)
- [x] same joints (69 / 69)
- [x] joint types match
- [x] joint bodies match parent/child (world-fixed roots have no body0)
- [x] joint limits match (USD degrees vs URDF radians)
- [x] articulation roots on the world-fixed joints (3)

## concept · STEP (AP214)

- [x] schema AUTOMOTIVE_DESIGN (AP214)
- [x] units: millimetre
- [x] named solids for every part (234 solids / 234 expected, 234 parts)
- [x] every solid has a colour (STYLED_ITEM)
- [x] all entity references resolve

## concept · GLB (web)

- [x] glTF 2.0 binary, JSON + BIN chunks
- [x] one node per part (234 / 234)
- [x] link nodes for every URDF link

## concept · web data

- [x] src/js/data/cad.js points at this GLB and matches report revision

## build · report.json

- [x] Rust self-checks passed (watertight, interference, joint sweeps)

## build · URDF tree

- [x] link names unique
- [x] joint names unique
- [x] joints reference existing links
- [x] single root 'desk' (found: desk)
- [x] every non-root link has exactly one parent
- [x] tree reaches every link (acyclic)

## build · URDF physics

- [x] 66 massive links: mass > 0, inertia PD + triangle inequality
- [x] 60 movable joints: unit axes, ordered limits

## build · URDF meshes (binary STL)

- [x] 146 STL files, 80224 triangles: exist, finite, watertight

## build · URDF vs spec.json

- [x] one prismatic joint per key (49 / 49)
- [x] key travel = 4 mm
- [x] monitor tilt limits = spec.tilt_deg
- [x] monitor swivel limits = spec.swivel_deg
- [x] monitor body carries the 2.1 kg LCD panel

## build · USDA vs URDF

- [x] stage: upAxis Z, metersPerUnit 1, kilogramsPerUnit 1
- [x] same rigid bodies (66 / 66)
- [x] masses agree (worst relative difference 0.0E+000)
- [x] same joints (66 / 66)
- [x] joint types match
- [x] joint bodies match parent/child (world-fixed roots have no body0)
- [x] joint limits match (USD degrees vs URDF radians)
- [x] articulation roots on the world-fixed joints (3)

## build · STEP (AP214)

- [x] schema AUTOMOTIVE_DESIGN (AP214)
- [x] units: millimetre
- [x] named solids for every part (389 solids / 389 expected, 377 parts)
- [x] every solid has a colour (STYLED_ITEM)
- [x] all entity references resolve

## build · GLB (web)

- [x] glTF 2.0 binary, JSON + BIN chunks
- [x] one node per part (377 / 377)
- [x] link nodes for every URDF link

## build · web data

- [x] src/js/data/cad.js points at this GLB and matches report revision

## build · 3D print pieces (STL)

- [x] 94 / 94 pieces: watertight, fit the bed, lie on it
- [x] every split seam has joints (housings)
- [x] print plan has no errors

## build · BOM · DXF

- [x] bom.csv lists the LCD panel and its controller board
- [x] bom.csv: one MX switch per key (49 / 49)
- [x] bom.csv: keycaps for every key (49 / 49)
- [x] bom.csv: heat-set inserts listed (108)
- [x] bom.csv lists every printed piece
- [x] kb_plate.dxf: outline, 51 switch/stabiliser cut-outs (>= 49), 4 screw holes
- [x] print-plan.md present
