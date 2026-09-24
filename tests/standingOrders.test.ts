import { describe, expect, it } from 'vitest';
import { buildAssault } from '../src/content/assaults';
import { defenseCatalogFor, enemyRosterFor, FACTION_IDS } from '../src/content/factions';
import { STANDING_ORDERS, STANDING_ORDER_IDS, standingOrdersFor } from '../src/content/standingOrders';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { deserialize, serialize } from '../src/meta/save';
import {
  caps,
  defenseConfig,
  probeConfig,
  newTown,
  onSpawnLane,
  outcomeFromEngine,
  place,
  placeWall,
  tick,
  unlockAll,
  upgrade,
  TOWN_GRID,
} from '../src/meta/town';
import { TEST_CATALOG, yardTown } from './helpers';
import {
  applyLiveDefense,
  claimLiveDefense,
  declineLiveDefense,
  liveDefenseBounty,
  liveDefenseConfig,
  probeLevel,
  runOfflineProbes,
  PROBE_INTERVAL_MS,
} from '../src/meta/warfare';
import { siegeOnBoard } from '../src/sim/board';
import { Engine } from '../src/sim/engine';
import { CHAIN_AIMED, CHAIN_CURRENT, CHAIN_ENGAGE, CHAIN_PINNED } from '../src/sim/killchain';
import type { SimConfig, StandingOrders } from '../src/sim/types';

const T0 = 1_700_000_000_000;
const W = TOWN_GRID.width;
const H = TOWN_GRID.height;
/** Approach space, as the balance harness writes it: depth, then across. */
const idx = (u: number, v: number) => u * W + v;

/**
 * The balance harness's MID reference base, the standing-orders test bed —
 * drawn for 10x15 as `--native` draws it: in at the centre past two nests,
 * out near an edge past the autocannons.
 */
function midConfig(seed: number, orders?: StandingOrders, level = 5): SimConfig {
  const walls: { cell: number; kind: string }[] = [];
  for (let v = 1; v <= 8; v++) {
    if (v !== 4) walls.push({ cell: idx(8, v), kind: 'wall' });
    if (v !== 1 && v !== 8) walls.push({ cell: idx(11, v), kind: 'wall' });
  }
  return {
    width: W,
    height: H,
    cellSize: TOWN_GRID.cellSize,
    seed,
    ccOrigin: TOWN_GRID.ccOrigin,
    ccLevel: 2,
    spawnLane: TOWN_GRID.spawnLane,
    spawnEdge: TOWN_GRID.spawnEdge,
    siege: siegeOnBoard(
      { ...buildAssault(level, enemyRosterFor('usa')), startingSupplies: 0 },
      TOWN_GRID.cellSize,
    ),
    layout: {
      walls,
      structures: [
        { cell: idx(9, 3), kind: 'm2nest', level: 2 },
        { cell: idx(9, 5), kind: 'm2nest', level: 2 },
        { cell: idx(12, 2), kind: 'autocannon', level: 2 },
        { cell: idx(12, 7), kind: 'autocannon', level: 2 },
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
    // Level 6: at 5 this base holds its walls with nobody acting, and since
    // M23 Phase 5 HOLDFAST's gun run waits for an assault on the post, so a
    // battle that never reaches the post is one it rightly spends nothing on.
    const bare = runOut(midConfig(41, undefined, 6));
    const ordered = runOut(midConfig(41, STANDING_ORDERS.holdfast, 6));
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

  /**
   * v1.42 added two optional order mechanics that were MEASURED AND NOT
   * ADOPTED (see ROADMAP M23 Phase 2). They stay in the type because the
   * instrument that priced them is worth keeping, which makes this the load
   * bearing test: absent, they must change nothing at all, or every archived
   * replay re-fights a battle it did not record.
   */
  it('the unadopted order mechanics are inert unless asked for', () => {
    for (const seed of [41, 7]) {
      const shipped = runOut(midConfig(seed, STANDING_ORDERS.tripwire));
      const spelled = runOut(
        midConfig(seed, { ...STANDING_ORDERS.tripwire, fairShare: false, perWave: false }),
      );
      expect(shipped.tick).toBeGreaterThan(200);
      expect(shipped.ordersExecuted).toBeGreaterThan(0);
      expect(spelled.stateHash()).toBe(shipped.stateHash());
    }
    // And asked for, each one actually does something — a flag that is inert
    // when set is not a flag, it is a typo nobody notices.
    const base = runOut(midConfig(41, STANDING_ORDERS.tripwire));
    const shared = runOut(midConfig(41, { ...STANDING_ORDERS.tripwire, fairShare: true }));
    expect(shared.stateHash()).not.toBe(base.stateHash());
    // `perWave` only has anything to refill in a battle that reaches a second
    // wave, so it is asserted across levels rather than on one: on a defence
    // that is overrun in wave one it legitimately does nothing, and a test
    // that demanded otherwise would be wrong about the mechanic.
    const movedSomewhere = [3, 4, 5].some(
      (level) =>
        runOut(midConfig(41, { ...STANDING_ORDERS.tripwire, perWave: true }, level)).stateHash() !==
        runOut(midConfig(41, STANDING_ORDERS.tripwire, level)).stateHash(),
    );
    expect(movedSomewhere, 'perWave changed nothing at any level').toBe(true);
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

describe('rule order as priority (M23 Phase 6)', () => {
  /** A rule that stands up a gun on the densest knot, at `cpAtLeast`. */
  const gun = (cpAtLeast: number, minHostiles = 1): StandingOrders['rules'][number] => ({
    cpAtLeast,
    action: 'deploy',
    kind: 'depmg',
    target: 'densest',
    minHostiles,
    cooldownTicks: 20,
  });
  const mine = (cpAtLeast: number): StandingOrders['rules'][number] => ({
    cpAtLeast,
    action: 'deploy',
    kind: 'claymore',
    target: 'densest',
    cooldownTicks: 20,
  });

  it('is inert unless asked for, and asked for it fights another battle', () => {
    for (const seed of [41, 7]) {
      const shipped = runOut(midConfig(seed, STANDING_ORDERS.tripwire));
      const spelled = runOut(midConfig(seed, { ...STANDING_ORDERS.tripwire, priority: false }));
      expect(shipped.ordersExecuted).toBeGreaterThan(0);
      expect(spelled.stateHash()).toBe(shipped.stateHash());
    }
    // TRIPWIRE with its gun first, on a battle that starts with no CP, so the
    // gun has to save for itself: evaluated first, the claymore spends as the
    // CP comes in and the gun waits; funded first, the claymore waits for it.
    const gunFirst = { ...STANDING_ORDERS.tripwire, rules: [1, 0, 2].map((k) => STANDING_ORDERS.tripwire.rules[k]!) };
    const broke = (orders: StandingOrders): SimConfig => {
      const config = midConfig(41, orders, 6);
      return { ...config, siege: { ...config.siege!, startingCp: 0 } };
    };
    const evaluated = runOut(broke(gunFirst));
    const funded = runOut(broke({ ...gunFirst, priority: true }));
    expect(funded.stateHash()).not.toBe(evaluated.stateHash());
  });

  it('a rule saving for its reserve holds back every rule below it', () => {
    // The gun can never be afforded, and wants to act the whole battle: the
    // mine below it would be spending all battle without priority.
    const orders: StandingOrders = { id: 'test', maxActions: 3, rules: [gun(10_000), mine(0)] };
    const evaluated = runOut(midConfig(7, orders));
    expect(evaluated.ordersExecuted).toBeGreaterThan(0);
    const funded = runOut(midConfig(7, { ...orders, priority: true }));
    expect(funded.ordersExecuted).toBe(0);
    expect(funded.stats.cpSpent).toBe(0);
  });

  it('a rule that does not want to act holds nothing back', () => {
    // The gun waits for a crowd that never comes, so it never saves for anything.
    const orders: StandingOrders = { id: 'test', maxActions: 3, rules: [gun(10_000, 10_000), mine(0)], priority: true };
    expect(runOut(midConfig(7, orders)).ordersExecuted).toBeGreaterThan(0);
  });

  it('keeps an action in hand for each rule above that has not acted', () => {
    const orders: StandingOrders = { id: 'test', maxActions: 2, rules: [gun(0, 10_000), mine(0)] };
    expect(runOut(midConfig(7, orders)).ordersExecuted).toBe(2);
    // The gun above never acts, so of two actions the mine may have one.
    expect(runOut(midConfig(7, { ...orders, priority: true })).ordersExecuted).toBe(1);
  });
});

describe("the duty officer's aim (chain v5, M23 Phase 3c)", () => {
  /**
   * The town board with nothing on it but the post, and a file of walkers
   * coming straight down column 4 onto it from the north edge: the geometry
   * every siege on this board has, with nothing else in the way.
   */
  const fileConfig = (chain: number, orders: StandingOrders, cellSize: number = TOWN_GRID.cellSize): SimConfig => ({
    width: W,
    height: H,
    cellSize,
    seed: 5,
    ccOrigin: TOWN_GRID.ccOrigin,
    spawnLane: TOWN_GRID.spawnLane,
    spawnEdge: TOWN_GRID.spawnEdge,
    killChainVersion: chain,
    siege: {
      name: 'file',
      startingSupplies: 0,
      suppliesPerWave: 0,
      startingCp: 200,
      cpCap: 200,
      cpPerSecond: 0,
      prepSeconds: 0,
      repairCostPerHp: 0,
      waves: [{ entries: [0, 40, 80, 120].map((atTick) => ({ atTick, kind: 'walker', col: 4 })) }],
    },
    powerCharges: { a10: 1 },
    standingOrders: orders,
  });
  const start = (config: SimConfig): Engine => {
    const engine = new Engine(config, TEST_CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    return engine;
  };

  it('a gun run ordered onto a walking file lands on it, where v4 lands where it was', () => {
    // Cast when the second walker arrives: the first has been walking for two
    // seconds, so it has a heading to lead.
    const strafe: StandingOrders = {
      id: 'test',
      maxActions: 1,
      rules: [{ cpAtLeast: 0, action: 'power', kind: 'a10', target: 'densest', minHostiles: 2, cooldownTicks: 1 }],
    };
    const run = (chain: number) => {
      const engine = start(fileConfig(chain, strafe));
      let cast = -1;
      for (let i = 0; i < 600 && (cast < 0 || engine.tick < cast + 40); i++) {
        for (const ev of engine.step()) if (ev.type === 'powerCast') cast = engine.tick;
      }
      const hurt = engine.attackers.reduce((sum, a) => sum + (a.maxHp - Math.max(0, a.hp)), 0);
      return { cast, kills: engine.stats.kills, hurt };
    };
    const v4 = run(CHAIN_ENGAGE);
    const v5 = run(CHAIN_AIMED);
    // Liveness: both cast it, at the same moment, at the same file.
    expect(v4.cast).toBeGreaterThan(0);
    expect(v5.cast).toBe(v4.cast);
    // v4: half a second later the strip is where the file was, and the file
    // has walked out of it. Nobody so much as scratched.
    expect(v4.kills).toBe(0);
    expect(v4.hurt).toBe(0);
    // v5: laid ahead of the lead walker, which walks into it.
    expect(v5.kills).toBeGreaterThan(0);
  });

  it('the approach gun goes down three units out, where it went on the 20x30 board', () => {
    const approach: StandingOrders = {
      id: 'test',
      maxActions: 1,
      rules: [{ cpAtLeast: 0, action: 'deploy', kind: 'depmg', target: 'ccApproach', minHostiles: 1, cooldownTicks: 1 }],
    };
    /** How far from the post's centre the order put its gun, in physical units. */
    const reach = (chain: number, cellSize: number) => {
      const engine = start(fileConfig(chain, approach, cellSize));
      for (let i = 0; i < 600 && engine.ordersExecuted === 0; i++) engine.step();
      const gun = engine.structures.find((st) => st.profile.kind === 'depmg');
      expect(gun, `chain ${chain} at cell size ${cellSize} never deployed`).toBeDefined();
      const dx = gun!.center.x - engine.cc.center.x;
      const dy = gun!.center.y - engine.cc.center.y;
      return Math.sqrt(dx * dx + dy * dy) * cellSize;
    };
    // The order is "three out", written when a cell was a unit. v4 reads it
    // as three of this board's cells, six units: twice as far as written.
    expect(reach(CHAIN_ENGAGE, 2)).toBe(6);
    // v5 reads it as three units, and the first whole cell inside that is
    // the one beside the post.
    expect(reach(CHAIN_AIMED, 2)).toBeLessThanOrEqual(3);
    // On a board of cell size 1 the two readings are one number.
    expect(reach(CHAIN_AIMED, 1)).toBe(reach(CHAIN_ENGAGE, 1));
  });

  it('HOLDFAST meets them at the hole from v5, and a battle fought before it gets back its own', () => {
    const v5 = standingOrdersFor('holdfast', CHAIN_AIMED)!;
    expect(v5.rules.filter((r) => r.action === 'deploy').every((r) => r.target === 'breach')).toBe(true);
    // A probe fought on chain 4 re-fights with the inner-line gun it had.
    const then = standingOrdersFor('holdfast', CHAIN_ENGAGE)!;
    expect(then.rules.map((r) => r.target)).toEqual(['breach', 'ccApproach', 'densest']);
    expect(v5.rules.map((r) => r.target)).toEqual(['breach', 'breach', 'densest']);
    // And a code says which: the reader resolves the id against the chain.
    for (const [chain, want] of [
      [CHAIN_ENGAGE, then],
      [CHAIN_AIMED, v5],
    ] as const) {
      const config = { ...midConfig(3, want), killChainVersion: chain };
      const round = decodeReplay(encodeReplay({ kind: 'probe', faction: 'usa', title: 'T', won: true, config }));
      expect(round.ok).toBe(true);
      if (round.ok) expect(round.replay.config.standingOrders).toEqual(want);
    }
    // TRIPWIRE never changed, so every chain reads it the same.
    for (const chain of [CHAIN_ENGAGE, CHAIN_AIMED, CHAIN_PINNED]) {
      expect(standingOrdersFor('tripwire', chain)).toBe(STANDING_ORDERS.tripwire);
    }
  });

  it('a board of cell size 1 fights a deploy-only doctrine identically on v4 and v5', () => {
    // Every battle v4 and older ever shipped was on such a board, and the
    // only other thing v5 changes is where a fire mission is laid.
    const hash = (chain: number) => {
      const engine = new Engine(
        { ...midConfig(41, STANDING_ORDERS.tripwire), cellSize: 1, killChainVersion: chain },
        defenseCatalogFor('usa'),
      );
      engine.enqueue({ tick: 0, type: 'startAssault' });
      engine.run(3000);
      expect(engine.ordersExecuted).toBeGreaterThan(0);
      return engine.stateHash();
    };
    expect(hash(CHAIN_AIMED)).toBe(hash(CHAIN_ENGAGE));
  });
});

/**
 * Fire missions the chain can see (chain v6, M23 Phase 5): a strike pins what
 * it lands on, and the duty officer waits for the assault to reach the post
 * before calling one.
 */
describe('fire on the assault (chain v6, M23 Phase 5)', () => {
  const onChain = (seed: number, orders: StandingOrders, level = 6): SimConfig => ({
    ...midConfig(seed, orders, level),
    killChainVersion: CHAIN_CURRENT,
  });
  const gunRunOn = (target: 'assault' | 'densest', minKnot?: number): StandingOrders => ({
    id: 'probe',
    maxActions: 2,
    rules: [
      {
        cpAtLeast: 45,
        action: 'power',
        kind: 'a10',
        target,
        minHostiles: 1,
        cooldownTicks: 200,
        ...(minKnot !== undefined ? { minKnot } : {}),
      },
    ],
  });
  /** Every gun run the battle called, with where the attack was when it did. */
  const casts = (config: SimConfig) => {
    const engine = new Engine(config, defenseCatalogFor('usa'));
    engine.enqueue({ tick: 0, type: 'startAssault' });
    const out: { nearest: number; inRing: number }[] = [];
    while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) {
      for (const ev of engine.step()) {
        if (ev.type !== 'powerCast') continue;
        const cc = engine.cc.center;
        const ground = engine.attackers.filter((a) => a.hp > 0 && !a.profile.air);
        const dist = ground.map((a) => Math.hypot(a.pos.x - cc.x, a.pos.y - cc.y));
        out.push({ nearest: Math.min(...dist), inRing: dist.filter((d) => d <= 2).length });
      }
    }
    return out;
  };

  it('an order on the assault waits for it to reach the post', () => {
    const seen = [41, 7, 13].flatMap((seed) => casts(onChain(seed, gunRunOn('assault'))));
    expect(seen.length, 'no gun run was ever called').toBeGreaterThan(0);
    // The ring is the post's cover radius: 4 units, 2 cells on this board.
    for (const cast of seen) expect(cast.nearest).toBeLessThanOrEqual(2);
    // Where the same order on the densest knot goes the moment it can pay.
    const eager = [41, 7, 13].flatMap((seed) => casts(onChain(seed, gunRunOn('densest'))));
    expect(eager.some((cast) => cast.nearest > 2)).toBe(true);
  });

  it('and one that asks for a knot waits for that many', () => {
    // Level 8, where the assault masses on the post: at 6 the base holds it
    // off before three are ever in the ring together.
    const seen = [41, 7, 13].flatMap((seed) => casts(onChain(seed, gunRunOn('assault', 3), 8)));
    expect(seen.length, 'no gun run was ever called').toBeGreaterThan(0);
    for (const cast of seen) expect(cast.inRing).toBeGreaterThanOrEqual(3);
  });

  it('HOLDFAST fires on the assault from v6, and a battle fought on v5 gets its own back', () => {
    const now = standingOrdersFor('holdfast')!;
    expect(now).toBe(STANDING_ORDERS.holdfast);
    const fire = now.rules.filter((r) => r.action === 'power');
    expect(fire.length).toBeGreaterThan(0);
    for (const rule of fire) {
      expect(rule.target).toBe('assault');
      expect(rule.minKnot ?? 1).toBeGreaterThan(1);
    }
    // A battle fought on v5 re-fights with the orders it had, on the mass.
    const v5 = standingOrdersFor('holdfast', CHAIN_AIMED)!;
    expect(v5.rules.filter((r) => r.action === 'power').every((r) => r.target === 'densest')).toBe(true);
    for (const [chain, want] of [
      [CHAIN_AIMED, v5],
      [CHAIN_PINNED, now],
    ] as const) {
      const config = { ...midConfig(3, want), killChainVersion: chain };
      const round = decodeReplay(encodeReplay({ kind: 'probe', faction: 'usa', title: 'T', won: true, config }));
      expect(round.ok).toBe(true);
      if (round.ok) expect(round.replay.config.standingOrders).toEqual(want);
    }
    // COUNTERBATTERY was measured re-aimed and kept as it stands, so every
    // chain reads it the same, as it does TRIPWIRE.
    for (const chain of [CHAIN_ENGAGE, CHAIN_AIMED, CHAIN_PINNED]) {
      expect(standingOrdersFor('counterbattery', chain)).toBe(STANDING_ORDERS.counterbattery);
    }
  });
});

/**
 * A town with a garrison in it, last seen at `T`.
 *
 * A bare `newTown` breaches on the first probe at every level — nothing is
 * built, so nothing defends — and a breach ends the sweep before the offer
 * is ever reached. A test about probes that HOLD needs guns, walls and a CC
 * that has been grown. Clear ground (`yardTown`) so the emplacements land
 * where they are asked for.
 */
function gunnedTown(T: number): ReturnType<typeof newTown> {
  const at = (u: number, v: number) => u * W + v;
  const t = unlockAll(yardTown(T - 1_000_000, 'usa'));
  t.supplies = 50_000;
  t.fuel = 50_000;
  upgrade(t, 1, T - 900_000);
  tick(t, T - 800_000);
  // A line with its gap over the post, three guns behind it and a mortar
  // behind them — drawn for 10x15.
  place(t, 'm2nest', at(10, 3), T - 700_000);
  place(t, 'm2nest', at(10, 6), T - 700_000);
  place(t, 'autocannon', at(10, 4), T - 700_000);
  place(t, 'mortar', at(12, 3), T - 700_000);
  for (let v = 1; v <= 3; v++) placeWall(t, at(9, v));
  for (let v = 6; v <= 8; v++) placeWall(t, at(9, v));
  tick(t, T);
  t.assaultLevel = 4;
  t.lastSeen = T;
  // Inside the caps (1200 / 350 at CC2, no bunker). Only the live-defence
  // path clamps to caps, so stores parked above them would come back as
  // battle damage in a test that is measuring battle damage.
  t.supplies = 1000;
  t.fuel = 200;
  return t;
}

describe('standing orders in the meta', () => {
  it("a probe bills the town for its own buildings, not for the mines its garrison spent", () => {
    // One nest by the post: enough to hold a level-6 probe with nothing lost,
    // close enough in that TRIPWIRE's mines are walked into before it does.
    const town = unlockAll(yardTown(T0 - 1_000_000, 'usa'));
    town.supplies = 50_000;
    town.fuel = 50_000;
    upgrade(town, 1, T0 - 900_000);
    tick(town, T0 - 800_000);
    place(town, 'm2nest', 12 * W + 3, T0 - 700_000);
    tick(town, T0);
    town.standingOrders = 'tripwire';
    // A probe's level is the rung, capped at one past the front line's tier.
    town.assaultLevel = 6;
    town.frontline.tier = 5;
    expect(probeLevel(town)).toBe(6);
    town.lastSeen = T0;
    town.supplies = 1000;
    town.fuel = 200;
    const ran = runOfflineProbes(town, T0 + 2 * PROBE_INTERVAL_MS + 60_000);
    expect(ran.length).toBeGreaterThan(0);
    const probe = ran[0]!;
    // Re-fight it to see what went: every structure the battle lost, and the
    // town's own among them, told apart as a played siege tells them apart.
    const engine = new Engine(probe.config, defenseCatalogFor('usa'));
    const own = () => engine.structures.filter((s) => s.profile.kind !== 'cc' && s.hp > 0 && s.profile.cpCost === undefined).length;
    const standing = own();
    engine.enqueue({ tick: 0, type: 'startAssault' });
    while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 8000) engine.step();
    const ownLost = standing - own();
    // Liveness: the garrison's mines went off, and the town held with every
    // building standing — so the old bill would have charged for the mines.
    expect(probe.held).toBe(true);
    expect(engine.stats.structuresLost).toBeGreaterThan(ownLost);
    expect(ownLost).toBe(0);
    expect(probe.suppliesLost).toBe(0);
    expect(probe.fuelLost).toBe(0);
  });

  it('offline probes fight under the town orders and log them', () => {
    const town = unlockAll(newTown(T0, 'usa'));
    town.standingOrders = 'holdfast';
    town.assaultLevel = 4;
    town.lastSeen = T0;
    // TWO intervals: v1.43 holds the last probe of an absence back as a live
    // offer, so a one-interval absence now resolves nothing at all. What this
    // test is about — that the orders ride the config — needs a probe that
    // actually resolved.
    const ran = runOfflineProbes(town, T0 + 2 * PROBE_INTERVAL_MS + 60_000);
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
    // The post, thirteen walls and four guns: a base, not an empty board.
    expect(cells.length).toBe(18);
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
describe('the live-defence offer', () => {
  const T = 1_800_000_000_000;
  const town = () => gunnedTown(T);

  it('holds the LAST probe of an absence back and resolves the rest', () => {
    const t = town();
    const ran = runOfflineProbes(t, T + 3 * PROBE_INTERVAL_MS + 60_000);
    // Three were due; two happened while nobody was watching and the third
    // has not happened yet.
    expect(ran.length).toBe(2);
    expect(t.pendingDefense).toBeDefined();
    expect(t.pendingDefense!.level).toBe(probeLevel(t));
  });

  it('a bare town gets the offer too — one interval away is always an offer', () => {
    // The garrisoned bed above is what the rest of these need, but it is not
    // what a new player has. A bare `newTown` BREACHES on the first probe at
    // every level, which ends the sweep — so if the offer were the last of
    // several, the players most in need of it would never see one.
    //
    // One interval away holds exactly one probe, and the one probe is the one
    // held back. Nothing resolves, so nothing can breach first.
    const t = unlockAll(newTown(T, 'usa'));
    t.assaultLevel = 4;
    t.lastSeen = T;
    const ran = runOfflineProbes(t, T + PROBE_INTERVAL_MS + 60_000);
    expect(ran).toEqual([]);
    expect(t.pendingDefense).toBeDefined();
    expect(liveDefenseConfig(t)).not.toBeNull();

    // And a LONGER absence on the same undefended town does not: the first
    // probe gets through, the shield goes up, and nothing is inbound to
    // defend. Being overrun is an answer to "what happened while I was gone".
    const overrun = unlockAll(newTown(T, 'usa'));
    overrun.assaultLevel = 4;
    overrun.lastSeen = T;
    const swept = runOfflineProbes(overrun, T + 3 * PROBE_INTERVAL_MS + 60_000);
    expect(swept.some((e) => !e.held)).toBe(true);
    expect(overrun.pendingDefense).toBeUndefined();
    expect(overrun.shieldUntil).toBeGreaterThan(T);
  });

  it('offers the attack that was actually coming, not a fresh one', () => {
    const a = town();
    runOfflineProbes(a, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const b = town();
    runOfflineProbes(b, T + 2 * PROBE_INTERVAL_MS + 60_000);
    expect(a.pendingDefense!.seed).toBe(b.pendingDefense!.seed);
    const config = liveDefenseConfig(a)!;
    expect(config).not.toBeNull();
    expect(config.seed).toBe(a.pendingDefense!.seed);
  });

  it('declining costs exactly what never being offered would have', () => {
    const declined = town();
    runOfflineProbes(declined, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const pending = declined.pendingDefense!;
    const entry = declineLiveDefense(declined, T + 2 * PROBE_INTERVAL_MS + 60_000)!;
    expect(entry).not.toBeNull();
    expect(declined.pendingDefense).toBeUndefined();
    // It is the probe that was offered, fought under its own seed, and it is
    // on the log like any other probe.
    expect(entry.at).toBe(pending.at);
    expect(entry.config.seed).toBe(pending.seed);
    expect(declined.defenseLog[0]!.at).toBe(entry.at);

    // And it billed exactly what the offline sweep would have billed: the same
    // town, left alone long enough for the offer to lapse, lands in the same
    // place. That equality is the whole promise of declining.
    const lapsed = town();
    runOfflineProbes(lapsed, T + 2 * PROBE_INTERVAL_MS + 60_000);
    // `tick()` advances lastSeen after every sweep; without it the second
    // sweep would re-run the whole absence and the comparison would be
    // measuring that instead.
    lapsed.lastSeen = T + 2 * PROBE_INTERVAL_MS + 60_000;
    runOfflineProbes(lapsed, lapsed.pendingDefense!.expiresAt);
    expect(lapsed.supplies).toBe(declined.supplies);
    expect(lapsed.fuel).toBe(declined.fuel);
    expect(lapsed.defenseLog[0]!.held).toBe(entry.held);
  });

  it('an offer walked away from still lands, at the full offline price', () => {
    const t = town();
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const pending = t.pendingDefense!;
    t.lastSeen = T + 2 * PROBE_INTERVAL_MS + 60_000;
    // Back after the window closed: the attack landed while they were gone.
    const later = pending.expiresAt + 60_000;
    const ran = runOfflineProbes(t, later);
    expect(t.pendingDefense).toBeUndefined();
    expect(ran.some((e) => e.at === pending.at)).toBe(true);
  });

  it('accepting does not make the attack disappear if you walk out on it', () => {
    const t = town();
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const offered = t.pendingDefense!;
    const claimed = claimLiveDefense(t)!;
    expect(claimed.seed).toBe(offered.seed);

    // The offer is still on the board, with its window shut. A player who
    // accepts and then closes the tab mid-battle has not ducked anything:
    // the next sweep lands it at the full offline price. Ducking it would
    // beat BOTH of the answers actually on offer.
    expect(t.pendingDefense).toBeDefined();
    expect(t.pendingDefense!.expiresAt).toBeLessThanOrEqual(T + 2 * PROBE_INTERVAL_MS);
    t.lastSeen = T + 2 * PROBE_INTERVAL_MS + 60_000;
    const ran = runOfflineProbes(t, t.lastSeen + 60_000);
    expect(ran.some((e) => e.at === offered.at)).toBe(true);
    expect(t.pendingDefense).toBeUndefined();

    // And a result coming back clears it, so the normal path bills once.
    const b = town();
    runOfflineProbes(b, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const fought = claimLiveDefense(b)!;
    applyLiveDefense(
      b,
      { level: fought.level, at: fought.at, config: defenseConfig(b, fought.level, fought.seed) },
      {
        victory: true,
        supplies: b.supplies,
        chargesLeft: { ...b.charges },
        walls: b.walls.map((w) => ({ ...w })),
        survivors: b.structures
          .filter((st) => st.kind !== 'cc' && !st.wrecked)
          .map((st) => ({ cell: st.cell, kind: st.kind, level: st.level })),
        stats: {} as never,
        ccHpFraction: 1,
      },
      T + 3 * PROBE_INTERVAL_MS,
    );
    expect(b.pendingDefense).toBeUndefined();
    expect(liveDefenseConfig(b)).toBeNull();
    expect(claimLiveDefense(b)).toBeNull();
  });

  it('only one offer stands at a time', () => {
    const t = town();
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const first = t.pendingDefense!;
    // The clock alone cannot reach this branch — the window is half an hour
    // and probes are three apart — so hold the offer open and sweep again.
    // What is pinned is that a standing offer is never REPLACED: the probes
    // that came due behind it resolve offline instead of queueing a second.
    first.expiresAt = T + 100 * PROBE_INTERVAL_MS;
    t.lastSeen = T + 2 * PROBE_INTERVAL_MS + 60_000;
    const ran = runOfflineProbes(t, t.lastSeen + PROBE_INTERVAL_MS + 60_000);
    expect(t.pendingDefense).toBe(first);
    expect(ran.length).toBe(1);
  });

  it('survives a save, and a junk offer is dropped rather than carried', () => {
    const t = town();
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const back = deserialize(serialize(t))!;
    expect(back.pendingDefense).toEqual(t.pendingDefense);

    // An offer that cannot lapse is a free shield: the attack it stands for
    // would never land, because `runOfflineProbes` only resolves it once the
    // window has closed. So a broken one is dropped, not repaired.
    const raw = JSON.parse(serialize(t)) as { town: Record<string, unknown> };
    raw.town['pendingDefense'] = { at: T, level: 2, seed: 7, expiresAt: 'soon' };
    expect(deserialize(JSON.stringify(raw))!.pendingDefense).toBeUndefined();
  });

  it('the offer takes command: the garrison orders do not fight it', () => {
    const t = town();
    t.standingOrders = 'holdfast';
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    // The probe the GARRISON would have fought carries the orders...
    expect(t.defenseLog[0]!.config.standingOrders?.id).toBe('holdfast');
    // ...and the one the player is being offered does not. Orders are a CP
    // policy for a battle nobody is watching; in a live battle they would
    // spend the player's CP.
    expect(liveDefenseConfig(t)!.standingOrders).toBeUndefined();
  });

  it('standing to fight makes them commit: the whole rung, and CP to spend it', () => {
    const t = town();
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const pending = t.pendingDefense!;
    const probe = probeConfig(t, pending.level, pending.seed);
    const live = liveDefenseConfig(t)!;

    // A probe is the first two waves with the defender economy switched off.
    // Offering THAT as a live battle would hand the player a fight with no
    // verbs in it — no CP means no deployments, no powers, nothing to do but
    // watch — and one a built town holds 100% of the time at every level.
    expect(probe.siege!.waves.length).toBeLessThan(live.siege!.waves.length);
    expect(probe.siege!.cpPerSecond).toBe(0);
    expect(live.siege!.cpPerSecond).toBeGreaterThan(0);
    expect(live.siege!.startingCp).toBeGreaterThan(0);
    // Same rung, same seed: it is still the attack that was coming.
    expect(live.seed).toBe(pending.seed);
  });

  it('a live defeat wrecks buildings where an offline one only bills', () => {
    const live = town();
    runOfflineProbes(live, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const fought = claimLiveDefense(live)!;
    // Far over this garrison's head, fought with nobody at the console — a
    // real engine run that really ends in defeat, rather than a hand-written
    // outcome asserting itself.
    const level = 12;
    const config = defenseConfig(live, level, fought.seed);
    const engine = new Engine(config, defenseCatalogFor('usa'));
    engine.enqueue({ tick: 0, type: 'startAssault' });
    while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 8000) engine.step();
    expect(engine.phase).toBe('defeat');

    const entry = applyLiveDefense(
      live,
      { level, at: fought.at, config },
      outcomeFromEngine(engine),
      T + 3 * PROBE_INTERVAL_MS,
    );
    expect(entry.held).toBe(false);
    // THE POINT: a defeat you were present for costs buildings. Nothing the
    // offline sweep does can wreck a structure.
    expect(live.structures.some((st) => st.wrecked)).toBe(true);
    expect(live.defenseLog[0]).toBe(entry);
    expect(live.shieldUntil).toBeGreaterThan(T);

    const offline = town();
    runOfflineProbes(offline, T + 2 * PROBE_INTERVAL_MS + 60_000);
    declineLiveDefense(offline, T + 2 * PROBE_INTERVAL_MS + 60_000);
    expect(offline.structures.some((st) => st.wrecked)).toBe(false);
  });

  it('a live hold pays the bounty and loses nothing', () => {
    const t = town();
    runOfflineProbes(t, T + 2 * PROBE_INTERVAL_MS + 60_000);
    const fought = claimLiveDefense(t)!;
    const config = defenseConfig(t, fought.level, fought.seed);
    const before = { supplies: t.supplies, fuel: t.fuel };
    const bounty = liveDefenseBounty(fought.level);
    const cap = caps(t);

    // A hold, stated rather than fought: what this test is about is the fold,
    // not whether this particular garrison wins.
    const entry = applyLiveDefense(
      t,
      { level: fought.level, at: fought.at, config },
      {
        victory: true,
        supplies: before.supplies,
        chargesLeft: { ...t.charges },
        walls: t.walls.map((w) => ({ ...w })),
        survivors: t.structures
          .filter((st) => st.kind !== 'cc' && !st.wrecked)
          .map((st) => ({ cell: st.cell, kind: st.kind, level: st.level })),
        stats: {} as never,
        ccHpFraction: 1,
      },
      T + 3 * PROBE_INTERVAL_MS,
    );
    expect(entry.held).toBe(true);
    expect(entry.suppliesLost).toBe(0);
    expect(entry.fuelLost).toBe(0);
    // Capped, like every other payout in the game: half a skirmish's loot can
    // overflow a small town's stores, and a full one takes what fits.
    expect(t.supplies).toBe(Math.min(cap.supplies, before.supplies + bounty.supplies));
    expect(t.fuel).toBe(Math.min(cap.fuel, before.fuel + bounty.fuel));
    expect(t.supplies).toBeGreaterThan(before.supplies);
    expect(t.structures.some((st) => st.wrecked)).toBe(false);
    // It counts on the record exactly like a probe the garrison held.
    expect(t.log!.probesHeld).toBeGreaterThan(0);
  });

  it('the bounty rises with what is coming', () => {
    expect(liveDefenseBounty(6).supplies).toBeGreaterThan(liveDefenseBounty(2).supplies);
    expect(liveDefenseBounty(6).fuel).toBeGreaterThan(liveDefenseBounty(2).fuel);
  });
});
