import { describe, expect, it } from 'vitest';
import {
  archetypeFor,
  generateBase,
  structureLevelFor,
  ARCHETYPES,
  ARCHETYPE_BY_ID,
  CHINA_BASE_KIT,
  MAP_H,
  MAP_W,
  TARGETS_PER_TIER,
  USA_BASE_KIT,
} from '../src/content/bases';

const TIERS = [1, 2, 3, 4, 5, 6, 8, 12];

describe('the archetype table', () => {
  it('is well formed, and fits a narrow rail', () => {
    const ids = ARCHETYPES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const arch of ARCHETYPES) {
      expect(ARCHETYPE_BY_ID[arch.id]).toBe(arch);
      expect(arch.fromTier).toBeGreaterThanOrEqual(1);
      expect(arch.towers).toBeGreaterThan(0);
      expect(arch.economy).toBeGreaterThan(0);
      expect(arch.levelBonus).toBeGreaterThanOrEqual(0);
      // Both strings share a panel row with a count, and panel rows do not wrap.
      expect(arch.short.length, arch.short).toBeLessThanOrEqual(6);
      expect(arch.tag.length, arch.tag).toBeLessThanOrEqual(26);
      expect(arch.name.length).toBeGreaterThan(3);
    }
  });

  it('offers enough shapes at tier one to fill the target list', () => {
    const opening = ARCHETYPES.filter((a) => a.fromTier <= 1);
    expect(opening.length).toBeGreaterThanOrEqual(TARGETS_PER_TIER);
  });

  it('brings every shape into play by the mid ladder — no dead content', () => {
    const met = new Set<string>();
    for (let tier = 1; tier <= 12; tier++) {
      for (let v = 0; v < TARGETS_PER_TIER; v++) met.add(archetypeFor(tier, v).id);
    }
    expect([...met].sort()).toEqual(ARCHETYPES.map((a) => a.id).sort());
  });
});

describe('which shape a target is', () => {
  it('is the same answer every time it is asked', () => {
    for (const tier of TIERS) {
      for (let v = 0; v < TARGETS_PER_TIER; v++) {
        expect(archetypeFor(tier, v).id).toBe(archetypeFor(tier, v).id);
      }
    }
  });

  it('never offers the same problem twice in one tier', () => {
    for (let tier = 1; tier <= 20; tier++) {
      const offered = [0, 1, 2].map((v) => archetypeFor(tier, v).id);
      expect(new Set(offered).size, `tier ${tier}: ${offered.join(', ')}`).toBe(TARGETS_PER_TIER);
    }
  });

  it('only offers what the depth has unlocked', () => {
    for (let tier = 1; tier <= 20; tier++) {
      for (let v = 0; v < TARGETS_PER_TIER; v++) {
        expect(archetypeFor(tier, v).fromTier).toBeLessThanOrEqual(tier);
      }
    }
  });

  it('survives a nonsense tier or variant rather than throwing', () => {
    expect(archetypeFor(0, 0)).toBeDefined();
    expect(archetypeFor(1, -1)).toBeDefined();
    expect(archetypeFor(1, 99)).toBeDefined();
  });
});

describe('every generated base', () => {
  const cases: { tier: number; shape: string }[] = [];
  for (const tier of TIERS) {
    for (const arch of ARCHETYPES) cases.push({ tier, shape: arch.id });
  }

  it('puts a command post on the map and keeps every wall inside it', () => {
    for (const { tier, shape } of cases) {
      const base = generateBase(tier, 0, CHINA_BASE_KIT, shape as never);
      const label = `${shape} @ t${tier}`;
      expect(base.archetype, label).toBe(shape);
      expect(base.ccLevel, label).toBeGreaterThanOrEqual(1);
      expect(base.ccLevel, label).toBeLessThanOrEqual(3);
      expect(base.ccOrigin, label).toBeGreaterThanOrEqual(0);
      expect(base.ccOrigin, label).toBeLessThan(MAP_W * MAP_H);

      for (const wall of base.walls) {
        const col = wall.cell % MAP_W;
        const row = Math.floor(wall.cell / MAP_W);
        expect(col, `${label} wall col`).toBeGreaterThanOrEqual(1);
        expect(col, `${label} wall col`).toBeLessThanOrEqual(MAP_W - 2);
        expect(row, `${label} wall row`).toBeGreaterThanOrEqual(1);
        expect(row, `${label} wall row`).toBeLessThanOrEqual(MAP_H - 2);
      }
    }
  });

  it('never stacks two things on one cell', () => {
    for (const { tier, shape } of cases) {
      const base = generateBase(tier, 0, CHINA_BASE_KIT, shape as never);
      const label = `${shape} @ t${tier}`;
      const wallCells = base.walls.map((w) => w.cell);
      expect(new Set(wallCells).size, `${label} duplicate walls`).toBe(wallCells.length);

      const taken = new Set<number>(wallCells);
      for (const s of base.structures) {
        // Everything but the guns is a 2x2 footprint; the check only needs the
        // origin to be unclaimed, which is what the occupancy map guarantees.
        expect(taken.has(s.cell), `${label} ${s.kind} on a taken cell`).toBe(false);
        taken.add(s.cell);
      }
    }
  });

  it('has something to shoot with and something worth taking', () => {
    const economy = new Set([CHINA_BASE_KIT.cache, CHINA_BASE_KIT.dump]);
    for (const { tier, shape } of cases) {
      const base = generateBase(tier, 0, CHINA_BASE_KIT, shape as never);
      const label = `${shape} @ t${tier}`;
      const guns = base.structures.filter((s) => s.kind !== 'cc' && !economy.has(s.kind));
      const stores = base.structures.filter((s) => economy.has(s.kind));
      expect(guns.length, `${label} guns`).toBeGreaterThan(0);
      expect(stores.length, `${label} stores`).toBeGreaterThan(0);
    }
  });

  it('builds a level deeper only where the shape says so', () => {
    for (const tier of TIERS) {
      const plain = generateBase(tier, 0, CHINA_BASE_KIT, 'compound');
      const dug = generateBase(tier, 0, CHINA_BASE_KIT, 'bunker');
      expect(plain.ccLevel).toBe(structureLevelFor(tier));
      expect(dug.ccLevel).toBe(Math.min(3, structureLevelFor(tier) + 1));
    }
  });

  it('is identical on every regeneration — scouting, raiding and replay agree', () => {
    for (const { tier, shape } of cases) {
      const a = generateBase(tier, 1, USA_BASE_KIT, shape as never);
      const b = generateBase(tier, 1, USA_BASE_KIT, shape as never);
      expect(b).toEqual(a);
    }
  });

  it('gives the same shape with or without the override naming it', () => {
    for (let tier = 1; tier <= 8; tier++) {
      for (let v = 0; v < TARGETS_PER_TIER; v++) {
        const natural = generateBase(tier, v, CHINA_BASE_KIT);
        const forced = generateBase(tier, v, CHINA_BASE_KIT, natural.archetype);
        expect(forced).toEqual(natural);
      }
    }
  });

  it('scales what is there with the shape, not just with the tier', () => {
    const tier = 6;
    const camp = generateBase(tier, 0, CHINA_BASE_KIT, 'camp');
    const compound = generateBase(tier, 0, CHINA_BASE_KIT, 'compound');
    const bunker = generateBase(tier, 0, CHINA_BASE_KIT, 'bunker');
    const gunsOf = (b: typeof camp): number =>
      b.structures.filter(
        (s) => s.kind !== 'cc' && s.kind !== CHINA_BASE_KIT.cache && s.kind !== CHINA_BASE_KIT.dump,
      ).length;

    // A camp is thinly gunned; a bunker has almost no wire.
    expect(gunsOf(camp)).toBeLessThan(gunsOf(compound));
    expect(bunker.walls.length).toBeLessThan(compound.walls.length / 2);
  });
});
