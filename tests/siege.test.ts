import { describe, expect, it } from 'vitest';
import { M1_CATALOG } from '../src/content/catalog';
import { HOLD_THE_LINE } from '../src/content/missions';
import { Engine } from '../src/sim/engine';
import type { SimConfig, SimEvent } from '../src/sim/types';

const WIDTH = 32;

function makeSiege(seed = 42): Engine {
  const config: SimConfig = {
    width: WIDTH,
    height: 24,
    seed,
    ccOrigin: 11 * WIDTH + 27, // (27, 11)
    spawnColumn: 0,
    siege: HOLD_THE_LINE,
  };
  return new Engine(config, M1_CATALOG);
}

const idx = (x: number, y: number) => y * WIDTH + x;

/** A modest scripted defense: guns covering the CC approach. */
function scriptDefense(e: Engine, tick: number): void {
  e.enqueue({ tick, type: 'placeStructure', cell: idx(25, 10), kind: 'm2nest' });
  e.enqueue({ tick, type: 'placeStructure', cell: idx(25, 13), kind: 'm2nest' });
  e.enqueue({ tick, type: 'placeStructure', cell: idx(24, 12), kind: 'autocannon' });
  e.enqueue({ tick, type: 'placeStructure', cell: idx(23, 11), kind: 'mortar' });
}

describe('siege flow', () => {
  it('starts in setup with the mission economy, and only permanent items are buildable', () => {
    const e = makeSiege();
    expect(e.phase).toBe('setup');
    expect(e.supplies).toBe(HOLD_THE_LINE.startingSupplies);
    expect(e.cp).toBe(HOLD_THE_LINE.startingCp);

    e.enqueue({ tick: 0, type: 'placeWall', cell: idx(20, 11), kind: 'wall' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(24, 11), kind: 'autocannon' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(22, 11), kind: 'foxhole' }); // CP item: rejected
    e.enqueue({ tick: 0, type: 'placeWall', cell: idx(21, 11), kind: 'hesco' }); // CP item: rejected
    e.enqueue({ tick: 0, type: 'castPower', kind: 'arty', target: { x: 10, y: 12 } }); // rejected
    e.run(1);

    expect(e.supplies).toBe(HOLD_THE_LINE.startingSupplies - 10 - 100);
    expect(e.structures).toHaveLength(2); // CC + autocannon
    expect(e.grid.walls.size).toBe(1);
    expect(e.cp).toBe(HOLD_THE_LINE.startingCp);
  });

  it('startAssault begins wave 1 and spawns attackers; CP accrues only in combat', () => {
    const e = makeSiege();
    e.run(40); // idling in setup: no CP income
    expect(e.cp).toBe(HOLD_THE_LINE.startingCp);

    e.enqueue({ tick: 40, type: 'startAssault' });
    e.run(2);
    expect(e.phase).toBe('combat');
    expect(e.attackers.length).toBeGreaterThan(0);

    e.run(100);
    expect(e.cp).toBeGreaterThan(HOLD_THE_LINE.startingCp);
  });

  it('field defenses deploy mid-combat for CP; emplacements are locked', () => {
    const e = makeSiege();
    e.enqueue({ tick: 0, type: 'startAssault' });
    e.run(20);
    const cpBefore = e.cp;

    e.enqueue({ tick: 20, type: 'placeStructure', cell: idx(20, 12), kind: 'foxhole' });
    e.enqueue({ tick: 20, type: 'placeStructure', cell: idx(20, 10), kind: 'm2nest' }); // rejected
    e.enqueue({ tick: 20, type: 'placeWall', cell: idx(20, 14), kind: 'hesco' });
    e.enqueue({ tick: 20, type: 'placeWall', cell: idx(20, 15), kind: 'wall' }); // rejected
    e.run(1);

    expect(e.structureAt(idx(20, 12))?.profile.kind).toBe('foxhole');
    expect(e.structureAt(idx(20, 10))).toBeUndefined();
    expect(e.grid.wallAt(idx(20, 14))?.kind).toBe('hesco');
    expect(e.grid.wallAt(idx(20, 15))).toBeUndefined();
    expect(e.cp).toBeCloseTo(cpBefore + 0.06 - 20 - 10, 3); // one tick of income, two buys
  });

  it('an undefended base falls: militia reach the CC and defeat follows', () => {
    const e = makeSiege();
    e.enqueue({ tick: 0, type: 'startAssault' });
    e.run(6000);
    expect(e.phase).toBe('defeat');
    expect(e.cc.hp).toBeLessThanOrEqual(0);
  });

  it('a modest gun line clears wave 1 into prep, with the supply award', () => {
    const e = makeSiege();
    scriptDefense(e, 0);
    e.enqueue({ tick: 0, type: 'startAssault' });

    let sawPrep: SimEvent | undefined;
    for (let i = 0; i < 3000 && !sawPrep; i++) {
      sawPrep = e.step().find((ev) => ev.type === 'prepStarted');
    }
    expect(sawPrep).toBeDefined();
    expect(e.phase).toBe('prep');
    expect(e.stats.kills).toBe(10); // 8 militia + 2 rifle squads
    expect(e.supplies).toBe(
      HOLD_THE_LINE.startingSupplies - 60 - 60 - 100 - 120 + HOLD_THE_LINE.suppliesPerWave,
    );
  });

  it('skipPrep jumps straight into the next wave', () => {
    const e = makeSiege();
    scriptDefense(e, 0);
    e.enqueue({ tick: 0, type: 'startAssault' });
    for (let i = 0; i < 3000 && e.phase !== 'prep'; i++) e.step();
    expect(e.phase).toBe('prep');

    e.command({ type: 'skipPrep' });
    e.run(2);
    expect(e.phase).toBe('combat');
    expect(e.waveIndex).toBe(1);
  });

  it('repair all restores damaged walls during prep and charges supplies', () => {
    const e = makeSiege();
    scriptDefense(e, 0);
    e.enqueue({ tick: 0, type: 'placeWall', cell: idx(20, 11), kind: 'wall' });
    e.enqueue({ tick: 0, type: 'startAssault' });
    for (let i = 0; i < 3000 && e.phase !== 'prep'; i++) e.step();

    const wall = e.grid.wallAt(idx(20, 11))!;
    e.grid.damageWall(idx(20, 11), 100);
    const cost = e.repairAllCost();
    expect(cost).toBe(Math.ceil(100 * HOLD_THE_LINE.repairCostPerHp));

    const suppliesBefore = e.supplies;
    e.command({ type: 'repairAll' });
    e.run(1);
    expect(wall.hp).toBe(wall.maxHp);
    expect(e.supplies).toBe(suppliesBefore - cost);
  });

  it('powers cost CP, respect cooldowns, and land their impacts', () => {
    const e = makeSiege();
    scriptDefense(e, 0);
    e.enqueue({ tick: 0, type: 'startAssault' });
    // By tick 400 passive income + kills comfortably cover the 60 CP barrage.
    e.enqueue({ tick: 400, type: 'castPower', kind: 'arty', target: { x: 8, y: 12 } });
    e.enqueue({ tick: 402, type: 'castPower', kind: 'arty', target: { x: 8, y: 12 } }); // on cooldown

    let casts = 0;
    let aoes = 0;
    for (let i = 0; i < 600; i++) {
      for (const ev of e.step()) {
        if (ev.type === 'powerCast') casts++;
        if (ev.type === 'aoe') aoes++;
      }
    }
    expect(casts).toBe(1);
    expect(aoes).toBeGreaterThanOrEqual(5); // 5 shells (mortar may add more)
    expect(e.stats.cpSpent).toBe(60);
    expect(e.powerCooldownSeconds('arty')).toBeGreaterThan(0);
  });

  it('wave previews describe the coming wave during setup and prep', () => {
    const e = makeSiege();
    const preview = e.nextWavePreview()!;
    const militia = preview.find((p) => p.kind === 'militia');
    expect(militia?.count).toBe(8);
    expect(preview.find((p) => p.kind === 'rifle')?.count).toBe(2);
  });
});
