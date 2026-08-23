import { describe, expect, it } from 'vitest';
import { generateBase } from '../src/content/bases';
import { RAID_CATALOG } from '../src/content/catalog';
import { DAY_MS, LADDER_EPOCH, LEAGUES } from '../src/content/leagues';
import {
  contractDay,
  contractsAfter,
  contractsAt,
  contractsEndAt,
  CONTRACTS,
  CONTRACTS_PER_DAY,
} from '../src/content/contracts';
import {
  contractPay,
  contractState,
  contractsDone,
  creditContracts,
  normalizeContracts,
} from '../src/meta/contracts';
import { deserialize, serialize } from '../src/meta/save';
import {
  applyCounterResult,
  applySiegeResult,
  newTown,
  place,
  placeWall,
  queueTrain,
  structureAt,
  tick,
  unlockAll,
  TOWN_GRID,
  type SiegeOutcome,
  type TownState,
} from '../src/meta/town';
import {
  applyRaidResult,
  raidConfig,
  resolveRaid,
  scoutTarget,
  type SquadPlan,
} from '../src/meta/warfare';

/** Noon on a day well after the epoch, so day indexes are positive and plain. */
const T0 = LADDER_EPOCH + 100 * DAY_MS + 12 * 3_600_000;
const idx = (x: number, y: number): number => y * TOWN_GRID.width + x;

const armed = (now = T0): TownState => {
  const town = unlockAll(newTown(now));
  town.supplies = 50_000;
  town.fuel = 50_000;
  town.intel = 5_000;
  town.army = { ranger: 20, abrams: 6, javelin: 8, engineer: 6 };
  return town;
};

describe('the day\'s orders', () => {
  it('posts one of each category, every day', () => {
    for (let day = 0; day < 70; day++) {
      const today = contractsAt(LADDER_EPOCH + day * DAY_MS + 9 * 3_600_000);
      expect(today).toHaveLength(CONTRACTS_PER_DAY);
      expect(today.map((c) => c.category)).toEqual(['offense', 'defense', 'home']);
    }
  });

  it('is the same for everyone, all day, with no schedule stored anywhere', () => {
    const morning = contractsAt(LADDER_EPOCH + 5 * DAY_MS + 60_000);
    const night = contractsAt(LADDER_EPOCH + 6 * DAY_MS - 60_000);
    expect(night.map((c) => c.id)).toEqual(morning.map((c) => c.id));
    expect(contractsAt(LADDER_EPOCH + 6 * DAY_MS).map((c) => c.id)).not.toEqual(
      morning.map((c) => c.id),
    );
  });

  it('says when the orders lapse, and what replaces them', () => {
    const now = LADDER_EPOCH + 5 * DAY_MS + 3 * 3_600_000;
    expect(contractsEndAt(now)).toBe(LADDER_EPOCH + 6 * DAY_MS);
    expect(contractsAfter(now).map((c) => c.id)).toEqual(
      contractsAt(contractsEndAt(now)).map((c) => c.id),
    );
  });

  it('does not repeat the same three for two months', () => {
    const seen = new Set<string>();
    for (let day = 0; day < 60; day++) {
      seen.add(
        contractsAt(LADDER_EPOCH + day * DAY_MS)
          .map((c) => c.id)
          .join('|'),
      );
    }
    // Pools of 5, 4 and 6 give a 60-day cycle; one pool of 15 would repeat
    // every 15 and pin each contract to the same weekday forever.
    expect(seen.size).toBe(60);
  });

  it('handles a clock set before the epoch without collapsing', () => {
    const before = LADDER_EPOCH - 3 * DAY_MS;
    expect(contractDay(before)).toBeLessThan(0);
    expect(contractsAt(before)).toHaveLength(CONTRACTS_PER_DAY);
  });

  it('fits the narrow rail, and asks for something in every line', () => {
    for (const c of CONTRACTS) {
      // Labels are panel headings: one unwrapped line.
      expect(c.label.length).toBeLessThanOrEqual(26);
      expect(c.label).toBe(c.label.toUpperCase());
      expect(c.brief.length).toBeGreaterThan(20);
      expect(c.goal).toBeGreaterThan(0);
      expect(c.pay.supplies + c.pay.fuel + c.pay.intel).toBeGreaterThan(0);
    }
    expect(new Set(CONTRACTS.map((c) => c.id)).size).toBe(CONTRACTS.length);
  });

  it('never pays standing — the one number that falls on its own', () => {
    for (const c of CONTRACTS) {
      expect(Object.keys(c.pay).sort()).toEqual(['fuel', 'intel', 'supplies']);
    }
  });
});

describe('progress', () => {
  it('starts a fresh sheet, and rolls it over at midnight', () => {
    const town = armed();
    const state = contractState(town, T0);
    expect(state.day).toBe(contractDay(T0));
    expect(state.progress).toEqual([0, 0, 0]);

    state.progress[0] = 1;
    // Same day, later: the sheet is kept.
    expect(contractState(town, T0 + 3_600_000).progress[0]).toBe(1);
    // Next day: new orders, and yesterday's half-finished work does not
    // count against them.
    expect(contractState(town, T0 + DAY_MS).progress).toEqual([0, 0, 0]);
  });

  it('pays the moment a contract finishes, without waiting to be claimed', () => {
    const town = armed();
    const home = contractsAt(T0)[2]!;
    const before = { s: town.supplies, f: town.fuel, i: town.intel };
    const paid = creditContracts(town, home.metric, home.goal, T0);
    expect(paid).toHaveLength(1);
    expect(paid[0]!.contract.id).toBe(home.id);
    // What it paid is kept, so a screen never has to guess the band it was
    // paid at — a raid can finish a contract and move the band in one breath.
    expect(contractState(town, T0).pay[2]).toEqual(paid[0]!.pay);
    expect(town.supplies).toBeGreaterThan(before.s);
    expect(town.fuel).toBeGreaterThan(before.f);
    expect(town.intel).toBeGreaterThan(before.i);
    expect(contractsDone(town, T0)).toBe(1);
  });

  it('pays once, however much more arrives', () => {
    const town = armed();
    const home = contractsAt(T0)[2]!;
    creditContracts(town, home.metric, home.goal, T0);
    const banked = town.supplies;
    expect(creditContracts(town, home.metric, home.goal * 5, T0)).toEqual([]);
    expect(town.supplies).toBe(banked);
  });

  it('accumulates across a day rather than needing one big result', () => {
    const town = armed();
    const home = contractsAt(T0)[2]!;
    for (let i = 0; i < home.goal - 1; i++) {
      expect(creditContracts(town, home.metric, 1, T0)).toEqual([]);
    }
    expect(creditContracts(town, home.metric, 1, T0)).toHaveLength(1);
  });

  it('ignores a metric no contract is asking for today', () => {
    const town = armed();
    const wanted = new Set(contractsAt(T0).map((c) => c.metric));
    const unwanted = CONTRACTS.map((c) => c.metric).find((m) => !wanted.has(m))!;
    const before = town.supplies;
    expect(creditContracts(town, unwanted, 999, T0)).toEqual([]);
    expect(town.supplies).toBe(before);
  });

  it('ignores a credit of nothing', () => {
    const town = armed();
    const home = contractsAt(T0)[2]!;
    expect(creditContracts(town, home.metric, 0, T0)).toEqual([]);
    expect(contractState(town, T0).progress).toEqual([0, 0, 0]);
  });

  it('pays at the commander\'s band, not a flat rate', () => {
    const low = armed();
    const high = armed();
    high.frontline.standing = LEAGUES[LEAGUES.length - 1]!.floor;
    const contract = contractsAt(T0)[0]!;
    expect(contractPay(high, contract).supplies).toBeGreaterThan(
      contractPay(low, contract).supplies,
    );
    // Goals stay flat; the band is what keeps the errand worth an afternoon.
    expect(contract.goal).toBe(contractsAt(T0)[0]!.goal);
  });
});

describe('what actually counts', () => {
  /** Force a specific day so the metric under test is one of today's three. */
  const dayWith = (metric: string): number => {
    for (let day = 0; day < 90; day++) {
      const at = LADDER_EPOCH + day * DAY_MS + 12 * 3_600_000;
      if (contractsAt(at).some((c) => c.metric === metric)) return at;
    }
    throw new Error(`no day asks for ${metric}`);
  };

  it('counts a raid: the post, the wreckage and the haul', () => {
    const now = dayWith('postsTaken');
    const town = armed(now);
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [
      { units: { ranger: 6, abrams: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
    ];
    const config = raidConfig(base, plan, 7);
    const res = resolveRaid(config, plan, 1, RAID_CATALOG);
    applyRaidResult(town, base, res, config, now);
    const state = contractState(town, now);
    const posts = contractsAt(now).findIndex((c) => c.metric === 'postsTaken');
    expect(state.progress[posts]).toBe(res.cleared ? 1 : 0);
  });

  it('counts a wall segment, and a building broken ground on', () => {
    const now = dayWith('walls');
    const town = armed(now);
    const wallsAt = contractsAt(now).findIndex((c) => c.metric === 'walls');
    placeWall(town, idx(19, 5), now);
    placeWall(town, idx(19, 6), now);
    expect(contractState(town, now).progress[wallsAt]).toBe(2);
  });

  it('counts a unit put into the training lines', () => {
    const now = dayWith('trained');
    const town = armed(now);
    town.army = {}; // the standing army in `armed` fills the manpower cap
    place(town, 'barracks', idx(24, 8), now - 1_000_000);
    tick(town, now);
    const barracks = structureAt(town, idx(24, 8))!;
    const at = contractsAt(now).findIndex((c) => c.metric === 'trained');
    expect(queueTrain(town, barracks.id, 'ranger', now)).toBe(true);
    expect(contractState(town, now).progress[at]).toBe(1);
  });

  it('counts a scouted target', () => {
    const now = dayWith('scouted');
    const town = armed(now);
    const at = contractsAt(now).findIndex((c) => c.metric === 'scouted');
    expect(scoutTarget(town, 1, 0, now)).toBe(true);
    expect(contractState(town, now).progress[at]).toBe(1);
  });

  it('counts a siege held at home, and a counterattack broken', () => {
    const outcome: SiegeOutcome = {
      victory: true,
      supplies: 500,
      chargesLeft: {},
      walls: [],
      survivors: [],
      stats: {
        spawned: 0,
        kills: 0,
        wallsBuilt: 0,
        wallsLost: 0,
        structuresLost: 0,
        suppliesSpent: 0,
        cpSpent: 0,
        salvage: 0,
      },
      ccHpFraction: 1,
    };
    const sieges = dayWith('siegesWon');
    const town = armed(sieges);
    const at = contractsAt(sieges).findIndex((c) => c.metric === 'siegesWon');
    applySiegeResult(town, outcome, sieges);
    expect(contractState(town, sieges).progress[at]).toBe(1);

    const counters = dayWith('countersHeld');
    const other = armed(counters);
    const cAt = contractsAt(counters).findIndex((c) => c.metric === 'countersHeld');
    applyCounterResult(other, outcome, counters);
    expect(contractState(other, counters).progress[cAt]).toBe(1);
  });
});

describe('orders on disk', () => {
  it('survives a save round trip inside the same day', () => {
    const town = armed();
    const home = contractsAt(T0)[2]!;
    creditContracts(town, home.metric, 1, T0);
    town.lastSeen = T0;
    const back = deserialize(serialize(town))!;
    expect(back.contracts).toEqual(town.contracts);
  });

  it('replaces a stale block rather than crediting it against new orders', () => {
    const town = armed();
    const home = contractsAt(T0)[2]!;
    creditContracts(town, home.metric, home.goal - 1, T0);
    // Come back tomorrow: the file still holds yesterday's sheet.
    town.lastSeen = T0 + DAY_MS;
    const back = deserialize(serialize(town))!;
    expect(back.contracts!.day).toBe(contractDay(T0 + DAY_MS));
    expect(back.contracts!.progress).toEqual([0, 0, 0]);
    expect(back.contracts!.pay).toEqual([null, null, null]);
  });

  it('repairs junk instead of failing the load', () => {
    const day = contractDay(T0);
    expect(normalizeContracts(undefined, T0)).toEqual({
      day,
      progress: [0, 0, 0],
      paid: [false, false, false],
      pay: [null, null, null],
    });
    expect(
      normalizeContracts(
        { day, progress: [2, 'x', -4, 9], paid: [true, 'yes'], pay: [{ supplies: 5 }] },
        T0,
      ),
    ).toEqual({
      day,
      progress: [2, 0, 0],
      paid: [true, false, false],
      // A payout is only kept for a contract that actually paid, and its
      // missing halves come back as zero rather than undefined.
      pay: [{ supplies: 5, fuel: 0, intel: 0 }, null, null],
    });
  });

  it('gives a war that predates orders a clean sheet for today', () => {
    const town = armed();
    delete town.contracts;
    town.lastSeen = T0;
    const back = deserialize(serialize(town))!;
    expect(back.contracts).toEqual({
      day: contractDay(T0),
      progress: [0, 0, 0],
      paid: [false, false, false],
      pay: [null, null, null],
    });
  });
});
