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

const scaleCount = (base: number, level: number, growth: number): number =>
  Math.max(1, Math.round(base * (1 + growth * (level - 1))));

/**
 * How much a level adds, and why it is so much smaller than it used to be.
 *
 * M23 Phase 3a measured the CONTESTED BAND — the range of attacker strength
 * over which a defence row lands somewhere between winning every seed and
 * losing every seed — at roughly 0.7x to 1.0x, about 43% wide. It then
 * measured what a level actually cost: +67% and +58% at the bottom of the
 * ladder against +9% at the top. A step bigger than the band jumps clean over
 * it, which is why 93% of defence rows were step functions with one contested
 * level or none, and why the single row that ramped was the one whose flip
 * happened to land in the flat part.
 *
 * You cannot fix that inside six levels. A 6-rung ladder spanning this
 * difficulty range has a floor of +33% per rung even when perfectly uniform,
 * and holding the mean while flattening forces level 1 up by 54% — which is
 * not a probing attack any more. So the ladder is LONGER instead: +9% per
 * level with new waves ramping in gently, giving a worst step of +25%,
 * comfortably inside the band, with level 1 untouched at its original size
 * and the old level 6 arriving at level 11.
 *
 * `assaultLevel` was never capped, so nothing in the meta had to change for
 * this — only saved towns, which are rescaled on load by `rescaleLadder`.
 */
const LADDER_GROWTH = 0.09;

/**
 * The ladder's rates, named together so a sweep can hold two and move one
 * (`npm run balance -- --retune`). Nothing but the balance harness passes
 * anything other than `LADDER`.
 */
export interface Ladder {
  /** What each level adds to every wave's counts: `LADDER_GROWTH`. */
  readonly growth: number;
  /** Levels between heavies, from the first at level 3. */
  readonly heavyEvery: number;
  /** Levels between rotors, from the first at level 4. */
  readonly rotorEvery: number;
}

export const LADDER: Ladder = { growth: LADDER_GROWTH, heavyEvery: 2, rotorEvery: 2 };

/**
 * A newly unlocked wave arrives at a FRACTION of its strength and grows in.
 *
 * `scaleCount` is a gentle +18% per level, but that was never what a level
 * actually cost: waves 4, 5 and 6 unlock at levels 2, 3 and 4 and arrived at
 * full size, so the real steps were +67%, +58% and +29% in units fielded
 * against +9-19% once the ladder runs out of waves to add. M23 Phase 3a
 * measured the contested band — where a defence row lands between 5% and 95%
 * rather than at one end — at roughly 0.7x to 1.0x of attacker strength, about
 * 43% wide. A 58% step jumps clean over it, which is why 93% of defence rows
 * were step functions and the single row that ramped was the one whose flip
 * landed in the flat part of the ladder.
 *
 * So the wave still ARRIVES on schedule — the lesson it teaches is the reason
 * it exists, and delaying it would cost the ladder its shape — but it arrives
 * at 40% and reaches full strength two levels later. The teaching order is
 * untouched; only the size of the step changes.
 */
const waveRamp = (level: number, unlockLevel: number): number =>
  Math.min(1, 0.15 + 0.1 * (level - unlockLevel));

/**
 * An `assaultLevel` from before the ladder was lengthened, in new levels.
 *
 * Derived from the curves rather than chosen: the smallest new level whose
 * assault is at least as large as the old one's was.
 *
 *     old  1   2   3   4    5    6
 *     new  1   4   7   9   10   11
 *
 * Past the table it keeps the same slope, so a town deep into the old ladder
 * does not suddenly find level 12 easier than the level 6 it just beat.
 */
const RESCALE = [1, 1, 4, 7, 9, 10, 11];

export function rescaleLadder(oldLevel: number): number {
  if (oldLevel <= 1) return 1;
  if (oldLevel < RESCALE.length) return RESCALE[oldLevel]!;
  return RESCALE[RESCALE.length - 1]! + (oldLevel - (RESCALE.length - 1)) * 2;
}

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

export function buildAssault(
  level: number,
  roster: AssaultRoster = CHINA_ASSAULT_ROSTER,
  ladder: Ladder = LADDER,
): SiegeDef {
  const n = (base: number) => scaleCount(base, level, ladder.growth);
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
    const r = (base: number) => Math.max(1, Math.round(n(base) * waveRamp(level, 2)));
    waves.push({
      entries: [
        ...series(0, 20, r(4), roster.swarm, [3, 5]),
        ...series(0, 20, r(4), roster.swarm, [15, 17]),
        ...series(220, 50, r(2), roster.ranged, [8, 12]),
        ...(level >= 3 ? series(380, 40, r(1), roster.lightVehicle, [10]) : []),
      ],
    });
  }

  // Wave 5 (level 3+) — the armored hammer.
  if (level >= 3) {
    const tanks = 1 + Math.floor((level - 3) / ladder.heavyEvery);
    const r = (base: number) => Math.max(1, Math.round(n(base) * waveRamp(level, 3)));
    waves.push({
      entries: [
        ...series(0, 40, r(2), roster.lightVehicle, [7, 13]),
        ...series(80, 40, r(4), roster.line, [5, 10, 15]),
        ...series(280, 50, r(2), roster.ranged, [8, 12]),
        ...series(380, 40, r(2), roster.breacher, [7, 13]),
        ...series(480, 80, tanks, roster.heavy, [10, 8, 12]),
      ],
    });
  }

  // Wave 6 (level 4+) — the sky. Rotors ignore the maze entirely, so a line
  // with no mount that can elevate simply watches them work.
  if (level >= 4) {
    const rotors = 1 + Math.floor((level - 4) / ladder.rotorEvery);
    const r = (base: number) => Math.max(1, Math.round(n(base) * waveRamp(level, 4)));
    waves.push({
      entries: [
        ...series(0, 40, r(3), roster.line, [5, 10, 15]),
        ...series(120, 70, rotors, roster.gunship, [7, 13, 10]),
        ...series(300, 50, r(2), roster.ranged, [8, 12]),
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
