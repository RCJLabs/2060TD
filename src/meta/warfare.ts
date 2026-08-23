import { generateBase, lootFor, MAP_H, MAP_W, type GeneratedBase } from '../content/bases';
import { RAID_CATALOG } from '../content/catalog';
import { baseKitFor, defenseCatalogFor } from '../content/factions';
import { TRAINABLE, type TrainMeta } from '../content/usaUnits';
import { Engine } from '../sim/engine';
import type {
  AttackerMods,
  AutoPowerRule,
  Catalog,
  CellIndex,
  Doctrine,
  SimConfig,
  WaveDef,
  WaveEntry,
} from '../sim/types';
import { probeConfig, researchEffects, type DefenseLogEntry, type TownState } from './town';

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
  /** Tunnel insertion (NK): surface at this cell instead of entering at the
   * sector edge. Costs fuel, arrives late (dig time), bypasses the maze. */
  tunnel?: CellIndex;
}

export const SQUAD_DELAY_TICKS = 120; // squads launch 6s apart, in order

// ---- tunnel insertion (v0.6, NK doctrine) ----------------------------------------

export const TUNNEL_DIG_TICKS = 160; // 8s: the ground opens after the walkers commit
export const TUNNEL_FUEL_COST = 40; // per squad: galleries are shored and sealed per raid
export const TUNNEL_MIN_CC_DIST = 4; // cells from the command post center: off its
// doorstep, but inside every template's wall ring (compound margin 6-7, star 7-8)

/** Deterministic surfacing ring: mouth first, neighbors, then the radius-2
 * shoulder — a squad comes up as a platoon, not a file of targets. */
const TUNNEL_OFFSETS: [number, number][] = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1],
  [2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, -1], [1, 2], [-1, -2],
];

export function tunnelCount(squads: SquadPlan[]): number {
  return squads.filter((s) => s.tunnel !== undefined).length;
}

export function tunnelFuelCost(squads: SquadPlan[]): number {
  return tunnelCount(squads) * TUNNEL_FUEL_COST;
}

/**
 * Where a gallery may head: inside the map margin, off the wall line, and no
 * closer than TUNNEL_MIN_CC_DIST to the command post's center — sappers do
 * not dig into the one building the whole garrison watches.
 */
export function tunnelSiteValid(base: GeneratedBase, cell: CellIndex): boolean {
  const col = cell % MAP_W;
  const row = Math.floor(cell / MAP_W);
  if (col < 2 || col > MAP_W - 3 || row < 2 || row > MAP_H - 3) return false;
  if (base.walls.some((w) => w.cell === cell)) return false;
  const ccCol = (base.ccOrigin % MAP_W) + 0.5;
  const ccRow = Math.floor(base.ccOrigin / MAP_W) + 0.5;
  const dc = col - ccCol;
  const dr = row - ccRow;
  return dc * dc + dr * dr >= TUNNEL_MIN_CC_DIST * TUNNEL_MIN_CC_DIST;
}

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

/** One wave: every squad's units, spread across their sectors, staggered.
 * Tunneled squads surface around their mouth instead, after the dig delay —
 * the whole squad comes up inside the wire as one push. */
export function raidWave(squads: SquadPlan[], trainable: TrainMeta[] = TRAINABLE): WaveDef {
  const entries: WaveEntry[] = [];
  squads.forEach((squad, squadIndex) => {
    const tunneled = squad.tunnel !== undefined;
    const cells = sectorCells(squad.sector);
    const mouthCol = tunneled ? squad.tunnel! % MAP_W : 0;
    const mouthRow = tunneled ? Math.floor(squad.tunnel! / MAP_W) : 0;
    const baseTick = squadIndex * SQUAD_DELAY_TICKS + (tunneled ? TUNNEL_DIG_TICKS : 0);
    let unitIndex = 0;
    // Deterministic composition order: the faction's trainable order, then count.
    for (const meta of trainable) {
      const count = squad.units[meta.kind] ?? 0;
      for (let i = 0; i < count; i++) {
        let spot: { col: number; row: number };
        if (tunneled) {
          const [dc, dr] = TUNNEL_OFFSETS[unitIndex % TUNNEL_OFFSETS.length]!;
          spot = {
            col: Math.min(MAP_W - 2, Math.max(1, mouthCol + dc)),
            row: Math.min(MAP_H - 2, Math.max(1, mouthRow + dr)),
          };
        } else {
          spot = cells[(unitIndex * 3) % cells.length]!;
        }
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

export interface RaidSupport {
  /** Research multipliers for the raiding units. */
  mods?: AttackerMods;
  /** Pre-planned fire missions, evaluated in-sim. */
  autoPowers?: AutoPowerRule[];
  /** Ordnance stock committed to this raid (usually the town's charges). */
  powerCharges?: Record<string, number>;
}

export function raidConfig(
  base: GeneratedBase,
  squads: SquadPlan[],
  seed: number,
  trainable: TrainMeta[] = TRAINABLE,
  support: RaidSupport = {},
): SimConfig {
  const mods = support.mods;
  const hasMods = mods && ((mods.hp ?? 1) !== 1 || (mods.damage ?? 1) !== 1);
  // One reserved cell per tunneled squad, in squad order: the renderer draws
  // the mouths, replays re-dig them, and applyRaidResult bills them.
  const mouths = squads.filter((s) => s.tunnel !== undefined).map((s) => s.tunnel!);
  return {
    width: MAP_W,
    height: MAP_H,
    seed,
    ccOrigin: base.ccOrigin,
    ccLevel: base.ccLevel,
    spawnColumn: 0,
    playerSide: 'attacker',
    siege: {
      name: `RAID — ${base.name}`,
      startingSupplies: 0,
      suppliesPerWave: 0,
      startingCp: 0,
      cpCap: 1,
      cpPerSecond: 0,
      prepSeconds: 1,
      repairCostPerHp: 1,
      waves: [raidWave(squads, trainable)],
    },
    layout: {
      walls: base.walls.map((w) => ({ ...w })),
      structures: base.structures.map((s) => ({ ...s })),
    },
    powerCharges: { ...(support.powerCharges ?? {}) },
    ...(mouths.length > 0 ? { reservedCells: mouths } : {}),
    ...(hasMods ? { mods: { attacker: mods } } : {}),
    ...(support.autoPowers && support.autoPowers.length > 0
      ? { autoPowers: support.autoPowers.map((r) => ({ ...r })) }
      : {}),
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
  /** Ordnance charges actually expended by the fire plan. */
  powersUsed: Record<string, number>;
}

/** Run the raid headlessly to its end. Deterministic; the replay re-runs it. */
export function resolveRaid(
  config: SimConfig,
  squads: SquadPlan[],
  tier: number,
  catalog: Catalog = RAID_CATALOG,
): RaidResolution {
  const engine = new Engine(config, catalog);
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

  const powersUsed: Record<string, number> = {};
  for (const [kind, stocked] of Object.entries(config.powerCharges ?? {})) {
    const used = stocked - (engine.powerChargesLeft(kind) ?? stocked);
    if (used > 0) powersUsed[kind] = used;
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
    powersUsed,
  };
}

/** Fold a resolved raid into the town: losses, loot, Front Line progress. */
export function applyRaidResult(
  town: TownState,
  base: GeneratedBase,
  resolution: RaidResolution,
  config: SimConfig,
  now: number,
  /**
   * Challenge raids (v1.2) name the code they fought. A given code pays out
   * once: losses are real every time, but a friend's base is not a mine.
   */
  challenge?: { fingerprint: string },
): void {
  for (const [kind, lost] of Object.entries(resolution.losses)) {
    town.army[kind] = Math.max(0, (town.army[kind] ?? 0) - lost);
  }
  // Ordnance fired in support is gone from the shared stock.
  for (const [kind, used] of Object.entries(resolution.powersUsed)) {
    town.charges[kind] = Math.max(0, (town.charges[kind] ?? 0) - used);
  }
  // Tunnel galleries are dug fresh per raid: fuel per mouth in the config.
  const mouths = config.reservedCells?.length ?? 0;
  if (mouths > 0) town.fuel = Math.max(0, town.fuel - mouths * TUNNEL_FUEL_COST);
  const duels = (town.duels ??= []);
  const alreadyBeaten =
    challenge !== undefined && duels.includes(challenge.fingerprint);
  if (!alreadyBeaten) {
    town.supplies += resolution.loot.supplies;
    town.fuel += resolution.loot.fuel;
  }
  if (challenge !== undefined && resolution.cleared && !alreadyBeaten) {
    duels.push(challenge.fingerprint);
    if (duels.length > 50) duels.splice(0, duels.length - 50);
  }

  // Challenge raids (v1.2) are duels against a shared snapshot, not rungs:
  // losses and ordnance are real, the ladder does not move, and nothing
  // counterattacks — there is no server and nobody's town was touched.
  if (base.tier === 0) {
    town.lastRaid = {
      config,
      baseName: base.name,
      tier: 0,
      at: now,
      cleared: resolution.cleared,
    };
    town.lastSeen = now;
    return;
  }

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

/** Recon is a Signals product now (M6): priced in Intel, not Supplies. */
export const scoutCost = (tier: number): number => 30 + 15 * tier;
export const targetKey = (tier: number, variant: number): string => `t${tier}v${variant}`;

/** The tier's scout price after research discounts. */
export function scoutPrice(town: TownState, tier: number): number {
  return Math.ceil(scoutCost(tier) * researchEffects(town).scoutCost);
}

export function isScouted(town: TownState, tier: number, variant: number): boolean {
  return town.frontline.scouted.includes(targetKey(tier, variant));
}

export function scoutTarget(town: TownState, tier: number, variant: number): boolean {
  if (isScouted(town, tier, variant)) return true;
  const cost = scoutPrice(town, tier);
  if (town.intel < cost) return false;
  town.intel -= cost;
  town.frontline.scouted.push(targetKey(tier, variant));
  return true;
}

export function targetFor(town: TownState, variant: number): GeneratedBase {
  return generateBase(town.frontline.tier, variant, baseKitFor(town.faction));
}

// ---- offline probe raids -----------------------------------------------------------------

export const PROBE_INTERVAL_MS = 3 * 3_600_000;
export const PROBE_SHIELD_MS = 12 * 3_600_000;
export const PROBE_MAX = 3;
export const DEFENSE_LOG_CAP = 4;
/** Supplies billed per standing-order action the garrison executes. */
export const ORDERS_UPKEEP_SUPPLIES = 15;

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
    const engine = new Engine(config, defenseCatalogFor(town.faction));
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

    // Standing orders spend real stock: ordnance the garrison fired offline
    // is gone from the shared charges, exactly like raid fire support —
    // and every executed order bills its supplies upkeep.
    for (const [kind, stocked] of Object.entries(config.powerCharges ?? {})) {
      const used = stocked - (engine.powerChargesLeft(kind) ?? stocked);
      if (used > 0) town.charges[kind] = Math.max(0, (town.charges[kind] ?? 0) - used);
    }
    const ordersCost = engine.ordersExecuted * ORDERS_UPKEEP_SUPPLIES;
    if (ordersCost > 0) town.supplies = Math.max(0, town.supplies - ordersCost);

    const entry: DefenseLogEntry = {
      at: town.lastSeen + (i + 1) * PROBE_INTERVAL_MS,
      level,
      held,
      suppliesLost,
      fuelLost,
      ...(engine.stats.ccKillerKind ? { killer: engine.stats.ccKillerKind } : {}),
      ...(config.standingOrders ? { orders: config.standingOrders.id } : {}),
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
