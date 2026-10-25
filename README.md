# PASTELLA 84 — 레트로 아날로그 파스텔 컴퓨터

파스텔 톤 레트로 컴퓨터(본체 · 19" 와이드 슬림 CRT · 49키 키보드 · 볼 마우스)를 다섯 가지 가상 환경에서 설계하고 검증하는 프로토타이핑 벤치입니다.

## 실행

`index.html`을 브라우저로 여세요(빌드 불필요). 3D 라이브러리(three.js r128)와 웹폰트는 CDN에서 불러오므로 인터넷 연결이 필요합니다. ES 모듈 대신 일반 `<script>`를 써서 `file://`로도 동작합니다.

## 다섯 환경

| 탭 | 하는 일 | 설계 문서 |
|---|---|---|
| **Topology** | 블록 다이어그램, 버스 트랜잭션, 전원망, **고장 주입**, 메모리 맵, 클럭 트리 | [environments/topology](environments/topology/) |
| **Circuit** | 선형 전원부(리플 · 열 차단), CRT 편향(H/V · 디가우스), 8×8 키 매트릭스(유령 키 · 바운스), 볼 마우스 엔코더, PSG 사운드 | [environments/circuit](environments/circuit/) |
| **Chassis** | 3D 모델, **파라메트릭 와이드 모니터**(크기 · 비율 · 베젤), 분해도, 단면, 야간 조명, 컬러웨이, BOM | [environments/chassis](environments/chassis/) |
| **Assembly** | **20단계 조립 애니메이션**, 단계별 공구 · 체결 부품 · 토크 · 검수 체크, 완성 시 POST | [environments/assembly](environments/assembly/) |
| **Instrument** | 2ch 오실로스코프(싱글 · XY · 슬로프), FFT 스펙트럼, 아날로그 멀티미터(DC/AC), 로직 분석기 | [environments/instrument](environments/instrument/) |

모든 환경은 하나의 시뮬레이션 상태(`src/js/core/state.js`)를 공유합니다. 예를 들어 Circuit에서 부하를 올리면 Instrument의 리플 파형이 바뀝니다. 7805가 과열되면 열 차단으로 3D 모니터에 NO SIGNAL이 뜨고, Topology의 PSU 블록에 경고가 표시됩니다.

## 폴더 구조

```
index.html                 화면 골격(마크업)만. 스타일과 로직은 src/
src/
  css/                     tokens · base · 환경별 스타일 (topology, circuit, chassis, assembly, instrument)
  js/core/                 util(이벤트 버스) · state(공유 상태) · signals(신호 모델) · screen(CRT 화면/POST)
                           knob · audio(PSG WebAudio) · trace
  js/data/                 런타임 데이터: palettes · keyboard · topology · parts · assembly · instrument
  js/topology/             블록 그래프 · 고장 주입
  js/circuit/              psu · crt · keyboard · mouse · psg
  js/chassis/              geometry · model(3D · 조립 단계 등록) · viewer(공유 렌더러) · chassis(UI)
  js/assembly/             조립 타임라인 · 체크리스트
  js/instrument/           scope · spectrum · meter · logic
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
