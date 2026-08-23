import { describe, expect, it } from 'vitest';
import { DAMAGE_MULT } from '../src/content/damage';
import { generateBase, CHINA_BASE_KIT, USA_BASE_KIT } from '../src/content/bases';
import { buildAssault, USA_ASSAULT_ROSTER } from '../src/content/assaults';
import { Engine, TICKS_PER_SECOND } from '../src/sim/engine';
import type { ArmorClass, DamageType } from '../src/sim/types';
import { makeSandbox, spawnCell, wallLine, TEST_CATALOG } from './helpers';

/**
 * The air layer (v1.0). Its whole reason to exist is that walls mean nothing
 * to it and only a gun that can elevate answers it — so that is what these
 * assert, from both ends.
 */
describe('air layer', () => {
  const run = (e: Engine, ticks: number) => {
    for (let i = 0; i < ticks; i++) e.step();
  };

  it('flies over a sealed wall line that stops a ground unit dead', () => {
    // A wall with no gap: a unit that cannot breach is stuck against it.
    const ground = makeSandbox(7);
    wallLine(ground, 0, 8, null);
    ground.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(ground, 5), kind: 'sealed' });
    run(ground, TICKS_PER_SECOND * 20);
    const walker = ground.attackers[0];
    expect(walker, 'the ground unit should still be alive and stuck').toBeDefined();
    expect(walker!.pos.x, 'a sealed unit cannot pass the wall').toBeLessThan(8);
    expect(ground.cc.hp).toBe(ground.cc.profile.maxHp);

    // The same board, the same wall, a flyer: the wall is not part of its world.
    const air = makeSandbox(7);
    wallLine(air, 0, 8, null);
    air.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(air, 5), kind: 'flyer' });
    run(air, TICKS_PER_SECOND * 20);
    expect(air.cc.hp, 'the flyer should be chewing on the command post').toBeLessThan(
      air.cc.profile.maxHp,
    );
    expect(air.grid.walls.size, 'and it should not have touched a single wall').toBe(
      ground.grid.walls.size,
    );
  });

  it('is scratched by a gun that can elevate and killed by the mount built for it', () => {
    const shootAt = (kind: string): number => {
      const e = makeSandbox(11);
      e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(10, 5), kind });
      e.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'flyer' });
      run(e, TICKS_PER_SECOND * 12);
      return e.attackers[0]?.hp ?? 0;
    };
    // An MG on a mount can point upward; the air column prices it badly.
    const scratched = shootAt('m2nest');
    expect(scratched, 'a rifle-calibre gun should not down it in 12s').toBeGreaterThan(0);
    expect(scratched, 'but it should not be untouched either').toBeLessThan(120);
    expect(shootAt('aa'), 'the flak mount is what actually kills it').toBe(0);
  });

  it('never draws fire from ordnance that cannot look up', () => {
    // Mortars lob, so their shells land on the ground whatever is overhead.
    const mortar = makeSandbox(13);
    mortar.enqueue({ tick: 1, type: 'placeStructure', cell: mortar.grid.idx(10, 5), kind: 'mortar' });
    mortar.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(mortar, 5), kind: 'flyer' });
    run(mortar, TICKS_PER_SECOND * 14);
    expect(mortar.attackers[0]?.hp, 'a mortar pit has nothing to say to a helicopter').toBe(
      mortar.attackers[0]?.maxHp,
    );
  });

  it('leaves the ground layer alone where the weapon truly cannot: the MANPADS tube', () => {
    const e = makeSandbox(29);
    e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'manpads' });
    e.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'walker' });
    run(e, TICKS_PER_SECOND * 12);
    const walker = e.attackers[0];
    expect(walker, 'the walker should have walked straight past it').toBeDefined();
    expect(walker!.hp, 'two men and a tube cannot engage infantry').toBe(walker!.maxHp);
  });

  it('passes over mines and under gun runs', () => {
    const mines = makeSandbox(17);
    mines.enqueue({ tick: 1, type: 'placeStructure', cell: mines.grid.idx(10, 5), kind: 'claymore' });
    mines.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(mines, 5), kind: 'flyer' });
    run(mines, TICKS_PER_SECOND * 12);
    expect(mines.attackers[0]?.hp, 'a buried mine cannot reach the sky').toBe(
      mines.attackers[0]?.maxHp,
    );

    const strafe = makeSandbox(19);
    strafe.enqueue({ tick: 2, type: 'spawnAttacker', cell: spawnCell(strafe, 5), kind: 'flyer' });
    run(strafe, TICKS_PER_SECOND * 2);
    const flyer = strafe.attackers[0]!;
    strafe.enqueue({ tick: strafe.tick + 1, type: 'castPower', kind: 'a10', target: { ...flyer.pos } });
    run(strafe, TICKS_PER_SECOND * 6);
    expect(strafe.attackers[0]?.hp, 'a gun run is laid on the ground').toBe(flyer.maxHp);
  });

  it('runs its doctrine: a standoff flyer works the guns before the post', () => {
    const e = makeSandbox(23);
    e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(9, 5), kind: 'm2nest' });
    e.enqueue({
      tick: 2,
      type: 'spawnAttacker',
      cell: spawnCell(e, 5),
      kind: 'gunFlyer',
      doctrine: 'hunt',
    });
    run(e, TICKS_PER_SECOND * 20);
    const nest = e.structures.find((s) => s.profile.kind === 'm2nest');
    expect(nest === undefined || nest.hp < nest.profile.maxHp).toBe(true);
  });

  it('is deterministic: same seed and commands, same state hash', () => {
    const play = (): string => {
      const e = makeSandbox(31);
      wallLine(e, 0, 8, null);
      e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(12, 5), kind: 'aa' });
      for (let i = 0; i < 4; i++) {
        e.enqueue({
          tick: 2 + i * 5,
          type: 'spawnAttacker',
          cell: spawnCell(e, 3 + i),
          kind: i % 2 === 0 ? 'flyer' : 'gunFlyer',
        });
      }
      run(e, TICKS_PER_SECOND * 30);
      return e.stateHash();
    };
    expect(play()).toBe(play());
  });

  it('prices every damage type against the air layer', () => {
    const types: DamageType[] = ['smallArms', 'kinetic', 'explosive', 'shaped', 'flak'];
    for (const type of types) {
      expect(DAMAGE_MULT[type]['air' as ArmorClass], `${type} has no air column`).toBeGreaterThan(0);
    }
    // Flak is the answer to air and nothing else.
    expect(DAMAGE_MULT.flak.air).toBeGreaterThan(DAMAGE_MULT.kinetic.air);
    expect(DAMAGE_MULT.flak.none).toBeLessThan(DAMAGE_MULT.smallArms.none);
    expect(DAMAGE_MULT.flak.structure).toBeLessThan(DAMAGE_MULT.explosive.structure);
  });

  it('puts a mount that can elevate in every compound from tier 2', () => {
    for (const kit of [CHINA_BASE_KIT, USA_BASE_KIT]) {
      const early = generateBase(1, 0, kit);
      const later = generateBase(4, 0, kit);
      expect(early.structures.some((s) => s.kind === kit.aa), 'tier 1 is the free lesson').toBe(false);
      expect(later.structures.some((s) => s.kind === kit.aa), 'tier 4 answers rotors').toBe(true);
    }
  });

  it('sends rotors up the assault ladder from level 4', () => {
    const kinds = (level: number): string[] =>
      buildAssault(level, USA_ASSAULT_ROSTER).waves.flatMap((w) => w.entries.map((e) => e.kind));
    expect(kinds(3)).not.toContain(USA_ASSAULT_ROSTER.gunship);
    expect(kinds(4)).toContain(USA_ASSAULT_ROSTER.gunship);
    expect(TEST_CATALOG.structures['aa'], 'the fixture kit carries a mount').toBeDefined();
  });
});
