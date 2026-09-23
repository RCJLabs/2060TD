import { describe, expect, it } from 'vitest';
import { footprintOfKind, M1_CATALOG, RAID_CATALOG } from '../src/content/catalog';
import { defenseCatalogFor, FACTION_IDS } from '../src/content/factions';
import {
  place,
  placeWall,
  siegeConfig,
  tick,
  unlockAll,
  upgrade,
  TOWN_GRID,
} from '../src/meta/town';
import { Engine } from '../src/sim/engine';
import { CHAIN_MODELS } from '../src/sim/killchain';
import {
  cellSizeOf,
  DISTANCE_FIELDS,
  scaleCatalog,
  scaleChain,
  scaleFootprint,
} from '../src/sim/scale';
import type { Catalog } from '../src/sim/types';
import { makeSandbox, spawnCell, TEST_CATALOG, yardTown } from './helpers';

const CATALOGS: Record<string, Catalog> = {
  m1: M1_CATALOG,
  raid: RAID_CATALOG,
  test: TEST_CATALOG,
  ...Object.fromEntries(FACTION_IDS.map((f) => [`defense:${f}`, defenseCatalogFor(f)])),
};

/**
 * Every numeric field in a catalog that is NOT a distance, by name.
 *
 * With `DISTANCE_FIELDS` this is a complete classification: the walk below
 * fails on any numeric field in neither list. That is deliberate friction. A
 * new radius added to a profile without being declared would reach twice as
 * far on the half-size board, the tables would drift, and nothing would say
 * why.
 */
const NOT_DISTANCE = new Set([
  'maxHp', 'wallDps', 'hqDps', 'cpValue', 'speedJitter', // attacker
  'damage', 'shotsPerSecond', 'flightSeconds', // weapon
  'perSecond', 'healPerSecond', // heal, aura — rates
  'supplyCost', 'cpCost', 'hp', 'gateCpCost', // economy, walls
  'cooldownSeconds', 'delayTicks', 'pulses', 'pulseSpacingTicks', 'pulseDamage', // strafe
  'shells', 'shellSpacingTicks', 'shellDamage', // barrage
]);

/** Where a numeric leaf lives, in the terms `DISTANCE_FIELDS` is keyed by. */
function contextOf(path: string[], root: Catalog): keyof typeof DISTANCE_FIELDS | null {
  if (path.includes('weapon')) return 'weapon';
  if (path.includes('heal')) return 'heal';
  if (path.includes('trigger')) return 'trigger';
  if (path.includes('aura')) return 'aura';
  if (path[0] === 'attackers' && path.length === 3) return 'attacker';
  if (path[0] === 'powers') {
    const power = root.powers[path[1]!];
    return power?.type === 'strafe' ? 'strafe' : 'barrage';
  }
  return null;
}

type Leaf = { path: string[]; before: number; after: number };
function leaves(before: unknown, after: unknown, path: string[] = [], out: Leaf[] = []): Leaf[] {
  if (typeof before === 'number') {
    out.push({ path, before, after: after as number });
  } else if (before && typeof before === 'object') {
    for (const key of Object.keys(before)) {
      leaves(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        [...path, key],
        out,
      );
    }
  }
  return out;
}

describe('cell size (M34)', () => {
  it('at 1 the catalog is the catalog — the same object, not an equal copy', () => {
    for (const [name, catalog] of Object.entries(CATALOGS)) {
      expect(scaleCatalog(catalog, 1), name).toBe(catalog);
    }
    for (const model of Object.values(CHAIN_MODELS)) expect(scaleChain(model, 1)).toBe(model);
  });

  it('a cell size that is not a positive number is treated as 1', () => {
    for (const junk of [undefined, 0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(cellSizeOf(junk)).toBe(1);
      expect(scaleCatalog(M1_CATALOG, junk as number)).toBe(M1_CATALOG);
    }
  });

  it('at 2 every distance halves and nothing else moves, in every catalog', () => {
    const unclassified = new Set<string>();
    for (const [name, catalog] of Object.entries(CATALOGS)) {
      const scaled = scaleCatalog(catalog, 2);
      // The damage table is multipliers against armour, not a place.
      for (const { path, before, after } of leaves({ ...catalog, damage: {} }, { ...scaled, damage: {} })) {
        const key = path[path.length - 1]!;
        const at = `${name}:${path.join('.')}`;
        const context = contextOf(path, catalog);
        const distances: readonly string[] = context ? DISTANCE_FIELDS[context] : [];
        if (key === 'footprint') {
          expect(after, at).toBe(scaleFootprint(before as 1 | 2, 2));
        } else if (distances.includes(key)) {
          expect(after, at).toBeCloseTo(before / 2, 10);
        } else if (NOT_DISTANCE.has(key)) {
          expect(after, at).toBe(before);
        } else {
          unclassified.add(`${context ?? 'root'}.${key} (e.g. ${at})`);
        }
      }
    }
    expect([...unclassified], 'numeric fields in no list — declare them').toEqual([]);
  });

  it('upgrade levels are scaled in their own right, not inherited from the base', () => {
    // `resolveProfile` merges a level SHALLOWLY, so a level's weapon replaces
    // the base weapon outright. An unscaled override would put an upgraded gun
    // back at its big-board reach the moment it levelled.
    const withLevels = Object.entries(M1_CATALOG.structures).filter(
      ([, s]) => s.levels?.some((l) => l.weapon),
    );
    expect(withLevels.length).toBeGreaterThan(0);
    const engine = new Engine({ ...sandboxConfig(), cellSize: 2 }, M1_CATALOG);
    for (const [kind, base] of withLevels) {
      for (let level = 2; level <= (base.levels?.length ?? 0) + 1; level++) {
        const raw = base.levels![level - 2]!.weapon ?? base.weapon;
        if (!raw) continue;
        expect(engine.resolveProfile(kind, level)!.weapon!.range, `${kind} L${level}`).toBeCloseTo(
          raw.range / 2,
          10,
        );
      }
    }
  });

  it('a 2x2 is exactly one cell on the half-size board, and a 1x1 stays one', () => {
    expect(scaleFootprint(2, 2)).toBe(1);
    expect(scaleFootprint(1, 2)).toBe(1);
    expect(scaleFootprint(2, 1)).toBe(2);
    expect(new Engine(sandboxConfig(), TEST_CATALOG).cc.cells).toHaveLength(4);
    expect(new Engine({ ...sandboxConfig(), cellSize: 2 }, TEST_CATALOG).cc.cells).toHaveLength(1);
  });

  it('the kill chain covers half as many cells, which is the same ground', () => {
    for (const model of Object.values(CHAIN_MODELS)) {
      expect(scaleChain(model, 2).coverRadius).toBe(model.coverRadius / 2);
      expect(scaleChain(model, 2).burnSeconds).toBe(model.burnSeconds);
    }
  });

  it('a unit covers the same GROUND in the same time — the claim the milestone rests on', () => {
    // Same seed, same walker, 60 ticks of open ground. On the half-size board
    // it moves half as many cells, which is the same physical distance: time
    // is what the transform preserves, so waves, prep and a battle's length are
    // untouched by it.
    const walked = (cellSize: number, height: number): number => {
      const e = makeSandbox(7, { cellSize, height, width: 20, ccOrigin: 1 * 20 + 18 });
      e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, height - 2), kind: 'walker' });
      e.run(1);
      const start = { ...e.attackers[0]!.pos };
      e.run(60);
      const end = e.attackers[0]!.pos;
      return Math.hypot(end.x - start.x, end.y - start.y) * cellSize;
    };
    const big = walked(1, 11);
    const small = walked(2, 11);
    // Liveness: it actually walked. A zero on both sides would agree perfectly.
    expect(big).toBeGreaterThan(3);
    expect(small).toBeCloseTo(big, 6);
  });

  it('at 1, set or absent, a real siege is the same battle at every checkpoint', () => {
    // A town that fights back. The bare yard has no guns, so its post fell by
    // tick ~1500 and every checkpoint after that compared two dead battles —
    // agreement bought by nothing happening, which the liveness check below
    // caught on the first run.
    const T = 1_800_000_000_000;
    const town = unlockAll(yardTown(T - 1_000_000));
    town.supplies = 50_000;
    town.fuel = 50_000;
    upgrade(town, 1, T - 900_000);
    tick(town, T - 800_000);
    const at = (u: number, v: number) => u * TOWN_GRID.width + v;
    place(town, 'm2nest', at(21, 7), T - 700_000);
    place(town, 'm2nest', at(21, 11), T - 700_000);
    place(town, 'autocannon', at(21, 9), T - 700_000);
    place(town, 'mortar', at(24, 9), T - 700_000);
    for (let v = 1; v <= 7; v++) placeWall(town, at(19, v));
    for (let v = 12; v <= 18; v++) placeWall(town, at(19, v));
    tick(town, T);
    town.assaultLevel = 4;
    const config = siegeConfig(town, 4242);
    const catalog = defenseCatalogFor('usa');
    const absent = new Engine(config, catalog);
    const explicit = new Engine({ ...config, cellSize: 1 }, catalog);
    for (const e of [absent, explicit]) e.enqueue({ tick: 0, type: 'startAssault' });
    for (let checkpoint = 0; checkpoint < 8; checkpoint++) {
      absent.run(400);
      explicit.run(400);
      expect(explicit.stateHash(), `checkpoint ${checkpoint}`).toBe(absent.stateHash());
    }
    // A hash that agrees because nothing happened is not a passing test: the
    // defence has to have engaged, and the battle has to have been running
    // for the checkpoints that compared it.
    expect(absent.stats.spawned).toBeGreaterThan(20);
    expect(absent.stats.kills).toBeGreaterThan(10);
    expect(absent.tick).toBeGreaterThan(3000);
  });
});

describe('the board sizes a thing the way the battle will (M34)', () => {
  it('draws a 2x2 building as one cell on a board of cell size 2, and as it is written at 1', () => {
    expect(footprintOfKind('supplyDepot')).toBe(2);
    expect(footprintOfKind('supplyDepot', 1)).toBe(2);
    expect(footprintOfKind('supplyDepot', 2)).toBe(1);
    // A one-cell gun cannot shrink, on any board.
    expect(footprintOfKind('m2nest', 2)).toBe(1);
    // And the board's answer IS the engine's: the scaled catalog says the same.
    const scaled = scaleCatalog(M1_CATALOG, 2);
    for (const [kind, profile] of Object.entries(scaled.structures)) {
      expect(footprintOfKind(kind, 2), kind).toBe(profile.footprint);
    }
  });
});

function sandboxConfig() {
  return { width: 20, height: 11, seed: 42, ccOrigin: 4 * 20 + 17, spawnLane: 0 };
}
