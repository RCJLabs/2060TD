import { describe, expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import type { RunnerProfile, SimConfig, TurretProfile } from '../src/sim/types';

// Zero-jitter profiles so travel times are exact in behavioral tests.
const WALKER: RunnerProfile = { kind: 'walker', maxHp: 40, speed: 2, wallDps: 3, speedJitter: 0 };
const BREACHER: RunnerProfile = { kind: 'breacher', maxHp: 70, speed: 1.6, wallDps: 45, speedJitter: 0 };
const SEALED: RunnerProfile = { kind: 'sealed', maxHp: 40, speed: 2, wallDps: 0, speedJitter: 0 };
const MG: TurretProfile = { kind: 'mg', range: 4.5, damage: 9, shotsPerSecond: 2.5 };

function makeEngine(seed = 42): Engine {
  const width = 20;
  const height = 11;
  const config: SimConfig = {
    width,
    height,
    seed,
    wallHp: 150,
    hqCell: (5 * width) + 19, // (19, 5)
    spawnColumn: 0,
  };
  return new Engine(config);
}

const spawnCell = (e: Engine, y: number) => e.grid.idx(0, y);

function wallLineCommands(e: Engine, tick: number, gapY: number | null) {
  for (let y = 0; y < e.grid.height; y++) {
    if (y === gapY) continue;
    e.enqueue({ tick, type: 'placeWall', cell: e.grid.idx(10, y) });
  }
}

describe('engine behavior', () => {
  it('a walker crosses open ground and leaks at the HQ', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'spawnRunner', cell: spawnCell(e, 5), profile: WALKER });
    e.run(220); // 19 cells at speed 2 = 9.5s = 190 ticks
    expect(e.stats.leaks).toBe(1);
    expect(e.stats.kills).toBe(0);
    expect(e.runners).toHaveLength(0);
  });

  it('a turret on the route kills a walker before it reaches the HQ', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'placeTurret', cell: e.grid.idx(10, 3), profile: MG });
    e.enqueue({ tick: 0, type: 'spawnRunner', cell: spawnCell(e, 5), profile: WALKER });
    e.run(300);
    expect(e.stats.kills).toBe(1);
    expect(e.stats.leaks).toBe(0);
  });

  it('a breacher chews through a sealed wall line and still gets in', () => {
    const e = makeEngine();
    wallLineCommands(e, 0, null);
    e.enqueue({ tick: 0, type: 'spawnRunner', cell: spawnCell(e, 5), profile: BREACHER });
    e.run(400); // ~11.9s walking + ~3.3s breaking ≈ 305 ticks
    expect(e.stats.wallsLost).toBe(1);
    expect(e.stats.leaks).toBe(1);
  });

  it('re-paths live when walls appear mid-run', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'spawnRunner', cell: spawnCell(e, 5), profile: WALKER });
    e.run(40); // runner is on its way straight down row 5
    wallLineCommands(e, 40, 0); // slam a wall line in front, gap at the top
    e.run(1);
    const runner = e.runners[0]!;
    expect(runner.path).not.toBeNull();
    expect(runner.path).toContain(e.grid.idx(10, 0)); // rerouted through the gap
    expect(runner.path!.some((c) => e.grid.wallAt(c) !== undefined)).toBe(false);
    e.run(400);
    expect(e.stats.leaks).toBe(1);
    expect(e.stats.wallsLost).toBe(0); // it walked around, never chewed
  });

  it('a unit that cannot break walls goes stuck when sealed, and recovers when a wall drops', () => {
    const e = makeEngine();
    wallLineCommands(e, 0, null);
    e.enqueue({ tick: 0, type: 'spawnRunner', cell: spawnCell(e, 5), profile: SEALED });
    e.run(60);
    expect(e.runners[0]!.state).toBe('stuck');
    expect(e.stats.leaks).toBe(0);
    e.enqueue({ tick: 60, type: 'removeWall', cell: e.grid.idx(10, 5) });
    e.run(400);
    expect(e.stats.leaks).toBe(1);
  });

  it('rejects illegal construction: HQ cell, spawn column, occupied cells, stacking', () => {
    const e = makeEngine();
    e.enqueue({ tick: 0, type: 'spawnRunner', cell: spawnCell(e, 2), profile: SEALED });
    e.run(1);
    const runnerCell = e.grid.cellAt(e.runners[0]!.pos);

    e.enqueue({ tick: 1, type: 'placeWall', cell: e.config.hqCell });
    e.enqueue({ tick: 1, type: 'placeWall', cell: e.grid.idx(0, 7) }); // spawn column
    e.enqueue({ tick: 1, type: 'placeWall', cell: runnerCell }); // under a runner
    e.enqueue({ tick: 1, type: 'placeWall', cell: e.grid.idx(5, 5) }); // legal
    e.enqueue({ tick: 1, type: 'placeTurret', cell: e.grid.idx(5, 5), profile: MG }); // on a wall
    e.run(1);

    expect(e.stats.wallsBuilt).toBe(1);
    expect(e.grid.wallAt(e.grid.idx(5, 5))).toBeDefined();
    expect(e.turrets).toHaveLength(0);
  });

  it('commands stamped for future ticks wait their turn', () => {
    const e = makeEngine();
    e.enqueue({ tick: 50, type: 'placeWall', cell: e.grid.idx(5, 5) });
    e.run(50);
    expect(e.grid.wallAt(e.grid.idx(5, 5))).toBeUndefined();
    e.run(1); // tick 50 applies now
    expect(e.grid.wallAt(e.grid.idx(5, 5))).toBeDefined();
  });
});
