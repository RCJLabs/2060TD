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

/** Wave-role → attacker kind, per enemy faction (China attacks by default). */
export interface AssaultRoster {
  swarm: string;
  line: string;
  breacher: string;
  ranged: string;
  lightVehicle: string;
  heavy: string;
  /** v1.0: the rotors that make a wall irrelevant. */
  gunship: string;
}

export const CHINA_ASSAULT_ROSTER: AssaultRoster = {
  swarm: 'militia',
  line: 'rifle',
  breacher: 'sapper',
  ranged: 'grenadier',
  lightVehicle: 'zbd',
  heavy: 'type99',
  gunship: 'wz10',
};

export const USA_ASSAULT_ROSTER: AssaultRoster = {
  swarm: 'guardsman',
  line: 'ranger',
  breacher: 'engineer',
  ranged: 'javelin',
  lightVehicle: 'humvee',
  heavy: 'abrams',
  gunship: 'reaper',
};

export function buildAssault(level: number, roster: AssaultRoster = CHINA_ASSAULT_ROSTER): SiegeDef {
  const n = (base: number) => scaleCount(base, level);
  const waves: WaveDef[] = [];

  // Wave 1 — probe: a swarm trickle with a line tail.
  waves.push({
    entries: [
      ...series(0, 40, n(6), roster.swarm, [7, 10, 13]),
      ...series(300, 40, n(1), roster.line, [10]),
    ],
  });

  // Wave 2 — the breach lesson: a breacher leads, the swarm pours through.
  waves.push({
    entries: [
      entry(0, roster.breacher, 10),
      ...series(60, 36, n(7), roster.swarm, [3, 7, 13, 17]),
      ...series(260, 40, n(2), roster.line, [10]),
    ],
  });

  // Wave 3 — infantry push with flanking breachers.
  waves.push({
    entries: [
      ...series(0, 40, n(5), roster.line, [7, 10, 13]),
      ...series(160, 60, n(2), roster.breacher, [3, 17]),
      ...(level >= 2 ? series(240, 60, n(1), roster.ranged, [10]) : []),
    ],
  });

  // Wave 4 (level 2+) — suppression: standoff fire behind a screen.
  if (level >= 2) {
    waves.push({
      entries: [
        ...series(0, 20, n(4), roster.swarm, [3, 5]),
        ...series(0, 20, n(4), roster.swarm, [15, 17]),
        ...series(220, 50, n(2), roster.ranged, [8, 12]),
        ...(level >= 3 ? series(380, 40, n(1), roster.lightVehicle, [10]) : []),
      ],
    });
  }

  // Wave 5 (level 3+) — the armored hammer.
  if (level >= 3) {
    const tanks = 1 + Math.floor((level - 3) / 2);
    waves.push({
      entries: [
        ...series(0, 40, n(2), roster.lightVehicle, [7, 13]),
        ...series(80, 40, n(4), roster.line, [5, 10, 15]),
        ...series(280, 50, n(2), roster.ranged, [8, 12]),
        ...series(380, 40, n(2), roster.breacher, [7, 13]),
        ...series(480, 80, tanks, roster.heavy, [10, 8, 12]),
      ],
    });
  }

  // Wave 6 (level 4+) — the sky. Rotors ignore the maze entirely, so a line
  // with no mount that can elevate simply watches them work.
  if (level >= 4) {
    const rotors = 1 + Math.floor((level - 4) / 2);
    waves.push({
      entries: [
        ...series(0, 40, n(3), roster.line, [5, 10, 15]),
        ...series(120, 70, rotors, roster.gunship, [7, 13, 10]),
        ...series(300, 50, n(2), roster.ranged, [8, 12]),
        ...(level >= 6 ? series(420, 90, rotors, roster.gunship, [10, 8]) : []),
      ],
    });
  }

  const tierName =
    level >= 5 ? 'ARMORED OFFENSIVE' : level >= 3 ? 'COMBINED ASSAULT' : 'PROBING ATTACK';

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

/**
 * Offline probe raids: the first two waves of a soft-scaled assault, with no
 * defender economy — permanent defenses fight it alone (GDD §2.3).
 */
export function probeAssault(level: number, roster: AssaultRoster = CHINA_ASSAULT_ROSTER): SiegeDef {
  const base = buildAssault(Math.max(1, level), roster);
  return {
    ...base,
    name: `PROBE — LEVEL ${level}`,
    waves: base.waves.slice(0, 2),
    startingCp: 0,
    cpPerSecond: 0,
    suppliesPerWave: 0,
  };
}
