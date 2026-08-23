/**
 * Leagues (M7): a standing on the Front Line that has to be *held*, not just
 * reached. Clearing rungs pays standing, losing your own base costs it, and
 * absence bleeds it — so the ladder has a reason to be climbed again next
 * week instead of once, forever.
 *
 * Everything here is a pure table plus wall-clock arithmetic. Season and
 * condition boundaries are derived from a fixed epoch rather than stored, so
 * two devices with the same clock agree without a server, and a save that has
 * been sitting in a drawer knows exactly how many seasons it slept through.
 */

export type LeagueId = 'irregulars' | 'line' | 'vanguard' | 'shock' | 'iron';

export interface League {
  id: LeagueId;
  label: string;
  /** Four characters or fewer, for a row that also has to carry a name. */
  short: string;
  /** Standing at or above this holds the band. */
  floor: number;
  /** Ladder loot multiplier while the band is held. */
  loot: number;
  /**
   * Extra probe levels while the band is held. Standing is visibility: the
   * higher you fly the flag, the heavier the things that come looking for it.
   */
  probePressure: number;
  /** Paid once, at season end, for the peak band reached that season. */
  placement: { supplies: number; fuel: number; intel: number };
  /** One line of radio-log flavour for the league overlay. */
  blurb: string;
}

/** Ascending by floor — index 0 is where everyone starts. */
export const LEAGUES: League[] = [
  {
    id: 'irregulars',
    label: 'IRREGULARS',
    short: 'IRR',
    floor: 0,
    loot: 1,
    probePressure: 0,
    placement: { supplies: 0, fuel: 0, intel: 0 },
    blurb: 'Unlisted. Nobody upstairs knows your callsign yet.',
  },
  {
    id: 'line',
    label: 'THE LINE',
    short: 'LINE',
    floor: 150,
    loot: 1.06,
    probePressure: 0,
    placement: { supplies: 500, fuel: 0, intel: 80 },
    blurb: 'On the board. Supply runs start arriving without being begged for.',
  },
  {
    id: 'vanguard',
    label: 'VANGUARD',
    short: 'VGD',
    floor: 400,
    loot: 1.12,
    probePressure: 1,
    placement: { supplies: 1200, fuel: 200, intel: 160 },
    blurb: 'Named in dispatches — and in whatever the other side calls dispatches.',
  },
  {
    id: 'shock',
    label: 'SHOCK',
    short: 'SHK',
    floor: 800,
    loot: 1.2,
    probePressure: 1,
    placement: { supplies: 2400, fuel: 400, intel: 260 },
    blurb: 'They plan around you now. Expect the probes to stop being polite.',
  },
  {
    id: 'iron',
    label: 'IRON',
    short: 'IRON',
    floor: 1400,
    loot: 1.3,
    probePressure: 2,
    placement: { supplies: 4000, fuel: 700, intel: 400 },
    blurb: 'Top of the board. Everything with a map has your grid on it.',
  },
];

export const LEAGUE_BY_ID: Record<LeagueId, League> = Object.fromEntries(
  LEAGUES.map((l) => [l.id, l]),
) as Record<LeagueId, League>;

/** The band a standing sits in. Standing below zero is clamped by the meta. */
export function leagueAt(standing: number): League {
  let held = LEAGUES[0]!;
  for (const league of LEAGUES) {
    if (standing >= league.floor) held = league;
  }
  return held;
}

/** The next band up, or null at the top of the board. */
export function nextLeagueAfter(standing: number): League | null {
  return LEAGUES.find((l) => l.floor > standing) ?? null;
}

// ---- standing ledger ---------------------------------------------------------------

/** Clearing a command post: the rung pays, and deeper rungs pay more. */
export const CLEAR_BASE = 18;
export const CLEAR_PER_TIER = 7;
/** A raid that failed to kill the post. The army is gone; the board notices. */
export const FAILED_RAID = -14;
/** An offline probe your garrison threw off. */
export const PROBE_HELD = 5;
/** An offline probe that reached the command post. */
export const PROBE_BREACHED = -30;
/** A counterattack fought in person. */
export const COUNTER_HELD = 35;
export const COUNTER_LOST = -40;

export function clearStanding(tier: number): number {
  return CLEAR_BASE + CLEAR_PER_TIER * Math.max(1, tier);
}

// ---- decay -------------------------------------------------------------------------

export const DAY_MS = 24 * 3_600_000;
/** Quiet time before the board starts forgetting you. */
export const DECAY_GRACE_MS = 36 * 3_600_000;
/** Standing lost per full day of silence past the grace. */
export const DECAY_PER_DAY = 30;

// ---- seasons -----------------------------------------------------------------------

/**
 * Monday 5 January 2026, 00:00 UTC. Arbitrary but fixed forever: seasons and
 * field conditions both count from here, so the schedule is a function of the
 * clock rather than a thing the save has to remember correctly.
 */
export const LADDER_EPOCH = Date.UTC(2026, 0, 5);
export const SEASON_MS = 14 * DAY_MS;
/** Fraction of final standing carried into the next season. */
export const SEASON_CARRY = 0.25;

export function seasonAt(now: number): number {
  return Math.floor((now - LADDER_EPOCH) / SEASON_MS);
}

export function seasonStart(season: number): number {
  return LADDER_EPOCH + season * SEASON_MS;
}

export function seasonEnd(season: number): number {
  return seasonStart(season + 1);
}

/** Seasons are numbered for the player from 1, not from the epoch. */
export function seasonNumber(season: number): number {
  return season + 1;
}
