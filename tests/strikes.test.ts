import { describe, expect, it } from 'vitest';
import { makeResolution } from './helpers';
import { DAY_MS } from '../src/content/leagues';
import { QUIET_MS, STRIKES_PER_QUIET } from '../src/content/theaters';
import { awardStanding } from '../src/meta/ladder';
import { deserialize, serialize } from '../src/meta/save';
import {
  chargeStrikes,
  cutAt,
  enemyClock,
  isCut,
  isLost,
  normalizeStrikes,
  retakeSector,
} from '../src/meta/strikes';
import { raidTargets, retakes, sectorAt, theaterView } from '../src/meta/theater';
import { newTown, tick, unlockAll, type TownState } from '../src/meta/town';
import { applyRaidResult, postAt, raidConfig, targetFor } from '../src/meta/warfare';

/** M25 Phase 2: the enemy strikes back when the front goes quiet. */

const T0 = 1_700_000_000_000;
const HOUR = 3_600_000;

/** A war at the fifth rung, last active at T0, its clock charged to T0. */
function atFront(tier = 5, faction: TownState['faction'] = 'usa'): TownState {
  const town = unlockAll(newTown(T0, faction));
  town.frontline.tier = tier;
  return town;
}

const lostKeys = (town: TownState): string[] =>
  (town.frontline.lost ?? []).map((l) => `t${l.tier}v${l.slot}`);

describe('the enemy clock', () => {
  it('strikes 36 hours into a quiet spell, and again a day later, and no more', () => {
    expect(QUIET_MS).toBe(36 * HOUR);
    expect(STRIKES_PER_QUIET).toBe(2);
    const town = atFront();
    expect(chargeStrikes(town, T0 + QUIET_MS - 1)).toEqual([]);
    const first = chargeStrikes(town, T0 + QUIET_MS);
    expect(first).toEqual([{ at: T0 + QUIET_MS, tier: 4, slot: 0, fellBack: false }]);
    expect(chargeStrikes(town, T0 + QUIET_MS + DAY_MS - 1)).toEqual([]);
    expect(chargeStrikes(town, T0 + QUIET_MS + DAY_MS)).toHaveLength(1);
    // Two is the most one quiet spell costs, however long it lasts.
    expect(chargeStrikes(town, T0 + 30 * DAY_MS)).toEqual([]);
    expect(lostKeys(town)).toEqual(['t4v0', 't4v1']);
  });

  it('lands everything a long absence owed in one charge, and charging again lands nothing', () => {
    const town = atFront();
    const landed = chargeStrikes(town, T0 + 10 * DAY_MS);
    expect(landed.map((s) => s.at)).toEqual([T0 + QUIET_MS, T0 + QUIET_MS + DAY_MS]);
    expect(chargeStrikes(town, T0 + 10 * DAY_MS)).toEqual([]);
    // A clock that jumped backwards lands nothing twice.
    expect(chargeStrikes(town, T0 + DAY_MS)).toEqual([]);
    expect(lostKeys(town)).toEqual(['t4v0', 't4v1']);
  });

  it('is reset by anything done on the Front Line, after what was owed has landed', () => {
    const town = atFront();
    // A raid 40 hours in: the strike due at 36 hours lands first.
    awardStanding(town, 10, T0 + 40 * HOUR);
    expect(lostKeys(town)).toEqual(['t4v0']);
    expect(town.frontline.activeAt).toBe(T0 + 40 * HOUR);
    // The new quiet spell counts from the raid.
    expect(chargeStrikes(town, T0 + 40 * HOUR + QUIET_MS - 1)).toEqual([]);
    expect(chargeStrikes(town, T0 + 40 * HOUR + QUIET_MS)).toHaveLength(1);
    expect(lostKeys(town)).toEqual(['t4v0', 't4v1']);
  });

  it('is not reset by an offline probe: sitting behind a garrison is not playing', () => {
    const town = atFront();
    awardStanding(town, 5, T0 + 20 * HOUR, false);
    expect(town.frontline.activeAt).toBe(T0);
    expect(chargeStrikes(town, T0 + QUIET_MS)).toHaveLength(1);
  });

  it('has nothing to take at the first rung: only the base is behind the front', () => {
    const town = atFront(1);
    expect(chargeStrikes(town, T0 + 10 * DAY_MS)).toEqual([]);
    expect(town.frontline.lost).toBeUndefined();
    expect(town.frontline.tier).toBe(1);
    expect(enemyClock(town, T0 + HOUR).next).toBeNull();
  });

  it('says how long the front has been quiet and when the next strike lands', () => {
    const town = atFront();
    expect(enemyClock(town, T0 + 20 * HOUR)).toEqual({ quiet: 20 * HOUR, next: T0 + QUIET_MS });
    chargeStrikes(town, T0 + 40 * HOUR);
    expect(enemyClock(town, T0 + 40 * HOUR).next).toBe(T0 + QUIET_MS + DAY_MS);
    chargeStrikes(town, T0 + 3 * DAY_MS);
    expect(enemyClock(town, T0 + 3 * DAY_MS).next).toBeNull();
  });

  it('is charged by tick, which reports what landed', () => {
    const town = atFront();
    town.lastSeen = T0;
    const settled = tick(town, T0 + 3 * DAY_MS);
    expect(settled.strikes.map((s) => [s.tier, s.slot])).toEqual([
      [4, 0],
      [4, 1],
    ]);
  });
});

describe('where the enemy strikes', () => {
  it('always the town behind the front, and a road that still reaches the front, main road first', () => {
    const town = atFront(6);
    // The heavy lane is already cut deep behind the front.
    town.frontline.lost = [{ tier: 3, slot: 0, at: T0 }];
    chargeStrikes(town, T0 + 3 * DAY_MS);
    // So the enemy goes for the middle road, then the light one, at tier 5.
    expect(lostKeys(town)).toEqual(['t5v1', 't5v2', 't3v0']);
    expect([0, 1, 2].map((s) => isCut(town.frontline, s))).toEqual([true, true, true]);
  });

  it('cuts a lane: its front post cannot be raided until the sector is retaken', () => {
    const town = atFront();
    chargeStrikes(town, T0 + QUIET_MS);
    expect(cutAt(town.frontline, 0)).toEqual({ tier: 4, slot: 0, at: T0 + QUIET_MS });
    const targets = raidTargets(town);
    expect(targets.map((t) => [t.tier, t.lane.slot, t.retake])).toEqual([
      [5, 1, false],
      [5, 2, false],
      [4, 0, true],
    ]);
    // The front post in the cut lane says where its road is cut.
    expect(sectorAt(town, 5, 0).cutAt).toBe('NEWPORT');
    expect(sectorAt(town, 5, 1).cutAt).toBeNull();
  });

  it('when every road is cut, takes what is left of the town, and the front falls back to it', () => {
    const town = atFront();
    town.frontline.wins = 2;
    town.frontline.lost = [
      { tier: 4, slot: 0, at: T0 },
      { tier: 4, slot: 1, at: T0 },
      { tier: 2, slot: 2, at: T0 },
    ];
    const [strike] = chargeStrikes(town, T0 + QUIET_MS);
    expect(strike).toEqual({ at: T0 + QUIET_MS, tier: 4, slot: 2, fellBack: true });
    expect(town.frontline.tier).toBe(4);
    expect(town.frontline.wins).toBe(0);
    // The town that fell is the front again, contested; the deeper loss stays.
    expect(lostKeys(town)).toEqual(['t2v2']);
    // And the quiet spell's second strike goes for the new town behind it.
    chargeStrikes(town, T0 + QUIET_MS + DAY_MS);
    expect(lostKeys(town)).toEqual(['t3v0', 't2v2']);
  });

  it('never pushes the front back from a whole town in one quiet spell', () => {
    for (let tier = 2; tier <= 13; tier++) {
      const town = atFront(tier);
      chargeStrikes(town, T0 + 60 * DAY_MS);
      expect(town.frontline.tier, `tier ${tier}`).toBe(tier);
    }
  });

  it('at the second rung, takes the first town, and the front can fall back to it but never past it', () => {
    const town = atFront(2);
    town.frontline.lost = [
      { tier: 1, slot: 0, at: T0 },
      { tier: 1, slot: 1, at: T0 },
    ];
    chargeStrikes(town, T0 + 60 * DAY_MS);
    expect(town.frontline.tier).toBe(1);
    expect(town.frontline.lost).toBeUndefined();
    town.frontline.activeAt = T0 + 61 * DAY_MS;
    chargeStrikes(town, T0 + 120 * DAY_MS);
    expect(town.frontline.tier).toBe(1);
  });
});

describe('retaking', () => {
  it("a lost sector's post is the one the ladder dealt at that tier and lane", () => {
    const town = atFront();
    chargeStrikes(town, T0 + QUIET_MS);
    const [back] = retakes(town);
    expect(back).toMatchObject({ tier: 4, town: 'NEWPORT', retake: true, band: 'HEAVY' });
    // The same base it was when NEWPORT was the front.
    const then = atFront(4);
    expect(JSON.stringify(back!.base)).toBe(JSON.stringify(targetFor(then, 0)));
    expect(JSON.stringify(back!.base)).toBe(JSON.stringify(postAt(town, 4, 0)));
  });

  it('a raid that takes it retakes the sector and reopens the lane, and the pushes do not move', () => {
    const town = atFront();
    town.frontline.wins = 1;
    const at = T0 + QUIET_MS;
    chargeStrikes(town, at);
    const base = postAt(town, 4, 0);
    const config = raidConfig(base, [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }], 1);
    const standing = town.frontline.standing;
    applyRaidResult(town, base, makeResolution(), config, at + HOUR);
    expect(isLost(town.frontline, 4, 0)).toBe(false);
    expect(town.frontline.lost).toBeUndefined();
    expect(isCut(town.frontline, 0)).toBe(false);
    expect(town.frontline.wins).toBe(1);
    expect(town.frontline.tier).toBe(5);
    expect(town.frontline.totalWins).toBe(1);
    // It pays standing like taking a post at that tier, and it is playing.
    expect(town.frontline.standing).toBeGreaterThan(standing);
    expect(town.frontline.activeAt).toBe(at + HOUR);
  });

  it('a failed retake leaves the sector lost', () => {
    const town = atFront();
    chargeStrikes(town, T0 + QUIET_MS);
    const base = postAt(town, 4, 0);
    const config = raidConfig(base, [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }], 1);
    applyRaidResult(town, base, makeResolution({ cleared: false, objectiveMet: false }), config, T0 + 40 * HOUR);
    expect(isLost(town.frontline, 4, 0)).toBe(true);
  });

  it('a raid at the front lands what the quiet spell owed first, on the front as it stood', () => {
    const town = atFront();
    town.frontline.wins = 2;
    // Launched 40 hours into a quiet spell: the strike due at 36 hours takes
    // NEWPORT's heavy lane before the raid takes LINCOLN CITY.
    const base = targetFor(town, 2);
    const config = raidConfig(base, [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }], 1);
    applyRaidResult(town, base, makeResolution(), config, T0 + 40 * HOUR);
    expect(town.frontline.tier).toBe(6);
    expect(lostKeys(town)).toEqual(['t4v0']);
  });

  it('retakeSector is false for ground that was never lost', () => {
    const town = atFront();
    expect(retakeSector(town.frontline, 4, 1)).toBe(false);
  });
});

describe('the map shows it', () => {
  it('marks lost sectors and cut lanes, and reaches back to the deepest loss', () => {
    const town = atFront(8);
    town.frontline.lost = [{ tier: 3, slot: 2, at: T0 }];
    const view = theaterView(town);
    expect(view.rows[0]!.tier).toBe(3);
    expect(view.rows[0]!.lost).toEqual([false, false, true]);
    expect(view.cut).toEqual([false, false, true]);
    expect(view.rows.find((r) => r.tier === 6)!.lost).toEqual([false, false, false]);
  });
});

describe('the save', () => {
  it('a file from before has lost nothing, and its clock starts at the next charge', () => {
    const town = atFront();
    delete town.frontline.pressedAt;
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.lost).toBeUndefined();
    expect(loaded.frontline.pressedAt).toBeUndefined();
    // Ten days of absence before the update are not charged.
    expect(chargeStrikes(loaded, T0 + 10 * DAY_MS)).toEqual([]);
    expect(loaded.frontline.pressedAt).toBe(T0 + 10 * DAY_MS);
    // From there it runs.
    expect(chargeStrikes(loaded, T0 + 11 * DAY_MS)).toEqual([]);
    loaded.frontline.activeAt = T0 + 10 * DAY_MS;
    expect(chargeStrikes(loaded, T0 + 10 * DAY_MS + QUIET_MS)).toHaveLength(1);
  });

  it('round-trips lost ground', () => {
    const town = atFront();
    chargeStrikes(town, T0 + 3 * DAY_MS);
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.lost).toEqual(town.frontline.lost);
    expect(loaded.frontline.pressedAt).toBe(T0 + 3 * DAY_MS);
  });

  it('repairs junk: partial entries, ground at or past the front, duplicates, a whole column', () => {
    const town = atFront();
    const fl = town.frontline as unknown as Record<string, unknown>;
    fl['pressedAt'] = 'soon';
    fl['lost'] = [
      { tier: 4, slot: 0, at: T0 },
      { tier: 4, slot: 0, at: T0 + 1 },
      { tier: 5, slot: 1, at: T0 },
      { tier: 0, slot: 1, at: T0 },
      { tier: 3, slot: 7, at: T0 },
      { tier: 3.5, slot: 1, at: T0 },
      { tier: 2, slot: 1 },
      null,
      'x',
      { tier: 2, slot: 0, at: T0 },
      { tier: 2, slot: 1, at: T0 },
      { tier: 2, slot: 2, at: T0 },
    ];
    normalizeStrikes(town.frontline);
    expect(town.frontline.pressedAt).toBeUndefined();
    expect(lostKeys(town)).toEqual(['t4v0', 't2v0', 't2v1']);
    fl['lost'] = 'nothing';
    normalizeStrikes(town.frontline);
    expect(town.frontline.lost).toBeUndefined();
  });
});
