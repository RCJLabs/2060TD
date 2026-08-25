/**
 * Combat variance (v1.23).
 *
 * For twelve releases the sim never rolled in combat. The engine's one shared
 * stream had exactly three draw sites — a ±3–8% speed jitter at spawn and two
 * for barrage scatter — so a raid was decided by its matchup and not by its
 * battle. `npm run balance -- --seed` measured what that cost:
 *
 *     200 matchups, 12 seeds each
 *     86% reached the same verdict under every seed
 *     54% brought the IDENTICAL force home every time
 *
 * The only thing that moved was how long a battle took, which is the spawn
 * jitter perturbing arrival times without perturbing who wins — and is why
 * nothing ever looked wrong from the outside.
 *
 * A model here is a **version**, frozen forever. Changing what the rolls do
 * means adding a version, never editing one, so every archived replay
 * re-fights the battle it recorded. Version 0 is the sim that never rolls.
 *
 * ## Every model preserves its mean
 *
 * A roll whose expected multiplier is not exactly 1 is a difficulty change
 * wearing a variance costume, and the two would be impossible to tell apart
 * in the tables. So a model is built so that `E[shot()] === 1`, and
 * `tests/combat.test.ts` measures that rather than trusting the algebra.
 *
 * ## What was priced, and what it cost
 *
 * Twelve candidates across four shapes, each on the same 8 seeds and 200
 * matchups. DECIDED falling is what is being bought; CLEAR drifting is the
 * price, since every model's mean is 1 by construction:
 *
 *     MODEL                  DECIDED   SAME HOME   CLEAR vs FLAT
 *     no rolls (today)          88%        56%          —
 *     damage ±15%               84%        48%        -0.2
 *     damage ±30%               79%        44%        -0.1
 *     damage ±50%               77%        42%        +0.4
 *     miss 10%                  75%        40%        +0.8
 *     miss 25%      <- shipped  64%        30%        +1.1
 *     miss 30%                  67%        29%        +1.1
 *     miss 40%                  65%        24%        +2.1
 *     glance 25% at x0.4        72%        37%        +0.3
 *     glance 40% at x0.3        69%        31%        +0.6
 *     glance 50% at x0.2        68%        28%        +1.8
 *     aim slack 1.5             85%        47%        -0.1
 *     aim slack 3               79%        39%        +1.5
 *     aim slack 6               78%        37%        +2.2
 *     miss 25% + slack 1.5      70%        31%        +1.9
 *     miss 25% + slack 3        67%        28%        +1.9
 *
 * Three findings, and two of them were not the guess:
 *
 * - **A fine spread washes out.** ±50% on every shot barely moves the verdict,
 *   because many small independent rolls average to their mean inside a single
 *   engagement. Variance has to be COARSE to survive to the outcome.
 * - **The zero matters, not just the variance.** `glance 40% at x0.3` and
 *   `miss 25%` have almost the same variance (0.327 against 0.333) and land
 *   five points apart. A shot that does nothing lets a unit at 1hp live; a
 *   shot that half-lands does not.
 * - **Aiming loosely is a difficulty change, not a variance one.** Letting a
 *   gun pick among near-equal targets costs +2.2 clear for a thin fall in
 *   DECIDED, and stacked on the winner it UNDID six points of it: spreading
 *   fire across a force averages the damage instead of concentrating it, so
 *   nobody crosses a threshold early. It was measured, it lost, and the
 *   mechanism was deleted with it.
 *
 * 25% is also an optimum rather than a floor — 30% and 40% both buy LESS
 * resolution for more drift, because past a point the battle stops being
 * uncertain and starts being long.
 *
 * The +1.1 that comes with the winner is real and is not a broken mean: it is
 * threshold asymmetry. A raid needs its heavy to reach the post, so noise in
 * the defensive fire that is trying to stop it helps the attacker slightly
 * more often than it hurts. It is absorbed in the re-tune rather than papered
 * over here.
 */

import type { Rng } from './rng';

/** The sim that never rolls: every config written before v1.23. */
export const COMBAT_NONE = 0;

/** The shipped model. New configs name this; nothing else should. */
export const COMBAT_CURRENT = 1;

export interface CombatModel {
  readonly version: number;
  /** Human-readable, for the harness tables. */
  readonly label: string;
  /**
   * Multiplier for one shot's damage. Exactly 1 in expectation.
   *
   * Applied to DISCRETE weapon fire only — never to the continuous per-tick
   * DPS of a melee assault, and once per shell rather than once per victim.
   * Many small independent rolls average away, which the table above measured
   * rather than assumed.
   */
  shot(rng: Rng): number;
}

const flat: CombatModel = {
  version: COMBAT_NONE,
  label: 'no rolls',
  shot: () => 1,
};

/**
 * Not every burst tells.
 *
 * A share `p` of fire does nothing at all; the rest is scaled by `1 / (1 - p)`
 * so a gun's expected output over a battle is exactly what its stat line says.
 * Nothing is nerfed and nothing is buffed — what changes is that a unit's
 * death is no longer a fixed number of ticks after it comes into range.
 */
const notEveryBurstTells = (version: number, p: number): CombatModel => ({
  version,
  label: `${Math.round(p * 100)}% of fire does not tell`,
  shot: (rng) => (rng() < p ? 0 : 1 / (1 - p)),
});

/**
 * The version registry. A version is frozen: a new model is a new number.
 */
export const COMBAT_MODELS: Record<number, CombatModel> = {
  [COMBAT_NONE]: flat,
  [COMBAT_CURRENT]: notEveryBurstTells(COMBAT_CURRENT, 0.25),
};

/**
 * An unknown version reads as flat rather than throwing: a save or a code
 * written by a newer build has to open on an older one, not take the vault
 * down with it.
 */
export function combatModelFor(version: number | undefined): CombatModel {
  return COMBAT_MODELS[version ?? COMBAT_NONE] ?? flat;
}
