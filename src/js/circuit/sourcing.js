/* Circuit · parts sourcing table (real part numbers, availability, easy alternatives) */
(function (PX) {
  'use strict';
  const { U, DATA } = PX, { $, $$ } = U;
  const GROUPS = [['all', '전체'], ['main', '본체 회로'], ['display', '디스플레이'], ['input', '키보드 · 마우스 · 케이스'], ['quantum', '양자']];
  let g = 'all';
  $('#src-filter').innerHTML = GROUPS.map(([k, n]) => `<button data-g="${k}" aria-pressed="${k === g}">${n}</button>`).join('');
  function render() {
    const rows = DATA.SOURCING.filter(r => g === 'all' || r[0] === g);
    $('#src-body').innerHTML = rows.map(([, blk, part, pn, st, alt, where]) => {
      const [label, cls] = DATA.SRC_STATUS[st];
      return `<tr><td>${blk}</td><td class="wrap">${part}</td><td class="num wrap">${pn}</td><td><span class="pill ${cls}">${label}</span></td><td class="wrap">${alt}</td><td class="wrap">${where}</td></tr>`;
    }).join('');
    const cnt = {}; rows.forEach(r => cnt[r[4]] = (cnt[r[4]] || 0) + 1);
    $('#src-sum').innerHTML = Object.entries(cnt).map(([k, n]) => `<span class="pill ${DATA.SRC_STATUS[k][1]}">${DATA.SRC_STATUS[k][0]} ${n}</span>`).join('');
  }
  $('#src-filter').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (!b) return; g = b.dataset.g; $$('#src-filter button').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); });
  PX.setSourcingGroup = k => { g = k; $$('#src-filter button').forEach(x => x.setAttribute('aria-pressed', x.dataset.g === k)); render(); };
  render();
})(window.PX);
