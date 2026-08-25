/**
 * What a raid came for (v1.24).
 *
 * Until now a raid had exactly one ending that counted: the command post dies,
 * or it does not. Everything the player keeps — ladder rungs, standing,
 * veterancy, contracts, a duel marked solved — read that one boolean. The
 * material economy already knew better: `npm run balance -- --objective`
 * measured a failed raid razing a third of the post and coming home with
 * roughly half a win's loot, and the command post is only 40% of the lootable
 * value on the board. So partial success existed; only progress did not.
 *
 * That mattered because it made one unit the whole raid. The doctrines are
 * real and mechanical — HUNT walks to the guns, RAZE walks to the stores — and
 * they deliver very differently, but only one class of outcome was ever paid
 * for, so the planner was decoration around *did you bring the tank*.
 *
 * ## Why an objective layer works here
 *
 * The measurement that would have killed this came back the other way. Three
 * objectives select three genuinely different forces, and each winner is
 * hopeless at the others — the KPA is the clearest case:
 *
 *     force / doctrine   TAKE POST   SPIKE GUNS   RAID STORES
 *     FOOT / HUNT             72.2         84.7           0.0
 *     FOOT / RAZE              5.6          0.0          79.2
 *     ARMOUR / HUNT           52.8         44.4           0.0
 *
 * The mechanism is already in the damage model rather than bolted on for this:
 * melee ignores `DAMAGE_MULT`, so infantry can kill a command post, while
 * ranged fire is discounted hard against structures, so the same infantry
 * cannot kill a tower. Different missions need different armies because the
 * combat maths already made them need different armies.
 *
 * ## Where this lives, and where it does not
 *
 * In the war layer, not the sim. The engine knows what a structure IS —
 * `countStanding` is a query it already answers — and this module decides what
 * that means for a raid. So there is no new `Phase`, no engine branch, and no
 * determinism risk: the objective rides the config so a replay can stop where
 * the raid stopped, and both readers reach the same tick from the same data.
 */

export type ObjectiveId = 'post' | 'guns' | 'stores';

/**
 * How much of a class a raid has to break, as a share of what the base is
 * actually holding.
 *
 * Proportional rather than a flat count, because a flat count is either
 * impossible on a small base or free on a large one — a T2 camp does not have
 * four emplacements to spike. The floor of 2 keeps a lightly-defended post
 * from handing out an objective for nothing.
 *
 * 0.65 was swept, not chosen. At 0.5 the lesser objectives are nearly free for
 * a force built for them — China's armour tops SPIKE THE GUNS at 95.8% — which
 * makes the choice a formality rather than a trade. At 0.65 a specialist lands
 * 83-86% on its own objective and 0-25% on the others, and a generalist is
 * mediocre at all three, which is the shape the whole layer needs. 0.5, 0.65
 * and 0.8 all give a different best force per objective, so the share is a
 * difficulty knob and not the thing that makes objectives work.
 */
export const OBJECTIVE_SHARE = 0.65;
export const OBJECTIVE_FLOOR = 2;

export interface ObjectiveDef {
  readonly id: ObjectiveId;
  readonly name: string;
  readonly short: string;
  /** One line for the planner: what you are going out for. */
  readonly brief: string;
  /**
   * The class whose loss counts, or null for the command post — which is not
   * a quota at all but the one thing that ends a war rather than a battle.
   */
  readonly cls: 'defense' | 'economy' | null;
}

export const OBJECTIVES: Record<ObjectiveId, ObjectiveDef> = {
  post: {
    id: 'post',
    name: 'TAKE THE POST',
    short: 'POST',
    brief: 'Kill the command post. The only objective that moves the Front Line.',
    cls: null,
  },
  guns: {
    id: 'guns',
    name: 'SPIKE THE GUNS',
    short: 'GUNS',
    brief: 'Break the emplacements and withdraw. Pays standing, not a rung.',
    cls: 'defense',
  },
  stores: {
    id: 'stores',
    name: 'RAID THE STORES',
    short: 'STORES',
    brief: 'Break the depots and withdraw. Pays supplies at a premium.',
    cls: 'economy',
  },
};

export const OBJECTIVE_IDS: ObjectiveId[] = ['post', 'guns', 'stores'];

/**
 * Checked against the list rather than with `in`, which is true for anything
 * on Object's prototype: `'constructor' in OBJECTIVES` passes, and the lookup
 * that follows hands back a function whose `cls` is undefined. A save or a
 * pasted code is untrusted input and this is the gate it comes through.
 */
export function isObjectiveId(value: unknown): value is ObjectiveId {
  return typeof value === 'string' && (OBJECTIVE_IDS as string[]).includes(value);
}

/** How many of the class have to fall, given what was standing at the start. */
export function quotaFor(objective: ObjectiveId, standingAtStart: number): number {
  if (OBJECTIVES[objective].cls === null) return 0;
  return Math.min(standingAtStart, Math.max(OBJECTIVE_FLOOR, Math.round(standingAtStart * OBJECTIVE_SHARE)));
}

/**
 * Can this objective be achieved against this base at all?
 *
 * A post with one emplacement cannot be asked for two. The planner uses this
 * to grey the choice out rather than let a raid launch against an ending it
 * can never reach.
 */
export function objectiveAvailable(objective: ObjectiveId, standingAtStart: number): boolean {
  return OBJECTIVES[objective].cls === null || standingAtStart >= OBJECTIVE_FLOOR;
}

/**
 * A live watch on whether a raid has what it came for.
 *
 * Built once, at tick zero, so the quota is fixed against what the base was
 * holding before a shot was fired — a quota the raid could move by filling it
 * would be a moving target. Both readers of an objective use this: the
 * resolver, which decides the outcome, and the replay, which has to stop on
 * the same tick or it shows a battle that did not happen.
 *
 * Takes a counter rather than an engine so this module stays free of the sim.
 */
export function watchObjective(
  objective: ObjectiveId,
  standingNow: (cls: 'defense' | 'economy') => number,
): { readonly quota: number; readonly startedWith: number; met(): boolean; progress(): number } {
  const cls = OBJECTIVES[objective].cls;
  const startedWith = cls === null ? 0 : standingNow(cls);
  const quota = quotaFor(objective, startedWith);
  const progress = (): number => (cls === null ? 0 : startedWith - standingNow(cls));
  return {
    quota,
    startedWith,
    progress,
    // The command post is not a quota: taking it ends the battle on its own,
    // and the engine's own phase says so.
    met: () => cls !== null && quota > 0 && progress() >= quota,
  };
}
