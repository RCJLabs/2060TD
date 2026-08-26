import { describe, expect, it } from 'vitest';
import {
  AIR_BAND_CUTS,
  AIR_READ_SECTORS,
  airReadOf,
  airTransit,
  bandOf,
  chordInside,
  slowestAirSpeed,
} from '../src/meta/airread';
import { generateBase, MAP_W, USA_BASE_KIT } from '../src/content/bases';
import { baseKitFor, raidCatalogFor } from '../src/content/factions';
import type { AirReadTarget } from '../src/meta/airread';

/**
 * The air read (v1.34).
 *
 * `npm run balance -- --airread` is the measurement of record — it scores the
 * read against the measured air clear rate on all 75 dealt targets and against
 * the shape, which is what a player already gets for free. These are the cheap
 * structural guards that fail first: the geometry, the monotonicity the whole
 * reading depends on, and the fact that a gun which cannot elevate is never
 * counted.
 */

const CAT = raidCatalogFor('usa'); // USA raids the PLA, so PLA structures

/** A bare target with one gun placed where the test wants it. */
const target = (ccCol: number, ccRow: number, guns: [string, number, number][]): AirReadTarget => ({
  ccOrigin: ccRow * MAP_W + ccCol,
  structures: guns.map(([kind, col, row]) => ({ kind, cell: row * MAP_W + col, level: 1 })),
});

describe('chordInside', () => {
  it('measures the segment inside the circle, not the infinite line', () => {
    // A circle of radius 2 centred on the midpoint of a 10-long segment.
    expect(chordInside(0, 0, 10, 0, 5, 0, 2)).toBeCloseTo(4, 6);
    // Same circle, but the segment stops short of it: nothing inside.
    expect(chordInside(0, 0, 2, 0, 5, 0, 2)).toBe(0);
    // Behind the start of the segment: also nothing. This is the case that
    // matters — a mount behind the spawn edge is never flown past.
    expect(chordInside(6, 0, 10, 0, 1, 0, 2)).toBe(0);
  });

  it('is zero when the circle misses the line entirely', () => {
    expect(chordInside(0, 0, 10, 0, 5, 9, 2)).toBe(0);
  });

  it('clips at the far end, so a circle over the goal counts only what is flown', () => {
    // Circle centred on the segment's end: half of it lies past the goal.
    expect(chordInside(0, 0, 10, 0, 10, 0, 3)).toBeCloseTo(3, 6);
  });
});

describe('airTransit', () => {
  it('counts nothing when no gun can elevate', () => {
    // hmgTower is ground-only in the PLA kit; it must not price a flight.
    const flat = target(16, 12, [['hmgTower', 8, 12]]);
    expect(airTransit(flat, CAT, AIR_READ_SECTORS, 2.6)).toBe(0);
  });

  it('counts a gun that can, and more of it the closer to the run in', () => {
    const near = target(16, 12, [['aaSite', 8, 12]]);
    const far = target(16, 12, [['aaSite', 8, 2]]);
    const onTheLine = airTransit(near, CAT, ['W1'], 2.6);
    const offToTheSide = airTransit(far, CAT, ['W1'], 2.6);
    expect(onTheLine).toBeGreaterThan(0);
    expect(onTheLine).toBeGreaterThan(offToTheSide);
  });

  it('scales with the number of guns and inversely with speed', () => {
    const one = target(16, 12, [['aaSite', 8, 12]]);
    const two = target(16, 12, [
      ['aaSite', 8, 12],
      ['aaSite', 10, 12],
    ]);
    expect(airTransit(two, CAT, ['W1'], 2.6)).toBeGreaterThan(airTransit(one, CAT, ['W1'], 2.6));
    // Half the speed is twice as long inside the envelope.
    expect(airTransit(one, CAT, ['W1'], 1.3)).toBeCloseTo(
      airTransit(one, CAT, ['W1'], 2.6) * 2,
      6,
    );
  });

  it('ignores a structure that is still inert', () => {
    const live = target(16, 12, [['aaSite', 8, 12]]);
    const scaffolding: AirReadTarget = {
      ccOrigin: live.ccOrigin,
      structures: live.structures.map((s) => ({ ...s, inert: true })),
    };
    expect(airTransit(live, CAT, ['W1'], 2.6)).toBeGreaterThan(0);
    expect(airTransit(scaffolding, CAT, ['W1'], 2.6)).toBe(0);
  });

  it('is an average over sectors, so adding a safe approach lowers it', () => {
    // A mount on the western run in only. Reading W1 alone is the worst case;
    // averaging in an approach it does not cover has to come out lower.
    const west = target(16, 12, [['aaSite', 6, 12]]);
    const alone = airTransit(west, CAT, ['W1'], 2.6);
    const averaged = airTransit(west, CAT, ['W1', 'N1', 'S1'], 2.6);
    expect(alone).toBeGreaterThan(averaged);
  });

  it('degrades safely rather than dividing by zero', () => {
    const t = target(16, 12, [['aaSite', 8, 12]]);
    expect(airTransit(t, CAT, [], 2.6)).toBe(0);
    expect(airTransit(t, CAT, ['W1'], 0)).toBe(0);
  });
});

describe('bands', () => {
  it('cut where the derivation put them', () => {
    expect(bandOf(AIR_BAND_CUTS[0] - 1)).toBe('clear');
    expect(bandOf(AIR_BAND_CUTS[0])).toBe('contested');
    expect(bandOf(AIR_BAND_CUTS[1] - 1)).toBe('contested');
    expect(bandOf(AIR_BAND_CUTS[1])).toBe('heavy');
  });

  it('are monotone in transit — the whole reading depends on it', () => {
    const order = { clear: 0, contested: 1, heavy: 2 };
    let last = -1;
    for (let t = 0; t < 300; t += 3) {
      const at = order[bandOf(t)];
      expect(at).toBeGreaterThanOrEqual(last);
      last = at;
    }
  });
});

describe('slowestAirSpeed', () => {
  it('picks the slowest airframe and ignores everything on the ground', () => {
    // The reference USA air plan flies Reapers with a Ranger tail.
    expect(slowestAirSpeed(CAT, ['reaper', 'ranger', 'engineer'])).toBe(
      CAT.attackers.reaper!.speed,
    );
  });

  it('is undefined when nothing flies, so a caller cannot silently read zero', () => {
    expect(slowestAirSpeed(CAT, ['ranger', 'abrams'])).toBeUndefined();
  });
});

describe('on real generated bases', () => {
  it('reads every dealt target without throwing, and spans more than one band', () => {
    const seen = new Set<string>();
    for (let tier = 1; tier <= 5; tier++) {
      for (let slot = 0; slot < 3; slot++) {
        const base = generateBase(tier, slot, baseKitFor('usa'), undefined, 'usa');
        const read = airReadOf(base, CAT, AIR_READ_SECTORS, CAT.attackers.reaper!.speed);
        expect(read.transit).toBeGreaterThanOrEqual(0);
        expect(read.label.length).toBeGreaterThan(0);
        seen.add(read.band);
      }
    }
    // A read that returns the same word for every target has said nothing.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('is deterministic — same base, same read', () => {
    const a = generateBase(3, 1, USA_BASE_KIT, undefined, 'china');
    const b = generateBase(3, 1, USA_BASE_KIT, undefined, 'china');
    const cat = raidCatalogFor('china');
    expect(airTransit(a, cat, AIR_READ_SECTORS, 3)).toBe(airTransit(b, cat, AIR_READ_SECTORS, 3));
  });
});
