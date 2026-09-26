import {
  BASE_SPAWN_EDGE,
  BASE_SPAWN_LANE,
  CITADEL_SLOT,
  generateBase,
  generateCitadel,
  lootFor,
  MAP_CELL_SIZE,
  MAP_H,
  MAP_W,
  type GeneratedBase,
} from '../content/bases';
import type { Condition } from '../content/conditions';
import { STORES_LOOT_BONUS } from '../content/leagues';
import { RAID_CATALOG } from '../content/catalog';
import { recordRaid, SQUAD_SLOTS } from '../content/veterancy';
import { baseKitFor, defenseCatalogFor } from '../content/factions';
import { columnName, strongholdTier, theaterFor } from '../content/theaters';
import { GARRISON_GUN_TRADE, garrisonEconomy, garrisonFor } from '../content/garrison';
import { TRAINABLE, type TrainMeta } from '../content/usaUnits';
import { Engine } from '../sim/engine';
import { TERRAIN_NONE, TERRAIN_VERSION } from '../sim/terrain';
import { COMBAT_CURRENT } from '../sim/combat';
import { CHAIN_CURRENT } from '../sim/killchain';
import { onBoard } from '../sim/board';
import { isObjectiveId, watchObjective, type ObjectiveId } from './objectives';
import type {
  AttackerMods,
  AutoPowerRule,
  Catalog,
  CellIndex,
  Doctrine,
  SimConfig,
  SimEvent,
  UnitMods,
  WaveDef,
  WaveEntry,
} from '../sim/types';
import {
  awardStanding,
  objectiveAward,
  leagueOf,
  probeAward,
  scoutingBlocked,
} from './ladder';
import {
  applyDefenseResult,
  defenseBounty,
  defenseConfig,
  probeConfig,
  productionPerHour,
  researchEffects,
  surge,
  warLog,
  type DefenseLogEntry,
  type PendingDefense,
  type SiegeOutcome,
  type TownState,
} from './town';
import { recordBattle } from './vault';
import { canonicalUnitMods } from './codec';
import { creditContracts } from './contracts';
import { chargeStrikes, retakeSector } from './strikes';
import { canFeedNext } from './supply';
import { atCapital, winAtCapital } from './capital';
import { resolveLapsedLastStand } from './laststand';
import { noNews, officersAfterRaid, promoteDue, squadRoster, type CadreNews } from './cadre';

// The roster and its multiplier moved to the cadre (M28), which owns the
// officers they now include; every caller already imported them from here.
export { squadRoster, squadVet } from './cadre';

/**
 * The offense layer (M4): raid planning, hands-off resolution, loot, Front
 * Line progression, and the offline probe raids that keep your own base
 * honest while you're away. Everything here is deterministic given the
 * inputs — a raid config replays to the identical battle.
 */

// ---- entry sectors ---------------------------------------------------------------

export type SectorId = 'N1' | 'N2' | 'E1' | 'E2' | 'S1' | 'S2' | 'W1' | 'W2';
export const SECTOR_IDS: SectorId[] = ['N1', 'N2', 'E1', 'E2', 'S1', 'S2', 'W1', 'W2'];

/**
 * The sectors a TOWN is entered by (M27 Phase 1): its entry edge, the north
 * (`TOWN_GRID.spawnEdge`), where every probe comes from and every town is
 * walled against. A duel or a ghost raid on a commander's town comes in here.
 * Every other sector is somewhere a town was never built to be attacked
 * from, and the south ones are the row under its command post.
 */
export const TOWN_ENTRY_SECTORS: SectorId[] = ['N1', 'N2'];

/** The sectors a planner may send a squad in by: a town's entry edge, or all eight. */
export const entrySectors = (onTown: boolean): SectorId[] => (onTown ? TOWN_ENTRY_SECTORS : SECTOR_IDS);

/** The next of `allowed` after `sector`, wrapping; the first if it is not one of them. */
export function nextSector(sector: SectorId, allowed: readonly SectorId[]): SectorId {
  return allowed[(allowed.indexOf(sector) + 1) % allowed.length]!;
}

/**
 * A sector brought within `allowed`: itself if it is one, or else the allowed
 * sector nearest it, so a plan made against a post and opened on a town
 * moves each squad to the part of the entry edge on its own side.
 */
export function sectorWithin(sector: SectorId, allowed: readonly SectorId[]): SectorId {
  if (allowed.includes(sector)) return sector;
  const mid = (id: SectorId): { col: number; row: number } => {
    const cells = sectorCells(id);
    return cells[Math.floor(cells.length / 2)]!;
  };
  const from = mid(sector);
  let best = allowed[0]!;
  let bestDist = Infinity;
  for (const id of allowed) {
    const to = mid(id);
    const dist = (to.col - from.col) ** 2 + (to.row - from.row) ** 2;
    if (dist < bestDist) {
      best = id;
      bestDist = dist;
    }
  }
  return best;
}

/** The doctrines a formation can be given, in picker order. Lives here rather
 * than in the scene because a stored plan read off disk has to be checked
 * against the same list the planner cycles. */
export const DOCTRINE_IDS: Doctrine[] = ['assault', 'hunt', 'raze'];

const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * Ordered spawn cells per sector, spread along one half of an edge.
 *
 * Re-authored for the portrait board (v1.40). North and south are the short
 * edges now, so their halves are six cells rather than eleven; east and west
 * are the long ones and grew. N1/N2 are the FRONT DOOR — the line a siege
 * comes down and the one the defender's guns are aimed at — which is what
 * makes choosing S1 or E2 instead a decision rather than a preference.
 *
 * The spans are PHYSICAL (M34), like the waves: N1 is units 2-8 of the
 * 20-unit north edge, whatever a cell is, and the board maps them by the one
 * rule. At two units a cell N1 is columns 1-4.
 */
export function sectorCells(id: SectorId): { col: number; row: number }[] {
  const span = (lo: number, hi: number): number[] =>
    range(onBoard(lo, MAP_CELL_SIZE), onBoard(hi, MAP_CELL_SIZE));
  switch (id) {
    case 'N1':
      return span(2, 8).map((col) => ({ col, row: 0 }));
    case 'N2':
      return span(11, 17).map((col) => ({ col, row: 0 }));
    case 'S1':
      return span(2, 8).map((col) => ({ col, row: MAP_H - 1 }));
    case 'S2':
      return span(11, 17).map((col) => ({ col, row: MAP_H - 1 }));
    case 'W1':
      return span(3, 13).map((row) => ({ col: 0, row }));
    case 'W2':
      return span(17, 27).map((row) => ({ col: 0, row }));
    case 'E1':
      return span(3, 13).map((row) => ({ col: MAP_W - 1, row }));
    case 'E2':
      return span(17, 27).map((row) => ({ col: MAP_W - 1, row }));
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
  /**
   * Which standing formation this is (v1.9). Explicit rather than positional
   * because the launcher drops empty squads from the plan — leave SQD2 at
   * home and SQD3 must still come back as SQD3, or it inherits a stranger's
   * experience. Defaults to the plan index.
   */
  slot?: number;
  /**
   * Veterancy multiplier the formation launched with (content/veterancy.ts).
   * Baked into the wave here so a replay re-fights the raid with the squad the
   * player actually sent, not the squad they have now.
   */
  vet?: number;
  /**
   * Seconds after LAUNCH this formation crosses the line (v1.15). Omit for the
   * default stagger — slot order, six seconds apart — which is exactly what
   * every plan did before the delay was a choice, so nothing that predates it
   * fights a different battle.
   *
   * Tunnel dig time is added on top: a gallery squad ordered to T+0 still
   * surfaces when the ground opens, not before.
   */
  delay?: number;
}

/**
 * The last plan the player launched, kept so the planner opens on it (v1.16).
 *
 * Stored rather than reconstructed from the replay. A saved raid IS its config,
 * but a config is a list of men with arrival ticks — the decisions above it
 * (which sector, which doctrine, which second, which gallery) are only
 * recoverable by inference, and inference is how a restored plan quietly stops
 * being the plan that was written. The three slots are kept even when empty,
 * because an empty formation is a decision too.
 */
export type StoredPlan = Pick<SquadPlan, 'units' | 'sector' | 'doctrine' | 'tunnel' | 'delay'>;

/** Strip a launched plan down to the parts worth reopening. */
export function storePlan(squads: SquadPlan[]): StoredPlan[] {
  return Array.from({ length: SQUAD_SLOTS }, (_, slot) => {
    // Slot order, not array order: launch() drops the empty formations, so the
    // third entry of what was sent is not necessarily the third formation.
    const squad = squads.find((s, i) => slotOf(s, i) === slot);
    if (!squad) return { units: {}, sector: SECTOR_IDS[0]!, doctrine: 'assault' as Doctrine };
    return {
      units: { ...squad.units },
      sector: squad.sector,
      doctrine: squad.doctrine,
      ...(squad.tunnel !== undefined ? { tunnel: squad.tunnel } : {}),
      ...(squad.delay !== undefined ? { delay: squad.delay } : {}),
    };
  });
}

/** A stored plan read back off disk, with anything unrecognizable dropped. */
export function normalizePlan(raw: unknown): StoredPlan[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const plan = raw.slice(0, SQUAD_SLOTS).map((entry): StoredPlan => {
    const squad = (entry ?? {}) as Partial<StoredPlan>;
    const units: Record<string, number> = {};
    if (squad.units && typeof squad.units === 'object') {
      for (const [kind, count] of Object.entries(squad.units)) {
        if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
          units[kind] = Math.min(999, Math.round(count));
        }
      }
    }
    return {
      units,
      sector: SECTOR_IDS.includes(squad.sector as SectorId) ? squad.sector! : SECTOR_IDS[0]!,
      doctrine: DOCTRINE_IDS.includes(squad.doctrine as Doctrine) ? squad.doctrine! : 'assault',
      ...(typeof squad.tunnel === 'number' && Number.isInteger(squad.tunnel)
        ? { tunnel: squad.tunnel }
        : {}),
      ...(typeof squad.delay === 'number' && Number.isFinite(squad.delay)
        ? { delay: Math.max(0, Math.min(60, Math.round(squad.delay))) }
        : {}),
    };
  });
  while (plan.length < SQUAD_SLOTS) {
    plan.push({ units: {}, sector: SECTOR_IDS[0]!, doctrine: 'assault' });
  }
  return plan;
}

/**
 * Reopen the stored plan against today's army and today's target.
 *
 * Two things are re-checked rather than trusted, because both can have moved
 * since the plan was written: the men (the last raid spent them, and a plan
 * that silently fields soldiers who are dead is worse than no plan) and the
 * galleries (a mouth was sited on ONE base — on the next target that cell may
 * be a wall, or the wrong side of the wire). Units fill in slot order, so the
 * lead formation is made whole first.
 */
export function reopenPlan(
  stored: StoredPlan[] | undefined,
  army: Record<string, number>,
  base: GeneratedBase | null,
): SquadPlan[] | null {
  const plan = normalizePlan(stored);
  if (!plan) return null;
  const budget: Record<string, number> = {};
  for (const [kind, held] of Object.entries(army)) {
    budget[kind] = Math.max(0, Math.floor(held));
  }
  const squads = plan.map((squad, slot): SquadPlan => {
    const units: Record<string, number> = {};
    for (const [kind, wanted] of Object.entries(squad.units)) {
      const take = Math.min(wanted, budget[kind] ?? 0);
      if (take > 0) {
        units[kind] = take;
        budget[kind] = (budget[kind] ?? 0) - take;
      }
    }
    const keepsTunnel =
      squad.tunnel !== undefined && base !== null && tunnelSiteValid(base, squad.tunnel);
    return {
      units,
      sector: squad.sector,
      doctrine: squad.doctrine,
      slot,
      ...(keepsTunnel ? { tunnel: squad.tunnel! } : {}),
      // The delay survives a dropped gallery: how late a formation goes in is a
      // decision about the clock, not about the hole in the ground.
      delay: squad.delay ?? slot * (SQUAD_DELAY_TICKS / 20),
    };
  });
  return squads;
}

/** How much of a stored plan today's army can actually field. */
export function planShortfall(
  stored: StoredPlan[] | undefined,
  army: Record<string, number>,
): { wanted: number; fielded: number } {
  const plan = normalizePlan(stored);
  if (!plan) return { wanted: 0, fielded: 0 };
  const wanted = plan.reduce(
    (sum, squad) => sum + Object.values(squad.units).reduce((a, b) => a + b, 0),
    0,
  );
  const reopened = reopenPlan(plan, army, null) ?? [];
  return { wanted, fielded: planUnitCount(reopened) };
}

/**
 * The delays a commander can order, in seconds. The first three are the old
 * fixed stagger, so the default plan is expressible in the same vocabulary the
 * player edits in — a picker whose starting value is not one of its own stops
 * is a picker that lies on the first tap.
 */
export const DELAY_STEPS = [0, 6, 12, 20, 30, 45, 60];

/** What this squad's delay actually is, default stagger included. */
export const delayOf = (squad: SquadPlan, index: number): number =>
  squad.delay ?? index * (SQUAD_DELAY_TICKS / 20);

/** The next stop up the list, wrapping at the top. */
export function nextDelay(seconds: number): number {
  const at = DELAY_STEPS.indexOf(seconds);
  return DELAY_STEPS[at === -1 ? 0 : (at + 1) % DELAY_STEPS.length]!;
}

export const slotOf = (squad: SquadPlan, index: number): number =>
  squad.slot ?? index;

export const SQUAD_DELAY_TICKS = 120; // squads launch 6s apart, in order

// ---- tunnel insertion (v0.6, NK doctrine) ----------------------------------------

export const TUNNEL_DIG_TICKS = 160; // 8s: the ground opens after the walkers commit
export const TUNNEL_FUEL_COST = 40; // per squad: galleries are shored and sealed per raid
export const TUNNEL_MIN_CC_DIST = 4; // PHYSICAL units from the post's centre: off its
// doorstep, but inside every template's wall ring — two cells at two units a cell,
// against a compound four out and a star three

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
  // Two units in from every edge, in this board's cells (M34).
  const margin = onBoard(2, MAP_CELL_SIZE);
  if (col < margin || col > MAP_W - 1 - margin || row < margin || row > MAP_H - 1 - margin) {
    return false;
  }
  if (base.walls.some((w) => w.cell === cell)) return false;
  const ccCol = (base.ccOrigin % MAP_W) + 0.5;
  const ccRow = Math.floor(base.ccOrigin / MAP_W) + 0.5;
  const dc = col - ccCol;
  const dr = row - ccRow;
  const min = TUNNEL_MIN_CC_DIST / MAP_CELL_SIZE;
  return dc * dc + dr * dr >= min * min;
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
    const ordered = Math.max(0, Math.min(60, Math.round(delayOf(squad, squadIndex))));
    const baseTick = ordered * 20 + (tunneled ? TUNNEL_DIG_TICKS : 0);
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
          squad: slotOf(squad, squadIndex),
          ...(squad.vet !== undefined && squad.vet !== 1 ? { vet: squad.vet } : {}),
        });
        unitIndex++;
      }
    }
  });
  return { entries };
}

export interface RaidSupport {
  /**
   * Pin the combat rolls instead of deriving them from the battle seed.
   *
   * A duel is a puzzle to beat, not a live match: both commanders fight the
   * same pasted base whenever they like, and the existing rule already strips
   * the weather and the bonus from it so that the PLAN is what differs. Rolls
   * that varied per attempt would put that back — so a challenge pins this to
   * its code's fingerprint and the ladder leaves it alone.
   */
  combatSeed?: number;
  /** What the raid is going out for (v1.24). Defaults to taking the post. */
  objective?: ObjectiveId;
  /** Research multipliers for the raiding units. */
  mods?: AttackerMods;
  /**
   * The army's fitted specialisations (M28 Phase 4), by kind: see
   * `unitModsOf`. Wherever research goes, these go too.
   */
  unitMods?: Record<string, UnitMods>;
  /** Pre-planned fire missions, evaluated in-sim. */
  autoPowers?: AutoPowerRule[];
  /** Ordnance stock committed to this raid (usually the town's charges). */
  powerCharges?: Record<string, number>;
  /**
   * Today's field condition (M7). Its attacker mods stack with research on
   * your units; its defender mods land on the target's guns and walls. Ladder
   * raids only — campaign, skirmish and code duels leave this out.
   */
  condition?: Condition;
}

/** Research and the weather, multiplied together. */
function combineAttackerMods(
  research: AttackerMods | undefined,
  condition: AttackerMods | undefined,
): AttackerMods {
  return {
    hp: (research?.hp ?? 1) * (condition?.hp ?? 1),
    damage: (research?.damage ?? 1) * (condition?.damage ?? 1),
  };
}

const identityAttacker = (mods: AttackerMods): boolean =>
  (mods.hp ?? 1) === 1 && (mods.damage ?? 1) === 1;

export function raidConfig(
  base: GeneratedBase,
  squads: SquadPlan[],
  seed: number,
  trainable: TrainMeta[] = TRAINABLE,
  support: RaidSupport = {},
): SimConfig {
  const attacker = combineAttackerMods(support.mods, support.condition?.attacker);
  const defender = support.condition?.defender;
  const hasAttacker = !identityAttacker(attacker);
  // No `hasDefender` guard any more: since v1.20 the defender block is always
  // present, because every raided post pays the garrison's price on its guns
  // whether or not the day's rotation is doing anything to them as well.
  // One reserved cell per tunneled squad, in squad order: the renderer draws
  // the mouths, replays re-dig them, and applyRaidResult bills them.
  const mouths = squads.filter((s) => s.tunnel !== undefined).map((s) => s.tunnel!);
  // As the replay code carries them, so the raid fought is the one it re-fights.
  const unitMods = canonicalUnitMods(support.unitMods);
  return {
    width: MAP_W,
    height: MAP_H,
    // The board's cell, in the catalog's units (M34): named here, at the one
    // seam every raid, duel and probe config comes through.
    cellSize: MAP_CELL_SIZE,
    seed,
    ccOrigin: base.ccOrigin,
    ccLevel: base.ccLevel,
    // The target's board is a generated one, so its entry line is the
    // generator's — what keeps the terrain's dry corridor on the same edge
    // the base was laid out against.
    spawnLane: BASE_SPAWN_LANE,
    spawnEdge: BASE_SPAWN_EDGE,
    // The target's own ground. A base carries its terrain seed, so a ladder
    // rung, a duel and a replay of either all fight the same sheet.
    terrainSeed: base.terrainSeed,
    terrainVersion: base.terrainSeed > 0 ? TERRAIN_VERSION : TERRAIN_NONE,
    // Every new battle rolls (v1.23). Absent the override below the engine
    // derives the combat stream from `seed`, so a ladder raid — seeded from
    // the clock — is a different battle every time it is fought, and a replay
    // that carries the same seed re-fights the one that happened.
    combatVersion: COMBAT_CURRENT,
    // …and every new raid is fought for a staged objective rather than an HP
    // sponge (v1.41). Named here rather than defaulted in the engine, so an
    // archived replay that names nothing still re-fights the sponge it recorded.
    killChainVersion: CHAIN_CURRENT,
    ...(support.combatSeed !== undefined ? { combatSeed: support.combatSeed >>> 0 } : {}),
    ...(support.objective !== undefined && support.objective !== 'post'
      ? { objective: support.objective }
      : {}),
    playerSide: 'attacker',
    // The watch on the wire (v1.20). Derived from the base's own shape and
    // rung, both of which a share code and a replay already carry, so a
    // scouted post, the raid on it and the replay of that raid all face the
    // same garrison without a byte of new format.
    garrison: garrisonFor(base.archetype, base.tier),
    siege: {
      name: `RAID — ${base.name}`,
      startingSupplies: 0,
      suppliesPerWave: 0,
      // Command Points are the defender's, and until v1.20 a raid gave them
      // none — which is why route length and wall HP bought nothing. The base
      // now starts asleep and wakes at a fixed rate: getting there fast means
      // getting there before the reserve exists.
      ...garrisonEconomy(base.tier),
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
    // Defender mods are now unconditional: every raided post pays the
    // garrison's price (v1.20) out of its standing gun coverage, and that
    // trade composes with — never replaces — whatever the day's conditions
    // are already doing to the same guns.
    mods: {
      ...(hasAttacker ? { attacker } : {}),
      // All three fields explicitly, identity included: the replay codec
      // writes the trio and reads it back as a trio, so a partial object here
      // would round-trip into a fuller one and stop matching itself.
      defender: {
        weaponDamage: (defender?.weaponDamage ?? 1) * GARRISON_GUN_TRADE,
        wallHp: defender?.wallHp ?? 1,
        cpCost: defender?.cpCost ?? 1,
      },
    },
    ...(support.autoPowers && support.autoPowers.length > 0
      ? { autoPowers: support.autoPowers.map((r) => ({ ...r })) }
      : {}),
    ...(unitMods ? { unitMods } : {}),
  };
}

// ---- resolution --------------------------------------------------------------------------

export const RAID_MAX_TICKS = 6000; // 5 minutes of sim time, hard stop

/** What one formation sent, and what walked back. */
export interface SquadReturn {
  /** Standing formation index (SquadPlan.slot). */
  slot: number;
  deployed: number;
  returned: number;
}

export interface RaidResolution {
  cleared: boolean;
  ticks: number;
  deployed: Record<string, number>;
  /** Per-formation returns, in plan order (v1.9). Empty squads are omitted. */
  squads: SquadReturn[];
  survivors: Record<string, number>;
  losses: Record<string, number>;
  destroyed: Record<string, number>;
  /**
   * Wall segments the attacker actually broke (v1.41).
   *
   * `destroyed` has always covered structures and said nothing about the wire,
   * which is the first thing a raid has to get through — so "did this force
   * even cut its way in" was not a question the resolution could answer.
   */
  wallsBreached: number;
  /**
   * Stages of the kill chain the assault completed, 0-4 (v1.41): breach,
   * suppress, charge, burn. Always 0 on the sponge, which has no stages —
   * the caller knows which model it asked for and reads this against that.
   */
  chainStages: number;
  loot: { supplies: number; fuel: number };
  destructionPct: number;
  /** Ordnance charges actually expended by the fire plan. */
  powersUsed: Record<string, number>;
  /** Reserves the base's garrison stood up while you were getting there (v1.20). */
  reserves: number;
  /** What the raid was sent to do (v1.24). Absent from a config means 'post'. */
  objective: ObjectiveId;
  /** Did it do it? For 'post' this is the same as `cleared`. */
  objectiveMet: boolean;
  /** How many of the objective's class had to fall; 0 for the command post. */
  quota: number;
  /** How many actually fell. */
  progress: number;
  /** True when the force pulled out on filling its quota rather than fighting on. */
  withdrew: boolean;
  /**
   * How much of the command post was still standing when the raid ended,
   * 0..1 (v1.23).
   *
   * A raid is a roll now, so the report has to be able to say how the roll
   * went. On a repulse this is how close the post came to falling; on a clear
   * it is 0 and the margin is read off who came home instead.
   */
  ccHpFraction: number;
}

/** Loot multipliers a raid is fought under (league band × field condition). */
export interface LootPayout {
  supplies: number;
  fuel: number;
}

export const FLAT_PAYOUT: LootPayout = { supplies: 1, fuel: 1 };

/**
 * Run the raid headlessly to its end. Deterministic; the replay re-runs it.
 *
 * `payout` scales what the wreckage is worth — the ladder pays by band and by
 * today's condition, and the battle report has to show the number that
 * actually reaches the depot, not the sticker price.
 */
/**
 * Fight a raid's engine to its end: the post taken or held, the clock, or a
 * lesser objective filled. The one loop every raid goes through, so a report
 * that fights one again (M29) gets the battle its resolution got; `observe`
 * sees each tick's events as they happen. Call it before the first step.
 */
export function fightRaid(
  engine: Engine,
  config: SimConfig,
  observe?: (events: SimEvent[]) => void,
): { withdrew: boolean; watch: ReturnType<typeof watchObjective> } {
  // What the raid came for, and what it takes (v1.24). Read once, from what
  // the base is actually holding — a quota fixed against the starting count
  // cannot be moved by the raid that is trying to fill it.
  const objective = isObjectiveId(config.objective) ? config.objective : 'post';
  /**
   * A lesser objective ends the raid the moment it is filled, and that is the
   * whole trade: you come home with the men you have left instead of feeding
   * them to a post you were never going to take. Checked between steps rather
   * than inside the engine, so no `Phase` is added and nothing in the sim has
   * to know what a mission is.
   */
  const watch = watchObjective(objective, (cls) => engine.countStanding(cls));
  let withdrew = false;
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < RAID_MAX_TICKS) {
    const events = engine.step();
    observe?.(events);
    if (watch.met()) {
      withdrew = true;
      break;
    }
  }
  return { withdrew, watch };
}

export function resolveRaid(
  config: SimConfig,
  squads: SquadPlan[],
  tier: number,
  catalog: Catalog = RAID_CATALOG,
  payout: LootPayout = FLAT_PAYOUT,
): RaidResolution {
  const engine = new Engine(config, catalog);
  engine.enqueue({ tick: 0, type: 'startAssault' });

  const initial = new Map<string, number>();
  for (const s of engine.structures) {
    initial.set(s.profile.kind, (initial.get(s.profile.kind) ?? 0) + 1);
  }

  const objective = isObjectiveId(config.objective) ? config.objective : 'post';
  const { withdrew, watch } = fightRaid(engine, config);

  const survivors: Record<string, number> = {};
  for (const attacker of engine.attackers) {
    survivors[attacker.profile.kind] = (survivors[attacker.profile.kind] ?? 0) + 1;
  }
  const deployed = planDeployment(squads);
  // Per-formation attribution: the engine stamped each unit with the squad
  // that sent it, so a survivor sweep tells us who came back and who didn't.
  const back = new Map<number, number>();
  for (const attacker of engine.attackers) {
    back.set(attacker.squad, (back.get(attacker.squad) ?? 0) + 1);
  }
  const squadReturns: SquadReturn[] = squads.map((squad, index) => {
    const slot = slotOf(squad, index);
    return {
      slot,
      deployed: Object.values(squad.units).reduce((a, b) => a + b, 0),
      returned: back.get(slot) ?? 0,
    };
  });
  const losses: Record<string, number> = {};
  for (const [kind, count] of Object.entries(deployed)) {
    const lost = count - (survivors[kind] ?? 0);
    if (lost > 0) losses[kind] = lost;
  }

  const remaining = new Map<string, number>();
  for (const s of engine.structures) {
    if (s.hp > 0 && !s.hulk) remaining.set(s.profile.kind, (remaining.get(s.profile.kind) ?? 0) + 1);
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

  loot.supplies = Math.round(loot.supplies * payout.supplies);
  loot.fuel = Math.round(loot.fuel * payout.fuel);
  // RAID THE STORES is paid in material rather than reputation: filling it
  // pays a premium on everything the force carried out.
  if (objective === 'stores' && withdrew) {
    loot.supplies = Math.round(loot.supplies * STORES_LOOT_BONUS);
    loot.fuel = Math.round(loot.fuel * STORES_LOOT_BONUS);
  }

  return {
    cleared: engine.phase === 'defeat', // the DEFENDER lost its command post
    ticks: engine.tick,
    deployed,
    squads: squadReturns.filter((r) => r.deployed > 0),
    survivors,
    losses,
    destroyed,
    wallsBreached: engine.stats.wallsLost,
    chainStages: engine.chainStagesCleared,
    loot,
    destructionPct: initialTotal > 0 ? destroyedTotal / initialTotal : 0,
    powersUsed,
    reserves: engine.ordersExecuted,
    ccHpFraction: Math.max(0, engine.cc.hp / engine.cc.profile.maxHp),
    objective,
    // Taking the post is a superset of every lesser objective: a force sent
    // for the guns that ends up killing the command post did not FAIL its
    // mission. Uniform rather than branched, because for 'post' there is no
    // quota to withdraw on and `withdrew` is always false.
    objectiveMet: engine.phase === 'defeat' || withdrew,
    quota: watch.quota,
    // The post is not a quota; for the other two this is how far they got.
    progress: watch.progress(),
    withdrew,
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
): CadreNews {
  for (const [kind, lost] of Object.entries(resolution.losses)) {
    town.army[kind] = Math.max(0, (town.army[kind] ?? 0) - lost);
  }
  // A raid is a battle the commander fought: China's lines surge (M26).
  surge(town, now);
  // Veterancy (v1.9): the formations that went out get their record updated
  // before anything else, because the record is written in the same men the
  // loss line just deducted. A duel counts as tier 1 — it is still a fight.
  warLog(town).raids++;
  // Today's orders (v1.12). One call site per metric: a contract counted from
  // two places would drift, and nothing in the save could say which was right.
  const razed = Object.values(resolution.destroyed).reduce((a, b) => a + b, 0);
  creditContracts(town, 'structuresRazed', razed, now);
  creditContracts(town, 'raidLoot', resolution.loot.supplies, now);
  if (resolution.cleared) {
    creditContracts(town, 'postsTaken', 1, now);
    if (base.tier >= 3) creditContracts(town, 'deepPost', 1, now);
  }
  const roster = squadRoster(town);
  const foughtTier = Math.max(1, base.tier);
  // The officers first (M28): one whose squad came back without a man falls
  // with it, and one who came back banks the raid, before the men's record is
  // written over by what the survivors kept.
  const news: CadreNews = {
    ...noNews(),
    ...officersAfterRaid(town, resolution.squads, foughtTier, resolution.objectiveMet, base.name, now),
  };
  for (const ret of resolution.squads) {
    const record = roster[ret.slot];
    if (!record) continue;
    roster[ret.slot] = recordRaid(record, {
      deployed: ret.deployed,
      returned: ret.returned,
      tier: foughtTier,
      // A formation that did what it was sent to do had a good day, whether
      // or not the post fell. Before v1.24 there was only one thing to be
      // sent to do, so this read `cleared`.
      cleared: resolution.objectiveMet,
    });
  }
  // A squad that reached LINE with nobody in command gets somebody.
  news.promoted = promoteDue(town, now);
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
    fileRaid(town, base, resolution, config, now, 'duel');
    town.lastSeen = now;
    return news;
  }

  const frontline = town.frontline;
  // Whatever the enemy retook while the raid was planned lands first, on the
  // front as it stood when it did (M25 Phase 2).
  chargeStrikes(town, now);
  if (resolution.cleared) {
    frontline.totalWins++;
    town.victories++;
    if (base.tier === frontline.tier && atCapital(town)) {
      // The enemy's capital is not taken by any three wins: its roads, each
      // once, and then its citadel, whose fall wins the war (M25 Phase 4b).
      winAtCapital(town, base.variant, now);
    } else if (base.tier === frontline.tier) {
      frontline.wins++;
      if (frontline.wins >= 3) {
        // The front's town is taken only if the depots can feed the line with
        // it (M25 Phase 4a); until they can, it holds at its last push.
        if (canFeedNext(frontline, productionPerHour(town).supplies)) {
          frontline.tier++;
          frontline.wins = 0;
        } else {
          frontline.wins = 2;
        }
      }
    } else {
      // A sector behind the front that the enemy had retaken is the
      // commander's again, and the pushes at the front do not move. A post
      // the ground moved out from under (the front fell back while it was
      // planned) pays like any post and moves nothing.
      retakeSector(frontline, base.tier, base.variant);
    }
    // Every second cleared post triggers a counterattack on your base.
    if (frontline.totalWins % 2 === 0) frontline.pendingCounterattack = true;
    // A front back at its deepest needs no reminder of it (M25 Phase 4c).
    if (frontline.deepest !== undefined && frontline.tier >= frontline.deepest) delete frontline.deepest;
  }
  // The board moves either way (M7): a rung pays standing at today's rate, a
  // failed raid costs it. Both count as playing, so the decay grace resets.
  // Since v1.24 the rate depends on what the raid went out for — only taking
  // the post pays a full clear, and only taking the post moved the rung above.
  awardStanding(
    town,
    objectiveAward(
      // …and it pays like one. A raid that took the post is a post raid on the
      // board whatever it declared, which is also the only reading consistent
      // with the rung it just banked above.
      resolution.cleared ? 'post' : resolution.objective,
      resolution.objectiveMet,
      base.tier,
      now,
    ),
    now,
  );

  town.lastRaid = {
    config,
    baseName: base.name,
    tier: base.tier,
    at: now,
    cleared: resolution.cleared,
  };
  fileRaid(town, base, resolution, config, now, 'raid');
  town.lastSeen = now;
  return news;
}

/** File a resolved raid in the vault with the line the config cannot know. */
function fileRaid(
  town: TownState,
  base: GeneratedBase,
  resolution: RaidResolution,
  config: SimConfig,
  now: number,
  kind: 'raid' | 'duel',
): void {
  const lost = Object.values(resolution.losses).reduce((a, b) => a + b, 0);
  recordBattle(town, {
    kind,
    faction: town.faction,
    title: base.name,
    won: resolution.cleared,
    at: now,
    detail:
      `${Math.round(resolution.destructionPct * 100)}% destroyed · ` +
      `${lost} lost · +${resolution.loot.supplies} SUP`,
    config,
  });
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

/**
 * Buy the layout. Pass `now` to honour the field condition: under BLACKOUT
 * Signals is down on both sides and no price buys a picture.
 */
export function scoutTarget(
  town: TownState,
  tier: number,
  variant: number,
  now?: number,
): boolean {
  if (isScouted(town, tier, variant)) return true;
  if (now !== undefined && scoutingBlocked(now)) return false;
  const cost = scoutPrice(town, tier);
  if (town.intel < cost) return false;
  town.intel -= cost;
  town.frontline.scouted.push(targetKey(tier, variant));
  creditContracts(town, 'scouted', 1, now ?? town.lastSeen);
  return true;
}

export function targetFor(town: TownState, variant: number): GeneratedBase {
  return postAt(town, town.frontline.tier, variant);
}

/**
 * The post the ladder deals at `tier` in slot `variant`: at the front, or in a
 * sector behind it that the enemy has retaken (M25 Phase 2), which is the same
 * base it was when that town was the front.
 */
export function postAt(town: TownState, tier: number, variant: number): GeneratedBase {
  // The citadel is the capital's fourth target, in no lane (M25 Phase 4b).
  if (variant === CITADEL_SLOT) return citadelAt(town, tier);
  // The faction decides the DEAL (v1.21): which of the eight shapes lands in
  // which of the rung's three slots. Every other path that generates a ladder
  // base has to pass it too, or it is looking at a different front line from
  // the one the player is.
  return generateBase(tier, variant, baseKitFor(town.faction), undefined, town.faction);
}

/** The enemy's headquarters at its capital, named for the stronghold it holds (M25 Phase 4b). */
export function citadelAt(town: TownState, tier = strongholdTier(theaterFor(town.faction))): GeneratedBase {
  const base = generateCitadel(tier, baseKitFor(town.faction), town.faction);
  return { ...base, name: `THE CITADEL · ${columnName(theaterFor(town.faction), tier)}` };
}

// ---- offline probe raids -----------------------------------------------------------------

export const PROBE_INTERVAL_MS = 3 * 3_600_000;
export const PROBE_SHIELD_MS = 12 * 3_600_000;
export const PROBE_MAX = 3;
export const DEFENSE_LOG_CAP = 4;
/** Supplies billed per standing-order action the garrison executes. */
export const ORDERS_UPKEEP_SUPPLIES = 15;

/**
 * The town's own buildings still standing: not the post, and not a field work
 * bought with CP, which expires with the battle as a played siege treats it.
 */
function ownStructures(engine: Engine): number {
  return engine.structures.filter(
    (s) => s.profile.kind !== 'cc' && s.hp > 0 && !s.hulk && s.profile.cpCost === undefined,
  ).length;
}

/**
 * How hard the probes hit. Standing is visibility (M7): the higher the band,
 * the heavier the things that come looking while you are away. That is the
 * price of the loot bonus, and it is why the top of the board is a posting
 * rather than a trophy.
 */
export function probeLevel(town: TownState): number {
  const pressure = leagueOf(town).probePressure;
  return Math.max(1, Math.min(town.assaultLevel, town.frontline.tier + 1) + pressure);
}

/**
 * Runs the offline probes owed for the absence since lastSeen. Call BEFORE
 * tick() on load. Structures are never wrecked by probes (crews rebuild
 * between skirmishes); walls lost stay lost and every probe is replayable.
 */
/** The seed a probe `i` steps into an absence fights under. */
const probeSeedAt = (lastSeen: number, i: number): number =>
  ((Math.floor(lastSeen / 60_000) + i * 7919) * 2654435761) >>> 0;

/** How long an offered defence waits before the attack simply lands. */
export const DEFENSE_OFFER_MS = 30 * 60_000;

/**
 * One probe, fought headless and billed to the town.
 *
 * Extracted in v1.43 because a probe can now arrive down two roads — the
 * offline sweep, and an offer the player walked away from — and what a breach
 * costs must not depend on which road it came down.
 */
function resolveProbe(
  town: TownState,
  level: number,
  seed: number,
  at: number,
  now: number,
): DefenseLogEntry {

  const config = probeConfig(town, level, seed);
  const engine = new Engine(config, defenseCatalogFor(town.faction));
  const standing = ownStructures(engine);
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 8000) {
    engine.step();
  }

  const held = engine.phase === 'victory';
  const structuresLost = standing - ownStructures(engine);
  // Walls chewed during the probe stay chewed.
  const walls: { cell: CellIndex; kind: string }[] = [];
  for (const [cell, wall] of engine.grid.walls) {
    if (engine.catalog.walls[wall.kind]?.supplyCost !== undefined) {
      walls.push({ cell, kind: wall.kind });
    }
  }
  town.walls = walls;

  // What the town lost, not what the battle did: a mine the garrison laid is
  // gone the moment it goes off, and a gun it bought with CP was never the
  // town's, so neither is billed as a building (M23 Phase 6). Until then both
  // were, at 3% of the stockpile each, which made the two presets that lay
  // them cost a held probe more than leaving no orders at all.
  const lossFraction = held ? Math.min(0.03 * structuresLost, 0.1) : 0.15;
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

  return logDefense(
    town,
    {
      at,
      level,
      held,
      suppliesLost,
      fuelLost,
      ...(engine.stats.ccKillerKind ? { killer: engine.stats.ccKillerKind } : {}),
      ...(config.standingOrders ? { orders: config.standingOrders.id } : {}),
      config,
    },
    now,
    false,
  );
}

/**
 * Everything a finished defence does to the record, whichever way it was
 * fought: the log entry, the war counts, the contract credit, the standing,
 * and the shield a breach buys.
 *
 * Split out in v1.43 so a defence the player took in person is the SAME event
 * in the record as the one the garrison would have fought. `live` changes two
 * things and nothing else — a played battle resets the decay grace, and it
 * does not go to the vault, because the vault stores a config and replaying a
 * played battle's config would show the garrison fighting it rather than what
 * the player actually did.
 */
function logDefense(
  town: TownState,
  entry: DefenseLogEntry,
  now: number,
  live: boolean,
): DefenseLogEntry {
  town.defenseLog.unshift(entry);
  // The defense log keeps four entries; the record keeps the count, because
  // the war fought while nobody was watching is most of the war.
  const log = warLog(town);
  if (entry.held) log.probesHeld++;
  else log.probesBreached++;
  if (entry.held) creditContracts(town, 'probesHeld', 1, entry.at);
  if (!live) {
    // The defense log keeps four; the vault keeps ten, and keeps them as
    // codes — so the probe that got through is still watchable next week.
    recordBattle(town, {
      kind: 'probe',
      faction: town.faction,
      title: `PROBE — LEVEL ${entry.level}`,
      won: entry.held,
      at: entry.at,
      detail: entry.held
        ? `held · ${entry.suppliesLost} SUP lost`
        : `BREACHED · ${entry.killer ?? 'command post lost'}`,
      config: entry.config,
    });
  }
  // A garrison holding the wire keeps you on the board; a breach is read as
  // exactly what it is. Only a defence fought in person counts as the
  // commander playing, and so only that one buys quiet time against the
  // decay clock.
  awardStanding(town, probeAward(entry.held), entry.at, live);
  if (!entry.held) town.shieldUntil = now + PROBE_SHIELD_MS;
  town.defenseLog.length = Math.min(town.defenseLog.length, DEFENSE_LOG_CAP);
  return entry;
}

/** What the scene needs to hand back after a live defence is fought. */
export interface FoughtDefense {
  level: number;
  at: number;
  config: SimConfig;
}

/**
 * Fold a live defence — the offer, accepted and played — back into the town,
 * and put it on the record beside the probes the garrison fought.
 *
 * The economics are in `applyDefenseResult`; this is the bookkeeping half.
 */
export function applyLiveDefense(
  town: TownState,
  fought: FoughtDefense,
  outcome: SiegeOutcome,
  now: number,
): DefenseLogEntry {
  // The result is in, so the attack is answered: clear the offer that
  // `claimLiveDefense` deliberately left standing.
  delete town.pendingDefense;
  const cost = applyDefenseResult(town, outcome, liveDefenseBounty(fought.level), now);
  return logDefense(
    town,
    {
      at: fought.at,
      level: fought.level,
      held: outcome.victory,
      suppliesLost: cost.suppliesLost,
      fuelLost: cost.fuelLost,
      ...(outcome.stats.ccKillerKind ? { killer: outcome.stats.ccKillerKind } : {}),
      live: true,
      config: fought.config,
    },
    now,
    true,
  );
}

/**
 * The battle behind a pending offer, or null when nothing is inbound.
 *
 * Same seed, same level, same layout the offline sweep would have used — so
 * accepting fights the attack that was actually coming rather than a fresh
 * one rolled for the occasion.
 */
export function liveDefenseConfig(town: TownState): SimConfig | null {
  const pending = town.pendingDefense;
  return pending ? defenseConfig(town, pending.level, pending.seed) : null;
}

/**
 * What holding the line live pays over letting the garrison handle it.
 *
 * Priced in `town.ts` beside the battle it pays for. Re-exported here because
 * this module is where the offer lives and every caller already imports it.
 */
export const liveDefenseBounty = defenseBounty;

/**
 * Commit to the offer: the battle is being fought now.
 *
 * This does NOT take the attack off the board, and that is the point. The
 * offer is saved with its window already closed, so a player who accepts and
 * then closes the tab mid-battle finds it landed at the full offline price on
 * their next load rather than having made it disappear. `applyLiveDefense`
 * clears it when a result actually comes back.
 *
 * Quitting a SKIRMISH to dodge a loss is an old property of the game and not
 * this function's business. An attack you have been told is coming is
 * different: ducking it would beat both of the answers on offer.
 */
export function claimLiveDefense(town: TownState): PendingDefense | null {
  const pending = town.pendingDefense;
  if (!pending) return null;
  town.pendingDefense = { ...pending, expiresAt: pending.at };
  return pending;
}

/**
 * Hand it to the garrison instead. It resolves exactly as it would have if the
 * player had never been offered it — no penalty for declining, because a
 * player who cannot play right now is not doing anything wrong.
 */
export function declineLiveDefense(town: TownState, now: number): DefenseLogEntry | null {
  const pending = town.pendingDefense;
  if (!pending) return null;
  // Deleted outright rather than committed: declining IS an answer, and the
  // probe resolves on the next line. Only accepting leaves the attack on the
  // board, because only accepting can be walked out on.
  delete town.pendingDefense;
  return resolveProbe(town, pending.level, pending.seed, pending.at, now);
}

export function runOfflineProbes(town: TownState, now: number): DefenseLogEntry[] {
  const ran: DefenseLogEntry[] = [];
  // A march on the capital whose window shut while nobody answered is the
  // garrison's to fight (M25 Phase 4c), before the probes: it came first.
  if (resolveLapsedLastStand(town, now)) ran.push(town.defenseLog[0]!);
  // An offer the player walked away from is still an attack. It lands, at the
  // full cost of a probe nobody was there for.
  const pending = town.pendingDefense;
  if (pending && now >= pending.expiresAt) {
    delete town.pendingDefense;
    ran.push(resolveProbe(town, pending.level, pending.seed, pending.at, now));
  }

  const away = now - town.lastSeen;
  if (now < town.shieldUntil || away < PROBE_INTERVAL_MS) return ran;
  const count = Math.min(PROBE_MAX, Math.floor(away / PROBE_INTERVAL_MS));
  const level = probeLevel(town);

  // The LAST probe of an absence is held back and OFFERED rather than
  // resolved (M23 Phase 4). Everything before it already happened while
  // nobody was watching; this one has not happened yet.
  const offering = town.pendingDefense === undefined;
  const resolveCount = offering ? count - 1 : count;
  for (let i = 0; i < resolveCount; i++) {
    const entry = resolveProbe(
      town,
      level,
      probeSeedAt(town.lastSeen, i),
      town.lastSeen + (i + 1) * PROBE_INTERVAL_MS,
      now,
    );
    ran.push(entry);
    // A breach raises the shield, and a raised shield ends the sweep — and
    // takes the offer with it: there is nothing left inbound to defend.
    if (!entry.held) return ran;
  }
  if (offering) {
    town.pendingDefense = {
      at: town.lastSeen + count * PROBE_INTERVAL_MS,
      level,
      seed: probeSeedAt(town.lastSeen, count - 1),
      expiresAt: now + DEFENSE_OFFER_MS,
    };
  }
  return ran;
}
