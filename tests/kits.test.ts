import { describe, expect, it } from 'vitest';
import { CHINA_BASE_KIT, USA_BASE_KIT } from '../src/content/bases';
import { raidCatalogFor } from '../src/content/factions';
import { DAMAGE_MULT } from '../src/content/damage';
import type { StructureProfile } from '../src/sim/types';

/**
 * The two fronts have to be the same fight (v1.21).
 *
 * There are exactly two base kits: the PLA post that the USA and the UN raid,
 * and the US firebase that China, Russia and the KPA raid. Nothing compared
 * them until v1.21, and running every reference force against both found the
 * PLA kit 34 clear-rate points softer for all five — a standing advantage to
 * whoever happened to pick a faction on that side of the map, which no amount
 * of deal or ladder work could reach.
 *
 * `npm run balance -- --kits` is the measurement of record and runs 2000-odd
 * raids. This is the cheap structural guard that fails first: effective damage
 * against the armour the reference plans actually field, times the ground the
 * gun covers, slot against matching slot.
 */

const CHINA_STRUCTS = raidCatalogFor('usa').structures;
const USA_STRUCTS = raidCatalogFor('china').structures;

/** Roughly what every reference plan fields: mostly soft, one light, one heavy. */
const ARMOR_MIX: [string, number][] = [
  ['none', 0.82],
  ['light', 0.08],
  ['heavy', 0.1],
];

/** Effective damage per second against that mix, times covered area. */
function throughput(src: Record<string, StructureProfile>, kind: string, level: number): number {
  const profile = src[kind];
  if (!profile) throw new Error(`no such structure: ${kind}`);
  const upgrade = profile.levels?.[level - 2];
  const weapon = level === 1 ? profile.weapon : (upgrade?.weapon ?? profile.weapon);
  if (!weapon) return 0;
  const table = (DAMAGE_MULT as Record<string, Record<string, number>>)[weapon.damageType] ?? {};
  const mult = ARMOR_MIX.reduce((sum, [armor, share]) => sum + share * (table[armor] ?? 1), 0);
  const min = weapon.minRange ?? 0;
  return weapon.damage * weapon.shotsPerSecond * mult * (weapon.range ** 2 - min ** 2);
}

/** How the generator fills a five-gun base: 2 basic, 2 area denial, 1 anti-armor. */
const SLOT_WEIGHT = [2, 2, 1];

describe('the two base kits', () => {
  it('match slot for slot, so neither front is the easy one', () => {
    for (const level of [1, 2, 3]) {
      for (let slot = 0; slot < 3; slot++) {
        const china = throughput(CHINA_STRUCTS, CHINA_BASE_KIT.towers[slot]!, level);
        const usa = throughput(USA_STRUCTS, USA_BASE_KIT.towers[slot]!, level);
        const ratio = usa / china;
        const label = `L${level} slot ${slot}: ${CHINA_BASE_KIT.towers[slot]} vs ${USA_BASE_KIT.towers[slot]} = ${ratio.toFixed(2)}x`;
        // Wide, because the slots are meant to differ in KIND — a splashy
        // close-in grenade launcher against a precise long autocannon is the
        // point. What is not allowed is one being worth half the other, which
        // is where the area-denial slot sat at 2.80x before this.
        expect(ratio, label).toBeGreaterThan(0.6);
        expect(ratio, label).toBeLessThan(1.6);
      }
    }
  });

  it('match overall, weighted the way the generator fills a base', () => {
    for (const level of [1, 2, 3]) {
      const weigh = (src: Record<string, StructureProfile>, kit: typeof CHINA_BASE_KIT): number =>
        kit.towers.reduce((sum, kind, at) => sum + SLOT_WEIGHT[at]! * throughput(src, kind, level), 0);
      const ratio = weigh(USA_STRUCTS, USA_BASE_KIT) / weigh(CHINA_STRUCTS, CHINA_BASE_KIT);
      expect(ratio, `L${level} whole kit = ${ratio.toFixed(2)}x`).toBeGreaterThan(0.75);
      expect(ratio, `L${level} whole kit = ${ratio.toFixed(2)}x`).toBeLessThan(1.35);
    }
  });

  it('still gives each kit its own character', () => {
    // Parity of worth, not of design. The PLA post answers a crowd up close;
    // the US firebase reaches further and hits single targets harder.
    const qlz = CHINA_STRUCTS.qlzTower!.weapon!;
    const autocannon = USA_STRUCTS.autocannon!.weapon!;
    expect(qlz.shotsPerSecond).toBeGreaterThan(autocannon.shotsPerSecond); // rapid-fire, GDD §4.2
    expect(qlz.splashRadius ?? 0).toBeGreaterThan(0); // anti-swarm
    expect(autocannon.range).toBeGreaterThan(qlz.range); // precision at reach
    expect(autocannon.splashRadius ?? 0).toBe(0);
    // And the ATGM still outranges every US attacker weapon, which is what
    // `chinaBase.ts` says it is for.
    const reach = Math.max(
      ...Object.values(raidCatalogFor('usa').attackers)
        .map((a) => a.weapon?.range ?? 0),
    );
    expect(CHINA_STRUCTS.atgmTower!.weapon!.range).toBeGreaterThan(reach);
  });
});
