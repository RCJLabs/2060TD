import { describe, expect, it } from 'vitest';
import { CHINA_BASE_KIT, generateBase } from '../src/content/bases';
import { M1_CATALOG } from '../src/content/catalog';
import { raidCatalogFor } from '../src/content/factions';
import { TRAINABLE } from '../src/content/usaUnits';
import { afterAction, SQUAD_ACTIVITIES } from '../src/meta/afteraction';
import { raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';
import { Engine, TICKS_PER_SECOND } from '../src/sim/engine';
import type { SimConfig, SimEvent } from '../src/sim/types';

/** M29 Phase 1: the sim keeps what killed each attacker, and says so when it dies. */

const WIDTH = 32;
const idx = (x: number, y: number): number => y * WIDTH + x;

const board = (extra: Partial<SimConfig> = {}): SimConfig => ({
  width: WIDTH,
  height: 24,
  seed: 7,
  ccOrigin: idx(27, 11),
  spawnLane: 0,
  ...extra,
});

/** A sandbox with one structure standing, and an attacker of 1 HP held still at `at`. */
function range(kind: string | null, at: [number, number], structure: [number, number] = [20, 12]): Engine {
  const e = new Engine(board(), M1_CATALOG);
  if (kind) e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(...structure), kind });
  e.enqueue({ tick: 0, type: 'spawnAttacker', cell: idx(...at), kind: 'militia' });
  e.run(1);
  const target = e.attackers[0]!;
  target.hp = 1;
  target.speed = 0;
  return e;
}

/** Step until the attacker dies; its death event. */
function death(e: Engine, limit = 400): Extract<SimEvent, { type: 'attackerDied' }> {
  for (let i = 0; i < limit; i++) {
    const died = e.step().find((ev) => ev.type === 'attackerDied');
    if (died && died.type === 'attackerDied') return died;
  }
  throw new Error('it never died');
}

describe('the killing blow (M29): every death says what landed it', () => {
  it('a gun: the structure that fired, and its damage type', () => {
    const died = death(range('m2nest', [17, 12]));
    expect(died.by).toBe('m2nest');
    expect(died.damageType).toBe('smallArms');
  });

  it('a mine: the field that went off', () => {
    // On the field itself, since a claymore trips within 0.8 of a cell; its
    // blast kills a militiaman outright.
    const e = new Engine(board(), M1_CATALOG);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(10, 5), kind: 'claymore' });
    e.enqueue({ tick: 0, type: 'spawnAttacker', cell: idx(10, 5), kind: 'militia' });
    const died = death(e);
    expect(died.by).toBe('claymore');
    expect(died.damageType).toBe(M1_CATALOG.structures['claymore']!.trigger!.damageType);
  });

  it('a shell: the gun that lobbed it, not whatever stands where it lands', () => {
    const died = death(range('mortar', [14, 12]));
    expect(died.by).toBe('mortar');
    expect(died.damageType).toBe('explosive');
  });

  it('a fire mission: the power that called it', () => {
    const e = range(null, [12, 6]);
    e.enqueue({ tick: e.tick, type: 'castPower', kind: 'a10', target: { x: 12.5, y: 6.5 } });
    const died = death(e);
    expect(died.by).toBe('a10');
    expect(died.damageType).toBe('kinetic');
  });

  it('the last hit counts: a man two guns shot at is the second gun’s', () => {
    const e = range('m2nest', [17, 12]);
    const target = e.attackers[0]!;
    target.hp = 1000;
    target.lastHit = { by: 'mortar', type: 'explosive' };
    for (let i = 0; i < 40 && target.lastHit.by === 'mortar'; i++) e.step();
    expect(target.lastHit).toEqual({ by: 'm2nest', type: 'smallArms' });
  });
});

describe('the after-action report (M29): the raid fought again, with what it threw away kept', () => {
  const CATALOG = raidCatalogFor('usa');
  const plan = (): SquadPlan[] => [
    { units: { abrams: 2, ranger: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
    { units: { javelin: 2, engineer: 2 }, sector: 'N1', doctrine: 'hunt', slot: 1 },
    { units: { ranger: 3 }, sector: 'W1', doctrine: 'assault', slot: 2, delay: 20 },
  ];
  const raids = ([
    [2, 0, 11],
    [3, 1, 4242],
    [4, 2, 99],
  ] as const).map(([tier, variant, seed]) => {
    const config = raidConfig(generateBase(tier, variant, CHINA_BASE_KIT), plan(), seed, TRAINABLE);
    return { tier, config, res: resolveRaid(config, plan(), tier, CATALOG), aar: afterAction(config, CATALOG) };
  });

  it('is the battle the resolution fought: its length, its end, and every squad’s men sent and back', () => {
    for (const { res, aar } of raids) {
      expect(aar.ticks).toBe(res.ticks);
      expect(aar.cleared).toBe(res.cleared);
      expect(aar.withdrew).toBe(res.withdrew);
      for (const r of res.squads) {
        const squad = aar.squads.find((s) => s.slot === r.slot)!;
        expect(squad.sent, `squad ${r.slot}`).toBe(r.deployed);
        expect(squad.back, `squad ${r.slot}`).toBe(r.returned);
      }
    }
  });

  it('accounts for every man lost: the dead and those still on their way in', () => {
    for (const { res, aar } of raids) {
      const lost = Object.values(res.losses).reduce((a, b) => a + b, 0);
      const late = aar.squads.reduce((a, s) => a + s.late, 0);
      expect(aar.deaths.length + late).toBe(lost);
      for (const squad of aar.squads) {
        const dead = Object.values(squad.lost).reduce((a, b) => a + b, 0);
        expect(squad.back + dead + squad.late).toBe(squad.sent);
        expect(Object.values(squad.killedBy).reduce((a, b) => a + b, 0)).toBe(dead);
      }
    }
  });

  it('names what killed them, every one, most kills first', () => {
    for (const { aar } of raids) {
      expect(aar.killers.reduce((a, k) => a + k.kills, 0)).toBe(aar.deaths.length);
      for (let i = 1; i < aar.killers.length; i++) {
        expect(aar.killers[i - 1]!.kills).toBeGreaterThanOrEqual(aar.killers[i]!.kills);
      }
      for (const death of aar.deaths) {
        expect(death.by, `a ${death.kind} died to nothing`).not.toBeNull();
        expect(death.squad).toBeGreaterThanOrEqual(0);
      }
    }
    // Something died somewhere, or the fixture says nothing.
    expect(raids.some(({ aar }) => aar.deaths.length > 0)).toBe(true);
  });

  it('splits each squad’s battle by what most of its men were doing, within the battle’s length', () => {
    for (const { aar } of raids) {
      for (const squad of aar.squads) {
        const total = SQUAD_ACTIVITIES.reduce((a, activity) => a + squad.seconds[activity], 0);
        expect(total).toBeLessThanOrEqual(aar.ticks / TICKS_PER_SECOND + 1e-9);
        if (squad.sent > squad.late) expect(total).toBeGreaterThan(0);
      }
    }
  });

  it('says when each stage of the chain fell, in order', () => {
    for (const { res, aar } of raids) {
      expect(aar.stages.length).toBe(res.chainStages);
      for (let i = 1; i < aar.stages.length; i++) expect(aar.stages[i]!).toBeGreaterThanOrEqual(aar.stages[i - 1]!);
    }
  });

  it('is the same report every time', () => {
    const { config } = raids[1]!;
    expect(afterAction(config, CATALOG)).toEqual(afterAction(config, CATALOG));
  });
});
