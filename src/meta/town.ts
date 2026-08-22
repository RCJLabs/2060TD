import { buildAssault, assaultLoot } from '../content/assaults';
import {
  BASE_CAPS,
  CC_GATING,
  CHARGE_CAP,
  CHARGE_PRICES,
  DEFEAT_LOSS_FRACTION,
  OFFLINE_CAP_HOURS,
  STARTING_FUEL,
  STARTING_SUPPLIES,
  TOWN_META,
  WRECK_REPAIR_FRACTION,
  type CcGating,
} from '../content/buildings';
import {
  ALL_UNLOCK_KEYS,
  BASELINE_UNLOCKS,
  bonusMet,
  missionSiege,
  type Difficulty,
  type MissionDef,
} from '../content/campaign';
import { M1_CATALOG } from '../content/catalog';
import type { Engine } from '../sim/engine';
import type { CellIndex, SimConfig, SimStats } from '../sim/types';

/**
 * The persistent town (M2): the base that exists between battles, generates
 * resources in real time, and IS the battlefield when sieges come.
 *
 * All functions take explicit timestamps (epoch ms) — no Date.now() in here —
 * so the whole layer is deterministic and testable.
 */

export const TOWN_GRID = {
  width: 32,
  height: 24,
  ccOrigin: 11 * 32 + 27, // (27, 11)
  spawnColumn: 0,
} as const;

export interface PlacedStructure {
  id: number;
  kind: string;
  cell: CellIndex; // footprint origin
  level: number;
  wrecked: boolean;
  /** Epoch ms when the current build/upgrade finishes. Absent = complete. */
  buildEndsAt?: number;
  /** Level being upgraded to while buildEndsAt runs. Absent on initial build. */
  upgradingTo?: number;
}

export interface CampaignState {
  /** Index of the next mission to fight (== CAMPAIGN.length when complete). */
  next: number;
  completed: string[];
  /** null until the first-run briefing picks one. */
  difficulty: Difficulty | null;
  /** Mission ids whose bonus objectives were achieved. */
  bonuses: string[];
}

export interface TownState {
  version: 2;
  supplies: number;
  fuel: number;
  structures: PlacedStructure[]; // includes the Command Center (kind 'cc')
  walls: { cell: CellIndex; kind: string }[];
  charges: Record<string, number>;
  campaign: CampaignState;
  /** Content keys the campaign has granted (see content/campaign.ts). */
  unlocked: string[];
  assaultLevel: number;
  victories: number;
  defeats: number;
  lastSeen: number;
  nextId: number;
}

export function newTown(now: number): TownState {
  return {
    version: 2,
    supplies: STARTING_SUPPLIES,
    fuel: STARTING_FUEL,
    structures: [
      { id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: 1, wrecked: false },
    ],
    walls: [],
    charges: { a10: 0, arty: 0 },
    campaign: { next: 0, completed: [], difficulty: null, bonuses: [] },
    unlocked: [...BASELINE_UNLOCKS],
    assaultLevel: 1,
    victories: 0,
    defeats: 0,
    lastSeen: now,
    nextId: 2,
  };
}

export function isUnlocked(town: TownState, key: string): boolean {
  return town.unlocked.includes(key);
}

/** Everything granted (dev sandboxes, migrated v1 saves, tests). */
export function unlockAll(town: TownState): TownState {
  town.unlocked = [...new Set([...BASELINE_UNLOCKS, ...ALL_UNLOCK_KEYS])];
  return town;
}

// ---- lookups -------------------------------------------------------------------

export const townCc = (town: TownState): PlacedStructure =>
  town.structures.find((s) => s.kind === 'cc')!;

export const ccLevel = (town: TownState): number => townCc(town).level;

export const gating = (town: TownState): CcGating =>
  CC_GATING[Math.min(ccLevel(town), CC_GATING.length) - 1]!;

/** Complete, not wrecked — the structure actually does its job. */
const functional = (s: PlacedStructure): boolean => !s.wrecked && s.buildEndsAt === undefined;

/** A structure upgrading keeps working at its current level. */
const working = (s: PlacedStructure): boolean =>
  !s.wrecked && (s.buildEndsAt === undefined || s.upgradingTo !== undefined);

export function footprintCells(kind: string, origin: CellIndex): CellIndex[] {
  const footprint = M1_CATALOG.structures[kind]?.footprint ?? 1;
  if (footprint === 1) return [origin];
  const w = TOWN_GRID.width;
  return [origin, origin + 1, origin + w, origin + w + 1];
}

export function structureAt(town: TownState, cell: CellIndex): PlacedStructure | undefined {
  return town.structures.find((s) => footprintCells(s.kind, s.cell).includes(cell));
}

export function wallAt(town: TownState, cell: CellIndex): boolean {
  return town.walls.some((w) => w.cell === cell);
}

export function countOf(town: TownState, kind: string): number {
  return town.structures.filter((s) => s.kind === kind).length;
}

// ---- economy -------------------------------------------------------------------------

export function caps(town: TownState): { supplies: number; fuel: number } {
  const base = BASE_CAPS[Math.min(ccLevel(town), BASE_CAPS.length) - 1]!;
  let supplies = base.supplies;
  let fuel = base.fuel;
  for (const s of town.structures) {
    const storage = TOWN_META[s.kind]?.storage;
    if (storage && working(s)) {
      const tier = storage[Math.min(s.level, storage.length) - 1]!;
      supplies += tier.supplies;
      fuel += tier.fuel;
    }
  }
  return { supplies, fuel };
}

export function ratesPerMinute(town: TownState): { supplies: number; fuel: number } {
  let supplies = 0;
  let fuel = 0;
  for (const s of town.structures) {
    if (!working(s)) continue;
    const meta = TOWN_META[s.kind];
    if (meta?.generatesSupplies) {
      supplies += meta.generatesSupplies[Math.min(s.level, meta.generatesSupplies.length) - 1]!;
    }
    if (meta?.generatesFuel) {
      fuel += meta.generatesFuel[Math.min(s.level, meta.generatesFuel.length) - 1]!;
    }
  }
  return { supplies, fuel };
}

export function buildSpeedFactor(town: TownState): number {
  let best = 0;
  for (const s of town.structures) {
    const speed = TOWN_META[s.kind]?.buildSpeed;
    if (speed && functional(s)) {
      best = Math.max(best, speed[Math.min(s.level, speed.length) - 1]!);
    }
  }
  return 1 - best;
}

/** Sum of build + upgrade costs paid to reach `level`. */
export function cumulativeCost(kind: string, level: number): { supplies: number; fuel: number } {
  const meta = TOWN_META[kind];
  let supplies = 0;
  let fuel = 0;
  if (!meta) return { supplies, fuel };
  for (let i = 0; i < Math.min(level, meta.levels.length); i++) {
    supplies += meta.levels[i]!.supplies;
    fuel += meta.levels[i]!.fuel;
  }
  return { supplies, fuel };
}

/**
 * Advance real time: accrue generation since lastSeen (offline capped), then
 * complete any finished builds/upgrades. Call every frame and on load.
 */
export function tick(town: TownState, now: number): void {
  const elapsed = Math.min(
    Math.max(0, now - town.lastSeen),
    OFFLINE_CAP_HOURS * 3_600_000,
  );
  if (elapsed > 0) {
    const rate = ratesPerMinute(town);
    const cap = caps(town);
    const minutes = elapsed / 60_000;
    town.supplies = Math.min(cap.supplies, town.supplies + rate.supplies * minutes);
    town.fuel = Math.min(cap.fuel, town.fuel + rate.fuel * minutes);
  }
  town.lastSeen = now;

  for (const s of town.structures) {
    if (s.buildEndsAt !== undefined && s.buildEndsAt <= now) {
      if (s.upgradingTo !== undefined) s.level = s.upgradingTo;
      delete s.buildEndsAt;
      delete s.upgradingTo;
    }
  }
}

// ---- construction -----------------------------------------------------------------------

export type PlaceError =
  | 'unknown'
  | 'locked'
  | 'occupied'
  | 'bounds'
  | 'spawnColumn'
  | 'count'
  | 'cost'
  | null;

function cellsFree(town: TownState, cells: CellIndex[], ignoreId?: number): PlaceError {
  const w = TOWN_GRID.width;
  for (const cell of cells) {
    if (cell < 0 || cell >= w * TOWN_GRID.height) return 'bounds';
    if (cell % w === TOWN_GRID.spawnColumn) return 'spawnColumn';
    if (wallAt(town, cell)) return 'occupied';
    const s = structureAt(town, cell);
    if (s && s.id !== ignoreId) return 'occupied';
  }
  // 2×2 footprints must not wrap the grid edge.
  const origin = cells[0]!;
  if (cells.length === 4 && origin % w >= w - 1) return 'bounds';
  return null;
}

export function canPlace(town: TownState, kind: string, cell: CellIndex): PlaceError {
  const meta = TOWN_META[kind];
  if (!meta || kind === 'cc') return 'unknown';
  if (!isUnlocked(town, kind)) return 'locked';
  const allowed = gating(town).counts[kind] ?? 0;
  if (countOf(town, kind) >= allowed) return 'count';
  const cost = meta.levels[0]!;
  if (town.supplies < cost.supplies || town.fuel < cost.fuel) return 'cost';
  return cellsFree(town, footprintCells(kind, cell));
}

export function place(town: TownState, kind: string, cell: CellIndex, now: number): boolean {
  if (canPlace(town, kind, cell) !== null) return false;
  const cost = TOWN_META[kind]!.levels[0]!;
  town.supplies -= cost.supplies;
  town.fuel -= cost.fuel;
  const structure: PlacedStructure = {
    id: town.nextId++,
    kind,
    cell,
    level: 1,
    wrecked: false,
  };
  const seconds = cost.seconds * buildSpeedFactor(town);
  if (seconds > 0) structure.buildEndsAt = now + seconds * 1000;
  town.structures.push(structure);
  return true;
}

export function canPlaceWall(town: TownState, cell: CellIndex): PlaceError {
  const def = M1_CATALOG.walls['wall']!;
  if (town.walls.length >= gating(town).walls) return 'count';
  if (town.supplies < (def.supplyCost ?? 0)) return 'cost';
  return cellsFree(town, [cell]);
}

export function placeWall(town: TownState, cell: CellIndex): boolean {
  if (canPlaceWall(town, cell) !== null) return false;
  town.supplies -= M1_CATALOG.walls['wall']!.supplyCost ?? 0;
  town.walls.push({ cell, kind: 'wall' });
  return true;
}

export function removeWall(town: TownState, cell: CellIndex): boolean {
  const index = town.walls.findIndex((w) => w.cell === cell);
  if (index === -1) return false;
  town.walls.splice(index, 1);
  town.supplies += M1_CATALOG.walls['wall']!.supplyCost ?? 0;
  return true;
}

export function upgradeError(town: TownState, s: PlacedStructure): PlaceError | 'busy' | 'max' {
  const meta = TOWN_META[s.kind];
  if (!meta) return 'unknown';
  if (s.wrecked || s.buildEndsAt !== undefined) return 'busy';
  const maxLevel = Math.min(gating(town).maxStructureLevel, meta.levels.length);
  if (s.kind === 'cc' ? s.level >= meta.levels.length : s.level >= maxLevel) return 'max';
  // CC expansion is a campaign requisition, not just a purchase.
  if (s.kind === 'cc' && !isUnlocked(town, `cc${s.level + 1}`)) return 'locked';
  const cost = meta.levels[s.level]!;
  if (town.supplies < cost.supplies || town.fuel < cost.fuel) return 'cost';
  return null;
}

export function upgrade(town: TownState, id: number, now: number): boolean {
  const s = town.structures.find((x) => x.id === id);
  if (!s || upgradeError(town, s) !== null) return false;
  const cost = TOWN_META[s.kind]!.levels[s.level]!;
  town.supplies -= cost.supplies;
  town.fuel -= cost.fuel;
  s.upgradingTo = s.level + 1;
  s.buildEndsAt = now + cost.seconds * buildSpeedFactor(town) * 1000;
  return true;
}

export function move(town: TownState, id: number, newCell: CellIndex): boolean {
  const s = town.structures.find((x) => x.id === id);
  if (!s || s.kind === 'cc') return false;
  if (cellsFree(town, footprintCells(s.kind, newCell), id) !== null) return false;
  s.cell = newCell;
  return true;
}

export function sell(town: TownState, id: number): boolean {
  const index = town.structures.findIndex((x) => x.id === id);
  if (index === -1) return false;
  const s = town.structures[index]!;
  if (s.kind === 'cc') return false;
  const spent = cumulativeCost(s.kind, s.upgradingTo ?? s.level);
  if (!s.wrecked) {
    town.supplies += Math.floor(spent.supplies * 0.5);
    town.fuel += Math.floor(spent.fuel * 0.5);
  }
  town.structures.splice(index, 1);
  return true;
}

export function repairCost(s: PlacedStructure): { supplies: number; fuel: number } {
  const spent = cumulativeCost(s.kind, s.level);
  return {
    supplies: Math.ceil(spent.supplies * WRECK_REPAIR_FRACTION),
    fuel: Math.ceil(spent.fuel * WRECK_REPAIR_FRACTION),
  };
}

export function repairWreck(town: TownState, id: number): boolean {
  const s = town.structures.find((x) => x.id === id);
  if (!s || !s.wrecked) return false;
  const cost = repairCost(s);
  if (town.supplies < cost.supplies || town.fuel < cost.fuel) return false;
  town.supplies -= cost.supplies;
  town.fuel -= cost.fuel;
  s.wrecked = false;
  return true;
}

export function buyCharge(town: TownState, power: string): boolean {
  const price = CHARGE_PRICES[power];
  if (price === undefined || !isUnlocked(town, power)) return false;
  if ((town.charges[power] ?? 0) >= CHARGE_CAP) return false;
  if (town.fuel < price) return false;
  town.fuel -= price;
  town.charges[power] = (town.charges[power] ?? 0) + 1;
  return true;
}

// ---- the siege bridge ----------------------------------------------------------------------

/** The town's physical layout, as battle-injectable data. */
function townLayout(town: TownState): NonNullable<SimConfig['layout']> {
  return {
    walls: town.walls.map((w) => ({ cell: w.cell, kind: w.kind })),
    structures: town.structures
      .filter((s) => s.kind !== 'cc')
      .map((s) => {
        const underConstruction = s.buildEndsAt !== undefined && s.upgradingTo === undefined;
        return {
          cell: s.cell,
          kind: s.kind,
          level: s.level,
          hpFraction: s.wrecked ? 0.25 : underConstruction ? 0.35 : 1,
          inert: s.wrecked || underConstruction,
        };
      }),
  };
}

/** CC gating counts, with campaign locks zeroing out unrequisitioned kinds. */
function buildLimitsFor(town: TownState): NonNullable<SimConfig['buildLimits']> {
  const g = gating(town);
  const structures: Record<string, number> = { ...g.counts };
  for (const kind of Object.keys(structures)) {
    if (!BASELINE_UNLOCKS.includes(kind) && !isUnlocked(town, kind)) structures[kind] = 0;
  }
  // Field kinds have no CC count; when locked they get an explicit zero.
  for (const kind of ['depmg', 'foxhole', 'claymore', 'hesco']) {
    if (!isUnlocked(town, kind)) structures[kind] = 0;
  }
  return { structures, walls: g.walls };
}

function battleConfig(
  town: TownState,
  seed: number,
  siege: SiegeDefWithSupplies,
  reservedCells?: CellIndex[],
): SimConfig {
  return {
    width: TOWN_GRID.width,
    height: TOWN_GRID.height,
    seed,
    ccOrigin: TOWN_GRID.ccOrigin,
    ccLevel: ccLevel(town),
    spawnColumn: TOWN_GRID.spawnColumn,
    siege,
    layout: townLayout(town),
    powerCharges: { ...town.charges },
    buildLimits: buildLimitsFor(town),
    ...(reservedCells && reservedCells.length > 0 ? { reservedCells } : {}),
  };
}

type SiegeDefWithSupplies = ReturnType<typeof buildAssault>;

/** Battle config for the next SKIRMISH ladder assault. */
export function siegeConfig(town: TownState, seed: number): SimConfig {
  const def = buildAssault(town.assaultLevel);
  return battleConfig(town, seed, { ...def, startingSupplies: Math.floor(town.supplies) });
}

/** Battle config for a campaign mission at the town's difficulty. */
export function missionConfig(town: TownState, mission: MissionDef, seed: number): SimConfig {
  const def = missionSiege(mission, town.campaign.difficulty ?? 'standard');
  const reserved = (mission.tunnels ?? []).map((tn) => tn.row * TOWN_GRID.width + tn.col);
  return battleConfig(
    town,
    seed,
    { ...def, startingSupplies: Math.floor(town.supplies) },
    reserved,
  );
}

export interface SiegeOutcome {
  victory: boolean;
  supplies: number;
  chargesLeft: Record<string, number>;
  walls: { cell: CellIndex; kind: string }[];
  survivors: { cell: CellIndex; kind: string; level: number }[];
  stats: SimStats;
  /** Command Center integrity at battle end, 0..1 (bonus objectives). */
  ccHpFraction: number;
}

/** Reads the battle's end state into a town-consumable outcome. */
export function outcomeFromEngine(engine: Engine): SiegeOutcome {
  const walls: { cell: CellIndex; kind: string }[] = [];
  for (const [cell, wall] of engine.grid.walls) {
    if (engine.catalog.walls[wall.kind]?.supplyCost !== undefined) {
      walls.push({ cell, kind: wall.kind });
    }
  }
  const survivors = engine.structures
    .filter(
      (s) =>
        s.profile.kind !== 'cc' &&
        s.hp > 0 &&
        s.profile.cpCost === undefined, // field defenses expire with the battle
    )
    .map((s) => ({ cell: s.origin, kind: s.profile.kind, level: s.level }));
  const chargesLeft: Record<string, number> = {};
  for (const kind of Object.keys(engine.catalog.powers)) {
    chargesLeft[kind] = engine.powerChargesLeft(kind) ?? 0;
  }
  return {
    victory: engine.phase === 'victory',
    supplies: Math.floor(engine.supplies),
    chargesLeft,
    walls,
    survivors,
    stats: { ...engine.stats },
    ccHpFraction: Math.max(0, engine.cc.hp / engine.cc.profile.maxHp),
  };
}

/** The shared core: fold the battle's physical + economic end-state into town. */
function foldBattle(town: TownState, outcome: SiegeOutcome, now: number): void {
  const survivorCells = new Set(outcome.survivors.map((s) => s.cell));

  // Walls: the battle's remaining Supplies-walls ARE the town walls now
  // (losses stay lost; setup-built walls are adopted).
  town.walls = outcome.walls.map((w) => ({ ...w }));

  // Existing structures that didn't survive are wrecked; the CC never is.
  const knownCells = new Set<number>();
  for (const s of town.structures) {
    knownCells.add(s.cell);
    if (s.kind === 'cc') continue;
    if (!survivorCells.has(s.cell)) {
      s.wrecked = true;
      // A wreck cancels any in-flight construction; the invested cost is lost.
      delete s.buildEndsAt;
      delete s.upgradingTo;
    }
  }
  // Emplacements bought during the siege become town property.
  for (const survivor of outcome.survivors) {
    if (!knownCells.has(survivor.cell)) {
      town.structures.push({
        id: town.nextId++,
        kind: survivor.kind,
        cell: survivor.cell,
        level: survivor.level,
        wrecked: false,
      });
    }
  }

  town.supplies = outcome.supplies;
  town.charges = { ...outcome.chargesLeft };
  // Battle time was not idle time.
  town.lastSeen = now;
}

function applyDefeat(town: TownState): void {
  town.supplies = Math.floor(town.supplies * (1 - DEFEAT_LOSS_FRACTION));
  town.fuel = Math.floor(town.fuel * (1 - DEFEAT_LOSS_FRACTION));
  town.defeats++;
}

function clampToCaps(town: TownState): void {
  const cap = caps(town);
  town.supplies = Math.min(town.supplies, cap.supplies);
  town.fuel = Math.min(town.fuel, cap.fuel);
}

/** Fold a finished SKIRMISH (ladder assault) back into the persistent town. */
export function applySiegeResult(town: TownState, outcome: SiegeOutcome, now: number): void {
  foldBattle(town, outcome, now);
  if (outcome.victory) {
    const loot = assaultLoot(town.assaultLevel);
    town.supplies += loot.supplies;
    town.fuel += loot.fuel;
    town.assaultLevel++;
    town.victories++;
  } else {
    applyDefeat(town);
  }
  clampToCaps(town);
}

export interface MissionResult {
  victory: boolean;
  firstClear: boolean;
  bonusAchieved: boolean;
  rewardSupplies: number;
  rewardFuel: number;
  unlocked: string[];
}

/** Fold a finished CAMPAIGN mission back into the town and advance the war. */
export function applyMissionResult(
  town: TownState,
  mission: MissionDef,
  outcome: SiegeOutcome,
  now: number,
): MissionResult {
  foldBattle(town, outcome, now);

  if (!outcome.victory) {
    applyDefeat(town);
    clampToCaps(town);
    return {
      victory: false,
      firstClear: false,
      bonusAchieved: false,
      rewardSupplies: 0,
      rewardFuel: 0,
      unlocked: [],
    };
  }

  const firstClear = !town.campaign.completed.includes(mission.id);
  const bonusAchieved = mission.bonus !== undefined && bonusMet(mission.bonus.id, outcome);
  const multiplier = bonusAchieved ? 1.5 : 1;
  const rewardSupplies = Math.floor(mission.reward.supplies * multiplier);
  const rewardFuel = Math.floor(mission.reward.fuel * multiplier);
  town.supplies += rewardSupplies;
  town.fuel += rewardFuel;
  town.victories++;

  const granted: string[] = [];
  if (firstClear) {
    town.campaign.completed.push(mission.id);
    town.campaign.next = Math.max(town.campaign.next, mission.index + 1);
    for (const key of mission.unlocks) {
      if (!town.unlocked.includes(key)) {
        town.unlocked.push(key);
        granted.push(key);
      }
    }
  }
  if (bonusAchieved && !town.campaign.bonuses.includes(mission.id)) {
    town.campaign.bonuses.push(mission.id);
  }

  clampToCaps(town);
  return {
    victory: true,
    firstClear,
    bonusAchieved,
    rewardSupplies,
    rewardFuel,
    unlocked: granted,
  };
}
