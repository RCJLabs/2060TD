/**
 * Synthesized SFX (M6): no audio assets, just a small WebAudio kit — clicks,
 * gunfire ticks, explosions, breaches, radio blips, and end-of-battle
 * stingers, all built from oscillators and filtered noise in the gritty
 * register. Master volume stays low; battle sounds are texture, not a show.
 *
 * Headless-safe: everything no-ops when AudioContext is unavailable, and the
 * context resumes on the first user gesture (browser autoplay rules).
 */

type SfxName =
  | 'click'
  | 'place'
  | 'erase'
  | 'shot'
  | 'shotHeavy'
  | 'explosion'
  | 'wallBreak'
  | 'structureDown'
  | 'power'
  | 'trigger'
  | 'radio'
  | 'research'
  | 'victory'
  | 'defeat';

/**
 * Headroom: what "100%" actually means on each bus. Battle sound is texture,
 * not a show, and a bed that competes with the gunfire is not a bed.
 */
const SFX_HEADROOM = 0.22;
const MUSIC_HEADROOM = 0.1;

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Per-sound minimum interval (ms) — battle ticks would stack into noise. */
const THROTTLE_MS: Partial<Record<SfxName, number>> = {
  shot: 75,
  shotHeavy: 110,
  explosion: 120,
  wallBreak: 100,
  structureDown: 150,
};

class AudioKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** 0..1, from the device mixer. SFX and music ride separate buses. */
  private sfxLevel = 1;
  private musicLevel = 0.5;
  private readonly lastAt = new Map<SfxName, number>();

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? null;
    if (!Ctor) return null;
    if (!this.ctx) {
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.sfxLevel * SFX_HEADROOM;
        this.master.connect(this.ctx.destination);
        // A second bus, so the mixer can hold the score down under gunfire
        // without also turning the gunfire down.
        this.music = this.ctx.createGain();
        this.music.gain.value = this.musicLevel * MUSIC_HEADROOM;
        this.music.connect(this.ctx.destination);
        const seconds = 1;
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  /** Call from a pointer handler once — creates/resumes the context. */
  unlock(): void {
    this.ensure();
  }

  /** The shared context, created on demand. Null when audio is unavailable. */
  context(): AudioContext | null {
    return this.ensure();
  }

  /** The music bus. The score connects here, never to the destination. */
  musicBus(): GainNode | null {
    this.ensure();
    return this.music;
  }

  setSfxVolume(level: number): void {
    this.sfxLevel = clamp01(level);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.sfxLevel * SFX_HEADROOM, this.ctx.currentTime, 0.02);
    }
  }

  setMusicVolume(level: number): void {
    this.musicLevel = clamp01(level);
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(this.musicLevel * MUSIC_HEADROOM, this.ctx.currentTime, 0.05);
    }
  }

  sfxVolume(): number {
    return this.sfxLevel;
  }

  musicVolume(): number {
    return this.musicLevel;
  }

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    fromHz: number,
    toHz: number,
    seconds: number,
    gain: number,
    delay = 0,
  ): void {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, t0);
    if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), t0 + seconds);
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(env).connect(this.master!);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  private noise(
    ctx: AudioContext,
    seconds: number,
    gain: number,
    filterHz: number,
    filterType: BiquadFilterType = 'lowpass',
    sweepToHz?: number,
    delay = 0,
  ): void {
    if (!this.noiseBuffer) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterHz, t0);
    if (sweepToHz !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(1, sweepToHz), t0 + seconds);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter).connect(env).connect(this.master!);
    src.start(t0);
    src.stop(t0 + seconds + 0.02);
  }

  sfx(name: SfxName): void {
    if (this.sfxLevel <= 0) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const now = performance.now();
    const gap = THROTTLE_MS[name] ?? 30;
    const last = this.lastAt.get(name) ?? -Infinity;
    if (now - last < gap) return;
    this.lastAt.set(name, now);

    switch (name) {
      case 'click':
        this.tone(ctx, 'square', 820, 820, 0.03, 0.12);
        break;
      case 'place':
        this.tone(ctx, 'triangle', 190, 120, 0.09, 0.3);
        this.noise(ctx, 0.05, 0.12, 900);
        break;
      case 'erase':
        this.tone(ctx, 'triangle', 140, 220, 0.07, 0.18);
        break;
      case 'shot':
        this.noise(ctx, 0.045, 0.16, 2600, 'highpass');
        break;
      case 'shotHeavy':
        this.noise(ctx, 0.09, 0.24, 700, 'lowpass');
        this.tone(ctx, 'sine', 140, 70, 0.09, 0.2);
        break;
      case 'explosion':
        this.noise(ctx, 0.42, 0.4, 2200, 'lowpass', 90);
        this.tone(ctx, 'sine', 150, 38, 0.35, 0.35);
        break;
      case 'wallBreak':
        this.noise(ctx, 0.16, 0.28, 640, 'lowpass', 160);
        break;
      case 'structureDown':
        this.noise(ctx, 0.3, 0.32, 1400, 'lowpass', 110);
        this.tone(ctx, 'sine', 110, 45, 0.28, 0.24);
        break;
      case 'power':
        this.tone(ctx, 'square', 620, 620, 0.06, 0.14);
        this.tone(ctx, 'square', 620, 620, 0.06, 0.14, 0.11);
        this.noise(ctx, 0.25, 0.08, 1200, 'bandpass');
        break;
      case 'trigger':
        this.noise(ctx, 0.2, 0.32, 1800, 'lowpass', 120);
        break;
      case 'radio':
        this.noise(ctx, 0.05, 0.1, 1800, 'bandpass');
        this.tone(ctx, 'sine', 1180, 1180, 0.04, 0.08, 0.02);
        break;
      case 'research':
        this.tone(ctx, 'triangle', 660, 660, 0.08, 0.16);
        this.tone(ctx, 'triangle', 880, 880, 0.12, 0.16, 0.1);
        break;
      case 'victory':
        this.tone(ctx, 'triangle', 392, 392, 0.16, 0.2);
        this.tone(ctx, 'triangle', 523, 523, 0.3, 0.2, 0.18);
        break;
      case 'defeat':
        this.tone(ctx, 'sawtooth', 130, 52, 0.9, 0.22);
        this.noise(ctx, 0.7, 0.12, 500, 'lowpass', 80);
        break;
    }
  }
}

export const audio = new AudioKit();
