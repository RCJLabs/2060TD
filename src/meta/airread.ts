/**
 * The air read (v1.34) — what a post costs to fly at, from the map alone.
 *
 * ## Why this exists
 *
 * v1.33 measured what flying is worth and found the answer was not a number.
 * The front line's three targets are selected against measured GROUND
 * difficulty (`--layouts`), correctly, because almost every raid is a ground
 * raid — and air experiences that same deal as a scrambled ladder. **39 of the
 * 75 targets the five factions are dealt move by 30 or more clear-rate points
 * depending on whether the force walked or flew**, while for four of five the
 * MEANS are within a few points. Air is not weaker. It is a different problem,
 * and the game said nothing about which target was which.
 *
 * So this is not a balance knob. It is the missing sentence.
 *
 * ## Why a rule rather than a table
 *
 * The cheap version is a lookup keyed on (tier, slot, faction), and it would be
 * worthless the moment a share code or a duel puts a base in front of you that
 * no table has ever seen. Everything here is computed from a layout and a
 * catalog, so a pasted base reads exactly like a ladder rung.
 *
 * ## The mechanic being modelled
 *
 * From `Engine.updateAirAttacker`: an aircraft ignores the grid entirely, flies
 * a straight line at its target, and hovers over it while it works. Walls,
 * gates and the maze — everything that makes a rung hard on foot — do not exist
 * for it. What is left is the flight in, so that is what this measures: for
 * every gun that can elevate, the length of the straight line in that falls
 * inside its envelope, divided by the speed of the slowest airframe, times its
 * damage per second. DPS-seconds absorbed getting there.
 *
 * ## It had to earn its place, and the bar was the shape
 *
 * `npm run balance -- --airread` scores it against the measured air clear rate
 * on every dealt target. A player is already told the shape for free, so the
 * shape's own mean is scored as the incumbent — and scored on the very rows it
 * was fitted to, which flatters it. Transit wins anyway, and wins for every
 * faction separately, which is what rules out a predictor carried by one roster:
 *
 *     TRANSIT DPS-seconds     r = -0.71   r^2 = 0.50
 *     SHAPE alone (flattered) r = +0.46   r^2 = 0.21
 *     per faction, transit    -0.78 -0.66 -0.90 -0.63 -0.54
 *     per faction, shape      +0.51 +0.42 +0.38 +0.60 +0.42
 *
 * An OVERHEAD term — flak covering the command post, where the aircraft has to
 * hover — was measured too and is NOT here. It scores r = -0.41 on its own and
 * makes the combination WORSE than transit alone (-0.68), because on a
 * generated base it is very nearly binary: either a mount covers the post or
 * one does not. A term that cannot vary cannot predict.
 */
import type { Catalog, CellIndex, LayoutStructure } from '../sim/types';
import { MAP_W } from '../content/bases';
import { sectorCells, type SectorId } from './warfare';

/** What the target list says. Three words is the whole budget it has. */
export type AirBand = 'clear' | 'contested' | 'heavy';

/**
 * Band cuts in DPS-seconds, at the TERCILES of the measured population.
 *
 * Derived, not chosen: `--airread` sorts all 75 dealt targets by transit and
 * cuts into thirds, so the boundaries cannot be nudged to flatter the result.
 * What each third then actually clears at, flown, at a 24 MP force:
 *
 *     CLEAR      under 27      91.0%
 *     CONTESTED  27 to 95      76.8%
 *     HEAVY      over 95       18.4%
 *
 * The information is concentrated at the bottom. CLEAR and CONTESTED are 14
 * points apart and the honest reading of them is "this will probably work";
 * HEAVY is a cliff, and it is the thing a player needed telling.
 */
export const AIR_BAND_CUTS = [27, 95] as const;

/** The three sectors the reference air plans launch from (`AIR_RAID_PLANS`). */
export const AIR_READ_SECTORS: SectorId[] = ['W1', 'N1', 'S1'];

export interface AirRead {
  /** DPS-seconds absorbed flying in, averaged over the sectors considered. */
  transit: number;
  band: AirBand;
  /** Short label for a panel row. */
  label: string;
}

/** A layout this can read: a generated base, a town, or a pasted share code. */
export interface AirReadTarget {
  ccOrigin: CellIndex;
  structures: readonly LayoutStructure[];
}

/** The weapon a placed structure actually fires, with its level applied. */
function weaponOf(cat: Catalog, kind: string, level: number) {
  const base = cat.structures[kind];
  if (!base) return undefined;
  const profile =
    level > 1 && base.levels && base.levels.length > 0
      ? { ...base, ...base.levels[Math.min(level - 2, base.levels.length - 1)] }
      : base;
  const w = profile.weapon;
  if (!w || (w.targets !== 'air' && w.targets !== 'both')) return undefined;
  return w;
}

/**
 * Length of the segment A->B that lies inside the circle (C, r).
 *
 * Clipped to the SEGMENT, not the infinite line: a mount behind the post or
 * behind the spawn edge covers no part of the run in, and counting it would
 * price a gun the aircraft never flies past.
 */
export function chordInside(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  const ux = dx / len;
  const uy = dy / len;
  const t = (cx - ax) * ux + (cy - ay) * uy;
  const px = ax + ux * t;
  const py = ay + uy * t;
  const d2 = (cx - px) ** 2 + (cy - py) ** 2;
  if (d2 >= r * r) return 0;
  const half = Math.sqrt(r * r - d2);
  const lo = Math.max(0, t - half);
  const hi = Math.min(len, t + half);
  return Math.max(0, hi - lo);
}

/** DPS-seconds an aircraft at `speed` absorbs flying from each sector to the post. */
export function airTransit(
  target: AirReadTarget,
  cat: Catalog,
  sectors: readonly SectorId[] = AIR_READ_SECTORS,
  speed = 2.6,
): number {
  if (sectors.length === 0 || speed <= 0) return 0;
  // The command post is footprint 2, so its centre is the far corner of its
  // origin cell rather than that cell's middle.
  const ccX = (target.ccOrigin % MAP_W) + 1;
  const ccY = Math.floor(target.ccOrigin / MAP_W) + 1;
  let total = 0;
  for (const st of target.structures) {
    if (st.inert) continue;
    const w = weaponOf(cat, st.kind, st.level ?? 1);
    if (!w) continue;
    const dps = w.damage * w.shotsPerSecond;
    const foot = cat.structures[st.kind]?.footprint ?? 1;
    const sx = (st.cell % MAP_W) + (foot === 2 ? 1 : 0.5);
    const sy = Math.floor(st.cell / MAP_W) + (foot === 2 ? 1 : 0.5);
    for (const sector of sectors) {
      const cells = sectorCells(sector);
      const from = cells[Math.floor(cells.length / 2)]!;
      total +=
        (dps * chordInside(from.col + 0.5, from.row + 0.5, ccX, ccY, sx, sy, w.range)) / speed;
    }
  }
  return total / sectors.length;
}

/** The slowest airframe in a roster, which is what sets the transit clock. */
export function slowestAirSpeed(cat: Catalog, kinds: readonly string[]): number | undefined {
  const speeds = kinds
    .map((k) => cat.attackers[k])
    .filter((a): a is NonNullable<typeof a> => !!a && a.air === true)
    .map((a) => a.speed);
  return speeds.length > 0 ? Math.min(...speeds) : undefined;
}

export function bandOf(transit: number): AirBand {
  if (transit < AIR_BAND_CUTS[0]) return 'clear';
  if (transit < AIR_BAND_CUTS[1]) return 'contested';
  return 'heavy';
}

const BAND_LABELS: Record<AirBand, string> = {
  clear: 'CLEAR RUN',
  contested: 'CONTESTED',
  heavy: 'HEAVY FLAK',
};

export function airReadOf(
  target: AirReadTarget,
  cat: Catalog,
  sectors: readonly SectorId[] = AIR_READ_SECTORS,
  speed?: number,
): AirRead {
  const transit = airTransit(target, cat, sectors, speed ?? 2.6);
  const band = bandOf(transit);
  return { transit, band, label: BAND_LABELS[band] };
}
