/**
 * The ground itself — elevation, water, woodland and roads, generated from a
 * seed and read by the sim.
 *
 * Three rules hold this together, and breaking any one of them corrupts
 * battles that were fought months ago:
 *
 * 1. **Its own randomness.** The engine's RNG is a single stream consumed in
 *    tick order, and drawing terrain from it would shift every later draw. The
 *    field takes `createRng(seed)` of its own, exactly as the base generator
 *    already does.
 * 2. **Frozen per version.** `TERRAIN_VERSION` names a generator, not a
 *    revision of one. Improving the maths means a NEW version; every config
 *    that named version 1 keeps fighting on version 1's ground forever.
 * 3. **Derived, never stored.** A field is a pure function of
 *    `(seed, version, width, height, occupied)`, so a replay carries two
 *    numbers rather than 768 cells.
 *
 * Terrain effects are all flat multipliers. There are no line-of-sight checks
 * anywhere in this sim — that was decided at M2 — so elevation extends a
 * gun's reach and canopy softens what lands on you, but neither ever asks
 * whether one cell can *see* another.
 */

import type { CellIndex } from './types';
import { createRng, type Rng } from './rng';

/**
 * The generator's identity. Bump this ONLY by adding a new branch in
 * `generateTerrain` — never by editing an existing one.
 */
export const TERRAIN_VERSION = 1;

/** Version 0 means "this config predates terrain": flat ground, no effects. */
export const TERRAIN_NONE = 0;

/** The road, and therefore the cheapest ground on the board. */
export const MIN_MOVE_COST = 0.7;

/**
 * How much reach a gun gains per elevation band. Band 3 is +15%.
 *
 * The mockup proposed +40%, and the harness refused it: at that value the
 * reference force's clear rate fell 33 points, which is a difficulty spike
 * rather than a trade. Switching the term off entirely put GROUND at 93.0
 * against FLAT's 93.4 — meaning water, cover and movement cost together
 * accounted for almost none of the drop, and elevation accounted for all of
 * it.
 *
 * That is the same lesson this project has now learned three times: a raid is
 * decided by GUN COVERAGE, not by route length or wall HP. Reach is read from
 * the firer's cell for both sides, which is symmetric in code and deeply
 * asymmetric in play — a defender's guns sit in fixed emplacements and keep
 * whatever ground they were built on, while an attacker mostly closes to
 * contact and never collects the bonus.
 *
 * At 0.05 the mean lands 6.6 points under flat, inside the same band field
 * conditions are held to, and the spread between sheets stays 40 points.
 */
export const RANGE_PER_BAND = 0.05;

/** Incoming direct fire under canopy. Artillery is not fooled by trees. */
export const WOOD_COVER = 0.7;

/**
 * Ground kinds, in the order the renderer stacks them. A plain object rather
 * than a `const enum` because the build runs with `isolatedModules`.
 */
export const Ground = {
  Open: 0,
  Rough: 1,
  Steep: 2,
  Wood: 3,
  Road: 4,
  Water: 5,
} as const;
export type Ground = (typeof Ground)[keyof typeof Ground];

/** Move cost per ground kind, indexed by `Ground`. */
const MOVE_COST = [1, 1.3, 1.6, 1.15, MIN_MOVE_COST, Infinity];

/**
 * What the sim needs to know about the ground. A field is immutable once
 * built: terrain does not burn, flood or crater, which is what lets the state
 * hash ignore it entirely.
 */
export interface TerrainField {
  readonly version: number;
  readonly width: number;
  readonly height: number;
  /** Elevation band 0-3. Higher ground reaches further. */
  band(cell: CellIndex): number;
  /** Movement multiplier; never below `MIN_MOVE_COST`, `Infinity` on water. */
  moveCost(cell: CellIndex): number;
  /** Incoming direct-fire multiplier. 1 in the open, `WOOD_COVER` under trees. */
  cover(cell: CellIndex): number;
  /** False only on water. */
  passable(cell: CellIndex): boolean;
  /** The ground kind, for the renderer. */
  groundAt(cell: CellIndex): Ground;
  /** Metres above the sheet datum, for contours. */
  elevation(cell: CellIndex): number;
  /** Sub-cell elevation, so contours can be traced finer than the grid. */
  elevationAt(x: number, y: number): number;
  /** Where the road crosses the water, in cell coordinates, or null. */
  readonly bridge: { x: number; y: number } | null;
  /** The road's sampled centreline, for drawing. */
  readonly road: readonly (readonly [number, number])[];
  /** The watercourse's sampled centreline, for drawing. */
  readonly river: readonly (readonly [number, number])[];
}

/**
 * The flat field every pre-terrain config fights on. Costs nothing to make and
 * lets every caller treat terrain as always-present rather than optional.
 */
export const FLAT_TERRAIN: TerrainField = {
  version: TERRAIN_NONE,
  width: 0,
  height: 0,
  band: () => 0,
  moveCost: () => 1,
  cover: () => 1,
  passable: () => true,
  groundAt: () => Ground.Open,
  elevation: () => 0,
  elevationAt: () => 0,
  bridge: null,
  road: [],
  river: [],
};

// ---- noise ------------------------------------------------------------------

const hash2 = (x: number, y: number, seed: number): number => {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
}

// ---- line features ----------------------------------------------------------

type Pt = [number, number];

/**
 * Quadratic midpoint spline through control points, sampled to a polyline.
 * Roads and watercourses are drawn from the same samples the height field
 * reads, so the valley and the blue line can never disagree.
 */
function samplePath(pts: Pt[], n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a: Pt =
      i === 1 ? pts[0]! : [(pts[i - 1]![0] + pts[i]![0]) / 2, (pts[i - 1]![1] + pts[i]![1]) / 2];
    const b = pts[i]!;
    const c: Pt = [(pts[i]![0] + pts[i + 1]![0]) / 2, (pts[i]![1] + pts[i + 1]![1]) / 2];
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      out.push([
        u * u * a[0] + 2 * u * t * b[0] + t * t * c[0],
        u * u * a[1] + 2 * u * t * b[1] + t * t * c[1],
      ]);
    }
  }
  return out;
}

/** Squared distance from a point to the nearest sample on a polyline. */
function distSq(pts: readonly Pt[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dx = x - pts[i]![0];
    const dy = y - pts[i]![1];
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return best;
}

// ---- the generator ----------------------------------------------------------

/** Control points for one map's road and river, rolled from the terrain rng. */
function routes(rng: Rng, width: number, height: number): { road: Pt[]; river: Pt[] } {
  // The river runs roughly north-south down one third of the map; which third
  // is the roll. Keeping it off the middle leaves the centre buildable.
  const west = rng() < 0.5;
  const rx = west ? width * 0.16 : width * 0.84;
  const drift = (rng() - 0.5) * width * 0.1;
  const river: Pt[] = [
    [rx - drift, -3],
    [rx - drift * 0.6, -1],
    [rx + drift * 0.4, height * 0.12],
    [rx + drift, height * 0.38],
    [rx + drift * 1.4, height * 0.56],
    [rx + drift * 0.8, height * 0.73],
    [rx + drift * 0.2, height * 0.88],
    [rx - drift * 0.4, height + 1],
    [rx - drift * 0.8, height + 3],
  ];

  // The road enters from the spawn edge (west) and climbs east. Its height is
  // a roll, so the crossing lands somewhere different on every map.
  const ry = height * (0.3 + rng() * 0.4);
  const road: Pt[] = [
    [-3, ry + 0.6],
    [-1, ry + 0.4],
    [width * 0.14, ry + 0.2],
    [width * 0.34, ry - 0.5],
    [width * 0.55, ry - 1.1],
    [width * 0.78, ry - 2.0],
    [width + 1, ry - 2.8],
    [width + 3, ry - 3.2],
  ];
  return { road, river };
}

/**
 * Build a terrain field.
 *
 * `occupied` names cells that already hold something — an existing building, a
 * wall, the command centre footprint. Water is kept off those cells AND their
 * four neighbours, so nothing already built can end up in a river and nothing
 * ends up walled in by one.
 */
export function generateTerrain(
  seed: number,
  version: number,
  width: number,
  height: number,
  occupied: Iterable<CellIndex> = [],
  spawnColumn = 0,
): TerrainField {
  if (version === TERRAIN_NONE) return FLAT_TERRAIN;

  const size = width * height;
  const rng = createRng(seed >>> 0);
  const { road, river } = routes(rng, width, height);
  const roadPts = samplePath(road, 10);
  const riverPts = samplePath(river, 10);
  const noiseSeed = (seed ^ 0x9e3779b9) >>> 0;

  // The bridge: the road/river sample pair that come closest together. It is
  // not decoration — it is what stops a river from cutting the map in two.
  let bridge: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const [rxp, ryp] of roadPts) {
    for (const [wx, wy] of riverPts) {
      const d = (rxp - wx) ** 2 + (ryp - wy) ** 2;
      if (d < bd) {
        bd = d;
        bridge = { x: (rxp + wx) / 2, y: (ryp + wy) / 2 };
      }
    }
  }
  if (bd > 4) bridge = null; // they never actually meet

  /** Height in metres. The river cuts a channel so contours crease into it. */
  const elevationAt = (x: number, y: number): number => {
    let n = 0;
    let amp = 1;
    let freq = 0.075;
    let total = 0;
    for (let o = 0; o < 3; o++) {
      n += valueNoise(x * freq, y * freq, noiseSeed + o * 17) * amp;
      total += amp;
      amp *= 0.45;
      freq *= 2.3;
    }
    n /= total;
    const tilt = (x / width) * 0.3 + ((height - y) / height) * 0.34;
    const d2 = distSq(riverPts, x, y);
    return (n * 0.74 + tilt) * 190 + 20 - 46 * Math.exp(-d2 / 20);
  };

  // --- the ground array --------------------------------------------------
  const ground = new Uint8Array(size);
  const elev = new Float32Array(size);
  const bandOf = new Uint8Array(size);

  const blocked = new Uint8Array(size);
  for (const cell of occupied) {
    if (cell < 0 || cell >= size) continue;
    blocked[cell] = 1;
    const cx = cell % width;
    const cy = (cell / width) | 0;
    if (cx > 0) blocked[cell - 1] = 1;
    if (cx < width - 1) blocked[cell + 1] = 1;
    if (cy > 0) blocked[cell - width] = 1;
    if (cy < height - 1) blocked[cell + width] = 1;
  }
  // The spawn column and its neighbour are never touched. A failed spawn
  // returns before the engine's speed-jitter draw, so one stranded unit would
  // shift every later roll and change the whole battle.
  for (let y = 0; y < height; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = spawnColumn + dx;
      if (x >= 0 && x < width) blocked[y * width + x] = 1;
    }
  }

  let lo = Infinity;
  let hi = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = elevationAt(x + 0.5, y + 0.5);
      elev[y * width + x] = h;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  const span = Math.max(1, hi - lo);

  const BRIDGE_R2 = 1.4 * 1.4;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = y * width + x;
      const cx = x + 0.5;
      const cy = y + 0.5;
      const t = (elev[cell]! - lo) / span;
      bandOf[cell] = Math.min(3, Math.max(0, Math.floor(t * 4)));

      const onBridge = bridge !== null && (cx - bridge.x) ** 2 + (cy - bridge.y) ** 2 < BRIDGE_R2;
      const roadD2 = distSq(roadPts, cx, cy);
      if (roadD2 < 0.36) {
        ground[cell] = Ground.Road;
        continue;
      }
      if (!onBridge && !blocked[cell] && distSq(riverPts, cx, cy) < 0.42) {
        ground[cell] = Ground.Water;
        continue;
      }
      const woodNoise = valueNoise(cx * 0.19 + 40, cy * 0.19 + 40, noiseSeed + 91);
      if (woodNoise > 0.665 && t > 0.28 && t < 0.86 && !blocked[cell]) {
        ground[cell] = Ground.Wood;
        continue;
      }
      // Slope is read from the field, not the noise: the steepest neighbour
      // difference is what a unit actually has to climb. The thresholds are
      // measured, not guessed — over this generator's amplitude the gradient
      // between adjacent cells runs p50 6.8 m, p75 9.4 m, p95 13.9 m, so
      // these put roughly a quarter of the board on rough going and a
      // fifteenth on steep, most of it hugging the valley wall.
      let steepest = 0;
      if (x > 0) steepest = Math.max(steepest, Math.abs(elev[cell]! - elev[cell - 1]!));
      if (x < width - 1) steepest = Math.max(steepest, Math.abs(elev[cell]! - elev[cell + 1]!));
      if (y > 0) steepest = Math.max(steepest, Math.abs(elev[cell]! - elev[cell - width]!));
      if (y < height - 1) steepest = Math.max(steepest, Math.abs(elev[cell]! - elev[cell + width]!));
      ground[cell] = steepest > 13.5 ? Ground.Steep : steepest > 9.5 ? Ground.Rough : Ground.Open;
    }
  }

  // Fords.
  //
  // The first cut of this had exactly one crossing — the road bridge — and
  // the harness said so: the reference force's clear rate fell 33 points,
  // which is a difficulty spike wearing terrain's clothes. A river IS a wall
  // you did not pay for, and that is the point, but a single door on a
  // 32-cell map is worth more than any wall in the game.
  //
  // Two more crossings keep the water a wall and turn "there is one way in"
  // into "there are three, and they are not equally good".
  //
  // They did NOT move the clear rate — the elevation term turned out to be
  // what was crushing it — but they moved the butcher's bill the other way
  // from the obvious guess: more crossings cost the attacker MORE men
  // (85% to 91% on the hardest sheet), because a force that splits across
  // three fords arrives piecemeal, and piecemeal is how you die.
  for (const t of [0.28, 0.68]) {
    const at = riverPts[Math.floor(riverPts.length * t)];
    if (!at) continue;
    const fx = Math.round(at[0]);
    const fy = Math.round(at[1]);
    for (let dx = -2; dx <= 2; dx++) {
      const x = fx + dx;
      if (x < 0 || x >= width || fy < 0 || fy >= height) continue;
      const cell = fy * width + x;
      if (ground[cell] === Ground.Water) ground[cell] = Ground.Rough; // a shallow, and slow
    }
  }

  drainUntilConnected(ground, width, height, spawnColumn);

  return {
    version,
    width,
    height,
    band: (cell) => bandOf[cell] ?? 0,
    moveCost: (cell) => MOVE_COST[ground[cell] ?? Ground.Open]!,
    cover: (cell) => (ground[cell] === Ground.Wood ? WOOD_COVER : 1),
    passable: (cell) => ground[cell] !== Ground.Water,
    groundAt: (cell) => (ground[cell] ?? Ground.Open) as Ground,
    elevation: (cell) => elev[cell] ?? 0,
    elevationAt,
    bridge,
    road: roadPts,
    river: riverPts,
  };
}

/**
 * Guarantee the board is one piece.
 *
 * A river that spans the map cuts it in two, and an attacker with no route
 * goes `'stuck'` rather than losing — so connectivity is a correctness
 * property, not a nicety. The bridge normally provides it; this is the
 * backstop for the maps where the road and the water never meet, or meet
 * twice.
 *
 * The repair is a drain, in canonical cell order, and it always terminates:
 * every pass either connects the board or removes at least one water cell,
 * and there are finitely many.
 */
function drainUntilConnected(
  ground: Uint8Array,
  width: number,
  height: number,
  spawnColumn: number,
): void {
  const size = width * height;
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);

  const visit = (c: number, tail: number): number => {
    if (seen[c] || ground[c] === Ground.Water) return tail;
    seen[c] = 1;
    queue[tail++] = c;
    return tail;
  };

  /** Dry cells reachable from the spawn edge. */
  const flood = (): number => {
    seen.fill(0);
    let head = 0;
    let tail = 0;
    for (let y = 0; y < height; y++) tail = visit(y * width + spawnColumn, tail);
    while (head < tail) {
      const c = queue[head++]!;
      const x = c % width;
      const y = (c / width) | 0;
      if (x > 0) tail = visit(c - 1, tail);
      if (x < width - 1) tail = visit(c + 1, tail);
      if (y > 0) tail = visit(c - width, tail);
      if (y < height - 1) tail = visit(c + width, tail);
    }
    return tail;
  };

  let dry = 0;
  for (let c = 0; c < size; c++) if (ground[c] !== Ground.Water) dry++;

  for (let guard = 0; guard < size; guard++) {
    if (flood() >= dry) return;
    // Drain the first water cell that touches the reached region — that is
    // the cheapest cut to open, and taking the first in cell order keeps the
    // whole repair deterministic.
    let drained = -1;
    for (let c = 0; c < size && drained < 0; c++) {
      if (ground[c] !== Ground.Water) continue;
      const x = c % width;
      const y = (c / width) | 0;
      const touches =
        (x > 0 && seen[c - 1] === 1) ||
        (x < width - 1 && seen[c + 1] === 1) ||
        (y > 0 && seen[c - width] === 1) ||
        (y < height - 1 && seen[c + width] === 1);
      if (touches) drained = c;
    }
    if (drained < 0) return; // nothing left to open; the rest is unreachable by design
    ground[drained] = Ground.Road; // a ford: dry, and quick to cross
    dry++;
  }
}
