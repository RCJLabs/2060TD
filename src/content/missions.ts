import type { SiegeDef, WaveEntry } from '../sim/types';

/**
 * M1 mission: HOLD THE LINE — the first siege of the Landfall arc.
 * Five authored waves teaching the core reads in order: swarms melt,
 * sappers void your maze, grenadiers eat field defenses, armor eats
 * small arms, and the Type 99 demands kinetic focus or powers.
 */

const entry = (atTick: number, kind: string, row: number): WaveEntry => ({ atTick, kind, row });

/** n spawns of `kind`, starting at `from`, every `step` ticks, cycling rows. */
function series(from: number, step: number, n: number, kind: string, rows: number[]): WaveEntry[] {
  const out: WaveEntry[] = [];
  for (let i = 0; i < n; i++) {
    out.push(entry(from + i * step, kind, rows[i % rows.length]!));
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
        ...series(0, 40, 8, 'militia', [8, 12, 16]),
        ...series(340, 40, 2, 'rifle', [12]),
      ],
    },
    // W2 — the maze lesson: a sapper leads, the swarm pours through the hole.
    {
      entries: [
        entry(0, 'sapper', 12),
        ...series(60, 36, 10, 'militia', [4, 8, 16, 20]),
        ...series(260, 40, 4, 'rifle', [12]),
      ],
    },
    // W3 — suppression: grenadiers stand off and shell defenses, sappers flank.
    {
      entries: [
        ...series(0, 60, 2, 'grenadier', [10, 14]),
        ...series(100, 40, 8, 'rifle', [8, 12, 16]),
        ...series(220, 60, 3, 'sapper', [4, 12, 20]),
      ],
    },
    // W4 — combined push: two militia lanes, grenadier line, first armor.
    {
      entries: [
        ...series(0, 20, 6, 'militia', [4, 6]),
        ...series(0, 20, 6, 'militia', [18, 20]),
        ...series(260, 40, 4, 'grenadier', [10, 14]),
        ...series(420, 40, 2, 'zbd', [8, 16]),
      ],
    },
    // W5 — the hammer: escorts, screen, then the Type 99.
    {
      entries: [
        ...series(0, 40, 2, 'zbd', [8, 16]),
        ...series(80, 40, 6, 'rifle', [6, 12, 18]),
        ...series(300, 40, 3, 'grenadier', [10, 12, 14]),
        ...series(400, 40, 2, 'sapper', [8, 16]),
        entry(520, 'type99', 12),
      ],
    },
  ],
};
