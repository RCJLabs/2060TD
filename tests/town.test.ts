import { describe, expect, it } from 'vitest';
import { CHARGE_CAP } from '../src/content/buildings';
import { Engine } from '../src/sim/engine';
import { deserialize, serialize } from '../src/meta/save';
import {
  applySiegeResult,
  buyCharge,
  canPlace,
  caps,
  move,
  outcomeFromEngine,
  place,
  placeWall,
  ratesPerMinute,
  repairCost,
  repairWreck,
  sell,
  siegeConfig,
  structureAt,
  tick,
  townCc,
  unlockAll,
  upgrade,
  upgradeError,
  TOWN_GRID,
  type SiegeOutcome,
  type TownState,
} from '../src/meta/town';
import { TEST_CATALOG, yardTown } from './helpers';

const T0 = 1_700_000_000_000;
const minutes = (m: number) => m * 60_000;
const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

/** Dev town: everything unlocked (campaign locks tested separately), rich. */
const rich = (town: TownState): TownState => {
  town.supplies = 50_000;
  town.fuel = 50_000;
  return unlockAll(town);
};

/** A town with its CC already at the given level (paid and completed). */
function townAtCc(level: number): TownState {
  const town = rich(yardTown(T0));
  for (let l = 1; l < level; l++) {
    expect(upgrade(town, townCc(town).id, T0)).toBe(true);
    tick(town, T0 + minutes(60));
    rich(town);
    town.lastSeen = T0;
  }
  town.lastSeen = T0;
  return town;
}

describe('town state', () => {
  it('a new town has a Command Center and starting stock', () => {
    const town = yardTown(T0);
    expect(townCc(town).level).toBe(1);
    expect(town.supplies).toBeGreaterThan(0);
    expect(town.assaultLevel).toBe(1);
  });

  it('placing a depot costs resources and takes construction time', () => {
    const town = yardTown(T0);
    const before = town.supplies;
    expect(place(town, 'supplyDepot', idx(5, 5), T0)).toBe(true);
    expect(town.supplies).toBe(before - 150);
    expect(ratesPerMinute(town).supplies).toBe(0); // still scaffolding

    tick(town, T0 + 16_000); // 15s build time
    expect(ratesPerMinute(town).supplies).toBe(40); // online
  });

  it('enforces CC gating: counts, forbidden kinds, and footprint overlap', () => {
    const town = rich(yardTown(T0));
    expect(place(town, 'supplyDepot', idx(5, 5), T0)).toBe(true);
    expect(canPlace(town, 'supplyDepot', idx(6, 6))).toBe('occupied'); // overlaps
    expect(place(town, 'supplyDepot', idx(8, 5), T0)).toBe(true);
    expect(canPlace(town, 'supplyDepot', idx(8, 8))).toBe('count'); // CC1 allows 2
    expect(canPlace(town, 'mortar', idx(12, 12))).toBe('count'); // CC1 allows 0
    expect(canPlace(town, 'm2nest', idx(0, 5))).toBe('spawnColumn');
  });

  it('structure upgrades are locked until the CC levels up', () => {
    const town = townAtCc(1);
    place(town, 'supplyDepot', idx(5, 5), T0);
    tick(town, T0 + minutes(1));
    town.lastSeen = T0;
    const depot = structureAt(town, idx(5, 5))!;
    expect(upgradeError(town, depot)).toBe('max'); // CC1 caps everything at L1

    const cc2 = townAtCc(2);
    place(cc2, 'supplyDepot', idx(5, 5), T0);
    tick(cc2, T0 + minutes(1));
    const depot2 = structureAt(cc2, idx(5, 5))!;
    expect(upgradeError(cc2, depot2)).toBe(null);
    expect(upgrade(cc2, depot2.id, T0 + minutes(1))).toBe(true);
    tick(cc2, T0 + minutes(3));
    expect(depot2.level).toBe(2);
    expect(ratesPerMinute(cc2).supplies).toBe(70);
  });

  it('accrues offline generation, capped by storage and the 8h window', () => {
    const town = rich(yardTown(T0));
    place(town, 'supplyDepot', idx(5, 5), T0);
    town.supplies = 0;
    town.fuel = 0;
    tick(town, T0 + minutes(1)); // build completes, accrual starts from T0 baseline
    town.supplies = 0;
    town.lastSeen = T0 + minutes(1);

    tick(town, T0 + minutes(11)); // 10 minutes online
    expect(town.supplies).toBeCloseTo(400, 0); // 40/min × 10

    town.supplies = 0;
    town.lastSeen = T0;
    tick(town, T0 + minutes(60 * 48)); // two days away
    // 8h cap × 40/min = 19200, but CC1 storage caps at 800.
    expect(town.supplies).toBe(caps(town).supplies);
  });

  it('the Engineering Bay shortens construction', () => {
    const town = townAtCc(2);
    place(town, 'engBay', idx(5, 5), T0);
    tick(town, T0 + minutes(2));
    town.lastSeen = T0;
    rich(town);

    place(town, 'm2nest', idx(10, 10), T0); // 10s base, −15%
    const nest = structureAt(town, idx(10, 10))!;
    expect(nest.buildEndsAt).toBe(T0 + 8500);
  });

  it('move respects occupancy; sell refunds half; wreck repair costs 30%', () => {
    const town = rich(yardTown(T0));
    place(town, 'supplyDepot', idx(5, 5), T0);
    place(town, 'm2nest', idx(10, 10), T0);
    const depot = structureAt(town, idx(5, 5))!;
    const nest = structureAt(town, idx(10, 10))!;

    expect(move(town, nest.id, idx(5, 6))).toBe(false); // inside the depot footprint
    expect(move(town, nest.id, idx(12, 12))).toBe(true);

    const before = town.supplies;
    expect(sell(town, nest.id)).toBe(true);
    expect(town.supplies).toBe(before + 30); // half of 60

    depot.wrecked = true;
    expect(ratesPerMinute(town).supplies).toBe(0);
    const cost = repairCost(town, depot);
    expect(cost.supplies).toBe(Math.ceil(150 * 0.3));
    expect(repairWreck(town, depot.id)).toBe(true);
    expect(depot.wrecked).toBe(false);
  });

  it('stocks power charges with Fuel, up to the cap', () => {
    const town = rich(yardTown(T0));
    town.charges = { a10: 0, arty: 0 };
    const fuelBefore = town.fuel;
    for (let i = 0; i < CHARGE_CAP + 2; i++) buyCharge(town, 'a10');
    expect(town.charges['a10']).toBe(CHARGE_CAP);
    expect(town.fuel).toBe(fuelBefore - 30 * CHARGE_CAP);
  });

  it('round-trips through the save format', () => {
    const town = rich(yardTown(T0));
    place(town, 'supplyDepot', idx(5, 5), T0);
    placeWall(town, idx(9, 9));
    const restored = deserialize(serialize(town));
    expect(restored).toEqual(town);
    expect(deserialize('{"schema":99}')).toBeNull();
    expect(deserialize('not json')).toBeNull();
  });
});

describe('the siege bridge', () => {
  it('builds a battle config from the town: layout, limits, charges, stockpile', () => {
    const town = rich(yardTown(T0));
    place(town, 'supplyDepot', idx(5, 5), T0); // still under construction
    place(town, 'm2nest', idx(10, 10), T0);
    tick(town, T0 + minutes(1));
    town.lastSeen = T0;
    place(town, 'autocannon', idx(12, 12), T0); // freshly started: inert in battle
    placeWall(town, idx(9, 9));
    town.supplies = 432.7;

    const config = siegeConfig(town, 7);
    expect(config.siege!.startingSupplies).toBe(432);
    expect(config.ccLevel).toBe(1);
    expect(config.layout!.walls).toEqual([{ cell: idx(9, 9), kind: 'wall' }]);
    expect(config.layout!.structures.some((s) => s.kind === 'cc')).toBe(false);
    const cannon = config.layout!.structures.find((s) => s.kind === 'autocannon')!;
    expect(cannon.inert).toBe(true);
    expect(cannon.hpFraction).toBeCloseTo(0.35);
    const nest = config.layout!.structures.find((s) => s.kind === 'm2nest')!;
    expect(nest.inert).toBe(false);
    expect(config.buildLimits!.walls).toBe(50);
    expect(config.powerCharges).toEqual(town.charges);

    // And the engine accepts it wholesale.
    const engine = new Engine(config, TEST_CATALOG);
    expect(engine.phase).toBe('setup');
    expect(engine.structureAt(idx(10, 10))?.profile.kind).toBe('m2nest');
  });

  it('victory: wrecks the fallen, adopts battle-bought guns, pays loot, advances the ladder', () => {
    const town = unlockAll(yardTown(T0));
    town.supplies = 300;
    town.fuel = 100;
    place(town, 'supplyDepot', idx(5, 5), T0);
    tick(town, T0 + minutes(1));
    place(town, 'm2nest', idx(10, 10), T0 + minutes(1));
    tick(town, T0 + minutes(2));

    const outcome: SiegeOutcome = {
      victory: true,
      supplies: 120,
      chargesLeft: { a10: 0, arty: 0 },
      walls: [{ cell: idx(9, 9), kind: 'wall' }],
      survivors: [
        { cell: idx(10, 10), kind: 'm2nest', level: 1 }, // held
        { cell: idx(14, 14), kind: 'autocannon', level: 1 }, // bought during setup
        // the supply depot is absent: destroyed
      ],
      stats: {
        spawned: 0, kills: 0, wallsBuilt: 0, wallsLost: 0,
        structuresLost: 1, suppliesSpent: 0, cpSpent: 0, salvage: 0,
      },
      ccHpFraction: 0.95,
    };
    applySiegeResult(town, outcome, T0 + minutes(10));

    expect(structureAt(town, idx(5, 5))!.wrecked).toBe(true);
    expect(structureAt(town, idx(10, 10))!.wrecked).toBe(false);
    expect(structureAt(town, idx(14, 14))!.kind).toBe('autocannon');
    expect(town.walls).toEqual([{ cell: idx(9, 9), kind: 'wall' }]);
    expect(town.assaultLevel).toBe(2);
    expect(town.victories).toBe(1);
    // 120 from the battle + 400 loot, clamped by CC1 storage (800).
    expect(town.supplies).toBe(Math.min(520, caps(town).supplies));
    expect(town.fuel).toBeGreaterThan(100);
  });

  it('defeat: raiders take their cut and the ladder holds still', () => {
    const town = yardTown(T0);
    town.fuel = 200;
    const outcome: SiegeOutcome = {
      victory: false,
      supplies: 400,
      chargesLeft: { a10: 1, arty: 0 },
      walls: [],
      survivors: [],
      stats: {
        spawned: 0, kills: 0, wallsBuilt: 0, wallsLost: 0,
        structuresLost: 0, suppliesSpent: 0, cpSpent: 0, salvage: 0,
      },
      ccHpFraction: 0,
    };
    applySiegeResult(town, outcome, T0 + minutes(10));
    expect(town.supplies).toBe(340); // 400 × 0.85
    expect(town.fuel).toBe(170);
    expect(town.assaultLevel).toBe(1);
    expect(town.defeats).toBe(1);
    expect(town.charges['a10']).toBe(1);
  });

  it('reads a battle outcome from the engine, excluding the battle layer', () => {
    const engine = new Engine(
      {
        width: 20,
        height: 11,
        seed: 1,
        ccOrigin: 4 * 20 + 17,
        spawnColumn: 0,
        layout: { walls: [{ cell: 30, kind: 'wall' }], structures: [{ cell: 4 * 20 + 8, kind: 'm2nest' }] },
      },
      TEST_CATALOG,
    );
    engine.enqueue({ tick: 0, type: 'placeStructure', cell: 50, kind: 'foxhole' }); // field kind
    engine.enqueue({ tick: 0, type: 'placeWall', cell: 51, kind: 'hesco' }); // battle wall
    engine.run(1);

    const outcome = outcomeFromEngine(engine);
    expect(outcome.victory).toBe(false);
    expect(outcome.walls).toEqual([{ cell: 30, kind: 'wall' }]); // hesco excluded
    expect(outcome.survivors).toEqual([{ cell: 4 * 20 + 8, kind: 'm2nest', level: 1 }]);
    expect(outcome.chargesLeft).toHaveProperty('a10');
  });
});
