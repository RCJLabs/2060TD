import Phaser from 'phaser';
import type { Attacker, Engine } from '../sim/engine';
import type { CellIndex, DamageType, SimEvent, Vec2 } from '../sim/types';
import { audio } from './audio';
import { drawAttackerGlyph, drawStructureGlyph, drawWallGlyph, wallJoins } from './glyphs';
import { makeSheet } from './ground';
import { COLORS } from './palette';

interface Effect {
  kind: 'tracer' | 'boom' | 'wallBoom' | 'structBoom' | 'aoe' | 'strafe' | 'reticle' | 'flash';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  color?: number;
  age: number;
  life: number;
}

/** How high the air layer rides above its own shadow, in world px. */
const AIR_LIFT = 15;

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
  private readonly container: Phaser.GameObjects.Container | undefined;
  private readonly hostileStructures: boolean;
  /** The baked topographic sheet. The world container owns it, so scene
   *  shutdown frees the texture with everything else. */
  private sheet: Phaser.GameObjects.RenderTexture | null = null;
  private readonly staticLayer: Phaser.GameObjects.Graphics;
  private readonly dynLayer: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  /** Last firing direction per structure id — barrels track their targets. */
  private readonly barrelDirs = new Map<number, number>();
  /** Last movement heading per attacker id — vehicles keep facing when halted. */
  private readonly facings = new Map<number, number>();

  constructor(
    scene: Phaser.Scene,
    engine: Engine,
    cellPx: number,
    hostileStructures = false,
    /** World container when the scene splits board and HUD across cameras. */
    container?: Phaser.GameObjects.Container,
  ) {
    this.scene = scene;
    this.engine = engine;
    this.cell = cellPx;
    this.hostileStructures = hostileStructures;
    this.container = container;
    this.staticLayer = scene.add.graphics();
    this.dynLayer = scene.add.graphics();
    container?.add([this.staticLayer, this.dynLayer]);
    this.drawStaticLayer();
  }

  // ---- static layer -----------------------------------------------------------

  private drawStaticLayer(): void {
    const grid = this.engine.grid;
    const c = this.cell;
    const g = this.staticLayer;
    // The sheet is a baked texture, not commands: it goes in behind the
    // static graphics rather than into them.
    this.sheet = makeSheet(this.scene, {
      width: grid.width,
      height: grid.height,
      cell: c,
      terrain: this.engine.terrain,
      spawnColumn: this.engine.config.spawnColumn,
    });
    this.container?.addAt(this.sheet, 0);

    // Tunnel mouths (reserved cells): the enemy owns this ground.
    for (const cell of this.engine.config.reservedCells ?? []) {
      const center = grid.centerOf(cell);
      const px = center.x * c;
      const py = center.y * c;
      // A shaft mouth is a hole in the ground, and reads as one — but it
      // needs the same paper knockout everything else on the sheet gets.
      g.fillStyle(COLORS.paperWarm, 0.92);
      g.fillCircle(px, py, 17);
      g.fillStyle(COLORS.oliveDark, 0.92);
      g.fillCircle(px, py, 11);
      g.lineStyle(2, COLORS.nkSlate, 1);
      g.strokeCircle(px, py, 11);
      g.lineStyle(2, COLORS.crimson, 0.8);
      g.strokeCircle(px, py, 15);
      g.fillStyle(COLORS.nkSlate, 1);
      g.fillRect(px - 6, py - 1.5, 12, 3);
    }

  }

  // ---- events → transient effects ---------------------------------------------------

  consumeEvents(events: SimEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'shot': {
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
          this.effects.push({ kind: 'flash', x: event.from.x, y: event.from.y, age: 0, life: 0.07 });
          // Track the shooter's barrel when the shot came from an emplacement.
          for (const s of this.engine.structures) {
            if (s.center.x === event.from.x && s.center.y === event.from.y) {
              this.barrelDirs.set(
                s.id,
                Math.atan2(event.to.y - event.from.y, event.to.x - event.from.x),
              );
              break;
            }
          }
          audio.sfx(
            event.damageType === 'explosive' || event.damageType === 'shaped' ? 'shotHeavy' : 'shot',
          );
          break;
        }
        case 'attackerDied':
          this.effects.push({ kind: 'boom', x: event.at.x, y: event.at.y, age: 0, life: 0.35 });
          this.facings.delete(event.id);
          audio.sfx('shotHeavy');
          break;
        case 'wallDestroyed': {
          const at = this.engine.grid.centerOf(event.cell);
          this.effects.push({ kind: 'wallBoom', x: at.x, y: at.y, age: 0, life: 0.4 });
          audio.sfx('wallBreak');
          break;
        }
        case 'structureDestroyed':
          this.effects.push({ kind: 'structBoom', x: event.at.x, y: event.at.y, age: 0, life: 0.5 });
          this.barrelDirs.delete(event.id);
          audio.sfx('structureDown');
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
          audio.sfx('explosion');
          break;
        // A reserve standing up (v1.20). A slow ring rather than a blast: the
        // player needs to notice that the base just answered, and to be able
        // to tell that answer apart from something going off.
        case 'garrisonDeployed':
          this.effects.push({
            kind: 'aoe',
            x: event.at.x,
            y: event.at.y,
            radius: 1.6,
            age: 0,
            life: 0.8,
          });
          audio.sfx('radio');
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
          audio.sfx('explosion');
          break;
        case 'powerCast':
          this.effects.push({ kind: 'reticle', x: event.at.x, y: event.at.y, age: 0, life: 0.8 });
          audio.sfx('power');
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
    const wire = new Set(grid.walls.keys());
    // Knockouts first, then segments: see WallPass.
    for (const pass of ['halo', 'ink'] as const) {
      for (const [cell, wall] of grid.walls) {
        drawWallGlyph(
          g,
          grid.xOf(cell) * c,
          grid.yOf(cell) * c,
          c,
          wall.kind,
          wall.hp / wall.maxHp,
          wall.open === true,
          wallJoins(wire, cell, grid.width),
          pass,
        );
      }
    }
  }

  private drawStructures(g: Phaser.GameObjects.Graphics): void {
    const c = this.cell;
    for (const s of this.engine.structures) {
      const px = s.center.x * c;
      const py = s.center.y * c;
      const aim = this.barrelDirs.get(s.id);
      drawStructureGlyph(g, s.profile.kind, px, py, c, {
        level: s.level,
        inert: s.inert,
        hostile: this.hostileStructures,
        ...(aim !== undefined ? { aimAngle: aim } : {}),
      });
      if (s.profile.kind === 'claymore') {
        g.lineStyle(1, COLORS.signal, 0.35);
        g.strokeCircle(px, py, (s.profile.trigger?.radius ?? 0.8) * c);
      }
      if (s.profile.aura && !s.inert) {
        // Sustainment radius: the blue circle everything shelters inside.
        g.lineStyle(1, COLORS.unBlue, 0.3);
        g.strokeCircle(px, py, s.profile.aura.radius * c);
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
      const pathColor = this.hostileStructures
        ? heavyBreaker
          ? COLORS.tracer
          : COLORS.intel
        : heavyBreaker
          ? COLORS.signal
          : COLORS.crimson;
      g.lineStyle(1.5, pathColor, 0.2);
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
    // Ground layer first, then the air layer above it: altitude has to read
    // at a glance, because it decides which of your guns can answer.
    for (const flying of [false, true]) {
      for (const attacker of this.engine.attackers) {
        if ((attacker.profile.air === true) !== flying) continue;
        const p = this.lerpPos(attacker, alpha);
        const px = p.x * c;
        const py = p.y * c;
        if (attacker.lastDir.x !== 0 || attacker.lastDir.y !== 0) {
          this.facings.set(attacker.id, Math.atan2(attacker.lastDir.y, attacker.lastDir.x));
        }
        if (flying) {
          // The shadow is the honest position; the body is where it is in the sky.
          g.fillStyle(COLORS.marg, 0.3);
          g.fillEllipse(px, py + 3, 16, 7);
        }
        const y = py - (flying ? AIR_LIFT : 0);
        drawAttackerGlyph(g, attacker.profile.kind, px, y, this.cell, {
          // In raids (hostileStructures) the attacking units are the
          // player's own; defending, they are the enemy.
          friendly: this.hostileStructures,
          facing: this.facings.get(attacker.id) ?? 0,
          wallDps: attacker.profile.wallDps,
        });

        if (attacker.state === 'breaking') {
          g.lineStyle(2, COLORS.tracer, 0.8);
          g.strokeCircle(px, y, 12);
        } else if (attacker.state === 'engaging') {
          g.lineStyle(1, COLORS.tracerExplosive, 0.6);
          g.strokeCircle(px, y, 11);
        }

        const hpFrac = attacker.hp / attacker.maxHp;
        if (hpFrac < 1) this.hpBar(g, px, y - 16, 20, hpFrac, false);
      }
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
        case 'flash':
          // Muzzle flash: a hot dot that dies in a few frames.
          g.fillStyle(COLORS.tracer, 0.9 * (1 - t));
          g.fillCircle(fx.x * c, fx.y * c, 4.5 * (1 - t) + 1.5);
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
    // A gauge drawn on the sheet: paper backing, ink fill, and alarm only when
    // it matters. Blue was legible on a dark board and is a shout on paper.
    g.fillStyle(COLORS.paperWarm, 0.95);
    g.fillRect(centerX - width / 2 - 1, y - 1, width + 2, 5);
    g.fillStyle(
      frac > 0.4 ? (isFriendly ? COLORS.oliveDark : COLORS.crimsonDark) : COLORS.alarm,
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
