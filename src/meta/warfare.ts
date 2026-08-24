import { generateBase, lootFor, MAP_H, MAP_W, type GeneratedBase } from '../content/bases';
import type { Condition } from '../content/conditions';
import { FAILED_RAID } from '../content/leagues';
import { RAID_CATALOG } from '../content/catalog';
import {
  newSquadRecords,
  rankMult,
  recordRaid,
  SQUAD_SLOTS,
  type SquadRecord,
} from '../content/veterancy';
import { baseKitFor, defenseCatalogFor } from '../content/factions';
import { GARRISON_GUN_TRADE, garrisonEconomy, garrisonFor } from '../content/garrison';
import { TRAINABLE, type TrainMeta } from '../content/usaUnits';
import { Engine } from '../sim/engine';
import { TERRAIN_NONE, TERRAIN_VERSION } from '../sim/terrain';
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
import {
  awardStanding,
  clearAward,
  leagueOf,
  probeAward,
  scoutingBlocked,
} from './ladder';
import {
  probeConfig,
  researchEffects,
  warLog,
  type DefenseLogEntry,
  type TownState,
} from './town';
import { recordBattle } from './vault';
import { creditContracts } from './contracts';

/**
 * The offense layer (M4): raid planning, hands-off resolution, loot, Front
 * Line progression, and the offline probe raids that keep your own base
 * honest while you're away. Everything here is deterministic given the
 * inputs — a raid config replays to the identical battle.
 */

// ---- entry sectors ---------------------------------------------------------------

export type SectorId = 'N1' | 'N2' | 'E1' | 'E2' | 'S1' | 'S2' | 'W1' | 'W2';
export const SECTOR_IDS: SectorId[] = ['N1', 'N2', 'E1', 'E2', 'S1', 'S2', 'W1', 'W2'];

/** The doctrines a formation can be given, in picker order. Lives here rather
 * than in the scene because a stored plan read off disk has to be checked
 * against the same list the planner cycles. */
export const DOCTRINE_IDS: Doctrine[] = ['assault', 'hunt', 'raze'];

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
  /** Research multipliers for the raiding units. */
  mods?: AttackerMods;
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
  return {
    width: MAP_W,
    height: MAP_H,
    seed,
    ccOrigin: base.ccOrigin,
    ccLevel: base.ccLevel,
    spawnColumn: 0,
    // The target's own ground. A base carries its terrain seed, so a ladder
    // rung, a duel and a replay of either all fight the same sheet.
    terrainSeed: base.terrainSeed,
    terrainVersion: base.terrainSeed > 0 ? TERRAIN_VERSION : TERRAIN_NONE,
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
  loot: { supplies: number; fuel: number };
  destructionPct: number;
  /** Ordnance charges actually expended by the fire plan. */
  powersUsed: Record<string, number>;
  /** Reserves the base's garrison stood up while you were getting there (v1.20). */
  reserves: number;
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

  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < RAID_MAX_TICKS) {
    engine.step();
  }

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

  loot.supplies = Math.round(loot.supplies * payout.supplies);
  loot.fuel = Math.round(loot.fuel * payout.fuel);

  return {
    cleared: engine.phase === 'defeat', // the DEFENDER lost its command post
    ticks: engine.tick,
    deployed,
    squads: squadReturns.filter((r) => r.deployed > 0),
    survivors,
    losses,
    destroyed,
    loot,
    destructionPct: initialTotal > 0 ? destroyedTotal / initialTotal : 0,
    powersUsed,
    reserves: engine.ordersExecuted,
  };
}

/**
 * The town's three standing formations, created on demand. Every caller wants
 * SQUAD_SLOTS records back, so a file that predates veterancy gets them here
 * rather than making each reader check.
 */
export function squadRoster(town: TownState): SquadRecord[] {
  if (!Array.isArray(town.squads) || town.squads.length !== SQUAD_SLOTS) {
    town.squads = newSquadRecords();
  }
  return town.squads;
}

/** The multiplier a formation's units fight at right now. */
export function squadVet(town: TownState, slot: number): number {
  return rankMult(squadRoster(town)[slot]?.xp ?? 0);
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
  for (const ret of resolution.squads) {
    const record = roster[ret.slot];
    if (!record) continue;
    roster[ret.slot] = recordRaid(record, {
      deployed: ret.deployed,
      returned: ret.returned,
      tier: foughtTier,
      cleared: resolution.cleared,
    });
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
    fileRaid(town, base, resolution, config, now, 'duel');
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
  // The board moves either way (M7): a rung pays standing at today's rate, a
  // failed raid costs it. Both count as playing, so the decay grace resets.
  awardStanding(
    town,
    resolution.cleared ? clearAward(base.tier, now) : FAILED_RAID,
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
  // The faction decides the DEAL (v1.21): which of the eight shapes lands in
  // which of the rung's three slots. Every other path that generates a ladder
  // base has to pass it too, or it is looking at a different front line from
  // the one the player is.
  return generateBase(town.frontline.tier, variant, baseKitFor(town.faction), undefined, town.faction);
}

// ---- offline probe raids -----------------------------------------------------------------

export const PROBE_INTERVAL_MS = 3 * 3_600_000;
export const PROBE_SHIELD_MS = 12 * 3_600_000;
export const PROBE_MAX = 3;
export const DEFENSE_LOG_CAP = 4;
/** Supplies billed per standing-order action the garrison executes. */
export const ORDERS_UPKEEP_SUPPLIES = 15;

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
    // The defense log keeps four entries; the record keeps the count, because
    // the war fought while nobody was watching is most of the war.
    const log = warLog(town);
    if (held) log.probesHeld++;
    else log.probesBreached++;
    if (held) creditContracts(town, 'probesHeld', 1, entry.at);
    // The defense log keeps four; the vault keeps ten, and keeps them as
    // codes — so the probe that got through is still watchable next week.
    recordBattle(town, {
      kind: 'probe',
      faction: town.faction,
      title: `PROBE — LEVEL ${level}`,
      won: held,
      at: entry.at,
      detail: held
        ? `held · ${suppliesLost} SUP lost`
        : `BREACHED · ${engine.stats.ccKillerKind ?? 'command post lost'}`,
      config,
    });
    // A garrison holding the wire keeps you on the board; a breach is read as
    // exactly what it is. Neither counts as the commander playing, so this
    // buys no quiet time against the decay clock.
    awardStanding(town, probeAward(held), entry.at, false);

    if (!held) {
      town.shieldUntil = now + PROBE_SHIELD_MS;
      break;
    }
  }

  town.defenseLog.length = Math.min(town.defenseLog.length, DEFENSE_LOG_CAP);
  return ran;
}
