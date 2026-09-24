import { describe, expect, it } from 'vitest';
import { BUILDABLE_KINDS, CC_GATING, CHARGE_CAP } from '../src/content/buildings';
import { townMetaFor } from '../src/content/factions';
import { TECHS, techPrereqs, TECH_BY_ID } from '../src/content/research';
import {
  accrue,
  buyCharge,
  canPlace,
  canResearch,
  caps,
  chargeCapOf,
  conversionPerHour,
  converterAt,
  newTown,
  place,
  productionPerHour,
  ratesPerHour,
  repairCost,
  standDown,
  startResearch,
  structureAt,
  tick,
  townCc,
  unlockAll,
  TOWN_GRID,
  type TownState,
} from '../src/meta/town';
import { yardTown } from './helpers';

/**
 * M24 Phase 4a: the works that turn the surplus into what is short, and the
 * research graph they feed.
 */

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
/** Column, row: the post stands at (4, 13), and powers two cells round it. */
const at = (x: number, y: number) => y * TOWN_GRID.width + x;

function cc3(...techs: string[]): TownState {
  const town = unlockAll(yardTown(T0));
  townCc(town).level = 3;
  town.supplies = 50_000;
  town.fuel = 50_000;
  town.research.completed = techs;
  return town;
}

function build(town: TownState, kind: string, x: number, y: number): void {
  expect(place(town, kind, at(x, y), town.lastSeen), `${kind} at (${x}, ${y})`).toBe(true);
  tick(town, town.lastSeen + 10 * MIN);
}

/** Two supply depots and a refinery, all within the post's reach. */
function works(...techs: string[]): TownState {
  const town = cc3('logistics1', 'logistics2', ...techs);
  build(town, 'supplyDepot', 2, 13);
  build(town, 'supplyDepot', 6, 13);
  build(town, 'refinery', 3, 12);
  return town;
}

describe('the works', () => {
  it('research unlocks them, not the campaign', () => {
    const town = cc3();
    expect(canPlace(town, 'refinery', at(3, 12))).toBe('locked');
    expect(canPlace(town, 'bureau', at(5, 12))).toBe('locked');
    town.research.completed = ['logistics1'];
    expect(canPlace(town, 'refinery', at(3, 12))).toBe(null);
    expect(canPlace(town, 'bureau', at(5, 12))).toBe('locked');
    town.research.completed = ['logistics1', 'logistics2'];
    expect(canPlace(town, 'bureau', at(5, 12))).toBe(null);
  });

  it('a refinery diverts supply production into fuel', () => {
    const town = works();
    town.fuel = 0;
    expect(productionPerHour(town)).toEqual({ supplies: 240, fuel: 0, intel: 0 });
    // Level 1: 120 supplies an hour in, 16 fuel out.
    expect(ratesPerHour(town)).toEqual({ supplies: 120, fuel: 16, intel: 0 });
  });

  it('idles while its store is full, rather than burn supplies into it', () => {
    const town = works();
    town.fuel = caps(town).fuel;
    expect(ratesPerHour(town)).toEqual({ supplies: 240, fuel: 0, intel: 0 });
  });

  it('is charged only for the part of an interval it ran', () => {
    const town = works();
    town.supplies = 0;
    town.fuel = caps(town).fuel - 8; // half an hour of 16 an hour
    const after = accrue(town, 2 * HOUR);
    expect(after.fuel).toBe(caps(town).fuel);
    expect(after.converted.supplies).toBeCloseTo(60, 6); // 120 an hour for half an hour
    expect(after.supplies).toBeCloseTo(240 * 2 - 60, 6);
  });

  it('never draws on the stockpile: it takes no more than the depots make', () => {
    const town = works();
    town.fuel = 0;
    // One depot left standing: 120 an hour, all of which the refinery wants.
    structureAt(town, at(6, 13))!.wrecked = true;
    expect(ratesPerHour(town)).toEqual({ supplies: 0, fuel: 16, intel: 0 });
    structureAt(town, at(2, 13))!.wrecked = true;
    const held = town.supplies;
    const after = accrue(town, 3 * HOUR);
    expect(after.supplies).toBe(held);
    expect(after.fuel).toBe(0);
  });

  it('on a full supply store it runs on what would have been thrown away', () => {
    const town = works();
    town.supplies = caps(town).supplies;
    town.fuel = 0;
    const after = accrue(town, HOUR);
    expect(after.supplies).toBe(caps(town).supplies);
    expect(after.fuel).toBeCloseTo(16, 6);
  });

  it('makes half out of power, like a producer', () => {
    const town = cc3('logistics1');
    build(town, 'supplyDepot', 2, 13);
    build(town, 'supplyDepot', 6, 13);
    build(town, 'refinery', 9, 13); // five columns from the post
    town.fuel = 0;
    expect(ratesPerHour(town)).toEqual({ supplies: 180, fuel: 8, intel: 0 });
  });

  it('cut back, it rounds down: what the works take never tops what is made', () => {
    const town = works();
    build(town, 'bureau', 5, 12);
    town.fuel = 0;
    town.intel = 0;
    // Both want 120 an hour; 121 made would round each half up to 61.
    for (const made of [0, 1, 121, 179, 239]) {
      expect(conversionPerHour(town, made).input, `${made} made`).toBeLessThanOrEqual(made);
    }
    expect(conversionPerHour(town, 240).input).toBe(240);
  });

  it('its card says what it takes and makes, and why it makes less', () => {
    const town = works();
    const refinery = structureAt(town, at(3, 12))!;
    town.fuel = 0;
    expect(converterAt(town, refinery)).toEqual({ to: 'fuel', input: 120, output: 16, state: 'running' });
    town.fuel = caps(town).fuel;
    expect(converterAt(town, refinery)).toMatchObject({ input: 0, state: 'full' });
    town.fuel = 0;
    structureAt(town, at(6, 13))!.wrecked = true; // 120 made, all of which it wants
    expect(converterAt(town, refinery)).toEqual({ to: 'fuel', input: 120, output: 16, state: 'running' });
    structureAt(town, at(2, 13))!.wrecked = true;
    expect(converterAt(town, refinery)).toEqual({ to: 'fuel', input: 0, output: 0, state: 'short' });
    refinery.wrecked = true;
    expect(converterAt(town, refinery)).toMatchObject({ state: 'stopped' });
    expect(converterAt(town, structureAt(town, at(4, 13))!)).toBe(null);
  });

  it('stood down, it takes and makes nothing until it is told to resume', () => {
    const town = works();
    const refinery = structureAt(town, at(3, 12))!;
    town.fuel = 0;
    expect(standDown(town, refinery.id, true)).toBe(true);
    expect(ratesPerHour(town)).toEqual({ supplies: 240, fuel: 0, intel: 0 });
    expect(converterAt(town, refinery)).toMatchObject({ input: 0, output: 0, state: 'down' });
    const after = accrue(town, HOUR);
    expect(after.converted).toEqual({ supplies: 0, fuel: 0, intel: 0 });
    expect(standDown(town, refinery.id, false)).toBe(true);
    expect(refinery.stoodDown).toBeUndefined();
    expect(ratesPerHour(town)).toEqual({ supplies: 120, fuel: 16, intel: 0 });
    // Only the works stand down.
    expect(standDown(town, structureAt(town, at(2, 13))!.id, true)).toBe(false);
  });

  it('an intel bureau makes intel the same way', () => {
    const town = cc3('logistics1', 'logistics2');
    build(town, 'supplyDepot', 2, 13);
    build(town, 'supplyDepot', 6, 13);
    build(town, 'bureau', 3, 12);
    town.intel = 0;
    expect(ratesPerHour(town)).toEqual({ supplies: 120, fuel: 0, intel: 6 });
  });
});

describe('the research graph', () => {
  /** A CC3 town with a working signals station, rich in everything. */
  function lab(...techs: string[]): TownState {
    const town = cc3(...techs);
    build(town, 'radar', 3, 13);
    town.intel = 5000;
    return town;
  }

  it('an upper tier needs a tech from another branch as well as its own', () => {
    const town = lab('fortify1', 'fortify2', 'fortify3');
    expect(canResearch(town, 'fortify4')).toBe('prereq');
    town.research.completed.push('logistics1', 'logistics2');
    expect(canResearch(town, 'fortify4')).toBe(null);
  });

  it('costs supplies and fuel as well as intel', () => {
    const town = lab('fortify1', 'fortify2', 'fortify3', 'logistics1', 'logistics2');
    town.supplies = 7999;
    expect(canResearch(town, 'fortify4')).toBe('cost');
    town.supplies = 8000;
    town.fuel = 1500;
    expect(startResearch(town, 'fortify4', town.lastSeen)).toBe(true);
    expect(town.supplies).toBe(0);
    expect(town.fuel).toBe(0);
    expect(town.intel).toBe(4600);
    expect(town.research.active!.endsAt - town.lastSeen).toBe(4 * HOUR);
  });

  it("every price fits a built-out CC3 town's stores, with the storage its prerequisites bring", () => {
    // Tier 5 was priced at 800 intel and 20,000 supplies in the plan, and no
    // store in the game holds either: the economy instrument's fortnight
    // bought the graph up to tier 4 and never finished it.
    const town = unlockAll(newTown(T0, 'usa'));
    const gate = CC_GATING[2]!;
    townCc(town).level = 3;
    let id = 100;
    for (const kind of BUILDABLE_KINDS) {
      const level = Math.min(gate.maxStructureLevel, townMetaFor('usa')[kind]!.levels.length);
      for (let i = 0; i < (gate.counts[kind] ?? 0); i++) {
        town.structures.push({ id, kind, cell: -id, level, wrecked: false });
        id++;
      }
    }
    const before = (tech: string, seen = new Set<string>()): string[] => {
      for (const p of techPrereqs(TECH_BY_ID[tech]!)) {
        if (!seen.has(p)) {
          seen.add(p);
          before(p, seen);
        }
      }
      return [...seen];
    };
    for (const tech of TECHS) {
      town.research.completed = before(tech.id);
      const cap = caps(town);
      expect(tech.intel, `${tech.id} intel`).toBeLessThanOrEqual(cap.intel);
      expect(tech.supplies ?? 0, `${tech.id} supplies`).toBeLessThanOrEqual(cap.supplies);
      expect(tech.fuel ?? 0, `${tech.id} fuel`).toBeLessThanOrEqual(cap.fuel);
    }
  });

  it('Deep Strike stocks one more charge of each ordnance', () => {
    const town = cc3();
    town.unlocked.push('a10');
    expect(chargeCapOf(town)).toBe(CHARGE_CAP);
    town.research.completed = ['strike5'];
    expect(chargeCapOf(town)).toBe(CHARGE_CAP + 1);
    town.charges = { a10: 0, arty: 0 };
    for (let i = 0; i < CHARGE_CAP + 3; i++) buyCharge(town, 'a10');
    expect(town.charges['a10']).toBe(CHARGE_CAP + 1);
  });

  it('Field Engineering takes 30% off a wreck, on top of the engineering bay', () => {
    const town = cc3();
    build(town, 'supplyDepot', 6, 13);
    const depot = structureAt(town, at(6, 13))!;
    depot.wrecked = true;
    const full = repairCost(town, depot).supplies;
    town.research.completed = ['logistics4'];
    expect(repairCost(town, depot).supplies).toBe(Math.ceil(150 * 0.3 * 0.7));
    expect(full).toBe(Math.ceil(150 * 0.3));
  });

  it('Strategic Reserve makes a quarter more from the same supplies', () => {
    const town = works('logistics5');
    town.fuel = 0;
    expect(ratesPerHour(town)).toEqual({ supplies: 120, fuel: 20, intel: 0 });
  });
});
