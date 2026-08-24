import type { CellIndex } from './types';

/**
 * Weighted A* — the maze rule.
 *
 * Path cost is measured in seconds. Entering an open cell costs 1/speed;
 * entering a cell holding a breakable obstacle (a wall, or a blocking
 * structure such as a foxhole) costs 1/speed + obstacleHP/wallDps — the time
 * spent demolishing it. Units with wallDps = 0 treat obstacles as impassable;
 * Infinity HP (the Command Center footprint) is impassable for everyone.
 *
 * This single rule produces the game's core behaviors: most units genuinely
 * prefer going around (mazing works), breachers happily go through, turret
 * rings are legal but demolishable, and a fully enclosed base trades HP for
 * time instead of being invincible.
 *
 * Supports multiple goals (e.g. the 8 perimeter cells of the 2×2 Command
 * Center): the path ends at whichever goal is cheapest to reach.
 */

/** What A* needs to know about the battlefield. Grid and Engine both provide it. */
export interface PathGrid {
  readonly width: number;
  readonly height: number;
  /** 0 = open, finite = breakable obstacle HP, Infinity = impassable. */
  obstacleHpAt(cell: CellIndex): number;
  neighbors4(cell: CellIndex, out: CellIndex[]): number;
  /**
   * Ground multiplier on the time it takes to enter a cell — a road is below
   * 1, mud and slope above it. Absent means flat ground everywhere.
   *
   * The movement integrator in the engine MUST charge the same multiplier per
   * segment, or units drift off the paths they were given.
   */
  moveCostAt?(cell: CellIndex): number;
  /**
   * The smallest value `moveCostAt` can ever return. The heuristic is scaled
   * by it, and getting this wrong is the one way terrain can break A*: see
   * the note on `heuristic` below.
   */
  readonly minMoveCost?: number;
}

export interface PathProfile {
  /** Cells per second. */
  speed: number;
  /** Demolition damage per second vs breakable obstacles; 0 = cannot break. */
  wallDps: number;
}

export interface PathResult {
  /** Cells from start to the reached goal inclusive; cells[0] === start. */
  cells: CellIndex[];
  /** Total traversal time in seconds. */
  cost: number;
}

/** Binary min-heap ordered by (f, then h, then cell index) — fully deterministic. */
class OpenHeap {
  private cells: CellIndex[] = [];
  private f: Float64Array;
  private h: Float64Array;

  constructor(f: Float64Array, h: Float64Array) {
    this.f = f;
    this.h = h;
  }

  get size(): number {
    return this.cells.length;
  }

  private less(a: CellIndex, b: CellIndex): boolean {
    const fa = this.f[a]!;
    const fb = this.f[b]!;
    if (fa !== fb) return fa < fb;
    const ha = this.h[a]!;
    const hb = this.h[b]!;
    if (ha !== hb) return ha < hb;
    return a < b;
  }

  push(cell: CellIndex): void {
    const arr = this.cells;
    arr.push(cell);
    let i = arr.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(arr[i]!, arr[parent]!)) {
        [arr[i], arr[parent]] = [arr[parent]!, arr[i]!];
        i = parent;
      } else break;
    }
  }

  pop(): CellIndex {
    const arr = this.cells;
    const top = arr[0]!;
    const last = arr.pop()!;
    if (arr.length > 0) {
      arr[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < arr.length && this.less(arr[l]!, arr[smallest]!)) smallest = l;
        if (r < arr.length && this.less(arr[r]!, arr[smallest]!)) smallest = r;
        if (smallest === i) break;
        [arr[i], arr[smallest]] = [arr[smallest]!, arr[i]!];
        i = smallest;
      }
    }
    return top;
  }
}

export function findPath(
  grid: PathGrid,
  start: CellIndex,
  goals: CellIndex | CellIndex[],
  profile: PathProfile,
): PathResult | null {
  const size = grid.width * grid.height;
  const inBounds = (c: CellIndex) => c >= 0 && c < size;
  if (!inBounds(start)) return null;

  // A goal nobody can stand on is not a goal. Both filters matter: the first
  // drops the command centre's own cells, the second drops anything the water
  // took.
  const goalList = (Array.isArray(goals) ? goals : [goals]).filter(
    (g) =>
      inBounds(g) && grid.obstacleHpAt(g) !== Infinity && (grid.moveCostAt?.(g) ?? 1) !== Infinity,
  );
  if (goalList.length === 0) return null;

  const goalSet = new Set(goalList);
  if (goalSet.has(start)) return { cells: [start], cost: 0 };

  const stepCost = 1 / profile.speed;
  const minMove = grid.minMoveCost ?? 1;
  const goalXs = goalList.map((g) => g % grid.width);
  const goalYs = goalList.map((g) => Math.floor(g / grid.width));

  /**
   * Manhattan distance priced at the CHEAPEST ground on the board.
   *
   * The `* minMove` is not a refinement — it is what keeps A* correct once a
   * road costs less than a plain step. An unscaled heuristic assumes every
   * remaining cell costs `1 / speed`, which over-estimates any route that
   * ends on roads; combined with `closed[next]` below (nodes are never
   * reopened) an inadmissible heuristic returns a silently suboptimal path
   * rather than failing. The price is a weaker bound and more nodes expanded,
   * which on a 32×24 board is nothing.
   */
  const heuristic = (cell: CellIndex): number => {
    const x = cell % grid.width;
    const y = Math.floor(cell / grid.width);
    let best = Infinity;
    for (let i = 0; i < goalXs.length; i++) {
      const d = Math.abs(x - goalXs[i]!) + Math.abs(y - goalYs[i]!);
      if (d < best) best = d;
    }
    return best * stepCost * minMove;
  };

  const g = new Float64Array(size).fill(Infinity);
  const f = new Float64Array(size).fill(Infinity);
  const h = new Float64Array(size).fill(0);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);

  const open = new OpenHeap(f, h);
  g[start] = 0;
  h[start] = heuristic(start);
  f[start] = h[start]!;
  open.push(start);

  const neighbors: CellIndex[] = [0, 0, 0, 0];

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue; // stale heap entry
    closed[current] = 1;

    if (goalSet.has(current)) {
      const cells: CellIndex[] = [];
      let c: CellIndex = current;
      while (c !== -1) {
        cells.push(c);
        c = cameFrom[c]!;
      }
      cells.reverse();
      return { cells, cost: g[current]! };
    }

    const count = grid.neighbors4(current, neighbors);
    for (let i = 0; i < count; i++) {
      const next = neighbors[i]!;
      if (closed[next]) continue;

      const ground = grid.moveCostAt?.(next) ?? 1;
      if (ground === Infinity) continue; // water
      const obstacleHp = grid.obstacleHpAt(next);
      let enterCost = stepCost * ground;
      if (obstacleHp > 0) {
        if (obstacleHp === Infinity || profile.wallDps <= 0) continue; // impassable
        // Chewing through a wall takes the same time wherever it stands.
        enterCost += obstacleHp / profile.wallDps;
      }

      const tentative = g[current]! + enterCost;
      if (tentative < g[next]!) {
        g[next] = tentative;
        h[next] = heuristic(next);
        f[next] = tentative + h[next]!;
        cameFrom[next] = current;
        open.push(next);
      }
    }
  }

  return null; // unreachable
}
