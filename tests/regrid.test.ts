import { describe, expect, it } from 'vitest';
import { decodeBase } from '../src/meta/sharecode';
import { deserialize } from '../src/meta/save';
import { LEGACY_GRID, regridCell, regridTown, V1_GRID } from '../src/meta/regrid';
import { newTown, onSpawnLane, TOWN_GRID, footprintCells } from '../src/meta/town';
import type { PlacedStructure, TownState } from '../src/meta/town';
import { defenseCatalogFor } from '../src/content/factions';

/**
 * Carrying a war across the turn of the board (v1.40).
 *
 * Every other migration this game has done added a field. This one reinterprets
 * every cell index a player has ever written down, which is a different kind of
 * risk: left alone a base does not shift, it scrambles, because the row stride
 * changed underneath it. Worse, it scrambles QUIETLY — the save still loads,
 * the buildings are still there, and the base is simply wrong.
 */

const T0 = 1_700_000_000_000;
const oldIdx = (x: number, y: number): number => y * LEGACY_GRID.width + x;
const xOf = (cell: number): number => cell % TOWN_GRID.width;
const yOf = (cell: number): number => Math.floor(cell / TOWN_GRID.width);
/** Where a cell is on the 20x30 board the v1.40 move landed on. */
const v1x = (cell: number): number => cell % V1_GRID.width;
const v1y = (cell: number): number => Math.floor(cell / V1_GRID.width);

/**
 * A save as v1.39 wrote one: the post at (27, 11), a wall line two cells in
 * front of it with a gap, guns behind the line, and stores back in the yard.
 */
function legacySave(): string {
  const town = newTown(T0, 'usa') as TownState & { gridVersion?: number };
  delete town.gridVersion; // no save before v1.40 wrote it
  delete town.terrainSeed;
  town.structures = [
    { id: 1, kind: 'cc', cell: LEGACY_GRID.ccOrigin, level: 2, wrecked: false },
    { id: 2, kind: 'm2nest', cell: oldIdx(25, 9), level: 1, wrecked: false },
    { id: 3, kind: 'm2nest', cell: oldIdx(25, 13), level: 1, wrecked: false },
    { id: 4, kind: 'autocannon', cell: oldIdx(26, 11), level: 2, wrecked: false },
    { id: 5, kind: 'supplyDepot', cell: oldIdx(22, 18), level: 1, wrecked: false },
    // The far corner of the old board, which the new one does not have.
    { id: 6, kind: 'fuelDump', cell: oldIdx(30, 22), level: 1, wrecked: false },
  ];
  town.walls = [];
  for (let y = 6; y <= 16; y++) {
    if (y !== 11) town.walls.push({ cell: oldIdx(24, y), kind: 'wall' });
  }
  town.nextId = 7;
  return JSON.stringify({ schema: 6, savedAt: T0, town });
}

const loaded = (): TownState => {
  const town = deserialize(legacySave());
  expect(town).not.toBeNull();
  return town!;
};

/** The legacy save's town taken through the v1.40 move ALONE, onto 20x30. */
const turned = (): { structures: PlacedStructure[]; walls: { cell: number; kind: string }[] } => {
  const town = JSON.parse(legacySave()).town as TownState;
  const target = { structures: town.structures, walls: town.walls };
  regridTown(target, 0, () => true, Infinity, 1);
  return target;
};

describe('a saved town rotates rather than scrambles', () => {
  it('lands every cell on the board, off the entry lane, with nothing overlapping', () => {
    const town = loaded();
    const seen = new Set<number>();
    const cells = [
      ...town.structures.flatMap((s) => footprintCells(s.kind, s.cell)),
      ...town.walls.map((w) => w.cell),
    ];
    // Six buildings and what is left of the line. After both moves the line's
    // middle is under the two guns that stood behind it on 32x24 — a gun and
    // a wall cannot share a two-unit cell — so most of it is refunded, and
    // the migration tests below M34's say what the refund is.
    expect(town.structures).toHaveLength(6);
    expect(town.walls.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(TOWN_GRID.width * TOWN_GRID.height);
      expect(onSpawnLane(cell), `cell ${cell} on the entry lane`).toBe(false);
      expect(seen.has(cell), `cell ${cell} claimed twice`).toBe(false);
      seen.add(cell);
    }
  });

  it('puts the command post where the new board keeps it', () => {
    const town = loaded();
    const cc = town.structures.find((s) => s.kind === 'cc');
    expect(cc?.cell).toBe(TOWN_GRID.ccOrigin);
    expect(cc?.level).toBe(2); // and does not quietly reset what it was
  });

  it('keeps every building the same distance from the post, turned a quarter', () => {
    // This is the whole argument for a transpose over anything cleverer. A gun
    // three cells in FRONT of the post — three cells towards the old western
    // entry — must end up three cells in front of it on the new board, which
    // is three cells north. A base that funnelled attackers into a crossfire
    // still funnels them into it. Checked on the 20x30 board this move landed
    // on; M34's move after it is pinned below.
    const town = turned();
    const cc = town.structures.find((s) => s.kind === 'cc')!;
    const pairs: [number, string][] = [
      [oldIdx(25, 9), 'm2nest'],
      [oldIdx(25, 13), 'm2nest'],
      [oldIdx(26, 11), 'autocannon'],
      [oldIdx(22, 18), 'supplyDepot'],
    ];
    for (const [was, kind] of pairs) {
      const oldDX = (was % LEGACY_GRID.width) - (LEGACY_GRID.ccOrigin % LEGACY_GRID.width);
      const oldDY =
        Math.floor(was / LEGACY_GRID.width) - Math.floor(LEGACY_GRID.ccOrigin / LEGACY_GRID.width);
      const now = town.structures.find((s) => s.cell === regridCell(was));
      expect(now, `${kind} at ${was} went missing`).toBeDefined();
      // Depth becomes depth, across becomes across: (dx, dy) -> (dy, dx).
      expect(v1x(now!.cell) - v1x(cc.cell)).toBe(oldDY);
      expect(v1y(now!.cell) - v1y(cc.cell)).toBe(oldDX);
    }
  });

  it('walks a building off the vanished corner instead of destroying it', () => {
    // (30, 22) is outside the 20x30 board however you rotate it. The player
    // paid for that dump; it gets a cell, not a refund it never asked for.
    const town = turned();
    expect(regridCell(oldIdx(30, 22))).toBeNull();
    const dump = town.structures.find((s) => s.kind === 'fuelDump');
    expect(dump).toBeDefined();
    expect(town.structures).toHaveLength(6);
    expect(town.walls).toHaveLength(10);
    // And it lands DEEP, in the corner furthest from the attack — where it
    // was. The first draft of the walk fell back to cell 0 when the transpose
    // had no answer, which put a fuel dump on the enemy's doorstep: still
    // present, still counted, and a gift.
    expect(v1y(dump!.cell)).toBeGreaterThan(v1y(V1_GRID.ccOrigin));
    // And it is still there, and still deep, after the second move too.
    const now = loaded();
    const still = now.structures.find((s) => s.kind === 'fuelDump');
    expect(now.structures).toHaveLength(6);
    expect(yOf(still!.cell)).toBeGreaterThanOrEqual(yOf(TOWN_GRID.ccOrigin));
  });

  it('migrates the same save the same way every time', () => {
    const a = loaded();
    const b = loaded();
    expect(a.structures.map((s) => `${s.kind}@${s.cell}`)).toEqual(
      b.structures.map((s) => `${s.kind}@${s.cell}`),
    );
    expect(a.walls.map((w) => w.cell)).toEqual(b.walls.map((w) => w.cell));
  });

  it('stamps the board it landed on, and leaves an already-current save alone', () => {
    const once = loaded();
    expect(once.gridVersion).toBe(TOWN_GRID.version);
    const twice = deserialize(JSON.stringify({ schema: 6, savedAt: T0, town: once }))!;
    expect(twice.structures.map((s) => s.cell)).toEqual(once.structures.map((s) => s.cell));
    expect(twice.walls.map((w) => w.cell)).toEqual(once.walls.map((w) => w.cell));
  });

  it('leaves the moved base on dry ground', () => {
    // The ground is fitted around whatever is standing, and the migration runs
    // FIRST for exactly this reason: fitting the river to the old coordinates
    // and then moving the base out from under it would drown buildings.
    const town = loaded();
    expect(town.terrainSeed).toBeGreaterThan(0);
  });
});

describe('a share code written before the turn', () => {
  /** Produced by a v1.39 build, not by this one. */
  const V139_CODE = 'AQAB-wIHQVJDSElWRQQKuQIBCrkDAQv6AgEClgUBAQEK2AEgICAgQCAgICC1vNPBDR3c';

  it('decodes onto the new board rather than being refused', () => {
    const out = decodeBase(V139_CODE);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.base.name).toBe('ARCHIVE');
    expect(out.base.ccOrigin).toBe(TOWN_GRID.ccOrigin);
    expect(out.base.structures).toHaveLength(4);
    // Ten segments of one line on 32x24, turned onto 20x30 and halved onto
    // 10x15: a line of two-unit cells, fewer of them, still a line.
    expect(out.base.walls.length).toBeGreaterThan(0);
    expect(out.base.walls.length).toBeLessThan(10);
    const cells = [
      out.base.ccOrigin,
      ...out.base.structures.map((s) => s.cell),
      ...out.base.walls.map((w) => w.cell),
    ];
    for (const cell of cells) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(TOWN_GRID.width * TOWN_GRID.height);
    }
  });

  it('and gives both players the same ground for it', () => {
    // The old code named a seed for a board that no longer exists, so the
    // seed is dropped and re-derived from the layout — the same rule a
    // pre-v1.19 code has always used, and the reason two players pasting the
    // same string still fight the same sheet.
    const a = decodeBase(V139_CODE);
    const b = decodeBase(V139_CODE);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.base.terrainSeed).toBe(b.base.terrainSeed);
    expect(a.base.terrainSeed).toBeGreaterThan(0);
  });
});

describe('a 20x30 town moves onto 10x15 by the one rule (M34)', () => {
  const at1 = (u: number, v: number): number => u * V1_GRID.width + v;
  const at2 = (u: number, v: number): number => u * TOWN_GRID.width + v;

  /**
   * A save as v1.44 wrote one: the post at (9, 27), a wall line across the
   * approach with a gap over the post, guns behind it, stores behind them.
   */
  function v1Save(wallRows: number[] = [19]): string {
    const town = newTown(T0, 'usa') as TownState;
    town.gridVersion = 1;
    delete town.terrainSeed;
    town.supplies = 100;
    town.structures = [
      { id: 1, kind: 'cc', cell: V1_GRID.ccOrigin, level: 1, wrecked: false },
      { id: 2, kind: 'm2nest', cell: at1(21, 7), level: 1, wrecked: false },
      { id: 3, kind: 'm2nest', cell: at1(21, 12), level: 1, wrecked: false },
      { id: 4, kind: 'supplyDepot', cell: at1(24, 4), level: 1, wrecked: false },
      // Two 2x2 stores side by side: at two units a cell both want the same one.
      { id: 5, kind: 'supplyDepot', cell: at1(24, 14), level: 1, wrecked: false },
      { id: 6, kind: 'fuelDepot', cell: at1(25, 15), level: 1, wrecked: false },
    ];
    town.walls = [];
    for (const u of wallRows) {
      for (let v = 1; v <= 18; v++) if (v < 8 || v > 11) town.walls.push({ cell: at1(u, v), kind: 'wall' });
    }
    town.nextId = 7;
    return JSON.stringify({ schema: 6, savedAt: T0, town });
  }

  const load = (rows?: number[]): TownState => {
    const town = deserialize(v1Save(rows));
    expect(town).not.toBeNull();
    return town!;
  };

  it('lands every cell on the board, off the entry lane, with nothing overlapping', () => {
    const town = load();
    expect(town.gridVersion).toBe(TOWN_GRID.version);
    const seen = new Set<number>();
    for (const cell of [
      ...town.structures.flatMap((s) => footprintCells(s.kind, s.cell)),
      ...town.walls.map((w) => w.cell),
    ]) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(TOWN_GRID.width * TOWN_GRID.height);
      expect(onSpawnLane(cell), `cell ${cell} on the entry lane`).toBe(false);
      expect(seen.has(cell), `cell ${cell} claimed twice`).toBe(false);
      seen.add(cell);
    }
    expect(town.structures.find((s) => s.kind === 'cc')!.cell).toBe(TOWN_GRID.ccOrigin);
  });

  it('puts every building at floor(p / 2), and walks the one that collided', () => {
    const town = load();
    const cellOf = (id: number): number => town.structures.find((s) => s.id === id)!.cell;
    expect(cellOf(2)).toBe(at2(10, 3));
    expect(cellOf(3)).toBe(at2(10, 6));
    expect(cellOf(4)).toBe(at2(12, 2));
    expect(cellOf(5)).toBe(at2(12, 7));
    // (25, 15) wants (12, 7) too, which the depot at (24, 14) took first.
    expect(cellOf(6)).not.toBe(at2(12, 7));
    expect(town.structures).toHaveLength(6);
  });

  it('keeps a wall line a line with its gap, and pays back what it merged', () => {
    const town = load();
    const row9 = town.walls.filter((w) => yOf(w.cell) === 9).map((w) => xOf(w.cell)).sort((a, b) => a - b);
    // Columns 1-7 and 12-18 of 20x30 are 1-3 and 6-8 here; the gap over the
    // post, 8-11, is 4-5 — two units wider, never closed.
    expect(row9).toEqual([1, 2, 3, 6, 7, 8]);
    // Fourteen segments went in and six came out: eight are refunded at cost.
    const cost = defenseCatalogFor('usa').walls['wall']!.supplyCost!;
    expect(town.supplies).toBe(100 + 8 * cost);
  });

  it('refunds walls past the smaller budget, the ones furthest from the post first', () => {
    // Six lines of fourteen at CC1: 84 segments, a budget of 50 on 20x30. On
    // 10x15 they are six lines of six, and CC1 allows 25.
    const town = load([3, 5, 7, 9, 11, 19]);
    expect(town.walls.length).toBe(25);
    // The line nearest the post is whole; what was cut came off the far rows.
    const near = town.walls.filter((w) => yOf(w.cell) === 9);
    expect(near).toHaveLength(6);
  });

  it('migrates the same save the same way every time', () => {
    const a = load();
    const b = load();
    expect(a.structures.map((s) => `${s.kind}@${s.cell}`)).toEqual(
      b.structures.map((s) => `${s.kind}@${s.cell}`),
    );
    expect(a.walls.map((w) => w.cell)).toEqual(b.walls.map((w) => w.cell));
    expect(a.supplies).toBe(b.supplies);
  });
});
