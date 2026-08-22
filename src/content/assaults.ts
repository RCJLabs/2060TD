import type { SiegeDef, WaveDef } from '../sim/types';
import { entry, series } from './missions';

/**
 * The pre-campaign assault ladder (M2): a deterministic difficulty generator.
 * Level 1 is a three-wave probing attack; grenadiers arrive at level 2, armor
 * and the Type 99 at level 3; from there counts scale up without mercy.
 *
 * `startingSupplies` is a placeholder — the town launcher substitutes the
 * player's actual stockpile when the battle begins.
 */

const scaleCount = (base: number, level: number): number =>
  Math.max(1, Math.round(base * (1 + 0.18 * (level - 1))));

export function buildAssault(level: number): SiegeDef {
  const n = (base: number) => scaleCount(base, level);
  const waves: WaveDef[] = [];

  // Wave 1 — probe: militia trickle with a rifle tail.
  waves.push({
    entries: [
      ...series(0, 40, n(6), 'militia', [8, 12, 16]),
      ...series(300, 40, n(1), 'rifle', [12]),
    ],
  });

  // Wave 2 — the breach lesson: a sapper leads, the swarm pours through.
  waves.push({
    entries: [
      entry(0, 'sapper', 12),
      ...series(60, 36, n(7), 'militia', [4, 8, 16, 20]),
      ...series(260, 40, n(2), 'rifle', [12]),
    ],
  });

  // Wave 3 — infantry push with flanking sappers.
  waves.push({
    entries: [
      ...series(0, 40, n(5), 'rifle', [8, 12, 16]),
      ...series(160, 60, n(2), 'sapper', [4, 20]),
      ...(level >= 2 ? series(240, 60, n(1), 'grenadier', [12]) : []),
    ],
  });

  // Wave 4 (level 2+) — suppression: grenadiers stand off, militia screen.
  if (level >= 2) {
    waves.push({
      entries: [
        ...series(0, 20, n(4), 'militia', [4, 6]),
        ...series(0, 20, n(4), 'militia', [18, 20]),
        ...series(220, 50, n(2), 'grenadier', [10, 14]),
        ...(level >= 3 ? series(380, 40, n(1), 'zbd', [12]) : []),
      ],
    });
  }

  // Wave 5 (level 3+) — the armored hammer.
  if (level >= 3) {
    const tanks = 1 + Math.floor((level - 3) / 2);
    waves.push({
      entries: [
        ...series(0, 40, n(2), 'zbd', [8, 16]),
        ...series(80, 40, n(4), 'rifle', [6, 12, 18]),
        ...series(280, 50, n(2), 'grenadier', [10, 14]),
        ...series(380, 40, n(2), 'sapper', [8, 16]),
        ...series(480, 80, tanks, 'type99', [12, 10, 14]),
      ],
    });
  }

  const tierName = level >= 5 ? 'ARMORED OFFENSIVE' : level >= 3 ? 'COMBINED ASSAULT' : 'PROBING ATTACK';

  return {
    name: `LEVEL ${level} — ${tierName}`,
    startingSupplies: 0, // substituted with the town stockpile at launch
    suppliesPerWave: 100 + 25 * level,
    startingCp: Math.min(40 + 5 * (level - 1), 80),
    cpCap: 150,
    cpPerSecond: 1.2,
    prepSeconds: 25,
    repairCostPerHp: 0.04,
    waves,
  };
}

/** Bonus loot for holding the sector, on top of per-wave supply awards. */
export function assaultLoot(level: number): { supplies: number; fuel: number } {
  return { supplies: 250 + 150 * level, fuel: 60 + 40 * level };
}
