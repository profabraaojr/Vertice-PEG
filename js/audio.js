// Áudio sintetizado com Web Audio: disparos, recargas, passos, impactos, interface e música.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.vol = { master: 0.8, sfx: 0.9, music: 0.45 };
    this.music = null;
    this.voices = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = new AC();
    this.ctx = c;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.sfx = c.createGain();
    this.musicBus = c.createGain();
    this.sfx.connect(this.comp);
    this.musicBus.connect(this.master);
    this.comp.connect(this.master);
    this.master.connect(c.destination);
    // ruído branco reutilizável
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // reverberação curta (resposta ao impulso sintética)
    const irLen = c.sampleRate * 1.4;
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
    }
    this.reverb = c.createConvolver();
    this.reverb.buffer = ir;
    this.reverbGain = c.createGain();
    this.reverbGain.gain.value = 0.22;
    this.reverb.connect(this.reverbGain).connect(this.comp);
    this.applyVolumes();
  }

  setVolumes(master, sfx, music) {
    this.vol.master = master; this.vol.sfx = sfx; this.vol.music = music;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.03);
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.03);
  }

  updateListener(pos, fwd) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t); l.positionY.setValueAtTime(pos.y, t); l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(fwd.x, t); l.forwardY.setValueAtTime(fwd.y, t); l.forwardZ.setValueAtTime(fwd.z, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  // Saída posicional (com pos) ou direta.
  out(pos, reverb = false) {
    const c = this.ctx;
    let node = this.sfx;
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = 4;
      p.maxDistance = 150;
      p.rolloffFactor = 1.1;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      p.connect(this.sfx);
      if (reverb) p.connect(this.reverb);
      node = p;
    } else if (reverb) {
      const g = c.createGain();
      g.connect(this.sfx);
      g.connect(this.reverb);
      node = g;
    }
    return node;
  }

  noiseBurst(dest, t, dur, type, freq, gain, q = 0.8, freqEnd = null) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.006, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5, dur + 0.05);
  }

  tone(dest, t, dur, type, f0, f1, gain) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Disparo: estalo filtrado + baque grave + cauda de ambiência.
  shot(p, pos = null, vol = 1) {
    if (!this.ctx) return;
    if (p.laser) { this.laser(p, pos, vol); return; }
    const t = this.ctx.currentTime;
    const dest = this.out(pos, true);
    const g = vol * p.gain;
    this.noiseBurst(dest, t, p.decay, 'lowpass', p.freq * 5, g, 0.7, p.freq * 0.5);
    this.noiseBurst(dest, t, 0.03, 'highpass', 3000, g * 0.5);
    this.tone(dest, t, p.decay * 0.9, 'sine', p.low * 2.2, p.low * 0.45, g * 0.9);
    if (p.tail) this.noiseBurst(dest, t + 0.02, p.tail, 'lowpass', 900, g * 0.18, 0.5, 200);
  }

  // Feixe de luz: varredura descendente com harmônicos e chiado elétrico.
  laser(p, pos = null, vol = 1) {
    const t = this.ctx.currentTime;
    const dest = this.out(pos, true);
    const g = vol * p.gain;
    const f0 = p.freq * (0.92 + Math.random() * 0.16);
    this.tone(dest, t, p.decay, 'sawtooth', f0, p.low, g * 0.32);
    this.tone(dest, t, p.decay * 0.8, 'square', f0 * 1.5, p.low * 2, g * 0.12);
    this.tone(dest, t, p.decay * 1.4, 'sine', f0 * 0.5, p.low * 0.5, g * 0.5);
    this.noiseBurst(dest, t, 0.08, 'bandpass', 5000, g * 0.35, 2, 1500);
  }

  // Assobio da lâmina cortando o ar.
  swing(heavy = false, pos = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = pos ? this.out(pos) : this.sfx;
    const d = heavy ? 0.32 : 0.2;
    this.noiseBurst(dest, t + 0.02, d, 'bandpass', heavy ? 900 : 1500, heavy ? 0.5 : 0.4, 3, heavy ? 2600 : 4200);
  }

  slashHit(pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(pos);
    this.noiseBurst(dest, t, 0.12, 'lowpass', 1400, 0.55, 1, 300);
    this.noiseBurst(dest, t, 0.05, 'highpass', 4000, 0.25);
    this.tone(dest, t, 0.1, 'sine', 160, 60, 0.35);
  }

  clang(pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(pos);
    [2100, 3170, 4400].forEach((f, i) => this.tone(dest, t, 0.5 - i * 0.1, 'sine', f, f * 0.98, 0.12 - i * 0.025));
    this.noiseBurst(dest, t, 0.04, 'highpass', 3000, 0.3);
  }

  dryFire() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.sfx, t, 0.03, 'highpass', 4000, 0.3);
    this.tone(this.sfx, t, 0.03, 'square', 1800, 900, 0.05);
  }

  click(t, f = 3000, g = 0.25, dest = this.sfx) {
    this.noiseBurst(dest, t, 0.035, 'bandpass', f, g, 3);
    this.tone(dest, t, 0.02, 'square', f * 0.4, f * 0.2, g * 0.12);
  }

  reload(def, pos = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = def.reload;
    const dest = pos ? this.out(pos) : this.sfx;
    const v = pos ? 0.5 : 1;
    if (def.model.type === 'gauntlet') {
      // células de energia: descarga, encaixe e zumbido de recarga crescente
      this.noiseBurst(dest, t + 0.05, 0.2, 'bandpass', 2000, 0.15 * v, 2, 400);
      this.click(t + r * 0.35, 2600, 0.22 * v, dest);
      this.tone(dest, t + r * 0.4, r * 0.55, 'sawtooth', 180, 1400, 0.06 * v);
      this.tone(dest, t + r * 0.4, r * 0.55, 'sine', 360, 2800, 0.05 * v);
      this.tone(dest, t + r * 0.95, 0.15, 'sine', 1760, 1760, 0.12 * v);
      return;
    }
    if (def.model.type === 'shotgun') {
      const n = Math.min(4, def.mag);
      for (let i = 0; i < n; i++) this.click(t + 0.25 + i * (r * 0.75 / n), 1800, 0.22 * v, dest);
      this.click(t + r * 0.9, 1200, 0.3 * v, dest);
      this.click(t + r * 0.95, 2200, 0.25 * v, dest);
      return;
    }
    this.click(t + r * 0.12, 2400, 0.22 * v, dest); // trava
    this.noiseBurst(dest, t + r * 0.18, 0.12, 'bandpass', 900, 0.12 * v, 1.2); // carregador saindo
    this.click(t + r * 0.6, 1600, 0.3 * v, dest); // carregador entrando
    this.click(t + r * 0.64, 2800, 0.2 * v, dest);
    this.click(t + r * 0.85, 1300, 0.28 * v, dest); // ferrolho
    this.click(t + r * 0.9, 3200, 0.2 * v, dest);
  }

  bolt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.click(t + 0.25, 1400, 0.22);
    this.click(t + 0.45, 2600, 0.2);
  }

  pump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.sfx, t + 0.18, 0.08, 'bandpass', 1100, 0.25, 2);
    this.click(t + 0.32, 1500, 0.25);
  }

  switchWeapon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.sfx, t, 0.12, 'bandpass', 700, 0.12, 0.8);
    this.click(t + 0.15, 2600, 0.2);
  }

  zoom() {
    if (!this.ctx) return;
    this.click(this.ctx.currentTime, 4200, 0.12);
  }

  footstep(vol = 0.3, pos = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = pos ? this.out(pos) : this.sfx;
    const f = 280 + Math.random() * 260;
    this.noiseBurst(dest, t, 0.09, 'lowpass', f * 3, vol, 1, f);
    this.noiseBurst(dest, t + 0.01, 0.05, 'highpass', 2500, vol * 0.15);
  }

  land(vol = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.sfx, t, 0.15, 'lowpass', 600, vol, 1, 120);
    this.tone(this.sfx, t, 0.12, 'sine', 120, 50, vol * 0.6);
  }

  jump() {
    if (!this.ctx) return;
    this.noiseBurst(this.sfx, this.ctx.currentTime, 0.08, 'lowpass', 900, 0.15, 1, 300);
  }

  impact(pos, mat = 'concrete') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(pos);
    if (mat === 'metal') {
      this.tone(dest, t, 0.18, 'triangle', 1800 + Math.random() * 900, 1200, 0.18);
      this.noiseBurst(dest, t, 0.05, 'highpass', 3500, 0.2);
    } else if (mat === 'wood') {
      this.noiseBurst(dest, t, 0.07, 'bandpass', 700, 0.3, 1.5);
    } else {
      this.noiseBurst(dest, t, 0.06, 'bandpass', 2200, 0.28, 1.2);
    }
  }

  fleshHit(pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.out(pos), t, 0.08, 'lowpass', 900, 0.35, 1, 300);
  }

  whizz(pos) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dest = this.out(pos);
    this.noiseBurst(dest, t, 0.16, 'bandpass', 4200, 0.35, 4, 900);
  }

  hitmarker(head = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (head) {
      this.tone(this.sfx, t, 0.22, 'sine', 2300, 2250, 0.2);
      this.tone(this.sfx, t, 0.18, 'sine', 3450, 3400, 0.1);
    } else {
      this.tone(this.sfx, t, 0.05, 'triangle', 1500, 1200, 0.16);
    }
  }

  killConfirm() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(this.sfx, t, 0.12, 'triangle', 880, 880, 0.14);
    this.tone(this.sfx, t + 0.07, 0.2, 'triangle', 1320, 1320, 0.12);
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.sfx, t, 0.18, 'lowpass', 500, 0.5, 1, 120);
    this.tone(this.sfx, t, 0.2, 'sine', 90, 45, 0.5);
  }

  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(this.sfx, t, 1.2, 'sine', 220, 55, 0.3);
    this.noiseBurst(this.sfx, t, 0.6, 'lowpass', 400, 0.3, 1, 80);
  }

  beep(f = 880, d = 0.12, g = 0.18) {
    if (!this.ctx) return;
    this.tone(this.sfx, this.ctx.currentTime, d, 'sine', f, f, g);
  }

  roundStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 0.18].forEach((d) => this.tone(this.sfx, t + d, 0.14, 'square', 660, 660, 0.06));
    this.tone(this.sfx, t + 0.36, 0.35, 'square', 990, 990, 0.07);
  }

  roundEnd(win) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = win ? [523, 659, 784, 1046] : [523, 466, 392, 311];
    notes.forEach((f, i) => this.tone(this.sfx, t + i * 0.13, 0.35, 'triangle', f, f, 0.12));
  }

  uiHover() {
    if (!this.ctx) return;
    this.tone(this.sfx, this.ctx.currentTime, 0.03, 'sine', 1200, 1300, 0.04);
  }

  uiClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(this.sfx, t, 0.06, 'triangle', 700, 500, 0.12);
    this.click(t, 3200, 0.1);
  }

  // ---------- música generativa: rock pesado com trechos de suspense ----------
  /*
   * A trilha alterna duas camadas:
   *  - suspense: zumbido grave, trítono em crescendo, cordas trêmulas dissonantes,
   *    tique-taque de relógio e batimento cardíaco;
   *  - rock: guitarras distorcidas em power chords com palhetada abafada,
   *    baixo, bateria (bumbo, caixa, chimbal, prato).
   * Fora da partida as seções se revezam sozinhas; durante a partida a intensidade
   * vem do jogo (setMusicIntensity): calmaria = suspense, combate = rock.
   */
  setMusicIntensity(v) {
    this.musicIntensity = v;
  }

  startMusic() {
    if (!this.ctx || this.music) return;
    const c = this.ctx;
    const bus = c.createGain();
    bus.gain.value = 0;
    bus.gain.setTargetAtTime(1, c.currentTime, 1.2);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    bus.connect(comp).connect(this.musicBus);

    // cadeia da guitarra: pré-ganho -> distorção -> corte de graves -> "caixa" de alto-falante
    const pre = c.createGain(); pre.gain.value = 3.5;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < 2048; i++) { const x = (i / 1024) - 1; curve[i] = Math.tanh(x * 9) * 0.9; }
    shaper.curve = curve; shaper.oversample = '4x';
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const mid = c.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 700; mid.Q.value = 0.8; mid.gain.value = -5;
    const cab = c.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3600; cab.Q.value = 0.7;
    const gtrOut = c.createGain(); gtrOut.gain.value = 0.16;
    pre.connect(shaper).connect(hp).connect(mid).connect(cab).connect(gtrOut).connect(bus);
    // eco discreto para a camada de suspense
    const delay = c.createDelay(); delay.delayTime.value = 0.43;
    const fb = c.createGain(); fb.gain.value = 0.38;
    const wet = c.createGain(); wet.gain.value = 0.5;
    delay.connect(fb).connect(delay); delay.connect(wet).connect(bus);

    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const bpm = 138;
    const step = 60 / bpm / 4; // semicolcheia
    const nodes = [];
    const keep = (n) => { nodes.push(n); if (nodes.length > 400) nodes.shift(); return n; };

    const guitar = (t, root, dur, accent) => {
      for (const [semi, det] of [[0, -9], [0, 9], [7, -5], [12, 6]]) {
        if (!accent && semi === 12) continue;
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midi(root + semi);
        o.detune.value = det;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.38, t + 0.006);
        g.gain.exponentialRampToValueAtTime(accent ? 0.3 : 0.05, t + dur * 0.8);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(pre);
        o.start(t); o.stop(t + dur + 0.02);
      }
    };
    const bass = (t, root, dur) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(root - 12);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
    };
    const kick = (t, v = 1) => this.tone(bus, t, 0.28, 'sine', 140, 42, 0.85 * v);
    const snare = (t, v = 1) => {
      this.noiseBurst(bus, t, 0.18, 'bandpass', 2200, 0.45 * v, 0.7);
      this.tone(bus, t, 0.1, 'triangle', 220, 160, 0.3 * v);
    };
    const hat = (t, open) => this.noiseBurst(bus, t, open ? 0.22 : 0.04, 'highpass', 8000, open ? 0.12 : 0.08);
    const crash = (t) => this.noiseBurst(bus, t, 1.6, 'highpass', 5000, 0.22, 0.5, 9000);

    // camada de suspense
    const drone = (t, dur) => {
      for (const [n, type, v] of [[28, 'sawtooth', 0.09], [40, 'sine', 0.12], [34, 'triangle', 0.05]]) { // Mi grave + trítono (Si bemol)
        const o = c.createOscillator(); o.type = type; o.frequency.value = midi(n);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(180, t); f.frequency.linearRampToValueAtTime(900, t + dur * 0.7); f.frequency.linearRampToValueAtTime(200, t + dur);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.05);
      }
    };
    const tremolo = (t, dur) => {
      // cordas agudas em segunda menor, com tremolo rápido
      for (const n of [76, 77]) {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n);
        const g = c.createGain(); g.gain.value = 0;
        const lfo = c.createOscillator(); lfo.frequency.value = 7.5;
        const lg = c.createGain(); lg.gain.value = 0.018;
        lfo.connect(lg).connect(g.gain);
        const env = c.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.linearRampToValueAtTime(1, t + dur * 0.6); env.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(env).connect(bus); env.connect(delay);
        o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
      }
    };
    const tick = (t, hi) => this.noiseBurst(bus, t, 0.015, 'bandpass', hi ? 5200 : 3800, 0.09, 6);
    const heart = (t) => { this.tone(bus, t, 0.18, 'sine', 70, 40, 0.5); this.tone(bus, t + 0.22, 0.16, 'sine', 62, 38, 0.35); };
    const riser = (t, dur) => {
      this.noiseBurst(bus, t, dur, 'bandpass', 300, 0.25, 1.5, 6000);
      this.tone(bus, t, dur, 'sawtooth', midi(40), midi(52), 0.05);
    };
    const stab = (t) => { guitar(t, 40, 1.4, true); }; // acorde solto e sinistro no suspense

    // riffs de 1 compasso: 1 = palhetada abafada, 2 = acorde aberto, 0 = pausa
    const RIFFS = [
      { notes: [40, 40, 40, 0, 40, 40, 43, 0, 40, 40, 40, 0, 46, 0, 45, 0], rhythm: [1, 1, 1, 0, 1, 1, 2, 0, 1, 1, 1, 0, 2, 0, 2, 0] },
      { notes: [40, 40, 0, 40, 40, 0, 40, 40, 38, 0, 38, 38, 36, 0, 35, 0], rhythm: [1, 1, 0, 1, 1, 0, 1, 1, 2, 0, 1, 1, 2, 0, 2, 0] },
      { notes: [40, 0, 40, 40, 43, 0, 42, 0, 40, 0, 40, 40, 47, 0, 46, 0], rhythm: [2, 0, 1, 1, 2, 0, 2, 0, 2, 0, 1, 1, 2, 0, 2, 0] },
    ];
    const KICKS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0];

    const st = { next: c.currentTime + 0.15, i: 0, section: 'suspense', barsLeft: 8, riff: 0 };
    const autoCycle = () => this.musicIntensity === undefined || this.musicIntensity === null;
    const tickFn = () => {
      while (st.next < c.currentTime + 0.35) {
        const t = st.next;
        const pos = st.i % 16;
        if (pos === 0) {
          // decide a seção no início de cada compasso
          st.barsLeft--;
          const want = autoCycle() ? null : (this.musicIntensity > 0.5 ? 'rock' : 'suspense');
          if (want === 'rock' && st.section === 'suspense') { st.section = 'build'; st.barsLeft = 1; }
          else if (want === 'suspense' && st.section === 'rock' && st.barsLeft > 2) st.barsLeft = 2;
          if (st.barsLeft <= 0) {
            if (st.section === 'suspense') { st.section = 'build'; st.barsLeft = 1; }
            else if (st.section === 'build') { st.section = 'rock'; st.barsLeft = 16; st.riff = Math.floor(Math.random() * RIFFS.length); crash(t); }
            else { st.section = (!autoCycle() && this.musicIntensity > 0.5) ? 'rock' : 'suspense'; st.barsLeft = st.section === 'rock' ? 8 : 8; if (st.section === 'rock') crash(t); }
          }
          if (st.section === 'rock' && st.barsLeft % 4 === 0 && st.barsLeft !== 16) st.riff = (st.riff + 1) % RIFFS.length;
          if (st.section === 'suspense') {
            const bar = st.barsLeft;
            if (bar % 4 === 3) drone(t, step * 64);
            if (bar % 4 === 1) tremolo(t, step * 32);
            if (bar % 2 === 0 && Math.random() < 0.6) stab(t);
          }
          if (st.section === 'build') riser(t, step * 16);
        }
        if (st.section === 'suspense') {
          if (pos % 4 === 0) tick(t, pos % 8 === 0);
          if (pos === 0 || pos === 8) heart(t);
        } else if (st.section === 'build') {
          // rufar crescente na caixa
          const v = 0.3 + (pos / 16) * 0.9;
          snare(t, v * 0.7);
          if (pos >= 12) snare(t + step / 2, v * 0.7);
          if (pos % 4 === 0) kick(t, 0.8);
        } else {
          const r = RIFFS[st.riff];
          const kind = r.rhythm[pos];
          if (kind) {
            const len = kind === 2 ? step * 1.9 : step * 0.85;
            guitar(t, r.notes[pos], len, kind === 2);
            bass(t, r.notes[pos], len);
          }
          if (KICKS[pos]) kick(t);
          if (pos === 4 || pos === 12) snare(t);
          if (pos % 2 === 0) hat(t, pos === 14);
          if (st.barsLeft === 1 && pos >= 12) snare(t + step / 2, 0.8); // virada
        }
        st.i++;
        st.next += step;
      }
    };
    const id = setInterval(tickFn, 90);
    tickFn();
    this.music = { id, bus, comp, nodes };
  }

  stopMusic() {
    if (!this.music) return;
    const { id, bus } = this.music;
    clearInterval(id);
    bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    setTimeout(() => bus.disconnect(), 2500);
    this.music = null;
  }
}
