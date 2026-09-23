import { scaleFootprint } from '../sim/scale';
import type { CellIndex } from '../sim/types';
import { footprintOfKind } from '../content/catalog';
import { onSpawnLane, TOWN_GRID, type PlacedStructure } from './town';

/**
 * Carrying a war across a change of board.
 *
 * A cell index means something different on every board, so a save written
 * against an older one has to be moved rather than read — left alone, a base
 * does not merely shift, it scrambles, because the row stride changed under
 * it. There have been two moves, and a save takes every one it missed, in
 * order:
 *
 * 1. **v1.40, 32x24 -> 20x30: a transpose and a two-cell slide.**
 *    `(x, y) -> (y - 2, x)`, the map that carries the old command post to the
 *    new one. Every building keeps its exact offset from the post AND its
 *    distance from the line the enemy walks in on, so a base that funnelled
 *    attackers into a crossfire still does. It is looked at from the other
 *    axis, not rearranged.
 *
 * 2. **M34, 20x30 -> 10x15: the one rule.** A cell of the new board is two
 *    units, and a building at physical position `p` lands in cell
 *    `floor(p / 2)` — the rule the waves, the tunnels and the entry sectors
 *    all use, so a saved base and everything it is attacked with agree about
 *    where things are. Walls go by half-or-more, the rule `sim/board.ts`
 *    explains: a line stays a line and an opening is never closed, and what
 *    that costs is a line's ends and its odd stubs. A 2x2 building is one
 *    cell now, so two of them can want the same cell.
 *
 * Nothing the player built is thrown away. A building that has nowhere to
 * land, or lands on the entry lane or on ground that is now a river, walks out
 * to the nearest free legal cell instead — deterministic and total, a
 * canonical spiral aimed at where the map wanted to put it. A wall that does
 * not survive, or that the new wall budget has no room for, is REFUNDED: the
 * report counts them by kind, and the caller pays them back.
 */

/** The board every save before v1.40 was written against. */
export const LEGACY_GRID = {
  width: 32,
  height: 24,
  /** (27, 11) — where the command post stood. */
  ccOrigin: 11 * 32 + 27,
} as const;

/** The board of v1.40 to v1.44 (grid version 1): 20x30, a cell of one unit. */
export const V1_GRID = {
  width: 20,
  height: 30,
  /** (9, 27). */
  ccOrigin: 27 * 20 + 9,
  cellSize: 1,
} as const;

/** A board a town can be moved onto: its size, its post, and its cell. */
export interface Board {
  readonly width: number;
  readonly height: number;
  readonly ccOrigin: CellIndex;
  readonly cellSize: number;
}

/** A town's structures and walls, as the save holds them. */
export interface RegridTarget {
  structures: PlacedStructure[];
  walls: { cell: CellIndex; kind: string }[];
}

/** What the migration had to do, for the log, the refund and the tests. */
export interface RegridReport {
  /** Buildings and walls carried straight across. */
  carried: number;
  /** Ones that had to walk to a free cell because theirs was gone. */
  rehomed: number;
  /** Walls with no cell on the new board, by kind: the caller refunds them. */
  wallsDropped: Record<string, number>;
}

// ---- the v1.40 transpose ----------------------------------------------------------

const LEGACY_CC_X = LEGACY_GRID.ccOrigin % LEGACY_GRID.width;
const LEGACY_CC_Y = Math.floor(LEGACY_GRID.ccOrigin / LEGACY_GRID.width);
const V1_CC_X = V1_GRID.ccOrigin % V1_GRID.width;
const V1_CC_Y = Math.floor(V1_GRID.ccOrigin / V1_GRID.width);
/** The slide that lands the transposed post on the post. */
const SHIFT_X = V1_CC_X - LEGACY_CC_Y;
const SHIFT_Y = V1_CC_Y - LEGACY_CC_X;

/** A legacy cell on the 20x30 board, answering even when that is off it. */
function transposed(cell: CellIndex): { x: number; y: number } {
  const safe = Math.max(0, cell);
  const x = safe % LEGACY_GRID.width;
  const y = Math.floor(safe / LEGACY_GRID.width);
  return { x: y + SHIFT_X, y: x + SHIFT_Y };
}

/**
 * Where a legacy cell lands on the 20x30 board, or null when that is off it.
 *
 * Exported for the tests, which pin what the v1.40 move did cell by cell.
 */
export function regridCell(cell: CellIndex): CellIndex | null {
  const at = transposed(cell);
  if (at.x < 0 || at.x >= V1_GRID.width || at.y < 0 || at.y >= V1_GRID.height) return null;
  return at.y * V1_GRID.width + at.x;
}

// ---- moving a town onto a board ------------------------------------------------------

/** Every cell a footprint covers on `board`, or null if it runs off it. */
function spread(board: Board, origin: CellIndex, size: number): CellIndex[] | null {
  const x = origin % board.width;
  const y = Math.floor(origin / board.width);
  if (x + size > board.width || y + size > board.height) return null;
  const cells: CellIndex[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) cells.push((y + dy) * board.width + (x + dx));
  }
  return cells;
}

/**
 * The nearest cell a footprint of `size` fits on `board`, searched outward.
 *
 * Rings of growing Chebyshev radius, each scanned top-left to bottom-right, so
 * two saves that need the same rescue get the same answer. `near` itself is
 * tried first. Returns null only if the whole board is full.
 */
function nearestFree(
  board: Board,
  near: { x: number; y: number },
  size: number,
  taken: Set<CellIndex>,
  usable: (cell: CellIndex) => boolean,
): CellIndex[] | null {
  const span = Math.max(board.width, board.height);
  for (let r = 0; r <= span; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = near.x + dx;
        const y = near.y + dy;
        if (x < 0 || y < 0 || x >= board.width || y >= board.height) continue;
        const cells = spread(board, y * board.width + x, size);
        if (!cells) continue;
        if (cells.every((c) => !taken.has(c) && usable(c))) return cells;
      }
    }
  }
  return null;
}

/**
 * Put a town's buildings on `board` where `where` says, in place.
 *
 * `where` gives a building's intended position even off the board, so a
 * building with nowhere to land walks to the corner it belonged in rather than
 * to the enemy's doorstep. The post goes first and by fiat: it defines the
 * frame everything else was measured against, and the board already says where
 * it lives.
 */
function moveStructures(
  town: RegridTarget,
  board: Board,
  where: (cell: CellIndex) => { x: number; y: number },
  usable: (cell: CellIndex) => boolean,
  taken: Set<CellIndex>,
  report: RegridReport,
): void {
  const size = (kind: string): number =>
    scaleFootprint(footprintOfKind(kind, 1), board.cellSize);
  const claim = (was: CellIndex, n: number): CellIndex | null => {
    const at = where(was);
    const inside = at.x >= 0 && at.y >= 0 && at.x < board.width && at.y < board.height;
    const direct = inside ? spread(board, at.y * board.width + at.x, n) : null;
    if (direct && direct.every((c) => !taken.has(c) && usable(c))) {
      for (const c of direct) taken.add(c);
      report.carried++;
      return direct[0]!;
    }
    const near = {
      x: Math.min(board.width - 1, Math.max(0, at.x)),
      y: Math.min(board.height - 1, Math.max(0, at.y)),
    };
    const found = nearestFree(board, near, n, taken, usable);
    if (!found) return null;
    for (const c of found) taken.add(c);
    report.rehomed++;
    return found[0]!;
  };

  const cc = town.structures.find((s) => s.kind === 'cc');
  if (cc) {
    cc.cell = board.ccOrigin;
    for (const c of spread(board, cc.cell, size('cc')) ?? [cc.cell]) taken.add(c);
  }
  // Canonical order — by id, then by cell — so the same save always migrates
  // the same way, however the arrays happen to be ordered on disk.
  const rest = town.structures
    .filter((s) => s.kind !== 'cc')
    .sort((a, b) => a.id - b.id || a.cell - b.cell);
  const survivors: PlacedStructure[] = [];
  for (const s of rest) {
    const landed = claim(s.cell, size(s.kind));
    if (landed === null) continue; // a board with no room left at all
    s.cell = landed;
    survivors.push(s);
  }
  town.structures = cc ? [cc, ...survivors] : survivors;
}

/** The v1.40 move: 32x24 onto 20x30, walls cell for cell. */
function legacyToV1(town: RegridTarget, report: RegridReport): void {
  const taken = new Set<CellIndex>();
  // The 20x30 board's entry lane was row 0, as this board's is.
  const usable = (cell: CellIndex): boolean => Math.floor(cell / V1_GRID.width) !== 0;
  moveStructures(town, V1_GRID, transposed, usable, taken, report);
  const kept: { cell: CellIndex; kind: string }[] = [];
  for (const w of [...town.walls].sort((a, b) => a.cell - b.cell)) {
    const at = transposed(w.cell);
    const inside = at.x >= 0 && at.y >= 0 && at.x < V1_GRID.width && at.y < V1_GRID.height;
    const cell = inside ? at.y * V1_GRID.width + at.x : -1;
    if (cell >= 0 && !taken.has(cell) && usable(cell)) {
      taken.add(cell);
      report.carried++;
      kept.push({ cell, kind: w.kind });
      continue;
    }
    const near = {
      x: Math.min(V1_GRID.width - 1, Math.max(0, at.x)),
      y: Math.min(V1_GRID.height - 1, Math.max(0, at.y)),
    };
    const found = nearestFree(V1_GRID, near, 1, taken, usable);
    if (!found) {
      report.wallsDropped[w.kind] = (report.wallsDropped[w.kind] ?? 0) + 1;
      continue;
    }
    taken.add(found[0]!);
    report.rehomed++;
    kept.push({ cell: found[0]!, kind: w.kind });
  }
  town.walls = kept;
}

/**
 * The M34 move: 20x30 onto this board, by the one rule.
 *
 * Walls go by half-or-more and are never rehomed: a wall is a segment of a
 * line, and one walked off to the nearest free cell is a stray block rather
 * than part of the base. So a wall either lands in a block it holds half of
 * or it is refunded. `wallCap` is the budget the town's command centre allows
 * on this board; walls past it are refunded too, the ones furthest from the
 * post first.
 */
function v1ToBoard(
  town: RegridTarget,
  clear: (cell: CellIndex) => boolean,
  wallCap: number,
  report: RegridReport,
): void {
  const board: Board = TOWN_GRID;
  const f = TOWN_GRID.cellSize / V1_GRID.cellSize;
  const taken = new Set<CellIndex>();
  const usable = (cell: CellIndex): boolean => !onSpawnLane(cell) && clear(cell);
  const where = (cell: CellIndex): { x: number; y: number } => ({
    x: Math.floor((cell % V1_GRID.width) / f),
    y: Math.floor(Math.floor(cell / V1_GRID.width) / f),
  });
  moveStructures(town, board, where, usable, taken, report);

  const byBlock = new Map<CellIndex, { cell: CellIndex; kind: string }[]>();
  for (const w of town.walls) {
    const at = where(w.cell);
    const block = at.y * board.width + at.x;
    const list = byBlock.get(block);
    if (list) list.push(w);
    else byBlock.set(block, [w]);
  }
  const need = (f * f) / 2;
  const kept: { cell: CellIndex; kind: string }[] = [];
  const drop = (kind: string, n = 1): void => {
    report.wallsDropped[kind] = (report.wallsDropped[kind] ?? 0) + n;
  };
  for (const block of [...byBlock.keys()].sort((a, b) => a - b)) {
    const inBlock = byBlock.get(block)!;
    // The block's kind is the one most of its segments were; ties go to the
    // first in cell order, so the answer never depends on array order.
    const counts = new Map<string, number>();
    for (const w of [...inBlock].sort((a, b) => a.cell - b.cell)) {
      counts.set(w.kind, (counts.get(w.kind) ?? 0) + 1);
    }
    let kind = inBlock[0]!.kind;
    for (const [k, n] of counts) if (n > (counts.get(kind) ?? 0)) kind = k;
    const survives =
      inBlock.length >= need && block >= 0 && block < board.width * board.height && !taken.has(block) && usable(block);
    if (!survives) {
      for (const w of inBlock) drop(w.kind);
      continue;
    }
    taken.add(block);
    report.carried++;
    kept.push({ cell: block, kind });
    // The rest of the block's segments are refunded. Two segments of a line on
    // the old board are ONE segment of the same line on this one — a line is
    // half as many cells here, which is why the budget halved too — and the
    // player paid for two.
    const one = [...inBlock].sort((a, b) => a.cell - b.cell).find((w) => w.kind === kind)!;
    for (const w of inBlock) if (w !== one) drop(w.kind);
  }
  if (kept.length > wallCap) {
    const cx = board.ccOrigin % board.width;
    const cy = Math.floor(board.ccOrigin / board.width);
    const far = (cell: CellIndex): number =>
      Math.abs((cell % board.width) - cx) + Math.abs(Math.floor(cell / board.width) - cy);
    kept.sort((a, b) => far(a.cell) - far(b.cell) || a.cell - b.cell);
    for (const w of kept.splice(wallCap)) drop(w.kind);
    kept.sort((a, b) => a.cell - b.cell);
  }
  town.walls = kept;
}

/**
 * Move a town written against grid version `from` onto the current board, in
 * place, taking every move it missed in order.
 *
 * `clear` says whether a cell of the CURRENT board is usable ground — passed
 * in rather than read here so the caller decides whether the river is known
 * yet. The entry lane is refused regardless, since nothing may ever be built
 * on it. `wallCap` is the wall budget the town's command centre allows on the
 * current board; absent, no wall is refunded for want of room. `to` stops the
 * chain early, which only the tests of a single move need.
 */
export function regridTown(
  town: RegridTarget,
  from = 0,
  clear: (cell: CellIndex) => boolean = () => true,
  wallCap = Infinity,
  to: number = TOWN_GRID.version,
): RegridReport {
  const report: RegridReport = { carried: 0, rehomed: 0, wallsDropped: {} };
  if (from < 1 && to >= 1) legacyToV1(town, report);
  if (from < 2 && to >= 2) v1ToBoard(town, clear, wallCap, report);
  return report;
}
