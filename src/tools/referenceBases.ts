import type { Board } from '../meta/regrid';
import { TOWN_GRID } from '../meta/town';
import type { CellIndex, LayoutStructure, LayoutWall } from '../sim/types';

/*
 * The balance harness's three reference defences, EARLY, MID and LATE.
 *
 * In their own module since M24 Phase 2, so the economy instrument can fight
 * them too: `balance.ts` runs its whole harness the moment it is imported.
 */

export interface ReferenceBase {
  name: string;
  ccLevel: number;
  /** The board it is drawn on, which is the board it is fought on (M34). */
  board: Board;
  walls: LayoutWall[];
  structures: LayoutStructure[];
}

/**
 * The reference bases below are written in APPROACH SPACE, like the generated
 * ones: `u` is depth from the line the attack comes down, `v` runs across it.
 */
export const idx = (u: number, v: number): CellIndex => u * TOWN_GRID.width + v;

/** A wall line at depth u covering [v0, v1], skipping the listed gaps. */
export function wallLine(base: ReferenceBase, u: number, v0: number, v1: number, gaps: number[]): void {
  for (let v = v0; v <= v1; v++) {
    if (!gaps.includes(v)) base.walls.push({ cell: u * base.board.width + v, kind: 'wall' });
  }
}

/**
 * Reference towns, staged like a real save: everything within CC gating for
 * its level (counts and structure levels), funnels facing the entry line.
 *
 * DRAWN for the 10x15 board (M34), not mapped onto it. Mapping by the one rule
 * is what Phase 4 measured, and it costs a base two thirds of its wall: a
 * one-thick line keeps only the blocks it fills half of, so line ends and
 * two-cell stubs vanish. These keep each 20x30 base's DESIGN at the new
 * resolution — the same lines, with the same openings in the same order, and
 * the same guns in the same roles — and give up its coordinates, which a board
 * this coarse cannot express. Guns are one cell on both boards, so here each
 * stands on twice the ground it did; the post is one cell at (4, 13).
 *
 * Every line spans columns 1-8 and leaves both edge columns open, as the 20x30
 * lines left columns 0 and 19. A gap is one cell: two physical units, the
 * width of the two-cell gaps it replaces. A pocket between lines is two rows
 * where guns stand in it, and one where it only carries attackers across —
 * a gun in a one-row pocket is a wall across it.
 *
 * What covers the post is kept too. The 20x30 MID had one gun within the cover
 * radius and LATE four; so do these, and none sits exactly ON the radius, the
 * knife-edge Phase 4 found deciding battles.
 */
export function referenceBases(): ReferenceBase[] {
  const board = TOWN_GRID;
  // EARLY (CC1): one line, its gap on the post's column, two nests flanking
  // the gap from behind and the autocannon out to the left — CC1's WHOLE gun
  // allowance. Three guns could not hold a level-4 assault on 20x30 however
  // they were arranged, so EARLY's missing contested band is a question about
  // what CC1 is FOR, not about this layout.
  const early: ReferenceBase = { name: 'EARLY (CC1)', ccLevel: 1, board, walls: [], structures: [] };
  wallLine(early, 10, 1, 8, [4]);
  early.structures = [
    { cell: idx(11, 3), kind: 'm2nest', level: 1 },
    { cell: idx(11, 5), kind: 'm2nest', level: 1 },
    { cell: idx(11, 1), kind: 'autocannon', level: 1 },
  ];

  // MID (CC2): the serpentine. In at the centre past two nests, across the
  // pocket, out near an edge past an autocannon, and back to the post under
  // the mortar. Each autocannon stands beside one of the inner line's two
  // openings, so whichever way the attack turns, an AT gun is waiting.
  const mid: ReferenceBase = { name: 'MID (CC2)', ccLevel: 2, board, walls: [], structures: [] };
  wallLine(mid, 8, 1, 8, [4]);
  wallLine(mid, 11, 1, 8, [1, 8]);
  mid.structures = [
    { cell: idx(9, 3), kind: 'm2nest', level: 2 },
    { cell: idx(9, 5), kind: 'm2nest', level: 2 },
    { cell: idx(14, 1), kind: 'm2nest', level: 2 },
    { cell: idx(12, 2), kind: 'autocannon', level: 2 },
    { cell: idx(12, 7), kind: 'autocannon', level: 2 },
    { cell: idx(14, 3), kind: 'mortar', level: 1 },
  ];

  // LATE (CC3): three lines, centre / edges / centre, so the way in crosses
  // the board twice. Two nests in the first pocket, the second pocket left
  // clear because it is one row, and the post ringed by four covering guns —
  // max emplacements at level 3.
  const late: ReferenceBase = { name: 'LATE (CC3)', ccLevel: 3, board, walls: [], structures: [] };
  wallLine(late, 6, 1, 8, [4]);
  wallLine(late, 9, 1, 8, [1, 8]);
  wallLine(late, 11, 1, 8, [4]);
  late.structures = [
    { cell: idx(8, 2), kind: 'm2nest', level: 3 },
    { cell: idx(8, 7), kind: 'm2nest', level: 3 },
    { cell: idx(12, 1), kind: 'm2nest', level: 3 },
    { cell: idx(12, 8), kind: 'm2nest', level: 3 },
    { cell: idx(12, 3), kind: 'autocannon', level: 3 },
    { cell: idx(12, 5), kind: 'autocannon', level: 3 },
    { cell: idx(8, 4), kind: 'autocannon', level: 3 },
    { cell: idx(14, 3), kind: 'mortar', level: 2 },
    { cell: idx(14, 5), kind: 'mortar', level: 2 },
  ];

  return [early, mid, late];
}
