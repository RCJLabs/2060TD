import { describe, expect, it } from 'vitest';
import { generateBase } from '../src/content/bases';
import {
  baseKitFor,
  defenseCatalogFor,
  raidCatalogFor,
  townMetaFor,
} from '../src/content/factions';
import { TECHS, effectsOf, techPrereq, TECH_BY_ID } from '../src/content/research';
import { deserialize } from '../src/meta/save';
import {
  applyMissionResult,
  canResearch,
  caps,
  hasRadar,
  isUnlocked,
  newTown,
  place,
  queueTrain,
  ratesPerMinute,
  siegeConfig,
  startResearch,
  tick,
  unlockAll,
  TOWN_GRID,
  type SiegeOutcome,
} from '../src/meta/town';
import { raidConfig, resolveRaid, scoutPrice, type SquadPlan } from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';
import { campaignFor, trainableFor } from '../src/content/factions';
import { makeSandbox, spawnCell } from './helpers';

const T0 = 1_700_000_000_000;
const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

const outcomeOf = (victory: boolean): SiegeOutcome => ({
  victory,
  supplies: 500,
  chargesLeft: { a10: 0, arty: 0 },
  walls: [],
  survivors: [],
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
  ccHpFraction: 0.5, // below every bonus threshold: base rewards only
});

describe('engine mods', () => {
  it('scales wall hp, cp prices, and attacker stats from config mods', () => {
    const engine = makeSandbox(1, {
      mods: {
        defender: { wallHp: 1.5, cpCost: 0.8 },
        attacker: { hp: 2, damage: 3 },
      },
    });
    engine.enqueue({ tick: 0, type: 'placeWall', cell: engine.grid.idx(5, 5), kind: 'wall' });
    engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(engine, 5), kind: 'walker' });
    engine.step();

    const wall = engine.grid.wallAt(engine.grid.idx(5, 5))!;
    expect(wall.hp).toBe(150 * 1.5);
    expect(engine.cpPrice(25)).toBe(20);

    const walker = engine.attackers[0]!;
    expect(walker.maxHp).toBe(40 * 2);
    expect(walker.hp).toBe(80);
  });

  it('attacker damage mods break walls proportionally faster', () => {
    const run = (damageMult: number): number => {
      const engine = makeSandbox(2, {
        ...(damageMult !== 1 ? { mods: { attacker: { damage: damageMult } } } : {}),
      });
      // Wall directly in the lane; the breacher chews through it.
      for (let y = 0; y < engine.grid.height; y++) {
        engine.enqueue({ tick: 0, type: 'placeWall', cell: engine.grid.idx(8, y), kind: 'wall' });
      }
      engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(engine, 4), kind: 'breacher' });
      let ticks = 0;
      while (engine.stats.wallsLost === 0 && ticks < 2000) {
        engine.step();
        ticks++;
      }
      return ticks;
    };
    const base = run(1);
    const boosted = run(2);
    expect(boosted).toBeLessThan(base);
  });

  it('defender weapon mods hit harder for the same battle', () => {
    const run = (weaponMult: number): number => {
      const engine = makeSandbox(3, {
        ...(weaponMult !== 1 ? { mods: { defender: { weaponDamage: weaponMult } } } : {}),
      });
      engine.enqueue({
        tick: 0,
        type: 'placeStructure',
        cell: engine.grid.idx(4, 4),
        kind: 'm2nest',
      });
      engine.enqueue({ tick: 0, type: 'spawnAttacker', cell: spawnCell(engine, 4), kind: 'tank' });
      engine.run(60);
      return engine.attackers[0]!.hp;
    };
    const normal = run(1);
    const boosted = run(1.5);
    expect(boosted).toBeLessThan(normal);
  });
});

describe('raid fire support', () => {
  const squads: SquadPlan[] = [
    { units: { ranger: 2 }, sector: 'W1', doctrine: 'assault' },
  ];

  it('auto-powers strike structures, spend charges, and stay deterministic', () => {
    const base = generateBase(1, 0, baseKitFor('usa'));
    const support = {
      powerCharges: { arty: 2, a10: 1 },
      autoPowers: [
        { kind: 'arty', atSeconds: 1, target: 'cc' as const },
        { kind: 'a10', atSeconds: 2, target: 'guns' as const },
      ],
    };
    const config = raidConfig(base, squads, 99, trainableFor('usa'), support);
    expect(config.playerSide).toBe('attacker');

    const first = resolveRaid(config, squads, 1, raidCatalogFor('usa'));
    const second = resolveRaid(config, squads, 1, raidCatalogFor('usa'));
    expect(second).toEqual(first);
    expect(first.powersUsed['arty']).toBe(1);
    expect(first.powersUsed['a10']).toBe(1);
    // A 155 on the command post plus a two-ranger escort beats tier 1.
    expect(first.destructionPct).toBeGreaterThan(0);
  });

  it('attacker-side impacts damage the base, never the raiders', () => {
    // A bare command post, no towers: the only fire on the map is ours.
    const bare = {
      tier: 1,
      variant: 0,
      name: 'TEST POST',
      ccOrigin: 10 * 32 + 15,
      ccLevel: 1,
      walls: [],
      structures: [],
    };
    const config = raidConfig(bare, squads, 7, trainableFor('usa'), {
      powerCharges: { arty: 1 },
      autoPowers: [{ kind: 'arty', atSeconds: 0, target: 'cc' as const }],
    });
    const engine = new Engine(config, raidCatalogFor('usa'));
    engine.enqueue({ tick: 0, type: 'startAssault' });
    engine.run(110); // shells land (delay 30 + spacing), rangers still walking
    expect(engine.cc.hp).toBeLessThan(engine.cc.profile.maxHp);
    expect(engine.attackers.length).toBeGreaterThan(0);
    for (const attacker of engine.attackers) {
      expect(attacker.hp).toBe(attacker.maxHp); // our own shells never touch them
    }
  });
});

describe('research program', () => {
  function radarTown() {
    const town = unlockAll(newTown(T0, 'usa'));
    town.supplies = 9000;
    town.fuel = 2000;
    town.structures.find((s) => s.kind === 'cc')!.level = 2; // radar gate: CC2
    place(town, 'radar', idx(20, 5), T0);
    tick(town, T0 + 60_000); // built (35s)
    return town;
  }

  it('gates on the signals station, prereqs, focus, and intel', () => {
    const town = unlockAll(newTown(T0, 'usa'));
    town.intel = 500;
    expect(hasRadar(town)).toBe(false);
    expect(canResearch(town, 'fortify1')).toBe('radar');

    const ready = radarTown();
    ready.intel = 500;
    expect(hasRadar(ready)).toBe(true);
    expect(canResearch(ready, 'nonsense')).toBe('unknown');
    expect(canResearch(ready, 'fortify2')).toBe('prereq');
    expect(canResearch(ready, 'fortify1')).toBeNull();

    expect(startResearch(ready, 'fortify1', T0 + 60_000)).toBe(true);
    expect(ready.intel).toBe(500 - TECH_BY_ID['fortify1']!.intel);
    expect(canResearch(ready, 'strike1')).toBe('busy');

    tick(ready, T0 + 60_000 + TECH_BY_ID['fortify1']!.seconds * 1000 + 1000);
    expect(ready.research.completed).toContain('fortify1');
    expect(ready.research.active).toBeNull();
    expect(canResearch(ready, 'fortify1')).toBe('done');
    expect(canResearch(ready, 'fortify2')).toBeNull();
  });

  it('radar generates and caps intel; effects reshape the economy', () => {
    const town = radarTown();
    place(town, 'supplyDepot', idx(20, 15), T0 + 60_000);
    tick(town, T0 + 120_000); // depot built
    expect(ratesPerMinute(town).intel).toBe(4);
    expect(ratesPerMinute(town).supplies).toBe(40);
    expect(caps(town).intel).toBeGreaterThan(150);
    town.intel = 0;
    tick(town, T0 + 120_000 + 10 * 60_000); // ten minutes of signals
    expect(town.intel).toBeCloseTo(40, 0);

    const before = caps(town);
    town.research.completed = ['logistics1', 'logistics3', 'strike3', 'logistics2'];
    const after = caps(town);
    expect(after.supplies).toBe(Math.floor(before.supplies * 1.2));
    expect(ratesPerMinute(town).supplies).toBeCloseTo(40 * 1.15, 5);
    expect(scoutPrice(town, 1)).toBe(Math.ceil(45 * 0.6));

    // Faster training: the queue head lands at 75% of book time.
    place(town, 'barracks', idx(20, 10), T0 + 700_000);
    tick(town, T0 + 800_000);
    const barracks = town.structures.find((s) => s.kind === 'barracks')!;
    town.supplies = 5000;
    expect(queueTrain(town, barracks.id, 'ranger', T0 + 800_000)).toBe(true);
    expect(barracks.trainEndsAt).toBe(T0 + 800_000 + 12 * 0.75 * 1000);
  });

  it('folds defender effects into battle configs (replay-safe)', () => {
    const town = radarTown();
    town.research.completed = ['fortify1', 'fortify2', 'fortify3'];
    const config = siegeConfig(town, 5);
    expect(config.mods?.defender).toEqual({ wallHp: 1.15, weaponDamage: 1.12, cpCost: 0.8 });

    const plain = radarTown();
    expect(siegeConfig(plain, 5).mods).toBeUndefined();
  });

  it('tech table is well-formed: unique ids, linear prereqs, real effects', () => {
    const ids = new Set(TECHS.map((t) => t.id));
    expect(ids.size).toBe(TECHS.length);
    for (const tech of TECHS) {
      const prereq = techPrereq(tech);
      if (tech.tier === 1) expect(prereq).toBeNull();
      else expect(prereq && ids.has(prereq)).toBe(true);
    }
    // Full board must move every knob off identity.
    const fx = effectsOf(TECHS.map((t) => t.id));
    for (const value of Object.values(fx)) expect(value).not.toBe(1);
  });
});

describe('v0.4 integration', () => {
  it('migrating a v4 save backfills new requisitions from cleared missions', () => {
    const legacy = {
      schema: 4,
      savedAt: T0,
      town: {
        version: 4,
        faction: 'usa',
        supplies: 800,
        fuel: 150,
        structures: [{ id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: 2, wrecked: false }],
        walls: [],
        charges: { a10: 0, arty: 0 },
        campaign: {
          next: 5,
          completed: ['m1', 'm2', 'm3', 'm4', 'm5'],
          difficulty: 'standard',
          bonuses: [],
        },
        // The v0.3-era grant for m1–m5, which never included 'radar'.
        unlocked: [
          'wall', 'supplyDepot', 'm2nest', 'storageBunker', 'depmg', 'foxhole',
          'claymore', 'hesco', 'fuelDepot', 'cc2', 'autocannon', 'engBay',
          'barracks', 'frontline',
        ],
        army: {},
        frontline: { tier: 1, wins: 0, totalWins: 0, pendingCounterattack: false, scouted: [] },
        defenseLog: [],
        shieldUntil: 0,
        lastRaid: null,
        assaultLevel: 3,
        victories: 5,
        defeats: 0,
        lastSeen: T0,
        nextId: 4,
      },
    };
    const town = deserialize(JSON.stringify(legacy))!;
    expect(town.version).toBe(5);
    expect(isUnlocked(town, 'radar')).toBe(true); // m5 grants it now
    expect(isUnlocked(town, 'mortar')).toBe(false); // m6 not cleared
    expect(town.intel).toBe(0);
    expect(town.research).toEqual({ completed: [], active: null });
  });

  it('replaying a cleared mission pays 35% and grants nothing new', () => {
    const town = newTown(T0, 'usa');
    const m1 = campaignFor('usa')[0]!;
    const first = applyMissionResult(town, m1, outcomeOf(true), T0);
    expect(first.rewardSupplies).toBe(m1.reward.supplies);
    const unlockedCount = town.unlocked.length;

    const replay = applyMissionResult(town, m1, outcomeOf(true), T0 + 1000);
    expect(replay.firstClear).toBe(false);
    expect(replay.rewardSupplies).toBe(Math.floor(m1.reward.supplies * 0.35));
    expect(replay.unlocked).toEqual([]);
    expect(town.unlocked).toHaveLength(unlockedCount);
  });

  it('the radar role resolves for both factions with faction names', () => {
    for (const faction of ['usa', 'china'] as const) {
      expect(defenseCatalogFor(faction).structures['radar']).toBeDefined();
      expect(townMetaFor(faction)['radar']).toBeDefined();
    }
    expect(defenseCatalogFor('usa').structures['radar']!.name).toBe('Signals Station');
    expect(defenseCatalogFor('china').structures['radar']!.name).toBe('Signals Post');
  });
});
