/* System graph — mirrored in environments/topology/system-graph.json */
(function (PX) {
  const D = PX.DATA;
  D.NODES = {
    xtal: { x: 60, y: 40, w: 170, h: 58, c: 'butter', t: 'XTAL', s: '14.318 MHz', title: '수정 발진기', sub: '시스템 마스터 클럭. NTSC 컬러버스트의 4배 주파수를 분주해 CPU와 VDP에 공급합니다.', kv: [['주파수', '14.31818 MHz'], ['CPU 분주', '÷4 → 3.58 MHz'], ['VDP', '도트 클럭 5.37 MHz'], ['정밀도', '±30 ppm']], probe: 'clk', fault: '클럭이 멈추면 CPU와 VDP가 모두 정지합니다. 모니터는 동기 신호를 잃고 NO SIGNAL을 띄웁니다.' },
    cpu: { x: 60, y: 200, w: 200, h: 96, c: 'lav', t: 'PX-80 CPU', s: 'Z80 호환 · 3.58 MHz', title: 'PX-80 CPU', sub: '8비트 CPU. 16비트 주소 버스와 8비트 데이터 버스로 모든 주변장치와 통신합니다.', kv: [['아키텍처', 'Z80 호환 8-bit'], ['클럭', '3.579545 MHz'], ['버스', 'A0–A15 · D0–D7'], ['M1 사이클', '4 T-state'], ['인터럽트', '/INT 모드 1 · 0x0038']], probe: 'bus', fault: 'CPU가 죽으면 POST가 실행되지 않고, VDP는 초기화되지 않은 VRAM 쓰레기 타일을 그대로 출력합니다.' },
    pio: { x: 60, y: 390, w: 200, h: 76, c: 'peach', t: 'PIO / KBC', s: '키 스캔 · 마우스 디코더', title: 'PIO / 키보드 컨트롤러', sub: '키 매트릭스를 행 단위로 스캔하고 마우스 직교 신호를 카운트해 /INT로 CPU에 알립니다.', kv: [['키 스캔', '8행 × 250 µs = 2 ms'], ['마우스', 'X/Y 직교 4체배'], ['I/O 포트', '0xA8–0xAB'], ['IRQ', '/INT (오픈 드레인)']], probe: 'kb', fault: '행 스캔이 멈춰 키 입력과 마우스 이동이 전달되지 않습니다. POST에 KBC FAIL이 표시됩니다.' },
    kbd: { x: 40, y: 520, w: 130, h: 58, c: 'peach', t: 'Keyboard', s: '49 keys · 8×8', title: '키보드', sub: '49키 매트릭스. 키마다 1N4148 다이오드가 있어 다중 입력 시 유령 키를 막습니다.', kv: [['키 수', '49'], ['매트릭스', '8 × 8'], ['스위치', '리프 스프링 · 3.5 mm'], ['케이블', '5핀 DIN 코일']], probe: 'kb', fault: '키보드 케이블 단선: 매트릭스 신호가 PIO에 도달하지 않습니다.' },
    mouse: { x: 186, y: 520, w: 130, h: 58, c: 'rose', t: 'Ball Mouse', s: 'Quadrature', title: '볼 마우스', sub: '고무 볼이 X/Y 초퍼 휠을 돌리고 포토인터럽터 2개가 90° 위상차 신호를 만듭니다.', kv: [['해상도', '200 CPI'], ['신호', 'XA XB YA YB'], ['버튼', '2 (택트)'], ['커넥터', 'DE-9']], probe: 'mouse', fault: '포토인터럽터 불량: 커서가 움직이지 않습니다.' },
    rom: { x: 470, y: 44, w: 180, h: 58, c: 'mint', t: 'ROM 32K', s: '0x0000–0x7FFF', title: '32 KB 마스크 ROM', sub: 'BIOS와 PASTELLA OS를 담은 ROM. M1 페치의 대부분이 여기서 일어납니다.', kv: [['용량', '32 KB'], ['주소', '0x0000–0x7FFF'], ['접근 시간', '250 ns'], ['내용', 'BIOS · OS · 폰트']], probe: 'bus', fault: 'ROM 체크섬 오류: 부팅 코드를 읽지 못해 화면에 쓰레기 문자가 나옵니다.' },
    ram: { x: 470, y: 146, w: 180, h: 58, c: 'mint', t: 'RAM 64K', s: '4164 × 8 · DRAM', title: '64 KB DRAM', sub: '다이내믹 RAM. M1 사이클 후반의 /RFSH 펄스로 128행이 주기적으로 리프레시됩니다.', kv: [['용량', '64 KB (뱅크 전환)'], ['칩', '4164 × 8'], ['리프레시', '128행 / 2 ms'], ['주소', '0x8000–0xFFFF']], probe: 'bus', fault: 'DRAM 비트 불량: POST의 RAM 테스트가 C000H에서 멈추고 시스템이 정지합니다.' },
    vdp: { x: 470, y: 248, w: 180, h: 70, c: 'sky', t: 'VDP', s: '256×192 · 16 KB VRAM', title: 'VDP 비디오 프로세서', sub: 'VRAM을 읽어 NTSC 타이밍의 컴포지트 비디오와 동기 신호를 만들어 CRT로 보냅니다.', kv: [['해상도', '256 × 192'], ['팔레트', '파스텔 16색'], ['VRAM', '16 KB'], ['수평', '15.734 kHz'], ['수직', '59.94 Hz']], probe: 'video', fault: '비디오와 동기 신호가 사라집니다. 모니터는 자유 발진 래스터와 NO SIGNAL만 표시합니다.' },
    fdc: { x: 470, y: 362, w: 180, h: 58, c: 'butter', t: 'FDC', s: 'MFM 250 kbps', title: '플로피 디스크 컨트롤러', sub: 'MFM 인코딩으로 3.5인치 드라이브를 제어합니다. CPU가 PIO 방식으로 바이트를 전송합니다.', kv: [['인코딩', 'MFM'], ['전송률', '250 kbps'], ['포트', '0x7FF8–0x7FFF']], probe: 'bus', fault: 'DISK ERROR 대화상자가 뜨고 DISK 1 아이콘이 물음표로 바뀝니다.' },
    psg: { x: 470, y: 464, w: 180, h: 58, c: 'rose', t: 'PSG', s: '3ch 구형파 + 노이즈', title: 'PSG 사운드 칩', sub: '3채널 구형파와 노이즈 발생기. 본체 전면의 아날로그 볼륨 다이얼로 출력이 조정됩니다.', kv: [['채널', '3 톤 + 1 노이즈'], ['출력', '모노 · 아날로그 볼륨'], ['전원', '+5V / −12V 앰프']], probe: 'psg', fault: '사운드 출력이 사라집니다. 키 클릭과 멜로디가 재생되지 않습니다.' },
    crt: { x: 760, y: 236, w: 200, h: 94, c: 'sky', t: '19" Wide CRT', s: 'H 15.7k · V 60 · 11 kV', title: '19인치 와이드 CRT', sub: '아날로그 편향 회로. H-FREQ · H-SIZE · V-HOLD · 밝기를 다이얼로 조정합니다.', kv: [['튜브', '19" 16:10 · 100° 편향'], ['수평', '15.734 kHz 플라이백'], ['고압', '11 kV'], ['조작부', 'BRIGHT · V-HOLD · H-SIZE']], probe: 'hdef', fault: '편향 회로가 멈춰 화면 중앙에 가로선 하나만 남습니다.' },
    fdd: { x: 760, y: 362, w: 200, h: 58, c: 'butter', t: '3.5" FDD', s: '720 KB · 300 rpm', title: '3.5인치 플로피 드라이브', sub: '720 KB 더블 덴시티 드라이브.', kv: [['용량', '720 KB DD'], ['회전', '300 rpm'], ['전원', '+5V / +12V 모터']], probe: 'bus', fault: '드라이브 모터 정지: POST에서 FDD NOT READY.' },
    spk: { x: 760, y: 464, w: 200, h: 58, c: 'rose', t: 'Speaker', s: '57 mm · 8 Ω', title: '스피커', sub: '본체 내장 57 mm 풀레인지 스피커.', kv: [['구경', '57 mm'], ['임피던스', '8 Ω'], ['정격', '0.5 W']], probe: 'psg', fault: '보이스 코일 단선: 소리가 나지 않습니다.' },
    psu: { x: 760, y: 44, w: 200, h: 96, c: 'butter', t: 'Linear PSU', s: '+5V · +12V · −12V', title: '선형 전원부', sub: '트랜스 → 브리지 정류 → C1 평활 → 7805 레귤레이터. 부하와 C1에 따라 리플이 달라집니다.', kv: [['입력', 'AC 220 V 60 Hz'], ['트랜스', '9 Vrms · 3 A'], ['+5V', '7805 · 최대 3 A'], ['+12V', '7812 · CRT/FDD'], ['−12V', '7912 · 오디오']], probe: 'psu', fault: '퓨즈 단선: 모든 레일이 0 V가 됩니다.' }
  };
  D.PROGRAM = [
    ['cpu', 'rom', 'M1 페치 0x%A ← ROM'], ['cpu', 'ram', 'MEM RD 0x%B → A'], ['cpu', 'vdp', 'I/O OUT 0x98 VRAM ←'],
    ['cpu', 'rom', 'M1 페치 0x%A ← ROM'], ['cpu', 'ram', 'MEM WR 0x%B ← HL'], ['cpu', 'psg', 'I/O OUT 0xA1 PSG 톤'],
    ['cpu', 'fdc', 'I/O IN 0x7FF8 FDC 상태'], ['cpu', 'ram', 'RFSH 행 0x%R']
  ];
  D.MEMMAP = [
    { from: 0x0000, to: 0x3FFF, n: 'BIOS', c: 'mint' }, { from: 0x4000, to: 0x7FFF, n: 'OS · 폰트', c: 'sky' },
    { from: 0x8000, to: 0xBFFF, n: 'RAM 뱅크 0–3', c: 'lav' }, { from: 0xC000, to: 0xFFFF, n: 'RAM 상주 · 스택', c: 'peach' }
  ];
  D.IOPORTS = [['0x98–0x99', 'VDP 데이터 / 제어'], ['0xA0–0xA2', 'PSG 레지스터'], ['0xA8–0xAB', 'PIO · 키 스캔 · 마우스'], ['0x7FF8–0x7FFF', 'FDC 레지스터'], ['0xF4', '리셋 상태 / 소프트 리셋']];
  D.CLOCKS = [[0, '14.31818 MHz XTAL', true], [1, '÷4 → 3.579545 MHz CPU'], [2, 'M1 4T / MEM 3T 사이클'], [1, '÷1 → VDP 도트 5.37 MHz'], [2, '÷341 → H 15.734 kHz'], [3, '÷262.5 → V 59.94 Hz'], [1, '÷4 → PSG 3.58 MHz'], [1, 'PIO 스캔 4 kHz (250 µs/행)'], [0, '60 Hz 상용 전원', true], [1, '브리지 → 120 Hz 리플']];
})(window.PX);
