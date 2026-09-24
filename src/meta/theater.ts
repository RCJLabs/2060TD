/**
 * The theater as the town sees it (M25 Phase 1): the map derived from the
 * Front Line's rung and its wins, and nothing stored.
 *
 * Columns behind the front are held, the front column is contested, and the
 * rest is enemy ground. Any three wins at the front take the column, as any
 * three wins took the rung, so which sectors a commander holds is not yet
 * state: it has to be once something can take one back (Phase 2).
 */
import type { GeneratedBase } from '../content/bases';
import {
  BAND_NAMES,
  columnName,
  laneFor,
  strongholdTier,
  theaterFor,
  type Lane,
  type Theater,
} from '../content/theaters';
import type { TownState } from './town';
import { targetFor } from './warfare';

export type ColumnState = 'home' | 'held' | 'front' | 'enemy';

export interface TheaterRow {
  tier: number;
  name: string;
  state: ColumnState;
  stronghold: boolean;
}

export interface TheaterView {
  theater: Theater;
  /** The front's column: the Front Line's rung. */
  front: number;
  /** Wins at the front toward taking its column, of three. */
  pushes: number;
  /** The columns around the front, nearest the base first. */
  rows: TheaterRow[];
}

/**
 * The map around the front: `behind` columns behind it (down to the base) and
 * `ahead` beyond it.
 */
export function theaterView(town: TownState, behind = 2, ahead = 3): TheaterView {
  const theater = theaterFor(town.faction);
  const front = Math.max(1, town.frontline.tier);
  const rows: TheaterRow[] = [];
  for (let tier = Math.max(0, front - behind); tier <= front + ahead; tier++) {
    rows.push({
      tier,
      name: columnName(theater, tier),
      state: tier === 0 ? 'home' : tier < front ? 'held' : tier === front ? 'front' : 'enemy',
      stronghold: tier === strongholdTier(theater),
    });
  }
  return { theater, front, pushes: town.frontline.wins, rows };
}

/** One of the front's three sectors: where it is, and the post in it. */
export interface Sector {
  tier: number;
  /** The column's town. */
  town: string;
  lane: Lane;
  /** The deal's band the lane holds. */
  band: (typeof BAND_NAMES)[number];
  /** The post, exactly as the ladder deals it. */
  base: GeneratedBase;
}

/** The front sector that holds the rung's dealt post `variant`. */
export function sectorOf(town: TownState, variant: number): Sector {
  const theater = theaterFor(town.faction);
  const lane = laneFor(theater, variant);
  return {
    tier: town.frontline.tier,
    town: columnName(theater, town.frontline.tier),
    lane,
    band: BAND_NAMES[lane.slot]!,
    base: targetFor(town, variant),
  };
}

/** "FLORENCE (T2)": the front's town beside the tier it still is. */
export function frontLabel(town: TownState): string {
  return `${columnName(theaterFor(town.faction), town.frontline.tier)} (T${town.frontline.tier})`;
}
