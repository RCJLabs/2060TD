import { describe, expect, it } from 'vitest';
import { assaultLoot, buildAssault } from '../src/content/assaults';
import { TOWN_GRID } from '../src/meta/town';
import { siegeOnBoard } from '../src/sim/board';

const kindCount = (level: number, kind: string): number =>
  buildAssault(level)
    .waves.flatMap((w) => w.entries)
    .filter((e) => e.kind === kind).length;

const totalCount = (level: number): number =>
  buildAssault(level).waves.reduce((n, w) => n + w.entries.length, 0);

describe('assault ladder generator', () => {
  it('ramps the roster in: no grenadiers at L1, no armor before L3', () => {
    expect(buildAssault(1).waves).toHaveLength(3);
    expect(kindCount(1, 'grenadier')).toBe(0);
    expect(kindCount(1, 'zbd')).toBe(0);
    expect(kindCount(1, 'type99')).toBe(0);

    expect(buildAssault(2).waves).toHaveLength(4);
    expect(kindCount(2, 'grenadier')).toBeGreaterThan(0);
    expect(kindCount(2, 'type99')).toBe(0);

    expect(buildAssault(3).waves).toHaveLength(5);
    expect(kindCount(3, 'type99')).toBe(1);
    expect(kindCount(3, 'zbd')).toBeGreaterThan(0);
  });

  it('scales up monotonically with level', () => {
    expect(totalCount(5)).toBeGreaterThan(totalCount(3));
    expect(totalCount(3)).toBeGreaterThan(totalCount(1));
    expect(kindCount(7, 'type99')).toBeGreaterThan(kindCount(3, 'type99'));
    expect(buildAssault(5).suppliesPerWave).toBeGreaterThan(buildAssault(1).suppliesPerWave);
  });

  it('is a pure function of level', () => {
    expect(buildAssault(4)).toEqual(buildAssault(4));
  });

  it('keeps wave entries on the board', () => {
    // Written against `row` until v1.40, when the board turned upright and an
    // assault started naming the COLUMN it comes down. Which axis a wave uses
    // belongs to the config's entry edge, not to this test — so what is
    // checked is the property that survives a rotation: every entry names a
    // position, and every position it names is on the board.
    //
    // Since M34 an assault is authored in physical units, so "on the board"
    // is asked of the waves the battle is given — through the same seam.
    for (const level of [1, 3, 6, 10]) {
      for (const wave of siegeOnBoard(buildAssault(level), TOWN_GRID.cellSize).waves) {
        for (const entry of wave.entries) {
          expect(entry.col ?? entry.row, 'an entry that names no position').toBeDefined();
          if (entry.col !== undefined) {
            expect(entry.col).toBeGreaterThanOrEqual(0);
            expect(entry.col).toBeLessThan(TOWN_GRID.width);
          }
          if (entry.row !== undefined) {
            expect(entry.row).toBeGreaterThanOrEqual(0);
            expect(entry.row).toBeLessThan(TOWN_GRID.height);
          }
          expect(entry.atTick).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('loot grows with level', () => {
    expect(assaultLoot(4).supplies).toBeGreaterThan(assaultLoot(1).supplies);
    expect(assaultLoot(4).fuel).toBeGreaterThan(assaultLoot(1).fuel);
  });
});
