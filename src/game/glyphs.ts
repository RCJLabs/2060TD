import type Phaser from 'phaser';
import { footprintOfKind } from '../content/catalog';
import { COLORS } from './palette';

/**
 * Every silhouette that stands on the sheet.
 *
 * These are counters printed over a map, and they follow three rules that the
 * whole art direction rests on:
 *
 * 1. **Shape carries the identity, colour carries the allegiance.** A depot
 *    and a barracks are different shapes in the same ink; a hostile depot is
 *    the same shape in crimson. Before this, twenty-two kinds shared four
 *    rectangles and the labels did all the work — which is exactly why the
 *    board read as cluttered.
 * 2. **Everything is drawn in fractions of a cell.** The old set was authored
 *    in absolute pixels against CELL=32, so it could not be scaled at all.
 * 3. **Everything gets a paper knockout first.** The ground is a busy
 *    topographic sheet; a silhouette laid straight onto contours competes
 *    with them. The halo is what makes it a counter ON the map rather than a
 *    mark IN it.
 *
 * The footprint is read from the catalog, never from a table kept here.
 */

export interface StructureGlyphOptions {
  level?: number;
  wrecked?: boolean;
  inert?: boolean;
  /** Enemy-held structure: the crimson family instead of the olive one. */
  hostile?: boolean;
  /** Barrel heading in radians (from the renderer's last-shot tracking).
   * Absent = the resting pose, pointing up. */
  aimAngle?: number;
}

/**
 * The wall line, drawn as a run rather than a row of beads.
 *
 * `joins` names the sides that carry on into another wall cell. A segment runs
 * flush to the cell edge on those sides and is inset on the others, so a ring
 * abuts into one continuous ribbon about two thirds of a cell wide — a
 * defensive line, not a string of blocks. A hairline seam at each join keeps
 * the segments countable, which matters because segments are what the player
 * spends.
 */
export interface WallJoins {
  left?: boolean;
  right?: boolean;
  up?: boolean;
  down?: boolean;
}

/**
 * Which sides of a wall cell carry on into another one.
 *
 * Handed the set of every wall cell on the board, so a run reads as a line
 * rather than as a row of beads. Cells outside the row are never joined
 * across the grid edge — `x % width` would wrap and stitch two opposite
 * walls together.
 */
export function wallJoins(cells: Set<number>, cell: number, width: number): WallJoins {
  const x = cell % width;
  return {
    left: x > 0 && cells.has(cell - 1),
    right: x < width - 1 && cells.has(cell + 1),
    up: cells.has(cell - width),
    down: cells.has(cell + width),
  };
}

const WALL_INSET = 0.215;
const HALO = 0.09;

/**
 * Which half of the wall line to draw.
 *
 * A run has to be laid down in two passes — every knockout first, then every
 * segment — because a halo is opaque paper and would otherwise erase the ink
 * its neighbour just laid at the shared edge. Drawing each cell whole leaves
 * a gap at every join, which is precisely the beading this was meant to fix.
 */
export type WallPass = 'halo' | 'ink' | 'both';

export function drawWallGlyph(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  cell: number,
  kind: string,
  hpFraction: number,
  open = false,
  joins: WallJoins = {},
  pass: WallPass = 'both',
): void {
  const inset = cell * WALL_INSET;
  const l = x + (joins.left ? 0 : inset);
  const r = x + cell - (joins.right ? 0 : inset);
  const t = y + (joins.up ? 0 : inset);
  const b = y + cell - (joins.down ? 0 : inset);
  const w = r - l;
  const h = b - t;
  const halo = cell * HALO;

  if (pass !== 'ink') {
    g.fillStyle(COLORS.paperWarm, 0.9);
    g.fillRect(l - halo, t - halo, w + halo * 2, h + halo * 2);
  }
  if (pass === 'halo') return;

  // A gate is a break in the line: paper through it, a post either side.
  if (kind === 'gate') {
    const post = Math.max(2, w * 0.26);
    g.fillStyle(COLORS.oliveDark, 1);
    g.fillRect(l, t, post, h);
    g.fillRect(r - post, t, post, h);
    if (!open) {
      g.fillStyle(COLORS.sand, 0.35 + 0.65 * hpFraction);
      g.fillRect(l + post, t, w - post * 2, h);
      g.lineStyle(Math.max(1, cell * 0.03), COLORS.paperWarm, 0.6);
      g.lineBetween(l + w / 2, t, l + w / 2, b);
    }
    return;
  }

  const hesco = kind === 'hesco';
  g.fillStyle(hesco ? COLORS.sand : COLORS.sandDark, 1);
  g.fillRect(l, t, w, h);
  if (hesco) {
    // Gabions read as a basket: cross-braced, and lighter than plain wire.
    g.lineStyle(Math.max(1, cell * 0.045), COLORS.paperWarm, 0.75);
    g.lineBetween(l + 2, t + 2, r - 2, b - 2);
    g.lineBetween(r - 2, t + 2, l + 2, b - 2);
  }

  // Seams, so a run stays countable.
  g.lineStyle(Math.max(1, cell * 0.025), COLORS.paperWarm, 0.45);
  if (joins.right) g.lineBetween(r, t + 2, r, b - 2);
  if (joins.down) g.lineBetween(l + 2, b, r - 2, b);

  const damage = 1 - hpFraction;
  if (damage > 0.02) {
    g.fillStyle(COLORS.alarm, 0.32 * damage);
    g.fillRect(l, t, w, h);
  }
}

/**
 * Draws a structure body centered at (px, py). `cell` is one cell in px; a
 * footprint-2 kind fills two of them.
 */
export function drawStructureGlyph(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  px: number,
  py: number,
  cell: number,
  opts: StructureGlyphOptions = {},
): void {
  const hostile = opts.hostile ?? false;
  const big = footprintOfKind(kind) === 2;
  /** The glyph's own box: one cell, or two for a big kind. */
  const S = cell * (big ? 2 : 1) * 0.9;
  const ink = hostile ? COLORS.crimsonDark : COLORS.oliveDark;
  const trim = hostile ? COLORS.crimson : COLORS.olive;
  const aim = opts.aimAngle ?? -Math.PI / 2; // resting pose: barrel up

  /** Paper knockout, so the silhouette sits ON the sheet, not in it. */
  const haloBox = (w: number, h: number): void => {
    const m = cell * HALO;
    g.fillStyle(COLORS.paperWarm, 0.92);
    g.fillRect(px - w / 2 - m, py - h / 2 - m, w + m * 2, h + m * 2);
  };
  const haloDisc = (r: number): void => {
    g.fillStyle(COLORS.paperWarm, 0.92);
    g.fillCircle(px, py, r + cell * HALO);
  };

  /** A filled box centred on the glyph, in glyph units (0..1 of S). */
  const box = (w: number, h: number, colour = ink, ox = 0, oy = 0): void => {
    g.fillStyle(colour, 1);
    g.fillRect(px + ox * S - (w * S) / 2, py + oy * S - (h * S) / 2, w * S, h * S);
  };
  const disc = (r: number, colour = ink, ox = 0, oy = 0): void => {
    g.fillStyle(colour, 1);
    g.fillCircle(px + ox * S, py + oy * S, r * S);
  };
  const ring = (r: number, w: number, colour = ink): void => {
    g.lineStyle(Math.max(1, w * S), colour, 1);
    g.strokeCircle(px, py, r * S);
  };
  /** Draw `body` in a frame rotated to the aim heading (+x = downrange). */
  const aimed = (body: () => void): void => {
    g.save();
    g.translateCanvas(px, py);
    g.rotateCanvas(aim);
    body();
    g.restore();
  };
  /** A barrel, in glyph units, pointing downrange from the mount. */
  const barrel = (len: number, thick: number, off = 0): void => {
    g.fillStyle(ink, 1);
    g.fillRect(0, off * S - (thick * S) / 2, len * S, thick * S);
  };

  /** The shed every building shares: a body with a lighter roof panel. */
  const shed = (w = 0.82, h = 0.6): void => {
    haloBox(w * S, h * S);
    box(w, h);
    box(w - 0.1, h - 0.14, trim);
  };
  /** The emplacement every gun shares: a square mount on the ground. */
  const mount = (w = 0.62): void => {
    haloBox(w * S * 1.15, w * S * 1.15);
    box(w, w);
  };

  switch (kind) {
    // ---- the command post ------------------------------------------------
    case 'cc': {
      haloBox(S * 0.88, S * 0.78);
      box(0.88, 0.7);
      box(0.62, 0.4, trim, 0, -0.09);
      disc(0.13, trim, 0, 0.14);
      // The mast: what tells you at a glance which building runs the war.
      g.fillStyle(ink, 1);
      g.fillRect(px - S * 0.02, py - S * 0.62, S * 0.045, S * 0.24);
      break;
    }

    // ---- economy ---------------------------------------------------------
    case 'supplyDepot':
    case 'supplyCache': {
      // Loading bays, seen from above.
      shed();
      g.fillStyle(COLORS.paperWarm, 0.85);
      for (let i = 0; i < 3; i++) {
        g.fillRect(px - S * 0.3 + i * S * 0.23, py - S * 0.18, S * 0.11, S * 0.36);
      }
      break;
    }
    case 'fuelDepot':
    case 'fuelDump': {
      // Round tanks in a bund — nothing else on the board is two circles.
      haloBox(S * 0.86, S * 0.5);
      box(0.86, 0.5);
      g.fillStyle(trim, 1);
      g.fillCircle(px - S * 0.18, py, S * 0.16);
      g.fillCircle(px + S * 0.18, py, S * 0.16);
      g.lineStyle(Math.max(1, S * 0.03), COLORS.paperWarm, 0.8);
      g.strokeCircle(px - S * 0.18, py, S * 0.16);
      g.strokeCircle(px + S * 0.18, py, S * 0.16);
      break;
    }
    case 'storageBunker': {
      // Revetted: a battered trapezoid with a hatch.
      haloBox(S * 0.84, S * 0.6);
      g.fillStyle(ink, 1);
      g.fillPoints(
        [
          { x: px - S * 0.42, y: py + S * 0.3 },
          { x: px - S * 0.3, y: py - S * 0.3 },
          { x: px + S * 0.3, y: py - S * 0.3 },
          { x: px + S * 0.42, y: py + S * 0.3 },
        ],
        true,
      );
      box(0.22, 0.2, trim, 0, 0.02);
      break;
    }
    case 'engBay': {
      // A workshop with a gantry across it.
      shed();
      g.lineStyle(Math.max(1.5, S * 0.06), COLORS.paperWarm, 0.85);
      g.lineBetween(px - S * 0.34, py + S * 0.2, px + S * 0.34, py - S * 0.2);
      g.fillStyle(COLORS.paperWarm, 0.85);
      g.fillCircle(px + S * 0.34, py - S * 0.2, S * 0.06);
      break;
    }
    case 'barracks': {
      // A long block with bunk rows — the widest shed on the board.
      haloBox(S * 0.9, S * 0.44);
      box(0.9, 0.44);
      g.fillStyle(COLORS.paperWarm, 0.8);
      for (let i = 0; i < 4; i++) {
        g.fillRect(px - S * 0.34 + i * S * 0.2, py - S * 0.06, S * 0.13, S * 0.12);
      }
      break;
    }
    case 'motorpool': {
      // Vehicle bays: open-ended, unlike the depot's closed ones.
      haloBox(S * 0.86, S * 0.5);
      box(0.86, 0.5);
      g.fillStyle(COLORS.paperWarm, 0.85);
      for (let i = 0; i < 3; i++) {
        g.fillRect(px - S * 0.3 + i * S * 0.22, py - S * 0.24, S * 0.12, S * 0.36);
      }
      break;
    }
    case 'airfield': {
      // A strip with a dashed centreline and a hardstand. Footprint 2, and
      // now finally drawn like it.
      haloBox(S * 0.94, S * 0.4);
      box(0.94, 0.28, ink, 0, 0.06);
      g.fillStyle(COLORS.paperWarm, 0.9);
      for (let i = 0; i < 6; i++) {
        g.fillRect(px - S * 0.4 + i * S * 0.14, py + S * 0.045, S * 0.07, S * 0.03);
      }
      box(0.2, 0.16, ink, -0.3, -0.14);
      break;
    }
    case 'radar': {
      // A cabin and a dish. The only arc on the friendly side.
      haloBox(S * 0.72, S * 0.56);
      box(0.72, 0.4, ink, 0, 0.1);
      g.fillStyle(ink, 1);
      g.fillRect(px - S * 0.02, py - S * 0.28, S * 0.04, S * 0.2);
      g.lineStyle(Math.max(1.5, S * 0.07), ink, 1);
      g.beginPath();
      g.arc(px, py - S * 0.26, S * 0.2, Math.PI * 1.08, Math.PI * 1.92, false);
      g.strokePath();
      break;
    }

    // ---- emplacements ----------------------------------------------------
    case 'm2nest': {
      mount(0.64);
      disc(0.2, trim);
      aimed(() => barrel(0.52, 0.11));
      break;
    }
    case 'autocannon': {
      mount(0.7);
      disc(0.22, trim);
      aimed(() => {
        barrel(0.58, 0.1, -0.1);
        barrel(0.58, 0.1, 0.1);
      });
      break;
    }
    case 'mortar': {
      // A pit, not a mount: a ring with a tube in the middle of it.
      haloDisc(S * 0.4);
      ring(0.38, 0.09);
      disc(0.15, ink);
      break;
    }
    case 'aa': {
      // Four tubes splayed skyward. Points up whatever it last fired at,
      // because a flak mount tracks the sky, not the wire.
      mount(0.58);
      g.fillStyle(ink, 1);
      for (const dx of [-0.21, -0.07, 0.07, 0.21]) {
        g.fillRect(px + dx * S - S * 0.03, py - S * 0.52, S * 0.06, S * 0.34);
      }
      break;
    }
    case 'aaSite': {
      // A missile site: a diamond in a ring. This kind had NO case at all
      // before v1.19 — it fell through to a default dot, on every ladder
      // base, so nobody ever saw what they were shooting at.
      haloDisc(S * 0.4);
      ring(0.38, 0.07);
      g.fillStyle(ink, 1);
      g.fillPoints(
        [
          { x: px, y: py - S * 0.25 },
          { x: px + S * 0.25, y: py },
          { x: px, y: py + S * 0.25 },
          { x: px - S * 0.25, y: py },
        ],
        true,
      );
      disc(0.07, COLORS.paperWarm);
      break;
    }
    case 'manpads': {
      // A team, not a mount: a man and a tube over his shoulder.
      haloDisc(S * 0.38);
      disc(0.36, ink);
      disc(0.13, trim, 0, 0.05);
      aimed(() => barrel(0.46, 0.08, -0.14));
      break;
    }
    case 'depmg': {
      // A deployed gun: a pad rather than a built mount.
      haloDisc(S * 0.38);
      g.fillStyle(ink, 0.6);
      g.fillCircle(px, py, S * 0.36);
      disc(0.15, ink);
      aimed(() => barrel(0.42, 0.09));
      break;
    }
    case 'foxhole': {
      // A hole with spoil in front of it.
      haloDisc(S * 0.36);
      g.fillStyle(ink, 0.45);
      g.fillCircle(px, py, S * 0.34);
      g.lineStyle(Math.max(1.5, S * 0.09), ink, 1);
      g.beginPath();
      g.arc(px, py + S * 0.05, S * 0.27, Math.PI * 1.1, Math.PI * 1.9, false);
      g.strokePath();
      break;
    }
    case 'claymore': {
      // A directional charge: an arc facing the way it will fire.
      haloDisc(S * 0.3);
      g.lineStyle(Math.max(2, S * 0.12), ink, 1);
      g.beginPath();
      g.arc(px, py + S * 0.1, S * 0.24, Math.PI * 1.15, Math.PI * 1.85, false);
      g.strokePath();
      g.fillStyle(ink, 1);
      g.fillRect(px - S * 0.02, py + S * 0.06, S * 0.04, S * 0.14);
      break;
    }

    // ---- hostile towers --------------------------------------------------
    case 'hmgTower': {
      mount(0.66);
      g.lineStyle(Math.max(1.5, S * 0.07), COLORS.paperWarm, 0.8);
      g.strokeRect(px - S * 0.19, py - S * 0.19, S * 0.38, S * 0.38);
      aimed(() => barrel(0.54, 0.1));
      break;
    }
    case 'qlzTower': {
      mount(0.66);
      g.fillStyle(trim, 1);
      g.fillTriangle(px, py - S * 0.23, px + S * 0.22, py + S * 0.17, px - S * 0.22, py + S * 0.17);
      break;
    }
    case 'atgmTower': {
      mount(0.66);
      aimed(() => {
        barrel(0.56, 0.08, -0.12);
        barrel(0.56, 0.08, 0.12);
      });
      break;
    }

    // ---- anything the content adds later ---------------------------------
    default: {
      haloDisc(S * 0.34);
      disc(0.32, ink);
      disc(0.13, COLORS.paperWarm);
      break;
    }
  }

  // Level pips under the body (level 2+).
  const level = opts.level ?? 1;
  if (level > 1) {
    const pipY = py + S * 0.5 + cell * 0.1;
    const pipW = cell * 0.16;
    g.fillStyle(COLORS.paperWarm, 0.9);
    g.fillRect(px - (level * pipW) / 2 - 2, pipY - 2, level * pipW + 4, cell * 0.1 + 4);
    g.fillStyle(ink, 1);
    for (let i = 0; i < level; i++) {
      g.fillRect(px - (level * pipW) / 2 + i * pipW, pipY, pipW * 0.7, cell * 0.1);
    }
  }

  if (opts.inert) {
    // Construction: a dashed outline over a paper-washed body, which reads as
    // "planned" on a sheet the way a dimmed body never could.
    const half = S * 0.55;
    g.fillStyle(COLORS.paperWarm, 0.72);
    g.fillRect(px - half, py - half, half * 2, half * 2);
    g.lineStyle(Math.max(1.5, cell * 0.06), COLORS.marg, 0.9);
    dashedRect(g, px - half, py - half, half * 2, half * 2, cell * 0.18);
  }

  if (opts.wrecked) {
    const half = S * 0.55;
    g.fillStyle(COLORS.paperWarm, 0.6);
    g.fillRect(px - half, py - half, half * 2, half * 2);
    g.lineStyle(Math.max(2, cell * 0.08), COLORS.alarm, 0.9);
    const m = half * 0.75;
    g.lineBetween(px - m, py - m, px + m, py + m);
    g.lineBetween(px + m, py - m, px - m, py + m);
  }
}

function dashedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  dash: number,
): void {
  const edge = (x0: number, y0: number, x1: number, y1: number): void => {
    const len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    const steps = Math.floor(len / (dash * 2));
    const dx = (x1 - x0) / len;
    const dy = (y1 - y0) / len;
    for (let i = 0; i <= steps; i++) {
      const sx = x0 + dx * i * dash * 2;
      const sy = y0 + dy * i * dash * 2;
      g.lineBetween(sx, sy, sx + dx * dash, sy + dy * dash);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
}
