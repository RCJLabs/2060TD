import Phaser from 'phaser';
import type { Attacker, Engine } from '../sim/engine';
import type { CellIndex, DamageType, SimEvent, Vec2 } from '../sim/types';
import { drawFieldBase, drawStructureGlyph, drawWallGlyph } from './glyphs';
import { COLORS } from './palette';
import { mono } from './ui';

interface Effect {
  kind: 'tracer' | 'boom' | 'wallBoom' | 'structBoom' | 'aoe' | 'strafe' | 'reticle';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  color?: number;
  age: number;
  life: number;
}

export interface GhostPreview {
  cell: CellIndex;
  /** Structure or wall kind being placed ('erase' for the erase tool). */
  kind: string;
  valid: boolean;
}

export interface PowerPreview {
  kind: string;
  at: Vec2;
}

export interface DrawOptions {
  showPaths: boolean;
  ghost?: GhostPreview;
  powerPreview?: PowerPreview;
}

/**
 * Shared battlefield rendering for SiegeScene and the sandbox playground:
 * a thin, interpolated, immediate-mode layer over the deterministic sim.
 */
export class BattleRenderer {
  private readonly scene: Phaser.Scene;
  private readonly engine: Engine;
  private readonly cell: number;
  private readonly staticLayer: Phaser.GameObjects.Graphics;
  private readonly dynLayer: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];

  constructor(scene: Phaser.Scene, engine: Engine, cellPx: number) {
    this.scene = scene;
    this.engine = engine;
    this.cell = cellPx;
    this.staticLayer = scene.add.graphics();
    this.dynLayer = scene.add.graphics();
    this.drawStaticLayer();
  }

  // ---- static layer -----------------------------------------------------------

  private drawStaticLayer(): void {
    const grid = this.engine.grid;
    const c = this.cell;
    const g = this.staticLayer;
    drawFieldBase(g, grid.width, grid.height, c, this.engine.config.spawnColumn);

    // Tunnel mouths (reserved cells): the enemy owns this ground.
    for (const cell of this.engine.config.reservedCells ?? []) {
      const center = grid.centerOf(cell);
      const px = center.x * c;
      const py = center.y * c;
      g.fillStyle(0x000000, 0.8);
      g.fillCircle(px, py, 11);
      g.lineStyle(2, COLORS.nkSlate, 1);
      g.strokeCircle(px, py, 11);
      g.lineStyle(2, COLORS.crimson, 0.8);
      g.strokeCircle(px, py, 15);
      g.fillStyle(COLORS.nkSlate, 1);
      g.fillRect(px - 6, py - 1.5, 12, 3);
    }

    // Command Center label (the block itself is drawn dynamically for HP shading).
    const cc = this.engine.cc;
    this.scene.add
      .text(cc.center.x * c, cc.center.y * c, 'CC', mono(13, COLORS.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(5);
  }

  // ---- events → transient effects ---------------------------------------------------

  consumeEvents(events: SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'shot':
          this.effects.push({
            kind: 'tracer',
            x: event.from.x,
            y: event.from.y,
            x2: event.to.x,
            y2: event.to.y,
            color: tracerColor(event.damageType),
            age: 0,
            life: 0.1,
          });
          break;
        case 'attackerDied':
          this.effects.push({ kind: 'boom', x: event.at.x, y: event.at.y, age: 0, life: 0.35 });
          break;
        case 'wallDestroyed': {
          const at = this.engine.grid.centerOf(event.cell);
          this.effects.push({ kind: 'wallBoom', x: at.x, y: at.y, age: 0, life: 0.4 });
          break;
        }
        case 'structureDestroyed':
          this.effects.push({ kind: 'structBoom', x: event.at.x, y: event.at.y, age: 0, life: 0.5 });
          break;
        case 'aoe':
          this.effects.push({
            kind: 'aoe',
            x: event.at.x,
            y: event.at.y,
            radius: event.radius,
            age: 0,
            life: 0.45,
          });
          break;
        case 'strafePulse':
          this.effects.push({
            kind: 'strafe',
            x: event.x0,
            y: event.y,
            x2: event.x1,
            age: 0,
            life: 0.3,
          });
          break;
        case 'powerCast':
          this.effects.push({ kind: 'reticle', x: event.at.x, y: event.at.y, age: 0, life: 0.8 });
          break;
        default:
          break;
      }
    }
  }

  // ---- dynamic layer -------------------------------------------------------------------

  draw(alpha: number, dtSeconds: number, opts: DrawOptions): void {
    const g = this.dynLayer;
    g.clear();
    this.drawWalls(g);
    if (opts.showPaths) this.drawPaths(g, alpha);
    this.drawStructures(g);
    this.drawAttackers(g, alpha);
    this.drawProjectiles(g, alpha);
    if (opts.ghost) this.drawGhost(g, opts.ghost);
    if (opts.powerPreview) this.drawPowerPreview(g, opts.powerPreview);
    this.drawEffects(g, dtSeconds);
  }

  private drawWalls(g: Phaser.GameObjects.Graphics): void {
    const grid = this.engine.grid;
    const c = this.cell;
    for (const [cell, wall] of grid.walls) {
      drawWallGlyph(g, grid.xOf(cell) * c, grid.yOf(cell) * c, c, wall.kind, wall.hp / wall.maxHp);
    }
  }

  private drawStructures(g: Phaser.GameObjects.Graphics): void {
    const c = this.cell;
    for (const s of this.engine.structures) {
      const px = s.center.x * c;
      const py = s.center.y * c;
      drawStructureGlyph(g, s.profile.kind, px, py, c, { level: s.level, inert: s.inert });
      if (s.profile.kind === 'claymore') {
        g.lineStyle(1, COLORS.signal, 0.35);
        g.strokeCircle(px, py, (s.profile.trigger?.radius ?? 0.8) * c);
      }
      if (s.profile.kind === 'cc') {
        this.hpBar(g, px, (s.center.y - 1) * c - 6, 2 * c - 8, s.hp / s.profile.maxHp, true);
      } else if (s.hp < s.profile.maxHp) {
        this.hpBar(g, px, py - 16, 22, s.hp / s.profile.maxHp, false);
      }
    }
  }

  private drawPaths(g: Phaser.GameObjects.Graphics, alpha: number): void {
    const grid = this.engine.grid;
    const c = this.cell;
    for (const attacker of this.engine.attackers) {
      if (!attacker.path) continue;
      const heavyBreaker = attacker.profile.wallDps > 20;
      g.lineStyle(1.5, heavyBreaker ? COLORS.signal : COLORS.crimson, 0.2);
      g.beginPath();
      const p = this.lerpPos(attacker, alpha);
      g.moveTo(p.x * c, p.y * c);
      for (let i = attacker.pathIndex; i < attacker.path.length; i++) {
        const wp = grid.centerOf(attacker.path[i]!);
        g.lineTo(wp.x * c, wp.y * c);
      }
      g.strokePath();
      for (let i = attacker.pathIndex; i < attacker.path.length; i++) {
        const cellIndex = attacker.path[i]!;
        if (grid.wallAt(cellIndex) || this.engine.structureAt(cellIndex)?.profile.blocks) {
          const wp = grid.centerOf(cellIndex);
          g.fillStyle(COLORS.signal, 0.5);
          g.fillCircle(wp.x * c, wp.y * c, 4);
        }
      }
    }
  }

  private drawAttackers(g: Phaser.GameObjects.Graphics, alpha: number): void {
    const c = this.cell;
    for (const attacker of this.engine.attackers) {
      const p = this.lerpPos(attacker, alpha);
      const px = p.x * c;
      const py = p.y * c;
      this.drawAttackerBody(g, attacker, px, py);

      if (attacker.state === 'breaking') {
        g.lineStyle(2, COLORS.tracer, 0.8);
        g.strokeCircle(px, py, 12);
      } else if (attacker.state === 'engaging') {
        g.lineStyle(1, COLORS.tracerExplosive, 0.6);
        g.strokeCircle(px, py, 11);
      }

      const hpFrac = attacker.hp / attacker.profile.maxHp;
      if (hpFrac < 1) this.hpBar(g, px, py - 16, 20, hpFrac, false);
    }
  }

  private drawAttackerBody(
    g: Phaser.GameObjects.Graphics,
    attacker: Attacker,
    px: number,
    py: number,
  ): void {
    switch (attacker.profile.kind) {
      case 'militia':
        g.fillStyle(COLORS.crimson, 1);
        g.fillCircle(px, py, 5);
        break;
      case 'rifle':
        g.fillStyle(COLORS.crimson, 1);
        g.fillCircle(px, py, 7);
        g.lineStyle(1, COLORS.crimsonDark, 1);
        g.strokeCircle(px, py, 7);
        break;
      case 'sapper':
        g.fillStyle(COLORS.signal, 1);
        g.fillPoints(
          [
            { x: px, y: py - 8 },
            { x: px + 8, y: py },
            { x: px, y: py + 8 },
            { x: px - 8, y: py },
          ],
          true,
        );
        break;
      case 'grenadier':
        g.fillStyle(COLORS.crimson, 1);
        g.fillTriangle(px - 6, py - 7, px - 6, py + 7, px + 8, py);
        g.fillStyle(COLORS.signal, 1);
        g.fillCircle(px - 2, py, 2);
        break;
      case 'infiltrator':
        g.fillStyle(COLORS.nkSlate, 1);
        g.fillPoints(
          [
            { x: px, y: py - 7 },
            { x: px + 5, y: py },
            { x: px, y: py + 7 },
            { x: px - 5, y: py },
          ],
          true,
        );
        g.lineStyle(1, COLORS.ink, 0.6);
        g.strokeCircle(px, py, 8);
        break;
      case 't72':
        g.fillStyle(COLORS.ruRust, 1);
        g.fillRect(px - 11, py - 7, 22, 14);
        g.lineStyle(2, COLORS.sand, 0.7);
        g.strokeRect(px - 11, py - 7, 22, 14);
        g.fillStyle(COLORS.sandDark, 1);
        g.fillCircle(px, py, 4);
        g.lineStyle(3, COLORS.ruRust, 1);
        g.lineBetween(px, py, px + 15, py);
        break;
      case 'zbd':
        g.fillStyle(COLORS.crimsonDark, 1);
        g.fillRect(px - 9, py - 6, 18, 12);
        g.lineStyle(1, COLORS.crimson, 1);
        g.strokeRect(px - 9, py - 6, 18, 12);
        g.lineStyle(2, COLORS.crimson, 1);
        g.lineBetween(px, py, px + 12, py);
        break;
      case 'type99':
        g.fillStyle(COLORS.crimsonDark, 1);
        g.fillRect(px - 12, py - 8, 24, 16);
        g.lineStyle(2, COLORS.crimson, 1);
        g.strokeRect(px - 12, py - 8, 24, 16);
        g.fillStyle(COLORS.crimson, 1);
        g.fillCircle(px, py, 5);
        g.lineStyle(3, COLORS.crimson, 1);
        g.lineBetween(px, py, px + 16, py);
        break;
      default:
        // Unknown kinds (test/sandbox content): breakers as diamonds, rest as circles.
        if (attacker.profile.wallDps > 20) {
          g.fillStyle(COLORS.signal, 1);
          g.fillPoints(
            [
              { x: px, y: py - 8 },
              { x: px + 8, y: py },
              { x: px, y: py + 8 },
              { x: px - 8, y: py },
            ],
            true,
          );
        } else {
          g.fillStyle(COLORS.crimson, 1);
          g.fillCircle(px, py, 7);
        }
        break;
    }
  }

  private drawProjectiles(g: Phaser.GameObjects.Graphics, alpha: number): void {
    const c = this.cell;
    for (const shell of this.engine.projectiles) {
      const flight = shell.impactTick - shell.firedTick;
      if (flight <= 0) continue;
      const t = Phaser.Math.Clamp(
        (this.engine.tick - shell.firedTick - 1 + alpha) / flight,
        0,
        1,
      );
      const x = shell.from.x + (shell.to.x - shell.from.x) * t;
      const y = shell.from.y + (shell.to.y - shell.from.y) * t - Math.sin(t * Math.PI) * 1.4;
      g.fillStyle(COLORS.sand, 1);
      g.fillCircle(x * c, y * c, 3);
      g.fillStyle(COLORS.sand, 0.3);
      g.fillCircle(x * c, y * c, 6);
      // Impact point marker while the shell is up.
      g.lineStyle(1, COLORS.signal, 0.4);
      g.strokeCircle(shell.to.x * c, shell.to.y * c, shell.splashRadius * c * 0.6);
    }
  }

  private drawGhost(g: Phaser.GameObjects.Graphics, ghost: GhostPreview): void {
    const grid = this.engine.grid;
    const c = this.cell;
    const x = grid.xOf(ghost.cell) * c;
    const y = grid.yOf(ghost.cell) * c;
    const color = ghost.valid ? COLORS.olive : COLORS.alarm;
    g.fillStyle(color, 0.25);
    g.fillRect(x + 1, y + 1, c - 2, c - 2);
    g.lineStyle(1, color, 0.8);
    g.strokeRect(x + 1, y + 1, c - 2, c - 2);

    const profile = this.engine.catalog.structures[ghost.kind];
    const weapon = profile?.weapon;
    if (weapon) {
      const center = grid.centerOf(ghost.cell);
      g.lineStyle(1, color, 0.35);
      g.strokeCircle(center.x * c, center.y * c, weapon.range * c);
      if (weapon.minRange) {
        g.lineStyle(1, COLORS.alarm, 0.3);
        g.strokeCircle(center.x * c, center.y * c, weapon.minRange * c);
      }
    }
  }

  private drawPowerPreview(g: Phaser.GameObjects.Graphics, preview: PowerPreview): void {
    const def = this.engine.catalog.powers[preview.kind];
    if (!def) return;
    const c = this.cell;
    const { x, y } = preview.at;
    g.lineStyle(1.5, COLORS.signal, 0.7);
    if (def.type === 'strafe') {
      g.strokeRect(
        (x - def.halfLength) * c,
        (y - def.halfWidth) * c,
        def.halfLength * 2 * c,
        def.halfWidth * 2 * c,
      );
      g.lineBetween((x - def.halfLength - 1) * c, y * c, (x - def.halfLength) * c, y * c);
    } else {
      g.strokeCircle(x * c, y * c, def.scatter * c);
      g.lineStyle(1, COLORS.signal, 0.4);
      g.strokeCircle(x * c, y * c, def.splashRadius * c);
    }
    g.lineStyle(1, COLORS.signal, 0.8);
    g.lineBetween(x * c - 6, y * c, x * c + 6, y * c);
    g.lineBetween(x * c, y * c - 6, x * c, y * c + 6);
  }

  private drawEffects(g: Phaser.GameObjects.Graphics, dtSeconds: number): void {
    const c = this.cell;
    this.effects = this.effects.filter((fx) => (fx.age += dtSeconds) < fx.life);
    for (const fx of this.effects) {
      const t = fx.age / fx.life;
      switch (fx.kind) {
        case 'tracer':
          g.lineStyle(1.5, fx.color ?? COLORS.tracer, 0.9 * (1 - t));
          g.lineBetween(fx.x * c, fx.y * c, fx.x2! * c, fx.y2! * c);
          // Impact flash on the target.
          g.fillStyle(fx.color ?? COLORS.tracer, 0.8 * (1 - t));
          g.fillCircle(fx.x2! * c, fx.y2! * c, 3.5 * (1 - t) + 1);
          break;
        case 'boom':
          g.lineStyle(2, COLORS.signal, 0.8 * (1 - t));
          g.strokeCircle(fx.x * c, fx.y * c, 4 + 12 * t);
          break;
        case 'wallBoom':
          g.lineStyle(3, COLORS.sand, 0.8 * (1 - t));
          g.strokeCircle(fx.x * c, fx.y * c, 6 + 14 * t);
          break;
        case 'structBoom':
          g.lineStyle(3, COLORS.signal, 0.9 * (1 - t));
          g.strokeCircle(fx.x * c, fx.y * c, 8 + 20 * t);
          g.lineStyle(1, COLORS.tracer, 0.7 * (1 - t));
          g.strokeCircle(fx.x * c, fx.y * c, 4 + 26 * t);
          break;
        case 'aoe':
          g.lineStyle(3, COLORS.tracerExplosive, 0.85 * (1 - t));
          g.strokeCircle(fx.x * c, fx.y * c, (fx.radius ?? 1) * c * (0.4 + 0.6 * t));
          g.fillStyle(COLORS.tracerExplosive, 0.25 * (1 - t));
          g.fillCircle(fx.x * c, fx.y * c, (fx.radius ?? 1) * c * 0.5 * (1 - t * 0.5));
          break;
        case 'strafe': {
          const midY = fx.y * c;
          g.fillStyle(COLORS.tracerKinetic, 0.5 * (1 - t));
          g.fillRect(fx.x * c, midY - 12, (fx.x2! - fx.x) * c, 24);
          g.lineStyle(2, COLORS.tracerKinetic, 0.9 * (1 - t));
          for (let i = 0; i < 4; i++) {
            const lx = (fx.x + ((fx.x2! - fx.x) * (i + 0.5)) / 4) * c;
            g.lineBetween(lx, midY - 14, lx + 6, midY + 14);
          }
          break;
        }
        case 'reticle':
          g.lineStyle(2, COLORS.signal, 0.9 * (1 - t));
          g.strokeCircle(fx.x * c, fx.y * c, 10 + 6 * Math.sin(t * Math.PI * 4));
          g.lineBetween(fx.x * c - 14, fx.y * c, fx.x * c + 14, fx.y * c);
          g.lineBetween(fx.x * c, fx.y * c - 14, fx.x * c, fx.y * c + 14);
          break;
      }
    }
  }

  private hpBar(
    g: Phaser.GameObjects.Graphics,
    centerX: number,
    y: number,
    width: number,
    fraction: number,
    isFriendly: boolean,
  ): void {
    const frac = Math.max(0, Math.min(1, fraction));
    g.fillStyle(0x000000, 0.6);
    g.fillRect(centerX - width / 2, y, width, 3);
    g.fillStyle(
      frac > 0.4 ? (isFriendly ? COLORS.intel : COLORS.olive) : COLORS.signal,
      1,
    );
    g.fillRect(centerX - width / 2, y, width * frac, 3);
  }

  private lerpPos(attacker: Attacker, alpha: number): Vec2 {
    return {
      x: attacker.prevPos.x + (attacker.pos.x - attacker.prevPos.x) * alpha,
      y: attacker.prevPos.y + (attacker.pos.y - attacker.prevPos.y) * alpha,
    };
  }
}

function tracerColor(type: DamageType): number {
  switch (type) {
    case 'kinetic':
      return COLORS.tracerKinetic;
    case 'explosive':
    case 'shaped':
      return COLORS.tracerExplosive;
    default:
      return COLORS.tracer;
  }
}
