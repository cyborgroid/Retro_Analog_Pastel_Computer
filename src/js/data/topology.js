/* System graph — mirrored in environments/topology/system-graph.json */
(function (PX) {
  const D = PX.DATA;
  D.NODES = {
    xtal: { x: 60, y: 40, w: 170, h: 58, c: 'butter', t: 'XTAL', s: '14.318 MHz', title: '수정 발진기', sub: '시스템 마스터 클럭. NTSC 컬러버스트의 4배 주파수를 분주해 CPU와 VDP에 공급합니다.', kv: [['주파수', '14.31818 MHz'], ['CPU 분주', '÷4 → 3.58 MHz'], ['VDP', '도트 클럭 5.37 MHz'], ['정밀도', '±30 ppm']], probe: 'clk', fault: '클럭이 멈추면 CPU와 VDP가 모두 정지합니다. 모니터는 동기 신호를 잃고 NO SIGNAL을 띄웁니다.' },
    cpu: { x: 60, y: 200, w: 200, h: 96, c: 'lav', t: 'PX-80 CPU', s: 'Z80 호환 · 3.58 MHz', title: 'PX-80 CPU', sub: '8비트 CPU. 16비트 주소 버스와 8비트 데이터 버스로 모든 주변장치와 통신합니다.', kv: [['실제 부품', 'Z84C0010PEG (Z80, 재고 풍부)'], ['클럭', '3.579545 MHz'], ['버스', 'A0–A15 · D0–D7'], ['M1 사이클', '4 T-state'], ['인터럽트', '/INT 모드 1 · 0x0038']], probe: 'bus', fault: 'CPU가 죽으면 POST가 실행되지 않고, VDP는 초기화되지 않은 VRAM 쓰레기 타일을 그대로 출력합니다.' },
    pio: { x: 60, y: 390, w: 200, h: 76, c: 'peach', t: 'PIO / KBC', s: '키 스캔 · 마우스 디코더', title: 'PIO / 키보드 컨트롤러', sub: '키 매트릭스를 행 단위로 스캔하고 마우스 직교 신호를 카운트해 /INT로 CPU에 알립니다.', kv: [['실제 부품', '74HC138 + 74HC541 + ATmega328P'], ['키 스캔', '8행 × 250 µs = 2 ms'], ['마우스', 'X/Y 직교 4체배'], ['I/O 포트', '0xA8–0xAB']], probe: 'kb', fault: '행 스캔이 멈춰 키 입력과 마우스 이동이 전달되지 않습니다. POST에 KBC FAIL이 표시됩니다.' },
    kbd: { x: 40, y: 520, w: 130, h: 58, c: 'peach', t: 'Keyboard', s: '49 keys · 8×8', title: '키보드', sub: '49키 매트릭스. 키마다 1N4148 다이오드가 있어 다중 입력 시 유령 키를 막습니다.', kv: [['키 수', '49'], ['매트릭스', '8 × 8'], ['스위치', 'Gateron/Cherry MX 호환'], ['케이블', '5핀 DIN 코일']], probe: 'kb', fault: '키보드 케이블 단선: 매트릭스 신호가 PIO에 도달하지 않습니다.' },
    mouse: { x: 186, y: 520, w: 130, h: 58, c: 'rose', t: 'Ball Mouse', s: 'Quadrature', title: '볼 마우스', sub: '고무 볼이 X/Y 초퍼 휠을 돌리고 포토인터럽터 2개가 90° 위상차 신호를 만듭니다.', kv: [['센서', 'ITR9608 포토인터럽터 × 4'], ['해상도', '200 CPI'], ['신호', 'XA XB YA YB'], ['커넥터', 'DE-9']], probe: 'mouse', fault: '포토인터럽터 불량: 커서가 움직이지 않습니다.' },
    rom: { x: 470, y: 44, w: 180, h: 58, c: 'mint', t: 'EEPROM 32K', s: 'AT28C256 · 0000–7FFF', title: '32 KB EEPROM', sub: 'BIOS와 PASTELLA OS를 담은 EEPROM. 범용 프로그래머(TL866 등)로 다시 쓸 수 있습니다.', kv: [['실제 부품', 'AT28C256-15PU (생산 중)'], ['주소', '0x0000–0x7FFF'], ['접근 시간', '150 ns'], ['내용', 'BIOS · OS · 폰트']], probe: 'bus', fault: 'ROM 체크섬 오류: 부팅 코드를 읽지 못해 화면에 쓰레기 문자가 나옵니다.' },
    ram: { x: 470, y: 146, w: 180, h: 58, c: 'mint', t: 'SRAM 64K', s: 'AS6C62256 × 2', title: '64 KB SRAM', sub: '정적 RAM 두 개. 리프레시가 필요 없어 회로가 단순합니다(Z80의 /RFSH는 쓰지 않음).', kv: [['실제 부품', 'AS6C62256-55PCN × 2 (생산 중)'], ['용량', '64 KB (뱅크 전환)'], ['접근 시간', '55 ns'], ['주소', '0x8000–0xFFFF']], probe: 'bus', fault: 'DRAM 비트 불량: POST의 RAM 테스트가 C000H에서 멈추고 시스템이 정지합니다.' },
    vdp: { x: 470, y: 248, w: 180, h: 70, c: 'sky', t: 'VDP (Pico)', s: 'RP2040 · TMS9918A 호환', title: 'VDP 비디오 프로세서', sub: 'Raspberry Pi Pico가 TMS9918A 호환 펌웨어로 VRAM을 흉내 내고, PIO와 저항 DAC로 NTSC 컴포지트 비디오를 만듭니다.', kv: [['실제 부품', 'Raspberry Pi Pico + 74LVC245'], ['해상도', '256 × 192'], ['팔레트', '파스텔 16색'], ['수평', '15.734 kHz'], ['수직', '59.94 Hz']], probe: 'video', fault: '비디오와 동기 신호가 사라집니다. 모니터는 자유 발진 래스터와 NO SIGNAL만 표시합니다.' },
    fdc: { x: 470, y: 362, w: 180, h: 58, c: 'butter', t: '저장 컨트롤러', s: 'CH376S · USB/SD', title: '저장장치 컨트롤러', sub: '단종된 플로피 컨트롤러 대신 CH376S 모듈이 USB 메모리·SD 카드의 FAT 파일을 읽고 씁니다.', kv: [['실제 부품', 'CH376S 모듈 (생산 중)'], ['인터페이스', '8비트 병렬'], ['포트', '0x7FF8–0x7FFF']], probe: 'bus', fault: 'DISK ERROR 대화상자가 뜨고 DISK 1 아이콘이 물음표로 바뀝니다.' },
    psg: { x: 470, y: 464, w: 180, h: 58, c: 'rose', t: 'PSG (Pico)', s: 'RP2040 · AY 호환', title: 'PSG 사운드', sub: '두 번째 Pico가 AY-3-8910 호환 3채널 구형파와 노이즈를 PWM으로 내보내고, LM386이 스피커를 구동합니다.', kv: [['실제 부품', 'Raspberry Pi Pico + LM386N-1'], ['채널', '3 톤 + 1 노이즈'], ['출력', 'PWM → RC 필터 → 볼륨']], probe: 'psg', fault: '사운드 출력이 사라집니다. 키 클릭과 멜로디가 재생되지 않습니다.' },
    crt: { x: 760, y: 236, w: 200, h: 94, c: 'sky', t: '19" Wide CRT', s: 'H 15.7k · V 60 · 11 kV', title: '19인치 와이드 CRT', sub: '아날로그 편향 회로. H-FREQ · H-SIZE · V-HOLD · 밝기를 다이얼로 조정합니다.', kv: [['튜브', '19" 16:10 · 100° 편향'], ['수평', '15.734 kHz 플라이백'], ['고압', '11 kV'], ['조작부', 'BRIGHT · V-HOLD · H-SIZE']], probe: 'hdef', fault: '편향 회로가 멈춰 화면 중앙에 가로선 하나만 남습니다.' },
    fdd: { x: 760, y: 362, w: 200, h: 58, c: 'butter', t: 'USB 메모리', s: '3.5" 베이 전면 포트', title: 'USB 메모리 (3.5인치 베이)', sub: '전면 3.5인치 베이 패널(Gotek 형태)에 USB 포트를 둡니다. 실제 3.5인치 FDD는 중고로만 구할 수 있습니다.', kv: [['매체', 'USB 메모리 / SD'], ['파일 시스템', 'FAT32'], ['전원', '+5V']], probe: 'bus', fault: '드라이브 모터 정지: POST에서 FDD NOT READY.' },
    spk: { x: 760, y: 464, w: 200, h: 58, c: 'rose', t: 'Speaker', s: '57 mm · 8 Ω', title: '스피커', sub: '본체 내장 57 mm 풀레인지 스피커.', kv: [['구경', '57 mm'], ['임피던스', '8 Ω'], ['정격', '0.5 W']], probe: 'psg', fault: '보이스 코일 단선: 소리가 나지 않습니다.' },
    psu: { x: 760, y: 44, w: 200, h: 96, c: 'butter', t: 'Linear PSU', s: '+5V · +12V · −12V', title: '선형 전원부', sub: '트랜스 → 브리지 정류 → C1 평활 → 7805 레귤레이터. 부하와 C1에 따라 리플이 달라집니다.', kv: [['입력', 'AC 220 V 60 Hz'], ['트랜스', '9 Vrms 30VA EI형'], ['+5V', 'L7805CV · 방열판'], ['+12V', '7812 · 모니터'], ['−12V', '7912 · 예비']], probe: 'psu', fault: '퓨즈 단선: 모든 레일이 0 V가 됩니다.' }
  };
  D.PROGRAM = [
    ['cpu', 'rom', 'M1 페치 0x%A ← ROM'], ['cpu', 'ram', 'MEM RD 0x%B → A'], ['cpu', 'vdp', 'I/O OUT 0x98 VRAM ←'],
    ['cpu', 'rom', 'M1 페치 0x%A ← ROM'], ['cpu', 'ram', 'MEM WR 0x%B ← HL'], ['cpu', 'psg', 'I/O OUT 0xA1 PSG 톤'],
    ['cpu', 'fdc', 'I/O IN 0x7FF8 CH376S 상태'], ['cpu', 'ram', 'MEM RD 0x%B 스택']
  ];
  D.MEMMAP = [
    { from: 0x0000, to: 0x3FFF, n: 'BIOS (EEPROM)', c: 'mint' }, { from: 0x4000, to: 0x7FFF, n: 'OS · 폰트', c: 'sky' },
    { from: 0x8000, to: 0xBFFF, n: 'RAM 뱅크 0–3', c: 'lav' }, { from: 0xC000, to: 0xFFFF, n: 'RAM 상주 · 스택', c: 'peach' }
  ];
  D.IOPORTS = [['0xC0–0xC7', 'Q-Bus 브리지 (Pico W → PC → 클라우드 QPU)'], ['0x98–0x99', 'VDP 데이터 / 제어'], ['0xA0–0xA2', 'PSG 레지스터'], ['0xA8–0xAB', 'PIO · 키 스캔 · 마우스'], ['0x7FF8–0x7FFF', 'CH376S 저장 컨트롤러'], ['0xF4', '리셋 상태 / 소프트 리셋']];
  D.CLOCKS = [[0, '14.31818 MHz XTAL', true], [1, '÷4 → 3.579545 MHz CPU'], [2, 'M1 4T / MEM 3T 사이클'], [1, 'Pico VDP: 자체 125 MHz → H 15.734 kHz'], [2, '÷262.5 → V 59.94 Hz'], [1, 'Pico PSG: PWM 250 kHz'], [1, 'PIO 스캔 4 kHz (250 µs/행)'], [0, '60 Hz 상용 전원', true], [1, '브리지 → 120 Hz 리플']];
})(window.PX);
