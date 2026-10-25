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
  PX.addFrame('circuit', () => {
    PX.drawMini($('#mini-psg'), [{ f: PX.SIG.psg.f, col: U.css('--ph4'), label: 'PSG OUT' }], PX.now(), 0.008, -1.6, 1.6);
  });
  status();
})(window.PX);
