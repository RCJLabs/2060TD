import { describe, expect, it } from 'vitest';
import { withDepots } from './helpers';
import { FACTION_IDS } from '../src/content/factions';
import { SACK_LOSS_FRACTION } from '../src/content/buildings';
import { LAST_STAND_HELD, LAST_STAND_LOST } from '../src/content/leagues';
import { LAST_STAND_LEVEL, QUIET_MS, STRIKE_INTERVAL_MS } from '../src/content/theaters';
import {
  applyLastStand,
  canMarch,
  claimLastStand,
  declineLastStand,
  lastStandBounty,
  lastStandLevel,
  normalizeLastStand,
  resolveLapsedLastStand,
  standConfig,
} from '../src/meta/laststand';
import { serviceRecord } from '../src/meta/record';
import { deserialize, serialize } from '../src/meta/save';
import { chargeStrikes } from '../src/meta/strikes';
import { caps, newTown, townCc, unlockAll, type SiegeOutcome, type TownState } from '../src/meta/town';
import { DEFENSE_OFFER_MS, PROBE_SHIELD_MS, runOfflineProbes } from '../src/meta/warfare';
import { vaultOf } from '../src/meta/vault';

/** M25 Phase 4c: the enemy marches on a capital whose front has been pushed back to the first town. */

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const MARCH = T0 + QUIET_MS;

/** A war pushed back to the first town from `deepest`, quiet since T0. */
function pushedBack(deepest = 4): TownState {
  const town = withDepots(unlockAll(newTown(T0, 'usa')), 2);
  town.frontline.tier = 1;
  if (deepest > 1) town.frontline.deepest = deepest;
  town.frontline.activeAt = T0;
  town.frontline.pressedAt = T0;
  town.frontline.fedAt = T0;
  return town;
}

/** The same war, the march sounded and waiting on an answer. */
function marched(): TownState {
  const town = pushedBack();
  chargeStrikes(town, MARCH + 5 * MIN);
  expect(town.frontline.lastStand).toBeDefined();
  return town;
}

const cleanStats = () => ({
  spawned: 0,
  kills: 0,
  wallsBuilt: 0,
  wallsLost: 0,
  structuresLost: 0,
  suppliesSpent: 0,
  cpSpent: 0,
  salvage: 0,
});

/** A last stand's end: held with everything standing, or lost with nothing. */
const outcomeOf = (town: TownState, victory: boolean): SiegeOutcome => ({
  victory,
  supplies: Math.floor(town.supplies),
  chargesLeft: { ...town.charges },
  walls: town.walls.map((w) => ({ ...w })),
  survivors: victory
    ? town.structures.filter((s) => s.kind !== 'cc').map((s) => ({ cell: s.cell, kind: s.kind, level: s.level }))
    : [],
  stats: cleanStats(),
  ccHpFraction: victory ? 1 : 0,
});

describe('the march', () => {
  it('a quiet strike on a front pushed back to the first town marches on the capital', () => {
    const town = pushedBack();
    expect(canMarch(town)).toBe(true);
    const now = MARCH + 5 * MIN;
    // Nothing behind the front to retake: no sector falls.
    expect(chargeStrikes(town, now)).toEqual([]);
    expect(town.frontline.lastStand).toMatchObject({
      at: MARCH,
      level: LAST_STAND_LEVEL.usa[1],
      expiresAt: now + DEFENSE_OFFER_MS,
    });
    expect(canMarch(town)).toBe(false);
  });

  it('never in a war whose front was never past the first town', () => {
    const town = pushedBack(1);
    expect(canMarch(town)).toBe(false);
    chargeStrikes(town, MARCH + 3 * DAY);
    expect(town.frontline.lastStand).toBeUndefined();
  });

  it('once a quiet spell, and never while one waits', () => {
    const town = marched();
    const first = town.frontline.lastStand;
    chargeStrikes(town, MARCH + STRIKE_INTERVAL_MS + MIN);
    expect(town.frontline.lastStand).toEqual(first);
  });

  it('comes in the contested band for the town’s faction and command post', () => {
    for (const faction of FACTION_IDS) {
      const town = pushedBack();
      town.faction = faction;
      const levels = LAST_STAND_LEVEL[faction];
      // A CC1 town's band is one level wide, and the same level for all five.
      expect(levels[1]).toBe(3);
      for (const level of [1, 2, 3]) {
        townCc(town).level = level;
        expect(lastStandLevel(town)).toBe(levels[level]);
      }
      // Each size's comes later than the size below's.
      expect(levels[2]!).toBeGreaterThan(levels[1]!);
      expect(levels[3]!).toBeGreaterThan(levels[2]!);
    }
  });

  it('a front that falls back remembers how deep it had been, and forgets once it is back there', () => {
    const town = pushedBack(1);
    town.frontline.tier = 3;
    town.frontline.lost = [
      { tier: 2, slot: 0, at: T0 },
      { tier: 2, slot: 1, at: T0 },
    ];
    chargeStrikes(town, MARCH);
    expect(town.frontline.tier).toBe(2);
    expect(town.frontline.deepest).toBe(3);
    town.frontline.lost = [
      { tier: 1, slot: 0, at: T0 },
      { tier: 1, slot: 1, at: T0 },
    ];
    chargeStrikes(town, MARCH + STRIKE_INTERVAL_MS);
    expect(town.frontline.tier).toBe(1);
    expect(town.frontline.deepest).toBe(3);
  });
});

describe('held', () => {
  it('in person: the enemy is thrown back, the bounty and standing paid, and the quiet clock restarted', () => {
    const town = marched();
    const stand = town.frontline.lastStand!;
    town.supplies = 0;
    town.fuel = 0;
    const now = MARCH + 20 * MIN;
    const result = applyLastStand(town, stand, outcomeOf(town, true), standConfig(town)!, now, true);
    const bounty = lastStandBounty(stand.level);
    expect(result).toMatchObject({ held: true, live: true, level: stand.level, suppliesLost: 0, bounty });
    const cap = caps(town);
    expect(town.supplies).toBe(Math.min(bounty.supplies, cap.supplies));
    expect(town.fuel).toBe(Math.min(bounty.fuel, cap.fuel));
    expect(town.frontline.standing).toBe(LAST_STAND_HELD);
    expect(town.frontline.lastStand).toBeUndefined();
    expect(town.frontline.activeAt).toBe(now);
    expect(town.log!.lastStandsHeld).toBe(1);
    expect(town.defenseLog[0]).toMatchObject({ lastStand: true, live: true, held: true, level: stand.level });
  });

  it('by the garrison: the same pay, but no quiet time bought, and the battle is filed', () => {
    const town = marched();
    const stand = town.frontline.lastStand!;
    const now = MARCH + 20 * MIN;
    applyLastStand(town, stand, outcomeOf(town, true), standConfig(town)!, now, false);
    expect(town.frontline.activeAt).toBe(T0);
    expect(vaultOf(town)[0]).toMatchObject({ title: `LAST STAND — LEVEL ${stand.level}`, won: true });
  });
});

describe('sacked', () => {
  it('every building that fell is wrecked, forty per cent of the stores go, and standing with them', () => {
    const town = marched();
    const stand = town.frontline.lastStand!;
    town.supplies = 1000;
    town.fuel = 500;
    town.intel = 100;
    town.frontline.standing = 300;
    const now = MARCH + 20 * MIN;
    const result = applyLastStand(town, stand, outcomeOf(town, false), standConfig(town)!, now, true);
    expect(SACK_LOSS_FRACTION).toBe(0.4);
    expect(result.held).toBe(false);
    expect(town.supplies).toBe(600);
    expect(town.fuel).toBe(300);
    expect(town.intel).toBe(60);
    expect(result.suppliesLost).toBe(400);
    for (const s of town.structures) expect(s.wrecked, s.kind).toBe(s.kind !== 'cc');
    expect(town.frontline.standing).toBe(300 + LAST_STAND_LOST);
    expect(town.shieldUntil).toBe(now + PROBE_SHIELD_MS);
    expect(town.log!.sacks).toBe(1);
    expect(town.log!.sackedAt).toBe(stand.at);
  });

  it('cannot end the war: it goes on from the first town, and a war won stays won', () => {
    const town = marched();
    town.frontline.wonAt = T0 - DAY;
    applyLastStand(town, town.frontline.lastStand!, outcomeOf(town, false), standConfig(town)!, MARCH + MIN, true);
    expect(town.frontline.tier).toBe(1);
    expect(town.frontline.wonAt).toBe(T0 - DAY);
  });
});

describe('the two answers', () => {
  it('defending fights the march’s own battle, the whole assault at its level', () => {
    const town = marched();
    const config = standConfig(town)!;
    expect(config.seed).toBe(town.frontline.lastStand!.seed);
    expect(standConfig(town)).toEqual(config);
  });

  it('left to the garrison, it fights the whole assault, and a town with nothing standing but its post loses it', () => {
    const town = marched();
    town.structures = town.structures.filter((s) => s.kind === 'cc');
    const result = declineLastStand(town, MARCH + 10 * MIN)!;
    expect(result).toMatchObject({ held: false, live: false });
    expect(town.frontline.lastStand).toBeUndefined();
    expect(town.log!.sacks).toBe(1);
    expect(town.defenseLog[0]).toMatchObject({ lastStand: true, held: false });
    expect(town.defenseLog[0]!.live).toBeUndefined();
  });

  it('a window that shuts unanswered is the garrison’s, on the next load', () => {
    const town = marched();
    const { expiresAt } = town.frontline.lastStand!;
    expect(resolveLapsedLastStand(town, expiresAt - 1)).toBeNull();
    const ran = runOfflineProbes(town, expiresAt + MIN);
    expect(ran[0]).toMatchObject({ lastStand: true });
    expect(town.frontline.lastStand).toBeUndefined();
  });

  it('claimed and walked out on, it is the garrison’s at once on the next load', () => {
    const town = marched();
    const stand = claimLastStand(town)!;
    expect(town.frontline.lastStand!.expiresAt).toBe(stand.at);
    expect(resolveLapsedLastStand(town, MARCH + 10 * MIN)).not.toBeNull();
  });
});

describe('the save and the record', () => {
  it('round-trips the march, how deep the war went, and the counts', () => {
    const town = marched();
    town.log!.lastStandsHeld = 2;
    town.log!.sacks = 1;
    town.log!.sackedAt = T0 - DAY;
    const loaded = deserialize(serialize(town))!;
    expect(loaded.frontline.lastStand).toEqual(town.frontline.lastStand);
    expect(loaded.frontline.deepest).toBe(4);
    expect(loaded.log).toMatchObject({ lastStandsHeld: 2, sacks: 1, sackedAt: T0 - DAY });
  });

  it('repairs junk: a march kept only whole, a depth only past the front', () => {
    const town = marched();
    const fl = town.frontline as unknown as Record<string, unknown>;
    fl['lastStand'] = { at: MARCH, level: 'high', seed: 1, expiresAt: MARCH };
    fl['deepest'] = 1;
    normalizeLastStand(town.frontline);
    expect(town.frontline.lastStand).toBeUndefined();
    expect(town.frontline.deepest).toBeUndefined();
    fl['deepest'] = 'far';
    normalizeLastStand(town.frontline);
    expect(town.frontline.deepest).toBeUndefined();
  });

  it('puts the last stands and the sacks on the service record', () => {
    const town = marched();
    town.log!.startedAt = T0 - 9 * DAY;
    applyLastStand(town, town.frontline.lastStand!, outcomeOf(town, false), standConfig(town)!, MARCH + MIN, true);
    const record = serviceRecord(town, MARCH + DAY);
    expect(record).toMatchObject({ sacks: 1, lastStandsHeld: 0 });
    expect(record.sackedDay).toBe(Math.floor((MARCH - (T0 - 9 * DAY)) / DAY) + 1);
  });
});
