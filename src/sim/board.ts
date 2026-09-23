import { TERRAIN_NONE } from './terrain';
import type { Catalog, CellIndex, LayoutStructure, LayoutWall, SimConfig, WaveDef } from './types';

/**
 * One rule for putting content on a coarser board (M34).
 *
 * Content in this game — assault waves, generated bases, reference plans, a
 * saved town — is written in PHYSICAL coordinates, which until M34 were also
 * the cells of the only board there was. A board whose cells are `factor`
 * units wide puts physical position `p` in cell `floor(p / factor)`. That one
 * rule maps every point in a config: the Command Center, a gun, a spawn
 * column, a tunnel mouth.
 *
 * It is also the centre-preserving map, which is why it is the right one: for
 * a factor of two, `round((c + 0.5) / 2 - 0.5)` equals `floor(c / 2)` for every
 * integer `c`, and a pair mirrored about the BOARD's axis stays mirrored — on a
 * 20-wide line any pair summing to 19 lands on one summing to 9.
 *
 * What it cannot fix is a bias the content already had. The assault waves pair
 * their spawn columns about column 10 (3/17, 7/13, 8/12), which is half a cell
 * right of a 20-wide line's true centre. Mapped, the odd pairs come out exactly
 * centred and the even ones a whole unit right. And a 10-wide board has no
 * centre column at all, so the post — a 2x2 straddling the axis today — becomes
 * a 1x1 one unit left of it. All three are +-1 unit on a 20-unit line, and the
 * similarity check prices them rather than this comment guessing.
 *
 * Walls need a rule of their own, because a wall is one cell thick and a thing
 * one cell thick is half a cell thick on the coarse board. A block of
 * `factor x factor` cells becomes a wall when HALF OR MORE of it is wall. Every
 * other candidate changes what a base IS:
 *
 *  - "any wall" seals every gap that straddles a block edge. The EARLY
 *    reference base's centre gap sits at columns 9-10, exactly across one, and
 *    under this rule the base becomes a solid line — a path turned into a
 *    breach, which is a different game rather than a coarser one.
 *  - "all wall" erases every one-thick line outright, since a line never fills
 *    a block.
 *
 * Half-or-more keeps a solid line solid and never closes an opening in one,
 * and because a board whose sides divide by the factor splits into whole
 * blocks, it is exactly mirror-symmetric. What it costs is known and runs one
 * way: a gap that straddles a block edge comes out twice as wide, and a piece of
 * wall that leaves less than half a block in every block it touches disappears.
 * That is a lone cell always, and a two-cell stub whenever it straddles a block
 * edge — which is how the MID reference base's serpentine lost its stubs.
 *
 * Two things cannot share a cell, and the rule can put them there. Nothing here
 * decides silently: whatever does not fit is REPORTED, so every caller — the
 * balance harness counting what its fixtures lost, a saved town refunding what
 * the new board had no room for — has to say what it does about it.
 */

/** Which cell a physical coordinate falls in, on a board `factor` units a cell. */
export function cellOf(p: number, factor: number): number {
  return Math.floor(p / factor);
}

/** What a coarsening could not carry across. Empty means nothing was lost. */
export interface CoarsenReport {
  /** Structures with nowhere to go: another claimed the cell first, or the post, or the lane. */
  structuresDropped: { cell: CellIndex; kind: string; why: 'collision' | 'post' | 'lane' }[];
  /** Wall segments in and out. Fewer out is the rule working, not a loss. */
  wallsIn: number;
  wallsOut: number;
  /** Doors kept. A gate that did not survive as a gate is a base that changed. */
  gatesIn: number;
  gatesOut: number;
}

/**
 * Map a battle config onto a board `factor` times coarser.
 *
 * The result fights at `cellSize * factor`, so the engine scales the catalog
 * to match (`sim/scale.ts`) and the battle is the same ground drawn with bigger
 * cells. At a factor of 1 it is the config it was given, unchanged.
 *
 * Terrain is refused rather than approximated. A terrain version is a
 * generator run at the board's size, so the same seed on a 10x15 board is a
 * DIFFERENT field, not a coarser picture of the 20x30 one — and a caller who
 * got that without being told would be measuring the wrong ground. It needs a
 * terrain version of its own that is written physically, and until one exists
 * the caller has to ask for flat ground explicitly.
 */
export function coarsenConfig(
  config: SimConfig,
  catalog: Catalog,
  factor: number,
): { config: SimConfig; report: CoarsenReport } {
  const f = Math.round(factor);
  if (f !== factor || f < 1) throw new Error(`coarsenConfig: factor must be a whole number >= 1, got ${factor}`);
  const walls = config.layout?.walls ?? [];
  const isGate = (kind: string): boolean => catalog.walls[kind]?.gateCpCost !== undefined;
  if (f === 1) {
    const gates = walls.filter((w) => isGate(w.kind)).length;
    return {
      config,
      report: { structuresDropped: [], wallsIn: walls.length, wallsOut: walls.length, gatesIn: gates, gatesOut: gates },
    };
  }
  if (config.width % f !== 0 || config.height % f !== 0) {
    throw new Error(
      `coarsenConfig: a ${config.width}x${config.height} board does not split into ${f}x${f} blocks`,
    );
  }
  if ((config.terrainVersion ?? TERRAIN_NONE) !== TERRAIN_NONE) {
    throw new Error(
      'coarsenConfig: terrain cannot be coarsened — the same seed on a smaller board is a ' +
        'different field. Pass terrainVersion: TERRAIN_NONE, or wait for a physical terrain version.',
    );
  }

  const W = config.width;
  const w = W / f;
  const h = config.height / f;
  const xOf = (cell: CellIndex): number => cell % W;
  const yOf = (cell: CellIndex): number => Math.floor(cell / W);
  const map = (cell: CellIndex): CellIndex => cellOf(yOf(cell), f) * w + cellOf(xOf(cell), f);

  const north = (config.spawnEdge ?? 'west') === 'north';
  const lane = cellOf(config.spawnLane, f);
  const onLane = (cell: CellIndex): boolean =>
    (north ? Math.floor(cell / w) : cell % w) === lane;
  const post = map(config.ccOrigin);

  // ---- structures: points, first claim wins, the rest reported --------------
  const claimed = new Set<CellIndex>([post]);
  const structuresDropped: CoarsenReport['structuresDropped'] = [];
  const structures: LayoutStructure[] = [];
  for (const s of config.layout?.structures ?? []) {
    const cell = map(s.cell);
    const why = cell === post ? 'post' : onLane(cell) ? 'lane' : claimed.has(cell) ? 'collision' : null;
    if (why) {
      structuresDropped.push({ cell: s.cell, kind: s.kind, why });
      continue;
    }
    claimed.add(cell);
    structures.push({ ...s, cell });
  }

  // ---- walls: a block is wall when half or more of it is -------------------
  // Blocks are visited in index order and a block's kind is decided from its
  // own cells, so the result does not depend on the order walls were listed.
  const byBlock = new Map<CellIndex, LayoutWall[]>();
  for (const wall of walls) {
    const cell = map(wall.cell);
    const list = byBlock.get(cell);
    if (list) list.push(wall);
    else byBlock.set(cell, [wall]);
  }
  const need = (f * f) / 2;
  const outWalls: LayoutWall[] = [];
  for (const cell of [...byBlock.keys()].sort((a, b) => a - b)) {
    const inBlock = byBlock.get(cell)!;
    if (inBlock.length < need || claimed.has(cell) || onLane(cell)) continue;
    outWalls.push({ cell, kind: blockKind(inBlock, isGate) });
  }

  const siege = config.siege ? { ...config.siege, waves: config.siege.waves.map((wv) => coarsenWave(wv, f)) } : undefined;
  const coarse: SimConfig = {
    ...config,
    width: w,
    height: h,
    cellSize: (config.cellSize ?? 1) * f,
    ccOrigin: post,
    spawnLane: lane,
    ...(siege ? { siege } : {}),
    ...(config.layout ? { layout: { walls: outWalls, structures } } : {}),
    ...(config.reservedCells
      ? { reservedCells: [...new Set(config.reservedCells.map(map))].sort((a, b) => a - b) }
      : {}),
    // A wall budget is a LENGTH of wire, and a line across the coarse board is
    // a factor fewer segments. It stays a whole number, and never goes to zero
    // where it was not zero.
    ...(config.buildLimits?.walls !== undefined
      ? {
          buildLimits: {
            ...config.buildLimits,
            walls: config.buildLimits.walls > 0 ? Math.max(1, Math.round(config.buildLimits.walls / f)) : 0,
          },
        }
      : {}),
  };

  return {
    config: coarse,
    report: {
      structuresDropped,
      wallsIn: walls.length,
      wallsOut: outWalls.length,
      gatesIn: walls.filter((wl) => isGate(wl.kind)).length,
      gatesOut: outWalls.filter((wl) => isGate(wl.kind)).length,
    },
  };
}

/**
 * The kind a coarse wall takes from the walls in its block.
 *
 * A gate wins outright: it is a door, the one feature of a wall line a player
 * operates, and a base that lost its door is a base that changed. Otherwise the
 * most common kind, ties to whichever of them appears first — which is stable,
 * because the block's walls are in the order the plan listed them.
 */
function blockKind(walls: LayoutWall[], isGate: (kind: string) => boolean): string {
  const gate = walls.find((wl) => isGate(wl.kind));
  if (gate) return gate.kind;
  const counts = new Map<string, number>();
  for (const wl of walls) counts.set(wl.kind, (counts.get(wl.kind) ?? 0) + 1);
  let best = walls[0]!.kind;
  for (const wl of walls) if (counts.get(wl.kind)! > counts.get(best)!) best = wl.kind;
  return best;
}

/**
 * An authored siege on a board of `cellSize` (M34).
 *
 * Waves are written in PHYSICAL positions — the column an arrival enters at on
 * the 20-unit entry line, the row a tunnel surfaces on — the way the catalog
 * is written in physical units. The board maps them by the one rule, so the
 * hundreds of authored arrivals across the campaign never had to be rewritten
 * and cannot drift from each other. A cell of one returns the siege it was
 * handed.
 */
export function siegeOnBoard<T extends { waves: WaveDef[] }>(siege: T, cellSize: number): T {
  if (cellSize === 1) return siege;
  if (!Number.isInteger(cellSize) || cellSize < 1) {
    throw new Error(`an authored siege maps onto a board of whole cells, not ${cellSize}`);
  }
  return { ...siege, waves: siege.waves.map((w) => coarsenWave(w, cellSize)) };
}

/** A physical point on a board of `cellSize`, by the one rule. */
export function onBoard(p: number, cellSize: number): number {
  return cellOf(p, cellSize);
}

function coarsenWave(wave: WaveDef, f: number): WaveDef {
  return {
    ...wave,
    entries: wave.entries.map((e) => ({
      ...e,
      ...(e.col !== undefined ? { col: cellOf(e.col, f) } : {}),
      ...(e.row !== undefined ? { row: cellOf(e.row, f) } : {}),
    })),
  };
}

/**
 * The inverse of `coarsenConfig`: put a coarse config back on a board `factor`
 * times finer, at a cell size `factor` times smaller.
 *
 * This is an INSTRUMENT, not a content path, and it exists to split one
 * question into two. When a mapped base plays differently on the coarse board,
 * the drift has two possible sources — what the mapping did to the PLAN (a stub
 * that vanished, a gun that lost its cell, a post that moved) and what the
 * coarser GRID does to the battle (coarser paths, a smaller post, scaled
 * physics). Refining the coarse plan keeps its shape exactly and hands it back
 * to the fine grid, so:
 *
 *   fine -> refined    is what the mapping did,
 *   refined -> coarse  is what the grid did,
 *
 * one variable each. A coarse cell becomes a whole block: a wall is a solid
 * `factor x factor` wall, the post fills its block because it is 2x2 again at
 * the finer cell size, and a one-cell thing sits in the block's top-left
 * corner, half a cell from the block's centre — the one place this is not
 * exact. `coarsenConfig(refineConfig(c))` is `c`, which the tests hold.
 */
export function refineConfig(config: SimConfig, factor: number): SimConfig {
  const f = Math.round(factor);
  if (f !== factor || f < 1) throw new Error(`refineConfig: factor must be a whole number >= 1, got ${factor}`);
  if (f === 1) return config;
  const cellSize = (config.cellSize ?? 1) / f;
  if (cellSize < 1 || cellSize !== Math.round(cellSize)) {
    throw new Error(`refineConfig: a board at cell size ${config.cellSize ?? 1} cannot be refined ${f}x`);
  }
  const w = config.width;
  const W = w * f;
  const origin = (cell: CellIndex): CellIndex => Math.floor(cell / w) * f * W + (cell % w) * f;
  const block = (cell: CellIndex): CellIndex[] => {
    const o = origin(cell);
    const out: CellIndex[] = [];
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) out.push(o + dy * W + dx);
    return out;
  };
  // Back at cell size 1 the field is left off entirely, the way every config
  // written before M34 has it, rather than set to a 1 nothing else ever carried.
  const rest: SimConfig = { ...config };
  delete rest.cellSize;
  return {
    ...rest,
    ...(cellSize === 1 ? {} : { cellSize }),
    width: W,
    height: config.height * f,
    ccOrigin: origin(config.ccOrigin),
    spawnLane: config.spawnLane * f,
    ...(config.siege
      ? {
          siege: {
            ...config.siege,
            waves: config.siege.waves.map((wv) => ({
              ...wv,
              entries: wv.entries.map((e) => ({
                ...e,
                ...(e.col !== undefined ? { col: e.col * f } : {}),
                ...(e.row !== undefined ? { row: e.row * f } : {}),
              })),
            })),
          },
        }
      : {}),
    ...(config.layout
      ? {
          layout: {
            walls: config.layout.walls.flatMap((wl) => block(wl.cell).map((cell) => ({ ...wl, cell }))),
            structures: config.layout.structures.map((st) => ({ ...st, cell: origin(st.cell) })),
          },
        }
      : {}),
    ...(config.reservedCells ? { reservedCells: config.reservedCells.flatMap(block) } : {}),
    ...(config.buildLimits?.walls !== undefined
      ? { buildLimits: { ...config.buildLimits, walls: config.buildLimits.walls * f } }
      : {}),
  };
}
