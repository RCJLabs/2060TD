/**
 * The enemy's capital (M25 Phase 4b): the stronghold is taken by its three
 * roads and then its citadel, and the citadel's fall wins the war.
 *
 * A town falls to any three wins at the front. The stronghold does not. Each
 * of its three roads has to fall once, and a win on a road already taken pays
 * like any post and counts for nothing more. Once all three have fallen the
 * citadel is in range: the enemy's headquarters, a fourth target in no lane.
 * The first time it falls the war is won, dated, and paid like the top band's
 * season placement.
 *
 * Nothing resets. The citadel's fall takes the stronghold as a third push
 * takes a town, if the depots can feed the line with it (Phase 4a), and the
 * front moves on into the enemy's rear. If they cannot, the war is won all
 * the same and the front holds at the stronghold with its roads, until the
 * depots make enough and the citadel falls again. A front that falls back
 * from the stronghold loses its roads, as any front that falls back loses
 * its pushes (`landStrike`).
 *
 * Pure, like the strikes and the supply line: the raid result calls it, and
 * the save repairs what it stores.
 */
import { CITADEL_SLOT } from '../content/bases';
import { LEAGUES } from '../content/leagues';
import { STRIKE_ORDER, strongholdTier, theaterFor } from '../content/theaters';
import { canFeedNext } from './supply';
import { productionPerHour, type FrontlineState, type TownState } from './town';

/** What winning the war pays, once: the top band's season placement. */
export const WAR_WON_PAYOUT: Readonly<{ supplies: number; fuel: number; intel: number }> =
  LEAGUES[LEAGUES.length - 1]!.placement;

/** The capital's column: the enemy's stronghold. */
export const capitalTier = (town: TownState): number => strongholdTier(theaterFor(town.faction));

/** The front is at the enemy's capital. */
export const atCapital = (town: TownState): boolean => town.frontline.tier === capitalTier(town);

/** The roads into the capital that have fallen, by slot. */
export const roadsTaken = (fl: FrontlineState): readonly number[] => fl.roads ?? [];

/** The citadel can be raided: the front is at the capital and all three of its roads have fallen. */
export const citadelInRange = (town: TownState): boolean =>
  atCapital(town) && roadsTaken(town.frontline).length === STRIKE_ORDER.length;

/** The citadel has fallen once, and the war is won. */
export const isWon = (fl: FrontlineState): boolean => fl.wonAt !== undefined;

/** What a win at the capital did, for the report. */
export type CapitalWin =
  | { kind: 'road'; slot: number; roads: number }
  /** A road already taken: it pays, and counts for nothing more. */
  | { kind: 'road-again'; slot: number; roads: number }
  | {
      kind: 'citadel';
      /** This fall won the war: the first. */
      won: boolean;
      /** The front moved on into the enemy's rear; false while the depots cannot feed the stronghold. */
      moved: boolean;
      /** What the war paid, when this fall won it. */
      payout: { supplies: number; fuel: number; intel: number } | null;
    };

/** Keep the roads sorted and whole, and `wins` counting them. */
function setRoads(fl: FrontlineState, roads: readonly number[]): void {
  const kept = [...new Set(roads)].filter((s) => STRIKE_ORDER.includes(s)).sort((a, b) => a - b);
  if (kept.length === 0) delete fl.roads;
  else fl.roads = kept;
  fl.wins = kept.length;
}

/**
 * Fold a won raid at the capital into the front: a road (`slot` 0 to 2), or
 * the citadel. Null for a citadel not yet in range, which only a raid aimed
 * before the ground moved could reach: it pays like any post and moves
 * nothing.
 */
export function winAtCapital(town: TownState, slot: number, now: number): CapitalWin | null {
  const fl = town.frontline;
  const roads = roadsTaken(fl);
  if (slot !== CITADEL_SLOT) {
    if (roads.includes(slot)) return { kind: 'road-again', slot, roads: roads.length };
    setRoads(fl, [...roads, slot]);
    return { kind: 'road', slot, roads: roadsTaken(fl).length };
  }
  if (roads.length < STRIKE_ORDER.length) return null;
  const won = !isWon(fl);
  if (won) {
    fl.wonAt = now;
    town.supplies += WAR_WON_PAYOUT.supplies;
    town.fuel += WAR_WON_PAYOUT.fuel;
    town.intel += WAR_WON_PAYOUT.intel;
  }
  const moved = canFeedNext(fl, productionPerHour(town).supplies);
  if (moved) {
    fl.tier++;
    fl.wins = 0;
    delete fl.roads;
  }
  return { kind: 'citadel', won, moved, payout: won ? { ...WAR_WON_PAYOUT } : null };
}

/**
 * Repair the two fields off disk. The roads are kept only while the front is
 * at the capital, as whole lanes, with `wins` counting them. A war won at a
 * time that is not a number is not won.
 *
 * Two kinds of file come from before Phase 4b. One at the stronghold holds
 * pushes toward it, won under the rule that any three wins took it: they are
 * kept as roads, the lightest lanes first, which is the likeliest reading and
 * costs the commander nothing. One already past the stronghold took it under
 * that rule: its war is won, dated to when it was last played, and paid
 * nothing, since the rule it was taken under paid nothing.
 */
export function normalizeCapital(town: TownState): void {
  const fl = town.frontline;
  if (fl.wonAt !== undefined && (typeof fl.wonAt !== 'number' || !Number.isFinite(fl.wonAt))) {
    delete fl.wonAt;
  }
  const capital = capitalTier(town);
  if (fl.tier !== capital) {
    delete fl.roads;
    if (fl.tier > capital && fl.wonAt === undefined) {
      fl.wonAt = Number.isFinite(town.lastSeen) ? town.lastSeen : 0;
    }
    return;
  }
  const raw: unknown = fl.roads;
  if (raw === undefined) {
    const pushes = Math.max(0, Math.min(STRIKE_ORDER.length - 1, Math.floor(Number(fl.wins) || 0)));
    setRoads(fl, [...STRIKE_ORDER].reverse().slice(0, pushes));
    return;
  }
  setRoads(
    fl,
    Array.isArray(raw) ? (raw as unknown[]).filter((s): s is number => typeof s === 'number') : [],
  );
}
