import { afterEach, describe, expect, it } from 'vitest';
import { makeResolution, withDepots } from './helpers';
import { M1_CATALOG } from '../src/content/catalog';
import { FACTION_IDS, type FactionId } from '../src/content/factions';
import {
  MANDATES,
  OVERBUILT_HULK,
  OVERBUILT_TRIM,
  PRODUCTION_SURGE,
  RAPID_RESPONSE_KIT,
  RAPID_RESPONSE_REFUND,
  setSignaturesLive,
  signaturesLive,
} from '../src/content/signatures';
import { deserialize, serialize } from '../src/meta/save';
import {
  applySiegeResult,
  newTown,
  outcomeFromEngine,
  probeConfig,
  queueTrain,
  researchEffects,
  siegeConfig,
  surge,
  trainingCost,
  unlockAll,
  type SiegeOutcome,
  type TownState,
} from '../src/meta/town';
import { applyRaidResult, postAt, raidConfig, runOfflineProbes } from '../src/meta/warfare';
import { Engine, TICKS_PER_SECOND } from '../src/sim/engine';
import type { SiegeDef, SimConfig, SimEvent, Signature } from '../src/sim/types';

const T0 = 1_700_000_000_000;

/** M26 Phase 1: the faction rules the sim carries, one at a time. */

const WIDTH = 32;
const idx = (x: number, y: number): number => y * WIDTH + x;

/** Two short waves of militia, no CP income but what kills and refunds bring. */
const TINY: SiegeDef = {
  name: 'TINY',
  startingSupplies: 1000,
  suppliesPerWave: 0,
  startingCp: 100,
  cpCap: 150,
  cpPerSecond: 0,
  prepSeconds: 5,
  repairCostPerHp: 0.04,
  waves: [
    { entries: [{ atTick: 0, kind: 'militia' }, { atTick: 10, kind: 'militia' }] },
    { entries: [{ atTick: 0, kind: 'militia' }] },
  ],
};

const board = (extra: Partial<SimConfig> = {}): SimConfig => ({
  width: WIDTH,
  height: 24,
  seed: 7,
  ccOrigin: idx(27, 11),
  spawnLane: 0,
  ...extra,
});

/** The tiny siege, three guns on the approach and the assault started. */
function siege(signature?: Signature): Engine {
  const e = new Engine(board({ siege: TINY, ...(signature ? { signature } : {}) }), M1_CATALOG);
  for (const [x, y] of [
    [24, 10],
    [24, 13],
    [22, 12],
  ] as const) {
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(x, y), kind: 'm2nest' });
  }
  e.enqueue({ tick: 0, type: 'startAssault' });
  e.run(1);
  expect(e.phase).toBe('combat');
  return e;
}

/** Step until the phase is one of `phases`, collecting what happened on the way. */
function until(e: Engine, phases: string[], limit = 6000): SimEvent[] {
  const events: SimEvent[] = [];
  while (!phases.includes(e.phase) && e.tick < limit) events.push(...e.step());
  return events;
}

const HULK = { seconds: 15, strength: 0.25 };

describe('Rapid Response (USA): a field defence that lives through its wave pays back', () => {
  it('half its CP, at the end of the wave it was placed in', () => {
    const withRule = siege({ refund: 0.5 });
    const without = siege();
    for (const e of [withRule, without]) {
      e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
      until(e, ['prep']);
      expect(e.phase).toBe('prep');
      expect(e.structureAt(idx(31, 23))?.profile.kind).toBe('foxhole');
    }
    const price = M1_CATALOG.structures['foxhole']!.cpCost!;
    expect(withRule.cp - without.cp).toBeCloseTo(price * 0.5, 9);
    expect(withRule.stats.cpRefunded).toBeCloseTo(price * 0.5, 9);
    expect(without.stats.cpRefunded).toBeUndefined();
  });

  it('once: the wave after is not the one it went down in', () => {
    const e = siege({ refund: 0.5 });
    e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    until(e, ['prep']);
    const paid = e.stats.cpRefunded;
    until(e, ['victory', 'defeat']);
    expect(e.phase).toBe('victory');
    expect(e.stats.cpRefunded).toBe(paid);
  });

  it('nothing for one that fell in its wave, or for an emplacement', () => {
    const e = siege({ refund: 0.5 });
    e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    e.run(1);
    e.structureAt(idx(31, 23))!.hp = 0;
    until(e, ['prep']);
    expect(e.phase).toBe('prep');
    // The three guns were bought with supplies before the assault.
    expect(e.stats.cpRefunded).toBeUndefined();
  });

  it('is announced where it stands, for the board to letter', () => {
    const e = siege({ refund: 0.5 });
    e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    const events = until(e, ['prep']);
    const foxhole = e.structureAt(idx(31, 23))!;
    expect(events.filter((ev) => ev.type === 'refund')).toEqual([
      { type: 'refund', id: foxhole.id, at: foxhole.center, cp: M1_CATALOG.structures['foxhole']!.cpCost! * 0.5 },
    ]);
    // And never without the rule.
    const plain = siege();
    plain.enqueue({ tick: plain.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    expect(until(plain, ['prep']).some((ev) => ev.type === 'refund')).toBe(false);
  });

  it('never past the cap', () => {
    const e = siege({ refund: 1 });
    e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    e.run(1);
    e.cp = TINY.cpCap - 1;
    until(e, ['prep']);
    expect(e.cp).toBe(TINY.cpCap);
  });
});

describe('Overbuilt (Russia): a destroyed emplacement burns on as a hulk', () => {
  /** A gun on open ground, nobody near it. */
  function sandbox(signature: Signature | null = { hulk: HULK }): Engine {
    const e = new Engine(board(signature ? { signature } : {}), M1_CATALOG);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(20, 12), kind: 'm2nest' });
    e.run(1);
    return e;
  }

  it('with a quarter of its HP, counted destroyed the moment it fell', () => {
    const e = sandbox();
    const nest = e.structureAt(idx(20, 12))!;
    const version = e.grid.version;
    nest.hp = 0;
    const events = e.step();
    expect(events).toContainEqual(expect.objectContaining({ type: 'structureDestroyed', id: nest.id }));
    expect(e.structureAt(idx(20, 12))).toBe(nest);
    expect(nest.hulk).toBeDefined();
    expect(nest.hp).toBeCloseTo(nest.profile.maxHp * HULK.strength, 9);
    expect(e.stats).toMatchObject({ structuresLost: 1, hulks: 1 });
    // Still in the way: the path through it has not opened.
    expect(nest.profile.blocks).toBe(true);
    expect(e.grid.version).toBe(version);
  });

  it('burns down to nothing over its seconds, and is not destroyed twice', () => {
    const e = sandbox();
    const nest = e.structureAt(idx(20, 12))!;
    nest.hp = 0;
    e.step();
    const version = e.grid.version;
    const events: SimEvent[] = [];
    for (let i = 0; i < HULK.seconds * TICKS_PER_SECOND - 2; i++) events.push(...e.step());
    expect(e.structureAt(idx(20, 12))).toBe(nest);
    for (let i = 0; i < 3; i++) events.push(...e.step());
    expect(e.structureAt(idx(20, 12))).toBeUndefined();
    expect(e.grid.version).toBe(version + 1);
    expect(events.filter((ev) => ev.type === 'structureDestroyed')).toEqual([]);
    expect(e.stats.structuresLost).toBe(1);
  });

  it('fires at a quarter of its damage', () => {
    const firstHit = (hulked: boolean): number => {
      const e = sandbox();
      if (hulked) {
        e.structureAt(idx(20, 12))!.hp = 0;
        e.step();
      }
      e.enqueue({ tick: e.tick, type: 'spawnAttacker', cell: idx(17, 12), kind: 'rifle' });
      for (let i = 0; i < 200; i++) {
        const target = e.attackers[0];
        const before = target?.hp ?? 0;
        const events = e.step();
        if (target && events.some((ev) => ev.type === 'shot')) return before - target.hp;
      }
      throw new Error('the nest never fired');
    };
    const full = firstHit(false);
    expect(full).toBeGreaterThan(0);
    expect(firstHit(true)).toBeCloseTo(full * HULK.strength, 9);
  });

  it('is shot at, and finished off sooner', () => {
    const e = sandbox();
    const nest = e.structureAt(idx(20, 12))!;
    nest.hp = 0;
    e.step();
    nest.hp = 0.001;
    e.step();
    e.step();
    expect(e.structureAt(idx(20, 12))).toBeUndefined();
  });

  it('only an emplacement: a field defence, or a battle without the rule, just falls', () => {
    const field = sandbox();
    field.enqueue({ tick: field.tick, type: 'placeStructure', cell: idx(10, 5), kind: 'foxhole' });
    field.run(1);
    field.structureAt(idx(10, 5))!.hp = 0;
    field.step();
    expect(field.structureAt(idx(10, 5))).toBeUndefined();

    const plain = sandbox(null);
    plain.structureAt(idx(20, 12))!.hp = 0;
    plain.step();
    expect(plain.structureAt(idx(20, 12))).toBeUndefined();
    expect(plain.stats.hulks).toBeUndefined();
  });

  it('collapses when the wave is beaten, so nothing burning is repaired or carried', () => {
    const e = siege({ hulk: { seconds: 600, strength: 0.25 } });
    const nest = e.structureAt(idx(22, 12))!;
    nest.hp = 0;
    e.step();
    expect(nest.hulk).toBeDefined();
    until(e, ['prep']);
    expect(e.phase).toBe('prep');
    expect(e.structureAt(idx(22, 12))).toBeUndefined();
  });

  it('is never among the survivors', () => {
    const e = sandbox();
    e.structureAt(idx(20, 12))!.hp = 0;
    e.step();
    expect(outcomeFromEngine(e).survivors.map((s) => s.cell)).not.toContain(idx(20, 12));
  });
});

describe('the post’s HP (the UN’s humanitarian shield)', () => {
  it('lengthens this battle’s bar and nobody else’s', () => {
    const base = M1_CATALOG.structures['cc']!.maxHp;
    const e = new Engine(board({ mods: { defender: { postHp: 1.3 } } }), M1_CATALOG);
    expect(e.cc.profile.maxHp).toBeCloseTo(base * 1.3, 9);
    expect(e.cc.hp).toBe(e.cc.profile.maxHp);
    expect(M1_CATALOG.structures['cc']!.maxHp).toBe(base);
    expect(new Engine(board(), M1_CATALOG).cc.profile.maxHp).toBe(base);
  });
});

describe('Rapid Response’s kit (USA): few, expensive, excellent', () => {
  const KIT = { scale: 1.5, price: 2 };

  it('a field defence has the scale’s HP and damage, and costs the price’s CP', () => {
    const plain = siege();
    const elite = siege({ elite: KIT });
    for (const e of [plain, elite]) e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    const before = { plain: plain.cp, elite: elite.cp };
    plain.run(1);
    elite.run(1);
    const def = M1_CATALOG.structures['foxhole']!;
    const a = plain.structureAt(idx(31, 23))!;
    const b = elite.structureAt(idx(31, 23))!;
    expect(b.profile.maxHp).toBeCloseTo(a.profile.maxHp * KIT.scale, 9);
    expect(b.hp).toBeCloseTo(b.profile.maxHp, 9);
    expect(b.profile.weapon!.damage).toBeCloseTo(a.profile.weapon!.damage * KIT.scale, 9);
    expect(before.elite - elite.cp).toBeCloseTo(elite.fieldPrice(def.cpCost!), 9);
    expect(elite.fieldPrice(def.cpCost!)).toBe(Math.ceil(def.cpCost! * KIT.price));
    // Walls and fire missions keep their own prices.
    expect(elite.cpPrice(10)).toBe(plain.cpPrice(10));
  });

  it('the emplacements are the kit’s own: untouched', () => {
    const elite = siege({ elite: KIT });
    const nest = elite.structureAt(idx(24, 10))!;
    expect(nest.profile.maxHp).toBe(M1_CATALOG.structures['m2nest']!.maxHp);
  });

  it('the refund is half of what the kit cost', () => {
    const e = siege({ refund: 0.5, elite: KIT });
    e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    until(e, ['prep']);
    expect(e.stats.cpRefunded).toBeCloseTo(e.fieldPrice(M1_CATALOG.structures['foxhole']!.cpCost!) * 0.5, 9);
  });
});

describe('Overbuilt’s trim (Russia): the concrete goes into the burning', () => {
  it('trims every armed emplacement, and nothing else', () => {
    const plain = siege();
    const trimmed = new Engine(board({ siege: TINY, mods: { defender: { emplacementHp: 0.8 } } }), M1_CATALOG);
    trimmed.enqueue({ tick: 0, type: 'placeStructure', cell: idx(24, 10), kind: 'm2nest' });
    trimmed.enqueue({ tick: 0, type: 'startAssault' });
    trimmed.run(1);
    const a = plain.structureAt(idx(24, 10))!;
    const b = trimmed.structureAt(idx(24, 10))!;
    expect(b.profile.maxHp).toBeCloseTo(a.profile.maxHp * 0.8, 9);
    expect(b.profile.weapon!.damage).toBe(a.profile.weapon!.damage);
    expect(trimmed.cc.profile.maxHp).toBe(plain.cc.profile.maxHp);
    trimmed.enqueue({ tick: trimmed.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    trimmed.run(1);
    expect(trimmed.structureAt(idx(31, 23))!.profile.maxHp).toBe(M1_CATALOG.structures['foxhole']!.maxHp);
  });

  it('a trimmed emplacement’s hulk is a share of its trimmed HP', () => {
    const e = new Engine(board({ signature: { hulk: HULK }, mods: { defender: { emplacementHp: 0.8 } } }), M1_CATALOG);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(20, 12), kind: 'm2nest' });
    e.run(1);
    const nest = e.structureAt(idx(20, 12))!;
    nest.hp = 0;
    e.step();
    expect(nest.hp).toBeCloseTo(M1_CATALOG.structures['m2nest']!.maxHp * 0.8 * HULK.strength, 9);
  });
});

describe('rapid deployment’s lighter field defences (the UN)', () => {
  it('scale the field defences’ HP and nothing else, on top of any kit', () => {
    const e = new Engine(board({ siege: TINY, mods: { defender: { fieldHp: 0.7 } } }), M1_CATALOG);
    e.enqueue({ tick: 0, type: 'placeStructure', cell: idx(24, 10), kind: 'm2nest' });
    e.enqueue({ tick: 0, type: 'startAssault' });
    e.run(1);
    e.enqueue({ tick: e.tick, type: 'placeStructure', cell: idx(31, 23), kind: 'foxhole' });
    e.run(1);
    const foxhole = e.structureAt(idx(31, 23))!;
    expect(foxhole.profile.maxHp).toBeCloseTo(M1_CATALOG.structures['foxhole']!.maxHp * 0.7, 9);
    expect(foxhole.profile.weapon!.damage).toBe(M1_CATALOG.structures['foxhole']!.weapon!.damage);
    expect(e.structureAt(idx(24, 10))!.profile.maxHp).toBe(M1_CATALOG.structures['m2nest']!.maxHp);
    const both = new Engine(board({ signature: { elite: { scale: 1.5, price: 2 } }, mods: { defender: { fieldHp: 0.5 } } }), M1_CATALOG);
    both.enqueue({ tick: 0, type: 'placeStructure', cell: idx(10, 5), kind: 'foxhole' });
    both.run(1);
    expect(both.structureAt(idx(10, 5))!.profile.maxHp).toBeCloseTo(M1_CATALOG.structures['foxhole']!.maxHp * 0.75, 9);
  });
});

describe('no rule, no change', () => {
  it('an empty signature fights the battle a missing one does', () => {
    const a = siege({});
    const b = siege();
    for (let i = 0; i < 600; i++) {
      a.step();
      b.step();
    }
    expect(a.stateHash()).toBe(b.stateHash());
  });
});

// ---- the town's half (M26): the rules attached, the mandate, the surge -------------

describe('the rules ride every town battle', () => {
  afterEach(() => setSignaturesLive(true));

  it('the game fights them: the switch is on', () => {
    expect(signaturesLive()).toBe(true);
  });

  it('with the switch off no battle carries one', () => {
    expect(setSignaturesLive(false)).toBe(true);
    for (const faction of FACTION_IDS) {
      const town = withDepots(unlockAll(newTown(T0, faction)), 2);
      expect(siegeConfig(town, 1).signature, faction).toBeUndefined();
      expect(probeConfig(town, 3, 1).signature, faction).toBeUndefined();
    }
    const un = withDepots(unlockAll(newTown(T0, 'un')), 2);
    un.mandate = 'shield';
    expect(siegeConfig(un, 1).mods?.defender?.postHp).toBeUndefined();
  });

  it('the USA’s kit and refund, Russia’s hulk and trim; nothing of the sim’s for the other three', () => {
    const expected: Record<FactionId, Signature | undefined> = {
      usa: { refund: RAPID_RESPONSE_REFUND, elite: { ...RAPID_RESPONSE_KIT } },
      russia: { hulk: { ...OVERBUILT_HULK } },
      china: undefined,
      nk: undefined,
      un: undefined,
    };
    for (const faction of FACTION_IDS) {
      const town = withDepots(unlockAll(newTown(T0, faction)), 2);
      expect(siegeConfig(town, 1).signature, faction).toEqual(expected[faction]);
      expect(probeConfig(town, 3, 1).signature, faction).toEqual(expected[faction]);
      const trim = siegeConfig(town, 1).mods?.defender?.emplacementHp;
      expect(trim, faction).toBe(faction === 'russia' ? OVERBUILT_TRIM : undefined);
    }
  });

  it('the UN’s mandate rides the mods, on top of what research set, the standing one by default', () => {
    const town = withDepots(unlockAll(newTown(T0, 'un')), 2);
    expect(siegeConfig(town, 1).mods?.defender).toEqual({ postHp: MANDATES.shield.mods.postHp });
    town.mandate = 'works';
    expect(siegeConfig(town, 1).mods?.defender).toMatchObject({ wallHp: MANDATES.works.mods.wallHp });
    town.mandate = 'deployment';
    expect(siegeConfig(town, 1).mods?.defender).toMatchObject({ cpCost: MANDATES.deployment.mods.cpCost });
    town.mandate = 'shield';
    expect(siegeConfig(town, 1).mods?.defender).toEqual({ postHp: MANDATES.shield.mods.postHp });
    // Research's own walls, multiplied, and kept to the thousandth a code keeps.
    town.research.completed.push('fortify1');
    town.mandate = 'works';
    const fx = researchEffects(town);
    expect(fx.wallHp).not.toBe(1);
    const wallHp = siegeConfig(town, 1).mods!.defender!.wallHp!;
    expect(wallHp).toBeCloseTo(fx.wallHp * MANDATES.works.mods.wallHp!, 3);
    expect(Math.round(wallHp * 1000) / 1000).toBe(wallHp);
  });
});

describe('Production Surge (China): training costs half after a battle fought', () => {
  afterEach(() => setSignaturesLive(true));

  const MIN = 60_000;
  const WINDOW = PRODUCTION_SURGE.minutes * MIN;

  /** A town with a barracks standing, and the infantry it trains. */
  function lines(faction: FactionId = 'china'): { town: TownState; barracks: number; kind: string } {
    const town = withDepots(unlockAll(newTown(T0, faction)), 2);
    town.supplies = 5000;
    town.fuel = 1000;
    town.structures.push({ id: 9500, kind: 'barracks', cell: 3, level: 3, wrecked: false });
    return { town, barracks: 9500, kind: faction === 'china' ? 'rifle' : 'ranger' };
  }

  it('for half an hour after a battle fought, every unit the lines take on costs half', () => {
    const { town, barracks, kind } = lines();
    const full = trainingCost(town, barracks, kind, T0);
    surge(town, T0);
    expect(town.surgeUntil).toBe(T0 + WINDOW);
    const half = trainingCost(town, barracks, kind, T0 + WINDOW - 1);
    expect(half.supplies).toBe(Math.round(full.supplies * PRODUCTION_SURGE.price));
    expect(half.fuel).toBe(Math.round(full.fuel * PRODUCTION_SURGE.price));
    expect(trainingCost(town, barracks, kind, T0 + WINDOW)).toEqual(full);
  });

  it('queued inside the window, a unit is charged the half', () => {
    const { town, barracks, kind } = lines();
    surge(town, T0);
    const before = town.supplies;
    expect(queueTrain(town, barracks, kind, T0 + MIN)).toBe(true);
    expect(before - town.supplies).toBe(trainingCost(town, barracks, kind, T0 + MIN).supplies);
    expect(before - town.supplies).toBeLessThan(trainingCost(town, barracks, kind, T0 + WINDOW).supplies);
  });

  it('buys price, not time: the lines run at their own speed', () => {
    const plain = lines();
    const surged = lines();
    surge(surged.town, T0);
    queueTrain(plain.town, plain.barracks, plain.kind, T0);
    queueTrain(surged.town, surged.barracks, surged.kind, T0);
    const head = (t: TownState): number | undefined => t.structures.find((s) => s.id === 9500)!.trainEndsAt;
    expect(head(surged.town)).toBe(head(plain.town));
  });

  it('a second battle inside the window extends it rather than stacking', () => {
    const { town, barracks, kind } = lines();
    const full = trainingCost(town, barracks, kind, T0);
    surge(town, T0);
    surge(town, T0 + 10 * MIN);
    expect(town.surgeUntil).toBe(T0 + 10 * MIN + WINDOW);
    expect(trainingCost(town, barracks, kind, T0 + 20 * MIN).supplies).toBe(
      Math.round(full.supplies * PRODUCTION_SURGE.price),
    );
  });

  it('only China’s, and only while the game fights the signatures', () => {
    const usa = lines('usa');
    surge(usa.town, T0);
    expect(usa.town.surgeUntil).toBeUndefined();
    const { town, barracks, kind } = lines();
    surge(town, T0);
    setSignaturesLive(false);
    expect(trainingCost(town, barracks, kind, T0 + MIN)).toEqual(trainingCost(town, barracks, kind, T0 + WINDOW));
    surge(town, T0 + WINDOW);
    expect(town.surgeUntil).toBe(T0 + WINDOW);
  });

  it('a skirmish and a raid are battles fought; the probes the garrison fights are not', () => {
    const skirmish = lines().town;
    applySiegeResult(skirmish, outcomeOf(skirmish, true), T0);
    expect(skirmish.surgeUntil).toBe(T0 + WINDOW);

    const raided = lines().town;
    const base = postAt(raided, 1, 0);
    applyRaidResult(raided, base, makeResolution({ cleared: false }), raidConfig(base, [], 1), T0);
    expect(raided.surgeUntil).toBe(T0 + WINDOW);

    const probed = lines().town;
    probed.lastSeen = T0;
    runOfflineProbes(probed, T0 + 3 * 24 * 60 * MIN);
    expect(probed.surgeUntil).toBeUndefined();
  });
});

describe('the save', () => {
  it('keeps a surge and a mandate, and repairs junk in either', () => {
    const town = withDepots(unlockAll(newTown(T0, 'un')), 2);
    town.mandate = 'shield';
    town.surgeUntil = T0 + 1000;
    const loaded = deserialize(serialize(town))!;
    expect(loaded.mandate).toBe('shield');
    expect(loaded.surgeUntil).toBe(T0 + 1000);
    const raw = town as unknown as Record<string, unknown>;
    raw['mandate'] = 'pacifism';
    raw['surgeUntil'] = 'soon';
    const repaired = deserialize(serialize(town))!;
    expect(repaired.mandate).toBeUndefined();
    expect(repaired.surgeUntil).toBeUndefined();
  });
});

/** A skirmish's end, everything standing. */
function outcomeOf(town: TownState, victory: boolean): SiegeOutcome {
  return {
    victory,
    supplies: Math.floor(town.supplies),
    chargesLeft: { ...town.charges },
    walls: town.walls.map((w) => ({ ...w })),
    survivors: town.structures.filter((s) => s.kind !== 'cc').map((s) => ({ cell: s.cell, kind: s.kind, level: s.level })),
    stats: {
      spawned: 0,
      kills: 0,
      wallsBuilt: 0,
      wallsLost: 0,
      structuresLost: 0,
      suppliesSpent: 0,
      cpSpent: 0,
      salvage: 0,
    },
    ccHpFraction: 1,
  };
}
