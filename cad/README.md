# CAD v3 — 실제 제작용 형상 (STEP · URDF · USDA)

`spec.json` 하나를 원본으로 Rust가 B-rep 솔리드를 만들고, 같은 형상을 세 가지 형식으로 내보냅니다. 웹 워크벤치의 Chassis 탭도 이 결과(GLB와 `src/js/data/cad.js`)를 표시합니다.

```
cad/spec.json ──▶ cad/rust (pastella-cad, truck B-rep) ──▶ cad/out/pastella84.step        STEP AP214, 부품 이름·색, mm
                                                      ├─▶ cad/out/urdf/pastella84.urdf  URDF + STL(링크별·재질별), 질량·관성
                                                      ├─▶ cad/out/pastella84.usda       OpenUSD + UsdPreviewSurface + UsdPhysics
                                                      ├─▶ cad/out/web/pastella84.glb    웹 워크벤치용 glTF (링크 계층 + 관절 정보)
                                                      ├─▶ cad/out/report.json           치수 · 질량 · 검사 결과
                                                      ├─▶ src/js/data/cad.js            워크벤치가 읽는 요약
                                                      └─▶ environments/chassis/dimensions.csv
                   cad/csharp (Pastella.Validate) ──▶ cad/out/validation.md          산출물 교차 검증
```

## 빌드

```
./cad/build.sh rust          # Only Rust: 형상 생성 + 내보내기 + Rust 자체 검사
./cad/build.sh csharp-rust   # 위와 같은 Rust 빌드 + C# 독립 검증 (기본값)
./cad/build.sh rust --palette "Lavender Haze"   # 컬러웨이 변경 (environments/chassis/colorways.json)
```

필요한 도구: Rust(cargo) 1.80 이상, .NET SDK 10. 처음 빌드할 때 crates.io에서 의존성을 받습니다. 전체 빌드는 약 5초, C# 검증까지 약 7초가 걸립니다. 검사가 하나라도 실패하면 종료 코드 1을 반환합니다.

워크벤치는 `./run.sh`로 연 뒤 터미널에 나오는 **Open Integrated Browser** 주소로 들어갑니다. GLB는 HTTP로만 불러올 수 있어서 `file://`로 열면 웹 v2 모델이 대신 표시됩니다.

## 두 파이프라인의 역할 (중복 없음)

| | Only Rust | C# & Rust |
|---|---|---|
| 형상 정의 · 생성 | Rust (`model.rs`, `geom.rs`) | 같은 Rust 코드 |
| 질량 · 관성 | Rust (폐곡면 다면체 적분) | 같은 Rust 결과 |
| 형상 검사 (밀폐 · 간섭 · 관절 스윕) | Rust (`check.rs`) | 같은 Rust 결과 |
| 내보내기 | Rust (`export.rs`) | 같은 Rust 결과 |
| 산출물 교차 검증 | — | C# (`Pastella.Validate`): URDF ↔ USDA ↔ STEP ↔ GLB ↔ report ↔ spec |

형상은 Rust에만 정의되어 있습니다. C#은 형상을 다시 만들지 않고, 내보낸 파일을 다시 읽어 서로 맞는지만 확인합니다. 이전의 Python(OpenCASCADE) 생성기는 같은 형상을 두 번 정의하는 중복이라 제거했습니다.

## 검사 항목

**Rust 자체 검사 (`report.json` → `checks`)**

- 모든 부품이 닫힌 솔리드인지 (테셀레이션 메시가 열린 모서리 없이 닫혀야 함)
- 기본 자세에서 모든 부품 쌍의 겹침 부피 (삼각형 분리축 판정 + 점 샘플링, 1 mm³ 초과면 실패)
- 가동 관절 63개 스윕: 회전 관절은 하한·상한, 직선 관절은 끝까지, 연속 관절은 90°·180°·270°에서 움직이는 부분과 나머지 부품의 간섭
- STEP을 다시 파싱해 솔리드 수가 맞는지

**C# 독립 검증 (`validation.md`)**: URDF 트리(단일 루트 · 비순환), 링크별 질량 > 0 · 관성 양의 정부호 · 삼각 부등식, STL 밀폐성, 키 49개 = 직선 관절 49개 · 키 이동 4 mm · 틸트/스위블 한계가 spec과 일치, USDA와 URDF의 질량 · 관절 · 한계 일치(도 ↔ 라디안), STEP 스키마 · 단위 · 부품 이름 · 색 · 참조, GLB 노드. 산출물에 일부러 결함을 넣었을 때 실패하는 것도 확인했습니다(USDA 질량 변조, STEP 색 삭제, URDF 관절 타입 변경, STL 정점 이동).

**외부 도구 확인 (빌드 과정에는 포함되지 않음, 개발 중 수동 확인)**: OpenCASCADE가 STEP 솔리드 234개를 모두 읽었고 BRepCheck 불량 0건, 전체 부피는 Rust 계산과 0.03 % 이내였습니다. Pixar USD가 USDA를 열었고(메시 148 · 강체 69 · 관절 69), ROS 2 `check_urdf`가 URDF를 파싱했으며, Blender가 GLB를 렌더링했습니다.

## 참고 사진에서 배운 것

실물 사진 148장(목록과 라이선스: [environments/chassis/references.md](../environments/chassis/references.md))에서 얻은 형태 언어를 v3에 반영했습니다.

| 참고한 실물 | 관찰 | v3 반영 |
|---|---|---|
| 모든 실물 키보드 (C64C, MSX, Canon Cat) | 키 피치 19.05 mm, 기성 키캡 규격 | 피치 31 → **19.05 mm**, MX 호환 플레이트(1.5 mm 강판, 14 mm 컷아웃, 6.25u 스태빌라이저 컷아웃), SHIFT · ENTER 1.75u, SPACE 6.25u |
| C64C, MSX | 쐐기형 케이스, 뒤쪽 접이식 다리 | 6.1° 쐐기 케이스, 접이식 다리 2개(0–95°) |
| MSX HitBit, Canon Cat, Amstrad | 기능 키만 다른 색 | 넓은 키는 포인트 색(keyB) |
| Macintosh Color Classic | 화면이 한 단 들어간 액자형 베젤 | 화면 둘레 8 mm 폭 · 6 mm 깊이 계단 리세스 |
| Color Classic, iMac G3 | 평평한 바닥, 뒤로 갈수록 좁아지는 몸체 | 바닥은 평평하게, 윗면만 뒤로 기울어진 후면 셸(뒷면 60 % × 70 %) |
| iMac G3, Canon Cat, Sharp X68000 | 무거운 본체에 손잡이 | 후면 나사 고정식 손잡이(손가락 공간 88 × 26 mm) |
| CRT 실물 비례 | 19" CRT를 154 mm 깊이로 만들 수 없음 | 125° 슈퍼슬림 CRT 기준 깊이 **266 mm** (0.52 × 대각 mm + 베젤 15) |
| Apple IIc (Snow White) | 측면 가로 홈 | 본체 측면 가로 슬롯 통풍구 3열 × 5단 |
| Bandai Pippin | 원형 타공 스피커 그릴 | 스피커 위 Ø3.2 타공 42개 |
| Sega SC-3000, Apple 로고 | 컬러 스트라이프 | 본체 전면과 키보드에 파스텔 4색 스트라이프 |
| MSX (투톤) | 하부는 진하고 상부는 밝음 | 하부 트레이를 본체 색의 88 % 명도로 |
| Apple M0100 마우스 | 버튼이 분리된 판 | 박스형 몸체 + 경첩식 버튼 판(3° 누름) |

## 간섭 검사로 고친 설계 결함

간섭 · 스윕 검사에서 찾은 결함을 실제 메커니즘으로 고쳤습니다. 0건으로 만들려고 검사를 완화하지는 않았습니다.

- **키 스위치**: MX 스템은 키캡과 함께 움직이는 슬라이더입니다. 하우징에 스템 구멍(Ø4.2, 깊이 5 mm)을 내고, 스템은 키 링크에 붙였습니다. 4 mm 끝까지 누르면 키캡 소켓이 하우징 윗면에 닿습니다(바텀아웃).
- **모니터 틸트**: 평평한 바닥을 바닥면 위의 축으로 돌리면 앞쪽이 받침을 파고듭니다. 축을 바닥보다 20 mm 위에 두고, 본체 쪽 볼록 로커(R40)가 받침 쪽 동심 오목 크래들(R40.5) 안에서 돌게 했습니다. 이 때문에 스탠드 높이가 40 → 50 mm가 됐습니다. 틸트축은 무게중심 바로 아래(앞뒤 오차 0.0 mm)에 자동으로 배치되며, 무게중심이 축보다 약 133 mm 위에 있으므로 12°에서 버티려면 마찰 토크가 약 3.6 N·m 필요합니다.
- **전원 토글**: 레버가 판을 뚫고 회전했습니다. 판에 8 × 16 mm 레버 구멍을 내고, 회전축을 판 뒷면에 두었습니다.
- **CRT 주변**: 디가우싱 코일은 유리 바깥(전면 유리 둘레)으로, 편향 요크는 넥에 걸리도록, 넥 보드는 넥 뒤로 옮겼습니다.

## 좌표계와 단위

- STEP: mm, X = 사용자 오른쪽, Y = 사용자에게서 멀어지는 쪽(정면이 −Y), Z = 위, 책상 윗면 Z = 0
- URDF · USDA: 같은 축, m · kg (USDA는 `upAxis = "Z"`, `metersPerUnit = 1`)
- GLB: glTF 규약(Y 위, +Z가 사용자 쪽, m). 워크벤치는 ×10 해서 1 칸 = 100 mm로 씁니다.

URDF의 루트 링크는 질량 없는 `desk`이고, 본체 · 키보드 · 마우스가 고정 관절로 붙습니다. USDA에서는 이 세 고정 관절이 월드에 고정되고 각각 `PhysicsArticulationRootAPI`를 가집니다. 충돌 형상은 링크별 경계 상자로 단순화했습니다.

## 한계와 제작 전 확인할 것

- **truck 커널의 한계**: truck은 필렛 기능이 없어서, 하우징은 수직 모서리만 둥글고(R8–R14) 윗면 모서리는 각져 있습니다. 사출 금형용 빼기 구배, 보스, 리브, 스냅도 아직 모델링하지 않았습니다. STEP을 CAD에서 열어 금형 설계 단계에서 추가해야 합니다.
- **CRT 튜브**: 19" 16:10 슈퍼슬림 CRT는 기성품으로 구할 수 없습니다. 튜브는 외곽 형상(봉투)과 실제에 가까운 유리 질량(9.4 kg)으로만 모델링했습니다. 실제로 만들려면 같은 외곽에 맞는 LCD 패널과 곡면 아크릴 커버로 대체하는 방안을 함께 검토하세요([parts-sourcing.md](../environments/circuit/parts-sourcing.md)).
- **생략한 부품과 질량**: 케이블(키보드 코일 · 마우스 · 비디오)은 휘는 부품이라 생략했습니다. 내부 기판 부품은 덩어리로 단순화했고, 질량은 재질 밀도 × 부피로 계산하되 트랜스 · CRT · 요크 · 플라이백 같은 주요 부품만 실측급 값으로 지정했습니다.
- **STEP의 부품 이름**: 각 솔리드 이름(`MANIFOLD_SOLID_BREP`)으로 넣었습니다. 색은 OpenCASCADE가 읽는 것을 확인했지만, 이름이 솔리드별로 표시되는지는 CAD 프로그램마다 다를 수 있습니다.

## 소스 구성

```
cad/spec.json                 사양 (치수 · 키 배열 · 재질 · 밀도) — 이 파일만 고치면 됩니다
cad/rust/src/geom.rs          불리언 없는 B-rep 조립: 공유 모서리 면 → 방향 정렬(BFS) → 닫힌 솔리드
cad/rust/src/model.rs         부품 · 링크 · 관절 정의 (참고 사진 반영 지점에 [ref: …] 주석)
cad/rust/src/mesh.rs          메시 질량 · 관성, 고유값, 쿼터니언
cad/rust/src/check.rs         간섭 · 관절 스윕
cad/rust/src/export.rs        STEP · URDF/STL · USDA · GLB
cad/rust/src/main.rs          파이프라인 · report · 웹 데이터 · dimensions.csv
cad/csharp/Pastella.Validate  C# 교차 검증기
cad/build.sh                  두 파이프라인 실행
```
