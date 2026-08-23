import { describe, expect, it } from 'vitest';
import { ALL_UNLOCK_KEYS } from '../src/content/campaign';
import { BLUE_LINE } from '../src/content/blueLine';
import {
  baseKitFor,
  defenseCatalogFor,
  enemyRosterFor,
  raidCatalogFor,
  trainableFor,
  wreckRepairFractionFor,
} from '../src/content/factions';
import { CHINA_BASE_KIT } from '../src/content/bases';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, unlockAll } from '../src/meta/town';

describe('blue line campaign', () => {
  it('is six missions distributing every unlock key', () => {
    expect(BLUE_LINE).toHaveLength(6);
    const granted = BLUE_LINE.flatMap((m) => m.unlocks);
    expect([...granted].sort()).toEqual([...ALL_UNLOCK_KEYS].sort());
    BLUE_LINE.forEach((m, i) => {
      expect(m.index).toBe(i);
      expect(m.id).toBe(`bl${i + 1}`);
    });
  });

  it('fights the China front: PLA besiegers, PLA targets, PLA wave kinds', () => {
    expect(baseKitFor('un')).toBe(CHINA_BASE_KIT);
    expect(enemyRosterFor('un')).toBe(enemyRosterFor('usa'));
    const kinds = new Set(
      BLUE_LINE.flatMap((m) => m.waves.flatMap((w) => w.entries.map((e) => e.kind))),
    );
    const catalog = defenseCatalogFor('un');
    for (const kind of kinds) {
      expect(catalog.attackers[kind], `defense catalog is missing '${kind}'`).toBeDefined();
    }
  });
});

describe('un sustainment identity', () => {
  it('the kit carries the auras and the roster carries the medic', () => {
    const defense = defenseCatalogFor('un');
    expect(defense.structures['foxhole']?.aura).toBeDefined();
    expect(defense.structures['engBay']?.aura).toBeDefined();
    const raid = raidCatalogFor('un');
    expect(raid.attackers['unmedic']?.heal).toBeDefined();
    // Bounded by design: one medic must not out-heal one MG post.
    const heal = raid.attackers['unmedic']!.heal!.perSecond;
    expect(heal).toBeGreaterThan(0);
    expect(heal).toBeLessThan(30);
  });

  it('every trainable kind exists in the raid catalog', () => {
    const raid = raidCatalogFor('un');
    for (const meta of trainableFor('un')) {
      expect(raid.attackers[meta.kind], `raid catalog is missing '${meta.kind}'`).toBeDefined();
    }
  });

  it('wreck repairs are the cheapest in the war', () => {
    expect(wreckRepairFractionFor('un')).toBeLessThan(wreckRepairFractionFor('nk'));
  });
});

describe('save v5 with faction un', () => {
  it('round-trips a UN town', () => {
    const town = unlockAll(newTown(1_700_000_000_000, 'un'));
    town.army = { peacekeeper: 3, unmedic: 1, leo1: 1 };
    const back = deserialize(serialize(town));
    expect(back).not.toBeNull();
    expect(back!.faction).toBe('un');
    expect(back!.army['unmedic']).toBe(1);
  });
});
