import { buildAssault, assaultLoot, probeAssault } from '../content/assaults';
import {
  defenseCatalogFor,
  enemyRosterFor,
  townMetaFor,
  trainMetaFor,
  wreckRepairFractionFor,
  type FactionId,
} from '../content/factions';
import { manpowerCap } from '../content/usaUnits';
import {
  BASE_CAPS,
  CC_GATING,
  CHARGE_CAP,
  CHARGE_PRICES,
  DEFEAT_LOSS_FRACTION,
  OFFLINE_CAP_HOURS,
  STARTING_FUEL,
  STARTING_SUPPLIES,
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
import { effectsOf, techPrereq, TECH_BY_ID, type ResearchEffects } from '../content/research';
import { seasonAt, type LeagueId } from '../content/leagues';
import { standingOrdersFor, type StandingOrdersId } from '../content/standingOrders';
import type { Engine } from '../sim/engine';
import type { CellIndex, SimConfig, SimStats } from '../sim/types';
import { awardStanding, counterAward, settleLadder, type LadderSettlement } from './ladder';

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
  /** Unit kinds waiting to train here (barracks/motor pool), head first. */
  trainQueue?: string[];
  /** Epoch ms when the head of the queue finishes. */
  trainEndsAt?: number;
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

export interface FrontlineState {
  tier: number;
  /** Command-post kills at the current tier; three advance the tier. */
  wins: number;
  totalWins: number;
  /** A counterattack is inbound: raids pause until it's fought off. */
  pendingCounterattack: boolean;
  /** Scouted target keys, "t{tier}v{variant}". */
  scouted: string[];
  /** League standing (M7). Earned on the ladder, bled by absence. */
  standing: number;
  /** Best standing this season — the placement payout reads this, not the
   * final number, so a peak that decayed away still counts at season end. */
  peak: number;
  /** Season index (content/leagues.ts) the standing belongs to. */
  season: number;
  /** Decay has been charged through this instant (epoch ms). */
  settledAt: number;
  /** Last ladder action (epoch ms) — the decay grace runs from here. */
  activeAt: number;
  /** Finished seasons, newest first. */
  placements: SeasonRecord[];
}

/** A closed season: where you finished, and what it paid. */
export interface SeasonRecord {
  season: number;
  league: LeagueId;
  /** Peak standing that season. */
  peak: number;
  /** When the season closed (epoch ms). */
  at: number;
}

export interface DefenseLogEntry {
  at: number;
  level: number;
  held: boolean;
  suppliesLost: number;
  fuelLost: number;
  /** What landed the killing blow on the CC, when breached. */
  killer?: string;
  /** Standing orders that fought this probe (v0.8). */
  orders?: string;
  /** Full battle config — every offline probe is replayable. */
  config: SimConfig;
}

export interface ResearchState {
  /** Completed tech ids (content/research.ts). */
  completed: string[];
  /** The single in-flight project, if any. */
  active: { id: string; endsAt: number } | null;
}

export interface RaidRecord {
  config: SimConfig;
  baseName: string;
  tier: number;
  at: number;
  cleared: boolean;
}

export interface TownState {
  version: 6;
  /** Whose war this town fights (M5): decides catalogs, campaign, enemies. */
  faction: FactionId;
  supplies: number;
  fuel: number;
  /** Signals product (M6): pays for scouting and research. */
  intel: number;
  research: ResearchState;
  structures: PlacedStructure[]; // includes the Command Center (kind 'cc')
  walls: { cell: CellIndex; kind: string }[];
  charges: Record<string, number>;
  campaign: CampaignState;
  /** Content keys the campaign has granted (see content/campaign.ts). */
  unlocked: string[];
  /** Standing army by unit kind. */
  army: Record<string, number>;
  frontline: FrontlineState;
  defenseLog: DefenseLogEntry[];
  /** Standing orders in force for offline defenses (v0.8); null = none. */
  standingOrders: StandingOrdersId | null;
  /** No offline probes before this timestamp (post-breach grace). */
  shieldUntil: number;
  /** The last raid fought, kept for the replay viewer. */
  lastRaid: RaidRecord | null;
  /** Fingerprints of share codes already cleared: each pays loot once. */
  duels?: string[];
  /** One-shot coach screens already read (content/tutorial.ts keys). */
  seen?: string[];
  assaultLevel: number;
  victories: number;
  defeats: number;
  lastSeen: number;
  nextId: number;
}

export function newTown(now: number, faction: FactionId = 'usa'): TownState {
  return {
    version: 6,
    faction,
    supplies: STARTING_SUPPLIES,
    fuel: STARTING_FUEL,
    intel: 0,
    research: { completed: [], active: null },
    structures: [
      { id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: 1, wrecked: false },
    ],
    walls: [],
    charges: { a10: 0, arty: 0 },
    campaign: { next: 0, completed: [], difficulty: null, bonuses: [] },
    unlocked: [...BASELINE_UNLOCKS],
    army: {},
    frontline: {
      tier: 1,
      wins: 0,
      totalWins: 0,
      pendingCounterattack: false,
      scouted: [],
      standing: 0,
      peak: 0,
      season: seasonAt(now),
      settledAt: now,
      activeAt: now,
      placements: [],
    },
    defenseLog: [],
    standingOrders: null,
    shieldUntil: 0,
    lastRaid: null,
    duels: [],
    seen: [],
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

/** Aggregated research multipliers for this town. */
export function researchEffects(town: TownState): ResearchEffects {
  return effectsOf(town.research.completed);
}

export function caps(town: TownState): { supplies: number; fuel: number; intel: number } {
  const base = BASE_CAPS[Math.min(ccLevel(town), BASE_CAPS.length) - 1]!;
  let supplies = base.supplies;
  let fuel = base.fuel;
  let intel = base.intel;
  for (const s of town.structures) {
    const meta = townMetaFor(town.faction)[s.kind];
    if (!meta || !working(s)) continue;
    if (meta.storage) {
      const tier = meta.storage[Math.min(s.level, meta.storage.length) - 1]!;
      supplies += tier.supplies;
      fuel += tier.fuel;
    }
    if (meta.intelCap) {
      intel += meta.intelCap[Math.min(s.level, meta.intelCap.length) - 1]!;
    }
  }
  const storageMult = researchEffects(town).storage;
  return {
    supplies: Math.floor(supplies * storageMult),
    fuel: Math.floor(fuel * storageMult),
    intel,
  };
}

export function ratesPerMinute(town: TownState): {
  supplies: number;
  fuel: number;
  intel: number;
} {
  let supplies = 0;
  let fuel = 0;
  let intel = 0;
  for (const s of town.structures) {
    if (!working(s)) continue;
    const meta = townMetaFor(town.faction)[s.kind];
    if (meta?.generatesSupplies) {
      supplies += meta.generatesSupplies[Math.min(s.level, meta.generatesSupplies.length) - 1]!;
    }
    if (meta?.generatesFuel) {
      fuel += meta.generatesFuel[Math.min(s.level, meta.generatesFuel.length) - 1]!;
    }
    if (meta?.generatesIntel) {
      intel += meta.generatesIntel[Math.min(s.level, meta.generatesIntel.length) - 1]!;
    }
  }
  const ratesMult = researchEffects(town).rates;
  return {
    supplies: Math.round(supplies * ratesMult * 10) / 10,
    fuel: Math.round(fuel * ratesMult * 10) / 10,
    intel,
  };
}

export function buildSpeedFactor(town: TownState): number {
  let best = 0;
  for (const s of town.structures) {
    const speed = townMetaFor(town.faction)[s.kind]?.buildSpeed;
    if (speed && functional(s)) {
      best = Math.max(best, speed[Math.min(s.level, speed.length) - 1]!);
    }
  }
  return 1 - best;
}

/** Sum of build + upgrade costs paid to reach `level`. */
export function cumulativeCost(
  town: TownState,
  kind: string,
  level: number,
): { supplies: number; fuel: number } {
  const meta = townMetaFor(town.faction)[kind];
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
/**
 * Advance the town to `now`: accrue, finish timers, and settle the ladder.
 * Returns what the ladder settlement did so the caller can report a closed
 * season; ignoring the return value is fine everywhere else.
 */
export function tick(town: TownState, now: number): LadderSettlement {
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
    town.intel = Math.min(cap.intel, town.intel + rate.intel * minutes);
  }
  town.lastSeen = now;

  // Research completes on its own clock — the lab doesn't wait for you.
  const active = town.research.active;
  if (active && active.endsAt <= now) {
    if (!town.research.completed.includes(active.id)) {
      town.research.completed.push(active.id);
    }
    town.research.active = null;
  }

  for (const s of town.structures) {
    if (s.buildEndsAt !== undefined && s.buildEndsAt <= now) {
      if (s.upgradingTo !== undefined) s.level = s.upgradingTo;
      delete s.buildEndsAt;
      delete s.upgradingTo;
    }
    // Training lines keep rolling, including while offline (chained).
    while (
      s.trainQueue !== undefined &&
      s.trainQueue.length > 0 &&
      s.trainEndsAt !== undefined &&
      s.trainEndsAt <= now &&
      !s.wrecked
    ) {
      const kind = s.trainQueue.shift()!;
      town.army[kind] = (town.army[kind] ?? 0) + 1;
      const next = s.trainQueue[0];
      if (next !== undefined) {
        const seconds =
          (trainMetaFor(town.faction)[next]?.seconds ?? 30) * researchEffects(town).trainTime;
        s.trainEndsAt = s.trainEndsAt + seconds * 1000;
      } else {
        delete s.trainEndsAt;
      }
    }
  }

  // Last, so a season placement lands on top of the storage cap rather than
  // being clipped by the accrual above — the same way raid loot does.
  return settleLadder(town, now);
}

// ---- the army ---------------------------------------------------------------------

export function armyManpower(town: TownState): number {
  const meta = trainMetaFor(town.faction);
  let total = 0;
  for (const [kind, count] of Object.entries(town.army)) {
    total += (meta[kind]?.manpower ?? 0) * count;
  }
  return total;
}

export function queuedManpower(town: TownState): number {
  const meta = trainMetaFor(town.faction);
  let total = 0;
  for (const s of town.structures) {
    for (const kind of s.trainQueue ?? []) {
      total += meta[kind]?.manpower ?? 0;
    }
  }
  return total;
}

export function manpowerCapOf(town: TownState): number {
  let barracksLevels = 0;
  let motorpoolLevels = 0;
  let airfieldLevels = 0;
  for (const s of town.structures) {
    if (s.wrecked || (s.buildEndsAt !== undefined && s.upgradingTo === undefined)) continue;
    if (s.kind === 'barracks') barracksLevels += s.level;
    if (s.kind === 'motorpool') motorpoolLevels += s.level;
    if (s.kind === 'airfield') airfieldLevels += s.level;
  }
  return manpowerCap(barracksLevels, motorpoolLevels, airfieldLevels);
}

export function armySize(town: TownState): number {
  return Object.values(town.army).reduce((a, b) => a + b, 0);
}

export type TrainError = 'unknown' | 'facility' | 'busy' | 'queue' | 'cost' | 'manpower' | null;

export function canTrain(town: TownState, structureId: number, kind: string): TrainError {
  const meta = trainMetaFor(town.faction)[kind];
  if (!meta) return 'unknown';
  const s = town.structures.find((x) => x.id === structureId);
  if (!s || s.kind !== meta.facility) return 'facility';
  if (s.wrecked || (s.buildEndsAt !== undefined && s.upgradingTo === undefined)) return 'busy';
  if ((s.trainQueue?.length ?? 0) >= 5) return 'queue';
  if (town.supplies < meta.supplies || town.fuel < meta.fuel) return 'cost';
  if (armyManpower(town) + queuedManpower(town) + meta.manpower > manpowerCapOf(town)) {
    return 'manpower';
  }
  return null;
}

export function queueTrain(town: TownState, structureId: number, kind: string, now: number): boolean {
  if (canTrain(town, structureId, kind) !== null) return false;
  const meta = trainMetaFor(town.faction)[kind]!;
  const s = town.structures.find((x) => x.id === structureId)!;
  town.supplies -= meta.supplies;
  town.fuel -= meta.fuel;
  s.trainQueue = s.trainQueue ?? [];
  s.trainQueue.push(kind);
  if (s.trainQueue.length === 1) {
    s.trainEndsAt = now + meta.seconds * researchEffects(town).trainTime * 1000;
  }
  return true;
}

// ---- research -----------------------------------------------------------------------

export type ResearchError = 'unknown' | 'done' | 'busy' | 'prereq' | 'radar' | 'cost' | null;

/** A functional Signals Station hosts the research program. */
export function hasRadar(town: TownState): boolean {
  return town.structures.some(
    (s) => s.kind === 'radar' && !s.wrecked && (s.buildEndsAt === undefined || s.upgradingTo !== undefined),
  );
}

export function canResearch(town: TownState, id: string): ResearchError {
  const tech = TECH_BY_ID[id];
  if (!tech) return 'unknown';
  if (town.research.completed.includes(id)) return 'done';
  if (town.research.active) return 'busy';
  if (!hasRadar(town)) return 'radar';
  const prereq = techPrereq(tech);
  if (prereq && !town.research.completed.includes(prereq)) return 'prereq';
  if (town.intel < tech.intel) return 'cost';
  return null;
}

export function startResearch(town: TownState, id: string, now: number): boolean {
  if (canResearch(town, id) !== null) return false;
  const tech = TECH_BY_ID[id]!;
  town.intel -= tech.intel;
  town.research.active = { id, endsAt: now + tech.seconds * 1000 };
  return true;
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
  const meta = townMetaFor(town.faction)[kind];
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
  const cost = townMetaFor(town.faction)[kind]!.levels[0]!;
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
  const def = defenseCatalogFor(town.faction).walls['wall']!;
  if (town.walls.length >= gating(town).walls) return 'count';
  if (town.supplies < (def.supplyCost ?? 0)) return 'cost';
  return cellsFree(town, [cell]);
}

export function placeWall(town: TownState, cell: CellIndex): boolean {
  if (canPlaceWall(town, cell) !== null) return false;
  town.supplies -= defenseCatalogFor(town.faction).walls['wall']!.supplyCost ?? 0;
  town.walls.push({ cell, kind: 'wall' });
  return true;
}

export function removeWall(town: TownState, cell: CellIndex): boolean {
  const index = town.walls.findIndex((w) => w.cell === cell);
  if (index === -1) return false;
  town.walls.splice(index, 1);
  town.supplies += defenseCatalogFor(town.faction).walls['wall']!.supplyCost ?? 0;
  return true;
}

export function upgradeError(town: TownState, s: PlacedStructure): PlaceError | 'busy' | 'max' {
  const meta = townMetaFor(town.faction)[s.kind];
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
  const cost = townMetaFor(town.faction)[s.kind]!.levels[s.level]!;
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
  const spent = cumulativeCost(town, s.kind, s.upgradingTo ?? s.level);
  if (!s.wrecked) {
    town.supplies += Math.floor(spent.supplies * 0.5);
    town.fuel += Math.floor(spent.fuel * 0.5);
  }
  town.structures.splice(index, 1);
  return true;
}

export function repairCost(town: TownState, s: PlacedStructure): { supplies: number; fuel: number } {
  const spent = cumulativeCost(town, s.kind, s.level);
  const fraction = wreckRepairFractionFor(town.faction);
  return {
    supplies: Math.ceil(spent.supplies * fraction),
    fuel: Math.ceil(spent.fuel * fraction),
  };
}

export function repairWreck(town: TownState, id: number): boolean {
  const s = town.structures.find((x) => x.id === id);
  if (!s || !s.wrecked) return false;
  const cost = repairCost(town, s);
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
  for (const kind of ['depmg', 'foxhole', 'claymore', 'hesco', 'manpads']) {
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
  const fx = researchEffects(town);
  const defender =
    fx.wallHp !== 1 || fx.weaponDamage !== 1 || fx.cpCost !== 1
      ? { wallHp: fx.wallHp, weaponDamage: fx.weaponDamage, cpCost: fx.cpCost }
      : undefined;
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
    ...(defender ? { mods: { defender } } : {}),
    ...(reservedCells && reservedCells.length > 0 ? { reservedCells } : {}),
  };
}

type SiegeDefWithSupplies = ReturnType<typeof buildAssault>;

/** Battle config for the next SKIRMISH ladder assault. */
export function siegeConfig(town: TownState, seed: number): SimConfig {
  const def = buildAssault(town.assaultLevel, enemyRosterFor(town.faction));
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

/** Battle config for a Front Line counterattack on the town. */
export function counterattackConfig(town: TownState, seed: number): SimConfig {
  const def = buildAssault(Math.max(2, town.frontline.tier + 1), enemyRosterFor(town.faction));
  return battleConfig(town, seed, {
    ...def,
    name: `COUNTERATTACK — TIER ${town.frontline.tier}`,
    startingSupplies: Math.floor(town.supplies),
  });
}

/** Headless battle config for one offline probe raid. */
export function probeConfig(town: TownState, level: number, seed: number): SimConfig {
  const config = battleConfig(town, seed, {
    ...probeAssault(level, enemyRosterFor(town.faction)),
    startingSupplies: 0,
  });
  // Offline defenses fight under the commander's standing orders (v0.8);
  // the orders ride the config, so the defense log replays them exactly.
  const orders = standingOrdersFor(town.standingOrders);
  return orders ? { ...config, standingOrders: orders } : config;
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
  town.intel = Math.floor(town.intel * (1 - DEFEAT_LOSS_FRACTION));
  town.defeats++;
}

function clampToCaps(town: TownState): void {
  const cap = caps(town);
  town.supplies = Math.min(town.supplies, cap.supplies);
  town.fuel = Math.min(town.fuel, cap.fuel);
  town.intel = Math.min(town.intel, cap.intel);
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

/** Fold a fought-off (or lost) Front Line counterattack into the town. */
export function applyCounterResult(town: TownState, outcome: SiegeOutcome, now: number): void {
  foldBattle(town, outcome, now);
  if (outcome.victory) {
    town.supplies += 120 + 60 * town.frontline.tier;
    town.victories++;
  } else {
    applyDefeat(town);
  }
  town.frontline.pendingCounterattack = false;
  // A counterattack is the ladder reaching back, so it settles on the board
  // like a rung does — and it is fought in person, which resets the grace.
  awardStanding(town, counterAward(outcome.victory), now);
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
  // Replays of cleared missions pay a shadow of the original requisition.
  const multiplier = (bonusAchieved ? 1.5 : 1) * (firstClear ? 1 : 0.35);
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
