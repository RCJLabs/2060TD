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
      // `short` is an abbreviation by design — it rides in a row's sub next
      // to a count — so it stays tight. `tag` is prose, and panel rows wrap
      // since v1.13, so its cap is editorial rather than structural.
      expect(arch.short.length, arch.short).toBeLessThanOrEqual(6);
      expect(arch.tag.length, arch.tag).toBeLessThanOrEqual(64);
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

  /**
   * The ladder has to climb (v1.21). Before the upgrade creep, every gun on a
   * base stepped to the next level on the same rung, which made T3->T4 a
   * 39-point cliff in the balance harness and left T4->T5 with nothing at all
   * to add — T4 measured HARDER than T5, so a player who ground past the wall
   * found the next rung easier.
   *
   * Gun-level points (guns summed by level) is the cheap structural stand-in
   * for that, and it catches both halves: a rung that adds nothing, and a rung
   * that more than doubles. Deleting `upgradeShareFor` fails the second bound
   * at T3->T4, which is the shape of the defect this exists to hold shut.
   */
  it('climbs the ladder instead of cliffing up it', () => {
    for (const shape of ['compound', 'corridor', 'keep'] as const) {
      const rungs = [1, 2, 3, 4, 5, 6].map((tier) => {
        const guns = generateBase(tier, 0, CHINA_BASE_KIT, shape).structures.filter((s) =>
          /tower|nest|cannon|mortar/i.test(s.kind),
        );
        return {
          // Guns summed by level: what the rung is worth in standing fire.
          points: guns.reduce((sum, g) => sum + (g.level ?? 1), 0),
          // …and the whole shape of the line, because a rung can also add a
          // KIND. T3 adds neither a gun nor a level — it adds anti-armor, and
          // the harness prices that rung at -21, so points alone cannot be
          // the only thing a rung is allowed to move.
          signature: `${guns.length}:${[...new Set(guns.map((g) => `${g.kind}${g.level ?? 1}`))].sort().join()}`,
        };
      });
      for (let i = 1; i < rungs.length; i++) {
        const label = `${shape} T${i}->T${i + 1}`;
        const prev = rungs[i - 1]!;
        const here = rungs[i]!;
        expect(here.points, `${label} goes backwards`).toBeGreaterThanOrEqual(prev.points);
        expect(here.signature, `${label} adds nothing at all`).not.toBe(prev.signature);
        expect(here.points, `${label} is a cliff`).toBeLessThanOrEqual(prev.points * 2);
      }
    }
  });

  it('creeps the upgrade through the line rather than landing it all at once', () => {
    // T1-T3 sit at ceiling 1: there is no level to be one back from, so the
    // shallow rungs must be untouched by the creep.
    for (const tier of [1, 2, 3]) {
      const guns = generateBase(tier, 0, CHINA_BASE_KIT, 'compound').structures.filter((s) =>
        /tower/i.test(s.kind),
      );
      expect(guns.every((g) => g.level === 1), `T${tier} all at the ceiling`).toBe(true);
    }
    // T4 opens the band with a minority upgraded, T6 closes it with all of
    // them, and the mount never upgrades at any of it.
    const at = (tier: number) =>
      generateBase(tier, 0, CHINA_BASE_KIT, 'compound').structures.filter((s) =>
        /tower/i.test(s.kind),
      );
    const t4 = at(4);
    const t6 = at(6);
    expect(t4.filter((g) => g.level === 2).length).toBeLessThan(t4.length);
    expect(t4.some((g) => g.level === 2)).toBe(true);
    expect(t6.every((g) => g.level === 2)).toBe(true);
    for (const tier of [4, 5, 6]) {
      const mounts = generateBase(tier, 0, CHINA_BASE_KIT, 'compound').structures.filter(
        (s) => s.kind === CHINA_BASE_KIT.aa,
      );
      expect(mounts.every((m) => m.level === 1), `T${tier} mounts`).toBe(true);
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
