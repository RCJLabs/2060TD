import type { DamageTable } from '../sim/types';

/**
 * Damage-type × armor-class multipliers (GDD §5.4). Deterministic, no damage
 * RNG anywhere — soft counters come entirely from this table:
 *
 * - small arms shred infantry, tickle armor and structures
 * - kinetic (AP) is the armor answer
 * - explosive punishes crowds and structures
 * - shaped (AT) exists for later TOW/HJ-8 content
 */
export const DAMAGE_MULT: DamageTable = {
  smallArms: { none: 1.0, light: 0.6, heavy: 0.2, structure: 0.15 },
  kinetic: { none: 0.8, light: 1.2, heavy: 1.0, structure: 0.5 },
  explosive: { none: 1.2, light: 1.0, heavy: 0.6, structure: 1.0 },
  shaped: { none: 0.5, light: 1.1, heavy: 1.4, structure: 0.8 },
};
