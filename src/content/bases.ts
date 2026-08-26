import { createRng, type Rng } from '../sim/rng';
import { generateTerrain, TERRAIN_VERSION } from '../sim/terrain';
import type { CellIndex, LayoutStructure, LayoutWall } from '../sim/types';

/**
 * Front Line base generator (M4): handcrafted layout templates + seeded
 * procedural mutation, scaled by tier. Fully deterministic per (tier,
 * variant) so scouting, raiding, and replays all agree on the world.
 */

export const MAP_W = 32;
export const MAP_H = 24;
export const TARGETS_PER_TIER = 3;

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
export function towerCountFor(tier: number, towers: number): number {
  const want = (t: number): number =>
    Math.max(1, Math.round(Math.min(8, 3 + Math.floor(t / 2)) * towers));
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
    return cells.every(
      (c) => !this.cells.has(c) && c >= 0 && c % MAP_W >= 2 && c % MAP_W <= MAP_W - 2 && c < MAP_W * MAP_H,
    );
  }
}

const footprint2 = (origin: CellIndex): CellIndex[] => [
  origin,
  origin + 1,
  origin + MAP_W,
  origin + MAP_W + 1,
];


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
  ccX: number;
  ccY: number;
  putWall: (x: number, y: number) => void;
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
 * The three targets a rung offers, chosen by MEASUREMENT (v1.31).
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
 * three targets at a rung spread ±15 around it. Slot 0 is the heavy fight,
 * slot 2 the one you can take today, slot 1 the reason to think about it.
 *
 * The early rungs saturate near 100 for everyone. That is not a defect here:
 * everyone at 100 is a spread of zero, and a starter rung should be beatable.
 *
 * Selection also carries a small penalty for a shape the faction has already
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
      [['star', 0], ['compound', 0], ['camp', 0]], // T2 100/100/100
      [['corridor', 11], ['camp', 11], ['depot', 0]], // T3 75/83/100
      [['keep', 5], ['corridor', 6], ['strongpoints', 10]], // T4 50/67/83
      [['bunker', 5], ['corridor', 0], ['star', 5]], // T5 42/58/67
    ],
    china: [
      [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
      [['compound', 3], ['star', 0], ['camp', 0]], // T2 92/100/100
      [['star', 7], ['depot', 5], ['strongpoints', 0]], // T3 58/92/100
      [['keep', 2], ['strongpoints', 1], ['star', 6]], // T4 50/67/83
      [['bunker', 10], ['compound', 2], ['corridor', 7]], // T5 33/58/67
    ],
    russia: [
      [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
      [['compound', 5], ['star', 0], ['camp', 0]], // T2 92/100/100
      [['camp', 1], ['strongpoints', 3], ['depot', 0]], // T3 67/92/100
      [['strongpoints', 7], ['keep', 10], ['compound', 6]], // T4 50/75/83
      [['camp', 4], ['bunker', 2], ['compound', 11]], // T5 42/50/67
    ],
    nk: [
      [['compound', 0], ['camp', 0], ['corridor', 2]], // T1 92/100/100
      [['star', 2], ['compound', 4], ['camp', 0]], // T2 83/92/100
      [['depot', 3], ['strongpoints', 7], ['compound', 0]], // T3 67/83/100
      [['compound', 0], ['keep', 10], ['camp', 2]], // T4 58/75/83
      [['bunker', 9], ['corridor', 1], ['compound', 4]], // T5 33/58/67
    ],
    un: [
      [['compound', 0], ['camp', 0], ['corridor', 0]], // T1 100/100/100
      [['star', 4], ['camp', 7], ['compound', 0]], // T2 92/92/100
      [['star', 10], ['strongpoints', 10], ['depot', 0]], // T3 67/92/100
      [['compound', 1], ['keep', 6], ['star', 5]], // T4 58/67/83
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

/** Walled rectangle with two or three gates, guns on the corners and gates. */
function planCompound(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const margin = ri(rng, 6, 7);
  const x0 = Math.max(3, ccX - margin);
  const x1 = Math.min(MAP_W - 3, ccX + margin + 1);
  const y0 = Math.max(2, ccY - margin + 1);
  const y1 = Math.min(MAP_H - 3, ccY + margin);
  const gates = new Set<number>();
  const gateCount = ri(rng, 2, 3);
  for (let g = 0; g < gateCount; g++) gates.add(ri(rng, 0, 3));
  const gateAt = (side: number): boolean => gates.has(side);
  const gatePos = [
    ri(rng, x0 + 2, x1 - 3),
    ri(rng, x0 + 2, x1 - 3),
    ri(rng, y0 + 2, y1 - 3),
    ri(rng, y0 + 2, y1 - 3),
  ];
  for (let x = x0; x <= x1; x++) {
    if (!(gateAt(0) && Math.abs(x - gatePos[0]!) <= 1)) putWall(x, y0);
    if (!(gateAt(1) && Math.abs(x - gatePos[1]!) <= 1)) putWall(x, y1);
  }
  for (let y = y0; y <= y1; y++) {
    if (!(gateAt(2) && Math.abs(y - gatePos[2]!) <= 1)) putWall(x0, y);
    if (!(gateAt(3) && Math.abs(y - gatePos[3]!) <= 1)) putWall(x1, y);
  }
  towerSpots.push(
    [x0 + 2, y0 + 2], [x1 - 2, y0 + 2], [x0 + 2, y1 - 2], [x1 - 2, y1 - 2],
    [gatePos[0]!, y0 + 2], [gatePos[1]!, y1 - 2], [x0 + 2, gatePos[2]!], [x1 - 2, gatePos[3]!],
  );
}

/** Diamond ring with two breaches. */
function planStar(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const r = ri(rng, 7, 8);
  const cx = ccX + 1;
  const cy = ccY + 1;
  const breachA = ri(rng, 0, 3);
  const breachB = (breachA + ri(rng, 1, 3)) % 4;
  for (let dx = -r; dx <= r; dx++) {
    const dy = r - Math.abs(dx);
    for (const sign of [1, -1]) {
      const x = cx + dx;
      const y = cy + sign * dy;
      const quadrant = (dx >= 0 ? 0 : 1) + (sign > 0 ? 0 : 2);
      const isBreach =
        (quadrant === breachA || quadrant === breachB) && Math.abs(Math.abs(dx) - r / 2) < 1.5;
      if (!isBreach) putWall(x, y);
      if (sign === -1 && dy === 0) break; // avoid double-placing the tips
    }
  }
  towerSpots.push(
    [cx + r - 3, cy], [cx - r + 3, cy], [cx, cy + r - 3], [cx, cy - r + 3],
    [cx + 3, cy + 3], [cx - 3, cy - 3], [cx + 3, cy - 3], [cx - 3, cy + 3],
  );
}

/** Two offset wall lines west of the post: a forced serpentine. */
function planCorridor(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const lineA = ccX - 7;
  const lineB = ccX - 3;
  const gapA = ri(rng, 3, 8);
  const gapB = ri(rng, 15, 20);
  for (let y = 1; y <= MAP_H - 2; y++) {
    if (Math.abs(y - gapA) > 1) putWall(lineA, y);
    if (Math.abs(y - gapB) > 1) putWall(lineB, y);
  }
  for (let x = lineB; x <= Math.min(MAP_W - 3, ccX + 6); x++) {
    putWall(x, 2);
    putWall(x, MAP_H - 3);
  }
  towerSpots.push(
    [lineA + 1, gapA], [lineB + 1, gapB], [lineB + 2, gapA],
    [ccX - 1, ccY - 4], [ccX - 1, ccY + 5], [ccX + 3, ccY - 3], [ccX + 3, ccY + 4],
    [lineA + 3, Math.floor(MAP_H / 2)],
  );
}

/**
 * A token perimeter and nothing else: four short stubs that shape the approach
 * without ever forcing a breach. The guns are spread thin because there are
 * not many of them.
 */
function planCamp(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const r = ri(rng, 5, 7);
  const stub = ri(rng, 3, 5);
  for (let i = -stub; i <= stub; i++) {
    putWall(ccX + i, ccY - r);
    putWall(ccX + i, ccY + r);
    putWall(ccX - r, ccY + i);
    putWall(ccX + r, ccY + i);
  }
  towerSpots.push(
    [ccX, ccY - r + 2], [ccX, ccY + r - 1], [ccX - r + 2, ccY], [ccX + r - 1, ccY],
    [ccX - 3, ccY - 3], [ccX + 4, ccY + 4], [ccX + 4, ccY - 3], [ccX - 3, ccY + 4],
  );
}

/**
 * Stores at the four corners of the map, each in a small pen; the post itself
 * gets a light ring. Killing the command post is easy and barely dents the
 * destruction score, so this is the shape that rewards RAZE and several
 * entry sectors instead of one heavy push.
 */
function planDepot(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const r = ri(rng, 3, 4);
  for (let i = -r; i <= r; i++) {
    if (Math.abs(i) > 1) {
      putWall(ccX + i, ccY - r);
      putWall(ccX + i, ccY + r);
      putWall(ccX - r, ccY + i);
      putWall(ccX + r, ccY + i);
    }
  }
  for (const [px, py] of depotSpots(c)) {
    for (let i = -2; i <= 2; i++) {
      if (Math.abs(i) > 1) {
        putWall(px + i, py - 2);
        putWall(px + i, py + 2);
      }
    }
    towerSpots.push([px, py - 3]);
  }
  towerSpots.push([ccX, ccY - r - 1], [ccX, ccY + r + 2], [ccX - r - 1, ccY], [ccX + r + 2, ccY]);
}

/** The four corner pens a dispersed depot keeps its stores in. */
function depotSpots(c: PlanContext): [number, number][] {
  const { rng } = c;
  const inset = ri(rng, 0, 1);
  return [
    [6 + inset, 5 + inset],
    [MAP_W - 8 - inset, 5 + inset],
    [6 + inset, MAP_H - 6 - inset],
    [MAP_W - 8 - inset, MAP_H - 6 - inset],
  ];
}

/**
 * Four small walled pens spread across the middle band, one of them holding
 * the command post. Each has its own gun, so a single squad walking the map
 * gets shot at by one pen while breaking into another.
 */
function planStrongpoints(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const pens: [number, number][] = [
    [ccX, ccY],
    [ccX - ri(rng, 8, 10), ccY - ri(rng, 4, 6)],
    [ccX - ri(rng, 8, 10), ccY + ri(rng, 4, 6)],
    [ccX + ri(rng, 5, 7), ccY + ri(rng, 5, 7) * (rng() < 0.5 ? -1 : 1)],
  ];
  pens.forEach(([px, py], index) => {
    const r = index === 0 ? 4 : 3;
    const gap = ri(rng, -1, 1);
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
    towerSpots.push([px + (index === 0 ? 2 : 0), py + (index === 0 ? -2 : 1)]);
  });
  towerSpots.push([ccX - 4, ccY], [ccX + 5, ccY], [ccX, ccY - 5], [ccX, ccY + 6]);
}

/**
 * Two concentric rings with their gates on opposite sides, so the way in is
 * long even though the base is small, and the guns between the rings all cover
 * each other. The shape that rewards spending ordnance before walking in.
 */
function planKeep(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const inner = 4;
  const outer = ri(rng, 7, 8);
  const innerGate = ri(rng, 0, 3);
  const outerGate = (innerGate + 2) % 4;
  const ring = (r: number, gate: number): void => {
    for (let i = -r; i <= r; i++) {
      const skipTop = gate === 0 && Math.abs(i) <= 1;
      const skipBottom = gate === 1 && Math.abs(i) <= 1;
      const skipLeft = gate === 2 && Math.abs(i) <= 1;
      const skipRight = gate === 3 && Math.abs(i) <= 1;
      if (!skipTop) putWall(ccX + i, ccY - r);
      if (!skipBottom) putWall(ccX + i, ccY + r);
      if (!skipLeft) putWall(ccX - r, ccY + i);
      if (!skipRight) putWall(ccX + r, ccY + i);
    }
  };
  ring(inner, innerGate);
  ring(outer, outerGate);
  const mid = Math.round((inner + outer) / 2);
  towerSpots.push(
    [ccX - mid, ccY - mid], [ccX + mid, ccY - mid], [ccX - mid, ccY + mid], [ccX + mid, ccY + mid],
    [ccX, ccY - mid], [ccX, ccY + mid + 1], [ccX - mid, ccY], [ccX + mid + 1, ccY],
  );
}

/**
 * One thick arc of wall on the likely approach and nothing anywhere else. The
 * maze is not the problem here; the guns are, and they are laid out in depth
 * so a force that walks straight in is engaged the whole way.
 */
function planBunker(c: PlanContext): void {
  const { rng, ccX, ccY, putWall, towerSpots } = c;
  const face = ccX - ri(rng, 5, 6);
  const half = ri(rng, 5, 7);
  for (let y = ccY - half; y <= ccY + half; y++) {
    if (Math.abs(y - ccY) > 1) {
      putWall(face, y);
      putWall(face - 1, y);
    }
  }
  towerSpots.push(
    [face + 2, ccY - 3], [face + 2, ccY + 4], [face + 4, ccY],
    [ccX - 2, ccY - 4], [ccX - 2, ccY + 5], [ccX + 3, ccY - 2], [ccX + 3, ccY + 3],
    [ccX, ccY - 6], [ccX, ccY + 7], [face + 3, ccY - 6], [face + 3, ccY + 7],
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
  for (let y = 9; y <= 13; y++) for (let x = 13; x <= 18; x++) ccBox.push(idx(x, y));
  const terrain = generateTerrain(terrainSeed, TERRAIN_VERSION, MAP_W, MAP_H, ccBox, 0);
  const water: CellIndex[] = [];
  for (let cell = 0; cell < MAP_W * MAP_H; cell++) {
    if (!terrain.passable(cell)) water.push(cell);
  }
  occupancy.block(water);

  const ccX = ri(rng, 13, 17);
  const ccY = ri(rng, 9, 12);
  const ccOrigin = idx(ccX, ccY);
  occupancy.block(footprint2(ccOrigin));

  const putStructure = (
    kind: string,
    x: number,
    y: number,
    big: boolean,
    at = level,
  ): boolean => {
    const origin = idx(x, y);
    const cells = big ? footprint2(origin) : [origin];
    if (y < 1 || y + (big ? 1 : 0) > MAP_H - 2 || !occupancy.free(cells)) return false;
    occupancy.block(cells);
    // Compound mounts stay at level 1 however deep the ladder goes. They are
    // there to answer rotors, not to be a quiet ground-defence buff on every
    // base a raider has to cross — flak is priced badly against the ground,
    // and an upgraded one at tier 5 would still be another gun in the line.
    structures.push({ cell: origin, kind, level: kind === kit.aa ? 1 : at });
    return true;
  };

  const putWall = (x: number, y: number): void => {
    if (x < 2 || x > MAP_W - 2 || y < 1 || y > MAP_H - 2) return;
    const cell = idx(x, y);
    if (!occupancy.free([cell])) return;
    occupancy.block([cell]);
    walls.push({ cell, kind: 'wall' });
  };

  const towerSpots: [number, number][] = [];
  const plan: PlanContext = { rng, tier, ccX, ccY, putWall, towerSpots };

  // ---- economy: caches and dumps, where the shape keeps them ----
  const cacheCount = Math.max(1, Math.round(Math.min(4, 2 + Math.floor(tier / 3)) * arch.economy));
  const dumpCount = Math.max(1, Math.round(Math.min(3, 1 + Math.floor(tier / 4)) * arch.economy));
  const economySpots: [number, number][] = arch.economySpots?.(plan) ?? [
    [ccX - 5, ccY - 4], [ccX + 4, ccY - 4], [ccX - 5, ccY + 3], [ccX + 4, ccY + 3],
    [ccX - 6, ccY], [ccX + 5, ccY], [ccX, ccY - 5], [ccX, ccY + 4],
  ];
  // Seeded shuffle.
  for (let i = economySpots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [economySpots[i], economySpots[j]] = [economySpots[j]!, economySpots[i]!];
  }
  let spotIndex = 0;
  const nextSpot = (): [number, number] | null =>
    spotIndex < economySpots.length ? economySpots[spotIndex++]! : null;
  for (let i = 0; i < cacheCount; i++) {
    const spot = nextSpot();
    if (spot) putStructure(kit.cache, spot[0] + ri(rng, -1, 1), spot[1], true);
  }
  for (let i = 0; i < dumpCount; i++) {
    const spot = nextSpot();
    if (spot) putStructure(kit.dump, spot[0], spot[1] + ri(rng, -1, 0), true);
  }

  // ---- walls: the archetype decides the shape of the problem ----
  arch.walls(plan);

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
    if (putStructure(kind, sx + ri(rng, -1, 1), sy + ri(rng, -1, 1), false, gunLevel(placed))) {
      if (wantAa) mounts++;
      else placed++;
    }
  }
  // Fill any shortfall with guards hugging the command post.
  const fallback: [number, number][] = [
    [ccX - 2, ccY - 1], [ccX + 3, ccY - 1], [ccX - 2, ccY + 2], [ccX + 3, ccY + 2],
  ];
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
