import { describe, expect, it } from 'vitest';
import { bar, barSeconds, MOODS, type Mood, type Note } from '../src/content/score';
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
