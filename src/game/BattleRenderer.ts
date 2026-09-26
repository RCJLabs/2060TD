import { clamp, type Container, type Graphics, type Image, type Scene, type Text } from './stage';
import type { Attacker, Engine } from '../sim/engine';
import type { CellIndex, DamageType, SimEvent, Vec2 } from '../sim/types';
import { POST_HURT_SECONDS, StepWatch, threatStep } from '../content/score';
import { audio } from './audio';
import { drawAttackerGlyph, drawStructureGlyph, drawWallGlyph, wallJoins } from './glyphs';
import { makeSheet } from './ground';
import { haptic } from './haptics';
import {
  BUZZ_GAP,
  eventImpact,
  IMPACTS,
  notePlayed,
  POST_GAP,
  WEAR_GAP,
  WearWatch,
  type EffectKind,
  type ImpactKind,
} from './impacts';
import { focusLines, phaseAt, punch, speedLines, starPoints } from './kinetics';
import { placeSound, type Placement, type View } from './mix';
import { music } from './music';
import { COLORS, css } from './palette';
import { notePainted, paintScar, ScarField, scarFor, SCARS, SMOKE_SECONDS, type ScarBoard } from './scars';
import { DISPLAY_FAMILY } from './tokens';

interface Effect {
  kind: EffectKind;
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

/** How long a jolt of the board lasts, in seconds (M31 Phase 1). */
const JOLT_SECONDS = 0.2;

/** The device's reduced-motion setting: made once, and `matches` follows the device. */
const reducedMotion: { matches: boolean } | null =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export interface RendererOptions {
  /**
   * A battle being fought now, rather than watched: only then does a breach
   * or a lost building buzz the phone (M31 Phase 1).
   */
  live?: boolean;
  /**
   * What the camera is looking at, in world pixels, so each battle sound can
   * be heard where it happened (M31 Phase 3). Without it, sounds sit in the
   * middle.
   */
  view?: () => View | null;
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
  private readonly scene: Scene;
  private readonly engine: Engine;
  private readonly cell: number;
  private readonly container: Container | undefined;
  private readonly hostileStructures: boolean;
  /** The baked page. The world container owns it, and `makeSheet` wires the
   *  canvas texture's release to this object's destroy. */
  private sheet: Image | null = null;
  private readonly staticLayer: Graphics;
  private readonly dynLayer: Graphics;
  private effects: Effect[] = [];
  /** Last firing direction per structure id — barrels track their targets. */
  private readonly barrelDirs = new Map<number, number>();
  /** Last movement heading per attacker id — vehicles keep facing when halted. */
  private readonly facings = new Map<number, number>();
  /** Pooled lettering. Lives in the world container, so it pans and zooms. */
  private readonly shouts: Text[] = [];
  private readonly live: boolean;
  /** Walls and the post read between frames, for the damage the sim reports as no event (M31). */
  private readonly wallWear = new WearWatch<CellIndex>(WEAR_GAP);
  private readonly postWear = new WearWatch<'post'>(POST_GAP);
  /** The board's jolt: how far, when it began (scene ms), and which way it turns. */
  private joltAmp = 0;
  private joltAt = 0;
  private joltPhase = 0;
  private jolted = false;
  /** When the phone last buzzed (scene ms): a volley of breaches is one buzz, not a drone. */
  private buzzAt = Number.NEGATIVE_INFINITY;
  private readonly wallsSeen = new Set<CellIndex>();
  /** Events keep the board's bookkeeping but play nothing: see `hush`. */
  private hushed = false;
  private readonly view: (() => View | null) | undefined;
  /** The step the score plays, from the threat to the post (M31 Phase 3). */
  private readonly scoreWatch = new StepWatch();
  private lastPostHp: number | null = null;
  private postHurtAt = Number.NEGATIVE_INFINITY;
  /**
   * The footage has run out (M31 Phase 3). A raid's replay stops at its
   * objective or its hard limit with men still on the board, and the score
   * should not go on pressing after it.
   */
  over = false;
  /** The scars painted into the sheet so far, for spacing (M31 Phase 2). */
  private readonly scarField = new ScarField();
  private readonly scarBoard: ScarBoard = {
    centerOf: (cell) => this.engine.grid.centerOf(cell),
    footprintOf: (kind) => this.engine.catalog.structures[kind]?.footprint ?? 1,
    // Read before a death's bookkeeping forgets it.
    headingOf: (id) => this.facings.get(id),
  };

  constructor(
    scene: Scene,
    engine: Engine,
    cellPx: number,
    hostileStructures = false,
    /** World container when the scene splits board and HUD across cameras. */
    container?: Container,
    opts: RendererOptions = {},
  ) {
    this.scene = scene;
    this.engine = engine;
    this.cell = cellPx;
    this.hostileStructures = hostileStructures;
    this.container = container;
    this.live = opts.live === true;
    this.view = opts.view;
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
    this.sheet = makeSheet({
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

  /**
   * Play an impact (M31 Phase 1): its mark and its sound together, from the
   * table, and for a breach or a loss the jolt and, in a live battle, the
   * buzz. The one way an impact reaches the page, so none can arrive with
   * half of itself.
   */
  private playImpact(kind: ImpactKind, x: number, y: number, extra: Partial<Effect> = {}, life?: number): void {
    if (this.hushed) return;
    const impact = IMPACTS[kind];
    this.effects.push({ ...extra, kind: impact.mark, x, y, age: 0, life: life ?? impact.life });
    audio.sfx(impact.sound, this.place(x, y));
    if (impact.duck !== undefined) music.duck(impact.duck);
    if (impact.jolt !== undefined) this.jolt(impact.jolt, x, y);
    if (impact.haptic !== undefined && this.live) {
      const now = this.scene.time.now;
      if (now - this.buzzAt >= BUZZ_GAP * 1000) {
        haptic(impact.haptic);
        this.buzzAt = now;
      }
    }
    notePlayed(kind);
  }

  /**
   * Leave what the event leaves on the board (M31 Phase 2), painted into the
   * sheet once and kept for the rest of the battle. A skip paints it too,
   * since the board a skip lands on is the one the battle left; only the
   * smoke, which is a moment and not a mark, waits for a frame to be drawn.
   */
  private leaveScar(event: SimEvent): void {
    const sheet = this.sheet;
    const scar = sheet ? scarFor(event, this.scarBoard) : null;
    if (!sheet || !scar || !this.scarField.admit(scar)) return;
    // The sheet is baked finer than the world it lies in: this many of its pixels to a cell.
    const px = this.cell / sheet.scaleX;
    if (!sheet.paint((ctx) => paintScar(ctx, scar, px))) return;
    notePainted(scar.kind);
    if (SCARS[scar.kind].smokes && !this.hushed) {
      this.effects.push({ kind: 'smoke', x: scar.x, y: scar.y, age: 0, life: SMOKE_SECONDS });
    }
  }

  consumeEvents(events: SimEvent[]): void {
    for (const event of events) {
      this.leaveScar(event);
      switch (event.type) {
        case 'shot': {
          // A round lands: the tracer, the star where it lands, and its crack.
          this.playImpact(eventImpact(event)!, event.from.x, event.from.y, {
            x2: event.to.x,
            y2: event.to.y,
            color: tracerColor(event.damageType),
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
          break;
        }
        case 'attackerDied':
          // A kill, weighed by what died (M31): infantry, armour or aircraft.
          this.playImpact(eventImpact(event)!, event.at.x, event.at.y);
          this.facings.delete(event.id);
          break;
        case 'wallDestroyed': {
          // A breach is the moment the battle turns, and it used to be a ring
          // that was gone in four tenths of a second. It gets long enough to
          // land, and it gets lettered.
          const at = this.engine.grid.centerOf(event.cell);
          this.playImpact('breach', at.x, at.y);
          this.shout('wallBoom', at.x, at.y, 0.8, 1);
          break;
        }
        case 'refund': {
          // Rapid Response (M26): the CP a field defence that held its wave
          // hands back, lettered over it as it comes.
          const word = `+${Math.round(event.cp)} CP`;
          this.effects.push({ kind: 'shout', x: event.at.x, y: event.at.y - 0.4, word, size: 0.7, age: 0, life: 1.1 });
          break;
        }
        case 'structureDestroyed':
          // A fall that leaves a hulk (M26) is marked briefly, with a smaller
          // word above it: under a real assault a hulk lasts a second or three,
          // and the full-size boom sat on it for most of that.
          this.playImpact('loss', event.at.x, event.at.y, {}, event.hulk ? 0.45 : undefined);
          if (event.hulk) this.shout('structBoom', event.at.x, event.at.y - 0.9, 0.6, 0.75);
          else this.shout('structBoom', event.at.x, event.at.y, 1, 1.25);
          this.barrelDirs.delete(event.id);
          break;
        case 'aoe':
          this.playImpact('blast', event.at.x, event.at.y, { radius: event.radius });
          this.shout('aoe', event.at.x, event.at.y, 0.65, 0.85);
          break;
        // A reserve standing up (v1.20). A slow ring rather than a blast: the
        // player needs to notice that the base just answered, and to be able
        // to tell that answer apart from something going off. A notice, so
        // it has a mark of its own and not the blast's (M31).
        case 'garrisonDeployed':
          this.effects.push({
            kind: 'muster',
            x: event.at.x,
            y: event.at.y,
            radius: 1.6,
            age: 0,
            life: 0.8,
          });
          if (!this.hushed) audio.sfx('radio', this.place(event.at.x, event.at.y));
          break;
        case 'strafePulse':
          this.playImpact('strafe', event.x0, event.y, { x2: event.x1 });
          break;
        case 'powerCast':
          this.effects.push({ kind: 'reticle', x: event.at.x, y: event.at.y, age: 0, life: 0.8 });
          if (!this.hushed) audio.sfx('power', this.place(event.at.x, event.at.y));
          break;
        default:
          break;
      }
    }
  }

  /**
   * Drop every effect still queued. A replay that skips to its end has heard
   * the whole battle's events at once, and would otherwise draw every shot
   * and blast of it on the next frame.
   */
  /**
   * Run `fn` with nothing played (M31): a replay skipped to its end steps
   * through the rest of the battle in one frame, and settles before a frame
   * is drawn, so every sound it played would be a sound without its mark.
   */
  hush(fn: () => void): void {
    this.hushed = true;
    try {
      fn();
    } finally {
      this.hushed = false;
    }
  }

  settle(): void {
    this.effects = [];
    for (const shout of this.shouts) shout.setVisible(false);
    // A jump in time is not wear: the next frame only learns the health again.
    this.wallWear.clear();
    this.postWear.clear();
    this.lastPostHp = null;
    this.joltAmp = 0;
  }

  /** Where a sound at board point (x, y), in cells, is heard (M31 Phase 3). */
  private place(x: number, y: number): Placement {
    return placeSound(x * this.cell, y * this.cell, this.view?.() ?? null);
  }

  /**
   * Tell the score how hard the battle is pressing the post (M31 Phase 3):
   * how many attackers are on the board, how close the nearest is, and
   * whether the post is being hurt. The watch holds each step long enough to
   * be heard, and the synth plays it from the next beat.
   */
  private followThreat(t: number): void {
    const engine = this.engine;
    const post = engine.cc;
    let nearest = Number.POSITIVE_INFINITY;
    for (const a of engine.attackers) {
      const d = Math.hypot(a.pos.x - post.center.x, a.pos.y - post.center.y);
      if (d < nearest) nearest = d;
    }
    const step = this.scoreWatch.update(
      threatStep({
        ended: this.over || engine.phase === 'victory' || engine.phase === 'defeat',
        alive: engine.attackers.length,
        nearest,
        postHurt: t - this.postHurtAt < POST_HURT_SECONDS,
        postHp: post.profile.maxHp > 0 ? post.hp / post.profile.maxHp : 1,
      }),
      t,
    );
    music.setStep(step);
  }

  /**
   * Wear (M31 Phase 1): a wall being broken and the post under attack lose
   * health with no event, so their health is read between frames and a fall
   * in it is marked, no oftener than the table's rate for each.
   */
  private watchWear(): void {
    const t = this.scene.time.now / 1000;
    const grid = this.engine.grid;
    const alive = this.wallsSeen;
    alive.clear();
    for (const [cell, wall] of grid.walls) {
      alive.add(cell);
      if (this.wallWear.wore(cell, wall.hp, t)) {
        const at = grid.centerOf(cell);
        this.playImpact('wear', at.x, at.y);
      }
    }
    this.wallWear.keep(alive);
    const post = this.engine.cc;
    // Any fall at all counts as the post being hurt, for the score; the mark
    // below keeps its own, slower rate.
    if (this.lastPostHp !== null && post.hp < this.lastPostHp) this.postHurtAt = t;
    this.lastPostHp = post.hp;
    if (post.hp > 0 && this.postWear.wore('post', post.hp, t)) {
      // Where on the post, from where it happened: the marks walk round it.
      const ph = phaseAt(t, post.hp);
      this.playImpact('postHit', post.center.x + (ph - 0.5) * 0.9, post.center.y + (phaseAt(post.hp, t) - 0.5) * 0.9);
    }
  }

  /**
   * Nudge the board (M31 Phase 1): a few pixels, gone in a fifth of a
   * second, the way a panel shakes when something heavy lands in it. Never
   * under the device's reduced-motion setting, and a bigger jolt is not
   * shrunk by a smaller one arriving on top of it.
   */
  private jolt(cells: number, x: number, y: number): void {
    if (!this.container || reducedMotion?.matches === true) return;
    const now = this.scene.time.now;
    const left = Math.max(0, 1 - (now - this.joltAt) / (JOLT_SECONDS * 1000));
    const amp = cells * this.cell;
    if (amp < this.joltAmp * left * left) return;
    this.joltAmp = amp;
    this.joltAt = now;
    this.joltPhase = phaseAt(x, y) * Math.PI * 2;
  }

  /** Where the board sits this frame: shaken while a jolt lasts, home otherwise. */
  private applyJolt(): void {
    if (!this.container) return;
    const e = (this.scene.time.now - this.joltAt) / 1000;
    if (this.joltAmp <= 0 || e >= JOLT_SECONDS) {
      if (this.jolted) {
        this.container.setPosition(0, 0);
        this.jolted = false;
      }
      return;
    }
    const k = 1 - e / JOLT_SECONDS;
    const a = this.joltAmp * k * k;
    const turn = this.joltPhase + e * 55;
    this.container.setPosition(Math.cos(turn) * a, Math.sin(turn) * a);
    this.jolted = true;
  }

  // ---- dynamic layer -------------------------------------------------------------------

  draw(alpha: number, dtSeconds: number, opts: DrawOptions): void {
    const g = this.dynLayer;
    g.clear();
    this.watchWear();
    this.followThreat(this.scene.time.now / 1000);
    this.applyJolt();
    this.drawWalls(g);
    if (opts.showPaths) this.drawPaths(g, alpha);
    this.drawStructures(g);
    this.drawAttackers(g, alpha);
    this.drawProjectiles(g, alpha);
    if (opts.ghost) this.drawGhost(g, opts.ghost);
    if (opts.powerPreview) this.drawPowerPreview(g, opts.powerPreview);
    this.drawEffects(g, dtSeconds);
  }

  private drawWalls(g: Graphics): void {
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

  private drawStructures(g: Graphics): void {
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
        // A hulk (M26, Overbuilt) is drawn as the wreck it already is.
        wrecked: s.hulk !== undefined,
        hostile: this.hostileStructures,
        ...(aim !== undefined ? { aimAngle: aim } : {}),
      });
      if (s.hulk) {
        this.flames(g, px, py, c);
        this.hpBar(g, px, py - 16, 22, Math.max(0, s.hp / s.hulk.from), false);
        continue;
      }
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

  private drawPaths(g: Graphics, alpha: number): void {
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

  private drawAttackers(g: Graphics, alpha: number): void {
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


  private drawProjectiles(g: Graphics, alpha: number): void {
    const c = this.cell;
    for (const shell of this.engine.projectiles) {
      const flight = shell.impactTick - shell.firedTick;
      if (flight <= 0) continue;
      const t = clamp(
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

  private drawGhost(g: Graphics, ghost: GhostPreview): void {
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

  private drawPowerPreview(g: Graphics, preview: PowerPreview): void {
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

  private drawEffects(g: Graphics, dtSeconds: number): void {
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
        case 'boomVehicle':
          // Armour dies (M31): a heavier star with a second burst inside it,
          // still no focus lines and no accent. The accent is for your own.
          burst(c * (0.58 + 0.34 * t), c * 0.22, 9);
          burst(c * (0.3 + 0.12 * t), c * 0.12, 6);
          break;
        case 'boomAir': {
          // An aircraft comes down (M31): the star falls from where it flew
          // to its shadow, trailing speed lines up the way it came.
          const lift = AIR_LIFT * (1 - t);
          const fy = y - lift;
          speedLines(g, x, fy, Math.PI / 2, c * 1.7, c * 0.16, 3, COLORS.oliveDark, a, Math.max(1.2, c * 0.05));
          const pts = starPoints(x, fy, c * (0.45 + 0.3 * t), c * 0.17, 8, ph);
          g.fillStyle(COLORS.bgField, a);
          g.fillPoints(pts, true);
          g.lineStyle(Math.max(1.5, c * 0.075), COLORS.oliveDark, a);
          g.strokePoints(pts, true, true);
          break;
        }
        case 'chip': {
          // A wall being worn (M31): a small star and two flecks thrown off it.
          const pts = starPoints(x, y, c * 0.27, c * 0.1, 5, ph);
          g.fillStyle(COLORS.bgField, a);
          g.fillPoints(pts, true);
          g.lineStyle(Math.max(1.2, c * 0.055), COLORS.oliveDark, a);
          g.strokePoints(pts, true, true);
          const fling = c * (0.32 + 0.3 * t);
          for (const k of [0, 1]) {
            const ang = (ph + k * 0.45) * Math.PI * 2;
            const cos = Math.cos(ang);
            const sin = Math.sin(ang);
            g.lineBetween(x + cos * fling, y + sin * fling, x + cos * (fling + c * 0.16), y + sin * (fling + c * 0.16));
          }
          break;
        }
        case 'postHit':
          // The post under attack (M31): the one hit the accent is spent on.
          burst(c * (0.42 + 0.18 * t), c * 0.16, 7, c * 0.2);
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
        case 'smoke': {
          // A fresh wreck or fallen building smoking (M31 Phase 2): three
          // wisps, each rising a cell and cutting at the top, round and round
          // until it burns out. Ink curls, not a grey wash.
          g.lineStyle(Math.max(1, c * 0.04), COLORS.oliveDark, a);
          for (let k = 0; k < 3; k++) {
            const w = (fx.age / 1.8 + k / 3 + ph) % 1;
            const r = c * (0.05 + 0.07 * w);
            const wx = x + Math.sin((w * 2 + ph + k) * Math.PI) * c * 0.12 - r;
            const wy = y - c * 0.25 - w * c * 1.1;
            g.beginPath();
            g.arc(wx, wy, r, Math.PI, Math.PI * 2);
            g.arc(wx + 2 * r, wy, r, Math.PI, 0, true);
            g.strokePath();
          }
          break;
        }
        case 'muster': {
          // A reserve standing up: the ring of ticks alone, in ink, opening
          // slowly. No star and no red, which are what something going off
          // looks like.
          const r = (fx.radius ?? 1) * c * (0.35 + 0.65 * t);
          g.lineStyle(Math.max(1.5, c * 0.06), COLORS.oliveDark, a);
          g.beginPath();
          for (let i = 0; i < 18; i++) {
            const ang = (i / 18) * Math.PI * 2;
            g.moveTo(x + Math.cos(ang) * r, y + Math.sin(ang) * r);
            g.lineTo(x + Math.cos(ang) * (r + c * 0.16), y + Math.sin(ang) * (r + c * 0.16));
          }
          g.strokePath();
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
        default: {
          // Every mark is drawn: a kind without a case is a compile error.
          const undrawn: never = fx.kind;
          return undrawn;
        }
      }
    }
    for (let i = shoutSlot; i < this.shouts.length; i++) this.shouts[i]!.setVisible(false);
  }

  /**
   * A hulk burning (M26, Overbuilt): three tongues of flame over the wreck,
   * each on its own flicker, in the accent, since a hulk is a thing that is
   * happening and not a thing that stands.
   */
  private flames(g: Graphics, px: number, py: number, c: number): void {
    const t = this.scene.time.now / 1000;
    g.lineStyle(Math.max(2, c * 0.08), COLORS.signal, 0.9);
    for (let k = -1; k <= 1; k++) {
      const flick = 0.5 + 0.5 * Math.sin(t * 9 + k * 2.1 + px * 0.13);
      const x = px + k * c * 0.22;
      const top = py - c * (0.28 + 0.22 * flick);
      g.lineBetween(x, py - c * 0.12, x + k * c * 0.05, top);
    }
  }

  private hpBar(
    g: Graphics,
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
   * The board's `Graphics` has no dash support, so the dash is drawn: short radial
   * strokes at a fixed arc spacing, which reads as a dashed circle and scales
   * with the radius for free.
   */
  private radius(
    g: Graphics,
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
  private shoutText(slot: number): Text {
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
