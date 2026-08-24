import { ECONOMY_STRUCTURES } from '../src/content/buildings';
import { DAMAGE_MULT } from '../src/content/damage';
import { USA_POWERS, USA_STRUCTURES, USA_WALLS } from '../src/content/usa';
import { Engine } from '../src/sim/engine';
import { newTown, type TownState } from '../src/meta/town';
import type { FactionId } from '../src/content/factions';
import type { AttackerProfile, Catalog, SimConfig } from '../src/sim/types';

/**
 * Controlled attacker profiles for engine tests: zero jitter so travel times
 * are exact, plus degenerate cases (sealed: cannot break anything).
 * Structures/walls/powers come from the real USA content — tests that depend
 * on their numbers assert behavior with generous windows, not exact ticks.
 */
export const TEST_ATTACKERS: Record<string, AttackerProfile> = {
  walker: {
    kind: 'walker',
    name: 'Walker',
    maxHp: 40,
    speed: 2,
    armor: 'none',
    wallDps: 3,
    hqDps: 10,
    cpValue: 2,
    speedJitter: 0,
  },
  breacher: {
    kind: 'breacher',
    name: 'Breacher',
    maxHp: 200,
    speed: 1.6,
    armor: 'none',
    wallDps: 60,
    hqDps: 10,
    cpValue: 4,
    speedJitter: 0,
  },
  sealed: {
    kind: 'sealed',
    name: 'Sealed',
    maxHp: 40,
    speed: 2,
    armor: 'none',
    wallDps: 0,
    hqDps: 10,
    cpValue: 1,
    speedJitter: 0,
  },
  shooter: {
    kind: 'shooter',
    name: 'Shooter',
    maxHp: 500,
    speed: 2,
    armor: 'none',
    wallDps: 4,
    hqDps: 10,
    cpValue: 5,
    weapon: { damageType: 'explosive', damage: 20, shotsPerSecond: 1, range: 3.5 },
    speedJitter: 0,
  },
  tank: {
    kind: 'tank',
    name: 'Tank',
    maxHp: 550,
    speed: 1.2,
    armor: 'heavy',
    wallDps: 30,
    hqDps: 25,
    cpValue: 15,
    speedJitter: 0,
  },
  gunTank: {
    kind: 'gunTank',
    name: 'Gun Tank',
    maxHp: 550,
    speed: 1.6,
    armor: 'heavy',
    wallDps: 30,
    hqDps: 25,
    cpValue: 15,
    weapon: { damageType: 'explosive', damage: 60, shotsPerSecond: 0.5, range: 4.0 },
    speedJitter: 0,
  },
  // v1.0 air-layer fixtures: a flyer with no weapon (pure closer) and one
  // that stands off. Both ignore the grid by profile.
  flyer: {
    kind: 'flyer',
    name: 'Flyer',
    maxHp: 120,
    speed: 2,
    armor: 'air',
    wallDps: 0,
    hqDps: 20,
    cpValue: 8,
    air: true,
    speedJitter: 0,
  },
  gunFlyer: {
    kind: 'gunFlyer',
    name: 'Gun Flyer',
    maxHp: 120,
    speed: 2,
    armor: 'air',
    wallDps: 0,
    hqDps: 20,
    cpValue: 8,
    air: true,
    weapon: { damageType: 'explosive', damage: 30, shotsPerSecond: 1, range: 3.5 },
    speedJitter: 0,
  },
  bruiser: {
    kind: 'bruiser',
    name: 'Bruiser',
    maxHp: 500,
    speed: 2.5,
    armor: 'none',
    wallDps: 30,
    hqDps: 100,
    cpValue: 5,
    speedJitter: 0,
  },
};

export const TEST_CATALOG: Catalog = {
  attackers: TEST_ATTACKERS,
  structures: { ...USA_STRUCTURES, ...ECONOMY_STRUCTURES },
  walls: USA_WALLS,
  powers: USA_POWERS,
  damage: DAMAGE_MULT,
};

/**
 * 20×11 sandbox field. Command Center footprint at (17,4)-(18,5); its
 * assault perimeter is x=16/19 and y=3/6 around it. Attackers spawn in
 * column 0.
 */
export function makeSandbox(seed = 42, overrides: Partial<SimConfig> = {}): Engine {
  const width = 20;
  const config: SimConfig = {
    width,
    height: 11,
    seed,
    ccOrigin: 4 * width + 17,
    spawnColumn: 0,
    ...overrides,
  };
  return new Engine(config, TEST_CATALOG);
}

export const spawnCell = (e: Engine, y: number) => e.grid.idx(0, y);

/** Full-height wall line at x, optionally leaving a gap at gapY. */
export function wallLine(e: Engine, tick: number, x: number, gapY: number | null): void {
  for (let y = 0; y < e.grid.height; y++) {
    if (y === gapY) continue;
    e.enqueue({ tick, type: 'placeWall', cell: e.grid.idx(x, y), kind: 'wall' });
  }
}

/**
 * A terrain seed whose ground is clear of the yard — every cell in
 * x 1..24, y 2..18 is dry, while the rest of the board still has water on it.
 *
 * Terrain arrived in v1.19, and most suites are about the economy, the yard
 * and the codecs rather than about where the river runs. They place buildings
 * at fixed coordinates and assert on RELATIVE positions — this footprint
 * overlaps that one, this move is blocked — so a river through the middle
 * would break them for reasons that have nothing to do with what they test.
 *
 * Pinning the seed keeps those assertions meaningful. `terrain.test.ts` holds
 * the guarantee: if a future generator stops honouring it, one clearly-named
 * test fails saying so, instead of fourteen confusing ones elsewhere.
 */
export const CLEAR_YARD_SEED = 2;

/** The rectangle CLEAR_YARD_SEED promises to keep dry. */
export const CLEAR_YARD = { x0: 1, y0: 2, x1: 24, y1: 18 };

/** A town on ground that leaves the yard clear. */
export function yardTown(now: number, faction?: FactionId): TownState {
  const town = newTown(now, faction);
  town.terrainSeed = CLEAR_YARD_SEED;
  return town;
}
