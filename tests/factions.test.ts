import { describe, expect, it } from 'vitest';
import { buildAssault, probeAssault } from '../src/content/assaults';
import { generateBase } from '../src/content/bases';
import { BUILDABLE_KINDS } from '../src/content/buildings';
import { ALL_UNLOCK_KEYS, missionSiege } from '../src/content/campaign';
import {
  FACTION_IDS,
  baseKitFor,
  campaignFor,
  defenseCatalogFor,
  enemyRosterFor,
  raidCatalogFor,
  townMetaFor,
  trainableFor,
  trainMetaFor,
  wreckRepairFractionFor,
} from '../src/content/factions';
import { lootFor } from '../src/content/bases';
import { deserialize, serialize } from '../src/meta/save';
import {
  applyMissionResult,
  armyManpower,
  canTrain,
  isUnlocked,
  newTown,
  place,
  queueTrain,
  repairCost,
  siegeConfig,
  tick,
  unlockAll,
  TOWN_GRID,
  type SiegeOutcome,
} from '../src/meta/town';
import { applyRaidResult, raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';

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
  ccHpFraction: 1,
});

describe('faction pipeline', () => {
  it.each(FACTION_IDS)('%s campaign grants every unlock key and completes', (faction) => {
    const town = newTown(T0, faction);
    for (const mission of campaignFor(faction)) {
      applyMissionResult(town, mission, outcomeOf(true), T0);
    }
    expect(town.campaign.next).toBe(campaignFor(faction).length);
    for (const key of ALL_UNLOCK_KEYS) {
      expect(isUnlocked(town, key), `${faction} never granted ${key}`).toBe(true);
    }
  });

  it.each(FACTION_IDS)('%s defense catalog resolves every kind it can meet', (faction) => {
    const catalog = defenseCatalogFor(faction);
    // Every attacker kind any campaign wave or ladder assault can spawn.
    const kinds = new Set<string>();
    for (const mission of campaignFor(faction)) {
      for (const wave of mission.waves) for (const entry of wave.entries) kinds.add(entry.kind);
    }
    const roster = enemyRosterFor(faction);
    for (const def of [buildAssault(5, roster), probeAssault(3, roster)]) {
      for (const wave of def.waves) for (const entry of wave.entries) kinds.add(entry.kind);
    }
    for (const kind of kinds) {
      expect(catalog.attackers[kind], `${faction} defense missing attacker ${kind}`).toBeDefined();
    }
    // Everything the town can build, plus battle-layer content.
    for (const kind of [...BUILDABLE_KINDS, 'cc', 'depmg', 'foxhole', 'claymore']) {
      expect(catalog.structures[kind], `${faction} defense missing structure ${kind}`).toBeDefined();
      expect(townMetaFor(faction)[kind === 'depmg' || kind === 'foxhole' || kind === 'claymore' ? 'cc' : kind]).toBeDefined();
    }
    for (const kind of ['wall', 'hesco']) {
      expect(catalog.walls[kind], `${faction} defense missing wall ${kind}`).toBeDefined();
    }
    for (const kind of ['a10', 'arty']) {
      expect(catalog.powers[kind], `${faction} defense missing power ${kind}`).toBeDefined();
    }
  });

  it.each(FACTION_IDS)('%s raid catalog covers its roster and the enemy base kit', (faction) => {
    const catalog = raidCatalogFor(faction);
    for (const meta of trainableFor(faction)) {
      expect(catalog.attackers[meta.kind], `${faction} cannot field ${meta.kind}`).toBeDefined();
    }
    const kit = baseKitFor(faction);
    for (const kind of [...kit.towers, kit.cache, kit.dump, 'cc']) {
      expect(catalog.structures[kind], `${faction} raids missing structure ${kind}`).toBeDefined();
      const loot = lootFor(kind, 2);
      expect(loot.supplies + loot.fuel, `${kind} pays no loot`).toBeGreaterThan(0);
    }
    const base = generateBase(2, 1, kit);
    for (const wall of base.walls) {
      expect(catalog.walls[wall.kind], `${faction} raids missing wall ${wall.kind}`).toBeDefined();
    }
    for (const s of base.structures) {
      expect(catalog.structures[s.kind], `generated base uses unknown ${s.kind}`).toBeDefined();
    }
  });

  it('china raids a US firebase deterministically and takes losses home', () => {
    const squads: SquadPlan[] = [
      { units: { type99: 1, rifle: 2 }, sector: 'W1', doctrine: 'assault' },
      { units: { grenadier: 2, sapper: 1 }, sector: 'N1', doctrine: 'hunt' },
      { units: { militia: 4, sapper: 1 }, sector: 'S1', doctrine: 'raze' },
    ];
    const base = generateBase(1, 0, baseKitFor('china'));
    const config = raidConfig(base, squads, 424242, trainableFor('china'));
    const first = resolveRaid(config, squads, 1, raidCatalogFor('china'));
    const second = resolveRaid(config, squads, 1, raidCatalogFor('china'));
    expect(second).toEqual(first); // same config → identical battle
    expect(first.deployed['militia']).toBe(4);
    expect(first.ticks).toBeGreaterThan(0);

    const town = unlockAll(newTown(T0, 'china'));
    town.army = { type99: 1, rifle: 2, grenadier: 2, sapper: 2, militia: 4 };
    applyRaidResult(town, base, first, config, T0 + 1000);
    for (const [kind, lost] of Object.entries(first.losses)) {
      const started = { type99: 1, rifle: 2, grenadier: 2, sapper: 2, militia: 4 }[kind] ?? 0;
      expect(town.army[kind]).toBe(Math.max(0, started - lost));
    }
    expect(town.lastRaid?.baseName).toBe(base.name);
  });

  it('a china town trains PLA units and its sieges spawn US attackers', () => {
    const town = unlockAll(newTown(T0, 'china'));
    town.supplies = 5000;
    town.fuel = 1000;
    expect(place(town, 'barracks', idx(20, 5), T0)).toBe(true);
    tick(town, T0 + 60_000); // build finishes (30s base time)
    const barracks = town.structures.find((s) => s.kind === 'barracks')!;
    expect(canTrain(town, barracks.id, 'militia')).toBeNull();
    expect(canTrain(town, barracks.id, 'ranger')).toBe('unknown'); // not china's roster
    expect(queueTrain(town, barracks.id, 'militia', T0 + 60_000)).toBe(true);
    tick(town, T0 + 120_000);
    expect(town.army['militia']).toBe(1);
    expect(armyManpower(town)).toBe(trainMetaFor('china')['militia']!.manpower);

    const config = siegeConfig(town, 7);
    const kinds = new Set(config.siege!.waves.flatMap((w) => w.entries.map((e) => e.kind)));
    for (const kind of kinds) {
      expect(
        defenseCatalogFor('china').attackers[kind],
        `china siege spawns unknown ${kind}`,
      ).toBeDefined();
    }
    expect(kinds.has('guardsman') || kinds.has('ranger')).toBe(true); // the US is attacking
    expect(kinds.has('militia')).toBe(false); // and not the PLA
  });

  it('save schema 4 round-trips china; schema 3 saves default to usa', () => {
    const china = newTown(T0, 'china');
    expect(deserialize(serialize(china))?.faction).toBe('china');

    const legacyV3 = {
      schema: 3,
      savedAt: T0,
      town: {
        version: 3,
        supplies: 800,
        fuel: 150,
        structures: [{ id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: 1, wrecked: false }],
        walls: [],
        charges: { a10: 0, arty: 0 },
        campaign: { next: 3, completed: ['m1', 'm2', 'm3'], difficulty: 'standard', bonuses: [] },
        unlocked: ['wall', 'supplyDepot', 'm2nest'],
        army: { ranger: 2 },
        frontline: { tier: 1, wins: 0, totalWins: 0, pendingCounterattack: false, scouted: [] },
        defenseLog: [],
        shieldUntil: 0,
        lastRaid: null,
        assaultLevel: 2,
        victories: 3,
        defeats: 0,
        lastSeen: T0,
        nextId: 5,
      },
    };
    const migrated = deserialize(JSON.stringify(legacyV3))!;
    expect(migrated).not.toBeNull();
    expect(migrated.version).toBe(6);
    expect(migrated.faction).toBe('usa');
    expect(migrated.campaign.next).toBe(3);
    expect(migrated.army['ranger']).toBe(2);
    expect(migrated.intel).toBe(0);
  });

  it.each(['china', 'russia'] as const)(
    "%s's first mission runs in-engine on its own catalog",
    (faction) => {
      const mission = campaignFor(faction)[0]!;
      const config = {
        width: TOWN_GRID.width,
        height: TOWN_GRID.height,
        seed: 99,
        ccOrigin: TOWN_GRID.ccOrigin,
        spawnColumn: TOWN_GRID.spawnColumn,
        siege: { ...missionSiege(mission, 'standard'), startingSupplies: 0 },
      };
      const engine = new Engine(config, defenseCatalogFor(faction));
      engine.enqueue({ tick: 0, type: 'startAssault' });
      while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 8000) {
        engine.step();
      }
      // An undefended base falls — proving spawn, pathing, and combat all
      // resolve on the faction's defense catalog.
      expect(engine.phase).toBe('defeat');
      expect(engine.stats.spawned).toBeGreaterThan(0);
    },
  );

  it('russia is overbuilt: pricier, slower builds and dearer wreck repairs', () => {
    const usa = townMetaFor('usa')['supplyDepot']!;
    const russia = townMetaFor('russia')['supplyDepot']!;
    expect(russia.name).toBe('Supply Railhead');
    expect(russia.levels[0]!.supplies).toBeGreaterThan(usa.levels[0]!.supplies);
    expect(russia.levels[0]!.seconds).toBeGreaterThan(usa.levels[0]!.seconds);
    // Generation and storage arrays stay shared — Overbuilt taxes builds, not yields.
    expect(townMetaFor('russia')['radar']!.generatesIntel).toEqual(
      townMetaFor('usa')['radar']!.generatesIntel,
    );
    expect(wreckRepairFractionFor('russia')).toBeGreaterThan(wreckRepairFractionFor('usa'));

    // A wrecked Russian depot costs more to restore than the same USA wreck.
    const cost = (faction: 'usa' | 'russia') => {
      const town = unlockAll(newTown(T0, faction));
      town.supplies = 9000;
      town.fuel = 2000;
      place(town, 'supplyDepot', idx(20, 5), T0);
      tick(town, T0 + 60_000);
      const depot = town.structures.find((s) => s.kind === 'supplyDepot')!;
      depot.wrecked = true;
      return repairCost(town, depot).supplies;
    };
    expect(cost('russia')).toBeGreaterThan(cost('usa'));
  });

  it('a russia save round-trips; its town holds more hp per role', () => {
    const town = newTown(T0, 'russia');
    expect(deserialize(serialize(town))?.faction).toBe('russia');
    const usaWall = defenseCatalogFor('usa').walls['wall']!;
    const ruWall = defenseCatalogFor('russia').walls['wall']!;
    expect(ruWall.hp).toBeGreaterThan(usaWall.hp);
    expect(defenseCatalogFor('russia').structures['cc']!.maxHp).toBeGreaterThan(
      defenseCatalogFor('usa').structures['cc']!.maxHp,
    );
  });
});
