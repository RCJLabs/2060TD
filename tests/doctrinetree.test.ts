import { describe, expect, it } from 'vitest';
import {
  DOCTRINE_TIER,
  doctrineOf,
  effectsOf,
  isDoctrineTech,
  TECH_BRANCHES,
  TECH_BY_ID,
  TECHS,
  techsOpenTo,
} from '../src/content/research';
import { battleRules } from '../src/content/signatures';
import { serviceRecord } from '../src/meta/record';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { deserialize, serialize } from '../src/meta/save';
import {
  canResearch,
  newTown,
  place,
  ratesPerHour,
  siegeConfig,
  startResearch,
  tick,
  unlockAll,
  TOWN_GRID,
  type TownState,
} from '../src/meta/town';
import type { FactionId } from '../src/content/factions';

/**
 * The war's doctrine (M28 Phase 2): every war buys the nine lower techs, the
 * first tier-4 tech it starts commits it to that branch for good, and only the
 * branch it chose has a sixth tier.
 */

const T0 = 1_700_000_000_000;
const HOUR = 3_600_000;
const idx = (x: number, y: number) => y * TOWN_GRID.width + x;
const NINE = TECHS.filter((t) => t.tier <= 3).map((t) => t.id);

/** A town with a working Signals Station, the nine done, and the stores to buy anything. */
function readyTown(faction: FactionId = 'usa'): TownState {
  const town = unlockAll(newTown(T0, faction));
  town.structures.find((s) => s.kind === 'cc')!.level = 2;
  town.supplies = 9000;
  town.fuel = 2000;
  place(town, 'radar', idx(2, 13), T0);
  tick(town, T0 + 60_000);
  town.research.completed = [...NINE];
  stock(town);
  return town;
}

/** Enough in every store for the dearest tech on the board. */
function stock(town: TownState): void {
  town.intel = 5000;
  town.supplies = 50_000;
  town.fuel = 20_000;
}

/** Start `id` and let it finish. */
function research(town: TownState, id: string, at: number): number {
  stock(town);
  expect(startResearch(town, id, at), id).toBe(true);
  const done = at + TECH_BY_ID[id]!.seconds * 1000 + 1000;
  tick(town, done);
  expect(town.research.completed).toContain(id);
  return done;
}

describe("the war's doctrine (M28 Phase 2)", () => {
  it('is the top of the graph: tiers 4 to 6, a capstone at the top of each branch', () => {
    expect(DOCTRINE_TIER).toBe(4);
    for (const branch of TECH_BRANCHES) {
      const top = TECHS.filter((t) => t.branch === branch && isDoctrineTech(t)).map((t) => t.tier);
      expect(top, branch).toEqual([4, 5, 6]);
      // The nine and three of its own: twelve techs a war of it can buy.
      expect(techsOpenTo(branch).map((t) => t.id)).toEqual([
        ...NINE.filter((id) => TECH_BY_ID[id]!.branch === 'fortify'),
        ...(branch === 'fortify' ? ['fortify4', 'fortify5', 'fortify6'] : []),
        ...NINE.filter((id) => TECH_BY_ID[id]!.branch === 'strike'),
        ...(branch === 'strike' ? ['strike4', 'strike5', 'strike6'] : []),
        ...NINE.filter((id) => TECH_BY_ID[id]!.branch === 'logistics'),
        ...(branch === 'logistics' ? ['logistics4', 'logistics5', 'logistics6'] : []),
      ]);
    }
  });

  it('is not chosen by the nine: every war buys them, and none of them commits it', () => {
    const town = readyTown();
    town.research.completed = NINE.filter((id) => id !== 'logistics3');
    expect(startResearch(town, 'logistics3', T0 + 60_000)).toBe(true);
    expect(town.research.doctrine).toBeUndefined();
    tick(town, T0 + 60_000 + HOUR);
    // And with the nine done, all three tier-4 techs are open.
    stock(town);
    for (const id of ['fortify4', 'strike4', 'logistics4']) expect(canResearch(town, id), id).toBeNull();
  });

  it('is the branch of the first tier-4 tech the war starts, for good', () => {
    const town = readyTown();
    expect(startResearch(town, 'strike4', T0 + 60_000)).toBe(true);
    expect(town.research.doctrine).toBe('strike');
    // Closed the moment it is started, not when it lands: research cannot be
    // cancelled, so neither can the choice.
    expect(canResearch(town, 'fortify4')).toBe('doctrine');
    expect(canResearch(town, 'logistics4')).toBe('doctrine');
    expect(canResearch(town, 'strike5')).toBe('busy');
    let at = T0 + 60_000 + 5 * HOUR;
    tick(town, at);
    expect(town.research.completed).toContain('strike4');
    stock(town);
    for (const id of ['fortify4', 'fortify5', 'fortify6', 'logistics4', 'logistics5', 'logistics6']) {
      expect(canResearch(town, id), id).toBe('doctrine');
      expect(startResearch(town, id, at), id).toBe(false);
    }
    // The nine stay the nine: a lower tech of another branch was never closed.
    town.research.completed = town.research.completed.filter((id) => id !== 'fortify3');
    expect(canResearch(town, 'fortify3')).toBeNull();
    town.research.completed.push('fortify3');
    // Its own branch goes on to the capstone, and nothing changes the doctrine.
    at = research(town, 'strike5', at);
    expect(canResearch(town, 'strike6')).toBeNull();
    research(town, 'strike6', at);
    expect(town.research.doctrine).toBe('strike');
    expect(town.research.completed.filter((id) => TECH_BY_ID[id]!.tier >= DOCTRINE_TIER)).toEqual([
      'strike4',
      'strike5',
      'strike6',
    ]);
  });

  it('keeps a capstone behind its own branch: none is reachable without the tier below it', () => {
    const town = readyTown();
    for (const id of ['fortify6', 'strike6', 'logistics6']) expect(canResearch(town, id), id).toBe('prereq');
  });

  it("reads a war's doctrine off what it researched, for a save written before it was kept", () => {
    expect(doctrineOf(NINE)).toBeUndefined();
    expect(doctrineOf([...NINE, 'logistics4'])).toBe('logistics');
    expect(doctrineOf([...NINE, 'strike4', 'fortify4', 'fortify5'])).toBe('fortify');
    // The furthest, and the first in board order on a tie.
    expect(doctrineOf([...NINE, 'strike4', 'fortify4'])).toBe('fortify');
    expect(doctrineOf([...NINE, 'logistics4', 'strike4'])).toBe('strike');
    expect(doctrineOf(['nonsense', 'strike4'])).toBe('strike');
  });

  it('is derived when an old war loads, and the war keeps every tech it paid for', () => {
    const old = readyTown();
    old.research.completed = [...NINE, 'fortify4', 'strike4', 'strike5'];
    delete old.research.doctrine;
    const back = deserialize(serialize(old))!;
    expect(back.research.doctrine).toBe('strike');
    expect(back.research.completed).toEqual(old.research.completed);
    expect(effectsOf(back.research.completed).wallHp).toBe(1.3);
    stock(back);
    expect(canResearch(back, 'fortify5')).toBe('doctrine');
    expect(canResearch(back, 'strike6')).toBeNull();

    // What it is researching counts: this war was going deeper into LOGISTICS.
    const busy = readyTown();
    busy.research.completed = [...NINE, 'fortify4', 'logistics4'];
    busy.research.active = { id: 'logistics5', endsAt: T0 + 10 * HOUR };
    expect(deserialize(serialize(busy))!.research.doctrine).toBe('logistics');

    // A war that never went past the nine has not chosen, and still can.
    const early = readyTown();
    const loaded = deserialize(serialize(early))!;
    expect(loaded.research.doctrine).toBeUndefined();
    expect('doctrine' in loaded.research).toBe(false);
    stock(loaded);
    expect(canResearch(loaded, 'logistics4')).toBeNull();
  });

  it('is kept by the save as written, and a broken one is read again from the research', () => {
    const town = readyTown();
    expect(startResearch(town, 'logistics4', T0 + 60_000)).toBe(true);
    const back = deserialize(serialize(town))!;
    expect(back.research.doctrine).toBe('logistics');
    expect(back.research.active?.id).toBe('logistics4');

    const raw = JSON.parse(serialize(town)) as { town: { research: Record<string, unknown> } };
    raw.town.research['doctrine'] = 'navy';
    expect(deserialize(JSON.stringify(raw))!.research.doctrine).toBe('logistics');
    raw.town.research['doctrine'] = 7;
    raw.town.research['active'] = null;
    expect(deserialize(JSON.stringify(raw))!.research.doctrine).toBeUndefined();
  });

  it('is named by the service record', () => {
    const town = readyTown();
    expect(serviceRecord(town, T0 + HOUR).doctrine).toBeNull();
    startResearch(town, 'fortify4', T0 + 60_000);
    expect(serviceRecord(town, T0 + HOUR).doctrine).toBe('fortify');
  });
});

describe('the capstones (M28 Phase 2)', () => {
  const full = (branch: string): string[] => [...NINE, `${branch}4`, `${branch}5`, `${branch}6`];

  it('add to their branch, as the graph does', () => {
    const fortify = effectsOf(full('fortify'));
    expect([fortify.wallHp, fortify.weaponDamage, fortify.cpCost, fortify.postHp]).toEqual([1.3, 1.38, 0.7, 1.25]);
    const strike = effectsOf(full('strike'));
    expect([strike.unitHp, strike.unitDamage, strike.postHp]).toEqual([1.34, 1.34, 1]);
    const logistics = effectsOf(full('logistics'));
    expect([logistics.rates, logistics.conversion, logistics.storage]).toEqual([1.35, 1.5, 1.4]);
    // Nothing below the capstone moved.
    expect(effectsOf([...NINE, 'fortify4', 'fortify5']).postHp).toBe(1);
    expect(effectsOf([...NINE, 'fortify4', 'fortify5']).weaponDamage).toBe(1.3);
  });

  it("THE LAST LINE hardens the post in every battle the town fights, and the replay keeps it", () => {
    const town = readyTown();
    town.research.completed = full('fortify');
    town.research.doctrine = 'fortify';
    const config = siegeConfig(town, 5);
    expect(config.mods?.defender).toMatchObject({ wallHp: 1.3, weaponDamage: 1.38, cpCost: 0.7, postHp: 1.25 });
    const back = decodeReplay(encodeReplay({ kind: 'probe', faction: 'usa', title: 'T', won: true, config }));
    expect(back.ok && back.replay.config.mods?.defender?.postHp).toBe(1.25);
  });

  it("multiplies into the UN's shield to the thousandth a replay code carries", () => {
    const un = readyTown('un');
    un.research.completed = full('fortify');
    un.research.doctrine = 'fortify';
    un.mandate = 'shield';
    expect(siegeConfig(un, 5).mods?.defender?.postHp).toBe(1.625);
    expect(battleRules('un', { postHp: 1.25 }, 'shield').defender?.postHp).toBe(1.625);
    expect(battleRules('usa', { postHp: 1.25 }, undefined).defender).toEqual({ postHp: 1.25 });
    expect(battleRules('usa', {}, undefined).defender).toBeUndefined();
  });

  it("WAR ECONOMY makes a fifth more than the tier below it, before the converters' share", () => {
    const town = readyTown();
    place(town, 'supplyDepot', idx(6, 13), T0 + 60_000);
    tick(town, T0 + 120_000);
    town.research.completed = [...NINE, 'logistics4', 'logistics5'];
    const before = ratesPerHour(town).supplies;
    town.research.completed.push('logistics6');
    expect(ratesPerHour(town).supplies).toBe(Math.round((before * 1.35) / 1.15));
  });
});
