import Phaser from 'phaser';
import type { Attacker, Engine } from '../sim/engine';
import type { CellIndex, DamageType, SimEvent, Vec2 } from '../sim/types';
import { audio } from './audio';
import { drawAttackerGlyph, drawStructureGlyph, drawWallGlyph, wallJoins } from './glyphs';
import { makeSheet } from './ground';
import { focusLines, phaseAt, punch, speedLines, starPoints } from './kinetics';
import { COLORS, css } from './palette';
import { DISPLAY_FAMILY } from './ui';

interface Effect {
  kind:
    | 'tracer'
    | 'boom'
    | 'wallBoom'
    | 'structBoom'
    | 'aoe'
    | 'strafe'
    | 'reticle'
    | 'flash'
    | 'shout';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  color?: number;
  /** Lettering: the word, and the pool slot drawing it. */
  word?: string;
  size?: number;
  age: number;
  life: number;
}

/**
 * What the page shouts, and at what.
 *
 * A comic does not draw an explosion, it LETTERS one — and this direction was
 * missing the single most recognisable thing it does. One word per event
 * kind, picked deterministically from where it happened so a hit keeps the
 * same word for as long as it is on screen.
 *
 * Kept to three families on purpose: a breach, a building going, and a shell
 * landing are the three things in a siege worth interrupting the page for. A
 * word on every rifle shot would be noise with an outline round it.
 */
const SHOUTS: Record<string, readonly string[]> = {
  wallBoom: ['KRRAK', 'SHRAAK', 'KRAKK'],
  structBoom: ['WHUMP', 'KRUMPH', 'DOOM'],
  aoe: ['WHAM', 'BLAM', 'KRUMP'],
};

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
  /** The baked page. The world container owns it, and `makeSheet` wires the
   *  canvas texture's release to this object's destroy. */
  private sheet: Phaser.GameObjects.Image | null = null;
  private readonly staticLayer: Phaser.GameObjects.Graphics;
  private readonly dynLayer: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  /** Last firing direction per structure id — barrels track their targets. */
  private readonly barrelDirs = new Map<number, number>();
  /** Last movement heading per attacker id — vehicles keep facing when halted. */
  private readonly facings = new Map<number, number>();
  /** Pooled lettering. Lives in the world container, so it pans and zooms. */
  private readonly shouts: Phaser.GameObjects.Text[] = [];

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
      spawnLane: this.engine.config.spawnLane,
      spawnEdge: this.engine.config.spawnEdge ?? 'west',
    });
    if (this.sheet) this.container?.addAt(this.sheet, 0);

    // Tunnel mouths (reserved cells): the enemy owns this ground.
    for (const cell of this.engine.config.reservedCells ?? []) {
      const center = grid.centerOf(cell);
      const px = center.x * c;
      const py = center.y * c;
      // A shaft mouth is a hole in the ground, and reads as one — but it
      // needs the same paper knockout everything else on the sheet gets.
      g.fillStyle(COLORS.bgField, 1);
      g.fillCircle(px, py, 17);
      g.lineStyle(2, COLORS.oliveDark, 1);
      g.strokeCircle(px, py, 16);
      g.fillStyle(COLORS.oliveDark, 1);
      g.fillCircle(px, py, 11);
      // The shoring across the mouth, knocked out of the hole in paper.
      g.fillStyle(COLORS.bgField, 1);
      g.fillRect(px - 8, py - 1.5, 16, 3);
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
          // A breach is the moment the battle turns, and it used to be a ring
          // that was gone in four tenths of a second. It gets long enough to
          // land, and it gets lettered.
          const at = this.engine.grid.centerOf(event.cell);
          this.effects.push({ kind: 'wallBoom', x: at.x, y: at.y, age: 0, life: 0.7 });
          this.shout('wallBoom', at.x, at.y, 0.8, 1);
          audio.sfx('wallBreak');
          break;
        }
        case 'structureDestroyed':
          this.effects.push({ kind: 'structBoom', x: event.at.x, y: event.at.y, age: 0, life: 0.9 });
          this.shout('structBoom', event.at.x, event.at.y, 1, 1.25);
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
          this.shout('aoe', event.at.x, event.at.y, 0.65, 0.85);
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
        // The battle's own footprint, which is the one it was fought at: a
        // replay from a board of another cell size draws its buildings at
        // the size they had, not at the size today's board would give them.
        footprint: s.profile.footprint === 2 ? 2 : 1,
        level: s.level,
        inert: s.inert,
        hostile: this.hostileStructures,
        ...(aim !== undefined ? { aimAngle: aim } : {}),
      });
      if (s.profile.kind === 'claymore') {
        this.radius(g, px, py, (s.profile.trigger?.radius ?? 0.8) * c, 5);
      }
      if (s.profile.aura && !s.inert) {
        // Sustainment radius: the circle everything shelters inside. Drawn as
        // ink ticks rather than a coloured ring — a radius is always on, and
        // the accent is for things that just happened.
        this.radius(g, px, py, s.profile.aura.radius * c, 3);
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
          // The shadow is the honest position; the body is where it is in the
          // sky. Drawn as an outline rather than a wash — a filled ellipse at
          // low alpha is a mid grey, and a drawn shadow also says "this is
          // where it is" rather than "this is a thing".
          g.lineStyle(1.2, COLORS.oliveDark, 0.8);
          g.strokeEllipse(px, py + 3, 16, 7);
        }
        // Speed lines behind anything moving fast enough to need them.
        //
        // Gated on MEASURED movement rather than on a unit kind: a rifleman
        // and a tank differ by how far they get in a tick, so the threshold
        // selects vehicles without this layer needing to know a roster. Four
        // lines, drawn only while the thing is actually moving, which is what
        // keeps a board of forty counters from paying for it.
        const moved = Math.hypot(p.x - attacker.prevPos.x, p.y - attacker.prevPos.y);
        if (!flying && moved > 0.055) {
          speedLines(
            g,
            px,
            py,
            this.facings.get(attacker.id) ?? 0,
            c * 0.85,
            c * 0.24,
            4,
            COLORS.oliveDark,
            0.85,
            Math.max(1, c * 0.045),
          );
        }
        const y = py - (flying ? AIR_LIFT : 0);
        drawAttackerGlyph(g, attacker.profile.kind, px, y, this.cell, {
          // In raids (hostileStructures) the attacking units are the
          // player's own; defending, they are the enemy.
          friendly: this.hostileStructures,
          facing: this.facings.get(attacker.id) ?? 0,
          wallDps: attacker.profile.wallDps,
        });

        if (attacker.pinnedUntil > this.engine.tick) {
          // Pinned under a fire mission (kill chain 6): four short strokes
          // closing on the unit, the page's mark for "under fire". It is doing
          // nothing else, so it wears no other ring.
          g.lineStyle(Math.max(1.5, c * 0.05), COLORS.alarm, 0.95);
          for (let k = 0; k < 4; k++) {
            const a = Math.PI / 4 + (k * Math.PI) / 2;
            g.lineBetween(
              px + Math.cos(a) * c * 0.46,
              y + Math.sin(a) * c * 0.46,
              px + Math.cos(a) * c * 0.3,
              y + Math.sin(a) * c * 0.3,
            );
          }
        } else if (attacker.state === 'breaking') {
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
    /** Pool slots are handed out per FRAME, so a word that died frees its. */
    let shoutSlot = 0;
    for (const fx of this.effects) {
      const t = fx.age / fx.life;
      // Ink does not fade to grey: an effect holds full value and then cuts.
      const a = punch(t);
      const x = fx.x * c;
      const y = fx.y * c;
      const ph = phaseAt(fx.x, fx.y);
      /** Paper inside an ink line — the two-pass shape everything here uses. */
      const burst = (outer: number, inner: number, spokes: number, core?: number): void => {
        const pts = starPoints(x, y, outer, inner, spokes, ph);
        g.fillStyle(COLORS.bgField, a);
        g.fillPoints(pts, true);
        g.lineStyle(Math.max(1.5, c * 0.075), COLORS.oliveDark, a);
        g.strokePoints(pts, true, true);
        if (core !== undefined) {
          g.fillStyle(COLORS.alarm, a);
          g.fillPoints(starPoints(x, y, core, core * 0.44, spokes, ph + 0.13), true);
        }
      };
      switch (fx.kind) {
        case 'tracer': {
          // A drawn round is a straight line with weight, not a glow.
          g.lineStyle(Math.max(1.5, c * 0.06), fx.color ?? COLORS.tracer, a);
          g.lineBetween(x, y, fx.x2! * c, fx.y2! * c);
          const hx = fx.x2! * c;
          const hy = fx.y2! * c;
          const hp = phaseAt(fx.x2!, fx.y2!);
          const pts = starPoints(hx, hy, c * 0.3 * (1 - t * 0.4), c * 0.11, 5, hp);
          g.fillStyle(COLORS.bgField, a);
          g.fillPoints(pts, true);
          g.lineStyle(Math.max(1.2, c * 0.05), COLORS.oliveDark, a);
          g.strokePoints(pts, true, true);
          break;
        }
        case 'boom':
          // A unit dies: one star, no focus lines. Those are for the wall.
          burst(c * (0.42 + 0.3 * t), c * 0.17, 7);
          break;
        case 'wallBoom':
          burst(c * (0.55 + 0.35 * t), c * 0.2, 8);
          focusLines(g, x, y, c * (0.7 + 0.4 * t), c * (1.5 + 1.1 * t), 7, ph, COLORS.oliveDark, a, Math.max(1.5, c * 0.07));
          break;
        case 'structBoom':
          // The money shot: something you built has gone. The only place on
          // the board the accent is allowed to be an area rather than a mark.
          burst(c * (0.85 + 0.5 * t), c * 0.3, 9, c * (0.38 + 0.2 * t));
          focusLines(g, x, y, c * (1.05 + 0.5 * t), c * (2.6 + 1.8 * t), 11, ph, COLORS.oliveDark, a, Math.max(2, c * 0.09));
          break;
        case 'aoe': {
          // Where it landed, as a ring of ticks rather than a wash: a filled
          // circle at any alpha is the mid grey this palette does not have.
          const r = (fx.radius ?? 1) * c * (0.45 + 0.55 * t);
          g.lineStyle(Math.max(1.5, c * 0.06), COLORS.alarm, a);
          g.beginPath();
          for (let i = 0; i < 18; i++) {
            const ang = (i / 18) * Math.PI * 2;
            g.moveTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
            g.lineTo(x + Math.cos(ang) * (r + c * 0.16), y + Math.sin(ang) * (r + c * 0.16));
          }
          g.strokePath();
          burst(c * (0.5 + 0.3 * t), c * 0.2, 8, c * 0.24);
          break;
        }
        case 'strafe': {
          // Speed lines down the run, and the run itself knocked out in paper
          // so the ground under it reads as blown past rather than covered.
          const midY = fx.y * c;
          const len = (fx.x2! - fx.x) * c;
          g.fillStyle(COLORS.bgField, a * 0.85);
          g.fillRect(x, midY - c * 0.34, len, c * 0.68);
          speedLines(g, fx.x2! * c, midY, 0, len, c * 0.3, 7, COLORS.oliveDark, a, Math.max(1.5, c * 0.055));
          break;
        }
        case 'reticle':
          // Four corner brackets: a mark the page would make, and it cannot
          // be mistaken for anything the terrain does.
          g.lineStyle(Math.max(2, c * 0.08), COLORS.alarm, a);
          for (const [sx, sy] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            const bx = x + sx! * c * 0.5;
            const by = y + sy! * c * 0.5;
            g.lineBetween(bx, by, bx - sx! * c * 0.22, by);
            g.lineBetween(bx, by, bx, by - sy! * c * 0.22);
          }
          break;
        case 'flash': {
          // Muzzle flash: a small paper star, drawn, not a hot dot.
          const pts = starPoints(x, y, c * 0.26 * (1 - t * 0.5), c * 0.1, 5, ph);
          g.fillStyle(COLORS.bgField, a);
          g.fillPoints(pts, true);
          g.lineStyle(Math.max(1.2, c * 0.05), COLORS.oliveDark, a);
          g.strokePoints(pts, true, true);
          break;
        }
        case 'shout': {
          // Lettering pops past its size and settles back, which is how a
          // hand-drawn word lands. It never fades to grey — `punch` holds it
          // and then cuts, like every other mark on this page.
          const pop = Math.min(1, t / 0.22);
          const text = this.shoutText(shoutSlot++);
          text
            .setVisible(true)
            .setText(fx.word ?? '')
            .setPosition(x, y - c * 0.55)
            .setScale((fx.size ?? 1) * (0.68 + 0.52 * pop - 0.1 * t))
            .setAlpha(a)
            .setAngle((ph - 0.5) * 18);
          break;
        }
      }
    }
    for (let i = shoutSlot; i < this.shouts.length; i++) this.shouts[i]!.setVisible(false);
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
    // A gauge on paper: a paper trough inside an ink keyline, filled in ink,
    // and alarm only when it matters. Without the keyline the trough is the
    // same value as the ground and the EMPTY part of the bar disappears,
    // which is the half of a health bar that carries the information.
    const left = centerX - width / 2;
    g.fillStyle(COLORS.bgField, 1);
    g.fillRect(left - 1, y - 1, width + 2, 5);
    g.lineStyle(1, COLORS.oliveDark, 1);
    g.strokeRect(left - 1, y - 1, width + 2, 5);
    g.fillStyle(frac > 0.4 ? (isFriendly ? COLORS.oliveDark : COLORS.crimson) : COLORS.alarm, 1);
    g.fillRect(left, y, width * frac, 3);
  }

  /**
   * A radius, as a ring of ink ticks.
   *
   * Phaser `Graphics` has no dash support, so the dash is drawn: short radial
   * strokes at a fixed arc spacing, which reads as a dashed circle and scales
   * with the radius for free.
   */
  private radius(
    g: Phaser.GameObjects.Graphics,
    px: number,
    py: number,
    r: number,
    tick: number,
  ): void {
    const n = Math.max(12, Math.round(r / 5));
    g.lineStyle(1.2, COLORS.oliveDark, 0.55);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
      g.lineTo(px + Math.cos(a) * (r + tick), py + Math.sin(a) * (r + tick));
    }
    g.strokePath();
  }

  /**
   * Letter an event.
   *
   * The Text objects are POOLED and parented into the world container, which
   * is what keeps them off the scene root — anything there is drawn twice,
   * once by each camera, and `boardStrays()` fails the harness on exactly
   * that. Being in the world also means the word scales and pans with the
   * board, which is right: it is drawn on the page, not on the screen.
   */
  private shout(kind: string, x: number, y: number, life: number, size: number): void {
    const words = SHOUTS[kind];
    if (!words) return;
    const word = words[Math.floor(phaseAt(x, y) * words.length) % words.length]!;
    this.effects.push({ kind: 'shout', x, y, word, size, age: 0, life });
  }

  /** A pooled word, made on first use and reused for the rest of the battle. */
  private shoutText(slot: number): Phaser.GameObjects.Text {
    let t = this.shouts[slot];
    if (!t) {
      t = this.scene.add
        .text(0, 0, '', {
          fontFamily: DISPLAY_FAMILY,
          fontSize: `${Math.round(this.cell * 1.15)}px`,
          fontStyle: '800',
          color: css(COLORS.bgField),
          stroke: css(COLORS.oliveDark),
          strokeThickness: Math.max(3, this.cell * 0.16),
        })
        .setOrigin(0.5);
      this.container?.add(t);
      this.shouts[slot] = t;
    }
    return t;
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
