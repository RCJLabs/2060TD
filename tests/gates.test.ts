import { describe, expect, it } from 'vitest';
import { USA_WALLS } from '../src/content/usa';
import { FACTION_IDS, defenseCatalogFor } from '../src/content/factions';
import {
  canPlaceWall,
  newTown,
  placeWall,
  removeWall,
  wallSegments,
  GATE_SEGMENTS,
  TOWN_GRID,
  unlockAll,
} from '../src/meta/town';
import { makeSandbox, spawnCell, TEST_CATALOG, wallLine } from './helpers';
import type { Engine } from '../src/sim/engine';

/**
 * Gates (v1.17). The GDD promised them from the first draft with a function
 * that does not exist in this game ("let defenders through") — nothing of the
 * player's walks. What a gate does here is edit the maze mid-fight: closed it
 * is a wall, open it is a hole, and every attacker re-paths toward the cheapest
 * way in. These tests are the design, stated as behaviour.
 */

const T0 = 1_700_000_000_000;

/** A sealed wall line at x=6 with a gate at (6,5), and one walker on the way. */
function gatedField(): { e: Engine; gate: number } {
  const e = makeSandbox(7);
  const gate = e.grid.idx(6, 5);
  wallLine(e, 0, 6, 5);
  e.enqueue({ tick: 0, type: 'placeWall', cell: gate, kind: 'gate' });
  return { e, gate };
}

describe('a gate is a wall you can open', () => {
  it('is an obstacle while it is shut, and a hole once it is not', () => {
    const { e, gate } = gatedField();
    e.step();
    const def = USA_WALLS['gate']!;
    expect(e.grid.obstacleHpAt(gate)).toBeCloseTo(def.hp, 5);
    expect(e.grid.isOpen(gate)).toBe(false);

    e.grid.setWallOpen(gate, true);
    expect(e.grid.obstacleHpAt(gate)).toBe(0);
    expect(e.grid.isOpen(gate)).toBe(true);
    // Still on the map: an open gate can be shut again. A DESTROYED one cannot.
    expect(e.grid.wallAt(gate)).toBeDefined();
  });

  it('carries less HP than the wall it sits in — a gate is a door', () => {
    // The standing price of building one, paid every hour you are not playing.
    for (const faction of FACTION_IDS) {
      const walls = defenseCatalogFor(faction).walls;
      const wall = walls['wall'];
      const gate = walls['gate'];
      expect(gate, faction).toBeDefined();
      expect(gate!.hp).toBeLessThan(wall!.hp);
      expect(gate!.supplyCost ?? 0).toBeGreaterThan(wall!.supplyCost ?? 0);
      expect(gate!.gateCpCost).toBeGreaterThan(0);
    }
  });

  it('is not something a wall can be mistaken for', () => {
    // No other wall kind answers to the lever, so a stray tap on the wire is
    // refused rather than quietly charged for.
    expect(USA_WALLS['wall']!.gateCpCost).toBeUndefined();
    expect(USA_WALLS['hesco']!.gateCpCost).toBeUndefined();
  });
});

describe('opening one pulls the attack through it', () => {
  /** Where a walker crosses the wall line, or null if it never gets through. */
  function crossing(e: Engine, gate: number, ticks: number): number | null {
    for (let i = 0; i < ticks; i++) {
      e.step();
      for (const a of e.attackers) {
        const cell = e.grid.cellAt(a.pos);
        if (cell % e.grid.width === 6) return cell;
      }
    }
    return null;
  }

  it('routes the assault to the open gate instead of the gap it was using', () => {
    // This is the whole mechanic: A* re-costs the moment the topology moves,
    // and a hole is the cheapest cell on the board.
    const e = makeSandbox(11);
    const gate = e.grid.idx(6, 1);
    // A sealed line except one far gap at y=9 — the natural way round.
    wallLine(e, 0, 6, 9);
    e.enqueue({ tick: 0, type: 'placeWall', cell: gate, kind: 'gate' });
    e.enqueue({ tick: 1, type: 'spawnAttacker', cell: spawnCell(e, 1), kind: 'sealed' });
    e.step();
    e.step();
    // Shut, the walker cannot pass the gate and must walk the length of the
    // line to the gap.
    e.grid.setWallOpen(gate, false);
    const shutRoute = crossing(e, gate, 200);
    expect(shutRoute).not.toBeNull();
    expect(e.grid.yOf(shutRoute!)).toBe(9);

    // Same field, same seed — but the gate is opened before it commits.
    const f = makeSandbox(11);
    wallLine(f, 0, 6, 9);
    f.enqueue({ tick: 0, type: 'placeWall', cell: gate, kind: 'gate' });
    f.enqueue({ tick: 1, type: 'spawnAttacker', cell: spawnCell(f, 1), kind: 'sealed' });
    f.step();
    f.step();
    f.grid.setWallOpen(gate, true);
    const openRoute = crossing(f, gate, 200);
    expect(openRoute).not.toBeNull();
    expect(f.grid.yOf(openRoute!)).toBe(1); // straight through the gate
  });

  it('lets a unit that cannot break anything through at all', () => {
    // A sealed attacker treats every wall as impassable, so an opened gate is
    // the difference between a battle and a stalemate.
    const { e, gate } = gatedField();
    e.enqueue({ tick: 1, type: 'spawnAttacker', cell: spawnCell(e, 5), kind: 'sealed' });
    for (let i = 0; i < 40; i++) e.step();
    const stuck = e.attackers[0]!;
    expect(stuck.state).toBe('stuck');
    e.grid.setWallOpen(gate, true);
    for (let i = 0; i < 120; i++) e.step();
    expect(e.attackers[0]!.state).not.toBe('stuck');
    expect(e.grid.xOf(e.grid.cellAt(e.attackers[0]!.pos))).toBeGreaterThan(6);
  });
});

describe('working a gate costs Command Points', () => {
  const combatField = (): { e: Engine; gate: number } => {
    const e = makeSandbox(3, {
      siege: {
        name: 'gate drill',
        startingSupplies: 400,
        suppliesPerWave: 0,
        startingCp: 20,
        cpCap: 40,
        cpPerSecond: 1,
        prepSeconds: 0,
        repairCostPerHp: 1,
        waves: [{ entries: [{ atTick: 400, kind: 'walker', row: 5, col: 0 }] }],
      },
    });
    const gate = e.grid.idx(6, 5);
    e.enqueue({ tick: 0, type: 'placeWall', cell: gate, kind: 'gate' });
    e.enqueue({ tick: 1, type: 'startAssault' });
    e.step();
    e.step();
    return { e, gate };
  };

  it('charges the swing and refuses one the budget will not cover', () => {
    const { e, gate } = combatField();
    const price = e.cpPrice(TEST_CATALOG.walls['gate']!.gateCpCost!);
    const before = e.cp;
    e.command({ type: 'toggleGate', cell: gate });
    e.step(); // commands land on the tick after they are given
    expect(e.grid.wallAt(gate)!.open).toBe(true);
    expect(e.cp).toBeLessThanOrEqual(before - price + 0.06); // one tick of accrual
    expect(e.cp).toBeGreaterThan(before - price - 0.06);

    e.cp = 0; // nothing left to shut it with
    e.command({ type: 'toggleGate', cell: gate });
    e.step();
    expect(e.grid.wallAt(gate)!.open).toBe(true); // still open, still free
  });

  it('refuses the lever on anything that is not a gate', () => {
    const { e } = combatField();
    const plain = e.grid.idx(6, 6);
    e.grid.placeWall(plain, 150, 'wall');
    const before = e.cp;
    e.command({ type: 'toggleGate', cell: plain });
    e.step();
    expect(e.grid.wallAt(plain)!.open).toBeUndefined();
    // And on empty ground.
    e.command({ type: 'toggleGate', cell: e.grid.idx(3, 3) });
    e.step();
    // Two refused levers cost nothing; CP only moved by the two ticks of accrual.
    expect(e.cp).toBeGreaterThan(before);
  });

  it('will not close on somebody standing in the gateway', () => {
    // The constraint that makes opening a gate a commitment rather than a peek:
    // the way out stays open while anyone is using it.
    // The wave puts a walker down in the gateway itself — spawnAttacker is a
    // sandbox command, and this has to be a real fight for CP to mean anything.
    const e = makeSandbox(3, {
      siege: {
        name: 'gate drill',
        startingSupplies: 400,
        suppliesPerWave: 0,
        startingCp: 20,
        cpCap: 40,
        cpPerSecond: 1,
        prepSeconds: 0,
        repairCostPerHp: 1,
        waves: [{ entries: [{ atTick: 6, kind: 'walker', row: 5, col: 6 }] }],
      },
    });
    const gate = e.grid.idx(6, 5);
    e.enqueue({ tick: 0, type: 'placeWall', cell: gate, kind: 'gate' });
    e.enqueue({ tick: 1, type: 'startAssault' });
    e.enqueue({ tick: 2, type: 'toggleGate', cell: gate });
    for (let i = 0; i < 8; i++) e.step();
    expect(e.grid.wallAt(gate)!.open).toBe(true);
    expect(e.grid.cellAt(e.attackers[0]!.pos)).toBe(gate);
    const before = e.cp;
    e.command({ type: 'toggleGate', cell: gate });
    e.step();
    expect(e.grid.wallAt(gate)!.open).toBe(true); // refused
    expect(e.cp).toBeGreaterThan(before); // and not charged for — CP only accrued
  });
});

describe('an open gate is a gap, not a weaker wall', () => {
  it('takes no damage while it stands open', () => {
    const { e, gate } = gatedField();
    e.step();
    const before = e.grid.wallAt(gate)!.hp;
    e.grid.setWallOpen(gate, true);
    expect(e.grid.damageWall(gate, 1000)).toBe(false);
    expect(e.grid.wallAt(gate)!.hp).toBeCloseTo(before, 5);
    // Shut again, it is a wall again.
    e.grid.setWallOpen(gate, false);
    e.grid.damageWall(gate, 10);
    expect(e.grid.wallAt(gate)!.hp).toBeCloseTo(before - 10, 5);
  });

  it('is a permanent hole once it is actually destroyed', () => {
    const { e, gate } = gatedField();
    e.step();
    expect(e.grid.damageWall(gate, 10_000)).toBe(true);
    expect(e.grid.wallAt(gate)).toBeUndefined();
    // Nothing left to work: the lever finds no wall.
    expect(e.grid.setWallOpen(gate, false)).toBe(false);
  });
});

describe('a gate is part of the battle the replay recorded', () => {
  const run = (toggleAt: number | null): string => {
    const e = makeSandbox(5, {
      siege: {
        name: 'gate replay',
        startingSupplies: 400,
        suppliesPerWave: 0,
        startingCp: 30,
        cpCap: 40,
        cpPerSecond: 1,
        prepSeconds: 0,
        repairCostPerHp: 1,
        waves: [{ entries: [{ atTick: 10, kind: 'sealed', row: 5, col: 0 }] }],
      },
    });
    const gate = e.grid.idx(6, 5);
    wallLine(e, 0, 6, 5);
    e.enqueue({ tick: 0, type: 'placeWall', cell: gate, kind: 'gate' });
    e.enqueue({ tick: 1, type: 'startAssault' });
    if (toggleAt !== null) e.enqueue({ tick: toggleAt, type: 'toggleGate', cell: gate });
    for (let i = 0; i < 300; i++) e.step();
    return e.stateHash();
  };

  it('re-fights identically from the same commands', () => {
    expect(run(20)).toBe(run(20));
  });

  it('and differently when the gate was worked differently', () => {
    // The open flag is in the hash. Without it a replay could diverge on the
    // one decision the feature exists to record and still call itself equal.
    expect(run(20)).not.toBe(run(null));
    expect(run(20)).not.toBe(run(120));
  });
});

describe('the yard treats a gate as a piece of the wall line', () => {
  const devTown = () => {
    const town = unlockAll(newTown(T0));
    town.supplies = 50_000;
    return town;
  };
  const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

  it('costs its own price and refunds it', () => {
    const town = devTown();
    const gateDef = defenseCatalogFor('usa').walls['gate']!;
    const before = town.supplies;
    expect(placeWall(town, idx(5, 5), T0, 'gate')).toBe(true);
    expect(town.supplies).toBe(before - (gateDef.supplyCost ?? 0));
    expect(town.walls[0]).toEqual({ cell: idx(5, 5), kind: 'gate' });
    expect(removeWall(town, idx(5, 5))).toBe(true);
    expect(town.supplies).toBe(before); // refunded at the gate's price, not the wall's
  });

  it('spends two segments of the allowance, not one', () => {
    // The gate's real price, and the only one the measurements support: HP is
    // not what decides a raid, so ring LENGTH is what a hole in the ring costs.
    const town = devTown();
    for (let i = 0; i < 4; i++) placeWall(town, idx(4 + i, 8), T0, i % 2 ? 'gate' : 'wall');
    expect(town.walls).toHaveLength(4);
    expect(wallSegments(town)).toBe(6); // two walls + two gates at two apiece
    expect(canPlaceWall(town, idx(4, 8), 'gate')).toBe('occupied');
    expect(canPlaceWall(town, idx(9, 8), 'nonesuch')).toBe('unknown');
  });

  it('runs the ring out of allowance sooner than plain wire does', () => {
    // Free cells well clear of the spawn column and the command post.
    const cells = Array.from({ length: 300 }, (_, i) => idx(1 + (i % 20), 2 + Math.floor(i / 20)));
    const lay = (kind: string): number => {
      const town = devTown();
      let n = 0;
      for (const cell of cells) {
        if (!placeWall(town, cell, T0, kind)) break;
        n++;
      }
      return n;
    };
    const wire = lay('wall');
    const gates = lay('gate');
    expect(wire).toBeGreaterThan(0);
    expect(gates).toBe(Math.floor(wire / GATE_SEGMENTS));
  });

  it('survives into the battle as a gate, not as a wall', () => {
    // The town layout is the battlefield; a gate that arrived as plain wire
    // would be a lever the commander cannot find.
    const town = devTown();
    placeWall(town, idx(5, 5), T0, 'gate');
    const wall = town.walls.find((w) => w.cell === idx(5, 5))!;
    expect(wall.kind).toBe('gate');
    expect(defenseCatalogFor(town.faction).walls[wall.kind]?.gateCpCost).toBeGreaterThan(0);
  });
});
