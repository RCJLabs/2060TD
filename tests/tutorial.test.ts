import { describe, expect, it } from 'vitest';
import {
  CoachRunner,
  COACH_KEYS,
  FIRST_SIEGE,
  type CoachState,
  type CoachStep,
} from '../src/content/tutorial';
import { forgetCoach, hasSeen, markSeen } from '../src/meta/coach';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, type TownState } from '../src/meta/town';

const T0 = Date.UTC(2026, 2, 10, 12);

const state = (over: Partial<CoachState> = {}): CoachState => ({
  phase: 'setup',
  waveIndex: -1,
  cp: 0,
  kills: 0,
  deployed: 0,
  casts: 0,
  ...over,
});

/** Run a runner to exhaustion against a fixed state, one frame at a time. */
function drain(runner: CoachRunner, s: CoachState, seconds = 120): number {
  let frames = 0;
  for (let t = 0; t < seconds * 10 && !runner.done; t++) {
    runner.update(s, 0.1);
    frames++;
  }
  return frames;
}

describe('the first-siege script', () => {
  it('is well formed', () => {
    expect(FIRST_SIEGE.length).toBeGreaterThan(3);
    const ids = FIRST_SIEGE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of FIRST_SIEGE) {
      expect(step.text.length).toBeGreaterThan(20);
      expect(typeof step.done).toBe('function');
      // Every line gets time to be read, and no hold outlasts a breath.
      expect(step.dwell ?? 0).toBeGreaterThan(0);
      expect(step.dwell ?? 0).toBeLessThanOrEqual(8);
    }
    // Exactly the steps that must be read hold the battle, and no others.
    expect(FIRST_SIEGE.filter((s) => s.hold).map((s) => s.id)).toEqual(['wire', 'cp']);
  });

  it('teaches the three opaque things, in the order the battle raises them', () => {
    const said = FIRST_SIEGE.map((s) => s.text.toLowerCase()).join(' | ');
    expect(said).toContain('route'); // the wire is a path, not a barrier
    expect(said).toContain('command points'); // the budget exists
    expect(said).toMatch(/gone when the siege ends|does not carry home/); // and it is temporary
  });
});

describe('the step cursor', () => {
  const script: CoachStep[] = [
    { id: 'a', text: 'first line of the briefing', dwell: 1, done: (s) => s.kills >= 1 },
    { id: 'b', text: 'second line of the briefing', dwell: 1, hold: true, done: (s) => s.cp >= 10 },
    { id: 'c', text: 'the last line of the briefing', dwell: 1, done: () => false },
  ];

  it('will not advance before its line has been on screen', () => {
    const runner = new CoachRunner(script);
    const met = state({ kills: 5 }); // the condition is already true
    runner.update(met, 0.5);
    expect(runner.step?.id).toBe('a'); // …but the dwell is not served
    runner.update(met, 0.6);
    expect(runner.step?.id).toBe('b');
  });

  it('holds the battle only until the dwell is served, never on a condition', () => {
    const runner = new CoachRunner(script);
    runner.update(state({ kills: 5 }), 1); // clear step a
    expect(runner.step?.id).toBe('b');

    // Step b holds and its condition is NOT met.
    expect(runner.update(state(), 0.4).hold).toBe(true);
    expect(runner.update(state(), 0.7).hold).toBe(false); // dwell served: released
    expect(runner.step?.id).toBe('b'); // still up, just no longer holding
  });

  it('lets a tap serve the rest of the dwell', () => {
    const runner = new CoachRunner(script);
    runner.update(state({ kills: 1 }), 0.1);
    expect(runner.step?.id).toBe('a');
    runner.skipDwell();
    runner.update(state({ kills: 1 }), 0.01);
    expect(runner.step?.id).toBe('b');
  });

  it('retires the last step on its dwell alone, so nothing lingers', () => {
    const runner = new CoachRunner(script);
    drain(runner, state({ kills: 9, cp: 99 }));
    expect(runner.done).toBe(true);
    expect(runner.step).toBeNull();
    // A finished runner is inert.
    expect(runner.update(state(), 1)).toEqual({ hold: false, changed: false });
  });

  it('is inert with an empty script', () => {
    const runner = new CoachRunner([]);
    expect(runner.done).toBe(true);
    expect(runner.update(state(), 1).hold).toBe(false);
  });
});

describe('the real script never traps a player', () => {
  it('runs to the end for someone who does everything asked', () => {
    const runner = new CoachRunner(FIRST_SIEGE);
    // A cooperative commander: fights, kills, banks CP, deploys, wins.
    const script: CoachState[] = [
      state({ phase: 'setup' }),
      state({ phase: 'combat', waveIndex: 0 }),
      state({ phase: 'combat', waveIndex: 0, kills: 3, cp: 25 }),
      state({ phase: 'combat', waveIndex: 0, kills: 6, cp: 30, deployed: 1 }),
      state({ phase: 'victory', waveIndex: 1, kills: 12, cp: 40, deployed: 1 }),
    ];
    for (const s of script) {
      for (let i = 0; i < 200 && !runner.done; i++) runner.update(s, 0.1);
    }
    expect(runner.done).toBe(true);
  });

  it('runs to the end for someone who ignores it entirely and loses', () => {
    const runner = new CoachRunner(FIRST_SIEGE);
    // Never deploys, never casts, and the post falls.
    drain(runner, state({ phase: 'defeat', waveIndex: 0, kills: 0, cp: 0 }));
    expect(runner.done).toBe(true);
  });

  it('never holds the battle for more than a few seconds in total', () => {
    const runner = new CoachRunner(FIRST_SIEGE);
    let heldSeconds = 0;
    const stubborn = state({ phase: 'combat', waveIndex: 0 }); // meets nothing
    for (let i = 0; i < 2000 && !runner.done; i++) {
      if (runner.update(stubborn, 0.1).hold) heldSeconds += 0.1;
    }
    expect(heldSeconds).toBeLessThanOrEqual(12);
  });
});

describe('the coach ledger', () => {
  const town = (): TownState => newTown(T0);

  it('remembers a screen once and forgets them all on request', () => {
    const t = town();
    expect(hasSeen(t, COACH_KEYS.firstSiege)).toBe(false);
    expect(markSeen(t, COACH_KEYS.firstSiege)).toBe(true);
    expect(markSeen(t, COACH_KEYS.firstSiege)).toBe(false); // already read
    expect(hasSeen(t, COACH_KEYS.firstSiege)).toBe(true);
    expect(hasSeen(t, COACH_KEYS.raidPlanner)).toBe(false);

    markSeen(t, COACH_KEYS.raidPlanner);
    forgetCoach(t);
    expect(hasSeen(t, COACH_KEYS.firstSiege)).toBe(false);
    expect(hasSeen(t, COACH_KEYS.raidPlanner)).toBe(false);
  });

  it('survives a save round-trip, and a save that predates it', () => {
    const t = town();
    markSeen(t, COACH_KEYS.firstSiege);
    const back = deserialize(serialize(t))!;
    expect(hasSeen(back, COACH_KEYS.firstSiege)).toBe(true);

    const legacy = JSON.parse(serialize(town())) as { town: Record<string, unknown> };
    delete legacy.town['seen'];
    const repaired = deserialize(JSON.stringify(legacy))!;
    expect(repaired).not.toBeNull();
    expect(repaired.seen).toEqual([]); // read nothing, rather than broken
    expect(hasSeen(repaired, COACH_KEYS.firstSiege)).toBe(false);
  });
});
