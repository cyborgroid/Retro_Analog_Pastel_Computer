/* Assembly environment: 20 animated steps on the shared 3D model, per-step tools / fasteners / torque, QC checklist */
(function (PX) {
  'use strict';
  const { U, S, DATA } = PX, { $, $$, clamp } = U;
  const STEPS = DATA.steps, N = STEPS.length;
  const A = PX.assembly = { progress: 1, target: 1, step: 1, playing: false, dwell: 0, speed: 1, booted: false };
  let checks = U.store.get('asm-checks', {});

  function totalChecks() { return STEPS.reduce((a, s) => a + s.checks.length, 0); }
  function doneChecks() { return Object.values(checks).filter(Boolean).length; }

  function renderList() {
    $('#asm-steps').innerHTML = STEPS.map((s, i) => {
      const n = i + 1, done = s.checks.every((_, j) => checks[s.id + '_' + j]);
      return `<li><button data-s="${n}" ${n === A.step ? 'aria-current="step"' : ''} class="${done ? 'done' : ''}"><span class="n bg-${s.c}">${String(n).padStart(2, '0')}</span><span>${s.t}</span><span class="d">${done ? '✓' : ''}</span></button></li>`;
    }).join('');
  }
  function renderStep() {
    const s = STEPS[A.step - 1], n = A.step;
    $('#asm-no').textContent = String(n).padStart(2, '0');
    $('#asm-title').textContent = s.t;
    $('#asm-mod').textContent = s.m; $('#asm-mod').className = 'tag bg-' + s.c;
    $('#asm-min').textContent = `예상 ${s.min}분`;
    $('#asm-tools').innerHTML = s.tools.map(x => `<li>${x}</li>`).join('');
    $('#asm-fast').innerHTML = s.fast.map(x => `<li>${x}</li>`).join('');
    $('#asm-torque').textContent = s.torque;
    $('#asm-notes').innerHTML = s.notes.map(x => `<li>${x}</li>`).join('');
    $('#asm-checks').innerHTML = s.checks.map((c, j) => { const id = s.id + '_' + j; return `<label><input type="checkbox" id="chk-${id}" data-c="${id}" ${checks[id] ? 'checked' : ''}><span>${c}</span></label>`; }).join('');
    $('#asm-hud').textContent = `STEP ${String(n).padStart(2, '0')} / ${N} · ${s.m} · ${s.t}`;
    $$('#asm-steps button').forEach(b => { if (+b.dataset.s === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    renderProgress();
  }
  function renderProgress() {
    const d = doneChecks(), t = totalChecks();
    $('#asm-prog').style.width = (d / t * 100) + '%';
    const minsDone = STEPS.slice(0, A.step).reduce((a, s) => a + s.min, 0), minsAll = STEPS.reduce((a, s) => a + s.min, 0);
    $('#asm-sum').textContent = `검수 ${d}/${t} · 공정 ${minsDone}/${minsAll}분`;
  }

  function go(n, tween = true) {
    n = clamp(n, 1, N);
    const changed = n !== A.step;
    A.step = n; A.target = n; A.dwell = 0;
    if (tween && (changed || !PX.viewer.camTween)) { const [p, t] = STEPS[n - 1].cam; PX.viewer.tween(p, t, 1.1); }
    renderStep();
  }
  function setPlay(on) {
    A.playing = on; const b = $('#asm-play'); b.textContent = on ? '❚❚ 일시정지' : '▶ 재생'; b.setAttribute('aria-pressed', on); b.classList.toggle('on', on);
    if (on && A.step >= N && A.progress >= N) { A.progress = 0; go(1); }
  }
  $('#asm-first').addEventListener('click', () => { setPlay(false); A.progress = 0; go(1); });
  $('#asm-prev').addEventListener('click', () => { setPlay(false); go(A.step - 1); });
  $('#asm-next').addEventListener('click', () => { setPlay(false); go(A.step + 1); });
  $('#asm-last').addEventListener('click', () => { setPlay(false); go(N); });
  $('#asm-play').addEventListener('click', () => setPlay(!A.playing));
  $('#asm-speed').addEventListener('change', e => A.speed = parseFloat(e.target.value));
  $('#asm-scrub').addEventListener('input', e => {
    setPlay(false); const v = parseFloat(e.target.value); A.progress = v; A.target = v;
    const n = clamp(Math.ceil(v - 1e-6), 1, N); if (n !== A.step) go(n); A.target = v;
  });
  $('#asm-steps').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { setPlay(false); go(+b.dataset.s); } });
  $('#asm-checks').addEventListener('change', e => { const c = e.target.dataset.c; if (!c) return; checks[c] = e.target.checked; U.store.set('asm-checks', checks); renderList(); renderProgress(); });
  $('#asm-reset').addEventListener('click', () => { checks = {}; U.store.set('asm-checks', checks); renderList(); renderStep(); });
  $('#asm-explode').addEventListener('click', () => { PX.show('chassis'); const el = $('#explode'); el.value = 1; el.dispatchEvent(new Event('input')); });

  PX.addFrame('assembly', (dt, t) => {
    if (A.progress < A.target) A.progress = Math.min(A.target, A.progress + dt * A.speed / 1.5);
    else if (A.progress > A.target) A.progress = Math.max(A.target, A.progress - dt * A.speed * 3);
    if (A.playing && A.progress === A.target) {
      A.dwell += dt;
      if (A.dwell > 1.6 / A.speed) { if (A.step < N) go(A.step + 1); else setPlay(false); }
    }
    /* final step: power on and run the POST */
    if (A.progress >= N - 0.001 && !A.booted) { A.booted = true; if (!S.power) $('#pwr').click(); S.bootT = 0; PX.logEvt && PX.logEvt('조립 완료 · 전원 투입 · POST 시작'); }
    if (A.progress < N - 0.5) A.booted = false;
    $('#asm-scrub').value = A.progress;
    $('#asm-pct').textContent = Math.round(A.progress / N * 100) + ' %';
    PX.viewer.render(dt, t);
  });
  PX.onShow = PX.onShow || {};
  PX.onShow.assembly = () => { if (PX.viewer.attach($('#asm-viewport'), 'assembly')) { const [p, t] = STEPS[A.step - 1].cam; PX.viewer.tween(p, t, 0.8); } };
  PX.screenForcedOff = () => PX.activeTab === 'assembly' && A.progress < N - 0.001;

  $('#asm-scrub').max = N;
  renderList(); renderStep();
})(window.PX);
