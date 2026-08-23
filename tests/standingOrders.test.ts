import { describe, expect, it } from 'vitest';
import { buildAssault } from '../src/content/assaults';
import { defenseCatalogFor, enemyRosterFor, FACTION_IDS } from '../src/content/factions';
import { STANDING_ORDERS, STANDING_ORDER_IDS } from '../src/content/standingOrders';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, unlockAll, TOWN_GRID } from '../src/meta/town';
import { runOfflineProbes, PROBE_INTERVAL_MS } from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';
import type { SimConfig, StandingOrders } from '../src/sim/types';

const T0 = 1_700_000_000_000;
const W = 32;
const H = 24;
const idx = (x: number, y: number) => y * W + x;

/** The balance harness's MID reference base, the standing-orders test bed. */
function midConfig(seed: number, orders?: StandingOrders, level = 5): SimConfig {
  const walls: { cell: number; kind: string }[] = [];
  for (let y = 2; y <= 21; y++) {
    if (y !== 11 && y !== 12) walls.push({ cell: idx(20, y), kind: 'wall' });
    if (![5, 6, 17, 18].includes(y)) walls.push({ cell: idx(24, y), kind: 'wall' });
  }
  return {
    width: W,
    height: H,
    seed,
    ccOrigin: 11 * W + 27,
    ccLevel: 2,
    spawnColumn: 0,
    siege: { ...buildAssault(level, enemyRosterFor('usa')), startingSupplies: 0 },
    layout: {
      walls,
      structures: [
        { cell: idx(22, 10), kind: 'm2nest', level: 2 },
        { cell: idx(22, 13), kind: 'm2nest', level: 2 },
        { cell: idx(25, 8), kind: 'autocannon', level: 2 },
        { cell: idx(25, 15), kind: 'autocannon', level: 2 },
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

  it('town grid is wide enough for the reference cells', () => {
    expect(TOWN_GRID.width).toBe(W);
    expect(TOWN_GRID.height).toBe(H);
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
