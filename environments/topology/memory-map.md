# 메모리 맵 · I/O 맵

## 주소 공간 (64 KB)

| 범위 | 크기 | 내용 | 비고 |
|---|---|---|---|
| 0000H–3FFFH | 16 KB | BIOS (EEPROM 하위) | 리셋 벡터 0000H, IM1 인터럽트 0038H |
| 4000H–7FFFH | 16 KB | PASTELLA OS · 8×8 폰트 | EEPROM 상위 |
| 8000H–BFFFH | 16 KB | RAM 뱅크 0–3 | 포트 F4H로 뱅크 전환 |
| C000H–FFFFH | 16 KB | RAM 상주 영역 · 스택 | 스택 초기값 F380H |

ROM은 AT28C256 EEPROM, RAM은 AS6C62256 SRAM 두 개(각 32 KB)로 구성합니다. 모두 생산 중인 부품이며, SRAM이라 Z80의 /RFSH 리프레시 신호는 쓰지 않습니다.

## I/O 포트

| 포트 | 장치 | 방향 | 설명 |
|---|---|---|---|
| 98H | VDP | R/W | VRAM 데이터 |
| 99H | VDP | R/W | 레지스터 · 상태 |
| A0H | PSG | W | 레지스터 선택 |
| A1H | PSG | W | 데이터 쓰기 |
| A2H | PSG | R | 데이터 읽기 |
| A8H | PIO | W | 키 매트릭스 행 선택 (0–7) |
| A9H | PIO | R | 열 감지 (active low) |
| AAH | PIO | R | 마우스 X 카운터 |
| ABH | PIO | R | 마우스 Y 카운터 · 버튼 |
| F4H | 시스템 | R/W | 리셋 상태 · 뱅크 선택 |
| 7FF8H–7FFFH | CH376S | R/W | USB/SD 저장 컨트롤러 |
| C0H–C7H | Q-Bus 브리지 | R/W | Pico W: OpenQASM 송신 · 결과 수신 (양자 서브시스템) |

## 인터럽트

- PIO는 키 상태가 바뀌거나 마우스 카운터가 움직이면 /INT를 낮춥니다(오픈 드레인, 4.7 kΩ 풀업).
- VDP는 수직 귀선마다(59.94 Hz) /INT를 냅니다.
- CPU는 IM1 모드로 0038H 핸들러에서 VDP 상태 → PIO 순으로 원인을 확인합니다.
