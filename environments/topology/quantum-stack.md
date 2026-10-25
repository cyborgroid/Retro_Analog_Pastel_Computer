# 양자 서브시스템 토폴로지

PX-80 본체에 양자 처리 장치(QPU)를 붙이는 구조입니다. 구현은 `src/js/topology/qtopology.js`, 데이터는 `src/js/data/quantum.js`와 [quantum-stack.json](quantum-stack.json)(자동 생성)에 있습니다.

## 신호 흐름

```
PX-80 버스 ─ Q-Bus 브리지(Pico W) ─ QCU 시퀀서(QICK/RFSoC)
                                      ├─ AWG I/Q ─┐
                                      │           IQ 믹서 ── 구동선 ─┐
                                      ├─ LO 4.95 GHz ┘               │ −20 dB(4K) −10 dB(Still) −20 dB(MXC)
                                      ├─ AWG Z ── 바이어스-T ── 플럭스선 (LPF 4K, LPF MXC)
                                      │                               ▼
                                      │                         QPU 5Q (10 mK)
                                      │                               │ 판독 공진기
                                      └─ ADC ← 상온 LNA ← HEMT(4K) ← TWPA(MXC) ← 아이솔레이터
```

## 결합 맵

T자형 5큐비트입니다: Q0–Q1, Q1–Q2, Q1–Q3, Q3–Q4. 이웃하지 않은 쌍에 2큐비트 게이트를 놓으면 SWAP 라우팅이 왕복으로 붙습니다. 거리 d이면 SWAP (d−1)회를 두 번 하므로 CZ가 6(d−1)개 늘어나고, 오류와 시간이 함께 커집니다.

## 고장 주입 효과 (양자 노드)

| 노드 | 효과 |
|---|---|
| Q-Bus 브리지 · QCU | 실행 불가 |
| AWG | 구동·플럭스 펄스 없음 → 결과가 모두 \|0⟩ |
| LO · IQ 믹서 | 구동 펄스 없음 → 결과가 모두 \|0⟩ (가상 Z와 플럭스만 동작) |
| 상온 LNA · ADC | 판독이 무작위 (오류 50 %) |
| HEMT | SNR × 0.05 |
| TWPA | SNR × 0.3 |
| 냉동기 제어 | 냉각이 멈춰 혼합실 온도가 오름 → 열적 들뜸, 준입자로 T1 붕괴 |
| QPU | 칩 무응답 → 결과가 완전히 무작위 |

## 실제로 만들 때

트랜스몬 칩과 희석 냉동기는 개인이 구하기 어렵습니다. 같은 토폴로지를 현실에서 구성하는 쉬운 경로는 다음과 같습니다.

1. Q-Bus 브리지는 Raspberry Pi Pico W로 만들고, PC를 거쳐 클라우드 QPU(IBM Quantum)에 OpenQASM을 제출합니다.
2. 직접 큐비트를 다루는 연구실이라면 QCU·AWG·LO·ADC 자리를 QICK(Fermilab 오픈소스) + RFSoC 4x2 보드로 채울 수 있습니다.
