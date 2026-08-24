import { describe, expect, it } from 'vitest';
import { DT, Engine, TICKS_PER_SECOND } from '../src/sim/engine';
import type { Catalog, SimConfig } from '../src/sim/types';
import { makeSandbox, spawnCell, TEST_CATALOG } from './helpers';
import {
  FLAT_TERRAIN,
  Ground,
  MIN_MOVE_COST,
  TERRAIN_NONE,
  TERRAIN_VERSION,
  WOOD_COVER,
  generateTerrain,
  type TerrainField,
} from '../src/sim/terrain';

const W = 32;
const H = 24;
const SPAWN = 0;

const field = (seed: number, occupied: number[] = []): TerrainField =>
  generateTerrain(seed, TERRAIN_VERSION, W, H, occupied, SPAWN);

/** Every cell of a field, as a comparable string. */
const fingerprint = (t: TerrainField): string => {
  const parts: string[] = [];
  for (let c = 0; c < W * H; c++) parts.push(String(t.groundAt(c)), String(t.band(c)));
  return parts.join(',');
};

const cells = (predicate: (c: number) => boolean): number[] => {
  const out: number[] = [];
  for (let c = 0; c < W * H; c++) if (predicate(c)) out.push(c);
  return out;
};

describe('terrain determinism', () => {
  it('the same seed and version yield an identical field', () => {
    expect(fingerprint(field(2060))).toEqual(fingerprint(field(2060)));
  });

  it('a different seed yields a different field', () => {
    // Guards against a generator that ignores its seed — the failure mode a
    // pure equality test cannot see.
    expect(fingerprint(field(2060))).not.toEqual(fingerprint(field(7)));
  });

  it('version 0 is flat ground with no effects', () => {
    const flat = generateTerrain(2060, TERRAIN_NONE, W, H, [], SPAWN);
    expect(flat).toBe(FLAT_TERRAIN);
    expect(flat.moveCost(0)).toBe(1);
    expect(flat.cover(0)).toBe(1);
    expect(flat.band(0)).toBe(0);
    expect(flat.passable(0)).toBe(true);
  });

  it('puts every ground kind on the board, on every seed', () => {
    // A weaker version of this test passed while `steep` was never generated
    // once — the thresholds were in metres and the real gradient between
    // adjacent cells is a third of what they assumed. Counting each kind is
    // what catches a mechanic that silently stops existing.
    const floors: Record<number, number> = {
      [Ground.Open]: 200,
      [Ground.Rough]: 20,
      [Ground.Steep]: 4,
      [Ground.Wood]: 20,
      [Ground.Road]: 20,
      [Ground.Water]: 8,
    };
    for (let i = 0; i < 24; i++) {
      const t = field((i * 104729 + 7) >>> 0);
      for (const [kind, floor] of Object.entries(floors)) {
        const n = cells((c) => t.groundAt(c) === Number(kind)).length;
        expect(n, `ground kind ${kind} on seed index ${i}`).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('leaves most of the board open, so the maze rule still decides raids', () => {
    for (let i = 0; i < 24; i++) {
      const t = field((i * 104729 + 7) >>> 0);
      const open = cells((c) => t.groundAt(c) === Ground.Open).length;
      expect(open / (W * H)).toBeGreaterThan(0.4);
    }
  });
});

describe('terrain effects', () => {
  it('the road is the cheapest ground and water is impassable', () => {
    const t = field(2060);
    for (let c = 0; c < W * H; c++) {
      const cost = t.moveCost(c);
      if (t.groundAt(c) === Ground.Water) {
        expect(cost).toBe(Infinity);
        expect(t.passable(c)).toBe(false);
      } else {
        expect(cost).toBeGreaterThanOrEqual(MIN_MOVE_COST);
        expect(cost).toBeLessThanOrEqual(2);
        expect(t.passable(c)).toBe(true);
      }
      if (t.groundAt(c) === Ground.Road) expect(cost).toBe(MIN_MOVE_COST);
    }
  });

  it('woodland is the only ground that gives cover', () => {
    const t = field(2060);
    for (let c = 0; c < W * H; c++) {
      expect(t.cover(c)).toBe(t.groundAt(c) === Ground.Wood ? WOOD_COVER : 1);
    }
  });

  it('elevation bands run 0 to 3 and use their whole range', () => {
    const t = field(2060);
    const bands = new Set<number>();
    for (let c = 0; c < W * H; c++) {
      const b = t.band(c);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(3);
      bands.add(b);
    }
    expect(bands.size).toBe(4);
  });
});

describe('terrain invariants', () => {
  // Each of these is a way to silently corrupt a battle, so each is checked
  // across many seeds rather than one lucky map.
  const SEEDS = Array.from({ length: 40 }, (_, i) => (i * 7919 + 12345) >>> 0);

  it('never floods the spawn column or its neighbour', () => {
    // A failed spawn returns before the engine's speed-jitter draw, so one
    // stranded unit shifts every later roll and changes the whole battle.
    for (const seed of SEEDS) {
      const t = field(seed);
      for (let y = 0; y < H; y++) {
        expect(t.passable(y * W + SPAWN)).toBe(true);
        expect(t.passable(y * W + SPAWN + 1)).toBe(true);
      }
    }
  });

  it('never puts water on an occupied cell or beside one', () => {
    const occupied = [5 * W + 14, 5 * W + 15, 6 * W + 14, 6 * W + 15, 12 * W + 20];
    for (const seed of SEEDS) {
      const t = field(seed, occupied);
      for (const cell of occupied) {
        expect(t.passable(cell)).toBe(true);
        const x = cell % W;
        const y = (cell / W) | 0;
        if (x > 0) expect(t.passable(cell - 1)).toBe(true);
        if (x < W - 1) expect(t.passable(cell + 1)).toBe(true);
        if (y > 0) expect(t.passable(cell - W)).toBe(true);
        if (y < H - 1) expect(t.passable(cell + W)).toBe(true);
      }
    }
  });

  it('leaves every dry cell reachable from the spawn edge', () => {
    // A river spanning the map would cut it in two, and an attacker with no
    // route goes 'stuck' rather than losing. The bridge normally provides
    // connectivity; the drain is the backstop.
    for (const seed of SEEDS) {
      const t = field(seed);
      const seen = new Set<number>();
      const queue: number[] = [];
      for (let y = 0; y < H; y++) {
        const c = y * W + SPAWN;
        if (t.passable(c)) {
          seen.add(c);
          queue.push(c);
        }
      }
      while (queue.length) {
        const c = queue.pop()!;
        const x = c % W;
        const y = (c / W) | 0;
        const push = (n: number): void => {
          if (!seen.has(n) && t.passable(n)) {
            seen.add(n);
            queue.push(n);
          }
        };
        if (x > 0) push(c - 1);
        if (x < W - 1) push(c + 1);
        if (y > 0) push(c - W);
        if (y < H - 1) push(c + W);
      }
      const dry = cells((c) => t.passable(c));
      expect(seen.size).toBe(dry.length);
    }
  });

  it('leaves every cell with at least one passable neighbour', () => {
    // A structure whose whole perimeter is water yields an empty goal list in
    // findPath, and the attacker sent to kill it goes 'stuck'.
    for (const seed of SEEDS) {
      const t = field(seed);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const c = y * W + x;
          if (!t.passable(c)) continue;
          const open =
            (x > 0 && t.passable(c - 1)) ||
            (x < W - 1 && t.passable(c + 1)) ||
            (y > 0 && t.passable(c - W)) ||
            (y < H - 1 && t.passable(c + W));
          expect(open).toBe(true);
        }
      }
    }
  });

  it('never drowns more than a fifth of the board', () => {
    for (const seed of SEEDS) {
      const t = field(seed);
      const water = cells((c) => !t.passable(c)).length;
      expect(water).toBeLessThan(W * H * 0.2);
    }
  });
});

describe('the integrator charges what the planner charged', () => {
  // A unit that MOVES on different terms than the planner ROUTED on will
  // drift off the path it was given: it arrives at a waypoint the planner
  // thought it could not afford, or stalls short of one it could. This is the
  // only invariant that catches that, and it does not need hand-placed
  // terrain — it measures the unit against the ground it actually crossed.
  const SANDBOX: SimConfig = {
    width: 32,
    height: 24,
    seed: 42,
    ccOrigin: 11 * 32 + 27,
    spawnColumn: 0,
    terrainSeed: 2060,
    terrainVersion: TERRAIN_VERSION,
  };

  it('spends exactly speed × DT of ground-weighted distance per tick', () => {
    const engine = new Engine(SANDBOX, TEST_CATALOG);
    engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: 11 * 32, kind: 'walker' });
    engine.step();
    const unit = engine.attackers[0]!;
    expect(unit).toBeDefined();

    let checked = 0;
    let varied = 0;
    for (let t = 0; t < 400; t++) {
      const before = { ...unit.pos };
      const stateBefore = unit.state;
      // The engine charges for the cell being ENTERED — the waypoint — not
      // the one the unit is standing in, so that is what the test must read.
      const target = unit.path?.[unit.pathIndex];
      const indexBefore = unit.pathIndex;
      engine.step();
      if (stateBefore !== 'moving' || unit.state !== 'moving') continue;
      // Only ticks spent entirely on one segment are comparable; a tick whose
      // budget carried across a waypoint crossed two different grounds.
      if (target === undefined || unit.pathIndex !== indexBefore) continue;
      const dx = unit.pos.x - before.x;
      const dy = unit.pos.y - before.y;
      const moved = Math.sqrt(dx * dx + dy * dy);
      if (moved === 0) continue;
      const ground = engine.terrain.moveCost(target);
      const spent = moved * ground;
      expect(spent).toBeCloseTo(unit.speed * DT, 6);
      checked++;
      if (ground !== 1) varied++;
    }
    // Both counters matter. Without the second this test passes with the
    // terrain charge deleted outright, because most of the board is ordinary
    // ground where the broken and correct versions agree exactly.
    expect(checked).toBeGreaterThan(50);
    expect(varied).toBeGreaterThan(10);
  });

  it('arrives when the route it was given said it would', () => {
    // The per-tick test above only exercises the branch where a unit runs out
    // of budget mid-segment. This one covers the whole journey, including the
    // ticks whose budget carries across a waypoint — and it is the property
    // that actually matters: the planner promised a travel time, and the
    // integrator has to deliver it.
    const engine = new Engine(SANDBOX, TEST_CATALOG);
    engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: 11 * 32, kind: 'walker' });
    engine.step();
    const unit = engine.attackers[0]!;
    engine.step(); // the first step is where the path is computed
    const route = [...(unit.path ?? [])];
    expect(route.length).toBeGreaterThan(20);

    const startTick = engine.tick;
    for (let t = 0; t < 3000 && unit.state === 'moving'; t++) engine.step();
    const travelled = engine.tick - startTick;

    // Seconds to walk the route: every cell entered, at its own ground cost.
    let seconds = 0;
    for (let i = 1; i < route.length; i++) seconds += engine.terrain.moveCost(route[i]!) / unit.speed;
    // Within a tick and a half — the unit begins mid-cell and the route it
    // finishes on is the goal cell it stops short of attacking.
    expect(travelled * DT).toBeCloseTo(seconds, 1);
  });

  it('charges the right ground when a whole cell fits inside one tick', () => {
    // At real unit speeds a tick covers a tenth of a cell, so the branch that
    // completes a segment and carries the remaining budget on is only ever a
    // boundary case — and a test using real units cannot tell whether it is
    // priced correctly. This one uses a courier fast enough to clear several
    // cells per tick, which is the only way to reach it.
    const FAST = 40; // cells/sec: two cells per tick
    const catalog: Catalog = {
      ...TEST_CATALOG,
      attackers: {
        ...TEST_CATALOG.attackers,
        courier: { ...TEST_CATALOG.attackers['walker']!, kind: 'courier', speed: FAST },
      },
    };
    const engine = new Engine(SANDBOX, catalog);
    engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: 11 * 32, kind: 'courier' });
    engine.step();
    const unit = engine.attackers[0]!;
    engine.step();
    const route = [...(unit.path ?? [])];
    expect(route.length).toBeGreaterThan(20);

    const startTick = engine.tick;
    for (let t = 0; t < 3000 && unit.state === 'moving'; t++) engine.step();
    const travelled = engine.tick - startTick;

    let seconds = 0;
    for (let i = 1; i < route.length; i++) seconds += engine.terrain.moveCost(route[i]!) / FAST;
    // Two ticks of slack: at this speed the whole crossing is under a second,
    // so the tolerance has to be tight enough to mean something.
    expect(travelled * DT).toBeCloseTo(seconds, 1);
    expect(travelled).toBeLessThan(route.length);
  });

  it('crosses cheap ground faster than expensive ground', () => {
    // The effect has to be visible in arrival time, not just in the maths.
    const walk = (terrainVersion: number): number => {
      const engine = new Engine({ ...SANDBOX, terrainVersion }, TEST_CATALOG);
      engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: 11 * 32, kind: 'walker' });
      engine.step();
      const unit = engine.attackers[0]!;
      for (let t = 0; t < 2000 && unit.state === 'moving'; t++) engine.step();
      return engine.tick;
    };
    const flat = walk(TERRAIN_NONE);
    const ground = walk(TERRAIN_VERSION);
    expect(ground).not.toBe(flat);
  });
});

describe('cover and elevation', () => {
  /** A field of one ground kind, swapped onto a built engine. */
  const uniform = (over: Partial<TerrainField>): TerrainField => ({
    ...FLAT_TERRAIN,
    version: TERRAIN_VERSION,
    ...over,
  });
  const withTerrain = (engine: Engine, over: Partial<TerrainField>): Engine => {
    Object.defineProperty(engine, 'terrain', { value: uniform(over), configurable: true });
    return engine;
  };

  it('canopy softens aimed fire', () => {
    // Uniform ground, so movement and targeting are identical in both runs
    // and the only thing that can differ is what the rounds did.
    const hurt = (cover: number): number => {
      const e = withTerrain(makeSandbox(11), { cover: () => cover });
      e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'm2nest' });
      e.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'breacher' });
      for (let t = 0; t < TICKS_PER_SECOND * 10; t++) e.step();
      const unit = e.attackers[0]!;
      return unit.maxHp - unit.hp;
    };
    const open = hurt(1);
    expect(open, 'the gun has to actually be hitting it').toBeGreaterThan(0);
    expect(hurt(WOOD_COVER)).toBeCloseTo(open * WOOD_COVER, 5);
  });

  it('canopy does nothing against a barrage', () => {
    // The asymmetry IS the mechanic: woodland is a trade against guns, and
    // artillery is the answer to it.
    const hurt = (cover: number): number => {
      const e = withTerrain(makeSandbox(11), { cover: () => cover });
      e.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'breacher' });
      // Let it walk up to the wire and stop. Shelling a moving target means
      // the scatter roll decides whether the test passes, and a barrage that
      // lands behind the man it was aimed at proves nothing either way.
      for (let t = 0; t < TICKS_PER_SECOND * 13; t++) e.step();
      const unit = e.attackers[0]!;
      const settled = unit.maxHp - unit.hp;
      e.enqueue({ tick: e.tick, type: 'castPower', kind: 'arty', target: { ...unit.pos } });
      for (let t = 0; t < TICKS_PER_SECOND * 8; t++) e.step();
      return unit.maxHp - unit.hp - settled;
    };
    const open = hurt(1);
    expect(open, 'the shells have to actually be landing on it').toBeGreaterThan(0);
    expect(hurt(WOOD_COVER)).toBe(open);
  });

  it('a gun on the crest opens fire sooner than the same gun in the valley', () => {
    // Reach is measured in when the shooting starts: a longer arm engages a
    // unit that is still further away, so first blood comes earlier.
    const firstHitTick = (band: number): number => {
      const e = withTerrain(makeSandbox(11), { band: () => band });
      e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(14, 5), kind: 'm2nest' });
      e.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'breacher' });
      for (let t = 0; t < TICKS_PER_SECOND * 20; t++) {
        e.step();
        const unit = e.attackers[0];
        if (unit && unit.hp < unit.maxHp) return e.tick;
      }
      return Infinity;
    };
    const valley = firstHitTick(0);
    const crest = firstHitTick(3);
    expect(valley).toBeLessThan(Infinity);
    expect(crest).toBeLessThan(valley);
  });

  it('leaves reach alone when there is no terrain', () => {
    const flat = makeSandbox(11);
    expect(flat.terrain).toBe(FLAT_TERRAIN);
  });
});
