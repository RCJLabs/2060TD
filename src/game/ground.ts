/**
 * The topographic sheet the whole game is drawn on.
 *
 * This is the one place terrain becomes pixels. It replaces `drawFieldBase`,
 * and it is baked rather than drawn live for a reason that is easy to miss:
 * a Phaser `Graphics` command list is re-walked and re-batched EVERY FRAME.
 * The flat field it replaces cost ~300 commands a frame; contours, canopy
 * stipple and paper grain are an order of magnitude more than that, and
 * paying it sixty times a second on a phone is not an option.
 *
 * So the sheet is drawn once into a RenderTexture at 2× world resolution and
 * added to the board container at half scale. Two rules keep that safe:
 *
 * - The texture is created OFF the display list (`scene.make.renderTexture`
 *   with `false`), and only the finished object is added to `board.world`.
 *   Anything sitting on the scene root would be drawn twice — once by each
 *   camera — and `boardStrays()` fails the E2E harness on exactly that.
 * - It is destroyed on scene shutdown. Four board scenes holding 2048×1536×4
 *   is 48 MB, which is real money on a phone.
 */

import Phaser from 'phaser';
import { Ground, type TerrainField } from '../sim/terrain';
import { COLORS } from './palette';

/**
 * How much finer than a cell the sheet is drawn. Two is crisp at fit view,
 * where nearly all play happens, and softens toward the camera's 6× pinch
 * ceiling — which reads as leaning in over paper rather than as a bug.
 */
const BAKE = 2;

/** Contour interval in metres, and how often one carries its figure. */
const CONTOUR_STEP = 10;
const INDEX_EVERY = 50;

/** Samples per cell for marching squares. Finer than the grid on purpose. */
const SUB = 4;

const hash2 = (x: number, y: number, seed: number): number => {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/**
 * Marching squares over the height field.
 *
 * Contours are TRACED from the same field the sim reads, not drawn by hand —
 * which is what makes the sheet an honest picture of the ground rather than
 * an illustration of it. Segments only, no chaining: at this scale a stroked
 * soup of short lines is indistinguishable from a chained polyline, and
 * chaining is where marching squares gets fiddly.
 */
function contourSegments(
  terrain: TerrainField,
  width: number,
  height: number,
  level: number,
): number[][] {
  const nx = width * SUB;
  const ny = height * SUB;
  const segs: number[][] = [];
  const at = (i: number, j: number): number => terrain.elevationAt(i / SUB, j / SUB);
  const lerp = (a: number[], b: number[], va: number, vb: number): number[] => {
    const t = (level - va) / (vb - va || 1e-6);
    return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t];
  };

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      const v = p.map(([a, b]) => at(a!, b!));
      let idx = 0;
      for (let k = 0; k < 4; k++) if (v[k]! > level) idx |= 1 << k;
      if (idx === 0 || idx === 15) continue;
      const e = [
        (): number[] => lerp(p[0]!, p[1]!, v[0]!, v[1]!),
        (): number[] => lerp(p[1]!, p[2]!, v[1]!, v[2]!),
        (): number[] => lerp(p[2]!, p[3]!, v[2]!, v[3]!),
        (): number[] => lerp(p[3]!, p[0]!, v[3]!, v[0]!),
      ];
      const CASES: Record<number, number[][]> = {
        1: [[3, 0]],
        2: [[0, 1]],
        3: [[3, 1]],
        4: [[1, 2]],
        5: [
          [3, 0],
          [1, 2],
        ],
        6: [[0, 2]],
        7: [[3, 2]],
        8: [[2, 3]],
        9: [[2, 0]],
        10: [
          [0, 1],
          [2, 3],
        ],
        11: [[2, 1]],
        12: [[1, 3]],
        13: [[1, 0]],
        14: [[0, 3]],
      };
      for (const [a, b] of CASES[idx]!) {
        const s = e[a!]!();
        const t = e[b!]!();
        segs.push([s[0]! / SUB, s[1]! / SUB, t[0]! / SUB, t[1]! / SUB]);
      }
    }
  }
  return segs;
}

/** Everything a sheet needs to know about the board it is drawn for. */
export interface SheetOptions {
  width: number;
  height: number;
  cell: number;
  terrain: TerrainField;
  /** Column reserved for attacker entry, or -1 for no entry strip. */
  spawnColumn: number;
  /** Sheet name for the bottom-left marginalia. */
  title?: string;
}

/**
 * Bake the sheet and hand back the object to put in `board.world`.
 *
 * The caller owns it: add it to the world container and destroy it on scene
 * shutdown.
 */
export function makeSheet(
  scene: Phaser.Scene,
  opts: SheetOptions,
): Phaser.GameObjects.RenderTexture {
  const { width, height, cell } = opts;
  const pxW = width * cell;
  const pxH = height * cell;

  // `false` keeps it off the scene's display list: only the finished object
  // is added, and only to board.world, or the HUD camera draws a second copy.
  const rt = scene.make.renderTexture(
    { x: 0, y: 0, width: pxW * BAKE, height: pxH * BAKE },
    false,
  );
  rt.setOrigin(0, 0);
  rt.setScale(1 / BAKE);

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const C = cell * BAKE;
  drawSheet(g, opts, C);
  rt.draw(g);
  g.destroy();

  return rt;
}

/** The whole sheet, in one pass, at `C` pixels per cell. */
function drawSheet(g: Phaser.GameObjects.Graphics, opts: SheetOptions, C: number): void {
  const { width, height, terrain, spawnColumn } = opts;
  const pxW = width * C;
  const pxH = height * C;
  const seed = terrain.version * 7919 + 13;

  // ---- paper --------------------------------------------------------------
  g.fillStyle(COLORS.bgField, 1);
  g.fillRect(0, 0, pxW, pxH);

  // Paper tooth: a faint deterministic grain so it reads as stock, not fill.
  for (let i = 0; i < 2200; i++) {
    const r = hash2(i, i * 7 + 3, seed);
    const r2 = hash2(i * 13 + 5, i, seed);
    g.fillStyle(r > 0.5 ? 0x8a7f62 : 0xf0e8d4, 0.06);
    g.fillRect(r * pxW, r2 * pxH, 2 * BAKE, 2 * BAKE);
  }

  // ---- woodland -----------------------------------------------------------
  // A union of overlapping discs on a half-cell lattice, so the boundary
  // comes out scalloped like a canopy edge rather than stepped like a tilemap.
  const wood: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain.groundAt(y * width + x) === Ground.Wood) wood.push(x, y);
    }
  }
  g.fillStyle(COLORS.wood, 0.34);
  for (let i = 0; i < wood.length; i += 2) {
    g.fillCircle((wood[i]! + 0.5) * C, (wood[i + 1]! + 0.5) * C, C * 0.72);
  }
  g.fillStyle(COLORS.woodEdge, 0.5);
  for (let i = 0; i < wood.length; i += 2) {
    const x = wood[i]!;
    const y = wood[i + 1]!;
    for (let k = 0; k < 5; k++) {
      const jx = hash2(x * 31 + k, y, seed + 5);
      const jy = hash2(x, y * 31 + k, seed + 5);
      g.fillCircle((x + jx) * C, (y + jy) * C, C * 0.07);
    }
  }

  // ---- rough and steep going ---------------------------------------------
  // Not a tint: hachure ticks, which is how a sheet says "this is a slope"
  // without spending any of the value budget on it.
  g.lineStyle(Math.max(1, C * 0.03), COLORS.contour, 0.5);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const kind = terrain.groundAt(y * width + x);
      if (kind !== Ground.Rough && kind !== Ground.Steep) continue;
      const ticks = kind === Ground.Steep ? 3 : 2;
      for (let k = 0; k < ticks; k++) {
        const jx = hash2(x * 17 + k, y * 5, seed + 9);
        const jy = hash2(x * 5, y * 17 + k, seed + 9);
        const px = (x + 0.15 + jx * 0.7) * C;
        const py = (y + 0.15 + jy * 0.7) * C;
        g.lineBetween(px, py, px, py + C * (kind === Ground.Steep ? 0.22 : 0.14));
      }
    }
  }

  // ---- contours -----------------------------------------------------------
  let lo = Infinity;
  let hi = -Infinity;
  for (let c = 0; c < width * height; c++) {
    const h = terrain.elevation(c);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  const first = Math.ceil(lo / CONTOUR_STEP) * CONTOUR_STEP;
  for (let level = first; level <= hi; level += CONTOUR_STEP) {
    const index = level % INDEX_EVERY === 0;
    g.lineStyle(
      index ? Math.max(1, C * 0.055) : Math.max(1, C * 0.028),
      index ? COLORS.contourIndex : COLORS.contour,
      index ? 0.95 : 0.7,
    );
    for (const [x1, y1, x2, y2] of contourSegments(terrain, width, height, level)) {
      g.lineBetween(x1! * C, y1! * C, x2! * C, y2! * C);
    }
  }

  // ---- watercourse --------------------------------------------------------
  const river = terrain.river;
  if (river.length > 1) {
    const ribbon = (w: number, colour: number): void => {
      g.lineStyle(w, colour, 1);
      g.beginPath();
      g.moveTo(river[0]![0] * C, river[0]![1] * C);
      for (let i = 1; i < river.length; i++) g.lineTo(river[i]![0] * C, river[i]![1] * C);
      g.strokePath();
    };
    ribbon(C * 0.3, COLORS.waterDeep);
    ribbon(C * 0.18, COLORS.water);
  }

  // ---- road ---------------------------------------------------------------
  const road = terrain.road;
  if (road.length > 1) {
    const ribbon = (w: number, colour: number): void => {
      g.lineStyle(w, colour, 1);
      g.beginPath();
      g.moveTo(road[0]![0] * C, road[0]![1] * C);
      for (let i = 1; i < road.length; i++) g.lineTo(road[i]![0] * C, road[i]![1] * C);
      g.strokePath();
    };
    ribbon(C * 0.3, COLORS.roadCase);
    ribbon(C * 0.17, COLORS.roadFill);
  }

  // ---- the bridge ---------------------------------------------------------
  const bridge = terrain.bridge;
  if (bridge) {
    g.fillStyle(COLORS.marg, 1);
    const t = Math.max(1.5, C * 0.05);
    g.fillRect(bridge.x * C - C * 0.3, bridge.y * C - C * 0.32, t, C * 0.64);
    g.fillRect(bridge.x * C + C * 0.3 - t, bridge.y * C - C * 0.32, t, C * 0.64);
  }

  // ---- kilometre grid + edge references ----------------------------------
  g.lineStyle(Math.max(1, C * 0.02), COLORS.gridLine, 0.14);
  for (let x = 0; x <= width; x += 4) g.lineBetween(x * C, 0, x * C, pxH);
  for (let y = 0; y <= height; y += 4) g.lineBetween(0, y * C, pxW, y * C);

  // ---- the entry strip ----------------------------------------------------
  // The one thing on the sheet that is not cartography: where they come from.
  if (spawnColumn >= 0) {
    g.fillStyle(COLORS.crimson, 0.07);
    g.fillRect(spawnColumn * C, 0, C, pxH);
    g.fillStyle(COLORS.crimson, 0.4);
    for (let y = 1; y < height; y += 3) {
      const cx = spawnColumn * C + C / 2;
      const cy = y * C + C / 2;
      g.fillTriangle(cx - C * 0.22, cy - C * 0.2, cx + C * 0.26, cy, cx - C * 0.22, cy + C * 0.2);
    }
  }
}
