import { generateBase, lootFor, MAP_H, MAP_W, type GeneratedBase } from '../content/bases';
import { M1_CATALOG, RAID_CATALOG } from '../content/catalog';
import { TRAINABLE } from '../content/usaUnits';
import { Engine } from '../sim/engine';
import type { CellIndex, Doctrine, SimConfig, WaveDef, WaveEntry } from '../sim/types';
import { probeConfig, type DefenseLogEntry, type TownState } from './town';

/**
 * The offense layer (M4): raid planning, hands-off resolution, loot, Front
 * Line progression, and the offline probe raids that keep your own base
 * honest while you're away. Everything here is deterministic given the
 * inputs — a raid config replays to the identical battle.
 */

// ---- entry sectors ---------------------------------------------------------------

export type SectorId = 'N1' | 'N2' | 'E1' | 'E2' | 'S1' | 'S2' | 'W1' | 'W2';
export const SECTOR_IDS: SectorId[] = ['N1', 'N2', 'E1', 'E2', 'S1', 'S2', 'W1', 'W2'];

const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** Ordered spawn cells per sector, spread along one half of an edge. */
export function sectorCells(id: SectorId): { col: number; row: number }[] {
  switch (id) {
    case 'N1':
      return range(4, 14).map((col) => ({ col, row: 0 }));
    case 'N2':
      return range(17, 27).map((col) => ({ col, row: 0 }));
    case 'S1':
      return range(4, 14).map((col) => ({ col, row: MAP_H - 1 }));
    case 'S2':
      return range(17, 27).map((col) => ({ col, row: MAP_H - 1 }));
    case 'W1':
      return range(2, 10).map((row) => ({ col: 0, row }));
    case 'W2':
      return range(13, 21).map((row) => ({ col: 0, row }));
    case 'E1':
      return range(2, 10).map((row) => ({ col: MAP_W - 1, row }));
    case 'E2':
      return range(13, 21).map((row) => ({ col: MAP_W - 1, row }));
  }
}

// ---- raid plans ------------------------------------------------------------------------

export interface SquadPlan {
  units: Record<string, number>;
  sector: SectorId;
  doctrine: Doctrine;
}

export const SQUAD_DELAY_TICKS = 120; // squads launch 6s apart, in order

export function planUnitCount(squads: SquadPlan[]): number {
  return squads.reduce(
    (total, squad) => total + Object.values(squad.units).reduce((a, b) => a + b, 0),
    0,
  );
}

export function planDeployment(squads: SquadPlan[]): Record<string, number> {
  const deployed: Record<string, number> = {};
  for (const squad of squads) {
    for (const [kind, count] of Object.entries(squad.units)) {
      if (count > 0) deployed[kind] = (deployed[kind] ?? 0) + count;
    }
  }
  return deployed;
}

/** One wave: every squad's units, spread across their sectors, staggered. */
export function raidWave(squads: SquadPlan[]): WaveDef {
  const entries: WaveEntry[] = [];
  squads.forEach((squad, squadIndex) => {
    const cells = sectorCells(squad.sector);
    const baseTick = squadIndex * SQUAD_DELAY_TICKS;
    let unitIndex = 0;
    // Deterministic composition order: TRAINABLE order, then count.
    for (const meta of TRAINABLE) {
      const count = squad.units[meta.kind] ?? 0;
      for (let i = 0; i < count; i++) {
        const spot = cells[(unitIndex * 3) % cells.length]!;
        entries.push({
          atTick: baseTick + unitIndex * 4,
          kind: meta.kind,
          row: spot.row,
          col: spot.col,
          doctrine: squad.doctrine,
        });
        unitIndex++;
      }
    }
  });
  return { entries };
}

export function raidConfig(base: GeneratedBase, squads: SquadPlan[], seed: number): SimConfig {
  return {
    width: MAP_W,
    height: MAP_H,
    seed,
    ccOrigin: base.ccOrigin,
    ccLevel: base.ccLevel,
    spawnColumn: 0,
    siege: {
      name: `RAID — ${base.name}`,
      startingSupplies: 0,
      suppliesPerWave: 0,
      startingCp: 0,
      cpCap: 1,
      cpPerSecond: 0,
      prepSeconds: 1,
      repairCostPerHp: 1,
      waves: [raidWave(squads)],
    },
    layout: {
      walls: base.walls.map((w) => ({ ...w })),
      structures: base.structures.map((s) => ({ ...s })),
    },
    powerCharges: {},
  };
}

// ---- resolution --------------------------------------------------------------------------

export const RAID_MAX_TICKS = 6000; // 5 minutes of sim time, hard stop

export interface RaidResolution {
  cleared: boolean;
  ticks: number;
  deployed: Record<string, number>;
  survivors: Record<string, number>;
  losses: Record<string, number>;
  destroyed: Record<string, number>;
  loot: { supplies: number; fuel: number };
  destructionPct: number;
}

/** Run the raid headlessly to its end. Deterministic; the replay re-runs it. */
export function resolveRaid(
  config: SimConfig,
  squads: SquadPlan[],
  tier: number,
): RaidResolution {
  const engine = new Engine(config, RAID_CATALOG);
  engine.enqueue({ tick: 0, type: 'startAssault' });

  const initial = new Map<string, number>();
  for (const s of engine.structures) {
    initial.set(s.profile.kind, (initial.get(s.profile.kind) ?? 0) + 1);
  }

  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < RAID_MAX_TICKS) {
    engine.step();
  }

  const survivors: Record<string, number> = {};
  for (const attacker of engine.attackers) {
    survivors[attacker.profile.kind] = (survivors[attacker.profile.kind] ?? 0) + 1;
  }
  const deployed = planDeployment(squads);
  const losses: Record<string, number> = {};
  for (const [kind, count] of Object.entries(deployed)) {
    const lost = count - (survivors[kind] ?? 0);
    if (lost > 0) losses[kind] = lost;
  }

  const remaining = new Map<string, number>();
  for (const s of engine.structures) {
    if (s.hp > 0) remaining.set(s.profile.kind, (remaining.get(s.profile.kind) ?? 0) + 1);
  }
  const destroyed: Record<string, number> = {};
  let destroyedTotal = 0;
  let initialTotal = 0;
  const loot = { supplies: 0, fuel: 0 };
  for (const [kind, count] of initial) {
    initialTotal += count;
    const gone = count - (remaining.get(kind) ?? 0);
    if (gone > 0) {
      destroyed[kind] = gone;
      destroyedTotal += gone;
      const per = lootFor(kind, tier);
      loot.supplies += per.supplies * gone;
      loot.fuel += per.fuel * gone;
    }
  }

  return {
    cleared: engine.phase === 'defeat', // the DEFENDER lost its command post
    ticks: engine.tick,
    deployed,
    survivors,
    losses,
    destroyed,
    loot,
    destructionPct: initialTotal > 0 ? destroyedTotal / initialTotal : 0,
  };
}

/** Fold a resolved raid into the town: losses, loot, Front Line progress. */
export function applyRaidResult(
  town: TownState,
  base: GeneratedBase,
  resolution: RaidResolution,
  config: SimConfig,
  now: number,
): void {
  for (const [kind, lost] of Object.entries(resolution.losses)) {
    town.army[kind] = Math.max(0, (town.army[kind] ?? 0) - lost);
  }
  town.supplies += resolution.loot.supplies;
  town.fuel += resolution.loot.fuel;

  const frontline = town.frontline;
  if (resolution.cleared) {
    frontline.wins++;
    frontline.totalWins++;
    town.victories++;
    if (frontline.wins >= 3) {
      frontline.tier++;
      frontline.wins = 0;
    }
    // Every second cleared post triggers a counterattack on your base.
    if (frontline.totalWins % 2 === 0) frontline.pendingCounterattack = true;
  }

  town.lastRaid = {
    config,
    baseName: base.name,
    tier: base.tier,
    at: now,
    cleared: resolution.cleared,
  };
  town.lastSeen = now;
}

// ---- scouting -----------------------------------------------------------------------------

export const scoutCost = (tier: number): number => 60 + 30 * tier;
export const targetKey = (tier: number, variant: number): string => `t${tier}v${variant}`;

export function isScouted(town: TownState, tier: number, variant: number): boolean {
  return town.frontline.scouted.includes(targetKey(tier, variant));
}

export function scoutTarget(town: TownState, tier: number, variant: number): boolean {
  if (isScouted(town, tier, variant)) return true;
  const cost = scoutCost(tier);
  if (town.supplies < cost) return false;
  town.supplies -= cost;
  town.frontline.scouted.push(targetKey(tier, variant));
  return true;
}

export function targetFor(town: TownState, variant: number): GeneratedBase {
  return generateBase(town.frontline.tier, variant);
}

// ---- offline probe raids -----------------------------------------------------------------

export const PROBE_INTERVAL_MS = 3 * 3_600_000;
export const PROBE_SHIELD_MS = 12 * 3_600_000;
export const PROBE_MAX = 3;
export const DEFENSE_LOG_CAP = 4;

export function probeLevel(town: TownState): number {
  return Math.max(1, Math.min(town.assaultLevel, town.frontline.tier + 1));
}

/**
 * Runs the offline probes owed for the absence since lastSeen. Call BEFORE
 * tick() on load. Structures are never wrecked by probes (crews rebuild
 * between skirmishes); walls lost stay lost and every probe is replayable.
 */
export function runOfflineProbes(town: TownState, now: number): DefenseLogEntry[] {
  const away = now - town.lastSeen;
  if (now < town.shieldUntil || away < PROBE_INTERVAL_MS) return [];
  const count = Math.min(PROBE_MAX, Math.floor(away / PROBE_INTERVAL_MS));
  const level = probeLevel(town);
  const ran: DefenseLogEntry[] = [];

  for (let i = 0; i < count; i++) {
    const seed = ((Math.floor(town.lastSeen / 60_000) + i * 7919) * 2654435761) >>> 0;
    const config = probeConfig(town, level, seed);
    const engine = new Engine(config, M1_CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 8000) {
      engine.step();
    }

    const held = engine.phase === 'victory';
    // Walls chewed during the probe stay chewed.
    const walls: { cell: CellIndex; kind: string }[] = [];
    for (const [cell, wall] of engine.grid.walls) {
      if (engine.catalog.walls[wall.kind]?.supplyCost !== undefined) {
        walls.push({ cell, kind: wall.kind });
      }
    }
    town.walls = walls;

    const lossFraction = held
      ? Math.min(0.03 * engine.stats.structuresLost, 0.1)
      : 0.15;
    const suppliesLost = Math.floor(town.supplies * lossFraction);
    const fuelLost = Math.floor(town.fuel * lossFraction);
    town.supplies -= suppliesLost;
    town.fuel -= fuelLost;

    const entry: DefenseLogEntry = {
      at: town.lastSeen + (i + 1) * PROBE_INTERVAL_MS,
      level,
      held,
      suppliesLost,
      fuelLost,
      config,
    };
    town.defenseLog.unshift(entry);
    ran.push(entry);

    if (!held) {
      town.shieldUntil = now + PROBE_SHIELD_MS;
      break;
    }
  }

  town.defenseLog.length = Math.min(town.defenseLog.length, DEFENSE_LOG_CAP);
  return ran;
}
