import type { CoachKey } from '../content/tutorial';
import type { TownState } from './town';

/**
 * The ledger of coach screens a commander has already read.
 *
 * Kept as a list of keys rather than a boolean so a later screen can be added
 * without re-teaching everything, and so REPLAY BRIEFINGS is one line. The
 * field is optional and repaired on load, like the duel ledger — a save from
 * before this existed has simply read nothing.
 */

export function hasSeen(town: TownState, key: CoachKey): boolean {
  return town.seen?.includes(key) === true;
}

/** Mark a screen read. Returns false when it already had been. */
export function markSeen(town: TownState, key: CoachKey): boolean {
  if (!town.seen) town.seen = [];
  if (town.seen.includes(key)) return false;
  town.seen.push(key);
  return true;
}

/** REPLAY BRIEFINGS: every one-shot screen becomes first-contact again. */
export function forgetCoach(town: TownState): void {
  town.seen = [];
}
