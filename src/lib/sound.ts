/**
 * Think Leo — Sound Engine v2 (Web Audio, zero audio files)
 * ────────────────────────────────────────────────────────
 * A tiny synth studio in ~400 lines. Design notes: docs/ALGORITHM.md §8.
 *
 * Signal chain:
 *
 *   voice ─► voiceGain ─► pan ─┬─► sfxBus ─────────────┬─► master ─► comp ─► out
 *                              └─► reverbSend ─► conv ──┘        ▲
 *   music voices ─► musicBus ───────────────────────────┘   (duckable)
 *
 * · Master bus dynamics: a gentle compressor glues SFX + music so loud
 *   layers never clip (kids crank volume; we protect their ears).
 * · One synthesized impulse-response gives everything the same "room",
 *   the way a real foley kit would.
 * · Instruments are a fixed palette (marimba, pluck, chime, horn, kit,
 *   riser, roar) — every cue is a recipe over that palette, which is why
 *   the whole game sounds like one instrument family.
 * · Music = lookahead-scheduled 4-bar loop in 3 moods (home / play /
 *   rush) with bass, pads, arps and hats; the bus ducks under big cues.
 */

type Osc = OscillatorType;

const NOTE = (semi: number, base = 440) => base * Math.pow(2, semi / 12);

interface ToneOpts {
  at?: number;
  dur?: number;
  type?: Osc;
  vol?: number;
  glide?: number;
  attack?: number;
  bus?: GainNode | null;
  pan?: number;
  wet?: number; // 0..1 reverb send
  filter?: number; // lowpass cutoff (Hz)
  detune?: number; // cents
}

class LeoSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private duckTimer: number | null = null;

  private musicTimer: number | null = null;
  private nextBarAt = 0;
  private barIndex = 0;
  private musicMode: "home" | "play" | "rush" | null = null;

  sfxOn = true;
  musicOn = true;

  /** Call on the first user gesture. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) this.buildGraph();
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", this.onVis);
        document.addEventListener("visibilitychange", this.onVis);
      }
    } catch {
      /* audio is a bonus, never a blocker */
    }
  }

  private onVis = () => {
    if (!this.ctx) return;
    if (document.visibilityState === "visible" && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  };

  private buildGraph() {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 14;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.18;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.comp).connect(ctx.destination);

    // one shared "room" — synthesized stereo impulse, exponential decay
    this.reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    this.reverb.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.32;
    this.reverbSend.connect(this.reverb).connect(reverbOut).connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicOn ? 0.2 : 0;
    this.musicBus.connect(this.master);

    // reusable white noise (saves building a buffer per hat/snare)
    const nlen = Math.floor(ctx.sampleRate * 1.0);
    this.noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
  }

  private get t0(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /* ── instrument primitives ──────────────────────────────────── */

  private tone(freq: number, o: ToneOpts = {}) {
    if (!this.ctx || !this.master) return;
    const {
      at = this.t0,
      dur = 0.15,
      type = "sine",
      vol = 0.2,
      glide,
      attack = 0.006,
      bus,
      pan = 0,
      wet = 0,
      filter,
      detune = 0,
    } = o;
    const out = bus ?? this.sfxBus;
    if (!out) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (detune) osc.detune.setValueAtTime(detune, at);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glide), at + dur);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    let node: AudioNode = osc;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(filter, at);
      f.Q.value = 0.8;
      node.connect(f);
      node = f;
    }
    node.connect(gain);
    this.route(gain, out, pan, wet);
    osc.start(at);
    osc.stop(at + dur + 0.08);
  }

  private noise(
    o: {
      at?: number;
      dur?: number;
      vol?: number;
      f0?: number;
      f1?: number;
      q?: number;
      type?: BiquadFilterType;
      pan?: number;
      wet?: number;
      bus?: GainNode | null;
    } = {}
  ) {
    if (!this.ctx || !this.noiseBuf) return;
    const {
      at = this.t0,
      dur = 0.25,
      vol = 0.12,
      f0 = 800,
      f1,
      q = 1,
      type = "bandpass",
      pan = 0,
      wet = 0,
      bus,
    } = o;
    const out = bus ?? this.sfxBus;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f0, at);
    if (f1) filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
    filt.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filt).connect(gain);
    this.route(gain, out, pan, wet);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  private route(input: AudioNode, bus: GainNode, pan: number, wet: number) {
    if (!this.ctx) return;
    let node = input;
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.setValueAtTime(pan, this.t0);
      node.connect(p);
      node = p;
    }
    node.connect(bus);
    if (wet > 0 && this.reverbSend) {
      const w = this.ctx.createGain();
      w.gain.value = wet;
      node.connect(w).connect(this.reverbSend);
    }
  }

  /* ── instruments ────────────────────────────────────────────── */

  /** warm wooden hit — the game's "correct voice" */
  private marimba(freq: number, at: number, vol = 0.18, pan = 0) {
    this.tone(freq, { at, dur: 0.34, type: "sine", vol, pan, wet: 0.24 });
    this.tone(freq * 4, { at, dur: 0.09, type: "sine", vol: vol * 0.34, pan });
    this.tone(freq * 2.01, { at, dur: 0.16, type: "triangle", vol: vol * 0.22, pan });
  }

  /** guitar-ish pluck for arps and melodies */
  private pluck(freq: number, at: number, vol = 0.13, pan = 0) {
    this.tone(freq, { at, dur: 0.22, type: "triangle", vol, pan, filter: Math.min(9000, freq * 5), wet: 0.18 });
    this.tone(freq * 2, { at, dur: 0.1, type: "sine", vol: vol * 0.4, pan });
  }

  /** bell — stars, achievements, magic */
  private chime(freq: number, at: number, vol = 0.12, pan = 0) {
    this.tone(freq, { at, dur: 0.6, type: "sine", vol, pan, wet: 0.5 });
    this.tone(freq * 2.76, { at, dur: 0.28, type: "sine", vol: vol * 0.3, pan, wet: 0.4 });
    this.tone(freq * 5.4, { at: at + 0.01, dur: 0.16, type: "sine", vol: vol * 0.14, pan });
  }

  /** soft rounded horn — fails, sad moments (never harsh) */
  private horn(freq: number, at: number, dur = 0.3, vol = 0.08) {
    this.tone(freq, { at, dur, type: "sawtooth", vol, filter: 900, attack: 0.03, wet: 0.2 });
    this.tone(freq * 1.005, { at, dur, type: "triangle", vol: vol * 0.8, attack: 0.03 });
  }

  private kick(at: number, vol = 0.3) {
    this.tone(150, { at, dur: 0.22, type: "sine", vol, glide: 44, attack: 0.002 });
    this.noise({ at, dur: 0.03, vol: vol * 0.3, f0: 1200, type: "lowpass" });
  }

  private snare(at: number, vol = 0.16) {
    this.noise({ at, dur: 0.14, vol, f0: 1900, q: 0.8, wet: 0.2 });
    this.tone(196, { at, dur: 0.1, type: "triangle", vol: vol * 0.55 });
  }

  private hat(at: number, open = false, vol = 0.05) {
    this.noise({ at, dur: open ? 0.14 : 0.035, vol, f0: 8200, type: "highpass", q: 0.7 });
  }

  /** rising energy sweep — intros, RUSH ignition */
  private riser(at: number, dur = 0.7, vol = 0.1) {
    this.noise({ at, dur, vol, f0: 350, f1: 3800, q: 1.6, wet: 0.3 });
    this.tone(220, { at, dur, type: "triangle", vol: vol * 0.7, glide: 880, attack: dur * 0.7 });
  }

  private thud(at: number, vol = 0.2) {
    this.tone(96, { at, dur: 0.24, type: "sine", vol, glide: 52, attack: 0.004 });
  }

  /** the one big "character" voice: a friendly lion-ish growl */
  roar(at = this.t0) {
    if (!this.guard()) return;
    const vol = 0.16;
    for (const [f, det] of [[104, 0], [131, 8], [78, -6]] as const) {
      this.tone(f, {
        at: at + 0.05,
        dur: 0.85,
        type: "sawtooth",
        vol: vol * 0.5,
        glide: f * 0.62,
        attack: 0.12,
        filter: 420,
        wet: 0.35,
        detune: det,
      });
    }
    this.noise({ at: at + 0.05, dur: 0.8, vol: vol * 0.4, f0: 300, f1: 160, q: 0.6, wet: 0.3 });
    this.noise({ at: at + 0.02, dur: 0.18, vol: vol * 0.5, f0: 220, f1: 900, q: 0.8 });
  }

  private guard(): boolean {
    return this.sfxOn && !!this.ctx;
  }

  /** brief music dip so a big cue always lands on top */
  private duck() {
    if (!this.ctx || !this.musicBus || !this.musicOn) return;
    const t = this.t0;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.07, t + 0.06);
    g.linearRampToValueAtTime(this.musicOn ? 0.2 : 0, t + 0.85);
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      if (this.ctx && this.musicBus && this.musicOn) {
        this.musicBus.gain.cancelScheduledValues(this.t0);
        this.musicBus.gain.setValueAtTime(0.2, this.t0);
      }
    }, 1000);
  }

  /* ── SFX library ────────────────────────────────────────────── */

  tap() {
    if (!this.guard()) return;
    this.pluck(660, this.t0, 0.1);
  }

  hover() {
    if (!this.guard()) return;
    this.tone(1180, { dur: 0.045, type: "sine", vol: 0.035 });
  }

  click() {
    if (!this.guard()) return;
    this.marimba(NOTE(3, 523.25), this.t0, 0.14);
    this.noise({ dur: 0.03, vol: 0.025, f0: 3600, type: "highpass" });
  }

  pop() {
    if (!this.guard()) return;
    this.tone(340, { dur: 0.1, type: "sine", vol: 0.16, glide: 720 });
    this.noise({ at: this.t0, dur: 0.05, vol: 0.05, f0: 1600, q: 1.4 });
  }

  scoreTick() {
    if (!this.guard()) return;
    this.tone(920 + Math.random() * 60, { dur: 0.04, type: "triangle", vol: 0.05 });
  }

  /** THE iconic cue — marimba major arp + air. Overheard-safe. */
  correct() {
    if (!this.guard()) return;
    const t = this.t0;
    [0, 4, 7].forEach((s, i) => this.marimba(NOTE(s, 523.25), t + i * 0.07, 0.17, i === 0 ? -0.2 : i === 2 ? 0.2 : 0));
    this.noise({ at: t, dur: 0.09, vol: 0.02, f0: 5600, type: "highpass", wet: 0.3 });
  }

  /** Wrong: a soft horn fall — "hmm", never "NO!" */
  wrong() {
    if (!this.guard()) return;
    const t = this.t0;
    this.horn(NOTE(0, 233.08), t, 0.17, 0.07);
    this.horn(NOTE(-3, 233.08), t + 0.13, 0.26, 0.07);
  }

  /**
   * Combo escalation family — ONE motif (major-third leap), FOUR levels,
   * root climbing a semitone per streak step (Duolingo principle, §8.3).
   */
  combo(n: number) {
    if (!this.guard()) return;
    const t = this.t0;
    const step = Math.min(n, 12);
    const root = NOTE(step, 523.25);
    this.pluck(root, t, 0.11, -0.25);
    this.pluck(root * 1.26, t + 0.06, 0.14, 0.1);
    if (n >= 5) this.marimba(root * 1.5, t + 0.12, 0.12, 0.3);
    if (n >= 7) {
      this.chime(root * 2, t + 0.17, 0.08, 0.4);
      this.noise({ at: t, dur: 0.22, vol: 0.025, f0: 6400, type: "highpass", wet: 0.4 });
    }
    if (n >= 10) {
      [root * 2, root * 2.52, root * 3].forEach((f, i) =>
        this.pluck(f, t + 0.24 + i * 0.055, 0.09, i === 1 ? 0 : -0.3)
      );
      this.snare(t + 0.24, 0.1);
    }
  }

  heartLost() {
    if (!this.guard()) return;
    const t = this.t0;
    this.tone(NOTE(3, 392), { at: t, dur: 0.18, type: "sine", vol: 0.1 });
    this.tone(NOTE(0, 392), { at: t + 0.14, dur: 0.3, type: "sine", vol: 0.1 });
    this.thud(t + 0.16, 0.12);
  }

  /** danger heartbeat — used under the last seconds of the clock */
  pulse() {
    if (!this.guard()) return;
    const t = this.t0;
    this.kick(t, 0.22);
    this.kick(t + 0.22, 0.15);
  }

  tick(low = false) {
    if (!this.guard()) return;
    this.tone(low ? 880 : 1320, { dur: 0.035, type: "square", vol: 0.04 });
  }

  pad(i: number) {
    if (!this.guard()) return;
    const f = [261.63, 329.63, 392.0, 523.25][((i % 4) + 4) % 4];
    this.marimba(f, this.t0, 0.2, i < 2 ? -0.3 : 0.3);
  }

  whoosh() {
    if (!this.guard()) return;
    this.noise({ dur: 0.42, vol: 0.13, f0: 320, f1: 2600, q: 2, wet: 0.25 });
  }

  star(i: number) {
    if (!this.guard()) return;
    const f = [1046.5, 1318.5, 1568.0][Math.min(i, 2)];
    this.chime(f, this.t0, 0.14);
    this.noise({ at: this.t0 + 0.02, dur: 0.3, vol: 0.02, f0: 7000, type: "highpass", wet: 0.5 });
  }

  /** the results parade */
  fanfare() {
    if (!this.guard()) return;
    const t = this.t0;
    this.duck();
    const seq: [number, number][] = [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36]];
    seq.forEach(([s, at], i) => {
      this.tone(NOTE(s, 523.25), { at: t + at, dur: 0.26, type: "triangle", vol: 0.15, wet: 0.3 });
      this.tone(NOTE(s - 12, 523.25), { at: t + at, dur: 0.26, type: "sine", vol: 0.09 });
      if (i === seq.length - 1) {
        this.marimba(NOTE(s, 523.25), t + at + 0.16, 0.14);
        this.marimba(NOTE(s + 4, 523.25), t + at + 0.26, 0.12);
      }
    });
    this.snare(t + 0.36, 0.12);
    this.noise({ at: t + 0.36, dur: 0.55, vol: 0.045, f0: 5200, type: "highpass", wet: 0.5 });
  }

  /** gentle sympathy, not a buzzer */
  sadTrombone() {
    if (!this.guard()) return;
    const t = this.t0;
    [0, -2, -5].forEach((s, i) => this.horn(NOTE(s, 311.13), t + i * 0.24, 0.34, 0.06));
  }

  flame() {
    if (!this.guard()) return;
    this.noise({ dur: 0.5, vol: 0.07, f0: 900, f1: 3200, q: 0.8, wet: 0.2 });
    this.marimba(NOTE(5, 523.25), this.t0 + 0.1, 0.13);
    this.marimba(NOTE(12, 523.25), this.t0 + 0.2, 0.11);
  }

  /** LEO RUSH ignition */
  rushGo() {
    if (!this.guard()) return;
    const t = this.t0;
    this.duck();
    this.riser(t, 0.75, 0.11);
    this.kick(t + 0.72, 0.32);
    this.snare(t + 0.72, 0.16);
    [0, 7, 12].forEach((s, i) => this.marimba(NOTE(s, 523.25), t + 0.74 + i * 0.05, 0.14));
  }

  chestOpen() {
    if (!this.guard()) return;
    const t = this.t0;
    this.tone(120, { at: t, dur: 0.4, type: "square", vol: 0.05, glide: 190, filter: 500 });
    this.thud(t + 0.32, 0.2);
    [0, 4, 7, 12].forEach((s, i) => this.chime(NOTE(s, 659.26), t + 0.4 + i * 0.09, 0.1));
  }

  questDone() {
    if (!this.guard()) return;
    const t = this.t0;
    this.marimba(NOTE(4, 523.25), t, 0.13);
    this.marimba(NOTE(9, 523.25), t + 0.1, 0.13);
    this.chime(NOTE(16, 523.25), t + 0.2, 0.09);
  }

  /** quest chest claimed */
  questClaim() {
    if (!this.guard()) return;
    const t = this.t0;
    this.noise({ at: t, dur: 0.3, vol: 0.05, f0: 500, f1: 2400, q: 1.4, wet: 0.3 });
    [0, 4, 7, 12].forEach((s, i) => this.marimba(NOTE(s, 587.33), t + 0.1 + i * 0.08, 0.12));
  }

  achievement() {
    if (!this.guard()) return;
    const t = this.t0;
    this.chime(NOTE(7, 659.26), t, 0.12);
    this.chime(NOTE(12, 659.26), t + 0.16, 0.13);
    this.noise({ at: t + 0.16, dur: 0.4, vol: 0.018, f0: 7500, type: "highpass", wet: 0.5 });
  }

  /** PLAYER LEVEL UP — the biggest cue in the game */
  levelUp() {
    if (!this.guard()) return;
    const t = this.t0;
    this.duck();
    this.riser(t, 0.6, 0.12);
    [0, 4, 7, 12, 16].forEach((s, i) => {
      this.marimba(NOTE(s, 523.25), t + 0.6 + i * 0.07, 0.16);
      this.tone(NOTE(s - 12, 523.25), { at: t + 0.6 + i * 0.07, dur: 0.3, type: "sine", vol: 0.08 });
    });
    this.kick(t + 0.6, 0.3);
    this.snare(t + 0.95, 0.14);
    this.hat(t + 1.0, true, 0.05);
  }

  leagueUp() {
    if (!this.guard()) return;
    const t = this.t0;
    this.duck();
    this.fanfare();
    [0, 4, 9, 16].forEach((s, i) => this.chime(NOTE(s, 784), t + 0.5 + i * 0.1, 0.09));
  }

  welcomeBack() {
    if (!this.guard()) return;
    const t = this.t0;
    [0, 4, 7].forEach((s, i) => this.pluck(NOTE(s, 392), t + i * 0.06, 0.1));
    [5, 9, 12].forEach((s, i) => this.pluck(NOTE(s, 392), t + 0.34 + i * 0.06, 0.1));
  }

  goalDone() {
    if (!this.guard()) return;
    const t = this.t0;
    [0, 4, 7, 12].forEach((s, i) => this.chime(NOTE(s, 659.26), t + i * 0.07, 0.1));
    this.noise({ at: t, dur: 0.5, vol: 0.02, f0: 6800, type: "highpass", wet: 0.5 });
  }

  lockClick() {
    if (!this.guard()) return;
    this.tone(220, { dur: 0.06, type: "square", vol: 0.06, filter: 700 });
    this.noise({ dur: 0.04, vol: 0.04, f0: 900, q: 2 });
  }

  /* ── Music: 3 moods, lookahead-scheduled ────────────────────── */

  /**
   * "Candy Waltz" — C · G · Am · F. The same progression everywhere;
   * moods change tempo, density and drums, so the score feels alive
   * without ever fighting the SFX.
   */
  startMusic(mode: "home" | "play" | "rush") {
    this.unlock();
    if (!this.ctx || !this.musicBus) return;
    if (this.musicMode === mode && this.musicTimer !== null) return;
    this.stopMusic();
    this.musicMode = mode;
    this.musicBus.gain.setValueAtTime(this.musicOn ? (mode === "rush" ? 0.24 : mode === "play" ? 0.2 : 0.17) : 0, this.t0);
    this.nextBarAt = this.t0 + 0.1;
    this.barIndex = 0;

    const CHORDS = [
      { root: 130.81, tones: [261.63, 329.63, 392.0, 523.25] }, // C
      { root: 98.0, tones: [246.94, 293.66, 392.0, 493.88] },   // G
      { root: 110.0, tones: [220.0, 261.63, 329.63, 440.0] },   // Am
      { root: 87.31, tones: [261.63, 349.23, 523.25, 659.26] }, // F
    ];
    const PENTA = [0, 2, 4, 7, 9, 12, 14];
    const barLen = mode === "rush" ? 1.45 : mode === "play" ? 1.9 : 2.4;

    const scheduleBar = () => {
      if (!this.ctx || this.musicMode === null) return;
      while (this.nextBarAt < this.t0 + 0.6) {
        const bar = this.barIndex % 4;
        const { root, tones } = CHORDS[bar];
        const t = this.nextBarAt;
        const bus = this.musicBus;

        // pad — the warm floor
        tones.forEach((f, i) =>
          this.tone(f, {
            at: t,
            dur: barLen * 0.94,
            type: i === 0 ? "sine" : "triangle",
            vol: i === 0 ? 0.34 : 0.15,
            attack: 0.35,
            bus,
          })
        );

        // bass pulse
        const beats = mode === "rush" ? 4 : 2;
        for (let b = 0; b < beats; b++) {
          this.tone(root, {
            at: t + b * (barLen / beats),
            dur: barLen / beats * 0.55,
            type: "sine",
            vol: 0.22,
            attack: 0.012,
            bus,
          });
        }

        // arpeggio sparkle (picks its own path each bar)
        const arpSteps = mode === "home" ? 2 : 4;
        for (let s = 0; s < arpSteps; s++) {
          if (Math.random() < (mode === "home" ? 0.5 : 0.8)) {
            const f = NOTE(PENTA[Math.floor(Math.random() * PENTA.length)], 523.25);
            this.pluck(f, t + s * (barLen / arpSteps), 0.07, s % 2 ? 0.3 : -0.3);
          }
        }

        // drums — none at home, hats in play, backbeat in rush
        if (mode === "play") {
          for (let s = 0; s < 8; s++) this.hat(t + s * (barLen / 8), false, s % 2 ? 0.02 : 0.035);
        } else if (mode === "rush") {
          for (let s = 0; s < 8; s++) this.hat(t + s * (barLen / 8), s === 7, s % 2 ? 0.03 : 0.05);
          this.snare(t + barLen / 4, 0.05);
          this.snare(t + barLen * 0.75, 0.05);
        }

        this.nextBarAt += barLen;
        this.barIndex += 1;
      }
    };
    scheduleBar();
    this.musicTimer = window.setInterval(scheduleBar, 300);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicMode = null;
  }

  setSfx(on: boolean) {
    this.sfxOn = on;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(on && this.musicMode ? 0.2 : 0, this.t0, 0.2);
    }
    if (!on) this.stopMusic();
  }
}

export const sfx = new LeoSound();
