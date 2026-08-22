import { Grid } from './grid';
import { fnv1a } from './hash';
import { findPath, type PathGrid } from './pathfinding';
import { createRng, rollRange, type Rng } from './rng';
import type {
  AttackerProfile,
  Catalog,
  CellIndex,
  Command,
  DamageType,
  Phase,
  SimConfig,
  SimEvent,
  SimStats,
  StructureProfile,
  Vec2,
  WaveEntry,
} from './types';

export const TICKS_PER_SECOND = 20;
export const DT = 1 / TICKS_PER_SECOND;

/** Omit that distributes over union types (plain Omit collapses the union). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface Attacker {
  id: number;
  profile: AttackerProfile;
  hp: number;
  /** Speed after the seeded jitter roll at spawn. */
  speed: number;
  pos: Vec2;
  /** Position at the previous tick, for render interpolation. */
  prevPos: Vec2;
  /** Unit direction of travel last tick (zero while stationary) — mortar lead. */
  lastDir: Vec2;
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
  private nextId = 1;
  private queue: Command[] = [];
  private spawnCursor = 0;
  private readonly waves: WaveEntry[][];
  private readonly structureAtCell = new Map<CellIndex, Structure>();
  private readonly pendingImpacts: PendingImpact[] = [];
  private readonly powerCooldowns = new Map<string, number>();
  private readonly pathView: PathGrid;

  constructor(config: SimConfig, catalog: Catalog) {
    this.config = config;
    this.catalog = catalog;
    this.grid = new Grid(config.width, config.height);
    this.rng = createRng(config.seed);
    this.phase = config.siege ? 'setup' : 'sandbox';
    this.supplies = config.siege?.startingSupplies ?? 0;
    this.cp = config.siege?.startingCp ?? 0;
    this.waves = (config.siege?.waves ?? []).map((w) =>
      [...w.entries].sort((a, b) => a.atTick - b.atTick),
    );

    // Plant the Command Center: 2×2, hard-blocked, the thing everyone dies for.
    const ccProfile = catalog.structures['cc'];
    if (!ccProfile) throw new Error('catalog is missing the cc structure');
    const o = config.ccOrigin;
    const w = config.width;
    const ccCells = [o, o + 1, o + w, o + w + 1];
    this.cc = {
      id: this.nextId++,
      profile: ccProfile,
      origin: o,
      cells: ccCells,
      center: { x: this.grid.xOf(o) + 1, y: this.grid.yOf(o) + 1 },
      hp: ccProfile.maxHp,
      weaponCooldown: 0,
    };
    this.structures.push(this.cc);
    for (const cell of ccCells) {
      this.grid.addBlocker(cell);
      this.structureAtCell.set(cell, this.cc);
    }

    // Assault goals: the CC's orthogonal perimeter (deduped, sorted — deterministic).
    const goals = new Set<CellIndex>();
    const scratch: CellIndex[] = [0, 0, 0, 0];
    for (const cell of ccCells) {
      const n = this.grid.neighbors4(cell, scratch);
      for (let i = 0; i < n; i++) {
        const c = scratch[i]!;
        if (!ccCells.includes(c)) goals.add(c);
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
        if (wall) return wall.hp;
        const s = this.structureAtCell.get(cell);
        if (s && s.profile.blocks && s.hp > 0) {
          return s.profile.kind === 'cc' ? Infinity : s.hp;
        }
        return 0;
      },
    };
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
    this.applyPendingImpacts(events);
    this.updateStructures(events);
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
        this.spawnAttackerAt(this.grid.idx(this.config.spawnColumn, entry.row), entry.kind, events);
      }
      this.waveTick++;

      const waveDone =
        this.spawnCursor >= wave.length &&
        this.attackers.length === 0 &&
        this.projectiles.length === 0;
      if (waveDone) {
        this.supplies += siege.suppliesPerWave;
        if (this.waveIndex >= this.waves.length - 1) {
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

  private spawnAttackerAt(cell: CellIndex, kind: string, events: SimEvent[]): boolean {
    const profile = this.catalog.attackers[kind];
    if (!profile || !this.grid.inBounds(cell)) return false;
    if (this.grid.wallAt(cell) || this.structureAtCell.get(cell)?.profile.blocks) return false;
    const jitter = profile.speedJitter;
    const speed = profile.speed * (1 + rollRange(this.rng, -jitter, jitter));
    const pos = this.grid.centerOf(cell);
    const attacker: Attacker = {
      id: this.nextId++,
      profile,
      hp: profile.maxHp,
      speed,
      pos,
      prevPos: { ...pos },
      lastDir: { x: 0, y: 0 },
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

  /** Checks phase gate + price for an item priced in Supplies or CP. */
  private affords(cost: { supplyCost?: number; cpCost?: number }): boolean {
    if (this.phase === 'sandbox') return true;
    if (cost.supplyCost !== undefined) {
      return this.canBuildPermanent && this.supplies >= cost.supplyCost;
    }
    if (cost.cpCost !== undefined) {
      return this.canBuildField && this.cp >= cost.cpCost;
    }
    return false;
  }

  private pay(cost: { supplyCost?: number; cpCost?: number }): void {
    if (this.phase === 'sandbox') return;
    if (cost.supplyCost !== undefined) {
      this.supplies -= cost.supplyCost;
      this.stats.suppliesSpent += cost.supplyCost;
    } else if (cost.cpCost !== undefined) {
      this.cp -= cost.cpCost;
      this.stats.cpSpent += cost.cpCost;
    }
  }

  private applyCommand(cmd: Command, events: SimEvent[]): boolean {
    switch (cmd.type) {
      case 'placeWall': {
        if (!this.canPlaceWall(cmd.kind, cmd.cell)) return false;
        const def = this.catalog.walls[cmd.kind]!;
        this.grid.placeWall(cmd.cell, def.hp, def.kind);
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
        const profile = this.catalog.structures[cmd.kind]!;
        const structure: Structure = {
          id: this.nextId++,
          profile,
          origin: cmd.cell,
          cells: [cmd.cell],
          center: this.grid.centerOf(cmd.cell),
          hp: profile.maxHp,
          weaponCooldown: 0,
        };
        this.structures.push(structure);
        this.structureAtCell.set(cmd.cell, structure);
        if (profile.blocks) this.grid.version++;
        this.pay(profile);
        return true;
      }
      case 'removeStructure': {
        if (this.phase !== 'setup' && this.phase !== 'sandbox') return false;
        const s = this.structureAtCell.get(cmd.cell);
        if (!s || s.profile.kind === 'cc') return false;
        if (this.phase === 'setup' && s.profile.supplyCost !== undefined) {
          this.supplies += s.profile.supplyCost;
        }
        this.dropStructure(s);
        return true;
      }
      case 'spawnAttacker': {
        if (this.phase !== 'sandbox') return false;
        return this.spawnAttackerAt(cmd.cell, cmd.kind, events);
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
      case 'castPower': {
        if (!this.canCastPower(cmd.kind)) return false;
        const def = this.catalog.powers[cmd.kind]!;
        if (this.phase !== 'sandbox') {
          this.cp -= def.cpCost;
          this.stats.cpSpent += def.cpCost;
        }
        this.powerCooldowns.set(def.kind, Math.round(def.cooldownSeconds * TICKS_PER_SECOND));
        this.schedulePower(def.kind, cmd.target);
        events.push({ type: 'powerCast', kind: def.kind, at: { ...cmd.target } });
        return true;
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

  private damageAttacker(attacker: Attacker, raw: number, type: DamageType): void {
    attacker.hp -= raw * this.catalog.damage[type][attacker.profile.armor];
  }

  private damageStructure(structure: Structure, raw: number, type: DamageType): void {
    structure.hp -= raw * this.catalog.damage[type]['structure'];
  }

  private applyPendingImpacts(events: SimEvent[]): void {
    if (this.pendingImpacts.length === 0) return;
    const remaining: PendingImpact[] = [];
    for (const impact of this.pendingImpacts) {
      if (impact.tick > this.tick) {
        remaining.push(impact);
        continue;
      }
      const { shape } = impact;
      for (const attacker of this.attackers) {
        if (attacker.hp <= 0) continue;
        const { x, y } = attacker.pos;
        const hit =
          shape.kind === 'circle'
            ? (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.r * shape.r
            : x >= shape.x0 && x <= shape.x1 && y >= shape.y0 && y <= shape.y1;
        if (hit) this.damageAttacker(attacker, impact.damage, impact.damageType);
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
      if (structure.hp <= 0) continue;
      const { profile } = structure;

      if (profile.trigger) {
        const t = profile.trigger;
        let tripped = false;
        for (const attacker of this.attackers) {
          if (attacker.hp <= 0) continue;
          const dx = attacker.pos.x - structure.center.x;
          const dy = attacker.pos.y - structure.center.y;
          if (dx * dx + dy * dy <= t.radius * t.radius) {
            tripped = true;
            break;
          }
        }
        if (tripped) {
          for (const attacker of this.attackers) {
            if (attacker.hp <= 0) continue;
            const dx = attacker.pos.x - structure.center.x;
            const dy = attacker.pos.y - structure.center.y;
            if (dx * dx + dy * dy <= t.splashRadius * t.splashRadius) {
              this.damageAttacker(attacker, t.damage, t.damageType);
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

      const target = this.acquireAttacker(structure.center, weapon.range, weapon.minRange ?? 0);
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
          damage: weapon.damage,
          damageType: weapon.damageType,
          splashRadius: weapon.splashRadius ?? 0,
        });
      } else {
        this.damageAttacker(target, weapon.damage, weapon.damageType);
        events.push({
          type: 'shot',
          from: { ...structure.center },
          to: { ...target.pos },
          damageType: weapon.damageType,
        });
      }
    }
  }

  private acquireAttacker(origin: Vec2, range: number, minRange: number): Attacker | null {
    let best: Attacker | null = null;
    let bestDistSq = Infinity;
    const rangeSq = range * range;
    const minSq = minRange * minRange;
    for (const attacker of this.attackers) {
      if (attacker.hp <= 0) continue;
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

  private updateProjectiles(events: SimEvent[]): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shell = this.projectiles[i]!;
      if (shell.impactTick > this.tick) continue;
      for (const attacker of this.attackers) {
        if (attacker.hp <= 0) continue;
        const dx = attacker.pos.x - shell.to.x;
        const dy = attacker.pos.y - shell.to.y;
        if (dx * dx + dy * dy <= shell.splashRadius * shell.splashRadius) {
          this.damageAttacker(attacker, shell.damage, shell.damageType);
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
    const goalSet = new Set(this.goalCells);

    for (const attacker of this.attackers) {
      attacker.prevPos = { ...attacker.pos };
      attacker.lastDir = { x: 0, y: 0 };
      attacker.weaponCooldown = Math.max(0, attacker.weaponCooldown - DT);

      // Re-path when the battlefield topology changed since the path was made.
      if (attacker.path === null || attacker.pathVersion !== this.grid.version) {
        const from = this.grid.cellAt(attacker.pos);
        const result = findPath(this.pathView, from, this.goalCells, {
          speed: attacker.speed,
          wallDps: attacker.profile.wallDps,
        });
        attacker.path = result ? result.cells : null;
        attacker.pathIndex = result && result.cells.length > 1 ? 1 : 0;
        attacker.pathVersion = this.grid.version;
        if (!result) attacker.state = 'stuck';
      }

      // Ranged units stop and pound any targetable structure in reach (incl. the CC).
      if (attacker.profile.weapon) {
        const weapon = attacker.profile.weapon;
        const target = this.acquireStructure(attacker.pos, weapon.range, weapon.minRange ?? 0);
        if (target) {
          attacker.state = 'engaging';
          if (attacker.weaponCooldown <= 0) {
            attacker.weaponCooldown = 1 / weapon.shotsPerSecond;
            this.damageStructure(target, weapon.damage, weapon.damageType);
            events.push({
              type: 'shot',
              from: { ...attacker.pos },
              to: { ...target.center },
              damageType: weapon.damageType,
            });
          }
          continue;
        }
      }

      if (!attacker.path) continue; // stuck: nothing to demolish, nowhere to go

      // At the Command Center perimeter: melee assault.
      if (attacker.path.length === 1 && goalSet.has(attacker.path[0]!)) {
        attacker.state = 'assaulting';
        this.cc.hp -= attacker.profile.hqDps * DT;
        continue;
      }

      let budget = attacker.speed * DT;
      while (budget > 0 && attacker.path) {
        const targetCell = attacker.path[attacker.pathIndex]!;

        // Something in the way (planned, or placed after pathing): demolish it.
        const wall = this.grid.wallAt(targetCell);
        if (wall) {
          attacker.state = 'breaking';
          if (this.grid.damageWall(targetCell, attacker.profile.wallDps * DT)) {
            this.stats.wallsLost++;
            events.push({ type: 'wallDestroyed', cell: targetCell });
          }
          break;
        }
        const blocker = this.structureAtCell.get(targetCell);
        if (blocker && blocker.profile.blocks && blocker.hp > 0) {
          attacker.state = 'breaking';
          blocker.hp -= attacker.profile.wallDps * DT; // demolition ignores armor
          break;
        }

        attacker.state = 'moving';
        const waypoint = this.grid.centerOf(targetCell);
        const dx = waypoint.x - attacker.pos.x;
        const dy = waypoint.y - attacker.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > budget) {
          attacker.lastDir = { x: dx / dist, y: dy / dist };
          attacker.pos.x += (dx / dist) * budget;
          attacker.pos.y += (dy / dist) * budget;
          budget = 0;
          break;
        }

        if (dist > 0) attacker.lastDir = { x: dx / dist, y: dy / dist };
        attacker.pos = { ...waypoint };
        budget -= dist;
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

  private acquireStructure(origin: Vec2, range: number, minRange: number): Structure | null {
    let best: Structure | null = null;
    let bestDistSq = Infinity;
    const rangeSq = range * range;
    const minSq = minRange * minRange;
    for (const structure of this.structures) {
      if (structure.hp <= 0 || !structure.profile.targetable) continue;
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

  /** Open ground, not the spawn column, no attacker standing on it. */
  isBuildable(cell: CellIndex): boolean {
    if (!this.grid.inBounds(cell)) return false;
    if (this.grid.wallAt(cell) || this.structureAtCell.has(cell)) return false;
    if (this.grid.isBlocked(cell)) return false;
    if (this.grid.xOf(cell) === this.config.spawnColumn) return false;
    for (const attacker of this.attackers) {
      if (this.grid.cellAt(attacker.pos) === cell) return false;
    }
    return true;
  }

  canPlaceWall(kind: string, cell: CellIndex): boolean {
    const def = this.catalog.walls[kind];
    return def !== undefined && this.affords(def) && this.isBuildable(cell);
  }

  canPlaceStructure(kind: string, cell: CellIndex): boolean {
    const profile = this.catalog.structures[kind];
    if (!profile || profile.kind === 'cc' || profile.footprint !== 1) return false;
    return this.affords(profile) && this.isBuildable(cell);
  }

  canCastPower(kind: string): boolean {
    const def = this.catalog.powers[kind];
    if (!def) return false;
    if (this.phase === 'sandbox') return (this.powerCooldowns.get(kind) ?? 0) <= 0;
    if (this.phase !== 'combat') return false;
    return (this.powerCooldowns.get(kind) ?? 0) <= 0 && this.cp >= def.cpCost;
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
      `s${s.spawned},${s.kills},${s.wallsBuilt},${s.wallsLost},${s.structuresLost},${s.suppliesSpent},${s.cpSpent.toFixed(6)}`,
    );

    const wallCells = [...this.grid.walls.keys()].sort((a, b) => a - b);
    for (const cell of wallCells) {
      const wall = this.grid.walls.get(cell)!;
      parts.push(`w${cell}:${wall.kind}:${wall.hp.toFixed(6)}`);
    }
    for (const st of this.structures) {
      parts.push(
        `S${st.id}:${st.profile.kind}@${st.origin}:${st.hp.toFixed(6)}:${st.weaponCooldown.toFixed(6)}`,
      );
    }
    for (const a of this.attackers) {
      parts.push(
        `a${a.id}:${a.profile.kind}:${a.hp.toFixed(6)}@${a.pos.x.toFixed(6)},${a.pos.y.toFixed(6)}:${a.state}:${a.weaponCooldown.toFixed(6)}`,
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
    return fnv1a(parts.join('|'));
  }
}
