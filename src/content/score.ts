/**
 * The score (v1.8): what the game plays, as data.
 *
 * There are no audio assets in this project and the artifact is one HTML file,
 * so the music is synthesized the same way the SFX are. That makes the score a
 * content problem rather than an asset problem: this module decides what notes
 * exist and when, and game/music.ts is only the synth that sounds them.
 *
 * It is pure, so the part with actual musical decisions in it can be tested —
 * densities, ranges and the fact that a mood is reproducible bar to bar.
 */

export type Mood = 'quiet' | 'planning' | 'battle';

export interface MoodScore {
  id: Mood;
  /** Beats per minute. Everything else is derived from the beat. */
  bpm: number;
  /** Beats in a bar. */
  beats: number;
  /** Root of the drone, in Hz. Low: this sits under everything. */
  rootHz: number;
  /** Chance per eligible beat that a melodic note sounds at all. */
  density: number;
  /** Beats between low pulses; 0 means no pulse. */
  pulseEvery: number;
  /** Lowpass cutoff on the drone — the higher, the more present. */
  cutoffHz: number;
  /** Drone level, 0..1, relative to the music bus. */
  droneGain: number;
}

/**
 * Three states, one idea: the same bleak interval set, played sparser or
 * tighter. The menu is a room with a radio on; the planner is that room with
 * someone thinking in it; a siege is the same music with a pulse under it.
 */
export const MOODS: Record<Mood, MoodScore> = {
  quiet: {
    id: 'quiet',
    bpm: 52,
    beats: 8,
    rootHz: 55, // A1
    density: 0.16,
    pulseEvery: 0,
    cutoffHz: 320,
    droneGain: 0.5,
  },
  planning: {
    id: 'planning',
    bpm: 66,
    beats: 8,
    rootHz: 61.74, // B1
    density: 0.26,
    pulseEvery: 4,
    cutoffHz: 420,
    droneGain: 0.55,
  },
  battle: {
    id: 'battle',
    bpm: 84,
    beats: 8,
    rootHz: 49, // G1
    density: 0.38,
    pulseEvery: 2,
    cutoffHz: 560,
    droneGain: 0.62,
  },
};

/**
 * Semitones above the root. Minor pentatonic with the flat second instead of
 * the fourth — the interval that keeps this from sounding hopeful.
 */
const SCALE = [0, 1, 3, 7, 8, 10, 12, 15];

// ---- the battle score's steps (M31 Phase 3) -------------------------------------------

/**
 * How hard the battle is pressing the post, in four steps. The battle mood
 * plays one at a time: the same idea, tighter and brighter as the threat
 * closes in. The other moods have no steps.
 */
export type Step = 'calm' | 'contact' | 'pressed' | 'critical';

export const STEPS: readonly Step[] = ['calm', 'contact', 'pressed', 'critical'];

export interface StepScore {
  /** Beats between low pulses. */
  pulseEvery: number;
  /** Chance per beat that a melodic note sounds. */
  density: number;
  /** Lowpass cutoff on the drone. */
  cutoffHz: number;
  /** Drone level. */
  droneGain: number;
  /** A second drone a semitone above the first: the post being hit. */
  edgeGain: number;
}

/**
 * CONTACT is the battle mood as it always was, so nothing sounds different
 * until the board does. CALM is nearly the planner, for a board with no one
 * on it; PRESSED puts the heartbeat on every beat; CRITICAL adds the second
 * drone, a semitone of grind under everything.
 */
export const BATTLE_STEPS: Readonly<Record<Step, StepScore>> = {
  calm: { pulseEvery: 4, density: 0.24, cutoffHz: 440, droneGain: 0.56, edgeGain: 0 },
  contact: { pulseEvery: 2, density: 0.38, cutoffHz: 560, droneGain: 0.62, edgeGain: 0 },
  pressed: { pulseEvery: 1, density: 0.5, cutoffHz: 760, droneGain: 0.66, edgeGain: 0 },
  critical: { pulseEvery: 1, density: 0.62, cutoffHz: 980, droneGain: 0.7, edgeGain: 0.2 },
};

/** The step a mood plays when nothing has said otherwise. */
export const DEFAULT_STEP: Step = 'contact';

/** What a mood plays at a step. Only the battle mood has steps; the others ignore it. */
export function scoreAt(mood: Mood, step: Step = DEFAULT_STEP): MoodScore & { edgeGain: number } {
  const base = MOODS[mood];
  if (mood !== 'battle') return { ...base, edgeGain: 0 };
  const s = BATTLE_STEPS[step];
  return {
    ...base,
    pulseEvery: s.pulseEvery,
    density: s.density,
    cutoffHz: s.cutoffHz,
    droneGain: s.droneGain,
    edgeGain: s.edgeGain,
  };
}

/** What the score reads off a battle. */
export interface Threat {
  /** Won, lost, or the footage has run out. */
  ended: boolean;
  /** Attackers on the board. */
  alive: number;
  /** The nearest one's distance from the command post, in cells; Infinity with none. */
  nearest: number;
  /** The post has lost health in the last few seconds. */
  postHurt: boolean;
  /** The post's health, 0..1. */
  postHp: number;
}

/** The post counts as being hurt for this long after it last lost health, in seconds. */
export const POST_HURT_SECONDS = 3;
/** Closer than this to the post, in cells, and the battle is pressing it. */
export const PRESSED_CELLS = 4;
/** This many on the board presses it wherever they are. */
export const PRESSED_COUNT = 8;
/** A post this far gone is critical with anyone close to it. */
export const CRITICAL_HP = 0.35;

/**
 * The step a battle calls for. Measured on live defences, the nearest attacker
 * is seven cells or more from the post most of a quiet defence and under
 * three for half of a heavy one, so the same battle mood played over both
 * was saying nothing about either.
 */
export function threatStep(t: Threat): Step {
  if (t.ended || t.alive <= 0) return 'calm';
  if (t.postHurt) return 'critical';
  if (t.postHp < CRITICAL_HP && t.nearest < PRESSED_CELLS) return 'critical';
  if (t.nearest < PRESSED_CELLS || t.alive >= PRESSED_COUNT) return 'pressed';
  return 'contact';
}

/** A step rises no sooner than this after the last change, in seconds. */
export const STEP_RISE_SECONDS = 2;
/** And falls only once the lower step has held this long. */
export const STEP_FALL_SECONDS = 4;

/**
 * What the score actually plays, from what the battle calls for: a rise is
 * heard at once but no oftener than every couple of seconds, and a fall waits
 * until the lower step has held, so the music does not drop the moment the
 * last man dies or flap at a replay's ×8.
 */
export class StepWatch {
  private current: Step | null = null;
  private changedAt = Number.NEGATIVE_INFINITY;
  private lowSince: number | null = null;

  /** Report what the battle calls for at `t` seconds; the step to play. */
  update(reading: Step, t: number): Step {
    if (this.current === null) {
      this.current = reading;
      this.changedAt = t;
      return reading;
    }
    const cur = STEPS.indexOf(this.current);
    const next = STEPS.indexOf(reading);
    if (next > cur) {
      this.lowSince = null;
      if (t - this.changedAt >= STEP_RISE_SECONDS) this.change(reading, t);
    } else if (next < cur) {
      if (this.lowSince === null) this.lowSince = t;
      if (t - this.lowSince >= STEP_FALL_SECONDS && t - this.changedAt >= STEP_RISE_SECONDS) this.change(reading, t);
    } else {
      this.lowSince = null;
    }
    return this.current;
  }

  private change(step: Step, t: number): void {
    this.current = step;
    this.changedAt = t;
    this.lowSince = null;
  }
}

export interface Note {
  /** Beat within the bar, 0-based. */
  beat: number;
  hz: number;
  /** Seconds the note rings for. */
  seconds: number;
  gain: number;
  kind: 'pulse' | 'voice';
}

/**
 * Deterministic per (mood, bar, beat): the same beat always plays the same
 * way. Per beat rather than per bar (M31), so a beat booked at one step draws
 * the same numbers as it would at another, and a step up adds voices without
 * moving the ones already there.
 */
function beatRng(mood: Mood, bar: number, beat: number): () => number {
  // mulberry32, same as the sim's — reproducible and cheap.
  let a = ((bar + 1) * 2654435761 + (beat + 1) * 1597334677 + mood.length * 40503 + mood.charCodeAt(0) * 7919) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One beat of music: the pulse, if this beat keeps time, and the voice, if the
 * density lets one through. Never more than one voice a beat — this is a bed,
 * not a tune, and something has to be audible over it. The synth books a beat
 * at a time (M31), so a step change is heard within a beat.
 */
export function beatNotes(mood: Mood, index: number, beat: number, step: Step = DEFAULT_STEP): Note[] {
  const score = scoreAt(mood, step);
  const beatSeconds = 60 / score.bpm;
  const notes: Note[] = [];
  if (score.pulseEvery > 0 && beat % score.pulseEvery === 0) {
    notes.push({
      beat,
      hz: score.rootHz,
      seconds: Math.min(0.5, beatSeconds * 0.7),
      // The downbeat lands; the rest of the pulses are a heartbeat.
      gain: beat === 0 ? 0.5 : 0.32,
      kind: 'pulse',
    });
  }
  const rng = beatRng(mood, index, beat);
  if (rng() >= score.density) return notes;
  const semitones = SCALE[Math.floor(rng() * SCALE.length)] ?? 0;
  // Two octaves up from the drone, so the voice sits above it rather than
  // fighting it for the same air.
  const hz = score.rootHz * 4 * Math.pow(2, semitones / 12);
  notes.push({
    beat,
    hz,
    seconds: beatSeconds * (1 + Math.floor(rng() * 2)),
    gain: 0.2 + rng() * 0.12,
    kind: 'voice',
  });
  return notes;
}

/** One bar of music: its beats, in order. */
export function bar(mood: Mood, index: number, step: Step = DEFAULT_STEP): Note[] {
  const notes: Note[] = [];
  for (let beat = 0; beat < MOODS[mood].beats; beat++) notes.push(...beatNotes(mood, index, beat, step));
  return notes;
}

export const barSeconds = (mood: Mood): number =>
  (60 / MOODS[mood].bpm) * MOODS[mood].beats;
