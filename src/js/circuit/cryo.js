/* Circuit (quantum) · dilution refrigerator: chandelier drawing with live stage temperatures, cool-down / warm-up,
   temperature history on a log scale */
(function (PX) {
  'use strict';
  const { U, S, Q, DATA, sch } = PX, { $ } = U;
  const PLATES = [[52, 260, '300 K'], [98, 236, '50 K'], [150, 212, '4 K'], [200, 186, 'Still'], [246, 166, 'CP'], [292, 146, 'MXC']];
  function drawing() {
    let h = `<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dca0"/><stop offset="1" stop-color="#d9b066"/></linearGradient>
      <linearGradient id="frost" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3dcf6" stop-opacity="0"/><stop offset="1" stop-color="#b3dcf6" stop-opacity=".75"/></linearGradient>
      <linearGradient id="warmg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f9bfd0" stop-opacity=".1"/><stop offset="1" stop-color="#f9bfd0" stop-opacity=".7"/></linearGradient></defs>`;
    h += `<rect x="150" y="6" width="60" height="40" rx="8" fill="#c9c3d6" stroke="#9f95bb"/><text class="tiny" x="180" y="30" text-anchor="middle">PT 헤드</text>`;
    PLATES.forEach(([y, w], i) => {
      if (i) { const [py, pw] = PLATES[i - 1]; [-1, 1].forEach(sg => h += `<path d="M${180 + sg * (w / 2 - 14)} ${py + 6} L${180 + sg * (w / 2 - 14)} ${y}" stroke="#c9c3d6" stroke-width="4"/>`); }
      h += `<rect x="${180 - w / 2}" y="${y}" width="${w}" height="10" rx="3" fill="url(#gold)" stroke="#c9a34a"/>`;
    });
    [150, 168, 186].forEach((x, k) => {
      h += `<path d="M${x} 62 V${PLATES[5][0] + 34}" stroke="${k === 2 ? '#5b8fd8' : k === 1 ? '#e7a83a' : '#e46a8f'}" stroke-width="2.4" fill="none"/>`;
      if (k === 0) [[150, '−20'], [200, '−10'], [292, '−20']].forEach(([y, t]) => h += `<rect x="${x - 9}" y="${y + 14}" width="18" height="14" rx="2" fill="#fbf9ff" stroke="#9f95bb"/><text class="tiny" x="${x}" y="${y + 25}" text-anchor="middle" font-size="7">${t}</text>`);
    });
    h += `<rect x="198" y="162" width="40" height="20" rx="3" fill="#aee8d0" stroke="#6fb99a"/><text class="tiny" x="218" y="176" text-anchor="middle">HEMT</text>`;
    h += `<rect x="198" y="304" width="40" height="18" rx="3" fill="#aee8d0" stroke="#6fb99a"/><text class="tiny" x="218" y="317" text-anchor="middle">TWPA</text><circle cx="250" cy="313" r="7" fill="#fbf9ff" stroke="#9f95bb"/>`;
    h += `<path d="M214 210 l8 6 l-8 6 l8 6 l-8 6 l8 6 l-8 6 l8 6" stroke="#b6a6ef" stroke-width="2" fill="none"/><text class="tiny" x="232" y="236">열교환기</text>`;
    h += `<rect x="146" y="${PLATES[5][0] + 12}" width="68" height="44" rx="6" fill="#ffcdb2" stroke="#d99a7a"/><text class="tiny" x="180" y="${PLATES[5][0] + 32}" text-anchor="middle">QPU</text><text class="tiny" x="180" y="${PLATES[5][0] + 45}" text-anchor="middle">샘플 박스</text>`;
    h += `<rect x="140" y="${PLATES[5][0] + 8}" width="80" height="54" rx="8" fill="none" stroke="#8c84a2" stroke-dasharray="3 3"/>`;
    h += `<rect id="cryo-frost" x="40" y="46" width="280" height="320" fill="url(#frost)" opacity="0"/><rect id="cryo-warm" x="40" y="46" width="280" height="320" fill="url(#warmg)" opacity="0"/>`;
    PLATES.forEach(([y, , n], i) => h += `<path class="w thin dash" d="M${180 + PLATES[i][1] / 2 + 4} ${y + 5} H330"/><text class="lab" x="336" y="${y + 9}">${n}</text><text class="val" id="cryo-t${i}" x="420" y="${y + 9}">—</text>`);
    h += sch.text(336, 392, '구동선 −50 dB 감쇠 · 플럭스선 저역통과 · 판독선 증폭', 'tiny');
    return `<svg class="schem" viewBox="0 0 520 400" role="img" aria-label="희석 냉동기 단면">${h}</svg>`;
  }
  $('#cryo-svg').innerHTML = drawing();

  const hist = [];
  const cool = $('#cryo-cool'), warm = $('#cryo-warm-btn');
  function setCooling(on) { Q.cooling = on; cool.classList.toggle('on', on); warm.classList.toggle('on', !on); cool.setAttribute('aria-pressed', on); warm.setAttribute('aria-pressed', !on); PX.qrecalc(); }
  cool.addEventListener('click', () => setCooling(true)); warm.addEventListener('click', () => setCooling(false));
  const fmtT = T => T >= 1 ? T.toFixed(T >= 10 ? 0 : 2) + ' K' : (T * 1000).toFixed(T < 0.1 ? 1 : 0) + ' mK';
  function live() {
    const H = PX.QH;
    DATA.QSTAGES.forEach((_, i) => sch.set('cryo-t' + i, fmtT(PX.stageT(i))));
    const fr = $('#cryo-frost'), wm = $('#cryo-warm'); if (fr) { fr.setAttribute('opacity', (Q.cool * 0.9).toFixed(2)); wm.setAttribute('opacity', ((1 - Q.cool) * 0.9).toFixed(2)); }
    $('#cryo-mxc').textContent = fmtT(H.T); $('#cryo-pth').textContent = (H.pth * 100).toFixed(H.pth < 0.001 ? 4 : 1) + ' %';
    $('#cryo-t1').textContent = (H.qubits[0].T1 >= 1 ? H.qubits[0].T1.toFixed(0) : H.qubits[0].T1.toFixed(3)) + ' µs';
    const p = $('#cryo-pill'), broken = S.faults.has('cryoctl');
    if (broken) { p.className = 'pill bad'; p.textContent = '냉동기 제어 고장 · 데워지는 중'; }
    else if (H.T < 0.03) { p.className = 'pill ok'; p.textContent = '기저 온도 · 큐비트 사용 가능'; }
    else if (Q.cooling) { p.className = 'pill warn'; p.textContent = '냉각 중'; }
    else { p.className = 'pill warn'; p.textContent = '워밍업 중'; }
  }
  function drawHist() {
    const { c, w, h } = U.fit($('#cryo-hist')); if (w < 2) return;
    c.fillStyle = U.css('--panel-2'); c.fillRect(0, 0, w, h);
    const lo = Math.log10(0.008), hi = Math.log10(400), Y = T => h - 16 - (Math.log10(T) - lo) / (hi - lo) * (h - 26);
    c.font = '10px "IBM Plex Mono", monospace';
    [[0.01, '10mK'], [0.1, '100mK'], [1, '1K'], [10, '10K'], [300, '300K']].forEach(([T, l]) => { c.strokeStyle = U.css('--line'); c.beginPath(); c.moveTo(44, Y(T)); c.lineTo(w - 6, Y(T)); c.stroke(); c.fillStyle = U.css('--muted'); c.fillText(l, 2, Y(T) + 3); });
    const cols = [null, '#e46a8f', '#e7a83a', '#5b8fd8', '#8a79cc', '#23885c'];
    for (let s = 1; s < 6; s++) {
      c.strokeStyle = cols[s]; c.lineWidth = s === 5 ? 2 : 1.2; c.beginPath();
      hist.forEach((row, i) => { const x = 44 + i / 119 * (w - 50); i ? c.lineTo(x, Y(row[s])) : c.moveTo(x, Y(row[s])); }); c.stroke();
    }
    c.lineWidth = 1; c.fillStyle = U.css('--muted'); c.fillText('최근 60 s (가속)', w - 100, 12);
  }
  PX.on('quantum', live); live();
  let t = 0, ht = 0;
  PX.addFrame('*', dt => { ht += dt; if (ht > 0.5) { ht = 0; hist.push(DATA.QSTAGES.map((_, i) => PX.stageT(i))); if (hist.length > 120) hist.shift(); } });
  PX.addFrame('circuit', dt => { if (PX.circuitMode !== 'quantum') return; t += dt; if (t > 0.25) { t = 0; live(); drawHist(); } });
})(window.PX);
