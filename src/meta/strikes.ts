/**
 * The enemy strikes back (M25 Phase 2): when the front goes quiet, the enemy
 * retakes ground behind it.
 *
 * It runs on standing decay's clock. Thirty-six hours after the last thing done
 * on the Front Line (a raid, a counterattack, a defence fought in person: what
 * moves `frontline.activeAt`) the enemy retakes one sector of the town directly
 * behind the front, and a day later a second. Two is the most one quiet spell
 * costs, and any of those actions starts the clock again.
 *
 * It goes for the roads. A lane with a lost sector anywhere behind the front is
 * cut, and the front post in it cannot be raided until the sector is retaken.
 * The enemy takes the sector of a lane that still reaches the front, its main
 * road first, and only when every road is cut does it take what is left of the
 * town. When all three of that town's sectors are lost, the front falls back to
 * it. At the first rung there is nothing behind the front but the base, and the
 * base is never taken.
 *
 * Every function takes an explicit `now`, and charging is idempotent at it, as
 * the decay's is: `tick()` charges the clock on every load and every frame.
 */
import {
  QUIET_MS,
  STRIKE_INTERVAL_MS,
  STRIKE_ORDER,
  STRIKES_PER_QUIET,
} from '../content/theaters';
import type { FrontlineState, LostSector, TownState } from './town';

/** A strike that landed: which sector the enemy retook, and when. */
export interface EnemyStrike {
  at: number;
  /** The town it retook a sector of. */
  tier: number;
  /** The lane, as the deal's slot. */
  slot: number;
  /** The whole town was lost with it, and the front fell back to `tier`. */
  fellBack: boolean;
  /** The front was quiet, or it was short of supply (Phase 3). */
  cause: 'quiet' | 'hunger';
}

/** The sectors the enemy holds behind the front, nearest the front first. */
export const lostSectors = (fl: FrontlineState): readonly LostSector[] => fl.lost ?? [];

export function isLost(fl: FrontlineState, tier: number, slot: number): boolean {
  return lostSectors(fl).some((l) => l.tier === tier && l.slot === slot);
}

/** The lost sector nearest the front in a lane: where its road is cut, or null when it is open. */
export function cutAt(fl: FrontlineState, slot: number): LostSector | null {
  let nearest: LostSector | null = null;
  for (const l of lostSectors(fl)) {
    if (l.slot === slot && (nearest === null || l.tier > nearest.tier)) nearest = l;
  }
  return nearest;
}

export const isCut = (fl: FrontlineState, slot: number): boolean => cutAt(fl, slot) !== null;

/** When this quiet spell's strikes land: `QUIET_MS` after the last action, then a day apart. */
export function strikeTimes(fl: FrontlineState): number[] {
  return Array.from(
    { length: STRIKES_PER_QUIET },
    (_, k) => fl.activeAt + QUIET_MS + k * STRIKE_INTERVAL_MS,
  );
}

/** Nearest the front first, then lane by lane: the order the map and the planner list them. */
function setLost(fl: FrontlineState, lost: LostSector[]): void {
  if (lost.length === 0) {
    delete fl.lost;
    return;
  }
  fl.lost = [...lost].sort((a, b) => b.tier - a.tier || a.slot - b.slot);
}

/**
 * One strike, landing at `at` on the front as it stands, whatever brought it:
 * a quiet front, or a hungry one (Phase 3). Null when there is nothing to take.
 */
export function landStrike(
  fl: FrontlineState,
  at: number,
  cause: EnemyStrike['cause'] = 'quiet',
): EnemyStrike | null {
  const rear = fl.tier - 1;
  if (rear < 1) return null;
  // A lane that still reaches the front has its sector here held, by
  // definition, so cutting a road is always possible while one is open.
  const slot =
    STRIKE_ORDER.find((s) => !isCut(fl, s)) ?? STRIKE_ORDER.find((s) => !isLost(fl, rear, s));
  if (slot === undefined) return null;
  const lost = [...lostSectors(fl), { tier: rear, slot, at }];
  if (STRIKE_ORDER.every((s) => lost.some((l) => l.tier === rear && l.slot === s))) {
    // The whole town behind the front is the enemy's again: the front falls
    // back to it, and its pushes start again from none. A front at the enemy's
    // capital loses the roads it had taken into it (M25 Phase 4b).
    fl.tier = rear;
    fl.wins = 0;
    delete fl.roads;
    setLost(fl, lost.filter((l) => l.tier < rear));
    return { at, tier: rear, slot, fellBack: true, cause };
  }
  setLost(fl, lost);
  return { at, tier: rear, slot, fellBack: false, cause };
}

/**
 * Land every strike owed up to `now`, oldest first, and return them.
 *
 * A file from before Phase 2 has no clock. It starts here, and nothing is
 * charged for an absence the rule did not exist for: an understatement, never
 * an invention, as the war log treats the time before it.
 */
export function chargeStrikes(town: TownState, now: number): EnemyStrike[] {
  const fl = town.frontline;
  if (fl.pressedAt === undefined) {
    fl.pressedAt = now;
    return [];
  }
  // A clock that jumped backwards must not land anything twice.
  if (now <= fl.pressedAt) return [];
  const struck: EnemyStrike[] = [];
  for (const at of strikeTimes(fl)) {
    if (at <= fl.pressedAt) continue;
    if (at > now) break;
    const strike = landStrike(fl, at);
    if (strike) struck.push(strike);
  }
  fl.pressedAt = now;
  return struck;
}

/** Take a lost sector back. False when it was not the enemy's. */
export function retakeSector(fl: FrontlineState, tier: number, slot: number): boolean {
  if (!isLost(fl, tier, slot)) return false;
  setLost(
    fl,
    lostSectors(fl).filter((l) => l.tier !== tier || l.slot !== slot),
  );
  return true;
}

/** What the map says about the enemy's clock. */
export interface EnemyClock {
  /** How long the front has been quiet (ms). */
  quiet: number;
  /**
   * When the quiet spell's next strike lands, or null: there is nothing
   * behind the front to take, or both of its strikes have landed.
   */
  next: number | null;
}

export function enemyClock(town: TownState, now: number): EnemyClock {
  const fl = town.frontline;
  const quiet = Math.max(0, now - fl.activeAt);
  if (fl.tier <= 1) return { quiet, next: null };
  const next = strikeTimes(fl).find((at) => at > now && at > (fl.pressedAt ?? now));
  return { quiet, next: next ?? null };
}

/**
 * Repair the two fields off disk (hand-edited files, older saves). A lost
 * sector has to be a whole one, behind the front, and not a duplicate; a town
 * with all three of a column lost would have fallen back, so a file claiming
 * one keeps the first two. A clock that is not a number starts again.
 */
export function normalizeStrikes(fl: FrontlineState): void {
  if (fl.pressedAt !== undefined && (typeof fl.pressedAt !== 'number' || Number.isNaN(fl.pressedAt))) {
    delete fl.pressedAt;
  }
  const raw: unknown = fl.lost;
  if (!Array.isArray(raw)) {
    delete fl.lost;
    return;
  }
  const kept: LostSector[] = [];
  for (const entry of raw as unknown[]) {
    if (entry === null || typeof entry !== 'object') continue;
    const { tier, slot, at } = entry as Record<string, unknown>;
    if (typeof tier !== 'number' || typeof slot !== 'number' || typeof at !== 'number') continue;
    if (!Number.isInteger(tier) || !STRIKE_ORDER.includes(slot) || !Number.isFinite(at)) continue;
    if (tier < 1 || tier >= fl.tier) continue;
    if (kept.some((l) => l.tier === tier && l.slot === slot)) continue;
    if (kept.filter((l) => l.tier === tier).length >= STRIKE_ORDER.length - 1) continue;
    kept.push({ tier, slot, at });
  }
  setLost(fl, kept);
}
