# Circuit 환경

회로 단위로 동작을 시뮬레이션합니다. 회로도는 실제 부품 기호, 참조번호(R1, C1, U1…), 부품값, 실제 품번으로 그렸고, 노란 TP 깃발은 실시간 측정값, 움직이는 점선은 관례 전류의 방향과 크기입니다. 전원부는 "실물 보드(PCB)" 보기도 있습니다. 부품은 모두 지금 구할 수 있는 것으로 골랐습니다([parts-sourcing.md](parts-sourcing.md)). 신호 모델은 `src/js/core/signals.js`, 카드 UI는 `src/js/circuit/*.js`에 있습니다.

| 블록 | 모델 | 문서 |
|---|---|---|
| 선형 전원부 | 브리지 정류 + C1 방전, 7805 드롭아웃(2 V), 1차 열 모델 | [psu.cir](psu.cir) |
| CRT 편향 | 수평 톱니파(트레이스 84 % · 리트레이스 16 %), 수직 톱니파, 동기 범위 ±250 Hz | [crt-deflection.cir](crt-deflection.cir) |
| 키 매트릭스 | 8×8, 행 스캔 250 µs, 다이오드 유무에 따른 유령 키(합집합-찾기), 접점 바운스 3.2 ms | [keyboard-matrix.csv](keyboard-matrix.csv) |
| 볼 마우스 | 12슬롯 초퍼, 직교 4체배, 200 CPI | [mouse-encoder.md](mouse-encoder.md) |
| PSG | 3채널 구형파 + 노이즈, WebAudio로 실제 재생 | [psg.md](psg.md) |

## 전원부 핵심 식

- C1 피크: `Vpk = 9 V × √2 − 1.4 V(다이오드 2개) = 11.33 V`
- 리플: `Vr = I / (2 · f · C)` (f = 60 Hz, 전파 정류이므로 120 Hz 충전)
- 7805 손실: `Pd = (Vavg − 5 V) × I`
- 접합 온도: `Tj = 25 °C + Pd × (θjc 3 °C/W + θsa)`, 시정수 7 s
- 차단: Tj ≥ 125 °C이면 +5V 차단, 95 °C 이하로 식으면 재기동(POST부터 다시)

| 부하 · C1 · 방열판 | 리플 | C1 최저 | Pd | 정상상태 Tj | 결과 |
|---|---|---|---|---|---|
| 1.0 A · 4700 µF · 대형 (4 °C/W) | 1.77 V | 9.56 V | 5.4 W | 63 °C | 정상 |
| 1.0 A · 4700 µF · 소형 (12 °C/W) | 1.77 V | 9.56 V | 5.4 W | 107 °C | 정상(뜨거움) |
| 1.0 A · 4700 µF · 없음 (45 °C/W) | 1.77 V | 9.56 V | 5.4 W | 286 °C | 열 차단 |
| 3.0 A · 4700 µF · 대형 | 5.32 V | 6.01 V | — | — | 드롭아웃 |
| 2.0 A · 10000 µF · 대형 | 1.67 V | 9.66 V | 11.0 W | 102 °C | 정상 |

## 양자 회로 (탭 상단 "양자 회로 · QPU")

| 카드 | 내용 | 문서 |
|---|---|---|
| 트랜스몬 큐비트 | SQUID + CΣ + 판독 공진기 회로도, 5큐비트 칩 실물 배치도, 퍼텐셜 우물과 에너지 준위, 플럭스 튜닝 곡선, 자동 보정 | [transmon.md](transmon.md), [transmon-lc.cir](transmon-lc.cir) |
| 마이크로파 제어 체인 | AWG → LPF → IQ 믹서 ← LO → BPF → 감쇠기 −50 dB → 큐비트, 바이어스-T 플럭스선, 라비 곡선, DRAG 펄스 | [transmon.md](transmon.md) |
| 희석 냉동기 | 단별 온도, 냉각/워밍업, 온도 기록 | [transmon.md](transmon.md) |
| 분산 판독 | 공진기 → 아이솔레이터 → TWPA → HEMT → LNA → ADC, S21, IQ 단발 측정 구름 | [transmon.md](transmon.md) |

부품 조달 표: [bom-sourcing.csv](bom-sourcing.csv) (자동 생성).
