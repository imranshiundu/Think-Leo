/**
 * Think Leo — Sound Engine (Web Audio, zero audio files)
 * ──────────────────────────────────────────────────────
 * Everything is synthesized at runtime: tiny bundle, offline-safe, and we
 * can follow Duolingo's "one sonic idea, many levels of reward" principle
 * (see docs/ALGORITHM.md §8) by transposing one core motif per combo tier.
 *
 * Autoplay policy: browsers only allow audio after a user gesture, so
 * `unlock()` is wired to the first pointerdown.
 */

type Osc = OscillatorType;

const NOTE = (semi: number, base = 440) => base * Math.pow(2, semi / 12);

class LeoSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextBarAt = 0;
  private barIndex = 0;
  private musicMode: "home" | "play" | null = null;

  sfxOn = true;
  musicOn = true;

  /** Call on first user gesture. Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? 0.055 : 0;
        this.musicBus.connect(this.master);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* audio is a bonus, never a blocker */
    }
  }

  private get t0(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private tone(
    freq: number,
    opts: {
      at?: number;
      dur?: number;
      type?: Osc;
      vol?: number;
      glide?: number;
      attack?: number;
      bus?: GainNode | null;
    } = {}
  ) {
    if (!this.ctx || !this.master) return;
    const {
      at = this.t0,
      dur = 0.15,
      type = "sine",
      vol = 0.2,
      glide,
      attack = 0.006,
      bus,
    } = opts;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, glide), at + dur);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(bus ?? this.master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  private noise(
    opts: {
      at?: number;
      dur?: number;
      vol?: number;
      f0?: number;
      f1?: number;
      q?: number;
      type?: BiquadFilterType;
    } = {}
  ) {
    if (!this.ctx || !this.master) return;
    const { at = this.t0, dur = 0.25, vol = 0.12, f0 = 800, f1, q = 1, type = "bandpass" } = opts;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f0, at);
    if (f1) filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
    filt.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(filt).connect(gain).connect(this.master);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  private guard(): boolean {
    return this.sfxOn && !!this.ctx;
  }

  /* ── SFX library ─────────────────────────────────────────────── */

  tap() {
    if (!this.guard()) return;
    this.tone(620, { dur: 0.07, type: "sine", vol: 0.12, glide: 940 });
  }

  click() {
    if (!this.guard()) return;
    this.tone(880, { dur: 0.05, type: "triangle", vol: 0.1 });
    this.noise({ dur: 0.04, vol: 0.03, f0: 3200 });
  }

  pop() {
    if (!this.guard()) return;
    this.tone(340, { dur: 0.09, type: "sine", vol: 0.16, glide: 680 });
  }

  /** The iconic "correct" arp — C6 E6 G6 family, built to be overheard-safe. */
  correct() {
    if (!this.guard()) return;
    const t = this.t0;
    [0, 4, 7].forEach((s, i) =>
      this.tone(NOTE(s, 523.25), {
        at: t + i * 0.07,
        dur: 0.16,
        type: "triangle",
        vol: 0.16,
      })
    );
    this.noise({ at: t, dur: 0.08, vol: 0.02, f0: 5200, type: "highpass" });
  }

  /** Wrong: soft minor fall, never scary. */
  wrong() {
    if (!this.guard()) return;
    const t = this.t0;
    this.tone(NOTE(0, 233.08), { at: t, dur: 0.16, type: "sawtooth", vol: 0.07 });
    this.tone(NOTE(-3, 233.08), { at: t + 0.12, dur: 0.22, type: "sawtooth", vol: 0.07 });
  }

  /**
   * Combo escalation family — ONE motif (major third leap), THREE+ levels:
   *   x3  → motif alone
   *   x5  → motif + fifth sparkle
   *   x7  → motif + octave + noise shimmer
   *   x10 → full fanfare (perfect-streak territory)
   */
  combo(n: number) {
    if (!this.guard()) return;
    const t = this.t0;
    const root = NOTE(Math.min(n, 12), 523.25);
    this.tone(root, { at: t, dur: 0.12, type: "square", vol: 0.08 });
    this.tone(root * 1.26, { at: t + 0.06, dur: 0.14, type: "triangle", vol: 0.12 });
    if (n >= 5) this.tone(root * 1.5, { at: t + 0.12, dur: 0.16, type: "triangle", vol: 0.1 });
    if (n >= 7) {
      this.tone(root * 2, { at: t + 0.18, dur: 0.18, type: "triangle", vol: 0.09 });
      this.noise({ at: t, dur: 0.2, vol: 0.03, f0: 6000, type: "highpass" });
    }
    if (n >= 10) {
      [root * 2, root * 2.52, root * 3].forEach((f, i) =>
        this.tone(f, { at: t + 0.24 + i * 0.06, dur: 0.2, type: "triangle", vol: 0.08 })
      );
    }
  }

  heartLost() {
    if (!this.guard()) return;
    const t = this.t0;
    this.tone(NOTE(3, 392), { at: t, dur: 0.18, type: "sine", vol: 0.1 });
    this.tone(NOTE(0, 392), { at: t + 0.14, dur: 0.28, type: "sine", vol: 0.1 });
  }

  tick() {
    if (!this.guard()) return;
    this.tone(1320, { dur: 0.035, type: "square", vol: 0.045 });
  }

  pad(i: number) {
    if (!this.guard()) return;
    const f = [261.63, 329.63, 392.0, 523.25][i % 4];
    this.tone(f, { dur: 0.3, type: "triangle", vol: 0.16 });
  }

  whoosh() {
    if (!this.guard()) return;
    this.noise({ dur: 0.4, vol: 0.14, f0: 300, f1: 2400, q: 2 });
  }

  star(i: number) {
    if (!this.guard()) return;
    const f = [1046.5, 1318.5, 1568.0][Math.min(i, 2)];
    this.tone(f, { dur: 0.35, type: "triangle", vol: 0.14 });
    this.tone(f * 2, { at: this.t0 + 0.04, dur: 0.3, type: "sine", vol: 0.06 });
  }

  fanfare() {
    if (!this.guard()) return;
    const t = this.t0;
    const seq: [number, number][] = [
      [0, 0], [4, 0.12], [7, 0.24], [12, 0.36],
    ];
    seq.forEach(([s, at]) => {
      this.tone(NOTE(s, 523.25), { at: t + at, dur: 0.22, type: "triangle", vol: 0.15 });
      this.tone(NOTE(s - 12, 523.25), { at: t + at, dur: 0.22, type: "sine", vol: 0.09 });
    });
    this.noise({ at: t + 0.36, dur: 0.5, vol: 0.05, f0: 5000, type: "highpass" });
  }

  sadTrombone() {
    if (!this.guard()) return;
    const t = this.t0;
    [0, -2, -5].forEach((s, i) =>
      this.tone(NOTE(s, 311.13), { at: t + i * 0.22, dur: 0.3, type: "sawtooth", vol: 0.05 })
    );
  }

  flame() {
    if (!this.guard()) return;
    this.noise({ dur: 0.5, vol: 0.08, f0: 900, f1: 3000, q: 0.8 });
    this.tone(NOTE(5, 523.25), { at: this.t0 + 0.1, dur: 0.3, type: "triangle", vol: 0.1 });
  }

  /* ── Music: soft 4-chord loop, lookahead-scheduled ──────────── */

  startMusic(mode: "home" | "play") {
    this.unlock();
    if (!this.ctx || !this.musicBus) return;
    if (this.musicMode === mode && this.musicTimer !== null) return;
    this.stopMusic();
    this.musicMode = mode;
    this.musicBus.gain.value = this.musicOn ? (mode === "play" ? 0.05 : 0.042) : 0;
    this.nextBarAt = this.t0 + 0.1;
    this.barIndex = 0;
    // Tune "Candy Waltz": C — G — Am — F  (pentatonic sparkles on top)
    const CHORDS = [
      [130.81, 196.0, 261.63, 329.63],
      [98.0, 146.83, 196.0, 293.66],
      [110.0, 164.81, 220.0, 261.63],
      [87.31, 130.81, 174.61, 261.63],
    ];
    const barLen = mode === "play" ? 1.9 : 2.4;
    const scheduleBar = () => {
      if (!this.ctx || this.musicMode === null) return;
      while (this.nextBarAt < this.t0 + 0.6) {
        const chord = CHORDS[this.barIndex % 4];
        const t = this.nextBarAt;
        chord.forEach((f, i) =>
          this.tone(f, {
            at: t,
            dur: barLen * 0.92,
            type: i === 0 ? "sine" : "triangle",
            vol: i === 0 ? 0.5 : 0.22,
            attack: 0.4,
            bus: this.musicBus,
          })
        );
        // gentle plucked sparkle melody
        const penta = [0, 2, 4, 7, 9, 12, 14];
        for (let s = 0; s < 4; s++) {
          if (Math.random() < 0.55) {
            const f = NOTE(oneOfPenta(penta), 523.25);
            this.tone(f, {
              at: t + s * (barLen / 4),
              dur: 0.22,
              type: "triangle",
              vol: 0.1,
              bus: this.musicBus,
            });
          }
        }
        if (mode === "play") {
          for (let s = 0; s < 8; s++) {
            this.noise({
              at: t + s * (barLen / 8),
              dur: 0.03,
              vol: s % 2 === 0 ? 0.05 : 0.02,
              f0: 8000,
              type: "highpass",
            });
          }
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
      this.musicBus.gain.setTargetAtTime(
        on && this.musicMode ? 0.05 : 0,
        this.t0,
        0.2
      );
    }
    if (!on) this.stopMusic();
  }
}

function oneOfPenta(arr: number[]): number {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const sfx = new LeoSound();
