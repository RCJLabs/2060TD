import type { CellIndex } from '../sim/types';
import { footprintCells, onSpawnLane, TOWN_GRID, type PlacedStructure } from './town';

/**
 * Carrying a war across the turn of the board (v1.40).
 *
 * The board was 32 wide and 24 tall, entered down the western column. It is
 * now 20 wide and 30 tall, entered across the northern row. A cell index means
 * something different on each, so a save written before this release has to be
 * moved rather than read — left alone, a base does not merely shift, it
 * scrambles, because the row stride changed underneath it.
 *
 * The move is a TRANSPOSE and a two-cell slide:
 *
 *     (x, y)  ->  (y - 2, x)
 *
 * which is the map that carries the old command post to the new one. That is
 * the whole reason to prefer it over anything cleverer: every building keeps
 * its exact offset from the post AND its exact distance from the line the
 * enemy walks in on, so a base that funnelled attackers into a crossfire still
 * does. The base is not rearranged; it is looked at from the other axis.
 *
 * Nothing the player built is thrown away. The old board had 768 cells and the
 * new one has 600, so a corner of it has nowhere to land — anything that falls
 * off, or onto ground that is now a river or the entry lane, walks out to the
 * nearest free legal cell instead. Deterministic and total: the walk is a
 * canonical spiral and a town cannot hold 600 buildings.
 */

/** The board every save before v1.40 was written against. */
export const LEGACY_GRID = {
  width: 32,
  height: 24,
  /** (27, 11) — where the command post stood. */
  ccOrigin: 11 * 32 + 27,
} as const;

const LEGACY_CC_X = LEGACY_GRID.ccOrigin % LEGACY_GRID.width;
const LEGACY_CC_Y = Math.floor(LEGACY_GRID.ccOrigin / LEGACY_GRID.width);
const CC_X = TOWN_GRID.ccOrigin % TOWN_GRID.width;
const CC_Y = Math.floor(TOWN_GRID.ccOrigin / TOWN_GRID.width);
/** The slide that lands the transposed post on the post. */
const SHIFT_X = CC_X - LEGACY_CC_Y;
const SHIFT_Y = CC_Y - LEGACY_CC_X;

/**
 * Where a legacy cell lands on the current board, or null when that is off it.
 *
 * Exported for the share codec, which carries base layouts written against the
 * same old board and has exactly the same problem.
 */
export function regridCell(cell: CellIndex): CellIndex | null {
  const at = regridPoint(cell);
  if (at.x < 0 || at.x >= TOWN_GRID.width || at.y < 0 || at.y >= TOWN_GRID.height) return null;
  return at.y * TOWN_GRID.width + at.x;
}

/**
 * The same map, but answering even when the result is off the board.
 *
 * What a building that has nowhere to land still needs is a DIRECTION: the
 * dump in the old board's far corner should be rehomed into the new board's
 * far corner, not wherever a search happens to reach first. Clamping this is
 * what turns "off the map" into "as close to where it belonged as there is
 * room for".
 */
function regridPoint(cell: CellIndex): { x: number; y: number } {
  const safe = Math.max(0, cell);
  const x = safe % LEGACY_GRID.width;
  const y = Math.floor(safe / LEGACY_GRID.width);
  return { x: y + SHIFT_X, y: x + SHIFT_Y };
}

/** Every cell a footprint of this size covers, or null if it runs off the board. */
function spread(origin: CellIndex, size: 1 | 2): CellIndex[] | null {
  const x = origin % TOWN_GRID.width;
  const y = Math.floor(origin / TOWN_GRID.width);
  if (x + size > TOWN_GRID.width || y + size > TOWN_GRID.height) return null;
  const cells: CellIndex[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) cells.push((y + dy) * TOWN_GRID.width + (x + dx));
  }
  return cells;
}

/**
 * The nearest cell a footprint of `size` fits, searched outward from `near`.
 *
 * Rings of growing Chebyshev radius, each scanned top-left to bottom-right, so
 * two saves that need the same rescue get the same answer. `near` itself is
 * tried first. Returns null only if the whole board is full.
 */
function nearestFree(
  near: { x: number; y: number },
  size: 1 | 2,
  taken: Set<CellIndex>,
  clear: (cell: CellIndex) => boolean,
): CellIndex[] | null {
  const span = Math.max(TOWN_GRID.width, TOWN_GRID.height);
  for (let r = 0; r <= span; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = near.x + dx;
        const y = near.y + dy;
        if (x < 0 || y < 0 || x >= TOWN_GRID.width || y >= TOWN_GRID.height) continue;
        const cells = spread(y * TOWN_GRID.width + x, size);
        if (!cells) continue;
        if (cells.every((c) => !taken.has(c) && clear(c))) return cells;
      }
    }
  }
  return null;
}

/** A town's structures and walls, as the save holds them. */
export interface RegridTarget {
  structures: PlacedStructure[];
  walls: { cell: CellIndex; kind: string }[];
}

/** What the migration had to do, for the log and for the tests. */
export interface RegridReport {
  /** Buildings and walls carried straight across by the transpose. */
  carried: number;
  /** Ones that had to walk to a free cell because theirs was gone. */
  rehomed: number;
}

/**
 * Move a legacy town onto the current board, in place.
 *
 * `clear` says whether a cell is usable ground — passed in rather than read
 * here so the caller decides whether the river is known yet. The entry lane is
 * refused regardless, since nothing may ever be built on it.
 */
export function regridTown(
  town: RegridTarget,
  clear: (cell: CellIndex) => boolean = () => true,
): RegridReport {
  const taken = new Set<CellIndex>();
  const usable = (cell: CellIndex): boolean => !onSpawnLane(cell) && clear(cell);
  const report: RegridReport = { carried: 0, rehomed: 0 };

  const claim = (was: CellIndex, size: 1 | 2): CellIndex | null => {
    const origin = regridCell(was);
    const direct = origin === null ? null : spread(origin, size);
    if (direct && direct.every((c) => !taken.has(c) && usable(c))) {
      for (const c of direct) taken.add(c);
      report.carried++;
      return origin;
    }
    // Aim the walk at where the transpose WANTED to put it, clamped onto the
    // board, so a building that fell off the old board's far corner lands in
    // the new board's far corner — not on the enemy's doorstep, which is
    // where a fallback to cell 0 puts it.
    const wanted = regridPoint(was);
    const near = {
      x: Math.min(TOWN_GRID.width - 1, Math.max(0, wanted.x)),
      y: Math.min(TOWN_GRID.height - 1, Math.max(0, wanted.y)),
    };
    const found = nearestFree(near, size, taken, usable);
    if (!found) return null;
    for (const c of found) taken.add(c);
    report.rehomed++;
    return found[0]!;
  };

  // The post first and by fiat: it defines the frame everything else was
  // measured against, and the new board already says where it lives.
  const cc = town.structures.find((s) => s.kind === 'cc');
  if (cc) {
    cc.cell = TOWN_GRID.ccOrigin;
    for (const c of footprintCells('cc', cc.cell)) taken.add(c);
  }

  // Canonical order — by id, then by cell — so the same save always migrates
  // the same way, however the arrays happen to be ordered on disk.
  const rest = town.structures
    .filter((s) => s.kind !== 'cc')
    .sort((a, b) => a.id - b.id || a.cell - b.cell);
  const survivors: PlacedStructure[] = [];
  for (const s of rest) {
    const size = footprintCells(s.kind, 0).length === 4 ? 2 : 1;
    const landed = claim(s.cell, size);
    if (landed === null) continue; // a board with no room left at all
    s.cell = landed;
    survivors.push(s);
  }
  town.structures = cc ? [cc, ...survivors] : survivors;

  const walls = [...town.walls].sort((a, b) => a.cell - b.cell);
  const keptWalls: { cell: CellIndex; kind: string }[] = [];
  for (const w of walls) {
    const landed = claim(w.cell, 1);
    if (landed === null) continue;
    w.cell = landed;
    keptWalls.push(w);
  }
  town.walls = keptWalls;

  return report;
}
