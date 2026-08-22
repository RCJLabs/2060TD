import type { CellIndex, Vec2 } from './types';

export interface WallState {
  hp: number;
  maxHp: number;
}

/**
 * The battlefield grid: bounds, walls (attackable obstacles with HP), and
 * hard blockers (turret footprints — impassable and unbreakable in M0).
 *
 * `version` increments on every topology change; runners compare it against
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
    return !this.walls.has(cell) && !this.blocked.has(cell);
  }

  placeWall(cell: CellIndex, hp: number): void {
    this.walls.set(cell, { hp, maxHp: hp });
    this.version++;
  }

  removeWall(cell: CellIndex): void {
    if (this.walls.delete(cell)) this.version++;
  }

  addBlocker(cell: CellIndex): void {
    this.blocked.add(cell);
    this.version++;
  }

  /** Applies damage; returns true if the wall was destroyed. */
  damageWall(cell: CellIndex, damage: number): boolean {
    const wall = this.walls.get(cell);
    if (!wall) return false;
    wall.hp -= damage;
    if (wall.hp <= 0) {
      this.walls.delete(cell);
      this.version++;
      return true;
    }
    return false;
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
