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
  /**
   * The surface behind this glyph is DARK — a drawer row, a spec card.
   *
   * Same reason the attackers carry it: the paper knockout lifts a counter
   * off the map sheet and paints a cream chip on the panel, where the
   * silhouette then reads as a hole rather than a shape.
   */
  onDark?: boolean;
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
  const dark = opts.onDark ?? false;
  const ink = dark
    ? hostile
      ? COLORS.crimson
      : COLORS.ink
    : hostile
      ? COLORS.crimsonDark
      : COLORS.oliveDark;
  const trim = dark
    ? hostile
      ? COLORS.crimsonDark
      : COLORS.inkDim
    : hostile
      ? COLORS.crimson
      : COLORS.olive;
  const aim = opts.aimAngle ?? -Math.PI / 2; // resting pose: barrel up

  /** Paper knockout, so the silhouette sits ON the sheet, not in it. */
  const haloBox = (w: number, h: number): void => {
    if (dark) return;
    const m = cell * HALO;
    g.fillStyle(COLORS.paperWarm, 0.92);
    g.fillRect(px - w / 2 - m, py - h / 2 - m, w + m * 2, h + m * 2);
  };
  const haloDisc = (r: number): void => {
    if (dark) return;
    g.fillStyle(COLORS.paperWarm, 0.92);
    g.fillCircle(px, py, r + cell * HALO);
  };
  /**
   * The ground showing through a shape — a courtyard, a hatch, a window slit.
   * It is the SURFACE colour, not paper, or every cut-out becomes a cream
   * chip the moment the glyph is drawn on the panel.
   */
  const cut = dark ? COLORS.bgPanel : COLORS.paperWarm;

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
      g.fillStyle(cut, 0.85);
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
      g.lineStyle(Math.max(1, S * 0.03), cut, 0.8);
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
      g.lineStyle(Math.max(1.5, S * 0.06), cut, 0.85);
      g.lineBetween(px - S * 0.34, py + S * 0.2, px + S * 0.34, py - S * 0.2);
      g.fillStyle(cut, 0.85);
      g.fillCircle(px + S * 0.34, py - S * 0.2, S * 0.06);
      break;
    }
    case 'barracks': {
      // A long block with bunk rows — the widest shed on the board.
      haloBox(S * 0.9, S * 0.44);
      box(0.9, 0.44);
      g.fillStyle(cut, 0.8);
      for (let i = 0; i < 4; i++) {
        g.fillRect(px - S * 0.34 + i * S * 0.2, py - S * 0.06, S * 0.13, S * 0.12);
      }
      break;
    }
    case 'motorpool': {
      // Vehicle bays: open-ended, unlike the depot's closed ones.
      haloBox(S * 0.86, S * 0.5);
      box(0.86, 0.5);
      g.fillStyle(cut, 0.85);
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
      g.fillStyle(cut, 0.9);
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
      disc(0.07, cut);
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
      g.lineStyle(Math.max(1.5, S * 0.07), cut, 0.8);
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
      disc(0.13, cut);
      break;
    }
  }

  // Level pips under the body (level 2+).
  const level = opts.level ?? 1;
  if (level > 1) {
    const pipY = py + S * 0.5 + cell * 0.1;
    const pipW = cell * 0.16;
    g.fillStyle(cut, 0.9);
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
    g.fillStyle(cut, 0.72);
    g.fillRect(px - half, py - half, half * 2, half * 2);
    g.lineStyle(Math.max(1.5, cell * 0.06), COLORS.marg, 0.9);
    dashedRect(g, px - half, py - half, half * 2, half * 2, cell * 0.18);
  }

  if (opts.wrecked) {
    const half = S * 0.55;
    g.fillStyle(cut, 0.6);
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

/**
 * How wide an attacker glyph reaches, as a fraction of the `cell` it is given.
 *
 * A caller that wants one to FILL a box needs this, and cannot guess it from
 * the structure glyphs: those fill `cell * footprint * 0.9`, while these are
 * counters standing inside a cell with ground visible around them. The widest
 * shape in the set is the tank, 26 of the 32 units a cell divides into, and it
 * sets the number — a smaller one makes every infantry counter fit and lets
 * the armour spill out of its row and into the label.
 */
export const ATTACKER_GLYPH_SPAN = 26 / 32;

/** How an attacker glyph is dressed: whose it is, and which way it points. */
export interface AttackerGlyphOptions {
  /** Olive when the unit is ours, crimson when it is coming for us. */
  friendly?: boolean;
  /** Heading in radians; +x is the way it faces. Only hulls and rotors turn. */
  facing?: number;
  /** Read only by the fallback shape: a breaker draws as a diamond. */
  wallDps?: number;
  /**
   * The surface behind this counter is DARK — a drawer row, a spec card —
   * rather than the map sheet.
   *
   * The paper knockout exists to lift a counter off busy contours. On the
   * panel it does the opposite: it paints a cream card and the silhouette
   * becomes a hole in it, which is how the muster ended up looking like a
   * row of bright chips. On dark the knockout goes and the ink inverts, so
   * the same shape reads light-on-dark like everything else in the drawer.
   */
  onDark?: boolean;
}

/**
 * One attacker, as a counter on the sheet.
 *
 * Same three rules as the structures: shape is the role, colour is the
 * allegiance, and everything gets a paper knockout so a unit standing on a
 * contour is still a unit. Thirty-four named kinds resolve to nine
 * silhouettes — a rifleman and a conscript are the same job in different
 * armies, and pretending otherwise would be thirty-four shapes nobody can
 * tell apart.
 *
 * Facing matters for anything with a hull or a rotor and not for a man, so
 * only the vehicle shapes rotate.
 */
export function drawAttackerGlyph(
  g: Phaser.GameObjects.Graphics,
  kind: string,
  px: number,
  py: number,
  cell: number,
  opts: AttackerGlyphOptions = {},
): void {
  // In raids the attacking units are the player's own — olive; defending,
  // they're the enemy — crimson. On a dark surface both invert: the ink is
  // the light one and the knockout is gone.
  const friendly = opts.friendly ?? false;
  const dark = opts.onDark ?? false;
  const body = dark
    ? friendly
      ? COLORS.ink
      : COLORS.crimson
    : friendly
      ? COLORS.oliveDark
      : COLORS.crimsonDark;
  const trim = dark
    ? friendly
      ? COLORS.inkDim
      : COLORS.crimsonDark
    : friendly
      ? COLORS.olive
      : COLORS.crimson;
  /** The darkest note: tracks, wheels, a gun barrel. Flips with the rest. */
  const shade = dark ? COLORS.inkDim : COLORS.oliveDark;
  /** The knockout colour, or nothing at all when the ground is already dark. */
  const knockout = (alpha = 0.9): boolean => {
    if (dark) return false;
    g.fillStyle(COLORS.paperWarm, alpha);
    return true;
  };
  const u = cell / 32; // glyph unit: everything below is authored at CELL=32

  const halo = (r: number): void => {
    if (!knockout()) return;
    g.fillCircle(px, py, r * u);
  };
  const haloBox = (w: number, h: number): void => {
    if (!knockout()) return;
    g.fillRect(px - (w * u) / 2 - 2, py - (h * u) / 2 - 2, w * u + 4, h * u + 4);
  };
  /** Draw `shape` rotated to the unit's heading (+x = the way it faces). */
  const facing = (shape: () => void): void => {
    g.save();
    g.translateCanvas(px, py);
    g.rotateCanvas(opts.facing ?? 0);
    shape();
    g.restore();
  };
  const hull = (len: number, wide: number, colour = body): void => {
    g.fillStyle(colour, 1);
    g.fillRect((-len / 2) * u, (-wide / 2) * u, len * u, wide * u);
  };

  // ---- the primitives every silhouette is built from ---------------------
  //
  // All of these draw in FACING space: the origin is the unit and +x is the
  // way it is pointing, so a caller inside `facing()` writes the shape once
  // and it turns with the heading.
  //
  // They exist because the set they replaced resolved thirty-four kinds to
  // nine shapes — three plain discs, five identical donuts, five identical
  // diamonds — and a roster where a rifleman, a sapper and an anti-tank team
  // differ by a dot is a roster you read by hovering, not by looking. What
  // separates them now is the OUTLINE, because at the size a drawer row gives
  // a counter (26px) the inside of a shape is four pixels and carries nothing.

  /**
   * A person from directly above: shoulders across, helmet forward.
   *
   * Shoulders are wide across the body and shallow front-to-back, which is
   * the whole reason this reads as a human at a glance and a disc never did.
   * The helmet is drawn in the lighter ink so it separates from the mass at
   * card size and merges into it at row size — the silhouette survives either
   * way.
   */
  const person = (ox: number, oy: number, s = 1, head = trim): void => {
    // Shoulders BEHIND the helmet, not around it. From directly above a
    // soldier is mostly helmet with the shoulders showing behind — put the
    // body around the head instead and the outline is a domino, which is
    // what the first attempt at this drew.
    g.fillStyle(body, 1);
    g.fillRect((ox - 3.6 * s) * u, (oy - 3.5 * s) * u, 3.4 * s * u, 7 * s * u);
    g.fillStyle(head, 1);
    g.fillCircle(ox * u, oy * u, 2.9 * s * u);
  };

  /**
   * What that person is carrying. `back` is the overhang BEHIND the shoulder,
   * which is the entire tell of a recoilless launcher seen from above: a
   * rifle sticks out in front, an RPG sticks out both ways.
   */
  const carried = (ox: number, oy: number, len: number, back = 0, wide = 1.1): void => {
    g.fillStyle(trim, 1);
    g.fillRect((ox - back) * u, (oy - wide / 2) * u, (len + back) * u, wide * u);
  };

  /** Wheels, bulging past the hull — what makes a truck read as a truck. */
  const wheels = (len: number, wide: number): void => {
    g.fillStyle(shade, 1);
    const r = 1.6;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        // Proud of the hull, like the tracks and for the same reason: four
        // bulges at the corners are what separates a truck from a crate.
        g.fillRect(
          (sx * len * 0.3 - r) * u,
          (sy * (wide / 2 + 0.9) - r * 0.75) * u,
          2 * r * u,
          1.5 * r * u,
        );
      }
    }
  };

  /**
   * Tracks, running the whole length and standing PROUD of the hull.
   *
   * Inset inside the hull they are invisible — the hull is drawn over them
   * and a tank is a plain box again. Outside it, the outline gains the two
   * parallel bands that say "tracked" from any distance.
   */
  const tracks = (len: number, wide: number): void => {
    g.fillStyle(shade, 1);
    for (const sy of [-1, 1]) {
      g.fillRect((-len / 2) * u, (sy * (wide / 2 + 1.3) - 1.3) * u, len * u, 2.6 * u);
    }
  };

  /** A rotor disc: the blur a turning blade makes, not the blade. */
  const rotor = (r: number, at = 0): void => {
    g.lineStyle(Math.max(1, 1.3 * u), body, 0.55);
    g.strokeCircle(at * u, 0, r * u);
  };

  /** A wing pair, swept back a little so the nose reads as the nose. */
  const wings = (at: number, span: number, chord: number, sweep = 0): void => {
    g.fillStyle(body, 1);
    g.fillPoints(
      [
        { x: (at + chord / 2) * u, y: -0.5 * u },
        { x: (at + chord / 2 - sweep) * u, y: -span * u },
        { x: (at - chord / 2 - sweep) * u, y: -span * u },
        { x: (at - chord / 2) * u, y: -0.5 * u },
      ],
      true,
    );
    g.fillPoints(
      [
        { x: (at + chord / 2) * u, y: 0.5 * u },
        { x: (at + chord / 2 - sweep) * u, y: span * u },
        { x: (at - chord / 2 - sweep) * u, y: span * u },
        { x: (at - chord / 2) * u, y: 0.5 * u },
      ],
      true,
    );
  };

  switch (kind) {
    // ---- a mob: several bodies, no drill --------------------------------
    // Three small figures in a wedge. The count IS the identity — what a
    // militia brings is numbers, and a single figure would say the opposite.
    case 'militia':
    case 'guardsman':
    case 'conscript': {
      halo(8);
      facing(() => {
        person(1.8, 0, 0.62, body);
        person(-1.8, -2.8, 0.62, body);
        person(-1.8, 2.8, 0.62, body);
        if (kind === 'guardsman') {
          // The one with a helmet and a weapon: China's line, not a crowd.
          g.fillStyle(trim, 1);
          g.fillCircle(2.1 * u, 0, 1.4 * u);
        }
      });
      break;
    }

    // ---- line infantry: one soldier, rifle forward ----------------------
    case 'rifle':
    case 'ranger':
    case 'motorrifle':
    case 'nkrifle':
    case 'peacekeeper': {
      halo(8);
      facing(() => {
        person(0, 0, 1.15, kind === 'peacekeeper' ? COLORS.unBlue : trim);
        carried(1.2, -2.4, 6.2);
      });
      break;
    }

    // ---- engineers: the soldier who carries the charge ------------------
    // Same body, plus the satchel — in the tracer accent, because what this
    // unit does to your wall is the reason it is on the board.
    case 'sapper':
    case 'engineer':
    case 'demoteam':
    case 'tunneler':
    case 'unsapper': {
      halo(8);
      facing(() => {
        person(0, 0, 1.15);
        g.fillStyle(COLORS.tracer, 1);
        g.fillRect(-1.2 * u, 2.4 * u, 3.6 * u, 2.8 * u);
        if (kind === 'tunneler') {
          // The mouth of the hole it came out of, behind it.
          g.lineStyle(Math.max(1, 1.2 * u), body, 0.9);
          g.strokeCircle(-5.6 * u, 0, 2.4 * u);
        }
      });
      break;
    }

    // ---- anti-tank: the tube overhangs BOTH ways ------------------------
    case 'grenadier':
    case 'javelin':
    case 'rpg':
    case 'rpg7':
    case 'nlaw': {
      halo(9);
      facing(() => {
        person(0, 0, 1.15);
        carried(1.2, -2.6, 6.4, 5.2, 1.8);
      });
      break;
    }

    // ---- the two that are a person before they are a job ----------------
    case 'infiltrator': {
      // Outline, not fill: this is the unit you are not supposed to see, and
      // a hollow counter is the only one on the sheet.
      halo(8);
      facing(() => {
        g.lineStyle(Math.max(1, 1.3 * u), COLORS.nkSlate, 1);
        g.strokeRect(-2.4 * u, -3.9 * u, 4.8 * u, 7.8 * u);
        g.strokeCircle(0.4 * u, 0, 2.4 * u);
        carried(1.2, -2.4, 4.4, 0, 0.9);
      });
      break;
    }
    case 'unmedic': {
      halo(8);
      facing(() => {
        person(0, 0, 1.15, COLORS.unBlue);
        // The cross on the back, where a medic wears it — punched through the
        // body, so it takes whatever the ground is.
        g.fillStyle(dark ? COLORS.bgPanel : COLORS.paperWarm, 1);
        g.fillRect(-2.4 * u, -0.7 * u, 4.8 * u, 1.4 * u);
        g.fillRect(-1.4 * u, -2.4 * u, 1.4 * u, 4.8 * u);
      });
      break;
    }

    // ---- wheels: a truck, and it has to look like one -------------------
    case 'humvee':
    case 'zbd':
    case 'btr':
    case 'vab': {
      haloBox(19, 13);
      facing(() => {
        hull(16, 9);
        wheels(16, 9);
        // Cab lighter than the box behind it, so the nose reads.
        g.fillStyle(trim, 1);
        g.fillRect(3.2 * u, -3.4 * u, 4.2 * u, 6.8 * u);
        // The mount on the roof: these all carry something.
        g.fillStyle(shade, 1);
        g.fillCircle(-1.4 * u, 0, 2.2 * u);
      });
      break;
    }

    // ---- tracks, turret, barrel: a tank from directly above -------------
    case 'abrams':
    case 'type99':
    case 't72':
    case 'chonma':
    case 'leo1': {
      haloBox(26, 17);
      facing(() => {
        hull(21, 12);
        tracks(21, 12);
        // Turret set BACK of centre and the barrel long and forward: the
        // proportion is the whole silhouette, and the old glyph had a stub.
        g.fillStyle(trim, 1);
        g.fillCircle(-1.6 * u, 0, 4.4 * u);
        g.fillStyle(shade, 1);
        g.fillRect(-1.6 * u, -1.1 * u, 13 * u, 2.2 * u);
      });
      break;
    }

    // ---- rotors: fuselage, tail boom, tail rotor ------------------------
    case 'wz10':
    case 'ka52':
    case 'nh90': {
      facing(() => {
        // The paper hugs the FUSELAGE. A knockout big enough to hold the rotor
        // is a cream disc two cells across, and the counter reads as a
        // lollipop — which is exactly what the old set drew. A rotor is a blur
        // and is allowed to be one, over terrain.
        if (knockout()) g.fillRect(-12.6 * u, -3.4 * u, 20 * u, 6.8 * u);
        // Tail boom and rotor, drawn before the fuselage so it sits on top.
        g.fillStyle(body, 1);
        g.fillRect(-11 * u, -1.1 * u, 7 * u, 2.2 * u);
        g.fillStyle(trim, 1);
        g.fillRect(-11.8 * u, -3.4 * u, 1.8 * u, 6.8 * u);
        hull(11, 5);
        // Nose, so the thing has a direction at a glance.
        g.fillStyle(trim, 1);
        g.fillRect(3.4 * u, -1.8 * u, 2.6 * u, 3.6 * u);
        if (kind === 'ka52') {
          // Coaxial: two discs, the one thing about a Ka-52 anybody can pick
          // out of a line-up.
          rotor(7);
          rotor(10.4);
        } else {
          rotor(10.4);
        }
      });
      break;
    }

    // ---- fixed wing: no rotor, and the wings say which -------------------
    case 'reaper': {
      // A drone: very long thin wings, slim body, V-tail.
      facing(() => {
        // Fuselage-width paper only; the wings are solid enough to read over
        // contours without a card behind them.
        if (knockout()) g.fillRect(-8.6 * u, -2.6 * u, 17 * u, 5.2 * u);
        wings(-0.5, 10.5, 2.2, 1.2);
        hull(15, 2.6);
        g.fillStyle(trim, 1);
        g.fillPoints(
          [
            { x: -6 * u, y: 0 },
            { x: -8.4 * u, y: -3.4 * u },
            { x: -7 * u, y: -3.4 * u },
          ],
          true,
        );
        g.fillPoints(
          [
            { x: -6 * u, y: 0 },
            { x: -8.4 * u, y: 3.4 * u },
            { x: -7 * u, y: 3.4 * u },
          ],
          true,
        );
      });
      break;
    }
    case 'an2': {
      // A biplane, because that is exactly what it is: two stacked wings,
      // offset, and a stubby body. Nothing else on the sheet looks like it.
      facing(() => {
        if (knockout()) g.fillRect(-8 * u, -3 * u, 15 * u, 6 * u);
        wings(1.6, 8.6, 2.6);
        wings(-2.2, 7.6, 2.4);
        hull(13, 3.4);
        g.fillStyle(trim, 1);
        g.fillRect(-7.6 * u, -3.2 * u, 1.8 * u, 6.4 * u); // tailplane
      });
      break;
    }

    default: {
      // Unknown kinds (test/sandbox content): breakers as diamonds, the
      // rest as discs, so a sandbox still reads correctly.
      halo(7);
      if ((opts.wallDps ?? 0) > 20) {
        g.fillStyle(body, 1);
        g.fillPoints(
          [
            { x: px, y: py - 6.5 * u },
            { x: px + 6.5 * u, y: py },
            { x: px, y: py + 6.5 * u },
            { x: px - 6.5 * u, y: py },
          ],
          true,
        );
      } else {
        g.fillStyle(body, 1);
        g.fillCircle(px, py, 5.5 * u);
      }
      break;
    }
  }
}
