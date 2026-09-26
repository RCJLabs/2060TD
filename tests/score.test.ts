import { describe, expect, it } from 'vitest';
import {
  bar,
  barSeconds,
  BATTLE_STEPS,
  beatNotes,
  MOODS,
  scoreAt,
  STEP_FALL_SECONDS,
  STEP_RISE_SECONDS,
  STEPS,
  StepWatch,
  threatStep,
  type Mood,
  type Note,
  type Step,
  type Threat,
} from '../src/content/score';
import { nextVolume, volumeLabel, VOLUME_STEPS } from '../src/game/settings';

const MOOD_IDS: Mood[] = ['quiet', 'planning', 'battle'];

const voices = (notes: Note[]): Note[] => notes.filter((n) => n.kind === 'voice');
const pulses = (notes: Note[]): Note[] => notes.filter((n) => n.kind === 'pulse');

/** Mean voices per bar over enough bars that the density is the signal. */
function voiceRate(mood: Mood, bars = 200): number {
  let total = 0;
  for (let i = 0; i < bars; i++) total += voices(bar(mood, i)).length;
  return total / bars;
}

describe('the moods', () => {
  it('are three states of one idea, not three tunes', () => {
    for (const id of MOOD_IDS) {
      const mood = MOODS[id];
      expect(mood.id).toBe(id);
      expect(mood.bpm).toBeGreaterThan(30);
      expect(mood.bpm).toBeLessThan(140);
      expect(mood.beats).toBeGreaterThan(0);
      expect(mood.density).toBeGreaterThan(0);
      expect(mood.density).toBeLessThan(1);
      expect(mood.droneGain).toBeGreaterThan(0);
      expect(mood.droneGain).toBeLessThanOrEqual(1);
      // A drone that is not below everything else is a note.
      expect(mood.rootHz).toBeLessThan(80);
    }
  });

  it('get tighter, not louder, as the situation does', () => {
    expect(MOODS.quiet.bpm).toBeLessThan(MOODS.planning.bpm);
    expect(MOODS.planning.bpm).toBeLessThan(MOODS.battle.bpm);
    expect(MOODS.quiet.density).toBeLessThan(MOODS.planning.density);
    expect(MOODS.planning.density).toBeLessThan(MOODS.battle.density);
    // The menu has no heartbeat at all; a siege has one every other beat.
    expect(MOODS.quiet.pulseEvery).toBe(0);
    expect(MOODS.battle.pulseEvery).toBeLessThan(MOODS.planning.pulseEvery);
  });
});

describe('a bar', () => {
  it('plays the same way every time it comes round', () => {
    for (const mood of MOOD_IDS) {
      for (const index of [0, 1, 7, 128]) {
        expect(bar(mood, index)).toEqual(bar(mood, index));
      }
    }
  });

  it('is not the same bar over and over', () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 40; i++) shapes.add(JSON.stringify(bar('battle', i)));
    expect(shapes.size).toBeGreaterThan(20);
  });

  it('keeps every note inside the bar it belongs to', () => {
    for (const mood of MOOD_IDS) {
      const beats = MOODS[mood].beats;
      for (let i = 0; i < 60; i++) {
        for (const note of bar(mood, i)) {
          expect(note.beat).toBeGreaterThanOrEqual(0);
          expect(note.beat).toBeLessThan(beats);
          expect(note.seconds).toBeGreaterThan(0);
          expect(note.gain).toBeGreaterThan(0);
          expect(note.gain).toBeLessThanOrEqual(1);
          // Nothing subsonic, nothing shrill: this has to sit under the game.
          expect(note.hz).toBeGreaterThan(30);
          expect(note.hz).toBeLessThan(2000);
        }
      }
    }
  });

  it('never puts more than one voice on a beat', () => {
    for (const mood of MOOD_IDS) {
      for (let i = 0; i < 60; i++) {
        const beats = voices(bar(mood, i)).map((n) => n.beat);
        expect(new Set(beats).size).toBe(beats.length);
      }
    }
  });

  it('keeps time exactly where the mood says', () => {
    for (const mood of MOOD_IDS) {
      const every = MOODS[mood].pulseEvery;
      const beat = pulses(bar(mood, 3)).map((n) => n.beat);
      if (every === 0) {
        expect(beat).toEqual([]);
        continue;
      }
      expect(beat.every((b) => b % every === 0)).toBe(true);
      expect(beat.length).toBe(Math.ceil(MOODS[mood].beats / every));
      // The downbeat is the one that lands.
      const down = pulses(bar(mood, 3)).find((n) => n.beat === 0);
      expect(down?.gain).toBeGreaterThan(pulses(bar(mood, 3))[1]?.gain ?? 0);
    }
  });

  it('sounds as sparse as its mood claims', () => {
    const quiet = voiceRate('quiet');
    const planning = voiceRate('planning');
    const battle = voiceRate('battle');
    expect(quiet).toBeLessThan(planning);
    expect(planning).toBeLessThan(battle);
    // A bed, not a tune: even a siege leaves most beats empty.
    expect(battle).toBeLessThan(MOODS.battle.beats * 0.6);
    expect(quiet).toBeGreaterThan(0.3);
  });

  it('is as long as its tempo says it is', () => {
    for (const mood of MOOD_IDS) {
      expect(barSeconds(mood)).toBeCloseTo((60 / MOODS[mood].bpm) * MOODS[mood].beats, 6);
    }
    expect(barSeconds('quiet')).toBeGreaterThan(barSeconds('battle'));
  });
});

describe("the battle score's steps (M31 Phase 3)", () => {
  it('run calm, contact, pressed, critical, and each is tighter and brighter than the last', () => {
    expect(STEPS).toEqual(['calm', 'contact', 'pressed', 'critical']);
    for (let i = 1; i < STEPS.length; i++) {
      const lower = BATTLE_STEPS[STEPS[i - 1]!];
      const upper = BATTLE_STEPS[STEPS[i]!];
      expect(upper.pulseEvery, STEPS[i]).toBeLessThanOrEqual(lower.pulseEvery);
      expect(upper.density, STEPS[i]).toBeGreaterThan(lower.density);
      expect(upper.cutoffHz, STEPS[i]).toBeGreaterThan(lower.cutoffHz);
      expect(upper.droneGain, STEPS[i]).toBeGreaterThanOrEqual(lower.droneGain);
    }
    // Every step keeps a heartbeat, and even the worst leaves beats empty.
    for (const step of STEPS) expect(BATTLE_STEPS[step].pulseEvery).toBeGreaterThan(0);
    expect(BATTLE_STEPS.critical.density).toBeLessThan(0.75);
  });

  it('put the second drone in only at critical', () => {
    for (const step of STEPS) expect(BATTLE_STEPS[step].edgeGain > 0, step).toBe(step === 'critical');
  });

  it("make contact today's battle score exactly, so nothing changes until the board does", () => {
    const contact = scoreAt('battle', 'contact');
    expect(contact.pulseEvery).toBe(MOODS.battle.pulseEvery);
    expect(contact.density).toBe(MOODS.battle.density);
    expect(contact.cutoffHz).toBe(MOODS.battle.cutoffHz);
    expect(contact.droneGain).toBe(MOODS.battle.droneGain);
    expect(bar('battle', 5)).toEqual(bar('battle', 5, 'contact'));
  });

  it('leave the quiet and planning moods alone, whatever the step', () => {
    for (const mood of ['quiet', 'planning'] as const) {
      for (const step of STEPS) expect(bar(mood, 3, step)).toEqual(bar(mood, 3));
    }
  });
});

describe('booked a beat at a time', () => {
  it('a bar is its beats, in order', () => {
    for (const mood of MOOD_IDS) {
      for (const step of STEPS) {
        const beats: Note[] = [];
        for (let b = 0; b < MOODS[mood].beats; b++) beats.push(...beatNotes(mood, 9, b, step));
        expect(bar(mood, 9, step)).toEqual(beats);
      }
    }
  });

  it('a step up adds voices and takes none away, so a change is heard as more, not different', () => {
    for (let i = 0; i < 40; i++) {
      for (let b = 0; b < MOODS.battle.beats; b++) {
        const lower = beatNotes('battle', i, b, 'contact').filter((n) => n.kind === 'voice');
        const upper = beatNotes('battle', i, b, 'pressed').filter((n) => n.kind === 'voice');
        for (const v of lower) expect(upper).toContainEqual(v);
      }
    }
  });

  it('sounds denser at every step up', () => {
    const rate = (step: Step): number => {
      let n = 0;
      for (let i = 0; i < 200; i++) n += voices(bar('battle', i, step)).length;
      return n / 200;
    };
    const rates = STEPS.map(rate);
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeGreaterThan(rates[i - 1]!);
  });
});

describe('the threat to the post', () => {
  const threat = (t: Partial<Threat>): Threat => ({
    ended: false,
    alive: 3,
    nearest: 9,
    postHurt: false,
    postHp: 1,
    ...t,
  });

  it('is calm with no one on the board, and once the battle is over', () => {
    expect(threatStep(threat({ alive: 0, nearest: Number.POSITIVE_INFINITY }))).toBe('calm');
    expect(threatStep(threat({ ended: true, postHurt: true, nearest: 0.5 }))).toBe('calm');
  });

  it('is contact while they are on the board and far off', () => {
    expect(threatStep(threat({}))).toBe('contact');
  });

  it('is pressed when one is close to the post, or when many are on the board', () => {
    expect(threatStep(threat({ nearest: 3 }))).toBe('pressed');
    expect(threatStep(threat({ alive: 8, nearest: 12 }))).toBe('pressed');
  });

  it('is critical while the post is being hurt, or when it is nearly gone with them close', () => {
    expect(threatStep(threat({ postHurt: true, nearest: 1 }))).toBe('critical');
    expect(threatStep(threat({ postHp: 0.3, nearest: 3 }))).toBe('critical');
    // Nearly gone, but no one is near it: not critical.
    expect(threatStep(threat({ postHp: 0.3, nearest: 9 }))).toBe('contact');
  });
});

describe('a step holds long enough to be heard', () => {
  it('rises at once the first time, and not again for a couple of seconds', () => {
    const w = new StepWatch();
    expect(w.update('contact', 0)).toBe('contact');
    expect(w.update('pressed', 1)).toBe('contact');
    expect(w.update('pressed', STEP_RISE_SECONDS)).toBe('pressed');
  });

  it('falls only once the lower step has held', () => {
    const w = new StepWatch();
    w.update('critical', 0);
    expect(w.update('contact', 10)).toBe('critical');
    expect(w.update('contact', 10 + STEP_FALL_SECONDS - 0.1)).toBe('critical');
    expect(w.update('contact', 10 + STEP_FALL_SECONDS)).toBe('contact');
  });

  it('a threat that comes back during the hold starts the hold again', () => {
    const w = new StepWatch();
    w.update('pressed', 0);
    w.update('calm', 10);
    w.update('pressed', 12);
    expect(w.update('calm', 13)).toBe('pressed');
    expect(w.update('calm', 13 + STEP_FALL_SECONDS - 0.1)).toBe('pressed');
    expect(w.update('calm', 13 + STEP_FALL_SECONDS)).toBe('calm');
  });

  it('never changes faster than the rise, even at replay speed', () => {
    const w = new StepWatch();
    const heard: Step[] = [];
    let t = 0;
    // A reading flipping every tenth of a second for ten seconds.
    for (let i = 0; i < 100; i++, t += 0.1) heard.push(w.update(i % 2 === 0 ? 'critical' : 'calm', t));
    let changes = 0;
    for (let i = 1; i < heard.length; i++) if (heard[i] !== heard[i - 1]) changes++;
    expect(changes).toBeLessThanOrEqual(Math.ceil(10 / STEP_RISE_SECONDS));
  });
});

describe('the mixer', () => {
  it('cycles through its stops and wraps back to silence', () => {
    let level = VOLUME_STEPS[0]!;
    const walked = [level];
    for (let i = 0; i < VOLUME_STEPS.length; i++) {
      level = nextVolume(level);
      walked.push(level);
    }
    expect(walked.slice(0, VOLUME_STEPS.length)).toEqual(VOLUME_STEPS);
    expect(walked[VOLUME_STEPS.length]).toBe(VOLUME_STEPS[0]); // wrapped
  });

  it('lands on a stop from anywhere, including nonsense', () => {
    for (const from of [0.3, 0.99, 1, -5, 42]) {
      expect(VOLUME_STEPS).toContain(nextVolume(from));
    }
  });

  it('says OFF rather than 0%', () => {
    expect(volumeLabel(0)).toBe('OFF');
    expect(volumeLabel(0.5)).toBe('50%');
    expect(volumeLabel(1)).toBe('100%');
  });
});
