import { describe, expect, it } from 'vitest';
import type { SiegeDef } from '../src/sim/types';
import { makeSandbox, spawnCell } from './helpers';

const MINI_SIEGE: SiegeDef = {
  name: 'MINI',
  startingSupplies: 100,
  suppliesPerWave: 50,
  startingCp: 30,
  cpCap: 150,
  cpPerSecond: 1.2,
  prepSeconds: 5,
  repairCostPerHp: 0.04,
  waves: [
    {
      entries: [
        { atTick: 0, kind: 'walker', row: 5 },
        { atTick: 20, kind: 'walker', row: 5 },
      ],
    },
  ],
};

describe('M2 engine: town layouts, levels, charges, limits, salvage', () => {
  it('injects the town layout free of charge, with leveled stats', () => {
    const e = makeSandbox(42, {
      siege: MINI_SIEGE,
      layout: {
        walls: [{ cell: 5 * 20 + 10, kind: 'wall' }],
        structures: [{ cell: 4 * 20 + 8, kind: 'm2nest', level: 3 }],
      },
    });
    expect(e.phase).toBe('setup');
    expect(e.supplies).toBe(100); // nothing was charged
    expect(e.grid.wallAt(5 * 20 + 10)).toBeDefined();
    const nest = e.structureAt(4 * 20 + 8)!;
    expect(nest.level).toBe(3);
    expect(nest.profile.maxHp).toBe(400); // level-3 override
    expect(nest.profile.weapon!.damage).toBe(17);
  });

  it('layout structures cannot be sold off mid-siege, battle-placed ones can', () => {
    const e = makeSandbox(42, {
      siege: MINI_SIEGE,
      layout: { walls: [], structures: [{ cell: 4 * 20 + 8, kind: 'm2nest' }] },
    });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(6, 6), kind: 'm2nest' });
    e.enqueue({ tick: 1, type: 'removeStructure', cell: e.grid.idx(8, 4) }); // layout: refused
    e.enqueue({ tick: 1, type: 'removeStructure', cell: e.grid.idx(6, 6) }); // bought: refunded
    e.run(2);
    expect(e.structureAt(e.grid.idx(8, 4))).toBeDefined();
    expect(e.structureAt(e.grid.idx(6, 6))).toBeUndefined();
    expect(e.supplies).toBe(100); // -60 buy, +60 refund
  });

  it('inert (under-construction) structures block and take hits but never fire', () => {
    const e = makeSandbox(42, {
      layout: {
        walls: [],
        structures: [{ cell: 4 * 20 + 8, kind: 'm2nest', hpFraction: 0.35, inert: true }],
      },
    });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'walker' });
    e.run(300);
    expect(e.stats.kills).toBe(0); // scaffolding doesn't shoot
    expect(e.attackers[0]?.state).toBe('assaulting'); // walker strolled past it
  });

  it('2×2 economy buildings occupy four cells and get razed by ranged attackers', () => {
    const e = makeSandbox(42, {
      layout: { walls: [], structures: [{ cell: 4 * 20 + 10, kind: 'supplyDepot' }] },
    });
    for (const cell of [e.grid.idx(10, 4), e.grid.idx(11, 4), e.grid.idx(10, 5), e.grid.idx(11, 5)]) {
      expect(e.structureAt(cell)?.profile.kind).toBe('supplyDepot');
    }
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'shooter' });
    e.run(700);
    expect(e.stats.structuresLost).toBe(1); // the depot went down
  });

  it('power charges are consumed and gate further casts', () => {
    const e = makeSandbox(42, { powerCharges: { a10: 1, arty: 0 } });
    expect(e.powerChargesLeft('a10')).toBe(1);
    expect(e.canCastPower('arty')).toBe(false); // no stock
    e.enqueue({ tick: 0, type: 'castPower', kind: 'a10', target: { x: 5, y: 5 } });
    e.run(1);
    expect(e.powerChargesLeft('a10')).toBe(0);
    expect(e.canCastPower('a10')).toBe(false); // out of ammo, despite sandbox
  });

  it('build limits cap structure counts and Supplies-wall segments', () => {
    const e = makeSandbox(42, {
      siege: MINI_SIEGE,
      buildLimits: { structures: { m2nest: 1 }, walls: 2 },
    });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(5, 5), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeStructure', cell: e.grid.idx(6, 6), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'placeWall', cell: e.grid.idx(3, 3), kind: 'wall' });
    e.enqueue({ tick: 0, type: 'placeWall', cell: e.grid.idx(3, 4), kind: 'wall' });
    e.enqueue({ tick: 0, type: 'placeWall', cell: e.grid.idx(3, 5), kind: 'wall' });
    e.run(1);
    expect(e.structures).toHaveLength(2); // CC + one nest
    expect(e.grid.walls.size).toBe(2);
  });

  it('tunnel entries spawn attackers inside the map, with blocked-mouth fallback', () => {
    const tunnelSiege: SiegeDef = {
      ...MINI_SIEGE,
      waves: [
        {
          entries: [
            { atTick: 0, kind: 'walker', row: 5, col: 10 },
            { atTick: 5, kind: 'walker', row: 8, col: 12 },
          ],
        },
      ],
    };
    const e = makeSandbox(42, {
      siege: tunnelSiege,
      layout: { walls: [{ cell: 8 * 20 + 12, kind: 'wall' }], structures: [] }, // brick one mouth
    });
    e.enqueue({ tick: 0, type: 'startAssault' });
    e.run(10);
    expect(e.attackers).toHaveLength(2);
    const first = e.attackers[0]!;
    expect(first.pos.x).toBeGreaterThan(9); // surfaced mid-map, not at the west strip
    const second = e.attackers[1]!;
    const dx = Math.abs(second.pos.x - 12.5);
    const dy = Math.abs(second.pos.y - 8.5);
    expect(Math.max(dx, dy)).toBeLessThanOrEqual(1.6); // shifted to a neighbor cell
  });

  it('reserved cells refuse new construction but keep pre-existing town walls', () => {
    const reserved = 5 * 20 + 10;
    const e = makeSandbox(42, {
      siege: MINI_SIEGE,
      reservedCells: [reserved, reserved + 1],
      layout: { walls: [{ cell: reserved + 1, kind: 'wall' }], structures: [] },
    });
    expect(e.grid.wallAt(reserved + 1)).toBeDefined(); // town wall stands
    expect(e.canPlaceWall('wall', reserved)).toBe(false);
    e.enqueue({ tick: 0, type: 'placeWall', cell: reserved, kind: 'wall' });
    e.run(1);
    expect(e.grid.wallAt(reserved)).toBeUndefined();
    expect(e.canPlaceWall('wall', reserved - 5)).toBe(true); // normal ground fine
  });

  it('victory converts unspent CP into salvaged Supplies', () => {
    const e = makeSandbox(42, {
      siege: MINI_SIEGE,
      layout: { walls: [], structures: [{ cell: 5 * 20 + 14, kind: 'autocannon' }] },
    });
    e.enqueue({ tick: 0, type: 'startAssault' });
    e.run(1200);
    expect(e.phase).toBe('victory');
    expect(e.stats.kills).toBe(2);
    expect(e.stats.salvage).toBeGreaterThan(50); // ~30 starting CP + kills + income, ×2
    expect(e.cp).toBe(0);
    expect(e.supplies).toBe(100 + 50 + e.stats.salvage);
  });
});
