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
import { writeFileSync } from 'node:fs';
import { buildAssault } from '../content/assaults';
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
  MAP_W,
  type ArchetypeId,
  type GeneratedBase,
} from '../content/bases';
import {
  baseKitFor,
  defenseCatalogFor,
  enemyRosterFor,
  flavorFor,
  raidCatalogFor,
  trainableFor,
  FACTION_IDS,
  type FactionId,
} from '../content/factions';
import {
  DOCTRINE_IDS,
  raidConfig,
  resolveRaid,
  tunnelSiteValid,
  type RaidSupport,
  type SectorId,
  type SquadPlan,
} from '../meta/warfare';
import { CONDITIONS } from '../content/conditions';
import { RANKS } from '../content/veterancy';
import { STANDING_ORDERS } from '../content/standingOrders';
import { Engine } from '../sim/engine';
import { createRng } from '../sim/rng';
import { COMBAT_CURRENT, COMBAT_MODELS, COMBAT_NONE, combatModelFor } from '../sim/combat';
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
  LayoutWall,
  SimConfig,
  StandingOrders,
  Catalog,
  DamageType,
  Doctrine,
} from '../sim/types';

const SEEDS = 20;
const VARIANTS = 3;
const RAID_TIERS = [1, 2, 3, 4, 5];
const ASSAULT_LEVELS = [1, 2, 3, 4, 5, 6];

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
 * The cost of a derived reference is that it is a monoculture in three cases,
 * so a defensive table now reads "how does this hold against nine APCs" rather
 * than against combined arms. `--kits` and `--shapes` vary force composition
 * and are the guard against tuning content to one attacker shape.
 *
 * Regenerate with `npm run balance -- --derive 60`, which emits these as
 * source. The sector split follows roster iteration order, so transcribe from
 * that output rather than by hand.
 */
const RAID_PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { javelin: 1, abrams: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { abrams: 1 }, sector: 'N1', doctrine: 'assault' },
    { units: { abrams: 1 }, sector: 'S1', doctrine: 'assault' },
  ],
  china: [
    { units: { militia: 1, type99: 1 }, sector: 'W1', doctrine: 'hunt' },
    { units: { sapper: 1, type99: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { sapper: 1, type99: 1 }, sector: 'S1', doctrine: 'hunt' },
  ],
  russia: [
    { units: { btr: 3 }, sector: 'W1', doctrine: 'assault' },
    { units: { btr: 3 }, sector: 'N1', doctrine: 'assault' },
    { units: { btr: 3 }, sector: 'S1', doctrine: 'assault' },
  ],
  nk: [
    { units: { nkrifle: 2, infiltrator: 1, tunneler: 3 }, sector: 'W1', doctrine: 'hunt' },
    { units: { nkrifle: 2, infiltrator: 1, tunneler: 3 }, sector: 'N1', doctrine: 'hunt' },
    { units: { nkrifle: 1, infiltrator: 1, tunneler: 3 }, sector: 'S1', doctrine: 'hunt' },
  ],
  un: [
    { units: { vab: 3 }, sector: 'W1', doctrine: 'hunt' },
    { units: { vab: 3 }, sector: 'N1', doctrine: 'hunt' },
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
 * offsets from the command post, east side first (behind most wall lines). */
function nkTunnelCell(base: GeneratedBase): number | undefined {
  const ccCol = base.ccOrigin % MAP_W;
  const ccRow = Math.floor(base.ccOrigin / MAP_W);
  const candidates: [number, number][] = [
    [5, 0], [-5, 0], [0, -5], [0, 5], [5, 3], [-5, -3], [6, 0], [-6, 0],
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
const RUNG_BUDGETS = [4, 6, 8, 11, 14, 18, 22, 27, 33, 40, 48] as const;
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
function planAtBudget(faction: FactionId, budget: number): SquadPlan[] {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  const base = RAID_PLANS[faction];
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
function rungClear(faction: FactionId, tier: number, budget: number): number {
  const plans = planAtBudget(faction, budget);
  let cleared = 0;
  let runs = 0;
  for (let variant = 0; variant < VARIANTS; variant++) {
    const base = generateBase(tier, variant, baseKitFor(faction), undefined, faction);
    const squads =
      faction === 'nk'
        ? tunnelPlanFor(faction, base, tier, plans).map((squad, at) => ({ ...squad, slot: at }))
        : plans;
    for (let i = 0; i < RUNG_SEEDS; i++) {
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
function budgetToClear(faction: FactionId, tier: number): number | null {
  let last = -1;
  for (const budget of RUNG_BUDGETS) {
    const fielded = planManpower(faction, planAtBudget(faction, budget));
    if (fielded === last) continue; // same force, already measured
    last = fielded;
    if (rungClear(faction, tier, budget) >= 50) return fielded;
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

const W = 32;
const H = 24;
const CC_ORIGIN = 11 * W + 27; // (27, 11) — the town grid's command post

interface ReferenceBase {
  name: string;
  ccLevel: number;
  walls: LayoutWall[];
  structures: LayoutStructure[];
}

const idx = (x: number, y: number): CellIndex => y * W + x;

/** A wall line at column x covering [y0, y1], skipping the listed gap rows. */
function wallLine(walls: LayoutWall[], x: number, y0: number, y1: number, gaps: number[]): void {
  for (let y = y0; y <= y1; y++) {
    if (!gaps.includes(y)) walls.push({ cell: idx(x, y), kind: 'wall' });
  }
}

/**
 * Reference towns, staged like a real save: everything within CC gating for
 * its level (counts and structure levels), west-facing funnels.
 */
function referenceBases(): ReferenceBase[] {
  // EARLY (CC1): one wall line, one gap, two gun nests. 21 walls of 50.
  const early: ReferenceBase = { name: 'EARLY (CC1)', ccLevel: 1, walls: [], structures: [] };
  wallLine(early.walls, 20, 2, 21, [11, 12]);
  early.structures = [
    { cell: idx(22, 10), kind: 'm2nest', level: 1 },
    { cell: idx(22, 13), kind: 'm2nest', level: 1 },
    { cell: idx(21, 5), kind: 'autocannon', level: 1 },
  ];

  // MID (CC2): offset double line — a serpentine through two kill pockets.
  // Both AT posts overlap the inner wall's breach approaches: a lone tank
  // that stalls at the line to shell the CC from standoff must be reachable
  // by at least one of them, wherever the escort fight left holes.
  const mid: ReferenceBase = { name: 'MID (CC2)', ccLevel: 2, walls: [], structures: [] };
  wallLine(mid.walls, 20, 2, 21, [11, 12]);
  wallLine(mid.walls, 24, 2, 21, [5, 6, 17, 18]);
  mid.structures = [
    { cell: idx(22, 10), kind: 'm2nest', level: 2 },
    { cell: idx(22, 13), kind: 'm2nest', level: 2 },
    { cell: idx(26, 6), kind: 'm2nest', level: 2 },
    { cell: idx(25, 8), kind: 'autocannon', level: 2 },
    { cell: idx(25, 15), kind: 'autocannon', level: 2 },
    { cell: idx(28, 8), kind: 'mortar', level: 1 },
  ];

  // LATE (CC3): triple line, max emplacements at level 3.
  const late: ReferenceBase = { name: 'LATE (CC3)', ccLevel: 3, walls: [], structures: [] };
  wallLine(late.walls, 17, 2, 21, [11, 12]);
  wallLine(late.walls, 21, 2, 21, [4, 5, 18, 19]);
  wallLine(late.walls, 25, 2, 21, [11, 12]);
  late.structures = [
    { cell: idx(19, 10), kind: 'm2nest', level: 3 },
    { cell: idx(19, 13), kind: 'm2nest', level: 3 },
    { cell: idx(23, 5), kind: 'm2nest', level: 3 },
    { cell: idx(23, 18), kind: 'm2nest', level: 3 },
    { cell: idx(27, 10), kind: 'autocannon', level: 3 },
    { cell: idx(27, 14), kind: 'autocannon', level: 3 },
    { cell: idx(22, 11), kind: 'autocannon', level: 3 },
    { cell: idx(29, 9), kind: 'mortar', level: 2 },
    { cell: idx(29, 14), kind: 'mortar', level: 2 },
  ];

  return [early, mid, late];
}

interface DefenseRow {
  stage: string;
  holdPct: number[];
}

function defenseMatrix(
  faction: FactionId,
  mods?: DefenderMods,
  extraStructures: LayoutStructure[] = [],
  orders?: StandingOrders,
): DefenseRow[] {
  const catalog = defenseCatalogFor(faction);
  const roster = enemyRosterFor(faction);
  const rows: DefenseRow[] = [];

  for (const base of referenceBases()) {
    const holds: number[] = [];
    for (const level of ASSAULT_LEVELS) {
      let held = 0;
      for (let i = 0; i < SEEDS; i++) {
        const config: SimConfig = {
          width: W,
          height: H,
          seed: seedOf(level, base.ccLevel, i),
          ccOrigin: CC_ORIGIN,
          ccLevel: base.ccLevel,
          spawnColumn: 0,
          // The shipped game rolls (v1.23). This matrix builds its config by
          // hand rather than through `battleConfig`, so it is the one place
          // that would quietly keep measuring the sim as it was.
          combatVersion: COMBAT_CURRENT,
          siege: { ...buildAssault(level, roster), startingSupplies: 0 },
          layout: {
            walls: base.walls.map((w) => ({ ...w })),
            structures: [...base.structures, ...extraStructures].map((s) => ({ ...s })),
          },
          // Orders rows fight with a typically-stocked magazine; bare rows
          // stay empty so every pre-v0.8 number is unchanged.
          powerCharges: orders ? { a10: 2, arty: 1 } : {},
          ...(orders ? { standingOrders: orders } : {}),
          ...(mods ? { mods: { defender: mods } } : {}),
        };
        const engine = new Engine(config, catalog);
        engine.enqueue({ tick: 0, type: 'startAssault' });
        while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) {
          engine.step();
        }
        if (engine.phase === 'victory') held++;
      }
      holds.push(Math.round((held / SEEDS) * 100));
    }
    rows.push({ stage: base.name, holdPct: holds });
  }
  return rows;
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
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
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
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
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
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
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
 * either — air is meant to buy speed and survival (fewer men lost) rather
 * than better odds against a post that expects it.
 */
function airTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `AIR — the ${flavor.faction} reference force vs ${flavor.enemy} posts, with and without AA`,
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
          // The control strips the AA order back out, which is what every
          // garrison looked like in v1.20.
          const g = built.garrison!;
          const config: SimConfig = aa
            ? built
            : { ...built, garrison: { ...g, rules: g.rules.filter((r) => r.hostiles !== 'air') } };
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
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

  const ground = row('GROUND', RAID_PLANS[faction], true);
  const airBare = row('AIR no AA', AIR_RAID_PLANS[faction], false);
  const airAA = row('AIR +AA', AIR_RAID_PLANS[faction], true);
  lines.push('');
  lines.push(
    `AIR'S EDGE OVER GROUND — without AA ${(airBare - ground >= 0 ? '+' : '')}` +
      `${(airBare - ground).toFixed(1)}  |  with AA ${(airAA - ground >= 0 ? '+' : '')}` +
      `${(airAA - ground).toFixed(1)}  (clear-rate points)`,
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
function carryTable(): string {
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
  const run = (faction: FactionId, cat: Catalog): number => {
    const squads = RAID_PLANS[faction].map((s, at) => ({ ...s, slot: at }));
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
    'WHO CARRIES A RAID — each unit kind silenced in turn, both damage channels',
    'FACTION | CARRY UNIT   | ITS MP | RAID IS | DEAD WEIGHT (MP delivering nothing)',
    '--------+--------------+--------+---------+------------------------------------',
  ];
  let topShare = 0;
  for (const faction of FACTION_IDS) {
    const cat = raidCatalogFor(faction);
    const base = run(faction, cat);
    const counts: Record<string, number> = {};
    for (const s of RAID_PLANS[faction]) {
      for (const [k, n] of Object.entries(s.units)) counts[k] = (counts[k] ?? 0) + n;
    }
    const mpOf = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
    const drops = Object.keys(counts).map((k) => ({ k, drop: base - run(faction, silence(cat, k)) }));
    drops.sort((a, b) => b.drop - a.drop);
    const carry = drops[0]!;
    const share = base > 0 ? (carry.drop / base) * 100 : 0;
    topShare = Math.max(topShare, share);
    const dead = drops
      .filter((d) => d.drop < 1.5)
      .reduce((a, d) => a + (mpOf[d.k] ?? 0) * (counts[d.k] ?? 0), 0);
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(carry.k, 12)} | ` +
        `${pad((mpOf[carry.k] ?? 0) * (counts[carry.k] ?? 0), 6)} | ${pad(`${share.toFixed(0)}%`, 7)} | ` +
        `${pad(`${dead} of ${planManpower(faction)} MP`, 35)}`,
    );
  }
  lines.push('');
  lines.push(
    `ONE UNIT IS UP TO ${topShare.toFixed(0)}% OF A RAID. Ending a raid means killing the command ` +
      'post; ranged fire is discounted hard against structures and melee only fires when ADJACENT,',
  );
  lines.push(
    '  so the heavy is the only unit that reliably survives to get there and hits hard when it does. ' +
      'Everything else is escort — and a buff to an escort buys nothing.',
  );
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
 * compositions per faction inside the manpower band at three unit kinds, and
 * screening all of them against three doctrines is half an hour of sim. The
 * sample is drawn from a fixed seed, so this is repeatable rather than a
 * one-off.
 */
function deriveTable(sampleSize = 200, air = false): string {
  const SCREEN_TIERS = [3];
  const SCREEN_ARCH: ArchetypeId[] = ['compound', 'keep', 'star', 'corridor'];
  const SCREEN_SEEDS = 2;
  const FINALISTS = 8;
  const seedFor = (i: number): number => ((i * 2654435761 + 977) & 0x7fffffff) >>> 0;

  /**
   * Every multiset of units inside the manpower band, at most three kinds.
   *
   * In air mode the pool is the whole roster rather than the airfield alone:
   * the shipped air plans are two squads of rotors and a ground tail, and a
   * search that could only fly would be answering a different question than
   * the one the reference asks. What makes a plan an AIR plan is that it must
   * contain something flown, which is filtered below.
   */
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
        if (n > 0 && kinds + 1 > 3) break;
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
    `IS THE ${air ? 'AIR ' : ''}REFERENCE PLAN ANY GOOD? — ${sampleSize} sampled compositions x 3 doctrines`,
    'FACTION | REF MP | REFERENCE | IN-SAMPL | HELD OUT | CURSE | GAIN | THE PLAN THAT BEAT IT',
    '--------+--------+-----------+----------+----------+-------+------+----------------------',
  ];
  const FULL_ARCH = ARCHETYPES.map((a) => a.id);
  let worst = 0;
  const winners: { faction: FactionId; squads: SquadPlan[] }[] = [];

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

    // Rank the finalists on the selection seeds...
    let best: { at: number; squads: SquadPlan[]; label: string } | null = null;
    for (const candidate of screened.slice(0, FINALISTS)) {
      const squads = spread(candidate.units, candidate.doctrine);
      const at = score(faction, squads, RAID_TIERS, FULL_ARCH, 3);
      if (best === null || at > best.at) {
        best = { at, squads, label: `${describe(candidate.units)} ${candidate.doctrine.toUpperCase()}` };
      }
    }
    // ...then score the winner and the reference on battles neither has seen.
    const reference = air ? AIR_RAID_PLANS[faction] : RAID_PLANS[faction];
    const refScore = score(faction, reference, RAID_TIERS, FULL_ARCH, 3, HELD_OUT);
    const held = best === null ? refScore : score(faction, best.squads, RAID_TIERS, FULL_ARCH, 3, HELD_OUT);
    const gain = held - refScore;
    const curse = best === null ? 0 : best.at - held;
    worst = Math.max(worst, gain);
    if (best !== null && gain > 0) winners.push({ faction, squads: best.squads });
    lines.push(
      `${pad(faction.toUpperCase(), 7)} | ${pad(planManpower(faction), 6)} | ${pad(refScore.toFixed(1), 9)} | ` +
        `${pad(best === null ? '—' : best.at.toFixed(1), 8)} | ${pad(held.toFixed(1), 8)} | ` +
        `${pad(curse.toFixed(1), 5)} | ${pad((gain >= 0 ? '+' : '') + gain.toFixed(1), 4)} | ` +
        `${best === null ? 'nothing beat it' : best.label}`,
    );
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
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
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
  // Tuning the rotation means running one table twenty times, not the whole
  // harness twenty times: `npm run balance -- --conditions` is that loop.
  if (process.argv.includes('--shapes')) {
    console.log(archetypeTable('usa'));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
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
        const taken = new Set<string>();
        const picks = wants.map((target) => {
          // Closest to the target, with a nudge toward shapes this faction has
          // not met yet. Selecting on difficulty alone collapses the roster:
          // `compound`, `camp` and `corridor` have the widest layout ranges,
          // so they can hit any target and the other five shapes stop being
          // dealt at all. The penalty is under half a quantum, so it breaks
          // ties and near-ties and never overrides a real difference.
          const best = measured
            .filter((m) => !taken.has(m.shape))
            .sort(
              (a, b) =>
                Math.abs(a.clear - target) +
                (seen.has(a.shape) ? COVERAGE_NUDGE : 0) -
                (Math.abs(b.clear - target) + (seen.has(b.shape) ? COVERAGE_NUDGE : 0)),
            )[0];
          if (best) {
            taken.add(best.shape);
            seen.add(best.shape);
          }
          return best;
        });
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
  // UN defense experiment: the Engineer Corps HQ parked behind the post,
  // its repair aura over the CC and the inner guns.
  const UN_ENG_BAY: LayoutStructure[] = [{ cell: idx(29, 11), kind: 'engBay', level: 1 }];
  // Air cover for the reference line: one mount forward of the wall, one over
  // the command post, which is what a player would actually build.
  const AA_COVER: LayoutStructure[] = [
    { cell: idx(24, 11), kind: 'aa', level: 2 },
    { cell: idx(29, 12), kind: 'aa', level: 2 },
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
  // Air against ground, per faction: the EDGE is the reading, and it is a
  // shadow of the ground-game spread rather than a fault of its own.
  for (const faction of FACTION_IDS) sections.push(airTable(faction));
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
  const body = sections.join('\n\n');
  console.log(body);
  console.log(
    `\n${FACTION_IDS.length * (RAID_TIERS.length + referenceBases().length * ASSAULT_LEVELS.length) * SEEDS * 1.5 | 0}+ battles in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  if (process.argv.includes('--md')) {
    const md = [
      '# Balance snapshot (v1.25)',
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
      '',
      '```',
      body,
      '```',
      '',
      '## Reading the tables (v0.8 pass)',
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
      '  can see; the Engineer Revetment (CP layer, 15 hp/s over 3 cells) is the live-play',
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
      '  conditions clear. It does: GROUND lands 6.6 points under FLAT on the mean, inside the',
      '  ±9 band, while the three sheets disagree with each other by forty points. Two of them',
      '  are walkovers for the reference force and one stops it dead at T3 and T5. That is the',
      '  whole point of putting a base somewhere rather than nowhere.',
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
      '- **Watch items for v0.6**: the EARLY L2→L3 cliff on all sides (armor arrives before',
      '  anti-armor requisitions), China MID vs L5+ (Javelin overwatch), and NK MID vs L4+',
      '  (everything kills sentry nests).',
      '- M7 changes behind these numbers: tunneled squads surface as one push around the mouth',
      '  after an 8s dig (reserved cells carry the mouths into replays), the Bulsae matches the',
      '  HJ-8 trade (46/58/72 at 0.5/s), the Koksan runs a 4.2s cadence with a 3.5 dead zone',
      '  in exchange for 10.5–11 reach, and v0.7 adds sustainment auras: healing is additive,',
      '  capped per target, and deterministic — it out-heals one gun, never two.',
      '',
    ].join('\n');
    writeFileSync('docs/BALANCE.md', md);
    console.log('docs/BALANCE.md written.');
  }
}

main();
