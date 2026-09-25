/**
 * The supply line (M25 Phase 3): holding ground costs, and overextending
 * punishes.
 *
 * Every sector held behind the front takes supplies an hour from what the
 * depots make, `SUPPLY_PER_RUNG` for each rung of its town's distance from
 * home, so the line grows with the square of its depth. The front itself costs
 * nothing until it is taken, and a sector the enemy retook costs nothing. The
 * line is fed before the works take their share, and never from the
 * stockpile: like the works, it diverts production (`accrue`).
 *
 * When the depots make less than the line takes, the front is short and goes
 * hungry at the share it is short by. A day of hunger, which is a day wholly
 * unfed or two half fed, and the enemy retakes a sector, as it does from a
 * quiet front (`landStrike`). Each loss lightens the line, so an overextended
 * front shrinks to what the town can feed. A front fed again forgets its
 * hunger.
 *
 * Pure, and on an explicit clock like the strikes: `tick()` charges it on
 * every load and every frame.
 */
import { HUNGER_MS, STRIKE_ORDER, SUPPLY_PER_RUNG } from '../content/theaters';
import { landStrike, lostSectors, type EnemyStrike } from './strikes';
import type { FrontlineState, TownState } from './town';

/** One held town's share of the line: its sectors still held, at its distance. */
export interface LineShare {
  tier: number;
  /** Sectors of it held, of three. */
  held: number;
  /** Supplies an hour. */
  perHour: number;
}

/** Each town behind the front and what it takes an hour, nearest the base first. */
export function lineShares(fl: FrontlineState): LineShare[] {
  const lost = lostSectors(fl);
  const shares: LineShare[] = [];
  for (let tier = 1; tier < fl.tier; tier++) {
    const held = STRIKE_ORDER.length - lost.filter((l) => l.tier === tier).length;
    shares.push({ tier, held, perHour: held * SUPPLY_PER_RUNG * tier });
  }
  return shares;
}

/** What the whole line to the front takes an hour. */
export function supplyLine(fl: FrontlineState): number {
  return lineShares(fl).reduce((n, s) => n + s.perHour, 0);
}

/** What the line would take an hour once the front's town is taken: all three of its sectors join it. */
export function lineAfterTaking(fl: FrontlineState): number {
  return supplyLine(fl) + STRIKE_ORDER.length * SUPPLY_PER_RUNG * Math.max(1, fl.tier);
}

/**
 * Whether the depots, making `produced` an hour, could feed the line with the
 * front's town in it (M25 Phase 4a). A town they could not feed holds: the
 * third push waits for them. Hunger alone was too slow to be a ceiling, since
 * a commander raiding three times a day takes a town a day and a starving
 * front loses at most a sector a day.
 */
export function canFeedNext(fl: FrontlineState, produced: number): boolean {
  return lineAfterTaking(fl) <= produced;
}

/** What the line gets an hour of `produced`: all it takes, when the depots make that much. */
export function lineFed(fl: FrontlineState, produced: number): number {
  return Math.min(supplyLine(fl), Math.max(0, produced));
}

/** The share of the line the depots cannot feed: 0 fed, 1 wholly unfed. */
export function shortShare(fl: FrontlineState, produced: number): number {
  const need = supplyLine(fl);
  return need > 0 ? Math.max(0, need - Math.max(0, produced)) / need : 0;
}

/**
 * Charge the front's hunger through `now`, the depots making `produced`
 * supplies an hour, and land the strikes it owes, oldest first.
 *
 * Each strike lightens the line, so the share short is taken again after it:
 * a long absence costs what the front's depth kept costing, not the first
 * shortage over again. A file from before Phase 3 starts its clock here.
 */
export function chargeHunger(town: TownState, now: number, produced: number): EnemyStrike[] {
  const fl = town.frontline;
  if (fl.fedAt === undefined) {
    fl.fedAt = now;
    return [];
  }
  // A clock that jumped backwards charges nothing twice.
  if (now <= fl.fedAt) return [];
  const struck: EnemyStrike[] = [];
  let at = fl.fedAt;
  let hunger = fl.hunger ?? 0;
  for (;;) {
    const short = shortShare(fl, produced);
    if (short <= 0) {
      // Fed again: the hunger is forgotten.
      hunger = 0;
      break;
    }
    const until = at + (HUNGER_MS - hunger) / short;
    if (until > now) {
      hunger += (now - at) * short;
      break;
    }
    at = until;
    hunger = 0;
    const strike = landStrike(fl, at, 'hunger');
    if (!strike) break;
    struck.push(strike);
  }
  if (hunger > 0) fl.hunger = hunger;
  else delete fl.hunger;
  fl.fedAt = now;
  return struck;
}

/** When a short front loses its next sector, at today's shortage, or null when it is fed. */
export function nextHungerAt(town: TownState, now: number, produced: number): number | null {
  const short = shortShare(town.frontline, produced);
  if (short <= 0) return null;
  return now + (HUNGER_MS - (town.frontline.hunger ?? 0)) / short;
}

/** Repair the two fields off disk: a hunger or a clock that is not a number starts again. */
export function normalizeSupply(fl: FrontlineState): void {
  if (fl.fedAt !== undefined && (typeof fl.fedAt !== 'number' || !Number.isFinite(fl.fedAt))) delete fl.fedAt;
  if (
    fl.hunger !== undefined &&
    (typeof fl.hunger !== 'number' || !Number.isFinite(fl.hunger) || fl.hunger <= 0)
  ) {
    delete fl.hunger;
  }
  if (fl.hunger !== undefined) fl.hunger = Math.min(fl.hunger, HUNGER_MS);
}
