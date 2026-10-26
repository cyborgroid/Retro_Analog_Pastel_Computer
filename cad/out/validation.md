# CAD 출력 검증 결과 (C# Pastella.Validate)

`cad/rust`가 만든 산출물을 C#에서 다시 읽어 서로 교차 검증한 결과입니다. 자동 생성 파일입니다.

**결과: 모두 통과**

## report.json

- [x] Rust self-checks passed (watertight, interference, joint sweeps)

## URDF tree

- [x] link names unique
- [x] joint names unique
- [x] joints reference existing links
- [x] single root 'desk' (found: desk)
- [x] every non-root link has exactly one parent
- [x] tree reaches every link (acyclic)

## URDF physics

- [x] 69 massive links: mass > 0, inertia PD + triangle inequality
- [x] 63 movable joints: unit axes, ordered limits

## URDF meshes (binary STL)

- [x] 148 STL files, 62498 triangles: exist, finite, watertight

## URDF vs spec.json

- [x] one prismatic joint per key (49 / 49)
- [x] key travel = 4 mm
- [x] monitor tilt limits = spec.tilt_deg
- [x] monitor swivel limits = spec.swivel_deg
- [x] monitor body carries the 9.4 kg CRT

## USDA vs URDF

- [x] stage: upAxis Z, metersPerUnit 1, kilogramsPerUnit 1
- [x] same rigid bodies (69 / 69)
- [x] masses agree (worst relative difference 0.0E+000)
- [x] same joints (69 / 69)
- [x] joint types match
- [x] joint bodies match parent/child (world-fixed roots have no body0)
- [x] joint limits match (USD degrees vs URDF radians)
- [x] articulation roots on the world-fixed joints (3)

## STEP (AP214)

- [x] schema AUTOMOTIVE_DESIGN (AP214)
- [x] units: millimetre
- [x] one named solid per part (234 / 234)
- [x] every solid has a colour (STYLED_ITEM)
- [x] all entity references resolve

## GLB (web)

- [x] glTF 2.0 binary, JSON + BIN chunks
- [x] one node per part (234 / 234)
- [x] link nodes for every URDF link

## web data

- [x] src/js/data/cad.js points at the GLB and matches report revision
