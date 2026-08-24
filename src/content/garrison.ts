import type { ArchetypeId } from './bases';
import type { StandingOrders } from '../sim/types';

/**
 * The garrison (v1.20): what an AI base does while you are walking towards it.
 *
 * Before this, a Front Line post was a diorama. `raidConfig` set
 * `cpPerSecond: 0` and `cpCap: 1`, so the defender's economy never ran, and
 * `applyStandingOrders` was gated to the player's own side, so nothing it
 * bought could have been spent. A raid was therefore decided entirely by how
 * many guns happened to cover your route, and the harness said so three times
 * running — field conditions, gates, and terrain each measured the same thing.
 *
 * WHAT THIS FIXES, AND WHAT IT DOES NOT. Two things were wrong and they are
 * not the same thing, which took an isolating control to see. Over 600 raids
 * a cell, holding the force and the seeds fixed:
 *
 *     watch  guns   walls   bare   the wall line is worth
 *       off  1.00    86.7   81.5                     -5.2
 *       off  0.80    86.7   94.0                     +7.3
 *        on  1.00    70.7   81.5                    +10.8
 *        on  0.80    86.7   93.3                     +6.7
 *
 * Read the second row before the fourth. A base with every wall stripped out
 * used to be EASIER to hold than the same base fortified — the wall line was
 * worth -5.2 TO THE ATTACKER — and cutting standing gun damage by a fifth is
 * what fixes that, on its own, with no garrison anywhere near it. The
 * garrison does not flip that sign and very slightly blunts it. Anything in
 * this file that reads as credit for the wall line is credit for
 * `GARRISON_GUN_TRADE` below, which is a different constant in a different
 * paragraph.
 *
 * What the garrison IS for is the clock. A wall only ever spends the
 * attacker's TIME, and a raid charged nothing for time: no economy, no
 * reinforcement, no deadline. Measured directly, over 1200 raids a cell,
 * by staggering the same three squads instead of launching them together:
 *
 *     launch stagger   watch off   watch on
 *              0s         93.3       88.3
 *             20s         90.8       88.2
 *             40s         92.5       82.5
 *             60s         88.2       80.0
 *
 * Unwatched, taking a minute longer costs 5.1 points and most of that is
 * noise. Watched, it costs 8.3, and the decline is the shape you want: a
 * concentrated push arrives before the reserve exists, a dawdling one walks
 * into guns that were not there when it started. That is the whole of what
 * this file buys, and it is worth being plain that it is a smaller effect
 * than the one above.
 *
 * The rate is 1.2/s, the same one every siege in the game already runs on,
 * and it is not a lever — 1.2, 1.6, 2.0 and 2.6 all measured identically,
 * because what the garrison does is front-loaded and a richer economy only
 * banks Command Points it never gets to spend.
 */

/**
 * The reserve: the CP-priced kinds a base can stand up mid-battle. These are
 * role ids, so each faction fields them out of its own defense catalog at its
 * own prices, exactly as standing orders do for a defending player.
 *
 * `manpads` is stocked but no doctrine below calls for it. A rule cannot yet
 * ask "is anything in the air?", so an AA order placed against a ground raid
 * burns one of a handful of actions for nothing. Air raids are measured in
 * the balance pass; if they need an answer, the answer is a new predicate,
 * not a wasted order.
 */
export const GARRISON_RESERVE_KINDS = ['manpads', 'depmg', 'foxhole', 'claymore'] as const;

export type GarrisonId = 'screen' | 'standto' | 'redoubt';

export const GARRISON_IDS: GarrisonId[] = ['screen', 'standto', 'redoubt'];

/**
 * Three postures, not eight, and every rule deploys onto `densest`.
 *
 * Both of those were measured rather than chosen. DEPLOY-only is a
 * correctness rule: the engine reads `attackerSide` to decide whether an
 * impact lands on units or on structures, so a garrison fire mission would
 * shell its own base.
 *
 * `densest` is the only target that does anything at all. The four were
 * measured against each other over 600 raids apiece, at full gun strength so
 * the differences were visible:
 *
 *     target        walls   bare
 *     (no watch)     86.7   81.5
 *     ccApproach     86.2   81.5
 *     breach         86.5   81.5
 *     densest        70.7   81.5
 *
 * `ccApproach` and `breach` are indistinguishable from having no watch at
 * all. `ccApproach` puts a gun three cells from the post, which is a last
 * stand at the objective — by then the attacker has walked the whole corridor
 * for free — and `breach` waits for a wall to actually fall, later still.
 * `densest` puts it on the mass while the mass is still moving, which is the
 * only moment at which a reserve is worth having.
 */
const DOCTRINES: Record<GarrisonId, StandingOrders['rules']> = {
  /** Barely held. One mine on the mass, and a gun if it lasts long enough. */
  screen: [
    { cpAtLeast: 16, action: 'deploy', kind: 'claymore', target: 'densest', minHostiles: 2, cooldownTicks: 180 },
    { cpAtLeast: 42, action: 'deploy', kind: 'depmg', target: 'densest', minHostiles: 2, cooldownTicks: 180 },
  ],
  /** The standard watch: mine them, then gun them, then dig in on them. */
  standto: [
    { cpAtLeast: 16, action: 'deploy', kind: 'claymore', target: 'densest', minHostiles: 2, cooldownTicks: 180 },
    { cpAtLeast: 42, action: 'deploy', kind: 'depmg', target: 'densest', minHostiles: 2, cooldownTicks: 180 },
    { cpAtLeast: 68, action: 'deploy', kind: 'foxhole', target: 'densest', minHostiles: 3, cooldownTicks: 180 },
  ],
  /** Held in depth: the same answer, with one more pair of hands to give it. */
  redoubt: [
    { cpAtLeast: 16, action: 'deploy', kind: 'claymore', target: 'densest', minHostiles: 2, cooldownTicks: 180 },
    { cpAtLeast: 42, action: 'deploy', kind: 'depmg', target: 'densest', minHostiles: 2, cooldownTicks: 180 },
    { cpAtLeast: 68, action: 'deploy', kind: 'foxhole', target: 'densest', minHostiles: 3, cooldownTicks: 180 },
  ],
};

/**
 * Which posture a shape is held with. A camp is barely manned and a depot is
 * a warehouse with a fence; a keep or a bunker is somebody's whole plan.
 */
const POSTURE: Record<ArchetypeId, GarrisonId> = {
  camp: 'screen',
  depot: 'screen',
  compound: 'standto',
  corridor: 'standto',
  strongpoints: 'standto',
  star: 'redoubt',
  keep: 'redoubt',
  bunker: 'redoubt',
};

/**
 * How many orders the watch gets through before it is out of hands.
 *
 * Flat per posture, deliberately NOT scaled by tier. The response to a
 * garrison is bimodal rather than gradual — every setting measured landed on
 * either about -0.2 or about +10.8 of wall value, with nothing in between,
 * because one more gun on a bunched force tips whole cohorts at once. A
 * ceiling that drifts up with the rung would walk deeper tiers across that
 * step without anything in the tables showing it happening.
 */
const ACTIONS: Record<GarrisonId, number> = { screen: 2, standto: 3, redoubt: 4 };

/**
 * The garrison for a base. Deterministic in (archetype, tier) — both of which
 * a share code and a replay already carry — so a scouted post, the raid on
 * it, and the replay of that raid all face the same watch.
 */
export function garrisonFor(archetype: ArchetypeId, _tier: number): StandingOrders {
  const id = POSTURE[archetype];
  return { id, maxActions: ACTIONS[id], rules: DOCTRINES[id] };
}

/**
 * The constant that actually earns the wall line (v1.20).
 *
 * This is NOT the garrison's price, and calling it that was the mistake an
 * isolating control caught. Standing gun coverage is the term every
 * measurement in this project keeps naming as decisive, and cutting it by a
 * fifth is what turns a fortification from a liability into a defence — with
 * or without a watch on the wire:
 *
 *     guns   watch   walls   bare   wall line worth   raids vs v1.19
 *     1.00     off    86.7   81.5             -5.2              0.0
 *     0.80     off    86.7   94.0             +7.3              0.0
 *     0.80      on    86.7   93.3             +6.7              0.0
 *
 * Why it works: weaker guns let attackers live longer in the open, so a wall
 * line that holds a force in a corridor under fire finally matters, and the
 * old dominant effect — a maze steering raiders AROUND the guns — stops being
 * worth more than the corridor itself. The clear rate does not move at any of
 * these, which is the bar: a trade, not a spike.
 *
 * A post can have guns everywhere all of the time, or fewer guns and a wall
 * line that means something. This release moves a fifth of the first into the
 * second, and hires the garrison above with the change.
 */
export const GARRISON_GUN_TRADE = 0.8;

/**
 * The economy behind it. `startingCp: 0` is the whole design: the base is
 * asleep when you cross the line and wakes at a fixed rate, so arriving fast
 * means arriving before the reserve exists. The cap is what a tier can bank,
 * not what it can spend — `maxActions` is the real ceiling.
 */
export function garrisonEconomy(tier: number): {
  startingCp: number;
  cpCap: number;
  cpPerSecond: number;
} {
  return { startingCp: 0, cpCap: 60 + tier * 20, cpPerSecond: 1.2 };
}

export function isGarrisonId(value: unknown): value is GarrisonId {
  return typeof value === 'string' && (GARRISON_IDS as string[]).includes(value);
}

/**
 * Rebuild a garrison from what a replay code carries. Only the posture id and
 * the action ceiling travel: the rules themselves are read out of the table
 * above, so a code can never carry a doctrine that has drifted out of step
 * with the game it is pasted into. Same contract as standing orders.
 */
export function garrisonById(id: GarrisonId, maxActions: number): StandingOrders {
  return { id, maxActions, rules: DOCTRINES[id] };
}
