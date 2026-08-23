import { createRng, type Rng } from '../sim/rng';
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
}

const idx = (x: number, y: number): CellIndex => y * MAP_W + x;
const ri = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

const CODENAMES = [
  'IRON SHED', 'RED LANTERN', 'BROKEN SPUR', 'PADDY GATE', 'COLD FORGE',
  'JADE WALL', 'GRANITE NEST', 'SILENT DYNAMO', 'ASH DEPOT', 'LOW THUNDER',
  'HOLLOW CROWN', 'BLACK TERRACE',
];

export function structureLevelFor(tier: number): number {
  return Math.min(3, 1 + Math.floor((tier - 1) / 3));
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
 * Which shape a target is. Deterministic in (tier, variant), so scouting,
 * raiding and replaying all agree — and the three variants offered at a tier
 * are three distinct shapes, because a choice between identical problems is
 * not a choice.
 */
export function archetypeFor(tier: number, variant: number): Archetype {
  const pool = ARCHETYPES.filter((a) => a.fromTier <= Math.max(1, tier));
  const rng = createRng(((tier * 2654435761) ^ 0x5f3a) >>> 0);
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order[((variant % order.length) + order.length) % order.length]!;
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
): GeneratedBase {
  const seed = (tier * 7919 + variant * 104729 + 12345) >>> 0;
  const rng = createRng(seed);
  const arch = force ? ARCHETYPE_BY_ID[force] : archetypeFor(tier, variant);
  const level = Math.min(3, structureLevelFor(tier) + arch.levelBonus);
  const occupancy = new Occupancy();
  const walls: LayoutWall[] = [];
  const structures: LayoutStructure[] = [];

  const ccX = ri(rng, 13, 17);
  const ccY = ri(rng, 9, 12);
  const ccOrigin = idx(ccX, ccY);
  occupancy.block(footprint2(ccOrigin));

  const putStructure = (kind: string, x: number, y: number, big: boolean): boolean => {
    const origin = idx(x, y);
    const cells = big ? footprint2(origin) : [origin];
    if (y < 1 || y + (big ? 1 : 0) > MAP_H - 2 || !occupancy.free(cells)) return false;
    occupancy.block(cells);
    // Compound mounts stay at level 1 however deep the ladder goes. They are
    // there to answer rotors, not to be a quiet ground-defence buff on every
    // base a raider has to cross — flak is priced badly against the ground,
    // and an upgraded one at tier 5 would still be another gun in the line.
    structures.push({ cell: origin, kind, level: kind === kit.aa ? 1 : level });
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
  const towerCount = Math.max(
    1,
    Math.round(Math.min(8, 3 + Math.floor(tier / 2)) * arch.towers),
  );
  // Air cover is an ADDITION to the compound, never a substitution. Swapping
  // a gun for a mount made every ground raid measurably easier — the exact
  // opposite of what the layer is for.
  const aaCount = tier >= 6 ? 2 : tier >= 2 ? 1 : 0;
  const towerKind = (i: number): string => {
    if (tier >= 3 && i % 3 === 2) return kit.towers[2]; // anti-armor
    if (tier >= 2 && i % 2 === 1) return kit.towers[1]; // area denial
    return kit.towers[0];
  };
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
    if (putStructure(kind, sx + ri(rng, -1, 1), sy + ri(rng, -1, 1), false)) {
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
    if (putStructure(kind, fallback[i]![0], fallback[i]![1], false)) {
      if (wantAa) mounts++;
      else placed++;
    }
  }

  const name = `GRID ${tier}-${variant + 1} “${CODENAMES[(seed >>> 3) % CODENAMES.length]}”`;
  return { tier, variant, name, ccOrigin, ccLevel: level, walls, structures, archetype: arch.id };
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
