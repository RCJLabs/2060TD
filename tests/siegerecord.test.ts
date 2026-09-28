import { describe, expect, it } from 'vitest';
import { yardTown } from './helpers';
import { defenseCatalogFor } from '../src/content/factions';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { BREACH_MERGE_TICKS, JUMP_LEAD_TICKS, jumpTick, LOSS_MERGE_TICKS, MomentLog } from '../src/meta/moments';
import {
  engineFor,
  fightTo,
  isOrder,
  ordersOf,
  ORDER_SHIFT_SECONDS,
  SiegeCounterfactual,
  siegeReport,
  waveStarts,
  withOrderChange,
  type SiegeRecord,
} from '../src/meta/siegerecord';
import { siegeConfig, unlockAll, type TownState } from '../src/meta/town';
import { fileCode, normalizeVault, recordBattle, SIEGE_CAP, VAULT_CAP, vaultShelves } from '../src/meta/vault';
import { Engine, TICKS_PER_SECOND } from '../src/sim/engine';
import type { Catalog, Command, SimConfig } from '../src/sim/types';

/**
 * A siege on the record (M35 Phase 3): a live siege is its config and the
 * commands it took, and the two together are the battle.
 */

const T0 = Date.UTC(2026, 8, 1, 12);

function town(): TownState {
  const t = unlockAll(yardTown(T0));
  t.supplies = 5000;
  return t;
}

const CATALOG: Catalog = defenseCatalogFor('usa');

/** The config of a skirmish from the test town. */
function skirmish(seed = 11, level = 1): SimConfig {
  const t = town();
  t.assaultLevel = level;
  const config = siegeConfig(t, seed);
  // Stock enough to build a defence in the setup, and to repair with between waves.
  return { ...config, siege: { ...config.siege!, startingSupplies: 1500 } };
}

/**
 * A commander who fights a siege through `command`, as the siege scene does:
 * builds in the setup (walls, a gate, a gun, one of each taken down again),
 * starts the assault, and in the fight deploys guns, calls strikes (a tap and
 * a drag), upgrades, moves and sells, works the gate, repairs between waves
 * and cuts the preps short. Every command a siege can take is among them.
 * `seen` hears every tick, with the engine after it.
 */
function commanded(config: SimConfig, seen?: (engine: Engine) => void): Engine {
  const e = new Engine(config, CATALOG);
  const cells = [...Array(e.grid.width * e.grid.height).keys()];
  const byReach = (c: number): number => {
    const at = e.grid.centerOf(c);
    return (at.x - e.cc.center.x) ** 2 + (at.y - e.cc.center.y) ** 2;
  };
  const nearPost = [...cells].sort((a, b) => byReach(a) - byReach(b) || a - b);
  const step = (): void => {
    e.step();
    seen?.(e);
  };
  const place = (kind: string, ok: (c: number) => boolean): number => {
    const cell = nearPost.find(ok);
    if (cell === undefined) throw new Error(`nowhere for ${kind}`);
    return cell;
  };

  // The setup.
  const wall = place('wall', (c) => e.canPlaceWall('wall', c) && byReach(c) > 6);
  e.command({ type: 'placeWall', cell: wall, kind: 'wall' });
  step();
  const spare = place('wall', (c) => e.canPlaceWall('wall', c) && byReach(c) > 6);
  e.command({ type: 'placeWall', cell: spare, kind: 'wall' });
  step();
  e.command({ type: 'removeWall', cell: spare });
  const gate = place('gate', (c) => e.canPlaceWall('gate', c) && byReach(c) > 6);
  e.command({ type: 'placeWall', cell: gate, kind: 'gate' });
  step();
  // One taken down again, before the town's room for guns is spent.
  const extra = place('m2nest', (c) => e.canPlaceStructure('m2nest', c));
  e.command({ type: 'placeStructure', cell: extra, kind: 'm2nest' });
  step();
  e.command({ type: 'removeStructure', cell: extra });
  step();
  // Guns round the post, as many as the town may field: the bare yard would
  // fall in the first wave.
  for (const kind of ['m2nest', 'autocannon', 'mortar']) {
    for (let i = 0; i < 4; i++) {
      const cell = nearPost.find((c) => e.canPlaceStructure(kind, c));
      if (cell === undefined) break;
      e.command({ type: 'placeStructure', cell, kind });
      step();
    }
  }
  e.command({ type: 'startAssault' });
  step();

  // The fight.
  const guns: number[] = [];
  let strikes = 0;
  let upgraded = false;
  let moved = false;
  let sold = false;
  let gateWorked = false;
  let prepTicks = 0;
  const gunPrice = e.fieldPrice(CATALOG.structures['depmg']!.cpCost!);
  while (e.phase !== 'victory' && e.phase !== 'defeat' && e.tick < 30_000) {
    if (e.phase === 'combat') {
      prepTicks = 0;
      const hostile = e.attackers.find((a) => a.hp > 0 && !a.profile.air);
      if (e.tick % 40 === 0 && e.cp >= gunPrice && guns.length < 4) {
        const cell = nearPost.find((c) => e.canPlaceStructure('depmg', c));
        if (cell !== undefined) {
          e.command({ type: 'placeStructure', cell, kind: 'depmg' });
          guns.push(cell);
        }
      } else if (hostile && strikes < 2 && e.canCastPower('a10')) {
        const target = { x: Math.floor(hostile.pos.x) + 0.5, y: Math.floor(hostile.pos.y) + 0.5 };
        // The second one dragged, to a point off the eighths: the engine takes it to the nearest.
        e.command({
          type: 'castPower',
          kind: 'a10',
          target,
          ...(strikes === 1 ? { toward: { x: target.x + 0.37, y: target.y + 1.91 } } : {}),
        });
        strikes++;
      } else if (!upgraded && guns.length >= 1 && e.fieldOptions(guns[0]!)?.upgrade !== null && e.cp >= (e.fieldOptions(guns[0]!)?.upgrade ?? Infinity)) {
        e.command({ type: 'upgradeStructure', cell: guns[0]! });
        upgraded = true;
      } else if (!moved && guns.length >= 2 && e.fieldOptions(guns[1]!) && e.cp >= e.fieldOptions(guns[1]!)!.move) {
        const to = nearPost.find((c) => e.isBuildable(c) && byReach(c) > byReach(guns[1]!));
        if (to !== undefined) {
          e.command({ type: 'moveStructure', cell: guns[1]!, to });
          guns[1] = to;
          moved = true;
        }
      } else if (!sold && guns.length >= 3 && e.fieldOptions(guns[2]!)) {
        e.command({ type: 'sellStructure', cell: guns[2]! });
        sold = true;
      } else if (!gateWorked && e.cp >= 10) {
        e.command({ type: 'toggleGate', cell: gate });
        gateWorked = true;
      }
    } else if (e.phase === 'prep') {
      prepTicks++;
      if (prepTicks === 5) e.command({ type: 'repairAll' });
      if (prepTicks === 40) e.command({ type: 'skipPrep' });
    }
    step();
  }
  return e;
}

const hashesEvery = (engine: Engine, every: number, into: Map<number, string>): void => {
  if (engine.tick % every === 0) into.set(engine.tick, engine.stateHash());
};

describe('the command log', () => {
  it('keeps what took, at the tick it took, and only that', () => {
    const e = new Engine(skirmish(), CATALOG);
    const cells = [...Array(e.grid.width * e.grid.height).keys()];
    const free = cells.find((c) => e.canPlaceWall('wall', c))!;
    e.command({ type: 'placeWall', cell: free, kind: 'wall' });
    // The same cell twice, and a field gun before the fighting: both refused.
    e.command({ type: 'placeWall', cell: free, kind: 'wall' });
    e.command({ type: 'placeStructure', cell: cells.find((c) => e.isBuildable(c))!, kind: 'depmg' });
    e.step();
    expect(e.commandLog).toEqual([{ tick: 0, type: 'placeWall', cell: free, kind: 'wall' }]);
  });

  it('keeps nothing standing orders do', () => {
    const config: SimConfig = {
      ...skirmish(),
      standingOrders: {
        id: 'probe',
        rules: [{ cpAtLeast: 0, action: 'deploy', kind: 'depmg', target: 'ccApproach', minHostiles: 1, cooldownTicks: 20 }],
      },
    };
    const e = new Engine(config, CATALOG);
    e.command({ type: 'startAssault' });
    for (let i = 0; i < 1500 && e.ordersExecuted === 0; i++) e.step();
    expect(e.ordersExecuted).toBeGreaterThan(0);
    expect(e.commandLog.map((c) => c.type)).toEqual(['startAssault']);
  });

  it('takes a cast’s points to the eighth of a cell', () => {
    const e = new Engine(skirmish(), CATALOG);
    e.command({ type: 'startAssault' });
    e.step();
    e.cp = 150;
    e.command({ type: 'castPower', kind: 'a10', target: { x: 4.3, y: 5.06 }, toward: { x: 4.3, y: 9.9 } });
    e.step();
    expect(e.commandLog[1]).toMatchObject({ target: { x: 4.25, y: 5 }, toward: { x: 4.25, y: 9.875 } });
  });
});

describe('a commanded siege', () => {
  // Level 3: five waves, held, with a repair in a prep and every other order in the fight.
  const config = skirmish(11, 3);
  const hashes = new Map<number, string>();
  const preps = new Map<number, string>();
  const fought = commanded(config, (e) => {
    hashesEvery(e, 250, hashes);
    // Keyed by the wave the prep is for, as a drill names it.
    if (e.phase === 'prep' && !preps.has(e.waveIndex + 2)) preps.set(e.waveIndex + 2, `${e.tick}:${e.stateHash()}`);
  });
  const record: SiegeRecord = { config, commands: [...fought.commandLog] };

  it('took every kind of command a siege can take', () => {
    const types = new Set(record.commands.map((c) => c.type));
    for (const type of [
      'placeWall',
      'removeWall',
      'placeStructure',
      'removeStructure',
      'startAssault',
      'skipPrep',
      'repairAll',
      'castPower',
      'toggleGate',
      'moveStructure',
      'sellStructure',
      'upgradeStructure',
    ] as const) {
      expect(types.has(type), type).toBe(true);
    }
    expect(record.commands.some((c) => c.type === 'castPower' && c.toward)).toBe(true);
  });

  it('is fought again from its log to the same state hash, tick for tick', () => {
    const again = new Map<number, string>();
    const engine = engineFor(record, CATALOG);
    while (engine.tick < fought.tick) {
      engine.step();
      hashesEvery(engine, 250, again);
    }
    expect(again.size).toBeGreaterThan(4);
    for (const [tick, hash] of again) expect(hash, `tick ${tick}`).toBe(hashes.get(tick));
    expect(engine.stateHash()).toBe(fought.stateHash());
    expect(engine.phase).toBe(fought.phase);
  });

  it('and from its code, which carries the log exactly', () => {
    const code = encodeReplay({ kind: 'siege', faction: 'usa', title: 'SKIRMISH', won: fought.phase === 'victory', config, commands: record.commands });
    const decoded = decodeReplay(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.replay.kind).toBe('siege');
    expect(decoded.replay.commands).toEqual(record.commands);
    const engine = fightTo({ config: decoded.replay.config, commands: decoded.replay.commands! }, CATALOG, fought.tick);
    expect(engine.stateHash()).toBe(fought.stateHash());
  });

  it('starts a drill at a wave in exactly the state the siege had there', () => {
    const starts = waveStarts(record, CATALOG);
    expect(starts[0]).toEqual({ wave: 1, tick: 0 });
    expect(starts.length).toBeGreaterThan(1);
    for (const start of starts.slice(1)) {
      const [tick, hash] = preps.get(start.wave)!.split(':');
      expect(start.tick).toBe(Number(tick));
      const drill = fightTo(record, CATALOG, start.tick);
      expect(drill.tick).toBe(start.tick);
      expect(drill.phase).toBe('prep');
      expect(drill.stateHash(), `wave ${start.wave}`).toBe(hash);
    }
  });

  it('marks what happened for the replay bar: each wave, and each strike called', () => {
    const log = new MomentLog({ side: 'defender', waves: true, name: (kind) => kind });
    const waves: number[] = [];
    fightTo(record, CATALOG, Infinity, (engine, events) => {
      log.observe(engine, events);
      for (const e of events) if (e.type === 'waveStarted') waves.push(engine.tick);
    });
    log.strikes(record.commands);
    const marked = log.moments.filter((m) => m.kind === 'wave');
    expect(marked.map((m) => m.label)).toEqual(waves.map((_, i) => `WAVE ${i + 1}`));
    // The first where the assault began, the rest where their preps did: where a drill starts.
    expect(marked[0]!.tick).toBe(waves[0]);
    expect(marked.slice(1).map((m) => m.tick)).toEqual(waveStarts(record, CATALOG).slice(1).map((s) => s.tick));
    const strikes = log.moments.filter((m) => m.kind === 'strike');
    expect(strikes.map((m) => m.tick)).toEqual(record.commands.filter((c) => c.type === 'castPower').map((c) => c.tick + 1));
    expect(strikes[0]!.label).toBe('STRIKE: A10');
    const ticks = log.moments.map((m) => m.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it('names what each order acted on, as the what-if lists them', () => {
    const orders = ordersOf(record, CATALOG);
    expect(orders.map((o) => o.index)).toEqual(record.commands.flatMap((c, i) => (isOrder(c) ? [i] : [])));
    const kindOf = (type: Command['type']): (string | null)[] => orders.filter((o) => o.cmd.type === type).map((o) => o.kind);
    // The field gun upgraded, moved and sold was a deployed MG, whatever cell it stood on.
    expect(kindOf('upgradeStructure')).toEqual(['depmg']);
    expect(kindOf('moveStructure')).toEqual(['depmg']);
    expect(kindOf('sellStructure')).toEqual(['depmg']);
    expect(kindOf('removeStructure')).toEqual(['m2nest']);
    expect(kindOf('toggleGate')).toEqual(['gate']);
    expect(kindOf('repairAll').every((k) => k === null)).toBe(true);
    expect(new Set(kindOf('castPower'))).toEqual(new Set(['a10']));
  });

  it('counts the battles a what-if still has to fight', () => {
    const cf = new SiegeCounterfactual(record, CATALOG);
    expect(cf.battlesToFight).toBe(22);
    const run = cf.fights({ index: cf.orders[0]!, change: 'without' });
    let yields = 0;
    while (!run.next().done) yields++;
    expect(yields).toBe(22);
    // What the siege did as fought is kept: the next change fights only its own.
    expect(cf.battlesToFight).toBe(11);
  });

  it('reports what the battle did', () => {
    const report = siegeReport(record, CATALOG);
    expect(report.result.held).toBe(fought.phase === 'victory');
    expect(report.kills).toBe(fought.stats.kills);
    expect(report.killers.reduce((n, k) => n + k.kills, 0)).toBe(fought.stats.kills);
    expect(report.orders.strikes).toBe(record.commands.filter((c) => c.type === 'castPower').length);
    expect(report.orders.upgrades).toBe(1);
    expect(report.cp).toBe(Math.round(fought.stats.cpSpent));
  });
});

describe('the replay bar', () => {
  // Only the engine's clock and the post's chain are read off the engine.
  const at = (tick: number, stages = 0): Engine => ({ tick, chainStagesCleared: stages }) as unknown as Engine;
  const lost = (kind: string) => ({ type: 'structureDestroyed', id: 1, kind, at: { x: 0, y: 0 } }) as const;

  it('makes one moment of losses close together, and names them', () => {
    const log = new MomentLog({ side: 'defender', waves: false, name: (kind) => `the ${kind}` });
    log.observe(at(100), [lost('m2nest')]);
    log.observe(at(100 + LOSS_MERGE_TICKS - 1), [lost('mortar'), lost('cc')]);
    log.observe(at(100 + LOSS_MERGE_TICKS), [lost('depot')]);
    expect(log.moments).toEqual([
      { tick: 100, kind: 'lost', label: 'LOST: THE M2NEST +1' },
      { tick: 100 + LOSS_MERGE_TICKS, kind: 'lost', label: 'LOST: THE DEPOT' },
    ]);
  });

  it('breaches once while the walls keep falling, and marks each stage of the chain', () => {
    const log = new MomentLog({ side: 'raider', waves: false, name: (kind) => kind });
    const wall = { type: 'wallDestroyed', cell: 4 } as const;
    log.observe(at(10), [wall]);
    log.observe(at(10 + BREACH_MERGE_TICKS - 1), [wall]);
    log.observe(at(10 + 2 * BREACH_MERGE_TICKS), [wall, lost('m2nest')]);
    log.observe(at(900, 2), []);
    expect(log.moments.map((m) => `${m.tick} ${m.label}`)).toEqual([
      '10 WALL BREACHED',
      `${10 + 2 * BREACH_MERGE_TICKS} WALL BREACHED`,
      `${10 + 2 * BREACH_MERGE_TICKS} DOWN: M2NEST`,
      '900 CHAIN: BREACH',
      '900 CHAIN: SUPPRESS',
    ]);
  });

  it('jumps to a wave at its start, and to anything else a little before', () => {
    expect(jumpTick({ tick: 500, kind: 'wave', label: 'WAVE 2' })).toBe(500);
    expect(jumpTick({ tick: 500, kind: 'lost', label: 'LOST: X' })).toBe(500 - JUMP_LEAD_TICKS);
    expect(jumpTick({ tick: 10, kind: 'strike', label: 'STRIKE: X' })).toBe(0);
  });
});

describe('siege codes', () => {
  it('carry the build limits, and a command of every shape', () => {
    const config: SimConfig = { ...skirmish(), buildLimits: { structures: { m2nest: 2, depmg: 0 }, walls: 30 } };
    const commands: Command[] = [
      { tick: 0, type: 'placeWall', cell: 12, kind: 'wall' },
      { tick: 0, type: 'removeWall', cell: 12 },
      { tick: 3, type: 'placeStructure', cell: 40, kind: 'm2nest', level: 2 },
      { tick: 3, type: 'removeStructure', cell: 40 },
      { tick: 5, type: 'spawnAttacker', cell: 7, kind: 'rifle', doctrine: 'hunt' },
      { tick: 9, type: 'startAssault' },
      { tick: 400, type: 'castPower', kind: 'a10', target: { x: 4.5, y: 6.5 } },
      { tick: 420, type: 'castPower', kind: 'arty', target: { x: 0.125, y: 13.5 }, toward: { x: -0.25, y: 14.875 } },
      { tick: 500, type: 'toggleGate', cell: 33 },
      { tick: 520, type: 'moveStructure', cell: 61, to: 62 },
      { tick: 530, type: 'upgradeStructure', cell: 62 },
      { tick: 540, type: 'sellStructure', cell: 62 },
      { tick: 900, type: 'repairAll' },
      { tick: 950, type: 'skipPrep' },
    ];
    const decoded = decodeReplay(encodeReplay({ kind: 'siege', faction: 'usa', title: 'SHAPES', won: false, config, commands }));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.replay.commands).toEqual(commands);
    expect(decoded.replay.config.buildLimits).toEqual(config.buildLimits);
  });

  it('refuse to carry a point off the eighths, or commands out of order', () => {
    const config = skirmish();
    const off: Command[] = [{ tick: 1, type: 'castPower', kind: 'a10', target: { x: 4.3, y: 5 } }];
    expect(() => encodeReplay({ kind: 'siege', faction: 'usa', title: 'X', won: false, config, commands: off })).toThrow();
    const backwards: Command[] = [
      { tick: 5, type: 'startAssault' },
      { tick: 4, type: 'skipPrep' },
    ];
    expect(() => encodeReplay({ kind: 'siege', faction: 'usa', title: 'X', won: false, config, commands: backwards })).toThrow();
  });

  it('leave every other kind of code as it was', () => {
    const config = skirmish();
    const probe = encodeReplay({ kind: 'probe', faction: 'usa', title: 'PROBE', won: true, config });
    const decoded = decodeReplay(probe);
    expect(decoded.ok && decoded.replay.commands).toBe(undefined);
  });
});

describe('the defence what-if', () => {
  const log: Command[] = [
    { tick: 0, type: 'placeWall', cell: 12, kind: 'wall' },
    { tick: 10, type: 'startAssault' },
    { tick: 300, type: 'placeStructure', cell: 40, kind: 'depmg' },
    { tick: 305, type: 'castPower', kind: 'a10', target: { x: 4.5, y: 4.5 } },
    { tick: 600, type: 'upgradeStructure', cell: 40 },
  ];

  it('offers every order but the walls and the buttons that start the fighting', () => {
    expect(log.filter(isOrder).map((c) => c.type)).toEqual(['placeStructure', 'castPower', 'upgradeStructure']);
  });

  it('drops one order, or moves it ten seconds and back into tick order', () => {
    const shift = ORDER_SHIFT_SECONDS * TICKS_PER_SECOND;
    expect(withOrderChange(log, { index: 3, change: 'without' }).map((c) => c.type)).not.toContain('castPower');
    const later = withOrderChange(log, { index: 2, change: 'later' });
    expect(later.map((c) => c.tick)).toEqual([0, 10, 305, 300 + shift, 600]);
    expect(later[3]!.type).toBe('placeStructure');
    const sooner = withOrderChange(log, { index: 4, change: 'sooner' });
    expect(sooner.map((c) => c.tick)).toEqual([0, 10, 300, 305, 600 - shift]);
    // Never before the battle's first tick, where it goes after what was there.
    const first = withOrderChange(log, { index: 1, change: 'sooner' });
    expect(first.slice(0, 2).map((c) => [c.type, c.tick])).toEqual([
      ['placeWall', 0],
      ['startAssault', 0],
    ]);
  });

  it('says whether a moved order still took, and fights both over the rolls', () => {
    const config = skirmish(23);
    const e = new Engine(config, CATALOG);
    e.command({ type: 'startAssault' });
    for (let i = 0; i < 20; i++) e.step();
    e.cp = 150;
    const cell = [...Array(e.grid.width * e.grid.height).keys()].find((c) => e.canPlaceStructure('depmg', c))!;
    const record: SiegeRecord = {
      config,
      commands: [
        { tick: 0, type: 'startAssault' },
        { tick: 300, type: 'placeStructure', cell, kind: 'depmg' },
        { tick: 320, type: 'upgradeStructure', cell },
      ],
    };
    const cf = new SiegeCounterfactual(record, CATALOG);
    expect(cf.orders).toEqual([1, 2]);
    // Ten seconds sooner, the upgrade comes before the gun it upgrades.
    const early = cf.whatIf({ index: 2, change: 'sooner' });
    expect(early.took).toBe(false);
    expect(early.rolls.fought).toBeGreaterThanOrEqual(0);
    expect(early.rolls.fought).toBeLessThanOrEqual(10);
    const without = cf.whatIf({ index: 1, change: 'without' });
    expect(without.took).toBeNull();
    expect(without.record.commands).toHaveLength(2);
    // What happened is fought once and kept.
    expect(without.fought).toBe(early.fought);
  });
});

describe('the siege shelf', () => {
  const siege = (i: number) => ({
    kind: 'siege' as const,
    faction: 'usa' as const,
    title: `SIEGE ${i}`,
    won: true,
    at: T0 + i,
    detail: 'HELD',
    config: skirmish(100 + i),
    commands: [{ tick: 0, type: 'startAssault' } as Command],
  });
  const raid = (i: number) => ({
    kind: 'probe' as const,
    faction: 'usa' as const,
    title: `PROBE ${i}`,
    won: true,
    at: T0 + 100 + i,
    detail: 'HELD',
    config: skirmish(200 + i),
  });

  it('keeps the last five sieges apart from the last ten of everything else', () => {
    const t = town();
    for (let i = 0; i < 7; i++) recordBattle(t, siege(i));
    for (let i = 0; i < 12; i++) recordBattle(t, raid(i));
    const { sieges, battles } = vaultShelves(t);
    expect(sieges.map((e) => e.title)).toEqual(['SIEGE 6', 'SIEGE 5', 'SIEGE 4', 'SIEGE 3', 'SIEGE 2']);
    expect(sieges).toHaveLength(SIEGE_CAP);
    expect(battles).toHaveLength(VAULT_CAP);
    expect(battles[0]!.title).toBe('PROBE 11');
    // And loads the same off the save.
    expect(normalizeVault(JSON.parse(JSON.stringify(t.vault)))).toEqual(t.vault);
  });

  it('files a pasted siege code onto the shelf', () => {
    const t = town();
    const code = encodeReplay({ ...siege(9), kind: 'siege' });
    const filed = fileCode(t, code, T0);
    expect(filed.ok).toBe(true);
    expect(vaultShelves(t).sieges).toHaveLength(1);
  });
});
