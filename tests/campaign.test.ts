import { describe, expect, it } from 'vitest';
import {
  ALL_UNLOCK_KEYS,
  BASELINE_UNLOCKS,
  CAMPAIGN,
  missionSiege,
  scaleWaves,
} from '../src/content/campaign';
import { M1_CATALOG } from '../src/content/catalog';
import { TOWN_META } from '../src/content/buildings';
import { deserialize, serialize } from '../src/meta/save';
import {
  applyMissionResult,
  canPlace,
  isUnlocked,
  missionConfig,
  newTown,
  townCc,
  upgradeError,
  TOWN_GRID,
  type SiegeOutcome,
} from '../src/meta/town';

const T0 = 1_700_000_000_000;
const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

const cleanStats = () => ({
  spawned: 0,
  kills: 0,
  wallsBuilt: 0,
  wallsLost: 0,
  structuresLost: 0,
  suppliesSpent: 0,
  cpSpent: 0,
  salvage: 0,
});

const outcomeOf = (victory: boolean, extra: Partial<SiegeOutcome> = {}): SiegeOutcome => ({
  victory,
  supplies: 500,
  chargesLeft: { a10: 0, arty: 0 },
  walls: [],
  survivors: [],
  stats: cleanStats(),
  ccHpFraction: 1,
  ...extra,
});

describe('campaign content', () => {
  it('has nine sequential missions with unique ids and non-empty writing', () => {
    expect(CAMPAIGN).toHaveLength(9);
    const ids = new Set(CAMPAIGN.map((m) => m.id));
    expect(ids.size).toBe(9);
    CAMPAIGN.forEach((mission, i) => {
      expect(mission.index).toBe(i);
      expect(mission.briefing.length).toBeGreaterThanOrEqual(4);
      expect(mission.debriefVictory.length).toBeGreaterThan(0);
      expect(mission.debriefDefeat.length).toBeGreaterThan(0);
      expect(mission.waves.length).toBeGreaterThan(0);
    });
  });

  it('grants every unlock key exactly once, and all keys are real content', () => {
    const granted = CAMPAIGN.flatMap((m) => m.unlocks);
    expect([...granted].sort()).toEqual([...ALL_UNLOCK_KEYS].sort());
    for (const key of granted) {
      const isSpecial = key === 'cc2' || key === 'cc3' || key === 'frontline';
      const inCatalog =
        key in M1_CATALOG.structures || key in M1_CATALOG.walls || key in M1_CATALOG.powers;
      expect(isSpecial || inCatalog, `unknown unlock key ${key}`).toBe(true);
    }
    for (const key of BASELINE_UNLOCKS) {
      // Baseline covers town buildings, walls, and the battle-layer pieces a
      // commander always has — the MANPADS tube among them, so rotors are
      // never unanswerable to someone actually at the board.
      const known =
        key in TOWN_META || key in M1_CATALOG.walls || key in M1_CATALOG.structures;
      expect(known, `baseline unlock ${key} is not real content`).toBe(true);
    }
  });

  it('keeps every spawn entry on the map, and tunnel entries match declared tunnels', () => {
    for (const mission of CAMPAIGN) {
      const tunnelSet = new Set((mission.tunnels ?? []).map((t) => `${t.col},${t.row}`));
      for (const wave of mission.waves) {
        for (const e of wave.entries) {
          expect(e.row).toBeGreaterThanOrEqual(0);
          expect(e.row).toBeLessThan(TOWN_GRID.height);
          expect(M1_CATALOG.attackers[e.kind], `unknown attacker ${e.kind}`).toBeDefined();
          if (e.col !== undefined) {
            expect(tunnelSet.has(`${e.col},${e.row}`), `${mission.id} stray tunnel`).toBe(true);
          }
        }
      }
    }
  });

  it('hard difficulty fields bigger waves and keeps tunnel columns', () => {
    const mission = CAMPAIGN[5]!; // INFILTRATION
    const standard = missionSiege(mission, 'standard');
    const hard = missionSiege(mission, 'hard');
    const count = (def: typeof standard) =>
      def.waves.reduce((n, w) => n + w.entries.length, 0);
    expect(count(hard)).toBeGreaterThan(count(standard));
    const hardTunnelEntries = hard.waves.flatMap((w) => w.entries).filter((e) => e.col !== undefined);
    const stdTunnelEntries = standard.waves.flatMap((w) => w.entries).filter((e) => e.col !== undefined);
    expect(hardTunnelEntries.length).toBeGreaterThanOrEqual(stdTunnelEntries.length);
    expect(scaleWaves(mission.waves, 1.3)).toEqual(scaleWaves(mission.waves, 1.3));
  });
});

describe('campaign progression', () => {
  it('a fresh town is locked down to the baseline kit', () => {
    const town = newTown(T0);
    expect(isUnlocked(town, 'supplyDepot')).toBe(true);
    expect(isUnlocked(town, 'autocannon')).toBe(false);
    expect(canPlace(town, 'autocannon', idx(10, 10))).toBe('locked');
    expect(canPlace(town, 'm2nest', idx(10, 10))).toBe(null);
    expect(upgradeError(town, townCc(town))).toBe('locked'); // cc2 not requisitioned
    town.supplies = 99_999;
    town.fuel = 99_999;
    expect(upgradeError(town, townCc(town))).toBe('locked');
  });

  it('mission victory pays rewards, grants unlocks, and advances the war', () => {
    const town = newTown(T0);
    const m1 = CAMPAIGN[0]!;
    const result = applyMissionResult(town, m1, outcomeOf(true, { ccHpFraction: 0.95 }), T0);
    expect(result.victory).toBe(true);
    expect(result.firstClear).toBe(true);
    expect(result.bonusAchieved).toBe(true); // ccAbove90
    expect(result.rewardSupplies).toBe(Math.floor(m1.reward.supplies * 1.5));
    expect(town.campaign.next).toBe(1);
    expect(town.campaign.completed).toContain('m1');
    expect(town.campaign.bonuses).toContain('m1');
    expect(isUnlocked(town, 'storageBunker')).toBe(true);
    expect(town.victories).toBe(1);
  });

  it('mission defeat costs stores and does not advance the campaign', () => {
    const town = newTown(T0);
    const result = applyMissionResult(town, CAMPAIGN[0]!, outcomeOf(false, { supplies: 400 }), T0);
    expect(result.victory).toBe(false);
    expect(town.supplies).toBe(340); // 400 × 0.85
    expect(town.campaign.next).toBe(0);
    expect(town.defeats).toBe(1);
    expect(isUnlocked(town, 'storageBunker')).toBe(false);
  });

  it('replaying a cleared mission never re-grants or re-advances', () => {
    const town = newTown(T0);
    applyMissionResult(town, CAMPAIGN[0]!, outcomeOf(true), T0);
    const unlockedCount = town.unlocked.length;
    const again = applyMissionResult(town, CAMPAIGN[0]!, outcomeOf(true), T0);
    expect(again.firstClear).toBe(false);
    expect(again.unlocked).toEqual([]);
    expect(town.unlocked).toHaveLength(unlockedCount);
    expect(town.campaign.next).toBe(1);
  });

  it('missionConfig zeroes locked kinds and reserves tunnel mouths', () => {
    const town = newTown(T0);
    const infiltration = CAMPAIGN[5]!;
    const config = missionConfig(town, infiltration, 7);
    expect(config.buildLimits!.structures!['autocannon']).toBe(0); // locked
    expect(config.buildLimits!.structures!['depmg']).toBe(0); // locked
    expect(config.buildLimits!.structures!['m2nest']).toBeGreaterThan(0); // baseline
    expect(config.reservedCells).toEqual([idx(18, 7), idx(18, 16)]);
    expect(config.siege!.name).toContain('INFILTRATION');
  });

  it('full campaign run-through grants everything and completes the war', () => {
    const town = newTown(T0);
    for (const mission of CAMPAIGN) {
      applyMissionResult(town, mission, outcomeOf(true), T0);
    }
    expect(town.campaign.next).toBe(CAMPAIGN.length);
    for (const key of ALL_UNLOCK_KEYS) {
      expect(isUnlocked(town, key), `missing ${key}`).toBe(true);
    }
    expect(upgradeError(town, townCc(town))).not.toBe('locked');
  });
});

describe('save migration', () => {
  it('lifts schema-1 saves to v2 with everything they had unlocked', () => {
    const legacy = {
      schema: 1,
      savedAt: T0,
      town: {
        version: 1,
        supplies: 500,
        fuel: 100,
        structures: [{ id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: 2, wrecked: false }],
        walls: [{ cell: 100, kind: 'wall' }],
        charges: { a10: 1, arty: 0 },
        assaultLevel: 4,
        victories: 3,
        defeats: 1,
        lastSeen: T0,
        nextId: 9,
      },
    };
    const town = deserialize(JSON.stringify(legacy))!;
    expect(town).not.toBeNull();
    expect(town.version).toBe(5); // migrated all the way forward
    expect(town.faction).toBe('usa'); // pre-faction saves fought the USA war
    expect(town.intel).toBe(0);
    expect(town.research).toEqual({ completed: [], active: null });
    expect(town.assaultLevel).toBe(4);
    expect(town.campaign.next).toBe(0);
    expect(town.campaign.difficulty).toBe('standard');
    expect(town.frontline.tier).toBe(1);
    expect(town.army).toEqual({});
    expect(town.defenseLog).toEqual([]);
    for (const key of ALL_UNLOCK_KEYS) expect(isUnlocked(town, key)).toBe(true);
    // And it round-trips at the current schema from here on.
    expect(deserialize(serialize(town))).toEqual(town);
  });
});
