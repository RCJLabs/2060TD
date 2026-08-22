import { DAMAGE_MULT } from '../src/content/damage';
import { USA_POWERS, USA_STRUCTURES, USA_WALLS } from '../src/content/usa';
import { Engine } from '../src/sim/engine';
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
};

export const TEST_CATALOG: Catalog = {
  attackers: TEST_ATTACKERS,
  structures: USA_STRUCTURES,
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
