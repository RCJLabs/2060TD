import { describe, expect, it } from 'vitest';
import { makeResolution, withDepots } from './helpers';
import {
  ARCHETYPES,
  CITADEL,
  CITADEL_DEAL,
  CITADEL_SLOT,
  dealPairFor,
  TARGETS_PER_TIER,
  towerCountFor,
} from '../src/content/bases';
import { baseKitFor, FACTION_IDS } from '../src/content/factions';
import { LEAGUES } from '../src/content/leagues';
import { QUIET_MS, strongholdTier, theaterFor } from '../src/content/theaters';
import {
  citadelInRange,
  normalizeCapital,
  roadsTaken,
  WAR_WON_PAYOUT,
  winAtCapital,
} from '../src/meta/capital';
import { serviceRecord } from '../src/meta/record';
import { deserialize, serialize } from '../src/meta/save';
import { chargeStrikes } from '../src/meta/strikes';
import { raidTargetKeys, sectorAt, theaterView } from '../src/meta/theater';
import { newTown, unlockAll, type TownState } from '../src/meta/town';
import { applyRaidResult, postAt, raidConfig } from '../src/meta/warfare';
import { capitalReport } from '../src/game/theaterMap';

/**
 * M25 Phase 4b: the enemy's capital is taken by its three roads and then its
 * citadel, and the citadel's fall wins the war.
 */

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const CAPITAL = strongholdTier(theaterFor('usa'));

/**
 * A war with its front at the enemy's capital. Twelve depots make 1,980 an
 * hour, which feeds the line into the enemy's rear; eight make 1,320, which
 * cannot feed the stronghold (1,365).
 */
function atCapital(depots = 12): TownState {
  const town = withDepots(unlockAll(newTown(T0, 'usa')), depots);
  town.frontline.tier = CAPITAL;
  town.frontline.activeAt = T0;
  town.frontline.pressedAt = T0;
  town.frontline.fedAt = T0;
  return town;
}

/** A won raid on the post in `slot` at the front, `minutes` after T0. */
function win(town: TownState, slot: number, minutes = 1): void {
  const base = postAt(town, town.frontline.tier, slot);
  const config = raidConfig(base, [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }], 1);
  applyRaidResult(town, base, makeResolution(), config, T0 + minutes * MIN);
}

const allRoads = (town: TownState): void => {
  win(town, 0, 1);
  win(town, 1, 2);
  win(town, 2, 3);
};

describe('the citadel', () => {
  it('is a shape of its own, and no rung deals it', () => {
    expect(CAPITAL).toBe(13);
    expect(CITADEL_SLOT).toBe(TARGETS_PER_TIER);
    expect(ARCHETYPES.map((a) => a.id)).not.toContain('citadel');
    for (const faction of FACTION_IDS) {
      for (let tier = 1; tier <= CAPITAL + 3; tier++) {
        for (let slot = 0; slot < TARGETS_PER_TIER; slot++) {
          expect(dealPairFor(tier, slot, faction)![0]).not.toBe(CITADEL.id);
        }
      }
    }
  });

  it('is the capital’s fourth post, the same every time, every gun dug in and the richest stores', () => {
    for (const faction of FACTION_IDS) {
      const town = unlockAll(newTown(T0, faction));
      const citadel = postAt(town, CAPITAL, CITADEL_SLOT);
      expect(citadel.archetype).toBe('citadel');
      expect(citadel.variant).toBe(CITADEL_SLOT);
      expect(citadel.tier).toBe(CAPITAL);
      expect(citadel.name).toBe(`THE CITADEL · ${theaterFor(faction).stronghold}`);
      expect(postAt(town, CAPITAL, CITADEL_SLOT)).toEqual(citadel);
      const kit = baseKitFor(faction);
      const guns = citadel.structures.filter((s) => kit.towers.includes(s.kind));
      expect(guns.length, faction).toBe(towerCountFor(CAPITAL, CITADEL_DEAL[faction]!.towers));
      for (const gun of guns) expect(gun.level, faction).toBe(citadel.ccLevel);
      const stores = (base: typeof citadel): number =>
        base.structures.filter((s) => s.kind === kit.cache || s.kind === kit.dump).length;
      const dealt = [0, 1, 2].map((slot) => stores(postAt(town, CAPITAL, slot)));
      expect(stores(citadel), faction).toBeGreaterThan(Math.max(...dealt));
    }
  });
});

describe('the roads', () => {
  it('each has to fall once: three wins on one road do not take the capital', () => {
    const town = atCapital();
    win(town, 2, 1);
    win(town, 2, 2);
    win(town, 2, 3);
    expect(town.frontline.tier).toBe(CAPITAL);
    expect(roadsTaken(town.frontline)).toEqual([2]);
    expect(town.frontline.wins).toBe(1);
    // The repeats paid like any post: they are on the record.
    expect(town.frontline.totalWins).toBe(3);
    expect(citadelInRange(town)).toBe(false);
  });

  it('a road already taken pays, and counts for nothing more', () => {
    const town = atCapital();
    expect(winAtCapital(town, 1, T0)).toEqual({ kind: 'road', slot: 1, roads: 1 });
    expect(winAtCapital(town, 1, T0)).toEqual({ kind: 'road-again', slot: 1, roads: 1 });
    expect(town.frontline.roads).toEqual([1]);
  });

  it('all three put the citadel in range, first on the planner’s list', () => {
    const town = atCapital();
    win(town, 0, 1);
    win(town, 2, 2);
    expect(raidTargetKeys(town).map((k) => k.slot)).toEqual([0, 1, 2]);
    win(town, 1, 3);
    expect(roadsTaken(town.frontline)).toEqual([0, 1, 2]);
    expect(town.frontline.wins).toBe(3);
    expect(citadelInRange(town)).toBe(true);
    // The roads stay on the list: they pay.
    expect(raidTargetKeys(town)).toEqual([
      { tier: CAPITAL, slot: CITADEL_SLOT },
      { tier: CAPITAL, slot: 0 },
      { tier: CAPITAL, slot: 1 },
      { tier: CAPITAL, slot: 2 },
    ]);
  });

  it('a citadel not in range moves nothing', () => {
    const town = atCapital();
    win(town, 0, 1);
    expect(winAtCapital(town, CITADEL_SLOT, T0)).toBeNull();
    expect(town.frontline.wonAt).toBeUndefined();
    expect(town.frontline.tier).toBe(CAPITAL);
  });
});

describe('the war won', () => {
  it('the citadel’s fall wins it, pays the top band’s placement, and the front moves into the rear', () => {
    expect(WAR_WON_PAYOUT).toEqual(LEAGUES[LEAGUES.length - 1]!.placement);
    const town = atCapital();
    allRoads(town);
    const before = { supplies: town.supplies, fuel: town.fuel, intel: town.intel };
    win(town, CITADEL_SLOT, 10);
    expect(town.frontline.wonAt).toBe(T0 + 10 * MIN);
    expect(town.supplies - before.supplies).toBe(WAR_WON_PAYOUT.supplies);
    expect(town.fuel - before.fuel).toBe(WAR_WON_PAYOUT.fuel);
    expect(town.intel - before.intel).toBe(WAR_WON_PAYOUT.intel);
    expect(town.frontline.tier).toBe(CAPITAL + 1);
    expect(town.frontline.wins).toBe(0);
    expect(town.frontline.roads).toBeUndefined();
  });

  it('goes on: past the capital, any three wins take a town again', () => {
    const town = atCapital();
    allRoads(town);
    win(town, CITADEL_SLOT, 10);
    win(town, 2, 11);
    win(town, 2, 12);
    win(town, 2, 13);
    expect(town.frontline.tier).toBe(CAPITAL + 2);
    expect(town.frontline.wonAt).toBe(T0 + 10 * MIN);
  });

  it('a citadel the depots cannot feed wins the war all the same, and the front holds there', () => {
    const town = atCapital(8);
    allRoads(town);
    const supplies = town.supplies;
    win(town, CITADEL_SLOT, 10);
    expect(town.frontline.wonAt).toBe(T0 + 10 * MIN);
    expect(town.supplies - supplies).toBe(WAR_WON_PAYOUT.supplies);
    expect(town.frontline.tier).toBe(CAPITAL);
    expect(town.frontline.roads).toEqual([0, 1, 2]);
    expect(citadelInRange(town)).toBe(true);
    // Fed at last, its next fall takes the stronghold: paid once, dated once.
    withDepots(town, 4);
    win(town, CITADEL_SLOT, 20);
    expect(town.frontline.tier).toBe(CAPITAL + 1);
    expect(town.frontline.wonAt).toBe(T0 + 10 * MIN);
    expect(town.supplies - supplies).toBe(WAR_WON_PAYOUT.supplies);
  });

  it('is on the service record, by the day of the war it was won on', () => {
    const town = atCapital();
    town.log!.startedAt = T0 - 42 * DAY;
    expect(serviceRecord(town, T0).wonDay).toBeNull();
    allRoads(town);
    win(town, CITADEL_SLOT, 10);
    expect(serviceRecord(town, T0 + 9 * DAY).wonDay).toBe(43);
  });
});

describe('falling back', () => {
  it('a front that falls back from the capital loses its roads', () => {
    const town = atCapital();
    win(town, 1, 1);
    win(town, 2, 2);
    // Two sectors behind it are the enemy's; the next quiet strike takes the last.
    town.frontline.lost = [
      { tier: CAPITAL - 1, slot: 0, at: T0 },
      { tier: CAPITAL - 1, slot: 1, at: T0 },
    ];
    const struck = chargeStrikes(town, T0 + 2 * MIN + QUIET_MS);
    expect(struck.map((s) => s.fellBack)).toEqual([true]);
    expect(town.frontline.tier).toBe(CAPITAL - 1);
    expect(town.frontline.roads).toBeUndefined();
    expect(town.frontline.wins).toBe(0);
  });

  it('a war won stays won when the front falls back to the capital, which is taken again by its roads', () => {
    const town = atCapital();
    allRoads(town);
    win(town, CITADEL_SLOT, 10);
    town.frontline.lost = [
      { tier: CAPITAL, slot: 0, at: T0 },
      { tier: CAPITAL, slot: 1, at: T0 },
    ];
    chargeStrikes(town, T0 + 10 * MIN + QUIET_MS);
    expect(town.frontline.tier).toBe(CAPITAL);
    expect(town.frontline.roads).toBeUndefined();
    expect(town.frontline.wonAt).toBe(T0 + 10 * MIN);
    expect(citadelInRange(town)).toBe(false);
  });
});

describe('the map', () => {
  it('marks the roads taken, and draws the citadel past the stronghold', () => {
    const town = atCapital();
    const citadelRow = () => theaterView(town).rows.find((r) => r.citadel)!;
    expect(citadelRow()).toMatchObject({ tier: CAPITAL, name: 'THE CITADEL', state: 'enemy' });
    win(town, 2, 1);
    expect(theaterView(town).roads).toEqual([false, false, true]);
    win(town, 0, 2);
    win(town, 1, 3);
    const view = theaterView(town);
    expect(view.roads).toEqual([true, true, true]);
    expect(view.citadelInRange).toBe(true);
    expect(citadelRow().state).toBe('front');
    const sector = sectorAt(town, CAPITAL, CITADEL_SLOT);
    expect(sector).toMatchObject({ lane: { name: 'THE CITADEL' }, band: 'HQ', retake: false, cutAt: null });
    expect(sector.base.archetype).toBe('citadel');
    win(town, CITADEL_SLOT, 10);
    expect(citadelRow().state).toBe('held');
    expect(theaterView(town).wonAt).toBe(T0 + 10 * MIN);
  });
});

describe('the save', () => {
  it('round-trips the roads and a war won', () => {
    const town = atCapital(8);
    allRoads(town);
    win(town, CITADEL_SLOT, 10);
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.roads).toEqual([0, 1, 2]);
    expect(loaded.frontline.wins).toBe(3);
    expect(loaded.frontline.wonAt).toBe(T0 + 10 * MIN);
  });

  it('repairs junk: roads kept whole and counted, only at the capital, and a war won at no time is not won', () => {
    const town = atCapital();
    const fl = town.frontline as unknown as Record<string, unknown>;
    fl['roads'] = [2, 'x', 2, 7, 0];
    fl['wins'] = 3;
    fl['wonAt'] = 'yesterday';
    normalizeCapital(town);
    expect(town.frontline.roads).toEqual([0, 2]);
    expect(town.frontline.wins).toBe(2);
    expect(town.frontline.wonAt).toBeUndefined();
    town.frontline.tier = CAPITAL - 1;
    normalizeCapital(town);
    expect(town.frontline.roads).toBeUndefined();
  });

  it('a file from before at the capital keeps its pushes as roads, the lightest lanes first', () => {
    const town = atCapital();
    town.frontline.wins = 2;
    delete town.frontline.roads;
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.roads).toEqual([1, 2]);
    expect(loaded.frontline.wins).toBe(2);
  });

  it('a file from before already past the capital took it by the old rule: its war is won, dated to when it was last played', () => {
    const town = atCapital();
    town.frontline.tier = CAPITAL + 2;
    town.lastSeen = T0 + 5 * DAY;
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.wonAt).toBe(T0 + 5 * DAY);
    expect(loaded.frontline.roads).toBeUndefined();
  });
});

describe('the report', () => {
  /** Win on `slot` at the front and return the line the report prints for it. */
  const report = (town: TownState, slot: number, minutes: number): string | null => {
    const fl = town.frontline;
    const before = { tier: fl.tier, roads: [...roadsTaken(fl)], won: fl.wonAt !== undefined };
    win(town, slot, minutes);
    return capitalReport(town, before, slot);
  };

  it('says which road fell, how many have, and when the citadel comes into range', () => {
    const town = atCapital();
    expect(report(town, 2, 1)).toBe('THE COAST RANGE INTO GRAYS HARBOR TAKEN · 1 of 3 roads');
    expect(report(town, 2, 2)).toBe(
      'THE COAST RANGE INTO GRAYS HARBOR WAS TAKEN ALREADY · the win pays, and the capital wants its other roads',
    );
    report(town, 0, 3);
    expect(report(town, 1, 4)).toBe(
      'THE BEACHES INTO GRAYS HARBOR TAKEN · all three roads have fallen, and THE CITADEL IS IN RANGE',
    );
  });

  it('says the war is won, and where the front went', () => {
    const town = atCapital();
    allRoads(town);
    expect(report(town, CITADEL_SLOT, 10)).toBe(
      'THE CITADEL AT GRAYS HARBOR FALLS · THE WAR IS WON · the front moves into GRAYS HARBOR REAR 1',
    );
    const held = atCapital(8);
    allRoads(held);
    expect(report(held, CITADEL_SLOT, 10)).toBe(
      'THE CITADEL AT GRAYS HARBOR FALLS · THE WAR IS WON · GRAYS HARBOR HOLDS: the depots cannot feed ' +
        'the line with it, 1365 an hour, and they make 1320',
    );
    expect(report(held, CITADEL_SLOT, 20)).toMatch(/^THE CITADEL AT GRAYS HARBOR FALLS AGAIN · GRAYS HARBOR HOLDS/);
  });

  it('has nothing to say about a raid that did not go out from the capital', () => {
    const town = atCapital();
    town.frontline.tier = CAPITAL - 1;
    expect(report(town, 0, 1)).toBeNull();
  });
});
