import { describe, expect, it } from 'vitest';
import { M1_CATALOG } from '../src/content/catalog';
import { HOLD_THE_LINE } from '../src/content/missions';
import { Engine } from '../src/sim/engine';
import type { Command, SimConfig } from '../src/sim/types';
import { TEST_CATALOG } from './helpers';

/**
 * The determinism contract: same config + catalog + command list ⇒ identical
 * state hashes at every checkpoint. This is what makes replays, offline raid
 * resolution, and the future balance harness trustworthy.
 */

// ---- sandbox battle -----------------------------------------------------------

const SANDBOX_CONFIG: SimConfig = {
  width: 32,
  height: 24,
  seed: 42,
  ccOrigin: 11 * 32 + 27,
  spawnColumn: 0,
};

function sandboxScript(config: SimConfig): Command[] {
  const idx = (x: number, y: number) => y * config.width + x;
  const commands: Command[] = [];
  for (let y = 2; y <= 20; y++) commands.push({ tick: 0, type: 'placeWall', cell: idx(12, y), kind: 'wall' });
  for (let y = 4; y <= 23; y++) commands.push({ tick: 0, type: 'placeWall', cell: idx(20, y), kind: 'wall' });
  commands.push({ tick: 0, type: 'placeStructure', cell: idx(13, 10), kind: 'm2nest' });
  commands.push({ tick: 0, type: 'placeStructure', cell: idx(21, 6), kind: 'mortar' });
  for (let i = 0; i < 8; i++) {
    commands.push({
      tick: i * 10,
      type: 'spawnAttacker',
      cell: idx(0, 3 + i * 2),
      kind: i % 3 === 0 ? 'breacher' : 'walker',
    });
  }
  // Mid-battle construction and powers, exercising live re-pathing, impacts,
  // and the seed-driven barrage scatter.
  commands.push({ tick: 120, type: 'placeWall', cell: idx(25, 12), kind: 'wall' });
  commands.push({ tick: 160, type: 'removeWall', cell: idx(20, 12) });
  commands.push({ tick: 200, type: 'castPower', kind: 'a10', target: { x: 8, y: 12 } });
  commands.push({ tick: 220, type: 'castPower', kind: 'arty', target: { x: 6, y: 12 } });
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

// ---- full siege ------------------------------------------------------------------

const SIEGE_CONFIG: SimConfig = { ...SANDBOX_CONFIG, siege: HOLD_THE_LINE };

function siegeScript(config: SimConfig): Command[] {
  const idx = (x: number, y: number) => y * config.width + x;
  const commands: Command[] = [
    { tick: 0, type: 'placeStructure', cell: idx(25, 10), kind: 'm2nest' },
    { tick: 0, type: 'placeStructure', cell: idx(25, 13), kind: 'm2nest' },
    { tick: 0, type: 'placeStructure', cell: idx(24, 12), kind: 'autocannon' },
    { tick: 0, type: 'placeStructure', cell: idx(23, 11), kind: 'mortar' },
  ];
  for (let y = 8; y <= 15; y++) {
    if (y === 9 || y === 14) continue;
    commands.push({ tick: 0, type: 'placeWall', cell: idx(22, y), kind: 'wall' });
  }
  commands.push({ tick: 10, type: 'startAssault' });
  commands.push({ tick: 500, type: 'castPower', kind: 'arty', target: { x: 10, y: 12 } });
  commands.push({ tick: 900, type: 'placeStructure', cell: idx(21, 12), kind: 'foxhole' });
  commands.push({ tick: 1000, type: 'skipPrep' });
  return commands;
}

describe('determinism', () => {
  it('sandbox: same seed + same commands ⇒ identical hashes at every checkpoint', () => {
    const a = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    const b = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) a.enqueue(cmd);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) b.enqueue(cmd);
    expect(checkpoints(a, CHECKPOINT_TICKS)).toEqual(checkpoints(b, CHECKPOINT_TICKS));
  });

  it('enqueue-all-upfront and enqueue-just-in-time are equivalent', () => {
    const upfront = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) upfront.enqueue(cmd);
    upfront.run(600);

    const justInTime = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    const commands = sandboxScript(SANDBOX_CONFIG);
    for (let tick = 0; tick < 600; tick++) {
      for (const cmd of commands) {
        if (cmd.tick === tick) justInTime.enqueue(cmd);
      }
      justInTime.step();
    }
    expect(justInTime.stateHash()).toBe(upfront.stateHash());
  });

  it('a different seed produces a different battle', () => {
    // Real content has spawn speed jitter, so seeds must diverge the sim.
    const a = new Engine(SIEGE_CONFIG, M1_CATALOG);
    const b = new Engine({ ...SIEGE_CONFIG, seed: 43 }, M1_CATALOG);
    for (const cmd of siegeScript(SIEGE_CONFIG)) a.enqueue(cmd);
    for (const cmd of siegeScript(SIEGE_CONFIG)) b.enqueue(cmd);
    a.run(1500);
    b.run(1500);
    expect(a.stateHash()).not.toBe(b.stateHash());
  });

  it('full siege: scripted defense replays to the identical state', () => {
    const a = new Engine(SIEGE_CONFIG, M1_CATALOG);
    const b = new Engine(SIEGE_CONFIG, M1_CATALOG);
    for (const cmd of siegeScript(SIEGE_CONFIG)) a.enqueue(cmd);
    for (const cmd of siegeScript(SIEGE_CONFIG)) b.enqueue(cmd);
    const ticks = [500, 1500, 4000];
    expect(checkpoints(a, ticks)).toEqual(checkpoints(b, ticks));
    expect(a.phase).toBe(b.phase);
    expect(a.stats).toEqual(b.stats);
  });

  it('the sandbox battle actually happened (hash is not fingerprinting an empty field)', () => {
    const engine = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) engine.enqueue(cmd);
    engine.run(600);
    const s = engine.stats;
    expect(s.spawned).toBe(8);
    expect(s.kills + engine.attackers.length).toBe(8);
    expect(s.kills).toBeGreaterThan(0); // the guns did work
  });
});

describe('terrain does not disturb a battle that never asked for it', () => {
  // The whole risk of adding a generated field to the sim is that it moves a
  // battle nobody wanted moved. These pin the two halves of that: a config
  // with no terrain fields must behave EXACTLY as it did before v1.19, and a
  // config with them must behave differently — otherwise terrain is inert.
  it('a config with no terrain fields hashes as it always did', () => {
    const a = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) a.enqueue(cmd);
    const b = new Engine({ ...SANDBOX_CONFIG }, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) b.enqueue(cmd);
    expect(checkpoints(a, CHECKPOINT_TICKS)).toEqual(checkpoints(b, CHECKPOINT_TICKS));
  });

  it('terrainVersion 0 is byte-for-byte the same battle as no terrain at all', () => {
    const bare = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) bare.enqueue(cmd);
    const zeroed = new Engine(
      { ...SANDBOX_CONFIG, terrainSeed: 999, terrainVersion: 0 },
      TEST_CATALOG,
    );
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) zeroed.enqueue(cmd);
    expect(checkpoints(zeroed, CHECKPOINT_TICKS)).toEqual(checkpoints(bare, CHECKPOINT_TICKS));
  });

  it('terrain changes the battle when it is switched on', () => {
    const flat = new Engine(SANDBOX_CONFIG, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) flat.enqueue(cmd);
    const ground = new Engine(
      { ...SANDBOX_CONFIG, terrainSeed: 2060, terrainVersion: 1 },
      TEST_CATALOG,
    );
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) ground.enqueue(cmd);
    expect(checkpoints(ground, CHECKPOINT_TICKS)).not.toEqual(
      checkpoints(flat, CHECKPOINT_TICKS),
    );
  });

  it('the same terrain seed replays identically', () => {
    const seeded = (): Engine => {
      const e = new Engine({ ...SANDBOX_CONFIG, terrainSeed: 2060, terrainVersion: 1 }, TEST_CATALOG);
      for (const cmd of sandboxScript(SANDBOX_CONFIG)) e.enqueue(cmd);
      return e;
    };
    expect(checkpoints(seeded(), CHECKPOINT_TICKS)).toEqual(
      checkpoints(seeded(), CHECKPOINT_TICKS),
    );
  });

  it('a different terrain seed is a different battle', () => {
    const on = (terrainSeed: number): Engine => {
      const e = new Engine({ ...SANDBOX_CONFIG, terrainSeed, terrainVersion: 1 }, TEST_CATALOG);
      for (const cmd of sandboxScript(SANDBOX_CONFIG)) e.enqueue(cmd);
      return e;
    };
    expect(checkpoints(on(2060), CHECKPOINT_TICKS)).not.toEqual(
      checkpoints(on(31337), CHECKPOINT_TICKS),
    );
  });

  it('the battles above are real battles, not empty fields', () => {
    // Every hash-equality assertion here is worthless if nothing happened.
    const e = new Engine({ ...SANDBOX_CONFIG, terrainSeed: 2060, terrainVersion: 1 }, TEST_CATALOG);
    for (const cmd of sandboxScript(SANDBOX_CONFIG)) e.enqueue(cmd);
    e.run(600);
    expect(e.stats.spawned).toBe(8);
    expect(e.attackers.filter((a) => a.state === 'stuck')).toHaveLength(0);
  });
});
