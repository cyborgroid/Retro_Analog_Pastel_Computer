# PASTELLA 84 — 레트로 아날로그 파스텔 컴퓨터

파스텔 톤 레트로 컴퓨터(본체 · 19" 와이드 슬림 CRT · 49키 키보드 · 볼 마우스)를 다섯 가지 가상 환경에서 설계하고 검증하는 프로토타이핑 벤치입니다.

## 실행

```
./run.sh
```

터미널에 나오는 **Open Integrated Browser** 주소(`http://localhost:8084/index.html`)를 VS Code에서 열면 됩니다. `run.sh`는 로컬 HTTP 서버만 띄우고 별도 앱이나 외부 브라우저를 실행하지 않습니다. 3D 라이브러리(three.js r128)와 웹폰트는 CDN에서 불러오므로 인터넷 연결이 필요합니다. `index.html`을 `file://`로 직접 열어도 동작하지만, 그때는 CAD v3 모델(GLB)을 불러올 수 없어 웹 v2 모델이 표시됩니다.

## CAD v3 — STEP · URDF · USDA · 3D 프린팅

`cad/spec.json`을 원본으로 Rust가 B-rep 솔리드를 만들어 STEP(AP214), URDF(+STL, 질량 · 관성), USDA(UsdPhysics), 웹용 GLB를 내보냅니다. 간섭 · 관절 스윕 검사를 거치고, C#이 산출물을 교차 검증합니다.

두 가지 판이 함께 나옵니다. **실제 제작판**(`cad/out/build/`)은 지금 살 수 있는 부품(19" LCD 패널, 12 V 어댑터, MX 스위치 등)과 256 mm급 3D 프린터로 만드는 구성입니다. 베드에 맞게 자동 분할된 출력 STL 94조각, 구매 목록, 출력 계획, 스위치 플레이트 DXF가 포함됩니다. **컨셉판**(`cad/out/`)은 워크벤치가 시뮬레이션하는 CRT 설계입니다. Chassis 탭에서 두 판을 골라 볼 수 있습니다.

```
./cad/build.sh rust          # Only Rust
./cad/build.sh csharp-rust   # Rust + C# 검증 (기본값)
```

실물 참고 사진에서 배운 내용, 조립 순서, 검사 항목, 한계는 [cad/README.md](cad/README.md)에 있습니다.

## 레퍼런스 이미지 수집

`./run.sh`로 연 서버의 `/refs.html`에서 웹 이미지 검색 결과를 모아 분석할 수 있습니다. 검색 결과 페이지를 브라우저에서 직접 열고, 페이지의 **수집 스크립트 복사** 버튼으로 받은 스크립트를 그 페이지의 개발자 도구 콘솔에서 실행하면 목록이 로컬 서버로 전송됩니다. **다운로드 · 분석**을 누르면 원본 사이트에서 이미지를 받아 중복 제거, 색 분석, 비교표를 만듭니다. 공개 라이선스 사진은 `python3 tools/refs/commons.py`로 Wikimedia Commons에서 대량으로 받을 수 있습니다. 이미지는 `references/`(git 제외)에 저장되고, 요약은 [environments/chassis/references-web.md](environments/chassis/references-web.md)에 생성됩니다.

## 다섯 환경

| 탭 | 하는 일 | 설계 문서 |
|---|---|---|
| **Topology** | 블록 다이어그램, 버스 트랜잭션, 전원망, **고장 주입**, 메모리 맵, 클럭 트리, **양자 서브시스템**(Q-Bus 브리지 → QCU → 희석 냉동기 → 5큐비트 QPU → 판독 체인)과 결합 맵 | [environments/topology](environments/topology/) |
| **Circuit** | **실물 회로도**(실제 기호 · 참조번호 · 품번 · 실시간 TP · 전류 흐름)와 전원부 실물 PCB 보기: 전원부, CRT 수평 출력단, 키 매트릭스, 포토인터럽터, Pico PSG. **양자 회로**: 트랜스몬(칩 실물 배치도), 마이크로파 제어 체인, 희석 냉동기, 분산 판독. **부품 조달 표** | [environments/circuit](environments/circuit/) |
| **Chassis** | **CAD v3 (Rust) 모델과 산출물 다운로드**, 웹 v2 3D 모델, **파라메트릭 와이드 모니터**(크기 · 비율 · 베젤), 분해도, 단면, 야간 조명, 컬러웨이, BOM | [environments/chassis](environments/chassis/) |
| **Assembly** | **20단계 조립 애니메이션**, 단계별 공구 · 체결 부품 · 토크 · 검수 체크, 완성 시 POST | [environments/assembly](environments/assembly/) |
| **Instrument** | **양자 블록 작곡기 · 펄스 시퀀서**(블록 배치 → 펄스 시퀀스 → 노이즈 시뮬레이션 → 히스토그램 · 블로흐 구 · 상태벡터 · 오류 예산 · OpenQASM), 실물형 벤치 계측기(오실로스코프 · 로터리 스위치 멀티테스터 · FFT · 로직 분석기) | [environments/instrument](environments/instrument/) |

모든 환경은 하나의 시뮬레이션 상태(`src/js/core/state.js`)를 공유합니다. 예를 들어 Circuit에서 부하를 올리면 Instrument의 리플 파형이 바뀝니다. 7805가 과열되면 열 차단으로 3D 모니터에 NO SIGNAL이 뜨고, Topology의 PSU 블록에 경고가 표시됩니다.

## 폴더 구조

```
index.html                 화면 골격(마크업)만. 스타일과 로직은 src/
src/
  css/                     tokens · base · 환경별 스타일 (topology, circuit, chassis, assembly, instrument)
  js/core/                 util(이벤트 버스) · state(공유 상태) · signals(신호 모델) · screen(CRT 화면/POST)
                           knob · audio(PSG WebAudio) · trace · schematic(회로도 기호 라이브러리)
  js/quantum/              hardware(트랜스몬 · 냉동기 · 판독 물리 모델) · sim(상태벡터 + 노이즈 궤적) · pulses(게이트 → 펄스)
  js/data/                 런타임 데이터: palettes · keyboard · topology · parts · assembly · instrument · quantum · sourcing
  js/topology/             블록 그래프 · 고장 주입 · qtopology(양자 서브시스템)
  js/circuit/              psu · crt · keyboard · mouse · psg · qubit · qcontrol · cryo · readout · sourcing
  js/chassis/              geometry · model(3D · 조립 단계 등록) · viewer(공유 렌더러) · chassis(UI)
  js/assembly/             조립 타임라인 · 체크리스트
  js/instrument/           scope · spectrum · meter · logic · composer(양자 블록 작곡기) · qresults
  js/main.js               탭 · 상태 표시줄 · 메인 루프
environments/              환경별 설계 문서 (사양, SPICE 넷리스트, CSV, JSON)
tools/export-data.js       src/js/data → environments/*.json·csv·md 재생성
cad/                       CAD v3: spec.json · rust(형상 · 검사 · 내보내기) · csharp(검증) · out(STEP · URDF · USDA · GLB)
run.sh                     워크벤치 로컬 서버 (Open Integrated Browser 주소 출력) — tools/serve.py
refs.html · tools/refs/    레퍼런스 이미지 수집 페이지 · 브라우저 수집 스크립트 · 다운로드/분석 · Commons 수집
```

## 데이터 동기화

`environments/` 안의 `*.json`, `keyboard-matrix.csv`, `steps.md`, `fasteners.csv`, `qc-checklist.md`는 `src/js/data/`에서 자동 생성됩니다. 데이터를 고친 뒤에는 다음 명령을 실행하세요.

```
node tools/export-data.js
```

`src/js/data/cad.js`와 `environments/chassis/dimensions.csv`는 `./cad/build.sh`가 생성합니다. 나머지 `.md`, `.cir`, `.csv` 문서는 사람이 직접 관리하는 설계 문서입니다.

## 모델 단위와 기준값

- 3D 모델: 1 단위 = 100 mm
- 상용 전원 220 V / 60 Hz, 트랜스 2차 9 Vrms
- NTSC 타이밍: H 15.734 kHz, V 59.94 Hz, CPU 3.579545 MHz (14.31818 MHz ÷ 4)

## 재료 원칙: 실재하고 구하기 쉬운 부품

본체 회로는 전부 지금 생산 중이거나 재고가 풍부한 부품으로 그렸습니다(SRAM AS6C62256, EEPROM AT28C256, RP2040 Pico, CH376S, 74HC 로직, LM386, L7805CV 등). 단종 칩은 대체했고, 구하기 어려운 것은 그렇다고 표시했습니다. 자세한 내용은 [environments/circuit/parts-sourcing.md](environments/circuit/parts-sourcing.md)를 보세요.

양자 하드웨어(트랜스몬 칩, 희석 냉동기)는 연구소급이라 개인이 구하기 어렵습니다. 벤치는 그 구조를 정확히 시뮬레이션하고, 현실에서는 **Pico W 브리지 → PC → 클라우드 QPU(IBM Quantum)** 경로로 같은 회로(OpenQASM)를 실제 양자컴퓨터에서 실행할 수 있습니다.

## "코딩"의 아날로그 표현

양자 블록을 배치하는 일은 **양자 회로 작성(작곡, composing)**이고, 하드웨어에서 실제로 일어나는 아날로그 실체는 **펄스 시퀀싱(pulse sequencing)**입니다. 옛 아날로그 컴퓨터에서는 같은 일을 **패칭(patching)**이라 불렀습니다. 자세한 내용은 [environments/instrument/quantum-composer.md](environments/instrument/quantum-composer.md)를 보세요.
