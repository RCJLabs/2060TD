import type { CellIndex, Vec2 } from './types';

export interface WallState {
  hp: number;
  maxHp: number;
  /** Wall variant (catalog key): 'wall', 'hesco', … Renderers care; the sim only needs hp. */
  kind: string;
  /**
   * A gate standing open (v1.17). Pathing sees no obstacle and nothing can
   * shoot it — an open gate is a gap in the line, not a weaker wall. It stays
   * in the map because it can be closed again; a gate that is DESTROYED leaves
   * the map like any other wall, and that hole is permanent.
   */
  open?: boolean;
}

/**
 * The battlefield grid: bounds, walls (attackable obstacles with HP), and
 * hard-blocked cells (the Command Center footprint — truly impassable).
 *
 * Blocking *structures* live in the Engine; pathfinding sees them through the
 * PathGrid interface (see pathfinding.ts), which merges both obstacle sources.
 *
 * `version` increments on every topology change; attackers compare it against
 * the version their path was computed under and re-path when stale.
 */
export class Grid {
  readonly width: number;
  readonly height: number;
  readonly walls = new Map<CellIndex, WallState>();
  readonly blocked = new Set<CellIndex>();
  version = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  idx(x: number, y: number): CellIndex {
    return y * this.width + x;
  }

  xOf(cell: CellIndex): number {
    return cell % this.width;
  }

  yOf(cell: CellIndex): number {
    return Math.floor(cell / this.width);
  }

  centerOf(cell: CellIndex): Vec2 {
    return { x: this.xOf(cell) + 0.5, y: this.yOf(cell) + 0.5 };
  }

  cellAt(pos: Vec2): CellIndex {
    return this.idx(Math.floor(pos.x), Math.floor(pos.y));
  }

  inBounds(cell: CellIndex): boolean {
    return cell >= 0 && cell < this.width * this.height;
  }

  wallAt(cell: CellIndex): WallState | undefined {
    return this.walls.get(cell);
  }

  isBlocked(cell: CellIndex): boolean {
    return this.blocked.has(cell);
  }

  isOpen(cell: CellIndex): boolean {
    const wall = this.walls.get(cell);
    return (wall === undefined || wall.open === true) && !this.blocked.has(cell);
  }

  /**
   * Swing a gate. Returns false when the cell holds no wall or the wall is
   * already in that state; the caller decides whether that is worth charging
   * for. Bumps the version, which is what makes every attacker re-path on the
   * next tick — the engine already re-paths on a stale version, so a gate
   * needs no pathfinding of its own.
   */
  setWallOpen(cell: CellIndex, open: boolean): boolean {
    const wall = this.walls.get(cell);
    if (!wall || (wall.open === true) === open) return false;
    if (open) wall.open = true;
    else delete wall.open;
    this.version++;
    return true;
  }

  placeWall(cell: CellIndex, hp: number, kind = 'wall'): void {
    this.walls.set(cell, { hp, maxHp: hp, kind });
    this.version++;
  }

  removeWall(cell: CellIndex): void {
    if (this.walls.delete(cell)) this.version++;
  }

  addBlocker(cell: CellIndex): void {
    this.blocked.add(cell);
    this.version++;
  }

  /** Applies damage; returns true if the wall was destroyed. An open gate is a
   * gap — there is nothing standing there to hit. */
  damageWall(cell: CellIndex, damage: number): boolean {
    const wall = this.walls.get(cell);
    if (!wall || wall.open === true) return false;
    wall.hp -= damage;
    if (wall.hp <= 0) {
      this.walls.delete(cell);
      this.version++;
      return true;
    }
    return false;
  }

  /** PathGrid obstacle view for a bare grid: walls breakable, blockers hard. */
  obstacleHpAt(cell: CellIndex): number {
    const wall = this.walls.get(cell);
    if (wall && wall.open !== true) return wall.hp;
    return this.blocked.has(cell) ? Infinity : 0;
  }

  /** 4-connected neighbors, in a fixed deterministic order (N, E, S, W). */
  neighbors4(cell: CellIndex, out: CellIndex[]): number {
    const x = this.xOf(cell);
    const y = this.yOf(cell);
    let n = 0;
    if (y > 0) out[n++] = cell - this.width;
    if (x < this.width - 1) out[n++] = cell + 1;
    if (y < this.height - 1) out[n++] = cell + this.width;
    if (x > 0) out[n++] = cell - 1;
    return n;
  }
}
