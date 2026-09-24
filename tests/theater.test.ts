import { describe, expect, it } from 'vitest';
import { TARGETS_PER_TIER } from '../src/content/bases';
import { FACTION_IDS } from '../src/content/factions';
import { BAND_NAMES, columnName, laneFor, strongholdTier, theaterFor } from '../src/content/theaters';
import { frontLabel, sectorOf, theaterView } from '../src/meta/theater';
import { newTown } from '../src/meta/town';
import { targetFor } from '../src/meta/warfare';

/** M25 Phase 1: the Front Line as a place, derived from the ladder. */

const T0 = 1_700_000_000_000;

describe('the theaters', () => {
  it('every faction has one: twelve towns, a stronghold, and three lanes that are the three bands', () => {
    for (const faction of FACTION_IDS) {
      const t = theaterFor(faction);
      expect(t.towns, faction).toHaveLength(12);
      const names = [t.home, ...t.towns, t.stronghold];
      expect(new Set(names).size, `${faction} names are all different`).toBe(names.length);
      expect(t.lanes.map((l) => l.slot).sort(), faction).toEqual([0, 1, 2]);
      expect(new Set(t.lanes.map((l) => l.name)).size, faction).toBe(3);
      expect(strongholdTier(t)).toBe(13);
    }
  });

  it("the wars meet: the USA and the UN drive on China's base", () => {
    expect(theaterFor('usa').stronghold).toBe(theaterFor('china').home);
    expect(theaterFor('un').stronghold).toBe(theaterFor('china').home);
  });

  it('a column is the tier: the base at 0, town n at tier n, the stronghold, then its rear', () => {
    const t = theaterFor('usa');
    expect(columnName(t, 0)).toBe('COOS BAY');
    expect(columnName(t, 1)).toBe('REEDSPORT');
    expect(columnName(t, 12)).toBe('ABERDEEN');
    expect(columnName(t, 13)).toBe('GRAYS HARBOR');
    expect(columnName(t, 15)).toBe('GRAYS HARBOR REAR 2');
  });

  it('every dealt post has one lane, for every variant a caller might pass', () => {
    const t = theaterFor('nk');
    for (let v = -3; v < 6; v++) {
      const lane = laneFor(t, v);
      expect(lane.slot).toBe(((v % TARGETS_PER_TIER) + TARGETS_PER_TIER) % TARGETS_PER_TIER);
    }
    expect(laneFor(t, 0).name).toBe('HIGHWAY 101');
  });
});

describe('the map over the ladder', () => {
  it("a sector's post is exactly the post the ladder deals: no battle changes", () => {
    for (const faction of FACTION_IDS) {
      const town = newTown(T0, faction);
      town.frontline.tier = 4;
      for (let v = 0; v < TARGETS_PER_TIER; v++) {
        const sector = sectorOf(town, v);
        expect(sector.tier).toBe(4);
        expect(sector.lane.slot).toBe(v);
        expect(sector.band).toBe(BAND_NAMES[v]);
        expect(sector.town).toBe(columnName(theaterFor(faction), 4));
        expect(JSON.stringify(sector.base)).toBe(JSON.stringify(targetFor(town, v)));
      }
    }
  });

  it('is derived from the rung and its wins: held behind the front, contested at it, enemy past it', () => {
    const town = newTown(T0, 'usa');
    town.frontline.tier = 5;
    town.frontline.wins = 2;
    const view = theaterView(town);
    expect(view.front).toBe(5);
    expect(view.pushes).toBe(2);
    expect(view.rows.map((r) => r.tier)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(view.rows.map((r) => r.state)).toEqual(['held', 'held', 'front', 'enemy', 'enemy', 'enemy']);
    expect(view.rows[2]!.name).toBe('LINCOLN CITY');
  });

  it('starts at the base, and marks the stronghold when it comes into view', () => {
    const town = newTown(T0, 'russia');
    expect(town.frontline.tier).toBe(1);
    const start = theaterView(town);
    expect(start.rows[0]).toMatchObject({ tier: 0, name: 'NOME', state: 'home' });
    expect(start.rows.map((r) => r.state)).toEqual(['home', 'front', 'enemy', 'enemy', 'enemy']);
    town.frontline.tier = 12;
    const late = theaterView(town);
    expect(late.rows.find((r) => r.stronghold)).toMatchObject({ tier: 13, name: 'FAIRBANKS' });
  });

  it('names the front beside the tier it still is', () => {
    const town = newTown(T0, 'usa');
    town.frontline.tier = 2;
    expect(frontLabel(town)).toBe('FLORENCE (T2)');
  });
});
