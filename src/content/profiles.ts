import type { RunnerProfile, TurretProfile } from '../sim/types';

/**
 * M0 playground content. Numbers are provisional (see GDD §8) but chosen so
 * the maze rule reads clearly on screen:
 *
 * - Wall = 150 HP.
 * - WALKER chews at 3 dps → 50s per wall: detours whenever one exists, but a
 *   fully enclosed base is still eventually breached (no invincible turtling).
 * - BREACHER chews at 45 dps → ~3.3s per wall: goes through whenever the
 *   detour would cost more than a few seconds. The counter to mazing.
 */

export const WALL_HP = 150;

export const WALKER: RunnerProfile = {
  kind: 'walker',
  maxHp: 40,
  speed: 2.2,
  wallDps: 3,
  speedJitter: 0.06,
};

export const BREACHER: RunnerProfile = {
  kind: 'breacher',
  maxHp: 70,
  speed: 1.6,
  wallDps: 45,
  speedJitter: 0.06,
};

/** ~22.5 dps: kills a walker in ~1.8s of sustained fire, a breacher in ~3.1s. */
export const MG_TURRET: TurretProfile = {
  kind: 'mg',
  range: 4.5,
  damage: 9,
  shotsPerSecond: 2.5,
};
