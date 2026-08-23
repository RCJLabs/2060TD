import Phaser from 'phaser';
import type { Attacker, Engine } from '../sim/engine';
import type { CellIndex, DamageType, SimEvent, Vec2 } from '../sim/types';
import { audio } from './audio';
import { drawFieldBase, drawStructureGlyph, drawWallGlyph } from './glyphs';
import { COLORS } from './palette';
import { mono } from './ui';

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
    const label = this.scene.add
      .text(cc.center.x * c, cc.center.y * c, 'CC', mono(13, COLORS.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(5);
    // Must ride the world layer, or the HUD camera draws a second copy.
    this.container?.add(label);
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
    for (const [cell, wall] of grid.walls) {
      drawWallGlyph(
        g,
        grid.xOf(cell) * c,
        grid.yOf(cell) * c,
        c,
        wall.kind,
        wall.hp / wall.maxHp,
        wall.open === true,
      );
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
          g.fillStyle(0x000000, 0.35);
          g.fillEllipse(px, py + 3, 16, 7);
        }
        const y = py - (flying ? AIR_LIFT : 0);
        this.drawAttackerBody(g, attacker, px, y);

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

  private drawAttackerBody(
    g: Phaser.GameObjects.Graphics,
    attacker: Attacker,
    px: number,
    py: number,
  ): void {
    // Color is allegiance, shape is role: in raids (hostileStructures) the
    // attacking units are the player's own — olive; defending, they're the
    // enemy — crimson. Faction cameos (NK, RU) keep their own tints.
    const friendly = this.hostileStructures;
    const body = friendly ? COLORS.olive : COLORS.crimson;
    const dark = friendly ? COLORS.oliveDark : COLORS.crimsonDark;

    switch (attacker.profile.kind) {
      // ---- swarm infantry: small plain circles --------------------------------
      case 'militia':
      case 'guardsman':
      case 'conscript':
        g.fillStyle(body, 1);
        g.fillCircle(px, py, 5);
        break;
      // ---- line infantry: ringed circles --------------------------------------
      case 'rifle':
      case 'ranger':
      case 'motorrifle':
      case 'nkrifle':
      case 'peacekeeper':
        g.fillStyle(body, 1);
        g.fillCircle(px, py, 7);
        g.lineStyle(1, dark, 1);
        g.strokeCircle(px, py, 7);
        break;
      // ---- breachers: diamonds (sapper reads as pure alarm) --------------------
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
      case 'engineer':
      case 'demoteam':
      case 'tunneler':
      case 'unsapper':
        g.fillStyle(body, 1);
        g.fillPoints(
          [
            { x: px, y: py - 8 },
            { x: px + 8, y: py },
            { x: px, y: py + 8 },
            { x: px - 8, y: py },
          ],
          true,
        );
        g.fillStyle(COLORS.tracer, 1);
        g.fillCircle(px, py, 2);
        break;
      // ---- standoff fire teams: arrowheads face their heading ---------------------
      case 'grenadier':
      case 'javelin':
      case 'rpg':
      case 'rpg7':
      case 'nlaw': {
        const angle = this.facings.get(attacker.id) ?? 0;
        g.save();
        g.translateCanvas(px, py);
        g.rotateCanvas(angle);
        g.fillStyle(body, 1);
        g.fillTriangle(-6, -7, -6, 7, 8, 0);
        g.fillStyle(attacker.profile.kind === 'grenadier' ? COLORS.signal : COLORS.intel, 1);
        g.fillCircle(-2, 0, 2);
        g.restore();
        break;
      }
      // ---- light vehicles: small hulls, facing their heading ----------------------
      case 'humvee':
      case 'zbd':
      case 'btr':
      case 'vab': {
        const angle = this.facings.get(attacker.id) ?? 0;
        g.save();
        g.translateCanvas(px, py);
        g.rotateCanvas(angle);
        g.fillStyle(dark, 1);
        g.fillRect(-9, -6, 18, 12);
        g.lineStyle(1, body, 1);
        g.strokeRect(-9, -6, 18, 12);
        g.lineStyle(2, body, 1);
        g.lineBetween(0, 0, 12, 0);
        g.restore();
        break;
      }
      // ---- main battle tanks: big hulls with turret + barrel -----------------------
      case 'abrams':
      case 'type99':
      case 't72':
      case 'chonma':
      case 'leo1': {
        const angle = this.facings.get(attacker.id) ?? 0;
        g.save();
        g.translateCanvas(px, py);
        g.rotateCanvas(angle);
        g.fillStyle(dark, 1);
        g.fillRect(-12, -8, 24, 16);
        g.lineStyle(2, body, 1);
        g.strokeRect(-12, -8, 24, 16);
        g.fillStyle(body, 1);
        g.fillCircle(0, 0, 5);
        g.lineStyle(3, body, 1);
        g.lineBetween(0, 0, 16, 0);
        g.restore();
        break;
      }
      // ---- the air layer: rotor disc over a fuselage, facing its run ----------
      case 'reaper':
      case 'wz10':
      case 'ka52':
      case 'an2':
      case 'nh90': {
        const angle = this.facings.get(attacker.id) ?? 0;
        g.save();
        g.translateCanvas(px, py);
        g.rotateCanvas(angle);
        g.lineStyle(1, body, 0.45);
        g.strokeCircle(0, 0, 13); // the disc: nothing on the ground reaches it
        g.fillStyle(dark, 1);
        g.fillTriangle(-9, -5, -9, 5, 13, 0);
        g.lineStyle(1, body, 1);
        g.strokeTriangle(-9, -5, -9, 5, 13, 0);
        g.lineStyle(2, body, 0.9);
        g.lineBetween(-7, -9, -7, 9); // tail plane
        g.restore();
        break;
      }
      case 'unmedic': {
        // The only unit in the war that keeps others alive: allegiance
        // body, blue cross, and the faint reach of the aid it carries.
        const reach = (attacker.profile.heal?.radius ?? 2.5) * this.cell;
        g.lineStyle(1, COLORS.unBlue, 0.22);
        g.strokeCircle(px, py, reach);
        g.fillStyle(body, 1);
        g.fillCircle(px, py, 6);
        g.fillStyle(COLORS.unBlue, 1);
        g.fillRect(px - 4, py - 1.5, 8, 3);
        g.fillRect(px - 1.5, py - 4, 3, 8);
        break;
      }
      case 'infiltrator':
        // The M3 cameo keeps its slate tint; in an NK raid they're yours.
        g.fillStyle(friendly ? body : COLORS.nkSlate, 1);
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
          g.fillStyle(body, 1);
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
