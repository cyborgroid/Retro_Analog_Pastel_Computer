/* Circuit · PSG sound chip: 3 tone channels + noise, key click, jingle */
(function (PX) {
  'use strict';
  const { U, S } = PX, { $ } = U;
  const NOTES = [['C4', 261.63], ['D4', 293.66], ['E4', 329.63], ['G4', 392.0], ['A4', 440.0], ['C5', 523.25], ['D5', 587.33], ['E5', 659.25], ['G5', 783.99], ['A5', 880.0], ['C6', 1046.5]];
  const host = $('#psg-chans');
  host.innerHTML = S.psg.ch.map((ch, i) => `<div class="chan"><button class="btn" id="pc-on-${i}" aria-pressed="false">CH ${ch.n}</button>
    <select class="sel" id="pc-note-${i}" aria-label="CH ${ch.n} 음정">${NOTES.map(([n, f]) => `<option value="${f}"${Math.abs(f - ch.f) < 0.5 ? ' selected' : ''}>${n} · ${f.toFixed(0)} Hz</option>`).join('')}</select>
    <input class="vol" type="range" id="pc-vol-${i}" min="0" max="1" step="0.01" value="${ch.v}" aria-label="CH ${ch.n} 볼륨"><b id="pc-vo-${i}">${Math.round(ch.v * 100)}%</b></div>`).join('')
    + `<div class="chan"><b>NOISE</b><span class="note">LFSR 17-bit</span><input type="range" id="pc-noise" min="0" max="1" step="0.01" value="0" aria-label="노이즈 볼륨"><b id="pc-no">0%</b></div>`;
  S.psg.ch.forEach((ch, i) => {
    $('#pc-on-' + i).addEventListener('click', e => { ch.on = !ch.on; e.currentTarget.setAttribute('aria-pressed', ch.on); e.currentTarget.classList.toggle('on', ch.on); });
    $('#pc-note-' + i).addEventListener('change', e => { ch.f = parseFloat(e.target.value); });
    $('#pc-vol-' + i).addEventListener('input', e => { ch.v = parseFloat(e.target.value); $('#pc-vo-' + i).textContent = Math.round(ch.v * 100) + '%'; });
  });
  $('#pc-noise').addEventListener('input', e => { S.psg.noise = parseFloat(e.target.value); $('#pc-no').textContent = Math.round(S.psg.noise * 100) + '%'; });
  PX.setPsgChannel = (i, on) => { const ch = S.psg.ch[i]; ch.on = on; const b = $('#pc-on-' + i); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); };

  /* PSG → mixing resistors → volume → LM386 → speaker */
  const sch = PX.sch;
  function schematic() {
    const G = 188; let h = '';
    h += sch.box(14, 52, 64, 60, '74LVC245', 'U6 5V→3.3V');
    h += sch.text(46, 40, 'Z80 D0–7', 'tiny', 'middle') + sch.wire([[46, 44], [46, 52]]);
    h += sch.box(110, 34, 112, 136, 'Pico', 'U3 RP2040 PSG');
    [['1–10', 'GP0–7', 70], ['11', 'GP8 BDIR', 100], ['12', 'GP9 BC1', 124]].forEach(([n, l, y]) => h += sch.pin(110, y, n, l, 'l'));
    h += sch.wire([[78, 70], [100, 70]]) + sch.text(84, 96, 'BDIR', 'tiny') + sch.wire([[78, 100], [100, 100]]) + sch.wire([[86, 124], [100, 124]]) + sch.text(30, 128, 'BC1', 'tiny');
    [['20', 'GP15 PWM', 80], ['38', 'GND', 140]].forEach(([n, l, y]) => h += sch.pin(222, y, n, l, 'r'));
    h += sch.wire([[232, 140], [244, 140], [244, 150]]) + sch.gnd(244, 150);
    h += sch.two('res', 232, 80, 282, 80, { ref: 'R5', v: '1kΩ' }) + sch.dot(292, 80) + sch.wire([[282, 80], [304, 80], [304, 108], [314, 108]]);
    h += sch.two('cap', 292, 80, 292, 140, { ref: 'C9', v: '10nF', side: 'l' }) + sch.gnd(292, 140) + sch.text(260, 168, 'RC 저역통과 fc ≈ 16 kHz', 'tiny');
    h += sch.two('pot', 314, 108, 364, 108, { ref: 'VR2', v: 'VOL 10kA', vid: 'psg-s-vol' });
    h += sch.two('ecap', 364, 108, 414, 108, { ref: 'C5', v: '10µF' });
    h += sch.opamp(430, 100, { ref: 'U4 LM386', v: 'G = 200' }) + sch.wire([[414, 92], [400, 92]]) + sch.gnd(400, 92);
    h += sch.text(430, 74, 'pin 6 ← +5V', 'tiny', 'middle');
    h += sch.wire([[446, 100], [480, 100]]) + sch.dot(460, 100);
    h += sch.two('res', 460, 100, 460, 146, { ref: 'R8', v: '10Ω', side: 'l' }) + sch.two('cap', 460, 146, 460, G, { ref: 'C8', v: '0.047µF', side: 'l' });
    h += sch.two('ecap', 480, 100, 540, 100, { ref: 'C7', v: '220µF' }) + sch.wire([[540, 100], [560, 100]]);
    h += sch.speaker(570, 106, { ref: 'LS1', v: '8Ω 0.5W' }) + sch.wire([[560, 112], [560, G]]);
    h += sch.wire([[460, G], [560, G]]) + sch.gnd(510, G);
    h += sch.flow([[446, 100], [480, 100], [540, 100], [560, 100]], 'fl-psg');
    h += sch.flag(292, 80, 20, -54, 'PWM', 'psg-s-mix', 100) + sch.flag(560, 100, 20, -60, 'OUT', 'psg-s-out', 92);
    return `<svg class="schem" viewBox="0 0 660 210" role="img" aria-label="PSG 오디오 회로도">${h}</svg>`;
  }
  $('#psg-schem').innerHTML = schematic();
  function psgLive() {
    const live = PX.clockOn() && !S.faults.has('psg'), mix = live ? S.psg.ch.reduce((a, c) => a + (c.on ? c.v : 0), 0) + S.psg.noise : 0;
    sch.set('psg-s-mix', live ? (mix * 0.5).toFixed(2) + ' Vpp' : '0 V');
    sch.set('psg-s-out', PX.audio.live() ? (mix * 2.2).toFixed(1) + ' Vpp' : '무음');
    sch.set('psg-s-vol', S.psgOn ? 'VOL 70%' : 'VOL 0%');
    sch.speed('fl-psg', PX.audio.live() && mix > 0 ? mix : 0);
  }

  const btn = $('#psg-audio');
  function setAudio(on) {
    if (on && !PX.audio.start()) { $('#psg-msg').textContent = '이 브라우저는 WebAudio를 지원하지 않습니다.'; return; }
    S.psgOn = on; if (!on) PX.audio.stop(); else PX.audio.start();
    btn.setAttribute('aria-pressed', on); btn.classList.toggle('on', on); btn.textContent = on ? '스피커 켜짐' : '스피커 켜기';
    status();
  }
  PX.setAudio = setAudio;
  btn.addEventListener('click', () => setAudio(!S.psgOn));
  $('#psg-melody').addEventListener('click', () => {
    if (!S.psgOn) setAudio(true);
    if (!PX.audio.melody()) $('#psg-msg').textContent = 'PSG 또는 스피커가 고장이거나 전원이 꺼져 있어 재생할 수 없습니다.';
  });
  function status() {
    const m = $('#psg-msg');
    if (!S.psgOn) m.textContent = '소리는 스피커 켜기를 누른 뒤에 납니다. 켜면 키를 누를 때마다 클릭음이 납니다.';
    else if (!PX.audio.live()) m.textContent = 'PSG 또는 스피커 고장, 혹은 전원 꺼짐 상태라 무음입니다.';
    else m.textContent = '재생 중. 채널을 켜면 지속음이 나고, 키 입력마다 클릭음이 납니다.';
  }
  PX.on('fault', status); PX.on('power', status);
  PX.addFrame('*', () => PX.audio.update());
  let plt = 0;
  PX.addFrame('circuit', dt => {
    if (PX.circuitMode !== 'classic') return;
    plt += dt; if (plt > 0.25) { plt = 0; psgLive(); }
    PX.drawMini($('#mini-psg'), [{ f: PX.SIG.psg.f, col: U.css('--ph4'), label: 'PSG OUT' }], PX.now(), 0.008, -1.6, 1.6);
  });
  status();
})(window.PX);
