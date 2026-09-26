import { describe, expect, it } from 'vitest';
import { M1_CATALOG } from '../src/content/catalog';
import { FACTION_IDS, raidCatalogFor, trainableFor } from '../src/content/factions';
import { generateBase } from '../src/content/bases';
import { raidConfig, type SquadPlan } from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';
import type { Catalog, SimConfig, UnitMods } from '../src/sim/types';
import {
  FIT_HOURS,
  fitCost,
  pairFor,
  ROLE_OF,
  ROLES,
  SPECIALISATIONS,
  specialisationById,
  unitModsFor,
  type Role,
} from '../src/content/specialisations';

/**
 * Unit upgrade paths (M28 Phase 4): every unit a commander trains has a role,
 * and every role a choice of two specialisations.
 */

describe('every unit has a role, and every role a pair', () => {
  it('every trainable unit of every army', () => {
    for (const f of FACTION_IDS) {
      for (const t of trainableFor(f)) {
        const role = ROLE_OF[t.kind];
        expect(role, `${f} ${t.kind}`).toBeDefined();
        expect(ROLES, `${f} ${t.kind}`).toContain(role);
        const pair = pairFor(t.kind)!;
        expect(pair.length).toBe(2);
        expect(pair[0]!.id).not.toBe(pair[1]!.id);
      }
    }
  });

  it("every role is somebody's, and each pair belongs to its role", () => {
    const used = new Set<Role>();
    for (const f of FACTION_IDS) for (const t of trainableFor(f)) used.add(ROLE_OF[t.kind]!);
    expect([...used].sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) {
      const pair = SPECIALISATIONS[role];
      expect(pair.length, role).toBe(2);
      for (const spec of pair) {
        expect(spec.role).toBe(role);
        expect(specialisationById(spec.id)).toBe(spec);
        expect(spec.name).toMatch(/^[A-Z][A-Z -]+$/);
        expect(spec.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it('each specialisation changes something and something the unit has', () => {
    for (const f of FACTION_IDS) {
      const catalog = raidCatalogFor(f);
      for (const t of trainableFor(f)) {
        const profile = catalog.attackers[t.kind]!;
        for (const spec of pairFor(t.kind)!) {
          const m = spec.mods;
          const changes = Object.values(m).filter((v) => v !== undefined && v !== 1);
          expect(changes.length, `${t.kind} ${spec.id}`).toBeGreaterThan(0);
          // Range only for a unit with a weapon, healing only for one that heals.
          if (m.range !== undefined) expect(profile.weapon, `${t.kind} ${spec.id}`).toBeDefined();
          if (m.heal !== undefined) expect(profile.heal, `${t.kind} ${spec.id}`).toBeDefined();
          if (m.wall !== undefined) expect(profile.wallDps, `${t.kind} ${spec.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every multiplier is to the thousandth, as the codes carry it, and within reason', () => {
    for (const role of ROLES) {
      for (const spec of SPECIALISATIONS[role]) {
        for (const [key, v] of Object.entries(spec.mods)) {
          expect(Math.round(v * 1000) / 1000, `${spec.id} ${key}`).toBe(v);
          expect(v, `${spec.id} ${key}`).toBeGreaterThanOrEqual(0.8);
          expect(v, `${spec.id} ${key}`).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it('the two sides of a pair are different kinds of better', () => {
    for (const role of ROLES) {
      const [a, b] = SPECIALISATIONS[role];
      const gains = (s: typeof a) =>
        Object.entries(s!.mods)
          .filter(([, v]) => v > 1)
          .map(([k]) => k)
          .sort();
      expect(gains(a), role).not.toEqual(gains(b));
    }
  });
});

describe('what a specialisation costs and how long it takes to fit', () => {
  it("ten times the unit's training price, to the nearest fifty", () => {
    for (const f of FACTION_IDS) {
      for (const t of trainableFor(f)) {
        const cost = fitCost(t);
        expect(cost.supplies, t.kind).toBe(Math.round((t.supplies * 10) / 50) * 50);
        expect(cost.fuel, t.kind).toBe(Math.round((t.fuel * 10) / 50) * 50);
        expect(cost.supplies % 50).toBe(0);
      }
    }
  });

  it('two hours at the barracks, three at the motor pool, four at the airfield', () => {
    expect(FIT_HOURS).toEqual({ barracks: 2, motorpool: 3, airfield: 4 });
  });
});

describe('what the battle is told', () => {
  it('the multipliers of each fitted kind, and nothing for a kind without one', () => {
    const heavy = SPECIALISATIONS.heavy[0]!;
    const line = SPECIALISATIONS.line[1]!;
    const mods = unitModsFor({ abrams: heavy.id, ranger: line.id });
    expect(mods).toEqual({ abrams: heavy.mods, ranger: line.mods });
    expect(unitModsFor({})).toBeUndefined();
  });

  it('ignores an id it does not know, so an old save cannot put nonsense in a battle', () => {
    expect(unitModsFor({ abrams: 'nonsense' })).toBeUndefined();
  });
});

describe('the engine fields what was fitted (M28 Phase 4)', () => {
  const WIDTH = 32;
  const idx = (x: number, y: number): number => y * WIDTH + x;
  const board = (unitMods?: Record<string, UnitMods>): SimConfig => ({
    width: WIDTH,
    height: 24,
    seed: 7,
    ccOrigin: idx(27, 11),
    spawnLane: 0,
    ...(unitMods ? { unitMods } : {}),
  });
  /** One `kind` spawned on an empty board, as the engine fields it. */
  const spawn = (catalog: Catalog, kind: string, unitMods?: Record<string, UnitMods>) => {
    const e = new Engine(board(unitMods), catalog);
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: idx(4, 12), kind });
    e.run(1);
    return { attacker: e.attackers[0]!, catalog };
  };

  it("a kind with nothing fitted is the catalog's unit, untouched", () => {
    const { attacker } = spawn(M1_CATALOG, 'grenadier', { sapper: { wall: 1.4 } });
    expect(attacker.profile).toBe(M1_CATALOG.attackers.grenadier);
  });

  it('health, speed and damage, on the same rolls as an unfitted one', () => {
    const plain = spawn(M1_CATALOG, 'grenadier').attacker;
    const fitted = spawn(M1_CATALOG, 'grenadier', { grenadier: { hp: 1.3, speed: 0.9, damage: 1.25 } }).attacker;
    expect(fitted.maxHp).toBeCloseTo(plain.maxHp * 1.3, 9);
    expect(fitted.hp).toBeCloseTo(plain.hp * 1.3, 9);
    expect(fitted.speed).toBeCloseTo(plain.speed * 0.9, 9);
    const base = M1_CATALOG.attackers.grenadier!;
    expect(fitted.profile.weapon!.damage).toBeCloseTo(base.weapon!.damage * 1.25, 9);
    expect(fitted.profile.wallDps).toBeCloseTo(base.wallDps * 1.25, 9);
    expect(fitted.profile.hqDps).toBeCloseTo(base.hqDps * 1.25, 9);
  });

  it('range and damage to walls, and the catalog is left as it was', () => {
    const base = M1_CATALOG.attackers.grenadier!;
    const range = base.weapon!.range;
    const ranged = spawn(M1_CATALOG, 'grenadier', { grenadier: { range: 1.15 } }).attacker;
    expect(ranged.profile.weapon!.range).toBeCloseTo(range * 1.15, 9);
    expect(M1_CATALOG.attackers.grenadier!.weapon!.range).toBe(range);
    const sapperWall = M1_CATALOG.attackers.sapper!.wallDps;
    const breacher = spawn(M1_CATALOG, 'sapper', { sapper: { wall: 1.4, damage: 1.25 } }).attacker;
    // Walls take both: its damage, and its damage to walls on top.
    expect(breacher.profile.wallDps).toBeCloseTo(sapperWall * 1.4 * 1.25, 9);
    expect(M1_CATALOG.attackers.sapper!.wallDps).toBe(sapperWall);
  });

  it("a medic's healing", () => {
    const un = raidCatalogFor('un');
    const base = un.attackers.unmedic!.heal!;
    const medic = spawn(un, 'unmedic', { unmedic: { heal: 1.4 } }).attacker;
    expect(medic.profile.heal!.perSecond).toBeCloseTo(base.perSecond * 1.4, 9);
    expect(medic.profile.heal!.radius).toBe(base.radius);
  });

  it('fights the same battle every time it is fought', () => {
    const run = () => {
      const e = new Engine(board({ militia: { hp: 1.3, speed: 0.9 } }), M1_CATALOG);
      for (let i = 0; i < 6; i++) e.enqueue({ tick: i * 10, type: 'spawnAttacker', cell: idx(1, 8 + i), kind: 'militia' });
      e.run(400);
      return e.attackers.map((a) => [a.hp.toFixed(6), a.pos.x.toFixed(6), a.pos.y.toFixed(6)].join());
    };
    expect(run()).toEqual(run());
  });
});

describe('a raid is told what was fitted (M28 Phase 4)', () => {
  const plan: SquadPlan[] = [{ units: { ranger: 4, abrams: 1 }, sector: 'W1', doctrine: 'assault', slot: 0 }];

  it('in its config, as its code carries it, and nothing when nothing is', () => {
    const spec = SPECIALISATIONS.line[0]!;
    const hp = spec.mods.hp;
    const config = raidConfig(generateBase(2, 0), plan, 5, undefined, { unitMods: unitModsFor({ ranger: spec.id }) });
    expect(config.unitMods).toEqual({ ranger: spec.mods });
    // Its own copy: a battle that edits its config does not re-tune the table.
    config.unitMods!.ranger!.hp = 9;
    expect(spec.mods.hp).toBe(hp);
    expect('unitMods' in raidConfig(generateBase(2, 0), plan, 5)).toBe(false);
    expect('unitMods' in raidConfig(generateBase(2, 0), plan, 5, undefined, { unitMods: {} })).toBe(false);
    // To the thousandth, so the battle fought is the one its replay re-fights.
    const odd = raidConfig(generateBase(2, 0), plan, 5, undefined, { unitMods: { ranger: { hp: 1.23456, speed: 1 } } });
    expect(odd.unitMods).toEqual({ ranger: { hp: 1.235 } });
  });
});
