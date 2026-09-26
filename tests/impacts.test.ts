import { describe, expect, it } from 'vitest';
import { M1_CATALOG } from '../src/content/catalog';
import { defenseCatalogFor, FACTION_IDS, raidCatalogFor } from '../src/content/factions';
import {
  BUZZ_GAP,
  EFFECT_KINDS,
  eventImpact,
  IMPACT_KINDS,
  IMPACTS,
  KILL_IMPACT,
  killWeight,
  notePlayed,
  playedImpacts,
  POST_GAP,
  silentImpacts,
  WEAR_GAP,
  WearWatch,
  type ImpactFamily,
  type KillWeight,
} from '../src/game/impacts';
import { Engine } from '../src/sim/engine';
import type { AttackerProfile, SimConfig, SimEvent } from '../src/sim/types';

/**
 * The impact vocabulary (M31 Phase 1): hit, kill, breach and loss, each with
 * one mark and one sound, played only through one table.
 */

const FAMILIES: ImpactFamily[] = ['hit', 'kill', 'breach', 'loss'];

/** Every attacker any army fields, in defence or on a raid, by kind. */
const everyUnit = (): Map<string, AttackerProfile> => {
  const units = new Map<string, AttackerProfile>();
  for (const f of FACTION_IDS) {
    for (const catalog of [defenseCatalogFor(f), raidCatalogFor(f)]) {
      for (const [kind, profile] of Object.entries(catalog.attackers)) units.set(kind, profile);
    }
  }
  return units;
};

describe('the table: every impact has its mark and its sound', () => {
  it('each impact names a mark the renderer draws, a sound, and a mark that lasts', () => {
    for (const kind of IMPACT_KINDS) {
      const impact = IMPACTS[kind];
      expect(EFFECT_KINDS, kind).toContain(impact.mark);
      expect(impact.sound.length, kind).toBeGreaterThan(0);
      expect(impact.life, kind).toBeGreaterThan(0);
    }
  });

  it('all four families are in it', () => {
    const families = new Set(IMPACT_KINDS.map((k) => IMPACTS[k].family));
    expect([...families].sort()).toEqual([...FAMILIES].sort());
  });

  it('no two families share a mark or a sound: a kill never sounds like a hit', () => {
    const markOf = new Map<string, ImpactFamily>();
    const soundOf = new Map<string, ImpactFamily>();
    for (const kind of IMPACT_KINDS) {
      const { family, mark, sound } = IMPACTS[kind];
      expect(markOf.get(mark) ?? family, `${kind}'s mark`).toBe(family);
      expect(soundOf.get(sound) ?? family, `${kind}'s sound`).toBe(family);
      markOf.set(mark, family);
      soundOf.set(sound, family);
    }
  });

  it('each weight of kill has a mark and a sound of its own, and heavier holds longer', () => {
    const kills = (['infantry', 'vehicle', 'air'] as KillWeight[]).map((w) => IMPACTS[KILL_IMPACT[w]]);
    expect(new Set(kills.map((k) => k.mark)).size).toBe(3);
    expect(new Set(kills.map((k) => k.sound)).size).toBe(3);
    expect(kills.every((k) => k.family === 'kill')).toBe(true);
    expect(IMPACTS.killVehicle.life).toBeGreaterThan(IMPACTS.killInfantry.life);
  });

  it('only a breach and a loss are felt, and a loss harder than a breach', () => {
    for (const kind of IMPACT_KINDS) {
      const impact = IMPACTS[kind];
      const felt = impact.family === 'breach' || impact.family === 'loss';
      expect(impact.jolt !== undefined, `${kind} jolts`).toBe(felt);
      expect(impact.haptic !== undefined, `${kind} buzzes`).toBe(felt);
    }
    expect(IMPACTS.breach.haptic).toBe('breach');
    expect(IMPACTS.loss.haptic).toBe('loss');
    expect(IMPACTS.loss.jolt!).toBeGreaterThan(IMPACTS.breach.jolt!);
    // A jolt is a nudge: never more than a fifth of a cell.
    expect(IMPACTS.loss.jolt!).toBeLessThanOrEqual(0.2);
  });

  it('marks the wear and the post at most about twice a second, and buzzes less often than a volley lands', () => {
    expect(WEAR_GAP).toBeGreaterThanOrEqual(0.4);
    expect(POST_GAP).toBeGreaterThanOrEqual(0.4);
    expect(BUZZ_GAP).toBeGreaterThan(0);
  });
});

describe('what each event plays', () => {
  const at = { x: 3, y: 4 };

  it('a round landing is a hit, and a heavy one when it is explosive or shaped', () => {
    const shot = (damageType: Extract<SimEvent, { type: 'shot' }>['damageType']): SimEvent => ({
      type: 'shot',
      from: at,
      to: at,
      damageType,
    });
    expect(eventImpact(shot('smallArms'))).toBe('hit');
    expect(eventImpact(shot('explosive'))).toBe('hitHeavy');
    expect(eventImpact(shot('shaped'))).toBe('hitHeavy');
  });

  it('a death is a kill, weighed by what died', () => {
    const died = (armor: Extract<SimEvent, { type: 'attackerDied' }>['armor']): SimEvent => ({
      type: 'attackerDied',
      id: 1,
      at,
      armor,
    });
    expect(eventImpact(died('none'))).toBe('killInfantry');
    expect(eventImpact(died('light'))).toBe('killVehicle');
    expect(eventImpact(died('heavy'))).toBe('killVehicle');
    expect(eventImpact(died('air'))).toBe('killAir');
  });

  it('a shell or a gun run going off is a hit too', () => {
    expect(eventImpact({ type: 'aoe', at, radius: 1.5 })).toBe('blast');
    expect(eventImpact({ type: 'strafePulse', x0: 1, x1: 8, y: 4 })).toBe('strafe');
    expect(IMPACTS.blast.family).toBe('hit');
    expect(IMPACTS.strafe.family).toBe('hit');
  });

  it('a wall gone is a breach, a building gone a loss, and a hulk is still a loss', () => {
    expect(eventImpact({ type: 'wallDestroyed', cell: 9 })).toBe('breach');
    expect(eventImpact({ type: 'structureDestroyed', id: 2, kind: 'm2nest', at })).toBe('loss');
    expect(eventImpact({ type: 'structureDestroyed', id: 2, kind: 'm2nest', at, hulk: true })).toBe('loss');
  });

  it('notices are not impacts', () => {
    const notices: SimEvent[] = [
      { type: 'refund', id: 1, at, cp: 3 },
      { type: 'garrisonDeployed', kind: 'rifle', at, committed: 1, ceiling: 4 },
      { type: 'powerCast', kind: 'arty', at },
      { type: 'waveStarted', index: 0 },
      { type: 'attackerSpawned', id: 4 },
    ];
    for (const event of notices) expect(eventImpact(event), event.type).toBeNull();
  });
});

describe('a kill weighed by what died', () => {
  it('armour is a vehicle, aircraft fly, and a soft target is infantry', () => {
    expect(killWeight('none')).toBe('infantry');
    expect(killWeight(undefined)).toBe('infantry');
    expect(killWeight('light')).toBe('vehicle');
    expect(killWeight('heavy')).toBe('vehicle');
    expect(killWeight('air')).toBe('air');
  });

  it("every army's units: an aircraft's armour is air and nothing else's is, so every weight is right", () => {
    const units = everyUnit();
    expect(units.size).toBeGreaterThan(20);
    const weights = new Set<KillWeight>();
    for (const [kind, profile] of units) {
      expect(profile.armor === 'air', kind).toBe(profile.air === true);
      const weight = killWeight(profile.armor);
      weights.add(weight);
      if (profile.air) expect(weight, kind).toBe('air');
      else expect(weight, kind).toBe(profile.armor === 'none' ? 'infantry' : 'vehicle');
    }
    expect([...weights].sort()).toEqual(['air', 'infantry', 'vehicle']);
  });
});

describe('wear: health read between frames', () => {
  it('the first reading only learns; a fall is marked; a rise is not', () => {
    const w = new WearWatch<number>(0.5);
    expect(w.wore(1, 100, 0)).toBe(false);
    expect(w.wore(1, 100, 0.1)).toBe(false);
    expect(w.wore(1, 90, 0.2)).toBe(true);
    expect(w.wore(1, 95, 1.5)).toBe(false);
  });

  it('no oftener than the gap for one target, but each target keeps its own', () => {
    const w = new WearWatch<number>(0.5);
    w.wore(1, 100, 0);
    w.wore(2, 100, 0);
    expect(w.wore(1, 90, 0.1)).toBe(true);
    expect(w.wore(1, 80, 0.3)).toBe(false);
    expect(w.wore(2, 90, 0.3)).toBe(true);
    expect(w.wore(1, 70, 0.6)).toBe(true);
  });

  it('a target gone is forgotten, so one built on its cell starts afresh', () => {
    const w = new WearWatch<number>(0.5);
    w.wore(1, 100, 0);
    w.keep(new Set([2]));
    // A cheaper wall on the same cell is not a fall in health.
    expect(w.wore(1, 40, 0.1)).toBe(false);
    expect(w.wore(1, 30, 0.2)).toBe(true);
  });

  it('clear forgets everything: a jump in time is not wear', () => {
    const w = new WearWatch<string>(0.5);
    w.wore('post', 500, 0);
    w.clear();
    expect(w.wore('post', 200, 5)).toBe(false);
  });
});

describe('the sim says what died', () => {
  const WIDTH = 32;
  const idx = (x: number, y: number): number => y * WIDTH + x;
  const board: SimConfig = { width: WIDTH, height: 24, seed: 7, ccOrigin: idx(27, 11), spawnLane: 0 };

  /** One attacker of 1 HP held still before a gun; its death event. */
  const deathOf = (kind: string): Extract<SimEvent, { type: 'attackerDied' }> => {
    const e = new Engine(board, M1_CATALOG);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(20, 12), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: idx(17, 12), kind });
    e.run(1);
    const target = e.attackers[0]!;
    target.hp = 1;
    target.speed = 0;
    for (let i = 0; i < 400; i++) {
      const died = e.step().find((ev) => ev.type === 'attackerDied');
      if (died && died.type === 'attackerDied') return died;
    }
    throw new Error(`${kind} never died`);
  };

  it('a death carries the armour of what died', () => {
    const soft = Object.entries(M1_CATALOG.attackers).find(([, p]) => p.armor === 'none' && !p.air)!;
    const armoured = Object.entries(M1_CATALOG.attackers).find(([, p]) => p.armor !== 'none' && !p.air)!;
    expect(deathOf(soft[0]).armor).toBe('none');
    expect(deathOf(armoured[0]).armor).toBe(armoured[1].armor);
  });
});

describe('the record the harness reads', () => {
  it('counts every impact played, by kind', () => {
    const before = playedImpacts().breach ?? 0;
    notePlayed('breach');
    notePlayed('breach');
    expect(playedImpacts().breach).toBe(before + 2);
  });

  it('names an impact played whose sound was never made', () => {
    notePlayed('loss');
    expect(silentImpacts({ wallBreak: 1 })).toContain('loss');
    expect(silentImpacts({ wallBreak: 1 })).not.toContain('breach');
    expect(silentImpacts({ wallBreak: 1, structureDown: 3 })).toEqual([]);
  });
});
