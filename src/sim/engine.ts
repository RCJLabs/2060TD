import { Grid } from './grid';
import { fnv1a } from './hash';
import { findPath } from './pathfinding';
import { createRng, rollRange, type Rng } from './rng';
import type {
  CellIndex,
  Command,
  RunnerProfile,
  SimConfig,
  SimEvent,
  SimStats,
  TurretProfile,
  Vec2,
} from './types';

export const TICKS_PER_SECOND = 20;
export const DT = 1 / TICKS_PER_SECOND;

/** Omit that distributes over union types (plain Omit collapses the union). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface Runner {
  id: number;
  profile: RunnerProfile;
  hp: number;
  /** Speed after the seeded jitter roll at spawn. */
  speed: number;
  pos: Vec2;
  /** Position at the previous tick, for render interpolation. */
  prevPos: Vec2;
  path: CellIndex[] | null;
  pathIndex: number;
  pathVersion: number;
  state: 'moving' | 'breaking' | 'stuck';
}

export interface Turret {
  id: number;
  cell: CellIndex;
  profile: TurretProfile;
  cooldown: number;
}

/**
 * The deterministic fixed-tick battle engine.
 *
 * All inputs are Commands stamped with the tick they apply on; the engine
 * consumes them in FIFO order at tick boundaries. Same config + same command
 * sequence ⇒ identical state (see stateHash), which is what makes replays,
 * offline raid resolution, and the balance harness possible.
 *
 * Determinism rules honored here:
 * - all randomness via the seeded PRNG (currently: spawn speed jitter)
 * - entities update in spawn/placement order; targeting ties break on id
 * - no Math.hypot (engine-dependent precision) — sqrt of a dot product only
 */
export class Engine {
  readonly config: SimConfig;
  readonly grid: Grid;
  readonly runners: Runner[] = [];
  readonly turrets: Turret[] = [];
  readonly stats: SimStats = { spawned: 0, kills: 0, leaks: 0, wallsBuilt: 0, wallsLost: 0 };
  tick = 0;

  private readonly rng: Rng;
  private nextId = 1;
  private queue: Command[] = [];

  constructor(config: SimConfig) {
    this.config = config;
    this.grid = new Grid(config.width, config.height);
    this.rng = createRng(config.seed);
  }

  /** Queue a command; it applies at the start of the tick it is stamped with. */
  enqueue(command: Command): void {
    this.queue.push(command);
  }

  /** Convenience for live play: stamp with the current tick and queue. */
  command(command: DistributiveOmit<Command, 'tick'> & { tick?: number }): void {
    this.enqueue({ ...command, tick: command.tick ?? this.tick } as Command);
  }

  /** Advance one fixed tick. Returns the events produced by this tick. */
  step(): SimEvent[] {
    const events: SimEvent[] = [];
    this.applyCommands(events);
    this.updateTurrets(events);
    this.removeDead(events);
    this.updateRunners(events);
    this.tick++;
    return events;
  }

  /** Run n ticks headlessly (offline raids, tests, fast-forward). */
  run(ticks: number): void {
    for (let i = 0; i < ticks; i++) this.step();
  }

  // ---- command application ------------------------------------------------

  private applyCommands(events: SimEvent[]): void {
    // Keep commands stamped for future ticks; apply (in FIFO order) the rest.
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

  private applyCommand(cmd: Command, events: SimEvent[]): boolean {
    switch (cmd.type) {
      case 'placeWall': {
        if (!this.isBuildable(cmd.cell)) return false;
        this.grid.placeWall(cmd.cell, this.config.wallHp);
        this.stats.wallsBuilt++;
        return true;
      }
      case 'removeWall': {
        if (!this.grid.wallAt(cmd.cell)) return false;
        this.grid.removeWall(cmd.cell);
        return true;
      }
      case 'placeTurret': {
        if (!this.isBuildable(cmd.cell)) return false;
        this.grid.addBlocker(cmd.cell);
        this.turrets.push({ id: this.nextId++, cell: cmd.cell, profile: cmd.profile, cooldown: 0 });
        return true;
      }
      case 'spawnRunner': {
        if (!this.grid.inBounds(cmd.cell) || !this.grid.isOpen(cmd.cell)) return false;
        const jitter = cmd.profile.speedJitter;
        const speed = cmd.profile.speed * (1 + rollRange(this.rng, -jitter, jitter));
        const pos = this.grid.centerOf(cmd.cell);
        const runner: Runner = {
          id: this.nextId++,
          profile: cmd.profile,
          hp: cmd.profile.maxHp,
          speed,
          pos,
          prevPos: { ...pos },
          path: null,
          pathIndex: 0,
          pathVersion: -1,
          state: 'moving',
        };
        this.runners.push(runner);
        this.stats.spawned++;
        events.push({ type: 'runnerSpawned', runnerId: runner.id });
        return true;
      }
    }
  }

  /** Open ground, not the HQ, not the spawn column, no runner standing on it. */
  isBuildable(cell: CellIndex): boolean {
    if (!this.grid.inBounds(cell)) return false;
    if (!this.grid.isOpen(cell)) return false;
    if (cell === this.config.hqCell) return false;
    if (this.grid.xOf(cell) === this.config.spawnColumn) return false;
    for (const r of this.runners) {
      if (this.grid.cellAt(r.pos) === cell) return false;
    }
    return true;
  }

  // ---- turrets --------------------------------------------------------------

  private updateTurrets(events: SimEvent[]): void {
    for (const turret of this.turrets) {
      turret.cooldown = Math.max(0, turret.cooldown - DT);
      if (turret.cooldown > 0) continue;

      const origin = this.grid.centerOf(turret.cell);
      const rangeSq = turret.profile.range * turret.profile.range;
      let target: Runner | null = null;
      let bestDistSq = Infinity;
      for (const runner of this.runners) {
        if (runner.hp <= 0) continue;
        const dx = runner.pos.x - origin.x;
        const dy = runner.pos.y - origin.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > rangeSq) continue;
        if (distSq < bestDistSq || (distSq === bestDistSq && runner.id < target!.id)) {
          bestDistSq = distSq;
          target = runner;
        }
      }
      if (!target) continue;

      target.hp -= turret.profile.damage;
      turret.cooldown = 1 / turret.profile.shotsPerSecond;
      events.push({
        type: 'shot',
        turretId: turret.id,
        runnerId: target.id,
        from: origin,
        to: { ...target.pos },
      });
    }
  }

  private removeDead(events: SimEvent[]): void {
    for (let i = this.runners.length - 1; i >= 0; i--) {
      const runner = this.runners[i]!;
      if (runner.hp <= 0) {
        events.push({ type: 'runnerDied', runnerId: runner.id, at: { ...runner.pos } });
        this.stats.kills++;
        this.runners.splice(i, 1);
      }
    }
  }

  // ---- runners --------------------------------------------------------------

  private updateRunners(events: SimEvent[]): void {
    const leaked: number[] = [];

    for (const runner of this.runners) {
      runner.prevPos = { ...runner.pos };

      // Re-path when the battlefield topology changed since the path was made.
      if (runner.path === null || runner.pathVersion !== this.grid.version) {
        const from = this.grid.cellAt(runner.pos);
        const result = findPath(this.grid, from, this.config.hqCell, {
          speed: runner.speed,
          wallDps: runner.profile.wallDps,
        });
        runner.path = result ? result.cells : null;
        runner.pathIndex = result && result.cells.length > 1 ? 1 : 0;
        runner.pathVersion = this.grid.version;
        runner.state = result ? 'moving' : 'stuck';
      }
      if (!runner.path) continue; // enclosed and unable to break walls: hold position

      let budget = runner.speed * DT;
      while (budget > 0) {
        const targetCell = runner.path[runner.pathIndex]!;

        // A wall in the way (planned, or placed after pathing): chew through it.
        const wall = this.grid.wallAt(targetCell);
        if (wall) {
          runner.state = 'breaking';
          const destroyed = this.grid.damageWall(targetCell, runner.profile.wallDps * DT);
          if (destroyed) {
            this.stats.wallsLost++;
            events.push({ type: 'wallDestroyed', cell: targetCell });
          }
          break; // the tick was spent attacking the wall
        }

        runner.state = 'moving';
        const waypoint = this.grid.centerOf(targetCell);
        const dx = waypoint.x - runner.pos.x;
        const dy = waypoint.y - runner.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > budget) {
          runner.pos.x += (dx / dist) * budget;
          runner.pos.y += (dy / dist) * budget;
          budget = 0;
          break;
        }

        // Reached the waypoint center; snap and continue with leftover budget.
        runner.pos = { ...waypoint };
        budget -= dist;
        if (runner.pathIndex >= runner.path.length - 1) {
          leaked.push(runner.id);
          break;
        }
        runner.pathIndex++;
      }
    }

    for (const id of leaked) {
      const index = this.runners.findIndex((r) => r.id === id);
      if (index !== -1) {
        events.push({ type: 'runnerLeaked', runnerId: id });
        this.stats.leaks++;
        this.runners.splice(index, 1);
      }
    }
  }

  // ---- fingerprinting ---------------------------------------------------------

  /** Canonical fingerprint of gameplay-relevant state, for determinism tests. */
  stateHash(): string {
    const parts: string[] = [`t${this.tick}`];
    const s = this.stats;
    parts.push(`s${s.spawned},${s.kills},${s.leaks},${s.wallsBuilt},${s.wallsLost}`);

    const wallCells = [...this.grid.walls.keys()].sort((a, b) => a - b);
    for (const cell of wallCells) {
      parts.push(`w${cell}:${this.grid.walls.get(cell)!.hp.toFixed(6)}`);
    }
    for (const turret of this.turrets) {
      parts.push(`T${turret.id}@${turret.cell}:${turret.cooldown.toFixed(6)}`);
    }
    for (const r of this.runners) {
      parts.push(
        `r${r.id}:${r.profile.kind}:${r.hp.toFixed(6)}@${r.pos.x.toFixed(6)},${r.pos.y.toFixed(6)}:${r.state}`,
      );
    }
    return fnv1a(parts.join('|'));
  }
}
