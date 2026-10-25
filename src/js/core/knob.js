/* Rotary knob control: drag vertically, mouse wheel, or arrow keys */
(function (PX) {
  'use strict';
  const { clamp } = PX.U;
  PX.knob = function (host, o) {
    host.className = 'knob'; host.tabIndex = 0; host.setAttribute('role', 'slider'); host.setAttribute('aria-label', o.label);
    host.innerHTML = `<div class="kb-cap"><i></i></div><span class="kb-val"></span><span class="kb-lab">${o.label}</span>`;
    const cap = host.querySelector('.kb-cap'), val = host.querySelector('.kb-val');
    const n = o.values.length, px = o.px || 14;
    let idx = o.index;
    function set(i, fire = true) {
      idx = clamp(Math.round(i), 0, n - 1);
      cap.style.transform = `rotate(${-135 + 270 * idx / (n - 1)}deg)`;
      const v = o.values[idx]; val.textContent = o.fmt(v);
      host.setAttribute('aria-valuemin', 0); host.setAttribute('aria-valuemax', n - 1);
      host.setAttribute('aria-valuenow', idx); host.setAttribute('aria-valuetext', o.fmt(v));
      if (fire) o.onChange(v, idx);
    }
    let st = null;
    host.addEventListener('pointerdown', e => { host.setPointerCapture(e.pointerId); st = { y: e.clientY, i: idx }; e.preventDefault(); host.focus(); });
    host.addEventListener('pointermove', e => { if (st) set(st.i + (st.y - e.clientY) / px); });
    host.addEventListener('pointerup', () => st = null);
    host.addEventListener('pointercancel', () => st = null);
    host.addEventListener('wheel', e => { e.preventDefault(); set(idx + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    host.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(idx + 1); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(idx - 1); }
    });
    set(idx, false);
    return {
      set,
      setVal: v => { let bi = 0, bd = Infinity; o.values.forEach((x, i) => { const d = Math.abs(x - v); if (d < bd) { bd = d; bi = i; } }); set(bi); },
      get: () => o.values[idx]
    };
  };
})(window.PX);
