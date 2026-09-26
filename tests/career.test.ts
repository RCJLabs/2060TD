import { beforeEach, describe, expect, it } from 'vitest';
import { campaignFor, type FactionId } from '../src/content/factions';
import type { Officer } from '../src/content/officers';
import {
  campaignMerit,
  HEAD_STARTS,
  MERIT_TO_MAX,
  OPENING_UNLOCKS,
  QUARTERMASTER_HOURS,
  rungMerit,
} from '../src/content/prestige';
import { TECH_BY_ID } from '../src/content/research';
import {
  applyHeadStart,
  bestOfficer,
  buy,
  buyError,
  CAREER_KEY,
  loadCareer,
  meritOf,
  newCareer,
  nextLevel,
  normalizeCareer,
  ordinal,
  retire,
  saveCareer,
  warIdOf,
  type Career,
} from '../src/meta/career';
import { deserialize, serialize } from '../src/meta/save';
import {
  accrue,
  newTown,
  productionPerHour,
  researchSeconds,
  startResearch,
  tick,
  type TownState,
} from '../src/meta/town';
import { withDepots } from './helpers';

/**
 * Prestige (M28 Phase 3): a war retired banks merit for what it achieved, the
 * merit buys head starts, and the war's best officer waits for the next war
 * of their army.
 */

const T0 = Date.UTC(2026, 3, 1, 8);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A war: a faction and a commitment chosen. */
function war(faction: FactionId = 'usa', at = T0): TownState {
  const town = newTown(at, faction);
  town.campaign.difficulty = 'standard';
  return town;
}

/** A war that got somewhere: its front at `rung`, the campaign done, and won if asked. */
function foughtWar(rung: number, won: boolean, faction: FactionId = 'usa', at = T0): TownState {
  const town = war(faction, at);
  town.frontline.tier = rung;
  town.campaign.completed = campaignFor(faction).map((m) => m.id);
  if (won) town.frontline.wonAt = at + 13 * DAY + 5 * HOUR;
  return town;
}

const officer = (name: string, xp: number): Officer => ({
  name,
  doctrine: 'hunt',
  xp,
  raids: 10,
  clears: 7,
  since: T0,
});

function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>)['localStorage'] = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

describe('merit (M28 Phase 3)', () => {
  it('pays a deep front more for each day than a short one', () => {
    expect([1, 2, 3, 5, 9, 14, 16].map(rungMerit)).toEqual([0, 1, 3, 10, 36, 91, 120]);
    // The campaign pays nine in all, whatever its length.
    expect(campaignMerit(9, 9)).toBe(9);
    expect(campaignMerit(6, 6)).toBe(9);
    expect(campaignMerit(3, 6)).toBe(5);
    expect(campaignMerit(0, 6)).toBe(0);
    expect(campaignMerit(12, 9)).toBe(9);
  });

  it('is nothing for a war that has done nothing', () => {
    const b = meritOf(war(), newCareer());
    expect(b.total).toBe(0);
    expect(b.lines.map((l) => l.label)).toEqual(['THE FRONT: the 1st rung', 'THE CAMPAIGN: 0 of 9 missions']);
  });

  it('reads the front, the campaign and the war won, and an army’s first win once', () => {
    const b = meritOf(foughtWar(14, true), newCareer());
    expect(b.lines).toEqual([
      { label: 'THE FRONT: the 14th rung', merit: 91 },
      { label: 'THE CAMPAIGN: 9 of 9 missions', merit: 9 },
      { label: 'THE WAR WON on day 14', merit: 30 },
      { label: 'THE FIRST WAR WON AS USA', merit: 30 },
    ]);
    expect(b.total).toBe(160);
    const career = newCareer();
    career.winners = ['usa'];
    expect(meritOf(foughtWar(14, true), career).total).toBe(130);
    // A HARD war pays a quarter more.
    const hard = foughtWar(14, true);
    hard.campaign.difficulty = 'hard';
    expect(meritOf(hard, career).total).toBe(163);
  });

  it('counts the deepest rung a front was pushed back from', () => {
    const town = foughtWar(6, false);
    town.frontline.deepest = 9;
    expect(meritOf(town, newCareer()).lines[0]).toEqual({ label: 'THE FRONT: the 9th rung', merit: 36 });
  });

  it('names rungs as a sentence does', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '101st',
    ]);
  });
});

describe('retiring a war (M28 Phase 3)', () => {
  it('banks its merit and puts it on the honour roll', () => {
    const career = newCareer();
    const town = foughtWar(9, false);
    const r = retire(career, town, T0 + 8 * DAY)!;
    expect(r.paid).toBe(45);
    expect(career.merit).toBe(45);
    expect(career.earned).toBe(45);
    expect(career.wars[0]).toMatchObject({
      id: warIdOf(town),
      faction: 'usa',
      rung: 9,
      missions: 9,
      wonDay: null,
      merit: 45,
      hard: false,
    });
  });

  it('refuses a file that never became a war', () => {
    const career = newCareer();
    expect(retire(career, newTown(T0), T0 + DAY)).toBeNull();
    expect(career.wars).toEqual([]);
  });

  it('pays a war only once, however often its file comes back', () => {
    const career = newCareer();
    const town = foughtWar(9, false);
    retire(career, town, T0 + 8 * DAY);
    // The same war exported, imported and retired again: nothing more.
    const again = deserialize(serialize(town))!;
    const second = retire(career, again, T0 + 9 * DAY)!;
    expect(second.paid).toBe(0);
    expect(second.before).toBe(45);
    // Played on and won, it pays what it has earned since, and its first win.
    again.frontline.tier = 14;
    again.frontline.wonAt = T0 + 13 * DAY;
    const third = retire(career, again, T0 + 14 * DAY)!;
    expect(third.paid).toBe(160 - 45);
    expect(career.merit).toBe(160);
    expect(career.wars).toHaveLength(1);
    expect(career.winners).toEqual(['usa']);
    // A second won war of the same army has no first win to pay.
    expect(retire(career, foughtWar(14, true, 'usa', T0 + DAY), T0 + 20 * DAY)!.paid).toBe(130);
    expect(career.wars).toHaveLength(2);
  });

  it('sends the best living officer to their army’s reserve', () => {
    const career = newCareer();
    const town = foughtWar(9, false);
    town.squads![0]!.officer = officer('A. MILLER', 150);
    town.squads![2]!.officer = officer('B. REYES', 420);
    expect(bestOfficer(town)?.name).toBe('B. REYES');
    const r = retire(career, town, T0 + 8 * DAY)!;
    expect(r.officer?.name).toBe('B. REYES');
    expect(career.reserve.usa?.name).toBe('B. REYES');
    // A war retired again sends nobody.
    expect(retire(career, deserialize(serialize(town))!, T0 + 9 * DAY)!.officer).toBeUndefined();
  });

  it('keeps the more experienced officer when the reserve is already filled', () => {
    const career = newCareer();
    const first = foughtWar(9, false);
    first.squads![1]!.officer = officer('C. OKAFOR', 400);
    retire(career, first, T0 + 8 * DAY);
    const second = foughtWar(5, false, 'usa', T0 + DAY);
    second.squads![0]!.officer = officer('D. SATO', 90);
    const r = retire(career, second, T0 + 9 * DAY)!;
    expect(r.officer).toBeUndefined();
    expect(r.kept?.name).toBe('C. OKAFOR');
    expect(career.reserve.usa?.name).toBe('C. OKAFOR');
    // Another army's reserve is its own.
    const china = foughtWar(5, false, 'china', T0 + 2 * DAY);
    china.squads![0]!.officer = officer('E. WANG', 60);
    retire(career, china, T0 + 10 * DAY);
    expect(career.reserve.china?.name).toBe('E. WANG');
  });
});

describe('the War College (M28 Phase 3)', () => {
  it('prices four head starts at three levels, all four for about three won wars', () => {
    expect(HEAD_STARTS.map((t) => t.id)).toEqual(['chest', 'opening', 'quartermasters', 'staff']);
    for (const track of HEAD_STARTS) expect(track.levels.map((l) => l.price)).toEqual([15, 35, 70]);
    expect(MERIT_TO_MAX).toBe(480);
    // A first win banks 160 or more: three of them buy the lot.
    expect(3 * meritOf(foughtWar(14, true), newCareer()).total).toBeGreaterThanOrEqual(MERIT_TO_MAX);
  });

  it('sells each level once, in order, for merit in hand', () => {
    const career = newCareer();
    expect(buyError(career, 'chest')).toBe('merit');
    career.merit = 50;
    expect(buy(career, 'chest')).toBe(true);
    expect(career.bought.chest).toBe(1);
    expect(career.merit).toBe(35);
    expect(nextLevel(career, 'chest')?.price).toBe(35);
    expect(buy(career, 'chest')).toBe(true);
    expect(buyError(career, 'chest')).toBe('merit');
    career.merit = 100;
    expect(buy(career, 'chest')).toBe(true);
    expect(buyError(career, 'chest')).toBe('max');
    expect(buy(career, 'chest')).toBe(false);
    expect(career.merit).toBe(30);
  });
});

describe('a head start (M28 Phase 3)', () => {
  const maxed = (): Career => {
    const career = newCareer();
    for (const id of ['chest', 'opening', 'quartermasters', 'staff'] as const) career.bought[id] = 2;
    return career;
  };

  it('is given once, when the war begins', () => {
    const career = maxed();
    career.reserve.usa = officer('F. HARLAN', 380);
    const town = war();
    const supplies = town.supplies;
    const news = applyHeadStart(town, career, T0)!;
    expect(town.supplies).toBe(supplies + 5000);
    expect(news.chest).toEqual({ supplies: 5000, fuel: 1000, intel: 250 });
    expect(town.unlocked).toEqual(expect.arrayContaining([...OPENING_UNLOCKS[1]!]));
    expect(town.unlocked).toContain('cc2');
    expect(town.headStart).toEqual({
      at: T0,
      quartermasters: { bonus: 1, until: T0 + QUARTERMASTER_HOURS * HOUR },
      staff: 0.5,
    });
    // The officer takes the first squad, and leaves the reserve.
    expect(town.squads![0]!.officer).toMatchObject({ name: 'F. HARLAN', xp: 380, since: T0 });
    expect(career.reserve.usa).toBeUndefined();
    expect(news.officer?.name).toBe('F. HARLAN');
    // Never twice.
    expect(applyHeadStart(town, career, T0 + HOUR)).toBeNull();
    expect(town.supplies).toBe(supplies + 5000);
  });

  it('is nothing for a commander who bought nothing, and says so by being empty', () => {
    const town = war();
    expect(applyHeadStart(town, newCareer(), T0)).toEqual({});
    expect(town.headStart).toEqual({ at: T0 });
  });

  it('leaves another army’s officer in the reserve', () => {
    const career = newCareer();
    career.reserve.china = officer('G. LI', 200);
    const town = war('usa');
    applyHeadStart(town, career, T0);
    expect(town.squads![0]!.officer).toBeUndefined();
    expect(career.reserve.china?.name).toBe('G. LI');
  });

  it('delivers the quartermasters’ share inside its window and nothing after', () => {
    // One depot, so two hours of it and its deliveries fit under a CC1 cap.
    const town = withDepots(war(), 1);
    town.supplies = 0;
    town.fuel = 0;
    town.headStart = { at: T0, quartermasters: { bonus: 1, until: T0 + HOUR } };
    const made = productionPerHour(town);
    expect(made.supplies).toBeGreaterThan(0);
    const plain = structuredClone(town);
    delete plain.headStart;
    // Two hours from the start: the first is delivered on, the second is not.
    const got = accrue(town, 2 * HOUR);
    const base = accrue(plain, 2 * HOUR);
    expect(got.delivered.supplies).toBeCloseTo(made.supplies, 6);
    expect(got.delivered.fuel).toBeCloseTo(made.fuel, 6);
    expect(got.supplies - base.supplies).toBeCloseTo(made.supplies, 6);
    // Deliveries are not production: the line to the front never sees them.
    expect(got.fed).toBe(base.fed);
    // And tick banks what accrue says.
    tick(town, T0 + 2 * HOUR);
    expect(town.supplies).toBeCloseTo(got.supplies, 6);
    // Past the window, the town makes what it makes.
    expect(accrue(town, 2 * HOUR).delivered).toEqual({ supplies: 0, fuel: 0 });
  });

  it('never delivers past a full store', () => {
    const town = withDepots(war());
    town.headStart = { at: T0, quartermasters: { bonus: 1.5, until: T0 + 72 * HOUR } };
    town.supplies = 1e9;
    expect(accrue(town, 8 * HOUR).supplies).toBe(1e9);
  });

  it('shortens research by the staff college’s factor', () => {
    const town = war();
    const tech = TECH_BY_ID['fortify4']!;
    expect(researchSeconds(town, tech)).toBe(4 * 3600);
    town.headStart = { at: T0, staff: 0.25 };
    expect(researchSeconds(town, tech)).toBe(3600);
    // What the board says is what the lab does.
    town.research.completed = ['fortify1', 'fortify2', 'fortify3', 'logistics1', 'logistics2'];
    town.structures.find((s) => s.kind === 'cc')!.level = 2;
    town.structures.push({ id: 90, kind: 'radar', cell: 30, level: 1, wrecked: false });
    town.intel = 1000;
    town.supplies = 10_000;
    town.fuel = 5_000;
    expect(startResearch(town, 'fortify4', T0)).toBe(true);
    expect(town.research.active!.endsAt).toBe(T0 + 3600 * 1000);
  });

  it('survives the save, and a war from before it has none', () => {
    const town = war();
    applyHeadStart(town, maxed(), T0);
    expect(deserialize(serialize(town))!.headStart).toEqual(town.headStart);
    const old = war();
    expect('headStart' in deserialize(serialize(old))!).toBe(false);
    // One that is there but unreadable was given: kept, with nothing in it that lasts.
    const raw = JSON.parse(serialize(old)) as { town: Record<string, unknown> };
    raw.town['headStart'] = { at: 'soon', quartermasters: { bonus: 99, until: 1 }, staff: 7 };
    expect(deserialize(JSON.stringify(raw))!.headStart).toEqual({ at: old.lastSeen });
  });
});

describe('the career on disk (M28 Phase 3)', () => {
  beforeEach(() => installStorage());

  it('is a new commander’s when there is nothing to read', () => {
    expect(loadCareer()).toEqual(newCareer());
  });

  it('round-trips through storage', () => {
    const career = newCareer();
    career.merit = 12;
    career.earned = 57;
    career.bought.staff = 2;
    career.reserve.nk = officer('H. KIM', 130);
    career.winners = ['nk'];
    retire(career, foughtWar(5, false, 'nk'), T0 + 5 * DAY);
    saveCareer(career);
    expect(loadCareer()).toEqual(career);
  });

  it('reads anything unreadable as what a new commander has', () => {
    localStorage.setItem(CAREER_KEY, '{not json');
    expect(loadCareer()).toEqual(newCareer());
    const c = normalizeCareer({
      merit: -4,
      earned: 'lots',
      bought: { chest: 9, opening: -1, staff: 2.7 },
      wars: [{ id: 'usa:1', faction: 'usa', rung: 5 }, { id: 7 }, 'nope'],
      reserve: { usa: { name: 'I. SUN' }, china: officer('J. WU', 50) },
      winners: ['un', 'navy', 'un'],
    });
    expect(c.merit).toBe(0);
    expect(c.earned).toBe(0);
    expect(c.bought).toEqual({ chest: 3, opening: 0, quartermasters: 0, staff: 2 });
    expect(c.wars.map((w) => w.id)).toEqual(['usa:1']);
    expect(Object.keys(c.reserve)).toEqual(['china']);
    expect(c.winners).toEqual(['un']);
  });
});
