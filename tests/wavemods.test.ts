import { describe, expect, it } from 'vitest';
import { defenseCatalogFor } from '../src/content/factions';
import { TOWN_GRID } from '../src/meta/town';
import { Engine } from '../src/sim/engine';
import { scaleCatalog } from '../src/sim/scale';
import type { SimConfig, SimEvent, WaveDef } from '../src/sim/types';

/**
 * Wave modifiers in the sim (M35 Phase 1): night shortens the defence's
 * guns, a jammed net refuses every cast, a fast column is quicker and
 * lighter. And the read of the next wave, which the INTEL tab shows.
 */

const W = TOWN_GRID.width;
const idx = (row: number, col: number): number => row * W + col;
const CATALOG = defenseCatalogFor('usa');
const RIFLE = 'rifle';

/** A town board with the given guns and waves, and CP and charges for the powers. */
function board(waves: WaveDef[], guns: { cell: number; kind: string }[] = []): SimConfig {
  return {
    width: W,
    height: TOWN_GRID.height,
    cellSize: TOWN_GRID.cellSize,
    seed: 11,
    ccOrigin: TOWN_GRID.ccOrigin,
    ccLevel: 2,
    spawnLane: TOWN_GRID.spawnLane,
    spawnEdge: TOWN_GRID.spawnEdge,
    siege: {
      name: 'TEST',
      startingSupplies: 0,
      suppliesPerWave: 0,
      startingCp: 150,
      cpCap: 150,
      cpPerSecond: 0,
      prepSeconds: 2,
      repairCostPerHp: 0,
      waves,
    },
    layout: { walls: [], structures: guns.map((g) => ({ ...g, level: 1 })) },
    powerCharges: { a10: 3, arty: 3 },
  };
}

function start(config: SimConfig): Engine {
  const engine = new Engine(config, CATALOG);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  engine.step();
  return engine;
}

/** Fight the wave in combat to its end, killing each man as he comes. */
function clearWave(engine: Engine): void {
  for (let i = 0; i < 2_000 && engine.phase === 'combat'; i++) {
    for (const a of engine.attackers) a.hp = 0;
    engine.step();
  }
}

/** Sit out the prep until the next wave is in. */
function nextWave(engine: Engine): void {
  for (let i = 0; i < 2_000 && engine.phase === 'prep'; i++) engine.step();
}

describe('night', () => {
  it("shortens the defence's guns while the wave fights", () => {
    const reach = scaleCatalog(CATALOG, TOWN_GRID.cellSize).structures.m2nest!.weapon!.range;
    // A nest and a rifleman's spawn this far apart: inside the gun's range by
    // day and outside three quarters of it by night.
    let geometry: { gunRow: number; col: number } | null = null;
    for (let gunRow = 1; gunRow < 8 && !geometry; gunRow++) {
      for (let dx = 0; dx <= 4 && !geometry; dx++) {
        const d = Math.hypot(dx, gunRow);
        if (d > reach * 0.8 && d < reach * 0.95) geometry = { gunRow, col: 5 - dx };
      }
    }
    expect(geometry, `no geometry for a reach of ${reach}`).not.toBeNull();
    const { gunRow, col } = geometry!;
    const fired = (night: boolean): boolean => {
      const wave: WaveDef = {
        entries: [{ atTick: 0, kind: RIFLE, col }],
        ...(night ? { mods: { range: 0.75 } } : {}),
      };
      const engine = new Engine(board([wave], [{ cell: idx(gunRow, 5), kind: 'm2nest' }]), CATALOG);
      const nest = engine.structures.find((s) => s.profile.kind === 'm2nest')!.center;
      engine.enqueue({ tick: 0, type: 'startAssault' });
      // The man spawns in range of the nest by day and it fires at once; three
      // ticks is too short a walk to bring him inside its night reach.
      const events: SimEvent[] = [];
      for (let i = 0; i < 3; i++) events.push(...engine.step());
      return events.some((e) => e.type === 'shot' && e.from.x === nest.x && e.from.y === nest.y);
    };
    expect(fired(false)).toBe(true);
    expect(fired(true)).toBe(false);
  });
});

describe('a jammed net', () => {
  it('refuses every cast while the wave fights, and the next wave is clear', () => {
    const waves: WaveDef[] = [
      { entries: [{ atTick: 0, kind: RIFLE, col: 5 }], mods: { jammed: true } },
      { entries: [{ atTick: 0, kind: RIFLE, col: 5 }] },
    ];
    const engine = start(board(waves));
    expect(engine.phase).toBe('combat');
    expect(engine.canCastPower('a10')).toBe(false);
    engine.enqueue({ tick: engine.tick, type: 'castPower', kind: 'a10', target: { x: 5, y: 3 } });
    const events = engine.step();
    expect(events.some((e) => e.type === 'powerCast')).toBe(false);
    expect(engine.powerChargesLeft('a10')).toBe(3);
    // Beat the jammed wave and fight on into the clear one.
    clearWave(engine);
    nextWave(engine);
    expect(engine.waveIndex).toBe(1);
    expect(engine.phase).toBe('combat');
    expect(engine.canCastPower('a10')).toBe(true);
  });
});

describe('a fast column', () => {
  it('is quicker and lighter than the same men in a plain wave', () => {
    const first = (mods?: WaveDef['mods']) => {
      const engine = start(board([{ entries: [{ atTick: 0, kind: RIFLE, col: 5 }], ...(mods ? { mods } : {}) }]));
      return engine.attackers[0]!;
    };
    const plain = first();
    const fast = first({ speed: 1.3, hp: 0.8 });
    expect(fast.speed).toBeCloseTo(plain.speed * 1.3, 9);
    expect(fast.maxHp).toBeCloseTo(plain.maxHp * 0.8, 9);
    expect(fast.hp).toBeCloseTo(plain.hp * 0.8, 9);
  });
});

describe('the read of the next wave', () => {
  const waves: WaveDef[] = [
    {
      entries: [
        { atTick: 0, kind: 'militia', col: 1, doctrine: 'raze' },
        { atTick: 20, kind: 'militia', col: 2, doctrine: 'raze' },
        { atTick: 60, kind: RIFLE, col: 8, doctrine: 'raze' },
      ],
    },
    { entries: [{ atTick: 0, kind: RIFLE, col: 5, vet: 1.35 }], mods: undefined },
    { entries: [{ atTick: 0, kind: RIFLE, col: 5 }], mods: { range: 0.75 } },
  ];

  it('says what is coming, down which lane, when and for what', () => {
    const engine = new Engine(board(waves), CATALOG);
    const read = engine.nextWaveRead()!;
    expect(read.index).toBe(0);
    expect(read.modifier).toBeUndefined();
    expect(read.groups).toEqual([
      { kind: 'militia', count: 2, lane: 0, arrives: 0, doctrine: 'raze' },
      { kind: RIFLE, count: 1, lane: 2, arrives: 3, doctrine: 'raze' },
    ]);
  });

  it('names a wave of veterans and a night wave by what they carry', () => {
    const engine = start(board(waves));
    clearWave(engine);
    expect(engine.phase).toBe('prep');
    expect(engine.nextWaveRead()!.modifier).toBe('veterans');
    nextWave(engine);
    clearWave(engine);
    expect(engine.phase).toBe('prep');
    expect(engine.nextWaveRead()!.index).toBe(2);
    expect(engine.nextWaveRead()!.modifier).toBe('night');
  });

  it('is nothing while a wave fights', () => {
    const engine = start(board(waves));
    expect(engine.phase).toBe('combat');
    expect(engine.nextWaveRead()).toBeNull();
  });
});
