import { bar, barSeconds, MOODS, type Mood, type Note } from '../content/score';
import { audio } from './audio';

/**
 * The synth (v1.8). content/score.ts decides what is played; this decides how
 * it sounds and keeps it in time.
 *
 * Scheduling is the standard WebAudio lookahead: a coarse timer wakes often
 * enough to book anything falling due in the next fraction of a second, and
 * every note is scheduled against ctx.currentTime rather than fired from the
 * timer. A setInterval that fired notes directly would audibly stagger the
 * moment the main thread got busy, which — during a siege — is always.
 *
 * Headless-safe: with no AudioContext every method is a no-op.
 */

/** How far ahead notes are booked, and how often we look. */
const LOOKAHEAD_SECONDS = 0.5;
const TICK_MS = 120;

class Music {
  private mood: Mood | null = null;
  private drone: { osc: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Context time the next bar starts at, and which bar it is. */
  private nextBarAt = 0;
  private barIndex = 0;
  /** What was asked for, even if there was no context to honour it yet. */
  private pending: Mood | null = null;

  /**
   * Switch mood, or start. Calling with the mood already playing does nothing,
   * so a scene may say what it wants on every create without restarting the
   * bed and putting a seam in the middle of the music.
   */
  play(mood: Mood): void {
    // Remembered before the context check: browsers refuse to start audio
    // before a gesture, so the first scene to ask usually cannot be served.
    this.pending = mood;
    const ctx = audio.context();
    const bus = audio.musicBus();
    if (!ctx || !bus) return;
    if (this.mood === mood && this.timer !== null) return;

    this.mood = mood;
    this.retuneDrone(ctx, bus, mood);
    if (this.timer === null) {
      this.nextBarAt = ctx.currentTime + 0.1;
      this.barIndex = 0;
      this.timer = setInterval(() => this.pump(), TICK_MS);
    }
  }

  /** Silence and tear down. Nothing calls this yet; scenes only switch mood. */
  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.mood = null;
    this.pending = null;
    const ctx = audio.context();
    if (this.drone && ctx) {
      this.drone.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      const dying = this.drone;
      setTimeout(() => {
        for (const osc of dying.osc) {
          try {
            osc.stop();
          } catch {
            /* already stopped */
          }
        }
      }, 1500);
    }
    this.drone = null;
  }

  playing(): Mood | null {
    return this.mood;
  }

  /** The first gesture wakes the context; whatever was asked for starts then. */
  resume(): void {
    if (this.pending) this.play(this.pending);
  }

  /**
   * The drone is one continuous pair of oscillators for the whole session: a
   * mood change slides its pitch and colour instead of stopping and starting,
   * which is what keeps a scene transition from clicking.
   */
  private retuneDrone(ctx: AudioContext, bus: GainNode, mood: Mood): void {
    const score = MOODS[mood];
    const t = ctx.currentTime;
    if (!this.drone) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = score.cutoffHz;
      filter.Q.value = 0.7;
      const osc: OscillatorNode[] = [];
      // Detuned by a few cents: one oscillator is a tone, two is a room.
      for (const cents of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = score.rootHz;
        o.detune.value = cents;
        o.connect(filter);
        o.start(t);
        osc.push(o);
      }
      filter.connect(gain).connect(bus);
      this.drone = { osc, gain, filter };
    }
    const { osc, gain, filter } = this.drone;
    for (const o of osc) o.frequency.setTargetAtTime(score.rootHz, t, 1.2);
    filter.frequency.setTargetAtTime(score.cutoffHz, t, 1.2);
    gain.gain.setTargetAtTime(score.droneGain, t, 1.5);
  }

  /** Book every bar that starts inside the lookahead window. */
  private pump(): void {
    const ctx = audio.context();
    const bus = audio.musicBus();
    const mood = this.mood;
    if (!ctx || !bus || !mood) return;
    const horizon = ctx.currentTime + LOOKAHEAD_SECONDS;
    // A tab left in the background can leave the clock a long way ahead; catch
    // up by skipping rather than by booking a hundred bars at once.
    if (this.nextBarAt < ctx.currentTime - 2) this.nextBarAt = ctx.currentTime + 0.05;

    while (this.nextBarAt < horizon) {
      const start = this.nextBarAt;
      const beat = 60 / MOODS[mood].bpm;
      for (const note of bar(mood, this.barIndex)) {
        this.sound(ctx, bus, note, start + note.beat * beat);
      }
      this.barIndex++;
      this.nextBarAt = start + barSeconds(mood);
    }
  }

  private sound(ctx: AudioContext, bus: GainNode, note: Note, at: number): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    if (note.kind === 'pulse') {
      // A soft thump: a sine dropping an octave, no attack to speak of.
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.hz * 2, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, note.hz), at + note.seconds * 0.6);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.hz, at);
    }
    // Slow attack on voices so nothing in the bed ever sounds like a cue.
    const attack = note.kind === 'pulse' ? 0.005 : 0.12;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(note.gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + note.seconds);
    osc.connect(env).connect(bus);
    osc.start(at);
    osc.stop(at + note.seconds + 0.05);
  }
}

export const music = new Music();
