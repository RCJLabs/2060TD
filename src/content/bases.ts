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

export function generateBase(
  tier: number,
  variant: number,
  kit: BaseKit = CHINA_BASE_KIT,
): GeneratedBase {
  const seed = (tier * 7919 + variant * 104729 + 12345) >>> 0;
  const rng = createRng(seed);
  const level = structureLevelFor(tier);
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

  // ---- economy: caches and dumps loosely ringed around the command post ----
  const cacheCount = Math.min(4, 2 + Math.floor(tier / 3));
  const dumpCount = Math.min(3, 1 + Math.floor(tier / 4));
  const economySpots: [number, number][] = [
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

  // ---- walls by template -----------------------------------------------------
  const template = variant % 3;
  const towerSpots: [number, number][] = [];

  if (template === 0) {
    // COMPOUND: rectangular ring with 2-3 gates.
    const margin = ri(rng, 6, 7);
    const x0 = Math.max(3, ccX - margin);
    const x1 = Math.min(MAP_W - 3, ccX + margin + 1);
    const y0 = Math.max(2, ccY - margin + 1);
    const y1 = Math.min(MAP_H - 3, ccY + margin);
    const gates = new Set<number>();
    const gateCount = ri(rng, 2, 3);
    for (let g = 0; g < gateCount; g++) gates.add(ri(rng, 0, 3));
    const gateAt = (side: number) => gates.has(side);
    const gatePos = [ri(rng, x0 + 2, x1 - 3), ri(rng, x0 + 2, x1 - 3), ri(rng, y0 + 2, y1 - 3), ri(rng, y0 + 2, y1 - 3)];
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
  } else if (template === 1) {
    // STAR: diamond ring |dx|+|dy| = r with two random breaches.
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
  } else {
    // CORRIDOR: two offset wall lines west of the post — a forced serpentine.
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

  // ---- towers ------------------------------------------------------------------
  const towerCount = Math.min(8, 3 + Math.floor(tier / 2));
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
  return { tier, variant, name, ccOrigin, ccLevel: level, walls, structures };
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
