/* PASTELLA 84 — shared helpers, event bus, frame registry.
   Classic scripts (no ES modules) so the bench also runs from file:// */
window.PX = window.PX || {};
(function (PX) {
  'use strict';
  const U = PX.U = {};
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.mod = (a, n) => ((a % n) + n) % n;
  U.TAU = Math.PI * 2;
  U.css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  U.easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  U.easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  U.hash = n => { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; };

  /* size a canvas to its CSS box at device pixel ratio; returns a ctx in CSS px */
  U.fit = cv => {
    const r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
    return { c, w: r.width, h: r.height };
  };

  const trim = s => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  U.fmtT = s => s >= 1 ? trim(s.toPrecision(3)) + ' s' : s >= 1e-3 ? trim((s * 1e3).toPrecision(3)) + ' ms' : s >= 1e-6 ? trim((s * 1e6).toPrecision(3)) + ' µs' : trim((s * 1e9).toPrecision(3)) + ' ns';
  U.fmtV = v => Math.abs(v) < 1 ? Math.round(v * 1000) + ' mV' : v + ' V';
  U.fmtHz = f => f >= 1e6 ? (f / 1e6).toFixed(3) + ' MHz' : f >= 1e3 ? (f / 1e3).toFixed(3) + ' kHz' : f.toFixed(1) + ' Hz';
  U.hex = (n, w = 4) => n.toString(16).toUpperCase().padStart(w, '0');

  U.store = {
    get(k, d) { try { const v = localStorage.getItem('px84-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('px84-' + k, JSON.stringify(v)); } catch (e) { } }
  };

  /* event bus */
  const L = {};
  PX.on = (e, f) => (L[e] = L[e] || []).push(f);
  PX.emit = (e, d) => (L[e] || []).forEach(f => f(d));

  /* per-tab frame callbacks; '*' runs every frame */
  const FR = PX._frames = {};
  PX.addFrame = (tab, fn) => (FR[tab] = FR[tab] || []).push(fn);

  PX.DATA = PX.DATA || {};
})(window.PX);
