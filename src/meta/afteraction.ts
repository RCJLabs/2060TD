/**
 * The after-action report (M29 Phase 1): what a raid's resolution throws away,
 * kept.
 *
 * The resolution says who came home. The battle knew more while it ran: what
 * landed each killing blow and with what, what every squad was doing each
 * tick, and when each stage of the kill chain fell. None of it moves the
 * battle, so none of it is on the resolution or the save. It is had by
 * fighting the raid again: a raid is its config, and the engine is
 * deterministic, so the same config through the same loop (`fightRaid`) is the
 * same battle, tick for tick. A report costs a fraction of a second, on
 * demand, and needs nothing but the config, so a raid watched again from the
 * vault has one as well.
 */
import { Engine, TICKS_PER_SECOND } from '../sim/engine';
import type { Catalog, DamageType, SimConfig, Vec2 } from '../sim/types';
import { fightRaid } from './warfare';

/**
 * What most of a squad's living men were doing on a tick: the engine's own
 * states, and a fire mission's pin over any of them.
 */
export type SquadActivity = 'moving' | 'breaking' | 'engaging' | 'assaulting' | 'stuck' | 'pinned';

/** In the order a tie goes: the more held up of two equal counts is the one a planner needs to hear about. */
export const SQUAD_ACTIVITIES: readonly SquadActivity[] = [
  'pinned',
  'stuck',
  'breaking',
  'assaulting',
  'engaging',
  'moving',
];

/** One thing on the enemy's side that killed men, and how many. */
export interface Killer {
  /** A structure's kind or a power's; null for a death nothing claimed. */
  by: string | null;
  damageType: DamageType | null;
  kills: number;
}

export interface SquadReport {
  slot: number;
  /** Men the plan sent. */
  sent: number;
  /** Men standing when the raid ended. */
  back: number;
  /** Sent but still on their way in when it ended: the raid was over before they arrived. */
  late: number;
  /** The dead, by unit kind. */
  lost: Record<string, number>;
  /** The dead, by what killed them (`Killer.by`, or 'unknown'). */
  killedBy: Record<string, number>;
  /** Seconds of the battle each activity held most of the squad's living men. */
  seconds: Record<SquadActivity, number>;
}

/** One man lost, for the report's tallies and the heat map (Phase 2). */
export interface Death {
  tick: number;
  kind: string;
  /** The squad that sent him, or -1 if the battle never said. */
  squad: number;
  by: string | null;
  damageType: DamageType | null;
  at: Vec2;
}

export interface AfterAction {
  ticks: number;
  cleared: boolean;
  withdrew: boolean;
  /** Most kills first; a tie goes to the name. */
  killers: Killer[];
  /** In plan order. */
  squads: SquadReport[];
  /** The tick each kill-chain stage fell, in order: breach, suppress, charge, burn. */
  stages: number[];
  deaths: Death[];
}

/** Fight the raid in `config` again, and report what it did. */
export function afterAction(config: SimConfig, catalog: Catalog): AfterAction {
  // What the plan sent, from the config itself: every unit is an entry with
  // its squad, including any the battle ends before it arrives.
  const sent = new Map<number, number>();
  const order: number[] = [];
  for (const wave of config.siege?.waves ?? []) {
    for (const entry of wave.entries) {
      const squad = entry.squad ?? -1;
      if (squad < 0) continue;
      if (!sent.has(squad)) order.push(squad);
      sent.set(squad, (sent.get(squad) ?? 0) + 1);
    }
  }
  const squads = new Map<number, SquadReport>();
  const report = (slot: number): SquadReport => {
    let r = squads.get(slot);
    if (!r) {
      r = {
        slot,
        sent: sent.get(slot) ?? 0,
        back: 0,
        late: 0,
        lost: {},
        killedBy: {},
        seconds: { pinned: 0, stuck: 0, breaking: 0, assaulting: 0, engaging: 0, moving: 0 },
      };
      squads.set(slot, r);
    }
    return r;
  };
  for (const slot of order) report(slot);

  const engine = new Engine(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  // Who each man was, learned the tick he is first on the map: by the time
  // his death is told he has been taken off it.
  const who = new Map<number, { kind: string; squad: number }>();
  const ticksIn = new Map<number, Record<SquadActivity, number>>();
  const deaths: Death[] = [];
  const stages: number[] = [];
  const { withdrew } = fightRaid(engine, config, (events) => {
    for (const event of events) {
      if (event.type !== 'attackerDied') continue;
      const man = who.get(event.id);
      deaths.push({
        tick: engine.tick,
        kind: man?.kind ?? 'unknown',
        squad: man?.squad ?? -1,
        by: event.by ?? null,
        damageType: event.damageType ?? null,
        at: { ...event.at },
      });
    }
    const counts = new Map<number, Record<SquadActivity, number>>();
    for (const a of engine.attackers) {
      if (!who.has(a.id)) who.set(a.id, { kind: a.profile.kind, squad: a.squad });
      if (a.hp <= 0 || a.squad < 0) continue;
      let c = counts.get(a.squad);
      if (!c) {
        c = { pinned: 0, stuck: 0, breaking: 0, assaulting: 0, engaging: 0, moving: 0 };
        counts.set(a.squad, c);
      }
      c[a.pinnedUntil > engine.tick ? 'pinned' : a.state]++;
    }
    for (const [squad, c] of counts) {
      let best: SquadActivity = SQUAD_ACTIVITIES[0]!;
      for (const activity of SQUAD_ACTIVITIES) if (c[activity] > c[best]) best = activity;
      let t = ticksIn.get(squad);
      if (!t) {
        t = { pinned: 0, stuck: 0, breaking: 0, assaulting: 0, engaging: 0, moving: 0 };
        ticksIn.set(squad, t);
      }
      t[best]++;
    }
    while (stages.length < engine.chainStagesCleared) stages.push(engine.tick);
  });

  const spawned = new Map<number, number>();
  for (const man of who.values()) spawned.set(man.squad, (spawned.get(man.squad) ?? 0) + 1);
  for (const a of engine.attackers) if (a.squad >= 0) report(a.squad).back++;
  for (const death of deaths) {
    if (death.squad < 0) continue;
    const r = report(death.squad);
    r.lost[death.kind] = (r.lost[death.kind] ?? 0) + 1;
    const by = death.by ?? 'unknown';
    r.killedBy[by] = (r.killedBy[by] ?? 0) + 1;
  }
  for (const r of squads.values()) {
    r.late = Math.max(0, r.sent - (spawned.get(r.slot) ?? 0));
    const t = ticksIn.get(r.slot);
    if (t) for (const activity of SQUAD_ACTIVITIES) r.seconds[activity] = t[activity] / TICKS_PER_SECOND;
  }

  const tally = new Map<string, Killer>();
  for (const death of deaths) {
    const key = death.by ?? '';
    const k = tally.get(key) ?? { by: death.by, damageType: death.damageType, kills: 0 };
    k.kills++;
    tally.set(key, k);
  }
  const killers = [...tally.values()].sort(
    (a, b) => b.kills - a.kills || (a.by ?? '~').localeCompare(b.by ?? '~'),
  );

  return {
    ticks: engine.tick,
    cleared: engine.phase === 'defeat',
    withdrew,
    killers,
    squads: order.map((slot) => report(slot)),
    stages,
    deaths,
  };
}
