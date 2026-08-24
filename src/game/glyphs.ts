import type Phaser from 'phaser';
import { COLORS } from './palette';

/**
 * Shared vector glyphs for everything that stands on the battlefield, usable
 * with or without a live engine (SiegeScene, sandbox, and the TownScene all
 * draw from here). Pixel coordinates; callers convert from cells.
 */

export interface StructureGlyphOptions {
  level?: number;
  wrecked?: boolean;
  inert?: boolean;
  /** Enemy-held structure: crimson palette instead of olive/intel. */
  hostile?: boolean;
  /** Barrel heading in radians (from the renderer's last-shot tracking).
   * Absent = the resting pose, pointing up. */
  aimAngle?: number;
}


export function drawWallGlyph(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  cell: number,
  kind: string,
  hpFraction: number,
  open = false,
): void {
  // A gate reads as gateposts: closed, the leaves fill the gap; open, only the
  // posts remain, so the hole in the line is visible from across the board —
  // which is the point, because that hole is what the attack will aim at.
  if (kind === 'gate') {
    const post = Math.max(2, Math.round(cell * 0.18));
    g.fillStyle(COLORS.steel, 1);
    g.fillRect(x + 1, y + 1, post, cell - 2);
    g.fillRect(x + cell - 1 - post, y + 1, post, cell - 2);
    if (!open) {
      g.fillStyle(COLORS.sandDark, 1);
      g.fillRect(x + 1 + post, y + 2, cell - 2 - post * 2, cell - 4);
      g.fillStyle(COLORS.sand, 0.3 + 0.7 * hpFraction);
      g.fillRect(x + 2 + post, y + 3, cell - 4 - post * 2, cell - 6);
      g.lineStyle(1, COLORS.steel, 0.7);
      g.lineBetween(x + cell / 2, y + 3, x + cell / 2, y + cell - 3);
    } else {
      g.lineStyle(1, COLORS.olive, 0.55);
      g.lineBetween(x + 1 + post, y + cell / 2, x + cell - 1 - post, y + cell / 2);
    }
    return;
  }
  const isHesco = kind === 'hesco';
  g.fillStyle(isHesco ? COLORS.steel : COLORS.sandDark, 1);
  g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  g.fillStyle(COLORS.sand, 0.35 + 0.65 * hpFraction);
  g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
  if (isHesco) {
    g.lineStyle(2, COLORS.steel, 0.8);
    g.lineBetween(x + 4, y + 4, x + cell - 4, y + cell - 4);
    g.lineBetween(x + cell - 4, y + 4, x + 4, y + cell - 4);
  }
  const damage = 1 - hpFraction;
  if (damage > 0.02) {
    g.fillStyle(COLORS.signal, 0.35 * damage);
    g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
  }
}

function turretBase(
  g: Phaser.GameObjects.Graphics,
  px: number,
  py: number,
  hostile = false,
): void {
  g.fillStyle(hostile ? COLORS.crimsonDark : COLORS.oliveDark, 1);
  g.fillRect(px - 11, py - 11, 22, 22);
  g.lineStyle(1, COLORS.gridLine, 1);
  g.strokeRect(px - 11, py - 11, 22, 22);
}

function buildingBase(
  g: Phaser.GameObjects.Graphics,
  px: number,
  py: number,
  cell: number,
  fill: number,
  hostile = false,
): void {
  const half = cell - 3;
  g.fillStyle(hostile ? COLORS.crimsonDark : COLORS.oliveDark, 1);
  g.fillRect(px - half, py - half, half * 2, half * 2);
  g.lineStyle(1, COLORS.gridLine, 1);
  g.strokeRect(px - half, py - half, half * 2, half * 2);
  g.fillStyle(fill, 0.9);
  g.fillRect(px - half + 4, py - half + 4, half * 2 - 8, half * 2 - 8);
}

/**
 * Draws a structure body centered at (px, py). `cell` is the cell size in px.
 * Footprint-2 kinds draw a 2×2-sized body; the caller passes the footprint
 * center either way.
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
  const aim = opts.aimAngle ?? -Math.PI / 2; // resting pose: barrel up
  /** Draw `body` in a frame rotated to the aim heading (+x = downrange). */
  const aimed = (body: () => void): void => {
    g.save();
    g.translateCanvas(px, py);
    g.rotateCanvas(aim);
    body();
    g.restore();
  };
  switch (kind) {
    case 'cc': {
      const half = cell - 3;
      g.fillStyle(hostile ? COLORS.crimson : COLORS.intel, 1);
      g.fillRect(px - half, py - half, half * 2, half * 2);
      g.lineStyle(2, COLORS.ink, 0.9);
      g.strokeRect(px - half, py - half, half * 2, half * 2);
      break;
    }
    case 'hmgTower':
      turretBase(g, px, py, hostile);
      g.fillStyle(COLORS.crimson, 1);
      g.fillCircle(px, py, 7);
      aimed(() => {
        g.lineStyle(3, COLORS.steel, 1);
        g.lineBetween(0, 0, 12, 0);
      });
      break;
    case 'qlzTower':
      turretBase(g, px, py, hostile);
      g.fillStyle(COLORS.crimson, 1);
      g.fillCircle(px, py, 7);
      aimed(() => {
        g.lineStyle(5, COLORS.steel, 1);
        g.lineBetween(2, 0, 10, 0);
      });
      g.lineStyle(1, COLORS.signal, 0.9);
      g.strokeCircle(px, py, 9);
      break;
    case 'atgmTower':
      turretBase(g, px, py, hostile);
      g.fillStyle(COLORS.crimson, 1);
      g.fillRect(px - 7, py - 5, 14, 10);
      aimed(() => {
        g.lineStyle(2, COLORS.steel, 1);
        g.lineBetween(5, -3, 12, -3);
        g.lineBetween(5, 3, 12, 3);
      });
      break;
    case 'supplyCache':
      buildingBase(g, px, py, cell, COLORS.sandDark, hostile);
      g.fillStyle(COLORS.sand, 1);
      g.fillRect(px - 12, py - 8, 9, 7);
      g.fillRect(px + 3, py - 8, 9, 7);
      g.fillRect(px - 5, py + 2, 9, 7);
      break;
    case 'fuelDump':
      buildingBase(g, px, py, cell, COLORS.steel, hostile);
      g.fillStyle(COLORS.signal, 0.9);
      g.fillCircle(px - 8, py, 6);
      g.fillCircle(px + 8, py, 6);
      g.lineStyle(1, COLORS.bgField, 1);
      g.strokeCircle(px - 8, py, 6);
      g.strokeCircle(px + 8, py, 6);
      break;
    case 'supplyDepot':
      buildingBase(g, px, py, cell, COLORS.sandDark, hostile);
      g.fillStyle(COLORS.sand, 1); // crates
      g.fillRect(px - 12, py - 10, 10, 8);
      g.fillRect(px + 2, py - 10, 10, 8);
      g.fillRect(px - 5, py + 2, 10, 8);
      break;
    case 'fuelDepot':
      buildingBase(g, px, py, cell, COLORS.steel, hostile);
      g.fillStyle(COLORS.signal, 0.9); // drums
      g.fillCircle(px - 8, py, 7);
      g.fillCircle(px + 8, py, 7);
      g.lineStyle(1, COLORS.bgField, 1);
      g.strokeCircle(px - 8, py, 7);
      g.strokeCircle(px + 8, py, 7);
      break;
    case 'storageBunker':
      buildingBase(g, px, py, cell, COLORS.sandDark);
      g.lineStyle(3, COLORS.sand, 0.9); // roof ribs
      g.lineBetween(px - 12, py - 8, px + 12, py - 8);
      g.lineBetween(px - 12, py, px + 12, py);
      g.lineBetween(px - 12, py + 8, px + 12, py + 8);
      break;
    case 'engBay':
      buildingBase(g, px, py, cell, COLORS.olive);
      g.lineStyle(3, COLORS.ink, 0.85); // wrench chevron
      g.lineBetween(px - 8, py + 6, px, py - 6);
      g.lineBetween(px, py - 6, px + 8, py + 6);
      break;
    case 'barracks':
      buildingBase(g, px, py, cell, COLORS.oliveDark);
      g.fillStyle(COLORS.olive, 1); // bunk rows
      g.fillRect(px - 12, py - 9, 24, 5);
      g.fillRect(px - 12, py - 2, 24, 5);
      g.fillRect(px - 12, py + 5, 24, 5);
      break;
    case 'motorpool':
      buildingBase(g, px, py, cell, COLORS.steel);
      g.fillStyle(COLORS.oliveDark, 1); // vehicle silhouette
      g.fillRect(px - 10, py - 4, 20, 9);
      g.fillCircle(px - 6, py + 6, 3);
      g.fillCircle(px + 6, py + 6, 3);
      g.lineStyle(2, COLORS.olive, 1);
      g.lineBetween(px, py - 2, px + 13, py - 2);
      break;
    case 'airfield':
      buildingBase(g, px, py, cell, COLORS.steel);
      // A strip with its centreline, and a pad marking off one end.
      g.fillStyle(COLORS.ink, 0.5);
      g.fillRect(px - 14, py - 5, 28, 10);
      g.lineStyle(2, COLORS.sand, 0.9);
      g.lineBetween(px - 11, py, px + 11, py);
      g.lineStyle(2, COLORS.olive, 1);
      g.strokeCircle(px + 9, py - 9, 4);
      break;
    case 'radar':
      buildingBase(g, px, py, cell, COLORS.intel);
      // Dish on a mast, angled skyward, plus a signal tick.
      g.lineStyle(3, COLORS.steel, 1);
      g.lineBetween(px - 2, py + 10, px - 2, py - 2);
      g.lineStyle(3, COLORS.ink, 0.9);
      g.beginPath();
      g.arc(px + 1, py - 4, 8, Math.PI * 0.75, Math.PI * 1.45, false);
      g.strokePath();
      g.fillStyle(COLORS.tracer, 0.9);
      g.fillCircle(px + 7, py - 10, 2);
      break;
    case 'm2nest':
      turretBase(g, px, py, hostile);
      g.fillStyle(hostile ? COLORS.crimson : COLORS.olive, 1);
      g.fillCircle(px, py, 7);
      aimed(() => {
        g.lineStyle(3, COLORS.steel, 1);
        g.lineBetween(0, 0, 12, 0);
      });
      break;
    case 'autocannon':
      turretBase(g, px, py, hostile);
      g.fillStyle(hostile ? COLORS.crimson : COLORS.olive, 1);
      g.fillCircle(px, py, 7);
      aimed(() => {
        g.lineStyle(2, COLORS.steel, 1);
        g.lineBetween(0, -3, 13, -3);
        g.lineBetween(0, 3, 13, 3);
      });
      break;
    case 'mortar':
      turretBase(g, px, py, hostile);
      g.lineStyle(3, COLORS.steel, 1);
      g.strokeCircle(px, py, 7);
      g.fillStyle(hostile ? COLORS.crimson : COLORS.olive, 1);
      g.fillCircle(px, py, 3);
      break;
    case 'depmg':
      g.fillStyle(COLORS.steel, 0.35);
      g.fillRect(px - 10, py - 10, 20, 20);
      g.fillStyle(COLORS.steel, 1);
      g.fillCircle(px, py, 5);
      aimed(() => {
        g.lineStyle(2, COLORS.ink, 0.8);
        g.lineBetween(0, 0, 9, 0);
      });
      break;
    case 'foxhole':
      g.fillStyle(COLORS.sandDark, 0.8);
      g.fillCircle(px, py, 10);
      g.lineStyle(3, COLORS.steel, 1);
      g.beginPath();
      g.arc(px, py, 10, Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(COLORS.olive, 1);
      g.fillCircle(px, py, 4);
      break;
    case 'claymore':
      g.fillStyle(COLORS.signal, 0.9);
      g.fillTriangle(px + 4, py - 5, px + 4, py + 5, px - 6, py);
      break;
    // ---- the air layer (v1.0) ------------------------------------------------
    // AA reads as barrels pointed UP: quad tubes on a mount, drawn splayed so
    // the one emplacement that cannot help against infantry is obvious.
    case 'aa': {
      turretBase(g, px, py, hostile);
      g.fillStyle(hostile ? COLORS.crimson : COLORS.olive, 1);
      g.fillCircle(px, py, 6);
      g.lineStyle(2, COLORS.steel, 1);
      g.lineBetween(px - 2, py - 2, px - 9, py - 11);
      g.lineBetween(px + 2, py - 2, px + 9, py - 11);
      g.lineBetween(px - 4, py, px - 12, py - 6);
      g.lineBetween(px + 4, py, px + 12, py - 6);
      break;
    }
    case 'manpads':
      // Two men and a tube, over open ground: no revetment to draw.
      g.fillStyle(COLORS.steel, 0.3);
      g.fillCircle(px, py, 9);
      g.fillStyle(COLORS.steel, 1);
      g.fillCircle(px, py + 2, 4);
      g.lineStyle(2, COLORS.intel, 1);
      g.lineBetween(px - 5, py + 4, px + 7, py - 8);
      break;
    default:
      turretBase(g, px, py, hostile);
      g.fillStyle(hostile ? COLORS.crimson : COLORS.olive, 1);
      g.fillCircle(px, py, 6);
      break;
  }

  // Level pips under the body (level 2+).
  const level = opts.level ?? 1;
  if (level > 1) {
    g.fillStyle(COLORS.ink, 0.9);
    const baseX = px - (level - 1) * 4;
    const pipY = py + (kind === 'cc' || isBuildingKind(kind) ? cell - 3 : 11) + 4;
    for (let i = 0; i < level; i++) {
      g.fillRect(baseX + i * 8 - 5, pipY, 5, 3);
    }
  }

  if (opts.inert) {
    // Construction scaffolding: dashed outline over a dimmed body.
    const half = isBigKind(kind) ? cell - 3 : 12;
    g.fillStyle(COLORS.bgField, 0.55);
    g.fillRect(px - half, py - half, half * 2, half * 2);
    g.lineStyle(2, COLORS.sand, 0.9);
    dashedRect(g, px - half, py - half, half * 2, half * 2, 6);
  }

  if (opts.wrecked) {
    const half = isBigKind(kind) ? cell - 3 : 12;
    g.fillStyle(0x000000, 0.45);
    g.fillRect(px - half, py - half, half * 2, half * 2);
    g.lineStyle(3, COLORS.alarm, 0.9);
    g.lineBetween(px - half + 4, py - half + 4, px + half - 4, py + half - 4);
    g.lineBetween(px + half - 4, py - half + 4, px - half + 4, py + half - 4);
  }
}

const BUILDING_KINDS = new Set([
  'supplyDepot',
  'fuelDepot',
  'storageBunker',
  'engBay',
  'radar',
  'barracks',
  'motorpool',
  'supplyCache',
  'fuelDump',
]);
const isBuildingKind = (kind: string): boolean => BUILDING_KINDS.has(kind);
const isBigKind = (kind: string): boolean => kind === 'cc' || BUILDING_KINDS.has(kind);

function dashedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  dash: number,
): void {
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
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
