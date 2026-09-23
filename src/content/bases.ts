import { createRng, type Rng } from '../sim/rng';
import { scaleFootprint } from '../sim/scale';
import { generateTerrain, TERRAIN_VERSION } from '../sim/terrain';
import type { CellIndex, LayoutStructure, LayoutWall, SpawnEdge } from '../sim/types';

/**
 * Front Line base generator (M4): handcrafted layout templates + seeded
 * procedural mutation, scaled by tier. Fully deterministic per (tier,
 * variant) so scouting, raiding, and replays all agree on the world.
 */

/**
 * The board, in cells (M34: 10x15, a cell of two physical units).
 *
 * It was 32x24 through v1.39, which fitted a desktop window and nothing else:
 * 32 cells across a 360px phone is an 11px cell. v1.40 turned it upright to
 * 20x30 and bought the phone 18px. M34 halves it again, to 36px on the same
 * phone: twice the cell, so a thumb lands on the square it aims at and the
 * art reads at the size it is drawn. The catalog did not move — a cell is two
 * of its units now, and `MAP_CELL_SIZE` says so.
 */
export const MAP_W = 10;
export const MAP_H = 15;
/**
 * How many physical units one cell of the board spans (M34).
 *
 * The catalog is written in physical units — a range of 7 is seven of today's
 * cells — and a battle's `cellSize` says how many of those a cell of ITS board
 * is. This is the board the game is played on now, so it is what every helper
 * that sizes a thing on the map defaults to: a footprint, a range ring, the
 * air read. A replay of a battle on another board carries its own.
 */
export const MAP_CELL_SIZE = 2;
export const TARGETS_PER_TIER = 3;

/**
 * Which edge a generated base is attacked from, and the lane the attackers
 * walk in on. The town and the ladder share a world, so this is the town's
 * edge — see `TOWN_GRID`.
 */
/**
 * Does depth run DOWN the board or ACROSS it? The one switch the frame below
 * turns on. Annotated rather than inferred so the compiler keeps both arms of
 * every ternary live — narrowed to a literal it folds them and the other
 * arm stops being typechecked at all.
 */
const APPROACH_NORTH: boolean = true;

export const BASE_SPAWN_EDGE: SpawnEdge = APPROACH_NORTH ? 'north' : 'west';
export const BASE_SPAWN_LANE = 0;

/**
 * APPROACH SPACE — the frame every wall plan below is authored in.
 *
 * `u` is depth: how far into the base you are from the edge the attack comes
 * from. `v` runs along that edge. On the original west-entry board those were
 * literally x and y, which is why the plans read as they do; when the world
 * turned portrait in v1.40 the attack came from the north instead, and a plan
 * written in x and y would have had its corridors running the wrong way.
 *
 * So the plans keep their coordinates and the TRANSFORM moves, at the three
 * points where a plan emits something: `putWall`, `putStructure` and the
 * tower and economy spot lists. Eight shapes tuned over six releases stay
 * exactly as tuned, and the board underneath them can rotate.
 */
/** Depth: 15 cells of two units — the 30 of v1.40, at half the resolution. */
export const MAP_U = APPROACH_NORTH ? MAP_H : MAP_W;
/** Across: 10 cells. */
export const MAP_V = APPROACH_NORTH ? MAP_W : MAP_H;

/** Approach space to the real board. */
const realX = (u: number, v: number): number => (APPROACH_NORTH ? v : u);
const realY = (u: number, v: number): number => (APPROACH_NORTH ? u : v);

/** Which kinds a generated base is built from — one kit per defending faction. */
export interface BaseKit {
  /** Tower kinds by role: [basic anti-infantry, area denial, anti-armor]. */
  towers: [string, string, string];
  /**
   * The mount that can elevate (v1.0) — what makes an air raid a fight. It is
   * a dedicated air asset: a compound's air cover must not double as a quiet
   * ground-defence buff on every base in the ladder.
   */
  aa: string;
  cache: string;
  dump: string;
}

/** China's Front Line kit (the default: USA raids China). */
export const CHINA_BASE_KIT: BaseKit = {
  towers: ['hmgTower', 'qlzTower', 'atgmTower'],
  aa: 'aaSite',
  cache: 'supplyCache',
  dump: 'fuelDump',
};

/** USA firebases (what a China player raids). Mortars arrive at tier 3 —
 * two per compound before then erased PLA infantry raids outright (M5 pass). */
export const USA_BASE_KIT: BaseKit = {
  towers: ['m2nest', 'autocannon', 'mortar'],
  aa: 'aaSite',
  cache: 'supplyDepot',
  dump: 'fuelDepot',
};

export interface GeneratedBase {
  tier: number;
  variant: number;
  name: string;
  ccOrigin: CellIndex;
  ccLevel: number;
  walls: LayoutWall[];
  structures: LayoutStructure[];
  /** Which kind of problem this base is (v1.6). */
  archetype: ArchetypeId;
  /** The ground it sits on (v1.19). Derived, so it costs one number. */
  terrainSeed: number;
}

const idx = (x: number, y: number): CellIndex => y * MAP_W + x;
const ri = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

const CODENAMES = [
  'IRON SHED', 'RED LANTERN', 'BROKEN SPUR', 'PADDY GATE', 'COLD FORGE',
  'JADE WALL', 'GRANITE NEST', 'SILENT DYNAMO', 'ASH DEPOT', 'LOW THUNDER',
  'HOLLOW CROWN', 'BLACK TERRACE',
];

/**
 * How many guns a shape stands at a rung — climbing by at most one (v1.25).
 *
 * The baseline steps on even tiers, `min(8, 3 + floor(tier / 2))`, and each
 * shape scales it by its own multiplier. Rounding that product turned a 10%
 * bonus into an uneven staircase, because 4 x 1.1 rounds DOWN to 4 and
 * 5 x 1.1 rounds UP to 6:
 *
 *     shape           T1 T2 T3 T4 T5     steps
 *     compound         3  4  4  5  5   +1 +0 +1 +0
 *     star             3  4  4  6  6   +1 +0 +2 +0   <- two guns in one rung
 *     strongpoints     3  4  4  6  6   +1 +0 +2 +0   <- and again
 *     camp             2  3  3  3  3   +1 +0 +0 +0
 *
 * Star and strongpoints are the only shapes that gain two guns on one rung,
 * and they are exactly the two that fall out of the ladder there: `--deal`
 * priced the T3->T4 step at -32 overall, made up of every other shape losing
 * 4 to 18 points and these two losing **75 and 53**. The tier was never the
 * problem; a half-integer was.
 *
 * So a rung adds at most one gun, which is the invariant the ladder wants
 * anyway. Only these two shapes move — everything else already climbed by one
 * or zero — and the clamp hands the deferred gun back at T5 rather than
 * dropping it, so a shape that wants six guns still gets six.
 */
/**
 * The turn of the board changed what a rung is worth, and NOT by changing this
 * (v1.40).
 *
 * The first reading was that guns are laid along the entry line, so a rung is
 * guns per cell of that line, and a line that went 24 cells to 20 raised
 * coverage by a fifth for free. That is a reasonable argument and the
 * measurement rejected it: scaling the count by the frontage overshot, taking
 * a keep from 79.6 mean to 100.0 and leaving tier 4 such a walkover that a
 * +45% wall condition measured no difference at all. One gun is worth more
 * than the coverage effect, so the count is left exactly where six releases of
 * tuning put it and the residual shift is recorded in the roadmap instead.
 */
export function towerCountFor(tier: number, towers: number): number {
  const want = (t: number): number =>
    Math.max(
      1,
      Math.round(Math.min(8, 3 + Math.floor(t / 2)) * towers),
    );
  let count = want(1);
  for (let t = 2; t <= Math.max(1, tier); t++) count = Math.min(want(t), count + 1);
  return count;
}

export function structureLevelFor(tier: number): number {
  return Math.min(3, 1 + Math.floor((tier - 1) / 3));
}

/**
 * How far the upgrade has crept through the gun line at a rung (v1.21).
 *
 * `structureLevelFor` steps every third tier, and until v1.21 every gun on a
 * base stepped with it on the same rung. Measured over all eight shapes and
 * all five factions, that made the ladder one cliff rather than a curve:
 *
 *     rung      T1    T2    T3    T4    T5
 *     clear%   100    95    74    35    36
 *     step           -5   -21   -39    +1
 *
 * T3→T4 is where the level steps AND a gun is added; T4→T5 adds neither, so
 * T4 came out HARDER than T5 and a player who ground past the wall found the
 * next rung easier. Isolating the two terms on the same generated bases —
 * demote every level, or delete one gun — priced them at -16 and -12 of that
 * -39, with the rest the keep archetype entering the pool.
 *
 * So the upgrade now creeps instead of landing. This returns the share of the
 * gun line standing at the full ceiling; the rest sit one level back. Position
 * in the three-tier band is what drives it, which means the first rung of a
 * band gets a third of the line, the second two thirds, and the third all of
 * it — the same ceiling arrives, spread over three rungs instead of one.
 *
 * Below the first step (T1-T3, ceiling 1) there is no level to be one back
 * from, so nothing moves and the shallow rungs measure exactly as they did.
 */
export function upgradeShareFor(tier: number): number {
  return [1 / 3, 2 / 3, 1][Math.max(0, tier - 1) % 3]!;
}

class Occupancy {
  private cells = new Set<CellIndex>();

  block(cells: CellIndex[]): void {
    for (const c of cells) this.cells.add(c);
  }

  free(cells: CellIndex[]): boolean {
    // Clear of both edge columns: nothing is built on the ground a raider
    // enters along. It was two columns on the west and one on the east at
    // 20x30; one each, at two units a cell, is the same ground.
    return cells.every(
      (c) => !this.cells.has(c) && c >= 0 && c % MAP_W >= 1 && c % MAP_W <= MAP_W - 2 && c < MAP_W * MAP_H,
    );
  }
}

/**
 * The cells a building covers on this board. A 2x2 kind is one cell once a
 * cell is two units (M34), which is how the engine fights it — so that is
 * also what the generator reserves for it.
 */
const BIG = scaleFootprint(2, MAP_CELL_SIZE);
const footprintBig = (origin: CellIndex): CellIndex[] =>
  BIG === 1 ? [origin] : [origin, origin + 1, origin + MAP_W, origin + MAP_W + 1];


// ---- archetypes ------------------------------------------------------------------

export type ArchetypeId =
  | 'compound'
  | 'camp'
  | 'corridor'
  | 'star'
  | 'depot'
  | 'strongpoints'
  | 'keep'
  | 'bunker';

/** What a wall plan is handed, and what it hands back through towerSpots. */
export interface PlanContext {
  rng: Rng;
  tier: number;
  /** The command post, in APPROACH SPACE — `u` is depth, `v` is across. */
  ccU: number;
  ccV: number;
  putWall: (u: number, v: number) => void;
  /**
   * A cell nothing may be built on: the way through a gap the generic walkway
   * rule cannot see, like a breach in a DIAGONAL wall, whose cells touch only
   * at their corners (M34).
   */
  keepClear: (u: number, v: number) => void;
  /** Preferred gun positions, best first. The generator takes what fits. */
  towerSpots: [number, number][];
}

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** Six characters or fewer: the target row already carries a count. */
  short: string;
  /**
   * One line of what-this-is for the planner, drawn next to the shape's name.
   * Rows wrap since v1.13, so the suite's cap is editorial rather than
   * structural — the prose version lives in the GDD.
   */
  tag: string;
  /** First ladder tier this shape appears on. */
  fromTier: number;
  /** Guns, relative to the tier baseline. */
  towers: number;
  /** Caches and dumps, relative to the tier baseline — and so the loot. */
  economy: number;
  /** Extra structure levels: a bunker complex is built up, a camp is not. */
  levelBonus: number;
  walls: (ctx: PlanContext) => void;
  /** Override where the economy sits. Absent = the default ring. */
  economySpots?: (ctx: PlanContext) => [number, number][];
}

/**
 * Eight shapes, each a different question rather than the same question with
 * more hit points. Tier scales the numbers; the archetype decides whether the
 * numbers are even the problem — a bunker complex has almost no maze and all
 * the guns, a dispersed depot has almost no guns and all the loot, and a
 * corridor has one way in whatever force you brought.
 *
 * They unlock with depth so a tier-1 commander meets readable shapes first,
 * and the three targets offered at any tier are always three DIFFERENT ones.
 */
export const ARCHETYPES: Archetype[] = [
  {
    id: 'compound',
    name: 'COMPOUND',
    short: 'CMPD',
    tag: 'RING WITH GATES',
    fromTier: 1,
    towers: 1,
    economy: 1,
    levelBonus: 0,
    walls: planCompound,
  },
  {
    id: 'camp',
    name: 'OPEN CAMP',
    short: 'CAMP',
    tag: 'SOFT AND BARELY WIRED',
    fromTier: 1,
    towers: 0.65,
    // A quiet day, not a payday: measured at 1.4 the camp was easier AND
    // richer than the compound, which makes every other shape a mistake.
    economy: 1,
    levelBonus: 0,
    walls: planCamp,
  },
  {
    id: 'corridor',
    name: 'CORRIDOR',
    short: 'CORR',
    tag: 'ONE LONG WAY IN',
    fromTier: 1,
    towers: 1,
    economy: 0.9,
    levelBonus: 0,
    walls: planCorridor,
  },
  {
    id: 'star',
    name: 'STAR FORT',
    short: 'STAR',
    tag: 'DIAMOND, TWO BREACHES',
    fromTier: 2,
    towers: 1.1,
    economy: 1,
    levelBonus: 0,
    walls: planStar,
  },
  {
    id: 'depot',
    name: 'DISPERSED DEPOT',
    short: 'DEPOT',
    tag: 'STORES IN THE CORNERS',
    fromTier: 3,
    // A gun per pen, so stripping the corners costs something. Undefended,
    // this shape cleared 100% at every tier for the lowest losses on the
    // board — the richest day in the game and also the safest.
    towers: 1.2,
    economy: 1.4,
    levelBonus: 0,
    walls: planDepot,
    economySpots: depotSpots,
  },
  {
    id: 'strongpoints',
    name: 'STRONGPOINTS',
    short: 'PENS',
    tag: 'FOUR PENS, ONE POST',
    fromTier: 3,
    towers: 1.1,
    economy: 1.1,
    levelBonus: 0,
    walls: planStrongpoints,
  },
  {
    id: 'keep',
    name: 'KEEP',
    short: 'KEEP',
    tag: 'TWO RINGS, OFFSET GATES',
    fromTier: 4,
    towers: 1.2,
    economy: 0.8,
    levelBonus: 0,
    walls: planKeep,
  },
  {
    id: 'bunker',
    name: 'BUNKER COMPLEX',
    short: 'BUNKER',
    tag: 'NO WIRE, DEEP POSITIONS',
    fromTier: 5,
    /**
     * FEWER guns than a compound, not more — the harness overturned the
     * obvious design here. With no wall line, every gun engages from the
     * first second instead of waiting for a breach, so an open base with a
     * standard gun count is a wall: 0% clears at tier 5 with the doctrine
     * ceiling behind the force. Fewer positions, one level deeper, reads the
     * same and measures as the hardest shape on the board that can still be
     * taken (33-43% for the reference force).
     */
    towers: 0.65,
    economy: 1,
    levelBonus: 1,
    walls: planBunker,
  },
];

export const ARCHETYPE_BY_ID: Record<ArchetypeId, Archetype> = Object.fromEntries(
  ARCHETYPES.map((a) => [a.id, a]),
) as Record<ArchetypeId, Archetype>;

/**
 * How hard each shape is FOR EACH FACTION, hardest first (v1.21).
 *
 * Keyed by `FactionId` as a plain string, because `factions.ts` imports this
 * module and the reverse would be a cycle. `tests/archetypes.test.ts` holds the
 * keys to `FACTION_IDS` exactly, which is where a typo would otherwise hide.
 *
 * Measured, not guessed: `npm run balance -- --pressure` prints this literal
 * ready to paste, which is the point — hand-copying measurements into content
 * is how this project has put wrong numbers into comments before. Each shape is
 * averaged over the rungs it can actually be DEALT on (`tier >= fromTier`);
 * folding in the rest flatters shapes that unlock late, since a bunker forced
 * onto T1 clears 100% and nobody is ever offered one there.
 *
 * The orderings genuinely differ, which is the whole reason this is a table
 * and not a number on `Archetype`. A KEEP is the hardest thing Russia meets
 * and the fourth-hardest for the USA. A CAMP is everyone's breather and the
 * USA's third-hardest target. v1.21 first tried one ordering averaged across
 * all five and it graded a rung for none of them: the USA went to 100% on
 * every rung and the faction spread widened. See the ROADMAP.
 *
 *     USA     bunker 67 < star 80 < camp 91 < keep 97 < (four tied at 100)
 *     CHINA   bunker  7 < strongpoints 22 < star 42 < depot 56 < keep 57 …
 *     RUSSIA  keep   17 < strongpoints 22 < bunker 33 < star 33 < depot 56 …
 *     NK      bunker  0 < keep 0 < strongpoints 13 < star 25 < depot 44 …
 *     UN      bunker  7 < keep 30 < strongpoints 40 < star 52 < depot 58 …
 */
export const DEAL_ORDER: Record<string, ArchetypeId[]> = {
  usa: ['bunker', 'star', 'camp', 'keep', 'compound', 'corridor', 'depot', 'strongpoints'],
  china: ['bunker', 'strongpoints', 'star', 'depot', 'keep', 'compound', 'camp', 'corridor'],
  russia: ['keep', 'strongpoints', 'bunker', 'star', 'depot', 'corridor', 'compound', 'camp'],
  nk: ['bunker', 'keep', 'strongpoints', 'star', 'depot', 'compound', 'corridor', 'camp'],
  un: ['bunker', 'keep', 'strongpoints', 'star', 'depot', 'corridor', 'compound', 'camp'],
};

/**
 * For a caller with no faction in hand — tools and tests that force a shape
 * anyway. Mean RANK across the five rather than mean clear rate, so the USA's
 * saturated rows (four shapes tied at 100%) cannot drown out the orderings of
 * the factions that can actually tell the shapes apart.
 */
const DEAL_ORDER_NEUTRAL: ArchetypeId[] = [
  'bunker', 'keep', 'star', 'strongpoints', 'depot', 'compound', 'corridor', 'camp',
];


/** A dealt target: which shape, and which of its layouts. */
export type DealPair = readonly [ArchetypeId, number];

/**
 * The three targets a rung offers, chosen by MEASUREMENT (v1.32).
 *
 * Regenerate with `npm run balance -- --layouts`, which emits this as source.
 *
 * ## Why a table and not a rule
 *
 * v1.30 recorded a negative result: the deal could not be used to fix the
 * ladder without costing parity, because both were steered by the same lever —
 * which shape lands in which difficulty band. That lever is too coarse. There
 * are eight shapes and five rungs, shape explains well under half the variance
 * in clear rate, and the LAYOUT explains most of the rest. The generator drew
 * the layout from `variant`, the slot index, so a rung's three targets were a
 * shape band and a difficulty lottery: two rungs could swap places, and the
 * USA's rung 4 measured easier than its rung 3.
 *
 * Decoupling the shape from the layout makes the deal a real tuning surface. A
 * target is a PAIR, the layout pool is wide, and a pair can be chosen to land
 * on a number rather than in a band. The ladder and parity then stop competing:
 * give every faction the same target curve and both are satisfied at once.
 *
 * ## The curve
 *
 * Clear rate at the faction's own reference plan — the force parity is
 * measured with — falling 100 / 95 / 85 / 70 / 55 across the rungs, with the
 * three targets at a rung spread ±15 around it. A steeper top was tried and
 * measured: it separates the last two rungs on the budget grid and costs
 * parity, 5.8 to 8.6 on seeds the selection never saw, because down at a 40%
 * clear rate the same seed noise is a much larger share of the number and the
 * factions spread out under it. Slot 0 is the heavy fight, slot 2 the one you
 * can take today, slot 1 the reason to think about it.
 *
 * The early rungs saturate near 100 for everyone. That is not a defect here:
 * everyone at 100 is a spread of zero, and a starter rung should be beatable.
 *
 * ## How the three are chosen
 *
 * All at once, not one after another. Filling slot 0 with the closest pair and
 * then slot 1 from what is left does not merely miss a target — it SPENDS the
 * pair another slot needed. China's T3 wanted 70 / 85 / 100 and greedy gave it
 * 58 / 92 / 100 for exactly that reason. Only the best pair per (shape, target)
 * can be in a winning triple, so the search is eight candidates per slot and
 * exhaustive over distinct-shape triples: instant, and it cannot make that
 * mistake. It moved parity from 5.8 to 4.2.
 *
 * The score also carries a small penalty for a shape the faction has already
 * met, because difficulty alone collapses the roster — `compound`, `camp` and
 * `corridor` have the widest layout ranges, so they can hit any target and the
 * other five stop being dealt at all. With the nudge, all eight reach every
 * faction across the ladder.
 *
 * The numbers after each row are the clear rates the row was selected for.
 */
export const DEAL_TABLE: Record<string, readonly (readonly DealPair[])[]> = {
  usa: [
    [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
    [['compound', 0], ['camp', 0], ['star', 0]], // T2 100/100/100
    [['corridor', 11], ['camp', 11], ['depot', 0]], // T3 75/83/100
    [['star', 7], ['keep', 1], ['strongpoints', 10]], // T4 50/67/83
    [['bunker', 5], ['corridor', 0], ['star', 5]], // T5 42/58/67
  ],
  china: [
    [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
    [['compound', 3], ['camp', 0], ['star', 0]], // T2 92/100/100
    [['star', 7], ['depot', 5], ['strongpoints', 0]], // T3 58/92/100
    [['compound', 2], ['strongpoints', 1], ['keep', 11]], // T4 58/67/83
    [['compound', 8], ['strongpoints', 2], ['bunker', 2]], // T5 42/58/67
  ],
  russia: [
    [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
    [['compound', 5], ['camp', 0], ['star', 0]], // T2 92/100/100
    [['camp', 1], ['corridor', 2], ['depot', 0]], // T3 67/83/100
    [['strongpoints', 7], ['keep', 10], ['compound', 6]], // T4 50/75/83
    [['camp', 4], ['bunker', 2], ['compound', 11]], // T5 42/50/67
  ],
  nk: [
    [['compound', 0], ['camp', 0], ['corridor', 2]], // T1 92/100/100
    [['compound', 2], ['corridor', 1], ['star', 0]], // T2 83/92/100
    [['depot', 3], ['compound', 2], ['strongpoints', 0]], // T3 67/83/100
    [['compound', 0], ['keep', 10], ['camp', 2]], // T4 58/75/83
    [['compound', 7], ['corridor', 1], ['bunker', 6]], // T5 42/58/75
  ],
  un: [
    [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
    [['camp', 7], ['corridor', 0], ['star', 0]], // T2 92/92/100
    [['star', 10], ['compound', 11], ['depot', 0]], // T3 67/83/100
    [['compound', 1], ['keep', 6], ['strongpoints', 9]], // T4 58/67/83
    [['bunker', 0], ['compound', 7], ['strongpoints', 5]], // T5 42/58/67
  ],
};

/**
 * What a rung deals in slot `slot`, or undefined for a faction or rung the
 * table does not cover.
 *
 * Above the top row the shapes stay at the hard end and only the layout moves
 * on, so a deep rung is a new problem of the same weight rather than the exact
 * board the player just cleared.
 */
export function dealPairFor(
  tier: number,
  slot: number,
  faction?: string,
): DealPair | undefined {
  const rows = faction ? DEAL_TABLE[faction] : undefined;
  if (!rows || rows.length === 0) return undefined;
  const at = Math.min(Math.max(1, tier), rows.length) - 1;
  const row = rows[at];
  const pair = row?.[((slot % TARGETS_PER_TIER) + TARGETS_PER_TIER) % TARGETS_PER_TIER];
  if (!pair) return undefined;
  const deeper = Math.max(0, tier - rows.length);
  return deeper === 0 ? pair : [pair[0], pair[1] + deeper * TARGETS_PER_TIER];
}

/**
 * Which shape a target is. Deterministic in (tier, variant, faction), so
 * scouting, raiding and replaying all agree.
 *
 * A rung's three targets are drawn one per DIFFICULTY BAND, not three at
 * random from the pool. This file always promised that "a choice between
 * identical problems is not a choice" and then enforced only half of it: the
 * old shuffle guaranteed three distinct SILHOUETTES and said nothing about
 * three distinct difficulties, so three shapes that were all impossible passed
 * the check as readily as a real choice. Measured with `--deal`, that is what
 * it dealt — four of the eight shapes ever appeared, `compound` on all five
 * rungs, `depot` on none, and T5 put the two hardest shapes in the game
 * together for every faction at once.
 *
 * `DEAL_ORDER[faction]` ranks the pool, three contiguous bands cut it, and one
 * target comes out of each: slot 0 is the heavy fight, slot 2 the one you can
 * take today, slot 1 the reason to think about it. The per-tier stream still
 * decides WHICH shape comes out of each band, so rungs differ from one another
 * while a rung's own three stay fixed forever.
 */
export function archetypeFor(tier: number, variant: number, faction?: string): Archetype {
  const pool = ARCHETYPES.filter((a) => a.fromTier <= Math.max(1, tier));
  const order = (faction ? DEAL_ORDER[faction] : undefined) ?? DEAL_ORDER_NEUTRAL;
  // Hardest first. A shape missing from the ordering sorts last rather than
  // throwing: a new archetype should show up as an easy target, not a crash.
  const rank = (a: Archetype): number => {
    const at = order.indexOf(a.id);
    return at < 0 ? order.length : at;
  };
  const ranked = [...pool].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const slots = Math.max(1, Math.min(TARGETS_PER_TIER, ranked.length));
  const slot = ((variant % slots) + slots) % slots;
  // One draw per band, in band order, so a slot consumes the stream the same
  // way however it is asked for — `archetypeFor(t, 2)` must not depend on
  // whether anybody asked for slot 0 first.
  const rng = createRng(((tier * 2654435761) ^ 0x5f3a) >>> 0);
  let picked = ranked[0]!;
  for (let s = 0; s < slots; s++) {
    const lo = Math.floor((s * ranked.length) / slots);
    const hi = Math.floor(((s + 1) * ranked.length) / slots);
    const choice = ranked[lo + Math.floor(rng() * (hi - lo))] ?? ranked[lo]!;
    if (s === slot) picked = choice;
  }
  return picked;
}

// ---- wall plans ------------------------------------------------------------------

/**
 * The largest ring radius that still fits the frontage, centred on `v`.
 *
 * A ring wider than the line does not make a bigger ring: `putWall` drops what
 * it cannot place, so it makes a ring with HOLES IN ITS TIPS — and these two
 * shapes exist to be the one way in. Capping keeps the radius the shape wants
 * wherever there is room for it.
 */
function ringFit(v: number, want: number): number {
  return Math.max(2, Math.min(want, v - 1, MAP_V - 2 - v));
}

// The eight plans below are DRAWN for the 10x15 board (M34), not mapped onto
// it. Mapping halves every coordinate, and a one-cell line keeps only the
// blocks it fills half of, so a mapped plan loses its line ends, its stubs and
// its gates. These keep each shape's design at the new resolution — the same
// walls in the same places relative to the post, the same gates, the same
// eight gun spots best-first — with every distance halved and rounded to what
// a cell of two units can say. A gate is one cell: two units, where it was
// three at 20x30, because a two-cell gate on a ten-cell line is a fifth of it.
// Guns are one cell on both boards and never sit in the only cell below a
// gate, which on a one-row pocket would be a wall across it.

/** Walled rectangle with two or three gates, guns on the corners and gates. */
function planCompound(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  // Four cells out, never three: the rectangle holds the post, up to eight
  // guns and the stores, and at three its inside is 25 cells, which packed
  // shut around its own gates on one base in fourteen.
  const margin = ri(rng, 4, 4);
  const x0 = Math.max(2, ccU - margin);
  const x1 = Math.min(MAP_U - 2, ccU + margin);
  const y0 = Math.max(1, ccV - margin);
  const y1 = Math.min(MAP_V - 2, ccV + margin);
  const gates = new Set<number>();
  const gateCount = ri(rng, 2, 3);
  for (let g = 0; g < gateCount; g++) gates.add(ri(rng, 0, 3));
  const gateAt = (side: number): boolean => gates.has(side);
  const gatePos = [
    ri(rng, x0 + 1, x1 - 1),
    ri(rng, x0 + 1, x1 - 1),
    ri(rng, y0 + 1, y1 - 1),
    ri(rng, y0 + 1, y1 - 1),
  ];
  for (let x = x0; x <= x1; x++) {
    if (!(gateAt(0) && x === gatePos[0])) putWall(x, y0);
    if (!(gateAt(1) && x === gatePos[1])) putWall(x, y1);
  }
  for (let y = y0; y <= y1; y++) {
    if (!(gateAt(2) && y === gatePos[2])) putWall(x0, y);
    if (!(gateAt(3) && y === gatePos[3])) putWall(x1, y);
  }
  towerSpots.push(
    [x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y1 - 1],
    [gatePos[0]!, y0 + 2], [gatePos[1]!, y1 - 2], [x0 + 2, gatePos[2]!], [x1 - 2, gatePos[3]!],
  );
}

/** Diamond ring with two breaches. */
function planStar(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  const cx = ccU;
  const cy = ccV;
  const r = ringFit(cy, ri(rng, 3, 4));
  const breachA = ri(rng, 0, 3);
  const breachB = (breachA + ri(rng, 1, 3)) % 4;
  for (let dx = -r; dx <= r; dx++) {
    const dy = r - Math.abs(dx);
    for (const sign of [1, -1]) {
      const x = cx + dx;
      const y = cy + sign * dy;
      const quadrant = (dx >= 0 ? 0 : 1) + (sign > 0 ? 0 : 2);
      // The middle of the quadrant's edge: two cells on a radius-3 diamond,
      // the same share of the edge the three-cell breach was at radius 7.
      const isBreach =
        (quadrant === breachA || quadrant === breachB) && Math.abs(Math.abs(dx) - r / 2) < 1;
      if (!isBreach) putWall(x, y);
      if (sign === -1 && dy === 0) break; // avoid double-placing the tips
    }
  }
  // A diamond's walls touch only at their corners, and a walker moves in four
  // directions, so the only ways in are the breaches — and at radius 3 the
  // cell behind a breach is the diagonal next to the post, which is where the
  // spots below put a gun. Kept clear, or a star fort is a sealed one.
  for (const q of [breachA, breachB]) {
    c.keepClear(cx + (q % 2 === 0 ? 1 : -1), cy + (q < 2 ? 1 : -1));
  }
  towerSpots.push(
    [cx + r - 1, cy], [cx - r + 1, cy], [cx, cy + r - 1], [cx, cy - r + 1],
    [cx + 1, cy + 1], [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1],
  );
}

/** Two offset wall lines north of the post: a forced serpentine. */
function planCorridor(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  // Two rows of pocket between the lines, so a gun can stand in it without
  // standing across it.
  const lineA = ccU - 5;
  const lineB = ccU - 2;
  const gapA = ri(rng, 1, 3);
  // The far gap, on the opposite half of the line from the near one.
  const gapB = ri(rng, 6, 8);
  for (let y = 1; y <= MAP_V - 2; y++) {
    if (y !== gapA) putWall(lineA, y);
    if (y !== gapB) putWall(lineB, y);
  }
  for (let x = lineB; x <= Math.min(MAP_U - 2, ccU + 3); x++) {
    putWall(x, 1);
    putWall(x, MAP_V - 2);
  }
  towerSpots.push(
    [lineA + 2, gapA], [lineB + 1, gapB - 1], [lineA + 2, gapB],
    [ccU - 1, ccV - 2], [ccU - 1, ccV + 2], [ccU + 1, ccV - 2], [ccU + 1, ccV + 2],
    [lineA + 2, Math.floor(MAP_V / 2)],
  );
}

/**
 * A token perimeter and nothing else: four short stubs that shape the approach
 * without ever forcing a breach. The guns are spread thin because there are
 * not many of them.
 */
function planCamp(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  const r = ringFit(ccV, ri(rng, 3, 3));
  // Two short of the radius, so the stubs never meet at a corner. A stub one
  // short closes the ring for a walker that moves in four directions — its
  // ends touch diagonally — and at 20x30 that sealed a third of the camps this
  // shape exists to leave open.
  const stub = r - 2;
  for (let i = -stub; i <= stub; i++) {
    putWall(ccU + i, ccV - r);
    putWall(ccU + i, ccV + r);
    putWall(ccU - r, ccV + i);
    putWall(ccU + r, ccV + i);
  }
  towerSpots.push(
    [ccU, ccV - r + 1], [ccU, ccV + r - 1], [ccU - r + 1, ccV], [ccU + r - 1, ccV],
    [ccU - 2, ccV - 2], [ccU + 2, ccV + 2], [ccU + 2, ccV - 2], [ccU - 2, ccV + 2],
  );
}

/**
 * Stores at the four corners of the map, each in a small pen; the post itself
 * gets a light ring. Killing the command post is easy and barely dents the
 * destruction score, so this is the shape that rewards RAZE and several
 * entry sectors instead of one heavy push.
 */
function planDepot(c: PlanContext): void {
  const { ccU, ccV, putWall, towerSpots } = c;
  // Two out, always: the 20x30 ring's three or four, at two units a cell,
  // with room inside it for the post and a gun on each side.
  const r = 2;
  // Walls on the ring's corners and half-sides, with its four gates at the
  // middle of each side — one cell, as every gate on this board is.
  for (let i = -r; i <= r; i++) {
    if (i !== 0) {
      putWall(ccU + i, ccV - r);
      putWall(ccU + i, ccV + r);
      putWall(ccU - r, ccV + i);
      putWall(ccU + r, ccV + i);
    }
  }
  for (const [px, py] of depotSpots(c)) {
    // A pen is its four corners: enough to say "this is a pen", open on
    // every side, which is what the five-cell pens at 20x30 were at a quarter
    // of the scale.
    putWall(px - 1, py - 1);
    putWall(px - 1, py + 1);
    putWall(px + 1, py - 1);
    putWall(px + 1, py + 1);
    towerSpots.push([px - 2, py]);
  }
  towerSpots.push([ccU, ccV - r - 1], [ccU, ccV + r + 1], [ccU - r - 1, ccV], [ccU + r + 1, ccV]);
}

/** The four corner pens a dispersed depot keeps its stores in. */
function depotSpots(c: PlanContext): [number, number][] {
  const { rng } = c;
  const inset = ri(rng, 0, 1);
  return [
    [3 + inset, 2],
    [MAP_U - 3 - inset, 2],
    [3 + inset, MAP_V - 3],
    [MAP_U - 3 - inset, MAP_V - 3],
  ];
}

/**
 * Four small walled pens spread across the middle band, one of them holding
 * the command post. Each has its own gun, so a single squad walking the map
 * gets shot at by one pen while breaking into another.
 */
function planStrongpoints(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  const pens: [number, number][] = [
    [ccU, ccV],
    [ccU - ri(rng, 4, 5), ccV - ri(rng, 2, 3)],
    [ccU - ri(rng, 4, 5), ccV + ri(rng, 2, 3)],
    [ccU + ri(rng, 3, 4), ccV + ri(rng, 2, 3) * (rng() < 0.5 ? -1 : 1)],
  ];
  pens.forEach(([px, py], index) => {
    const r = index === 0 ? 2 : 1;
    const gap = ri(rng, -1, 1) * (index === 0 ? 1 : 0);
    for (let i = -r; i <= r; i++) {
      if (i !== gap) {
        putWall(px + i, py - r);
        putWall(px + i, py + r);
      }
      if (i !== -gap) {
        putWall(px - r, py + i);
        putWall(px + r, py + i);
      }
    }
    // The command post's pen has room for a gun beside it; a small pen's gun
    // IS what it holds.
    towerSpots.push([px + (index === 0 ? 1 : 0), py + (index === 0 ? -1 : 0)]);
  });
  towerSpots.push([ccU - 3, ccV], [ccU + 3, ccV], [ccU, ccV - 3], [ccU, ccV + 3]);
}

/**
 * Two concentric rings with their gates on opposite sides, so the way in is
 * long even though the base is small, and the guns between the rings all cover
 * each other. The shape that rewards spending ordnance before walking in.
 *
 * At 10x15 the outer ring is deeper than it is wide (M34). A square one can be
 * three cells from the post at most across a ten-cell line, which leaves ONE
 * row between the rings — and a gun standing in a one-row corridor is a wall
 * across it: 81 of 84 keeps came out sealed. Four rows deep and three across,
 * the bands in front of and behind the post are two rows, and the guns stand
 * in their outer row with the walk going past them.
 */
function planKeep(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  const inner = 1;
  const outerV = ringFit(ccV, ri(rng, 3, 4));
  const outerU = outerV + 1;
  const innerGate = ri(rng, 0, 3);
  const outerGate = (innerGate + 2) % 4;
  // Sides 0 and 1 are the walls ACROSS from the post, 2 and 3 the faces in
  // front of it and behind it; a gate is the middle cell of its side.
  const ring = (ru: number, rv: number, gate: number): void => {
    for (let i = -ru; i <= ru; i++) {
      if (!(gate === 0 && i === 0)) putWall(ccU + i, ccV - rv);
      if (!(gate === 1 && i === 0)) putWall(ccU + i, ccV + rv);
    }
    for (let i = -rv; i <= rv; i++) {
      if (!(gate === 2 && i === 0)) putWall(ccU - ru, ccV + i);
      if (!(gate === 3 && i === 0)) putWall(ccU + ru, ccV + i);
    }
  };
  ring(inner, inner, innerGate);
  ring(outerU, outerV, outerGate);
  // The ring of cells right outside the inner ring is the walk between the
  // gates, and it is kept clear: two structures in one column of a two-row
  // band close it as surely as one in a one-row corridor.
  for (let du = -2; du <= 2; du++) {
    for (let dv = -2; dv <= 2; dv++) {
      if (Math.max(Math.abs(du), Math.abs(dv)) === 2) c.keepClear(ccU + du, ccV + dv);
    }
  }
  const band = outerU - 1;
  towerSpots.push(
    [ccU - band, ccV - 2], [ccU - band, ccV + 2], [ccU + band, ccV - 2], [ccU + band, ccV + 2],
    [ccU - band, ccV], [ccU + band, ccV], [ccU - band, ccV - 1], [ccU + band, ccV + 1],
  );
}

/**
 * One thick arc of wall on the likely approach and nothing anywhere else. The
 * maze is not the problem here; the guns are, and they are laid out in depth
 * so a force that walks straight in is engaged the whole way.
 */
function planBunker(c: PlanContext): void {
  const { rng, ccU, ccV, putWall, towerSpots } = c;
  // One row: two units thick, which is what the two rows of 20x30 were.
  const face = ccU - 3;
  const half = ri(rng, 2, 3);
  for (let y = ccV - half; y <= ccV + half; y++) {
    if (y !== ccV) putWall(face, y);
  }
  towerSpots.push(
    [face + 1, ccV - 2], [face + 1, ccV + 2], [face + 2, ccV + 1],
    [ccU - 1, ccV - 2], [ccU - 1, ccV + 2], [ccU + 1, ccV - 1], [ccU + 1, ccV + 1],
    [ccU, ccV - 3], [ccU, ccV + 3], [face + 1, ccV - 3], [face + 1, ccV + 3],
  );
}

/**
 * `force` overrides which shape is built without touching the seed — the
 * balance harness needs to compare all eight archetypes at the SAME tier, and
 * only three of them are ever offered at one.
 */
export function generateBase(
  tier: number,
  variant: number,
  kit: BaseKit = CHINA_BASE_KIT,
  force?: ArchetypeId,
  faction?: string,
): GeneratedBase {
  // The deal names a SHAPE and a LAYOUT (v1.31). Before, both came from
  // `variant` — the slot index — so which board a slot showed was whatever
  // seed that slot happened to be, and a rung's difficulty was a lottery on
  // top of its shape band. `force` still overrides the shape and takes the
  // layout from `variant`, which is how the harness compares all eight shapes
  // on the same ground.
  const dealt = force ? undefined : dealPairFor(tier, variant, faction);
  const layout = dealt ? dealt[1] : variant;
  const seed = (tier * 7919 + layout * 104729 + 12345) >>> 0;
  const rng = createRng(seed);
  // `faction` picks the DEAL, not the layout: two factions share a base kit
  // (`baseKitFor`), so the ground is the same and only which of the eight
  // shapes lands in which slot changes. Passing it is what makes a rung offer
  // a KPA commander a graded choice rather than the USA's graded choice.
  const arch = force
    ? ARCHETYPE_BY_ID[force]
    : dealt
      ? (ARCHETYPE_BY_ID[dealt[0]] ?? archetypeFor(tier, variant, faction))
      : archetypeFor(tier, variant, faction);
  const level = Math.min(3, structureLevelFor(tier) + arch.levelBonus);
  const occupancy = new Occupancy();
  const walls: LayoutWall[] = [];
  const structures: LayoutStructure[] = [];

  // The ground comes first, and from its OWN stream — drawing it from `rng`
  // would move every base layout that has ever been generated for a given
  // (tier, variant). Water is then blocked out of the occupancy map, so the
  // builders below route around the river instead of into it. Both `put`
  // helpers already fail soft, and the tower loop has a fallback ring, so
  // this costs a placement here and there and never an exception.
  //
  // The command post is rolled with no occupancy check of its own, so the box
  // it can land in is handed to the generator as ground to keep dry.
  const terrainSeed = (Math.imul(seed, 2654435761) ^ 0x517cc1b7) >>> 0;
  const ccBox: CellIndex[] = [];
  for (let v = 4; v <= 5; v++) {
    for (let u = 6; u <= 8; u++) ccBox.push(idx(realX(u, v), realY(u, v)));
  }
  const terrain = generateTerrain(
    terrainSeed,
    TERRAIN_VERSION,
    MAP_W,
    MAP_H,
    ccBox,
    BASE_SPAWN_LANE,
    BASE_SPAWN_EDGE,
    MAP_CELL_SIZE,
  );
  const water: CellIndex[] = [];
  for (let cell = 0; cell < MAP_W * MAP_H; cell++) {
    if (!terrain.passable(cell)) water.push(cell);
  }
  occupancy.block(water);

  // The post sits deep and central: `ccU` is how far in from the attack, `ccV`
  // how far along the line. Rows 6-8 of 15 and columns 4-5 of 10 are the
  // 12-16 and 8-10 of 20x30 at two units a cell; the box above keeps them dry.
  const ccU = ri(rng, 6, 8);
  const ccV = ri(rng, 4, 5);
  const ccOrigin = idx(realX(ccU, ccV), realY(ccU, ccV));
  occupancy.block(footprintBig(ccOrigin));

  const putStructure = (
    kind: string,
    u: number,
    v: number,
    big: boolean,
    at = level,
  ): boolean => {
    const origin = idx(realX(u, v), realY(u, v));
    const cells = big ? footprintBig(origin) : [origin];
    const reach = cells.length > 1 ? 1 : 0;
    if (u < 1 || u + reach > MAP_U - 1 || v < 1 || v + reach > MAP_V - 2 || !occupancy.free(cells)) {
      return false;
    }
    occupancy.block(cells);
    // Compound mounts stay at level 1 however deep the ladder goes. They are
    // there to answer rotors, not to be a quiet ground-defence buff on every
    // base a raider has to cross — flak is priced badly against the ground,
    // and an upgraded one at tier 5 would still be another gun in the line.
    structures.push({ cell: origin, kind, level: kind === kit.aa ? 1 : at });
    return true;
  };

  const putWall = (u: number, v: number): void => {
    // Clear of the entry row, as two rows of 20x30 were, and of both edges.
    if (u < 1 || u > MAP_U - 2 || v < 1 || v > MAP_V - 2) return;
    const cell = idx(realX(u, v), realY(u, v));
    if (!occupancy.free([cell])) return;
    occupancy.block([cell]);
    walls.push({ cell, kind: 'wall' });
  };

  const towerSpots: [number, number][] = [];
  const declared: CellIndex[] = [];
  const keepClear = (u: number, v: number): void => {
    if (u < 0 || u >= MAP_U || v < 0 || v >= MAP_V) return;
    declared.push(idx(realX(u, v), realY(u, v)));
  };
  // The post's four sides are always a way to stand at it. At 20x30 it was
  // two cells wide with eight around it; one cell has four, and four guns
  // jittered onto them made a post nobody could reach without breaking one.
  keepClear(ccU - 1, ccV);
  keepClear(ccU + 1, ccV);
  keepClear(ccU, ccV - 1);
  keepClear(ccU, ccV + 1);
  const plan: PlanContext = { rng, tier, ccU, ccV, putWall, keepClear, towerSpots };

  // ---- walls: the archetype decides the shape of the problem ----
  // First, since M34, and then the walkways they leave are kept clear. At
  // 20x30 a gate was three cells and a corridor between rings three wide, so
  // nothing that landed in one could close it; at two units a cell both are
  // one cell, and a store or a gun in it IS the way in, closed. A walkway is
  // any open cell with wall on two opposite sides — a gate in a line, a cell
  // of a one-wide corridor — together with the open cells in front of and
  // behind it. Nothing is built there, and the walls-first order is what lets
  // the economy see where they are.
  arch.walls(plan);
  const wallAt = new Set(walls.map((w) => w.cell));
  const isWall = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && wallAt.has(y * MAP_W + x);
  const walkway: CellIndex[] = [];
  for (let cell = 0; cell < MAP_W * MAP_H; cell++) {
    if (wallAt.has(cell)) continue;
    const x = cell % MAP_W;
    const y = Math.floor(cell / MAP_W);
    const across = isWall(x - 1, y) && isWall(x + 1, y);
    const along = isWall(x, y - 1) && isWall(x, y + 1);
    if (!across && !along) continue;
    walkway.push(cell);
    // In front of and behind a gap in a LINE: the cells a gate opens onto. A
    // line is wall that carries on past the gap's own two neighbours; a pen's
    // four corners do not, and a store in the middle of its pen blocks nobody.
    if (across && (isWall(x - 2, y) || isWall(x + 2, y))) {
      if (y > 0 && !wallAt.has(cell - MAP_W)) walkway.push(cell - MAP_W);
      if (y < MAP_H - 1 && !wallAt.has(cell + MAP_W)) walkway.push(cell + MAP_W);
    }
    if (along && (isWall(x, y - 2) || isWall(x, y + 2))) {
      if (x > 0 && !wallAt.has(cell - 1)) walkway.push(cell - 1);
      if (x < MAP_W - 1 && !wallAt.has(cell + 1)) walkway.push(cell + 1);
    }
  }
  occupancy.block(walkway);
  occupancy.block(declared);

  // ---- economy: caches and dumps, where the shape keeps them ----
  const cacheCount = Math.max(1, Math.round(Math.min(4, 2 + Math.floor(tier / 3)) * arch.economy));
  const dumpCount = Math.max(1, Math.round(Math.min(3, 1 + Math.floor(tier / 4)) * arch.economy));
  const economySpots: [number, number][] = arch.economySpots?.(plan) ?? [
    [ccU - 3, ccV - 2], [ccU + 2, ccV - 2], [ccU - 3, ccV + 2], [ccU + 2, ccV + 2],
    [ccU - 3, ccV], [ccU + 3, ccV], [ccU, ccV - 3], [ccU, ccV + 3],
  ];
  // Seeded shuffle.
  for (let i = economySpots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [economySpots[i], economySpots[j]] = [economySpots[j]!, economySpots[i]!];
  }
  let spotIndex = 0;
  const nextSpot = (): [number, number] | null =>
    spotIndex < economySpots.length ? economySpots[spotIndex++]! : null;
  // The jitter is variety, and a store is loot, so it is never lost to it:
  // the jittered cell, then the spot itself, then outward ring by ring. A wall
  // or a walkway can hold a store's spot now, which it could not when stores
  // went down before the walls.
  const putStore = (kind: string, u: number, v: number, du: number, dv: number): void => {
    if (putStructure(kind, u + du, v + dv, true)) return;
    for (let r = 0; r <= 2; r++) {
      for (let a = -r; a <= r; a++) {
        for (let b = -r; b <= r; b++) {
          if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
          if (putStructure(kind, u + a, v + b, true)) return;
        }
      }
    }
  };
  for (let i = 0; i < cacheCount; i++) {
    const spot = nextSpot();
    const ju = ri(rng, -1, 1);
    if (spot) putStore(kit.cache, spot[0], spot[1], ju, 0);
  }
  for (let i = 0; i < dumpCount; i++) {
    const spot = nextSpot();
    const jv = ri(rng, -1, 0);
    if (spot) putStore(kit.dump, spot[0], spot[1], 0, jv);
  }

  // ---- towers ------------------------------------------------------------------
  // Unchanged, and deliberately so — see the ROADMAP's open item. This steps
  // on even tiers only, so T5 gains no gun, and with the creep above landing
  // just two more upgrades there the T4->T5 rung measures a nearly flat -2.
  // Smoothing it to `round(2.5 + tier * 0.6)` does give T5 its gun and a
  // proper -16 step, and it also erases what v1.20 shipped for: more guns
  // means the maze goes back to steering raiders AROUND them, and the wall
  // line falls from +7.6 to +0.8. That trade is real and it is not this
  // change's to make.
  const towerCount = towerCountFor(tier, arch.towers);
  // Air cover is an ADDITION to the compound, never a substitution. Swapping
  // a gun for a mount made every ground raid measurably easier — the exact
  // opposite of what the layer is for.
  const aaCount = tier >= 6 ? 2 : tier >= 2 ? 1 : 0;
  const towerKind = (i: number): string => {
    if (tier >= 3 && i % 3 === 2) return kit.towers[2]; // anti-armor
    if (tier >= 2 && i % 2 === 1) return kit.towers[1]; // area denial
    return kit.towers[0];
  };
  // The upgrade creeps through the line rather than landing on it (v1.21).
  // `towerSpots` is ordered best-position-first, so the guns that matter most
  // are the ones already standing at the ceiling — a base builds up its key
  // positions before its outlying ones, and a raider can read which is which
  // off the board. Floor, so the first rung of a band gets strictly fewer than
  // a third rather than rounding straight back up to all of them.
  const upgraded = Math.floor(towerCount * upgradeShareFor(tier));
  const gunLevel = (i: number): number => Math.max(1, i < upgraded ? level : level - 1);
  let placed = 0;
  let mounts = 0;
  for (
    let i = 0;
    i < towerSpots.length && (placed < towerCount || mounts < aaCount);
    i++
  ) {
    const [sx, sy] = towerSpots[i]!;
    // Mounts sit mid-line and mid-depth, not tucked at the back where a
    // standoff run would never have to enter their envelope.
    const wantAa = mounts < aaCount && (i === 2 || i === 5 || placed >= towerCount);
    const kind = wantAa ? kit.aa : towerKind(placed);
    // The jitter is variety, not a rule, so a gun is not lost to it: if the
    // jittered cell is taken, the spot itself gets one more try. There are
    // exactly eight spots for up to eight placements, so every failure used
    // to be a gun the rung never got — and the narrower frontage of v1.40
    // made spots collide often enough that a tier 7 base could field fewer
    // guns than a tier 1 one, which `warfare.test.ts` caught.
    //
    // Both `ri` draws happen either way, so the retry costs the stream nothing
    // and a base that already fit is unchanged.
    const jx = sx + ri(rng, -1, 1);
    const jy = sy + ri(rng, -1, 1);
    if (
      putStructure(kind, jx, jy, false, gunLevel(placed)) ||
      putStructure(kind, sx, sy, false, gunLevel(placed))
    ) {
      if (wantAa) mounts++;
      else placed++;
    }
  }
  // Fill any shortfall with guards hugging the command post.
  // Then outward, ring by ring: at two units a cell the walkways take cells a
  // gun used to stand on, and a rung is priced by its gun count, so a gun that
  // does not fit its spot goes on the next ring out rather than missing.
  const fallback: [number, number][] = [
    [ccU - 1, ccV - 1], [ccU + 1, ccV - 1], [ccU - 1, ccV + 1], [ccU + 1, ccV + 1],
  ];
  for (let r = 2; r <= 4; r++) {
    for (let du = -r; du <= r; du++) {
      for (let dv = -r; dv <= r; dv++) {
        if (Math.max(Math.abs(du), Math.abs(dv)) === r) fallback.push([ccU + du, ccV + dv]);
      }
    }
  }
  for (let i = 0; i < fallback.length && (placed < towerCount || mounts < aaCount); i++) {
    const wantAa = mounts < aaCount;
    const kind = wantAa ? kit.aa : towerKind(placed);
    if (putStructure(kind, fallback[i]![0], fallback[i]![1], false, gunLevel(placed))) {
      if (wantAa) mounts++;
      else placed++;
    }
  }

  const name = `GRID ${tier}-${variant + 1} “${CODENAMES[(seed >>> 3) % CODENAMES.length]}”`;
  return {
    tier,
    variant,
    name,
    ccOrigin,
    ccLevel: level,
    walls,
    structures,
    archetype: arch.id,
    terrainSeed,
  };
}

/** Loot paid per destroyed structure kind (walls pay nothing). */
export function lootFor(kind: string, tier: number): { supplies: number; fuel: number } {
  switch (kind) {
    case 'supplyCache':
    case 'supplyDepot':
      return { supplies: 120 + 40 * tier, fuel: 0 };
    case 'fuelDump':
    case 'fuelDepot':
      return { supplies: 0, fuel: 40 + 15 * tier };
    case 'hmgTower':
    case 'qlzTower':
    case 'atgmTower':
    case 'm2nest':
    case 'autocannon':
    case 'mortar':
      return { supplies: 25 + 10 * tier, fuel: 0 };
    // Mounts carry missiles: worth more to strip, and paid partly in fuel.
    case 'aa':
    case 'aaSite':
      return { supplies: 30 + 12 * tier, fuel: 10 + 5 * tier };
    case 'cc':
      return { supplies: 250 + 90 * tier, fuel: 50 + 20 * tier };
    default:
      return { supplies: 0, fuel: 0 };
  }
}
