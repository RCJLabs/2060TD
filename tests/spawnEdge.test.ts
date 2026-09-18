import { describe, expect, it } from 'vitest';
import { M1_CATALOG } from '../src/content/catalog';
import { Engine } from '../src/sim/engine';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { generateTerrain, TERRAIN_VERSION } from '../src/sim/terrain';
import type { SiegeDef, SimConfig } from '../src/sim/types';

/**
 * Which edge the attack comes from (v1.40).
 *
 * The world turned portrait so a phone could render a cell big enough to read,
 * and a portrait world wants its long axis to be the axis of the fight — so
 * attackers walk DOWN the board instead of across it. The edge is a config
 * field rather than a rewrite because two things must stay true at once: a
 * battle recorded before this release re-fights exactly as recorded, and a
 * battle that names the north edge is genuinely fought from the north.
 */

const W = 24;
const H = 20;
const idx = (x: number, y: number): number => y * W + x;

/** Three units in at the same moment, spread along whichever edge is in play. */
const siegeAlong = (positions: number[]): SiegeDef => ({
  name: 'EDGE',
  startingSupplies: 200,
  suppliesPerWave: 0,
  startingCp: 20,
  cpCap: 100,
  cpPerSecond: 1,
  prepSeconds: 0,
  repairCostPerHp: 0.04,
  waves: [{ entries: positions.map((p) => ({ atTick: 0, kind: 'rifle', row: p })) }],
});

/** The same wave, authored along a north edge: the free coordinate is the column. */
const siegeAcross = (positions: number[]): SiegeDef => ({
  ...siegeAlong(positions),
  waves: [{ entries: positions.map((p) => ({ atTick: 0, kind: 'rifle', col: p })) }],
});

function run(siege: SiegeDef, overrides: Partial<SimConfig> = {}): Engine {
  const config: SimConfig = {
    width: W,
    height: H,
    seed: 7,
    ccOrigin: idx(18, 9),
    spawnLane: 0,
    siege,
    ...overrides,
  };
  const engine = new Engine(config, M1_CATALOG);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  // `prepSeconds: 0`, so this is out of setup, through prep and a tick or two
  // into combat: long enough to spawn, short enough that nobody has walked off
  // the cell they arrived on.
  engine.run(3);
  return engine;
}

describe('the entry edge', () => {
  it('puts a west entry on the spawn column, as it always has', () => {
    const e = run(siegeAlong([3, 9, 15]));
    const cells = e.attackers.map((a) => e.grid.cellAt(a.pos));
    expect(cells.length).toBe(3);
    expect(cells.map((c) => e.grid.xOf(c))).toEqual([0, 0, 0]);
    expect(cells.map((c) => e.grid.yOf(c)).sort((a, b) => a - b)).toEqual([3, 9, 15]);
  });

  it('and an absent edge means west — an archived battle is not rotated', () => {
    const west = run(siegeAlong([3, 9, 15]), { spawnEdge: 'west' });
    const absent = run(siegeAlong([3, 9, 15]));
    // Paired with a liveness check on purpose: two empty boards also agree.
    expect(absent.attackers.length).toBe(3);
    expect(absent.stateHash()).toBe(west.stateHash());
  });

  it('puts a north entry on the spawn row, along the top', () => {
    const e = run(siegeAcross([3, 9, 15]), { spawnEdge: 'north' });
    const cells = e.attackers.map((a) => e.grid.cellAt(a.pos));
    expect(cells.length).toBe(3);
    expect(cells.map((c) => e.grid.yOf(c))).toEqual([0, 0, 0]);
    expect(cells.map((c) => e.grid.xOf(c)).sort((a, b) => a - b)).toEqual([3, 9, 15]);
  });

  it('honours a lane that is not the outermost line', () => {
    const e = run(siegeAcross([5]), { spawnEdge: 'north', spawnLane: 2 });
    const cell = e.grid.cellAt(e.attackers[0]!.pos);
    expect([e.grid.xOf(cell), e.grid.yOf(cell)]).toEqual([5, 2]);
  });

  it('and a raid that names its own cell is not touched by the edge at all', () => {
    // Explicit (col,row) is how raids pick an entry sector and how an
    // infiltration tunnel opens inside the map. Neither asks the config.
    const both: SiegeDef = {
      ...siegeAlong([0]),
      waves: [{ entries: [{ atTick: 0, kind: 'rifle', col: 11, row: 6 }] }],
    };
    for (const edge of ['west', 'north'] as const) {
      const e = run(both, { spawnEdge: edge });
      const cell = e.grid.cellAt(e.attackers[0]!.pos);
      expect([e.grid.xOf(cell), e.grid.yOf(cell)]).toEqual([11, 6]);
    }
  });
});

describe('the build ban follows the edge', () => {
  it('bans the column on a west board and leaves the top row alone', () => {
    const e = run(siegeAlong([9]));
    expect(e.isBuildable(idx(0, 5))).toBe(false);
    expect(e.isBuildable(idx(5, 0))).toBe(true);
  });

  it('and bans the row on a north board', () => {
    const e = run(siegeAcross([9]), { spawnEdge: 'north' });
    expect(e.isBuildable(idx(5, 0))).toBe(false);
    expect(e.isBuildable(idx(0, 5))).toBe(true);
  });
});

describe('terrain keeps the entry lane dry', () => {
  // A failed spawn returns before the engine's speed-jitter draw, so one unit
  // stranded in a river shifts every later roll and changes the whole battle.
  // The corridor is a correctness property, not a courtesy.
  const seeds = [1, 2, 3, 7, 11, 19, 23, 101];

  it('down the west column', () => {
    for (const seed of seeds) {
      const t = generateTerrain(seed, TERRAIN_VERSION, W, H, [], 0, 'west');
      for (let y = 0; y < H; y++) expect(t.passable(idx(0, y))).toBe(true);
    }
  });

  it('and across the north row', () => {
    for (const seed of seeds) {
      const t = generateTerrain(seed, TERRAIN_VERSION, W, H, [], 0, 'north');
      for (let x = 0; x < W; x++) expect(t.passable(idx(x, 0))).toBe(true);
    }
  });

  it('and the two are genuinely different sheets, not the same one twice', () => {
    // Without this the pair above passes on a generator that ignores the edge
    // and simply never floods row 0 — which is most of them, most of the time.
    const west = generateTerrain(5, TERRAIN_VERSION, W, H, [], 0, 'west');
    const north = generateTerrain(5, TERRAIN_VERSION, W, H, [], 0, 'north');
    const cells = Array.from({ length: W * H }, (_, c) => c);
    expect(cells.some((c) => west.passable(c) !== north.passable(c))).toBe(true);
  });
});


// ---- the archive ----------------------------------------------------------

/**
 * A replay code written by v1.39, before the entry edge existed.
 *
 * Verified byte-for-byte against a v1.39 build rather than regenerated here:
 * the same battle encoded by both releases produces this identical string,
 * which is what "a record does not change" has to mean. It is frozen because
 * the vault drops any entry that stops decoding — a format slip would quietly
 * empty every player's archive rather than fail loudly.
 *
 * The battle is written out in full below rather than borrowed from shipping
 * content. The first draft of this fixture used HOLD_THE_LINE and broke the
 * same day, when the campaign's entry lanes were re-authored for the portrait
 * board: a true change to the CONTENT, failing a test that exists to watch the
 * FORMAT. A fixture has to hold still on its own.
 */
const V139_CODE =
  'AQAAAQZGUk9aRU4HAmNjBm0ybmVzdAR3YWxsB21pbGl0aWEGc2FwcGVyBXJpZmxlA3piZCAYkiH7AgIAAAABAgD7' +
  'AgL_AAHUAgH_AAECAs8CIAEGRlJPWkVOkANQHnjcCxQoAgIDAgAGAAAA6AcoDAAAAOgHBAFQEgAAAOgHAgUBAAkA' +
  'AADoBwYBPAwAAgDoBwAAAAABYwAAAQABkM4';

const frozenConfig = (): SimConfig => ({
  width: 32,
  height: 24,
  seed: 4242,
  ccOrigin: 11 * 32 + 27,
  ccLevel: 2,
  spawnLane: 0,
  terrainVersion: 1,
  terrainSeed: 99,
  combatVersion: 1,
  objective: 'guns',
  siege: {
    name: 'FROZEN',
    startingSupplies: 400,
    suppliesPerWave: 80,
    startingCp: 30,
    cpCap: 120,
    cpPerSecond: 1.5,
    prepSeconds: 20,
    repairCostPerHp: 0.04,
    waves: [
      {
        entries: [
          { atTick: 0, kind: 'militia', row: 6 },
          { atTick: 40, kind: 'militia', row: 12 },
          { atTick: 80, kind: 'sapper', row: 18 },
        ],
      },
      {
        entries: [
          { atTick: 0, kind: 'rifle', row: 9 },
          { atTick: 60, kind: 'zbd', row: 12, doctrine: 'raze' },
        ],
      },
    ],
  },
  layout: {
    structures: [
      { cell: 11 * 32 + 27, kind: 'cc', level: 2 },
      { cell: 10 * 32 + 20, kind: 'm2nest', level: 1 },
    ],
    walls: [
      { cell: 10 * 32 + 15, kind: 'wall' },
      { cell: 11 * 32 + 15, kind: 'wall' },
    ],
  },
});

describe('replay codes across the change', () => {
  it('still writes a west battle exactly as v1.39 wrote it', () => {
    const code = encodeReplay({
      kind: 'raid',
      faction: 'usa',
      title: 'FROZEN',
      won: true,
      config: frozenConfig(),
    });
    expect(code).toBe(V139_CODE);
  });

  it('and reads the archived code back as the battle it recorded', () => {
    const out = decodeReplay(V139_CODE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replay.config.spawnEdge).toBeUndefined();
    expect(out.replay.config.spawnLane).toBe(0);
    // Liveness: a code that decoded to an empty battle would satisfy the two
    // assertions above just as well.
    expect(out.replay.config.terrainSeed).toBe(99);
    expect(out.replay.config.layout?.structures.length).toBe(2);
    expect(out.replay.config.siege?.waves.length).toBe(2);
    expect(out.replay.config.siege?.waves[0]!.entries.length).toBe(3);
  });

  it('round-trips a north battle, and says so in more bytes than a west one', () => {
    const west = frozenConfig();
    const north: SimConfig = { ...west, spawnEdge: 'north' };
    const encode = (config: SimConfig): string =>
      encodeReplay({ kind: 'raid', faction: 'usa', title: 'FROZEN', won: true, config });
    const code = encode(north);
    expect(code.length).toBeGreaterThan(encode(west).length);
    const out = decodeReplay(code);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.replay.config.spawnEdge).toBe('north');
  });
});
