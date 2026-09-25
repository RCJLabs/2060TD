import { describe, expect, it } from 'vitest';
import { DAY_MS } from '../src/content/leagues';
import { HUNGER_MS, QUIET_MS, SUPPLY_PER_RUNG } from '../src/content/theaters';
import { deserialize, serialize } from '../src/meta/save';
import {
  canFeedNext,
  chargeHunger,
  lineAfterTaking,
  lineShares,
  nextHungerAt,
  normalizeSupply,
  shortShare,
  supplyLine,
} from '../src/meta/supply';
import { applyRaidResult, raidConfig, targetFor } from '../src/meta/warfare';
import { makeResolution } from './helpers';
import {
  accrue,
  converterAt,
  newTown,
  place,
  productionPerHour,
  ratesPerHour,
  structureAt,
  tick,
  townCc,
  unlockAll,
  TOWN_GRID,
  type TownState,
} from '../src/meta/town';
import { yardTown } from './helpers';

/** M25 Phase 3: holding ground costs supplies, and a front the town cannot feed goes hungry. */

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (x: number, y: number) => y * TOWN_GRID.width + x;

/** A CC3 town with two powered supply depots: 240 an hour. */
function depots(tier: number): TownState {
  const town = unlockAll(yardTown(T0));
  townCc(town).level = 3;
  town.supplies = 50_000;
  town.fuel = 50_000;
  town.research.completed = ['logistics1', 'logistics2'];
  for (const [kind, x, y] of [
    ['supplyDepot', 2, 13],
    ['supplyDepot', 6, 13],
  ] as const) {
    expect(place(town, kind, at(x, y), town.lastSeen)).toBe(true);
    tick(town, town.lastSeen + 10 * MIN);
  }
  expect(productionPerHour(town).supplies).toBe(240);
  town.frontline.tier = tier;
  town.frontline.activeAt = town.lastSeen;
  town.frontline.pressedAt = town.lastSeen;
  town.frontline.fedAt = town.lastSeen;
  return town;
}

/** The same town with a refinery, which wants 120 an hour of the 240. */
function works(tier: number): TownState {
  const town = depots(tier);
  town.frontline.tier = 1;
  expect(place(town, 'refinery', at(3, 12), town.lastSeen)).toBe(true);
  tick(town, town.lastSeen + 10 * MIN);
  town.frontline.tier = tier;
  town.frontline.activeAt = town.lastSeen;
  town.frontline.pressedAt = town.lastSeen;
  town.frontline.fedAt = town.lastSeen;
  town.fuel = 0;
  return town;
}

/** A war with nothing making supplies, at a given rung, its clocks at T0. */
function bare(tier: number): TownState {
  const town = unlockAll(newTown(T0));
  town.frontline.tier = tier;
  return town;
}

describe('the line', () => {
  it('takes five supplies an hour for each rung of a held sector’s distance, a town at a time', () => {
    expect(SUPPLY_PER_RUNG).toBe(5);
    const fl = bare(6).frontline;
    expect(lineShares(fl).map((s) => s.perHour)).toEqual([15, 30, 45, 60, 75]);
    expect(supplyLine(fl)).toBe(225);
  });

  it('costs nothing at the first rung, for the front, or for ground the enemy holds', () => {
    expect(supplyLine(bare(1).frontline)).toBe(0);
    const fl = bare(6).frontline;
    fl.lost = [{ tier: 5, slot: 0, at: T0 }];
    expect(lineShares(fl)[4]).toEqual({ tier: 5, held: 2, perHour: 50 });
    expect(supplyLine(fl)).toBe(200);
  });

  it('grows with the square of its depth: CC1, CC2 and CC3 feed the sixth, ninth and thirteenth rungs', () => {
    const line = (tier: number): number => supplyLine(bare(tier).frontline);
    expect(line(6)).toBeLessThanOrEqual(240);
    expect(line(7)).toBeGreaterThan(240);
    expect(line(9)).toBeLessThanOrEqual(630);
    expect(line(10)).toBeGreaterThan(630);
    expect(line(13)).toBeLessThanOrEqual(1_320);
    expect(line(14)).toBeGreaterThan(1_320);
  });
});

describe('feeding it', () => {
  it('comes out of production before the works take theirs', () => {
    // 240 made; the line to the fourth rung takes 90, the refinery its 120.
    expect(ratesPerHour(works(4))).toEqual({ supplies: 30, fuel: 16, intel: 0 });
    // To the fifth the line takes 150, and the refinery gets the 90 left.
    const town = works(5);
    expect(ratesPerHour(town)).toEqual({ supplies: 0, fuel: 12, intel: 0 });
    const refinery = structureAt(town, at(3, 12))!;
    expect(converterAt(town, refinery)).toMatchObject({ input: 90, state: 'short' });
  });

  it('is booked by the accrual, and the rest is banked', () => {
    const town = depots(4);
    town.supplies = 0;
    const after = accrue(town, HOUR);
    expect(after.fed).toBeCloseTo(90, 6);
    expect(after.supplies).toBeCloseTo(150, 6);
  });

  it('never draws on the stockpile: a line deeper than the depots can feed takes what they make', () => {
    const town = depots(7);
    const held = town.supplies;
    const after = accrue(town, 3 * HOUR);
    expect(after.supplies).toBe(held);
    expect(after.fed).toBeCloseTo(240 * 3, 6);
  });
});

describe('the ceiling (M25 Phase 4a)', () => {
  it('a town the depots could not feed holds, and the third push waits for them', () => {
    // 240 made. Taking the fifth rung's town puts the line at 225: fed.
    const fifth = depots(5);
    expect(lineAfterTaking(fifth.frontline)).toBe(225);
    expect(canFeedNext(fifth.frontline, 240)).toBe(true);
    // Taking the sixth's would put it at 315, which the depots cannot feed.
    const town = depots(6);
    expect(lineAfterTaking(town.frontline)).toBe(315);
    expect(canFeedNext(town.frontline, 240)).toBe(false);
    town.frontline.wins = 2;
    const base = targetFor(town, 2);
    const config = raidConfig(base, [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }], 1);
    applyRaidResult(town, base, makeResolution(), config, town.lastSeen + MIN);
    expect(town.frontline.tier).toBe(6);
    expect(town.frontline.wins).toBe(2);
    // It still pays: the win counts on the record and the board.
    expect(town.frontline.totalWins).toBe(1);
    // And the same win at the fifth rung takes its town.
    fifth.frontline.wins = 2;
    const next = targetFor(fifth, 2);
    applyRaidResult(fifth, next, makeResolution(), config, fifth.lastSeen + MIN);
    expect(fifth.frontline.tier).toBe(6);
    expect(fifth.frontline.wins).toBe(0);
  });
});

describe('a hungry front', () => {
  it('wholly unfed, loses a sector a day, lightening the line until the front falls back to what it can hold', () => {
    const town = bare(2);
    const lost = chargeHunger(town, T0 + 10 * DAY_MS, 0);
    expect(lost.map((s) => [s.at - T0, s.tier, s.slot, s.fellBack, s.cause])).toEqual([
      [HUNGER_MS, 1, 0, false, 'hunger'],
      [2 * HUNGER_MS, 1, 1, false, 'hunger'],
      [3 * HUNGER_MS, 1, 2, true, 'hunger'],
    ]);
    expect(town.frontline.tier).toBe(1);
    expect(supplyLine(town.frontline)).toBe(0);
    expect(town.frontline.hunger).toBeUndefined();
  });

  it('goes hungry at the share it is short by', () => {
    const town = depots(8);
    // The line takes 420 and the depots make 240: 180 short, three sevenths.
    expect(supplyLine(town.frontline)).toBe(420);
    expect(shortShare(town.frontline, 240)).toBeCloseTo(180 / 420, 9);
    const due = nextHungerAt(town, town.lastSeen, 240)!;
    expect(due - town.lastSeen).toBeCloseTo((HUNGER_MS * 420) / 180, 3);
    expect(chargeHunger(town, due - MIN, 240)).toEqual([]);
    const [strike] = chargeHunger(town, due + MIN, 240);
    expect(strike).toMatchObject({ tier: 7, slot: 0, cause: 'hunger' });
    expect(strike!.at).toBeCloseTo(due, 3);
    // Lighter by the sector it lost, and no longer as short.
    expect(supplyLine(town.frontline)).toBe(385);
  });

  it('is never hungry while fed', () => {
    const town = depots(6);
    expect(chargeHunger(town, town.lastSeen + 60 * DAY_MS, 240)).toEqual([]);
    expect(town.frontline.hunger).toBeUndefined();
    expect(nextHungerAt(town, town.lastSeen, 240)).toBeNull();
  });

  it('fed again, forgets its hunger', () => {
    const town = bare(3);
    chargeHunger(town, T0 + 12 * HOUR, 0);
    expect(town.frontline.hunger).toBeCloseTo(12 * HOUR, 6);
    // The depots come back: a charge while fed clears it.
    chargeHunger(town, T0 + 13 * HOUR, 100);
    expect(town.frontline.hunger).toBeUndefined();
    // And the next shortage needs a whole day of its own.
    expect(chargeHunger(town, T0 + 13 * HOUR + HUNGER_MS - MIN, 0)).toEqual([]);
    expect(chargeHunger(town, T0 + 13 * HOUR + HUNGER_MS, 0)).toHaveLength(1);
  });

  it('charges nothing twice, and nothing for a clock that ran backwards', () => {
    const town = bare(3);
    chargeHunger(town, T0 + 12 * HOUR, 0);
    const hunger = town.frontline.hunger;
    expect(chargeHunger(town, T0 + 12 * HOUR, 0)).toEqual([]);
    expect(chargeHunger(town, T0 + 6 * HOUR, 0)).toEqual([]);
    expect(town.frontline.hunger).toBe(hunger);
  });

  it('is charged by tick, through the whole absence, and reported beside the quiet strikes', () => {
    const town = bare(5);
    town.lastSeen = T0;
    const settled = tick(town, T0 + 2 * DAY_MS);
    // Hungry from the start, a sector a day; quiet from 36 hours.
    expect(settled.strikes.map((s) => [s.at - T0, s.cause])).toEqual([
      [HUNGER_MS, 'hunger'],
      [QUIET_MS, 'quiet'],
      [2 * HUNGER_MS, 'hunger'],
    ]);
  });
});

describe('the save', () => {
  it('a file from before has no hunger, and its clock starts at the next charge', () => {
    const town = bare(5);
    delete town.frontline.fedAt;
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.fedAt).toBeUndefined();
    expect(chargeHunger(loaded, T0 + 10 * DAY_MS, 0)).toEqual([]);
    expect(loaded.frontline.fedAt).toBe(T0 + 10 * DAY_MS);
  });

  it('round-trips a hunger, and repairs junk', () => {
    const town = bare(3);
    chargeHunger(town, T0 + 12 * HOUR, 0);
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.hunger).toBeCloseTo(12 * HOUR, 6);
    expect(loaded.frontline.fedAt).toBe(T0 + 12 * HOUR);
    const fl = loaded.frontline as unknown as Record<string, unknown>;
    fl['fedAt'] = 'later';
    fl['hunger'] = 5 * DAY_MS;
    normalizeSupply(loaded.frontline);
    expect(loaded.frontline.fedAt).toBeUndefined();
    expect(loaded.frontline.hunger).toBe(HUNGER_MS);
    fl['hunger'] = -3;
    normalizeSupply(loaded.frontline);
    expect(loaded.frontline.hunger).toBeUndefined();
  });
});
