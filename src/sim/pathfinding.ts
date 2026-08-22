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

  const goalList = (Array.isArray(goals) ? goals : [goals]).filter(
    (g) => inBounds(g) && grid.obstacleHpAt(g) !== Infinity,
  );
  if (goalList.length === 0) return null;

  const goalSet = new Set(goalList);
  if (goalSet.has(start)) return { cells: [start], cost: 0 };

  const stepCost = 1 / profile.speed;
  const goalXs = goalList.map((g) => g % grid.width);
  const goalYs = goalList.map((g) => Math.floor(g / grid.width));

  const heuristic = (cell: CellIndex): number => {
    const x = cell % grid.width;
    const y = Math.floor(cell / grid.width);
    let best = Infinity;
    for (let i = 0; i < goalXs.length; i++) {
      const d = Math.abs(x - goalXs[i]!) + Math.abs(y - goalYs[i]!);
      if (d < best) best = d;
    }
    return best * stepCost;
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

      const obstacleHp = grid.obstacleHpAt(next);
      let enterCost = stepCost;
      if (obstacleHp > 0) {
        if (obstacleHp === Infinity || profile.wallDps <= 0) continue; // impassable
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
