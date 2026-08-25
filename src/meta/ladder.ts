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
  LADDER_EPOCH,
  PROBE_BREACHED,
  PROBE_HELD,
  SEASON_CARRY,
  FAILED_OBJECTIVE,
  FAILED_RAID,
  OBJECTIVE_STANDING_SHARE,
  type League,
} from '../content/leagues';
import type { ObjectiveId } from './objectives';
import type { FrontlineState, SeasonRecord, StandingHistory, TownState } from './town';

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

// ---- the standing line (v1.10) ---------------------------------------------------

/** Days of standing kept for the record's line. A month of war. */
export const HISTORY_DAYS = 30;

/** Which day of the war an instant falls on. */
export const dayOf = (now: number): number => Math.floor((now - LADDER_EPOCH) / DAY_MS);

/**
 * Record today's standing.
 *
 * Days the game was never opened are filled in by interpolating between the
 * last sample and this one, which is not a guess: decay is linear, and decay
 * is the only thing that moves standing while nobody is playing. Awards land
 * on the day they happen, so they read as the step they are.
 */
export function noteStanding(fl: FrontlineState, now: number): void {
  const day = dayOf(now);
  const standing = Math.max(0, Math.round(fl.standing));
  const h = fl.history;
  if (!h || h.values.length === 0) {
    fl.history = { from: day, values: [standing] };
    return;
  }
  const last = h.from + h.values.length - 1;
  if (day <= last) {
    // Same day, or a clock that went backwards: today's number is the number.
    if (day === last) h.values[h.values.length - 1] = standing;
    return;
  }
  const previous = h.values[h.values.length - 1]!;
  const gap = day - last;
  for (let step = 1; step <= gap; step++) {
    h.values.push(Math.round(previous + ((standing - previous) * step) / gap));
  }
  if (h.values.length > HISTORY_DAYS) {
    h.from += h.values.length - HISTORY_DAYS;
    h.values.splice(0, h.values.length - HISTORY_DAYS);
  }
}

/**
 * The standing line up to `now`, oldest first. Pure: today's live standing is
 * appended rather than recorded, so drawing the record never writes to a save.
 */
export function standingSeries(
  town: TownState,
  now: number,
): { day: number; value: number }[] {
  const fl = town.frontline;
  const h = fl.history;
  const today = dayOf(now);
  const series: { day: number; value: number }[] = [];
  if (h && h.values.length > 0) {
    h.values.forEach((value, i) => series.push({ day: h.from + i, value }));
  }
  const last = series[series.length - 1];
  if (!last || last.day < today) {
    series.push({ day: today, value: Math.max(0, Math.round(fl.standing)) });
  } else if (last.day === today) {
    last.value = Math.max(0, Math.round(fl.standing));
  }
  return series.slice(-HISTORY_DAYS);
}

/** Repair a history block off disk (hand-edited files, older saves). */
export function normalizeHistory(raw: unknown): StandingHistory | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const h = raw as Partial<StandingHistory>;
  if (typeof h.from !== 'number' || !Number.isFinite(h.from)) return undefined;
  if (!Array.isArray(h.values)) return undefined;
  const values = h.values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .map((v) => Math.max(0, Math.round(v)))
    .slice(-HISTORY_DAYS);
  if (values.length === 0) return undefined;
  // Trimming the tail moves the start day with it.
  const dropped = Math.max(0, h.values.length - values.length);
  return { from: Math.round(h.from) + dropped, values };
}

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
    // Close the line on the season it belongs to, before the carry rewrites
    // the number — otherwise the record slides through a reset that was a step.
    noteStanding(fl, seasonEnd(fl.season));
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
    // And re-close it on the carried number. A rollover is a step, not a
    // slide: without this the drop from the season's peak to a quarter of it
    // gets smeared across however many days passed before the game reopened.
    noteStanding(fl, seasonStart(current));
  }

  settlement.decayed += chargeDecay(fl, now);
  noteStanding(fl, now);
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
  noteStanding(fl, now);
  return fl.standing;
}

// ---- what the ladder pays -----------------------------------------------------------

/** Standing for a cleared rung, after today's condition multiplier. */
export function clearAward(tier: number, now: number): number {
  return Math.round(clearStanding(tier) * conditionAt(now).standing);
}

/**
 * What a raid pays the board, by what it went out for (v1.24).
 *
 * Only taking the post pays a full clear, and only taking the post moves the
 * Front Line at all — those are the two things that keep the ladder meaning
 * something once a raid can come home with less.
 */
export function objectiveAward(
  objective: ObjectiveId,
  met: boolean,
  tier: number,
  now: number,
): number {
  if (objective === 'post') return met ? clearAward(tier, now) : FAILED_RAID;
  // The stores are paid in supplies, not reputation: nobody is impressed that
  // you robbed a depot, and nobody holds it against you either. Neutral in
  // both directions rather than zero-on-success — paying nothing for a hit
  // while charging for a miss makes the expected standing NEGATIVE, which
  // measured as a tax of -0.13 to -0.48 per man lost on an objective that is
  // supposed to be a free choice. It costs men and pays material; the board
  // simply does not follow it.
  if (objective === 'stores') return 0;
  return met
    ? Math.round(clearAward(tier, now) * OBJECTIVE_STANDING_SHARE)
    : FAILED_OBJECTIVE;
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
