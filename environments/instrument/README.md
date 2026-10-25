# Instrument 환경

시뮬레이션된 신호를 계측기로 측정합니다. 구현은 `src/js/instrument/`(scope · spectrum · meter · logic)에 있습니다.

## 계측기

| 계측기 | 사양 |
|---|---|
| 오실로스코프 | 2ch, 100 ns – 50 ms/div, 50 mV – 10 V/div, 트리거 레벨 · 슬로프(↑/↓) · 채널, RUN / STOP / SINGLE, XY 모드, 형광 잔상 |
| 스펙트럼 분석기 | CH1 기록의 1024포인트 FFT(Hann 창), 피크 마커, 0 ~ −80 dB |
| 아날로그 멀티미터 | DC 20 V / AC 2 V rms, 바늘 관성(스프링-댐퍼), 극성 표시 |
| 로직 분석기 | CPU 버스(CLK, /M1, /MREQ, /IORQ, /RD, /WR, /RFSH, 사이클 주석), 키보드 스캔(ROW0–6, COL), 마우스(XA, XB, YA, YB) |

## 측정점

[probe-points.csv](probe-points.csv)에 측정점과 기대값을 정리했습니다. 프리셋 설정은 [scope-presets.json](scope-presets.json)(자동 생성)에 있습니다.

## 추천 실습

1. **전원 리플**: 부하를 1 A → 2.5 A로 올리면 리플이 커지고 Vpp 값이 따라 변하는 것을 확인합니다.
2. **키 바운스**: 프리셋을 고른 뒤(SINGLE, ↓ 트리거) 아무 키나 누르면 3 ms 남짓의 접점 채터링이 한 번 캡처됩니다.
3. **수평 동기**: Circuit에서 H-FREQ를 16.1 kHz로 돌리면 H-DEF가 H-SYNC에 대해 흘러가는 모습이 보입니다(동기 이탈).
4. **PSG 스펙트럼**: 채널 A를 A4(440 Hz)로 두면 스펙트럼에 440, 1320, 2200 Hz(홀수 고조파) 피크가 나타납니다.
5. **고장 추적**: Topology에서 XTAL 고장을 주입한 뒤 로직 분석기 CLK가 평탄해지는 것을 확인합니다.
