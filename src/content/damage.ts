import type { DamageTable } from '../sim/types';

/**
 * Damage-type × armor-class multipliers (GDD §5.4). Deterministic, no damage
 * RNG anywhere — soft counters come entirely from this table:
 *
 * - small arms shred infantry, tickle armor and structures
 * - kinetic (AP) is the armor answer
 * - explosive punishes crowds and structures
 * - shaped (AT) is the tank-killer: huge alpha, useless against a moving sky
 * - flak (v1.0) is the air answer, and almost nothing else — an AA mount
 *   spends a build slot on a threat that may never come
 *
 * Every AA mount deliberately outranges every aircraft in the game: a mount
 * that a drone can plink from outside its envelope is a decoration, not a
 * decision. What separates the kits is how fast they kill once the thing is
 * inside — not whether they get to shoot at all.
 *
 * The `air` column is what a weapon does to something flying. Only weapons
 * that can elevate ever get to apply it (Weapon.targets), so these numbers
 * decide how a dual-purpose gun trades, not whether a rifle can hit a
 * helicopter.
 */
export const DAMAGE_MULT: DamageTable = {
  smallArms: { none: 1.0, light: 0.6, heavy: 0.2, structure: 0.15, air: 0.3 },
  kinetic: { none: 0.8, light: 1.2, heavy: 1.0, structure: 0.5, air: 0.55 },
  explosive: { none: 1.2, light: 1.0, heavy: 0.6, structure: 1.0, air: 0.35 },
  shaped: { none: 0.5, light: 1.1, heavy: 1.4, structure: 0.8, air: 0.05 },
  flak: { none: 0.35, light: 0.25, heavy: 0.1, structure: 0.1, air: 1.4 },
};
