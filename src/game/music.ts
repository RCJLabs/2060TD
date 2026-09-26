import { beatNotes, DEFAULT_STEP, MOODS, scoreAt, type Mood, type Note, type Step } from '../content/score';
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
 * The battle mood follows the battle (M31 Phase 3): a battle scene says which
 * of four steps the threat to the post calls for, and the synth books a beat
 * at a time, so a step is heard within a beat of being asked for. A breach or
 * a lost building ducks the whole score for a moment, so the impact lands.
 *
 * Headless-safe: with no AudioContext every method is a no-op, though the
 * step is still kept, so what was asked for can be read back.
 */

/** How far ahead notes are booked, and how often we look. */
const LOOKAHEAD_SECONDS = 0.5;
const TICK_MS = 120;

/** A semitone: the second drone's distance above the first, at CRITICAL. */
const EDGE_RATIO = Math.pow(2, 1 / 12);
/** How far a duck takes the score down, and how fast it comes back. */
const DUCK_LEVEL = 0.35;
const DUCK_RECOVERY = 0.12;
/**
 * How long the drone takes to settle, in seconds (a time constant): a mood
 * change slides slowly, and a step, the same music pressing harder, twice as
 * fast.
 */
const MOOD_GLIDE = 1.2;
const STEP_GLIDE = 0.6;

class Music {
  private mood: Mood | null = null;
  private drone: {
    osc: OscillatorNode[];
    gain: GainNode;
    filter: BiquadFilterNode;
    edge: OscillatorNode;
    edgeGain: GainNode;
  } | null = null;
  /** Everything the score plays goes through this, so a duck takes it all down together. */
  private duckNode: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Context time the next beat falls at, which beat of its bar, and which bar. */
  private nextBeatAt = 0;
  private beatInBar = 0;
  private barIndex = 0;
  /** What was asked for, even if there was no context to honour it yet. */
  private pending: Mood | null = null;
  /** The battle's step, and every step the score has been asked for, by count (M31). */
  private step: Step = DEFAULT_STEP;
  /** Whether this mood's battle has asked for a step yet: its first is counted even if it is the default. */
  private stepAsked = false;
  private readonly visited = new Map<Step, number>();

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

    // A battle starts from its default step until the battle says otherwise,
    // and nothing outside a battle keeps the last one's.
    const moodChanged = mood !== this.mood;
    if (moodChanged) {
      this.step = DEFAULT_STEP;
      this.stepAsked = false;
    }
    this.mood = mood;
    this.retuneDrone(ctx, bus, mood, moodChanged ? MOOD_GLIDE : STEP_GLIDE);
    if (this.timer === null) {
      this.nextBeatAt = ctx.currentTime + 0.1;
      this.beatInBar = 0;
      this.barIndex = 0;
      this.timer = setInterval(() => this.pump(), TICK_MS);
    }
  }

  /**
   * The step the battle calls for (M31 Phase 3). Only the battle mood has
   * steps; asked for in another, it is kept and does nothing until a battle.
   */
  setStep(step: Step): void {
    if (step === this.step && this.stepAsked) return;
    this.stepAsked = true;
    this.step = step;
    this.visited.set(step, (this.visited.get(step) ?? 0) + 1);
    const ctx = audio.context();
    const bus = audio.musicBus();
    if (ctx && bus && this.mood) this.retuneDrone(ctx, bus, this.mood, STEP_GLIDE);
  }

  currentStep(): Step {
    return this.step;
  }

  /** Every step the score has been asked for since the page loaded, by count. */
  visitedSteps(): Partial<Record<Step, number>> {
    return Object.fromEntries(this.visited) as Partial<Record<Step, number>>;
  }

  /**
   * Drop the whole score for `seconds`, then let it back up: a breach or a
   * lost building is heard over the music rather than inside it.
   */
  duck(seconds: number): void {
    const ctx = audio.context();
    const node = this.duckNode;
    if (!ctx || !node) return;
    const t = ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(DUCK_LEVEL, t + 0.04);
    node.gain.setTargetAtTime(1, t + seconds, DUCK_RECOVERY);
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
        for (const osc of [...dying.osc, dying.edge]) {
          try {
            osc.stop();
          } catch {
            /* already stopped */
          }
        }
      }, 1500);
    }
    this.drone = null;
    this.duckNode = null;
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
  private retuneDrone(ctx: AudioContext, bus: GainNode, mood: Mood, glide: number): void {
    const score = scoreAt(mood, this.step);
    const t = ctx.currentTime;
    if (!this.duckNode) {
      this.duckNode = ctx.createGain();
      this.duckNode.gain.value = 1;
      this.duckNode.connect(bus);
    }
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
      // The second drone, a semitone up, silent until the post is being hit.
      const edgeGain = ctx.createGain();
      edgeGain.gain.value = 0;
      const edge = ctx.createOscillator();
      edge.type = 'sawtooth';
      edge.frequency.value = score.rootHz * EDGE_RATIO;
      edge.connect(edgeGain).connect(filter);
      edge.start(t);
      filter.connect(gain).connect(this.duckNode);
      this.drone = { osc, gain, filter, edge, edgeGain };
    }
    const { osc, gain, filter, edge, edgeGain } = this.drone;
    for (const o of osc) o.frequency.setTargetAtTime(score.rootHz, t, glide);
    edge.frequency.setTargetAtTime(score.rootHz * EDGE_RATIO, t, glide);
    filter.frequency.setTargetAtTime(score.cutoffHz, t, glide);
    gain.gain.setTargetAtTime(score.droneGain, t, glide + 0.3);
    edgeGain.gain.setTargetAtTime(score.edgeGain, t, glide);
  }

  /**
   * Book every beat that falls inside the lookahead window, at the step asked
   * for now. A beat at a time rather than a bar (M31 Phase 3): a bar of battle
   * music is nearly six seconds, far too long to wait to hear the post is
   * being hit.
   */
  private pump(): void {
    const ctx = audio.context();
    const out = this.duckNode;
    const mood = this.mood;
    if (!ctx || !out || !mood) return;
    const horizon = ctx.currentTime + LOOKAHEAD_SECONDS;
    // A tab left in the background can leave the clock a long way ahead; catch
    // up by skipping rather than by booking a hundred beats at once.
    if (this.nextBeatAt < ctx.currentTime - 2) this.nextBeatAt = ctx.currentTime + 0.05;

    const { beats, bpm } = MOODS[mood];
    while (this.nextBeatAt < horizon) {
      if (this.beatInBar >= beats) {
        this.beatInBar = 0;
        this.barIndex++;
      }
      const at = this.nextBeatAt;
      for (const note of beatNotes(mood, this.barIndex, this.beatInBar, this.step)) this.sound(ctx, out, note, at);
      this.beatInBar++;
      this.nextBeatAt = at + 60 / bpm;
    }
  }

  private sound(ctx: AudioContext, bus: AudioNode, note: Note, at: number): void {
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
