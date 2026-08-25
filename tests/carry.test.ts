import { describe, expect, it } from 'vitest';
import { baseKitFor, raidCatalogFor, trainableFor, FACTION_IDS, type FactionId } from '../src/content/factions';
import { DAMAGE_MULT } from '../src/content/damage';
import { generateBase } from '../src/content/bases';
import { raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';
import type { AttackerProfile, Catalog } from '../src/sim/types';

const seedOf = (a: number, b: number): number => (a * 7919 + b * 104729 + 977) >>> 0;

/** The shipping reference plans, the force these numbers were tuned against. */
const PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { abrams: 1, ranger: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { ranger: 2, engineer: 1, humvee: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  china: [
    { units: { type99: 1, zbd: 1, rifle: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { grenadier: 2, sapper: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { militia: 4, rifle: 2, sapper: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  russia: [
    { units: { t72: 1, btr: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { rpg: 2, demoteam: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { conscript: 3, motorrifle: 2, demoteam: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  nk: [
    { units: { chonma: 1, nkrifle: 3 }, sector: 'W1', doctrine: 'assault' },
    { units: { rpg7: 2, tunneler: 2 }, sector: 'N1', doctrine: 'hunt' },
    { units: { infiltrator: 4, nkrifle: 5, tunneler: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  un: [
    { units: { leo1: 1, peacekeeper: 1, unmedic: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { nlaw: 2, unmedic: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { peacekeeper: 2, unsapper: 1, vab: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
};
const PLANNED: Record<FactionId, Set<string>> = Object.fromEntries(
  FACTION_IDS.map((f) => [f, new Set(PLANS[f].flatMap((s) => Object.keys(s.units)))]),
) as Record<FactionId, Set<string>>;

/**
 * A raid should not be one unit (v1.22).
 *
 * Measured in v1.21: silencing each unit kind in turn showed one tank was
 * 46-87% of every faction's raid, and 11-18 of every 27 manpower delivered
 * nothing at all. The mechanism is that killing the command post ends a raid,
 * ranged fire is discounted hard against structures, and melee only fires when
 * a unit is ADJACENT — so the heavy was the only thing that reliably arrived
 * and hurt.
 *
 * v1.22 moved power out of the heavy (x0.8 on both its channels) and into the
 * ranged infantry (x1.5 on its weapon), which unlike the riflemen fire `shaped`
 * or `explosive` and so can already hurt a post from a standoff. Measured: the
 * clear rate moved 40.3 -> 40.2 while the heavy's share of a raid fell from 67%
 * to 50%.
 *
 * `npm run balance -- --carry` is the measurement of record and runs thousands
 * of raids. This is the cheap structural guard that fails first, and it guards
 * the RATIO rather than the absolute numbers so a later difficulty pass can
 * move both without tripping it.
 */

/** What a unit can do to a structure: melee ignores the armour table, ranged does not. */
function antiStructure(p: AttackerProfile): number {
  const ranged = p.weapon
    ? p.weapon.damage *
      p.weapon.shotsPerSecond *
      ((DAMAGE_MULT as Record<string, Record<string, number>>)[p.weapon.damageType]?.structure ?? 1)
    : 0;
  return p.hqDps + ranged;
}

describe('who carries a raid', () => {
  /**
   * This has to run the SIM. A paper ratio cannot express it: the AT infantry
   * was already better per manpower than the heavy before the trade (0.79 for
   * the USA) and still delivered almost nothing, because it dies before it can
   * spend any of it. Potential is not delivery, and only a battle knows the
   * difference — a static version of this test caught 1 of the 10 single-value
   * reverts it was supposed to guard, which is why it is not here.
   *
   * Small fixture on purpose: `npm run balance -- --carry` is the measurement
   * of record and runs thousands of raids. This is the tripwire.
   */
  const silence = (cat: Catalog, kind: string): Catalog => ({
    ...cat,
    attackers: Object.fromEntries(
      Object.entries(cat.attackers).map(([k, p]) => [
        k,
        k === kind
          ? { ...p, hqDps: 0, weapon: p.weapon ? { ...p.weapon, damage: 0 } : p.weapon }
          : p,
      ]),
    ),
  });

  const clearRate = (faction: FactionId, cat: Catalog): number => {
    const squads = PLANS[faction].map((s, at) => ({ ...s, slot: at }));
    let cleared = 0;
    let runs = 0;
    for (const tier of [2, 3, 4]) {
      for (const shape of ['compound', 'corridor', 'camp', 'keep'] as const) {
        const base = generateBase(tier, 0, baseKitFor(faction), shape);
        for (let i = 0; i < 3; i++) {
          const config = raidConfig(base, squads, seedOf(tier, i), trainableFor(faction));
          if (resolveRaid(config, squads, tier, cat).cleared) cleared++;
          runs++;
        }
      }
    }
    return (cleared / runs) * 100;
  };

  it('gives the standoff arm real work across the board', () => {
    // Aggregate, and deliberately so. The trade landed for Russia, the KPA and
    // the UN, whose AT arms went from bit parts to 55%, 62% and 36% of a raid.
    // It did NOT change the USA or China, whose AT arms sit at 8% and 9% — and
    // the reason is worth knowing, because it is not that their infantry cannot
    // contribute. Their raids simply succeed on the tank alone, so removing the
    // escort changes nothing: redundancy, not incapacity. Normalising the
    // heavies' damage type was measured as the candidate fix and is not one —
    // it costs the USA 11.7 clear points and leaves the Javelin at 8%.
    //
    // Fixing that means making the heavy insufficient on its own, which is a
    // different design decision (ROADMAP M12). So this guards the aggregate the
    // trade actually moved, and the ROADMAP carries the residual.
    const shares = FACTION_IDS.map((faction) => {
      const cat = raidCatalogFor(faction);
      const at = Object.values(cat.attackers).find(
        (p) => p.weapon && p.armor === 'none' && !p.air && PLANNED[faction].has(p.kind),
      );
      expect(at, `${faction} fields no ranged infantry`).toBeDefined();
      const base = clearRate(faction, cat);
      if (base <= 0) return 0;
      return ((base - clearRate(faction, silence(cat, at!.kind))) / base) * 100;
    });
    const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
    // Threshold measured, not guessed. On this fixture: shipped 31%, both
    // halves undone 15%, the heavy cut alone undone 18%, the AT buff alone
    // undone 24.5%. 25% is the only bar that fails all three, and an earlier
    // draft at 20% passed with the buff fully reverted — a guard that does not
    // fail is not a guard.
    //
    // The AT-only margin is half a point, which is thin. It does not FLAKE —
    // the fixture is fixed seeds over fixed bases, so this number only moves
    // when content moves — but a future balance pass will likely have to
    // re-measure the bar rather than nudge it.
    expect(mean, `AT arm mean share ${mean.toFixed(0)}% (per faction ${shares.map((x) => x.toFixed(0)).join(', ')})`)
      .toBeGreaterThan(25);
  }, 60_000);

  it('keeps the heavy worth bringing', () => {
    // The other direction: this was a trade, not a demolition. A heavy that no
    // longer anchors a raid would just move the problem somewhere else.
    for (const faction of FACTION_IDS) {
      const cat = raidCatalogFor(faction).attackers;
      const heavy = Object.values(cat).find((p) => p.armor === 'heavy')!;
      const softest = Math.min(
        ...Object.values(cat).filter((p) => !p.air && p.armor === 'none').map((p) => p.maxHp),
      );
      expect(heavy.maxHp / softest, `${faction} heavy durability`).toBeGreaterThan(4);
      expect(antiStructure(heavy), `${faction} heavy still hurts`).toBeGreaterThan(20);
    }
  });
});
