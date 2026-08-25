import { Grid } from './grid';
import { fnv1a } from './hash';
import { findPath, type PathGrid } from './pathfinding';
import { createRng, rollRange, type Rng } from './rng';
import { COMBAT_NONE, combatModelFor, type CombatModel } from './combat';
import {
  FLAT_TERRAIN,
  MIN_MOVE_COST,
  RANGE_PER_BAND,
  generateTerrain,
  TERRAIN_NONE,
  type TerrainField,
} from './terrain';
import type {
  AttackerProfile,
  AutoPowerRule,
  Catalog,
  CellIndex,
  Command,
  DamageType,
  Doctrine,
  Phase,
  SimConfig,
  SimEvent,
  SimStats,
  StandingOrderTarget,
  StructureProfile,
  TargetLayer,
  Weapon,
  Vec2,
  WaveEntry,
} from './types';

export const TICKS_PER_SECOND = 20;
export const DT = 1 / TICKS_PER_SECOND;
/** How close a flyer gets to its target's edge before working it over. */
const AIR_STANDOFF = 0.6;

/**
 * Cells the terrain generator must leave dry.
 *
 * Everything already committed to the board before the ground exists: the
 * command centre, the persistent town layout, and the tunnel mouths a raid
 * plan has already sited. Water on any of these either drowns something the
 * player built or strands a squad that was promised a way in.
 */
function occupiedCellsOf(config: SimConfig, catalog: Catalog): CellIndex[] {
  const w = config.width;
  const out: CellIndex[] = [];
  const footprint = (origin: CellIndex, size: number): void => {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) out.push(origin + dy * w + dx);
    }
  };

  footprint(config.ccOrigin, 2);
  for (const wall of config.layout?.walls ?? []) out.push(wall.cell);
  for (const structure of config.layout?.structures ?? []) {
    footprint(structure.cell, catalog.structures[structure.kind]?.footprint ?? 1);
  }
  for (const cell of config.reservedCells ?? []) out.push(cell);
  return out;
}

/**
 * Which layer a weapon engages when its profile does not say (v1.0).
 *
 * A gun on a mount can elevate, so the default is both layers — a line with
 * no dedicated flak is not helpless, just bad at it, which is what the `air`
 * column of the damage table prices. Two kinds of weapon never look up:
 * lobbed ordnance, which lands on the ground by definition, and wire-guided
 * shaped charges, which cannot track something moving through the sky.
 */
function layerOf(weapon: Weapon): TargetLayer {
  if (weapon.targets) return weapon.targets;
  if (weapon.flightSeconds !== undefined || weapon.damageType === 'shaped') return 'ground';
  return 'both';
}

/** Omit that distributes over union types (plain Omit collapses the union). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface Attacker {
  id: number;
  profile: AttackerProfile;
  hp: number;
  /** Max HP after attacker-side mods (profile.maxHp × research). */
  maxHp: number;
  /** Speed after the seeded jitter roll at spawn. */
  speed: number;
  pos: Vec2;
  /** Position at the previous tick, for render interpolation. */
  prevPos: Vec2;
  /** Unit direction of travel last tick (zero while stationary) — mortar lead. */
  lastDir: Vec2;
  /** Behavior program: what this unit walks toward and melees. */
  doctrine: Doctrine;
  /** Raid squad that sent it, or -1. Read by the resolution, not the sim. */
  squad: number;
  /** Damage multiplier: config-wide attacker mods × this squad's veterancy. */
  damageMult: number;
  /** Current doctrine target (a structure id; the CC by default). */
  targetId: number;
  /** Perimeter cells of the current target — the path goals. */
  goalCells: CellIndex[];
  path: CellIndex[] | null;
  pathIndex: number;
  pathVersion: number;
  state: 'moving' | 'breaking' | 'engaging' | 'assaulting' | 'stuck';
  weaponCooldown: number;
}

export interface Structure {
  id: number;
  profile: StructureProfile;
  origin: CellIndex;
  cells: CellIndex[];
  center: Vec2;
  hp: number;
  level: number;
  /** Still under construction: an obstacle, but fires nothing. */
  inert: boolean;
  weaponCooldown: number;
}

export interface Projectile {
  id: number;
  from: Vec2;
  to: Vec2;
  firedTick: number;
  impactTick: number;
  damage: number;
  damageType: DamageType;
  splashRadius: number;
}

type ImpactShape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x0: number; x1: number; y0: number; y1: number };

interface PendingImpact {
  tick: number;
  shape: ImpactShape;
  damage: number;
  damageType: DamageType;
}

/**
 * The deterministic fixed-tick battle engine.
 *
 * All inputs are Commands stamped with the tick they apply on; the engine
 * consumes them in FIFO order at tick boundaries. Same config + catalog +
 * command sequence ⇒ identical state (see stateHash), which is what makes
 * replays, offline raid resolution, and the balance harness possible.
 *
 * Two modes:
 * - siege (config.siege set): setup → waves of combat with prep windows →
 *   victory/defeat, with the Supplies/CP economy enforced in-sim.
 * - sandbox (no siege): free placement and manual spawns, for the dev
 *   playground and tests.
 *
 * Determinism rules honored here:
 * - all randomness via the seeded PRNG (spawn jitter, barrage scatter)
 * - entities update in spawn/placement order; targeting ties break on id
 * - no Math.hypot (engine-dependent precision) — sqrt of a dot product only
 */
export class Engine {
  readonly config: SimConfig;
  readonly catalog: Catalog;
  readonly grid: Grid;
  readonly attackers: Attacker[] = [];
  readonly structures: Structure[] = [];
  readonly projectiles: Projectile[] = [];
  readonly stats: SimStats = {
    spawned: 0,
    kills: 0,
    wallsBuilt: 0,
    wallsLost: 0,
    structuresLost: 0,
    suppliesSpent: 0,
    cpSpent: 0,
    salvage: 0,
  };

  tick = 0;
  phase: Phase;
  /** Index of the current (combat) or just-cleared (prep) wave; -1 pre-assault. */
  waveIndex = -1;
  waveTick = 0;
  prepTicksLeft = 0;
  supplies = 0;
  cp = 0;

  readonly cc: Structure;
  readonly goalCells: CellIndex[];

  private readonly rng: Rng;
  /**
   * Combat rolls draw from their OWN stream, for the same reason terrain does:
   * the engine's `rng` is one sequence consumed in tick order, so a new draw
   * site inside it would shift every later roll and re-fight every archived
   * battle differently.
   */
  private readonly combatRng: Rng;
  private readonly combat: CombatModel;
  private nextId = 1;
  private queue: Command[] = [];
  private spawnCursor = 0;
  private readonly waves: WaveEntry[][];
  private readonly structureAtCell = new Map<CellIndex, Structure>();
  private readonly pendingImpacts: PendingImpact[] = [];
  private readonly powerCooldowns = new Map<string, number>();
  private readonly chargesLeft: Map<string, number> | null;
  /** Structures with id below this came from the town layout — not removable. */
  private layoutWatermark = 0;
  private readonly pathView: PathGrid;
  /** The ground. Immutable for the life of the battle — terrain does not
   *  burn, flood or crater, which is what lets the state hash ignore it. */
  readonly terrain: TerrainField;
  /** Research multipliers, resolved once (identity when absent). */
  private readonly defWeaponMult: number;
  private readonly defWallHpMult: number;
  private readonly defCpMult: number;
  private readonly atkHpMult: number;
  private readonly atkDamageMult: number;
  /** Pre-planned fire missions, sorted by time then kind (deterministic). */
  private readonly autoRules: AutoPowerRule[];
  private autoRuleCursor = 0;
  /** Standing orders: per-rule next-allowed tick + the latest wall breach. */
  private orderNextTick: number[] = [];
  private ordersUsed = 0;
  private lastBreachCell: CellIndex | null = null;

  /** How many standing-order actions the garrison executed this battle. */
  get ordersExecuted(): number {
    return this.ordersUsed;
  }

  /**
   * What the watch has done and what it is saving for (v1.20), or null when
   * nobody is holding this base by policy.
   *
   * The HUD's one honest read on why being slow is expensive: `cp` climbing
   * towards `nextAt` is the reserve the post has not stood up YET, and the
   * whole point of arriving early is arriving before that number is reached.
   */
  garrisonReadiness(): {
    committed: number;
    ceiling: number;
    cp: number;
    nextAt: number | null;
  } | null {
    const orders = this.attackerSide ? this.config.garrison : this.config.standingOrders;
    if (!orders) return null;
    const ceiling = orders.maxActions ?? orders.rules.length;
    // The cheapest order still on the table — what the pool is filling towards.
    let nextAt: number | null = null;
    if (this.ordersUsed < ceiling) {
      for (const rule of orders.rules) {
        if (this.cp >= rule.cpAtLeast) continue;
        if (nextAt === null || rule.cpAtLeast < nextAt) nextAt = rule.cpAtLeast;
      }
    }
    return { committed: this.ordersUsed, ceiling, cp: this.cp, nextAt };
  }

  constructor(config: SimConfig, catalog: Catalog) {
    this.config = config;
    this.catalog = catalog;
    this.grid = new Grid(config.width, config.height);
    this.rng = createRng(config.seed);
    this.combat = combatModelFor(config.combatVersion);
    this.combatRng = createRng((config.combatSeed ?? config.seed ^ 0x9e3779b9) >>> 0);
    // Terrain draws from its OWN stream. Sharing `this.rng` would shift every
    // later roll and re-fight every archived battle on different ground.
    this.terrain =
      (config.terrainVersion ?? TERRAIN_NONE) === TERRAIN_NONE
        ? FLAT_TERRAIN
        : generateTerrain(
            config.terrainSeed ?? config.seed,
            config.terrainVersion!,
            config.width,
            config.height,
            occupiedCellsOf(config, catalog),
            config.spawnColumn,
          );
    this.phase = config.siege ? 'setup' : 'sandbox';
    this.supplies = config.siege?.startingSupplies ?? 0;
    this.cp = config.siege?.startingCp ?? 0;
    this.waves = (config.siege?.waves ?? []).map((w) =>
      [...w.entries].sort((a, b) => a.atTick - b.atTick),
    );
    this.chargesLeft = config.powerCharges
      ? new Map(Object.entries(config.powerCharges))
      : null;
    this.defWeaponMult = config.mods?.defender?.weaponDamage ?? 1;
    this.defWallHpMult = config.mods?.defender?.wallHp ?? 1;
    this.defCpMult = config.mods?.defender?.cpCost ?? 1;
    this.atkHpMult = config.mods?.attacker?.hp ?? 1;
    this.atkDamageMult = config.mods?.attacker?.damage ?? 1;
    this.autoRules = [...(config.autoPowers ?? [])].sort(
      (a, b) => a.atSeconds - b.atSeconds || (a.kind < b.kind ? -1 : 1),
    );

    // Plant the Command Center: 2×2, hard-blocked, the thing everyone dies for.
    // Water is a blocker, which is what makes it unbuildable and keeps
    // findSpawnCell off it. Pathfinding learns about it separately, through
    // pathView.moveCostAt — the two are different questions.
    if (this.terrain.version !== TERRAIN_NONE) {
      const cells = config.width * config.height;
      for (let cell = 0; cell < cells; cell++) {
        if (!this.terrain.passable(cell)) this.grid.addBlocker(cell);
      }
    }

    const cc = this.createStructure(config.ccOrigin, 'cc', config.ccLevel ?? 1, 1, false, true);
    if (!cc) throw new Error('invalid Command Center placement or missing cc profile');
    this.cc = cc;
    for (const cell of cc.cells) this.grid.addBlocker(cell);

    // Assault goals: the CC's orthogonal perimeter (deduped, sorted — deterministic).
    const goals = new Set<CellIndex>();
    const scratch: CellIndex[] = [0, 0, 0, 0];
    for (const cell of cc.cells) {
      const n = this.grid.neighbors4(cell, scratch);
      for (let i = 0; i < n; i++) {
        const c = scratch[i]!;
        if (!cc.cells.includes(c)) goals.add(c);
      }
    }
    this.goalCells = [...goals].sort((a, b) => a - b);

    // Pathfinding sees walls AND blocking structures as breakable obstacles.
    this.pathView = {
      width: config.width,
      height: config.height,
      neighbors4: (cell, out) => this.grid.neighbors4(cell, out),
      obstacleHpAt: (cell) => {
        const wall = this.grid.wallAt(cell);
        if (wall && wall.open !== true) return wall.hp;
        const s = this.structureAtCell.get(cell);
        if (s && s.profile.blocks && s.hp > 0) {
          return s.profile.kind === 'cc' ? Infinity : s.hp;
        }
        return 0;
      },
      // Terrain has to be wired HERE, not only into Grid: the engine never
      // calls Grid.obstacleHpAt, so ground added there alone would pass its
      // unit tests and be invisible in every real battle.
      moveCostAt: (cell) => this.terrain.moveCost(cell),
      minMoveCost: this.terrain.version === TERRAIN_NONE ? 1 : MIN_MOVE_COST,
    };

    // Inject the persistent town layout, free of charge, before anything moves.
    // Reserved cells don't apply here: what the town built already stands.
    if (config.layout) {
      for (const wall of config.layout.walls) {
        const def = catalog.walls[wall.kind];
        if (def && this.isBuildable(wall.cell, true)) {
          this.grid.placeWall(wall.cell, def.hp * this.defWallHpMult, def.kind);
        }
      }
      for (const s of config.layout.structures) {
        this.createStructure(s.cell, s.kind, s.level ?? 1, s.hpFraction ?? 1, s.inert ?? false, true);
      }
    }
    this.layoutWatermark = this.nextId;
  }

  /** Base profile merged with its per-level overrides (level 2 = levels[0]). */
  resolveProfile(kind: string, level: number): StructureProfile | undefined {
    const base = this.catalog.structures[kind];
    if (!base || level <= 1 || !base.levels || base.levels.length === 0) return base;
    const override = base.levels[Math.min(level - 2, base.levels.length - 1)];
    return override ? { ...base, ...override } : base;
  }

  private footprintCells(origin: CellIndex, footprint: 1 | 2): CellIndex[] | null {
    if (footprint === 1) return [origin];
    const x = this.grid.xOf(origin);
    const y = this.grid.yOf(origin);
    if (x >= this.grid.width - 1 || y >= this.grid.height - 1) return null;
    const w = this.grid.width;
    return [origin, origin + 1, origin + w, origin + w + 1];
  }

  private createStructure(
    origin: CellIndex,
    kind: string,
    level: number,
    hpFraction: number,
    inert: boolean,
    ignoreReserved = false,
  ): Structure | null {
    const profile = this.resolveProfile(kind, level);
    if (!profile) return null;
    const cells = this.footprintCells(origin, profile.footprint);
    if (!cells || !cells.every((c) => this.isBuildable(c, ignoreReserved))) return null;
    const center =
      profile.footprint === 2
        ? { x: this.grid.xOf(origin) + 1, y: this.grid.yOf(origin) + 1 }
        : this.grid.centerOf(origin);
    const structure: Structure = {
      id: this.nextId++,
      profile,
      origin,
      cells,
      center,
      hp: profile.maxHp * hpFraction,
      level,
      inert,
      weaponCooldown: 0,
    };
    this.structures.push(structure);
    for (const cell of cells) this.structureAtCell.set(cell, structure);
    if (profile.blocks) this.grid.version++;
    return structure;
  }

  // ---- input ------------------------------------------------------------------

  /** Queue a command; it applies at the start of the tick it is stamped with. */
  enqueue(command: Command): void {
    this.queue.push(command);
  }

  /** Convenience for live play: stamp with the current tick and queue. */
  command(command: DistributiveOmit<Command, 'tick'> & { tick?: number }): void {
    this.enqueue({ ...command, tick: command.tick ?? this.tick } as Command);
  }

  // ---- main loop -----------------------------------------------------------------

  /** Advance one fixed tick. Returns the events produced by this tick. */
  step(): SimEvent[] {
    const events: SimEvent[] = [];
    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.tick++;
      return events;
    }
    this.applyCommands(events);
    this.updatePhase(events);
    this.applyAutoPowers(events);
    this.applyStandingOrders(events);
    this.applyPendingImpacts(events);
    this.updateStructures(events);
    this.applyAuras();
    this.updateProjectiles(events);
    this.removeDeadAttackers(events);
    this.updateAttackers(events);
    this.processStructureDeaths(events);
    this.tick++;
    return events;
  }

  /** Run n ticks headlessly (offline raids, tests, fast-forward). */
  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  // ---- phase machine ---------------------------------------------------------------

  private get siege() {
    return this.config.siege;
  }

  private updatePhase(events: SimEvent[]): void {
    for (const [kind, ticks] of this.powerCooldowns) {
      if (ticks > 0) this.powerCooldowns.set(kind, ticks - 1);
    }

    const siege = this.siege;
    if (!siege || this.phase === 'setup' || this.phase === 'sandbox') return;

    if (this.phase === 'combat') {
      this.cp = Math.min(siege.cpCap, this.cp + siege.cpPerSecond * DT);

      const wave = this.waves[this.waveIndex]!;
      while (this.spawnCursor < wave.length && wave[this.spawnCursor]!.atTick <= this.waveTick) {
        const entry = wave[this.spawnCursor++]!;
        const column = entry.col ?? this.config.spawnColumn;
        this.spawnAttackerAt(
          this.grid.idx(column, entry.row),
          entry.kind,
          events,
          entry.doctrine,
          entry.squad ?? -1,
          entry.vet ?? 1,
        );
      }
      this.waveTick++;

      const waveDone =
        this.spawnCursor >= wave.length &&
        this.attackers.length === 0 &&
        this.projectiles.length === 0;
      if (waveDone) {
        this.supplies += siege.suppliesPerWave;
        if (this.waveIndex >= this.waves.length - 1) {
          // Unspent CP converts to salvaged Supplies — hoarding was a choice.
          this.stats.salvage = Math.floor(this.cp * 2);
          this.supplies += this.stats.salvage;
          this.cp = 0;
          this.phase = 'victory';
          events.push({ type: 'victory' });
        } else {
          this.phase = 'prep';
          this.prepTicksLeft = Math.round(siege.prepSeconds * TICKS_PER_SECOND);
          events.push({ type: 'prepStarted', index: this.waveIndex + 1 });
        }
      }
    } else if (this.phase === 'prep') {
      this.prepTicksLeft--;
      if (this.prepTicksLeft <= 0) this.startWave(this.waveIndex + 1, events);
    }
  }

  private startWave(index: number, events: SimEvent[]): void {
    this.waveIndex = index;
    this.waveTick = 0;
    this.spawnCursor = 0;
    this.phase = 'combat';
    events.push({ type: 'waveStarted', index });
  }

  /** The requested cell, or the nearest open neighbor (tunnel mouths can be
   *  walled over) — deterministic search order, null if the area is bricked. */
  private findSpawnCell(cell: CellIndex): CellIndex | null {
    const open = (c: CellIndex) =>
      this.grid.inBounds(c) &&
      this.grid.isOpen(c) &&
      !this.structureAtCell.get(c)?.profile.blocks;
    if (open(cell)) return cell;
    const w = this.grid.width;
    const x = this.grid.xOf(cell);
    const y = this.grid.yOf(cell);
    const candidates = [
      [0, -1], [1, 0], [0, 1], [-1, 0],
      [1, -1], [1, 1], [-1, 1], [-1, -1],
    ];
    for (const [dx, dy] of candidates) {
      const nx = x + dx!;
      const ny = y + dy!;
      if (nx < 0 || nx >= w || ny < 0 || ny >= this.grid.height) continue;
      const c = ny * w + nx;
      if (open(c)) return c;
    }
    return null;
  }

  private spawnAttackerAt(
    cell: CellIndex,
    kind: string,
    events: SimEvent[],
    doctrine: Doctrine = 'assault',
    squad = -1,
    vet = 1,
  ): boolean {
    const profile = this.catalog.attackers[kind];
    if (!profile || !this.grid.inBounds(cell)) return false;
    const spawnCell = this.findSpawnCell(cell);
    if (spawnCell === null) return false;
    cell = spawnCell;
    const jitter = profile.speedJitter;
    const speed = profile.speed * (1 + rollRange(this.rng, -jitter, jitter));
    const pos = this.grid.centerOf(cell);
    const maxHp = profile.maxHp * this.atkHpMult * vet;
    const attacker: Attacker = {
      id: this.nextId++,
      profile,
      hp: maxHp,
      maxHp,
      speed,
      pos,
      prevPos: { ...pos },
      lastDir: { x: 0, y: 0 },
      doctrine,
      squad,
      damageMult: this.atkDamageMult * vet,
      targetId: -1, // resolved by doctrine on the first update
      goalCells: this.goalCells,
      path: null,
      pathIndex: 0,
      pathVersion: -1,
      state: 'moving',
      weaponCooldown: 0,
    };
    this.attackers.push(attacker);
    this.stats.spawned++;
    events.push({ type: 'attackerSpawned', id: attacker.id });
    return true;
  }

  // ---- commands ---------------------------------------------------------------------

  private applyCommands(events: SimEvent[]): void {
    const pending: Command[] = [];
    for (const cmd of this.queue) {
      if (cmd.tick > this.tick) {
        pending.push(cmd);
        continue;
      }
      this.applyCommand(cmd, events);
    }
    this.queue = pending;
  }

  private get canBuildPermanent(): boolean {
    return this.phase === 'setup' || this.phase === 'prep' || this.phase === 'sandbox';
  }

  private get canBuildField(): boolean {
    return this.phase === 'combat' || this.phase === 'sandbox';
  }

  /** CP price after the defender's research discount. */
  /** Is any ground attacker standing in this cell right now? */
  private attackerInCell(cell: CellIndex): boolean {
    for (const a of this.attackers) {
      if (a.profile.air || a.hp <= 0) continue;
      if (this.grid.cellAt(a.pos) === cell) return true;
    }
    return false;
  }

  cpPrice(cpCost: number): number {
    return Math.ceil(cpCost * this.defCpMult);
  }

  /** Checks phase gate + price for an item priced in Supplies or CP. */
  private affords(cost: { supplyCost?: number; cpCost?: number }): boolean {
    if (this.phase === 'sandbox') return true;
    if (cost.supplyCost !== undefined) {
      return this.canBuildPermanent && this.supplies >= cost.supplyCost;
    }
    if (cost.cpCost !== undefined) {
      return this.canBuildField && this.cp >= this.cpPrice(cost.cpCost);
    }
    return false;
  }

  private pay(cost: { supplyCost?: number; cpCost?: number }): void {
    if (this.phase === 'sandbox') return;
    if (cost.supplyCost !== undefined) {
      this.supplies -= cost.supplyCost;
      this.stats.suppliesSpent += cost.supplyCost;
    } else if (cost.cpCost !== undefined) {
      const price = this.cpPrice(cost.cpCost);
      this.cp -= price;
      this.stats.cpSpent += price;
    }
  }

  private applyCommand(cmd: Command, events: SimEvent[]): boolean {
    switch (cmd.type) {
      case 'placeWall': {
        if (!this.canPlaceWall(cmd.kind, cmd.cell)) return false;
        const def = this.catalog.walls[cmd.kind]!;
        this.grid.placeWall(cmd.cell, def.hp * this.defWallHpMult, def.kind);
        this.pay(def);
        this.stats.wallsBuilt++;
        return true;
      }
      case 'removeWall': {
        const wall = this.grid.wallAt(cmd.cell);
        if (!wall || !this.canBuildPermanent) return false;
        const def = this.catalog.walls[wall.kind];
        if (this.phase !== 'sandbox' && def?.supplyCost !== undefined) {
          this.supplies += Math.floor(def.supplyCost * (wall.hp / wall.maxHp));
        }
        this.grid.removeWall(cmd.cell);
        return true;
      }
      case 'placeStructure': {
        if (!this.canPlaceStructure(cmd.kind, cmd.cell)) return false;
        const structure = this.createStructure(cmd.cell, cmd.kind, cmd.level ?? 1, 1, false);
        if (!structure) return false;
        this.pay(this.catalog.structures[cmd.kind]!);
        return true;
      }
      case 'removeStructure': {
        if (this.phase !== 'setup' && this.phase !== 'sandbox') return false;
        const s = this.structureAtCell.get(cmd.cell);
        // Town-layout structures (and the CC) can't be sold off mid-siege.
        if (!s || s.profile.kind === 'cc' || s.id < this.layoutWatermark) return false;
        if (this.phase === 'setup' && s.profile.supplyCost !== undefined) {
          this.supplies += s.profile.supplyCost;
        }
        this.dropStructure(s);
        return true;
      }
      case 'spawnAttacker': {
        if (this.phase !== 'sandbox') return false;
        return this.spawnAttackerAt(cmd.cell, cmd.kind, events, cmd.doctrine);
      }
      case 'startAssault': {
        if (this.phase !== 'setup' || !this.siege) return false;
        events.push({ type: 'assaultStarted' });
        this.startWave(0, events);
        return true;
      }
      case 'skipPrep': {
        if (this.phase !== 'prep') return false;
        this.prepTicksLeft = 0;
        return true;
      }
      case 'repairAll': {
        if ((this.phase !== 'setup' && this.phase !== 'prep') || !this.siege) return false;
        const cost = this.repairAllCost();
        if (cost <= 0 || this.supplies < cost) return false;
        for (const wall of this.grid.walls.values()) wall.hp = wall.maxHp;
        for (const s of this.structures) s.hp = s.profile.maxHp;
        this.supplies -= cost;
        this.stats.suppliesSpent += cost;
        return true;
      }
      case 'toggleGate': {
        const wall = this.grid.wallAt(cmd.cell);
        const def = wall ? this.catalog.walls[wall.kind] : undefined;
        if (!wall || def?.gateCpCost === undefined) return false;
        if (!this.affords({ cpCost: def.gateCpCost })) return false;
        const opening = wall.open !== true;
        // A gate cannot close on somebody standing in it. That constraint is
        // what makes opening one a commitment rather than a free look: the way
        // out stays open as long as anyone is using it.
        if (!opening && this.attackerInCell(cmd.cell)) return false;
        if (!this.grid.setWallOpen(cmd.cell, opening)) return false;
        this.pay({ cpCost: def.gateCpCost });
        events.push({ type: 'gateToggled', cell: cmd.cell, open: opening });
        return true;
      }
      case 'castPower': {
        return this.castPowerAt(cmd.kind, cmd.target, events);
      }
    }
  }

  /** The player attacks in raids; powers then strike structures, not units. */
  private get attackerSide(): boolean {
    return this.config.playerSide === 'attacker';
  }

  private castPowerAt(kind: string, target: Vec2, events: SimEvent[]): boolean {
    if (!this.canCastPower(kind)) return false;
    const def = this.catalog.powers[kind]!;
    // Raid-side ordnance is pre-paid stock (charges), not a CP purchase.
    if (this.phase !== 'sandbox' && !this.attackerSide) {
      const price = this.cpPrice(def.cpCost);
      this.cp -= price;
      this.stats.cpSpent += price;
    }
    if (this.chargesLeft) {
      this.chargesLeft.set(def.kind, (this.chargesLeft.get(def.kind) ?? 0) - 1);
    }
    this.powerCooldowns.set(def.kind, Math.round(def.cooldownSeconds * TICKS_PER_SECOND));
    this.schedulePower(def.kind, target);
    events.push({ type: 'powerCast', kind: def.kind, at: { ...target } });
    return true;
  }

  /** Auto-rule target: the armed structure with the most armed neighbors. */
  private densestGunCluster(): Vec2 {
    let best: Structure | null = null;
    let bestCount = -1;
    for (const s of this.structures) {
      if (s.hp <= 0 || !this.isDefenseStructure(s)) continue;
      let count = 0;
      for (const other of this.structures) {
        if (other.hp <= 0 || !this.isDefenseStructure(other)) continue;
        const dx = other.center.x - s.center.x;
        const dy = other.center.y - s.center.y;
        if (dx * dx + dy * dy <= 9) count++; // within 3 cells, itself included
      }
      if (count > bestCount || (count === bestCount && s.id < best!.id)) {
        bestCount = count;
        best = s;
      }
    }
    return best ? { ...best.center } : { ...this.cc.center };
  }

  /** Fire any pre-planned missions whose time has come (assault clock). */
  private applyAutoPowers(events: SimEvent[]): void {
    if (this.phase !== 'combat') return;
    while (this.autoRuleCursor < this.autoRules.length) {
      const rule = this.autoRules[this.autoRuleCursor]!;
      if (rule.atSeconds * TICKS_PER_SECOND > this.waveTick) break;
      this.autoRuleCursor++;
      const target =
        rule.target === 'guns' ? this.densestGunCluster() : { ...this.cc.center };
      this.castPowerAt(rule.kind, target, events);
    }
  }

  // ---- standing orders (v0.8): the unattended defender's CP policy ---------------

  /** The attacker with the most nearby attackers — where the fight is. */
  private densestAttackerCluster(): Vec2 | null {
    let best: Attacker | null = null;
    let bestCount = -1;
    for (const attacker of this.attackers) {
      if (attacker.hp <= 0) continue;
      let count = 0;
      for (const other of this.attackers) {
        if (other.hp <= 0) continue;
        const dx = other.pos.x - attacker.pos.x;
        const dy = other.pos.y - attacker.pos.y;
        if (dx * dx + dy * dy <= 9) count++; // within 3 cells, itself included
      }
      if (count > bestCount || (count === bestCount && attacker.id < best!.id)) {
        bestCount = count;
        best = attacker;
      }
    }
    return best ? { ...best.pos } : null;
  }

  /** Deterministic search ring: anchor first, then outward, fixed order. */
  private static readonly ORDER_OFFSETS: [number, number][] = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1],
    [2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, -1], [1, 2], [-1, -2],
  ];

  private orderDeployCell(target: StandingOrderTarget, kind: string): CellIndex | null {
    let anchor: Vec2 | null = null;
    if (target === 'breach') {
      anchor = this.lastBreachCell !== null ? this.grid.centerOf(this.lastBreachCell) : null;
    } else if (target === 'densest') {
      anchor = this.densestAttackerCluster();
    } else {
      // ccApproach: between the post and the fight, three cells out.
      const threat = this.densestAttackerCluster();
      if (threat) {
        const dx = threat.x - this.cc.center.x;
        const dy = threat.y - this.cc.center.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        anchor =
          len > 0.001
            ? { x: this.cc.center.x + (dx / len) * 3, y: this.cc.center.y + (dy / len) * 3 }
            : null;
      }
    }
    if (!anchor) return null;
    const ax = Math.floor(anchor.x);
    const ay = Math.floor(anchor.y);
    for (const [dc, dr] of Engine.ORDER_OFFSETS) {
      // The duty officer reinforces AROUND a breach; corking the hole
      // itself is a live commander's move, not a standing order.
      if (target === 'breach' && dc === 0 && dr === 0) continue;
      const x = ax + dc;
      const y = ay + dr;
      if (x < 0 || y < 0 || x >= this.grid.width || y >= this.grid.height) continue;
      const cell = this.grid.idx(x, y);
      if (this.canPlaceStructure(kind, cell)) return cell;
    }
    return null;
  }

  /**
   * Standing orders: evaluated every combat tick in rule order for whichever
   * side the AI is holding. Each rule holds a CP reserve, a hostile threshold,
   * and its own cooldown; deploys and casts go through the same commands a
   * player would issue, so prices, limits, and buildability all apply.
   *
   * The garrison is DEPLOY-ONLY, and that is a correctness rule rather than a
   * taste one: `resolvePowers` reads `attackerSide` to decide whether an
   * impact lands on units or on structures, so a fire mission called during a
   * raid would shell the garrison's own base. Fire support stays the
   * attacker's instrument; the garrison answers by standing guns up.
   */
  private applyStandingOrders(events: SimEvent[]): void {
    // Whichever side the AI is holding: the player's doctrine when they
    // defend, the garrison's when they raid. Never both in one battle.
    const garrison = this.attackerSide;
    const orders = garrison ? this.config.garrison : this.config.standingOrders;
    if (!orders || this.phase !== 'combat') return;
    // The duty officer works a 1-second command cycle, not the sim tick,
    // and the playbook has only so many pages per battle.
    if (this.tick % TICKS_PER_SECOND !== 0) return;
    if (orders.maxActions !== undefined && this.ordersUsed >= orders.maxActions) return;
    for (let i = 0; i < orders.rules.length; i++) {
      const rule = orders.rules[i]!;
      if (this.tick < (this.orderNextTick[i] ?? 0)) continue;
      if (this.cp < rule.cpAtLeast) continue;
      let hostiles = 0;
      for (const a of this.attackers) {
        if (a.hp <= 0) continue;
        // A rule can ask what it would be shooting at (v1.21).
        if (rule.hostiles === 'air' && a.profile.air !== true) continue;
        if (rule.hostiles === 'ground' && a.profile.air === true) continue;
        hostiles++;
      }
      if (hostiles < (rule.minHostiles ?? 1)) continue;

      let acted = false;
      if (rule.action === 'power' && garrison) {
        continue; // see the deploy-only note above — this would shell its own base
      } else if (rule.action === 'power') {
        const target =
          rule.target === 'ccApproach'
            ? { ...this.cc.center }
            : rule.target === 'breach' && this.lastBreachCell !== null
              ? this.grid.centerOf(this.lastBreachCell)
              : this.densestAttackerCluster();
        if (target) acted = this.castPowerAt(rule.kind, target, events);
      } else {
        const cell = this.orderDeployCell(rule.target, rule.kind);
        if (cell !== null) {
          acted = this.applyCommand(
            { tick: this.tick, type: 'placeStructure', cell, kind: rule.kind },
            events,
          );
          // Announced only for the garrison: a defending player watched
          // themselves issue the order and does not need telling.
          if (acted && garrison) {
            events.push({
              type: 'garrisonDeployed',
              kind: rule.kind,
              at: this.grid.centerOf(cell),
              committed: this.ordersUsed + 1,
              ceiling: orders.maxActions ?? orders.rules.length,
            });
          }
        }
      }
      if (acted) {
        this.orderNextTick[i] = this.tick + rule.cooldownTicks;
        this.ordersUsed++;
        if (orders.maxActions !== undefined && this.ordersUsed >= orders.maxActions) return;
      }
    }
  }

  private schedulePower(kind: string, target: Vec2): void {
    const def = this.catalog.powers[kind]!;
    if (def.type === 'strafe') {
      const x0 = target.x - def.halfLength;
      const segment = (def.halfLength * 2) / def.pulses;
      for (let i = 0; i < def.pulses; i++) {
        this.pendingImpacts.push({
          tick: this.tick + def.delayTicks + i * def.pulseSpacingTicks,
          shape: {
            kind: 'rect',
            x0: x0 + i * segment,
            x1: x0 + (i + 1) * segment,
            y0: target.y - def.halfWidth,
            y1: target.y + def.halfWidth,
          },
          damage: def.pulseDamage,
          damageType: def.damageType,
        });
      }
    } else {
      for (let i = 0; i < def.shells; i++) {
        const angle = this.rng() * Math.PI * 2;
        const dist = Math.sqrt(this.rng()) * def.scatter;
        this.pendingImpacts.push({
          tick: this.tick + def.delayTicks + i * def.shellSpacingTicks,
          shape: {
            kind: 'circle',
            x: target.x + Math.cos(angle) * dist,
            y: target.y + Math.sin(angle) * dist,
            r: def.splashRadius,
          },
          damage: def.shellDamage,
          damageType: def.damageType,
        });
      }
    }
  }

  // ---- combat resolution ----------------------------------------------------------

  /**
   * `direct` says whether the shot had to find the target — aimed fire from a
   * gun, or a mine that saw it walk past. Canopy hides a man from a gunner,
   * so it applies there; it does not hide him from a shell that lands in the
   * trees, so barrages and mortar splash pass `false`.
   *
   * That asymmetry is the whole point of woodland as a mechanic: it is a
   * trade, not a hiding place, and it is what gives the fire-mission layer
   * something to answer.
   */
  /**
   * One shot's damage multiplier, from the combat model.
   *
   * Drawn ONCE PER SHOT even when the shot splashes — a shell that catches
   * four men is one shell. Rolling per victim would turn every burst into an
   * average of independent draws, and `src/sim/combat.ts` measured what that
   * costs: a fine spread washes out and changes almost nothing.
   *
   * Version 0 never draws, so a config without `combatVersion` consumes the
   * combat stream zero times and hashes exactly as it did before v1.23.
   */
  private rollShot(): number {
    return this.combat.version === COMBAT_NONE ? 1 : this.combat.shot(this.combatRng);
  }

  private damageAttacker(
    attacker: Attacker,
    raw: number,
    type: DamageType,
    direct = true,
    roll = 1,
  ): void {
    const cover = direct ? this.terrain.cover(this.grid.cellAt(attacker.pos)) : 1;
    attacker.hp -= raw * roll * cover * this.catalog.damage[type][attacker.profile.armor];
  }

  private damageStructure(
    structure: Structure,
    raw: number,
    type: DamageType,
    source = 'fires',
    roll = 1,
  ): void {
    const before = structure.hp;
    structure.hp -= raw * roll * this.catalog.damage[type]['structure'];
    if (structure === this.cc && before > 0 && structure.hp <= 0) {
      this.stats.ccKillerKind ??= source;
    }
  }

  private applyPendingImpacts(events: SimEvent[]): void {
    if (this.pendingImpacts.length === 0) return;
    const remaining: PendingImpact[] = [];
    const inShape = (shape: ImpactShape, x: number, y: number): boolean =>
      shape.kind === 'circle'
        ? (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.r * shape.r
        : x >= shape.x0 && x <= shape.x1 && y >= shape.y0 && y <= shape.y1;

    for (const impact of this.pendingImpacts) {
      if (impact.tick > this.tick) {
        remaining.push(impact);
        continue;
      }
      const { shape } = impact;
      if (this.attackerSide) {
        // Raid fire support pounds the base: structures and walls, not units.
        for (const structure of this.structures) {
          if (structure.hp <= 0) continue;
          if (inShape(shape, structure.center.x, structure.center.y)) {
            this.damageStructure(structure, impact.damage, impact.damageType, 'fire support');
          }
        }
        const wallDamage =
          impact.damage * this.catalog.damage[impact.damageType]['structure'];
        for (const cell of [...this.grid.walls.keys()]) {
          const center = this.grid.centerOf(cell);
          if (inShape(shape, center.x, center.y)) {
            if (this.grid.damageWall(cell, wallDamage)) {
              this.stats.wallsLost++;
              this.lastBreachCell = cell;
              events.push({ type: 'wallDestroyed', cell });
            }
          }
        }
      } else {
        for (const attacker of this.attackers) {
          // Shells and gun runs are laid on the ground; the answer to air is
          // a gun that can elevate, which is the whole point of AA cover.
          if (attacker.hp <= 0 || attacker.profile.air) continue;
          if (inShape(shape, attacker.pos.x, attacker.pos.y)) {
            // A barrage lands where it lands; the canopy does not stop it.
            this.damageAttacker(attacker, impact.damage, impact.damageType, false);
          }
        }
      }
      if (shape.kind === 'circle') {
        events.push({ type: 'aoe', at: { x: shape.x, y: shape.y }, radius: shape.r });
      } else {
        events.push({ type: 'strafePulse', x0: shape.x0, x1: shape.x1, y: (shape.y0 + shape.y1) / 2 });
      }
    }
    this.pendingImpacts.length = 0;
    this.pendingImpacts.push(...remaining);
  }

  private updateStructures(events: SimEvent[]): void {
    for (const structure of this.structures) {
      if (structure.hp <= 0 || structure.inert) continue;
      const { profile } = structure;

      if (profile.trigger) {
        const t = profile.trigger;
        let tripped = false;
        for (const attacker of this.attackers) {
          if (attacker.hp <= 0 || attacker.profile.air) continue; // buried: flyers pass over
          const dx = attacker.pos.x - structure.center.x;
          const dy = attacker.pos.y - structure.center.y;
          if (dx * dx + dy * dy <= t.radius * t.radius) {
            tripped = true;
            break;
          }
        }
        if (tripped) {
          const roll = this.rollShot();
          for (const attacker of this.attackers) {
            if (attacker.hp <= 0 || attacker.profile.air) continue;
            const dx = attacker.pos.x - structure.center.x;
            const dy = attacker.pos.y - structure.center.y;
            if (dx * dx + dy * dy <= t.splashRadius * t.splashRadius) {
              this.damageAttacker(attacker, t.damage * this.defWeaponMult, t.damageType, true, roll);
            }
          }
          events.push({ type: 'aoe', at: { ...structure.center }, radius: t.splashRadius });
          structure.hp = 0; // consumed; swept up by processStructureDeaths
        }
        continue;
      }

      const weapon = profile.weapon;
      if (!weapon) continue;
      structure.weaponCooldown = Math.max(0, structure.weaponCooldown - DT);
      if (structure.weaponCooldown > 0) continue;

      const target = this.acquireAttacker(
        structure.center,
        weapon.range,
        weapon.minRange ?? 0,
        layerOf(weapon),
      );
      if (!target) continue;
      structure.weaponCooldown = 1 / weapon.shotsPerSecond;

      if (weapon.flightSeconds !== undefined) {
        // Lobbed shell: lead the target by its current velocity.
        const lead = weapon.flightSeconds * 0.85 * target.speed;
        const aim: Vec2 = {
          x: target.pos.x + target.lastDir.x * lead,
          y: target.pos.y + target.lastDir.y * lead,
        };
        this.projectiles.push({
          id: this.nextId++,
          from: { ...structure.center },
          to: aim,
          firedTick: this.tick,
          impactTick: this.tick + Math.round(weapon.flightSeconds * TICKS_PER_SECOND),
          damage: weapon.damage * this.defWeaponMult,
          damageType: weapon.damageType,
          splashRadius: weapon.splashRadius ?? 0,
        });
      } else {
        this.damageAttacker(
          target,
          weapon.damage * this.defWeaponMult,
          weapon.damageType,
          true,
          this.rollShot(),
        );
        events.push({
          type: 'shot',
          from: { ...structure.center },
          to: { ...target.pos },
          damageType: weapon.damageType,
        });
      }
    }
  }

  /**
   * A weapon's reach from where it stands. Height is worth distance: a gun on
   * the crest sees further than the same gun in the bottom of the valley, up
   * to +40% at the top band.
   *
   * Both sides read this from the FIRER's cell, so it is symmetric — it buys
   * a defender the high ground and buys an attacker who takes it exactly the
   * same thing. Minimum range is deliberately not scaled: a mortar's dead
   * zone is a property of its arc, not of the hill it sits on.
   */
  private reachFrom(origin: Vec2, range: number): number {
    if (this.terrain.version === TERRAIN_NONE) return range;
    return range * (1 + RANGE_PER_BAND * this.terrain.band(this.grid.cellAt(origin)));
  }

  private acquireAttacker(
    origin: Vec2,
    range: number,
    minRange: number,
    targets: TargetLayer = 'ground',
  ): Attacker | null {
    let best: Attacker | null = null;
    let bestDistSq = Infinity;
    const reach = this.reachFrom(origin, range);
    const rangeSq = reach * reach;
    const minSq = minRange * minRange;
    for (const attacker of this.attackers) {
      if (attacker.hp <= 0) continue;
      // A gun engages one layer or the other unless it was built for both.
      const flying = attacker.profile.air === true;
      if (flying ? targets === 'ground' : targets === 'air') continue;
      const dx = attacker.pos.x - origin.x;
      const dy = attacker.pos.y - origin.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > rangeSq || distSq < minSq) continue;
      if (distSq < bestDistSq || (distSq === bestDistSq && attacker.id < best!.id)) {
        bestDistSq = distSq;
        best = attacker;
      }
    }
    return best;
  }

  /**
   * Sustainment auras (v0.7, UN doctrine). Engineer structures repair
   * friendly structures and walls in radius; medic attackers heal OTHER
   * attackers in radius. Runs through prep and combat — the line is
   * rebuilt while it bleeds. Healing is additive and capped per target,
   * so iteration order cannot change the outcome; sources iterate in
   * stable id/insertion order regardless.
   */
  private applyAuras(): void {
    if (this.phase !== 'combat' && this.phase !== 'prep' && this.phase !== 'sandbox') return;

    for (const source of this.structures) {
      const aura = source.profile.aura;
      if (!aura || source.hp <= 0 || source.inert) continue;
      const amount = aura.healPerSecond * DT;
      const r2 = aura.radius * aura.radius;
      for (const target of this.structures) {
        if (target.id === source.id || target.hp <= 0 || target.inert) continue;
        if (target.hp >= target.profile.maxHp) continue;
        const dx = target.center.x - source.center.x;
        const dy = target.center.y - source.center.y;
        if (dx * dx + dy * dy > r2) continue;
        target.hp = Math.min(target.profile.maxHp, target.hp + amount);
      }
      for (const [cell, wall] of this.grid.walls) {
        if (wall.hp <= 0 || wall.hp >= wall.maxHp) continue;
        const dx = this.grid.xOf(cell) + 0.5 - source.center.x;
        const dy = this.grid.yOf(cell) + 0.5 - source.center.y;
        if (dx * dx + dy * dy > r2) continue;
        wall.hp = Math.min(wall.maxHp, wall.hp + amount);
      }
    }

    for (const medic of this.attackers) {
      const heal = medic.profile.heal;
      if (!heal || medic.hp <= 0) continue;
      const amount = heal.perSecond * DT;
      const r2 = heal.radius * heal.radius;
      for (const other of this.attackers) {
        if (other.id === medic.id || other.hp <= 0 || other.hp >= other.maxHp) continue;
        const dx = other.pos.x - medic.pos.x;
        const dy = other.pos.y - medic.pos.y;
        if (dx * dx + dy * dy > r2) continue;
        other.hp = Math.min(other.maxHp, other.hp + amount);
      }
    }
  }

  private updateProjectiles(events: SimEvent[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shell = this.projectiles[i]!;
      if (shell.impactTick > this.tick) continue;
      const roll = this.rollShot();
      for (const attacker of this.attackers) {
        if (attacker.hp <= 0) continue;
        const dx = attacker.pos.x - shell.to.x;
        const dy = attacker.pos.y - shell.to.y;
        if (dx * dx + dy * dy <= shell.splashRadius * shell.splashRadius) {
          // Mortar splash, likewise: no cover against something that lobs.
          this.damageAttacker(attacker, shell.damage, shell.damageType, false, roll);
        }
      }
      events.push({ type: 'aoe', at: { ...shell.to }, radius: shell.splashRadius });
      this.projectiles.splice(i, 1);
    }
  }

  private removeDeadAttackers(events: SimEvent[]): void {
    for (let i = this.attackers.length - 1; i >= 0; i--) {
      const attacker = this.attackers[i]!;
      if (attacker.hp > 0) continue;
      events.push({ type: 'attackerDied', id: attacker.id, at: { ...attacker.pos } });
      this.stats.kills++;
      if (this.siege) {
        this.cp = Math.min(this.siege.cpCap, this.cp + attacker.profile.cpValue);
      }
      this.attackers.splice(i, 1);
    }
  }

  private updateAttackers(events: SimEvent[]): void {
    for (const attacker of this.attackers) {
      attacker.prevPos = { ...attacker.pos };
      attacker.lastDir = { x: 0, y: 0 };
      attacker.weaponCooldown = Math.max(0, attacker.weaponCooldown - DT);

      // Keep the doctrine target alive; retarget (and re-path) when it falls.
      let target = this.structureById(attacker.targetId);
      if (!target || target.hp <= 0) {
        target = this.pickDoctrineTarget(attacker);
        attacker.targetId = target.id;
        attacker.path = null;
      }

      // Flying units skip the grid entirely — no path, no walls, no blockers.
      if (attacker.profile.air) {
        this.updateAirAttacker(attacker, target, events);
        continue;
      }

      // Re-path when the battlefield topology changed since the path was made.
      if (attacker.path === null || attacker.pathVersion !== this.grid.version) {
        attacker.goalCells = this.perimeterOf(target);
        const from = this.grid.cellAt(attacker.pos);
        const result = findPath(this.pathView, from, attacker.goalCells, {
          speed: attacker.speed,
          wallDps: attacker.profile.wallDps * attacker.damageMult,
        });
        attacker.path = result ? result.cells : null;
        attacker.pathIndex = result && result.cells.length > 1 ? 1 : 0;
        attacker.pathVersion = this.grid.version;
        if (!result) attacker.state = 'stuck';
      }

      // Ranged units stop and pound targetable structures in reach, preferring
      // their doctrine's class of target.
      if (attacker.profile.weapon) {
        const weapon = attacker.profile.weapon;
        const prefer =
          attacker.doctrine === 'hunt'
            ? 'defense'
            : attacker.doctrine === 'raze'
              ? 'economy'
              : undefined;
        const engageTarget = this.acquireStructure(
          attacker.pos,
          weapon.range,
          weapon.minRange ?? 0,
          prefer,
        );
        if (engageTarget) {
          attacker.state = 'engaging';
          if (attacker.weaponCooldown <= 0) {
            attacker.weaponCooldown = 1 / weapon.shotsPerSecond;
            this.damageStructure(
              engageTarget,
              weapon.damage * attacker.damageMult,
              weapon.damageType,
              attacker.profile.name,
              this.rollShot(),
            );
            events.push({
              type: 'shot',
              from: { ...attacker.pos },
              to: { ...engageTarget.center },
              damageType: weapon.damageType,
            });
          }
          continue;
        }
      }

      if (!attacker.path) continue; // stuck: nothing to demolish, nowhere to go

      // At the target's perimeter: melee it down. hqDps is the anti-CC pace;
      // any other structure is a demolition job, so breachers bring charges
      // (same rule as path-blockers below — wallDps, armor ignored).
      if (attacker.path.length === 1 && attacker.goalCells.includes(attacker.path[0]!)) {
        attacker.state = 'assaulting';
        const dps =
          (target === this.cc
            ? attacker.profile.hqDps
            : Math.max(attacker.profile.hqDps, attacker.profile.wallDps)) *
          attacker.damageMult;
        const before = target.hp;
        target.hp -= dps * DT;
        if (target === this.cc && before > 0 && target.hp <= 0) {
          this.stats.ccKillerKind ??= attacker.profile.name;
        }
        continue;
      }

      let budget = attacker.speed * DT;
      while (budget > 0 && attacker.path) {
        const targetCell = attacker.path[attacker.pathIndex]!;

        // Something in the way (planned, or placed after pathing): demolish it.
        // An OPEN gate is not in the way — that is what open means.
        const wall = this.grid.wallAt(targetCell);
        if (wall && wall.open !== true) {
          attacker.state = 'breaking';
          if (this.grid.damageWall(targetCell, attacker.profile.wallDps * attacker.damageMult * DT)) {
            this.stats.wallsLost++;
            this.lastBreachCell = targetCell;
            events.push({ type: 'wallDestroyed', cell: targetCell });
          }
          break;
        }
        const blocker = this.structureAtCell.get(targetCell);
        if (blocker && blocker.profile.blocks && blocker.hp > 0) {
          attacker.state = 'breaking';
          // Demolition ignores armor.
          blocker.hp -= attacker.profile.wallDps * attacker.damageMult * DT;
          break;
        }

        attacker.state = 'moving';
        const waypoint = this.grid.centerOf(targetCell);
        const dx = waypoint.x - attacker.pos.x;
        const dy = waypoint.y - attacker.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Charged per segment, at the cost of the cell being ENTERED — the
        // same model weighted A* used to choose this route. Scaling the whole
        // tick's budget once would be off by up to a cell whenever the budget
        // carries across a waypoint, and a unit that moves on different terms
        // than the planner drifts off the path it was given.
        const ground = this.terrain.moveCost(targetCell);
        const spend = dist * ground;

        if (spend > budget) {
          const step = (budget / ground) / dist;
          attacker.lastDir = { x: dx / dist, y: dy / dist };
          attacker.pos.x += dx * step;
          attacker.pos.y += dy * step;
          budget = 0;
          break;
        }

        if (dist > 0) attacker.lastDir = { x: dx / dist, y: dy / dist };
        attacker.pos = { ...waypoint };
        budget -= spend;
        if (attacker.pathIndex >= attacker.path.length - 1) {
          // Arrived at a goal cell; assault begins next tick.
          attacker.path = [targetCell];
          attacker.pathIndex = 0;
          break;
        }
        attacker.pathIndex++;
      }
    }
  }

  /**
   * One tick of flight (v1.0). Air units answer to the same doctrines as the
   * infantry, but the maze underneath them is irrelevant: they run straight
   * at what they came for, shoot it from range if they have a weapon, and
   * fall only to a gun that can elevate. Everything a base spends on walls
   * buys nothing here — AA cover is the only answer, which is exactly the
   * planning tension the layer exists to create.
   */
  private updateAirAttacker(attacker: Attacker, target: Structure, events: SimEvent[]): void {
    attacker.path = null;
    attacker.goalCells = [];

    // Standoff weapons fire the moment their doctrine's prey is in reach.
    const weapon = attacker.profile.weapon;
    if (weapon) {
      const prefer =
        attacker.doctrine === 'hunt'
          ? 'defense'
          : attacker.doctrine === 'raze'
            ? 'economy'
            : undefined;
      const engageTarget = this.acquireStructure(
        attacker.pos,
        weapon.range,
        weapon.minRange ?? 0,
        prefer,
      );
      if (engageTarget) {
        attacker.state = 'engaging';
        if (attacker.weaponCooldown <= 0) {
          attacker.weaponCooldown = 1 / weapon.shotsPerSecond;
          this.damageStructure(
            engageTarget,
            weapon.damage * attacker.damageMult,
            weapon.damageType,
            attacker.profile.name,
            this.rollShot(),
          );
          events.push({
            type: 'shot',
            from: { ...attacker.pos },
            to: { ...engageTarget.center },
            damageType: weapon.damageType,
          });
        }
        return;
      }
    }

    // Otherwise close on the target and work it over from directly above.
    const dx = target.center.x - attacker.pos.x;
    const dy = target.center.y - attacker.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const reach = target.profile.footprint / 2 + AIR_STANDOFF;
    if (dist <= reach) {
      attacker.state = 'assaulting';
      const dps =
        (target === this.cc
          ? attacker.profile.hqDps
          : Math.max(attacker.profile.hqDps, attacker.profile.wallDps)) * attacker.damageMult;
      const before = target.hp;
      target.hp -= dps * DT;
      if (target === this.cc && before > 0 && target.hp <= 0) {
        this.stats.ccKillerKind ??= attacker.profile.name;
      }
      return;
    }

    attacker.state = 'moving';
    const budget = attacker.speed * DT;
    attacker.lastDir = { x: dx / dist, y: dy / dist };
    attacker.pos.x += (dx / dist) * Math.min(budget, dist);
    attacker.pos.y += (dy / dist) * Math.min(budget, dist);
  }

  /**
   * How many of a class are still standing.
   *
   * A query, not a rule: the sim knows what a structure IS, and the war layer
   * decides what a raid came for. `src/meta/objectives.ts` reads this rather
   * than keeping its own list of kinds, because a hand-written list is one
   * content addition away from being wrong and these predicates are not.
   */
  countStanding(cls: 'defense' | 'economy'): number {
    let n = 0;
    for (const s of this.structures) {
      if (s.hp <= 0) continue;
      if (cls === 'defense' ? this.isDefenseStructure(s) : this.isEconomyStructure(s)) n++;
    }
    return n;
  }

  private isDefenseStructure(s: Structure): boolean {
    return s.profile.targetable && s.profile.weapon !== undefined && !s.inert;
  }

  private isEconomyStructure(s: Structure): boolean {
    return s.profile.targetable && s.profile.weapon === undefined && s.profile.kind !== 'cc';
  }

  private structureById(id: number): Structure | undefined {
    for (const s of this.structures) {
      if (s.id === id) return s;
    }
    return undefined;
  }

  /** Perimeter cells of a structure — the melee approach ring. */
  private perimeterOf(structure: Structure): CellIndex[] {
    if (structure.id === this.cc.id) return this.goalCells;
    const cells = new Set<CellIndex>();
    const scratch: CellIndex[] = [0, 0, 0, 0];
    for (const cell of structure.cells) {
      const n = this.grid.neighbors4(cell, scratch);
      for (let i = 0; i < n; i++) {
        const c = scratch[i]!;
        if (!structure.cells.includes(c)) cells.add(c);
      }
    }
    return [...cells].sort((a, b) => a - b);
  }

  /** Nearest structure matching the attacker's doctrine; the CC as fallback. */
  private pickDoctrineTarget(attacker: Attacker): Structure {
    if (attacker.doctrine === 'assault') return this.cc;
    const wants =
      attacker.doctrine === 'hunt'
        ? (s: Structure) => this.isDefenseStructure(s)
        : (s: Structure) => this.isEconomyStructure(s);
    let best: Structure | null = null;
    let bestDistSq = Infinity;
    for (const s of this.structures) {
      if (s.hp <= 0 || !wants(s)) continue;
      const dx = s.center.x - attacker.pos.x;
      const dy = s.center.y - attacker.pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq || (distSq === bestDistSq && s.id < best!.id)) {
        bestDistSq = distSq;
        best = s;
      }
    }
    return best ?? this.cc;
  }

  private acquireStructure(
    origin: Vec2,
    range: number,
    minRange: number,
    prefer?: 'defense' | 'economy',
  ): Structure | null {
    const reach = this.reachFrom(origin, range);
    const rangeSq = reach * reach;
    const minSq = minRange * minRange;
    const pick = (filter: ((s: Structure) => boolean) | null): Structure | null => {
      let best: Structure | null = null;
      let bestDistSq = Infinity;
      for (const structure of this.structures) {
        if (structure.hp <= 0 || !structure.profile.targetable) continue;
        if (filter && !filter(structure)) continue;
        const dx = structure.center.x - origin.x;
        const dy = structure.center.y - origin.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > rangeSq || distSq < minSq) continue;
        if (distSq < bestDistSq || (distSq === bestDistSq && structure.id < best!.id)) {
          bestDistSq = distSq;
          best = structure;
        }
      }
      return best;
    };
    if (prefer) {
      const preferred = pick(
        prefer === 'defense'
          ? (s) => this.isDefenseStructure(s)
          : (s) => this.isEconomyStructure(s),
      );
      if (preferred) return preferred;
    }
    return pick(null);
  }

  private processStructureDeaths(events: SimEvent[]): void {
    for (let i = this.structures.length - 1; i >= 0; i--) {
      const structure = this.structures[i]!;
      if (structure.hp > 0) continue;
      if (structure.profile.kind === 'cc') {
        this.cc.hp = 0;
        this.phase = 'defeat';
        events.push({ type: 'defeat' });
        continue;
      }
      events.push({
        type: 'structureDestroyed',
        id: structure.id,
        kind: structure.profile.kind,
        at: { ...structure.center },
      });
      this.stats.structuresLost++;
      this.dropStructure(structure);
    }
  }

  private dropStructure(structure: Structure): void {
    for (const cell of structure.cells) this.structureAtCell.delete(cell);
    const index = this.structures.indexOf(structure);
    if (index !== -1) this.structures.splice(index, 1);
    if (structure.profile.blocks) this.grid.version++;
  }

  // ---- queries for the UI --------------------------------------------------------

  structureAt(cell: CellIndex): Structure | undefined {
    return this.structureAtCell.get(cell);
  }

  /** Open ground, not the spawn column or a reserved cell, no attacker on it. */
  isBuildable(cell: CellIndex, ignoreReserved = false): boolean {
    if (!this.grid.inBounds(cell)) return false;
    if (this.grid.wallAt(cell) || this.structureAtCell.has(cell)) return false;
    if (this.grid.isBlocked(cell)) return false;
    if (this.grid.xOf(cell) === this.config.spawnColumn) return false;
    if (!ignoreReserved && this.config.reservedCells?.includes(cell)) return false;
    for (const attacker of this.attackers) {
      if (this.grid.cellAt(attacker.pos) === cell) return false;
    }
    return true;
  }

  canPlaceWall(kind: string, cell: CellIndex): boolean {
    const def = this.catalog.walls[kind];
    if (!def) return false;
    // Town wall allowance gates Supplies walls only; HESCOs are battle-layer.
    if (def.supplyCost !== undefined && this.config.buildLimits?.walls !== undefined) {
      let supplyWalls = 0;
      for (const wall of this.grid.walls.values()) {
        if (this.catalog.walls[wall.kind]?.supplyCost !== undefined) supplyWalls++;
      }
      if (supplyWalls >= this.config.buildLimits.walls) return false;
    }
    // Per-kind limits also cover wall kinds (a 0 entry = not yet unlocked).
    const kindLimit = this.config.buildLimits?.structures?.[kind];
    if (kindLimit !== undefined) {
      let count = 0;
      for (const wall of this.grid.walls.values()) {
        if (wall.kind === kind) count++;
      }
      if (count >= kindLimit) return false;
    }
    return this.affords(def) && this.isBuildable(cell);
  }

  canPlaceStructure(kind: string, cell: CellIndex): boolean {
    const profile = this.catalog.structures[kind];
    if (!profile || profile.kind === 'cc') return false;
    if (!this.affords(profile)) return false;
    const limit = this.config.buildLimits?.structures?.[kind];
    if (limit !== undefined) {
      let count = 0;
      for (const s of this.structures) {
        if (s.profile.kind === kind) count++;
      }
      if (count >= limit) return false;
    }
    const cells = this.footprintCells(cell, profile.footprint);
    return cells !== null && cells.every((c) => this.isBuildable(c));
  }

  canCastPower(kind: string): boolean {
    const def = this.catalog.powers[kind];
    if (!def) return false;
    if (this.chargesLeft && (this.chargesLeft.get(kind) ?? 0) <= 0) return false;
    if (this.phase === 'sandbox') return (this.powerCooldowns.get(kind) ?? 0) <= 0;
    if (this.phase !== 'combat') return false;
    if ((this.powerCooldowns.get(kind) ?? 0) > 0) return false;
    // Attacker-side ordnance is charge-budgeted, never CP-budgeted.
    return this.attackerSide || this.cp >= this.cpPrice(def.cpCost);
  }

  /** Remaining charges for a power, or null when the battle has no stock limit. */
  powerChargesLeft(kind: string): number | null {
    return this.chargesLeft ? (this.chargesLeft.get(kind) ?? 0) : null;
  }

  powerCooldownSeconds(kind: string): number {
    return (this.powerCooldowns.get(kind) ?? 0) / TICKS_PER_SECOND;
  }

  repairAllCost(): number {
    if (!this.siege) return 0;
    let missing = 0;
    for (const wall of this.grid.walls.values()) missing += wall.maxHp - wall.hp;
    for (const s of this.structures) missing += s.profile.maxHp - s.hp;
    return Math.ceil(missing * this.siege.repairCostPerHp);
  }

  /** Composition of the next wave to fight (during setup/prep), else null. */
  nextWavePreview(): { kind: string; count: number }[] | null {
    if (!this.siege) return null;
    const index = this.phase === 'setup' ? 0 : this.phase === 'prep' ? this.waveIndex + 1 : -1;
    if (index < 0 || index >= this.waves.length) return null;
    const counts = new Map<string, number>();
    for (const entry of this.waves[index]!) {
      counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
    }
    return [...counts.entries()].map(([kind, count]) => ({ kind, count }));
  }

  get waveCount(): number {
    return this.waves.length;
  }

  // ---- fingerprinting ----------------------------------------------------------------

  /** Canonical fingerprint of gameplay-relevant state, for determinism tests. */
  stateHash(): string {
    const parts: string[] = [
      `t${this.tick}`,
      `ph${this.phase}`,
      `wv${this.waveIndex},${this.waveTick},${this.prepTicksLeft},${this.spawnCursor}`,
      `ec${this.supplies},${this.cp.toFixed(6)}`,
    ];
    const s = this.stats;
    parts.push(
      `s${s.spawned},${s.kills},${s.wallsBuilt},${s.wallsLost},${s.structuresLost},${s.suppliesSpent},${s.cpSpent.toFixed(6)},${s.salvage}`,
    );

    const wallCells = [...this.grid.walls.keys()].sort((a, b) => a - b);
    for (const cell of wallCells) {
      const wall = this.grid.walls.get(cell)!;
      parts.push(`w${cell}:${wall.kind}${wall.open === true ? 'o' : ''}:${wall.hp.toFixed(6)}`);
    }
    for (const st of this.structures) {
      parts.push(
        `S${st.id}:${st.profile.kind}L${st.level}${st.inert ? 'i' : ''}@${st.origin}:${st.hp.toFixed(6)}:${st.weaponCooldown.toFixed(6)}`,
      );
    }
    for (const a of this.attackers) {
      parts.push(
        `a${a.id}:${a.profile.kind}:${a.doctrine[0]}${a.targetId}:${a.hp.toFixed(6)}@${a.pos.x.toFixed(6)},${a.pos.y.toFixed(6)}:${a.state}:${a.weaponCooldown.toFixed(6)}`,
      );
    }
    for (const p of this.projectiles) {
      parts.push(`p${p.id}:${p.impactTick}@${p.to.x.toFixed(6)},${p.to.y.toFixed(6)}`);
    }
    for (const impact of this.pendingImpacts) {
      const sh = impact.shape;
      parts.push(
        sh.kind === 'circle'
          ? `i${impact.tick}c${sh.x.toFixed(6)},${sh.y.toFixed(6)}`
          : `i${impact.tick}r${sh.x0.toFixed(6)},${sh.y0.toFixed(6)}`,
      );
    }
    const cds = [...this.powerCooldowns.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    for (const [kind, ticks] of cds) parts.push(`cd${kind}:${ticks}`);
    if (this.chargesLeft) {
      const charges = [...this.chargesLeft.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
      for (const [kind, left] of charges) parts.push(`ch${kind}:${left}`);
    }
    return fnv1a(parts.join('|'));
  }
}
