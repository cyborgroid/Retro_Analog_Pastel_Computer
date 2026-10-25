# PASTELLA 84 — 레트로 아날로그 파스텔 컴퓨터

파스텔 톤 레트로 컴퓨터(본체 · 19" 와이드 슬림 CRT · 49키 키보드 · 볼 마우스)를 다섯 가지 가상 환경에서 설계하고 검증하는 프로토타이핑 벤치입니다.

## 실행

`index.html`을 브라우저로 여세요(빌드 불필요). 3D 라이브러리(three.js r128)와 웹폰트는 CDN에서 불러오므로 인터넷 연결이 필요합니다. ES 모듈 대신 일반 `<script>`를 써서 `file://`로도 동작합니다.

## 다섯 환경

| 탭 | 하는 일 | 설계 문서 |
|---|---|---|
| **Topology** | 블록 다이어그램, 버스 트랜잭션, 전원망, **고장 주입**, 메모리 맵, 클럭 트리, **양자 서브시스템**(Q-Bus 브리지 → QCU → 희석 냉동기 → 5큐비트 QPU → 판독 체인)과 결합 맵 | [environments/topology](environments/topology/) |
| **Circuit** | **실물 회로도**(실제 기호 · 참조번호 · 품번 · 실시간 TP · 전류 흐름)와 전원부 실물 PCB 보기: 전원부, CRT 수평 출력단, 키 매트릭스, 포토인터럽터, Pico PSG. **양자 회로**: 트랜스몬(칩 실물 배치도), 마이크로파 제어 체인, 희석 냉동기, 분산 판독. **부품 조달 표** | [environments/circuit](environments/circuit/) |
| **Chassis** | 3D 모델, **파라메트릭 와이드 모니터**(크기 · 비율 · 베젤), 분해도, 단면, 야간 조명, 컬러웨이, BOM | [environments/chassis](environments/chassis/) |
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
```

## 데이터 동기화

`environments/` 안의 `*.json`, `keyboard-matrix.csv`, `steps.md`, `fasteners.csv`, `qc-checklist.md`는 `src/js/data/`에서 자동 생성됩니다. 데이터를 고친 뒤에는 다음 명령을 실행하세요.

```
node tools/export-data.js
```

나머지 `.md`, `.cir`, `.csv` 문서는 사람이 직접 관리하는 설계 문서입니다.

## 모델 단위와 기준값

- 3D 모델: 1 단위 = 100 mm
- 상용 전원 220 V / 60 Hz, 트랜스 2차 9 Vrms
- NTSC 타이밍: H 15.734 kHz, V 59.94 Hz, CPU 3.579545 MHz (14.31818 MHz ÷ 4)

## 재료 원칙: 실재하고 구하기 쉬운 부품

본체 회로는 전부 지금 생산 중이거나 재고가 풍부한 부품으로 그렸습니다(SRAM AS6C62256, EEPROM AT28C256, RP2040 Pico, CH376S, 74HC 로직, LM386, L7805CV 등). 단종 칩은 대체했고, 구하기 어려운 것은 그렇다고 표시했습니다. 자세한 내용은 [environments/circuit/parts-sourcing.md](environments/circuit/parts-sourcing.md)를 보세요.

양자 하드웨어(트랜스몬 칩, 희석 냉동기)는 연구소급이라 개인이 구하기 어렵습니다. 벤치는 그 구조를 정확히 시뮬레이션하고, 현실에서는 **Pico W 브리지 → PC → 클라우드 QPU(IBM Quantum)** 경로로 같은 회로(OpenQASM)를 실제 양자컴퓨터에서 실행할 수 있습니다.

## "코딩"의 아날로그 표현

양자 블록을 배치하는 일은 **양자 회로 작성(작곡, composing)**이고, 하드웨어에서 실제로 일어나는 아날로그 실체는 **펄스 시퀀싱(pulse sequencing)**입니다. 옛 아날로그 컴퓨터에서는 같은 일을 **패칭(patching)**이라 불렀습니다. 자세한 내용은 [environments/instrument/quantum-composer.md](environments/instrument/quantum-composer.md)를 보세요.
