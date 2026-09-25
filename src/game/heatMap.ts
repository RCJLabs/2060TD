/**
 * The heat map (M29 Phase 2): where a battle bled, drawn over its board.
 *
 * Two marks, both in the page's one colour. The palette keeps that colour for
 * what a player has to see, and a map the player turned on to see where a
 * raid bled is exactly that:
 *
 * - a SHADE over each cell the fire landed in, deeper the more of the force
 *   it hit there: where the guns reach and how hard, including on the men
 *   who lived. It is scaled to the battle's worst cell, but never to less
 *   than `HIT_FLOOR`, so a raid that took a few scratches does not paint them
 *   as if they were the killing ground. A wash, never a fill: what is under it
 *   has to read through it.
 * - a CROSS where each man fell, on a paper halo, so it reads on tone, on ink
 *   and on the shade.
 *
 * One function for every board that shows it: the replay draws the heat as
 * the footage plays, and the raid planner draws the last raid on a post.
 */
import type { Ink } from './ink';
import { COLORS } from './palette';

export interface HeatView {
  /** The board's width in cells, which `hits` is laid out by. */
  width: number;
  /** Damage taken in each cell, row-major, in men's worth (`AfterAction.hits`). */
  hits: readonly number[];
  /** Where each man fell, in cells. */
  deaths: readonly { at: { x: number; y: number } }[];
}

/** The damage, in men's worth, that shades a cell at full strength at the least. */
export const HIT_FLOOR = 1;

/** The shade at full strength. */
const SHADE = 0.42;

/** What the marks mean, said the same way wherever they are drawn. */
export function heatLegend(fell?: number): string {
  return `× WHERE EACH MAN FELL${fell === undefined ? '' : ` (${fell})`} · SHADED WHERE THEY WERE HIT`;
}

/** Draw `heat` over a board whose cells are `cell` px. */
export function drawHeatMap(g: Ink, heat: HeatView, cell: number): void {
  let most = HIT_FLOOR;
  for (const s of heat.hits) if (s > most) most = s;
  heat.hits.forEach((s, i) => {
    if (s <= 0) return;
    // By the square root: a cell hit a quarter as hard as the worst still
    // reads at half its strength, rather than fading into the paper.
    g.fillStyle(COLORS.signal, SHADE * Math.sqrt(Math.min(1, s / most)));
    g.fillRect((i % heat.width) * cell, Math.floor(i / heat.width) * cell, cell, cell);
  });
  // The halo first under every cross, then the crosses, so no halo cuts
  // into a cross beside it.
  const arm = cell * 0.2;
  const passes = [
    { width: Math.max(3.5, cell * 0.17), color: COLORS.bgField },
    { width: Math.max(1.8, cell * 0.08), color: COLORS.signal },
  ];
  for (const pass of passes) {
    g.lineStyle(pass.width, pass.color, 1);
    for (const { at } of heat.deaths) {
      const x = at.x * cell;
      const y = at.y * cell;
      g.lineBetween(x - arm, y - arm, x + arm, y + arm);
      g.lineBetween(x - arm, y + arm, x + arm, y - arm);
    }
  }
}
