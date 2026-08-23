import { DAY_MS, leagueAt, type League } from '../content/leagues';
import { flavorFor, type FactionId } from '../content/factions';
import { rankFor, squadName, type Rank, type SquadRecord } from '../content/veterancy';
import { leagueOf, standingSeries } from './ladder';
import { readSlot, SLOT_COUNT } from './save';
import { warLog, type SeasonRecord, type TownState } from './town';

/**
 * The service record (v1.10): what this war has cost and what it has taken.
 *
 * Almost nothing here is new state. The league layer, the campaign, the town
 * and the squad roster have been accumulating this since v0.2 — it simply had
 * nowhere to be read. So this module is a reader: pure, total, and free of
 * anything that needs a browser, which means the whole record can be asserted
 * in a test instead of squinted at in a screenshot.
 */

// ---- the record --------------------------------------------------------------------

export interface FormationLine {
  slot: number;
  name: string;
  rank: Rank;
  record: SquadRecord;
}

export interface ServiceRecord {
  faction: FactionId;
  /** Faction long name, for the heading. */
  army: string;
  /** Whole days since the war started (day one reads as 1, not 0). */
  day: number;
  // the board
  tier: number;
  standing: number;
  peak: number;
  league: League;
  /** Highest band this war ever held — current peak or any season's. */
  bestLeague: League;
  seasons: SeasonRecord[];
  /** Daily standing, oldest first, at most a month long. */
  line: { day: number; value: number }[];
  // the offense
  raids: number;
  postsTaken: number;
  duelsWon: number;
  menLost: number;
  formations: FormationLine[];
  // the defense
  battlesWon: number;
  battlesLost: number;
  assaultLevel: number;
  probesHeld: number;
  probesBreached: number;
  // the long game
  missions: number;
  research: number;
}

/**
 * Which day of this war `now` falls on, counting from one.
 *
 * Separate from serviceRecord because the WAR tab shows the day on a row that
 * is rebuilt every frame, and building the whole record — a fresh object and
 * a month-long series — to read one integer is not what that row needs.
 */
export function warDay(town: TownState, now: number): number {
  return Math.max(1, Math.floor((now - warLog(town).startedAt) / DAY_MS) + 1);
}

export function serviceRecord(town: TownState, now: number): ServiceRecord {
  const log = warLog(town);
  const fl = town.frontline;
  const squads = town.squads ?? [];
  const peakBand = Math.max(fl.peak, ...fl.placements.map((p) => p.peak), 0);
  return {
    faction: town.faction,
    army: flavorFor(town.faction).faction,
    // A war that started this minute is on its first day, not its zeroth.
    day: warDay(town, now),
    tier: fl.tier,
    standing: fl.standing,
    peak: fl.peak,
    league: leagueOf(town),
    bestLeague: leagueAt(peakBand),
    seasons: fl.placements,
    line: standingSeries(town, now),
    raids: log.raids,
    postsTaken: fl.totalWins,
    duelsWon: town.duels?.length ?? 0,
    menLost: squads.reduce((total, s) => total + s.lost, 0),
    formations: squads.map((record, slot) => ({
      slot,
      name: squadName(town.faction, slot),
      rank: rankFor(record.xp),
      record,
    })),
    battlesWon: town.victories,
    battlesLost: town.defeats,
    assaultLevel: town.assaultLevel,
    probesHeld: log.probesHeld,
    probesBreached: log.probesBreached,
    missions: town.campaign.completed.length,
    research: town.research.completed.length,
  };
}

// ---- the standing line, as bars ----------------------------------------------------

/**
 * Normalize the line to 0..1 for drawing.
 *
 * The floor is zero rather than the minimum sample on purpose: standing is a
 * distance above nothing, and a chart that rescales its own floor would draw
 * a war spent at 20 points exactly like a war spent at 2,000. The ceiling is
 * the run's own peak, so the shape of THIS war is what's visible.
 */
export function lineBars(line: { value: number }[]): number[] {
  const top = Math.max(1, ...line.map((p) => p.value));
  return line.map((p) => Math.max(0, Math.min(1, p.value / top)));
}

/** Where the line ends up against where it has been. */
export function lineTrend(line: { value: number }[]): 'up' | 'down' | 'flat' {
  if (line.length < 2) return 'flat';
  const last = line[line.length - 1]!.value;
  // A week is the window a commander can actually act on; shorter runs use
  // whatever they have.
  const back = line[Math.max(0, line.length - 8)]!.value;
  if (last > back) return 'up';
  if (last < back) return 'down';
  return 'flat';
}

// ---- every war on this machine -----------------------------------------------------

export interface WarSummary {
  slot: number;
  faction: FactionId;
  army: string;
  tier: number;
  standing: number;
  league: League;
  battlesWon: number;
  /** Epoch ms this war was last played. */
  lastSeen: number;
}

/**
 * One line per save slot that holds a war. The record is per-war by nature —
 * a town is one commander's file — so the cross-war view is this, and it is
 * read straight off the other slots rather than duplicated into each save.
 */
export function allWars(): WarSummary[] {
  const wars: WarSummary[] = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    const town = readSlot(slot);
    if (!town) continue;
    wars.push({
      slot,
      faction: town.faction,
      army: flavorFor(town.faction).faction,
      tier: town.frontline.tier,
      standing: town.frontline.standing,
      league: leagueAt(town.frontline.standing),
      battlesWon: town.victories,
      lastSeen: town.lastSeen,
    });
  }
  return wars;
}
