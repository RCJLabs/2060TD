import type { Grid } from './grid';
import type { CellIndex } from './types';

/**
 * Weighted A* — the maze rule.
 *
 * Path cost is measured in seconds. Entering an open cell costs 1/speed;
 * entering a walled cell costs 1/speed + wallHP/wallDps (the time spent
 * chewing through it). Units with wallDps = 0 treat walls as impassable.
 *
 * This single rule produces the game's core behaviors: most units genuinely
 * prefer going around (mazing works), breachers happily go through, and a
 * fully enclosed base trades wall HP for time instead of being invincible.
 */

export interface PathProfile {
  /** Cells per second. */
  speed: number;
  /** Damage per second vs walls; 0 = cannot break walls. */
  wallDps: number;
}

export interface PathResult {
  /** Cells from start to goal inclusive; cells[0] === start. */
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
  grid: Grid,
  start: CellIndex,
  goal: CellIndex,
  profile: PathProfile,
): PathResult | null {
  if (!grid.inBounds(start) || !grid.inBounds(goal)) return null;
  if (start === goal) return { cells: [start], cost: 0 };

  const size = grid.width * grid.height;
  const stepCost = 1 / profile.speed;

  const g = new Float64Array(size).fill(Infinity);
  const f = new Float64Array(size).fill(Infinity);
  const h = new Float64Array(size).fill(0);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);

  const gx = grid.xOf(goal);
  const gy = grid.yOf(goal);
  const heuristic = (cell: CellIndex): number =>
    (Math.abs(grid.xOf(cell) - gx) + Math.abs(grid.yOf(cell) - gy)) * stepCost;

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

    if (current === goal) {
      const cells: CellIndex[] = [];
      let c: CellIndex = goal;
      while (c !== -1) {
        cells.push(c);
        c = cameFrom[c]!;
      }
      cells.reverse();
      return { cells, cost: g[goal]! };
    }

    const count = grid.neighbors4(current, neighbors);
    for (let i = 0; i < count; i++) {
      const next = neighbors[i]!;
      if (closed[next]) continue;
      if (grid.isBlocked(next)) continue;

      let enterCost = stepCost;
      const wall = grid.wallAt(next);
      if (wall) {
        if (profile.wallDps <= 0) continue; // impassable for this unit
        enterCost += wall.hp / profile.wallDps;
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
