import { rescaleLadder } from '../src/content/assaults';
import { describe, expect, it } from 'vitest';
import {
  ALL_UNLOCK_KEYS,
  BASELINE_UNLOCKS,
  CAMPAIGN,
  missionSiege,
  scaleWaves,
} from '../src/content/campaign';
import { M1_CATALOG } from '../src/content/catalog';
import { campaignFor, FACTION_IDS } from '../src/content/factions';
import { TOWN_META } from '../src/content/buildings';
import { deserialize, serialize } from '../src/meta/save';
import { onBoard } from '../src/sim/board';
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
    // An entry that names BOTH coordinates has chosen a cell rather than a
    // place on the entry line, and the only thing allowed to do that is a
    // declared tunnel mouth. That reading is what makes this survive the
    // board turning upright in v1.40 — before, "has a col" meant "is a
    // tunnel", which is now what every ordinary arrival has.
    //
    // Positions are authored in physical units (M34) and reach the board by
    // the one rule, so the bound that matters is where that rule puts them;
    // the tunnel match is between two authored things, in the same units.
    const cs = TOWN_GRID.cellSize;
    for (const mission of CAMPAIGN) {
      const tunnelSet = new Set((mission.tunnels ?? []).map((t) => `${t.col},${t.row}`));
      for (const wave of mission.waves) {
        for (const e of wave.entries) {
          expect(e.col ?? e.row, `${mission.id} entry names no position`).toBeDefined();
          if (e.col !== undefined) {
            expect(e.col).toBeGreaterThanOrEqual(0);
            expect(onBoard(e.col, cs), `${mission.id} col ${e.col}`).toBeLessThan(TOWN_GRID.width);
          }
          if (e.row !== undefined) {
            expect(e.row).toBeGreaterThanOrEqual(0);
            expect(onBoard(e.row, cs), `${mission.id} row ${e.row}`).toBeLessThan(TOWN_GRID.height);
          }
          expect(M1_CATALOG.attackers[e.kind], `unknown attacker ${e.kind}`).toBeDefined();
          if (e.col !== undefined && e.row !== undefined) {
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
    const isTunnel = (e: { col?: number; row?: number }): boolean =>
      e.col !== undefined && e.row !== undefined;
    const hardTunnelEntries = hard.waves.flatMap((w) => w.entries).filter(isTunnel);
    const stdTunnelEntries = standard.waves.flatMap((w) => w.entries).filter(isTunnel);
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

  it('the mission that teaches spending CP has field guns to spend it on, in every campaign (v1.62.1)', () => {
    const usable = (town: ReturnType<typeof newTown>, index: number): string[] => {
      const limits = missionConfig(town, campaignFor(town.faction)[index]!, 1).buildLimits!.structures!;
      return ['depmg', 'foxhole', 'claymore', 'hesco'].filter((k) => limits[k] !== 0);
    };
    for (const faction of FACTION_IDS) {
      const town = newTown(T0, faction);
      const missions = campaignFor(faction);
      expect(usable(town, 0), faction).toEqual([]);
      applyMissionResult(town, missions[0]!, outcomeOf(true), T0);
      expect(usable(town, 1), faction).toEqual(['depmg', 'foxhole']);
      applyMissionResult(town, missions[1]!, outcomeOf(true), T0);
      expect(usable(town, 2), faction).toEqual(['depmg', 'foxhole', 'claymore', 'hesco']);
    }
  });

  it('a war cleared past a mission under the old order gets what that mission gives now, on load', () => {
    const town = newTown(T0, 'russia');
    town.campaign.completed = [campaignFor('russia')[0]!.id];
    town.campaign.next = 1;
    town.unlocked = town.unlocked.filter((k) => k !== 'depmg' && k !== 'foxhole');
    town.unlocked.push('storageBunker');
    const back = deserialize(serialize(town))!;
    expect(back.unlocked).toEqual(expect.arrayContaining(['storageBunker', 'depmg', 'foxhole']));
    expect(back.unlocked).not.toContain('claymore');
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
    // Declared at (6,18) and (13,18) in physical units; on a board of 2-unit
    // cells those mouths are (3,9) and (6,9).
    expect(infiltration.tunnels).toEqual([
      { col: 6, row: 18 },
      { col: 13, row: 18 },
    ]);
    expect(TOWN_GRID.cellSize).toBe(2);
    expect(config.reservedCells).toEqual([idx(3, 9), idx(6, 9)]);
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
    expect(town.version).toBe(6); // migrated all the way forward
    expect(town.faction).toBe('usa'); // pre-faction saves fought the USA war
    expect(town.intel).toBe(0);
    expect(town.research).toEqual({ completed: [], active: null });
    // v1.42 lengthened the assault ladder, so the level is RESCALED rather
    // than carried: this save had reached an 81-unit assault at level 4, and
    // the level that fields that same attack now is 9. Carrying the 4 would
    // have handed a returning player an attack a third the size.
    expect(town.assaultLevel).toBe(rescaleLadder(4));
    expect(town.assaultLevel).toBe(9);
    expect(town.ladderVersion).toBe(1);
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
