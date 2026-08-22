/**
 * Deterministic seeded PRNG (mulberry32).
 *
 * All gameplay randomness must flow through an instance of this — never
 * Math.random() — so that a (seed, command list) pair always reproduces the
 * exact same battle. Uses only integer ops + one exact division, so results
 * are identical across JS engines.
 */

export type Rng = () => number;

/** Returns a function producing floats in [0, 1). */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform float in [min, max). */
export function rollRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}
