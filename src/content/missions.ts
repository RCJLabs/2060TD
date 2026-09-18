import type { SiegeDef, WaveEntry } from '../sim/types';

/**
 * M1 mission: HOLD THE LINE — the first siege of the Landfall arc.
 * Five authored waves teaching the core reads in order: swarms melt,
 * sappers void your maze, grenadiers eat field defenses, armor eats
 * small arms, and the Type 99 demands kinetic focus or powers.
 */

/**
 * One arrival, `col` cells along the entry line.
 *
 * A COLUMN since v1.40: the board turned upright and the attack comes down it
 * from the north, so where a unit enters is how far across the top it is.
 * Every authored lane in this file and in the campaign arcs was rewritten from
 * the old 24-cell western line onto the 20-cell northern one, scaled and held
 * a cell clear of each end — the same spreads, the same flanks, a narrower
 * board.
 */
export const entry = (atTick: number, kind: string, col: number): WaveEntry => ({
  atTick,
  kind,
  col,
});

/** n spawns of `kind`, starting at `from`, every `step` ticks, cycling columns. */
export function series(
  from: number,
  step: number,
  n: number,
  kind: string,
  cols: number[],
): WaveEntry[] {
  const out: WaveEntry[] = [];
  for (let i = 0; i < n; i++) {
    out.push(entry(from + i * step, kind, cols[i % cols.length]!));
  }
  return out;
}

export const HOLD_THE_LINE: SiegeDef = {
  name: 'HOLD THE LINE',
  startingSupplies: 650,
  suppliesPerWave: 120,
  startingCp: 40,
  cpCap: 150,
  cpPerSecond: 1.2,
  prepSeconds: 25,
  repairCostPerHp: 0.04,
  waves: [
    // W1 — probe: militia trickle, a pair of rifle squads at the tail.
    {
      entries: [
        ...series(0, 40, 8, 'militia', [7, 10, 13]),
        ...series(340, 40, 2, 'rifle', [10]),
      ],
    },
    // W2 — the maze lesson, twice over: a sapper leads the swarm through the
    // hole, and a pair of WZ-10s ignore the hole entirely.
    {
      entries: [
        entry(0, 'sapper', 12),
        ...series(60, 36, 10, 'militia', [3, 7, 13, 17]),
        ...series(260, 40, 4, 'rifle', [10]),
        ...series(180, 90, 2, 'wz10', [7, 12]),
      ],
    },
    // W3 — suppression: grenadiers stand off and shell defenses, sappers flank.
    {
      entries: [
        ...series(0, 60, 2, 'grenadier', [8, 12]),
        ...series(100, 40, 8, 'rifle', [7, 10, 13]),
        ...series(220, 60, 3, 'sapper', [3, 10, 17]),
      ],
    },
    // W4 — combined push: two militia lanes, grenadier line, first armor.
    {
      entries: [
        ...series(0, 20, 6, 'militia', [3, 5]),
        ...series(0, 20, 6, 'militia', [15, 17]),
        ...series(260, 40, 4, 'grenadier', [8, 12]),
        ...series(420, 40, 2, 'zbd', [7, 13]),
      ],
    },
    // W5 — the hammer: escorts, screen, then the Type 99.
    {
      entries: [
        ...series(0, 40, 2, 'zbd', [7, 13]),
        ...series(80, 40, 6, 'rifle', [5, 10, 15]),
        ...series(300, 40, 3, 'grenadier', [8, 10, 12]),
        ...series(400, 40, 2, 'sapper', [7, 13]),
        entry(520, 'type99', 12),
      ],
    },
  ],
};
