import type { CellIndex, SimEvent, Vec2 } from '../sim/types';
import { killWeight } from './impacts';
import { phaseAt } from './kinetics';
import { COLORS, css } from './palette';

/**
 * Persistent scarring (M31 Phase 2): what a battle leaves on its board.
 *
 * A blast leaves a crater, a dead vehicle a wreck, a downed aircraft a crash,
 * a fallen building scorch and a broken wall rubble. Soldiers leave nothing:
 * the war is fought with materiel, and the page does not mark where a man fell.
 *
 * Scars are painted once into the battle's baked sheet, so they cost nothing
 * a frame however many a battle leaves, and they last as long as the battle
 * does. A replay paints them again from the battle it re-runs. Nothing is
 * saved and nothing reaches the sim.
 *
 * They are drawn in line-work and never in tone. The sheet's dot and hatch
 * densities are the terrain legend the pathfinder reads, and bare paper is
 * road, so a scar that filled or knocked out the ground would lie about it. A
 * scar is ink lines, lighter than the keylines, and silent: the impact that
 * made it has already made its sound.
 */

export type ScarKind = 'crater' | 'wreck' | 'crash' | 'scorch' | 'rubble';

export interface Scar {
  kind: ScarKind;
  /** Where, in cells. */
  x: number;
  y: number;
  /**
   * How big, in cells: a crater's radius, a wreck's or a crash's length, the
   * edge of a fallen building's footprint, a wall's cell.
   */
  size: number;
  /** Which way a wreck or a crash lay when it died, in radians. */
  heading: number;
}

export interface ScarRule {
  /** A scar this close to one of its own kind, in cells, is not painted again. */
  spacing: number;
  /** A fresh one smokes for a while. */
  smokes: boolean;
}

export const SCARS: Readonly<Record<ScarKind, ScarRule>> = {
  crater: { spacing: 0.5, smokes: false },
  wreck: { spacing: 0.5, smokes: true },
  crash: { spacing: 0.5, smokes: true },
  scorch: { spacing: 0.5, smokes: true },
  rubble: { spacing: 0.5, smokes: false },
};

export const SCAR_KINDS = Object.keys(SCARS) as ScarKind[];

/** How long a fresh wreck or a fallen building smokes, in seconds. */
export const SMOKE_SECONDS = 8;

/** The one colour a scar is drawn in. */
export const SCAR_INK = css(COLORS.oliveDark);

/** A heavy vehicle's wreck is longer than a light one's, and keeps its turret ring. */
const WRECK_HEAVY = 0.62;
const WRECK_LIGHT = 0.5;
const CRASH = 0.5;

/** A crater's radius, in cells, for a blast of `radius` cells: a pit in one cell, however big the blast. */
export function craterRadius(radius: number): number {
  return Math.min(0.42, 0.2 + 0.08 * Math.max(0, radius));
}

/** What the scars need to know about the board they are left on. */
export interface ScarBoard {
  centerOf(cell: CellIndex): Vec2;
  /** A structure kind's footprint edge, in cells. */
  footprintOf(kind: string): number;
  /** Which way a unit was last seen heading, in radians, if it was. */
  headingOf(id: number): number | undefined;
}

/** What a sim event leaves on the board, if anything. */
export function scarFor(event: SimEvent, board: ScarBoard): Scar | null {
  switch (event.type) {
    case 'aoe':
      return { kind: 'crater', x: event.at.x, y: event.at.y, size: craterRadius(event.radius), heading: 0 };
    case 'attackerDied': {
      const weight = killWeight(event.armor);
      if (weight === 'infantry') return null;
      const heading = board.headingOf(event.id) ?? 0;
      if (weight === 'air') return { kind: 'crash', x: event.at.x, y: event.at.y, size: CRASH, heading };
      const size = event.armor === 'heavy' ? WRECK_HEAVY : WRECK_LIGHT;
      return { kind: 'wreck', x: event.at.x, y: event.at.y, size, heading };
    }
    case 'wallDestroyed': {
      const at = board.centerOf(event.cell);
      return { kind: 'rubble', x: at.x, y: at.y, size: 1, heading: 0 };
    }
    case 'structureDestroyed':
      return { kind: 'scorch', x: event.at.x, y: event.at.y, size: board.footprintOf(event.kind), heading: 0 };
    default:
      return null;
  }
}

/**
 * The scars a board has been left, by kind, for spacing: a scar within its
 * kind's spacing of one already painted is not painted again. Clustered blasts
 * pit the ground rather than bury it, and a board keeps a few dozen scars at
 * most.
 */
export class ScarField {
  private readonly placed = new Map<ScarKind, Vec2[]>();

  /** True when the scar should be painted, and then it counts. */
  admit(scar: Scar): boolean {
    const list = this.placed.get(scar.kind) ?? [];
    const gap = SCARS[scar.kind].spacing;
    for (const p of list) if (Math.hypot(p.x - scar.x, p.y - scar.y) < gap) return false;
    list.push({ x: scar.x, y: scar.y });
    this.placed.set(scar.kind, list);
    return true;
  }

  get count(): number {
    let n = 0;
    for (const list of this.placed.values()) n += list.length;
    return n;
  }

  clear(): void {
    this.placed.clear();
  }
}

// ---- the painter -----------------------------------------------------------------

/**
 * What a scar may do to a canvas: draw lines, and fill a little ink. There is
 * no `fillRect`, `clearRect` or `createPattern` here, so no scar can lay down
 * paper, knock the ground out or shade it with a tone.
 */
export type ScarCanvas = Pick<
  CanvasRenderingContext2D,
  'save' | 'restore' | 'beginPath' | 'closePath' | 'moveTo' | 'lineTo' | 'arc' | 'stroke' | 'fill' | 'translate' | 'rotate'
> & {
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
};

const TAU = Math.PI * 2;

/**
 * Paint a scar, at `px` canvas pixels a cell. The same scar paints the same
 * strokes every time, so a replay's board is the battle's.
 */
export function paintScar(ctx: ScarCanvas, scar: Scar, px: number): void {
  const ph = phaseAt(scar.x, scar.y);
  ctx.save();
  ctx.translate(scar.x * px, scar.y * px);
  ctx.strokeStyle = SCAR_INK;
  ctx.fillStyle = SCAR_INK;
  // Under half a keyline's weight: a scar sits under everything still standing.
  ctx.lineWidth = Math.max(1, px * 0.035);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (scar.kind) {
    case 'crater':
      crater(ctx, scar.size * px, ph, px);
      break;
    case 'wreck':
      ctx.rotate(scar.heading);
      wreck(ctx, scar.size * px, scar.size >= WRECK_HEAVY, ph, px);
      break;
    case 'crash':
      ctx.rotate(scar.heading);
      crash(ctx, scar.size * px, ph, px);
      break;
    case 'scorch':
      scorch(ctx, scar.size * px, scar.size, ph, px);
      break;
    case 'rubble':
      blocks(ctx, px * 0.34, 6, ph, px);
      flecks(ctx, px * 0.3, px * 0.48, 3, ph, px);
      break;
    default: {
      // Every scar is painted: a kind without a case is a compile error.
      const unpainted: never = scar.kind;
      return unpainted;
    }
  }
  ctx.restore();
}

/**
 * A pit: a ragged rim broken in two places, and the far wall's shadow as an
 * arc inside it. Broken, so it reads as a hole in the ground and not a ring
 * laid on it.
 */
function pit(ctx: ScarCanvas, r: number, ph: number): void {
  const n = 18;
  const at = (i: number): [number, number] => {
    const j = phaseAt((i % n) * 3.7 + ph * 11, ph * 5.3 + (i % n));
    const a = (i / n + ph) * TAU;
    const rr = r * (0.86 + 0.26 * j);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  };
  const gap = Math.floor(ph * n);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === gap || i === (gap + 9) % n || i === (gap + 10) % n) continue;
    const [x0, y0] = at(i);
    const [x1, y1] = at(i + 1);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  // The wall under the light's side of the rim, in its shadow. The page is
  // lit from the top left, so every pit is shaded on the same side.
  ctx.beginPath();
  const a0 = Math.PI * (0.92 + (ph - 0.5) * 0.12);
  ctx.arc(0, 0, r * 0.58, a0, a0 + 1.7);
  ctx.stroke();
}

/** Short strokes thrown outward between two radii. */
function flecks(ctx: ScarCanvas, from: number, to: number, n: number, ph: number, px: number): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const j = phaseAt(ph * 7 + i * 1.9, i * 4.1 + ph);
    const a = (ph + i / n + j * 0.2) * TAU;
    const d = from + (to - from) * j;
    const len = px * (0.04 + 0.04 * j);
    ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    ctx.lineTo(Math.cos(a) * (d + len), Math.sin(a) * (d + len));
  }
  ctx.stroke();
}

/** Broken blocks scattered within `spread` of the centre, each outlined and turned. */
function blocks(ctx: ScarCanvas, spread: number, n: number, ph: number, px: number): void {
  for (let i = 0; i < n; i++) {
    const j = phaseAt(ph * 13 + i * 2.3, i * 5.7 - ph);
    const k = phaseAt(i * 1.3 + ph, ph * 9.1 + i * 0.7);
    const x = (j - 0.5) * 2 * spread;
    const y = (k - 0.5) * 2 * spread;
    const s = px * (0.045 + 0.045 * j);
    const turn = k * Math.PI;
    const cos = Math.cos(turn) * s;
    const sin = Math.sin(turn) * s;
    ctx.beginPath();
    ctx.moveTo(x + cos - sin, y + sin + cos);
    ctx.lineTo(x - cos - sin, y - sin + cos);
    ctx.lineTo(x - cos + sin * 0.6, y - sin - cos * 0.6);
    ctx.lineTo(x + cos + sin, y + sin - cos);
    ctx.closePath();
    ctx.stroke();
  }
}

function crater(ctx: ScarCanvas, r: number, ph: number, px: number): void {
  pit(ctx, r, ph);
  flecks(ctx, r * 1.3, r * 1.9, 6, ph, px);
}

/** The hull in outline with its corners knocked off, cracked across where it burst. */
function wreck(ctx: ScarCanvas, length: number, heavy: boolean, ph: number, px: number): void {
  const l = length / 2;
  const b = length * 0.3;
  const k = b * 0.45;
  ctx.beginPath();
  ctx.moveTo(-l + k, -b);
  ctx.lineTo(l - k, -b);
  ctx.lineTo(l, -b + k);
  ctx.lineTo(l, b - k);
  ctx.lineTo(l - k, b);
  ctx.lineTo(-l + k, b);
  ctx.lineTo(-l, b - k);
  ctx.lineTo(-l, -b + k);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-length * 0.05, -b);
  ctx.lineTo(length * 0.06, -b * 0.3);
  ctx.lineTo(-length * 0.04, b * 0.25);
  ctx.lineTo(length * 0.08, b);
  ctx.stroke();
  if (heavy) {
    // The turret ring, knocked off its seat.
    ctx.beginPath();
    ctx.arc(length * 0.14, -b * 0.18, b * 0.55, 0, TAU);
    ctx.stroke();
  }
  flecks(ctx, length * 0.6, length * 0.85, 4, ph, px);
}

/** A small pit where it came down, and a broken skid back the way it flew. */
function crash(ctx: ScarCanvas, length: number, ph: number, px: number): void {
  const r = length * 0.4;
  pit(ctx, r, ph);
  ctx.beginPath();
  ctx.moveTo(-r * 1.2, 0);
  ctx.lineTo(-r * 2.4, r * 0.12);
  ctx.moveTo(-r * 2.75, r * 0.16);
  ctx.lineTo(-r * 3.3, r * 0.22);
  ctx.stroke();
  flecks(ctx, r * 1.3, r * 2, 5, ph, px);
}

/** A splash of short strokes radiating from where a building stood, and what is left of it. */
function scorch(ctx: ScarCanvas, edge: number, cells: number, ph: number, px: number): void {
  const n = 10 + 4 * Math.round(cells);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const j = phaseAt(i * 2.9 + ph * 3, ph * 7.7 - i);
    const a = (i / n + j * 0.08 + ph) * TAU;
    const r0 = edge * (0.3 + 0.1 * j);
    const r1 = edge * (0.55 + 0.3 * j);
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  ctx.stroke();
  blocks(ctx, edge * 0.24, 2 + Math.round(cells) * 2, ph, px);
}

// ---- the record the harness reads -----------------------------------------------

const painted = new Map<ScarKind, number>();

/** Count a scar painted. */
export function notePainted(kind: ScarKind): void {
  painted.set(kind, (painted.get(kind) ?? 0) + 1);
}

/** Every scar painted since the page loaded, by kind. */
export function paintedScars(): Partial<Record<ScarKind, number>> {
  return Object.fromEntries(painted) as Partial<Record<ScarKind, number>>;
}
