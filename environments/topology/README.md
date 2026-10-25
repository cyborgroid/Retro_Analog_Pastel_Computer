# Topology 환경

시스템을 블록과 연결선으로 보는 환경입니다. 구현은 `src/js/topology/topology.js`, 데이터는 `src/js/data/topology.js`에 있습니다.

## 구성

- **신호 레이어**: CPU를 중심으로 공통 버스(D0–D7, A0–A15, /MREQ, /IORQ, /RD, /WR)에 ROM · RAM · VDP · FDC · PSG · PIO가 매달린 구조입니다. 점선은 버스 밖 직결 신호(VIDEO, 34P, AUDIO, CLK, DIN-5, DE-9)입니다.
- **전원 레이어**: PSU에서 +5V(로직), +12V(CRT · FDD 모터), −12V(오디오 앰프)로 갈라지는 전원망입니다.
- **버스 트랜잭션**: 0.9초마다 대표 명령(M1 페치, MEM RD/WR, I/O OUT, RFSH)을 하나씩 실행하며 패킷과 로그를 남깁니다.

## 고장 주입

블록을 고르고 **고장 주입**을 누르면 다른 환경 전체가 실제 고장처럼 반응합니다.

| 블록 | 증상 |
|---|---|
| PSU | 모든 레일 0 V, 화면 꺼짐 |
| XTAL | CPU · VDP 정지, 모니터 NO SIGNAL, 로직 분석기 CLK 평탄 |
| CPU / ROM | POST 미실행, VDP가 쓰레기 타일 출력, 버스 로그 "CPU 정지" |
| RAM | POST RAM 테스트가 C000H에서 정지 (`RAM ERROR AT C000H`) |
| VDP | 비디오와 동기 신호 소실, NO SIGNAL |
| PIO / Keyboard | 키 스캔 정지, 타이핑 불가, POST `KBC FAIL` |
| Mouse | 엔코더 출력 없음, 커서 고정 |
| FDC / FDD | POST `FDD NOT READY`, 데스크톱에 DISK ERROR 대화상자 |
| PSG / Speaker | 무음, PSG 오디오 신호 평탄 |
| CRT | 편향 정지, 화면 중앙 가로선 |

자세한 그래프 데이터는 [system-graph.json](system-graph.json), 주소 공간은 [memory-map.md](memory-map.md)를 보세요.
