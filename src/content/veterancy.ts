import type { FactionId } from './factions';

/**
 * Veterancy (v1.9): the three raid slots stop being scratch space and become
 * three standing formations with names and records.
 *
 * The rule is one sentence: experience lives in the men, so it walks out with
 * the ones who don't come back. A squad that clears a post whole banks the
 * whole lesson; a squad that loses half its strength loses half of everything
 * it ever knew, because the half that knew it is lying in the wire. That is
 * the entire point — it turns the loss line in the raid report from a number
 * into a cost you carry into the next raid.
 *
 * Everything here is pure arithmetic over integers so the same raid replays to
 * the same record, and the rank multiplier is small enough that veterancy is
 * an edge and never a substitute for bringing enough people.
 */

// ---- ranks ------------------------------------------------------------------------

export type RankId = 'green' | 'line' | 'veteran' | 'cadre';

export interface Rank {
  id: RankId;
  /** Full name for headings. */
  name: string;
  /** Panel tag — three characters, sits in a row's sub. */
  short: string;
  /** XP floor: the lowest experience that reads as this rank. */
  at: number;
  /** Multiplier on unit HP and damage for this squad's units. */
  mult: number;
  /** One line for the record panel. Kept under 26 characters (narrow rail). */
  tag: string;
}

export const RANKS: Rank[] = [
  { id: 'green', at: 0, mult: 1, name: 'GREEN', short: 'GRN', tag: 'Replacements. No edge.' },
  { id: 'line', at: 40, mult: 1.04, name: 'LINE', short: 'LN', tag: 'Been shot at. Steadier.' },
  { id: 'veteran', at: 110, mult: 1.09, name: 'VETERAN', short: 'VET', tag: 'Reads a base on sight.' },
  { id: 'cadre', at: 220, mult: 1.15, name: 'CADRE', short: 'CDR', tag: 'Teaches the others.' },
];

export const RANK_BY_ID: Record<RankId, Rank> = Object.fromEntries(
  RANKS.map((r) => [r.id, r]),
) as Record<RankId, Rank>;

/**
 * Experience stops accruing a little above cadre. The slack is deliberate: a
 * squad at the top can absorb one bad afternoon without dropping a rank, but
 * it cannot bank a war's worth of insurance against being thrown away.
 */
export const XP_CAP = 300;

export function rankFor(xp: number): Rank {
  let found = RANKS[0]!;
  for (const rank of RANKS) {
    if (xp >= rank.at) found = rank;
  }
  return found;
}

/** The next rank up, or null at cadre. */
export function nextRank(xp: number): Rank | null {
  return RANKS.find((r) => r.at > xp) ?? null;
}

/** Progress through the current band, 0..1 (1 at cadre). */
export function rankProgress(xp: number): number {
  const here = rankFor(xp);
  const up = nextRank(xp);
  if (!up) return 1;
  return Math.max(0, Math.min(1, (xp - here.at) / (up.at - here.at)));
}

export const rankMult = (xp: number): number => rankFor(xp).mult;

// ---- experience -------------------------------------------------------------------

/** Experience a whole squad banks per tier of the post it hit. */
export const XP_PER_TIER = 6;
/** A cleared command post teaches more than a repulse at the wire. */
export const XP_CLEAR_BONUS = 1.5;

export interface RaidReturn {
  /** Men sent. */
  deployed: number;
  /** Men who walked back. */
  returned: number;
  /** Post tier fought (duels count as tier 1). */
  tier: number;
  /** Did the command post fall? */
  cleared: boolean;
}

/**
 * The squad's experience after a raid.
 *
 * Both halves scale by the survival fraction, because both halves are held by
 * people: what the squad knew, and what it just learned. Send eight, bring
 * back four, and the formation is half strangers — it fights like it.
 * A wipe returns the squad to green with a new number stencilled on the
 * vehicles, which is exactly what a reconstituted unit is.
 */
export function earnXp(xp: number, raid: RaidReturn): number {
  if (raid.deployed <= 0) return Math.round(xp);
  const survival = Math.max(0, Math.min(1, raid.returned / raid.deployed));
  const gained = Math.max(1, raid.tier) * XP_PER_TIER * (raid.cleared ? XP_CLEAR_BONUS : 1);
  return Math.max(0, Math.min(XP_CAP, Math.round((xp + gained) * survival)));
}

// ---- names ------------------------------------------------------------------------

export const SQUAD_SLOTS = 3;

/**
 * Call signs, not unit designations: the radio log is how the player meets
 * these formations, and a call sign is what comes over the radio. Three per
 * faction, one per standing slot, at most eight characters so a squad row
 * still reads as one unwrapped line in the rail.
 */
const CALL_SIGNS: Record<FactionId, [string, string, string]> = {
  usa: ['HAMMER', 'RONIN', 'TALON'],
  china: ['VANGUARD', 'IRON OX', 'RED WIND'],
  russia: ['ANVIL', 'SNOWFALL', 'BEAR'],
  nk: ['MOLE', 'NIGHTJAR', 'HORNET'],
  un: ['ATLAS', 'LANTERN', 'SHIELD'],
};

export function squadName(faction: FactionId, slot: number): string {
  const signs = CALL_SIGNS[faction];
  return signs[Math.max(0, Math.min(SQUAD_SLOTS - 1, slot)) as 0 | 1 | 2];
}

// ---- the standing record ----------------------------------------------------------

export interface SquadRecord {
  /** Experience held by the men currently in the formation. */
  xp: number;
  /** Raids this formation has been sent on. */
  raids: number;
  /** Command posts it has taken. */
  clears: number;
  /** Men it has lost, all-time. This number never goes down. */
  lost: number;
}

export const newSquadRecord = (): SquadRecord => ({ xp: 0, raids: 0, clears: 0, lost: 0 });

export const newSquadRecords = (): SquadRecord[] =>
  Array.from({ length: SQUAD_SLOTS }, newSquadRecord);

/** Fold one raid into a formation's record. Pure: returns the new record. */
export function recordRaid(record: SquadRecord, raid: RaidReturn): SquadRecord {
  if (raid.deployed <= 0) return record;
  return {
    xp: earnXp(record.xp, raid),
    raids: record.raids + 1,
    clears: record.clears + (raid.cleared ? 1 : 0),
    lost: record.lost + Math.max(0, raid.deployed - raid.returned),
  };
}

/**
 * Repair a roster off disk. Squads arrived in v1.9, so most files simply have
 * none; a hand-edited one can have junk. Either way the answer is the same
 * shape, because every caller wants three formations back.
 */
export function normalizeSquads(raw: unknown): SquadRecord[] {
  const list = Array.isArray(raw) ? raw : [];
  const num = (value: unknown, cap: number): number =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(cap, Math.round(value)))
      : 0;
  return Array.from({ length: SQUAD_SLOTS }, (_, i) => {
    const entry = list[i] as Partial<SquadRecord> | undefined;
    if (!entry || typeof entry !== 'object') return newSquadRecord();
    return {
      xp: num(entry.xp, XP_CAP),
      raids: num(entry.raids, 1e6),
      clears: num(entry.clears, 1e6),
      lost: num(entry.lost, 1e9),
    };
  });
}
