import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../src/sim/types';
import { makeSandbox, spawnCell, wallLine } from './helpers';

describe('engine behavior (sandbox)', () => {
  it('an attacker crosses open ground and assaults the Command Center', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'walker' });
    e.run(250); // ~16 cells at speed 2 = 160 ticks, then assault begins
    expect(e.attackers[0]!.state).toBe('assaulting');
    expect(e.cc.hp).toBeLessThan(e.cc.profile.maxHp);
  });

  it('enough attackers on the perimeter destroy the CC → defeat', () => {
    const e = makeSandbox();
    for (let i = 0; i < 5; i++) {
      e.enqueue({ tick: i * 5, type: 'spawnAttacker', cell: spawnCell(e, 3 + i), kind: 'walker' });
    }
    e.run(3800); // 5 × 10 hqDps = 50 dps vs 1500 HP ≈ 30s of assault + travel
    expect(e.phase).toBe('defeat');
  });

  it('an M2 nest on the route kills a walker before it arrives', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(8, 4), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'walker' });
    e.run(300);
    expect(e.stats.kills).toBe(1);
    expect(e.attackers).toHaveLength(0);
    expect(e.cc.hp).toBe(e.cc.profile.maxHp);
  });

  it('a breacher chews through a sealed wall line and still gets in', () => {
    const e = makeSandbox();
    wallLine(e, 0, 10, null);
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'breacher' });
    e.run(500);
    expect(e.stats.wallsLost).toBe(1);
    expect(e.attackers[0]!.state).toBe('assaulting');
  });

  it('re-paths live when walls appear mid-run', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'walker' });
    e.run(40);
    wallLine(e, 40, 10, 0); // slam a wall line in front, gap at the top
    e.run(1);
    const attacker = e.attackers[0]!;
    expect(attacker.path).not.toBeNull();
    expect(attacker.path).toContain(e.grid.idx(10, 0)); // rerouted through the gap
    e.run(600);
    expect(e.stats.wallsLost).toBe(0); // walked around, never chewed
    expect(e.attackers[0]!.state).toBe('assaulting'); // and still got there
  });

  it('a unit that cannot break anything goes stuck when sealed, and recovers when a wall drops', () => {
    const e = makeSandbox();
    wallLine(e, 0, 10, null);
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'sealed' });
    e.run(60);
    expect(e.attackers[0]!.state).toBe('stuck');
    e.enqueue({ tick: 60, type: 'removeWall', cell: e.grid.idx(10, 5) });
    e.run(300);
    expect(e.attackers[0]!.state).toBe('assaulting');
  });

  it('demolishes a blocking structure when that is the cheapest way through', () => {
    const e = makeSandbox();
    // Wall line with the row-5 slot held by a foxhole instead of a wall:
    // breaking the foxhole (180/60 = 3s, no detour) beats a wall + detour.
    wallLine(e, 0, 10, 5);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'foxhole' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'breacher' });
    e.run(500);
    expect(e.stats.structuresLost).toBe(1);
    expect(e.stats.wallsLost).toBe(0);
    expect(e.attackers[0]!.state).toBe('assaulting');
  });

  it('a ranged attacker stops to destroy a defensive structure, then moves on', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'shooter' });

    let sawEngaging = false;
    let sawDestroyed = false;
    for (let i = 0; i < 800; i++) {
      const events = e.step();
      if (e.attackers[0]?.state === 'engaging') sawEngaging = true;
      if (events.some((ev: SimEvent) => ev.type === 'structureDestroyed')) sawDestroyed = true;
    }
    expect(sawEngaging).toBe(true);
    expect(sawDestroyed).toBe(true);
    expect(e.stats.structuresLost).toBe(1);
    // Having cleared the nest, it advances until the CC is in range and shells it.
    const shooter = e.attackers[0]!;
    expect(shooter.state).toBe('engaging');
    expect(shooter.pos.x).toBeGreaterThan(11);
    expect(e.cc.hp).toBeLessThan(e.cc.profile.maxHp);
  });

  it('a claymore detonates on contact and kills the swarm around it', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(10, 5), kind: 'claymore' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'walker' });
    let sawAoe = false;
    for (let i = 0; i < 300; i++) {
      if (e.step().some((ev: SimEvent) => ev.type === 'aoe')) sawAoe = true;
    }
    expect(sawAoe).toBe(true);
    expect(e.stats.kills).toBe(1);
    expect(e.structures).toHaveLength(1); // only the CC remains
  });

  it('a mortar lobs shells that splash a cluster', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(12, 5), kind: 'mortar' });
    for (const row of [4, 5, 6]) {
      e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, row), kind: 'walker' });
    }
    let sawShellInFlight = false;
    for (let i = 0; i < 400; i++) {
      e.step();
      if (e.projectiles.length > 0) sawShellInFlight = true;
    }
    expect(sawShellInFlight).toBe(true);
    expect(e.stats.kills).toBeGreaterThanOrEqual(1);
  });

  it('armor classes matter: the M2 shreds infantry but barely scratches a tank', () => {
    const walkerField = makeSandbox();
    walkerField.enqueue({ tick: 0, type: 'placeStructure', cell: walkerField.grid.idx(8, 4), kind: 'm2nest' });
    walkerField.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(walkerField, 5), kind: 'walker' });
    walkerField.run(400);
    expect(walkerField.stats.kills).toBe(1);

    const tankField = makeSandbox();
    tankField.enqueue({ tick: 0, type: 'placeStructure', cell: tankField.grid.idx(8, 4), kind: 'm2nest' });
    tankField.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(tankField, 5), kind: 'tank' });
    tankField.run(400);
    expect(tankField.stats.kills).toBe(0);
    expect(tankField.attackers[0]!.hp).toBeGreaterThan(400); // smallArms vs heavy = ×0.2
  });

  it('rejects illegal construction: CC footprint, spawn column, occupied cells, stacking', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 2), kind: 'sealed' });
    e.run(1);
    const attackerCell = e.grid.cellAt(e.attackers[0]!.pos);

    e.enqueue({ tick: 1, type: 'placeWall', cell: e.config.ccOrigin, kind: 'wall' });
    e.enqueue({ tick: 1, type: 'placeWall', cell: e.grid.idx(0, 7), kind: 'wall' }); // spawn column
    e.enqueue({ tick: 1, type: 'placeWall', cell: attackerCell, kind: 'wall' }); // under an attacker
    e.enqueue({ tick: 1, type: 'placeWall', cell: e.grid.idx(5, 5), kind: 'wall' }); // legal
    e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(5, 5), kind: 'm2nest' }); // on a wall
    e.enqueue({ tick: 1, type: 'placeStructure', cell: e.grid.idx(6, 5), kind: 'cc' }); // never placeable
    e.run(1);

    expect(e.stats.wallsBuilt).toBe(1);
    expect(e.grid.wallAt(e.grid.idx(5, 5))).toBeDefined();
    expect(e.structures).toHaveLength(1); // only the CC
  });

  it('commands stamped for future ticks wait their turn', () => {
    const e = makeSandbox();
    e.enqueue({ tick: 50, type: 'placeWall', cell: e.grid.idx(5, 5), kind: 'wall' });
    e.run(50);
    expect(e.grid.wallAt(e.grid.idx(5, 5))).toBeUndefined();
    e.run(1); // tick 50 applies now
    expect(e.grid.wallAt(e.grid.idx(5, 5))).toBeDefined();
  });
});
