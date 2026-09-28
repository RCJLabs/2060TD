import { describe, expect, it } from 'vitest';
import {
  buildAssault,
  CHINA_ASSAULT_ROSTER,
  LADDER,
  MODIFIERS,
  probeAssault,
  USA_ASSAULT_ROSTER,
  waveModifierOf,
  type WaveModifier,
} from '../src/content/assaults';
import type { SiegeDef, WaveDef } from '../src/sim/types';

/**
 * Composed assaults (M35 Phase 1): the enemy plans each wave of the ladder's
 * script from the battle's seed. The same units come in the same waves, and
 * what changes is the lane, the purpose, the timing and the modifier.
 */

const SEEDS = Array.from({ length: 24 }, (_, i) => 1_000 + i * 7_919);

/** Each kind's count in a wave. */
const kinds = (wave: WaveDef): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const e of wave.entries) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
};

/** A plan's shape, for telling two plans apart. */
const shape = (def: SiegeDef): string =>
  JSON.stringify(
    def.waves.map((w) => [
      w.entries.map((e) => `${e.kind}:${e.col}:${e.doctrine ?? 'assault'}`).sort(),
      waveModifierOf(w) ?? '',
    ]),
  );

describe('a composed assault', () => {
  it('is a pure function of level, roster and seed', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      expect(buildAssault(8, CHINA_ASSAULT_ROSTER, LADDER, seed)).toEqual(
        buildAssault(8, CHINA_ASSAULT_ROSTER, LADDER, seed),
      );
    }
  });

  it("is today's script without a seed", () => {
    // The tests above this file and the balance tool's baseline read this.
    const classic = buildAssault(6);
    expect(classic.waves.every((w) => w.entries.every((e) => e.doctrine === undefined))).toBe(true);
    expect(classic.waves.every((w) => w.mods === undefined)).toBe(true);
  });

  it('fields the same units in the same waves, bar what a modifier trades', () => {
    for (const level of [1, 2, 3, 4, 6, 9, 12]) {
      const classic = buildAssault(level, USA_ASSAULT_ROSTER);
      for (const seed of SEEDS) {
        const composed = buildAssault(level, USA_ASSAULT_ROSTER, LADDER, seed);
        expect(composed.waves.length, `level ${level}`).toBe(classic.waves.length);
        composed.waves.forEach((wave, i) => {
          const want = kinds(classic.waves[i]!);
          const got = kinds(wave);
          expect(Object.keys(got).sort(), `level ${level} wave ${i + 1}`).toEqual(Object.keys(want).sort());
          const modifier = waveModifierOf(wave);
          if (!modifier) {
            expect(got, `level ${level} wave ${i + 1} seed ${seed}`).toEqual(want);
            return;
          }
          // A modified wave is thinned (or kept) by the modifier's count, kind by
          // kind, and never loses a kind altogether.
          for (const [kind, n] of Object.entries(want)) {
            expect(got[kind], `${modifier} ${kind}`).toBeGreaterThanOrEqual(1);
            expect(got[kind], `${modifier} ${kind}`).toBeLessThanOrEqual(Math.max(1, Math.ceil(n * MODIFIERS[modifier].count)));
          }
        });
        expect(composed.startingCp).toBe(classic.startingCp);
        expect(composed.suppliesPerWave).toBe(classic.suppliesPerWave);
      }
    }
  });

  it('draws a different plan on nearly every seed', () => {
    const plans = new Set(SEEDS.map((seed) => shape(buildAssault(8, CHINA_ASSAULT_ROSTER, LADDER, seed))));
    expect(plans.size).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });

  it('opens with a probe for the post, and nothing modifies the first wave', () => {
    for (const seed of SEEDS) {
      const first = buildAssault(10, CHINA_ASSAULT_ROSTER, LADDER, seed).waves[0]!;
      expect(first.entries.every((e) => (e.doctrine ?? 'assault') === 'assault')).toBe(true);
      expect(waveModifierOf(first)).toBeUndefined();
    }
  });

  it('sends every purpose, down every lane, and some waves go for the guns or the economy', () => {
    const doctrines = new Set<string>();
    const cols = new Set<number>();
    for (const seed of SEEDS) {
      for (const wave of buildAssault(9, CHINA_ASSAULT_ROSTER, LADDER, seed).waves) {
        for (const e of wave.entries) {
          doctrines.add(e.doctrine ?? 'assault');
          cols.add(e.col!);
        }
      }
    }
    expect([...doctrines].sort()).toEqual(['assault', 'hunt', 'raze']);
    // The entry line is 20 physical cells; the three lanes each get used.
    expect([...cols].some((c) => c <= 6)).toBe(true);
    expect([...cols].some((c) => c >= 8 && c <= 12)).toBe(true);
    expect([...cols].some((c) => c >= 14)).toBe(true);
    expect([...cols].every((c) => c >= 1 && c <= 18)).toBe(true);
  });

  it('keeps a wave to one purpose, so the read can say what it is for', () => {
    for (const seed of SEEDS) {
      for (const wave of buildAssault(9, CHINA_ASSAULT_ROSTER, LADDER, seed).waves) {
        expect(new Set(wave.entries.map((e) => e.doctrine ?? 'assault')).size).toBe(1);
      }
    }
  });

  it('holds its modifiers back until level 3, and gives a wave one at most', () => {
    const seen = new Set<WaveModifier>();
    for (const seed of SEEDS) {
      for (const level of [1, 2]) {
        for (const wave of buildAssault(level, CHINA_ASSAULT_ROSTER, LADDER, seed).waves) {
          expect(waveModifierOf(wave), `level ${level}`).toBeUndefined();
        }
      }
      for (const level of [3, 6, 9, 12]) {
        for (const wave of buildAssault(level, CHINA_ASSAULT_ROSTER, LADDER, seed).waves) {
          const m = waveModifierOf(wave);
          if (m) seen.add(m);
          const mods = wave.mods ?? {};
          const vets = wave.entries.some((e) => (e.vet ?? 1) > 1);
          const count = [mods.range !== undefined, mods.jammed === true, mods.speed !== undefined, vets].filter(Boolean).length;
          expect(count).toBeLessThanOrEqual(1);
        }
      }
    }
    expect([...seen].sort()).toEqual(['fast', 'jammed', 'night', 'veterans']);
  });

  it('carries each modifier as the sim reads it', () => {
    expect(MODIFIERS.night.mods?.range).toBeLessThan(1);
    expect(MODIFIERS.jammed.mods?.jammed).toBe(true);
    expect(MODIFIERS.fast.mods?.speed).toBeGreaterThan(1);
    expect(MODIFIERS.fast.mods?.hp).toBeLessThan(1);
    expect(MODIFIERS.veterans.vet).toBeGreaterThan(1);
    expect(MODIFIERS.veterans.count).toBeLessThan(1);
    for (const m of Object.values(MODIFIERS)) {
      for (const v of [m.count, m.vet ?? 1, m.mods?.range ?? 1, m.mods?.speed ?? 1, m.mods?.hp ?? 1]) {
        expect(Math.round(v * 1000) / 1000).toBe(v);
      }
    }
  });

  it('makes a probe of the composed assault’s first two waves', () => {
    for (const seed of SEEDS.slice(0, 6)) {
      const probe = probeAssault(5, CHINA_ASSAULT_ROSTER, seed);
      const whole = buildAssault(5, CHINA_ASSAULT_ROSTER, LADDER, seed);
      expect(probe.waves).toEqual(whole.waves.slice(0, 2));
      expect(probe.startingCp).toBe(0);
    }
    expect(probeAssault(5, CHINA_ASSAULT_ROSTER).waves).toEqual(buildAssault(5).waves.slice(0, 2));
  });
});
