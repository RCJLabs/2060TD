import { describe, expect, it } from 'vitest';
import { Grid } from '../src/sim/grid';
import { findPath } from '../src/sim/pathfinding';

const WALL_HP = 150;
const WALKER = { speed: 2.2, wallDps: 3 }; // ~50s per wall: detours if at all possible
const BREACHER = { speed: 1.6, wallDps: 45 }; // ~3.3s per wall: happily goes through
const NO_BREAK = { speed: 2.0, wallDps: 0 }; // obstacles are impassable

/** 21×11 grid, start mid-left, goal mid-right. */
function openField() {
  const grid = new Grid(21, 11);
  return { grid, start: grid.idx(0, 5), goal: grid.idx(20, 5) };
}

/** Adds a full-height vertical wall at x=10, optionally leaving a gap at y=gapY. */
function wallLine(grid: Grid, gapY: number | null) {
  for (let y = 0; y < grid.height; y++) {
    if (y === gapY) continue;
    grid.placeWall(grid.idx(10, y), WALL_HP);
  }
}

const wallCellsIn = (grid: Grid, cells: number[]) => cells.filter((c) => grid.wallAt(c) !== undefined);

describe('weighted A* — the maze rule', () => {
  it('walks a straight line across open ground at the exact expected cost', () => {
    const { grid, start, goal } = openField();
    const path = findPath(grid, start, goal, { speed: 2, wallDps: 0 });
    expect(path).not.toBeNull();
    expect(path!.cells.length).toBe(21);
    expect(path!.cells[0]).toBe(start);
    expect(path!.cells.at(-1)).toBe(goal);
    expect(path!.cost).toBeCloseTo(20 / 2, 10);
  });

  it('routes a walker through the gap instead of through walls (mazing works)', () => {
    const { grid, start, goal } = openField();
    wallLine(grid, 0); // gap at the top: a real but costly detour
    const path = findPath(grid, start, goal, WALKER);
    expect(path).not.toBeNull();
    expect(wallCellsIn(grid, path!.cells)).toHaveLength(0);
    expect(path!.cells).toContain(grid.idx(10, 0)); // went through the gap
  });

  it('routes a breacher straight through the wall when breaking is cheaper', () => {
    const { grid, start, goal } = openField();
    wallLine(grid, 0);
    // Detour costs ~10 extra steps (6.25s at speed 1.6); breaking costs ~3.3s.
    const path = findPath(grid, start, goal, BREACHER);
    expect(path).not.toBeNull();
    expect(wallCellsIn(grid, path!.cells)).toHaveLength(1);
    expect(path!.cells).toContain(grid.idx(10, 5)); // straight through the middle
  });

  it('lets even a reluctant wall-chewer escape full enclosure (no invincible turtling)', () => {
    const { grid, start, goal } = openField();
    wallLine(grid, null); // no gap at all
    const path = findPath(grid, start, goal, WALKER);
    expect(path).not.toBeNull();
    expect(wallCellsIn(grid, path!.cells)).toHaveLength(1);
    expect(path!.cost).toBeGreaterThan(WALL_HP / WALKER.wallDps);
  });

  it('returns null when a unit that cannot break walls is fully sealed off', () => {
    const { grid, start, goal } = openField();
    wallLine(grid, null);
    expect(findPath(grid, start, goal, NO_BREAK)).toBeNull();
  });

  it('treats hard blockers (Command Center footprint) as impassable even for breachers', () => {
    const { grid, start, goal } = openField();
    for (let y = 0; y < grid.height; y++) grid.addBlocker(grid.idx(10, y));
    expect(findPath(grid, start, goal, BREACHER)).toBeNull();
  });

  it('accounts obstacle HP into the path cost exactly', () => {
    // 1-wide corridor: 5 cells, wall in the middle — no way around.
    const grid = new Grid(5, 1);
    grid.placeWall(grid.idx(2, 0), WALL_HP);
    const path = findPath(grid, grid.idx(0, 0), grid.idx(4, 0), { speed: 1, wallDps: 50 });
    expect(path).not.toBeNull();
    expect(path!.cost).toBeCloseTo(4 * 1 + WALL_HP / 50, 10);
  });

  it('reaches the cheapest of multiple goals', () => {
    const { grid, start } = openField();
    const near = grid.idx(20, 3);
    const far = grid.idx(20, 9);
    const path = findPath(grid, start, [far, near], WALKER);
    expect(path).not.toBeNull();
    expect(path!.cells.at(-1)).toBe(near);
  });

  it('skips goals that are hard-blocked but still reaches the others', () => {
    const { grid, start } = openField();
    const blockedGoal = grid.idx(20, 3);
    grid.addBlocker(blockedGoal);
    const path = findPath(grid, start, [blockedGoal, grid.idx(20, 9)], WALKER);
    expect(path).not.toBeNull();
    expect(path!.cells.at(-1)).toBe(grid.idx(20, 9));
  });

  it('is deterministic: identical queries yield identical paths', () => {
    const { grid, start, goal } = openField();
    wallLine(grid, 3);
    grid.placeWall(grid.idx(5, 5), WALL_HP);
    grid.placeWall(grid.idx(15, 6), WALL_HP);
    const a = findPath(grid, start, [goal], WALKER);
    const b = findPath(grid, start, [goal], WALKER);
    expect(a).toEqual(b);
  });

  it('handles start === goal and out-of-bounds gracefully', () => {
    const { grid, start } = openField();
    expect(findPath(grid, start, start, WALKER)).toEqual({ cells: [start], cost: 0 });
    expect(findPath(grid, start, -1, WALKER)).toBeNull();
    expect(findPath(grid, start, grid.width * grid.height, WALKER)).toBeNull();
  });
});

describe('weighted A* — the ground', () => {
  /** A PathGrid over open ground with a per-cell move cost we control. */
  function ground(costs: Map<number, number>, min = 1) {
    const grid = new Grid(21, 11);
    return {
      grid,
      view: {
        width: grid.width,
        height: grid.height,
        obstacleHpAt: (c: number) => grid.obstacleHpAt(c),
        neighbors4: (c: number, out: number[]) => grid.neighbors4(c, out),
        moveCostAt: (c: number) => costs.get(c) ?? 1,
        minMoveCost: min,
      },
      start: grid.idx(0, 5),
      goal: grid.idx(20, 5),
    };
  }

  it('charges the ground multiplier for entering a cell, exactly', () => {
    const costs = new Map<number, number>();
    const grid0 = new Grid(21, 11);
    // Six columns of mud at 1.5×, bank to bank, so there is nothing to walk
    // around and the price is forced.
    for (let x = 5; x < 11; x++) for (let y = 0; y < 11; y++) costs.set(grid0.idx(x, y), 1.5);
    const { view, start, goal } = ground(costs);
    const path = findPath(view, start, goal, { speed: 2, wallDps: 0 });
    expect(path).not.toBeNull();
    expect(path!.cells.length).toBe(21);
    // Twenty cells entered: fourteen at 1×, six at 1.5×, all priced at 1/speed.
    expect(path!.cost).toBeCloseTo((14 * 1 + 6 * 1.5) / 2, 10);
  });

  it('detours around mud when the detour is genuinely cheaper', () => {
    const costs = new Map<number, number>();
    const grid0 = new Grid(21, 11);
    // A thick, expensive band across the direct line, open one row above.
    for (let x = 8; x < 13; x++) for (let y = 3; y <= 10; y++) costs.set(grid0.idx(x, y), 4);
    const { view, start, goal } = ground(costs);
    const path = findPath(view, start, goal, { speed: 2, wallDps: 0 });
    expect(path).not.toBeNull();
    expect(path!.cells.some((c) => costs.get(c) === 4)).toBe(false);
  });

  it('treats Infinity ground as impassable for everyone, wall-chewers included', () => {
    const costs = new Map<number, number>();
    const grid0 = new Grid(21, 11);
    for (let y = 0; y < 11; y++) costs.set(grid0.idx(10, y), Infinity); // a river, bank to bank
    const { view, start, goal } = ground(costs);
    expect(findPath(view, start, goal, { speed: 2, wallDps: 0 })).toBeNull();
    expect(findPath(view, start, goal, BREACHER)).toBeNull();
  });

  it('refuses a goal the water took', () => {
    const costs = new Map<number, number>();
    const grid0 = new Grid(21, 11);
    costs.set(grid0.idx(20, 5), Infinity);
    const { view, start, goal } = ground(costs);
    expect(findPath(view, start, goal, { speed: 2, wallDps: 0 })).toBeNull();
  });

  it('finds the true cheapest route when a road costs less than open ground', () => {
    // The heuristic is Manhattan × stepCost × minMoveCost. Drop that last
    // factor and this is the test that fails: an unscaled heuristic
    // over-estimates a route that ends on cheap ground, and because closed
    // nodes are never reopened the search commits to the wrong path.
    const costs = new Map<number, number>();
    const grid0 = new Grid(21, 11);
    // Direct line is ordinary ground. One row down is a road at 0.5×, which
    // is cheaper overall despite the two extra steps to reach it.
    for (let x = 0; x <= 20; x++) costs.set(grid0.idx(x, 6), 0.5);
    const { view, start, goal } = ground(costs, 0.5);
    const path = findPath(view, start, goal, { speed: 2, wallDps: 0 });
    expect(path).not.toBeNull();
    const onRoad = path!.cells.filter((c) => costs.get(c) === 0.5).length;
    expect(onRoad).toBeGreaterThan(15);
    // Twenty-two cells entered: down onto the road, twenty along it, then one
    // ordinary step up onto the goal.
    expect(path!.cost).toBeCloseTo((21 * 0.5 + 1) / 2, 10);
  });

  it('costs nothing when the grid declares no ground at all', () => {
    // Every existing PathGrid — the bare Grid, and the tests above — omits
    // moveCostAt entirely, and must path exactly as it did before terrain.
    const grid = new Grid(21, 11);
    const path = findPath(grid, grid.idx(0, 5), grid.idx(20, 5), { speed: 2, wallDps: 0 });
    expect(path!.cost).toBeCloseTo(20 / 2, 10);
  });
});
