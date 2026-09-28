import { describe, expect, it } from 'vitest';
import { defenseCatalogFor } from '../src/content/factions';
import { TOWN_GRID } from '../src/meta/town';
import { Engine, TICKS_PER_SECOND } from '../src/sim/engine';
import { FIELD_COMMAND } from '../src/sim/fieldcommand';
import { CHAIN_CURRENT } from '../src/sim/killchain';
import type { SimConfig, SimEvent, WaveDef } from '../src/sim/types';

/**
 * Field command (M35 Phase 2): a field defence can be moved, sold or upgraded
 * once, and a power can be aimed along a line or across an area.
 */

const W = TOWN_GRID.width;
const idx = (row: number, col: number): number => row * W + col;
const CATALOG = defenseCatalogFor('usa');
const GUN = 'depmg';

/** A town board in combat from the start, with nobody arriving for a while unless a wave says so. */
function board(waves: WaveDef[] = [{ entries: [{ atTick: 4_000, kind: 'rifle', col: 5 }] }], extra: Partial<SimConfig> = {}): SimConfig {
  return {
    width: W,
    height: TOWN_GRID.height,
    cellSize: TOWN_GRID.cellSize,
    seed: 5,
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
    layout: { walls: [], structures: [{ cell: idx(9, 7), kind: 'm2nest', level: 1 }] },
    ...extra,
  };
}

function fighting(config: SimConfig = board()): Engine {
  const engine = new Engine(config, CATALOG);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  engine.step();
  return engine;
}

/** Place a field gun at a cell, in the wave, and return it. */
function field(engine: Engine, cell: number) {
  engine.command({ type: 'placeStructure', cell, kind: GUN });
  engine.step();
  const s = engine.structureAt(cell);
  if (!s || s.profile.kind !== GUN) throw new Error(`no ${GUN} at ${cell}`);
  return s;
}

const run = (engine: Engine, ticks: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) events.push(...engine.step());
  return events;
};

describe('moving a field defence', () => {
  it('costs half its price, keeps its health and rank, and puts it out of action for three seconds', () => {
    const engine = fighting();
    const price = engine.fieldPrice(CATALOG.structures[GUN]!.cpCost!);
    const gun = field(engine, idx(5, 2));
    gun.hp = 80;
    const cp = engine.cp;
    engine.command({ type: 'moveStructure', cell: idx(5, 2), to: idx(6, 6) });
    engine.step();
    // In whole CP, rounded up, like every price on the drawer.
    expect(engine.cp).toBe(cp - Math.ceil(price * FIELD_COMMAND.moveShare));
    expect(engine.structureAt(idx(5, 2))).toBeUndefined();
    const moved = engine.structureAt(idx(6, 6))!;
    expect(moved.id).toBe(gun.id);
    expect(moved.hp).toBe(80);
    expect(moved.level).toBe(1);
    expect(moved.downUntil).toBe(engine.tick - 1 + Math.round(FIELD_COMMAND.moveSeconds * TICKS_PER_SECOND));
  });

  it('is refused onto ground that is taken, onto its own, for a town building, without the CP, and before the fighting', () => {
    const engine = fighting();
    field(engine, idx(5, 2));
    const refused = (cmd: { cell: number; to: number }) => {
      const before = engine.cp;
      engine.command({ type: 'moveStructure', ...cmd });
      engine.step();
      return engine.cp === before;
    };
    // Onto the nest, onto the entry lane, where it already stands, and the nest itself.
    expect(refused({ cell: idx(5, 2), to: idx(9, 7) })).toBe(true);
    expect(refused({ cell: idx(5, 2), to: idx(0, 2) })).toBe(true);
    expect(refused({ cell: idx(5, 2), to: idx(5, 2) })).toBe(true);
    expect(engine.structureAt(idx(5, 2))?.downUntil).toBeUndefined();
    expect(refused({ cell: idx(9, 7), to: idx(6, 6) })).toBe(true);
    engine.cp = 1;
    expect(refused({ cell: idx(5, 2), to: idx(6, 6) })).toBe(true);
    expect(engine.structureAt(idx(5, 2))?.profile.kind).toBe(GUN);
    // Setup has no field defences to move.
    const setup = new Engine(board(), CATALOG);
    expect(setup.fieldOptions(idx(9, 7))).toBeNull();
  });

  it('does not fire, or hold the post shut, until it is set up again', () => {
    // A rifleman comes in on column 5 and walks down column 4, past a gun
    // moved beside his path just before he gets there.
    const waves: WaveDef[] = [{ entries: [{ atTick: 0, kind: 'rifle', col: 5 }] }];
    const engine = fighting(board(waves, { killChainVersion: CHAIN_CURRENT, layout: { walls: [], structures: [] } }));
    const gun = field(engine, idx(3, 8));
    engine.command({ type: 'moveStructure', cell: idx(3, 8), to: idx(3, 5) });
    engine.step();
    const moved = engine.structureAt(idx(3, 5))!;
    const from = moved.center;
    const down = Math.round(FIELD_COMMAND.moveSeconds * TICKS_PER_SECOND);
    const early = run(engine, down - 2);
    expect(early.some((e) => e.type === 'shot' && e.from.x === from.x && e.from.y === from.y)).toBe(false);
    expect(engine.attackers.length).toBeGreaterThan(0);
    const later = run(engine, 3 * TICKS_PER_SECOND);
    expect(later.some((e) => e.type === 'shot' && e.from.x === from.x && e.from.y === from.y)).toBe(true);
    expect(gun.id).toBe(moved.id);

    // And beside the post, a gun being moved does not cover it.
    const post = fighting(board(undefined, { killChainVersion: CHAIN_CURRENT, layout: { walls: [], structures: [] } }));
    const cc = post.cc.center;
    // Right beside the post, and one cell along: both well inside its cover.
    const near = idx(Math.floor(cc.y) - 1, Math.floor(cc.x));
    const guard = field(post, near);
    expect(post.chainProgress()!.covering).toBe(1);
    post.command({ type: 'moveStructure', cell: near, to: near - 1 });
    post.step();
    expect(post.structureAt(near - 1)?.id).toBe(guard.id);
    expect(post.chainProgress()!.covering).toBe(0);
    run(post, down);
    expect(post.chainProgress()!.covering).toBe(1);
  });
});

describe('selling a field defence', () => {
  it('pays back half of what it cost, by the share of its health left', () => {
    const engine = fighting();
    const price = engine.fieldPrice(CATALOG.structures[GUN]!.cpCost!);
    const gun = field(engine, idx(5, 2));
    gun.hp = gun.profile.maxHp / 2;
    const cp = engine.cp;
    expect(engine.fieldOptions(idx(5, 2))!.sell).toBeCloseTo(price * FIELD_COMMAND.sellShare * 0.5, 9);
    engine.command({ type: 'sellStructure', cell: idx(5, 2) });
    engine.step();
    expect(engine.cp).toBeCloseTo(cp + price * FIELD_COMMAND.sellShare * 0.5, 9);
    expect(engine.structureAt(idx(5, 2))).toBeUndefined();
  });

  it('pays back the upgrade too, never past the cap, and never a town building', () => {
    const engine = fighting();
    const price = engine.fieldPrice(CATALOG.structures[GUN]!.cpCost!);
    field(engine, idx(5, 2));
    engine.command({ type: 'upgradeStructure', cell: idx(5, 2) });
    engine.step();
    expect(engine.fieldOptions(idx(5, 2))!.sell).toBeCloseTo(2 * price * FIELD_COMMAND.sellShare, 9);
    engine.cp = 149;
    engine.command({ type: 'sellStructure', cell: idx(5, 2) });
    engine.step();
    expect(engine.cp).toBe(150);
    const nest = engine.structureAt(idx(9, 7))!;
    engine.command({ type: 'sellStructure', cell: idx(9, 7) });
    engine.step();
    expect(engine.structureAt(idx(9, 7))).toBe(nest);
    expect(engine.fieldOptions(idx(9, 7))).toBeNull();
  });
});

describe('upgrading a field defence', () => {
  it('is once, for its price again, and makes it tougher and harder hitting', () => {
    const engine = fighting();
    const price = engine.fieldPrice(CATALOG.structures[GUN]!.cpCost!);
    const gun = field(engine, idx(5, 2));
    const { maxHp } = gun.profile;
    const damage = gun.profile.weapon!.damage;
    gun.hp = maxHp - 30;
    expect(engine.fieldOptions(idx(5, 2))!.upgrade).toBe(price);
    const cp = engine.cp;
    engine.command({ type: 'upgradeStructure', cell: idx(5, 2) });
    engine.step();
    const up = engine.structureAt(idx(5, 2))!;
    expect(engine.cp).toBeCloseTo(cp - price, 9);
    expect(up.level).toBe(2);
    expect(up.profile.maxHp).toBeCloseTo(maxHp * FIELD_COMMAND.upgradeHp, 9);
    expect(up.profile.weapon!.damage).toBeCloseTo(damage * FIELD_COMMAND.upgradeDamage, 9);
    // It keeps the damage it had taken.
    expect(up.hp).toBeCloseTo(maxHp * FIELD_COMMAND.upgradeHp - 30, 9);
    // And once is all.
    expect(engine.fieldOptions(idx(5, 2))!.upgrade).toBeNull();
    const again = engine.cp;
    engine.command({ type: 'upgradeStructure', cell: idx(5, 2) });
    engine.step();
    expect(engine.cp).toBe(again);
    expect(engine.structureAt(idx(5, 2))!.level).toBe(2);
  });

  it('moves at half the price of the defence, not of what was spent on it', () => {
    const engine = fighting();
    const price = engine.fieldPrice(CATALOG.structures[GUN]!.cpCost!);
    field(engine, idx(5, 2));
    engine.command({ type: 'upgradeStructure', cell: idx(5, 2) });
    engine.step();
    expect(engine.fieldOptions(idx(5, 2))!.move).toBe(Math.ceil(price * FIELD_COMMAND.moveShare));
  });
});

describe('an aimed power', () => {
  /** A file of riflemen standing still down column 5, rows 2 to 8. */
  function file(): Engine {
    const waves: WaveDef[] = [
      { entries: [2, 3, 4, 5, 6, 7, 8].map((row) => ({ atTick: 0, kind: 'rifle', col: 5, row })) },
    ];
    const engine = new Engine(
      board(waves, { layout: { walls: [], structures: [] }, powerCharges: { a10: 3, arty: 3 } }),
      CATALOG,
    );
    engine.enqueue({ tick: 0, type: 'startAssault' });
    engine.step();
    for (const a of engine.attackers) {
      a.speed = 0;
      a.pos = { x: 5.5, y: a.pos.y };
    }
    return engine;
  }
  const hurt = (engine: Engine): number => engine.attackers.filter((a) => a.hp < a.maxHp).length;

  it('runs the gun run down the line it is given, where a run across it hits one man', () => {
    const across = file();
    across.command({ type: 'castPower', kind: 'a10', target: { x: 5.5, y: 5.5 } });
    run(across, 40);
    const down = file();
    down.command({ type: 'castPower', kind: 'a10', target: { x: 5.5, y: 5.5 }, toward: { x: 5.5, y: 9 } });
    run(down, 40);
    expect(hurt(across)).toBeLessThanOrEqual(2);
    expect(hurt(down)).toBeGreaterThanOrEqual(5);
  });

  it('is laid by an aimed order along the line the men stand on', () => {
    const cast = (aimed: boolean): number => {
      const standingOrders = {
        id: 'probe' as const,
        rules: [
          {
            cpAtLeast: 0,
            action: 'power' as const,
            kind: 'a10',
            target: 'densest' as const,
            minHostiles: 1,
            cooldownTicks: 2_000,
            ...(aimed ? { aimed } : {}),
          },
        ],
      };
      // Given once the file is set down, or the order fires on the first
      // tick at men still where they spawned.
      const engine = file();
      engine.config.standingOrders = standingOrders;
      const events = run(engine, 80);
      expect(events.filter((e) => e.type === 'powerCast')).toHaveLength(1);
      return hurt(engine);
    };
    expect(cast(false)).toBeLessThanOrEqual(2);
    expect(cast(true)).toBeGreaterThanOrEqual(4);
  });

  it('lands the barrage across the circle it is given, from half to twice its spread', () => {
    const scatter = new Engine(board(), CATALOG).catalog.powers['arty'];
    if (scatter?.type !== 'barrage') throw new Error('no barrage');
    const landed = (reach: number): number => {
      const engine = file();
      const target = { x: 5.5, y: 5.5 };
      engine.command({ type: 'castPower', kind: 'arty', target, toward: { x: 5.5 + reach, y: 5.5 } });
      const aoe = run(engine, 120).filter((e) => e.type === 'aoe');
      expect(aoe.length).toBe(scatter.shells);
      return Math.max(...aoe.map((e) => (e.type === 'aoe' ? Math.hypot(e.at.x - target.x, e.at.y - target.y) : 0)));
    };
    expect(landed(0.01)).toBeLessThanOrEqual(scatter.scatter * FIELD_COMMAND.areaMin + 1e-9);
    expect(landed(100)).toBeLessThanOrEqual(scatter.scatter * FIELD_COMMAND.areaMax + 1e-9);
  });

  it('is the cast it always was when it is aimed along the old line, or not aimed at all', () => {
    const hash = (toward?: { x: number; y: number }, kind = 'a10'): string => {
      const engine = file();
      engine.command({ type: 'castPower', kind, target: { x: 5.5, y: 5.5 }, ...(toward ? { toward } : {}) });
      run(engine, 120);
      return engine.stateHash();
    };
    expect(hash({ x: 9, y: 5.5 })).toBe(hash());
    const spread = new Engine(board(), CATALOG).catalog.powers['arty'];
    if (spread?.type !== 'barrage') throw new Error('no barrage');
    expect(hash({ x: 5.5 + spread.scatter, y: 5.5 }, 'arty')).toBe(hash(undefined, 'arty'));
  });
});

describe('the instruments’ orders', () => {
  it('upgrade a field defence, and sell or move one the fight has gone on without', () => {
    const rule = (action: 'upgrade' | 'sell' | 'move') => ({
      id: 'probe' as const,
      rules: [{ cpAtLeast: 0, action, kind: GUN, target: 'ccApproach' as const, minHostiles: 0, cooldownTicks: 20 }],
    });
    // A file of men down the centre from five seconds in, and a gun beside
    // their path to fight them. The gun the orders are about sits out of
    // reach in a far corner.
    const waves: WaveDef[] = [
      { entries: Array.from({ length: 12 }, (_, i) => ({ atTick: 100 + i * 40, kind: 'rifle', col: 5 })) },
    ];
    for (const action of ['upgrade', 'sell', 'move'] as const) {
      const engine = fighting(board(waves, { standingOrders: rule(action), layout: { walls: [], structures: [] } }));
      const corner = field(engine, idx(2, 0));
      const fighter = field(engine, idx(8, 4));
      run(engine, 30 * TICKS_PER_SECOND);
      const now = (id: number) => engine.structures.find((s) => s.id === id);
      if (action === 'upgrade') expect([now(corner.id)?.level, now(fighter.id)?.level]).toContain(2);
      if (action === 'sell') {
        expect(now(corner.id)).toBeUndefined();
        expect(now(fighter.id)).toBeDefined();
      }
      if (action === 'move') {
        expect(now(corner.id)?.origin).not.toBe(idx(2, 0));
        expect(now(fighter.id)?.origin).toBe(idx(8, 4));
      }
    }
  });

  it('strand nobody in a lull: a gun is idle only while the rest of the defence fights on', () => {
    // Nobody comes at all, so nothing fires, however long the gun sits.
    const orders = {
      id: 'probe' as const,
      rules: [{ cpAtLeast: 0, action: 'sell' as const, kind: GUN, target: 'ccApproach' as const, minHostiles: 0, cooldownTicks: 20 }],
    };
    const engine = fighting(board(undefined, { standingOrders: orders, layout: { walls: [], structures: [] } }));
    const gun = field(engine, idx(2, 0));
    run(engine, 60 * TICKS_PER_SECOND);
    expect(engine.structures.some((s) => s.id === gun.id)).toBe(true);
  });
});
