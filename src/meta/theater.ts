/**
 * The theater as the town sees it (M25): the map read off the Front Line's
 * rung, its wins, and the ground the enemy has retaken behind it.
 *
 * Columns behind the front are held, the front column is contested, and the
 * rest is enemy ground. Any three wins at the front take the column, as any
 * three wins took the rung, but for the enemy's capital, which falls to its
 * roads and its citadel (Phase 4b, `capital.ts`). Since Phase 2 the enemy
 * strikes back when the front goes quiet (`strikes.ts`), so a sector behind
 * the front can be the enemy's again: that and the capital's roads are the
 * parts of the map that are stored.
 */
import { CITADEL_SLOT, type GeneratedBase } from '../content/bases';
import {
  BAND_NAMES,
  columnName,
  laneFor,
  strongholdTier,
  theaterFor,
  type Lane,
  type Theater,
} from '../content/theaters';
import { atCapital, citadelInRange, roadsTaken } from './capital';
import { cutAt, isLost, lostSectors } from './strikes';
import type { TownState } from './town';
import { postAt } from './warfare';

export type ColumnState = 'home' | 'held' | 'front' | 'enemy';

export interface TheaterRow {
  tier: number;
  name: string;
  state: ColumnState;
  stronghold: boolean;
  /**
   * The enemy's headquarters, drawn as a row of its own past the stronghold's
   * (M25 Phase 4b): in no lane, and in range once the three roads have fallen.
   */
  citadel?: boolean;
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
  /** Per lane, by slot: at the enemy's capital, its road into it has fallen (M25 Phase 4b). */
  roads: [boolean, boolean, boolean];
  /** The front is at the capital and the citadel can be raided. */
  citadelInRange: boolean;
  /** When the citadel fell and the war was won, if it has. */
  wonAt?: number;
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
  const capital = strongholdTier(theater);
  for (let tier = Math.max(0, deepest); tier <= front + ahead; tier++) {
    const state: ColumnState = tier === 0 ? 'home' : tier < front ? 'held' : tier === front ? 'front' : 'enemy';
    rows.push({
      tier,
      name: columnName(theater, tier),
      state,
      stronghold: tier === capital,
      lost: [isLost(fl, tier, 0), isLost(fl, tier, 1), isLost(fl, tier, 2)],
    });
    if (tier === capital) {
      // The citadel, past the stronghold's roads: held once the front has
      // moved on into the rear, the front while it is in range, and otherwise
      // the enemy's.
      rows.push({
        tier,
        name: 'THE CITADEL',
        state: front > capital ? 'held' : citadelInRange(town) ? 'front' : 'enemy',
        stronghold: true,
        citadel: true,
        lost: [false, false, false],
      });
    }
  }
  const cut: [boolean, boolean, boolean] = [
    cutAt(fl, 0) !== null,
    cutAt(fl, 1) !== null,
    cutAt(fl, 2) !== null,
  ];
  const taken = atCapital(town) ? roadsTaken(fl) : [];
  const roads: [boolean, boolean, boolean] = [taken.includes(0), taken.includes(1), taken.includes(2)];
  return {
    theater,
    front,
    pushes: fl.wins,
    cut,
    roads,
    citadelInRange: citadelInRange(town),
    ...(fl.wonAt !== undefined ? { wonAt: fl.wonAt } : {}),
    rows,
  };
}

/** A sector a raid can go for, and the post in it. */
export interface Sector {
  tier: number;
  /** The column's town. */
  town: string;
  lane: Lane;
  /** The deal's band the lane holds, or HQ for the citadel. */
  band: (typeof BAND_NAMES)[number] | 'HQ';
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

/** The citadel's place on the map (M25 Phase 4b): in no lane, so it names itself. */
export const CITADEL_LANE: Lane = { name: 'THE CITADEL', slot: CITADEL_SLOT };

/** The sector at `tier` in slot `variant`'s lane, or the citadel. */
export function sectorAt(town: TownState, tier: number, variant: number): Sector {
  const theater = theaterFor(town.faction);
  if (variant === CITADEL_SLOT) {
    return {
      tier,
      town: columnName(theater, tier),
      lane: CITADEL_LANE,
      band: 'HQ',
      base: postAt(town, tier, CITADEL_SLOT),
      retake: false,
      cutAt: null,
    };
  }
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
 * What a raid can go for, in the planner's order: the citadel when it is in
 * range (M25 Phase 4b), the front posts whose roads are open, slot by slot,
 * then the sectors to retake, nearest the front first. At the capital a road
 * already taken stays on the list: it pays, and counts for nothing more. As
 * keys, which deal no posts: the planner asks this every frame.
 */
export function raidTargetKeys(town: TownState): { tier: number; slot: number }[] {
  const fl = town.frontline;
  const citadel = citadelInRange(town) ? [{ tier: fl.tier, slot: CITADEL_SLOT }] : [];
  const front = [0, 1, 2].filter((slot) => cutAt(fl, slot) === null).map((slot) => ({ tier: fl.tier, slot }));
  return [...citadel, ...front, ...lostSectors(fl).map((l) => ({ tier: l.tier, slot: l.slot }))];
}

/** `raidTargetKeys`, with the post in each. */
export function raidTargets(town: TownState): Sector[] {
  return raidTargetKeys(town).map((k) => sectorAt(town, k.tier, k.slot));
}

/** "FLORENCE (T2)": the front's town beside the tier it still is. */
export function frontLabel(town: TownState): string {
  return `${columnName(theaterFor(town.faction), town.frontline.tier)} (T${town.frontline.tier})`;
}
