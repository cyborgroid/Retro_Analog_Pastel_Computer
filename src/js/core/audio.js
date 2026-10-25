/* PSG sound via WebAudio: 3 square channels + noise + a key-click voice. Starts only from a user click */
(function (PX) {
  'use strict';
  const { S } = PX;
  const A = PX.audio = {
    ctx: null, osc: [], gain: [],
    start() {
      if (this.ctx) { this.ctx.resume(); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.12; this.master.connect(c.destination);
      S.psg.ch.forEach(ch => {
        const o = c.createOscillator(); o.type = 'square'; o.frequency.value = ch.f;
        const g = c.createGain(); g.gain.value = 0; o.connect(g); g.connect(this.master); o.start();
        this.osc.push(o); this.gain.push(g);
      });
      const buf = c.createBuffer(1, c.sampleRate, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true;
      this.noiseG = c.createGain(); this.noiseG.gain.value = 0; ns.connect(this.noiseG); this.noiseG.connect(this.master); ns.start();
      this.blipO = c.createOscillator(); this.blipO.type = 'square';
      this.blipG = c.createGain(); this.blipG.gain.value = 0; this.blipO.connect(this.blipG); this.blipG.connect(this.master); this.blipO.start();
      return true;
    },
    live() { return !!this.ctx && S.psgOn && PX.clockOn() && !S.faults.has('psg') && !S.faults.has('spk'); },
    update() {
      if (!this.ctx) return;
      const live = this.live(), t = this.ctx.currentTime;
      S.psg.ch.forEach((ch, i) => {
        this.osc[i].frequency.setTargetAtTime(ch.f, t, 0.01);
        this.gain[i].gain.setTargetAtTime(live && ch.on ? ch.v * 0.5 : 0, t, 0.02);
      });
      this.noiseG.gain.setTargetAtTime(live ? S.psg.noise * 0.5 : 0, t, 0.02);
    },
    blip(f, len = 0.09) {
      if (!this.live()) return;
      const t = this.ctx.currentTime, g = this.blipG.gain;
      this.blipO.frequency.setValueAtTime(f, t);
      g.cancelScheduledValues(t); g.setValueAtTime(0.45, t); g.exponentialRampToValueAtTime(0.001, t + len);
    },
    /* a short jingle in the pastel spirit: C major arpeggio and a turn */
    melody() {
      if (!this.live()) return false;
      const notes = [523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 880, 1046.5];
      const t0 = this.ctx.currentTime + 0.05, g = this.blipG.gain;
      g.cancelScheduledValues(t0);
      notes.forEach((f, i) => {
        const t = t0 + i * 0.16;
        this.blipO.frequency.setValueAtTime(f, t);
        g.setValueAtTime(0.4, t); g.exponentialRampToValueAtTime(0.02, t + 0.15);
      });
      g.setValueAtTime(0, t0 + notes.length * 0.16);
      return true;
    },
    stop() { if (this.ctx) this.ctx.suspend(); }
  };
})(window.PX);
