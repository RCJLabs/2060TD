import { conditionAt } from '../content/conditions';
import {
  clearStanding,
  leagueAt,
  nextLeagueAfter,
  seasonAt,
  seasonEnd,
  seasonStart,
  COUNTER_HELD,
  COUNTER_LOST,
  DAY_MS,
  DECAY_GRACE_MS,
  DECAY_PER_DAY,
  PROBE_BREACHED,
  PROBE_HELD,
  SEASON_CARRY,
  type League,
} from '../content/leagues';
import type { FrontlineState, SeasonRecord, TownState } from './town';

/**
 * The league layer (M7): standing, decay, and the season clock.
 *
 * Standing is the one number in the game that goes DOWN on its own. Rungs and
 * repelled probes pay into it, lost raids and breached walls take from it, and
 * silence bleeds it a fixed amount per day. That is the whole point — a
 * scoreboard you have to keep standing on, not a total you bank.
 *
 * Every function takes an explicit `now`, like the rest of meta/, so seasons,
 * decay and today's field condition are all reproducible in a test.
 */

/** Closed seasons kept on the record. */
export const PLACEMENT_CAP = 6;

export const standingOf = (town: TownState): number => town.frontline.standing;

export const leagueOf = (town: TownState): League => leagueAt(town.frontline.standing);

/** Standing still owed for the next band, or null at the top of the board. */
export function standingToNext(town: TownState): number | null {
  const next = nextLeagueAfter(town.frontline.standing);
  return next ? next.floor - town.frontline.standing : null;
}

/** When the board starts forgetting you (epoch ms). */
export const decayStartsAt = (town: TownState): number =>
  town.frontline.activeAt + DECAY_GRACE_MS;

/**
 * Charge the decay owed up to `to` and return the points taken.
 *
 * The cursor advances by exactly the time the charged points paid for, never
 * past it, so a sub-point remainder is still owed on the next call. Settling
 * twice in a row therefore costs nothing — which matters, because tick() runs
 * this on every load and the UI settles again whenever it redraws.
 */
function chargeDecay(fl: FrontlineState, to: number): number {
  const from = Math.max(fl.settledAt, fl.activeAt + DECAY_GRACE_MS);
  if (to <= from) {
    fl.settledAt = Math.max(fl.settledAt, to);
    return 0;
  }
  const owed = ((to - from) / DAY_MS) * DECAY_PER_DAY;
  const taken = Math.max(0, Math.min(fl.standing, Math.floor(owed)));
  fl.standing -= taken;
  fl.settledAt = from + (taken / DECAY_PER_DAY) * DAY_MS;
  return taken;
}

export interface LadderSettlement {
  /** Standing lost to silence. */
  decayed: number;
  /** The season that closed, if one did. */
  placement: SeasonRecord | null;
  /** What the placement paid. */
  payout: { supplies: number; fuel: number; intel: number };
}

const NOTHING: LadderSettlement = {
  decayed: 0,
  placement: null,
  payout: { supplies: 0, fuel: 0, intel: 0 },
};

/**
 * Bring the ladder up to `now`: bleed the decay owed, and if the season
 * turned over while the game was closed, close it out, pay the placement for
 * the peak band reached, and carry a quarter of the standing forward.
 *
 * A save that slept through several seasons places for the one it actually
 * played. The empty seasons in between have nothing to place and pay nothing.
 */
export function settleLadder(town: TownState, now: number): LadderSettlement {
  const fl = town.frontline;
  // A clock that jumped backwards must not hand out free time later.
  if (now <= fl.settledAt) return { ...NOTHING, payout: { ...NOTHING.payout } };

  const settlement: LadderSettlement = {
    decayed: 0,
    placement: null,
    payout: { supplies: 0, fuel: 0, intel: 0 },
  };
  const current = seasonAt(now);

  if (current > fl.season) {
    // The stored season still bleeds up to its own end before it is placed.
    settlement.decayed += chargeDecay(fl, seasonEnd(fl.season));
    const league = leagueAt(fl.peak);
    const record: SeasonRecord = {
      season: fl.season,
      league: league.id,
      peak: fl.peak,
      at: seasonEnd(fl.season),
    };
    fl.placements.unshift(record);
    fl.placements.length = Math.min(fl.placements.length, PLACEMENT_CAP);
    settlement.placement = record;
    settlement.payout = { ...league.placement };
    town.supplies += league.placement.supplies;
    town.fuel += league.placement.fuel;
    town.intel += league.placement.intel;

    const carry = Math.round(Math.max(0, fl.standing) * SEASON_CARRY);
    fl.standing = carry;
    fl.peak = carry;
    fl.season = current;
    fl.settledAt = seasonStart(current);
  }

  settlement.decayed += chargeDecay(fl, now);
  return settlement;
}

/**
 * Move the standing. `active` marks it as something the commander did — a
 * raid, a counterattack fought in person — which restarts the decay grace.
 * Offline probes move the number without buying anyone quiet time: sitting
 * behind a garrison is not playing.
 */
export function awardStanding(
  town: TownState,
  delta: number,
  now: number,
  active = true,
): number {
  const fl = town.frontline;
  chargeDecay(fl, now);
  fl.standing = Math.max(0, fl.standing + delta);
  if (fl.standing > fl.peak) fl.peak = fl.standing;
  if (active) fl.activeAt = now;
  return fl.standing;
}

// ---- what the ladder pays -----------------------------------------------------------

/** Standing for a cleared rung, after today's condition multiplier. */
export function clearAward(tier: number, now: number): number {
  return Math.round(clearStanding(tier) * conditionAt(now).standing);
}

export const probeAward = (held: boolean): number => (held ? PROBE_HELD : PROBE_BREACHED);
export const counterAward = (held: boolean): number => (held ? COUNTER_HELD : COUNTER_LOST);

/**
 * Ladder loot multipliers: the band you hold times the condition in force.
 * Campaign, skirmish and code duels never see these — the front pays the
 * front.
 */
export function ladderPayout(
  town: TownState,
  now: number,
): { supplies: number; fuel: number } {
  const league = leagueOf(town);
  const condition = conditionAt(now);
  return {
    supplies: league.loot * condition.loot.supplies,
    fuel: league.loot * condition.loot.fuel,
  };
}

/** Signals is down today: no target can be scouted at any price. */
export const scoutingBlocked = (now: number): boolean => conditionAt(now).blackout === true;
