import { describe, expect, it } from 'vitest';
import { SPECIALISATIONS } from '../src/content/specialisations';
import { trainMetaFor } from '../src/content/factions';
import {
  beginFit,
  fitError,
  fittedSpecs,
  fitting,
  fitReadyAt,
  normalizeSpecs,
  unitModsOf,
} from '../src/meta/armoury';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, type TownState } from '../src/meta/town';

/**
 * The armoury (M28 Phase 4): a war's specialisations, bought in supplies,
 * fuel and a fitting at the facility that trains the unit.
 */

const NOW = Date.UTC(2026, 8, 1);
const HOUR = 3600 * 1000;
const [ARMOUR, ASSAULT] = SPECIALISATIONS.line;
const [REACTIVE] = SPECIALISATIONS.heavy;

/** A USA town rich enough to fit anything, with the facilities asked for. */
function town(facilities: string[] = ['barracks', 'motorpool', 'airfield']): TownState {
  const t = newTown(NOW, 'usa');
  t.supplies = 100_000;
  t.fuel = 50_000;
  let cell = 20;
  for (const kind of facilities) {
    t.structures.push({ id: t.nextId++, kind, cell: cell, level: 1, wrecked: false });
    cell += 3;
  }
  return t;
}

describe('fitting a specialisation', () => {
  it('pays for it and fits it over its hours, at the facility that trains the unit', () => {
    const t = town();
    const meta = trainMetaFor('usa').ranger!;
    expect(fitError(t, 'ranger', ARMOUR!.id, NOW)).toBeNull();
    expect(beginFit(t, 'ranger', ARMOUR!.id, NOW)).toBe(true);
    expect(t.supplies).toBe(100_000 - meta.supplies * 10);
    expect(fitReadyAt(t, 'ranger')).toBe(NOW + 2 * HOUR);
    expect(fitting(t, 'barracks', NOW + HOUR)).toEqual({ kind: 'ranger', id: ARMOUR!.id, readyAt: NOW + 2 * HOUR });
    // Not in a battle until it is fitted.
    expect(fittedSpecs(t, NOW + HOUR)).toEqual({});
    expect(unitModsOf(t, NOW + HOUR)).toBeUndefined();
    expect(fittedSpecs(t, NOW + 2 * HOUR)).toEqual({ ranger: ARMOUR!.id });
    expect(unitModsOf(t, NOW + 2 * HOUR)).toEqual({ ranger: ARMOUR!.mods });
    expect(fitting(t, 'barracks', NOW + 2 * HOUR)).toBeNull();
  });

  it('takes three hours at the motor pool and four at the airfield', () => {
    const t = town();
    beginFit(t, 'abrams', REACTIVE!.id, NOW);
    beginFit(t, 'reaper', SPECIALISATIONS.gunship[1]!.id, NOW);
    expect(fitReadyAt(t, 'abrams')).toBe(NOW + 3 * HOUR);
    expect(fitReadyAt(t, 'reaper')).toBe(NOW + 4 * HOUR);
  });

  it('is for good: a choice closes the other side of its pair', () => {
    const t = town();
    beginFit(t, 'ranger', ARMOUR!.id, NOW);
    expect(fitError(t, 'ranger', ASSAULT!.id, NOW + 3 * HOUR)).toBe('chosen');
    expect(fitError(t, 'ranger', ARMOUR!.id, NOW + 3 * HOUR)).toBe('chosen');
    expect(beginFit(t, 'ranger', ASSAULT!.id, NOW + 3 * HOUR)).toBe(false);
  });

  it('one at a time at each kind of facility, and the kinds work in parallel', () => {
    const t = town();
    beginFit(t, 'ranger', ARMOUR!.id, NOW);
    expect(fitError(t, 'engineer', SPECIALISATIONS.breacher[0]!.id, NOW + HOUR)).toBe('busy');
    expect(fitError(t, 'abrams', REACTIVE!.id, NOW + HOUR)).toBeNull();
    expect(fitError(t, 'engineer', SPECIALISATIONS.breacher[0]!.id, NOW + 2 * HOUR)).toBeNull();
  });

  it('needs a working facility of the kind, and the stores to pay', () => {
    const noMotorPool = town(['barracks']);
    expect(fitError(noMotorPool, 'abrams', REACTIVE!.id, NOW)).toBe('facility');
    const wrecked = town(['barracks', 'motorpool']);
    wrecked.structures.find((s) => s.kind === 'motorpool')!.wrecked = true;
    expect(fitError(wrecked, 'abrams', REACTIVE!.id, NOW)).toBe('facility');
    const poor = town();
    poor.supplies = 100;
    expect(fitError(poor, 'abrams', REACTIVE!.id, NOW)).toBe('cost');
    expect(beginFit(poor, 'abrams', REACTIVE!.id, NOW)).toBe(false);
    expect(poor.supplies).toBe(100);
  });

  it("knows only its own army's units, and each unit's own pair", () => {
    const t = town();
    expect(fitError(t, 'type99', REACTIVE!.id, NOW)).toBe('unknown');
    expect(fitError(t, 'ranger', REACTIVE!.id, NOW)).toBe('unknown');
    expect(fitError(t, 'ranger', 'nonsense', NOW)).toBe('unknown');
  });
});

describe('the save', () => {
  it("keeps a war's specialisations and their fittings", () => {
    const t = town();
    beginFit(t, 'ranger', ARMOUR!.id, NOW);
    beginFit(t, 'abrams', REACTIVE!.id, NOW);
    const back = deserialize(serialize(t))!;
    expect(back.specs).toEqual(t.specs);
    expect(unitModsOf(back, NOW + 4 * HOUR)).toEqual({ ranger: ARMOUR!.mods, abrams: REACTIVE!.mods });
  });

  it('reads a war saved before them as having none', () => {
    const t = town();
    const raw = JSON.parse(serialize(t));
    delete raw.town?.specs;
    delete raw.specs;
    const back = deserialize(JSON.stringify(raw))!;
    expect(back.specs).toBeUndefined();
    expect(unitModsOf(back, NOW)).toBeUndefined();
  });

  it('drops anything that was never on offer', () => {
    expect(
      normalizeSpecs({
        ranger: { id: ARMOUR!.id, readyAt: NOW },
        abrams: { id: 'line-armour', readyAt: NOW },
        ghost: { id: ARMOUR!.id, readyAt: NOW },
        humvee: { id: 'light-slat', readyAt: 'soon' },
        nonsense: 7,
      }),
    ).toEqual({ ranger: { id: ARMOUR!.id, readyAt: NOW } });
    expect(normalizeSpecs(undefined)).toBeUndefined();
    expect(normalizeSpecs({})).toBeUndefined();
  });
});
