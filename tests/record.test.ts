import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS, LADDER_EPOCH, DECAY_PER_DAY, SEASON_MS } from '../src/content/leagues';
import { newSquadRecord } from '../src/content/veterancy';
import {
  awardStanding,
  dayOf,
  noteStanding,
  standingSeries,
  HISTORY_DAYS,
} from '../src/meta/ladder';
import { allWars, lineBars, lineTrend, serviceRecord } from '../src/meta/record';
import {
  deserialize,
  resetSlotCache,
  saveSlot,
  serialize,
  setActiveSlot,
} from '../src/meta/save';
import { newTown, tick, unlockAll, warLog, type TownState } from '../src/meta/town';

const T0 = LADDER_EPOCH + 40 * DAY_MS + 9 * 3_600_000;

const war = (now = T0): TownState => unlockAll(newTown(now));

describe('the standing line', () => {
  it('starts on the day the first sample lands', () => {
    const town = war();
    town.frontline.standing = 120;
    noteStanding(town.frontline, T0);
    expect(town.frontline.history).toEqual({ from: dayOf(T0), values: [120] });
  });

  it('overwrites, not appends, within the same day', () => {
    const town = war();
    town.frontline.standing = 100;
    noteStanding(town.frontline, T0);
    town.frontline.standing = 160;
    noteStanding(town.frontline, T0 + 6 * 3_600_000); // same day, later
    expect(town.frontline.history!.values).toEqual([160]);
  });

  it('fills the days nobody played by interpolating', () => {
    const town = war();
    town.frontline.standing = 100;
    noteStanding(town.frontline, T0);
    town.frontline.standing = 40;
    noteStanding(town.frontline, T0 + 3 * DAY_MS);
    // 100 → 40 over three days is the shape decay actually has: linear.
    expect(town.frontline.history!.values).toEqual([100, 80, 60, 40]);
  });

  it('keeps at most a month, moving the start day with the window', () => {
    const town = war();
    for (let day = 0; day < HISTORY_DAYS + 12; day++) {
      town.frontline.standing = day;
      noteStanding(town.frontline, T0 + day * DAY_MS);
    }
    const h = town.frontline.history!;
    expect(h.values).toHaveLength(HISTORY_DAYS);
    expect(h.from).toBe(dayOf(T0) + 12);
    expect(h.values[h.values.length - 1]).toBe(HISTORY_DAYS + 11);
  });

  it('ignores a clock that went backwards rather than rewriting the past', () => {
    const town = war();
    town.frontline.standing = 90;
    noteStanding(town.frontline, T0 + 5 * DAY_MS);
    const before = JSON.stringify(town.frontline.history);
    town.frontline.standing = 10;
    noteStanding(town.frontline, T0);
    expect(JSON.stringify(town.frontline.history)).toBe(before);
  });

  it('is written by the two things that move standing', () => {
    const town = war();
    expect(town.frontline.history).toBeUndefined();
    awardStanding(town, 40, T0);
    expect(town.frontline.history!.values).toEqual([40]);
    // A settle a week later charges decay and records the result.
    tick(town, T0 + 7 * DAY_MS);
    const values = town.frontline.history!.values;
    expect(values).toHaveLength(8);
    expect(values[values.length - 1]).toBeLessThan(40); // silence bled it
  });

  it('reads back a series that ends on today, without writing to the save', () => {
    const town = war();
    awardStanding(town, 200, T0);
    const frozen = JSON.stringify(town.frontline.history);
    const series = standingSeries(town, T0 + 4 * DAY_MS);
    expect(series[series.length - 1]!.day).toBe(dayOf(T0 + 4 * DAY_MS));
    expect(JSON.stringify(town.frontline.history)).toBe(frozen);
  });

  it('survives a save round trip, and repairs junk', () => {
    const town = war();
    awardStanding(town, 75, T0);
    const back = deserialize(serialize(town))!;
    expect(back.frontline.history).toEqual(town.frontline.history);

    const junk = war();
    junk.frontline.history = { from: 'soon', values: [1, 'two', 3] } as never;
    const fixed = deserialize(serialize(junk));
    expect(fixed!.frontline.history).toBeUndefined(); // a junk start day is no history
  });

  it('closes the line on the season it belongs to rather than sliding through', () => {
    const start = LADDER_EPOCH + 2 * DAY_MS;
    const town = war(start);
    awardStanding(town, 3000, start);
    // Well into the next season: the rollover carries a quarter forward.
    tick(town, start + SEASON_MS + 2 * DAY_MS);
    expect(town.frontline.standing).toBeLessThan(3000);
    const values = town.frontline.history!.values;
    // A carry is a step, not a slide: exactly one day-over-day fall in the run
    // is far larger than a day of decay, and it is the one at the boundary.
    const drops = values.map((v, i) => (i === 0 ? 0 : values[i - 1]! - v));
    const cliffs = drops.filter((d) => d > DECAY_PER_DAY * 2);
    expect(cliffs).toHaveLength(1);
    expect(Math.max(...drops)).toBeGreaterThan(1000);
  });
});

describe('drawing the line', () => {
  it('measures against zero, not against the run minimum', () => {
    // Two wars with the same SHAPE at different heights must not draw alike:
    // standing is a distance above nothing.
    const low = lineBars([{ value: 10 }, { value: 20 }]);
    const high = lineBars([{ value: 1000 }, { value: 2000 }]);
    expect(low).toEqual(high); // same shape, same bars — the ceiling is the peak
    expect(lineBars([{ value: 0 }, { value: 100 }])).toEqual([0, 1]);
  });

  it('never divides by an empty run', () => {
    expect(lineBars([])).toEqual([]);
    expect(lineBars([{ value: 0 }])).toEqual([0]);
  });

  it('reads the trend over the last week', () => {
    const flat = Array.from({ length: 10 }, () => ({ value: 50 }));
    expect(lineTrend(flat)).toBe('flat');
    expect(lineTrend([{ value: 10 }, { value: 90 }])).toBe('up');
    expect(lineTrend([{ value: 90 }, { value: 10 }])).toBe('down');
    expect(lineTrend([{ value: 5 }])).toBe('flat');
    // A dip and a full recovery inside the window is not a slip.
    expect(lineTrend([{ value: 50 }, { value: 10 }, { value: 50 }])).toBe('flat');
  });
});

describe('the war log', () => {
  it('starts a new war on day one, not day zero', () => {
    const town = war();
    expect(serviceRecord(town, T0).day).toBe(1);
    expect(serviceRecord(town, T0 + 3 * DAY_MS).day).toBe(4);
  });

  it('starts an older file at the load that upgraded it, never earlier', () => {
    const town = war();
    delete town.log;
    town.lastSeen = T0;
    const back = deserialize(serialize(town))!;
    expect(back.log!.startedAt).toBe(T0);
    expect(back.log!.raids).toBe(0);
  });

  it('repairs junk counters instead of rejecting the save', () => {
    const town = war();
    town.log = { startedAt: 'yesterday', raids: -5, probesHeld: 2.6 } as never;
    town.lastSeen = T0;
    const back = deserialize(serialize(town))!;
    expect(back.log).toEqual({ startedAt: T0, raids: 0, probesHeld: 3, probesBreached: 0 });
  });

  it('creates the counters on demand for a town that never had them', () => {
    const town = war();
    delete town.log;
    warLog(town).raids++;
    expect(town.log!.raids).toBe(1);
  });
});

describe('the service record', () => {
  it('reads the war off state that already existed', () => {
    const town = war();
    town.victories = 9;
    town.defeats = 2;
    town.assaultLevel = 5;
    town.frontline.tier = 4;
    town.frontline.totalWins = 11;
    town.campaign.completed = ['m1', 'm2', 'm3'];
    town.research.completed = ['a', 'b'];
    town.duels = ['x', 'y'];
    town.squads = [
      { ...newSquadRecord(), xp: 130, raids: 8, clears: 5, lost: 14 },
      { ...newSquadRecord(), xp: 0, raids: 1, clears: 0, lost: 6 },
      newSquadRecord(),
    ];
    warLog(town).raids = 12;
    awardStanding(town, 300, T0);

    const r = serviceRecord(town, T0);
    expect(r.battlesWon).toBe(9);
    expect(r.battlesLost).toBe(2);
    expect(r.assaultLevel).toBe(5);
    expect(r.tier).toBe(4);
    expect(r.postsTaken).toBe(11);
    expect(r.missions).toBe(3);
    expect(r.research).toBe(2);
    expect(r.duelsWon).toBe(2);
    expect(r.raids).toBe(12);
    // Men lost is the sum of the formations' files — the only exact source.
    expect(r.menLost).toBe(20);
    expect(r.formations.map((f) => f.rank.id)).toEqual(['veteran', 'green', 'green']);
    expect(r.formations[0]!.name).toBe('HAMMER');
  });

  it('remembers the best band held even after the standing bled away', () => {
    const town = war();
    awardStanding(town, 900, T0);
    const peakBand = serviceRecord(town, T0).league.label;
    // A month of silence takes it back down.
    tick(town, T0 + 30 * DAY_MS);
    const r = serviceRecord(town, T0 + 30 * DAY_MS);
    expect(r.standing).toBeLessThan(900);
    expect(r.bestLeague.label).toBe(peakBand);
    expect(r.league.label).not.toBe(peakBand);
  });

  it('counts the probes the defense log has already forgotten', () => {
    const town = war();
    const log = warLog(town);
    for (let i = 0; i < 20; i++) log.probesHeld++;
    log.probesBreached = 3;
    const r = serviceRecord(town, T0);
    expect(r.probesHeld).toBe(20);
    expect(r.probesBreached).toBe(3);
    expect(town.defenseLog).toHaveLength(0); // the log itself keeps four
  });

  it('has a line to draw even on a war that has done nothing', () => {
    const r = serviceRecord(war(), T0);
    expect(r.line.length).toBeGreaterThan(0);
    expect(lineBars(r.line)).toHaveLength(r.line.length);
  });
});

describe('every war on this machine', () => {
  /** Minimal localStorage, since the meta layer is tested outside a browser. */
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>)['localStorage'] = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    };
    resetSlotCache();
    setActiveSlot(1);
  });

  it('lists only the slots that hold a real war', () => {
    const usa = war();
    usa.campaign.difficulty = 'standard';
    usa.victories = 4;
    saveSlot(1, usa);
    const china = war();
    china.faction = 'china';
    china.campaign.difficulty = 'standard';
    china.frontline.tier = 3;
    saveSlot(2, china);
    // Slot 3 holds a husk: a town saved before the faction pick is not a war.
    saveSlot(3, war());

    const wars = allWars();
    expect(wars.map((w) => w.slot)).toEqual([1, 2]);
    expect(wars[0]!.battlesWon).toBe(4);
    expect(wars[1]!.faction).toBe('china');
    expect(wars[1]!.tier).toBe(3);
  });

  it('is empty rather than throwing when nothing has been played', () => {
    expect(allWars()).toEqual([]);
  });
});
