/**
 * A siege on the record (M35 Phase 3).
 *
 * A live siege is its config and the commands the commander gave, and the
 * engine keeps those as it takes them (`Engine.commandLog`): the ones that
 * took, at the tick they took. The two together are the battle. Queue the log
 * on a new engine and step, and the siege is fought again to the same state
 * hash, which is all its footage, its drills, its report and its what-if need.
 */
import { createRng } from '../sim/rng';
import { Engine, TICKS_PER_SECOND } from '../sim/engine';
import type { Catalog, Command, SimConfig, SimEvent } from '../sim/types';
import { BattleRecorder, type Killer } from './afteraction';
import { WHAT_IF_ROLLS } from './counterfactual';

export interface SiegeRecord {
  config: SimConfig;
  /** What the siege took from its queue, in the order it took it (`Engine.commandLog`). */
  commands: Command[];
}

/** A siege fought this long without a verdict is over: the balance tool's ceiling. */
export const SIEGE_MAX_TICKS = 40_000;

export const siegeOver = (engine: Engine): boolean =>
  engine.phase === 'victory' || engine.phase === 'defeat' || engine.tick >= SIEGE_MAX_TICKS;

/** A new engine for the record, with its commands from before `before` queued. */
export function engineFor(record: SiegeRecord, catalog: Catalog, before = Infinity): Engine {
  const engine = new Engine(record.config, catalog);
  for (const cmd of record.commands) if (cmd.tick < before) engine.enqueue({ ...cmd });
  return engine;
}

/**
 * The record fought to `tick`, or to its end: the engine as the siege had it
 * then. `observe` hears every tick, for whatever is kept as it goes.
 */
export function fightTo(
  record: SiegeRecord,
  catalog: Catalog,
  tick = Infinity,
  observe?: (engine: Engine, events: SimEvent[]) => void,
): Engine {
  const engine = engineFor(record, catalog, tick);
  while (engine.tick < tick && !siegeOver(engine)) {
    const events = engine.step();
    observe?.(engine, events);
  }
  return engine;
}

/** Where a wave can be fought again from: its prep, or the setup for the first. */
export interface WaveStart {
  /** The wave, from 1. */
  wave: number;
  /** The tick the drill takes over at: the first of the prep. */
  tick: number;
}

/** A prep that has just begun, heard as it is raised: the drill for its wave starts at the next tick. */
export function waveStartOf(engine: Engine, events: readonly SimEvent[]): WaveStart | null {
  for (const e of events) if (e.type === 'prepStarted') return { wave: e.index + 1, tick: engine.tick };
  return null;
}

/** Every point the siege can be drilled from, the setup first. */
export function waveStarts(record: SiegeRecord, catalog: Catalog): WaveStart[] {
  const starts: WaveStart[] = [{ wave: 1, tick: 0 }];
  fightTo(record, catalog, Infinity, (engine, events) => {
    const start = waveStartOf(engine, events);
    if (start) starts.push(start);
  });
  return starts;
}

/** How a siege ended, in the terms its what-if compares. */
export interface SiegeResult {
  held: boolean;
  /** The post's lowest, 0 to 1. */
  low: number;
  /**
   * Structures lost that would have outlasted the battle: the town's own and
   * what the setup bought. Not the post, and not the field defences.
   */
  buildings: number;
  /** Field defences lost. */
  field: number;
  walls: number;
  ticks: number;
}

/** Is this kind a field defence, one bought with CP in the battle? */
const isField = (catalog: Catalog, kind: string): boolean => catalog.structures[kind]?.cpCost !== undefined;

/** The record fought to its end, and how it went; `observe` hears every tick. */
export function resultOf(
  record: SiegeRecord,
  catalog: Catalog,
  observe?: (engine: Engine, events: SimEvent[]) => void,
): { result: SiegeResult; engine: Engine } {
  let low = 1;
  let buildings = 0;
  let field = 0;
  const engine = fightTo(record, catalog, Infinity, (e, events) => {
    low = Math.min(low, Math.max(0, e.cc.hp / e.cc.profile.maxHp));
    for (const ev of events) {
      if (ev.type !== 'structureDestroyed' || ev.kind === 'cc') continue;
      if (isField(catalog, ev.kind)) field++;
      else buildings++;
    }
    observe?.(e, events);
  });
  return {
    result: {
      held: engine.phase === 'victory',
      low,
      buildings,
      field,
      walls: engine.stats.wallsLost,
      ticks: engine.tick,
    },
    engine,
  };
}

// ---- the what-if ------------------------------------------------------------------

/** What a defence what-if can do to one order (settled M35 Phase 3). */
export type OrderChange = 'without' | 'sooner' | 'later';
export const ORDER_CHANGES: readonly OrderChange[] = ['without', 'sooner', 'later'];

/** How far SOONER and LATER move an order. */
export const ORDER_SHIFT_SECONDS = 10;

/**
 * An order a what-if can change: anything the commander chose to do in the
 * battle, but not the walls, which are painted a dozen at a stroke, and not
 * the buttons that start the fighting.
 */
export function isOrder(cmd: Command): boolean {
  return (
    cmd.type !== 'placeWall' &&
    cmd.type !== 'removeWall' &&
    cmd.type !== 'startAssault' &&
    cmd.type !== 'skipPrep' &&
    cmd.type !== 'spawnAttacker'
  );
}

/** An order, and the kind of thing it acted on: a command names a cell, and what stood there is the battle's. */
export interface OrderEntry {
  /** Its place in the log. */
  index: number;
  cmd: Command;
  /** A structure's or a power's kind; null for a repair. */
  kind: string | null;
}

/** What an order acted on, read off the battle just before it took. */
function orderKind(engine: Engine, cmd: Command): string | null {
  switch (cmd.type) {
    case 'placeStructure':
    case 'castPower':
      return cmd.kind;
    case 'removeStructure':
    case 'sellStructure':
    case 'moveStructure':
    case 'upgradeStructure':
      return engine.structureAt(cmd.cell)?.profile.kind ?? null;
    case 'toggleGate':
      return 'gate';
    default:
      return null;
  }
}

/** Every order the what-if can change, in the log's order, with what it acted on. */
export function ordersOf(record: SiegeRecord, catalog: Catalog): OrderEntry[] {
  const orders = record.commands.flatMap((cmd, index) => (isOrder(cmd) ? [{ index, cmd }] : []));
  const out: OrderEntry[] = [];
  const engine = engineFor(record, catalog);
  // Before each step, the orders it is about to take, looked at as the board stands.
  const look = (): void => {
    while (out.length < orders.length && orders[out.length]!.cmd.tick <= engine.tick) {
      const { index, cmd } = orders[out.length]!;
      out.push({ index, cmd, kind: orderKind(engine, cmd) });
    }
  };
  look();
  while (out.length < orders.length && !siegeOver(engine)) {
    engine.step();
    look();
  }
  return out;
}

/** One change to one order, by its place in the log. */
export interface SiegeChange {
  index: number;
  change: OrderChange;
}

/**
 * The log with one change made. A moved order goes back into tick order, and
 * a tick it now shares keeps the others' order: the engine applies a tick's
 * commands in the order they were queued.
 */
export function withOrderChange(commands: readonly Command[], { index, change }: SiegeChange): Command[] {
  if (change === 'without') return commands.filter((_, i) => i !== index);
  const shift = (change === 'sooner' ? -1 : 1) * ORDER_SHIFT_SECONDS * TICKS_PER_SECOND;
  return commands
    .map((cmd, i) => ({ cmd: i === index ? { ...cmd, tick: Math.max(0, cmd.tick + shift) } : cmd, i }))
    .sort((a, b) => a.cmd.tick - b.cmd.tick || a.i - b.i)
    .map((entry) => entry.cmd);
}

/** The siege as fought beside the siege with one order changed. */
export interface SiegeWhatIf {
  change: SiegeChange;
  /** Both on the siege's own dice. */
  fought: SiegeResult;
  changed: SiegeResult;
  /** Sieges held over `WHAT_IF_ROLLS` more seeds, each way: the waves stay, the dice change. */
  rolls: { fought: number; changed: number };
  /** Did a moved order still take at its new time? Null when it was dropped. */
  took: boolean | null;
  /** The changed siege itself, to watch. */
  record: SiegeRecord;
}

const sameOrder = (a: Command, b: Command): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * A siege, ready to be asked what-ifs. What it did as fought, on its own dice
 * and over the rolls, is fought once and kept. The rolls re-seed the battle,
 * which re-rolls its dice and keeps its waves: a siege's config holds every
 * man it sends, so the seed no longer decides them.
 */
export class SiegeCounterfactual {
  private foughtResult: SiegeResult | null = null;
  private foughtRolls: number | null = null;

  constructor(
    readonly record: SiegeRecord,
    private readonly catalog: Catalog,
  ) {}

  /** The orders a what-if may change, by their place in the log. */
  get orders(): number[] {
    return this.record.commands.flatMap((cmd, i) => (isOrder(cmd) ? [i] : []));
  }

  /** How many battles the next what-if fights, what is already kept not counted: one per yield. */
  get battlesToFight(): number {
    return (this.foughtResult ? 0 : 1) + 1 + (this.foughtRolls === null ? WHAT_IF_ROLLS : 0) + WHAT_IF_ROLLS;
  }

  /** The seeds the rolls are fought on: drawn from the siege's own, so every look is the same. */
  rollSeeds(): number[] {
    const rng = createRng((this.record.config.seed ^ 0x5eed_c0de) >>> 0);
    return Array.from({ length: WHAT_IF_ROLLS }, () => Math.floor(rng() * 0x1_0000_0000) >>> 0);
  }

  /**
   * The what-if, one battle at a time: each yield is a battle fought, so a
   * card can keep the screen alive between them. `whatIf` runs it through.
   */
  *fights(change: SiegeChange): Generator<void, SiegeWhatIf, void> {
    const commands = withOrderChange(this.record.commands, change);
    const record: SiegeRecord = { config: this.record.config, commands };
    if (!this.foughtResult) {
      this.foughtResult = resultOf(this.record, this.catalog).result;
      yield;
    }
    const { result: changed, engine } = resultOf(record, this.catalog);
    yield;
    // A moved order took if the changed battle's own log has it, at its new tick.
    const moved = change.change === 'without' ? null : withOrderChange([this.record.commands[change.index]!], { index: 0, change: change.change })[0]!;
    const took = moved ? engine.commandLog.some((c) => sameOrder(c, moved)) : null;
    if (this.foughtRolls === null) {
      let held = 0;
      for (const seed of this.rollSeeds()) {
        if (resultOf({ config: { ...this.record.config, seed }, commands: this.record.commands }, this.catalog).result.held) held++;
        yield;
      }
      this.foughtRolls = held;
    }
    let changedHeld = 0;
    for (const seed of this.rollSeeds()) {
      if (resultOf({ config: { ...this.record.config, seed }, commands }, this.catalog).result.held) changedHeld++;
      yield;
    }
    return {
      change,
      fought: this.foughtResult,
      changed,
      rolls: { fought: this.foughtRolls, changed: changedHeld },
      took,
      record,
    };
  }

  whatIf(change: SiegeChange): SiegeWhatIf {
    const run = this.fights(change);
    for (;;) {
      const step = run.next();
      if (step.done) return step.value;
    }
  }
}

// ---- the report ------------------------------------------------------------------

/** What the commander did, counted by kind of order. */
export interface OrderCounts {
  placements: number;
  strikes: number;
  moves: number;
  sales: number;
  upgrades: number;
  gates: number;
  repairs: number;
  walls: number;
}

/** A siege's after-action report: what held, what killed them, what it cost. */
export interface SiegeReport {
  result: SiegeResult;
  kills: number;
  spawned: number;
  /** What killed the enemy, most kills first; a tie goes to the name. */
  killers: Killer[];
  /** The tick each kill-chain stage of the post fell, in order. */
  stages: number[];
  /** What landed the blow that took the post, when it fell. */
  postKiller: string | null;
  cp: number;
  supplies: number;
  orders: OrderCounts;
}

export function countOrders(commands: readonly Command[]): OrderCounts {
  const counts: OrderCounts = { placements: 0, strikes: 0, moves: 0, sales: 0, upgrades: 0, gates: 0, repairs: 0, walls: 0 };
  for (const cmd of commands) {
    if (cmd.type === 'placeStructure') counts.placements++;
    else if (cmd.type === 'castPower') counts.strikes++;
    else if (cmd.type === 'moveStructure') counts.moves++;
    else if (cmd.type === 'sellStructure') counts.sales++;
    else if (cmd.type === 'upgradeStructure') counts.upgrades++;
    else if (cmd.type === 'toggleGate') counts.gates++;
    else if (cmd.type === 'repairAll') counts.repairs++;
    else if (cmd.type === 'placeWall') counts.walls++;
  }
  return counts;
}

/** The report, had by fighting the record again: a fraction of a second, and nothing kept. */
export function siegeReport(record: SiegeRecord, catalog: Catalog): SiegeReport {
  const recorder = new BattleRecorder(record.config);
  const { result, engine } = resultOf(record, catalog, (e, events) => recorder.observe(e, events));
  const tally = new Map<string, Killer>();
  for (const death of recorder.deaths) {
    const key = death.by ?? '';
    const k = tally.get(key) ?? { by: death.by, damageType: death.damageType, kills: 0 };
    k.kills++;
    tally.set(key, k);
  }
  const killers = [...tally.values()].sort(
    (a, b) => b.kills - a.kills || (a.by ?? '￿').localeCompare(b.by ?? '￿'),
  );
  // The stages the recorder saw fall, read back off its report.
  const stages = recorder.report(engine, false).stages;
  return {
    result,
    kills: engine.stats.kills,
    spawned: engine.stats.spawned,
    killers,
    stages,
    postKiller: engine.phase === 'defeat' ? (engine.stats.ccKillerKind ?? null) : null,
    cp: Math.round(engine.stats.cpSpent),
    supplies: Math.round(engine.stats.suppliesSpent),
    orders: countOrders(record.commands),
  };
}
