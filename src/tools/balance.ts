/**
 * Headless balance harness (M5): deterministic raid and defense matrices for
 * both factions, printed to stdout and snapshotted to docs/BALANCE.md.
 *
 *   npm run balance            # print tables
 *   npm run balance -- --md    # also rewrite docs/BALANCE.md
 *
 * Everything here is seeded and command-free, so runs are exactly
 * reproducible: the raid side measures the hands-off auto-resolver, the
 * defense side measures the PERMANENT layer only (like offline probes — no
 * live CP play), which is the floor a base must clear.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { buildAssault, LADDER, probeAssault, type Ladder } from '../content/assaults';
import { missionSiege, type Difficulty, type MissionDef } from '../content/campaign';
import { GARRISON_GUN_TRADE } from '../content/garrison';
import { DAMAGE_MULT } from '../content/damage';
import {
  generateBase,
  ARCHETYPES,
  CHINA_BASE_KIT,
  USA_BASE_KIT,
  TARGETS_PER_TIER,
  archetypeFor,
  dealPairFor,
  BASE_SPAWN_EDGE,
  BASE_SPAWN_LANE,
  MAP_CELL_SIZE,
  MAP_W,
  type ArchetypeId,
  type GeneratedBase,
} from '../content/bases';
import {
  baseKitFor,
  campaignFor,
  defenseCatalogFor,
  enemyRosterFor,
  flavorFor,
  raidCatalogFor,
  trainableFor,
  FACTION_IDS,
  type FactionId,
} from '../content/factions';
import { airTransit, slowestAirSpeed } from '../meta/airread';
import { V1_GRID } from '../meta/regrid';
import { TOWN_GRID } from '../meta/town';
import {
  DOCTRINE_IDS,
  raidConfig,
  resolveRaid,
  tunnelSiteValid,
  type RaidResolution,
  type RaidSupport,
  type SectorId,
  type SquadPlan,
} from '../meta/warfare';
import { CONDITIONS } from '../content/conditions';
import { effectsOf, TECHS, type TechBranch } from '../content/research';
import type { TrainMeta } from '../content/usaUnits';
import { RANKS } from '../content/veterancy';
import { STANDING_ORDERS, standingOrdersFor } from '../content/standingOrders';
import { economyTable } from './economy';
import { yardTable } from './yard';
import { idx, referenceBases, wallLine, type ReferenceBase } from './referenceBases';
import { coarsenConfig, onBoard, refineConfig, siegeOnBoard } from '../sim/board';
import { Engine } from '../sim/engine';
import { scaleFootprint } from '../sim/scale';
import { createRng } from '../sim/rng';
import { COMBAT_CURRENT, COMBAT_MODELS, COMBAT_NONE, combatModelFor } from '../sim/combat';
import {
  CHAIN_AIMED,
  CHAIN_CURRENT,
  CHAIN_ENGAGE,
  CHAIN_LATCHED,
  CHAIN_MODELS,
  CHAIN_NONE,
  CHAIN_PINNED,
  chainModelFor,
  type ChainModel,
} from '../sim/killchain';
import {
  OBJECTIVES,
  OBJECTIVE_FLOOR,
  OBJECTIVE_IDS,
  OBJECTIVE_SHARE,
} from '../meta/objectives';
import type {
  CellIndex,
  DefenderMods,
  LayoutStructure,
  SiegeDef,
  SimConfig,
  StandingOrders,
  StandingOrderTarget,
  Catalog,
  DamageType,
  Doctrine,
} from '../sim/types';

const SEEDS = 20;
const VARIANTS = 3;
const RAID_TIERS = [1, 2, 3, 4, 5];
/**
 * The rungs the defence tables sample.
 *
 * Six consecutive levels used to span the whole ladder. v1.42 lengthened it —
 * a level is a +25% step now instead of up to +67%, so today's level 6 is what
 * used to be level 2 and sampling 1-6 would report 100% holds everywhere and
 * say nothing. These are the rungs that cover the same DIFFICULTY range the
 * old six did, which is what keeps a row in this file comparable to the row
 * above it in the history.
 *
 * They are CONSECUTIVE for a reason that cost a snapshot to learn. The first
 * attempt sampled 1/4/6/8/10/12 — the same difficulty span in six columns —
 * and reported 80% of rows as step functions while `--contested`, scanning
 * every rung, measured 2.20 contested levels per row. Both were right: a row
 * contested at levels 7 and 8 shows up once in a sample that skips 7. A table
 * read as "the shape of the ladder" must not sample every other rung of it.
 */
const ASSAULT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const seedOf = (a: number, b: number, c: number): number =>
  ((a * 7919 + b * 104729 + c * 2654435761 + 977) & 0x7fffffff) >>> 0;

// ---- raid side: a fixed ~27-manpower expedition per faction ---------------------

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
const RAID_PLANS: Record<FactionId, SquadPlan[]> = {
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

/**
 * The v1.0 air thesis, offense side: roughly the same manpower, flown. Two
 * squads of rotors and a small ground tail, so the run still has something
 * to hold ground while the air layer works.
 *
 * **These are a THESIS, not a derived optimum, and v1.25 measured the
 * difference.** `--derive-air` searches the whole roster under one constraint —
 * the force must contain something flown — and four of five factions answer
 * with exactly ONE aircraft, the minimum the constraint allows, spending the
 * rest on ground. It beats these plans by up to +16.7. Kept as written anyway,
 * because the `--air` table's question is "what does flying buy you", and a
 * reference that has quietly stopped flying cannot answer it. The honest
 * reading is in the ROADMAP: air costs 2.5 to 10.8 clear points for everyone
 * except China.
 */
const AIR_RAID_PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { reaper: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { reaper: 2 }, sector: 'N1', doctrine: 'assault' },
    { units: { ranger: 2, engineer: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  china: [
    { units: { wz10: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { wz10: 2 }, sector: 'N1', doctrine: 'assault' },
    { units: { rifle: 2, sapper: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  russia: [
    { units: { ka52: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { ka52: 1 }, sector: 'N1', doctrine: 'assault' },
    { units: { motorrifle: 2, demoteam: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  nk: [
    { units: { an2: 4 }, sector: 'W1', doctrine: 'hunt' },
    { units: { an2: 4 }, sector: 'N1', doctrine: 'assault' },
    { units: { nkrifle: 3, tunneler: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  un: [
    { units: { nh90: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { nh90: 2 }, sector: 'N1', doctrine: 'assault' },
    { units: { peacekeeper: 2, unsapper: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
};

/** Deterministic gallery head for a base: the first valid site among fixed
 * offsets from the command post, east side first (behind most wall lines).
 *
 * In this board's cells. The 20x30 list, halved away from the post (M34): the
 * same directions at the same distance, just outside the minimum. Its two
 * outer fallbacks halved onto the first two and are gone. */
function nkTunnelCell(base: GeneratedBase): number | undefined {
  const ccCol = base.ccOrigin % MAP_W;
  const ccRow = Math.floor(base.ccOrigin / MAP_W);
  const candidates: [number, number][] = [
    [3, 0], [-3, 0], [0, -3], [0, 3], [3, 2], [-3, -2],
  ];
  for (const [dc, dr] of candidates) {
    const cell = (ccRow + dr) * MAP_W + (ccCol + dc);
    if (tunnelSiteValid(base, cell)) return cell;
  }
  return undefined;
}

/** Which squads go underground: hunt+raze, raze alone, or the whole raid. */
const TUNNEL_POLICIES: number[][] = [[1, 2], [2], [0, 1, 2]];

/**
 * A tunnel plan the way a player would pick one: scout the base, try the
 * sensible options, commit to what works. Five probe seeds (disjoint from
 * the measurement seeds) score each policy; fixed order + strict improvement
 * keeps the choice deterministic per base.
 */
function tunnelPlanFor(
  faction: FactionId,
  base: GeneratedBase,
  tier: number,
  from?: SquadPlan[],
): SquadPlan[] {
  // `from` lets a caller ask where a DIFFERENT force should dig — the rung
  // sweep resizes the plan, and a tunnel policy chosen for the reference
  // force is not the one a quarter of it would pick.
  const plans = from ?? RAID_PLANS[faction];
  const mouth = nkTunnelCell(base);
  if (mouth === undefined) return plans;
  const catalog = raidCatalogFor(faction);
  const trainable = trainableFor(faction);
  let best = plans;
  let bestScore = -1;
  for (const idxs of TUNNEL_POLICIES) {
    const candidate = plans.map((p, i) => (idxs.includes(i) ? { ...p, tunnel: mouth } : p));
    let score = 0;
    for (let i = 0; i < 5; i++) {
      const config = raidConfig(base, candidate, seedOf(tier, 99, i), trainable, {});
      const res = resolveRaid(config, candidate, tier, catalog);
      score += (res.cleared ? 1000 : 0) + Math.round(res.destructionPct * 100);
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

function planManpower(faction: FactionId, plans: SquadPlan[] = RAID_PLANS[faction]): number {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  return plans.reduce(
    (total, squad) =>
      total +
      Object.entries(squad.units).reduce((s, [kind, n]) => s + (meta[kind] ?? 0) * n, 0),
    0,
  );
}

/**
 * Manpower sent and manpower home, from one resolution.
 *
 * The column has read MP LOST% since v0.3 and was counting HEADS. `deployed`
 * and `returned` on a `SquadReturn` are unit counts, so a 7-MP Ka-52 and a
 * 1-MP conscript weighed the same. Ground rosters field similar mixes and the
 * proxy held there; air does not, and `--air` is where it broke — a
 * three-airframe force reads as catastrophic for losing what a nine-body force
 * shrugs off, which is the opposite of what "air buys survival" wants to test.
 *
 * `raidRows` at the top of this file always did it correctly, off `res.deployed`
 * and `res.losses` weighted by kind; five later tables each re-implemented it
 * by hand and each got heads. This is that computation, extracted.
 *
 * `--delay` and `--vet` are deliberately NOT converted: both headers say "men
 * returned%" and mean it, and `--delay`'s per-seat column could not be
 * converted anyway — the resolution carries survivors per KIND and returns per
 * SQUAD, never per kind per squad.
 */
function manpowerFlow(faction: FactionId, res: RaidResolution): { sent: number; home: number } {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  let sent = 0;
  let home = 0;
  for (const [kind, n] of Object.entries<number>(res.deployed)) sent += (meta[kind] ?? 0) * n;
  for (const [kind, n] of Object.entries<number>(res.survivors)) home += (meta[kind] ?? 0) * n;
  return { sent, home };
}

/**
 * How much FORCE each rung demands (v1.30) — the ladder, measured honestly.
 *
 * Every other ladder table in this file fights all five rungs with the same
 * reference plan, and that plan is a mature army: the USA's is three Abrams
 * and a Javelin, 27 manpower, which needs a barracks and a motor pool most of
 * the way up. Against a tier-1 firebase it clears 100%. So does tier 2. The
 * "step size" between them was therefore reported as -0, and the ROADMAP has
 * carried "the shallow rungs are free" as a balance defect since M15.
 *
 * It is not a defect, or at least the evidence for it was never there. **A
 * clear rate pinned at 100 cannot show a step.** The metric saturates, and two
 * rungs that differ by a real amount both report the ceiling.
 *
 * The question a ladder actually poses is not "what does one army do to every
 * rung" — no player ever fights that way, because the tier advances on clears
 * and the town grows alongside it. It is **how much force does this rung
 * demand**. So this table sweeps a manpower budget per rung and reports the
 * smallest one that clears half the time. A graded ladder makes each rung ask
 * for meaningfully more than the last; a free rung asks for the same.
 *
 * The composition is held at the reference plan's proportions and only the
 * SIZE moves, so this measures the rung and not a change of doctrine.
 */
// Roughly 20% apart at the bottom and 10% at the top. The coarse original
// jumped 27 -> 33, so any rung needing 28 to 32 reported as one or the other
// and four of five factions read "flat at the top" when their clear rates were
// plainly separating. A grid that cannot resolve a step will invent one.
const RUNG_BUDGETS = [4, 6, 8, 11, 14, 18, 22, 25, 28, 31, 34, 38, 42, 48] as const;
const RUNG_SEEDS = 12;

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
function planAtBudget(
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

/** Clear rate of a budgeted force against a whole rung's dealt pool. */
function rungClear(
  faction: FactionId,
  tier: number,
  budget: number,
  shape: SquadPlan[] = RAID_PLANS[faction],
  seeds: number = RUNG_SEEDS,
): number {
  const plans = planAtBudget(faction, budget, shape);
  let cleared = 0;
  let runs = 0;
  for (let variant = 0; variant < VARIANTS; variant++) {
    const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
    const squads =
      faction === 'nk'
        ? tunnelPlanFor(faction, base, tier, plans).map((squad, at) => ({ ...squad, slot: at }))
        : plans;
    for (let i = 0; i < seeds; i++) {
      const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
      if (resolveRaid(config, squads, tier, raidCatalogFor(faction)).cleared) cleared++;
      runs++;
    }
  }
  return runs > 0 ? (cleared / runs) * 100 : 0;
}

/**
 * The smallest force in the sweep that clears at least half the time, reported
 * as the manpower it actually FIELDS rather than the budget it was given —
 * the budget grid is coarse and two budgets often deal the same men.
 */
function budgetToClear(
  faction: FactionId,
  tier: number,
  shape: SquadPlan[] = RAID_PLANS[faction],
  budgets: readonly number[] = RUNG_BUDGETS,
  seeds: number = RUNG_SEEDS,
  confirm = false,
): number | null {
  /** Distinct forces on this grid, in order, with their fielded manpower. */
  const steps: { budget: number; fielded: number }[] = [];
  let last = -1;
  for (const budget of budgets) {
    const fielded = planManpower(faction, planAtBudget(faction, budget, shape));
    if (fielded === last) continue; // same force, already measured
    last = fielded;
    steps.push({ budget, fielded });
  }
  const clears = new Map<number, number>();
  const at = (i: number): number => {
    const cached = clears.get(i);
    if (cached !== undefined) return cached;
    const got = rungClear(faction, tier, steps[i]!.budget, shape, seeds);
    clears.set(i, got);
    return got;
  };
  for (let i = 0; i < steps.length; i++) {
    if (at(i) < 50) continue;
    // A crossing that immediately un-crosses was noise. Demand is monotone in
    // budget, so requiring the next force up to clear too costs one probe and
    // removes the single-probe flukes that made the first air table read
    // 12/12/28/12/38 — a shape no real demand curve has.
    if (confirm && i + 1 < steps.length && at(i + 1) < 50) continue;
    return steps[i]!.fielded;
  }
  return null;
}

/**
 * What a rung actually deals in a slot.
 *
 * `archetypeFor` is now only the fallback — the shipped deal is a measured
 * table of (shape, layout) pairs (`DEAL_TABLE`). Reading the fallback here
 * made every coverage table in this file describe a deal the game had stopped
 * using, which is the same class of mistake as the harness that reported a
 * flow it never drove.
 */
function dealtShape(tier: number, slot: number, faction: FactionId): ArchetypeId {
  return dealPairFor(tier, slot, faction)?.[0] ?? archetypeFor(tier, slot, faction).id;
}

interface RaidRow {
  tier: number;
  clearPct: number;
  destructionPct: number;
  lossPct: number;
}

function raidMatrix(
  faction: FactionId,
  support?: RaidSupport,
  tunneled = false,
  plansOverride?: SquadPlan[],
  shape?: ArchetypeId,
): RaidRow[] {
  const catalog = raidCatalogFor(faction);
  const kit = baseKitFor(faction);
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  const rows: RaidRow[] = [];

  for (const tier of RAID_TIERS) {
    let cleared = 0;
    let destruction = 0;
    let lossMp = 0;
    let deployedMp = 0;
    let runs = 0;
    for (let variant = 0; variant < VARIANTS; variant++) {
      const base = generateBase(tier, variant, kit, shape);
      const squads =
        plansOverride ?? (tunneled ? tunnelPlanFor(faction, base, tier) : RAID_PLANS[faction]);
      for (let i = 0; i < SEEDS; i++) {
        const config = raidConfig(
          base,
          squads,
          seedOf(tier, variant, i),
          trainableFor(faction),
          support ?? {},
        );
        const res = resolveRaid(config, squads, tier, catalog);
        runs++;
        if (res.cleared) cleared++;
        destruction += res.destructionPct;
        for (const [kind, n] of Object.entries(res.deployed)) deployedMp += (meta[kind] ?? 0) * n;
        for (const [kind, n] of Object.entries(res.losses)) lossMp += (meta[kind] ?? 0) * n;
      }
    }
    rows.push({
      tier,
      clearPct: Math.round((cleared / runs) * 100),
      destructionPct: Math.round((destruction / runs) * 100),
      lossPct: Math.round((lossMp / deployedMp) * 100),
    });
  }
  return rows;
}

// ---- defense side: three reference bases vs the assault ladder ------------------

// The reference bases themselves live in `./referenceBases` (M24 Phase 2).

/**
 * The reference towns as v1.40-v1.44 drew them, on the 20x30 board at one unit
 * a cell. Nothing is played there any more. They are kept because two M34
 * instruments measure the move FROM them: `--similar` maps them by the one
 * rule, and `--native` holds the curve they published against the one the
 * bases above fight.
 */
function v1ReferenceBases(): ReferenceBase[] {
  const board = V1_GRID;
  const at = (u: number, v: number): CellIndex => u * board.width + v;
  // EARLY (CC1): one wall line, one gap, three guns — two nests and an
  // autocannon. 16 wall segments of the 50 it could lay, and that gap was
  // checked rather than assumed: doubling the maze to 32 moved level 4 not at
  // all, at any attacker strength from 0.6x to 1.4x.
  const early: ReferenceBase = { name: 'EARLY (CC1)', ccLevel: 1, board, walls: [], structures: [] };
  wallLine(early, 20, 1, 18, [9, 10]);
  early.structures = [
    { cell: at(22, 8), kind: 'm2nest', level: 1 },
    { cell: at(22, 11), kind: 'm2nest', level: 1 },
    { cell: at(21, 3), kind: 'autocannon', level: 1 },
  ];

  // MID (CC2): offset double line — a serpentine through two kill pockets.
  // Both AT posts overlap the inner wall's breach approaches: a lone tank
  // that stalls at the line to shell the CC from standoff must be reachable
  // by at least one of them, wherever the escort fight left holes.
  const mid: ReferenceBase = { name: 'MID (CC2)', ccLevel: 2, board, walls: [], structures: [] };
  wallLine(mid, 20, 1, 18, [9, 10]);
  wallLine(mid, 24, 1, 18, [3, 4, 15, 16]);
  mid.structures = [
    { cell: at(22, 8), kind: 'm2nest', level: 2 },
    { cell: at(22, 11), kind: 'm2nest', level: 2 },
    { cell: at(26, 4), kind: 'm2nest', level: 2 },
    { cell: at(25, 6), kind: 'autocannon', level: 2 },
    { cell: at(25, 13), kind: 'autocannon', level: 2 },
    { cell: at(28, 6), kind: 'mortar', level: 1 },
  ];

  // LATE (CC3): triple line, max emplacements at level 3.
  const late: ReferenceBase = { name: 'LATE (CC3)', ccLevel: 3, board, walls: [], structures: [] };
  wallLine(late, 17, 1, 18, [9, 10]);
  wallLine(late, 21, 1, 18, [2, 3, 16, 17]);
  wallLine(late, 25, 1, 18, [9, 10]);
  late.structures = [
    { cell: at(19, 8), kind: 'm2nest', level: 3 },
    { cell: at(19, 11), kind: 'm2nest', level: 3 },
    { cell: at(23, 3), kind: 'm2nest', level: 3 },
    { cell: at(23, 16), kind: 'm2nest', level: 3 },
    { cell: at(27, 8), kind: 'autocannon', level: 3 },
    { cell: at(27, 12), kind: 'autocannon', level: 3 },
    { cell: at(22, 9), kind: 'autocannon', level: 3 },
    { cell: at(29, 7), kind: 'mortar', level: 2 },
    { cell: at(29, 12), kind: 'mortar', level: 2 },
  ];

  return [early, mid, late];
}

/**
 * The bare defence tables as v1.44 published them — the bases above on 20x30,
 * kill chain v3 — in FACTION_IDS order, EARLY / MID / LATE, levels 1-12.
 *
 * Frozen here because docs/BALANCE.md moved on with the board, and two
 * instruments still measure against the old curve: `--similar`, whose first
 * act is to prove its 20x30 pass IS the game that was, and `--native`, because
 * it is the curve the 10x15 re-tune aims at.
 */
const V1_PUBLISHED: readonly (readonly number[])[] = [
  [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0], // USA
  [100, 100, 100, 100, 100, 100, 100, 85, 40, 0, 0, 0],
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 95, 90],
  [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0], // China
  [100, 100, 100, 100, 100, 100, 70, 5, 0, 0, 0, 0],
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 95, 45, 25],
  [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Russia
  [100, 100, 100, 100, 100, 100, 100, 55, 55, 0, 0, 0],
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90],
  [100, 100, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0], // North Korea
  [100, 100, 100, 100, 95, 95, 40, 10, 0, 0, 0, 0],
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 95, 40, 10],
  [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0], // UN
  [100, 100, 100, 100, 100, 100, 55, 10, 5, 0, 0, 0],
  [100, 100, 100, 100, 100, 100, 100, 100, 100, 75, 15, 0],
];

/** The bare defence tables docs/BALANCE.md publishes now, in the same order. */
function publishedDefense(): number[][] {
  const published: number[][] = [];
  const md = readFileSync('docs/BALANCE.md', 'utf8').split('\n');
  for (let i = 0; i < md.length; i++) {
    if (!/^DEFENSE — .+ permanent layer vs .+ assault ladder \(hold%\)$/.test(md[i]!)) continue;
    for (let r = 0; r < 3; r++) {
      published.push(md[i + 3 + r]!.split('|').slice(1).map((v) => Number(v.trim())));
    }
  }
  return published;
}

/**
 * Is there a way from the entry row to the post that breaks nothing? Walls and
 * structures block, four-connected — stricter than the pathfinder, so a base
 * that passes this is open to it too.
 */
function openPath(base: ReferenceBase): boolean {
  const { width, height, ccOrigin } = base.board;
  const blocked = new Set<number>([ccOrigin]);
  for (const w of base.walls) blocked.add(w.cell);
  for (const s of base.structures) blocked.add(s.cell);
  const seen = new Set<number>();
  const queue: number[] = [];
  for (let v = 0; v < width; v++) {
    if (!blocked.has(v)) {
      seen.add(v);
      queue.push(v);
    }
  }
  const cu = Math.floor(ccOrigin / width);
  const cv = ccOrigin % width;
  while (queue.length > 0) {
    const c = queue.shift()!;
    const u = Math.floor(c / width);
    const v = c % width;
    if (Math.abs(u - cu) + Math.abs(v - cv) === 1) return true;
    for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nu = u + du;
      const nv = v + dv;
      if (nu < 0 || nu >= height || nv < 0 || nv >= width) continue;
      const n = nu * width + nv;
      if (blocked.has(n) || seen.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return false;
}

/** How a gun is drawn on a base map: n nest, a autocannon, o mortar. */
const GLYPH: Record<string, string> = { m2nest: 'n', autocannon: 'a', mortar: 'o' };

/** A base as text: # wall, P post, and each gun by its glyph. */
function baseMap(base: ReferenceBase): string[] {
  const { width, height, ccOrigin } = base.board;
  const at = new Map<number, string>([[ccOrigin, 'P']]);
  for (const w of base.walls) at.set(w.cell, '#');
  for (const s of base.structures) at.set(s.cell, GLYPH[s.kind] ?? s.kind[0]!);
  const rows: string[] = [];
  for (let u = 0; u < height; u++) {
    let line = '';
    for (let v = 0; v < width; v++) line += at.get(u * width + v) ?? '.';
    rows.push(line);
  }
  return rows;
}

/**
 * Is a siege ever actually CLOSE? (M23 Phase 1)
 *
 * Every defence table in this file reports a VERDICT — held or did not. That
 * says nothing about whether the battle in between was a game. The GDD's first
 * pillar is "defense is the action game"; a defence that is decided in wave one
 * and watched for four more is a cutscene with a HUD, and no verdict column
 * can tell the two apart.
 *
 * So this measures the MARGIN OVER TIME. One row per (base, level): the
 * defender's command post integrity at the end of each wave, plus four
 * readings that say where the tension was, if anywhere.
 *
 * - **FIRST** is the first wave in which the post takes any damage at all.
 *   Every wave before it was watched rather than played — the attack never
 *   reached the thing that decides the battle.
 * - **BIGGEST** is the single wave that moved the margin most. If one wave
 *   does all the work, the others are pacing.
 * - **CLOSEST** is the lowest integrity reached across runs that were WON. A
 *   defence whose wins never dip below 90% was never in doubt; one that wins
 *   at 12% was a game.
 * - **LIVE** is the share of waves that moved the margin at all, which is the
 *   headline the milestone turns on.
 *
 * Deliberately NOT a counterfactual: nothing here forks a battle at wave three
 * and re-rolls it, because the engine cannot snapshot and a re-run from tick
 * zero with a different seed is a different battle, not a branch of this one.
 * What it can say is where the margin moved and how near it came, which is the
 * question as the milestone asked it.
 */
interface WaveTrace {
  /** Post integrity 0..1 at the end of each wave reached. */
  integrity: number[];
  held: boolean;
  /** Lowest integrity at any wave end, whatever the verdict. */
  low: number;
  /**
   * The battle hit the tick cap without reaching a verdict.
   *
   * Counted because the defence tables do NOT: `defenseMatrix` reads anything
   * that is not `victory` as a loss, so a stalemate has always been filed as a
   * defeat. Whether that is rare or routine is a question this row can answer
   * and that one cannot.
   */
  timedOut: boolean;
  /** Standing-order actions the policy actually landed. */
  acts: number;
  /** CP it spent, and CP still in hand when the battle ended. */
  spent: number;
  banked: number;
  kills: number;
  /** Chain stages the ATTACK completed, 0-4. >= 2 means SUPPRESS was passed. */
  stages: number;
  /** Armed defence structures still standing when the battle ended. */
  gunsLeft: number;
  /**
   * What a probe bills the town for (M23 Phase 6): every structure the battle
   * lost, the town's own among them — what `resolveProbe` bills since the
   * phase, where it billed all of them before — and wall segments.
   */
  structuresLost: number;
  ownLost: number;
  wallsLost: number;
  /** Stocked fire missions spent: real ordnance, bought with fuel. */
  strikes: number;
}

/**
 * What the defender is allowed to do. `null` is the Phase 1 baseline — the
 * permanent layer alone, spending nothing — and every other entry is the
 * closest thing the harness has to a player: a standing-orders preset with a
 * typically-stocked magazine, the same pairing `defenseMatrix` uses.
 */
type SiegePolicy = StandingOrders | null;

/**
 * Which battle a siege trace fights: the ladder's rung, or the PROBE the rung
 * sends when nobody is home (`--probes`, M23 Phase 6) — its first two waves
 * with the defender's economy off, which is the only battle standing orders
 * ever fight in the game. Every M23 phase before 6 judged the orders on the
 * ladder's sieges, which start with 40 to 80 CP and earn 1.2 a second.
 */
let FIGHT: 'ladder' | 'probe' = 'ladder';

function siegeTrace(
  faction: FactionId,
  base: ReferenceBase,
  level: number,
  seed: number,
  policy: SiegePolicy = null,
): WaveTrace {
  return siegeTraceOn(faction, base, level, seed, policy, CHAIN_CURRENT);
}

/** The same trace against a NAMED chain version, for sweeping candidates. */
function siegeTraceOn(
  faction: FactionId,
  base: ReferenceBase,
  level: number,
  seed: number,
  policy: SiegePolicy,
  chainVersion: number,
  attackerHp = 1,
): WaveTrace {
  const catalog = defenseCatalogFor(faction);
  // The table's own battle, so a trace is of a row the snapshot publishes.
  const config = defenseConfigFor(faction, base, level, seed, {
    orders: policy ?? undefined,
    chainVersion,
    ...(FIGHT === 'probe' ? { siege: probeAssault(level, enemyRosterFor(faction)) } : {}),
  });
  if (attackerHp !== 1) config.mods = { ...config.mods, attacker: { hp: attackerHp } };
  const engine = layDefense(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  const standing = ownStructures(engine);

  const max = engine.cc.profile.maxHp;
  const integrity: number[] = [];
  let low = 1;
  let seen = -1;
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) {
    engine.step();
    const now = Math.max(0, engine.cc.hp / max);
    if (now < low) low = now;
    // A wave ended when the index moved on, or when the battle did. Read the
    // margin at that boundary rather than on a clock, because waves are not
    // the same length and a tick-sampled curve would compare different things.
    if (engine.waveIndex > seen) {
      if (seen >= 0) integrity.push(now);
      seen = engine.waveIndex;
    }
  }
  integrity.push(Math.max(0, engine.cc.hp / max));
  return {
    integrity,
    held: engine.phase === 'victory',
    low,
    timedOut: engine.phase !== 'victory' && engine.phase !== 'defeat',
    acts: engine.ordersExecuted,
    spent: engine.stats.cpSpent,
    banked: engine.cp,
    kills: engine.stats.kills,
    stages: engine.chainStagesCleared,
    gunsLeft: engine.structures.filter((st) => st.hp > 0 && st.profile.weapon).length,
    structuresLost: engine.stats.structuresLost,
    ownLost: standing - ownStructures(engine),
    wallsLost: engine.stats.wallsLost,
    strikes: Object.entries(config.powerCharges ?? {}).reduce(
      (sum, [kind, stocked]) => sum + stocked - (engine.powerChargesLeft(kind) ?? stocked),
      0,
    ),
  };
}

/** The town's own buildings standing: not the post, not a field work bought with CP. */
function ownStructures(engine: Engine): number {
  return engine.structures.filter((st) => st.profile.kind !== 'cc' && st.hp > 0 && st.profile.cpCost === undefined)
    .length;
}

/** A cell of the contested band, with its bare verdict seed by seed. */
interface BandCell {
  faction: FactionId;
  base: ReferenceBase;
  level: number;
  bare: boolean[];
}

const BAND_STAGES = ['EARLY', 'MID', 'LATE'];
const bandStageOf = (c: BandCell): number => BAND_STAGES.findIndex((st) => c.base.name.startsWith(st));

/**
 * The band as it is NOW (M23 Phase 3c): every (faction, base, level) the
 * bare permanent layer holds between 5% and 95%. Phase 2 scoped the verbs to
 * MID levels 3-4 because on the six-rung ladder that was the only place a row
 * moved; the ladder has been lengthened, the board shrunk and the chain
 * changed since, and those cells are held every time now. A verb measured
 * where the row cannot move reads zero for a reason that is not the verb.
 */
function contestedBand(seeds: number): BandCell[] {
  const cells: BandCell[] = [];
  for (const faction of FACTION_IDS) {
    for (const base of referenceBases()) {
      for (const level of ASSAULT_LEVELS) {
        const bare = Array.from(
          { length: seeds },
          (_, i) => siegeTrace(faction, base, level, seedOf(level, base.ccLevel, i), null).held,
        );
        const held = (bare.filter(Boolean).length / seeds) * 100;
        if (held >= 5 && held <= 95) cells.push({ faction, base, level, bare });
      }
    }
  }
  return cells;
}

interface BandScore {
  held: number;
  low: number;
  byStage: number[];
  acts: number;
  won: number;
  lost: number;
}

/**
 * Hold rate and mean low-water mark over every cell of the band, and by stage
 * — and the battles whose verdict the policy CHANGED, each way. The net is the
 * hold rate; the gross is whether the policy decides battles or only stirs
 * them, and a verb that flips as many losses into wins as wins into losses is
 * not leverage, it is noise with a price.
 *
 * The bare verdicts it is compared with were fought on the shipped chain, so a
 * candidate chain must fight a bare battle exactly as the shipped one does —
 * which a model that only changes what a fire mission does, does.
 */
function scoreOnBand(
  cells: BandCell[],
  seeds: number,
  policy: SiegePolicy,
  chainVersion = CHAIN_CURRENT,
): BandScore {
  let held = 0;
  let low = 0;
  let acts = 0;
  let won = 0;
  let lost = 0;
  let n = 0;
  const stageHeld = [0, 0, 0];
  const stageN = [0, 0, 0];
  for (const c of cells) {
    for (let i = 0; i < seeds; i++) {
      const r = siegeTraceOn(c.faction, c.base, c.level, seedOf(c.level, c.base.ccLevel, i), policy, chainVersion);
      if (r.held) {
        held++;
        stageHeld[bandStageOf(c)]!++;
      }
      if (r.held && !c.bare[i]) won++;
      if (!r.held && c.bare[i]) lost++;
      stageN[bandStageOf(c)]!++;
      low += r.low;
      acts += r.acts;
      n++;
    }
  }
  return {
    held: (held / n) * 100,
    low: low / n,
    byStage: stageHeld.map((h, st) => (stageN[st] ? (h / stageN[st]!) * 100 : NaN)),
    acts: acts / n,
    won,
    lost,
  };
}

/**
 * The battles changed each way, starred when the net is more than a coin
 * would give: a policy that changes W + L verdicts at random nets zero with
 * a spread of sqrt(W + L), so a net beyond twice that is a direction.
 */
function flipCell(got: { won: number; lost: number }): string {
  const star = Math.abs(got.won - got.lost) > 2 * Math.sqrt(got.won + got.lost);
  return pad(`+${got.won} -${got.lost}${star ? ' *' : '  '}`, 11);
}

/**
 * A policy of one rule, acting the moment it can afford to: the same budget,
 * threshold and cooldown for every verb, so the verb and its aim are all that
 * vary.
 */
function oneRulePolicy(
  action: 'deploy' | 'power',
  kind: string,
  target: StandingOrderTarget,
  price: number,
  minKnot?: number,
): StandingOrders {
  return {
    id: 'probe',
    maxActions: 3,
    rules: [
      {
        cpAtLeast: price,
        action,
        kind,
        target,
        minHostiles: 2,
        cooldownTicks: 200,
        ...(minKnot !== undefined ? { minKnot } : {}),
      },
    ],
  };
}

/**
 * The verb set, ONE AT A TIME — the table M23 Phase 2 exists to produce.
 *
 * The shipped presets each bundle three rules, so `--leverage` can say HOLDFAST
 * carries all the leverage and cannot say WHICH of its three rules does. This
 * runs a policy with exactly one rule, and holds everything else fixed: the
 * same budget, the same hostile threshold, the same cooldown, and a `cpAtLeast`
 * equal to the thing's own price so every verb acts the moment it can afford
 * to. What varies is the verb and where it is aimed.
 *
 * Scoped to the contested band — every (faction, base, level) the permanent
 * layer alone holds between 5% and 95% of seeds — because a verb measured on a
 * row that cannot move reads zero for a reason that has nothing to do with the
 * verb. Phase 2 ran it on MID (CC2) levels 3-4, the only place a row moved on
 * the six-rung ladder; Phase 3c re-ran it on the band the longer ladder built,
 * which is what found both of chain 5's reasons to exist.
 *
 * The prior worth testing: since M22, SUPPRESS gates the post on every live gun
 * within `coverRadius`, so a deployed GUN adds a gate the attacker must clear
 * while a mine or a fire mission only does damage. If that is right, the verbs
 * that place weapons should beat the ones that deal damage, and two of the
 * three shipped presets are written for the HP sponge the chain replaced.
 */
function verbTable(seeds = 20): string {
  interface Verb {
    label: string;
    action: 'deploy' | 'power';
    kind: string;
    target: StandingOrderTarget;
    price: number;
    minKnot?: number;
  }
  const VERBS: Verb[] = [
    { label: 'depmg -> breach', action: 'deploy', kind: 'depmg', target: 'breach', price: 25 },
    { label: 'depmg -> ccApproach', action: 'deploy', kind: 'depmg', target: 'ccApproach', price: 25 },
    { label: 'depmg -> densest', action: 'deploy', kind: 'depmg', target: 'densest', price: 25 },
    { label: 'foxhole -> breach', action: 'deploy', kind: 'foxhole', target: 'breach', price: 20 },
    { label: 'foxhole -> ccApproach', action: 'deploy', kind: 'foxhole', target: 'ccApproach', price: 20 },
    { label: 'claymore -> ccApproach', action: 'deploy', kind: 'claymore', target: 'ccApproach', price: 15 },
    { label: 'claymore -> densest', action: 'deploy', kind: 'claymore', target: 'densest', price: 15 },
    { label: 'a10 -> densest', action: 'power', kind: 'a10', target: 'densest', price: 45 },
    { label: 'arty -> densest', action: 'power', kind: 'arty', target: 'densest', price: 60 },
    // Fire on the assault at the post, once a knot of that many is inside its
    // cover ring (M23 Phase 5): the orders COUNTERBATTERY and HOLDFAST give.
    // Aimed at the post itself instead, a strike goes the moment it can be
    // paid for and lands on an empty post; 3c measured that at +0 and +3.
    { label: 'a10 -> assault k2', action: 'power', kind: 'a10', target: 'assault', price: 45, minKnot: 2 },
    { label: 'arty -> assault k3', action: 'power', kind: 'arty', target: 'assault', price: 60, minKnot: 3 },
  ];

  const CELLS = contestedBand(seeds);
  const STAGES = BAND_STAGES;
  const stageOf = bandStageOf;
  const score = (policy: SiegePolicy): BandScore => scoreOnBand(CELLS, seeds, policy);
  const flips = flipCell;

  const bare = score(null);
  const perStage = STAGES.map((_, st) => CELLS.filter((c) => stageOf(c) === st).length);
  const signed = (d: number) => (Number.isNaN(d) ? '—' : d >= 0 ? `+${d.toFixed(0)}` : d.toFixed(0));
  const lines = [
    `VERBS — one rule at a time, on the contested band: ${CELLS.length} cells ` +
      `(EARLY ${perStage[0]}, MID ${perStage[1]}, LATE ${perStage[2]}) held 5-95% bare, ${seeds} seeds each`,
    'VERB                   | HELD | vs NONE |   LOW | vs NONE | EARLY |   MID |  LATE |       FLIPS',
    '-----------------------+------+---------+-------+---------+-------+-------+-------+------------',
    `${pad('(nothing)', 22)} | ${pad(`${bare.held.toFixed(0)}%`, 4)} |       — | ` +
      `${bare.low.toFixed(3)} |       — | ${bare.byStage.map((h) => pad(Number.isNaN(h) ? '—' : `${h.toFixed(0)}%`, 5)).join(' | ')} |           —`,
  ];
  for (const verb of VERBS) {
    const got = score(oneRulePolicy(verb.action, verb.kind, verb.target, verb.price, verb.minKnot));
    const dHeld = got.held - bare.held;
    const dLow = got.low - bare.low;
    lines.push(
      `${pad(verb.label, 22)} | ${pad(`${got.held.toFixed(0)}%`, 4)} | ` +
        `${pad(dHeld >= 0 ? `+${dHeld.toFixed(0)}` : dHeld.toFixed(0), 7)} | ` +
        `${got.low.toFixed(3)} | ${pad(dLow >= 0 ? `+${dLow.toFixed(3)}` : dLow.toFixed(3), 7)} | ` +
        got.byStage.map((h, st) => pad(signed(h - bare.byStage[st]!), 5)).join(' | ') +
        ` | ${flips(got)}`,
    );
  }
  lines.push('');
  lines.push(
    'FLIPS: the battles the rule changed, each way, on the same seeds. * marks a net beyond twice ' +
      'the square root of the gross — what changing that many verdicts at random would not give.',
  );

  // ---- and what the SHIPPED presets do with those verbs ------------------------
  //
  // Rules are evaluated in list order and every action spends one of
  // `maxActions`, so a cheap rule at the top with a short cooldown can eat the
  // whole budget before an expensive rule further down ever gets a turn. The
  // two repairs below change ONE thing each, to say whether that is what is
  // happening rather than to fix anything: TRIPWIRE's is still not shipped,
  // because it would make one doctrine the answer on two stages of three.
  const gunAtApproach = {
    cpAtLeast: 45,
    action: 'deploy',
    kind: 'depmg',
    target: 'ccApproach',
    minHostiles: 3,
    cooldownTicks: 240,
  };
  const PRESETS: [string, StandingOrders][] = [
    ['HOLDFAST (shipped)', STANDING_ORDERS.holdfast],
    ['COUNTERBATTERY (shipped)', STANDING_ORDERS.counterbattery],
    ['TRIPWIRE (shipped)', STANDING_ORDERS.tripwire],
    [
      'TRIPWIRE less the claymore',
      {
        ...STANDING_ORDERS.tripwire,
        rules: STANDING_ORDERS.tripwire.rules.filter((r) => r.kind !== 'claymore'),
      } as StandingOrders,
    ],
    [
      'CBTY + a gun at the approach',
      {
        ...STANDING_ORDERS.counterbattery,
        rules: [gunAtApproach, ...STANDING_ORDERS.counterbattery.rules],
      } as unknown as StandingOrders,
    ],
    // HOLDFAST as it was before Phase 3c moved its second gun to the breach,
    // fought on today's chain: the rule that repair exists to take out.
    ['HOLDFAST, gun at the post', standingOrdersFor('holdfast', CHAIN_ENGAGE)!],
    // HOLDFAST before Phase 5 aimed its gun run at the assault, on today's
    // chain, and COUNTERBATTERY with both its fire missions aimed there: the
    // re-aim HOLDFAST took, and the one COUNTERBATTERY's claymore defeats.
    ['HOLDFAST, air on the mass', standingOrdersFor('holdfast', CHAIN_AIMED)!],
    [
      'CBTY, fire on the assault',
      {
        ...STANDING_ORDERS.counterbattery,
        rules: STANDING_ORDERS.counterbattery.rules.map((r) =>
          r.action === 'power' ? { ...r, target: 'assault', minKnot: r.kind === 'a10' ? 2 : 3 } : r,
        ),
      } as StandingOrders,
    ],
  ];
  lines.push('');
  lines.push(
    'PRESETS — the same cells: the shipped three, two one-line repairs, HOLDFAST before 3c, ' +
      'HOLDFAST before Phase 5, and COUNTERBATTERY re-aimed as HOLDFAST was',
  );
  lines.push('PRESET                       | HELD | vs NONE |   LOW | ACTS | EARLY |   MID |  LATE |       FLIPS');
  lines.push('-----------------------------+------+---------+-------+------+-------+-------+-------+------------');
  for (const [label, policy] of PRESETS) {
    const got = score(policy);
    const d = got.held - bare.held;
    lines.push(
      `${pad(label, 28)} | ${pad(`${got.held.toFixed(0)}%`, 4)} | ` +
        `${pad(d >= 0 ? `+${d.toFixed(0)}` : d.toFixed(0), 7)} | ${got.low.toFixed(3)} | ` +
        `${pad(got.acts.toFixed(1), 4)} | ` +
        got.byStage.map((h, st) => pad(signed(h - bare.byStage[st]!), 5)).join(' | ') +
        ` | ${flips(got)}`,
    );
  }
  return lines.join('\n');
}

/**
 * M23 Phase 6: the battle standing orders actually fight.
 *
 * Standing orders run only in offline probes: the first two waves of the
 * town's rung with the defender's economy off, so every CP they spend is one
 * a kill earned. This reads, per faction, base and probe level, how often the
 * permanent layer alone holds, and how often each shipped preset does — on
 * the reference towns, and on EARLY cut to two guns and to one, the towns of
 * a commander who climbed faster than they built.
 */
function probeHeldTable(seeds = 8): string {
  FIGHT = 'probe';
  const [early, mid, late] = referenceBases();
  const cut = (keep: number): ReferenceBase => ({
    ...early!,
    name: `EARLY, ${keep} gun${keep === 1 ? '' : 's'}`,
    structures: early!.structures.slice(0, keep),
  });
  const bases = [cut(1), cut(2), early!, mid!, late!];
  const levels = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
  const policies: [string, SiegePolicy][] = [
    ['none', null],
    ['HOLDFAST', STANDING_ORDERS.holdfast],
    ['CBTY', STANDING_ORDERS.counterbattery],
    ['TRIPWIRE', STANDING_ORDERS.tripwire],
  ];
  const lines = [
    `PROBES — held with no orders and under each preset, ${seeds} seeds, levels ${levels.join(' ')}`,
    `FACTION  | BASE          | POLICY   | ${levels.map((l) => pad(`L${l}`, 4)).join(' ')}`,
  ];
  for (const faction of FACTION_IDS) {
    for (const base of bases) {
      for (const [label, policy] of policies) {
        const cells = levels.map((level) => {
          let held = 0;
          for (let i = 0; i < seeds; i++) {
            if (siegeTraceOn(faction, base, level, seedOf(level, base.ccLevel, i), policy, CHAIN_CURRENT).held) held++;
          }
          return pad(`${Math.round((held / seeds) * 100)}`, 4);
        });
        lines.push(`${pad(faction.toUpperCase(), 8)} | ${pad(base.name, 13)} | ${pad(label, 8)} | ${cells.join(' ')}`);
      }
    }
  }

  // ---- and what they cost and save when the probe is held anyway ---------------
  //
  // A held probe bills 3% of the stockpile per building lost, capped at 10%,
  // and a breach 15% (`resolveProbe`); every order the garrison carries out
  // bills ORDERS_UPKEEP_SUPPLIES on top. So an order that changes no verdict can
  // still pay for itself by saving buildings — or be a tax. OLD BILL is the
  // rule before M23 Phase 6, which counted every structure the battle lost:
  // the garrison's own mines going off, and the guns it bought with CP.
  const UPKEEP = 15;
  const probeLevels = [1, 2, 3, 4, 5, 6, 7, 8];
  lines.push('');
  lines.push(
    `WHAT A PROBE BILLS — levels ${probeLevels.join('-')}, every faction, ${seeds} seeds: held, ` +
      `structures and wall segments lost, the stockpile share billed, orders carried out, and their upkeep`,
  );
  lines.push(
    'BASE          | POLICY   | HELD | STRUCT |  OWN | WALLS | OLD BILL | BILLED | ORDERS | UPKEEP | STRIKES | BREAK-EVEN STOCKPILE',
  );
  for (const base of bases) {
    let bareShare = 0;
    for (const [label, policy] of policies) {
      let held = 0;
      let lost = 0;
      let own = 0;
      let walls = 0;
      let oldShare = 0;
      let share = 0;
      let acts = 0;
      let strikes = 0;
      let n = 0;
      for (const faction of FACTION_IDS) {
        for (const level of probeLevels) {
          for (let i = 0; i < seeds; i++) {
            const r = siegeTraceOn(faction, base, level, seedOf(level, base.ccLevel, i), policy, CHAIN_CURRENT);
            if (r.held) held++;
            lost += r.structuresLost;
            own += r.ownLost;
            walls += r.wallsLost;
            oldShare += r.held ? Math.min(0.03 * r.structuresLost, 0.1) : 0.15;
            share += r.held ? Math.min(0.03 * r.ownLost, 0.1) : 0.15;
            acts += r.acts;
            strikes += r.strikes;
            n++;
          }
        }
      }
      oldShare /= n;
      share /= n;
      if (policy === null) bareShare = share;
      const saved = bareShare - share;
      const upkeep = (acts / n) * UPKEEP;
      // The stockpile at which the share an order saves equals what it bills.
      const even = policy === null ? '—' : saved > 0 ? `${Math.round(upkeep / saved)}` : 'never';
      lines.push(
        `${pad(base.name, 13)} | ${pad(label, 8)} | ${pad(`${((held / n) * 100).toFixed(0)}%`, 4)} | ` +
          `${pad((lost / n).toFixed(2), 6)} | ${pad((own / n).toFixed(2), 4)} | ${pad((walls / n).toFixed(2), 5)} | ` +
          `${pad(`${(oldShare * 100).toFixed(2)}%`, 8)} | ${pad(`${(share * 100).toFixed(2)}%`, 6)} | ` +
          `${pad((acts / n).toFixed(2), 6)} | ${pad(upkeep.toFixed(1), 6)} | ${pad((strikes / n).toFixed(2), 7)} | ${even}`,
      );
    }
  }
  return lines.join('\n');
}

/** Every order of `n` things, the identity first. */
function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1)) {
    for (let at = rest.length; at >= 0; at--) out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
  }
  return out.sort((a, b) => a.join().localeCompare(b.join()));
}

/** A rule as a word: what it stands up or calls in. */
const RULE_WORD: Record<string, string> = { depmg: 'gun', foxhole: 'fox', claymore: 'mine', a10: 'a10', arty: 'arty' };

/**
 * M23 Phase 6: what rule ORDER is worth, measured before deciding what it
 * should mean.
 *
 * Every order of each shipped preset's three rules, on the contested band,
 * under the two meanings order can have. EVALUATED first is what the engine
 * has always done: in any one second a rule is looked at before the ones
 * below it, and that is all. FUNDED first is `priority`: a rule that wants to
 * act and is short of its reserve holds back every rule below it, and a rule
 * keeps an action in hand for each rule above it that has not acted yet.
 *
 * Three questions. Does order matter as the engine stands? Does funded-first
 * leave each preset what it was, since the shipped orders were written under
 * the other meaning? And is the best order the same everywhere — in which case
 * letting the player choose it is a trap with the answer printed on it — or
 * does it change with the stage and the faction, which would make choosing it
 * a decision?
 */
function orderTable(seeds = 20): string {
  const cells = contestedBand(seeds);
  const stages = BAND_STAGES;
  /** Held seeds per cell, and actions taken. */
  const run = (policy: SiegePolicy): { held: boolean[][]; acts: number } => {
    let acts = 0;
    const held = cells.map((c) =>
      Array.from({ length: seeds }, (_, i) => {
        const r = siegeTraceOn(c.faction, c.base, c.level, seedOf(c.level, c.base.ccLevel, i), policy, CHAIN_CURRENT);
        acts += r.acts;
        return r.held;
      }),
    );
    return { held, acts: acts / (cells.length * seeds) };
  };
  const rate = (held: boolean[][], pick: (c: BandCell) => boolean): number => {
    let h = 0;
    let n = 0;
    held.forEach((seedsHeld, k) => {
      if (!pick(cells[k]!)) return;
      for (const x of seedsHeld) {
        if (x) h++;
        n++;
      }
    });
    return n ? (h / n) * 100 : NaN;
  };
  const bareHeld = cells.map((c) => c.bare);
  const all = (): boolean => true;
  const bareRate = rate(bareHeld, all);
  const bareStage = stages.map((_, st) => rate(bareHeld, (c) => bandStageOf(c) === st));
  const bareFaction = FACTION_IDS.map((f) => rate(bareHeld, (c) => c.faction === f));
  const signed = (d: number) => (Number.isNaN(d) ? '—' : d >= 0 ? `+${d.toFixed(0)}` : d.toFixed(0));

  interface Row {
    preset: string;
    order: number[];
    words: string;
    priority: boolean;
    held: number;
    stage: number[];
    faction: number[];
    acts: number;
    won: number;
    lost: number;
    verdicts: string;
  }
  const rows: Row[] = [];
  for (const id of ['holdfast', 'counterbattery', 'tripwire'] as const) {
    const preset = STANDING_ORDERS[id];
    for (const order of permutations(preset.rules.length)) {
      for (const priority of [false, true]) {
        const policy: StandingOrders = {
          ...preset,
          rules: order.map((k) => preset.rules[k]!),
          ...(priority ? { priority: true } : {}),
        };
        const got = run(policy);
        let won = 0;
        let lost = 0;
        got.held.forEach((seedsHeld, k) =>
          seedsHeld.forEach((x, i) => {
            if (x && !cells[k]!.bare[i]) won++;
            if (!x && cells[k]!.bare[i]) lost++;
          }),
        );
        rows.push({
          preset: id,
          order,
          words: order.map((k) => RULE_WORD[preset.rules[k]!.kind] ?? preset.rules[k]!.kind).join(' > '),
          priority,
          held: rate(got.held, all),
          stage: stages.map((_, st) => rate(got.held, (c) => bandStageOf(c) === st)),
          faction: FACTION_IDS.map((f) => rate(got.held, (c) => c.faction === f)),
          acts: got.acts,
          won,
          lost,
          verdicts: got.held.map((x) => x.map((b) => (b ? '1' : '0')).join('')).join(''),
        });
      }
    }
  }

  const perStage = stages.map((_, st) => cells.filter((c) => bandStageOf(c) === st).length);
  const lines = [
    `ORDER — every order of each preset's rules, evaluated first and funded first, on the contested band of ` +
      `${FIGHT === 'probe' ? 'PROBES' : 'ladder sieges'}: ` +
      `${cells.length} cells (EARLY ${perStage[0]}, MID ${perStage[1]}, LATE ${perStage[2]}), ${seeds} seeds each`,
    `(nothing) holds ${bareRate.toFixed(0)}%. Columns are held, and held against no orders, overall and by stage.`,
    '',
    'PRESET         | ORDER              | MEANING   | HELD | vs NONE | EARLY |   MID |  LATE | ACTS |       FLIPS',
    '---------------+--------------------+-----------+------+---------+-------+-------+-------+------+------------',
  ];
  for (const r of rows) {
    lines.push(
      `${pad(r.preset.toUpperCase(), 14)} | ${pad(r.words + (r.order.join() === '0,1,2' ? ' *' : ''), 18)} | ` +
        `${pad(r.priority ? 'funded' : 'evaluated', 9)} | ${pad(`${r.held.toFixed(0)}%`, 4)} | ` +
        `${pad(signed(r.held - bareRate), 7)} | ` +
        r.stage.map((h, st) => pad(signed(h - bareStage[st]!), 5)).join(' | ') +
        ` | ${pad(r.acts.toFixed(1), 4)} | ${flipCell(r)}`,
    );
  }
  lines.push('');
  lines.push('* the shipped order. FLIPS as in --verbs.');

  // ---- does order matter at all, meaning by meaning ------------------------------
  lines.push('');
  lines.push('DISTINCT — how many of the six orders fight different battles, seed by seed');
  for (const id of ['holdfast', 'counterbattery', 'tripwire']) {
    for (const priority of [false, true]) {
      const mine = rows.filter((r) => r.preset === id && r.priority === priority);
      const distinct = new Set(mine.map((r) => r.verdicts)).size;
      const spread = Math.max(...mine.map((r) => r.held)) - Math.min(...mine.map((r) => r.held));
      lines.push(
        `${pad(id.toUpperCase(), 14)} | ${pad(priority ? 'funded' : 'evaluated', 9)} | ` +
          `${distinct} of ${mine.length} distinct | best to worst ${spread.toFixed(0)} points held`,
      );
    }
  }

  // ---- is the best order the same everywhere ------------------------------------
  const best = (mine: Row[], pick: (r: Row) => number): string => {
    const top = Math.max(...mine.map(pick));
    return mine
      .filter((r) => pick(r) >= top - 0.001)
      .map((r) => r.words)
      .join(' = ');
  };
  lines.push('');
  lines.push('BEST — the order that holds most, funded first, by stage and by faction (ties joined)');
  for (const id of ['holdfast', 'counterbattery', 'tripwire']) {
    const mine = rows.filter((r) => r.preset === id && r.priority);
    lines.push(`${id.toUpperCase()}`);
    lines.push(`  overall  ${best(mine, (r) => r.held)}`);
    stages.forEach((name, st) => lines.push(`  ${pad(name, 8)} ${best(mine, (r) => r.stage[st]!)}`));
    FACTION_IDS.forEach((f, k) =>
      lines.push(`  ${pad(f.toUpperCase(), 8)} ${best(mine, (r) => r.faction[k]!)}  (none ${bareFaction[k]!.toFixed(0)}%)`),
    );
  }
  return lines.join('\n');
}

/**
 * M23 Phase 5: the fire missions, re-judged with a job the chain can see.
 *
 * Phase 3c found that on the contested band a gun decides battles and a fire
 * mission only stirs them. Two things were behind it, and this table prices
 * each on its own. The first is WHEN the duty officer calls a strike: on the
 * densest knot on the board the moment it can pay, which is usually the
 * column still forming at the edge of the map, or on the assault at the post
 * once a knot of two or three is inside its cover ring (`assault`,
 * `minKnot`). The second is what a strike DOES: damage alone on chain 5, and
 * on chain 6 a pin, which leaves every unit it lands on moving no stage of the
 * chain for `pinSeconds`.
 *
 * The pin rows below the shipped model are candidates registered under
 * throwaway version numbers, as `--band` does: the pin's length, and which
 * armour it catches. Every row is judged by the rule `--verbs` judges by, on
 * the band it measures on.
 */
function pinTable(seeds = 20): string {
  const cells = contestedBand(seeds);
  const base = chainModelFor(CHAIN_PINNED);
  type Fire = [string, string, StandingOrderTarget, number, number?];
  const GUN_RUN: Fire = ['a10 -> assault k2', 'a10', 'assault', 45, 2];
  const ROWS: [string, number, Fire[]][] = [
    [
      'chain 5, no pin',
      CHAIN_AIMED,
      [
        ['a10 -> densest', 'a10', 'densest', 45],
        GUN_RUN,
        ['arty -> densest', 'arty', 'densest', 60],
        ['arty -> assault k2', 'arty', 'assault', 60, 2],
        ['arty -> assault k3', 'arty', 'assault', 60, 3],
      ],
    ],
    [
      'chain 6 (shipped)',
      CHAIN_PINNED,
      [
        ['a10 -> densest', 'a10', 'densest', 45],
        GUN_RUN,
        ['arty -> densest', 'arty', 'densest', 60],
        ['arty -> assault k2', 'arty', 'assault', 60, 2],
        ['arty -> assault k3', 'arty', 'assault', 60, 3],
      ],
    ],
  ];
  const PROBES: [string, Partial<ChainModel>][] = [
    ['pin 8s, inf + light', { pinArmor: ['none', 'light'] }],
    ['pin 8s, heavy only', { pinArmor: ['heavy'] }],
    ['pin 5s, all ground', { pinSeconds: 5 }],
    ['pin 12s, all ground', { pinSeconds: 12 }],
  ];
  PROBES.forEach(([label, over], at) => {
    const version = 900 + at;
    CHAIN_MODELS[version] = { ...base, ...over, version };
    ROWS.push([label, version, [GUN_RUN]]);
  });

  const bare = scoreOnBand(cells, seeds, null);
  const perStage = BAND_STAGES.map((_, st) => cells.filter((c) => bandStageOf(c) === st).length);
  const signed = (d: number) => (Number.isNaN(d) ? '—' : d >= 0 ? `+${d.toFixed(0)}` : d.toFixed(0));
  const lines = [
    `PINS — fire missions on the contested band: ${cells.length} cells ` +
      `(EARLY ${perStage[0]}, MID ${perStage[1]}, LATE ${perStage[2]}), ${seeds} seeds, ` +
      `bare ${bare.held.toFixed(0)}%`,
    'CHAIN                | VERB               | HELD | vs NONE | EARLY |   MID |  LATE |       FLIPS',
    '---------------------+--------------------+------+---------+-------+-------+-------+------------',
  ];
  for (const [label, version, fires] of ROWS) {
    for (const [verb, kind, target, price, minKnot] of fires) {
      const got = scoreOnBand(cells, seeds, oneRulePolicy('power', kind, target, price, minKnot), version);
      lines.push(
        `${pad(label, 20)} | ${pad(verb, 18)} | ${pad(`${got.held.toFixed(0)}%`, 4)} | ` +
          `${pad(signed(got.held - bare.held), 7)} | ` +
          got.byStage.map((h, st) => pad(signed(h - bare.byStage[st]!), 5)).join(' | ') +
          ` | ${flipCell(got)}`,
      );
    }
  }
  lines.push('');
  lines.push(
    'k: the knot the order waits for inside the post\'s cover ring (minKnot). FLIPS as --verbs: ' +
      '* is a net beyond twice the square root of the gross.',
  );
  return lines.join('\n');
}

/**
 * WHY is a row decided before anybody plays?
 *
 * `--leverage` found that 37 of 45 rows come back identical under every
 * policy, which is a fact about the rows and not about the verb list. This
 * asks what the defender was actually ABLE to do in them, because three very
 * different situations all read as "the policy changed nothing" and each one
 * wants a different fix:
 *
 * - **STARVED** — no actions, no CP banked. The policy could not afford to
 *   play. CP comes from `cpPerSecond` and from `cpValue` per kill, so a
 *   defence that is being overrun earns least exactly when it needs most.
 * - **IDLE** — no actions, CP piling up. The policy had the money and its
 *   rules never fired: a `cpAtLeast` it never cleared, a target shape that
 *   never appeared, an action budget spent early.
 * - **SPENT AND LOST** — actions at the ceiling and the row still falls. The
 *   verbs fired and did not matter, which is the only one of the three that
 *   is an argument about the verbs themselves.
 *
 * Run under HOLDFAST alone, because `--leverage` showed it is the only preset
 * that moves a row at all: asking what the other two were able to do is a
 * question about presets, and this is a question about battles.
 */
function spendTable(levels = [2, 3, 4], seeds = 20): string {
  const lines = [
    `SPEND — what could the defender DO? HOLDFAST, means over ${seeds} seeds`,
    'FACTION  | BASE        | LVL | HELD | KILLS |    CP SPENT |   CP BANKED | ACTS | READ',
    '---------+-------------+-----+------+-------+-------------+-------------+------+---------------',
  ];
  const tally: Record<string, number> = { starved: 0, idle: 0, 'spent, lost': 0, live: 0 };

  for (const faction of FACTION_IDS) {
    for (const base of referenceBases()) {
      for (const level of levels) {
        const runs = Array.from({ length: seeds }, (_, i) =>
          siegeTrace(
            faction,
            base,
            level,
            seedOf(level, base.ccLevel, i),
            STANDING_ORDERS.holdfast,
          ),
        );
        const mean = (f: (r: WaveTrace) => number): number =>
          runs.reduce((a, r) => a + f(r), 0) / runs.length;
        const held = (runs.filter((r) => r.held).length / runs.length) * 100;
        const acts = mean((r) => r.acts);
        const spent = mean((r) => r.spent);
        const banked = mean((r) => r.banked);
        const kills = mean((r) => r.kills);

        // A row is only "decided" if it is decided the same way every seed;
        // anything in between is a row the player is already inside.
        const read =
          held > 0 && held < 100
            ? 'live'
            : acts >= 0.5
              ? held === 100
                ? 'spent, won'
                : 'spent, lost'
              : banked >= 1
                ? 'idle'
                : 'starved';
        tally[read] = (tally[read] ?? 0) + 1;

        lines.push(
          `${pad(faction.toUpperCase(), 8)} | ${pad(base.name, 11)} | ${pad(String(level), 3)} | ` +
            `${pad(`${held.toFixed(0)}%`, 4)} | ${pad(kills.toFixed(1), 5)} | ` +
            `${pad(spent.toFixed(1), 11)} | ${pad(banked.toFixed(1), 11)} | ` +
            `${pad(acts.toFixed(1), 4)} | ${read}`,
        );
      }
    }
  }

  lines.push('');
  for (const [name, n] of Object.entries(tally)) {
    if (n > 0) lines.push(`${name.toUpperCase()}: ${n} rows`);
  }
  return lines.join('\n');
}

/**
 * Does PLAYING change the outcome?
 *
 * M23 Phase 1 measured the defence with the player absent and found 28% of
 * waves moving the margin at all. That says the battle is passive; it does not
 * say whether a player COULD have changed it, and those are different claims.
 * This is the second one: the same board, the same seed, the same attack, with
 * the defender's policy as the only variable.
 *
 * The four policies are everything the headless harness can express as player
 * input — doing nothing, and the three shipped standing-orders presets with a
 * stocked magazine. The magazine rides along with the policy and not with the
 * baseline, which would be a second variable if it did anything by itself; it
 * does not, because nothing casts a power unless a policy or an autoPower rule
 * asks for it. Pinned in `standingOrders.test.ts` ("a magazine with no policy
 * to spend it changes nothing at all") rather than assumed, and checked here
 * across all 45 rows: the NONE column reproduces `--siege`'s HELD exactly.
 *
 * That is a floor on the verb set's leverage, not a ceiling:
 * a human picks targets a policy cannot. But it is the RIGHT floor to know
 * before adding a verb, because if the verbs that exist move nothing on a row,
 * the row is what needs fixing and a fourth verb will read zero too.
 *
 * FLIPPED is the number Phase 2 has to move. It counts battles, not rows: for
 * one (base, level, seed) the four policies fight the identical attack, and a
 * flip is a seed where they did not agree on the verdict. A row-level average
 * would let one policy's good luck on seed 3 cancel another's bad luck on seed
 * 5 and report leverage that no single battle ever had.
 */
function leverageTable(levels = [2, 3, 4], seeds = 8): string {
  const policies: [string, SiegePolicy][] = [
    ['NONE', null],
    ['HOLD', STANDING_ORDERS.holdfast],
    ['CBTY', STANDING_ORDERS.counterbattery],
    ['TRIP', STANDING_ORDERS.tripwire],
  ];
  const lines = [
    `LEVERAGE — does playing change the outcome? Policy is the only variable (${seeds} seeds)`,
    'FACTION  | BASE        | LVL | ' +
      policies.map(([name]) => pad(name, 4)).join(' | ') +
      ' | SPREAD | FLIPPED | BEST dLOW',
    '---------+-------------+-----+------+------+------+------+--------+---------+-----------',
  ];
  let flippedBattles = 0;
  let allBattles = 0;
  let deadRows = 0;
  let allRows = 0;
  let bestGain = 0;

  for (const faction of FACTION_IDS) {
    for (const base of referenceBases()) {
      for (const level of levels) {
        // [policy][seed] — held as a grid so a seed can be read ACROSS
        // policies, which is the whole point of the table.
        const grid = policies.map(([, policy]) =>
          Array.from({ length: seeds }, (_, i) =>
            siegeTrace(faction, base, level, seedOf(level, base.ccLevel, i), policy),
          ),
        );
        const holds = grid.map((runs) => (runs.filter((r) => r.held).length / seeds) * 100);
        let flips = 0;
        for (let i = 0; i < seeds; i++) {
          const verdicts = new Set(grid.map((runs) => runs[i]!.held));
          if (verdicts.size > 1) flips++;
        }
        flippedBattles += flips;
        allBattles += seeds;
        allRows++;
        const spread = Math.max(...holds) - Math.min(...holds);
        if (spread === 0 && flips === 0) deadRows++;

        // How much lower the post was allowed to get — averaged per seed, and
        // the best policy read per seed rather than per row, because "the
        // best policy" is a choice a player makes for THIS battle.
        let gain = 0;
        for (let i = 0; i < seeds; i++) {
          const bare = grid[0]![i]!.low;
          const best = Math.max(...grid.slice(1).map((runs) => runs[i]!.low));
          gain += best - bare;
        }
        gain /= seeds;
        if (gain > bestGain) bestGain = gain;

        lines.push(
          `${pad(faction.toUpperCase(), 8)} | ${pad(base.name, 11)} | ${pad(String(level), 3)} | ` +
            holds.map((h) => pad(`${h.toFixed(0)}%`, 4)).join(' | ') +
            ` | ${pad(spread.toFixed(0), 6)} | ${pad(`${flips}/${seeds}`, 7)} | ` +
            `${pad(gain >= 0 ? `+${gain.toFixed(3)}` : gain.toFixed(3), 10)}`,
        );
      }
    }
  }

  const pct = (a: number, b: number): string => (b > 0 ? ((a / b) * 100).toFixed(0) : '0');
  lines.push('');
  lines.push(
    `FLIPPED ${pct(flippedBattles, allBattles)}% — the share of BATTLES whose verdict depended on the ` +
      'policy. This is the second number M23 Phase 2 judges a verb by, and the ' +
      'first one it has to move: a verb that does not change what happens is decoration.',
  );
  lines.push(
    `NO VERB HELPS ${pct(deadRows, allRows)}% of rows came back identical under all four policies — ` +
      'same hold rate, no seed disagreeing. On those the verb set is not weak, it is absent, ' +
      'and a fifth verb added to the same battle would read zero too.',
  );
  lines.push(
    `BEST dLOW +${bestGain.toFixed(3)} — the largest a policy ever moved how close the post came to ` +
      'falling, averaged over seeds. Integrity is continuous where a verdict is not, so this ' +
      'sees leverage that has not yet grown big enough to flip a battle.',
  );
  return lines.join('\n');
}

function siegeTable(levels = [2, 3, 4], seeds = 8): string {
  const lines = [
    `PRESSURE — is a siege ever close? Post integrity at each wave end (${seeds} seeds)`,
    'FACTION  | BASE        | LVL | W1  W2  W3  W4  W5  W6 | FIRST | BIGGEST  | CLOSEST | HELD | STALL',
    '---------+-------------+-----+------------------------+-------+----------+---------+------+------',
  ];
  let liveWaves = 0;
  let allWaves = 0;
  let neverClose = 0;
  let wonRows = 0;
  let stalled = 0;
  let allRuns = 0;

  for (const faction of FACTION_IDS) {
    for (const base of referenceBases()) {
      for (const level of levels) {
        const runs: WaveTrace[] = [];
        for (let i = 0; i < seeds; i++) {
          runs.push(siegeTrace(faction, base, level, seedOf(level, base.ccLevel, i)));
        }
        const waves = Math.max(...runs.map((r) => r.integrity.length));
        const mean = (at: number): number => {
          const xs = runs.map((r) => r.integrity[Math.min(at, r.integrity.length - 1)] ?? 0);
          return xs.reduce((a, b) => a + b, 0) / xs.length;
        };
        const curve = Array.from({ length: waves }, (_, at) => mean(at));
        allWaves += waves;

        let first = 0;
        let biggest = 0;
        let biggestAt = 0;
        for (let at = 0; at < waves; at++) {
          const drop = (at === 0 ? 1 : curve[at - 1]!) - curve[at]!;
          if (drop > 0.005) {
            liveWaves++;
            if (first === 0) first = at + 1;
            if (drop > biggest) {
              biggest = drop;
              biggestAt = at + 1;
            }
          }
        }
        const won = runs.filter((r) => r.held);
        const closest = won.length > 0 ? Math.min(...won.map((r) => r.low)) : null;
        if (won.length > 0) {
          wonRows++;
          if (closest! > 0.9) neverClose++;
        }
        const held = (runs.filter((r) => r.held).length / runs.length) * 100;
        const stalls = runs.filter((r) => r.timedOut).length;
        stalled += stalls;
        allRuns += runs.length;
        lines.push(
          `${pad(faction.toUpperCase(), 8)} | ${pad(base.name, 11)} | ${pad(String(level), 3)} | ` +
            Array.from({ length: 6 }, (_, at) =>
              at < waves ? pad(Math.round(curve[at]! * 100), 3) : '  —',
            ).join(' ') +
            ` | ${pad(first === 0 ? 'never' : `W${first}`, 5)} | ` +
            `${pad(biggest > 0 ? `W${biggestAt} -${Math.round(biggest * 100)}` : '—', 8)} | ` +
            `${pad(closest === null ? '—' : closest.toFixed(2), 7)} | ${pad(`${held.toFixed(0)}%`, 4)} | ` +
            `${pad(stalls > 0 ? `${Math.round((stalls / runs.length) * 100)}%` : '—', 5)}`,
        );
      }
    }
  }

  lines.push('');
  lines.push(
    `LIVE WAVES ${allWaves > 0 ? ((liveWaves / allWaves) * 100).toFixed(0) : 0}% — the share of waves that moved the margin AT ALL. ` +
      'The rest were watched: the attack never reached the one thing that decides the battle.',
  );
  lines.push(
    `NEVER IN DOUBT ${wonRows > 0 ? ((neverClose / wonRows) * 100).toFixed(0) : 0}% of rows that were won never dropped below 90% ` +
      'integrity in ANY seed. GDD pillar 1 says defence is the action game; a row like that is a HUD over a cutscene.',
  );
  lines.push(
    `STALLED ${allRuns > 0 ? ((stalled / allRuns) * 100).toFixed(0) : 0}% of runs hit the tick cap with no verdict, and every ` +
      'defence table in this file has been filing those as losses — `defenseMatrix` reads anything that is',
    'not a victory as "did not hold". A stalemate is not a defeat, and a row that is mostly stalemate is not',
    'a hold rate.',
  );
  lines.push(
    'FIRST is the first wave the post takes damage. BIGGEST is the wave that moved the margin most —',
    'one wave doing all of it means the others are pacing. CLOSEST is the lowest integrity reached in a',
    'run that was WON, which is the only number that can say a win was earned rather than collected.',
  );
  return lines.join('\n');
}

interface DefenseRow {
  stage: string;
  holdPct: number[];
}

/**
 * One defence-matrix battle's config. The ONE place it is built (M34).
 *
 * It used to be written out inside `defenseMatrix`, and M34's similarity check
 * needs the identical battle. A second hand-built copy would have doubled the
 * hazard the comment below describes, so both read it from here — and the
 * check's first act is to prove, cell for cell, that what it builds still
 * reproduces the published table.
 */
function defenseConfigFor(
  faction: FactionId,
  base: ReferenceBase,
  level: number,
  seed: number,
  opts: {
    mods?: DefenderMods;
    extraStructures?: LayoutStructure[];
    orders?: StandingOrders;
    chainVersion?: number;
    /** A candidate ladder, for `--retune`; the shipped one otherwise. */
    ladder?: Ladder;
    /**
     * An authored siege to fight instead of the ladder's — a campaign
     * mission's, for `--missions`. Physical positions, like every other, and
     * `level` is ignored when it is given.
     */
    siege?: SiegeDef;
    /** Its tunnel mouths, physical, reserved as `missionConfig` reserves them. */
    tunnels?: readonly { col: number; row: number }[];
  } = {},
): SimConfig {
  const { mods, extraStructures = [], orders, chainVersion = CHAIN_CURRENT, ladder = LADDER } = opts;
  const { board } = base;
  const authored = opts.siege ?? buildAssault(level, enemyRosterFor(faction), ladder);
  const reserved = (opts.tunnels ?? []).map(
    (t) => onBoard(t.row, board.cellSize) * board.width + onBoard(t.col, board.cellSize),
  );
  return {
    width: board.width,
    height: board.height,
    // The board's cell, in the catalog's units (M34), named the way
    // `battleConfig` names it — and left out at one, so a 20x30 config is the
    // one v1.44 fought, field for field.
    ...(board.cellSize === 1 ? {} : { cellSize: board.cellSize }),
    seed,
    ccOrigin: board.ccOrigin,
    ccLevel: base.ccLevel,
    spawnLane: BASE_SPAWN_LANE,
    spawnEdge: BASE_SPAWN_EDGE,
    // The shipped game rolls (v1.23) and fights a staged objective (v1.41).
    // This matrix builds its config BY HAND rather than through
    // `battleConfig`, so it is the one place that quietly keeps measuring the
    // sim as it was — and it did exactly that, twice now. The v1.23 comment
    // predicted it; v1.41 shipped a whole milestone before anyone checked
    // whether the defence half of the snapshot had been told. Every line added
    // to `battleConfig` has to be added here too, or this file reports a game
    // nobody is playing.
    combatVersion: COMBAT_CURRENT,
    killChainVersion: chainVersion,
    // Authored in physical positions, and mapped onto the board's cells by
    // the one rule — `battleConfig`'s seam, again.
    siege: siegeOnBoard({ ...authored, startingSupplies: 0 }, board.cellSize),
    layout: {
      walls: base.walls.map((w) => ({ ...w })),
      structures: [...base.structures, ...extraStructures].map((s) => ({ ...s })),
    },
    // Orders rows fight with a typically-stocked magazine; bare rows stay
    // empty so every pre-v0.8 number is unchanged.
    powerCharges: orders ? { a10: 2, arty: 1 } : {},
    ...(orders ? { standingOrders: orders } : {}),
    ...(mods ? { mods: { defender: mods } } : {}),
    ...(reserved.length > 0 ? { reservedCells: reserved } : {}),
  };
}

/**
 * A defence battle's engine, refusing a layout it could not lay.
 *
 * The engine drops a layout piece that does not fit without a word — right
 * for a player's save, where a building a migration could not place must not
 * brick the battle, and wrong for an instrument, where a row that silently
 * lost a piece measures a base nobody drew. Two rows of the snapshot did
 * exactly that until M34: the Engineer Corps HQ was a 2x2 on the last row of
 * the 20x30 board from v1.40 on, and the AA cover's forward mount stood on
 * MID's inner wall from the day it was added. Neither was ever in a battle.
 */
function layDefense(config: SimConfig, catalog: Catalog): Engine {
  const engine = new Engine(config, catalog);
  const structures = config.layout?.structures ?? [];
  const walls = config.layout?.walls ?? [];
  const laid = structures.filter((s) =>
    engine.structures.some((st) => st.origin === s.cell && st.profile.kind === s.kind),
  ).length;
  const walled = walls.filter((w) => engine.grid.wallAt(w.cell)).length;
  if (laid !== structures.length || walled !== walls.length) {
    throw new Error(
      `a reference layout did not lay: ${laid}/${structures.length} structures, ` +
        `${walled}/${walls.length} walls`,
    );
  }
  return engine;
}

/** Run one defence battle to its verdict. */
function fightDefense(config: SimConfig, catalog: Catalog): Engine {
  const engine = layDefense(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) {
    engine.step();
  }
  return engine;
}

function defenseMatrix(
  faction: FactionId,
  mods?: DefenderMods,
  extraStructures: LayoutStructure[] = [],
  orders?: StandingOrders,
  levels: readonly number[] = ASSAULT_LEVELS,
): DefenseRow[] {
  const catalog = defenseCatalogFor(faction);
  const rows: DefenseRow[] = [];

  for (const base of referenceBases()) {
    const holds: number[] = [];
    for (const level of levels) {
      let held = 0;
      for (let i = 0; i < SEEDS; i++) {
        const config = defenseConfigFor(faction, base, level, seedOf(level, base.ccLevel, i), {
          mods,
          extraStructures,
          orders,
        });
        if (fightDefense(config, catalog).phase === 'victory') held++;
      }
      holds.push(Math.round((held / SEEDS) * 100));
    }
    rows.push({ stage: base.name, holdPct: holds });
  }
  return rows;
}

/**
 * Is the half-size board the same game? (M34 Phase 4 — the go/no-go)
 *
 * M34 moves the world from 20x30 to 10x15 as a similarity transform: every
 * distance and speed in the catalog halves (`sim/scale.ts`), so the ground is
 * the same and only the cells are bigger. What cannot halve is anything that
 * was already one cell — a gun, a wall — and the question this answers is how
 * much that costs, measured on the defence ladder the last three milestones
 * were spent tuning.
 *
 * Three passes per (faction, base, level):
 *
 *   FINE    the 20x30 board, the published seeds. Its first job is to prove the
 *           instrument: every cell must equal the table v1.44 shipped
 *           (`V1_PUBLISHED`), or the comparison below is between two things
 *           neither of which is the game that was.
 *   NULL    the 20x30 board again with twenty DIFFERENT seeds. How far two runs of
 *           the same game disagree is the noise floor, measured rather than
 *           assumed — at 20 seeds one cell's hold rate swings a long way by
 *           chance, and a drift is only a drift if it is bigger than that.
 *   COARSE  the FINE configs mapped by the one rule (`sim/board.ts`) onto 10x15
 *           at cell size 2 — exactly what migrating a player's base would do.
 *   REFINED the COARSE plan put back on the 20x30 grid at cell size 1: the coarse
 *           plan's exact shape, fought with fine pathing and a 2x2 post. It
 *           splits the drift in two, one variable each — FINE -> REFINED is what
 *           the MAPPING did to the plan, REFINED -> COARSE is what the GRID did
 *           to the battle.
 *
 * The defence tables are flat by design ("the permanent layer alone"), so no
 * terrain question enters: the only variable is the board.
 */
function similarity(chainVersion: number = CHAIN_LATCHED): void {
  const started = Date.now();
  const bases = v1ReferenceBases();
  const pct = (n: number) => Math.round((n / SEEDS) * 100);

  // ---- what the fixtures lose in the mapping ----------------------------------
  // A plan does not depend on the faction, so its mapping is reported once.
  console.log(`SIMILAR — is the 10x15 board the same game? (M34 Phase 4) — kill chain v${chainVersion}\n`);
  console.log('FIXTURES ON 10x15 (cell size 2), by the one rule:');
  for (const base of bases) {
    const { config, report } = coarsenConfig(
      defenseConfigFor('usa', base, 1, 1),
      defenseCatalogFor('usa'),
      2,
    );
    const dropped = report.structuresDropped.map((d) => `${d.kind} (${d.why})`);
    console.log(
      `  ${base.name.padEnd(11)}  structures ${base.structures.length} -> ` +
        `${config.layout!.structures.length}${dropped.length ? `, lost: ${dropped.join(', ')}` : ''}` +
        `   walls ${report.wallsIn} -> ${report.wallsOut}`,
    );
  }

  // ---- the three passes ---------------------------------------------------------
  type Cell = { fine: number; null: number; coarse: number; refined: number };
  const rows: { faction: FactionId; base: string; cells: Cell[] }[] = [];
  // Defender wins, and how many of them include a stall wipe-out: an assault
  // that stood on the post doing nothing until the rule removed it, rather than
  // one the defence stopped.
  const tally = {
    fine: { wins: 0, stalled: 0 },
    null: { wins: 0, stalled: 0 },
    coarse: { wins: 0, stalled: 0 },
    refined: { wins: 0, stalled: 0 },
  };
  const count = (key: keyof typeof tally, e: Engine): boolean => {
    const won = e.phase === 'victory';
    if (won) {
      tally[key].wins++;
      if (e.stallWipes > 0) tally[key].stalled++;
    }
    return won;
  };
  for (const faction of FACTION_IDS) {
    const catalog = defenseCatalogFor(faction);
    for (const base of bases) {
      const cells: Cell[] = [];
      for (const level of ASSAULT_LEVELS) {
        let fine = 0;
        let nul = 0;
        let coarse = 0;
        let refined = 0;
        for (let i = 0; i < SEEDS; i++) {
          const a = defenseConfigFor(faction, base, level, seedOf(level, base.ccLevel, i), {
            chainVersion,
          });
          if (count('fine', fightDefense(a, catalog))) fine++;
          const b = defenseConfigFor(faction, base, level, seedOf(level, base.ccLevel, i + SEEDS), {
            chainVersion,
          });
          if (count('null', fightDefense(b, catalog))) nul++;
          const small = coarsenConfig(a, catalog, 2).config;
          if (count('coarse', fightDefense(small, catalog))) coarse++;
          if (count('refined', fightDefense(refineConfig(small, 2), catalog))) refined++;
        }
        cells.push({ fine: pct(fine), null: pct(nul), coarse: pct(coarse), refined: pct(refined) });
      }
      rows.push({ faction, base: base.name, cells });
    }
  }

  // ---- the instrument, checked before it is believed ------------------------------
  // The FINE pass must reproduce the tables v1.44 published cell for cell.
  // They were fought on chain v3, so that is the only chain it can check.
  let agree = 0;
  let checked = 0;
  const off: string[] = [];
  if (chainVersion !== CHAIN_LATCHED) {
    console.log(
      `\nSELF-CHECK: skipped — the v1.44 tables were fought on chain v${CHAIN_LATCHED}, and this ` +
        `run is measuring v${chainVersion}. Run without CHAIN= to check the instrument.`,
    );
  } else {
    rows.forEach((row, r) => {
      row.cells.forEach((cell, l) => {
        checked++;
        if (V1_PUBLISHED[r]?.[l] === cell.fine) agree++;
        else off.push(`${row.faction} ${row.base} L${l + 1}: ${V1_PUBLISHED[r]?.[l]} vs ${cell.fine}`);
      });
    });
    console.log(
      `\nSELF-CHECK: the FINE pass against the tables v1.44 published — ${agree}/${checked} cells identical` +
        (off.length ? `\n  DISAGREES, do not trust what follows:\n    ${off.slice(0, 8).join('\n    ')}` : ''),
    );
  }

  // ---- the rows ---------------------------------------------------------------------
  console.log(
    `\nHOLD% BY LEVEL — FINE (20x30) / REFINED (coarse plan, fine grid) / COARSE (10x15), ${SEEDS} seeds`,
  );
  console.log(`FACTION | BASE        | BOARD   | ${ASSAULT_LEVELS.map((l) => pad(`L${l}`, 4)).join(' ')}`);
  for (const row of rows) {
    for (const which of ['fine', 'refined', 'coarse'] as const) {
      console.log(
        `${pad(which === 'fine' ? row.faction.toUpperCase() : '', 7)} | ${
          which === 'fine' ? row.base.padEnd(11) : ''.padEnd(11)
        } | ${which.padEnd(7)} | ${row.cells.map((c) => pad(c[which], 4)).join(' ')}`,
      );
    }
  }

  // ---- the verdict's numbers ----------------------------------------------------------
  const all = rows.flatMap((r) => r.cells);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const live = (x: number, y: number) => (x >= 5 && x <= 95) || (y >= 5 && y <= 95);
  type Key = 'fine' | 'null' | 'coarse' | 'refined';
  const drift = (from: Key, to: Key) => {
    const liveCells = all.filter((c) => live(c[from], c[to]));
    return {
      shift: mean(all.map((c) => c[to] - c[from])),
      all: mean(all.map((c) => Math.abs(c[to] - c[from]))),
      live: mean(liveCells.map((c) => Math.abs(c[to] - c[from]))),
      liveCells: liveCells.length,
      flips: rows.filter((r) => flip(r.cells, from) !== flip(r.cells, to)).length,
      flipShift: mean(rows.map((r) => flip(r.cells, to) - flip(r.cells, from))),
    };
  };
  const flip = (cells: Cell[], key: Key) => {
    const at = cells.findIndex((c) => c[key] < 50);
    return at < 0 ? ASSAULT_LEVELS.length + 1 : at + 1;
  };
  const contested = (key: Key) =>
    mean(rows.map((r) => r.cells.filter((c) => c[key] >= 5 && c[key] <= 95).length));
  const steps = [
    { label: 'NULL', note: 'same board, new seeds', d: drift('fine', 'null'), c: contested('null') },
    { label: 'MAPPING', note: 'fine -> refined', d: drift('fine', 'refined'), c: contested('refined') },
    { label: 'GRID', note: 'refined -> coarse', d: drift('refined', 'coarse'), c: contested('coarse') },
    { label: 'TOTAL', note: 'fine -> coarse', d: drift('fine', 'coarse'), c: contested('coarse') },
  ];
  const floor = steps[0]!.d;
  console.log('\nTHE DRIFT, ONE VARIABLE AT A TIME (hold% points; x = multiples of the noise floor)');
  console.log('STEP     | WHAT               | MEAN SHIFT | |DRIFT|/CELL     | LIVE CELLS           | FLIPS MOVED');
  console.log('---------+--------------------+------------+------------------+----------------------+------------');
  for (const { label, note, d } of steps) {
    const x = (v: number, f: number) => (label === 'NULL' ? '' : ` (${(v / Math.max(0.01, f)).toFixed(1)}x)`);
    console.log(
      `${label.padEnd(8)} | ${note.padEnd(18)} | ${pad(`${d.shift >= 0 ? '+' : ''}${d.shift.toFixed(1)}`, 10)} | ` +
        `${`${d.all.toFixed(1)}${x(d.all, floor.all)}`.padEnd(16)} | ` +
        `${`${d.live.toFixed(1)}${x(d.live, floor.live)} n=${d.liveCells}`.padEnd(20)} | ` +
        `${d.flips} of ${rows.length} (${d.flipShift >= 0 ? '+' : ''}${d.flipShift.toFixed(2)})`,
    );
  }
  console.log(
    `\ncontested levels per row: fine ${contested('fine').toFixed(2)}, null ${contested('null').toFixed(2)}, ` +
      `refined ${contested('refined').toFixed(2)}, coarse ${contested('coarse').toFixed(2)}`,
  );
  const share = (k: keyof typeof tally) =>
    `${tally[k].stalled}/${tally[k].wins} (${((100 * tally[k].stalled) / Math.max(1, tally[k].wins)).toFixed(1)}%)`;
  console.log(
    `defender wins that include a stall wipe-out: fine ${share('fine')}, null ${share('null')}, ` +
      `refined ${share('refined')}, coarse ${share('coarse')}`,
  );
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/**
 * The move, row by row: the reference bases drawn for 10x15 against the curve
 * the 20x30 bases published (M34, `--native`).
 *
 * Phase 4 established that a 10x15 board is a different game, so what is left
 * to measure is how different, with content made FOR it rather than mapped
 * onto it. Each base is fought on both chains — v3, the one the 20x30 tables
 * were fought on, and v4, today's, whose crews go after the guns covering the
 * post — so a row's drift splits into what the board did and what the chain
 * did. Every row is compared with v1.44's at the level where the defence first
 * holds under half: the number a re-tune has to move.
 *
 * Checked before it is believed, twice. A bare native battle must be exactly
 * what the one rule makes of a bare 20x30 one — the waves, the post, the lane,
 * the cell — so a row differs from v1.44's by the layout and the chain and
 * nothing else. And the v4 pass is today's game, so it must reproduce the
 * tables docs/BALANCE.md publishes, cell for cell: the job `--similar` does
 * for the 20x30 board.
 */
function nativeCheck(): void {
  const started = Date.now();
  const bases = referenceBases();
  const fine = v1ReferenceBases();
  const { width, height } = TOWN_GRID;
  console.log('NATIVE — the reference bases drawn for 10x15 (M34)\n');
  const maps = bases.map(baseMap);
  console.log(bases.map((b) => b.name.padEnd(width + 4)).join(''));
  for (let u = 0; u < height; u++) {
    console.log(maps.map((m) => m[u]!.padEnd(width + 4)).join(''));
  }
  const open = bases.map((b) => `${b.name}: ${openPath(b) ? 'open' : 'SEALED'}, ${b.walls.length} walls`);
  console.log(`\n${open.join(' · ')}`);
  if (bases.some((b) => !openPath(b))) throw new Error('a native base has no way in');

  // Everything a base does not decide is the one rule's.
  const bare = (base: ReferenceBase): ReferenceBase => ({ ...base, walls: [], structures: [] });
  let mapped = 0;
  for (const faction of FACTION_IDS) {
    for (const [b, base] of bases.entries()) {
      for (const level of ASSAULT_LEVELS) {
        const seed = seedOf(level, base.ccLevel, 0);
        const was = defenseConfigFor(faction, bare(fine[b]!), level, seed);
        const one = coarsenConfig(was, defenseCatalogFor(faction), 2).config;
        if (!isDeepStrictEqual(one, defenseConfigFor(faction, bare(base), level, seed))) {
          throw new Error(`${faction} ${base.name} L${level}: a bare native battle is not the mapped one`);
        }
        mapped++;
      }
    }
  }
  console.log(`MAPPING: all ${mapped} bare native battles are the one rule's mapping of the 20x30 ones`);

  type Row = { faction: FactionId; base: string; today: readonly number[]; v3: number[]; v4: number[] };
  const rows: Row[] = [];
  const stalls = { v3: { wins: 0, stalled: 0 }, v4: { wins: 0, stalled: 0 } };
  const pct = (n: number) => Math.round((n / SEEDS) * 100);
  let r = 0;
  for (const faction of FACTION_IDS) {
    const catalog = defenseCatalogFor(faction);
    for (const base of bases) {
      const v3: number[] = [];
      const v4: number[] = [];
      for (const level of ASSAULT_LEVELS) {
        let held3 = 0;
        let held4 = 0;
        for (let i = 0; i < SEEDS; i++) {
          // Seeded exactly as the published table's cell, so a row differs
          // from v1.44's by the board and the chain and nothing else.
          const seed = seedOf(level, base.ccLevel, i);
          for (const [chain, tally] of [
            [CHAIN_LATCHED, stalls.v3],
            [CHAIN_ENGAGE, stalls.v4],
          ] as const) {
            const config = defenseConfigFor(faction, base, level, seed, { chainVersion: chain });
            const e = fightDefense(config, catalog);
            if (e.phase !== 'victory') continue;
            tally.wins++;
            if (e.stallWipes > 0) tally.stalled++;
            if (chain === CHAIN_LATCHED) held3++;
            else held4++;
          }
        }
        v3.push(pct(held3));
        v4.push(pct(held4));
      }
      rows.push({ faction, base: base.name, today: V1_PUBLISHED[r] ?? [], v3, v4 });
      r++;
    }
  }

  // The v4 pass is today's game, so it has to BE the snapshot. Version 5 is
  // version 4 with standing orders and fire plans that aim, and a bare battle
  // has neither, so it is today's game for a bare battle as long as that is
  // ALL that separates them.
  const published = publishedDefense();
  const bareModel = (version: number) => ({
    ...chainModelFor(version),
    version: 0,
    label: '',
    aimToScale: false,
    leadFire: false,
  });
  const current = isDeepStrictEqual(bareModel(CHAIN_CURRENT), bareModel(CHAIN_ENGAGE)) ? 'v4' : null;
  if (current) {
    const cells = rows.flatMap((row) => row[current]);
    const agree = cells.filter((c, i) => published[Math.floor(i / 12)]?.[i % 12] === c).length;
    console.log(
      `SELF-CHECK: the ${current} pass against docs/BALANCE.md — ${agree}/${cells.length} cells identical` +
        (agree === cells.length ? '' : ' (a snapshot from before this change, or a tool that drifted from it)'),
    );
  }

  console.log(`\nHOLD% BY LEVEL — v1.44 (20x30, v3, published) / NATIVE 10x15 on v3 / on v4, ${SEEDS} seeds`);
  console.log(`FACTION | BASE        | BOARD     | ${ASSAULT_LEVELS.map((l) => pad(`L${l}`, 4)).join(' ')}`);
  for (const row of rows) {
    for (const which of ['today', 'v3', 'v4'] as const) {
      console.log(
        `${pad(which === 'today' ? row.faction.toUpperCase() : '', 7)} | ${
          which === 'today' ? row.base.padEnd(11) : ''.padEnd(11)
        } | ${(which === 'today' ? 'v1.44' : `native ${which}`).padEnd(9)} | ${row[which]
          .map((c) => pad(c, 4))
          .join(' ')}`,
      );
    }
  }

  // Where each row first holds under half — the level a re-tune has to move.
  const falls = (cells: readonly number[]) => {
    const at = cells.findIndex((c) => c < 50);
    return at < 0 ? ASSAULT_LEVELS.length + 1 : at + 1;
  };
  const show = (l: number) => (l > ASSAULT_LEVELS.length ? `>${ASSAULT_LEVELS.length}` : `L${l}`);
  const rises = (cells: number[]) => cells.slice(1).some((c, i) => c > cells[i]! + 15);
  console.log('\nWHERE EACH ROW FIRST HOLDS UNDER HALF');
  console.log('FACTION | BASE        | v1.44 | NATIVE v3    | NATIVE v4');
  const shifts = { v3: [] as number[], v4: [] as number[] };
  for (const row of rows) {
    const t = falls(row.today);
    const cell = (k: 'v3' | 'v4') => {
      const n = falls(row[k]);
      shifts[k].push(n - t);
      return `${show(n).padEnd(4)} (${n - t >= 0 ? '+' : ''}${n - t})${rises(row[k]) ? ' RISES' : ''}`;
    };
    console.log(
      `${pad(row.faction.toUpperCase(), 7)} | ${row.base.padEnd(11)} | ${show(t).padEnd(5)} | ${cell('v3').padEnd(12)} | ${cell('v4')}`,
    );
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const contested = (k: 'today' | 'v3' | 'v4') =>
    mean(rows.map((row) => row[k].filter((c) => c >= 5 && c <= 95).length));
  console.log(
    `\nmean shift of that level: v3 ${mean(shifts.v3).toFixed(2)}, v4 ${mean(shifts.v4).toFixed(2)} ` +
      `(mean |shift| ${mean(shifts.v3.map(Math.abs)).toFixed(2)} / ${mean(shifts.v4.map(Math.abs)).toFixed(2)})`,
  );
  console.log(
    `rows that rise by more than 15 points: v3 ${rows.filter((x) => rises(x.v3)).length}, ` +
      `v4 ${rows.filter((x) => rises(x.v4)).length} of ${rows.length}`,
  );
  console.log(
    `contested levels per row: v1.44 ${contested('today').toFixed(2)}, native v3 ${contested('v3').toFixed(2)}, ` +
      `native v4 ${contested('v4').toFixed(2)}`,
  );
  const share = (k: 'v3' | 'v4') =>
    `${stalls[k].stalled}/${stalls[k].wins} (${((100 * stalls[k].stalled) / Math.max(1, stalls[k].wins)).toFixed(1)}%)`;
  console.log(`defender wins that include a stall wipe-out: v3 ${share('v3')}, v4 ${share('v4')}`);
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/**
 * Re-tune the ladder for 10x15 (M34 Phase 8, `--retune`).
 *
 * `--native` says where each row now first holds under half and how far that
 * is from where v1.44 put it. This prices candidate ladders against the same
 * question — every row on the native bases on today's chain, seeded as the
 * published cells — and scores each by how far the rows' falls move from
 * v1.44's, by stage, and how many contested levels a row keeps.
 *
 * The ladder rather than the chain, because the chain decides raids too and
 * the raid tables did not drift: a chain made kinder to defenders would buy
 * back the defence ladder by taking the Front Line's top rungs away.
 */
function retune(): void {
  const started = Date.now();
  // Every candidate is a whole ladder, written from v1.44's so the table is a
  // record of the decision rather than a diff against whatever ships today.
  const V144: Ladder = { growth: 0.09, heavyEvery: 2, rotorEvery: 2 };
  const CANDIDATES: [string, Ladder][] = [
    ['v1.44', V144],
    ['heavy /3', { ...V144, heavyEvery: 3 }],
    ['growth .07', { ...V144, growth: 0.07 }],
    ['growth .05', { ...V144, growth: 0.05 }],
    ['heavy /3 + rotor /3', { ...V144, heavyEvery: 3, rotorEvery: 3 }],
    ['heavy /3 + growth .07', { ...V144, heavyEvery: 3, growth: 0.07 }],
    ['heavy /3 + growth .06', { ...V144, heavyEvery: 3, growth: 0.06 }],
    ['heavy /3 + growth .05', { ...V144, heavyEvery: 3, growth: 0.05 }],
    ['heavy /3 + growth .07 + rotor /3', { ...V144, heavyEvery: 3, growth: 0.07, rotorEvery: 3 }],
    ['heavy /4', { ...V144, heavyEvery: 4 }],
    ['heavy /4 + growth .08', { ...V144, heavyEvery: 4, growth: 0.08 }],
    ['heavy /4 + growth .06', { ...V144, heavyEvery: 4, growth: 0.06 }],
    ['shipped', LADDER],
  ];
  const only = process.argv.slice(process.argv.indexOf('--retune') + 1).filter((a) => !a.startsWith('--'));
  const picked = only.length ? CANDIDATES.filter(([label]) => only.includes(label)) : CANDIDATES;
  const bases = referenceBases();
  const falls = (cells: readonly number[]) => {
    const at = cells.findIndex((c) => c < 50);
    return at < 0 ? ASSAULT_LEVELS.length + 1 : at + 1;
  };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const signed = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
  console.log(`RETUNE — candidate ladders on the native bases, chain v${CHAIN_CURRENT}, ${SEEDS} seeds`);
  console.log('shift = the level a row first holds under half, minus v1.44\'s (0 is on target)\n');
  console.log(
    'LADDER                 | SHIFT | |SHIFT| | EARLY | MID   | LATE  | CONTESTED | RISES | FALLS BY ROW (USA CHN RUS NK UN, E/M/L)',
  );
  for (const [label, ladder] of picked) {
    const shifts: number[] = [];
    const byStage: number[][] = [[], [], []];
    const contested: number[] = [];
    let rises = 0;
    const fallsRow: string[] = [];
    let r = 0;
    for (const faction of FACTION_IDS) {
      const catalog = defenseCatalogFor(faction);
      const cells: string[] = [];
      for (const [b, base] of bases.entries()) {
        const row = ASSAULT_LEVELS.map((level) => {
          let held = 0;
          for (let i = 0; i < SEEDS; i++) {
            const config = defenseConfigFor(faction, base, level, seedOf(level, base.ccLevel, i), { ladder });
            if (fightDefense(config, catalog).phase === 'victory') held++;
          }
          return Math.round((held / SEEDS) * 100);
        });
        if (process.argv.includes('--rows')) {
          console.log(`  ${faction.toUpperCase().padEnd(6)} ${base.name.padEnd(11)} ${row.map((c) => pad(c, 4)).join('')}`);
        }
        const shift = falls(row) - falls(V1_PUBLISHED[r]!);
        shifts.push(shift);
        byStage[b]!.push(shift);
        contested.push(row.filter((c) => c >= 5 && c <= 95).length);
        if (row.slice(1).some((c, i) => c > row[i]! + 15)) rises++;
        cells.push(String(falls(row)));
        r++;
      }
      fallsRow.push(cells.join('/'));
    }
    console.log(
      `${label.padEnd(22)} | ${pad(signed(mean(shifts)), 5)} | ${pad(mean(shifts.map(Math.abs)).toFixed(2), 7)} | ` +
        `${byStage.map((xs) => pad(signed(mean(xs)), 5)).join(' | ')} | ${pad(mean(contested).toFixed(2), 9)} | ` +
        `${pad(rises, 5)} | ${fallsRow.join(' ')}`,
    );
  }
  console.log(
    `\nv1.44 falls by row: ${FACTION_IDS.map((_, f) => [0, 1, 2].map((b) => falls(V1_PUBLISHED[f * 3 + b]!)).join('/')).join(' ')}` +
      ` · contested per row 1.67`,
  );
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/**
 * Every campaign as v1.44 fought it: the 20x30 reference bases on chain v3,
 * the missions as they were written for that board, standard difficulty,
 * hold% over forty seeds, EARLY / MID / LATE. Frozen because the missions
 * were re-authored for the 10x15 board after it (v1.45.1), and the instrument
 * that checks them needs the campaign they were written to play like.
 */
const V1_CAMPAIGN: Record<FactionId, readonly (readonly number[])[]> = {
  usa: [
    [100, 100, 100], // M1 DIG IN
    [100, 100, 100], // M2 FIRST BLOOD
    [100, 100, 100], // M3 THE BREACH
    [100, 100, 100], // M4 CONVOY
    [0, 100, 100], // M5 SUPPRESSION
    [100, 100, 100], // M6 INFILTRATION
    [0, 95, 100], // M7 ARMOR PROBE
    [0, 3, 100], // M8 THE LONG NIGHT
    [0, 88, 100], // M9 LANDFALL
  ],
  china: [
    [100, 100, 100], // M1 BEACHHEAD
    [100, 100, 100], // M2 COUNTERATTACK
    [100, 100, 100], // M3 DEMOLITION TEAMS
    [3, 100, 100], // M4 JAVELIN RAIN
    [0, 55, 100], // M5 ARMOR SPEARHEAD
    [0, 15, 100], // M6 THE TIDE BREAKS
  ],
  russia: [
    [100, 100, 100], // M1 THE RAILHEAD
    [100, 100, 100], // M2 WHITEOUT
    [100, 100, 100], // M3 SAPPERS ON THE ICE
    [10, 100, 100], // M4 RIDGELINE MISSILES
    [0, 95, 100], // M5 STEEL ON STEEL
    [0, 68, 100], // M6 THE CORRIDOR HOLDS
  ],
  nk: [
    [100, 100, 100], // M1 THE ENCLAVE
    [100, 100, 100], // M2 NO MOON
    [100, 100, 100], // M3 BREACHING CHARGES
    [0, 100, 100], // M4 FIRE ON THE BLUFFS
    [0, 75, 100], // M5 UP THE 101
    [0, 35, 100], // M6 DAYLIGHT
  ],
  un: [
    [100, 100, 100], // M1 THE CORRIDOR
    [100, 100, 100], // M2 RULES OF ENGAGEMENT
    [100, 100, 100], // M3 SAPPERS AT THE WIRE
    [50, 100, 100], // M4 GRENADIER LINE
    [0, 90, 100], // M5 ARMOR ON THE FIVE
    [0, 13, 100], // M6 THE MANDATE HOLDS
  ],
};

/**
 * The campaign on the new board (`--missions`, after M34).
 *
 * Every faction's missions moved to 10x15 and chain v4 in v1.45, and nothing
 * measured them: the ladder has always had a harness and the campaign never
 * did. The same move put the ladder's rows 1.13 levels toward the attacker
 * before it was re-tuned, so the missions are presumed moved until this says
 * otherwise.
 *
 * Each mission is fought against all three reference bases, because what a
 * player brings to mission N varies more than what they bring to ladder level
 * N, in the defence tables' terms: permanent layer alone, flat ground. It is
 * held up against `V1_CAMPAIGN`, the campaign as v1.44 fought it on 20x30 and
 * frozen before the missions were re-authored for this board. A second pass
 * with other seeds is the noise floor, measured rather than assumed. The base
 * a campaign actually allows at a mission, by the command post level it has
 * unlocked by then, is marked: that is the cell the mission was tuned in.
 *
 * It found every drifted mission was one that fields heavies, and the fix
 * was per mission (`--missions fit`), because no one rule served all five.
 */
function missionsTable(difficulty: Difficulty = 'standard'): string {
  const lines: string[] = [];
  const out = (line: string) => lines.push(line);
  const bases = referenceBases();
  const n = SEEDS * 2;
  const pct = (k: number) => Math.round((k / n) * 100);
  type Cell = { was: number; now: number; again: number };
  type Row = { faction: FactionId; mission: MissionDef; cells: Cell[]; home: number };
  const rows: Row[] = [];
  for (const faction of FACTION_IDS) {
    const catalog = defenseCatalogFor(faction);
    // The command post level a player can have when a mission comes: a
    // mission's unlocks arrive with its victory, so they count from the next.
    let cc = 1;
    for (const mission of campaignFor(faction)) {
      const opts = { siege: missionSiege(mission, difficulty), tunnels: mission.tunnels ?? [] };
      const cells = bases.map((base, b) => {
        let now = 0;
        let again = 0;
        for (let i = 0; i < n; i++) {
          const seed = seedOf(100 + mission.index, base.ccLevel, i);
          const other = seedOf(100 + mission.index, base.ccLevel, i + n);
          if (fightDefense(defenseConfigFor(faction, base, 1, seed, opts), catalog).phase === 'victory') now++;
          if (fightDefense(defenseConfigFor(faction, base, 1, other, opts), catalog).phase === 'victory') again++;
        }
        // The baseline is standard difficulty; at hard there is none to hold.
        const was = difficulty === 'standard' ? (V1_CAMPAIGN[faction][mission.index]?.[b] ?? NaN) : NaN;
        return { was, now: pct(now), again: pct(again) };
      });
      rows.push({ faction, mission, cells, home: cc - 1 });
      if (mission.unlocks.includes('cc2')) cc = Math.max(cc, 2);
      if (mission.unlocks.includes('cc3')) cc = Math.max(cc, 3);
    }
  }

  // The noise floor: how far two seed sets on the SAME board disagree, where
  // either of them is contested. A drift is only a drift if it is bigger.
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const live = (x: number, y: number) => (x >= 5 && x <= 95) || (y >= 5 && y <= 95);
  const every = rows.flatMap((r) => r.cells);
  const floor = mean(every.filter((c) => live(c.now, c.again)).map((c) => Math.abs(c.now - c.again)));
  const moved = Math.max(20, Math.round(floor * 3));
  const baseline = difficulty === 'standard';

  out(
    `MISSIONS — every campaign on 10x15 (chain v${CHAIN_CURRENT}), ${difficulty}, ${n} seeds, ` +
      'permanent layer alone' + (baseline ? ', against v1.44 on 20x30 (chain v3, frozen)' : ''),
  );
  out(
    (baseline ? 'hold% v1.44 -> now' : 'hold% now') +
      ' per reference base · * the base the campaign allows by then' +
      (baseline ? ` · ! moved ${moved}+ points (3x the noise floor of ${floor.toFixed(1)}, never under 20)` : '') +
      '\n',
  );
  const show = (c: Cell, home: boolean) =>
    baseline
      ? `${home ? '*' : ' '}${pad(c.was, 3)} -> ${pad(c.now, 3)}${Math.abs(c.now - c.was) >= moved ? ' !' : '  '}`
      : `${home ? '*' : ' '}${pad(c.now, 3)}`;
  for (const faction of FACTION_IDS) {
    out(`${faction.toUpperCase()}`);
    out(`MISSION                    | ${bases.map((b) => b.name.padEnd(12)).join(' | ')}`);
    for (const row of rows.filter((r) => r.faction === faction)) {
      const label = `M${row.mission.index + 1} ${row.mission.codename}`.slice(0, 26).padEnd(26);
      out(`${label} | ${row.cells.map((c, b) => show(c, b === row.home).padEnd(12)).join(' | ')}`);
    }
    out('');
  }
  if (baseline) {
    const signed = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
    const home = rows.map((r) => r.cells[r.home]!);
    out(
      `THE MISSION AS TUNED (the * cells): mean shift ${signed(mean(home.map((c) => c.now - c.was)))} points over ` +
        `${home.length}, mean |shift| ${mean(home.map((c) => Math.abs(c.now - c.was))).toFixed(1)}; ` +
        `${home.filter((c) => c.now - c.was <= -moved).length} harder by ${moved}+, ` +
        `${home.filter((c) => c.now - c.was >= moved).length} easier`,
    );
    for (const faction of FACTION_IDS) {
      const mine = rows.filter((r) => r.faction === faction).map((r) => r.cells[r.home]!);
      out(
        `  ${faction.toUpperCase().padEnd(6)} mean shift ${signed(mean(mine.map((c) => c.now - c.was))).padStart(6)}` +
          `   held ${mean(mine.map((c) => c.was)).toFixed(0).padStart(3)}% of the time in v1.44, ` +
          `${mean(mine.map((c) => c.now)).toFixed(0).padStart(3)}% now`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * How much armour does the campaign have to lose to be the campaign it was?
 * (`--missions sweep`)
 *
 * `--missions` found every drifted mission is one that fields heavies, which
 * is the ladder's finding again: under chain v4 a heavy that reaches a
 * covered post kills what covers it. This prices uniform rules for thinning a
 * wave's heavies, each applied to every mission, against the home cell's hold
 * rate as it was on 20x30 — the same yardstick `--retune` used, so the ladder
 * and the campaign are re-tuned to one standard.
 */
function missionsSweep(): void {
  const started = Date.now();
  const bases = referenceBases();
  /** How many heavies a wave keeps, of the n it was written with. */
  const RULES: [string, (n: number) => number][] = [
    ['as written', (n) => n],
    ['half, rounded up', (n) => Math.ceil(n / 2)],
    ['one fewer', (n) => Math.max(0, n - 1)],
    ['one fewer, never none', (n) => (n === 0 ? 0 : Math.max(1, n - 1))],
    ['at most one', (n) => Math.min(n, 1)],
  ];
  /** The latest-arriving heavies go first, so a wave keeps its opening. */
  const thin = (siege: SiegeDef, catalog: Catalog, keep: (n: number) => number): SiegeDef => ({
    ...siege,
    waves: siege.waves.map((wave) => {
      const heavy = (kind: string) => catalog.attackers[kind]?.armor === 'heavy';
      let drop = wave.entries.filter((e) => heavy(e.kind)).length;
      drop -= keep(drop);
      const late = [...wave.entries].sort((a, b) => b.atTick - a.atTick);
      const gone = new Set<unknown>();
      for (const e of late) {
        if (drop <= 0) break;
        if (heavy(e.kind)) {
          gone.add(e);
          drop--;
        }
      }
      return { ...wave, entries: wave.entries.filter((e) => !gone.has(e)) };
    }),
  });
  const pct = (n: number) => Math.round((n / SEEDS) * 100);
  const held = (config: SimConfig, catalog: Catalog) => fightDefense(config, catalog).phase === 'victory';

  type Home = { faction: FactionId; mission: MissionDef; b: number; was: number };
  const homes: Home[] = [];
  for (const faction of FACTION_IDS) {
    let cc = 1;
    for (const mission of campaignFor(faction)) {
      const b = cc - 1;
      homes.push({ faction, mission, b, was: V1_CAMPAIGN[faction][mission.index]?.[b] ?? NaN });
      if (mission.unlocks.includes('cc2')) cc = Math.max(cc, 2);
      if (mission.unlocks.includes('cc3')) cc = Math.max(cc, 3);
    }
  }
  const armoured = homes.filter((h) =>
    h.mission.waves.some((w) => w.entries.some((e) => defenseCatalogFor(h.faction).attackers[e.kind]?.armor === 'heavy')),
  );
  console.log(`MISSIONS SWEEP — thinning each wave's heavies, ${SEEDS} seeds, the home cell of every mission that fields any`);
  console.log(`the ${armoured.length} missions: ${armoured.map((h) => `${h.faction} M${h.mission.index + 1}`).join(', ')}\n`);
  console.log(`RULE                    | MEAN SHIFT | MEAN |SHIFT| | WORST | ${armoured.map((h) => `${h.faction.slice(0, 3)}${h.mission.index + 1}`.padStart(6)).join('')}`);
  console.log(`v1.44 (20x30, v${CHAIN_LATCHED})       |            |              |       | ${armoured.map((h) => pad(h.was, 6)).join('')}`);
  for (const [label, keep] of RULES) {
    const now = armoured.map((h) => {
      const catalog = defenseCatalogFor(h.faction);
      const siege = thin(missionSiege(h.mission, 'standard'), catalog, keep);
      let n = 0;
      for (let i = 0; i < SEEDS; i++) {
        const seed = seedOf(100 + h.mission.index, bases[h.b]!.ccLevel, i);
        if (held(defenseConfigFor(h.faction, bases[h.b]!, 1, seed, { siege, tunnels: h.mission.tunnels ?? [] }), catalog)) n++;
      }
      return pct(n);
    });
    const shifts = now.map((x, i) => x - armoured[i]!.was);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const worst = shifts.reduce((w, x) => (Math.abs(x) > Math.abs(w) ? x : w), 0);
    console.log(
      `${label.padEnd(23)} | ${pad(`${mean(shifts) >= 0 ? '+' : ''}${mean(shifts).toFixed(1)}`, 10)} | ` +
        `${pad(mean(shifts.map(Math.abs)).toFixed(1), 12)} | ${pad(`${worst >= 0 ? '+' : ''}${worst}`, 5)} | ${now.map((x) => pad(x, 6)).join('')}`,
    );
  }
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
}

/**
 * Fit each drifted mission's armour to the campaign it was (`--missions fit`).
 *
 * `--missions sweep` showed no single thinning rule serves every campaign: a
 * finale's four heavies want to become two for one faction and one for
 * another, because each mission was tuned by hand against its own faction's
 * guns. So each mission is fitted the way the deal is: search how many heavies
 * each wave keeps, never more than it was written with, and take the count
 * whose home-cell hold rate lands nearest v1.44's, ties to the one that
 * removes fewer. Forty seeds a side rather than twenty, so a fit is not a fit
 * to one seed set's noise.
 */
function missionsFit(): void {
  const started = Date.now();
  const SEEDS2 = SEEDS * 2;
  const bases = referenceBases();
  const pct = (n: number) => Math.round((n / SEEDS2) * 100);
  const held = (config: SimConfig, catalog: Catalog) => fightDefense(config, catalog).phase === 'victory';
  /** The wave's heavies beyond `keep` removed, the latest arrivals first. */
  const keepHeavies = (siege: SiegeDef, catalog: Catalog, keep: number[]): SiegeDef => ({
    ...siege,
    waves: siege.waves.map((wave, w) => {
      const heavy = (kind: string) => catalog.attackers[kind]?.armor === 'heavy';
      let drop = wave.entries.filter((e) => heavy(e.kind)).length - keep[w]!;
      const gone = new Set<unknown>();
      for (const e of [...wave.entries].sort((a, b) => b.atTick - a.atTick)) {
        if (drop <= 0) break;
        if (heavy(e.kind)) {
          gone.add(e);
          drop--;
        }
      }
      return { ...wave, entries: wave.entries.filter((e) => !gone.has(e)) };
    }),
  });
  /** Every per-wave count at or below what was written. */
  const combos = (written: number[]): number[][] =>
    written.reduce<number[][]>(
      (acc, n) => acc.flatMap((c) => Array.from({ length: n + 1 }, (_, k) => [...c, k])),
      [[]],
    );
  console.log(`MISSIONS FIT — per-wave heavies, the home cell, ${SEEDS2} seeds a side\n`);
  console.log('MISSION             | WRITTEN    | v1.44 | AS WRITTEN | FITTED     | NOW');
  for (const faction of FACTION_IDS) {
    const catalog = defenseCatalogFor(faction);
    let cc = 1;
    for (const mission of campaignFor(faction)) {
      const b = cc - 1;
      if (mission.unlocks.includes('cc2')) cc = Math.max(cc, 2);
      if (mission.unlocks.includes('cc3')) cc = Math.max(cc, 3);
      const written = mission.waves.map((w) => w.entries.filter((e) => catalog.attackers[e.kind]?.armor === 'heavy').length);
      if (written.every((n) => n === 0)) continue;
      const siege = missionSiege(mission, 'standard');
      const tunnels = mission.tunnels ?? [];
      const rate = (base: ReferenceBase, s: SiegeDef) => {
        let n = 0;
        for (let i = 0; i < SEEDS2; i++) {
          const seed = seedOf(100 + mission.index, base.ccLevel, i);
          if (held(defenseConfigFor(faction, base, 1, seed, { siege: s, tunnels }), catalog)) n++;
        }
        return pct(n);
      };
      const was = V1_CAMPAIGN[faction][mission.index]?.[b] ?? NaN;
      const asWritten = rate(bases[b]!, siege);
      let best = { keep: written, now: asWritten };
      if (Math.abs(asWritten - was) > 10) {
        for (const keep of combos(written)) {
          const now = rate(bases[b]!, keepHeavies(siege, catalog, keep));
          const removed = (k: number[]) => written.reduce((a, n, w) => a + n - k[w]!, 0);
          const better =
            Math.abs(now - was) < Math.abs(best.now - was) ||
            (Math.abs(now - was) === Math.abs(best.now - was) && removed(keep) < removed(best.keep));
          if (better) best = { keep, now };
        }
      }
      console.log(
        `${`${faction} M${mission.index + 1} ${mission.codename}`.slice(0, 19).padEnd(19)} | ${written.join(' ').padEnd(10)} | ` +
          `${pad(was, 5)} | ${pad(asWritten, 10)} | ${best.keep.join(' ').padEnd(10)} | ${pad(best.now, 3)}`,
      );
    }
  }
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
}

// ---- report ---------------------------------------------------------------------

const pad = (value: string | number, width: number): string => String(value).padStart(width);

function raidTable(faction: FactionId, rows: RaidRow[], suffix = ''): string {
  const flavor = flavorFor(faction);
  const lines = [
    `RAID — ${flavor.faction} strike force (${planManpower(faction)} MP) vs ${flavor.enemy} Front Line${suffix}`,
    'TIER | CLEAR% | DESTR% | MP LOST%',
    '-----+--------+--------+---------',
  ];
  for (const r of rows) {
    lines.push(
      `${pad(r.tier, 4)} | ${pad(r.clearPct, 6)} | ${pad(r.destructionPct, 6)} | ${pad(r.lossPct, 8)}`,
    );
  }
  return lines.join('\n');
}

function defenseTable(faction: FactionId, rows: DefenseRow[], suffix = ''): string {
  const flavor = flavorFor(faction);
  const lines = [
    `DEFENSE — ${flavor.faction} permanent layer vs ${flavor.enemy} assault ladder (hold%)${suffix}`,
    `STAGE       | ${ASSAULT_LEVELS.map((l) => pad(`L${l}`, 4)).join(' | ')}`,
    `------------+${ASSAULT_LEVELS.map(() => '------').join('+')}`,
  ];
  for (const r of rows) {
    lines.push(`${r.stage.padEnd(11)} | ${r.holdPct.map((h) => pad(h, 4)).join(' | ')}`);
  }
  return lines.join('\n');
}

/** The v0.4 ceiling: full Strike doctrine plus a stocked two-charge fire plan. */
const DOCTRINE_SUPPORT: RaidSupport = {
  mods: { hp: 1.12, damage: 1.12 },
  powerCharges: { a10: 1, arty: 2 },
  autoPowers: [
    { kind: 'a10', atSeconds: 15, target: 'guns' },
    { kind: 'arty', atSeconds: 40, target: 'cc' },
  ],
};

const FORTIFY_MODS: DefenderMods = { wallHp: 1.15, weaponDamage: 1.12 };

/** Every tech of a branch up to `tier`, by id. */
const branchTo = (branch: TechBranch, tier: number): string[] =>
  TECHS.filter((t) => t.branch === branch && t.tier <= tier).map((t) => t.id);

/**
 * M24 Phase 4: the research graph's top tiers in battle, beside the doctrine
 * they extend. The multipliers come from `effectsOf`, so this table reads the
 * techs as shipped. A tier's worth of multiplier ought to move a band by about
 * half a level, the way the first tiers do.
 *
 * The reading is an area, not a crossing: the levels a defence holds summed
 * over the ladder (a level held half the time counts a half), and the tiers a
 * raid clears summed the same way. The late base's hold curve is not monotone
 * past L10, where a heavy wave lands every fourth level and rotors every
 * second, and the first level it drops below 50% said more about the noise
 * than the doctrine. The defence runs past the published twelve levels
 * because the late base holds past all of them, and the graph is a late tool.
 *
 * STRIKE 5's other half, one more charge of each ordnance in stock, is not in
 * it. A third call inside one raid was measured and moved nothing: a raid that
 * clears is over in about a minute, before either power is off cooldown. The
 * charge is one more raid's fire plan between restocks, which is economy.
 */
function graphTable(faction: FactionId): string {
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  const fortify = (tier: number): DefenderMods => {
    const e = effectsOf(branchTo('fortify', tier));
    return { wallHp: e.wallHp, weaponDamage: e.weaponDamage };
  };
  const strike = (tier: number): RaidSupport => {
    const e = effectsOf(branchTo('strike', tier));
    return { ...DOCTRINE_SUPPORT, mods: { hp: e.unitHp, damage: e.unitDamage } };
  };
  const area = (pcts: readonly number[]): number => pcts.reduce((n, p) => n + p / 100, 0);
  const flavor = flavorFor(faction);
  const lines = [`THE GRAPH IN BATTLE — ${flavor.faction}`];
  const defence = [
    defenseMatrix(faction, undefined, [], undefined, levels),
    defenseMatrix(faction, fortify(3), [], undefined, levels),
    defenseMatrix(faction, fortify(5), [], undefined, levels),
  ];
  lines.push('DEFENCE, levels held of L1-L20: STAGE | NONE | FORTIFY 1-3 | FORTIFY 1-5');
  const held = defence.map((rows) => rows.map((r) => area(r.holdPct)));
  defence[0]!.forEach((row, i) => {
    lines.push(
      `  ${row.stage.padEnd(11)} | ${pad(held[0]![i]!.toFixed(2), 5)} | ${pad(held[1]![i]!.toFixed(2), 11)} | ` +
        `${pad(held[2]![i]!.toFixed(2), 11)}`,
    );
  });
  const meanShift = (a: number[], b: number[]): string =>
    (b.reduce((n, x, i) => n + x - a[i]!, 0) / a.length).toFixed(2);
  lines.push(
    `  mean: tiers 1-3 +${meanShift(held[0]!, held[1]!)} levels, tiers 4-5 on top of them ` +
      `+${meanShift(held[1]!, held[2]!)}`,
  );
  const raids = [raidMatrix(faction), raidMatrix(faction, strike(3)), raidMatrix(faction, strike(5))];
  lines.push(`RAID, clear% by tier: ROW | ${RAID_TIERS.map((t) => `T${t}`).join(' | ')} | TIERS CLEARED`);
  const cleared = raids.map((rows) => area(rows.map((r) => r.clearPct)));
  ['NONE', 'STRIKE 1-3 + fire plan', 'STRIKE 1-5 + fire plan'].forEach((label, i) => {
    lines.push(
      `  ${label.padEnd(22)} | ${raids[i]!.map((r) => pad(r.clearPct, 3)).join(' | ')} | ${cleared[i]!.toFixed(2)}`,
    );
  });
  lines.push(
    `  tiers 1-3 and the fire plan +${(cleared[1]! - cleared[0]!).toFixed(2)} tiers, ` +
      `tiers 4-5 on top of them +${(cleared[2]! - cleared[1]!).toFixed(2)}`,
  );
  return lines.join('\n');
}

/**
 * The field-condition rotation (M7). A condition is meant to be a trade, so
 * the only number that matters here is the swing against CLEAR LINE: an easy
 * day has to be measurably easier and a hard day measurably harder, or the
 * rotation is flavour text with a loot multiplier stapled on.
 *
 * One faction is enough — conditions are flat multipliers on both sides, so
 * the ordering they produce is the same everywhere; running all five would
 * quadruple the harness for a table that says the same thing five times.
 */
/**
 * The eight ladder shapes measured against the SAME force at the SAME tiers.
 *
 * The point of an archetype is that it asks a different question, not that it
 * asks the same one louder — so what this table has to show is spread. A row
 * that lands on the compound baseline is a shape that is not doing anything,
 * and a row at 0 or 100 across the board is a wall or a walkover rather than a
 * choice. Loot moves with it: the soft shapes carry more economy, so an easy
 * clear pays for itself and a hard one has to be worth the army.
 */
function archetypeTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `ARCHETYPES — ${flavor.faction} strike force (${planManpower(faction)} MP), clear% by tier`,
    `SHAPE        | FROM | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | DESTR% | MP LOST%`,
    `-------------+------+${RAID_TIERS.map(() => '------').join('+')}+-------+--------+---------`,
  ];
  const withDoctrine = new Set<ArchetypeId>(['bunker', 'star', 'depot']);
  for (const arch of ARCHETYPES) {
    const rows = raidMatrix(faction, undefined, false, undefined, arch.id);
    const clears = rows.map((r) => r.clearPct);
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    const destr = rows.reduce((a, r) => a + r.destructionPct, 0) / rows.length;
    const loss = rows.reduce((a, r) => a + r.lossPct, 0) / rows.length;
    lines.push(
      `${arch.name.padEnd(12)} | ${pad(arch.fromTier, 4)} | ${clears.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(destr.toFixed(0), 6)} | ${pad(loss.toFixed(0), 8)}`,
    );
    // The shapes that stop the reference force get a second row with the
    // doctrine ceiling behind them: a shape you have to prepare for is a
    // shape; a shape nothing opens is a wall.
    if (withDoctrine.has(arch.id)) {
      const armed = raidMatrix(faction, DOCTRINE_SUPPORT, false, undefined, arch.id);
      const ac = armed.map((r) => r.clearPct);
      const am = ac.reduce((a, b) => a + b, 0) / ac.length;
      lines.push(
        `  └ prepared | ${pad('', 4)} | ${ac.map((c) => pad(c, 4)).join(' | ')} | ` +
          `${pad(am.toFixed(1), 5)} | ${pad((armed.reduce((a, r) => a + r.destructionPct, 0) / armed.length).toFixed(0), 6)} | ` +
          `${pad((armed.reduce((a, r) => a + r.lossPct, 0) / armed.length).toFixed(0), 8)}`,
      );
    }
  }
  return lines.join('\n');
}

function conditionTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const baseline = raidMatrix(faction).map((r) => r.clearPct);
  const lines = [
    `FIELD CONDITIONS — ${flavor.faction} strike force (${planManpower(faction)} MP), clear% by tier`,
    `CONDITION    | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | vs CLEAR`,
    `-------------+${RAID_TIERS.map(() => '------').join('+')}+-------+---------`,
  ];
  const meanOf = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const flat = meanOf(baseline);
  for (const condition of CONDITIONS) {
    const rows =
      condition.id === 'clearline'
        ? baseline
        : raidMatrix(faction, { condition }).map((r) => r.clearPct);
    const mean = meanOf(rows);
    const delta = mean - flat;
    lines.push(
      `${condition.label.padEnd(12)} | ${rows.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`, 8)}`,
    );
  }
  return lines.join('\n');
}

/**
 * Veterancy (v1.9). The rank multiplier is small on purpose, so the question
 * this table has to answer is not "does it win more" — a reference plan that
 * already clears everything cannot show a 4% edge. It is "does it bring more
 * men home", because that is what veterancy is FOR: the rank pays in
 * survivors, and survivors are what carry the rank forward.
 *
 * The thin plan is deliberate. At the margin a rank is worth a coin flip; with
 * the reference force behind it every row reads 100 and the table says nothing.
 */
/**
 * Ordered launch delays (v1.15). The same force, the same tiers, the same
 * seeds — only the clock differs. The question a picker has to answer before it
 * earns its row: is WHEN a real choice, or is one schedule simply correct?
 */
/**
 * What a gate costs the rest of the time (v1.17).
 *
 * A gate's VALUE is a live decision — you open it to route the assault into a
 * killzone — and a headless harness cannot play that. What it can price is the
 * standing cost, which is the honest half of the trade: a gate is a door, it
 * carries about half a wall's HP, and it sits in the ring whether or not
 * anybody is at the controls. This measures a raid against rings with 0/2/4/8
 * of their segments swapped for gates, closed and unattended — the base as an
 * offline probe finds it.
 */
function gateTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const COUNTS = [0, 4, 12, 24, 48];
  const lines = [
    `GATES — soft spots in a ${flavor.enemy} ring, unattended, vs the ${flavor.faction} reference force`,
    `GATES | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];
  for (const gates of COUNTS) {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        // Deterministic, evenly spread through the ring: the same segments
        // every run, so the only thing that moves between rows is the count.
        if (gates > 0) {
          const step = Math.max(1, Math.floor(base.walls.length / gates));
          for (let g = 0; g < gates; g++) {
            const wall = base.walls[g * step];
            if (wall) wall.kind = 'gate';
          }
        }
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({ ...squad, slot: at }));
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          const flow = manpowerFlow(faction, res);
          home += flow.home;
          sent += flow.sent;
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(Math.round((cleared / runs) * 100));
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(gates, 5)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(Math.round((1 - home / sent) * 100), 8)}`,
    );
  }
  return lines.join('\n');
}

/**
 * Is the ground a trade, or a buff wearing a costume? (v1.19)
 *
 * Terrain arrived with a promise attached: it should change WHICH bases are
 * hard rather than making all of them harder or all of them easier. The bar
 * is the same one field conditions have to clear — and the reading is the
 * SPREAD, not the mean. Ground that lifts the clear rate everywhere is a
 * defender nerf; ground that drops it everywhere is a difficulty spike; ground
 * that does different things to different sheets is terrain.
 *
 * Every row is the same reference force against the same archetypes. FLAT is
 * the pre-v1.19 control — the exact battles docs/BALANCE.md was measured on —
 * and the GROUND rows are the same targets with their real terrain under them,
 * split so a sheet's own character shows rather than averaging away.
 */
function terrainTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `TERRAIN — the ${flavor.faction} reference force vs ${flavor.enemy} posts, flat ground vs real`,
    `GROUND      | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];

  /** One row: every (tier, variant, seed), with terrain on or off. */
  const row = (label: string, ground: boolean, pick?: (variant: number) => boolean): void => {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        if (pick && !pick(variant)) continue;
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        if (!ground) base.terrainSeed = 0; // the flat control
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({ ...squad, slot: at }));
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          const flow = manpowerFlow(faction, res);
          home += flow.home;
          sent += flow.sent;
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(label, 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)}`,
    );
  };

  row('FLAT', false);
  row('GROUND', true);
  // Each variant is a different sheet. If terrain is doing its job these
  // three rows disagree with each other more than they disagree with FLAT.
  for (let v = 0; v < VARIANTS; v++) row(`SHEET ${v + 1}`, true, (variant) => variant === v);
  return lines.join('\n');
}

/**
 * v1.20: is the wall line worth building, and WHICH change earned it?
 *
 * The question is not "how hard is a raid" but "does fortifying do anything",
 * and the honest way to ask it is to take the walls away and see whether the
 * base gets easier. Before v1.20 it got HARDER without them.
 *
 * The table is a 2x2 because an earlier read of it was wrong. Moving the
 * garrison and the gun trade together looked like the garrison had flipped
 * the wall line; holding one still at a time shows the trade did it alone,
 * and the watch is very slightly negative on this axis. What the watch earns
 * is the CLOCK, which this table cannot see — for that, stagger the launch
 * and read `--delay`, or the tempo table in tests/garrison.test.ts.
 */
function garrisonTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `GARRISON — the ${flavor.faction} reference force vs ${flavor.enemy} posts`,
    `CONFIG      | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];

  const row = (label: string, watch: boolean, guns: number, walls: boolean): number => {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({ ...squad, slot: at }));
          const built = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          // One thing at a time: the watch and the guns move independently, so
          // the table can say which of them is doing the work.
          const config: SimConfig = {
            ...built,
            ...(watch
              ? {}
              : { garrison: undefined, siege: { ...built.siege!, cpPerSecond: 0, cpCap: 1 } }),
            mods: {
              ...built.mods,
              defender: { ...built.mods?.defender, weaponDamage: guns },
            },
            ...(walls ? {} : { layout: { ...built.layout!, walls: [] } }),
          };
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          const flow = manpowerFlow(faction, res);
          home += flow.home;
          sent += flow.sent;
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(label, 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)}`,
    );
    return mean;
  };

  const cases: [string, boolean, number][] = [
    ['v1.19', false, 1],
    ['GUNS 0.8', false, GARRISON_GUN_TRADE],
    ['WATCH', true, 1],
    ['SHIPPED', true, GARRISON_GUN_TRADE],
  ];
  const worth: string[] = [];
  for (const [label, watch, guns] of cases) {
    const walls = row(`${label} W`, watch, guns, true);
    const bare = row(`${label} —`, watch, guns, false);
    worth.push(`${label} ${(bare - walls >= 0 ? '+' : '')}${(bare - walls).toFixed(1)}`);
  }
  lines.push('');
  // Positive = the wall line defends the base. Negative = it is doing the
  // attacker a favour, which is what it did until v1.20.
  lines.push(`WALL LINE IS WORTH — ${worth.join('  |  ')}  (clear-rate points to the defender)`);
  return lines.join('\n');
}

/**
 * Air against ground (v1.21), and whether the garrison can answer it.
 *
 * Measured after v1.20, air was the dominant doctrine almost everywhere: it
 * cleared as often or better than a ground push for four factions of five and
 * cost far fewer men in all five. The garrison could not answer it at all —
 * `manpads` sat in the reserve with no doctrine calling for it, because a
 * standing-order rule had no way to ask what it would be shooting at.
 *
 * The row to read is the EDGE: air's clear rate minus ground's. It should not
 * be a large positive number, and it should not swing to a large negative one
 * either — air is meant to buy speed and survival (less manpower lost) rather
 * than better odds against a post that expects it.
 *
 * **The two air rows are not "AA" versus "no AA".** Every generated ladder base
 * BUILDS `aaSite` mounts — `aaCount` of them, sited mid-line so a standoff run
 * has to enter their envelope — and no row here removes those. What the control
 * removes is the GARRISON'S reactive air-defence order, the rule that stands up
 * `manpads` when it sees something flying, which is what every garrison looked
 * like before v1.11. The rows say MOUNTS and +MANPADS now; they said `no AA`
 * and `+AA` for four releases and that read as a claim the table never made.
 */
function airTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  // The air plans are described as "roughly the same manpower, flown", and
  // `roughly` was never checked. It is not true: four of the five fly a force
  // 3-4 MP larger than the ground reference they were being compared against,
  // and the one that is matched — Russia — is the one that measured worst. An
  // edge column that compares two forces of different sizes is reporting
  // budget as well as doctrine.
  //
  // Rather than re-cut five hand-written plans (unit costs quantise, so an
  // exact match is not always reachable while keeping the shape), the control
  // moves: GROUND =N is the ground reference dealt to the air plan's budget by
  // `planAtBudget`, the same routine `--rungs` sizes forces with. The edge is
  // read against THAT. The unmatched GROUND row stays for continuity with
  // `--parity`, which is measured on the reference at its own size.
  //
  // When the two budgets already agree, `planAtBudget` at the reference's own
  // manpower re-deals exactly the reference, so the two GROUND rows must be
  // identical — Russia is a free check on the sizer every time this runs.
  const groundMp = planManpower(faction, RAID_PLANS[faction]);
  const airMp = planManpower(faction, AIR_RAID_PLANS[faction]);
  const lines = [
    `AIR — the ${flavor.faction} reference force vs ${flavor.enemy} posts, with and without AA`,
    `      GROUND reference ${groundMp} MP, AIR plan ${airMp} MP` +
      `${groundMp === airMp
        ? ' — already matched, so GROUND =N must repeat GROUND exactly'
        : `, so the edge is read against GROUND =${airMp}`}`,
    `FORCE       | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];

  const row = (label: string, plans: SquadPlan[], aa: boolean): number => {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        for (let i = 0; i < SEEDS; i++) {
          const squads = plans.map((squad, at) => ({ ...squad, slot: at }));
          const built = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          // The control strips the garrison's AIR-DEFENCE ORDER back out,
          // which is what every garrison looked like in v1.20. The base's
          // built `aaSite` mounts stay in BOTH rows — this is not a
          // no-air-defence control and never was.
          const g = built.garrison!;
          const config: SimConfig = aa
            ? built
            : { ...built, garrison: { ...g, rules: g.rules.filter((r) => r.hostiles !== 'air') } };
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          const flow = manpowerFlow(faction, res);
          home += flow.home;
          sent += flow.sent;
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(label, 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)}`,
    );
    return mean;
  };

  row('GROUND', RAID_PLANS[faction], true);
  const matched = row(`GROUND =${airMp}`, planAtBudget(faction, airMp), true);
  const airBare = row('AIR mounts', AIR_RAID_PLANS[faction], false);
  const airAA = row('AIR +manpads', AIR_RAID_PLANS[faction], true);
  lines.push('');
  lines.push(
    `AIR'S EDGE OVER MATCHED GROUND — vs mounts ${(airBare - matched >= 0 ? '+' : '')}` +
      `${(airBare - matched).toFixed(1)}  |  vs mounts+manpads ${(airAA - matched >= 0 ? '+' : '')}` +
      `${(airAA - matched).toFixed(1)}  (clear-rate points, both forces at ${airMp} MP)`,
  );
  return lines.join('\n');
}

/**
 * What air CHARGES (v1.33) — the air roster priced in the only honest unit.
 *
 * `--air` reads a fixed force against the ladder, so it saturates: four of five
 * factions clear T1-T2 at 100 whatever they send, and no comparison between
 * them can show through a ceiling. The same defect broke the ladder tables
 * until `--rungs` replaced "what does one army do to every rung" with "how much
 * force does each rung DEMAND". This asks that question of the wing.
 *
 * For each faction and rung: the smallest manpower that clears half the time,
 * once dealt in the GROUND reference's shape and once in the AIR plan's shape.
 * The ratio is what flying costs. A ratio near 1 means the air layer is a real
 * alternative; a large one means it is a flourish you pay for.
 *
 * Two things this had to get right to mean anything:
 *
 * - A budget too small to buy one airframe deals a plan of pure ground tail,
 *   which would report the tail's price as air's. Russia is where that bites —
 *   the Ka-52 costs 7 and the cheapest rung is 6 — so any dealt plan with
 *   nothing flown in it is skipped rather than measured.
 * - The ladder runs far past `RUNG_BUDGETS`. Air does not merely cost more, it
 *   costs multiples, and a grid that stopped at 48 would report the top rungs
 *   as unreachable for four factions and hide the size of the gap.
 */
const WING_BUDGETS = [6, 9, 12, 16, 20, 24, 28, 33, 39, 46, 54, 64, 76, 90] as const;
/**
 * Twenty seeds and three variants: 60 battles a probe.
 *
 * Eight was tried first and the table came out with air demand reading
 * 12/12/28/12/38 across one faction's five rungs. A 50% threshold read off 24
 * battles is a coin flip at the boundary, and `budgetToClear` STOPS at the
 * first crossing, so a fluke low is never corrected by the probes above it.
 * More seeds plus the confirm rule (below) is what makes the number a demand
 * rather than a draw.
 */
const WING_SEEDS = 20;

function wingTable(): string {
  const lines = [
    'WHAT AIR CHARGES — smallest manpower that clears half the time, by plan shape',
    `FACTION     | SHAPE  | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN`,
    `------------+--------+${RAID_TIERS.map(() => '-------').join('+')}+-------`,
  ];
  for (const faction of FACTION_IDS) {
    const flavor = flavorFor(faction);
    const airKinds = new Set(
      trainableFor(faction)
        .filter((t) => t.facility === 'airfield')
        .map((t) => t.kind),
    );
    /** Budgets whose dealt plan actually flies. */
    const flies = (shape: SquadPlan[], budget: number): boolean =>
      shape !== AIR_RAID_PLANS[faction] ||
      planAtBudget(faction, budget, shape).some((sq) =>
        Object.keys(sq.units).some((k) => airKinds.has(k)),
      );
    const rowFor = (shape: SquadPlan[]): (number | null)[] =>
      RAID_TIERS.map((tier) =>
        budgetToClear(
          faction,
          tier,
          shape,
          WING_BUDGETS.filter((b) => flies(shape, b)),
          WING_SEEDS,
          true,
        ),
      );
    const ground = rowFor(RAID_PLANS[faction]);
    const wing = rowFor(AIR_RAID_PLANS[faction]);
    const cell = (v: number | null): string => pad(v ?? '—', 5);
    const meanOf = (row: (number | null)[]): number | null => {
      const got = row.filter((v): v is number => v !== null);
      return got.length === RAID_TIERS.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
    };
    const gm = meanOf(ground);
    const wm = meanOf(wing);
    lines.push(
      `${pad(flavor.faction.slice(0, 11), 11)} | GROUND | ${ground.map(cell).join(' | ')} | ` +
        `${pad(gm === null ? '—' : gm.toFixed(1), 5)}`,
    );
    lines.push(
      `            | AIR    | ${wing.map(cell).join(' | ')} | ` +
        `${pad(wm === null ? '—' : wm.toFixed(1), 5)}`,
    );
    lines.push(
      `            | x      | ${RAID_TIERS.map((_, i) => {
        const g = ground[i];
        const w = wing[i];
        return pad(g && w ? `${(w / g).toFixed(1)}x` : '—', 5);
      }).join(' | ')} | ` + `${pad(gm && wm ? `${(wm / gm).toFixed(1)}x` : '—', 5)}`,
    );
  }
  lines.push('');
  lines.push(
    '  A rung a shape never clears at any budget on the grid reads —, and its mean',
    '  is withheld rather than averaged over the rungs it did reach: a force that',
    '  cannot take the top rung has not earned a better mean for stopping early.',
    '',
    '  The AIR row is not monotone and that is not the instrument. See below.',
  );
  lines.push('', shapeAirTable());
  return lines.join('\n');
}

/**
 * The OVERHEAD term, kept here as the control that did NOT ship.
 *
 * `src/meta/airread.ts` ships TRANSIT alone. Overhead — flak covering the
 * command post, where an aircraft has to hover while it works — sounds like it
 * should dominate and does not: on a generated base it is very nearly binary,
 * either a mount covers the post or one does not, and a term that cannot vary
 * cannot predict. It is still scored below so the table keeps saying why.
 */
function overheadFlak(base: GeneratedBase, cat: Catalog): number {
  // In PHYSICAL units, as `airTransit` measures (M34): the catalog's ranges
  // are written in them, so the board's cells are scaled up to meet them.
  const u = MAP_CELL_SIZE;
  const ccHalf = scaleFootprint(2, u) / 2;
  const ccX = ((base.ccOrigin % MAP_W) + ccHalf) * u;
  const ccY = (Math.floor(base.ccOrigin / MAP_W) + ccHalf) * u;
  let total = 0;
  for (const st of base.structures) {
    const profile = cat.structures[st.kind];
    if (!profile) continue;
    const level = st.level ?? 1;
    const merged =
      level > 1 && profile.levels && profile.levels.length > 0
        ? { ...profile, ...profile.levels[Math.min(level - 2, profile.levels.length - 1)] }
        : profile;
    const w = merged.weapon;
    if (!w || (w.targets !== 'air' && w.targets !== 'both')) continue;
    const half = scaleFootprint(profile.footprint === 2 ? 2 : 1, u) / 2;
    const sx = ((st.cell % MAP_W) + half) * u;
    const sy = (Math.floor(st.cell / MAP_W) + half) * u;
    if ((ccX - sx) ** 2 + (ccY - sy) ** 2 <= w.range * w.range) total += w.damage * w.shotsPerSecond;
  }
  return total;
}

/**
 * Does the read predict? (v1.34)
 *
 * Nothing about `airRead` is allowed to ship on the strength of the story it
 * tells. This measures the clear rate of the air plan on every dealt target and
 * correlates it against each term, so the decision is a number. The bar: the
 * read has to beat what a player already has, which is the SHAPE — so the
 * shape's own mean air clear rate is scored as a third predictor and has to
 * lose.
 */
function airReadTable(): string {
  const BUDGET = 24;
  const SEEDS = 20;
  const lines = [
    `DOES THE AIR READ PREDICT? — every dealt target, air plan at ${BUDGET} MP`,
    'FACTION     | RUNG | SHAPE        | OVERHEAD | TRANSIT | AIR CLEAR%',
    '------------+------+--------------+----------+---------+-----------',
  ];
  const rows: { faction: FactionId; shape: string; overhead: number; transit: number; clear: number }[] = [];
  for (const faction of FACTION_IDS) {
    const flavor = flavorFor(faction);
    const cat = raidCatalogFor(faction);
    const air = planAtBudget(faction, BUDGET, AIR_RAID_PLANS[faction]);
    const sectors = [...new Set(air.map((sq) => sq.sector))];
    // The slowest airframe in the plan sets the transit clock: the force is
    // only through an envelope when its last aircraft is.
    const speed = slowestAirSpeed(cat, air.flatMap((sq) => Object.keys(sq.units)));
    for (const tier of RAID_TIERS) {
      for (let slot = 0; slot < 3; slot++) {
        const base = generateBase(tier, slot, baseKitFor(faction), undefined, faction);
        const read = {
          overhead: overheadFlak(base, cat),
          transit: airTransit(base, cat, sectors, speed),
        };
        const squads =
          faction === 'nk'
            ? tunnelPlanFor(faction, base, tier, air).map((sq, at) => ({ ...sq, slot: at }))
            : air;
        let cleared = 0;
        for (let i = 0; i < SEEDS; i++) {
          const cfg = raidConfig(base, squads, seedOf(tier, slot, i), trainableFor(faction));
          if (resolveRaid(cfg, squads, tier, cat).cleared) cleared++;
        }
        const clear = (cleared / SEEDS) * 100;
        rows.push({ faction, shape: dealtShape(tier, slot, faction), overhead: read.overhead, transit: read.transit, clear });
        lines.push(
          `${pad(slot === 0 && tier === RAID_TIERS[0] ? flavor.faction.slice(0, 11) : '', 11)} | ` +
            `${pad(slot === 0 ? `T${tier}` : '', 4)} | ${dealtShape(tier, slot, faction).padEnd(12)} | ` +
            `${pad(read.overhead.toFixed(0), 8)} | ${pad(read.transit.toFixed(0), 7)} | ${pad(clear.toFixed(0), 10)}`,
        );
      }
    }
    lines.push('');
  }
  const corr = (xs: number[], ys: number[]): number => {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i]! - mx) * (ys[i]! - my);
      dx += (xs[i]! - mx) ** 2;
      dy += (ys[i]! - my) ** 2;
    }
    return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
  };
  const clears = rows.map((r) => r.clear);
  // The incumbent: what a player already knows for free is the SHAPE, so the
  // read has to beat predicting from the shape's own average. Scored on the
  // same rows it was fitted to, which flatters it — deliberately, because a
  // predictor that cannot beat a flattered baseline is not worth shipping.
  const byShape = new Map<string, number[]>();
  for (const r of rows) byShape.set(r.shape, [...(byShape.get(r.shape) ?? []), r.clear]);
  const shapeMean = rows.map((r) => {
    const got = byShape.get(r.shape)!;
    return got.reduce((a, b) => a + b, 0) / got.length;
  });
  lines.push(
    'PREDICTOR                                   |     r |    r^2',
    '--------------------------------------------+-------+-------',
  );
  const score = (name: string, xs: number[]): void => {
    const r = corr(xs, clears);
    lines.push(`${name.padEnd(43)} | ${pad(`${r >= 0 ? '+' : ''}${r.toFixed(2)}`, 5)} | ${pad((r * r).toFixed(2), 6)}`);
  };
  score('OVERHEAD flak DPS over the post', rows.map((r) => r.overhead));
  score('TRANSIT DPS-seconds on the way in', rows.map((r) => r.transit));
  score('OVERHEAD + TRANSIT', rows.map((r) => r.overhead + r.transit));
  score('SHAPE alone (the incumbent, flattered)', shapeMean);
  lines.push(
    '',
    '  The bar is the last row. A player is told the shape for free, so a read that',
    '  cannot beat predicting from the shape alone has bought nothing — and the shape',
    '  baseline is scored on the very rows it was fitted to, which flatters it.',
    '',
    'PER FACTION — a predictor carried by one roster is not a predictor',
    'FACTION     | TRANSIT r | SHAPE r',
    '------------+-----------+--------',
  );
  for (const faction of FACTION_IDS) {
    const mine = rows.filter((r) => r.faction === faction);
    const idx = rows.map((r, i) => (r.faction === faction ? i : -1)).filter((i) => i >= 0);
    const rt = corr(mine.map((r) => r.transit), mine.map((r) => r.clear));
    const rs = corr(idx.map((i) => shapeMean[i]!), mine.map((r) => r.clear));
    lines.push(
      `${pad(flavorFor(faction).faction.slice(0, 11), 11)} | ` +
        `${pad(`${rt >= 0 ? '+' : ''}${rt.toFixed(2)}`, 9)} | ${pad(`${rs >= 0 ? '+' : ''}${rs.toFixed(2)}`, 7)}`,
    );
  }
  // The player cannot read DPS-seconds. Bands are what ships, and the cuts are
  // derived here rather than chosen: sort every dealt target by transit and cut
  // into thirds, then report what each third actually clears at.
  const sorted = [...rows].sort((a, b) => a.transit - b.transit);
  const third = Math.floor(sorted.length / 3);
  const cuts = [sorted[third]!.transit, sorted[third * 2]!.transit];
  lines.push(
    '',
    'BANDS — cut at the terciles of transit, then measured',
    'BAND  | TRANSIT       | TARGETS | MEAN AIR CLEAR%',
    '------+---------------+---------+----------------',
  );
  const bands: [string, (t: number) => boolean, string][] = [
    ['GOOD', (t) => t < cuts[0]!, `under ${cuts[0]!.toFixed(0)}`],
    ['FAIR', (t) => t >= cuts[0]! && t < cuts[1]!, `${cuts[0]!.toFixed(0)} to ${cuts[1]!.toFixed(0)}`],
    ['POOR', (t) => t >= cuts[1]!, `over ${cuts[1]!.toFixed(0)}`],
  ];
  for (const [name, test, label] of bands) {
    const got = rows.filter((r) => test(r.transit));
    const mean = got.length > 0 ? got.reduce((a, b) => a + b.clear, 0) / got.length : 0;
    lines.push(
      `${name.padEnd(5)} | ${label.padEnd(13)} | ${pad(got.length, 7)} | ${pad(mean.toFixed(1), 15)}`,
    );
  }
  lines.push(
    '',
    '  The bands are the shippable form: a player cannot read DPS-seconds, and three',
    '  words is the whole budget the target list has. The cuts are terciles of the',
    '  measured population rather than round numbers, so they cannot be tuned to',
    '  flatter the result.',
  );
  return lines.join('\n');
}

/**
 * WHY the air row is not monotone: air fights a different ladder (v1.33).
 *
 * The deal is selected against GROUND difficulty — that is what `--layouts`
 * does and it is the right thing for it to do, since almost every raid is a
 * ground raid. This asks what the SAME dealt targets are worth to a force that
 * flies, at one fixed budget so the two are directly comparable.
 *
 * The answer is that the two orderings are not merely different. For the USA at
 * 24 MP the two shapes air cannot take at all — `camp` at 0% and `depot` at 5%
 * — are the two the ground force finds EASIEST, at 60% and 100%; and the two
 * air walks (`star` and `keep`, both 100%) are among the hardest on foot. Walls
 * and overlapping arcs are what make a rung hard on the ground and neither
 * exists for an aircraft, so what is left is the flight in: the shapes with the
 * fewest walls are the ones that spread their mounts and their command post
 * over the most ground, and that is the thing air pays for.
 *
 * So an air player does not climb a harder ladder. They climb a SCRAMBLED one.
 */
function shapeAirTable(): string {
  const BUDGET = 24;
  const SHAPE_SEEDS = 20;
  const lines = [
    `THE SAME TARGETS, FLOWN — clear% at a fixed ${BUDGET} MP, ground shape vs air shape`,
    'FACTION     | RUNG | SHAPE        | GROUND | AIR | AIR MINUS GROUND',
    '------------+------+--------------+--------+-----+-----------------',
  ];
  const bar = (d: number): string =>
    d >= 0 ? '+'.padEnd(1) + '#'.repeat(Math.round(d / 10)) : '-' + '#'.repeat(Math.round(-d / 10));
  for (const faction of FACTION_IDS) {
    const flavor = flavorFor(faction);
    const ground = planAtBudget(faction, BUDGET, RAID_PLANS[faction]);
    const air = planAtBudget(faction, BUDGET, AIR_RAID_PLANS[faction]);
    const gs: number[] = [];
    const as: number[] = [];
    for (const tier of RAID_TIERS) {
      for (let slot = 0; slot < 3; slot++) {
        const base = generateBase(tier, slot, baseKitFor(faction), undefined, faction);
        const run = (plans: SquadPlan[]): number => {
          const squads =
            faction === 'nk'
              ? tunnelPlanFor(faction, base, tier, plans).map((sq, at) => ({ ...sq, slot: at }))
              : plans;
          let cleared = 0;
          for (let i = 0; i < SHAPE_SEEDS; i++) {
            const cfg = raidConfig(base, squads, seedOf(tier, slot, i), trainableFor(faction));
            if (resolveRaid(cfg, squads, tier, raidCatalogFor(faction)).cleared) cleared++;
          }
          return (cleared / SHAPE_SEEDS) * 100;
        };
        const g = run(ground);
        const a = run(air);
        gs.push(g);
        as.push(a);
        lines.push(
          `${pad(slot === 0 && tier === RAID_TIERS[0] ? flavor.faction.slice(0, 11) : '', 11)} | ` +
            `${pad(slot === 0 ? `T${tier}` : '', 4)} | ${dealtShape(tier, slot, faction).padEnd(12)} | ` +
            `${pad(g.toFixed(0), 6)} | ${pad(a.toFixed(0), 3)} | ${bar(a - g)}`,
        );
      }
    }
    // Pearson r over the fifteen dealt targets. Near zero means the ground
    // ladder carries no information about the air one; negative means it
    // carries the wrong information.
    const mean = (xs: number[]): number => xs.reduce((p, q) => p + q, 0) / xs.length;
    const mg = mean(gs);
    const ma = mean(as);
    let num = 0;
    let dg = 0;
    let da = 0;
    for (let i = 0; i < gs.length; i++) {
      num += (gs[i]! - mg) * (as[i]! - ma);
      dg += (gs[i]! - mg) ** 2;
      da += (as[i]! - ma) ** 2;
    }
    const r = dg > 0 && da > 0 ? num / Math.sqrt(dg * da) : 0;
    // r is inflated by the saturated T1 row, where every cell is 100/100 and
    // carries no information while pulling the coefficient toward +1. The
    // counts do not have that problem: they say, plainly, on how many of the
    // fifteen dealt targets a player who flies is facing a different question.
    const easier = gs.filter((g, i) => as[i]! - g >= 30).length;
    const harder = gs.filter((g, i) => g - as[i]! >= 30).length;
    lines.push(
      `            |      | MEAN / SPLIT | ${pad(mg.toFixed(0), 6)} | ${pad(ma.toFixed(0), 3)} | ` +
        `r=${r >= 0 ? '+' : ''}${r.toFixed(2)}  30+ easier ${easier}, harder ${harder}`,
      '',
    );
  }
  lines.push(
    '  r is over the fifteen targets the faction is actually dealt, and it reads',
    '  higher than it should: every T1 cell is 100/100 for both shapes, which is no',
    '  information and still pulls the coefficient toward +1. Read the COUNTS, which',
    '  cannot be inflated that way — they say how many of the fifteen targets are a',
    '  materially different problem depending on whether you walked or flew.',
    '',
    '  The MEANS are the other half of it: air is not WEAKER at a fixed budget, it is',
    '  UNPREDICTABLE. A player is told the shape for free (GDD §5) and told nothing',
    '  about what it means to an aircraft, so the choice to fly is a lottery over a',
    '  ladder that was selected — correctly, by `--layouts` — against ground.',
  );
  return lines.join('\n');
}

/**
 * The deal (v1.21): what the front line OFFERS against what the generator can
 * BUILD. This table exists because a session spent chasing a "T3-T5 collapse"
 * turned out to be chasing this, and nothing already in the harness could
 * have shown it.
 *
 * Three facts have to sit together before the numbers below read correctly.
 *
 * ONE — the seed decides almost nothing. A raid with no fire plan draws from
 * the engine's stream exactly once per unit: a +/-3..8% speed roll at spawn
 * (`engine.ts:554`). Barrage scatter (`:944`) needs a barrage and these runs
 * have none. Measured: 45% of the 75 (faction, tier, variant) matchups return
 * a BYTE-IDENTICAL outcome across 20 different seeds, and one cell held the
 * same result for 200. The seed does reach the sim — different seeds give
 * different state hashes at every checkpoint, on a board with 11 units on it —
 * so this is wash-out, not a plumbing fault. Twenty seeds is nineteen copies.
 *
 * TWO — 88% of matchups are FULLY decided: 66 of 75 land on exactly 0% or
 * exactly 100%. So `clearPct` is not a probability. It is a count of winnable
 * matchups wearing a percent sign, and on a 15-cell mean it moves in steps of
 * 6.7 points. Half the "34.6-point spread" between the best and worst faction
 * is five matchups flipping.
 *
 * THREE — and therefore the three shapes a tier deals matter more than
 * anything else about it. `archetypeFor` deals them from ONE hardcoded
 * shuffle that does not take the faction, and `TARGETS_PER_TIER` is 3, so
 * every player of every faction meets the same three shapes at a rung,
 * forever, and never sees a fourth.
 *
 * The deal is not representative and the skew is systematic. Ranking each
 * dealt shape inside a pool of twelve variants, worst first:
 *
 *     CHINA T4  dealt rank 9, 9, 9 of 12  ->  100% clear, pool mean 33%
 *     CHINA T5  dealt rank 1, 1, 1 of 12  ->    0% clear, pool mean  8%
 *     NK    T4  dealt rank 1, 1, 1 of 12  ->    0% clear, pool mean 25%
 *     RUSSIA T4 dealt rank 12, 1, 1 of 12 ->   33% clear, pool mean 10%
 *
 * A China player walks from a rung where every target is trivial onto one
 * where every target is impossible, and neither rung says anything about the
 * China kit. `bases.ts` already states the principle this breaks — "a choice
 * between identical problems is not a choice" — and then enforces only half
 * of it: the deal guarantees three distinct SILHOUETTES and says nothing
 * about three distinct DIFFICULTIES, so three shapes that are all impossible
 * pass the check.
 *
 * The RUNG block underneath measures the ladder itself, every shape at every
 * tier, and finds the other half of the problem: the difficulty step is one
 * cliff rather than a curve. T3->T4 adds a structure level AND a tower;
 * T4->T5 adds nothing but the bunker archetype entering the pool. T4 comes
 * out HARDER than T5.
 *
 * Seeds are deliberately few here. Spending twenty of them on a roll that
 * decides nothing, to sample a variant axis that decides everything, is the
 * mistake this table was written to stop making.
 */
const DEAL_SEEDS = 5;

/** Clear% for one (faction, tier, shape), averaged over the three variants. */
function shapeClear(faction: FactionId, tier: number, shape: ArchetypeId): number {
  const tunneled = faction === 'nk';
  let cleared = 0;
  let runs = 0;
  for (let variant = 0; variant < VARIANTS; variant++) {
    const base = generateBase(tier, variant, baseKitFor(faction), shape);
    const squads = (tunneled ? tunnelPlanFor(faction, base, tier) : RAID_PLANS[faction]).map(
      (squad, at) => ({ ...squad, slot: at }),
    );
    for (let i = 0; i < DEAL_SEEDS; i++) {
      const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
      if (resolveRaid(config, squads, tier, raidCatalogFor(faction)).cleared) cleared++;
      runs++;
    }
  }
  return runs > 0 ? (cleared / runs) * 100 : 0;
}

/**
 * Who carries a raid (v1.21). The largest finding of this milestone and the
 * one that reframes the rest of it.
 *
 * Silencing one unit kind at a time — both damage channels, everything else
 * held — measures DELIVERED contribution rather than the potential a stat line
 * advertises. The answer is that a raid is very nearly one unit:
 *
 *     USA  baseline 51.6      UN  baseline 29.7
 *       abrams  -44.3           leo1        -16.1
 *       humvee   -4.2           nlaw         -6.3
 *       javelin  -1.0           vab          -5.7
 *       engineer -1.0           peacekeeper  -1.0
 *       ranger   -0.0           unmedic      -0.0
 *                               unsapper     -0.0
 *
 * Eighty-six percent of a USA raid is the Abrams. Three Ranger squads — 6 of
 * 27 manpower — deliver ZERO measurable outcome, as do the UN's medics and
 * breachers. Between a third and a half of every reference plan is manpower
 * spent on units that do not change whether the raid succeeds.
 *
 * Why: ending a raid means killing the command post, ranged fire is discounted
 * hard against structures, and melee only fires when a unit is ADJACENT. The
 * heavy is the only unit that reliably survives to get there and hit hard when
 * it does. Everything else is escort.
 *
 * This is what the UN's floor actually is. Delivered per manpower, the Abrams
 * is worth 5.53 and the Leopard 2.69 — the same 2x that shows up in `--kits`
 * and `--structure`, arriving here as the bottom line. And it explains why
 * `--plans` reorders the table so violently: an armour-forward plan is not a
 * better idea, it is the only idea, and the reference plans differ mostly in
 * how much manpower they waste before finding it.
 *
 * Read this before tuning any unit stat. A buff to something that never
 * reaches the post buys nothing, which cost this milestone three separate
 * measurements to learn.
 */
/**
 * THE KILL CHAIN — how far a raid gets, and what gets it there (M22 phase 1).
 *
 * `--carry` answers "whose silence changes the verdict" and that is all it can
 * answer, because the verdict is one bit. It found that one unit is 99-100% of
 * a raid and could not say why, which is the whole reason this exists: a raid
 * has to be readable as a SEQUENCE before anything can be said about which
 * unit is for which part of it.
 *
 * Four stages, named for what a raid physically does:
 *
 *   BREACH  break a wall segment to get in
 *   GUNS    put a covering emplacement down
 *   CHARGE  reach the post and land a hit on it
 *   BURN    finish it
 *
 * All four are read off today's sponge, deliberately. They are not new
 * mechanics; they are a lens on the mechanics that are already there, so the
 * baseline this prints stays comparable after the stage model ships behind
 * `KILL_CHAIN_VERSION` and can be used to judge it.
 *
 * **BREACH IS NOT A GATE TODAY, AND THE COLUMN IS THERE TO SHOW THAT.** The
 * first draft of this called it WIRE and read it as "got in", which every
 * faction then failed at 5-36% while still burning the post four times in
 * five. Nothing was wrong with the sim: a wall line STEERS, it does not block
 * (GDD §5.3), so a force that walks around the wire never breaks any and is
 * inside all the same. Low BREACH beside high CHARGE is that, and after M22
 * this column is where the difference shows up.
 *
 * The stages are reported INDEPENDENTLY rather than as a strict prefix, since
 * they are not strictly ordered today — a base can keep guns outside its wire.
 * STALLS AT names the biggest FALL between consecutive stages, which is where
 * a raid actually runs out rather than where it happens to score low.
 */
const CHAIN_STAGES = ['BREACH', 'GUNS', 'CHARGE', 'BURN'] as const;
type ChainStage = (typeof CHAIN_STAGES)[number];

/**
 * Which stages one resolved raid got through.
 *
 * Two lenses on the same four columns, because the two models keep the score
 * in different places:
 *
 * - On the SPONGE there are no stages, so they are inferred from what the
 *   raid left behind. The inference is a lens on mechanics that are already
 *   there, not a claim that the sponge has stages.
 * - Under the CHAIN the engine counts them itself, and the count is the
 *   answer: `chainStages` is a high-water mark of stages COMPLETED.
 *
 * The columns mean the same thing either way — how far did this raid get —
 * which is what makes the two tables comparable, and comparing them is the
 * entire point of having built the sponge lens first.
 */
function stagesReached(
  outcome: RaidResolution,
  base: GeneratedBase,
  guns: Set<string>,
  staged: boolean,
): Record<ChainStage, boolean> {
  if (staged) {
    return {
      BREACH: outcome.chainStages >= 1,
      GUNS: outcome.chainStages >= 2,
      CHARGE: outcome.chainStages >= 3,
      BURN: outcome.chainStages >= 4,
    };
  }
  return {
    // A base with no wire cannot be blocked by it, so the stage is passed
    // rather than skipped — scoring it as a failure would read every open
    // camp as a force that could not get in.
    BREACH: base.walls.length === 0 || outcome.wallsBreached > 0,
    GUNS: Object.entries(outcome.destroyed).some(([kind, n]) => n > 0 && guns.has(kind)),
    CHARGE: outcome.ccHpFraction < 1,
    BURN: outcome.cleared,
  };
}

function chainTable(chainVersion = CHAIN_NONE): string {
  const model = chainModelFor(chainVersion);
  const zero = (): Record<ChainStage, number> =>
    ({ BREACH: 0, GUNS: 0, CHARGE: 0, BURN: 0 });

  /** Stage reach RATES for one faction's reference expedition, 0..100. */
  const run = (faction: FactionId, cat: Catalog): Record<ChainStage, number> => {
    const squads = RAID_PLANS[faction].map((s, at) => ({ ...s, slot: at }));
    const kit = baseKitFor(faction);
    const guns = new Set<string>([...kit.towers, kit.aa]);
    const hit = zero();
    let runs = 0;
    // Same scope as `--carry`, so the two tables are read against each other.
    for (const tier of [2, 3, 4, 5]) {
      for (const arch of ARCHETYPES) {
        for (let v = 0; v < 2; v++) {
          const base = generateBase(tier, v, kit, arch.id);
          for (let i = 0; i < 2; i++) {
            const config = {
              ...raidConfig(base, squads, seedOf(tier, v, i), trainableFor(faction)),
              killChainVersion: chainVersion,
            };
            const reached = stagesReached(
              resolveRaid(config, squads, tier, cat),
              base,
              guns,
              model.staged,
            );
            for (const stage of CHAIN_STAGES) if (reached[stage]) hit[stage]++;
            runs++;
          }
        }
      }
    }
    const out = zero();
    for (const stage of CHAIN_STAGES) out[stage] = runs > 0 ? (hit[stage] / runs) * 100 : 0;
    return out;
  };

  /**
   * Every damage channel a unit has, off — the body stays on the board.
   *
   * `wallDps` is in here and was not in the first draft, which understated
   * every sapper in the game: silencing one left its 60-80 demolition intact,
   * so the BREACH column could not move and the row read as a unit that
   * contributes nothing. It is the same oversight in both models, but the
   * chain is the one that makes it matter, since demolition is what buys the
   * first stage.
   */
  const silence = (cat: Catalog, kind: string): Catalog => ({
    ...cat,
    attackers: Object.fromEntries(
      Object.entries(cat.attackers).map(([k, p]) => [
        k,
        k === kind
          ? {
              ...p,
              hqDps: 0,
              wallDps: 0,
              weapon: p.weapon ? { ...p.weapon, damage: 0 } : p.weapon,
            }
          : p,
      ]),
    ),
  });

  const pct = (n: number): string => n.toFixed(0).padStart(4);
  const lines = [
    `THE KILL CHAIN — how far the reference expedition gets, by stage (${model.label})`,
    'FACTION     | BRCH | GUNS | CHRG | BURN | STALLS AT',
    '------------+------+------+------+------+-----------',
  ];
  const baseline: Partial<Record<FactionId, Record<ChainStage, number>>> = {};
  for (const faction of FACTION_IDS) {
    const rates = run(faction, raidCatalogFor(faction));
    baseline[faction] = rates;
    // Where the chain actually loses people: the biggest fall from one stage
    // to the next. A stage that simply scores low without falling from the one
    // before it is not where the raid ran out.
    let stalls: string = 'nowhere';
    let worstFall = 2;
    for (let i = 1; i < CHAIN_STAGES.length; i++) {
      const fall = rates[CHAIN_STAGES[i - 1]!] - rates[CHAIN_STAGES[i]!];
      if (fall > worstFall) {
        worstFall = fall;
        stalls = `${CHAIN_STAGES[i]} (-${fall.toFixed(0)})`;
      }
    }
    lines.push(
      `${flavorFor(faction).faction.slice(0, 11).padEnd(11)} |${pct(rates.BREACH)}  |${pct(rates.GUNS)}  |` +
        `${pct(rates.CHARGE)}  |${pct(rates.BURN)}  | ${stalls}`,
    );
  }

  lines.push('');
  lines.push('WHO GETS YOU THROUGH — each unit silenced, the stage that stops advancing');
  lines.push('FACTION     | UNIT         | MP | BRCH | GUNS | CHRG | BURN | ITS STAGE');
  lines.push('------------+--------------+----+------+------+------+------+-----------');
  for (const faction of FACTION_IDS) {
    const cat = raidCatalogFor(faction);
    const before = baseline[faction]!;
    const counts: Record<string, number> = {};
    for (const s of RAID_PLANS[faction]) {
      for (const [k, n] of Object.entries(s.units)) counts[k] = (counts[k] ?? 0) + n;
    }
    const mpOf = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
    for (const kind of Object.keys(counts)) {
      const after = run(faction, silence(cat, kind));
      const drop = (st: ChainStage): number => before[st] - after[st];
      // The stage a unit is FOR: where silencing it costs the most progress.
      // A unit whose biggest loss is BURN is an escort by another name — that
      // is the finish line, not a job.
      let worst: ChainStage = 'BREACH';
      for (const st of CHAIN_STAGES) if (drop(st) > drop(worst)) worst = st;
      const owns = drop(worst) >= 3 ? worst : '—';
      lines.push(
        `${flavorFor(faction).faction.slice(0, 11).padEnd(11)} | ${kind.padEnd(12)} |` +
          `${String(mpOf[kind] ?? 0).padStart(3)} |${pct(drop('BREACH'))}  |${pct(drop('GUNS'))}  |` +
          `${pct(drop('CHARGE'))}  |${pct(drop('BURN'))}  | ${owns}`,
      );
    }
  }
  lines.push('');
  lines.push('Drops are percentage points of stage reach lost when that unit DOES NO DAMAGE —');
  lines.push('hqDps, wallDps and its weapon all zeroed.');
  lines.push('It stays on the board, so a zero row means its damage buys nothing — not that');
  lines.push('the unit does: a body still soaks fire. Same channel `--carry` measures.');
  lines.push('A roster where every unit owns BURN and nothing else is a roster of escorts.');
  return lines.join('\n');
}

/**
 * Does the chain actually ASK for a mix? (v1.41)
 *
 * The per-unit table above cannot answer that, and it is important to say why:
 * three of the five reference plans are monocultures — nine BTRs, nine VABs,
 * three Abrams — so silencing their one kind silences the whole army and the
 * row reads 60-90 whatever the model does. That is a plan problem, and M22
 * Phase 3 is where it gets fixed.
 *
 * This asks the model directly instead. One manpower budget per faction, five
 * compositions built from its OWN roster by stat rather than by name, so the
 * table keeps working when the content changes:
 *
 *     ALL HEAVY   the thing the sponge rewards — fill the budget with the
 *                 toughest unit there is
 *     +BREACH     one heavy, the rest demolition
 *     +BODIES     one heavy, the rest of the cheapest bodies available
 *     COMBINED    one of each role, the remainder in bodies
 *     NO HEAVY    breachers, guns and bodies, no heavy at all
 *
 * Run it under both models. If ALL HEAVY wins under the sponge and loses under
 * the chain, the milestone did what it set out to do. If ALL HEAVY wins under
 * both, it did not, and no amount of re-derived plans will hide that.
 */
type MixRole = 'heavy' | 'breacher' | 'gun' | 'body';

function rolesFor(faction: FactionId): Record<MixRole, TrainMeta> | null {
  const cat = raidCatalogFor(faction);
  const ground = trainableFor(faction).filter((t) => cat.attackers[t.kind] && !cat.attackers[t.kind]!.air);
  if (ground.length < 3) return null;
  const at = (t: TrainMeta) => cat.attackers[t.kind]!;
  const best = (score: (t: TrainMeta) => number, skip: TrainMeta[]): TrainMeta =>
    ground
      .filter((t) => !skip.includes(t))
      .reduce((a, b) => (score(b) > score(a) ? b : a));
  const heavy = best((t) => at(t).maxHp, []);
  const breacher = best((t) => at(t).wallDps, [heavy]);
  const gun = best((t) => at(t).weapon?.damage ?? 0, [heavy, breacher]);
  // The cheapest body there is: least manpower, ties broken on least CP so the
  // pick is deterministic rather than roster-order dependent.
  const body = ground
    .filter((t) => t !== heavy && t !== breacher && t !== gun)
    .reduce(
      (a, b) => (b.manpower < a.manpower || (b.manpower === a.manpower && at(b).cpValue < at(a).cpValue) ? b : a),
      ground.find((t) => t !== heavy && t !== breacher && t !== gun) ?? heavy,
    );
  return { heavy, breacher, gun, body };
}

/** Fill a manpower budget with a fixed core, then spend the rest on one role. */
function fillBudget(
  roles: Record<MixRole, TrainMeta>,
  budget: number,
  core: Partial<Record<MixRole, number>>,
  topUp: MixRole | null,
): Record<string, number> {
  const units: Record<string, number> = {};
  let left = budget;
  for (const [role, want] of Object.entries(core) as [MixRole, number][]) {
    const meta = roles[role];
    for (let i = 0; i < want && meta.manpower <= left; i++) {
      units[meta.kind] = (units[meta.kind] ?? 0) + 1;
      left -= meta.manpower;
    }
  }
  if (topUp) {
    const meta = roles[topUp];
    while (meta.manpower <= left) {
      units[meta.kind] = (units[meta.kind] ?? 0) + 1;
      left -= meta.manpower;
    }
  }
  return units;
}

function mixTable(chainVersion = CHAIN_NONE): string {
  const model = chainModelFor(chainVersion);
  /** Round-robin one force into the three reference sectors. */
  const spread = (units: Record<string, number>): SquadPlan[] => {
    const sectors: SectorId[] = ['W1', 'N1', 'S1'];
    const piles: Record<string, number>[] = [{}, {}, {}];
    let at = 0;
    for (const [kind, n] of Object.entries(units)) {
      for (let i = 0; i < n; i++) {
        const pile = piles[at % 3]!;
        pile[kind] = (pile[kind] ?? 0) + 1;
        at++;
      }
    }
    return piles.map((units_, i) => ({
      units: units_,
      sector: sectors[i]!,
      doctrine: 'assault' as const,
      slot: i,
    }));
  };

  const clearRate = (faction: FactionId, units: Record<string, number>): number => {
    const squads = spread(units);
    const kit = baseKitFor(faction);
    const cat = raidCatalogFor(faction);
    let wins = 0;
    let runs = 0;
    for (const tier of [2, 3, 4, 5]) {
      for (const arch of ARCHETYPES) {
        for (let v = 0; v < 2; v++) {
          const base = generateBase(tier, v, kit, arch.id);
          const config = {
            ...raidConfig(base, squads, seedOf(tier, v, 0), trainableFor(faction)),
            killChainVersion: chainVersion,
          };
          if (resolveRaid(config, squads, tier, cat).cleared) wins++;
          runs++;
        }
      }
    }
    return runs > 0 ? (wins / runs) * 100 : 0;
  };

  // A ladder in ONE variable: how many heavies the budget keeps. Everything
  // else is the remainder spent on one specialist role, so a column beating
  // `3 HEAVY` says that trading exactly one heavy for that role pays.
  const MIXES: [string, Partial<Record<MixRole, number>>, MixRole | null][] = [
    ['3 HEAVY', {}, 'heavy'],
    ['2H+BRCH', { heavy: 2 }, 'breacher'],
    ['2H+GUN', { heavy: 2 }, 'gun'],
    ['2H+BODY', { heavy: 2 }, 'body'],
    ['1H+MIX', { heavy: 1, breacher: 1, gun: 1 }, 'body'],
    ['0 HEAVY', { breacher: 1, gun: 1 }, 'body'],
  ];

  const lines = [
    `WHAT ONE HEAVY BUYS — one manpower budget, six compositions (${model.label})`,
    'FACTION     | BUDGET | 3 HEAVY | 2H+BRCH | 2H+GUN | 2H+BODY | 1H+MIX | 0 HEAVY | BEST',
    '------------+--------+---------+---------+--------+---------+--------+---------+---------',
  ];
  for (const faction of FACTION_IDS) {
    const roles = rolesFor(faction);
    if (!roles) continue;
    // Three of the toughest thing in the roster: what the derived reference
    // plans converged on under the sponge, and so the budget worth comparing at.
    const budget = roles.heavy.manpower * 3;
    const rates = MIXES.map(([, core, topUp]) => clearRate(faction, fillBudget(roles, budget, core, topUp)));
    let bestAt = 0;
    for (let i = 1; i < rates.length; i++) if (rates[i]! > rates[bestAt]!) bestAt = i;
    lines.push(
      `${flavorFor(faction).faction.slice(0, 11).padEnd(11)} |` +
        `${String(budget).padStart(6)}  |` +
        rates.map((r, i) => r.toFixed(0).padStart(MIXES[i]![0].length + 1) + ' ').join('|') +
        `| ${MIXES[bestAt]![0]}`,
    );
  }
  lines.push('');
  lines.push('Clear rate, 4 tiers x 8 archetypes x 2 variants. Roles are picked from each');
  lines.push("roster BY STAT — toughest, most demolition, biggest gun, cheapest body — so");
  lines.push('the table survives content changes a hand-written unit list would not.');
  lines.push('A column beating 3 HEAVY says trading exactly one heavy for that role pays.');
  return lines.join('\n');
}

/**
 * Who carries a raid, measured two ways (v1.41).
 *
 * SILENCED is the original channel: every damage stat zeroed, the body left on
 * the board. It answers "what is this unit's damage worth" and it was the only
 * question worth asking while the post was an HP sponge, because damage was
 * the only thing that ended a raid.
 *
 * Under the kill chain that is no longer true. Bodies work the charge and hold
 * the ground while the post burns, so a unit can be worth a great deal while
 * measuring zero under SILENCED. REPLACED closes that: the kind is taken OUT
 * of the plan and its manpower spent on whatever else the plan already had, in
 * the proportions it already had them. That is the planning question — is this
 * unit better than more of the rest — and it is the one M22's bar is set on.
 *
 * At equal manpower deliberately. Removing eight manpower of Abrams and not
 * spending it measures a smaller raid, which loses for a reason that is not
 * the Abrams.
 *
 * A single-kind plan cannot answer REPLACED at all: there is nothing to spend
 * the manpower on. Those rows read `n/a`, and that is not a gap in the
 * instrument — it is the monoculture problem stated in one column.
 */
function carryTable(): string {
  const silence = (cat: Catalog, kind: string): Catalog => ({
    ...cat,
    attackers: Object.fromEntries(
      Object.entries(cat.attackers).map(([k, p]) => [
        k,
        k === kind
          ? { ...p, hqDps: 0, wallDps: 0, weapon: p.weapon ? { ...p.weapon, damage: 0 } : p.weapon }
          : p,
      ]),
    ),
  });

  /**
   * The plan with `kind` gone and its manpower respent on the rest.
   *
   * Substitutes are added one at a time, cheapest-affordable first among the
   * kinds furthest below their original share, so the plan keeps its shape
   * rather than turning into a pile of whatever is cheapest. Returns null when
   * there is nothing left to spend on.
   */
  const replace = (
    faction: FactionId,
    plan: SquadPlan[],
    kind: string,
  ): SquadPlan[] | null => {
    const mpOf = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
    const counts: Record<string, number> = {};
    for (const sq of plan) for (const [k, n] of Object.entries(sq.units)) counts[k] = (counts[k] ?? 0) + n;
    const others = Object.keys(counts).filter((k) => k !== kind && (mpOf[k] ?? 0) > 0);
    if (others.length === 0) return null;

    let budget = (mpOf[kind] ?? 0) * (counts[kind] ?? 0);
    const want: Record<string, number> = {};
    const total = others.reduce((a, k) => a + counts[k]!, 0);
    for (;;) {
      // The kind furthest below its original share of the surviving force,
      // ties broken on cost then name so the walk is deterministic.
      const added = others.reduce((a, b) => a + (want[b] ?? 0), 0);
      const pick = others
        .filter((k) => (mpOf[k] ?? 0) <= budget)
        .sort((a, b) => {
          const sa = (counts[a]! + (want[a] ?? 0)) / (total + added || 1) - counts[a]! / total;
          const sb = (counts[b]! + (want[b] ?? 0)) / (total + added || 1) - counts[b]! / total;
          return sa - sb || mpOf[a]! - mpOf[b]! || (a < b ? -1 : 1);
        })[0];
      if (!pick) break;
      want[pick] = (want[pick] ?? 0) + 1;
      budget -= mpOf[pick]!;
    }

    const out: SquadPlan[] = plan.map((sq) => ({
      ...sq,
      units: Object.fromEntries(Object.entries(sq.units).filter(([k]) => k !== kind)),
    }));
    let at = 0;
    for (const [k, n] of Object.entries(want)) {
      for (let i = 0; i < n; i++) {
        const sq = out[at % out.length]!;
        sq.units[k] = (sq.units[k] ?? 0) + 1;
        at++;
      }
    }
    return out.filter((sq) => Object.keys(sq.units).length > 0);
  };

  const run = (faction: FactionId, cat: Catalog, plan: SquadPlan[]): number => {
    const squads = plan.map((s, at) => ({ ...s, units: { ...s.units }, slot: at }));
    let cleared = 0;
    let runs = 0;
    for (const tier of [2, 3, 4, 5]) {
      for (const arch of ARCHETYPES) {
        for (let v = 0; v < 2; v++) {
          const base = generateBase(tier, v, baseKitFor(faction), arch.id);
          for (let i = 0; i < 2; i++) {
            const config = raidConfig(base, squads, seedOf(tier, v, i), trainableFor(faction));
            if (resolveRaid(config, squads, tier, cat).cleared) cleared++;
            runs++;
          }
        }
      }
    }
    return runs > 0 ? (cleared / runs) * 100 : 0;
  };

  const lines = [
    'WHO CARRIES A RAID — every unit kind taken out of the plan, two ways',
    'FACTION | UNIT         | MP | BASE | SILENCED | REPLACED | SHARE',
    '--------+--------------+----+------+----------+----------+------',
  ];
  let topShare = 0;
  let topLabel = '';
  const monocultures: FactionId[] = [];
  for (const faction of FACTION_IDS) {
    const cat = raidCatalogFor(faction);
    const plan = RAID_PLANS[faction];
    const base = run(faction, cat, plan);
    const counts: Record<string, number> = {};
    for (const s of plan) for (const [k, n] of Object.entries(s.units)) counts[k] = (counts[k] ?? 0) + n;
    if (Object.keys(counts).length === 1) monocultures.push(faction);
    const mpOf = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
    for (const kind of Object.keys(counts).sort()) {
      const quiet = base - run(faction, silence(cat, kind), plan);
      const swapped = replace(faction, plan, kind);
      const gone = swapped === null ? null : base - run(faction, cat, swapped);
      const share = gone === null || base <= 0 ? null : (gone / base) * 100;
      if (share !== null && share > topShare) {
        topShare = share;
        topLabel = `${faction.toUpperCase()} ${kind}`;
      }
      lines.push(
        `${pad(faction.toUpperCase(), 7)} | ${pad(kind, 12)} | ` +
          `${pad((mpOf[kind] ?? 0) * (counts[kind] ?? 0), 2)} | ${pad(base.toFixed(0), 4)} | ` +
          `${pad(quiet.toFixed(0), 8)} | ${pad(gone === null ? 'n/a' : gone.toFixed(0), 8)} | ` +
          `${pad(share === null ? 'n/a' : `${share.toFixed(0)}%`, 5)}`,
      );
    }
  }
  lines.push('');
  lines.push(
    `WORST CARRY ${topShare.toFixed(0)}% — ${topLabel || 'nothing measurable'}. M22's bar is 50%: ` +
      'above it, the plan is one unit and two decorations, and "your plan is your skill" is false.',
  );
  lines.push(
    'SILENCED zeroes every damage stat and leaves the body; REPLACED takes the kind out and ' +
      'spends its manpower on the rest of the plan. A unit that scores low SILENCED and high ' +
      'REPLACED is earning its place with its BODY — under the kill chain that is a real job, ' +
      'since the charge needs a crew and the burn needs the ground held.',
  );
  if (monocultures.length > 0) {
    lines.push(
      `REPLACED is n/a for ${monocultures.map((f) => f.toUpperCase()).join(', ')}: a plan of one ` +
        'kind has nothing to spend the manpower on. That is the finding, not a gap.',
    );
  }
  return lines.join('\n');
}

/**
 * What actually kills a command post, and what that costs each faction (v1.21).
 *
 * Chasing the UN's floor split its clock at the moment the post first takes
 * damage. The approach is not the problem — the UN arrives 26% later but with
 * MORE of its force intact (3.7 units against the USA's 3.2). The fight AT the
 * objective is 74% longer: 1245 ticks against 716.
 *
 * So: what kills a post? Two channels, and they are not the obvious ones.
 * Ranged fire goes through `DAMAGE_MULT`, which discounts everything hard
 * against a structure — smallArms 0.15, flak 0.1, kinetic 0.5, shaped 0.8,
 * explosive 1.0. Melee (`hqDps`) bypasses the table entirely, but only fires
 * when an attacker is ADJACENT (`engine.ts:1324`), which in practice only the
 * heavy manages: it lands 60-84% of killing blows.
 *
 * Which makes the heavy's damage type one of the largest single numbers in the
 * game, and it was chosen for flavour. USA and China fire explosive at x1.0;
 * Russia, the KPA and the UN fire kinetic at x0.5. Swapping only that flag:
 *
 *     faction   fires       shipping   all explosive   all kinetic   swing
 *     USA       explosive       51.6            51.6          41.1   +10.4
 *     CHINA     explosive       52.6            52.6          35.9   +16.7
 *     RUSSIA    kinetic         50.5            62.5          50.5   +12.0
 *     NK        kinetic         55.7            59.4          55.7    +3.6
 *     UN        kinetic         29.7            37.0          29.7    +7.3
 *
 * Read that as an argument about fairness, not about the UN. Normalising the
 * flag does NOT close the UN's floor — it is last under every uniform setting —
 * and it would hand Russia twelve points. What it says is that three factions
 * are paying a large, undocumented tax on a field that reads as flavour text.
 *
 * Also settled here, because it looked obvious and was wrong: the USA Ranger
 * does 22 hqDps where every other faction's basic infantry does 8-16, as much
 * melee as the UN's TANK. Giving the Peacekeeper the Ranger's figure is worth
 * -0.4. Infantry melee is not the term; only the unit that reaches the post
 * spends it, and the infantry mostly do not get there.
 */
function structureTable(): string {
  const swapHeavy = (cat: Catalog, to: string): Catalog => ({
    ...cat,
    attackers: Object.fromEntries(
      Object.entries(cat.attackers).map(([kind, p]) => [
        kind,
        p.armor === 'heavy' && p.weapon
          ? { ...p, weapon: { ...p.weapon, damageType: to as DamageType } }
          : p,
      ]),
    ),
  });
  const run = (faction: FactionId, cat: Catalog): number => {
    let cleared = 0;
    let runs = 0;
    for (const tier of [2, 3, 4, 5]) {
      for (const arch of ARCHETYPES) {
        for (let v = 0; v < 2; v++) {
          const base = generateBase(tier, v, baseKitFor(faction), arch.id);
          const squads = (
            faction === 'nk' ? tunnelPlanFor('nk', base, tier) : RAID_PLANS[faction]
          ).map((s, at) => ({ ...s, slot: at }));
          for (let i = 0; i < 3; i++) {
            const config = raidConfig(base, squads, seedOf(tier, v, i), trainableFor(faction));
            if (resolveRaid(config, squads, tier, cat).cleared) cleared++;
            runs++;
          }
        }
      }
    }
    return runs > 0 ? (cleared / runs) * 100 : 0;
  };

  const lines = [
    'WHAT KILLS A COMMAND POST — the heavy\'s damage type, which was picked for flavour',
    'FACTION | HEAVY FIRES | vs STRUCT | SHIPPING | ALL EXPLOSIVE | ALL KINETIC | SWING',
    '--------+-------------+-----------+----------+---------------+-------------+------',
  ];
  let widest = 0;
  for (const faction of FACTION_IDS) {
    const cat = raidCatalogFor(faction);
    const heavy = Object.values(cat.attackers).find((p) => p.armor === 'heavy');
    const type = heavy?.weapon?.damageType ?? '—';
    const mult = (DAMAGE_MULT as Record<string, Record<string, number>>)[type]?.structure ?? 1;
    const now = run(faction, cat);
    const exp = run(faction, swapHeavy(cat, 'explosive'));
    const kin = run(faction, swapHeavy(cat, 'kinetic'));
    widest = Math.max(widest, exp - kin);
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(type, 11)} | ${pad(`x${mult}`, 9)} | ${pad(now.toFixed(1), 8)} | ` +
        `${pad(exp.toFixed(1), 13)} | ${pad(kin.toFixed(1), 11)} | ${pad(`+${(exp - kin).toFixed(1)}`, 5)}`,
    );
  }
  lines.push('');
  lines.push(
    `ONE FLAG ON ONE UNIT IS WORTH UP TO ${widest.toFixed(1)} POINTS. Ranged fire is discounted ` +
      'against structures (smallArms 0.15, kinetic 0.5, explosive 1.0); melee ignores the table but',
  );
  lines.push(
    '  only fires when adjacent, which in practice only the heavy manages — it lands 60-84% of the ' +
      'killing blows. Normalising the flag does NOT lift the UN off the floor.',
  );
  return lines.join('\n');
}

/**
 * A SECOND plan per faction, built to one recipe rather than by hand (v1.21).
 *
 * The five reference plans above were written one at a time, and they are not
 * equally good. Every one of them sits 4-19 clear-rate points below what its
 * own roster can do at the same manpower, and the shortfall is uneven — so a
 * cross-faction row carries as much PLAN as it does faction.
 *
 * How uneven: applying a single recipe — heavy up front with a screen, light
 * armour and the ranged specialists in the middle, breachers and filler behind
 * — to all five rosters does not shift the spread much (26.6 -> 27.0) but it
 * REORDERS the table completely:
 *
 *     faction   reference   one recipe
 *     CHINA        52.7        71.9
 *     RUSSIA       50.4        64.1
 *     NK           55.5        55.5
 *     USA          52.0        52.3
 *     UN           28.9        44.9
 *
 * The USA leads on the shipping plans and comes fourth on these. Neither set is
 * wrong; both are one player's idea of a sane force. What is wrong is reading
 * either as a measurement of the FACTION, and `--parity` had been read that way
 * for several releases.
 *
 * So the harness reports both and the SPREAD between them. A faction's ceiling
 * over the plans tried is a better invariant than any single plan's result, and
 * the spread is the error bar that belongs on every cross-faction number.
 *
 * Note what this does NOT touch: `--kits` holds the force fixed and swaps only
 * the fortifications, so plan quality cancels exactly within each row. That
 * finding stands.
 */
const RECIPE_PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { abrams: 1, ranger: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { humvee: 2, javelin: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { javelin: 1, engineer: 1, ranger: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  china: [
    { units: { type99: 1, rifle: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { zbd: 2, grenadier: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { grenadier: 2, sapper: 2 }, sector: 'S1', doctrine: 'raze' },
  ],
  russia: [
    { units: { t72: 1, motorrifle: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { btr: 2, rpg: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { rpg: 1, demoteam: 2, motorrifle: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  // No light armour in the roster, so the middle is ranged and the mass goes
  // behind. That is the KPA's identity rather than a break in the recipe.
  nk: [
    { units: { chonma: 1, nkrifle: 3 }, sector: 'W1', doctrine: 'assault' },
    { units: { rpg7: 3, tunneler: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { tunneler: 1, infiltrator: 4, nkrifle: 4 }, sector: 'S1', doctrine: 'raze' },
  ],
  un: [
    { units: { leo1: 1, peacekeeper: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { vab: 2, nlaw: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { nlaw: 1, unsapper: 1, unmedic: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
};

function planTable(combatVersion = COMBAT_CURRENT): string {
  const run = (faction: FactionId, plan: SquadPlan[]): number => {
    const cat = raidCatalogFor(faction);
    let cleared = 0;
    let runs = 0;
    for (const tier of RAID_TIERS) {
      for (const arch of ARCHETYPES) {
        for (let v = 0; v < 2; v++) {
          const base = generateBase(tier, v, baseKitFor(faction), arch.id);
          const squads = (faction === 'nk' ? tunnelPlanFor('nk', base, tier) : plan).map(
            (s, at) => ({ ...s, slot: at }),
          );
          for (let i = 0; i < 3; i++) {
            const config = {
              ...raidConfig(base, squads, seedOf(tier, v, i), trainableFor(faction)),
              combatVersion,
            };
            if (resolveRaid(config, squads, tier, cat).cleared) cleared++;
            runs++;
          }
        }
      }
    }
    return runs > 0 ? (cleared / runs) * 100 : 0;
  };

  const lines = [
    'THE PLAN, NOT THE FACTION — the same roster asked twice' +
      (combatVersion === COMBAT_NONE ? ' (no rolls)' : ''),
    'FACTION | REF MP | REFERENCE | RECIPE MP | RECIPE |  BEST | PLAN IS WORTH',
    '--------+--------+-----------+-----------+--------+-------+--------------',
  ];
  const best: number[] = [];
  let widest = 0;
  for (const faction of FACTION_IDS) {
    const ref = run(faction, RAID_PLANS[faction]);
    const rec = run(faction, RECIPE_PLANS[faction]);
    best.push(Math.max(ref, rec));
    widest = Math.max(widest, Math.abs(rec - ref));
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(planManpower(faction), 6)} | ${pad(ref.toFixed(1), 9)} | ` +
        `${pad(planManpower(faction, RECIPE_PLANS[faction]), 9)} | ${pad(rec.toFixed(1), 6)} | ` +
        `${pad(Math.max(ref, rec).toFixed(1), 5)} | ${pad((rec - ref >= 0 ? '+' : '') + (rec - ref).toFixed(1), 13)}`,
    );
  }
  lines.push('');
  lines.push(
    `PLAN IS WORTH UP TO ${widest.toFixed(1)} POINTS — comparable to every effect this harness ` +
      'measures. Read BEST as the faction and the last column as the error bar; a single ' +
      'plan\'s row is not a reading of a kit.',
  );
  lines.push(
    `BEST-PLAN SPREAD ${(Math.max(...best) - Math.min(...best)).toFixed(1)} points. ` +
      '`--kits` is unaffected: it holds the force fixed and swaps only the fortifications.',
  );
  return lines.join('\n');
}

/**
 * The two base kits, each measured against every force (v1.21).
 *
 * There are exactly two: the PLA post that the USA and the UN raid, and the US
 * firebase that China, Russia and the KPA raid. Nothing else in the harness
 * compares them, and until v1.21 nothing had: the PLA kit measured 34
 * clear-rate points softer for all five forces, which handed the two factions
 * that raid it a standing advantage no amount of deal or ladder work could
 * reach.
 *
 * Forced shapes on both sides, so the deal cannot move the answer, and the
 * catalog's structures are swapped rather than its attackers — the same force
 * meets the other side's fortifications with nothing else changed.
 *
 * A row near zero is the bar. A column that is uniformly softer is a faction
 * pick behaving as a difficulty setting.
 */
function kitTable(): string {
  const own = (f: FactionId): 'china' | 'usa' => (f === 'usa' || f === 'un' ? 'china' : 'usa');
  const swapped = (f: FactionId, donor: FactionId): Catalog => {
    const mine = raidCatalogFor(f);
    const theirs = raidCatalogFor(donor);
    return { ...mine, structures: theirs.structures, walls: theirs.walls };
  };
  const run = (faction: FactionId, kitOwner: 'china' | 'usa'): number => {
    const kit = kitOwner === 'china' ? CHINA_BASE_KIT : USA_BASE_KIT;
    const donor = FACTION_IDS.find((f) => own(f) === kitOwner)!;
    const catalog = own(faction) === kitOwner ? raidCatalogFor(faction) : swapped(faction, donor);
    const squads = RAID_PLANS[faction].map((s, at) => ({ ...s, slot: at }));
    let cleared = 0;
    let runs = 0;
    for (const tier of [2, 3, 4, 5]) {
      for (const arch of ARCHETYPES) {
        for (let v = 0; v < 2; v++) {
          const base = generateBase(tier, v, kit, arch.id);
          for (let i = 0; i < 3; i++) {
            const config = raidConfig(base, squads, seedOf(tier, v, i), trainableFor(faction));
            if (resolveRaid(config, squads, tier, catalog).cleared) cleared++;
            runs++;
          }
        }
      }
    }
    return runs > 0 ? (cleared / runs) * 100 : 0;
  };

  const lines = [
    'THE TWO KITS — every force against both sets of fortifications',
    'FORCE   | vs PLA post | vs US firebase |   GAP | normally raids',
    '--------+-------------+----------------+-------+---------------',
  ];
  let worst = 0;
  for (const faction of FACTION_IDS) {
    const c = run(faction, 'china');
    const u = run(faction, 'usa');
    worst = Math.max(worst, Math.abs(c - u));
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(c.toFixed(1), 11)} | ${pad(u.toFixed(1), 14)} | ` +
        `${pad((c - u >= 0 ? '+' : '') + (c - u).toFixed(1), 5)} | ${own(faction).toUpperCase()}`,
    );
  }
  lines.push('');
  lines.push(
    `WORST GAP ${worst.toFixed(1)} points. Two fronts differing in STYLE should not differ this ` +
      'much in DIFFICULTY — whoever raids the softer one is playing on easy and did not choose to.',
  );
  return lines.join('\n');
}

/**
 * How much of a raid the seed actually decides.
 *
 * `clearPct` everywhere else in this file is a COUNT of matchups tipped, not
 * a probability — which is only a problem if the seed changes nothing, and
 * for twelve releases nobody had asked. This table asks. It fights the same
 * matchup under many seeds and reports how often they all agree.
 *
 * Three measures, because they fail differently and only the first one is the
 * headline:
 *
 * - **decided** — matchups where every seed reached the same verdict. High is
 *   bad: it means the matchup, not the battle, is the outcome.
 * - **same men home** — matchups where the identical force came back every
 *   time. This is the harsher one: a raid can tip and still be the same
 *   battle either side of the line.
 * - **length** — spread in ticks. This one moves today, because the ±3-8%
 *   spawn jitter perturbs arrival times without perturbing who wins.
 */
function seedTable(combatVersion = COMBAT_CURRENT): string {
  const SEED_COUNT = 12;
  const seedFor = (i: number): number => ((i * 2654435761 + 977) & 0x7fffffff) >>> 0;

  const rows: string[] = [];
  let allMatchups = 0;
  let allDecided = 0;
  let allSameHome = 0;
  const allClear: number[] = [];
  const allTickSpread: number[] = [];

  for (const faction of FACTION_IDS) {
    const cat = raidCatalogFor(faction);
    const plan = RAID_PLANS[faction];
    let matchups = 0;
    let decided = 0;
    let sameHome = 0;
    const clears: number[] = [];
    const tickSpreads: number[] = [];

    for (const tier of RAID_TIERS) {
      for (const arch of ARCHETYPES) {
        const base = generateBase(tier, 0, baseKitFor(faction), arch.id, faction);
        const squads = (faction === 'nk' ? tunnelPlanFor('nk', base, tier) : plan).map(
          (sq, at) => ({ ...sq, slot: at }),
        );
        let won = 0;
        const home: number[] = [];
        const ticks: number[] = [];
        for (let i = 0; i < SEED_COUNT; i++) {
          const res = resolveRaid(
            { ...raidConfig(base, squads, seedFor(i), trainableFor(faction)), combatVersion },
            squads,
            tier,
            cat,
          );
          if (res.cleared) won++;
          home.push(res.squads.reduce((a, sq) => a + sq.returned, 0));
          ticks.push(res.ticks);
        }
        matchups++;
        if (won === 0 || won === SEED_COUNT) decided++;
        if (Math.max(...home) === Math.min(...home)) sameHome++;
        clears.push((won / SEED_COUNT) * 100);
        tickSpreads.push(Math.max(...ticks) - Math.min(...ticks));
      }
    }

    allMatchups += matchups;
    allDecided += decided;
    allSameHome += sameHome;
    allClear.push(...clears);
    allTickSpread.push(...tickSpreads);

    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    const tickMean = tickSpreads.reduce((a, b) => a + b, 0) / tickSpreads.length;
    rows.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(String(matchups), 8)} | ` +
        `${pad(`${decided} (${((decided / matchups) * 100).toFixed(0)}%)`, 11)} | ` +
        `${pad(`${sameHome} (${((sameHome / matchups) * 100).toFixed(0)}%)`, 13)} | ` +
        `${pad(tickMean.toFixed(0), 6)} | ${pad(mean.toFixed(1), 5)}`,
    );
  }

  const mean = allClear.reduce((a, b) => a + b, 0) / allClear.length;
  const tickMean = allTickSpread.reduce((a, b) => a + b, 0) / allTickSpread.length;
  const lines = [
    `WHAT THE SEED DECIDES — the same matchup fought ${SEED_COUNT} times` +
      (combatVersion === COMBAT_NONE ? '' : ` (${combatModelFor(combatVersion).label})`),
    'FORCE   | MATCHUPS | DECIDED     | SAME MEN HOME | LENGTH | CLEAR',
    '--------+----------+-------------+---------------+--------+------',
    ...rows,
    '--------+----------+-------------+---------------+--------+------',
    `${pad('ALL', 7)} | ${pad(String(allMatchups), 8)} | ` +
      `${pad(`${allDecided} (${((allDecided / allMatchups) * 100).toFixed(0)}%)`, 11)} | ` +
      `${pad(`${allSameHome} (${((allSameHome / allMatchups) * 100).toFixed(0)}%)`, 13)} | ` +
      `${pad(tickMean.toFixed(0), 6)} | ${pad(mean.toFixed(1), 5)}`,
    '',
    'DECIDED is the headline and high is bad: those are matchups where every',
    'seed agreed, so the pairing is the result and the battle is a formality.',
    'SAME MEN HOME is harsher still — the identical force walked back every time.',
    ...(combatVersion === COMBAT_NONE
      ? [
          'LENGTH is the only thing that moves without a combat model: the spawn',
          'jitter changes when units arrive without changing who wins, which is',
          'why nothing ever looked wrong from the outside.',
        ]
      : [
          'Against v0 — 86% decided, 54% bringing the same men home — this is what',
          'the model bought. LENGTH widening alongside is the same battles being',
          'fought to different lengths rather than replayed.',
        ]),
  ];
  return lines.join('\n');
}

/**
 * Is the shipped reference plan anywhere near the best one available?
 *
 * `--parity` reads every faction "at its own best line", and those lines are
 * hand-written. `--plans` says a plan is worth up to 13.7 points against a
 * parity spread of 25.6 — so more than half of what the faction table measures
 * could be the PLAN rather than the KIT. The plans also predate the combat
 * rolls (v1.23) and the objective layer (v1.24), which is two changes to the
 * rules they were written under.
 *
 * This does not look for the optimum. It asks the question that actually
 * matters before any faction row is read as a verdict on a kit: **is the
 * shipped plan materially worse than what a search turns up?** If a sample of
 * the space cannot beat it, the reference is fine and parity can be read as
 * it stands.
 *
 * Sampled rather than exhaustive, and it says so. There are 472-2621
 * compositions per faction inside the manpower band at four unit kinds, and
 * screening all of them against three doctrines is half an hour of sim. The
 * sample is drawn from a fixed seed, so this is repeatable rather than a
 * one-off.
 */
function deriveTable(sampleSize = 200, air = false): string {
  const SCREEN_TIERS = [3];
  const SCREEN_ARCH: ArchetypeId[] = ['compound', 'keep', 'star', 'corridor'];
  // Deepened in v1.41 alongside the four-kind cap. A screen is a RANKING over
  // hundreds of candidates, and eight binary outcomes per candidate carries a
  // standard error near 17 points — enough that a top-8 cut is substantially
  // a draw. The space doubled at the same time, so the screen had to widen or
  // the search would report noise with more confidence than before.
  const SCREEN_SEEDS = 3;
  /**
   * Finalists deep-scored PER kind-count bucket rather than globally.
   *
   * A global top-N is dominated by whichever bucket happens to screen highest,
   * so the buckets that lose get no finalist run at all and their row would be
   * a screen score masquerading as a measurement.
   *
   * Ten rather than six, because six was measurably not enough. Raising the
   * sample from 150 to 260 — a strict SUPERSET of the same seeded stream —
   * moved the USA's three-kind winner from 75.0 down to 65.8. More candidates
   * cannot make the true best worse, so the only explanation is that the
   * larger set screened some worse candidates above the real winner and evicted
   * it before it was ever deep-scored. A screen is a noisy ranker; the cut
   * taken from it has to be loose enough to survive that.
   */
  const PER_KIND = 10;
  const seedFor = (i: number): number => ((i * 2654435761 + 977) & 0x7fffffff) >>> 0;

  /**
   * Every multiset of units inside the manpower band, at most FOUR kinds.
   *
   * Three until v1.41, and the cap was load-bearing in a way nobody noticed:
   * the kill chain has four stages, each wanting a different unit, so a
   * three-kind search is structurally incapable of expressing the force the
   * model was built to reward. It would have reported "nothing beat the
   * reference" and the reason would have been the search, not the rosters.
   *
   * Four rather than unlimited because four is the number of stages, and
   * because the marginal space past it is small — USA 757 compositions at four
   * kinds against 794 unlimited, China 6216 against 8653. What it does cost is
   * coverage: the space roughly doubles, so a sample of the same size sees
   * proportionally less of it.
   *
   * In air mode the pool is the whole roster rather than the airfield alone:
   * the shipped air plans are two squads of rotors and a ground tail, and a
   * search that could only fly would be answering a different question than
   * the one the reference asks. What makes a plan an AIR plan is that it must
   * contain something flown, which is filtered below.
   */
  /** One kind per stage of the kill chain. See the note below. */
  const MAX_KINDS = 4;

  const compositions = (faction: FactionId): Record<string, number>[] => {
    const airKinds = new Set(
      trainableFor(faction)
        .filter((t) => t.facility === 'airfield')
        .map((t) => t.kind),
    );
    const pool = trainableFor(faction)
      .filter((t) => air || t.facility !== 'airfield')
      .map((t) => ({ kind: t.kind, manpower: t.manpower }));
    const out: Record<string, number>[] = [];
    const walk = (at: number, left: number, kinds: number, acc: Record<string, number>): void => {
      if (at === pool.length) {
        if (27 - left < 24 || kinds === 0) return;
        if (air && !Object.keys(acc).some((k) => airKinds.has(k))) return;
        out.push({ ...acc });
        return;
      }
      const meta = pool[at]!;
      for (let n = 0; n * meta.manpower <= left; n++) {
        if (n > 0 && kinds + 1 > MAX_KINDS) break;
        if (n > 0) acc[meta.kind] = n;
        walk(at + 1, left - n * meta.manpower, kinds + (n > 0 ? 1 : 0), acc);
        if (n > 0) delete acc[meta.kind];
      }
    };
    walk(0, 27, 0, {});
    return out;
  };

  const spread = (units: Record<string, number>, doctrine: Doctrine): SquadPlan[] => {
    const sectors: SectorId[] = ['W1', 'N1', 'S1'];
    const squads: SquadPlan[] = sectors.map((sector, slot) => ({ units: {}, sector, doctrine, slot }));
    let at = 0;
    for (const [kind, n] of Object.entries(units)) {
      for (let i = 0; i < n; i++) {
        const sq = squads[at % 3]!;
        sq.units[kind] = (sq.units[kind] ?? 0) + 1;
        at++;
      }
    }
    return squads.filter((sq) => Object.keys(sq.units).length > 0);
  };

  /**
   * Clear rate on TAKE THE POST, which is what the parity table reads.
   *
   * `from` offsets the seed stream. Selecting a winner and then scoring it on
   * the battles it was selected on reports the winner's curse as if it were a
   * gain, so validation draws from a block this search has never touched.
   */
  const score = (
    faction: FactionId,
    squads: SquadPlan[],
    tiers: number[],
    archetypes: ArchetypeId[],
    seeds: number,
    from = 0,
  ): number => {
    const cat = raidCatalogFor(faction);
    let cleared = 0;
    let runs = 0;
    for (const tier of tiers) {
      for (const arch of archetypes) {
        const base = generateBase(tier, 0, baseKitFor(faction), arch, faction);
        for (let i = 0; i < seeds; i++) {
          const config = raidConfig(base, squads, seedFor(from + i), trainableFor(faction));
          if (resolveRaid(config, squads, tier, cat).cleared) cleared++;
          runs++;
        }
      }
    }
    return runs > 0 ? (cleared / runs) * 100 : 0;
  };
  /** Seeds 0-99 select; 1000+ validate. Disjoint by construction. */
  const HELD_OUT = 1000;

  const asUnits = (plan: SquadPlan[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const sq of plan) for (const [k, n] of Object.entries(sq.units)) out[k] = (out[k] ?? 0) + n;
    return out;
  };
  const describe = (units: Record<string, number>): string =>
    Object.entries(units)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, n]) => `${n}x${k}`)
      .join(' ');

  const lines = [
    `IS THE ${air ? 'AIR ' : ''}REFERENCE PLAN ANY GOOD? — ${sampleSize} sampled compositions ` +
      `x 3 doctrines, up to ${MAX_KINDS} unit kinds`,
    'FACTION | REF MP | REFERENCE | IN-SAMPL | HELD OUT | CURSE | GAIN | THE PLAN THAT BEAT IT',
    '--------+--------+-----------+----------+----------+-------+------+----------------------',
  ];
  const FULL_ARCH = ARCHETYPES.map((a) => a.id);
  let worst = 0;
  const winners: { faction: FactionId; squads: SquadPlan[] }[] = [];
  const ladder: {
    faction: FactionId;
    byKinds: Map<number, { at: number; held: number; squads: SquadPlan[]; label: string }>;
  }[] = [];
  const references: Partial<Record<FactionId, number>> = {};

  for (const faction of FACTION_IDS) {
    const all = compositions(faction);
    // A fixed stream per faction, so the sample is the same every run.
    const rng = createRng(((FACTION_IDS.indexOf(faction) + 1) * 2654435761) >>> 0);

    // Stratified by headcount, not uniform over compositions. A manpower band
    // admits combinatorially more ways to spend it on cheap units than on
    // expensive ones, so a uniform sample is nearly all large forces — and
    // large is the WRONG end: clear rate falls with headcount for every faction
    // holding a real heavy (China 100% at 3-5 bodies against 25.6% at 18+).
    // Uniform sampling was therefore under-searching the region that wins.
    const byCount = new Map<number, Record<string, number>[]>();
    for (const units of all) {
      const bodies = Object.values(units).reduce((a, b) => a + b, 0);
      const at = byCount.get(bodies);
      if (at) at.push(units);
      else byCount.set(bodies, [units]);
    }
    const strata = [...byCount.keys()].sort((a, b) => a - b).map((k) => byCount.get(k)!);
    const picked: Record<string, number>[] = [];
    const taken = strata.map(() => new Set<number>());
    let stratum = 0;
    let exhausted = 0;
    while (picked.length < Math.min(sampleSize, all.length) && exhausted < strata.length) {
      const pool = strata[stratum % strata.length]!;
      const seen = taken[stratum % strata.length]!;
      if (seen.size >= pool.length) {
        exhausted++;
      } else {
        exhausted = 0;
        let at = Math.floor(rng() * pool.length);
        while (seen.has(at)) at = (at + 1) % pool.length;
        seen.add(at);
        picked.push(pool[at]!);
      }
      stratum++;
    }

    // Screen wide and shallow, then run the finalists properly — a single
    // shallow score is too noisy to rank on and a deep score of every
    // candidate is half an hour of sim.
    const screened: { units: Record<string, number>; doctrine: Doctrine; at: number }[] = [];
    for (const units of picked) {
      for (const doctrine of DOCTRINE_IDS) {
        const squads = spread(units, doctrine);
        if (squads.length === 0) continue;
        screened.push({
          units,
          doctrine,
          at: score(faction, squads, SCREEN_TIERS, SCREEN_ARCH, SCREEN_SEEDS),
        });
      }
    }
    screened.sort((a, b) => b.at - a.at);

    // Rank the finalists on the selection seeds — but SEPARATELY at each number
    // of unit kinds, which is the question M22 actually has to answer.
    //
    // A single global winner cannot say what combined arms costs, and under the
    // kill chain that is the whole argument: the model was built so that four
    // stages want four different units, and if the optimum is still one kind
    // then either the model failed or the price of mixing is worth paying and
    // somebody has to see the number before deciding. Ranking per bucket makes
    // the trade visible instead of hiding it behind an argmax.
    const byKinds = new Map<number, { at: number; held: number; squads: SquadPlan[]; label: string }>();
    const buckets = new Map<number, typeof screened>();
    for (const candidate of screened) {
      const k = Object.keys(candidate.units).length;
      const at = buckets.get(k);
      if (at) at.push(candidate);
      else buckets.set(k, [candidate]);
    }
    for (const [kinds, pool] of buckets) {
      let top: { at: number; squads: SquadPlan[]; label: string } | null = null;
      for (const candidate of pool.slice(0, PER_KIND)) {
        const squads = spread(candidate.units, candidate.doctrine);
        const at = score(faction, squads, RAID_TIERS, FULL_ARCH, 3);
        if (top === null || at > top.at) {
          top = { at, squads, label: `${describe(candidate.units)} ${candidate.doctrine.toUpperCase()}` };
        }
      }
      if (top !== null) {
        byKinds.set(kinds, { ...top, held: score(faction, top.squads, RAID_TIERS, FULL_ARCH, 3, HELD_OUT) });
      }
    }
    ladder.push({ faction, byKinds });

    // The global winner is whichever bucket won, scored on held-out battles.
    let best: { at: number; squads: SquadPlan[]; label: string } | null = null;
    let held = 0;
    for (const entry of byKinds.values()) {
      if (best === null || entry.at > best.at) {
        best = { at: entry.at, squads: entry.squads, label: entry.label };
        held = entry.held;
      }
    }
    const reference = air ? AIR_RAID_PLANS[faction] : RAID_PLANS[faction];
    const refScore = score(faction, reference, RAID_TIERS, FULL_ARCH, 3, HELD_OUT);
    if (best === null) held = refScore;
    const gain = held - refScore;
    const curse = best === null ? 0 : best.at - held;
    worst = Math.max(worst, gain);
    if (best !== null && gain > 0) winners.push({ faction, squads: best.squads });
    references[faction] = refScore;
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(planManpower(faction), 6)} | ${pad(refScore.toFixed(1), 9)} | ` +
        `${pad(best === null ? '—' : best.at.toFixed(1), 8)} | ${pad(held.toFixed(1), 8)} | ` +
        `${pad(curse.toFixed(1), 5)} | ${pad((gain >= 0 ? '+' : '') + gain.toFixed(1), 4)} | ` +
        `${best === null ? 'nothing beat it' : best.label}`,
    );
  }

  // ---- what combined arms costs -----------------------------------------------------
  lines.push('');
  lines.push(
    `WHAT COMBINED ARMS COSTS — best HELD-OUT plan at each number of unit kinds`,
  );
  lines.push('FACTION | REF  | 1 KIND | 2 KINDS | 3 KINDS | 4 KINDS | MIXING COSTS');
  lines.push('--------+------+--------+---------+---------+---------+-------------');
  let dearest = 0;
  for (const { faction, byKinds } of ladder) {
    const cell = (k: number): string => {
      const at = byKinds.get(k);
      return at === undefined ? '—' : at.held.toFixed(1);
    };
    const held = (k: number): number | null => byKinds.get(k)?.held ?? null;
    // What you give up to field a plan that is actually a plan: the best
    // concentrated force against the best one with three kinds or more.
    const concentrated = Math.max(held(1) ?? -1, held(2) ?? -1);
    const mixed = Math.max(held(3) ?? -1, held(4) ?? -1);
    const cost = concentrated < 0 || mixed < 0 ? null : concentrated - mixed;
    if (cost !== null) dearest = Math.max(dearest, cost);
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad((references[faction] ?? 0).toFixed(1), 4)} | ` +
        `${pad(cell(1), 6)} | ${pad(cell(2), 7)} | ${pad(cell(3), 7)} | ${pad(cell(4), 7)} | ` +
        `${cost === null ? 'n/a' : (cost >= 0 ? '-' : '+') + Math.abs(cost).toFixed(1) + ' points'}`,
    );
  }
  lines.push('');
  lines.push(
    `THE DEAREST MIX COSTS ${dearest.toFixed(1)} POINTS. This is the number M22 Phase 3 turns ` +
      'on. The milestone\'s bar asks every roster slot to deliver something measurable, and a ' +
      'reference plan of one kind cannot answer that at all — `--carry` reads n/a, because ' +
      'there is nothing to spend the manpower on. If mixing is cheap, the references should ' +
      'mix and the bar is met by choosing to. If it is dear, the bar is a claim about the ' +
      'CONTENT and no plan can satisfy it.',
  );
  lines.push('');
  lines.push('EVERY BUCKET WINNER, one line each — transcribe whichever the decision picks:');
  for (const { faction, byKinds } of ladder) {
    for (const kinds of [...byKinds.keys()].sort()) {
      const at = byKinds.get(kinds)!;
      lines.push(`  ${pad(faction, 7)} ${kinds} kind(s)  ${pad(at.held.toFixed(1), 5)}  ${at.label}`);
    }
  }

  if (winners.length > 0) {
    lines.push('');
    lines.push('THE DERIVED PLANS AS SOURCE — the sector split follows roster order, so this');
    lines.push('is emitted rather than transcribed:');
    for (const { faction, squads } of winners) {
      lines.push(`  ${faction}: [`);
      for (const sq of squads) {
        const units = Object.entries(sq.units)
          .map(([k, n]) => `${k}: ${n}`)
          .join(', ');
        lines.push(`    { units: { ${units} }, sector: '${sq.sector}', doctrine: '${sq.doctrine}' },`);
      }
      lines.push('  ],');
    }
  }
  lines.push('');
  lines.push('WHAT GOT BEATEN — the shipped reference, flattened to a composition');
  for (const faction of FACTION_IDS) {
    lines.push(
      `  ${pad(faction.toUpperCase(), 7)} ${describe(asUnits(air ? AIR_RAID_PLANS[faction] : RAID_PLANS[faction]))}`,
    );
  }
  lines.push('');
  lines.push(
    `WORST HELD-OUT GAIN ${worst.toFixed(1)} POINTS. The parity spread is what this has to be ` +
      'read against: a gain of that size means a faction row is measuring the PLAN and not ' +
      'the kit, and no amount of tuning content will fix a row that is really a stale plan. ' +
      'A gain near zero means the references are current and parity can be read as it stands.',
  );
  lines.push(
    'CURSE is how much of IN-SAMPLE did not survive fresh seeds. GAIN is HELD OUT minus ' +
      'REFERENCE, both measured on battles the search never saw, and is the only column ' +
      'worth acting on. REF MP is there because a gain bought with more manpower is not a ' +
      'better plan; the search is capped at the 24-27 band the references sit in.',
  );
  return lines.join('\n');
}

/**
 * Would an objective layer select for different forces, or is it decoration?
 *
 * This is the measurement that had a veto. A raid has always had exactly one
 * ending that counted, and everything the player keeps read that one boolean —
 * so the planner was decoration around *did you bring the tank*. Adding named
 * objectives only helps if a force built for one is genuinely bad at another.
 * If the same column tops every objective, the layer is theatre and the
 * milestone stops.
 *
 * Three forces per faction at the same 27 manpower — everything the motorpool
 * will sell, everything the barracks will sell, and the reference plan — each
 * run under all three doctrines against the same ladder.
 */
function objectiveTable(share = OBJECTIVE_SHARE): string {
  const SEEDS = 3;
  const TIERS = [2, 3, 4];
  const seedFor = (i: number): number => ((i * 2654435761 + 977) & 0x7fffffff) >>> 0;
  const quota = (standing: number): number =>
    Math.min(standing, Math.max(OBJECTIVE_FLOOR, Math.round(standing * share)));

  /** Fill to 27 manpower from one facility's units, dearest first. */
  const build = (faction: FactionId, facility: string): Record<string, number> => {
    const pool = trainableFor(faction)
      .filter((t) => t.facility === facility)
      .sort((a, b) => b.manpower - a.manpower);
    const out: Record<string, number> = {};
    let left = 27;
    for (const meta of pool) {
      while (meta.manpower <= left) {
        out[meta.kind] = (out[meta.kind] ?? 0) + 1;
        left -= meta.manpower;
      }
    }
    return out;
  };
  const flatten = (plan: SquadPlan[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const sq of plan) {
      for (const [kind, n] of Object.entries(sq.units)) out[kind] = (out[kind] ?? 0) + n;
    }
    return out;
  };
  /** One force, three squads on fixed sectors, all under one doctrine. */
  const spread = (units: Record<string, number>, doctrine: Doctrine): SquadPlan[] => {
    const sectors: SectorId[] = ['W1', 'N1', 'S1'];
    const squads: SquadPlan[] = sectors.map((sector, slot) => ({
      units: {},
      sector,
      doctrine,
      slot,
    }));
    let at = 0;
    for (const [kind, n] of Object.entries(units)) {
      for (let i = 0; i < n; i++) {
        const sq = squads[at % 3]!;
        sq.units[kind] = (sq.units[kind] ?? 0) + 1;
        at++;
      }
    }
    return squads.filter((sq) => Object.keys(sq.units).length > 0);
  };

  const lines = [
    `WHAT A RAID COULD COME FOR — quota is ${Math.round(share * 100)}% of what the base holds`,
    'FORCE  | DOCTRINE | TAKE POST | SPIKE GUNS | RAID STORES',
    '-------+----------+-----------+------------+------------',
  ];
  let distinctWinners = 0;
  let objectives = 0;

  for (const faction of FACTION_IDS) {
    const cat = raidCatalogFor(faction);
    const forces: [string, Record<string, number>][] = [
      ['ARMOUR', build(faction, 'motorpool')],
      ['FOOT', build(faction, 'barracks')],
      ['MIXED', flatten(RAID_PLANS[faction])],
    ];
    lines.push(`${faction.toUpperCase()}`);
    const best: Record<string, { at: string; pct: number }> = {};
    for (const [name, units] of forces) {
      for (const doctrine of DOCTRINE_IDS) {
        const squads = spread(units, doctrine);
        if (squads.length === 0) continue;
        let runs = 0;
        const hit: Record<string, number> = { post: 0, guns: 0, stores: 0 };
        for (const tier of TIERS) {
          for (const arch of ARCHETYPES) {
            const base = generateBase(tier, 0, baseKitFor(faction), arch.id, faction);
            for (let i = 0; i < SEEDS; i++) {
              const config = raidConfig(base, squads, seedFor(i), trainableFor(faction));
              const engine = new Engine(config, cat);
              const startGuns = engine.countStanding('defense');
              const startStores = engine.countStanding('economy');
              const res = resolveRaid(config, squads, tier, cat);
              runs++;
              if (res.cleared) hit['post']!++;
              const killed = (cls: 'defense' | 'economy'): number => {
                let n = 0;
                for (const [kind, count] of Object.entries(res.destroyed)) {
                  const profile = cat.structures[kind];
                  if (!profile || !profile.targetable || kind === 'cc') continue;
                  const isGun = profile.weapon !== undefined;
                  if (cls === 'defense' ? isGun : !isGun) n += count;
                }
                return n;
              };
              if (startGuns >= OBJECTIVE_FLOOR && killed('defense') >= quota(startGuns)) hit['guns']!++;
              if (startStores >= OBJECTIVE_FLOOR && killed('economy') >= quota(startStores)) hit['stores']!++;
            }
          }
        }
        const pct = (id: string): number => (runs > 0 ? (hit[id]! / runs) * 100 : 0);
        for (const id of OBJECTIVE_IDS) {
          const at = `${name}/${doctrine.toUpperCase()}`;
          if (!best[id] || pct(id) > best[id]!.pct) best[id] = { at, pct: pct(id) };
        }
        lines.push(
          `${pad(name, 6)} | ${pad(doctrine.toUpperCase(), 8)} | ${pad(pct('post').toFixed(1), 9)} | ` +
            `${pad(pct('guns').toFixed(1), 10)} | ${pad(pct('stores').toFixed(1), 11)}`,
        );
      }
    }
    const winners = new Set(OBJECTIVE_IDS.map((id) => best[id]?.at ?? ''));
    distinctWinners += winners.size;
    objectives += OBJECTIVE_IDS.length;
    lines.push(
      `       best: ${OBJECTIVE_IDS.map((id) => `${OBJECTIVES[id].short} ${best[id]?.at ?? '—'}`).join('  ·  ')}`,
    );
    lines.push('-------+----------+-----------+------------+------------');
  }

  lines.push('');
  lines.push(
    `DISTINCT WINNERS ${distinctWinners} of ${objectives}. One force topping every column ` +
      'would mean the objective is a label on the same raid; a different force per column ' +
      'is the whole argument for letting a raid declare what it came for.',
  );
  return lines.join('\n');
}

/**
 * Price every candidate variance model on the one measure that matters.
 *
 * Each model preserves its mean by construction, so a shift in CLEAR is a
 * variance effect and not a buff — which is exactly the confound that would
 * otherwise make these rows unreadable. What is being bought is the fall in
 * DECIDED; what is being watched for is CLEAR wandering, which would mean the
 * mean-preservation is not holding in practice whatever the algebra says.
 */
function sweepTable(): string {
  const SEED_COUNT = 8;
  const seedFor = (i: number): number => ((i * 2654435761 + 977) & 0x7fffffff) >>> 0;

  const measure = (version: number): { decided: number; home: number; clear: number } => {
    let matchups = 0;
    let decided = 0;
    let sameHome = 0;
    let clearSum = 0;
    for (const faction of FACTION_IDS) {
      const cat = raidCatalogFor(faction);
      for (const tier of RAID_TIERS) {
        for (const arch of ARCHETYPES) {
          const base = generateBase(tier, 0, baseKitFor(faction), arch.id, faction);
          const squads = (
            faction === 'nk' ? tunnelPlanFor('nk', base, tier) : RAID_PLANS[faction]
          ).map((sq, at) => ({ ...sq, slot: at }));
          let won = 0;
          const home: number[] = [];
          for (let i = 0; i < SEED_COUNT; i++) {
            const res = resolveRaid(
              {
                ...raidConfig(base, squads, seedFor(i), trainableFor(faction)),
                combatVersion: version,
              },
              squads,
              tier,
              cat,
            );
            if (res.cleared) won++;
            home.push(res.squads.reduce((a, sq) => a + sq.returned, 0));
          }
          matchups++;
          if (won === 0 || won === SEED_COUNT) decided++;
          if (Math.max(...home) === Math.min(...home)) sameHome++;
          clearSum += (won / SEED_COUNT) * 100;
        }
      }
    }
    return {
      decided: (decided / matchups) * 100,
      home: (sameHome / matchups) * 100,
      clear: clearSum / matchups,
    };
  };

  const base = measure(COMBAT_NONE);
  const lines = [
    `PRICING THE ROLL — every candidate on the same ${SEED_COUNT} seeds`,
    'VER | MODEL                | DECIDED | SAME HOME | CLEAR | vs FLAT',
    '----+----------------------+---------+-----------+-------+--------',
    `${pad('0', 3)} | ${pad('no rolls (today)', 20)} | ${pad(base.decided.toFixed(0) + '%', 7)} | ` +
      `${pad(base.home.toFixed(0) + '%', 9)} | ${pad(base.clear.toFixed(1), 5)} | ${pad('—', 6)}`,
  ];
  const only = process.argv
    .slice(process.argv.indexOf('--sweep') + 1)
    .filter((a) => /^\d+$/.test(a))
    .map(Number);
  const versions = (
    only.length > 0
      ? only
      : Object.keys(COMBAT_MODELS)
          .map(Number)
          .filter((v) => v !== COMBAT_NONE)
  ).sort((a, b) => a - b);
  for (const version of versions) {
    const m = measure(version);
    const delta = m.clear - base.clear;
    lines.push(
      `${pad(String(version), 3)} | ${pad(combatModelFor(version).label, 20)} | ` +
        `${pad(m.decided.toFixed(0) + '%', 7)} | ${pad(m.home.toFixed(0) + '%', 9)} | ` +
        `${pad(m.clear.toFixed(1), 5)} | ${pad((delta >= 0 ? '+' : '') + delta.toFixed(1), 6)}`,
    );
  }
  lines.push('');
  lines.push(
    'DECIDED falling is what is being bought. CLEAR drifting is the warning ' +
      'sign: every model preserves its mean by construction, so a large vs FLAT ' +
      'means the variance is interacting with a threshold rather than sitting ' +
      'symmetrically around it — which is a difficulty change and has to be ' +
      'priced as one.',
  );
  return lines.join('\n');
}

/**
 * The per-faction deal ordering, printed as the literal `bases.ts` holds.
 *
 * Exists because the numbers below have to live in content and hand-copying
 * measurements into content is how this project has put wrong numbers in
 * comments before. `npm run balance -- --pressure` prints the table; paste it.
 *
 * Each shape is averaged over the rungs where it can actually be DEALT
 * (`tier >= fromTier`). Folding in the rest flatters the shapes that unlock
 * late — a bunker forced onto T1 clears 100%, but nobody is ever offered one
 * there, and including that rung moved it four places up the ranking.
 */
function pressureTable(): string {
  const lines = [
    'DEAL ORDER — hardest first, per faction, over the rungs each shape is dealt on',
    '',
  ];
  const literal: string[] = [];
  for (const faction of FACTION_IDS) {
    const scored = ARCHETYPES.map((arch) => {
      const rungs = RAID_TIERS.filter((t) => t >= arch.fromTier);
      const mean =
        rungs.length > 0
          ? rungs.reduce((a, t) => a + shapeClear(faction, t, arch.id), 0) / rungs.length
          : 100;
      return { id: arch.id, mean };
    }).sort((a, b) => a.mean - b.mean || a.id.localeCompare(b.id));
    lines.push(
      `${pad(faction.toUpperCase(), 7)} ${scored.map((s) => `${s.id} ${s.mean.toFixed(0)}`).join('  <  ')}`,
    );
    literal.push(`  ${faction}: [${scored.map((s) => `'${s.id}'`).join(', ')}],`);
  }
  // The no-faction fallback: mean RANK across the five, not mean clear rate.
  // A rate would let the USA's saturated rows (five shapes tied at 100%) drown
  // out the orderings of the factions that can actually tell the shapes apart.
  const ranks = new Map<string, number>();
  for (const row of literal) {
    const ids = [...row.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!);
    ids.forEach((id, at) => ranks.set(id, (ranks.get(id) ?? 0) + at));
  }
  const neutral = [...ranks.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  lines.push('');
  lines.push(`NEUTRAL (mean rank) ${neutral.map(([id, r]) => `${id} ${(r / 5 + 1).toFixed(1)}`).join('  <  ')}`);
  lines.push('');
  lines.push('Paste into `bases.ts`:');
  lines.push('');
  lines.push('const DEAL_ORDER: Record<string, ArchetypeId[]> = {');
  lines.push(...literal);
  lines.push('};');
  lines.push(`const DEAL_ORDER_NEUTRAL: ArchetypeId[] = [${neutral.map(([id]) => `'${id}'`).join(', ')}];`);
  return lines.join('\n');
}

function dealTable(): string {
  // Per (faction, shape, tier), measured once and read three ways below.
  const cell = new Map<string, number>();
  const key = (f: FactionId, id: ArchetypeId, t: number): string => `${f}|${id}|${t}`;
  for (const faction of FACTION_IDS) {
    for (const arch of ARCHETYPES) {
      for (const tier of RAID_TIERS) {
        cell.set(key(faction, arch.id, tier), shapeClear(faction, tier, arch.id));
      }
    }
  }
  const across = (id: ArchetypeId, tier: number): number =>
    FACTION_IDS.reduce((a, f) => a + cell.get(key(f, id, tier))!, 0) / FACTION_IDS.length;

  // ---- what a SHAPE costs, averaged over the five so it describes the shape --
  const lines = [
    'THE DEAL — the three targets a rung offers vs the eight it could offer',
    `SHAPE        | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN`,
    `-------------+${RAID_TIERS.map(() => '-------').join('+')}+-------`,
  ];
  const shapeMean = new Map<ArchetypeId, number>();
  for (const arch of ARCHETYPES) {
    const ts = RAID_TIERS.map((t) => across(arch.id, t));
    shapeMean.set(arch.id, ts.reduce((a, b) => a + b, 0) / ts.length);
  }
  for (const [id, mean] of [...shapeMean.entries()].sort((a, b) => a[1] - b[1])) {
    lines.push(
      `${id.padEnd(12)} | ${RAID_TIERS.map((t) => pad(across(id, t).toFixed(0), 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)}`,
    );
  }

  // ---- and what each faction is actually DEALT, against its OWN pool --------
  // Per faction, deliberately. v1.21 shipped a deal change whose all-faction
  // average looked right at every rung while the USA sat at 100% on all five,
  // and the row-per-faction below is the shape of table that would have caught
  // it before `--parity` did.
  lines.push('');
  lines.push('WHAT EACH FACTION IS DEALT — its three targets vs its own pool at that rung');
  lines.push(`FACTION | ${RAID_TIERS.map((t) => pad(`T${t}`, 11)).join(' | ')} |   MEAN GAP`);
  lines.push(`--------+${RAID_TIERS.map(() => '-------------').join('+')}+-----------`);
  for (const faction of FACTION_IDS) {
    const cells: string[] = [];
    let gapSum = 0;
    for (const tier of RAID_TIERS) {
      const dealt = Array.from(
        { length: TARGETS_PER_TIER },
        (_, v) => dealtShape(tier, v, faction),
      );
      const pool = ARCHETYPES.filter((a) => a.fromTier <= tier).map((a) => a.id);
      const at = (id: ArchetypeId): number => cell.get(key(faction, id, tier))!;
      const d = dealt.reduce((a, id) => a + at(id), 0) / dealt.length;
      const p = pool.reduce((a, id) => a + at(id), 0) / pool.length;
      gapSum += d - p;
      cells.push(pad(`${d.toFixed(0)}/${p.toFixed(0)} ${d - p >= 0 ? '+' : ''}${(d - p).toFixed(0)}`, 11));
    }
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${cells.join(' | ')} | ` +
        `${pad((gapSum / RAID_TIERS.length >= 0 ? '+' : '') + (gapSum / RAID_TIERS.length).toFixed(1), 10)}`,
    );
  }
  lines.push('');
  lines.push('  dealt/pool and the gap. A deal that tracks its pool is offering that faction');
  lines.push('  a fair read of the rung; a big negative gap is a rung of walls.');

  // ---- coverage: a shape nobody is ever dealt is a shape nobody has seen ----
  lines.push('');
  lines.push('SHAPE COVERAGE — the rungs each faction is dealt each shape on');
  lines.push(`SHAPE        | ${FACTION_IDS.map((f) => pad(f.toUpperCase(), 11)).join(' | ')}`);
  lines.push(`-------------+${FACTION_IDS.map(() => '-------------').join('+')}`);
  for (const arch of ARCHETYPES) {
    const cols = FACTION_IDS.map((faction) => {
      const on = RAID_TIERS.filter((tier) =>
        Array.from({ length: TARGETS_PER_TIER }, (_, v) => dealtShape(tier, v, faction)).includes(
          arch.id,
        ),
      );
      return pad(on.length > 0 ? on.map((t) => `T${t}`).join(',') : '— never —', 11);
    });
    lines.push(`${arch.id.padEnd(12)} | ${cols.join(' | ')}`);
  }
  const everDealt = new Set<string>();
  for (const faction of FACTION_IDS) {
    for (const tier of RAID_TIERS) {
      for (let v = 0; v < TARGETS_PER_TIER; v++) everDealt.add(dealtShape(tier, v, faction));
    }
  }
  lines.push('');
  lines.push(`  ${everDealt.size} of ${ARCHETYPES.length} shapes reach a player somewhere.`);

  // ---- the ladder itself ---------------------------------------------------
  const rungs = RAID_TIERS.map((tier) => {
    const pool = ARCHETYPES.filter((a) => a.fromTier <= tier).map((a) => a.id);
    return pool.reduce((a, id) => a + across(id, tier), 0) / pool.length;
  });
  lines.push('');
  lines.push(
    `THE LADDER, pool mean per rung: ${rungs.map((r, i) => `T${RAID_TIERS[i]} ${r.toFixed(0)}`).join('  ->  ')}`,
  );
  const steps = rungs.slice(1).map((r, i) => r - rungs[i]!);
  lines.push(
    `STEP SIZE: ${steps.map((s, i) => `T${RAID_TIERS[i]}->T${RAID_TIERS[i + 1]} ${s >= 0 ? '+' : ''}${s.toFixed(0)}`).join('  ')}` +
      ' — POOL mean, at a fixed reference force.',
  );
  lines.push(
    '  This is the whole pool, not the deal, and the force is a mature army: the early\n' +
      '  rungs saturate near 100 and no step between them can show. It is here to price\n' +
      "  the SHAPES, not to judge the ladder — `--rungs` does that, by asking how much\n" +
      '  force each rung demands rather than what one army does to all of them.',
  );
  return lines.join('\n');
}

/**
 * Faction parity (v1.21): every faction measured at its OWN best line.
 *
 * The trap this table exists to avoid: the plain RAID rows are not
 * like-for-like. They walk each faction's reference force up to the wire the
 * same way, which flatters the factions whose plan IS to walk up to the wire
 * and buries the ones whose whole design is to do something else. NK reads
 * 29.4 walking in and 52.2 through a tunnel — a 22.8-point swing — and its
 * own GDD entry says "the maze doesn't matter if you're under it". Reading
 * the 29.4 as NK's strength is reading a mistake, not a faction.
 *
 * So each row here uses the signature the faction is built around: a tunnel
 * for the KPA, and the plain approach for everyone whose plan that is. The
 * spread between these rows is the number parity work has to close.
 */
function parityTable(): string {
  const lines = [
    'PARITY — every faction at its own best line, same manpower, same ladder',
    `FACTION     | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST% | LINE`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+----------+------`,
  ];

  const results: { faction: FactionId; mean: number }[] = [];
  for (const faction of FACTION_IDS) {
    // The KPA's signature is the tunnel; everyone else's plan is the approach.
    const tunneled = faction === 'nk';
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        const squads = (
          tunneled ? tunnelPlanFor(faction, base, tier) : RAID_PLANS[faction]
        ).map((squad, at) => ({ ...squad, slot: at }));
        for (let i = 0; i < SEEDS; i++) {
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          const flow = manpowerFlow(faction, res);
          home += flow.home;
          sent += flow.sent;
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    results.push({ faction, mean });
    lines.push(
      `${pad(flavorFor(faction).faction.slice(0, 11), 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)} | ` +
        `${tunneled ? 'TUNNEL' : 'GROUND'}`,
    );
  }

  const best = Math.max(...results.map((r) => r.mean));
  const worst = Math.min(...results.map((r) => r.mean));
  lines.push('');
  lines.push(
    `SPREAD — ${(best - worst).toFixed(1)} points between ` +
      `${results.find((r) => r.mean === best)!.faction.toUpperCase()} and ` +
      `${results.find((r) => r.mean === worst)!.faction.toUpperCase()}. ` +
      'Five kits differing in STYLE (GDD §4) should not differ this much in ODDS.',
  );
  return lines.join('\n');
}

function delayTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const PATTERNS: { name: string; delays: number[] }[] = [
    { name: 'ALL AT ONCE', delays: [0, 0, 0] },
    { name: 'DEFAULT', delays: [0, 6, 12] },
    { name: 'WIDE', delays: [0, 20, 45] },
    { name: 'SEQUENTIAL', delays: [0, 30, 60] },
    { name: 'LEAD LAST', delays: [12, 6, 0] },
  ];
  const lines = [
    `LAUNCH DELAYS — ${flavor.faction} strike force (${planManpower(faction)} MP), men returned% by tier`,
    `PATTERN     | T+       | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | CLEAR% | SECS | SLOT 1/2/3`,
    `------------+----------+${RAID_TIERS.map(() => '------').join('+')}+-------+--------+------+-----------`,
  ];
  for (const pattern of PATTERNS) {
    const back: number[] = [];
    let cleared = 0;
    let runs = 0;
    let ticks = 0;
    const bySlot = [0, 0, 0].map(() => ({ home: 0, sent: 0 }));
    for (const tier of RAID_TIERS) {
      let home = 0;
      let sent = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({
            ...squad,
            slot: at,
            delay: pattern.delays[at] ?? 0,
          }));
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
            const seat = bySlot[ret.slot];
            if (seat) {
              seat.home += ret.returned;
              seat.sent += ret.deployed;
            }
          }
          if (res.cleared) cleared++;
          ticks += res.ticks;
          runs++;
        }
      }
      back.push(Math.round((home / sent) * 100));
    }
    const mean = back.reduce((a, b) => a + b, 0) / back.length;
    lines.push(
      `${pattern.name.padEnd(11)} | ${pad(pattern.delays.join('/'), 8)} | ${back.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(Math.round((cleared / runs) * 100), 6)} | ` +
        `${pad((ticks / runs / 20).toFixed(0), 4)} | ` +
        bySlot.map((seat) => pad(Math.round((seat.home / seat.sent) * 100), 3)).join('/'),
    );
  }
  return lines.join('\n');
}

function veterancyTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  // The reference force, unchanged. An earlier pass tried thinning it to force
  // the clear rate to the margin; that read as "veterancy does nothing" for
  // China and NK, because a swarm cut in half dies at every rank and a
  // multiplier cannot save a unit that was never going to survive the volley.
  // At full strength the signal is monotone for all five.
  const plan = (vet: number): SquadPlan[] =>
    RAID_PLANS[faction].map((squad, i) => ({ ...squad, slot: i, vet }));
  const lines = [
    `VETERANCY — ${flavor.faction} strike force (${planManpower(faction)} MP), men returned% by tier`,
    `RANK    |  ×   | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | CLEAR%`,
    `--------+------+${RAID_TIERS.map(() => '------').join('+')}+-------+-------`,
  ];
  for (const rank of RANKS) {
    const back: number[] = [];
    let cleared = 0;
    let runs = 0;
    for (const tier of RAID_TIERS) {
      let home = 0;
      let sent = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
        for (let i = 0; i < SEEDS; i++) {
          const squads = plan(rank.mult);
          const config = raidConfig(
            base,
            squads,
            seedOf(tier, variant, i),
            trainableFor(faction),
          );
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
          if (res.cleared) cleared++;
          runs++;
        }
      }
      back.push(Math.round((home / sent) * 100));
    }
    const mean = back.reduce((a, b) => a + b, 0) / back.length;
    lines.push(
      `${rank.name.padEnd(7)} | ${pad(rank.mult.toFixed(2), 4)} | ${back.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(Math.round((cleared / runs) * 100), 6)}`,
    );
  }
  return lines.join('\n');
}

function main(): void {
  const started = Date.now();
  const sections: string[] = [];
  if (process.argv.includes('--probes')) FIGHT = 'probe';
  // Tuning the rotation means running one table twenty times, not the whole
  // harness twenty times: `npm run balance -- --conditions` is that loop.
  if (process.argv.includes('--shapes')) {
    console.log(archetypeTable('usa'));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--graph')) {
    const picked = FACTION_IDS.filter((f) => process.argv.includes(f));
    for (const faction of picked.length > 0 ? picked : FACTION_IDS) console.log(`${graphTable(faction)}\n`);
    console.log(`${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--conditions')) {
    console.log(conditionTable('usa'));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--terrain')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(terrainTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--derive') || process.argv.includes('--derive-air')) {
    const air = process.argv.includes('--derive-air');
    const flag = air ? '--derive-air' : '--derive';
    const arg = process.argv[process.argv.indexOf(flag) + 1];
    console.log(deriveTable(/^\d+$/.test(arg ?? '') ? Number(arg) : 200, air));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--objective')) {
    const arg = process.argv[process.argv.indexOf('--objective') + 1];
    console.log(objectiveTable(/^0?\.\d+$/.test(arg ?? '') ? Number(arg) : OBJECTIVE_SHARE));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--sweep')) {
    console.log(sweepTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--seed')) {
    const arg = process.argv[process.argv.indexOf('--seed') + 1];
    console.log(seedTable(/^\d+$/.test(arg ?? '') ? Number(arg) : COMBAT_CURRENT));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--chain')) {
    const arg = process.argv[process.argv.indexOf('--chain') + 1];
    console.log(chainTable(/^\d+$/.test(arg ?? '') ? Number(arg) : CHAIN_NONE));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--siege')) {
    const arg = process.argv[process.argv.indexOf('--siege') + 1];
    const seeds = /^\d+$/.test(arg ?? '') ? Number(arg) : 8;
    console.log(siegeTable([2, 3, 4], seeds));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--slope')) {
    // Every chain constant leaves CONTESTED at 12%, so the step is not the
    // chain's. Two explanations remain, and this separates them: dial the
    // attack's strength CONTINUOUSLY through the place where a row flips.
    //
    // Smooth → the ladder's integer levels are simply a bigger step than the
    // battle's variance, and the fix is a finer ladder. A jump → the battle
    // is bimodal for a given matchup and no curve-shaping helps; the fix is
    // variance, which is M13's territory, not content's.
    const SCALES = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.4];
    console.log('SLOPE — hold% against a CONTINUOUS attacker-HP dial, 20 seeds');
    console.log(
      'FACTION  | BASE        | LVL | ' + SCALES.map((x) => pad(`${x}x`, 4)).join(' | '),
    );
    console.log('---------+-------------+-----+' + SCALES.map(() => '------').join('+'));
    for (const faction of FACTION_IDS) {
      for (const ref of referenceBases()) {
        for (const level of [3, 4]) {
          const cells = SCALES.map((scale) => {
            const runs = Array.from({ length: 20 }, (_, i) =>
              siegeTraceOn(
                faction,
                ref,
                level,
                seedOf(level, ref.ccLevel, i),
                null,
                CHAIN_CURRENT,
                scale,
              ),
            );
            return pad(`${((runs.filter((r) => r.held).length / runs.length) * 100).toFixed(0)}%`, 4);
          });
          console.log(
            `${pad(faction.toUpperCase(), 8)} | ${pad(ref.name, 11)} | ${pad(String(level), 3)} | ` +
              cells.join(' | '),
          );
        }
      }
    }
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--width')) {
    // How WIDE is the contested band, per base stage?
    //
    // v1.42 sized the ladder's rungs against a band measured across the whole
    // board — ~43% of attacker strength. EARLY (CC1) still has no contested
    // rung anywhere, and it dies across a +24% step, so its band must be
    // narrower than that. The obvious suspect is variance: two guns is a
    // smaller sample than six, so the same matchup lands the same way more
    // often and the region where seeds disagree is thinner. If that is right
    // the band is a property of the BASE, not of the game, and no single rung
    // size can serve all three.
    const SCALES: number[] = [];
    for (let x = 0.5; x <= 2.01; x += 0.05) SCALES.push(Math.round(x * 100) / 100);
    console.log('WIDTH — how much attacker strength separates always-win from always-lose?');
    console.log('FACTION  | BASE        | LVL | BAND (x attacker HP)      | WIDTH');
    console.log('---------+-------------+-----+--------------------------+-------');
    const byStage = new Map<string, number[]>();
    for (const faction of FACTION_IDS) {
      for (const ref of referenceBases()) {
        // Pick the rung where this row actually turns over.
        let flip = 1;
        for (let level = 1; level <= 14; level++) {
          const runs = Array.from({ length: 8 }, (_, i) =>
            siegeTraceOn(faction, ref, level, seedOf(level, ref.ccLevel, i), null, CHAIN_CURRENT),
          );
          if (runs.filter((r) => r.held).length / runs.length < 0.5) {
            flip = level;
            break;
          }
          flip = level;
        }
        const held = (scale: number): number => {
          const runs = Array.from({ length: 20 }, (_, i) =>
            siegeTraceOn(faction, ref, flip, seedOf(flip, ref.ccLevel, i), null, CHAIN_CURRENT, scale),
          );
          return (runs.filter((r) => r.held).length / runs.length) * 100;
        };
        const inBand = SCALES.filter((x) => {
          const h = held(x);
          return h >= 5 && h <= 95;
        });
        const lo = inBand.length ? inBand[0]! : null;
        const hi = inBand.length ? inBand[inBand.length - 1]! : null;
        const width = lo !== null && hi !== null ? (hi / lo - 1) * 100 : 0;
        if (!byStage.has(ref.name)) byStage.set(ref.name, []);
        byStage.get(ref.name)!.push(width);
        console.log(
          `${pad(faction.toUpperCase(), 8)} | ${pad(ref.name, 11)} | ${pad(String(flip), 3)} | ` +
            `${pad(lo === null ? 'none' : `${lo.toFixed(2)}x - ${hi!.toFixed(2)}x`, 24)} | ` +
            `${pad(width ? `+${width.toFixed(0)}%` : '—', 5)}`,
        );
      }
    }
    console.log('');
    for (const [stage, widths] of byStage) {
      const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
      console.log(`${pad(stage, 12)} mean band width: +${mean.toFixed(0)}%`);
    }
    console.log(
      '\nA rung has to be smaller than the band to land in it. Where these differ by ' +
        'stage, ONE rung size cannot serve every base.',
    );
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--native')) {
    nativeCheck();
    return;
  }
  if (process.argv.includes('--missions')) {
    // `--missions hard` fights the campaign at hard difficulty; `--missions
    // sweep` prices rules for thinning its armour, and `--missions fit` fits
    // each drifted mission's armour to the campaign as it was.
    if (process.argv.includes('sweep')) missionsSweep();
    else if (process.argv.includes('fit')) missionsFit();
    else {
      console.log(missionsTable(process.argv.includes('hard') ? 'hard' : 'standard'));
      console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
    return;
  }
  if (process.argv.includes('--retune')) {
    // `--retune 'heavy /3'` runs candidates by label; `--rows` prints each row.
    retune();
    return;
  }
  if (process.argv.includes('--similar')) {
    // Chain v3 by default, the one the 20x30 tables were fought on and so the
    // only one the self-check can check; CHAIN=4 measures today's. An env var
    // rather than a flag: `--chain` is already an instrument, and
    // `process.argv.includes` would hand this run to it.
    similarity(Number(process.env['CHAIN'] ?? CHAIN_LATCHED));
    return;
  }
  if (process.argv.includes('--contested')) {
    // How many rungs of CONTEST does a player actually climb through?
    //
    // `--band` samples fixed level numbers, which stops being comparable the
    // moment the ladder's length changes — stretching it moved levels 2-5 to
    // a third of their old size and the metric read the drop as a regression.
    // This scans each (faction, base) across the WHOLE ladder and counts the
    // levels that land between 5% and 95%, which is what a player experiences
    // and is invariant to how many rungs it takes to get there.
    const MAX = 14;
    console.log(`CONTESTED — contested levels per row, scanning levels 1-${MAX}, 20 seeds`);
    console.log('FACTION  | BASE        | CONTESTED LEVELS');
    console.log('---------+-------------+------------------');
    let total = 0;
    let rows = 0;
    for (const faction of FACTION_IDS) {
      for (const ref of referenceBases()) {
        const hits: number[] = [];
        for (let level = 1; level <= MAX; level++) {
          const runs = Array.from({ length: 20 }, (_, i) =>
            siegeTraceOn(faction, ref, level, seedOf(level, ref.ccLevel, i), null, CHAIN_CURRENT),
          );
          const held = (runs.filter((r) => r.held).length / runs.length) * 100;
          if (held >= 5 && held <= 95) hits.push(level);
        }
        total += hits.length;
        rows++;
        console.log(
          `${pad(faction.toUpperCase(), 8)} | ${pad(ref.name, 11)} | ` +
            `${pad(String(hits.length), 2)}  ${hits.length ? `(L${hits.join(', L')})` : '—'}`,
        );
      }
    }
    console.log(
      `\nCONTESTED LEVELS PER ROW: ${(total / rows).toFixed(2)} across ${rows} rows. ` +
        'The pre-v1.42 ladder gave 0.73 — 14 rows of 15 had one contested level or none.',
    );
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--band')) {
    // M23 Phase 3: can CHARGE and BURN be made to decide battles that SUPPRESS
    // currently decides?
    //
    // `--cliff` says every 0%/100% row is one where clearing the gate and
    // taking the base are the SAME event, so the only way to a contested band
    // is for the two stages AFTER the gate to be able to fail. These are the
    // three constants that could do it, swept one at a time against the number
    // that matters: the share of rows landing between 5% and 95%.
    //
    // Candidate models are registered into CHAIN_MODELS under throwaway
    // version numbers. That is a tool-local hack and deliberately not a
    // shipped version: nothing may name these but this sweep.
    const base = chainModelFor(CHAIN_CURRENT);
    const CANDIDATES: [string, Partial<ChainModel>][] = [
      ['shipped', {}],
      // The real candidate: `coverRadius` 4 is the same as a deployed gun's
      // weapon range, so the guns that GATE suppression and the guns that can
      // REACH the post are one set. Clearing the gate necessarily removes
      // everything that could contest the burn. Shrink the gate below weapon
      // range and a gun can cover the post without blocking the assault.
      ['cover 3', { coverRadius: 3 }],
      ['cover 2', { coverRadius: 2 }],
      ['cover 1', { coverRadius: 1 }],
      ['cover 2 + burn 60', { coverRadius: 2, burnSeconds: 60 }],
      ['cover 1 + burn 60', { coverRadius: 1, burnSeconds: 60 }],
      ['cover 2 + crew 3', { coverRadius: 2, chargeCrew: 3 }],
      ['burn 60s', { burnSeconds: 60 }],
      ['crew 3', { chargeCrew: 3 }],
    ];
    console.log('BAND — can the stages AFTER the gate decide a battle? 20 seeds, no policy');
    console.log('CANDIDATE          | CONTESTED | MEAN HOLD | PASSED GATE | THEN TOOK IT');
    console.log('-------------------+-----------+-----------+-------------+-------------');
    CANDIDATES.forEach(([label, over], at) => {
      const version = 900 + at;
      CHAIN_MODELS[version] = { ...base, ...over, version };
      let contested = 0;
      let rows = 0;
      let holdSum = 0;
      let passedSum = 0;
      let got = 0;
      let took = 0;
      for (const faction of FACTION_IDS) {
        for (const ref of referenceBases()) {
          for (const level of [2, 3, 4, 5]) {
            const runs = Array.from({ length: 20 }, (_, i) =>
              siegeTraceOn(faction, ref, level, seedOf(level, ref.ccLevel, i), null, version),
            );
            const held = (runs.filter((r) => r.held).length / runs.length) * 100;
            if (held >= 5 && held <= 95) contested++;
            rows++;
            holdSum += held;
            const passed = runs.filter((r) => r.stages >= 2);
            passedSum += (passed.length / runs.length) * 100;
            got += passed.length;
            took += passed.filter((r) => r.stages >= 4).length;
          }
        }
      }
      console.log(
        `${pad(label, 18)} | ${pad(`${((contested / rows) * 100).toFixed(0)}%`, 9)} | ` +
          `${pad(`${(holdSum / rows).toFixed(0)}%`, 9)} | ${pad(`${(passedSum / rows).toFixed(0)}%`, 11)} | ` +
          `${pad(got ? `${((took / got) * 100).toFixed(0)}%` : '—', 12)}`,
      );
    });
    // The question the null result raises: when an attack DOES take the post,
    // is there any defence left that could have stopped it?
    {
      let alive = 0;
      let n = 0;
      for (const faction of FACTION_IDS) {
        for (const ref of referenceBases()) {
          for (const level of [2, 3, 4, 5]) {
            for (let i = 0; i < 20; i++) {
              const r = siegeTraceOn(faction, ref, level, seedOf(level, ref.ccLevel, i), null, 900);
              if (r.stages >= 4) {
                alive += r.gunsLeft;
                n++;
              }
            }
          }
        }
      }
      console.log(
        `\nWhen the post FELL (${n} battles): ${(alive / Math.max(1, n)).toFixed(2)} armed ` +
          'defence structures were still standing, on average.',
      );
    }
    console.log(
      '\nCONTESTED is the number Phase 3 exists to move: rows landing between 5% and 95%. ' +
        'THEN TOOK IT is the share of attacks that cleared the gate and went on to take the ' +
        'post — every point below 100 is a battle the last two stages decided.',
    );
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--cliff')) {
    // Is the kill chain itself the step function?
    //
    // SUPPRESS is binary — EVERY live gun within coverRadius must be down — so
    // a defence either keeps one gun alive and the attack cannot start, or
    // loses them all and the rest follows. If that is the cliff, then hold%
    // and "the attack passed SUPPRESS" should be complements, not merely
    // correlated: the share of runs reaching stage 2 should be 100 minus the
    // hold rate, row by row, with nothing in between.
    console.log('CLIFF — is SUPPRESS the step? 20 seeds, no defender policy');
    console.log('FACTION  | BASE        | LVL | HELD | PASSED SUPPRESS | SUM | THEN TOOK IT');
    console.log('---------+-------------+-----+------+-----------------+-----+-------------');
    let worst = 0;
    for (const faction of FACTION_IDS) {
      for (const base of referenceBases()) {
        for (const level of [2, 3, 4]) {
          const runs = Array.from({ length: 20 }, (_, i) =>
            siegeTrace(faction, base, level, seedOf(level, base.ccLevel, i), null),
          );
          const held = (runs.filter((r) => r.held).length / runs.length) * 100;
          const passed = (runs.filter((r) => r.stages >= 2).length / runs.length) * 100;
          const sum = held + passed;
          worst = Math.max(worst, Math.abs(sum - 100));
          // Of the runs that got PAST the gate, how many went on to take the
          // post? Where that is 100%, SUPPRESS is the whole battle and the row
          // is a step. Where it is not, the stages after it are load bearing
          // and the row has slope — which is where a player could matter.
          const got = runs.filter((r) => r.stages >= 2);
          const took = got.length
            ? (got.filter((r) => r.stages >= 4).length / got.length) * 100
            : null;
          console.log(
            `${pad(faction.toUpperCase(), 8)} | ${pad(base.name, 11)} | ${pad(String(level), 3)} | ` +
              `${pad(`${held.toFixed(0)}%`, 4)} | ${pad(`${passed.toFixed(0)}%`, 15)} | ${pad(sum.toFixed(0), 4)}` +
              ` | ${pad(took === null ? '—' : `${took.toFixed(0)}%`, 12)}`,
          );
        }
      }
    }
    console.log(
      `\nWorst departure from 100: ${worst.toFixed(0)} points. A row that sums to 100 is one ` +
        'where passing SUPPRESS and taking the base are the SAME event.',
    );
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--orders')) {
    // Prices the two v1.42 order mechanics against the numbers M23 actually
    // cares about. A lever that raises hold% while leaving the waves dead has
    // not helped: LIVE is the share of waves that move the margin at all.
    const mid = referenceBases().find((b) => b.name.startsWith('MID'))!;
    const VARIANTS: [string, Partial<StandingOrders>][] = [
      ['shipped', {}],
      ['fairShare', { fairShare: true }],
      ['perWave', { perWave: true }],
      ['both', { fairShare: true, perWave: true }],
    ];
    console.log('ORDERS — the two v1.42 mechanics, MID (CC2) levels 3-4, 20 seeds x 5 factions');
    console.log('PRESET         | VARIANT   | HELD | ACTS |  LOW  | LIVE');
    console.log('---------------+-----------+------+------+-------+-----');
    for (const id of ['holdfast', 'counterbattery', 'tripwire'] as const) {
      for (const [label, over] of VARIANTS) {
        const orders = { ...STANDING_ORDERS[id], ...over };
        let held = 0;
        let acts = 0;
        let low = 0;
        let live = 0;
        let waves = 0;
        let n = 0;
        for (const faction of FACTION_IDS) {
          for (const level of [3, 4]) {
            for (let i = 0; i < 20; i++) {
              const r = siegeTrace(faction, mid, level, seedOf(level, mid.ccLevel, i), orders);
              if (r.held) held++;
              acts += r.acts;
              low += r.low;
              for (let w = 0; w < r.integrity.length; w++) {
                const drop = (w === 0 ? 1 : r.integrity[w - 1]!) - r.integrity[w]!;
                if (drop > 0.005) live++;
                waves++;
              }
              n++;
            }
          }
        }
        console.log(
          `${pad(id.toUpperCase(), 14)} | ${pad(label, 9)} | ${pad(`${((held / n) * 100).toFixed(0)}%`, 4)} | ` +
            `${pad((acts / n).toFixed(1), 4)} | ${(low / n).toFixed(3)} | ` +
            `${pad(`${((live / waves) * 100).toFixed(0)}%`, 4)}`,
        );
      }
    }
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--pins')) {
    const arg = process.argv[process.argv.indexOf('--pins') + 1];
    console.log(pinTable(/^\d+$/.test(arg ?? '') ? Number(arg) : 20));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--economy')) {
    // `--economy russia` reads another faction's town; the USA's otherwise.
    const arg = process.argv[process.argv.indexOf('--economy') + 1];
    const faction = FACTION_IDS.find((id) => id === arg) ?? 'usa';
    console.log(economyTable(faction));
    console.log('');
    console.log(yardTable(faction));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--probe-held')) {
    const arg = process.argv[process.argv.indexOf('--probe-held') + 1];
    console.log(probeHeldTable(/^\d+$/.test(arg ?? '') ? Number(arg) : 8));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--order')) {
    const arg = process.argv[process.argv.indexOf('--order') + 1];
    console.log(orderTable(/^\d+$/.test(arg ?? '') ? Number(arg) : 20));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--verbs')) {
    const arg = process.argv[process.argv.indexOf('--verbs') + 1];
    console.log(verbTable(/^\d+$/.test(arg ?? '') ? Number(arg) : 20));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--budget')) {
    // Prices the action budget, the one lever that costs nothing to test:
    // `maxActions` is the only thing stopping a defender who ends a lost
    // battle sitting on a full 150 CP. If the dead rows move with it, they
    // were an opportunity problem. They do not.
    const budgets = [3, 6, 12, 999];
    console.log('BUDGET — HOLDFAST with maxActions swept (20 seeds). Held% / acts / banked');
    console.log(
      'FACTION  | BASE        | LVL | ' + budgets.map((b) => pad(`cap ${b}`, 16)).join(' | '),
    );
    for (const faction of FACTION_IDS) {
      for (const base of referenceBases()) {
        for (const level of [2, 3, 4]) {
          const cells = budgets.map((maxActions) => {
            const orders = { ...STANDING_ORDERS.holdfast, maxActions };
            const runs = Array.from({ length: 20 }, (_, i) =>
              siegeTrace(faction, base, level, seedOf(level, base.ccLevel, i), orders),
            );
            const held = (runs.filter((r) => r.held).length / runs.length) * 100;
            const acts = runs.reduce((a, r) => a + r.acts, 0) / runs.length;
            const bank = runs.reduce((a, r) => a + r.banked, 0) / runs.length;
            return pad(`${held.toFixed(0)}% ${acts.toFixed(1)}a ${bank.toFixed(0)}cp`, 16);
          });
          console.log(
            `${pad(faction.toUpperCase(), 8)} | ${pad(base.name, 11)} | ${pad(String(level), 3)} | ` +
              cells.join(' | '),
          );
        }
      }
    }
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--spend')) {
    const arg = process.argv[process.argv.indexOf('--spend') + 1];
    const seeds = /^\d+$/.test(arg ?? '') ? Number(arg) : 20;
    console.log(spendTable([2, 3, 4], seeds));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--leverage')) {
    const arg = process.argv[process.argv.indexOf('--leverage') + 1];
    const seeds = /^\d+$/.test(arg ?? '') ? Number(arg) : 8;
    console.log(leverageTable([2, 3, 4], seeds));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--mix')) {
    const arg = process.argv[process.argv.indexOf('--mix') + 1];
    console.log(mixTable(/^\d+$/.test(arg ?? '') ? Number(arg) : CHAIN_NONE));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--carry')) {
    console.log(carryTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--structure')) {
    console.log(structureTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--plans')) {
    const arg = process.argv[process.argv.indexOf('--plans') + 1];
    console.log(planTable(/^\d+$/.test(arg ?? '') ? Number(arg) : COMBAT_CURRENT));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--kits')) {
    console.log(kitTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--pressure')) {
    console.log(pressureTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--layouts')) {
    // Select the deal against MEASURED difficulty, not a shape ranking.
    //
    // v1.30 recorded a negative result: the deal could not be used to fix the
    // ladder without costing parity, because both were being steered by the
    // same lever — which shape lands in which band. That lever is too coarse.
    // There are eight shapes and five rungs, and shape explains well under
    // half the variance in clear rate; the LAYOUT explains most of the rest,
    // and the generator picks it from `variant` — the slot index — so a rung's
    // three targets are a shape band and a difficulty lottery.
    //
    // Decoupling them makes the deal a real tuning surface. A target is a
    // (shape, layout) PAIR, the layout pool is wide, and the pair can be
    // chosen to land on a number instead of in a band. Then the ladder and
    // parity stop competing: give every faction the same target curve and
    // both are satisfied by construction.
    //
    // Measured at each faction's REFERENCE plan, because that is the force
    // parity is measured with. The early rungs saturate near 100 for everyone
    // and that is not a defect here — everyone at 100 is a spread of zero, and
    // a starter rung should be beatable.
    const LAYOUT_POOL = 12;
    // Twelve, not six. Six quantises clear rate to steps of 17 points and the
    // selection then fits to that grid — picking a pair because six coin
    // flips landed on 83 is overfitting to the seeds, not measuring a target.
    const SELECT_SEEDS = 12;
    /** What a rung should clear at, at the reference force. Same for all. */
    // Measured, not chosen. A steeper top (100/93/80/62/42) separates the last
    // two rungs on the budget grid — and costs parity, 5.8 to 8.6 on seeds the
    // selection never saw. Down at a 40% clear rate the same seed noise is a
    // much larger share of the number, and the five factions spread out under
    // it. The gentler curve keeps every rung in the band where the measurement
    // is steady.
    const CURVE: Record<number, number> = { 1: 100, 2: 95, 3: 85, 4: 70, 5: 55 };
    /** How far the three targets at a rung spread around its mean. */
    const SPREAD = 15;

    const clearOf = (faction: FactionId, tier: number, shape: ArchetypeId, layout: number) => {
      let cleared = 0;
      let runs = 0;
      const base = generateBase(tier, layout, baseKitFor(faction), shape);
      const squads = (
        faction === 'nk' ? tunnelPlanFor(faction, base, tier) : RAID_PLANS[faction]
      ).map((sq, at) => ({ ...sq, slot: at }));
      for (let i = 0; i < SELECT_SEEDS; i++) {
        const config = raidConfig(base, squads, seedOf(tier, layout, i), trainableFor(faction));
        if (resolveRaid(config, squads, tier, raidCatalogFor(faction)).cleared) cleared++;
        runs++;
      }
      return runs > 0 ? (cleared / runs) * 100 : 0;
    };

    /** How much a shape this faction has already met is penalised, in points. */
    const COVERAGE_NUDGE = 6;
    console.log('DEAL TABLE — three (shape, layout) pairs a rung offers, chosen by measurement\n');
    for (const faction of FACTION_IDS) {
      const rows: string[] = [];
      /** Shapes this faction has already been dealt, lower rungs first. */
      const seen = new Set<string>();
      for (const tier of RAID_TIERS) {
        const want = CURVE[tier] ?? 60;
        // Slot 0 is the heavy fight, slot 2 the one you can take today.
        const wants = [want - SPREAD, want, want + SPREAD];
        const pool = ARCHETYPES.filter((a) => a.fromTier <= tier);
        const measured: { shape: ArchetypeId; layout: number; clear: number }[] = [];
        for (const arch of pool) {
          for (let layout = 0; layout < LAYOUT_POOL; layout++) {
            measured.push({ shape: arch.id, layout, clear: clearOf(faction, tier, arch.id, layout) });
          }
        }
        // Search the TRIPLE, not each slot in turn.
        //
        // Picking slot 0's best pair, then slot 1 from what is left, then slot
        // 2, leaves a rung far off its curve whenever nothing sits near an
        // early target — greedy selection put China's T3 at 58/92/100 against
        // a want of 70/85/100, because the pair it spent on slot 0 was the one
        // slot 1 needed. About ninety candidate pairs per rung makes an
        // exhaustive search over distinct-shape triples a few hundred thousand
        // combinations, which is instant, and it cannot make that mistake.
        //
        // The coverage penalty rides along in the same score: selecting on
        // difficulty alone collapses the roster, because `compound`, `camp`
        // and `corridor` have the widest layout ranges and can hit any target
        // while the other five stop being dealt at all. It is under half a
        // quantum, so it decides ties and never overrides a real difference.
        //
        // Only the best pair per (shape, target) can ever be in the winning
        // triple, so the candidate set is trimmed to those first — same answer,
        // an order of magnitude less work.
        const shapes = [...new Set(measured.map((m) => m.shape))];
        const bestFor = (shape: string, target: number) =>
          measured
            .filter((m) => m.shape === shape)
            .sort((a, b) => Math.abs(a.clear - target) - Math.abs(b.clear - target))[0]!;
        const cost = (m: { shape: ArchetypeId; clear: number }, target: number) =>
          (m.clear - target) ** 2 + (seen.has(m.shape) ? COVERAGE_NUDGE ** 2 : 0);
        let picks: { shape: ArchetypeId; layout: number; clear: number }[] = [];
        let bestCost = Infinity;
        for (const a of shapes) {
          const pa = bestFor(a, wants[0]!);
          for (const b of shapes) {
            if (b === a) continue;
            const pb = bestFor(b, wants[1]!);
            for (const c of shapes) {
              if (c === a || c === b) continue;
              const pc = bestFor(c, wants[2]!);
              const total = cost(pa, wants[0]!) + cost(pb, wants[1]!) + cost(pc, wants[2]!);
              if (total < bestCost) {
                bestCost = total;
                picks = [pa, pb, pc];
              }
            }
          }
        }
        for (const p of picks) seen.add(p.shape);
        rows.push(
          `      [${picks
            .map((p) => (p ? `['${p.shape}', ${p.layout}]` : `['camp', 0]`))
            .join(', ')}], // T${tier} ` +
            `${picks.map((p) => Math.round(p?.clear ?? 0)).join('/')} (want ${wants.join('/')})`,
        );
      }
      console.log(`    ${faction}: [\n${rows.join('\n')}\n    ],`);
    }
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }

  if (process.argv.includes('--dealorder')) {
    // Re-derive DEAL_ORDER at a force that does NOT saturate.
    //
    // The shipped ordering was measured with each faction's reference plan,
    // and for the USA that plan clears almost everything: four shapes tied at
    // 100% and the ranking between them was noise. `DEAL_ORDER_NEUTRAL` says
    // as much in its own comment. A rank drawn from a pinned metric is a
    // coin-flip wearing a number, and it is dealt to players as "the heavy
    // fight" for the rest of the game.
    //
    // With `planAtBudget` there is a force size that half-clears, so the
    // shapes can be told apart. Ranked at the MIDDLE rung, where every shape
    // in the pool is available and none of them is a formality.
    const RANK_TIER = 3;
    console.log('DEAL ORDER — re-derived at a force that half-clears T3, hardest first\n');
    for (const faction of FACTION_IDS) {
      const budget = RUNG_BUDGETS.find((b) => rungClear(faction, RANK_TIER, b) >= 50) ?? 27;
      const plans = planAtBudget(faction, budget);
      const scored = ARCHETYPES.filter((a) => a.fromTier <= RANK_TIER + 2).map((arch) => {
        let cleared = 0;
        let runs = 0;
        for (let variant = 0; variant < VARIANTS; variant++) {
          const base = generateBase(RANK_TIER, variant, baseKitFor(faction), arch.id);
          const squads =
            faction === 'nk'
              ? tunnelPlanFor(faction, base, RANK_TIER, plans).map((sq, at) => ({ ...sq, slot: at }))
              : plans;
          for (let i = 0; i < RUNG_SEEDS; i++) {
            const config = raidConfig(
              base,
              squads,
              seedOf(RANK_TIER, variant, i),
              trainableFor(faction),
            );
            if (resolveRaid(config, squads, RANK_TIER, raidCatalogFor(faction)).cleared) cleared++;
            runs++;
          }
        }
        return { id: arch.id, clear: runs > 0 ? (cleared / runs) * 100 : 0 };
      });
      scored.sort((a, b) => a.clear - b.clear || a.id.localeCompare(b.id));
      const ties = new Set(scored.map((x) => Math.round(x.clear))).size;
      console.log(
        `  ${faction}: [${scored.map((x) => `'${x.id}'`).join(', ')}],` +
          `\n    // at ${planManpower(faction, plans)} MP — ` +
          `${scored.map((x) => Math.round(x.clear)).join('/')}` +
          `${ties < 4 ? '  *** still saturated, ranking is weak ***' : ''}`,
      );
    }
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }

  if (process.argv.includes('--rungs')) {
    const lines = [
      'WHAT EACH RUNG DEMANDS — smallest manpower that clears half the time',
      `FACTION     | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} | STEPS`,
      `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------`,
    ];
    const over = RUNG_BUDGETS[RUNG_BUDGETS.length - 1]!;
    for (const faction of FACTION_IDS) {
      const budgets = RAID_TIERS.map((t) => budgetToClear(faction, t));
      const steps = budgets
        .slice(1)
        .map((b, i) => {
          const prev = budgets[i];
          if (b === null || prev === null || prev === undefined) return '?';
          return b === prev ? '·' : `+${b - prev}`;
        })
        .join(' ');
      lines.push(
        `${pad(flavorFor(faction).faction.slice(0, 11), 11)} | ` +
          `${budgets.map((b) => pad(b === null ? `>${over}` : b, 5)).join(' | ')} | ${steps}`,
      );
    }
    console.log(lines.join('\n'));
    console.log(
      '\n  A rung that asks the same manpower as the one below it (·) added nothing.\n' +
        '  Composition is held at the reference plan and only the SIZE moves, so this is\n' +
        '  the rung talking, not a change of doctrine. The fixed-force ladder tables report\n' +
        '  every early rung at 100% and cannot show a step at all — see `budgetToClear`.',
    );
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }

  if (process.argv.includes('--deal')) {
    console.log(dealTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--parity')) {
    console.log(parityTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--airread')) {
    console.log(airReadTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--wing')) {
    console.log(wingTable());
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--air')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(airTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--garrison')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(garrisonTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--gates')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(gateTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--delay')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(delayTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--vet')) {
    // `--vet china` retunes against a swarm instead of an elite handful.
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(veterancyTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  // UN control experiment: the same 27 MP with the medics swapped for rifles.
  const UN_NO_MEDICS: SquadPlan[] = [
    { units: { leo1: 1, peacekeeper: 2 }, sector: 'W1', doctrine: 'assault' },
    { units: { nlaw: 2, peacekeeper: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { peacekeeper: 2, unsapper: 1, vab: 1 }, sector: 'S1', doctrine: 'raze' },
  ];
  // UN defense experiment: the Engineer Corps HQ parked right behind the
  // post, its repair aura (four units: two cells) over the post and the guns
  // either side of it. Until M34 this row placed nothing — see `layDefense`.
  const UN_ENG_BAY: LayoutStructure[] = [{ cell: idx(14, 4), kind: 'engBay', level: 1 }];
  // Air cover for the reference line: one mount inside the inner line, one
  // beside the command post, which is what a player would actually build.
  // Both cells are free in all three bases and on nobody's way in.
  const AA_COVER: LayoutStructure[] = [
    { cell: idx(12, 6), kind: 'aa', level: 2 },
    { cell: idx(14, 6), kind: 'aa', level: 2 },
  ];

  for (const faction of FACTION_IDS) {
    sections.push(raidTable(faction, raidMatrix(faction)));
    if (faction === 'un') {
      sections.push(
        raidTable(
          faction,
          raidMatrix(faction, undefined, false, UN_NO_MEDICS),
          ' — CONTROL: medics replaced by riflemen',
        ),
      );
    }
    if (faction === 'nk') {
      // The faction thesis: the same force, resurfaced inside the wire.
      sections.push(
        raidTable(faction, raidMatrix(faction, undefined, true), ' — hunt + raze squads TUNNELED'),
      );
      sections.push(
        raidTable(
          faction,
          raidMatrix(faction, DOCTRINE_SUPPORT, true),
          ' — TUNNELED + STRIKE doctrine + fire plan',
        ),
      );
    }
    sections.push(
      raidTable(faction, raidMatrix(faction, DOCTRINE_SUPPORT), ' — STRIKE doctrine + fire plan'),
    );
    // The air thesis: the maze is irrelevant, the mounts are not.
    sections.push(
      raidTable(
        faction,
        raidMatrix(faction, undefined, false, AIR_RAID_PLANS[faction]),
        ' — AIR RAID (rotors + a ground tail)',
      ),
    );
  }
  sections.push(archetypeTable('usa'));
  sections.push(conditionTable('usa'));
  // The ground has to be a trade, and the reading is the SPREAD, not the mean.
  sections.push(terrainTable('usa'));
  // Like-for-like first: the plain RAID rows below are NOT comparable across
  // factions, and reading them as if they were is what made the KPA look
  // twice as broken as it is.
  sections.push(parityTable());
  // And before any faction row is read as a verdict on a KIT: this is what the
  // front line actually deals. Four of the eight shapes, compound five times,
  // the depot never, and the two hardest shapes in the game landing together
  // on T5 for every faction at once.
  sections.push(dealTable());
  // And the layer under the deal: whether the two fronts are the same fight.
  sections.push(kitTable());
  // And the error bar that belongs on every faction row above.
  sections.push(planTable());
  // …and the single largest number in the game that nobody chose deliberately.
  sections.push(structureTable());
  // …and the bottom line under all of it: a raid is very nearly one unit.
  sections.push(carryTable());
  // …and the caveat that belongs on every percentage above it: CLEAR% is a
  // count of matchups tipped, and this is how few of them the seed can tip.
  sections.push(seedTable());
  // …and the answer to the question all of the above kept raising: whether a
  // raid could come for something other than the command post.
  sections.push(objectiveTable());
  // Fortifying has to be worth something, and the 2x2 says which change made
  // it so — a single-column read of this table is what got it wrong once.
  sections.push(garrisonTable('usa'));
  // Air against ground, per faction. The EDGE is the reading, and it is read
  // against a MANPOWER-MATCHED control — the air plans fly 3-4 MP more than the
  // ground reference for four of five factions, so the raw comparison was
  // reporting budget as well as doctrine.
  for (const faction of FACTION_IDS) sections.push(airTable(faction));
  // And what air actually costs, ceiling-free, plus why the answer is not a
  // single number: air fights a different ladder from the one the deal was
  // selected against.
  sections.push(wingTable());
  // And the read that answers it, with the score that let it ship.
  sections.push(airReadTable());
  // Veterancy pays in survivors, not in wins, so it is measured per faction:
  // the survival column is the whole claim and the swarms have to show it too.
  for (const faction of FACTION_IDS) sections.push(veterancyTable(faction));
  for (const faction of FACTION_IDS) {
    sections.push(defenseTable(faction, defenseMatrix(faction)));
    sections.push(
      defenseTable(
        faction,
        defenseMatrix(faction, undefined, [], STANDING_ORDERS.holdfast),
        ' — HOLDFAST standing orders',
      ),
    );
    // The defense side of the air thesis: the same ladder, with two mounts
    // that can elevate added to the reference line.
    sections.push(
      defenseTable(faction, defenseMatrix(faction, undefined, AA_COVER), ' — WITH AA COVER'),
    );
    if (faction === 'nk') {
      // The weakest floor gets the full preset comparison.
      sections.push(
        defenseTable(
          faction,
          defenseMatrix(faction, undefined, [], STANDING_ORDERS.counterbattery),
          ' — COUNTERBATTERY standing orders',
        ),
      );
      sections.push(
        defenseTable(
          faction,
          defenseMatrix(faction, undefined, [], STANDING_ORDERS.tripwire),
          ' — TRIPWIRE standing orders',
        ),
      );
    }
    if (faction === 'un') {
      sections.push(
        defenseTable(
          faction,
          defenseMatrix(faction, undefined, UN_ENG_BAY),
          ' — Engineer Corps HQ on the line',
        ),
      );
    }
    sections.push(
      defenseTable(faction, defenseMatrix(faction, FORTIFY_MODS), ' — FORTIFY doctrine'),
    );
  }
  // The campaign (v1.45.1). It was never in this file, which is how a whole
  // board's worth of drift in it went unseen until someone went looking.
  sections.push(missionsTable());
  const body = sections.join('\n\n');
  console.log(body);
  console.log(
    `\n${FACTION_IDS.length * (RAID_TIERS.length + referenceBases().length * ASSAULT_LEVELS.length) * SEEDS * 1.5 | 0}+ battles in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  if (process.argv.includes('--md')) {
    // Read the version rather than typing it. It was a literal, and a literal
    // in a generator only tells the truth on the day it is edited: this file
    // said v1.25 for six releases of tables measured on other builds.
    const pkgVersion = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string })
      .version;
    const md = [
      `# Balance snapshot (v${pkgVersion})`,
      '',
      'Deterministic headless matrices from `npm run balance -- --md`.',
      `${SEEDS} seeds × ${VARIANTS} base variants per raid cell; ${SEEDS} seeds per defense cell.`,
      'Defense rows measure the permanent layer alone (no live CP play), the floor a base must clear —',
      'an active player defends one to two ladder levels above their probe floor.',
      '',
      '> **CLEAR% is becoming a probability, and was not one before v1.23.** Until then the sim',
      "> never rolled in combat: a raid with no fire plan drew from the engine's stream exactly once",
      '> per unit — a ±3-8% speed roll at spawn — and nothing else in it was random. 86% of matchups',
      '> reached the SAME verdict under every seed and 54% brought the identical force home, so a',
      '> cell was a count of matchups tipped rather than a rate, and a five-tier mean moved in steps',
      '> of 6.7 points. Twelve releases of tuning were read off that.',
      '>',
      '> v1.23 rolls (`--seed` is the instrument, GDD §3): 63% and 28% now. A cell is still closer to',
      '> a count than a rate — a matchup that is hopeless stays hopeless — so keep treating a gap',
      '> narrower than one matchup as noise, and prefer DESTR%, which is continuous, when a change is',
      '> smaller than a whole cell. What is no longer true is that a gap of a few points is',
      '> necessarily nothing: the rows can move now without the content moving.',
      '>',
      '> Every table below EXCEPT the ones that name a model was measured with the rolls on, so none',
      '> of them is comparable to a pre-v1.23 snapshot cell for cell.',
      '>',
      '> **These are the first tables measured against the KILL CHAIN (v1.41), and none of them is',
      '> comparable to a v1.40 cell either.** Taking a command post is no longer chewing an HP bar:',
      '> it is four staged gates — breach, suppress, charge, burn — each paid in a different stat',
      '> (GDD §5.4a). Two things follow for reading these rows. The raid rows use REFERENCE PLANS',
      '> that were re-derived against the chain and are combined arms now, so a raid cell measures',
      '> a different force as well as a different objective. And the DEFENSE rows moved for a',
      '> reason that is not content: `defenseMatrix` builds its config by hand, it was never told',
      '> about the chain, and so every defence number in the v1.41 snapshot before this one was',
      '> still being measured on the sponge while the game shipped the chain.',
      '>',
      "> **v1.41.1 moved MP LOST% and the DEFENSE rows, and nothing else.** v1.41's chain",
      '> could deadlock: an attacker that had reached the post, could not pay the crew',
      '> minimum and could no longer be shot had nowhere left to go, and 18% of reference',
      '> sieges ended that way. A spent assault is now written off after 90 static seconds',
      '> (GDD §5.4a). Held to ONE variable — same seeds, same plans, chain v1 against v2 —',
      '> CLEAR% and DESTR% come back identical in every tier and only MP LOST% moves (USA',
      '> T2 27 → 73, T4 66 → 75): the assault that stalls was never going to clear and had',
      '> already done its damage, so the whole of the change is whether the force pinned at',
      '> the wire walks home. It does not. The DEFENSE rows gained for the mirror reason —',
      '> a stalemate used to run to the tick cap and be filed as a defeat, and is now',
      '> scored as the defender victory it always was.',
      '>',
      '> **v1.41.2 latches the breach, and these tables are measured against chain',
      '> version 3.** M22 dropped the opened post from the target list so standoff fire',
      '> could not shell a bar that cannot move, and wrote it as a live comparison',
      '> against the breach floor — which a repair aura crosses back over, handing the',
      '> livelock straight back. Found in M23 Phase 2 on UN LATE (CC3) level 4, where a',
      '> lone gunship held a bar oscillating either side of 0.70 for thirty thousand',
      '> ticks. It was invisible to every table in this file, including the two written',
      '> to hunt exactly this: a defender only reaches it by taking more than the three',
      '> actions HOLDFAST allows, and nothing here had ever let one.',
      '>',
      '> **v1.42 LENGTHENED the assault ladder, so no defence row here is comparable',
      '> to the row above it in the history by level number.** A level is a +25% step',
      '> now instead of up to +67%, and today\'s level 6 is roughly what level 2 used',
      '> to be. The defence tables sample levels 1, 4, 6, 8, 10 and 12 — the rungs',
      '> covering the same difficulty range the old six did — so read a cell against',
      '> its column header, never against its position.',
      '>',
      '> The reason is M23 Phase 3. A defence row is CONTESTED when it lands between',
      '> winning every seed and losing every seed, and the band that does it is about',
      '> 43% of attacker strength wide. A six-rung ladder over this range has a floor',
      '> of +33% per rung even when perfectly uniform, so ONE contested level per base',
      '> was the ceiling — which is what every snapshot in this file had recorded, and',
      '> what three content notes carried since v0.6 were separately describing.',
      '> Contested levels per row: 0.73 before, 2.20 after.',
      '>',
      '> **M34 moved every battle onto a 10x15 board at two units a cell, so no row here',
      '> is comparable to a v1.44 cell.** The catalog is written in physical units and',
      '> halves onto the new cells, but a gun or a wall cannot shrink below one, and the',
      '> kill chain is version 4: a crew stuck on a covered post goes after the guns',
      '> covering it. The eight generator plans, the three reference bases and the deal',
      '> were drawn or chosen again for this board. The assault ladder was re-tuned so each',
      '> defence row first holds under half where v1.44\'s did (`--retune`): a heavy every',
      '> four levels instead of two, and +7% a level instead of +9%, which moves that level',
      '> by −0.07 on average against −1.13 for the old ladder on this board. Two rows below',
      '> measured nothing before this snapshot: the Engineer Corps HQ and the forward AA',
      '> mount never landed. A reference layout that does not land now stops the harness.',
      '>',
      '> **v1.45.3 is kill chain 5, which changes how standing orders and fire plans AIM and',
      '> nothing else.** Three distances an order aims by had stayed cells through M34 and are',
      '> units now: the radius a cluster is counted within, and how far out the approach gun',
      '> goes. A fire mission on the densest knot is laid ahead of it, on the ground force it',
      '> can hit. A bare defence row has neither orders nor a fire plan and reads exactly as',
      '> v1.45.2 did; the raid rows and every row fought under standing orders moved.',
      '> HOLDFAST\'s second gun goes to the breach in the same release (M23 Phase 3c).',
      '>',
      '> **v1.47.0 is kill chain 6: a fire mission pins what it lands on (M23 Phase 5).** A',
      '> ground unit a gun run or a barrage lands on moves no stage of the chain for eight',
      '> seconds: it does not move, shoot, dig or hold. Only fire missions pin, and nothing in a',
      '> bare defence row or a raid calls one on the attack, so those rows read exactly as',
      '> v1.46.0\'s did. The rows fought under standing orders moved, and HOLDFAST\'s gun run',
      '> waits for the assault to reach the post now.',
      '',
      '```',
      body,
      '```',
      '',
      '## Reading the tables (v0.8 pass)',
      '',
      '> These bullets are a LOG, not a caption. Each records what was learned when it was',
      "> learned, and the tables above are re-measured on every `--md` run — so where a bullet",
      '> cites a figure, read it as the number that produced the conclusion, and the table as',
      '> the number today. A conclusion that stops holding gets rewritten here; a figure that',
      '> merely moved does not.',
      '',
      '- **The raid rows use a FIXED mid-game force**, so the ladder is supposed to outgrow it.',
      '  USA (quality) stays potent deep into the ladder but pays 70%+ of the force at tier 4–5;',
      '  China (mass) grinds tiers 2–3 with cheap replacements, then needs the late-game army:',
      '  a 33-manpower PLA force with doubled armor clears tier 4–5 at ~70% (verified headlessly).',
      '  Steeper curve + cheaper bodies is the intended faction texture, not a wall.',
      '- **North Korea (tunnels) rewrites the entry problem, not the force problem**: the TUNNELED',
      '  row re-sites squads through galleries inside the wire (the harness probes hunt+raze /',
      '  raze-only / everything per base, like a player adapting to the scout). Tunnels turn',
      '  tier 2 from a coin flip into a walkover and roughly quadruple tier-4 clears, but a',
      '  27-MP force that is outmassed stays outmassed — the late answer stacks galleries with',
      '  the KN-09 plan. Each gallery costs 40 Fuel, the faction tax.',
      '- **NK defense floor sits one ladder step below China by design** (MID holds L3 at ~80%,',
      '  L4 at ~20%): rock barricades and sentry nests are the cheapest line in the war and die',
      '  like it. The compensators are price (rebuild fast, repair at 25%), the Koksan pit',
      '  outranging every gun in the game, and the CP battle layer (ambush teams at 20, mines',
      '  at 12) — the reference measures none of those.',
      '- **UN (sustainment) is measured against its own control**: the CONTROL row runs the',
      '  same 27 MP with the medics swapped for riflemen. Medics clear the bar where the fight',
      '  is winnable — tier-1 losses drop ~18 points and tier-3 clears gain ~13 — and go quiet',
      '  where the force is simply outgunned (tier 4+): healing at 22/s loses to two guns',
      '  focused, by design. On defense the Engineer Corps HQ row shows the aura the reference',
      '  can see; the Engineer Revetment (CP layer, 15 hp/s over 3 units) is the live-play',
      '  tool the reference cannot. Every UN gun is deliberately mid-pack; the faction wins',
      '  by still being there in wave three.',
      '- **Russia (artillery) progresses through fire preparation**: their bare late-game force',
      '  stalls past tier 3 (43/12/0 at t3–5), but a max-cap army behind a TOS-1A fire plan on',
      '  the guns holds 53/52/42 — shell the batteries first, then walk the armor in. Their',
      '  ordnance habit is the faction tax: fuel per charge, every raid.',
      '- **The doctrine rows are the v0.4 ceiling**: full Strike research plus a stocked fire plan',
      '  (an A-10/MLRS pass on the guns at T+15, 155s/PLZ-05 on the post at T+40). It lifts the',
      '  USA tail to ~92–98% and trims losses ~6 points; for China it converts into destruction',
      '  and loot more than into clears — their tier 4+ answer remains the max-cap army.',
      '- **FORTIFY is strictly non-negative everywhere** (verified after the reference-base fix',
      "  below). China's defense floor runs softer than the USA's at MID — their besiegers are",
      '  Rangers, Javelins, and Abrams, not militia — which makes the FORTIFY branch their',
      '  must-have doctrine (L4 hold: 50% → 85%).',
      '- **Coverage lesson baked into the MID reference**: a lone tank that survives to the wall',
      '  line will stand at standoff range and shell the CC; every breach approach must be inside',
      "  some AT post's arc or that tank ends the siege. The reference base was fixed to overlap",
      '  its arcs, which is also the in-game lesson for players.',
      '- **Standing orders (v0.8) are the offline defense doctrines**: the HOLDFAST rows show',
      '  the probe floor when the garrison spends kill-earned CP by policy (a 1-second command',
      '  cadence and a hard per-battle action budget are the handicap; breach-reactive field',
      '  guns are the payoff). HOLDFAST lifts chokepointed MID layouts two to three ladder',
      '  levels and still collapses when outmassed (NK MID L6 stays 0%); COUNTERBATTERY burns',
      '  the real ordnance stock and TRIPWIRE is the budget option — the NK section compares',
      '  all three. Orders cost supplies upkeep per action and every probe replay re-issues',
      '  them from the config.',
      '- **Base archetypes (v1.6) are eight different questions**, and the ARCHETYPES table',
      '  is what keeps them that way: the shapes have to SPREAD, and none of them may be a',
      '  wall at a tier where it is actually offered. The band runs OPEN CAMP 99% (the',
      '  breather) through COMPOUND 94% (the baseline) to BUNKER COMPLEX 71% (33% at the',
      '  tier it first appears). Prepared rows sit under the three hardest so a shape that',
      '  stops the reference force can be shown to open for a force that planned for it.',
      '- **The bunker complex overturned the obvious design.** "Few walls, many guns" was',
      '  built as more guns and a level deeper, and measured 0% clears at tiers 4 AND 5 —',
      '  with the doctrine ceiling behind the force. The cause is structural: with no wall',
      '  line there is no breach to wait for, so every gun engages from the first second.',
      '  An open base is harder at the SAME gun count, which means the multiplier has to',
      '  come down. It ships at 0.65× guns, one level deeper: fewest positions on the',
      '  board, best dug, and the hardest thing on it that can still be taken.',
      '- **Field conditions (v1.3) are trades, not buffs**, and the FIELD CONDITIONS table is',
      '  what enforces that: the pay must rise with the measured difficulty. The rotation lands',
      '  on ±9 points of clear rate around CLEAR LINE — HARD RAIN is the walkover that pays 0.85×,',
      '  DUG IN / FUEL CRISIS / ATTRITION cost 8–10 points and pay 1.3–1.45×. Two readings matter:',
      '  defender weaponDamage is by far the strongest lever (wall HP alone barely moves a fixed',
      '  force, because softer walls just deliver it to the guns sooner), and BLACKOUT reads as',
      '  exactly neutral here BY CONSTRUCTION — it carries no sim modifiers at all. Its cost is',
      '  that no target can be scouted at any price, so the plan is made against fog and NK loses',
      '  tunnels entirely; a headless matrix that always fights with the layout in hand cannot',
      '  price that, which is why its 1.25× is a judgement and is labelled as one.',
      '- **Veterancy (v1.9) pays in survivors, not in wins**, and the VETERANCY tables are',
      '  the proof: from GREEN to CADRE the mean share of the force that walks home rises for',
      '  every faction (USA 28→34, China 12→16, Russia 18→20, NK 12→20, UN 20→27), while the',
      '  clear rate barely moves for three of the five. That is the intended shape — a rank is',
      '  worth a few men, never a win — and it is self-reinforcing by design, because the men',
      '  who come home are the experience. A +15% top-end multiplier is deliberately too small',
      '  to substitute for bringing enough people.',
      '- **The first veterancy table measured the wrong thing.** It thinned the reference force',
      '  to push the clear rate to the margin, which made the swarm factions read as flat: a',
      '  China or NK plan cut in half dies at every rank, and a 15% HP bump cannot save a unit',
      '  that was never going to survive the volley. Measured at full strength the signal is',
      '  monotone for all five. The lesson is general — a multiplier is invisible at the floor',
      '  and at the ceiling, so it has to be measured where the units were already living.',
      '- **The ground (v1.19) is a trade, and the reading is the SPREAD.** Terrain has to change',
      '  WHICH bases are hard rather than making all of them harder — the same bar field',
      '  conditions clear. Read the KITS table two ways: GROUND against FLAT on the mean, which',
      '  has to land inside the ±9 band field conditions are held to, and the three SHEET rows',
      '  against each other, which has to be much wider than that. It has held at every',
      '  measurement since — a couple of points on the mean against roughly twenty across the',
      '  sheets at v1.32 — and the second number is the whole point of putting a base somewhere',
      '  rather than nowhere. Both move when the deal moves, because the sheets are measured on',
      '  the bases the deal names.',
      '- **The first cut of terrain was a difficulty spike, and the harness said which term did',
      '  it.** GROUND opened at 33 points under FLAT. Switching the elevation multiplier off',
      '  put it at 93.0 against 93.4 — meaning water, cover and movement cost together',
      '  accounted for almost NONE of the drop and elevation accounted for all of it. The',
      '  mockup had proposed +40% reach on the top band; it ships at +15%.',
      '- **That was the third time this project learned the same thing**: a raid is decided',
      '  by GUN COVERAGE, not by route length or wall HP. Field conditions found it (defender',
      '  weaponDamage is by far the strongest lever, wall HP barely moves a fixed force), gates',
      '  found it (48 doors in a ring moved the clear rate by one point, because attackers',
      '  route rather than breach), and terrain found it again. v1.20 went after the cause',
      '  rather than working around it a fourth time — see the GARRISON table above.',
      '- **The cause was that a raid charged nothing for TIME (v1.20).** `raidConfig` set',
      '  cpPerSecond 0 and cpCap 1, so a defending post had no economy, and the standing-orders',
      '  evaluator bailed on the attacker side, so nothing it might have bought could be spent.',
      '  A Front Line base was a diorama. Route length and wall HP can only ever spend the',
      '  attacker’s time, and time was free — so the whole fortification layer was priced at',
      '  zero. It was in fact priced BELOW zero: stripping every wall out of a generated base',
      '  made it EASIER to hold, 86.7 against 81.5, because the maze’s one real effect was',
      '  steering raiders AROUND the guns.',
      '- **Two faults, two fixes, and they had to be separated to be seen.** The GARRISON',
      '  table is a 2x2 for a reason: a first read moved the watch and the gun trade together',
      '  and credited the watch with the wall line. Held still one at a time, GUNS 0.8 alone',
      '  takes the wall line from -5.0 to +8.6 with the clear rate unmoved, and the watch is',
      '  slightly negative on that axis (+6.6 shipped). Weaker guns let attackers live longer',
      '  in the open, so a wall that holds a force in a corridor under fire finally outweighs',
      '  a maze that routes them past the shooting.',
      '- **What the watch earns is the CLOCK, which this table cannot see.** Measured by',
      '  staggering the same three squads instead of launching them together, over 1200 raids',
      '  a cell: a 60-second stagger costs 5.1 points unwatched and 8.3 watched. A concentrated',
      '  push arrives before the reserve exists; a dawdling one walks into guns that were not',
      '  there when it set off. Targeting is the whole of it — ccApproach and breach both',
      '  measured indistinguishable from having no garrison at all, because a last stand at',
      '  the objective comes after the corridor has already been walked for free.',
      '- **The method lesson is the one worth keeping.** A test written against the first,',
      '  wrong read PASSED with the garrison deleted, because it moved two things and asserted',
      '  on the sum. tests/garrison.test.ts now moves one thing per test, and each claim was',
      '  checked to FAIL when its own cause is reverted and to SURVIVE when the other is.',
      '- **The fords are the one thing that came out backwards.** A river with a single bridge',
      '  is a chokepoint worth more than any wall, so two fords were added — and they did not',
      '  move the clear rate at all. What they moved was the butcher’s bill, the wrong way:',
      '  losses rose from 85% to 91% on the hardest sheet, because a force that splits across',
      '  three crossings arrives piecemeal, and piecemeal is how you die. Three doors is worse',
      '  than one if you insist on using all of them.',
      '- **Woodland is a trade because artillery ignores it.** Cover applies to aimed fire and',
      '  not to a barrage or mortar splash: canopy hides a man from a gunner, not from',
      '  something that lands in the trees. That asymmetry is what stops it being a free',
      '  hiding place, and it is what gives the fire-mission layer something to answer.',
      '- **Terrain moved the veterancy fixture onto the floor, which is its own lesson.** The',
      '  survival test measures a thin 5R1A push at tier 4; with ground under it, GREEN and',
      '  CADRE bring home exactly the same men, because a 15% HP bump cannot save a unit that',
      '  was never going to survive the volley. It measures on flat ground now — the same',
      '  correction the first veterancy table needed, for the same reason.',
      '- **Air is not weaker. It is a different LADDER (v1.33), and three labels had to be',
      '  fixed before that was visible.** The v1.32 reading of this section said the air',
      '  ROSTER was mispriced, off a spread of 32 clear-rate points. That spread was measured',
      '  against a control of the wrong size: four of the five air plans fly 3-4 MP more than',
      '  the ground reference, and the only matched one is the faction that measured worst.',
      '  Against `GROUND =N` no air force beats its own ground, and the USA\'s +6.4 is +0.6.',
      '  The loss column was counting heads rather than manpower, and the row labelled `no AA`',
      '  never removed any AA — the mounts are built into every base and only the garrison\'s',
      '  reactive order came off. All three are fixed above; each had been read as a finding',
      '  for four or more releases.',
      '- **What is left is the real one.** `--wing` prices air the way `--rungs` prices the',
      '  ladder, and the air demand row comes out non-monotone: the USA needs 38 MP at T3 and',
      '  12 at T4. Probed directly that is not noise — a 12-MP air force clears T4 62% of the',
      '  time and T3 0%. Measured per dealt target, the two hardest shapes for the USA\'s',
      '  aircraft (`camp` 0%, `depot` 5%) are the two its ground force finds EASIEST (60%,',
      '  100%), and `star` and `keep` invert the other way. Walls and overlapping arcs make a',
      '  rung hard on the ground and neither exists for an aircraft; what is left is the flight',
      '  in, and the shapes with the fewest walls spread their mounts and their post over the',
      '  most ground. 39 of the 75 dealt targets move by 30+ points depending on whether the',
      '  force walked or flew, while four of five factions have MEANS within a few points. It',
      '  is not a power problem, it is an information one: the shape is free knowledge and the',
      '  game says nothing about what it means to an aircraft.',
      '- **Watch items for v0.6**: the EARLY L2→L3 cliff on all sides (armor arrives before',
      '  anti-armor requisitions), China MID vs L5+ (Javelin overwatch), and NK MID vs L4+',
      '  (everything kills sentry nests).',
      '- M7 changes behind these numbers: tunneled squads surface as one push around the mouth',
      '  after an 8s dig (reserved cells carry the mouths into replays), the Bulsae matches the',
      '  HJ-8 trade (46/58/72 at 0.5/s), the Koksan runs a 4.2s cadence with a 3.5 dead zone',
      '  in exchange for 10.5–11 reach, and v0.7 adds sustainment auras: healing is additive,',
      '  capped per target, and deterministic — it out-heals one gun, never two.',
      '- **The campaign is in this file from v1.45.1 (`--missions`).** Every mission is held',
      '  up against v1.44\'s campaign, frozen, on the three reference bases; `*` marks the base',
      '  the campaign allows by then. It had never been measured, and on the 10x15 board every',
      '  mission that fields heavies had drifted toward the attacker, by about forty points on',
      '  average at its own base. None without heavies moved. The armour missions and finales',
      '  now field two heavies, chosen per mission by measurement (`--missions fit`). One cell',
      '  still off is LANDFALL fought without the CC3 the campaign has unlocked by then: with no',
      '  heavies at all a CC2 base holds it 15% of the time, so it is the mission, not the tanks.',
      '- **The keep\'s guns spread in v1.45.2.** Drawn for 10x15 with every gun in the bands',
      '  in front of and behind the post, it was a wall for the three reference forces that',
      '  hunt guns — Russia 7, the UN 0 and the KPA 11 clears in 144 at T4-T5 — because each',
      '  gun covered every other. With the same guns in the bands\' corners and in outworks',
      '  outside the outer ring, 54, 12 and 58, still each one\'s third hardest shape, and the',
      '  deal hands the keep to all five factions again.',
      '- **The defender\'s verbs were re-judged on the contested band in v1.45.3 (`--verbs`).**',
      '  Every rule that stands up a gun wins two to twelve battles for each it loses, +20 to',
      '  +26 held. A fire mission lands now, and it changes about one battle in four, nearly as',
      '  often each way: +3 for the A-10 and +4 for the barrage, which is noise with a price.',
      '  Before chain 5 the A-10 had never landed at all. On the new aim HOLDFAST\'s inner-line',
      '  gun stood beside the post, inside the ring an assault clears first, and cost it 7 on',
      '  MID; at the breach HOLDFAST is +16 and positive on every stage. It is now the best',
      '  preset on an EARLY base and TRIPWIRE on MID and LATE, where on chain 4 HOLDFAST was',
      '  the best of the three on every stage.',
      '- **The fire missions got a job the chain can see in v1.47.0 (`--pins`, `--verbs`).** Two',
      '  things kept them stirring battles rather than deciding them, and each was priced alone.',
      '  The duty officer called a strike the moment it could pay, onto the densest knot on the',
      '  board, usually the column still forming at the edge of the map. Waiting for two or',
      '  three in the post\'s cover ring already makes both starred verbs on chain 5: the A-10',
      '  +6, the barrage +9. And a strike did damage and nothing else. On chain 6 it pins every',
      '  ground unit it lands on for eight seconds, and a gun run on the assault is +13, winning',
      '  74 battles for 13 lost. Nearly all of the pin is in the tanks: pinning heavies alone',
      '  gives +12. HOLDFAST\'s gun run waits for the assault now, +22 against +12 on its old aim.',
      '  COUNTERBATTERY keeps its aim, because its claymore spends the budget while a waiting',
      '  strike holds its fire: 13 re-aimed against 15 as it stands.',
      '',
    ].join('\n');
    writeFileSync('docs/BALANCE.md', md);
    console.log('docs/BALANCE.md written.');
  }
}

main();
