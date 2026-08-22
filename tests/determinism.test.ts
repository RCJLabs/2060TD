import { describe, expect, it } from 'vitest';
import { Engine } from '../src/sim/engine';
import { BREACHER, MG_TURRET, WALKER, WALL_HP } from '../src/content/profiles';
import type { Command, SimConfig } from '../src/sim/types';

/**
 * The determinism contract: same config + same command list ⇒ identical
 * state hashes at every checkpoint. This is what makes replays, offline raid
 * resolution, and the future balance harness trustworthy.
 */

const CONFIG: SimConfig = {
  width: 32,
  height: 24,
  seed: 42,
  wallHp: WALL_HP,
  hqCell: 12 * 32 + 29, // (29, 12)
  spawnColumn: 0,
};

/** A representative scripted battle: maze walls, two turrets, a mixed wave. */
function script(config: SimConfig): Command[] {
  const idx = (x: number, y: number) => y * config.width + x;
  const commands: Command[] = [];

  for (let y = 2; y <= 20; y++) commands.push({ tick: 0, type: 'placeWall', cell: idx(12, y) });
  for (let y = 4; y <= 23; y++) commands.push({ tick: 0, type: 'placeWall', cell: idx(20, y) });
  commands.push({ tick: 0, type: 'placeTurret', cell: idx(13, 10), profile: MG_TURRET });
  commands.push({ tick: 0, type: 'placeTurret', cell: idx(21, 6), profile: MG_TURRET });

  for (let i = 0; i < 8; i++) {
    commands.push({
      tick: i * 10,
      type: 'spawnRunner',
      cell: idx(0, 3 + i * 2),
      profile: i % 3 === 0 ? BREACHER : WALKER,
    });
  }
  // Mid-battle construction, exercising live re-pathing under fire.
  commands.push({ tick: 120, type: 'placeWall', cell: idx(25, 12) });
  commands.push({ tick: 140, type: 'placeWall', cell: idx(25, 11) });
  commands.push({ tick: 160, type: 'removeWall', cell: idx(20, 12) });
  return commands;
}

function checkpoints(engine: Engine, ticks: number[]): string[] {
  const hashes: string[] = [];
  let done = 0;
  for (const target of ticks) {
    engine.run(target - done);
    done = target;
    hashes.push(engine.stateHash());
  }
  return hashes;
}

const CHECKPOINT_TICKS = [150, 300, 600];

describe('determinism', () => {
  it('same seed + same commands ⇒ identical hashes at every checkpoint', () => {
    const a = new Engine(CONFIG);
    const b = new Engine(CONFIG);
    for (const cmd of script(CONFIG)) a.enqueue(cmd);
    for (const cmd of script(CONFIG)) b.enqueue(cmd);

    const hashesA = checkpoints(a, CHECKPOINT_TICKS);
    const hashesB = checkpoints(b, CHECKPOINT_TICKS);
    expect(hashesA).toEqual(hashesB);
  });

  it('enqueue-all-upfront and enqueue-just-in-time are equivalent', () => {
    const upfront = new Engine(CONFIG);
    for (const cmd of script(CONFIG)) upfront.enqueue(cmd);
    upfront.run(600);

    const justInTime = new Engine(CONFIG);
    const commands = script(CONFIG);
    for (let tick = 0; tick < 600; tick++) {
      for (const cmd of commands) {
        if (cmd.tick === tick) justInTime.enqueue(cmd);
      }
      justInTime.step();
    }

    expect(justInTime.stateHash()).toBe(upfront.stateHash());
  });

  it('a different seed produces a different battle', () => {
    const a = new Engine(CONFIG);
    const b = new Engine({ ...CONFIG, seed: 43 });
    for (const cmd of script(CONFIG)) a.enqueue(cmd);
    for (const cmd of script(CONFIG)) b.enqueue(cmd);
    a.run(600);
    b.run(600);
    expect(a.stateHash()).not.toBe(b.stateHash());
  });

  it('the battle actually happened (hash is not fingerprinting an empty field)', () => {
    const engine = new Engine(CONFIG);
    for (const cmd of script(CONFIG)) engine.enqueue(cmd);
    engine.run(600);
    const s = engine.stats;
    expect(s.spawned).toBe(8);
    expect(s.kills + s.leaks + engine.runners.length).toBe(8);
    expect(s.kills).toBeGreaterThan(0); // turrets did work
  });
});
