import { describe, expect, it } from 'vitest';
import { COMBAT_CURRENT, COMBAT_MODELS, COMBAT_NONE, combatModelFor } from '../src/sim/combat';
import { createRng } from '../src/sim/rng';
import { M1_CATALOG } from '../src/content/catalog';
import { Engine } from '../src/sim/engine';
import type { SimConfig } from '../src/sim/types';
import { TEST_CATALOG } from './helpers';

/**
 * The combat-variance contract (v1.23).
 *
 * Two things have to hold and they pull against each other. The rolls have to
 * actually change a battle — that is the whole point of the milestone — and
 * they have to change NOTHING for a config that does not ask for them, or
 * every replay in every player's vault re-fights a different war.
 */

describe('a model preserves its mean', () => {
  // The algebra says each model's expected multiplier is 1. That is exactly
  // the sort of claim that is true on paper and wrong in the code, so it is
  // measured. A model whose mean drifts is a difficulty change wearing a
  // variance costume, and the balance tables could not tell the two apart.
  const DRAWS = 200_000;

  for (const version of Object.keys(COMBAT_MODELS).map(Number)) {
    const model = combatModelFor(version);
    it(`v${version} (${model.label}) averages 1.0 over ${DRAWS} shots`, () => {
      const rng = createRng(0x5eed ^ version);
      let total = 0;
      for (let i = 0; i < DRAWS; i++) total += model.shot(rng);
      const mean = total / DRAWS;
      expect(mean, `v${version} mean ${mean.toFixed(4)}`).toBeGreaterThan(0.99);
      expect(mean, `v${version} mean ${mean.toFixed(4)}`).toBeLessThan(1.01);
    });
  }

  it('and the models that are meant to vary actually do', () => {
    const rolling = Object.keys(COMBAT_MODELS)
      .map(Number)
      .filter((v) => v !== COMBAT_NONE);
    expect(rolling.length, 'no damage models registered').toBeGreaterThan(0);
    for (const version of rolling) {
      const model = combatModelFor(version);
      const rng = createRng(11);
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) seen.add(Math.round(model.shot(rng) * 1000));
      expect(seen.size, `v${version} (${model.label}) returned one value`).toBeGreaterThan(1);
    }
  });

  it('and version 0 is the sim that never rolls', () => {
    const model = combatModelFor(COMBAT_NONE);
    const rng = createRng(7);
    let drawn = 0;
    const counting = (): number => {
      drawn++;
      return rng();
    };
    for (let i = 0; i < 50; i++) expect(model.shot(counting)).toBe(1);
    expect(drawn, 'version 0 drew from the stream').toBe(0);
    expect(combatModelFor(undefined).version).toBe(COMBAT_NONE);
    // An unknown version is flat rather than a crash: a save or a code from a
    // future build must open, not take the vault down with it.
    expect(combatModelFor(9999).version).toBe(COMBAT_NONE);
  });
});

// ---- the engine side ----------------------------------------------------------

const BASE: SimConfig = {
  width: 32,
  height: 24,
  seed: 42,
  ccOrigin: 11 * 32 + 27,
  spawnColumn: 0,
};

/** A short battle with shots actually fired, hashed at checkpoints. */
function fight(config: SimConfig): { hashes: string[]; shots: number } {
  const engine = new Engine(config, TEST_CATALOG);
  const idx = (x: number, y: number): number => y * config.width + x;
  engine.enqueue({ tick: 0, type: 'placeStructure', cell: idx(21, 8), kind: 'm2nest' });
  engine.enqueue({ tick: 0, type: 'placeStructure', cell: idx(21, 14), kind: 'm2nest' });
  for (let i = 0; i < 10; i++) {
    engine.enqueue({
      tick: i * 6,
      type: 'spawnAttacker',
      cell: idx(0, 4 + i * 2),
      kind: i % 3 === 0 ? 'breacher' : 'walker',
    });
  }
  const hashes: string[] = [];
  let shots = 0;
  for (let tick = 0; tick < 900; tick++) {
    const events = engine.step();
    shots += events.filter((e) => e.type === 'shot').length;
    if (tick % 150 === 0) hashes.push(engine.stateHash());
  }
  hashes.push(engine.stateHash());
  return { hashes, shots };
}

describe('the engine only rolls when asked', () => {
  it('a config with no combatVersion ignores combatSeed entirely', () => {
    const a = fight(BASE);
    const b = fight({ ...BASE, combatSeed: 999_331 });
    const c = fight({ ...BASE, combatVersion: COMBAT_NONE, combatSeed: 12_345 });
    // The liveness half: a hash that agrees because nothing happened is not a
    // passing test, so the battle has to have fired.
    expect(a.shots, 'nothing fired, so the hashes prove nothing').toBeGreaterThan(20);
    expect(b.hashes).toEqual(a.hashes);
    expect(c.hashes).toEqual(a.hashes);
  });

  it('and a model that rolls answers to its own seed', () => {
    const version = COMBAT_CURRENT;
    const a = fight({ ...BASE, combatVersion: version, combatSeed: 1 });
    const b = fight({ ...BASE, combatVersion: version, combatSeed: 2 });
    const again = fight({ ...BASE, combatVersion: version, combatSeed: 1 });
    expect(a.shots).toBeGreaterThan(20);
    expect(a.hashes, 'the same combat seed did not reproduce').toEqual(again.hashes);
    expect(a.hashes, 'a different combat seed changed nothing').not.toEqual(b.hashes);
  });

  it('and the battle stream is still the battle stream', () => {
    // The two streams have to be independent in both directions, and proving
    // it needs a catalog whose units actually roll: TEST_CATALOG is built with
    // zero jitter so travel times are exact, which means the battle seed is
    // inert there and an assertion about it would be about the fixture.
    const jittered = (config: SimConfig): string[] => {
      const engine = new Engine(config, M1_CATALOG);
      const idx = (x: number, y: number): number => y * config.width + x;
      engine.enqueue({ tick: 0, type: 'placeStructure', cell: idx(21, 8), kind: 'm2nest' });
      for (let i = 0; i < 8; i++) {
        engine.enqueue({ tick: i * 6, type: 'spawnAttacker', cell: idx(0, 4 + i * 2), kind: 'rifle' });
      }
      const hashes: string[] = [];
      for (let tick = 0; tick < 600; tick++) {
        engine.step();
        if (tick % 150 === 0) hashes.push(engine.stateHash());
      }
      return hashes;
    };
    const flat = jittered({ ...BASE });
    expect(
      jittered({ ...BASE, seed: 43 }),
      'the battle seed is inert even without any combat model',
    ).not.toEqual(flat);
    expect(
      jittered({ ...BASE, combatSeed: 999 }),
      'the combat seed reached a battle that never asked to roll',
    ).toEqual(flat);
    expect(
      jittered({ ...BASE, combatVersion: COMBAT_CURRENT, combatSeed: 999 }),
      'the combat seed changed nothing on a model that rolls',
    ).not.toEqual(flat);
  });
});
