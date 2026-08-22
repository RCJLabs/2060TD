import { describe, expect, it } from 'vitest';
import { DAMAGE_MULT } from '../src/content/damage';
import type { ArmorClass, DamageType } from '../src/sim/types';

const TYPES: DamageType[] = ['smallArms', 'kinetic', 'explosive', 'shaped'];
const ARMORS: ArmorClass[] = ['none', 'light', 'heavy', 'structure'];

describe('damage table', () => {
  it('is complete and strictly positive (soft counters, never immunity)', () => {
    for (const type of TYPES) {
      for (const armor of ARMORS) {
        const mult = DAMAGE_MULT[type][armor];
        expect(mult).toBeGreaterThan(0);
        expect(mult).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it('encodes the intended counters', () => {
    // Small arms: infantry shredder, armor tickler.
    expect(DAMAGE_MULT.smallArms.none).toBeGreaterThan(DAMAGE_MULT.smallArms.light);
    expect(DAMAGE_MULT.smallArms.light).toBeGreaterThan(DAMAGE_MULT.smallArms.heavy);
    // Kinetic is the armor answer.
    expect(DAMAGE_MULT.kinetic.heavy).toBeGreaterThan(DAMAGE_MULT.smallArms.heavy);
    // Explosive punishes crowds and structures.
    expect(DAMAGE_MULT.explosive.none).toBeGreaterThanOrEqual(1);
    expect(DAMAGE_MULT.explosive.structure).toBeGreaterThan(DAMAGE_MULT.kinetic.structure);
    // Shaped charges exist to kill tanks.
    expect(DAMAGE_MULT.shaped.heavy).toBeGreaterThan(DAMAGE_MULT.shaped.none);
  });
});
