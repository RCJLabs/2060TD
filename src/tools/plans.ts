/**
 * The harness's raid force and fire plan, in one place so every instrument
 * fights the same raid: the balance harness's raid tables, and the economy
 * instrument's week at war (M24 Phase 4).
 */
import { trainableFor, type FactionId } from '../content/factions';
import type { RaidSupport, SquadPlan } from '../meta/warfare';

/**
 * The standard expedition each faction is measured with: ~27 manpower, three
 * sectors, one per slot.
 *
 * **Derived, not written (v1.25.)** These were hand-authored through v1.24 to
 * "mirror a sane player plan" — armour front, tower hunters, economy razers —
 * and every defensive table in this file was measured against them. `--derive`
 * searched the composition space instead and beat all five by 20.0 to 36.7
 * points on held-out battles, which is more than the 25.6-point parity spread
 * those same tables were being read for. A faction row that moves that far on
 * a change of plan is measuring the plan and not the kit, so the yardstick had
 * to be replaced before parity could be read at all.
 *
 * Two things the search found that the hand-written plans had backwards:
 *
 * - **Concentration beats spread.** Clear rate falls with headcount for every
 *   faction holding a real heavy — China 100% at 3-5 bodies against 25.6% at
 *   18+ — because a raid is a race to kill the post, not an attrition contest.
 *   Three Abrams beat one Abrams and eight supporting bodies by 21.7 points.
 * - **One doctrine beats three.** Every winner runs a single doctrine across
 *   all three sectors. The reference plans split assault/hunt/raze for
 *   thematic reasons and paid for it: a raid that sends a third of its force
 *   to the depots is a raid that arrives at the post a third under strength.
 *
 * **Re-derived against the kill chain in v1.41, and they are combined arms
 * now.** M15's derived optima were monocultures in three cases — nine BTRs,
 * nine VABs, three Abrams — which made a defensive table read "how does this
 * hold against nine APCs". The four-stage objective changed what a plan is
 * for, and the ladder in `--derive` priced the trade that M15 could not see:
 * every faction has a THREE-kind plan within 2.5 points of its best
 * concentrated one, and China and Russia gain 10-17 points by mixing.
 *
 *     faction   was                              is
 *     USA       3xabrams 1xjavelin        77.5   2xabrams 2xhumvee 1xjavelin  75.0
 *     CHINA     1xmilitia 2xsapper 3xt99  65.8   2xgrenadier 1xmilitia 3xt99  82.5
 *     RUSSIA    9xbtr                     66.7   6xbtr 3xdemoteam 1xrpg       76.7
 *     NK        3xinf 5xnkrifle 9xtunnel  68.3   12xnkrifle 2xrpg7 5xtunneler 74.2
 *     UN        9xvab                     69.2   7xvab 1xunsapper 1xnlaw      66.7
 *
 * A demolition team, an RPG and an NLAW are in there: kinds that measured zero
 * for twenty-two milestones. `--kits` and `--shapes` remain the guard against
 * tuning content to one attacker shape.
 *
 * Regenerate with `npm run balance -- --derive 150`, which emits these as
 * source. **The sector split follows roster iteration order**, so transcribe
 * from that output rather than by hand — a plan written in a different key
 * order round-robins into different sectors and is a different battle, worth
 * five points on the USA's plan when it was measured both ways.
 */
export const RAID_PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { javelin: 1, abrams: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { humvee: 1, abrams: 1 }, sector: 'N1', doctrine: 'assault' },
    { units: { humvee: 1 }, sector: 'S1', doctrine: 'assault' },
  ],
  china: [
    { units: { militia: 1, type99: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { grenadier: 1, type99: 1 }, sector: 'N1', doctrine: 'assault' },
    { units: { grenadier: 1, type99: 1 }, sector: 'S1', doctrine: 'assault' },
  ],
  russia: [
    { units: { demoteam: 1, rpg: 1, btr: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { demoteam: 1, btr: 2 }, sector: 'N1', doctrine: 'hunt' },
    { units: { demoteam: 1, btr: 2 }, sector: 'S1', doctrine: 'hunt' },
  ],
  nk: [
    { units: { nkrifle: 4, tunneler: 2, rpg7: 1 }, sector: 'W1', doctrine: 'hunt' },
    { units: { nkrifle: 4, tunneler: 2 }, sector: 'N1', doctrine: 'hunt' },
    { units: { nkrifle: 4, tunneler: 1, rpg7: 1 }, sector: 'S1', doctrine: 'hunt' },
  ],
  un: [
    { units: { unsapper: 1, vab: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { nlaw: 1, vab: 2 }, sector: 'N1', doctrine: 'hunt' },
    { units: { vab: 3 }, sector: 'S1', doctrine: 'hunt' },
  ],
};

/** The v0.4 ceiling: full Strike doctrine plus a stocked two-charge fire plan. */
export const DOCTRINE_SUPPORT: RaidSupport = {
  mods: { hp: 1.12, damage: 1.12 },
  powerCharges: { a10: 1, arty: 2 },
  autoPowers: [
    { kind: 'a10', atSeconds: 15, target: 'guns' },
    { kind: 'arty', atSeconds: 40, target: 'cc' },
  ],
};

/** The manpower a plan fields, by each unit's own cost. */
export function planManpower(faction: FactionId, plans: SquadPlan[] = RAID_PLANS[faction]): number {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  return plans.reduce(
    (total, squad) =>
      total +
      Object.entries(squad.units).reduce((s, [kind, n]) => s + (meta[kind] ?? 0) * n, 0),
    0,
  );
}

/**
 * The reference composition, resized to a manpower budget.
 *
 * Built by DEALING units out of the reference in its own order, one at a time,
 * until the next one would break the budget. Every plan in `RAID_PLANS` is
 * mostly counts of ONE, so the obvious resize — scale each count and round —
 * cannot express anything between "one Abrams" and "two": `round(1 * k)` is 1
 * for every k from 0.5 to 1.5, and a budget sweep built that way reported
 * eleven of twenty-five rungs at exactly the same number because they were all
 * fighting the identical force.
 *
 * Dealing round-robin keeps the proportions — the reference's own order is the
 * cycle — while letting the force grow one man at a time.
 */
export function planAtBudget(
  faction: FactionId,
  budget: number,
  shape: SquadPlan[] = RAID_PLANS[faction],
): SquadPlan[] {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  const base = shape;
  /** Every unit the reference fields, in its order: (squad index, kind). */
  const slots: { squad: number; kind: string }[] = [];
  base.forEach((squad, i) => {
    for (const [kind, n] of Object.entries(squad.units)) {
      for (let k = 0; k < n; k++) slots.push({ squad: i, kind });
    }
  });
  if (slots.length === 0) return base;

  const counts = base.map(() => ({}) as Record<string, number>);
  let spent = 0;
  let took = 0;
  // Several laps, so a budget larger than the reference is a bigger raid of
  // the same shape rather than a truncated one.
  for (let lap = 0; lap < 8 && spent < budget; lap++) {
    for (const slot of slots) {
      const cost = meta[slot.kind] ?? 0;
      if (spent + cost > budget) continue;
      counts[slot.squad]![slot.kind] = (counts[slot.squad]![slot.kind] ?? 0) + 1;
      spent += cost;
      took++;
    }
  }
  // A budget under the cheapest unit still sends somebody: a raid of nobody
  // is not a measurement of the rung.
  if (took === 0) {
    const cheapest = slots.reduce((a, b) => ((meta[a.kind] ?? 99) <= (meta[b.kind] ?? 99) ? a : b));
    counts[cheapest.squad]![cheapest.kind] = 1;
  }
  return base
    .map((squad, i) => ({ ...squad, units: counts[i]! }))
    .filter((squad) => Object.keys(squad.units).length > 0)
    .map((squad, at) => ({ ...squad, slot: at }));
}

/**
 * The force the citadel is tuned for (M25 Phase 4b): 62 men of the 66 a built
 * town fields. `--citadel` chooses each faction's citadel against it, and the
 * war instrument's growing commander takes it to the citadel.
 */
export const CITADEL_BUDGET = 62;

/** Men a rung past the fifth that the deep rows are tuned for (M25 Phase 4a). */
export const DEEP_STEP = 4;

/**
 * The force a rung is tuned for: the reference's own manpower to the fifth
 * rung, and four men more for every rung past it. `--deeplayouts` selects the
 * deep rows against it, and the war instrument's growing commander raids with
 * it.
 */
export const deepBudget = (faction: FactionId, tier: number): number =>
  planManpower(faction) + DEEP_STEP * Math.max(0, tier - 5);
