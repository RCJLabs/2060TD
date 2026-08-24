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
 * The measurement that produced this file is worth keeping in view. Stripping
 * EVERY wall out of a generated base made it EASIER to hold, not harder:
 *
 *     cpPerSecond   walls   stripped   the wall line is worth
 *              0      90         86                        -4
 *            0.8      86         86                         0
 *            1.2      80         85                        +5
 *            2.0      79         80                        +1
 *
 * At zero the fortification was worse than no fortification, because a wall
 * only ever spends the attacker's TIME and nothing in a raid charged for time
 * — so the maze's only real effect was to steer raiders around the guns. Give
 * the defender a clock and the sign flips: seconds become Command Points,
 * Command Points become guns, and a wall that costs ten seconds finally buys
 * something that shoots.
 *
 * The 2.0 row is the other half of the lesson and the reason this is tuned
 * rather than maximised. Too rich an economy saturates the garrison — it
 * reaches `maxActions` whether you took the short way or the long way — and
 * route length stops mattering all over again. The signal lives in the
 * middle, at the same 1.2 every siege in the game already runs on.
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
 * shell its own base. And `densest` is the only target that makes a wall line
 * pay — the four were measured against each other over 600 raids apiece:
 *
 *     target        walls   bare   the wall line is worth
 *     (no watch)     86.7   81.5                     -5.2
 *     ccApproach     86.2   81.5                     -4.7
 *     breach         86.5   81.5                     -5.0
 *     densest        70.7   81.5                    +10.8
 *
 * `ccApproach` puts a gun three cells from the post, which is a last stand at
 * the objective — by then the attacker has walked the whole corridor for
 * free. `breach` waits for a wall to actually fall, which is later still.
 * `densest` puts it on the mass, and a wall line's real work is bunching that
 * mass into a corridor, so the two compound. That is the mechanism: the maze
 * makes the crowd, the garrison shoots the crowd.
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
 * What a manned base gives up for the privilege (v1.20).
 *
 * A garrison on its own is a straight difficulty rise: switched on at full
 * strength it took the reference force's clear rate from 86.7 to 70.7. That
 * is a spike wearing a design's clothes, and the harness has refused it twice
 * before under other names. So the base PAYS for its reserve out of the one
 * account the measurements keep naming as decisive — standing gun coverage:
 *
 *     guns    walls   bare   wall line worth   raids vs before
 *     1.00     70.7   81.5             +10.8             -16.0
 *     0.85     85.7   92.5              +6.8              -1.0
 *     0.80     86.7   93.3              +6.7               0.0
 *     0.75     93.3   93.3               0.0              +6.7
 *
 * At 0.80 a raid is exactly as hard as it was and the wall line is worth
 * +6.7 instead of -5.2. That is the whole trade in one number: a post can
 * have guns everywhere all of the time, or guns where you are when you get
 * there, and this release moves a fifth of the first into the second.
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
