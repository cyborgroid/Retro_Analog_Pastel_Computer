/* CRT picture: BIOS POST, PASTELLA OS desktop, and every analog / fault effect.
   The output canvas feeds the 3D screen texture and the Circuit preview. */
(function (PX) {
  'use strict';
  const { U, S, C } = PX, { TAU, mod, clamp } = U;
  const mk = () => document.createElement('canvas');
  const scr = PX.screen = { W: 640, H: 400, desk: mk(), out: mk(), bg: mk(), ov: mk(), garb: mk(), roll: 0, off: 0, listeners: [], dirty: true };
  const INK = '#3a3550', PAPER = '#fdfbff';

  scr.resize = function (aspect) {
    scr.W = 640; scr.H = Math.round(640 / aspect);
    [scr.desk, scr.out, scr.bg, scr.ov, scr.garb].forEach(c => { c.width = scr.W; c.height = scr.H; });
    statics();
    S.mouse.cx = clamp(S.mouse.cx, 2, scr.W - 4); S.mouse.cy = clamp(S.mouse.cy, 24, scr.H - 4);
    scr.listeners.forEach(f => f());
  };
  scr.onResize = f => scr.listeners.push(f);

  function statics() {
    const { W, H } = scr;
    const b = scr.bg.getContext('2d');
    const g = b.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, '#cbbaff'); g.addColorStop(0.55, '#b9d8fb'); g.addColorStop(1, '#b4ecd6');
    b.fillStyle = g; b.fillRect(0, 0, W, H);
    b.fillStyle = 'rgba(255,255,255,.2)'; for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 * 2; x < W; x += 4) b.fillRect(x, y, 2, 2);
    const o = scr.ov.getContext('2d'); o.clearRect(0, 0, W, H);
    o.fillStyle = 'rgba(10,8,20,.17)'; for (let y = 0; y < H; y += 3) o.fillRect(0, y, W, 1);
    const v = o.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.62); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,6,16,.55)');
    o.fillStyle = v; o.fillRect(0, 0, W, H);
    /* uninitialised VRAM: pastel tile garbage */
    const q = scr.garb.getContext('2d'); const pal = ['#f9bfd0', '#ffcdb2', '#ffe9a8', '#aee8d0', '#b3dcf6', '#cdbdff', '#1d1a2e', '#3a3550'];
    q.font = '16px VT323, monospace';
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
      const k = U.hash(x * 131 + y * 7 + 3); q.fillStyle = pal[Math.floor(k * 8)]; q.fillRect(x, y, 16, 16);
      if (k > 0.55) { q.fillStyle = pal[Math.floor(U.hash(x + y * 999) * 8)]; q.fillText(String.fromCharCode(33 + Math.floor(k * 90)), x + 3, y + 13); }
    }
  }

  function win(c, x, y, w, h, title) {
    c.fillStyle = PAPER; c.fillRect(x, y, w, h); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(x, y, w, h);
    c.fillStyle = '#ffd9e6'; c.fillRect(x + 1, y + 1, w - 2, 18); c.strokeStyle = 'rgba(58,53,80,.5)'; c.lineWidth = 1;
    for (let i = 5; i < 16; i += 3) { c.beginPath(); c.moveTo(x + 4, y + i + .5); c.lineTo(x + w - 4, y + i + .5); c.stroke(); }
    c.fillStyle = '#ffd9e6'; const tw = c.measureText(title).width + 16; c.fillRect(x + w / 2 - tw / 2, y + 1, tw, 18);
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText(title, x + w / 2, y + 15); c.textAlign = 'left';
    c.fillStyle = PAPER; c.fillRect(x + 7, y + 4, 11, 11); c.strokeStyle = INK; c.strokeRect(x + 7.5, y + 4.5, 10, 10);
    c.beginPath(); c.moveTo(x, y + 19.5); c.lineTo(x + w, y + 19.5); c.lineWidth = 2; c.stroke(); c.lineWidth = 1;
  }
  function icon(c, kind, x, y, label) {
    c.strokeStyle = INK; c.lineWidth = 2;
    if (kind === 'disk') { c.fillStyle = '#ffe39a'; c.fillRect(x, y, 34, 34); c.strokeRect(x, y, 34, 34); c.fillStyle = INK; c.fillRect(x + 8, y + 2, 18, 11); c.fillStyle = PAPER; c.fillRect(x + 6, y + 19, 22, 13); if (S.faults.has('fdc') || S.faults.has('fdd')) { c.fillStyle = '#d94a74'; c.font = '28px VT323, monospace'; c.fillText('?', x + 11, y + 31); c.font = '18px VT323, monospace'; } }
    else if (kind === 'folder') { c.fillStyle = '#b6f0d6'; c.fillRect(x, y + 6, 34, 27); c.strokeRect(x, y + 6, 34, 27); c.fillRect(x, y + 2, 13, 6); c.strokeRect(x, y + 2, 13, 6); }
    else if (kind === 'paint') { c.fillStyle = '#cdbdff'; c.fillRect(x + 2, y + 2, 30, 30); c.strokeRect(x + 2, y + 2, 30, 30); ['#f9bfd0', '#ffe9a8', '#aee8d0', '#b3dcf6'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x + 11 + (i % 2) * 12, y + 11 + Math.floor(i / 2) * 12, 5, 0, TAU); c.fill(); }); }
    else { c.fillStyle = '#ffc8b0'; c.fillRect(x + 4, y + 6, 26, 28); c.strokeRect(x + 4, y + 6, 26, 28); c.strokeRect(x + 1, y + 2, 32, 5); for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x + 11 + k * 6, y + 11); c.lineTo(x + 11 + k * 6, y + 30); c.stroke(); } }
    c.lineWidth = 1; c.fillStyle = PAPER; const tw = c.measureText(label).width; c.fillRect(x + 17 - tw / 2 - 3, y + 38, tw + 6, 15);
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText(label, x + 17, y + 50); c.textAlign = 'left';
  }

  function drawDesk(t) {
    const { W, H } = scr, c = scr.desk.getContext('2d');
    c.drawImage(scr.bg, 0, 0);
    c.font = '18px VT323, monospace'; c.textBaseline = 'alphabetic';
    c.fillStyle = PAPER; c.fillRect(0, 0, W, 20); c.fillStyle = INK; c.fillRect(0, 20, W, 2);
    c.fillText('◆ PASTELLA   File   Edit   View   Special   Sound', 8, 15);
    const d = new Date(), hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0');
    c.textAlign = 'right'; c.fillText(hh + ':' + mi, W - 8, 15); c.textAlign = 'left';
    [['disk', 'DISK 1'], ['folder', 'WORK'], ['paint', 'PAINT'], ['trash', 'TRASH']].forEach(([k, n], i) => { if (34 + i * 64 + 54 < H - 22) icon(c, k, W - 58, 34 + i * 64, n); });
    /* NOTE.TXT */
    const nw = Math.min(330, W * 0.5), nh = Math.min(240, H - 120);
    win(c, 18, 34, nw, nh, 'NOTE.TXT');
    c.fillStyle = INK;
    const maxLines = Math.floor((nh - 30) / 19), cols = Math.floor((nw - 22) / 8.2);
    let lines = S.text.split('\n').slice(-maxLines);
    if (S.faults.has('pio') || S.faults.has('kbd')) lines = lines.slice(-(maxLines - 1)).concat(['!! KEYBOARD NOT RESPONDING']);
    lines.forEach((ln, i) => c.fillText(ln.length > cols ? ln.slice(-cols) : ln, 28, 72 + i * 19));
    if (Math.floor(t / 0.45) % 2) { const ll = lines[lines.length - 1] || ''; const lw = c.measureText(ll.slice(-cols)).width; c.fillRect(29 + lw, 72 + (lines.length - 1) * 19 - 13, 8, 15); }
    /* palette + status under note */
    const py = 34 + nh + 10;
    if (py + 30 < H - 24) {
      ['#f9bfd0', '#ffcdb2', '#ffe9a8', '#aee8d0', '#b3dcf6', '#cdbdff', '#fdfbff', '#3a3550'].forEach((col, i) => { c.fillStyle = col; c.fillRect(20 + i * 26, py, 22, 22); c.strokeStyle = INK; c.strokeRect(20.5 + i * 26, py + .5, 21, 21); });
      c.fillStyle = INK; c.fillText('PASTEL-16', 20 + 8 * 26 + 6, py + 16);
    }
    /* CLOCK */
    const cx0 = 18 + nw + 14, cw = Math.min(190, W - cx0 - 78);
    if (cw > 120) {
      win(c, cx0, 34, cw, 150, 'CLOCK');
      const cx = cx0 + cw / 2, cy = 34 + 85, R = 50;
      c.fillStyle = '#fff5d6'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = i % 3 ? 7 : 12; c.beginPath(); c.moveTo(cx + Math.sin(a) * (R - 4), cy - Math.cos(a) * (R - 4)); c.lineTo(cx + Math.sin(a) * (R - l), cy - Math.cos(a) * (R - l)); c.stroke(); }
      const ha = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * TAU, ma = (d.getMinutes() + d.getSeconds() / 60) / 60 * TAU, sa = (d.getSeconds() + d.getMilliseconds() / 1000) / 60 * TAU;
      [[ha, R * .5, 4, INK], [ma, R * .75, 3, INK], [sa, R * .82, 1.5, '#f07aa0']].forEach(([a, l, w, col]) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); c.stroke(); });
      c.lineCap = 'butt'; c.lineWidth = 1;
      /* SCOPE.APP — live trace of the bench scope CH1 */
      const sy = 196, sh = Math.min(120, H - sy - 30);
      if (sh > 70) {
        win(c, cx0, sy, cw, sh, 'SCOPE.APP');
        const gx = cx0 + 6, gy = sy + 24, gw = cw - 12, gh = sh - 30;
        c.fillStyle = '#1b1f2e'; c.fillRect(gx, gy, gw, gh);
        const src = (PX.scopeState && PX.scopeState.src[0]) || 'hdef', sig = PX.SIG[src] || PX.SIG.hdef;
        const win_ = (PX.scopeState ? PX.scopeState.tdiv : 20e-6) * 10, now = PX.now();
        let mn = Infinity, mx = -Infinity; const N = 90, vals = [];
        for (let i = 0; i <= N; i++) { const v = sig.f(now + i / N * win_); vals.push(v); if (isFinite(v)) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
        if (!isFinite(mn)) { mn = 0; mx = 1; } if (mx - mn < 0.1) { mx += 0.5; mn -= 0.5; }
        c.strokeStyle = '#9ff3cc'; c.lineWidth = 1.5; c.beginPath();
        vals.forEach((v, i) => { const y = gy + gh - 4 - ((isFinite(v) ? v : mn) - mn) / (mx - mn) * (gh - 8); i ? c.lineTo(gx + i / N * gw, y) : c.moveTo(gx, y); }); c.stroke(); c.lineWidth = 1;
      }
    }
    /* FDC fault dialog */
    if (S.faults.has('fdc') || S.faults.has('fdd')) {
      const dw = 260, dh = 92, dx = W / 2 - dw / 2, dy = H / 2 - 30;
      c.fillStyle = PAPER; c.fillRect(dx, dy, dw, dh); c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(dx, dy, dw, dh); c.lineWidth = 1; c.strokeRect(dx + 5, dy + 5, dw - 10, dh - 10);
      c.fillStyle = '#d94a74'; c.fillRect(dx + 16, dy + 22, 26, 26); c.fillStyle = PAPER; c.font = '26px VT323, monospace'; c.fillText('!', dx + 25, dy + 44);
      c.font = '18px VT323, monospace'; c.fillStyle = INK; c.fillText('USB ERROR: NO MEDIA IN A:', dx + 52, dy + 34); c.fillText('[ RETRY ]   [ CANCEL ]', dx + 62, dy + 70);
    }
    /* status bar */
    c.fillStyle = PAPER; c.fillRect(0, H - 18, W, 18); c.fillStyle = INK; c.fillRect(0, H - 20, W, 2);
    c.fillText(`RAM 64K  FREE 38912   KEYS ${S.detected.size}   MOUSE ${S.mouse.cntX},${S.mouse.cntY}   7805 ${Math.round(S.tReg)}C`, 8, H - 4);
    /* cursor */
    if (!S.faults.has('mouse')) {
      const m = S.mouse; c.save(); c.translate(Math.round(m.cx), Math.round(m.cy)); c.fillStyle = PAPER; c.strokeStyle = '#1d1a2a'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 17); c.lineTo(4, 13); c.lineTo(7, 20); c.lineTo(10, 19); c.lineTo(7, 12); c.lineTo(12, 12); c.closePath(); c.fill(); c.stroke(); c.restore();
    }
  }

  const POST_T = 3.6;
  scr.booted = () => S.bootT >= POST_T && !S.faults.has('ram');
  function drawPost() {
    const { W, H } = scr, c = scr.desk.getContext('2d'), t = S.bootT;
    c.fillStyle = '#1d1a2e'; c.fillRect(0, 0, W, H);
    c.font = '20px VT323, monospace'; c.textBaseline = 'alphabetic';
    const ramFault = S.faults.has('ram');
    const ramCount = Math.min(65536, Math.floor(clamp((t - 0.9) / 1.1, 0, 1) * 65536 / 1024) * 1024);
    const shownRam = ramFault ? Math.min(ramCount, 49152) : ramCount;
    const ok = (f, msg) => f ? msg : 'OK';
    const L = [
      ['PASTELLA BIOS v1.4   (C) 1984 PASTELLA LABS', '#ffb3d6'], ['', ''],
      ['CPU  PX-80 @ 3.58 MHz ............ OK', '#9ff3cc'],
      ['EEPROM AT28C256 CHECKSUM ........ OK', '#9ff3cc'],
      ['RAM  TEST ' + String(shownRam).padStart(5, ' ') + ' BYTES ' + (shownRam >= 65536 ? '...... OK' : ramFault && ramCount >= 49152 ? '' : ''), '#9ff3cc'],
      ['VDP  PICO TMS9918 COMPAT ......... OK', '#9ff3cc'],
      ['KBC  8x8 MATRIX .................. ' + ok(S.faults.has('pio') || S.faults.has('kbd'), 'FAIL'), S.faults.has('pio') || S.faults.has('kbd') ? '#ff7d9c' : '#9ff3cc'],
      ['USB  CH376S STORAGE .............. ' + ok(S.faults.has('fdc') || S.faults.has('fdd'), 'NO MEDIA'), S.faults.has('fdc') || S.faults.has('fdd') ? '#ff7d9c' : '#9ff3cc'],
      ['PSG  PICO AY COMPAT .............. ' + ok(S.faults.has('psg'), 'NO ACK'), S.faults.has('psg') ? '#ff7d9c' : '#9ff3cc'],
      ['', ''], ['BOOTING PASTELLA OS ...', '#ffe39a']
    ];
    const step = [0, 0, 0.3, 0.55, 0.9, 2.1, 2.35, 2.6, 2.85, 3.0, 3.1];
    let y = 44;
    for (let i = 0; i < L.length; i++) {
      if (t < step[i]) break;
      if (ramFault && i > 4) break;
      c.fillStyle = L[i][1] || '#9ff3cc'; c.fillText(L[i][0], 28, y); y += 24;
    }
    if (ramFault && ramCount >= 49152) {
      c.fillStyle = '#ff7d9c'; c.fillText('RAM ERROR AT C000H  (BANK 3, BIT 5)', 28, y + 4);
      c.fillText('SYSTEM HALTED', 28, y + 28);
    }
    /* pastel logo bar */
    ['#f9bfd0', '#ffcdb2', '#ffe9a8', '#aee8d0', '#b3dcf6', '#cdbdff'].forEach((col, i) => { c.fillStyle = col; c.fillRect(W - 150 + i * 20, 30, 16, 60); });
    if (Math.floor(t / 0.4) % 2) { c.fillStyle = '#fdfbff'; c.fillRect(28, H - 34, 10, 18); }
  }
  function drawNoSignal(t, label) {
    const { W, H } = scr, c = scr.desk.getContext('2d');
    c.fillStyle = '#16151d'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(200,200,230,${Math.random() * 0.08})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
    const bw = 210, bh = 54, x = W / 2 - bw / 2, y = H / 2 - bh / 2 + Math.sin(t * 0.7) * H * 0.18;
    c.fillStyle = '#cdbdff'; c.fillRect(x, y, bw, bh); c.fillStyle = '#2b2838'; c.font = '26px VT323, monospace'; c.textAlign = 'center';
    c.fillText(label, W / 2, y + 34); c.textAlign = 'left';
  }

  let lastSigT = 0;
  scr.compose = function (dt, t, forceOff) {
    const { W, H } = scr, o = scr.out.getContext('2d');
    o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    o.fillStyle = '#0b0a10'; o.fillRect(0, 0, W, H);
    const powered = PX.mainsOn() && !forceOff;
    if (!powered || S.faults.has('crt')) {
      if (powered && S.faults.has('crt')) { o.fillStyle = 'rgba(230,240,255,.85)'; o.fillRect(W * 0.05, H / 2 - 1, W * 0.9, 2); }
      else { scr.off = Math.max(0, scr.off - dt * 1.5); if (scr.off > 0) { o.fillStyle = `rgba(230,240,255,${scr.off})`; o.beginPath(); o.arc(W / 2, H / 2, 4 + 24 * (1 - scr.off), 0, TAU); o.fill(); } }
      scr.dirty = true; return;
    }
    scr.off = 1;
    /* choose what the VDP is sending */
    if (!PX.logicOn()) drawNoSignal(t, S.trip ? 'NO SIGNAL · 5V OFF' : 'NO SIGNAL');
    else if (!PX.syncOK()) drawNoSignal(t, 'NO SIGNAL');
    else if (!PX.cpuOK()) scr.desk.getContext('2d').drawImage(scr.garb, 0, 0);
    else if (S.bootT < POST_T || S.faults.has('ram')) drawPost();
    else if (t - lastSigT > 0) drawDesk(t);
    const locked = PX.hLocked() || !PX.syncOK();
    const total = H + 26; scr.roll = mod(scr.roll + S.vHold * total * 0.35 * dt, total);
    let hs = S.hSize, bright = S.bright, jy = 0;
    if (PX.P.dropout) { const k = clamp((7 - PX.P.vmin) / 4, 0.1, 1); bright *= 1 - k * 0.6 * Math.abs(Math.sin(t * TAU * 7.5)); hs *= 1 - k * 0.08 * (0.5 + 0.5 * Math.sin(t * TAU * 7.5)); jy = (Math.random() - .5) * 6 * k; }
    const dw = W * hs, dx = (W - dw) / 2, ys = [scr.roll + jy, scr.roll + jy - total];
    const deg = S.degauss;
    if (locked && deg <= 0.01) ys.forEach(y => o.drawImage(scr.desk, 0, 0, W, H, dx, y, dw, H));
    else {
      const df = locked ? 0 : S.hFreq - C.H_NOM, strips = 72, sh = H / strips;
      ys.forEach(y => {
        for (let i = 0; i < strips; i++) {
          let sk = locked ? 0 : mod(i * df * 0.06 + t * df * 0.5, dw);
          const wob = deg * 22 * Math.sin(i * 0.35 + t * 40) * Math.sin(t * 9);
          o.drawImage(scr.desk, 0, i * sh, W, sh, dx + sk + wob - (locked ? 0 : dw), y + i * sh, dw, sh + 0.5);
          if (!locked) o.drawImage(scr.desk, 0, i * sh, W, sh, dx + sk + wob, y + i * sh, dw, sh + 0.5);
        }
      });
    }
    if (Math.abs(S.vHold) > 0.02) ys.forEach(y => { o.fillStyle = '#0b0a10'; o.fillRect(0, y + H, W, 26); });
    if (deg > 0.01) {
      o.globalCompositeOperation = 'overlay'; o.globalAlpha = Math.min(1, deg * 0.9);
      const g = o.createRadialGradient(W * (0.5 + 0.3 * Math.sin(t * 13)), H * (0.5 + 0.3 * Math.cos(t * 11)), 10, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, '#ff6fa8'); g.addColorStop(0.35, '#6fe0ff'); g.addColorStop(0.7, '#d6ff6f'); g.addColorStop(1, '#a36fff');
      o.fillStyle = g; o.fillRect(0, 0, W, H); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
    }
    o.fillStyle = `rgba(5,4,10,${1 - bright})`; o.fillRect(0, 0, W, H);
    o.drawImage(scr.ov, 0, 0);
    scr.dirty = true;
  };

  scr.resize(C.ASPECTS[S.monitor.aspect]);
})(window.PX);
