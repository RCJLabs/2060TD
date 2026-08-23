import { describe, expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import type { AttackerProfile, Catalog, SimConfig, StructureProfile } from '../src/sim/types';
import { TEST_ATTACKERS, TEST_CATALOG } from './helpers';

/**
 * Sustainment auras (v0.7): engineer structures repair nearby structures
 * and walls; medic attackers heal nearby attackers. All rates here are
 * exact multiples of DT so assertions can be tight.
 */

const REPAIR_POST: StructureProfile = {
  kind: 'repairPost',
  name: 'Repair Post',
  maxHp: 200,
  footprint: 1,
  blocks: true,
  targetable: true,
  supplyCost: 10,
  aura: { healPerSecond: 10, radius: 3 },
};

const MEDIC: AttackerProfile = {
  kind: 'medic',
  name: 'Medic',
  maxHp: 60,
  speed: 2,
  armor: 'none',
  wallDps: 0,
  hqDps: 2,
  cpValue: 2,
  heal: { perSecond: 20, radius: 2.5 },
  speedJitter: 0,
};

const CATALOG: Catalog = {
  ...TEST_CATALOG,
  attackers: { ...TEST_ATTACKERS, medic: MEDIC },
  structures: { ...TEST_CATALOG.structures, repairPost: REPAIR_POST },
};

const WIDTH = 20;

function makeEngine(seed = 42, overrides: Partial<SimConfig> = {}): Engine {
  return new Engine(
    { width: WIDTH, height: 11, seed, ccOrigin: 4 * WIDTH + 17, spawnColumn: 0, ...overrides },
    CATALOG,
  );
}

describe('structure repair aura', () => {
  it('repairs damaged structures in radius, ignores those outside, caps at max', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'repairPost' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(12, 5), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(2, 5), kind: 'm2nest' });
    e.run(1);
    const near = e.structures.find((s) => s.origin === e.grid.idx(12, 5))!;
    const far = e.structures.find((s) => s.origin === e.grid.idx(2, 5))!;
    near.hp = 100;
    far.hp = 100;
    e.run(20); // 1 second at 10 hp/s
    expect(near.hp).toBeCloseTo(110, 5);
    expect(far.hp).toBe(100);

    near.hp = near.profile.maxHp - 1;
    e.run(40); // would be +20 uncapped
    expect(near.hp).toBe(near.profile.maxHp);
  });

  it('repairs damaged walls in radius', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'repairPost' });
    e.enqueue({ tick: 0, type: 'placeWall', cell: e.grid.idx(11, 5), kind: 'wall' });
    e.enqueue({ tick: 0, type: 'placeWall', cell: e.grid.idx(1, 5), kind: 'wall' });
    e.run(1);
    const near = e.grid.walls.get(e.grid.idx(11, 5))!;
    const far = e.grid.walls.get(e.grid.idx(1, 5))!;
    near.hp = 50;
    far.hp = 50;
    e.run(20);
    expect(near.hp).toBeCloseTo(60, 5);
    expect(far.hp).toBe(50);
  });

  it('wrecked structures neither heal nor get healed', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'repairPost' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(12, 5), kind: 'm2nest' });
    e.run(1);
    const post = e.structures.find((s) => s.origin === e.grid.idx(10, 5))!;
    const nest = e.structures.find((s) => s.origin === e.grid.idx(12, 5))!;

    nest.inert = true;
    nest.hp = 100;
    e.run(20);
    expect(nest.hp).toBe(100); // wrecks stay wrecked until repaired with Supplies

    nest.inert = false;
    post.inert = true;
    e.run(20);
    expect(nest.hp).toBe(100); // a wrecked engineer post repairs nothing
  });
});

describe('medic healing', () => {
  it('heals a nearby attacker, never itself, and caps at max', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: e.grid.idx(0, 5), kind: 'medic' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: e.grid.idx(0, 6), kind: 'walker' });
    e.run(1);
    const medic = e.attackers.find((a) => a.profile.kind === 'medic')!;
    const walker = e.attackers.find((a) => a.profile.kind === 'walker')!;
    medic.hp = 30;
    walker.hp = 20;
    e.run(20); // 1 second at 20 hp/s; both move at speed 2, staying adjacent
    expect(walker.hp).toBeGreaterThanOrEqual(39); // healed ~+20, capped at 40
    expect(walker.hp).toBeLessThanOrEqual(walker.maxHp);
    expect(medic.hp).toBe(30); // nobody heals the medic
  });
});

describe('aura determinism', () => {
  it('same seed and commands with auras in play → identical state hash', () => {
    const run = (): string => {
      const e = makeEngine(1234);
      e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'repairPost' });
      e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(12, 5), kind: 'm2nest' });
      e.enqueue({ tick: 2, type: 'spawnAttacker', cell: e.grid.idx(0, 5), kind: 'medic' });
      e.enqueue({ tick: 2, type: 'spawnAttacker', cell: e.grid.idx(0, 6), kind: 'shooter' });
      e.enqueue({ tick: 4, type: 'spawnAttacker', cell: e.grid.idx(0, 4), kind: 'breacher' });
      e.run(600);
      return `${e.stateHash()}`;
    };
    expect(run()).toBe(run());
  });
});
