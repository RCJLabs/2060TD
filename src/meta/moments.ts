/**
 * The replay bar's marks (M35 Phase 3): what happened in a battle and when,
 * heard off its events as it is fought.
 *
 * A moment is what the footage can be sent to: each wave of a siege, a wall
 * breached, a gun or building lost, a stage of the post's kill chain gone, and
 * each strike a siege's commander called. Its tick is the one after the step
 * it happened in, where the footage shows it done; a jump lands a little
 * before, so the thing is seen happening.
 */
import { TICKS_PER_SECOND, type Engine } from '../sim/engine';
import { CHAIN_ORDER, CHAIN_STAGE_NAME } from '../sim/killchain';
import type { Command, SimEvent } from '../sim/types';

export type MomentKind = 'wave' | 'breach' | 'lost' | 'stage' | 'strike';

export interface Moment {
  tick: number;
  kind: MomentKind;
  /** What it was, as the JUMP list says it. */
  label: string;
}

/** Losses this close together are one moment: a salvo that takes three guns is one thing to jump to. */
export const LOSS_MERGE_TICKS = 3 * TICKS_PER_SECOND;
/** A breach is one moment until the walls have held this long. */
export const BREACH_MERGE_TICKS = 10 * TICKS_PER_SECOND;
/** How far before a moment a jump lands, so it is seen happening. */
export const JUMP_LEAD_TICKS = 2 * TICKS_PER_SECOND;

/** Where a jump to this moment lands: a wave from its start, anything else a little before. */
export function jumpTick(moment: Moment): number {
  return moment.kind === 'wave' ? moment.tick : Math.max(0, moment.tick - JUMP_LEAD_TICKS);
}

export interface MomentOptions {
  /** Whose losses the footage counts: the town's (a siege, a probe) or the post's (a raid). */
  side: 'defender' | 'raider';
  /** A siege's waves are marked; a raid is one assault. */
  waves: boolean;
  /** A structure's or a power's name. */
  name: (kind: string) => string;
}

export class MomentLog {
  readonly moments: Moment[] = [];
  private stages = 0;
  private lastBreach = -Infinity;
  /** The loss moment still taking in the losses around it, and what it has. */
  private losses: { moment: Moment; names: string[] } | null = null;

  constructor(private readonly opts: MomentOptions) {}

  /** One step's events, with the engine after it. */
  observe(engine: Engine, events: readonly SimEvent[]): void {
    const tick = engine.tick;
    for (const e of events) {
      if (this.opts.waves && e.type === 'assaultStarted') this.moments.push({ tick, kind: 'wave', label: 'WAVE 1' });
      else if (this.opts.waves && e.type === 'prepStarted') this.moments.push({ tick, kind: 'wave', label: `WAVE ${e.index + 1}` });
      else if (e.type === 'wallDestroyed') {
        if (tick - this.lastBreach >= BREACH_MERGE_TICKS) this.moments.push({ tick, kind: 'breach', label: 'WALL BREACHED' });
        this.lastBreach = tick;
      } else if (e.type === 'structureDestroyed' && e.kind !== 'cc') this.lost(tick, this.opts.name(e.kind).toUpperCase());
    }
    while (this.stages < engine.chainStagesCleared) {
      const stage = CHAIN_ORDER[this.stages++];
      if (stage) this.moments.push({ tick, kind: 'stage', label: `CHAIN: ${CHAIN_STAGE_NAME[stage]}` });
    }
  }

  /**
   * The strikes a siege's commander called, off its log: standing orders cast
   * too, and those are the town's rules, not a call anybody made in the battle.
   */
  strikes(commands: readonly Command[]): void {
    for (const cmd of commands) {
      if (cmd.type !== 'castPower') continue;
      this.moments.push({ tick: cmd.tick + 1, kind: 'strike', label: `STRIKE: ${this.opts.name(cmd.kind).toUpperCase()}` });
    }
    // Stable, so what happened on one tick keeps the order it was heard in.
    this.moments.sort((a, b) => a.tick - b.tick);
  }

  private lost(tick: number, name: string): void {
    const verb = this.opts.side === 'defender' ? 'LOST' : 'DOWN';
    const open = this.losses;
    if (open && tick - open.moment.tick < LOSS_MERGE_TICKS) {
      open.names.push(name);
      open.moment.label = `${verb}: ${open.names[0]} +${open.names.length - 1}`;
      return;
    }
    const moment: Moment = { tick, kind: 'lost', label: `${verb}: ${name}` };
    this.losses = { moment, names: [name] };
    this.moments.push(moment);
  }
}
