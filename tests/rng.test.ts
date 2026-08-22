import { describe, expect, it } from 'vitest';
import { createRng, rollRange } from '../src/sim/rng';

describe('seeded PRNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 10_000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('rollRange stays within bounds and is deterministic', () => {
    const a = createRng(7);
    const b = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const va = rollRange(a, -0.06, 0.06);
      expect(va).toBe(rollRange(b, -0.06, 0.06));
      expect(Math.abs(va)).toBeLessThanOrEqual(0.06);
    }
  });
});
