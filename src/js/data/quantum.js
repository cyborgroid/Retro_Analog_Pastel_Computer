/* Quantum subsystem data: control stack nodes, coupling map, gate set, preset circuits, OpenQASM export.
   Mirrored in environments/topology/quantum-stack.json and environments/instrument/presets.qasm */
(function (PX) {
  const D = PX.DATA;
  D.QNODES = {
    qbi: { x: 40, y: 40, w: 180, h: 60, c: 'lav', t: 'Q-Bus 브리지', s: 'Pico W · I/O 0xC0', title: 'Q-Bus 브리지 (Raspberry Pi Pico W)', sub: 'PX-80 버스에서 OpenQASM 회로를 받아 QCU로 넘깁니다. 실제로 만들 때는 이 브리지가 USB/Wi-Fi로 PC에 전달하고, PC가 클라우드 QPU(IBM Quantum)에 제출합니다.', kv: [['실제 부품', 'Raspberry Pi Pico W + 74LVC245'], ['포트', '0xC0–0xC7'], ['IRQ', '결과 준비 시 /INT']], fault: '호스트와 QCU의 연결이 끊겨 회로를 실행할 수 없습니다.' },
    qcu: { x: 40, y: 140, w: 180, h: 70, c: 'lav', t: 'QCU 시퀀서', s: 'QICK · RFSoC FPGA', title: '양자 제어 장치 (QCU)', sub: '게이트를 펄스 일정으로 바꾸어 DAC를 정확한 시각에 트리거하고, 판독 결과를 0/1로 판정합니다. 구할 수 있는 실물: Fermilab 오픈소스 QICK 펌웨어 + RFSoC 4x2 보드.', kv: [['실제 부품', 'QICK + RFSoC 4x2'], ['클럭', '250 MHz (4 ns 분해능)'], ['샷 반복', '최대 10 kHz'], ['판정', '실시간 IQ 임계값']], fault: '시퀀서가 멈춰 회로를 실행할 수 없습니다.' },
    awg: { x: 40, y: 260, w: 180, h: 60, c: 'sky', t: 'AWG 4ch', s: 'DAC 16bit · 2 GS/s', title: '임의 파형 발생기 (AWG)', sub: 'I/Q 기저대역 펄스(가우시안 + DRAG)와 플럭스 펄스를 만듭니다. IF는 50 MHz입니다.', kv: [['채널', 'I · Q · Z0–Z4'], ['샘플링', '2 GS/s, 16 bit'], ['IF', '50 MHz']], fault: '구동 펄스와 플럭스 펄스가 모두 사라집니다. 게이트가 실행되지 않아 결과가 모두 |0⟩이 됩니다.' },
    lo: { x: 260, y: 260, w: 160, h: 60, c: 'sky', t: 'LO 합성기', s: '4.95 GHz · −110 dBc', title: '국부 발진기 (LO)', sub: '마이크로파 반송파를 만듭니다. LO + IF = 큐비트 구동 주파수입니다.', kv: [['주파수', '4.950 GHz'], ['위상잡음', '−110 dBc/Hz @10 kHz'], ['출력', '+16 dBm']], fault: '반송파가 없어 큐비트가 구동되지 않습니다.' },
    iq: { x: 260, y: 370, w: 160, h: 56, c: 'sky', t: 'IQ 믹서', s: '업컨버전 → 5 GHz', title: 'IQ 믹서', sub: 'I/Q 기저대역과 LO를 곱해 큐비트 주파수의 펄스를 만듭니다. 측파대 억제가 중요합니다.', kv: [['형식', '이중 평형'], ['측파대 억제', '> 35 dBc']], fault: '업컨버전 실패: 구동 펄스가 큐비트에 도달하지 않습니다.' },
    rtamp: { x: 260, y: 40, w: 160, h: 56, c: 'mint', t: '상온 LNA', s: '+40 dB · 다운믹서', title: '상온 증폭 · 다운컨버전', sub: 'HEMT 다음 단에서 판독 신호를 다시 증폭하고 IF로 내립니다.', kv: [['이득', '+40 dB'], ['IF', '25 MHz']], fault: '판독 신호가 손실되어 0/1 판정이 무작위가 됩니다.' },
    adc: { x: 260, y: 140, w: 160, h: 56, c: 'mint', t: '디지타이저', s: 'ADC 12bit · 1 GS/s', title: '디지타이저 (ADC)', sub: 'IF 판독 신호를 샘플링해 I/Q로 복조하고 적분합니다.', kv: [['분해능', '12 bit · 1 GS/s'], ['적분', '0.2–3 µs 창']], fault: '판독값이 기록되지 않아 0/1 판정이 무작위가 됩니다.' },
    cryoctl: { x: 40, y: 370, w: 180, h: 56, c: 'butter', t: '냉동기 제어', s: 'PT 압축기 · ³He 순환', title: '희석 냉동기 제어', sub: '펄스 튜브 압축기와 ³He/⁴He 혼합물 순환 펌프를 운전합니다. 고장 시 냉동기가 데워집니다.', kv: [['냉각', '펄스튜브 + 희석 유닛'], ['최저 온도', '10 mK'], ['냉각 시간', '실제 약 2일 (벤치 40초)']], fault: '냉각이 멈춰 혼합실 온도가 오르고, 큐비트가 열적으로 들뜨며 T1이 무너집니다.' },
    hemt: { x: 800, y: 212, w: 140, h: 46, c: 'mint', t: 'HEMT', s: '4 K · +40 dB', title: 'HEMT 극저온 증폭기', sub: '4 K 단에서 판독 신호를 증폭합니다. 잡음 온도 약 2 K입니다.', kv: [['이득', '+40 dB'], ['잡음 온도', '≈ 2 K']], fault: '판독 SNR이 크게 떨어져 판정 오류가 커집니다.' },
    twpa: { x: 800, y: 382, w: 140, h: 46, c: 'mint', t: 'TWPA', s: 'MXC · 양자한계', title: '진행파 파라메트릭 증폭기 (TWPA)', sub: '조지프슨 접합 사슬로 만든 거의 양자한계 증폭기입니다. 판독 SNR을 크게 높입니다.', kv: [['이득', '+20 dB'], ['대역', '6–8 GHz'], ['펌프', '≈ 7.9 GHz']], fault: 'TWPA가 꺼지면 SNR이 약 1/3로 줄어 판독 오류가 늘어납니다.' },
    qpu: { x: 570, y: 452, w: 240, h: 80, c: 'peach', t: 'QPU 5Q', s: '트랜스몬 × 5 · 10 mK', title: '양자 처리 장치 (QPU)', sub: '사파이어 기판 위 알루미늄/니오븀 트랜스몬 5개. T자형 결합 구조와 큐비트별 판독 공진기를 가집니다.', kv: [['큐비트', '트랜스몬 × 5 (플럭스 가변)'], ['결합', 'T자형 (Q0–Q1–Q2, Q1–Q3–Q4)'], ['2Q 게이트', 'CZ (플럭스 펄스 200 ns)'], ['판독', '분산 판독 7.0–7.2 GHz']], fault: '칩이 응답하지 않아 측정 결과가 완전히 무작위가 됩니다.' }
  };
  D.QSTAGES = [['300 K', 300, 0, 0], ['50 K', 45, 0, 0.35], ['4 K', 3.2, 0.1, 0.5], ['Still', 0.9, 0.4, 0.45], ['CP', 0.1, 0.45, 0.45], ['MXC', 0.010, 0.5, 0.5]];
  D.QCOUPLING = [[0, 1], [1, 2], [1, 3], [3, 4]];
  D.QPOS = [[60, 70], [160, 70], [260, 70], [160, 160], [160, 250]];
  D.QOFFS = { f: [0, 0.11, -0.07, 0.17, -0.13], t1: [1, 0.85, 1.1, 0.75, 0.95], ro: [1, 1.1, 0.9, 1.25, 1.05] };

  /* gate set. phys: needs a drive pulse; vz: virtual Z (frame change, no pulse); two: two-qubit */
  D.GATES = {
    H: { c: 'lav', d: '아다마르: 중첩 생성', kind: 'phys' },
    X: { c: 'mint', d: 'π 펄스 (비트 반전)', kind: 'phys' },
    Y: { c: 'mint', d: 'Y축 π 펄스', kind: 'phys' },
    Z: { c: 'butter', d: '위상 반전 (가상 Z)', kind: 'vz' },
    S: { c: 'butter', d: 'π/2 위상 (가상 Z)', kind: 'vz' },
    T: { c: 'butter', d: 'π/4 위상 (가상 Z)', kind: 'vz' },
    SX: { c: 'mint', d: '√X: π/2 펄스', kind: 'phys' },
    RX: { c: 'sky', d: 'X축 회전 θ', kind: 'phys', p: true },
    RY: { c: 'sky', d: 'Y축 회전 θ', kind: 'phys', p: true },
    RZ: { c: 'butter', d: 'Z축 회전 θ (가상 Z)', kind: 'vz', p: true },
    CX: { c: 'peach', d: 'CNOT: 제어 큐비트가 1이면 대상 반전', kind: 'two' },
    CZ: { c: 'peach', d: '제어-Z: 둘 다 1이면 위상 반전', kind: 'two' },
    CP: { c: 'peach', d: '제어-위상 θ', kind: 'two', p: true },
    SWAP: { c: 'peach', d: '두 큐비트 상태 교환', kind: 'two' },
    M: { c: 'rose', d: '측정 (분산 판독)', kind: 'meas' },
    RST: { c: 'rose', d: '능동 리셋 (측정 + 조건부 π)', kind: 'meas' }
  };
  D.ANGLES = [['π/8', Math.PI / 8], ['π/4', Math.PI / 4], ['π/3', Math.PI / 3], ['π/2', Math.PI / 2], ['2π/3', 2 * Math.PI / 3], ['π', Math.PI], ['3π/2', 3 * Math.PI / 2], ['−π/2', -Math.PI / 2], ['1.2', 1.2]];
  D.angleName = th => { const a = D.ANGLES.find(([, v]) => Math.abs(v - th) < 1e-6); return a ? a[0] : th.toFixed(2); };

  const M = (q, t) => ({ g: 'M', q, t });
  D.QPRESETS = {
    bell: { n: '벨 상태 |Φ+⟩', q: 2, note: '00과 11만 반씩 나옵니다. 두 큐비트가 얽혀 있습니다.', ops: [{ g: 'H', q: 0, t: 0 }, { g: 'CX', q: 0, q2: 1, t: 1 }, M(0, 2), M(1, 2)] },
    ghz: { n: 'GHZ 5큐비트', q: 5, note: '00000과 11111만 나옵니다. 결합 맵(T자형)을 따라 CNOT을 배치했습니다.', ops: [{ g: 'H', q: 0, t: 0 }, { g: 'CX', q: 0, q2: 1, t: 1 }, { g: 'CX', q: 1, q2: 2, t: 2 }, { g: 'CX', q: 1, q2: 3, t: 3 }, { g: 'CX', q: 3, q2: 4, t: 4 }, ...[0, 1, 2, 3, 4].map(q => M(q, 5))] },
    superpos: { n: '균등 중첩 3큐비트', q: 3, note: '8가지 결과가 고르게 나옵니다(각 12.5 %).', ops: [{ g: 'H', q: 0, t: 0 }, { g: 'H', q: 1, t: 0 }, { g: 'H', q: 2, t: 0 }, M(0, 1), M(1, 1), M(2, 1)] },
    grover: { n: '그로버 검색 (|11⟩ 찾기)', q: 2, note: '한 번의 반복으로 표시된 답 11이 거의 100 % 나옵니다.', ops: [{ g: 'H', q: 0, t: 0 }, { g: 'H', q: 1, t: 0 }, { g: 'CZ', q: 0, q2: 1, t: 1 }, { g: 'H', q: 0, t: 2 }, { g: 'H', q: 1, t: 2 }, { g: 'X', q: 0, t: 3 }, { g: 'X', q: 1, t: 3 }, { g: 'CZ', q: 0, q2: 1, t: 4 }, { g: 'X', q: 0, t: 5 }, { g: 'X', q: 1, t: 5 }, { g: 'H', q: 0, t: 6 }, { g: 'H', q: 1, t: 6 }, M(0, 7), M(1, 7)] },
    bv: { n: '번스타인–바지라니 (비밀 101)', q: 4, note: '한 번의 질의로 비밀 문자열 101을 알아냅니다. Q2–Q3는 비인접이라 SWAP 라우팅이 붙습니다.', ops: [{ g: 'X', q: 3, t: 0 }, ...[0, 1, 2, 3].map(q => ({ g: 'H', q, t: 1 })), { g: 'CX', q: 0, q2: 3, t: 2 }, { g: 'CX', q: 2, q2: 3, t: 3 }, ...[0, 1, 2].map(q => ({ g: 'H', q, t: 4 })), M(0, 5), M(1, 5), M(2, 5)] },
    dj: { n: '도이치–조사 (균형 함수)', q: 3, note: '결과가 00이 아니면 함수는 균형입니다. 여기서는 11이 나옵니다.', ops: [{ g: 'X', q: 2, t: 0 }, ...[0, 1, 2].map(q => ({ g: 'H', q, t: 1 })), { g: 'CX', q: 0, q2: 2, t: 2 }, { g: 'CX', q: 1, q2: 2, t: 3 }, { g: 'H', q: 0, t: 4 }, { g: 'H', q: 1, t: 4 }, M(0, 5), M(1, 5)] },
    teleport: { n: '양자 순간이동 (지연 측정)', q: 3, note: 'Q0에 만든 상태 RY(1.2)가 Q2로 옮겨집니다. Q2에서 1이 나올 확률은 sin²(0.6) ≈ 31.9 %입니다.', ops: [{ g: 'RY', q: 0, t: 0, th: 1.2 }, { g: 'H', q: 1, t: 0 }, { g: 'CX', q: 1, q2: 2, t: 1 }, { g: 'CX', q: 0, q2: 1, t: 2 }, { g: 'H', q: 0, t: 3 }, { g: 'CX', q: 1, q2: 2, t: 4 }, { g: 'CZ', q: 0, q2: 2, t: 5 }, M(2, 6)] },
    qft3: { n: 'QFT 3큐비트 (|101⟩ 입력)', q: 3, note: '확률은 고르지만 상태벡터의 위상이 계단처럼 돕니다. 상태벡터 표의 위상 원판을 보세요.', ops: [{ g: 'X', q: 0, t: 0 }, { g: 'X', q: 2, t: 0 }, { g: 'H', q: 2, t: 1 }, { g: 'CP', q: 1, q2: 2, t: 2, th: Math.PI / 2 }, { g: 'CP', q: 0, q2: 2, t: 3, th: Math.PI / 4 }, { g: 'H', q: 1, t: 4 }, { g: 'CP', q: 0, q2: 1, t: 5, th: Math.PI / 2 }, { g: 'H', q: 0, t: 6 }, { g: 'SWAP', q: 0, q2: 2, t: 7 }] },
    bloch: { n: '블로흐 구 데모', q: 3, note: '측정 없이 각 큐비트의 방향만 봅니다. Q0은 −Y, Q1은 X–Z 사이, Q2는 +Y를 향합니다.', ops: [{ g: 'RX', q: 0, t: 0, th: Math.PI / 2 }, { g: 'RY', q: 1, t: 0, th: Math.PI / 4 }, { g: 'H', q: 2, t: 0 }, { g: 'S', q: 2, t: 1 }] }
  };

  D.toQASM = (circ, n) => {
    const r = th => th.toFixed(6);
    const L = ['OPENQASM 2.0;', 'include "qelib1.inc";', `qreg q[${n}];`, `creg c[${n}];`];
    [...circ].sort((a, b) => a.t - b.t || a.q - b.q).forEach(o => {
      const g = o.g, q = `q[${o.q}]`, q2 = `q[${o.q2}]`;
      if (g === 'M') L.push(`measure ${q} -> c[${o.q}];`);
      else if (g === 'RST') L.push(`reset ${q};`);
      else if (g === 'CX') L.push(`cx ${q},${q2};`);
      else if (g === 'CZ') L.push(`cz ${q},${q2};`);
      else if (g === 'CP') L.push(`cu1(${r(o.th)}) ${q},${q2};`);
      else if (g === 'SWAP') L.push(`swap ${q},${q2};`);
      else if (D.GATES[g] && D.GATES[g].p) L.push(`${g.toLowerCase()}(${r(o.th)}) ${q};`);
      else L.push(`${g.toLowerCase()} ${q};`);
    });
    return L.join('\n');
  };
})(window.PX);
