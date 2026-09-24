/**
 * The theater as the town sees it (M25): the map read off the Front Line's
 * rung, its wins, and the ground the enemy has retaken behind it.
 *
 * Columns behind the front are held, the front column is contested, and the
 * rest is enemy ground. Any three wins at the front take the column, as any
 * three wins took the rung. Since Phase 2 the enemy strikes back when the
 * front goes quiet (`strikes.ts`), so a sector behind the front can be the
 * enemy's again: that is the one part of the map that is stored.
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
import { cutAt, isLost, lostSectors } from './strikes';
import type { TownState } from './town';
import { postAt } from './warfare';

export type ColumnState = 'home' | 'held' | 'front' | 'enemy';

export interface TheaterRow {
  tier: number;
  name: string;
  state: ColumnState;
  stronghold: boolean;
  /** Per lane, by slot: a held column's sector the enemy has retaken. */
  lost: [boolean, boolean, boolean];
}

export interface TheaterView {
  theater: Theater;
  /** The front's column: the Front Line's rung. */
  front: number;
  /** Wins at the front toward taking its column, of three. */
  pushes: number;
  /** Per lane, by slot: its road to the front is cut behind it. */
  cut: [boolean, boolean, boolean];
  /** The columns around the front, nearest the base first. */
  rows: TheaterRow[];
}

/**
 * The map around the front: `behind` columns behind it (down to the base), and
 * further back to any sector the enemy holds, and `ahead` beyond it.
 */
export function theaterView(town: TownState, behind = 2, ahead = 3): TheaterView {
  const theater = theaterFor(town.faction);
  const fl = town.frontline;
  const front = Math.max(1, fl.tier);
  const deepest = Math.min(front - behind, ...lostSectors(fl).map((l) => l.tier));
  const rows: TheaterRow[] = [];
  for (let tier = Math.max(0, deepest); tier <= front + ahead; tier++) {
    rows.push({
      tier,
      name: columnName(theater, tier),
      state: tier === 0 ? 'home' : tier < front ? 'held' : tier === front ? 'front' : 'enemy',
      stronghold: tier === strongholdTier(theater),
      lost: [isLost(fl, tier, 0), isLost(fl, tier, 1), isLost(fl, tier, 2)],
    });
  }
  const cut: [boolean, boolean, boolean] = [
    cutAt(fl, 0) !== null,
    cutAt(fl, 1) !== null,
    cutAt(fl, 2) !== null,
  ];
  return { theater, front, pushes: fl.wins, cut, rows };
}

/** A sector a raid can go for, and the post in it. */
export interface Sector {
  tier: number;
  /** The column's town. */
  town: string;
  lane: Lane;
  /** The deal's band the lane holds. */
  band: (typeof BAND_NAMES)[number];
  /** The post, exactly as the ladder deals it at that tier. */
  base: GeneratedBase;
  /** Behind the front and the enemy's again: taking it retakes it (Phase 2). */
  retake: boolean;
  /**
   * For a front post: the town where its lane's road is cut, nearest the
   * front, or null when the road is open and it can be raided.
   */
  cutAt: string | null;
}

/** The sector at `tier` in slot `variant`'s lane. */
export function sectorAt(town: TownState, tier: number, variant: number): Sector {
  const theater = theaterFor(town.faction);
  const lane = laneFor(theater, variant);
  const fl = town.frontline;
  const cut = tier === fl.tier ? cutAt(fl, lane.slot) : null;
  return {
    tier,
    town: columnName(theater, tier),
    lane,
    band: BAND_NAMES[lane.slot]!,
    base: postAt(town, tier, lane.slot),
    retake: tier < fl.tier && isLost(fl, tier, lane.slot),
    cutAt: cut ? columnName(theater, cut.tier) : null,
  };
}

/** The front sector that holds the rung's dealt post `variant`. */
export function sectorOf(town: TownState, variant: number): Sector {
  return sectorAt(town, town.frontline.tier, variant);
}

/** The sectors behind the front the enemy holds, nearest the front first. */
export function retakes(town: TownState): Sector[] {
  return lostSectors(town.frontline).map((l) => sectorAt(town, l.tier, l.slot));
}

/**
 * What a raid can go for, in the planner's order: the front posts whose roads
 * are open, slot by slot, then the sectors to retake, nearest the front first.
 * As keys, which deal no posts: the planner asks this every frame.
 */
export function raidTargetKeys(town: TownState): { tier: number; slot: number }[] {
  const fl = town.frontline;
  const front = [0, 1, 2].filter((slot) => cutAt(fl, slot) === null).map((slot) => ({ tier: fl.tier, slot }));
  return [...front, ...lostSectors(fl).map((l) => ({ tier: l.tier, slot: l.slot }))];
}

/** `raidTargetKeys`, with the post in each. */
export function raidTargets(town: TownState): Sector[] {
  return raidTargetKeys(town).map((k) => sectorAt(town, k.tier, k.slot));
}

/** "FLORENCE (T2)": the front's town beside the tier it still is. */
export function frontLabel(town: TownState): string {
  return `${columnName(theaterFor(town.faction), town.frontline.tier)} (T${town.frontline.tier})`;
}
