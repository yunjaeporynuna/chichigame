/**
 * Procedural audio. Everything is synthesised with the Web Audio API so the
 * game ships with zero audio files: a soft generative pad for BGM plus short
 * one-shot effects. Swap in real files later by replacing `play()` cases.
 */

type SfxName =
  | 'glass'
  | 'squeak'
  | 'cloth'
  | 'paper'
  | 'metal'
  | 'hiss'
  | 'beep'
  | 'chime'
  | 'back'
  | 'meow'
  | 'purr'
  | 'step'
  | 'sticker'
  | 'badge'
  | 'golden'
  | 'whoosh';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pentatonic-ish cosy chord set (Hz), one chord per bar. */
const CHORDS: number[][] = [
  [174.61, 261.63, 349.23], // F3 C4 F4
  [196.0, 293.66, 392.0], // G3 D4 G4
  [220.0, 329.63, 440.0], // A3 E4 A4
  [164.81, 246.94, 329.63], // E3 B3 E4
];

const MELODY = [523.25, 587.33, 659.25, 783.99, 880.0];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private bgmOn = true;
  private sfxOn = true;
  private running = false;
  private schedulerId: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private mood: 'menu' | 'game' = 'menu';
  private duckTarget = 1;
  private stepCooldown = 0;

  init(): void {
    if (this.ctx) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const bgmBus = ctx.createGain();
    bgmBus.gain.value = this.bgmOn ? 0.28 : 0;
    bgmBus.connect(master);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = this.sfxOn ? 0.6 : 0;
    sfxBus.connect(master);

    // Shared noise buffer for percussive / airy effects.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.bgmBus = bgmBus;
    this.sfxBus = sfxBus;
    this.noise = buffer;
  }

  /** Browsers block audio until a gesture; call this from any input handler. */
  resume(): void {
    this.init();
    void this.ctx?.resume();
  }

  setBgmEnabled(on: boolean): void {
    this.bgmOn = on;
    if (this.bgmBus && this.ctx) {
      this.bgmBus.gain.setTargetAtTime(
        on ? 0.28 * this.duckTarget : 0,
        this.ctx.currentTime,
        0.2,
      );
    }
  }

  setSfxEnabled(on: boolean): void {
    this.sfxOn = on;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 0.6 : 0, this.ctx.currentTime, 0.1);
    }
  }

  /** Fade the music down (cutscenes) and back up (gameplay). */
  duck(amount: number, seconds: number): void {
    this.duckTarget = clamp01(amount);
    if (!this.bgmBus || !this.ctx) return;
    const target = this.bgmOn ? 0.28 * this.duckTarget : 0;
    this.bgmBus.gain.setTargetAtTime(
      target,
      this.ctx.currentTime,
      Math.max(0.05, seconds / 3),
    );
  }

  setMood(mood: 'menu' | 'game'): void {
    this.mood = mood;
  }

  startMusic(): void {
    this.init();
    if (!this.ctx || this.running) return;
    this.running = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      this.schedule();
      this.schedulerId = window.setTimeout(tick, 60);
    };
    tick();
  }

  stopMusic(): void {
    this.running = false;
    if (this.schedulerId !== null) window.clearTimeout(this.schedulerId);
    this.schedulerId = null;
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.bgmBus) return;
    const beat = this.mood === 'game' ? 0.46 : 0.62;
    while (this.nextNoteTime < ctx.currentTime + 0.4) {
      this.playPadStep(this.nextNoteTime, beat);
      this.nextNoteTime += beat;
      this.step += 1;
    }
  }

  private playPadStep(time: number, beat: number): void {
    const ctx = this.ctx;
    const bus = this.bgmBus;
    if (!ctx || !bus) return;

    const chord = CHORDS[Math.floor(this.step / 4) % CHORDS.length];
    const isBarStart = this.step % 4 === 0;

    if (isBarStart) {
      chord.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1400;
        osc.type = index === 0 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.detune.value = (index - 1) * 4;
        const peak = index === 0 ? 0.22 : 0.13;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(peak, time + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + beat * 4.4);
        osc.connect(filter).connect(gain).connect(bus);
        osc.start(time);
        osc.stop(time + beat * 4.6);
      });
    }

    // Sparse music-box melody, denser during gameplay.
    const density = this.mood === 'game' ? 0.55 : 0.32;
    if (Math.random() < density) {
      const note = MELODY[Math.floor(Math.random() * MELODY.length)];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.16, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.9);
      osc.connect(gain).connect(bus);
      osc.start(time);
      osc.stop(time + 1);
    }

    if (this.mood === 'game' && this.step % 4 === 2) {
      this.blip(time, 220, 0.06, 0.05, 'triangle', bus);
    }
  }

  private blip(
    time: number,
    freq: number,
    dur: number,
    peak: number,
    type: OscillatorType,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(gain).connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private noiseBurst(
    time: number,
    dur: number,
    peak: number,
    filterType: BiquadFilterType,
    freq: number,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter).connect(gain).connect(dest);
    src.start(time);
    src.stop(time + dur + 0.05);
  }

  play(name: SfxName, volume = 1): void {
    this.init();
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || !this.sfxOn) return;

    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(bus);
    const t = ctx.currentTime;

    switch (name) {
      case 'glass':
        [1180, 1670, 2350].forEach((f, i) =>
          this.blip(t + i * 0.015, f, 0.35, 0.2, 'sine', gain),
        );
        this.noiseBurst(t, 0.12, 0.12, 'highpass', 3200, gain);
        break;
      case 'squeak': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(680, t);
        osc.frequency.exponentialRampToValueAtTime(1500, t + 0.09);
        osc.frequency.exponentialRampToValueAtTime(520, t + 0.2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(g).connect(gain);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      }
      case 'cloth':
        this.noiseBurst(t, 0.3, 0.16, 'bandpass', 900, gain);
        break;
      case 'paper':
        this.noiseBurst(t, 0.16, 0.14, 'highpass', 2200, gain);
        this.noiseBurst(t + 0.1, 0.14, 0.1, 'highpass', 2600, gain);
        break;
      case 'metal':
        [520, 780, 1240].forEach((f, i) =>
          this.blip(t + i * 0.02, f, 0.25, 0.13, 'square', gain),
        );
        break;
      case 'hiss':
        this.noiseBurst(t, 0.7, 0.1, 'highpass', 4200, gain);
        break;
      case 'beep':
        this.blip(t, 1320, 0.1, 0.16, 'square', gain);
        this.blip(t + 0.14, 1760, 0.12, 0.16, 'square', gain);
        break;
      case 'chime':
        this.blip(t, 880, 0.25, 0.14, 'sine', gain);
        this.blip(t + 0.06, 1320, 0.3, 0.1, 'sine', gain);
        break;
      case 'back':
        this.blip(t, 660, 0.22, 0.13, 'sine', gain);
        this.blip(t + 0.06, 440, 0.28, 0.1, 'sine', gain);
        break;
      case 'meow': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1100;
        filter.Q.value = 3;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.exponentialRampToValueAtTime(780, t + 0.12);
        osc.frequency.exponentialRampToValueAtTime(360, t + 0.42);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        osc.connect(filter).connect(g).connect(gain);
        osc.start(t);
        osc.stop(t + 0.55);
        break;
      }
      case 'purr': {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 62;
        lfo.frequency.value = 24;
        lfoGain.gain.value = 26;
        lfo.connect(lfoGain).connect(osc.frequency);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.14, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        osc.connect(g).connect(gain);
        lfo.start(t);
        osc.start(t);
        osc.stop(t + 1.2);
        lfo.stop(t + 1.2);
        break;
      }
      case 'step':
        this.noiseBurst(t, 0.06, 0.05, 'lowpass', 700, gain);
        break;
      case 'sticker':
        this.blip(t, 1046, 0.12, 0.12, 'sine', gain);
        this.blip(t + 0.07, 1568, 0.16, 0.1, 'sine', gain);
        break;
      case 'badge':
        [784, 988, 1319].forEach((f, i) =>
          this.blip(t + i * 0.07, f, 0.3, 0.13, 'triangle', gain),
        );
        break;
      case 'golden':
        [659, 880, 1109, 1319, 1760].forEach((f, i) =>
          this.blip(t + i * 0.06, f, 0.45, 0.14, 'sine', gain),
        );
        break;
      case 'whoosh':
        this.noiseBurst(t, 0.4, 0.09, 'bandpass', 600, gain);
        break;
    }
  }

  /** Footstep loop driven by the game loop; call every frame while moving. */
  footstep(dt: number, moving: boolean): void {
    if (!moving) {
      this.stepCooldown = 0;
      return;
    }
    this.stepCooldown -= dt;
    if (this.stepCooldown <= 0) {
      this.stepCooldown = 0.28;
      this.play('step', 0.5);
    }
  }
}

export const audio = new AudioEngine();
