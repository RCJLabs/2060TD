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
const STEPS = [0, 1, 3, 7, 8, 10, 12, 15];

export interface Note {
  /** Beat within the bar, 0-based. */
  beat: number;
  hz: number;
  /** Seconds the note rings for. */
  seconds: number;
  gain: number;
  kind: 'pulse' | 'voice';
}

/** Deterministic per (mood, bar): the same bar always plays the same way. */
function barRng(mood: Mood, bar: number): () => number {
  // mulberry32, same as the sim's — reproducible and cheap.
  let a = ((bar + 1) * 2654435761 + mood.length * 40503 + mood.charCodeAt(0) * 7919) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One bar of music: the pulses that keep time and whatever voices the mood's
 * density lets through. Never more than one voice a beat — this is a bed, not
 * a tune, and something has to be audible over it.
 */
export function bar(mood: Mood, index: number): Note[] {
  const score = MOODS[mood];
  const rng = barRng(mood, index);
  const beatSeconds = 60 / score.bpm;
  const notes: Note[] = [];

  for (let beat = 0; beat < score.beats; beat++) {
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
    if (rng() >= score.density) continue;
    const step = STEPS[Math.floor(rng() * STEPS.length)] ?? 0;
    // Two octaves up from the drone, so the voice sits above it rather than
    // fighting it for the same air.
    const hz = score.rootHz * 4 * Math.pow(2, step / 12);
    notes.push({
      beat,
      hz,
      seconds: beatSeconds * (1 + Math.floor(rng() * 2)),
      gain: 0.2 + rng() * 0.12,
      kind: 'voice',
    });
  }
  return notes;
}

export const barSeconds = (mood: Mood): number =>
  (60 / MOODS[mood].bpm) * MOODS[mood].beats;
