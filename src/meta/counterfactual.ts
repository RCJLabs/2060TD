/**
 * The counterfactual (M29 Phase 3): the raid as fought, and the same raid with
 * one thing changed.
 *
 * A raid is its config, and a config is a list of men with arrival ticks, not
 * the plan that wrote it. The save keeps the last plan because inferring one
 * is how a restored plan stops being the plan that was written (`StoredPlan`).
 * Here the inference is proven instead: a raid's wave comes from its plan by
 * one function, `raidWave`, so a plan read back off a config is rebuilt into a
 * wave and compared with the one fought, man for man. If anything differs
 * there is no what-if; if nothing does, the plan is the one that was fought.
 *
 * A what-if makes one change (`Change`) and rebuilds only the wave: the post,
 * the ground, the day, the fire plan, the watch and the dice are the raid's
 * own. It is fought on the raid's own seed, beside what happened, and both
 * plans are fought on `WHAT_IF_ROLLS` more seeds, because one roll of a close
 * raid can mislead: of 45 raids fought on twenty seeds each, seven were coin
 * flips. A duel's dice are pinned by design, so its what-if is the one roll
 * there is. Never two changes: every what-if is measured from the raid as
 * fought, so it says what mattered, and is not a place to write the next plan.
 */
import type { TrainMeta } from '../content/usaUnits';
import { createRng } from '../sim/rng';
import { Engine } from '../sim/engine';
import type { Catalog, Doctrine, SimConfig, WaveEntry } from '../sim/types';
import {
  DELAY_STEPS,
  DOCTRINE_IDS,
  fightRaid,
  raidWave,
  sectorCells,
  SECTOR_IDS,
  TUNNEL_DIG_TICKS,
  type SectorId,
  type SquadPlan,
  type StoredPlan,
} from './warfare';

/** What a what-if can change, in the order the card offers them. */
export type ChangeKind = 'more' | 'fewer' | 'entry' | 'doctrine' | 'start';
export const CHANGE_KINDS: readonly ChangeKind[] = ['more', 'fewer', 'entry', 'doctrine', 'start'];

/** One change to one squad of the raid as fought. */
export type Change =
  | { slot: number; kind: 'more' | 'fewer'; unit: string }
  | { slot: number; kind: 'entry'; sector: SectorId }
  | { slot: number; kind: 'doctrine'; doctrine: Doctrine }
  | { slot: number; kind: 'start'; seconds: number };

/** Seeds each plan is fought on besides the raid's own. */
export const WHAT_IF_ROLLS = 10;

/** A wave in the order the engine spawns it: by tick, and in list order on a tie. */
const inOrder = (entries: readonly WaveEntry[]): WaveEntry[] =>
  [...entries].sort((a, b) => a.atTick - b.atTick);

const sameEntry = (a: WaveEntry, b: WaveEntry): boolean =>
  a.atTick === b.atTick &&
  a.kind === b.kind &&
  a.row === b.row &&
  a.col === b.col &&
  (a.doctrine ?? 'assault') === (b.doctrine ?? 'assault') &&
  (a.squad ?? -1) === (b.squad ?? -1) &&
  (a.vet ?? 1) === (b.vet ?? 1);

/**
 * The plan `config` was fought with, in slot order as the planner launches
 * it, or null if it cannot be proven: the plan must rebuild the config's own
 * wave, man for man, and account for every gallery it dug.
 */
export function planOf(config: SimConfig, trainable: readonly TrainMeta[]): SquadPlan[] | null {
  const waves = config.siege?.waves;
  if (!waves || waves.length !== 1) return null;
  const wave = waves[0]!;
  const bySlot = new Map<number, WaveEntry[]>();
  for (const entry of wave.entries) {
    const slot = entry.squad ?? -1;
    if (slot < 0) return null;
    const list = bySlot.get(slot) ?? [];
    list.push(entry);
    bySlot.set(slot, list);
  }
  if (bySlot.size === 0) return null;
  const mouths = [...(config.reservedCells ?? [])];
  const plan: SquadPlan[] = [];
  for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) {
    const entries = inOrder(bySlot.get(slot)!);
    // The squad's first man stands where the plan puts its first: the head of
    // its sector's strip, or beside its gallery's mouth.
    const first = entries[0]!;
    const units: Record<string, number> = {};
    for (const e of entries) units[e.kind] = (units[e.kind] ?? 0) + 1;
    const sector = SECTOR_IDS.find((id) => {
      const head = sectorCells(id)[0]!;
      return head.col === first.col && head.row === first.row;
    });
    const doctrine = first.doctrine ?? 'assault';
    let squad: SquadPlan;
    if (sector) {
      squad = { units, sector, doctrine, slot, delay: first.atTick / 20 };
    } else {
      // Galleries are dug in plan order, so this squad's is the next mouth.
      const tunnel = mouths.shift();
      if (tunnel === undefined) return null;
      squad = { units, sector: SECTOR_IDS[0]!, doctrine, slot, tunnel, delay: (first.atTick - TUNNEL_DIG_TICKS) / 20 };
    }
    if (first.vet !== undefined) squad.vet = first.vet;
    plan.push(squad);
  }
  if (mouths.length > 0) return null;
  const rebuilt = inOrder(raidWave(plan, [...trainable]).entries);
  const fought = inOrder(wave.entries);
  if (rebuilt.length !== fought.length || rebuilt.some((e, i) => !sameEntry(e, fought[i]!))) return null;
  return plan;
}

/** `plan` with `change` made to it. A squad left with nobody in it stays home. */
export function withChange(plan: readonly SquadPlan[], change: Change): SquadPlan[] {
  const next = plan.map((squad) => ({ ...squad, units: { ...squad.units } }));
  const squad = next.find((s) => s.slot === change.slot);
  if (!squad) return next;
  switch (change.kind) {
    case 'more':
      squad.units[change.unit] = (squad.units[change.unit] ?? 0) + 1;
      break;
    case 'fewer':
      if ((squad.units[change.unit] ?? 0) > 1) squad.units[change.unit]!--;
      else delete squad.units[change.unit];
      break;
    case 'entry':
      squad.sector = change.sector;
      break;
    case 'doctrine':
      squad.doctrine = change.doctrine;
      break;
    case 'start':
      squad.delay = change.seconds;
      break;
  }
  return next.filter((s) => Object.values(s.units).some((n) => n > 0));
}

/**
 * The same raid fought with `plan`: its wave rebuilt, and its galleries if the
 * plan digs different ones. Nothing else of the config is touched.
 */
export function refought(config: SimConfig, plan: readonly SquadPlan[], trainable: readonly TrainMeta[]): SimConfig {
  const mouths = plan.filter((s) => s.tunnel !== undefined).map((s) => s.tunnel!);
  const next: SimConfig = { ...config, siege: { ...config.siege!, waves: [raidWave([...plan], [...trainable])] } };
  if (mouths.length > 0) next.reservedCells = mouths;
  else delete next.reservedCells;
  return next;
}

/** What each kind of change can be for a squad: every choice but the one it was fought with. */
export function choicesFor(
  plan: readonly SquadPlan[],
  slot: number,
  trainable: readonly TrainMeta[],
): { more: string[]; fewer: string[]; entry: SectorId[]; doctrine: Doctrine[]; start: number[] } {
  const squad = plan.find((s) => s.slot === slot);
  if (!squad) return { more: [], fewer: [], entry: [], doctrine: [], start: [] };
  return {
    more: trainable.map((t) => t.kind),
    fewer: trainable.map((t) => t.kind).filter((kind) => (squad.units[kind] ?? 0) > 0),
    // A squad that came up through a gallery never crossed a sector line.
    entry: squad.tunnel !== undefined ? [] : SECTOR_IDS.filter((id) => id !== squad.sector),
    doctrine: DOCTRINE_IDS.filter((d) => d !== squad.doctrine),
    start: DELAY_STEPS.filter((s) => s !== squad.delay),
  };
}

/** How a raid ended, in the terms a what-if compares. */
export interface Outcome {
  /** It did what it came for: took the post, or met its objective and withdrew. */
  done: boolean;
  cleared: boolean;
  withdrew: boolean;
  ticks: number;
  sent: number;
  /** Men sent who were not standing at the end, as the resolution counts them. */
  lost: number;
  /** Kill-chain stages done when it ended. */
  stages: number;
}

/** Fight `config` to its end, as the resolution does, and say how it went. */
export function outcomeOf(config: SimConfig, catalog: Catalog): Outcome {
  const engine = new Engine(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  const { withdrew } = fightRaid(engine, config);
  const sent = config.siege?.waves.reduce((n, w) => n + w.entries.length, 0) ?? 0;
  const back = engine.attackers.filter((a) => a.squad >= 0).length;
  const cleared = engine.phase === 'defeat';
  return {
    done: cleared || withdrew,
    cleared,
    withdrew,
    ticks: engine.tick,
    sent,
    lost: sent - back,
    stages: engine.chainStagesCleared,
  };
}

/** A plan over the rolls: how many times it did the job, and the men it lost on average. */
export interface Rolls {
  done: number;
  lost: number;
}

/** The raid as fought beside the raid with one change. */
export interface WhatIf {
  change: Change;
  /** Both on the raid's own dice. */
  fought: Outcome;
  changed: Outcome;
  /** Both plans over `WHAT_IF_ROLLS` more seeds; null for a duel, whose dice are fixed. */
  rolls: { fought: Rolls; changed: Rolls } | null;
  /** The changed raid itself, to watch. */
  config: SimConfig;
}

/**
 * A raid, ready to be asked what-ifs: its proven plan, and what the plan as
 * fought did on the raid's dice and over the rolls, fought once and kept.
 */
export class Counterfactual {
  readonly plan: SquadPlan[];
  private foughtOutcome: Outcome | null = null;
  private foughtRolls: Rolls | null = null;

  private constructor(
    readonly config: SimConfig,
    private readonly catalog: Catalog,
    readonly trainable: readonly TrainMeta[],
    plan: SquadPlan[],
  ) {
    this.plan = plan;
  }

  /** The raid in `config`, or null if its plan cannot be proven (see `planOf`). */
  static of(config: SimConfig, catalog: Catalog, trainable: readonly TrainMeta[]): Counterfactual | null {
    const plan = planOf(config, trainable);
    return plan ? new Counterfactual(config, catalog, trainable, plan) : null;
  }

  /** The seeds the rolls are fought on: drawn from the raid's own, so every look is the same. */
  rollSeeds(): number[] {
    const rng = createRng((this.config.seed ^ 0x5eed_c0de) >>> 0);
    return Array.from({ length: WHAT_IF_ROLLS }, () => Math.floor(rng() * 0x1_0000_0000) >>> 0);
  }

  /** A duel pins its dice (`combatSeed`): there is only the one roll. */
  get fixedDice(): boolean {
    return this.config.combatSeed !== undefined;
  }

  private rolls(config: SimConfig): Rolls {
    let done = 0;
    let lost = 0;
    for (const seed of this.rollSeeds()) {
      const outcome = outcomeOf({ ...config, seed }, this.catalog);
      if (outcome.done) done++;
      lost += outcome.lost;
    }
    return { done, lost: lost / WHAT_IF_ROLLS };
  }

  whatIf(change: Change): WhatIf {
    const config = refought(this.config, withChange(this.plan, change), this.trainable);
    this.foughtOutcome ??= outcomeOf(this.config, this.catalog);
    if (!this.fixedDice) this.foughtRolls ??= this.rolls(this.config);
    return {
      change,
      fought: this.foughtOutcome,
      changed: outcomeOf(config, this.catalog),
      rolls: this.fixedDice ? null : { fought: this.foughtRolls!, changed: this.rolls(config) },
      config,
    };
  }
}

/**
 * The plan the planner reopens with, as launched with this one change (M29
 * Phase 3): `fought` is the stored plan of the raid, and the change is made to
 * it rather than to whatever the planner holds now, so taking a second what-if
 * replaces the first instead of stacking on it.
 */
export function storedWithChange(fought: readonly StoredPlan[], change: Change): StoredPlan[] {
  return fought.map((squad, slot) => {
    const next: StoredPlan = { ...squad, units: { ...squad.units } };
    if (slot !== change.slot) return next;
    switch (change.kind) {
      case 'more':
        next.units[change.unit] = (next.units[change.unit] ?? 0) + 1;
        break;
      case 'fewer':
        if ((next.units[change.unit] ?? 0) > 1) next.units[change.unit]!--;
        else delete next.units[change.unit];
        break;
      case 'entry':
        next.sector = change.sector;
        break;
      case 'doctrine':
        next.doctrine = change.doctrine;
        break;
      case 'start':
        next.delay = change.seconds;
        break;
    }
    return next;
  });
}
