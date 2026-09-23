import { describe, expect, it } from 'vitest';
import { buildAssault } from '../src/content/assaults';
import { missionSiege } from '../src/content/campaign';
import { campaignFor, defenseCatalogFor, enemyRosterFor, FACTION_IDS } from '../src/content/factions';
import { siegeConfig, TOWN_GRID } from '../src/meta/town';
import { cellOf, coarsenConfig } from '../src/sim/board';
import { Engine } from '../src/sim/engine';
import { createRng } from '../src/sim/rng';
import { TERRAIN_NONE } from '../src/sim/terrain';
import type { LayoutWall, SimConfig } from '../src/sim/types';
import { yardTown } from './helpers';

const W = TOWN_GRID.width; // 20
const H = TOWN_GRID.height; // 30
const at = (u: number, v: number) => u * W + v;
const catalog = defenseCatalogFor('usa');

/** A north-edge board in approach space, flat, with whatever plan it is handed. */
function board(walls: LayoutWall[] = [], structures: SimConfig['layout'] extends infer L
  ? L extends { structures: infer S } ? S : never : never = []): SimConfig {
  return {
    width: W,
    height: H,
    seed: 1,
    ccOrigin: TOWN_GRID.ccOrigin,
    spawnLane: 0,
    spawnEdge: 'north',
    layout: { walls, structures },
  };
}

/** A wall line at depth u across [v0, v1], skipping the gaps — the fixtures' own primitive. */
function line(u: number, v0: number, v1: number, gaps: number[] = []): LayoutWall[] {
  const out: LayoutWall[] = [];
  for (let v = v0; v <= v1; v++) if (!gaps.includes(v)) out.push({ cell: at(u, v), kind: 'wall' });
  return out;
}

/** The coarse row at depth U, as a string: '#' wall, '.' open. */
function row(config: SimConfig, U: number): string {
  const walls = new Set(config.layout!.walls.map((w) => w.cell));
  let s = '';
  for (let V = 0; V < config.width; V++) s += walls.has(U * config.width + V) ? '#' : '.';
  return s;
}

/** A flat siege on the town board, so the terrain refusal does not fire. */
const flatSiege = (level: number): SimConfig => ({
  ...siegeConfig(yardTown(1_800_000_000_000), 7),
  terrainVersion: TERRAIN_NONE,
  siege: { ...buildAssault(level, enemyRosterFor('usa')), startingSupplies: 0 },
});

describe('one rule for a coarser board (M34)', () => {
  it('floor(c/2) is the centre-preserving map — checked, not assumed', () => {
    for (let c = 0; c < 200; c++) {
      // `+ 0` because Math.round(-0.25) is -0, and toBe tells the two apart.
      expect(cellOf(c, 2), `c=${c}`).toBe(Math.round((c + 0.5) / 2 - 0.5) + 0);
    }
    // Symmetry about the BOARD's axis is exact: on a 20-wide line that axis
    // runs between columns 9 and 10, so a mirrored pair sums to 19, and every
    // such pair lands on a 10-wide pair summing to 9.
    for (let c = 0; c < 20; c++) {
      expect(cellOf(c, 2) + cellOf(19 - c, 2), `${c}/${19 - c}`).toBe(9);
    }
  });

  it('spawn content was authored about column 10, half a cell off the axis — and says so', () => {
    // The assault waves pair their columns about 10 (3/17, 7/13, 8/12 sum to
    // 20), which on a 20-wide line is half a cell right of the true centre. The
    // rule cannot remove a bias the content already had; what it does is
    // requantise it. Odd pairs land exactly centred and even pairs a whole
    // unit right. Pinned so the balance check's drift has a named cause.
    expect([3, 17].map((c) => cellOf(c, 2))).toEqual([1, 8]); // sum 9: centred
    expect([7, 13].map((c) => cellOf(c, 2))).toEqual([3, 6]); // sum 9: centred
    expect([8, 12].map((c) => cellOf(c, 2))).toEqual([4, 6]); // sum 10: a unit right
    expect(cellOf(10, 2)).toBe(5); // the lone "centre" column: right of 4.5
    // And the post: a 2x2 straddling the axis at columns 9-10 becomes a 1x1,
    // and a 10-wide board has no centre column to put it in.
    expect(cellOf(TOWN_GRID.ccOrigin % W, 2)).toBe(4);
  });

  it('at a factor of 1 the config is the config', () => {
    const config = flatSiege(4);
    expect(coarsenConfig(config, catalog, 1).config).toBe(config);
  });

  it('refuses what it cannot do faithfully, loudly', () => {
    expect(() => coarsenConfig(board(), catalog, 1.5)).toThrow(/whole number/);
    expect(() => coarsenConfig({ ...board(), width: 21 }, catalog, 2)).toThrow(/does not split/);
    // Terrain: the same seed on a smaller board is a different field, not a
    // coarser picture of this one.
    expect(() => coarsenConfig({ ...board(), terrainVersion: 1 }, catalog, 2)).toThrow(/terrain/);
  });

  it('the EARLY reference line keeps all three of its openings', () => {
    // Depth 20, across 1-18, centre gap at 9-10 — the edge cells 0 and 19 are
    // open too. "Any wall" would seal all three; this rule keeps them, and the
    // centre one comes out twice as wide because it straddles a block edge.
    const { config } = coarsenConfig(board(line(20, 1, 18, [9, 10])), catalog, 2);
    expect(row(config, 10)).toBe('.###..###.');
  });

  it('a solid line stays solid, and every one-thick line keeps every opening it had', () => {
    expect(row(coarsenConfig(board(line(12, 0, W - 1)), catalog, 2).config, 6)).toBe('##########');

    // Property, over hundreds of random lines: every cell that was an opening
    // in an isolated line lands on a coarse cell that is still open. A gap can
    // widen; it can never close.
    const rng = createRng(20260923);
    const pick = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
    for (let trial = 0; trial < 400; trial++) {
      const u = pick(4, H - 4);
      const gaps: number[] = [];
      for (let g = pick(1, 3); g > 0; g--) {
        const at0 = pick(0, W - 1);
        for (let k = 0; k < pick(1, 3); k++) if (at0 + k < W) gaps.push(at0 + k);
      }
      const { config } = coarsenConfig(board(line(u, 0, W - 1, gaps)), catalog, 2);
      const coarse = row(config, cellOf(u, 2));
      for (const g of gaps) {
        expect(coarse[cellOf(g, 2)], `trial ${trial}: gap ${g} in line at ${u} -> ${coarse}`).toBe('.');
      }
    }
  });

  it('is mirror-symmetric: a symmetric plan comes out symmetric', () => {
    const walls = [...line(20, 1, 18, [9, 10]), ...line(24, 1, 18, [3, 4, 15, 16])];
    const structures = [
      { cell: at(22, 8), kind: 'm2nest' },
      { cell: at(22, 11), kind: 'm2nest' },
      { cell: at(26, 4), kind: 'mortar' },
      { cell: at(26, 15), kind: 'mortar' },
    ];
    const { config } = coarsenConfig(board(walls, structures), catalog, 2);
    const w = config.width;
    const mirror = (cell: number) => Math.floor(cell / w) * w + (w - 1 - (cell % w));
    const wallSet = new Set(config.layout!.walls.map((x) => x.cell));
    for (const cell of wallSet) expect(wallSet.has(mirror(cell)), `wall ${cell}`).toBe(true);
    const guns = new Set(config.layout!.structures.map((s) => s.cell));
    for (const cell of guns) expect(guns.has(mirror(cell)), `structure ${cell}`).toBe(true);
  });

  it('two things in one cell: the first keeps it and the rest are REPORTED, never dropped quietly', () => {
    const { config, report } = coarsenConfig(
      board([], [
        { cell: at(22, 8), kind: 'm2nest' },
        { cell: at(23, 9), kind: 'autocannon' }, // the same 2x2 block as the nest
        // Just north of the post: a legal cell today, and in the one block of
        // the four the old 2x2 covered that becomes the new 1x1.
        { cell: at(26, 9), kind: 'mortar' },
        { cell: at(1, 6), kind: 'm2nest' }, // onto the entry lane once halved
      ]),
      catalog,
      2,
    );
    expect(config.layout!.structures.map((s) => s.kind)).toEqual(['m2nest']);
    expect(report.structuresDropped.map((d) => `${d.kind}:${d.why}`)).toEqual([
      'autocannon:collision',
      'mortar:post',
      'm2nest:lane',
    ]);
  });

  it('a door stays a door', () => {
    const walls = [...line(20, 0, W - 1, [9]), { cell: at(20, 9), kind: 'gate' }];
    const { config, report } = coarsenConfig(board(walls), catalog, 2);
    expect(report.gatesIn).toBe(1);
    expect(report.gatesOut).toBe(1);
    expect(config.layout!.walls.find((w) => w.kind === 'gate')!.cell).toBe(10 * config.width + 4);
  });

  it('no coordinate escapes the coarse board — the wrap-around trap', () => {
    // `grid.idx(17, row)` on a 10-wide board does not fail: it wraps to column
    // 7 of the NEXT row, an in-bounds index that means somewhere else. So every
    // point in every real config has to land inside the board it is mapped to.
    const configs: SimConfig[] = [];
    for (let level = 1; level <= 14; level++) configs.push(flatSiege(level));
    for (const faction of FACTION_IDS) {
      for (const mission of campaignFor(faction)) {
        for (const difficulty of ['standard', 'hard'] as const) {
          configs.push({ ...flatSiege(1), siege: missionSiege(mission, difficulty) });
        }
      }
    }
    for (const fine of configs) {
      const { config } = coarsenConfig(fine, catalog, 2);
      const cells = config.width * config.height;
      expect(config.ccOrigin).toBeLessThan(cells);
      for (const wv of config.siege!.waves) {
        for (const e of wv.entries) {
          if (e.col !== undefined) expect(e.col, config.siege!.name).toBeLessThan(config.width);
          if (e.row !== undefined) expect(e.row, config.siege!.name).toBeLessThan(config.height);
        }
      }
      for (const w of config.layout?.walls ?? []) expect(w.cell).toBeLessThan(cells);
      for (const s of config.layout?.structures ?? []) expect(s.cell).toBeLessThan(cells);
    }
  });

  it('the coarse battle is a battle: it spawns, fights and ends', () => {
    const fine: SimConfig = {
      ...board(
        [...line(20, 1, 18, [9, 10]), ...line(24, 1, 18, [3, 4, 15, 16])],
        [
          { cell: at(22, 8), kind: 'm2nest', level: 2 },
          { cell: at(22, 11), kind: 'm2nest', level: 2 },
          { cell: at(26, 4), kind: 'm2nest', level: 2 },
          { cell: at(28, 6), kind: 'mortar', level: 1 },
        ],
      ),
      ccLevel: 2,
      siege: { ...buildAssault(4, enemyRosterFor('usa')), startingSupplies: 0 },
    };
    const { config } = coarsenConfig(fine, catalog, 2);
    expect(config.cellSize).toBe(2);
    const e = new Engine(config, catalog);
    e.enqueue({ tick: 0, type: 'startAssault' });
    while (e.phase !== 'victory' && e.phase !== 'defeat' && e.tick < 40_000) e.step();
    expect(['victory', 'defeat']).toContain(e.phase);
    expect(e.stats.spawned).toBeGreaterThan(20);
    expect(e.stats.kills).toBeGreaterThan(0);
  });
});
