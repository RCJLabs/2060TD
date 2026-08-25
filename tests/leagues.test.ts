import { makeResolution } from './helpers';
import { describe, expect, it } from 'vitest';
import {
  clearStanding,
  leagueAt,
  nextLeagueAfter,
  seasonAt,
  seasonEnd,
  seasonNumber,
  seasonStart,
  DAY_MS,
  DECAY_GRACE_MS,
  DECAY_PER_DAY,
  LEAGUES,
  LEAGUE_BY_ID,
  SEASON_MS,
} from '../src/content/leagues';
import { generateBase } from '../src/content/bases';
import { conditionAt } from '../src/content/conditions';
import {
  awardStanding,
  decayStartsAt,
  ladderPayout,
  leagueOf,
  probeAward,
  settleLadder,
  standingToNext,
} from '../src/meta/ladder';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, tick, unlockAll, type TownState } from '../src/meta/town';
import { applyRaidResult, probeLevel, raidConfig, type SquadPlan } from '../src/meta/warfare';

/** Comfortably after LADDER_EPOCH, mid-season, so nothing wraps by accident. */
const T0 = Date.UTC(2026, 2, 10, 12);
const HOUR = 3_600_000;
/** Start of T0's season: decay tests need a week of runway before a rollover. */
const TS = seasonStart(seasonAt(T0)) + HOUR;

const devTown = (now = T0): TownState => {
  const town = unlockAll(newTown(now));
  town.supplies = 1000;
  town.fuel = 500;
  town.intel = 100;
  return town;
};

describe('league bands', () => {
  it('sorts ascending, starts at zero, and every floor names its own band', () => {
    expect(LEAGUES[0]!.floor).toBe(0);
    for (let i = 1; i < LEAGUES.length; i++) {
      expect(LEAGUES[i]!.floor).toBeGreaterThan(LEAGUES[i - 1]!.floor);
      // A better band is never a worse deal, and never lighter to carry.
      expect(LEAGUES[i]!.loot).toBeGreaterThanOrEqual(LEAGUES[i - 1]!.loot);
      expect(LEAGUES[i]!.probePressure).toBeGreaterThanOrEqual(LEAGUES[i - 1]!.probePressure);
      expect(LEAGUES[i]!.placement.supplies).toBeGreaterThan(LEAGUES[i - 1]!.placement.supplies);
    }
    for (const league of LEAGUES) {
      expect(leagueAt(league.floor).id).toBe(league.id);
      expect(LEAGUE_BY_ID[league.id]).toBe(league);
      // The short form shares a row with a faction name on a phone.
      expect(league.short.length, league.short).toBeLessThanOrEqual(4);
      expect(league.short.length).toBeGreaterThan(0);
    }
  });

  it('holds the band until the next floor is actually reached', () => {
    expect(leagueAt(0).id).toBe('irregulars');
    expect(leagueAt(149).id).toBe('irregulars');
    expect(leagueAt(150).id).toBe('line');
    expect(leagueAt(399).id).toBe('line');
    expect(leagueAt(1400).id).toBe('iron');
    expect(leagueAt(99_999).id).toBe('iron');
    expect(nextLeagueAfter(0)?.id).toBe('line');
    expect(nextLeagueAfter(1400)).toBeNull();
  });

  it('pays deeper rungs more', () => {
    expect(clearStanding(5)).toBeGreaterThan(clearStanding(1));
    expect(clearStanding(0)).toBe(clearStanding(1)); // tier 0 is a duel, never a rung
  });
});

describe('standing', () => {
  it('clamps at zero, tracks the peak, and restarts the grace when you play', () => {
    const town = devTown();
    awardStanding(town, 200, T0);
    expect(town.frontline.standing).toBe(200);
    expect(town.frontline.peak).toBe(200);
    expect(leagueOf(town).id).toBe('line');
    expect(standingToNext(town)).toBe(200); // 400 - 200

    awardStanding(town, -500, T0 + HOUR);
    expect(town.frontline.standing).toBe(0);
    expect(town.frontline.peak).toBe(200); // the peak is a record, not a balance
    expect(town.frontline.activeAt).toBe(T0 + HOUR);
    expect(decayStartsAt(town)).toBe(T0 + HOUR + DECAY_GRACE_MS);
  });

  it('leaves an offline probe off the grace clock', () => {
    const town = devTown();
    awardStanding(town, 100, T0);
    awardStanding(town, probeAward(true), T0 + 10 * HOUR, false);
    // The garrison held, so the number moved — but sitting behind it is not
    // playing, and it bought no quiet time.
    expect(town.frontline.standing).toBe(105);
    expect(town.frontline.activeAt).toBe(T0);
  });
});

describe('decay', () => {
  it('costs nothing inside the grace, then bleeds a fixed rate', () => {
    const town = devTown(TS);
    awardStanding(town, 300, TS);

    expect(settleLadder(town, TS + DECAY_GRACE_MS - HOUR).decayed).toBe(0);
    expect(town.frontline.standing).toBe(300);

    const twoDays = settleLadder(town, TS + DECAY_GRACE_MS + 2 * DAY_MS);
    expect(twoDays.decayed).toBe(2 * DECAY_PER_DAY);
    expect(town.frontline.standing).toBe(300 - 2 * DECAY_PER_DAY);
  });

  it('charges the same whether it settles once or a hundred times', () => {
    const once = devTown(TS);
    const often = devTown(TS);
    awardStanding(once, 400, TS);
    awardStanding(often, 400, TS);

    const end = TS + DECAY_GRACE_MS + 5 * DAY_MS;
    settleLadder(once, end);
    // Every load, every redraw, every scene change settles again: a cursor
    // that dropped the sub-point remainder would make absence free.
    for (let i = 1; i <= 120; i++) settleLadder(often, TS + ((end - TS) * i) / 120);

    expect(often.frontline.standing).toBe(once.frontline.standing);
    expect(once.frontline.standing).toBe(400 - 5 * DECAY_PER_DAY);
  });

  it('stops at zero and never goes negative, however long the silence', () => {
    const town = devTown(TS);
    awardStanding(town, 40, TS);
    settleLadder(town, TS + 400 * DAY_MS);
    expect(town.frontline.standing).toBe(0);
    expect(settleLadder(town, TS + 800 * DAY_MS).decayed).toBe(0);
  });

  it('ignores a clock that jumped backwards', () => {
    const town = devTown(TS);
    awardStanding(town, 200, TS);
    settleLadder(town, TS + DECAY_GRACE_MS + DAY_MS);
    const after = town.frontline.standing;
    expect(settleLadder(town, TS).decayed).toBe(0);
    expect(town.frontline.standing).toBe(after);
  });
});

describe('seasons', () => {
  it('numbers from one and tiles the calendar without gaps', () => {
    const s = seasonAt(T0);
    expect(seasonNumber(s)).toBe(s + 1);
    expect(seasonStart(s)).toBeLessThanOrEqual(T0);
    expect(seasonEnd(s)).toBeGreaterThan(T0);
    expect(seasonEnd(s) - seasonStart(s)).toBe(SEASON_MS);
    expect(seasonAt(seasonEnd(s))).toBe(s + 1);
  });

  it('places on the PEAK band, pays it once, and carries a quarter forward', () => {
    const town = devTown();
    const season = town.frontline.season;
    town.frontline.peak = 900; // touched SHOCK earlier in the season
    town.frontline.standing = 500; // and slid back to VANGUARD by the end
    town.frontline.activeAt = seasonEnd(season); // isolate the placement from decay
    town.frontline.settledAt = seasonEnd(season) - HOUR;
    const supplies = town.supplies;
    const intel = town.intel;

    const result = settleLadder(town, seasonEnd(season) + HOUR);

    expect(result.placement?.season).toBe(season);
    expect(result.placement?.league).toBe('shock');
    expect(result.placement?.peak).toBe(900);
    expect(town.supplies).toBe(supplies + LEAGUE_BY_ID.shock.placement.supplies);
    expect(town.intel).toBe(intel + LEAGUE_BY_ID.shock.placement.intel);
    expect(town.frontline.standing).toBe(125); // 500 × 0.25
    expect(town.frontline.peak).toBe(125);
    expect(town.frontline.season).toBe(season + 1);
    expect(town.frontline.placements).toHaveLength(1);

    // Settling again inside the new season must not pay twice.
    const again = settleLadder(town, seasonEnd(season) + 2 * HOUR);
    expect(again.placement).toBeNull();
    expect(again.payout.supplies).toBe(0);
  });

  it('places once for a save that slept through several seasons', () => {
    const town = devTown();
    const season = town.frontline.season;
    town.frontline.peak = 200;
    town.frontline.standing = 200;

    const result = settleLadder(town, seasonStart(season + 4));
    expect(result.placement?.season).toBe(season);
    expect(town.frontline.placements).toHaveLength(1); // empty seasons place nothing
    expect(town.frontline.season).toBe(season + 4);
  });

  it('is settled by tick(), so a placement lands the moment the game opens', () => {
    const town = devTown();
    const season = town.frontline.season;
    town.frontline.peak = 450;
    town.frontline.standing = 450;
    const settlement = tick(town, seasonEnd(season) + HOUR);
    expect(settlement.placement?.league).toBe('vanguard');
    expect(settlement.payout.supplies).toBe(LEAGUE_BY_ID.vanguard.placement.supplies);
  });
});

describe('the board and the war', () => {
  const win = makeResolution({ ticks: 100 });
  const loss = makeResolution({
    ticks: 100,
    cleared: false,
    objectiveMet: false,
    destructionPct: 0.2,
    ccHpFraction: 0.6,
  });
  const plan: SquadPlan[] = [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }];

  it('pays standing for a rung and takes it back for a failed raid', () => {
    const town = devTown();
    const base = generateBase(3, 0);
    const config = raidConfig(base, plan, 1);

    applyRaidResult(town, base, win, config, T0);
    const earned = town.frontline.standing;
    expect(earned).toBeGreaterThan(0);

    applyRaidResult(town, base, loss, config, T0 + HOUR);
    expect(town.frontline.standing).toBeLessThan(earned);
    expect(town.frontline.peak).toBe(earned);
  });

  it('leaves the board alone for a code duel', () => {
    const town = devTown();
    const shared = { ...generateBase(1, 0), tier: 0 };
    const config = raidConfig(shared, plan, 1);
    applyRaidResult(town, shared, win, config, T0, { fingerprint: 'abc' });
    expect(town.frontline.standing).toBe(0);
    expect(town.frontline.totalWins).toBe(0);
  });

  it('makes standing visible: a higher band draws heavier probes', () => {
    const town = devTown();
    town.assaultLevel = 4;
    town.frontline.tier = 5;
    const quiet = probeLevel(town);
    town.frontline.standing = LEAGUE_BY_ID.iron.floor;
    expect(probeLevel(town)).toBe(quiet + LEAGUE_BY_ID.iron.probePressure);
  });

  it('multiplies the band bonus by the day', () => {
    const town = devTown();
    town.frontline.standing = LEAGUE_BY_ID.iron.floor;
    const today = conditionAt(T0);
    const payout = ladderPayout(town, T0);
    expect(payout.supplies).toBeCloseTo(LEAGUE_BY_ID.iron.loot * today.loot.supplies, 6);
    expect(payout.fuel).toBeCloseTo(LEAGUE_BY_ID.iron.loot * today.loot.fuel, 6);
    // The bottom band with nothing on the wire is exactly par.
    const rookie = devTown();
    const par = ladderPayout(rookie, seasonStart(seasonAt(T0)));
    expect(par.supplies).toBeCloseTo(conditionAt(seasonStart(seasonAt(T0))).loot.supplies, 6);
  });
});

describe('save migration', () => {
  it('seeds a pre-league save from the rungs it already cleared', () => {
    const town = devTown();
    const legacy = JSON.parse(serialize(town)) as { town: Record<string, unknown> };
    legacy.town['version'] = 5;
    (legacy.town['frontline'] as Record<string, unknown>) = {
      tier: 4, wins: 1, totalWins: 10, pendingCounterattack: false, scouted: [],
    };
    const migrated = deserialize(JSON.stringify(legacy))!;
    expect(migrated).not.toBeNull();
    expect(migrated.version).toBe(6);
    expect(migrated.frontline.standing).toBe(120); // 10 wins × 12
    expect(migrated.frontline.peak).toBe(120);
    expect(migrated.frontline.placements).toEqual([]);
    expect(migrated.frontline.season).toBe(seasonAt(migrated.lastSeen));
  });

  it('caps the seeding below the top bands however long the war has run', () => {
    const town = devTown();
    const legacy = JSON.parse(serialize(town)) as { town: Record<string, unknown> };
    legacy.town['version'] = 5;
    (legacy.town['frontline'] as Record<string, unknown>) = {
      tier: 30, wins: 0, totalWins: 999, pendingCounterattack: false, scouted: [],
    };
    const migrated = deserialize(JSON.stringify(legacy))!;
    expect(migrated.frontline.standing).toBe(LEAGUE_BY_ID.vanguard.floor);
    expect(leagueAt(migrated.frontline.standing).id).toBe('vanguard');
  });

  it('repairs a junk league block instead of rejecting the save', () => {
    const town = devTown();
    const raw = JSON.parse(serialize(town)) as { town: Record<string, unknown> };
    const fl = raw.town['frontline'] as Record<string, unknown>;
    delete fl['standing'];
    delete fl['season'];
    fl['settledAt'] = 'yesterday';
    fl['peak'] = Number.NaN;
    fl['placements'] = 'none';

    const repaired = deserialize(JSON.stringify(raw))!;
    expect(repaired).not.toBeNull();
    expect(repaired.frontline.standing).toBe(0);
    expect(repaired.frontline.peak).toBe(0);
    expect(repaired.frontline.season).toBe(seasonAt(repaired.lastSeen));
    expect(repaired.frontline.settledAt).toBe(repaired.lastSeen);
    expect(repaired.frontline.placements).toEqual([]);
  });

  it('round-trips a town that has a season on the record', () => {
    const town = devTown();
    town.frontline.standing = 640;
    town.frontline.peak = 700;
    town.frontline.placements = [
      { season: town.frontline.season - 1, league: 'vanguard', peak: 480, at: T0 - SEASON_MS },
    ];
    const back = deserialize(serialize(town))!;
    expect(back.frontline.standing).toBe(640);
    expect(back.frontline.placements).toHaveLength(1);
    expect(back.frontline.placements[0]!.league).toBe('vanguard');
  });
});
