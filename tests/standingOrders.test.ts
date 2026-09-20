import { describe, expect, it } from 'vitest';
import { buildAssault } from '../src/content/assaults';
import { defenseCatalogFor, enemyRosterFor, FACTION_IDS } from '../src/content/factions';
import { STANDING_ORDERS, STANDING_ORDER_IDS } from '../src/content/standingOrders';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, onSpawnLane, unlockAll, TOWN_GRID } from '../src/meta/town';
import { runOfflineProbes, PROBE_INTERVAL_MS } from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';
import type { SimConfig, StandingOrders } from '../src/sim/types';

const T0 = 1_700_000_000_000;
const W = TOWN_GRID.width;
const H = TOWN_GRID.height;
/** Approach space, as the balance harness writes it: depth, then across. */
const idx = (u: number, v: number) => u * W + v;

/** The balance harness's MID reference base, the standing-orders test bed. */
function midConfig(seed: number, orders?: StandingOrders, level = 5): SimConfig {
  const walls: { cell: number; kind: string }[] = [];
  for (let v = 1; v <= 18; v++) {
    if (v !== 9 && v !== 10) walls.push({ cell: idx(20, v), kind: 'wall' });
    if (![3, 4, 15, 16].includes(v)) walls.push({ cell: idx(24, v), kind: 'wall' });
  }
  return {
    width: W,
    height: H,
    seed,
    ccOrigin: TOWN_GRID.ccOrigin,
    ccLevel: 2,
    spawnLane: TOWN_GRID.spawnLane,
    spawnEdge: TOWN_GRID.spawnEdge,
    siege: { ...buildAssault(level, enemyRosterFor('usa')), startingSupplies: 0 },
    layout: {
      walls,
      structures: [
        { cell: idx(22, 8), kind: 'm2nest', level: 2 },
        { cell: idx(22, 11), kind: 'm2nest', level: 2 },
        { cell: idx(25, 6), kind: 'autocannon', level: 2 },
        { cell: idx(25, 13), kind: 'autocannon', level: 2 },
      ],
    },
    powerCharges: { a10: 2, arty: 1 },
    ...(orders ? { standingOrders: orders } : {}),
  };
}

function runOut(config: SimConfig): Engine {
  const engine = new Engine(config, defenseCatalogFor('usa'));
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) {
    engine.step();
  }
  return engine;
}

describe('standing orders in the engine', () => {
  it('every preset kind resolves in every faction defense catalog', () => {
    for (const id of STANDING_ORDER_IDS) {
      for (const rule of STANDING_ORDERS[id].rules) {
        for (const faction of FACTION_IDS) {
          const catalog = defenseCatalogFor(faction);
          const table = rule.action === 'power' ? catalog.powers : catalog.structures;
          expect(table[rule.kind], `${faction} lacks '${rule.kind}' (${id})`).toBeDefined();
        }
      }
    }
  });

  it('spends CP and deploys field works the bare battle never gets', () => {
    const bare = runOut(midConfig(41));
    const ordered = runOut(midConfig(41, STANDING_ORDERS.holdfast));
    expect(bare.stats.cpSpent).toBe(0);
    expect(ordered.stats.cpSpent).toBeGreaterThan(0);
    expect(ordered.ordersExecuted).toBeGreaterThan(0);
    expect(ordered.ordersExecuted).toBeLessThanOrEqual(
      STANDING_ORDERS.holdfast.maxActions ?? Infinity,
    );
  });

  /**
   * The invariant `--leverage` rests on. That table reads the defender's policy
   * as its only variable, but its baseline column has an EMPTY magazine while
   * every policy column has a stocked one — so "a policy did worse than doing
   * nothing" would be two variables, not one, if a magazine did anything by
   * itself. It does not: nothing casts a power unless a policy or an autoPower
   * rule asks for it, so the charges sit there.
   */
  it('a magazine with no policy to spend it changes nothing at all', () => {
    for (const seed of [41, 7, 13]) {
      const stocked = runOut(midConfig(seed));
      const bare = runOut({ ...midConfig(seed), powerCharges: {} });
      // Liveness first: two battles that agree because neither happened is not
      // a passing test.
      expect(stocked.tick).toBeGreaterThan(200);
      expect(stocked.stats.kills).toBeGreaterThan(0);
      expect(stocked.stats.cpSpent).toBe(0);
      // NOT stateHash: it folds in `chargesLeft`, so a stocked battle cannot
      // hash equal to a bare one however identically the two are fought. What
      // is being claimed is that everything the battle DOES is the same, so
      // that is what gets compared.
      expect(bare.tick).toBe(stocked.tick);
      expect(bare.phase).toBe(stocked.phase);
      expect(bare.cc.hp).toBe(stocked.cc.hp);
      expect(bare.stats).toEqual(stocked.stats);
      expect(bare.attackers.map((a) => `${a.id}:${a.hp}:${a.state}`)).toEqual(
        stocked.attackers.map((a) => `${a.id}:${a.hp}:${a.state}`),
      );
      expect(bare.structures.map((st) => `${st.id}:${st.hp}`)).toEqual(
        stocked.structures.map((st) => `${st.id}:${st.hp}`),
      );
    }
  });

  it('respects the action budget', () => {
    const single: StandingOrders = {
      id: 'test',
      maxActions: 1,
      rules: [
        { cpAtLeast: 0, action: 'deploy', kind: 'depmg', target: 'densest', cooldownTicks: 1 },
      ],
    };
    const engine = runOut(midConfig(7, single));
    expect(engine.ordersExecuted).toBe(1);
  });

  it('holds its CP reserve: no actions below cpAtLeast', () => {
    const greedy: StandingOrders = {
      id: 'test',
      rules: [
        { cpAtLeast: 10_000, action: 'deploy', kind: 'depmg', target: 'densest', cooldownTicks: 1 },
      ],
    };
    const engine = runOut(midConfig(7, greedy));
    expect(engine.ordersExecuted).toBe(0);
    expect(engine.stats.cpSpent).toBe(0);
  });

  it('is deterministic: same config and orders → identical state hash', () => {
    const a = runOut(midConfig(1234, STANDING_ORDERS.holdfast));
    const b = runOut(midConfig(1234, STANDING_ORDERS.holdfast));
    expect(a.stateHash()).toBe(b.stateHash());
    expect(a.tick).toBe(b.tick);
  });
});

describe('standing orders in the meta', () => {
  it('offline probes fight under the town orders and log them', () => {
    const town = unlockAll(newTown(T0, 'usa'));
    town.standingOrders = 'holdfast';
    town.assaultLevel = 4;
    town.lastSeen = T0;
    const ran = runOfflineProbes(town, T0 + PROBE_INTERVAL_MS + 60_000);
    expect(ran.length).toBeGreaterThan(0);
    expect(ran[0]!.orders).toBe('holdfast');
    expect(ran[0]!.config.standingOrders?.id).toBe('holdfast');
    // The logged config replays to the same outcome.
    const catalog = defenseCatalogFor('usa');
    const replayA = new Engine(ran[0]!.config, catalog);
    const replayB = new Engine(ran[0]!.config, catalog);
    for (const engine of [replayA, replayB]) {
      engine.enqueue({ tick: 0, type: 'startAssault' });
      engine.run(4000);
    }
    expect(replayA.stateHash()).toBe(replayB.stateHash());
  });

  it('every reference cell is on the board and clear of the entry lane', () => {
    // Was `TOWN_GRID.width === 32`, which stopped meaning anything the moment
    // W came from TOWN_GRID. What this bed actually needs is that the base it
    // builds exists: a wall or a gun quietly off the edge would wrap to the
    // far side of the board, and the battle would still run.
    const config = midConfig(1);
    const cells = [
      TOWN_GRID.ccOrigin,
      ...config.layout!.walls.map((w) => w.cell),
      ...config.layout!.structures.map((st) => st.cell),
    ];
    expect(cells.length).toBeGreaterThan(20);
    for (const cell of cells) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(W * H);
      expect(onSpawnLane(cell), `cell ${cell} sits on the entry lane`).toBe(false);
    }
  });

  it('round-trips through the save and rejects junk values', () => {
    const town = unlockAll(newTown(T0, 'russia'));
    town.standingOrders = 'tripwire';
    const back = deserialize(serialize(town));
    expect(back!.standingOrders).toBe('tripwire');

    const raw = JSON.parse(serialize(town)) as { town: Record<string, unknown> };
    raw.town['standingOrders'] = 'blitz';
    const cleaned = deserialize(JSON.stringify(raw));
    expect(cleaned!.standingOrders).toBeNull();
  });
});
