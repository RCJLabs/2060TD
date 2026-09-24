import { describe, expect, it } from 'vitest';
import {
  baseRatesPerHour,
  canTrain,
  isPoweredCell,
  place,
  queueTrain,
  ratesPerHour,
  repairCost,
  structureAt,
  tick,
  townCc,
  trainingCost,
  unlockAll,
  upgrade,
  yardOutput,
  yardOutputAt,
  TOWN_GRID,
  type TownState,
} from '../src/meta/town';
import { deserialize, serialize } from '../src/meta/save';
import { newTown } from '../src/meta/town';
import { yardTown } from './helpers';

/**
 * The yard (M24 Phase 3): power and adjacency, the two rules that make where a
 * building stands an economic question as well as a maze one.
 */

const T0 = 1_700_000_000_000;
const MIN = 60_000;
/** Column, row: the post stands at (4, 13). */
const at = (x: number, y: number) => y * TOWN_GRID.width + x;

/** A CC3 town on clear ground, rich, with everything unlocked. */
function cc3(): TownState {
  const town = unlockAll(yardTown(T0));
  townCc(town).level = 3;
  town.supplies = 50_000;
  town.fuel = 50_000;
  return town;
}

/** Place and finish building it. */
function build(town: TownState, kind: string, x: number, y: number): void {
  expect(place(town, kind, at(x, y), town.lastSeen), `${kind} at (${x}, ${y})`).toBe(true);
  tick(town, town.lastSeen + 10 * MIN);
}

describe('the yard: power', () => {
  it('the post powers everything within two of it, diagonals included', () => {
    const town = cc3();
    expect(isPoweredCell(town, at(4, 11))).toBe(true);
    expect(isPoweredCell(town, at(6, 14))).toBe(true); // two across, one down
    expect(isPoweredCell(town, at(7, 13))).toBe(false);
    expect(isPoweredCell(town, at(4, 10))).toBe(false);
  });

  it('an unpowered depot makes half, and a generator in reach restores it', () => {
    const town = cc3();
    // Column 9: the clear yard runs a river down column 8.
    build(town, 'supplyDepot', 9, 13);
    const depot = structureAt(town, at(9, 13))!;
    expect(yardOutput(town, depot)).toBe(0.5);
    expect(ratesPerHour(town).supplies).toBe(60);
    // What the depot is rated at does not care where it stands.
    expect(baseRatesPerHour(town).supplies).toBe(120);

    build(town, 'generator', 9, 11); // reach 1 at level 1: two rows is too far
    expect(yardOutput(town, depot)).toBe(0.5);
    const gen = structureAt(town, at(9, 11))!;
    expect(upgrade(town, gen.id, town.lastSeen)).toBe(true);
    // Upgrading, it still powers at the reach it has.
    expect(yardOutput(town, depot)).toBe(0.5);
    tick(town, town.lastSeen + 10 * MIN);
    expect(gen.level).toBe(2);
    expect(yardOutput(town, depot)).toBe(1); // reach 2 now
    expect(ratesPerHour(town).supplies).toBe(120);

    gen.wrecked = true;
    expect(yardOutput(town, depot)).toBe(0.5);
  });

  it('a generator still going up powers nothing', () => {
    const town = cc3();
    build(town, 'supplyDepot', 9, 13);
    expect(place(town, 'generator', at(9, 12), town.lastSeen)).toBe(true);
    expect(yardOutput(town, structureAt(town, at(9, 13))!)).toBe(0.5);
    tick(town, town.lastSeen + 10 * MIN);
    expect(yardOutput(town, structureAt(town, at(9, 13))!)).toBe(1);
  });

  it('only producers need power', () => {
    const town = cc3();
    build(town, 'barracks', 9, 13);
    expect(yardOutput(town, structureAt(town, at(9, 13))!)).toBe(1);
  });
});

describe('the yard: neighbours', () => {
  it('a depot makes a quarter more for each bunker beside it, up to two', () => {
    const town = cc3();
    build(town, 'supplyDepot', 6, 13);
    const depot = structureAt(town, at(6, 13))!;
    expect(yardOutput(town, depot)).toBe(1);
    build(town, 'storageBunker', 6, 12);
    expect(yardOutput(town, depot)).toBe(1.25);
    // A diagonal is not beside.
    build(town, 'storageBunker', 5, 12);
    expect(yardOutput(town, depot)).toBe(1.25);
    build(town, 'storageBunker', 7, 13);
    expect(yardOutput(town, depot)).toBe(1.5);
    expect(ratesPerHour(town).supplies).toBe(180);
  });

  it('counts only a bunker that works', () => {
    const town = cc3();
    build(town, 'supplyDepot', 6, 13);
    const depot = structureAt(town, at(6, 13))!;
    expect(place(town, 'storageBunker', at(6, 12), town.lastSeen)).toBe(true);
    expect(yardOutput(town, depot)).toBe(1); // still going up
    tick(town, town.lastSeen + 10 * MIN);
    expect(yardOutput(town, depot)).toBe(1.25);
    structureAt(town, at(6, 12))!.wrecked = true;
    expect(yardOutput(town, depot)).toBe(1);
  });

  it('power and neighbours multiply', () => {
    const town = cc3();
    build(town, 'fuelDepot', 9, 13);
    build(town, 'storageBunker', 9, 12);
    expect(yardOutput(town, structureAt(town, at(9, 13))!)).toBe(1.25 * 0.5);
  });

  it('the signals station makes half again beside a generator', () => {
    const town = cc3();
    build(town, 'radar', 3, 13);
    const radar = structureAt(town, at(3, 13))!;
    expect(yardOutput(town, radar)).toBe(1);
    build(town, 'generator', 3, 12);
    expect(yardOutput(town, radar)).toBe(1.5);
  });

  it('prices a building where it would stand, before it is placed', () => {
    const town = cc3();
    build(town, 'storageBunker', 6, 12);
    expect(yardOutputAt(town, 'supplyDepot', at(6, 13))).toBe(1.25);
    expect(yardOutputAt(town, 'supplyDepot', at(9, 13))).toBe(0.5);
  });

  it('a facility beside its depot trains a quarter cheaper', () => {
    const town = cc3();
    build(town, 'barracks', 3, 13);
    const barracks = structureAt(town, at(3, 13))!;
    expect(trainingCost(town, barracks.id, 'ranger')).toEqual({ supplies: 60, fuel: 0 });
    build(town, 'supplyDepot', 2, 13);
    expect(trainingCost(town, barracks.id, 'ranger')).toEqual({ supplies: 45, fuel: 0 });

    build(town, 'motorpool', 5, 14);
    const pool = structureAt(town, at(5, 14))!;
    build(town, 'fuelDepot', 6, 14);
    expect(trainingCost(town, pool.id, 'abrams')).toEqual({ supplies: 315, fuel: 98 });

    // The price is what the queue checks and what it takes.
    town.supplies = 45;
    town.fuel = 0;
    expect(canTrain(town, barracks.id, 'ranger')).toBe(null);
    expect(queueTrain(town, barracks.id, 'ranger', town.lastSeen)).toBe(true);
    expect(town.supplies).toBe(0);
  });

  it('a wreck beside a working engineering bay repairs for half', () => {
    const town = cc3();
    build(town, 'supplyDepot', 6, 13);
    const depot = structureAt(town, at(6, 13))!;
    depot.wrecked = true;
    const full = repairCost(town, depot);
    build(town, 'engBay', 6, 12);
    expect(repairCost(town, depot)).toEqual({
      supplies: Math.ceil(150 * 0.3 * 0.5),
      fuel: 0,
    });
    expect(full.supplies).toBe(Math.ceil(150 * 0.3));
    // A wrecked bay repairs nothing.
    structureAt(town, at(6, 12))!.wrecked = true;
    expect(repairCost(town, depot)).toEqual(full);
  });
});

describe('the yard: saves', () => {
  it('a war that took CC2 before the grid existed gets the generator on load', () => {
    const took = newTown(T0);
    took.unlocked.push('fuelDepot', 'cc2');
    expect(deserialize(serialize(took))!.unlocked).toContain('generator');
    // One that has not reached CC2 waits for the mission, like everyone else.
    expect(deserialize(serialize(newTown(T0)))!.unlocked).not.toContain('generator');
  });
});
