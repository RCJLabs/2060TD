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
 *
 * Phase 2 adds where. The dead already had their place; the recorder keeps
 * where the fire landed on the living, cell by cell, and the heat map draws
 * both. It is fed tick by tick, by `afterAction` in one go or by the replay as
 * it plays, so the map on the footage is the report's own. The last raid on a
 * post is found in the vault (`lastRaidOn`), so the planner can draw it on the
 * post.
 */
import { MAP_H, MAP_W, type GeneratedBase } from '../content/bases';
import { Engine, TICKS_PER_SECOND } from '../sim/engine';
import type { Catalog, DamageType, LayoutStructure, LayoutWall, SimConfig, SimEvent, Vec2 } from '../sim/types';
import type { TownState } from './town';
import { isFiled, openEntry, vaultOf } from './vault';
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

/** One man lost, for the report's tallies and the heat map's crosses (Phase 2). */
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
  /** The board's width in cells, which `hits` is laid out by. */
  width: number;
  /**
   * Where the fire landed (Phase 2): the damage men took in each cell,
   * row-major, in men's worth (a hit counts its share of the man's whole
   * health, so a man killed outright is one). The heat map's shade.
   */
  hits: number[];
}

const noActivity = (): Record<SquadActivity, number> => ({
  pinned: 0,
  stuck: 0,
  breaking: 0,
  assaulting: 0,
  engaging: 0,
  moving: 0,
});

/**
 * A battle's report, kept as it is fought (M29 Phase 2).
 *
 * Whatever steps a battle feeds it each tick: `afterAction` fighting a raid
 * again in one go, or the replay as it plays. Both get the same report from
 * the same ticks, so the heat map on the footage is the report's own.
 */
export class BattleRecorder {
  /** Every man lost so far, in the order they fell. */
  readonly deaths: Death[] = [];
  /** Men's worth of damage taken in each cell so far, row-major (`AfterAction.hits`). */
  readonly hits: number[];
  private readonly width: number;
  private readonly height: number;
  /** What the plan sent, by squad, and the squads in plan order. */
  private readonly sent = new Map<number, number>();
  private readonly order: number[] = [];
  /**
   * Who each man was, learned the tick he is first on the map: by the time
   * his death is told he has been taken off it.
   */
  private readonly who = new Map<number, { kind: string; squad: number }>();
  /** Each man's health when last seen, against his whole: what the next hit takes off him. */
  private readonly health = new Map<number, { hp: number; max: number }>();
  private readonly ticksIn = new Map<number, Record<SquadActivity, number>>();
  private readonly stages: number[] = [];

  constructor(config: SimConfig) {
    this.width = config.width;
    this.height = config.height;
    this.hits = new Array<number>(config.width * config.height).fill(0);
    // What the plan sent, from the config itself: every unit is an entry with
    // its squad, including any the battle ends before it arrives.
    for (const wave of config.siege?.waves ?? []) {
      for (const entry of wave.entries) {
        const squad = entry.squad ?? -1;
        if (squad < 0) continue;
        if (!this.sent.has(squad)) this.order.push(squad);
        this.sent.set(squad, (this.sent.get(squad) ?? 0) + 1);
      }
    }
  }

  /** One tick: the events it raised, and the engine after it. */
  observe(engine: Engine, events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type !== 'attackerDied') continue;
      const man = this.who.get(event.id);
      this.deaths.push({
        tick: engine.tick,
        kind: man?.kind ?? 'unknown',
        squad: man?.squad ?? -1,
        by: event.by ?? null,
        damageType: event.damageType ?? null,
        at: { ...event.at },
      });
      // The blow that killed him took what he had left, where he fell. He is
      // off the map by now, so this is the only place it can be counted.
      const was = this.health.get(event.id);
      this.hit(event.at, was ? was.hp / was.max : 1);
      this.health.delete(event.id);
    }
    const counts = new Map<number, Record<SquadActivity, number>>();
    for (const a of engine.attackers) {
      if (!this.who.has(a.id)) this.who.set(a.id, { kind: a.profile.kind, squad: a.squad });
      // Whatever he has lost since he was last seen, he lost where he stands.
      const hp = Math.max(0, a.hp);
      const was = this.health.get(a.id) ?? { hp: a.maxHp, max: a.maxHp };
      if (hp < was.hp) this.hit(a.pos, (was.hp - hp) / was.max);
      this.health.set(a.id, { hp, max: was.max });
      if (a.hp <= 0) continue;
      const activity: SquadActivity = a.pinnedUntil > engine.tick ? 'pinned' : a.state;
      if (a.squad < 0) continue;
      let c = counts.get(a.squad);
      if (!c) {
        c = noActivity();
        counts.set(a.squad, c);
      }
      c[activity]++;
    }
    for (const [squad, c] of counts) {
      let best: SquadActivity = SQUAD_ACTIVITIES[0]!;
      for (const activity of SQUAD_ACTIVITIES) if (c[activity] > c[best]) best = activity;
      let t = this.ticksIn.get(squad);
      if (!t) {
        t = noActivity();
        this.ticksIn.set(squad, t);
      }
      t[best]++;
    }
    while (this.stages.length < engine.chainStagesCleared) this.stages.push(engine.tick);
  }

  /** Damage landing on a man at `at`, in men's worth. */
  private hit(at: Vec2, share: number): void {
    const x = Math.floor(at.x);
    const y = Math.floor(at.y);
    if (share > 0 && x >= 0 && x < this.width && y >= 0 && y < this.height) this.hits[y * this.width + x]! += share;
  }

  /** The report, from the battle as it stands: call it once the battle is over. */
  report(engine: Engine, withdrew: boolean): AfterAction {
    const squads = new Map<number, SquadReport>();
    const squadFor = (slot: number): SquadReport => {
      let r = squads.get(slot);
      if (!r) {
        r = { slot, sent: this.sent.get(slot) ?? 0, back: 0, late: 0, lost: {}, killedBy: {}, seconds: noActivity() };
        squads.set(slot, r);
      }
      return r;
    };
    for (const slot of this.order) squadFor(slot);

    const spawned = new Map<number, number>();
    for (const man of this.who.values()) spawned.set(man.squad, (spawned.get(man.squad) ?? 0) + 1);
    for (const a of engine.attackers) if (a.squad >= 0) squadFor(a.squad).back++;
    for (const death of this.deaths) {
      if (death.squad < 0) continue;
      const r = squadFor(death.squad);
      r.lost[death.kind] = (r.lost[death.kind] ?? 0) + 1;
      const by = death.by ?? 'unknown';
      r.killedBy[by] = (r.killedBy[by] ?? 0) + 1;
    }
    for (const r of squads.values()) {
      r.late = Math.max(0, r.sent - (spawned.get(r.slot) ?? 0));
      const t = this.ticksIn.get(r.slot);
      if (t) for (const activity of SQUAD_ACTIVITIES) r.seconds[activity] = t[activity] / TICKS_PER_SECOND;
    }

    const tally = new Map<string, Killer>();
    for (const death of this.deaths) {
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
      squads: this.order.map((slot) => squadFor(slot)),
      stages: [...this.stages],
      deaths: this.deaths.map((d) => ({ ...d, at: { ...d.at } })),
      width: this.width,
      hits: [...this.hits],
    };
  }
}

/** Fight the raid in `config` again, and report what it did. */
export function afterAction(config: SimConfig, catalog: Catalog): AfterAction {
  const engine = new Engine(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  const recorder = new BattleRecorder(config);
  const { withdrew } = fightRaid(engine, config, (events) => recorder.observe(engine, events));
  return recorder.report(engine, withdrew);
}

/** A layout as one comparable string: what stands where, in any order. */
function groundKey(walls: readonly LayoutWall[], structures: readonly LayoutStructure[]): string {
  return [
    ...walls.map((w) => `w${w.cell}:${w.kind}`),
    ...structures.map((s) => `s${s.cell}:${s.kind}:${s.level ?? 1}`),
  ]
    .sort()
    .join(',');
}

/**
 * Was this battle fought on this base: the same board, ground, post and
 * everything built around it? A base is generated from its rung, its slot
 * and the faction, so a post raided twice is the same layout both times; a
 * layout from an older generator, or another post, is not this one.
 */
export function sameGround(config: SimConfig, base: GeneratedBase): boolean {
  return (
    config.width === MAP_W &&
    config.height === MAP_H &&
    config.ccOrigin === base.ccOrigin &&
    (config.ccLevel ?? 1) === base.ccLevel &&
    (config.terrainSeed ?? 0) === base.terrainSeed &&
    groundKey(config.layout?.walls ?? [], config.layout?.structures ?? []) ===
      groundKey(base.walls, base.structures)
  );
}

/**
 * The newest raid (or duel) this commander fought on a base's ground, from
 * the vault, or null if none is kept. Only the town's own battles: a code
 * filed from somebody else is their raid, not the last one here.
 */
export function lastRaidOn(town: TownState, base: GeneratedBase): { config: SimConfig; at: number } | null {
  for (const entry of vaultOf(town)) {
    if ((entry.kind !== 'raid' && entry.kind !== 'duel') || isFiled(entry)) continue;
    const replay = openEntry(entry);
    if (!replay || replay.faction !== town.faction) continue;
    if (sameGround(replay.config, base)) return { config: replay.config, at: entry.at };
  }
  return null;
}
