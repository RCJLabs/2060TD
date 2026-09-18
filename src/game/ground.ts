/**
 * The page the whole game is drawn on.
 *
 * This is the one place terrain becomes pixels. It is baked rather than drawn
 * live for a reason that is easy to miss: a Phaser `Graphics` command list is
 * re-walked and re-batched EVERY FRAME, and a screentone board is tens of
 * thousands of dots. Baking makes that a one-off.
 *
 * It bakes onto a **Canvas2D texture** rather than into a `RenderTexture`,
 * which is the change that made the ink direction possible at all. Screentone
 * is a repeating pattern fill, `createPattern` is native to Canvas2D, and
 * Phaser `Graphics` has no equivalent — a Graphics implementation would have
 * to emit one `fillCircle` per dot, about 31,000 of them for a 32x24 board at
 * 2x, where this is one `fillRect` per region. Canvas2D also brings real
 * clipping, dashes and line joins, which the keyline style leans on.
 *
 * Three rules keep it safe:
 *
 * - The image is created OFF the display list (`scene.make.image` with
 *   `false`), and only the finished object is added, and only to
 *   `board.world`. Anything sitting on the scene root is drawn twice — once
 *   by each camera — and `boardStrays()` fails the E2E harness on exactly
 *   that.
 * - Because it lives in `board.world`, the tone is locked to the WORLD. Pan
 *   and the dots stay on the ground; zoom and you lean in over the paper. A
 *   screen-locked dot screen crawls, and that is the usual way this style
 *   fails in a game.
 * - The texture is removed from the manager when the image is destroyed.
 *   Four board scenes holding 2048x1536x4 is 48 MB, which is real money on a
 *   phone, and unlike a RenderTexture an Image's destroy does not free the
 *   texture behind it.
 */

import Phaser from 'phaser';
import { Ground, type TerrainField } from '../sim/terrain';
import type { SpawnEdge } from '../sim/types';
import { COLORS, css } from './palette';
import { INK, PAPER, toneFill, type ToneKind } from './tone';

/**
 * How much finer than a cell the sheet is drawn. Two is crisp at fit view,
 * where nearly all play happens, and softens toward the camera's 6x pinch
 * ceiling — which reads as leaning in over paper rather than as a bug.
 */
const BAKE = 2;

/** Contour interval in metres, and how often one carries its figure. */
const CONTOUR_STEP = 10;
const INDEX_EVERY = 50;

/** Samples per cell for marching squares. Finer than the grid on purpose. */
const SUB = 4;

/**
 * What each ground kind is shaded with.
 *
 * This is the legend, and it is the whole reason the direction is structural
 * rather than decorative: the density you see IS the class the sim reads.
 * Road and water are absent because neither is a dot screen — the road is
 * bare paper knocked out of the tone, and water is a line screen laid as a
 * ribbon rather than per cell.
 */
const GROUND_TONE: Partial<Record<Ground, ToneKind>> = {
  [Ground.Open]: 't10',
  [Ground.Rough]: 't20',
  [Ground.Steep]: 't40',
};

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
  /** Lane reserved for attacker entry, or -1 for no entry strip. */
  spawnLane: number;
  /** Which edge that lane runs along. */
  spawnEdge: SpawnEdge;
  /** Sheet name for the bottom-left marginalia. */
  title?: string;
}

let sheetSeq = 0;

/**
 * Bake the page and hand back the object to put in `board.world`.
 *
 * The caller owns it: add it to the world container and let scene shutdown
 * destroy it. Freeing the texture behind it is wired to that destroy here, so
 * no call site has to remember.
 */
export function makeSheet(scene: Phaser.Scene, opts: SheetOptions): Phaser.GameObjects.Image {
  const { width, height, cell } = opts;
  const pxW = width * cell;
  const pxH = height * cell;
  const key = `sheet-${++sheetSeq}`;

  const tex = scene.textures.createCanvas(key, pxW * BAKE, pxH * BAKE);
  if (tex) {
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    paintSheet(ctx, opts, cell * BAKE, BAKE);
    tex.refresh();
  }

  // `false` keeps it off the scene's display list: only the finished object
  // is added, and only to board.world, or the HUD camera draws a second copy.
  const img = scene.make.image({ x: 0, y: 0, key }, false);
  img.setOrigin(0, 0);
  img.setScale(1 / BAKE);
  // An Image does not own its texture, so nothing else would ever free this.
  img.once(Phaser.GameObjects.Events.DESTROY, () => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  });
  return img;
}

/** The whole page, in one pass, at `C` texture px per cell. */
function paintSheet(
  ctx: CanvasRenderingContext2D,
  opts: SheetOptions,
  C: number,
  scale: number,
): void {
  const { width, height, terrain, spawnLane, spawnEdge } = opts;
  const pxW = width * C;
  const pxH = height * C;
  const seed = terrain.version * 7919 + 13;
  const hair = Math.max(1, C * 0.028);

  /** A spline in cell units, as a path ready to stroke. */
  const spline = (pts: readonly (readonly number[])[]): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0]![0]! * C, pts[0]![1]! * C);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0]! * C, pts[i]![1]! * C);
  };

  // ---- paper --------------------------------------------------------------
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, pxW, pxH);

  // ---- the tone screens ---------------------------------------------------
  // One fillRect per cell, but the pattern is anchored to the canvas origin,
  // so the dots run continuously across cell boundaries and the board reads
  // as one laid sheet rather than as a patchwork.
  for (const [kindStr, tone] of Object.entries(GROUND_TONE)) {
    const kind = Number(kindStr) as Ground;
    toneFill(ctx, tone!, scale);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain.groundAt(y * width + x) === kind) ctx.fillRect(x * C, y * C, C, C);
      }
    }
  }

  // ---- contours -----------------------------------------------------------
  // Under the woodland, water and road, so those knock the hairlines out
  // cleanly rather than fighting them.
  let lo = Infinity;
  let hi = -Infinity;
  for (let c = 0; c < width * height; c++) {
    const h = terrain.elevation(c);
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';
  const first = Math.ceil(lo / CONTOUR_STEP) * CONTOUR_STEP;
  for (let level = first; level <= hi; level += CONTOUR_STEP) {
    const index = level % INDEX_EVERY === 0;
    ctx.lineWidth = index ? hair * 2.2 : hair;
    ctx.globalAlpha = index ? 1 : 0.72;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of contourSegments(terrain, width, height, level)) {
      ctx.moveTo(x1! * C, y1! * C);
      ctx.lineTo(x2! * C, y2! * C);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---- woodland -----------------------------------------------------------
  // A union of overlapping discs on the cell lattice, so the boundary comes
  // out scalloped like a canopy edge rather than stepped like a tilemap. The
  // whole union is filled ONCE, which is what keeps the hatch continuous
  // across it instead of restarting inside every disc.
  const discUnion = (kinds: Ground[], r: number): Path2D | null => {
    const path = new Path2D();
    let any = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!kinds.includes(terrain.groundAt(y * width + x))) continue;
        path.moveTo((x + 0.5) * C + r, (y + 0.5) * C);
        path.arc((x + 0.5) * C, (y + 0.5) * C, r, 0, Math.PI * 2);
        any = true;
      }
    }
    return any ? path : null;
  };

  const wood = discUnion([Ground.Wood], C * 0.72);
  if (wood) {
    ctx.fillStyle = PAPER;
    ctx.fill(wood);
    toneFill(ctx, 'hatch', scale);
    ctx.fill(wood);
    // Canopy stipple: solid ink blobs scattered inside the mask, which is
    // what stops a hatched blob reading as a hatched blob.
    ctx.save();
    ctx.clip(wood);
    ctx.fillStyle = INK;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (terrain.groundAt(y * width + x) !== Ground.Wood) continue;
        for (let k = 0; k < 2; k++) {
          const jx = hash2(x * 31 + k, y, seed + 5);
          const jy = hash2(x, y * 31 + k, seed + 5);
          ctx.beginPath();
          ctx.arc((x + jx) * C, (y + jy) * C, C * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---- watercourse --------------------------------------------------------
  // A line screen rather than a dot screen: dots are a surface you walk on,
  // lines are a material you do not.
  const bank = hair * 2.2;
  const water = discUnion([Ground.Water], C * 0.6);
  const channel = discUnion([Ground.Water], C * 0.6 - bank);
  if (water) {
    // The bank is an ERODED union, not a stroke. Stroking a path of
    // overlapping discs strokes every subpath — including the arcs buried
    // inside the union — which turns a river into a chain of beads. Filling
    // the union in ink and the same union inset by the line width on top of
    // it gives a true outline of exactly that width.
    ctx.fillStyle = INK;
    ctx.fill(water);
    ctx.fillStyle = PAPER;
    if (channel) ctx.fill(channel);
    toneFill(ctx, 'cross', scale);
    if (channel) ctx.fill(channel);
  }
  const river = terrain.river;
  if (river.length > 1) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = hair * 1.8;
    ctx.lineJoin = 'round';
    spline(river);
    ctx.stroke();
  }

  // ---- road ---------------------------------------------------------------
  // Bare paper with an ink casing, which makes it the brightest thing on the
  // board without spending any colour on it. Drawn as a casing stroke under a
  // paper stroke, so the two edges come out parallel round every bend.
  const road = terrain.road;
  if (road.length > 1) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = C * 0.9;
    spline(road);
    ctx.stroke();
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = C * 0.9 - hair * 3;
    spline(road);
    ctx.stroke();
    // The centre line: dashed, the way a sheet draws a metalled road.
    ctx.strokeStyle = INK;
    ctx.lineWidth = hair;
    ctx.setLineDash([C * 0.5, C * 0.42]);
    spline(road);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- the bridge ---------------------------------------------------------
  const bridge = terrain.bridge;
  if (bridge) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = hair * 2.4;
    ctx.beginPath();
    ctx.moveTo(bridge.x * C - C * 0.5, bridge.y * C - C * 0.5);
    ctx.lineTo(bridge.x * C + C * 0.5, bridge.y * C - C * 0.5);
    ctx.moveTo(bridge.x * C - C * 0.5, bridge.y * C + C * 0.5);
    ctx.lineTo(bridge.x * C + C * 0.5, bridge.y * C + C * 0.5);
    ctx.stroke();
  }

  // ---- kilometre grid -----------------------------------------------------
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1, C * 0.016);
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 4) {
    ctx.moveTo(x * C, 0);
    ctx.lineTo(x * C, pxH);
  }
  for (let y = 0; y <= height; y += 4) {
    ctx.moveTo(0, y * C);
    ctx.lineTo(pxW, y * C);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ---- the entry strip ----------------------------------------------------
  // The one thing on the sheet that is not cartography: where they come from.
  // Solid ink, because everything hostile on this page is solid ink.
  if (spawnLane >= 0) {
    // The arrows point INTO the board, along the direction of the advance, so
    // the strip reads as a direction rather than as a decorated edge. On the
    // portrait board that is downward; on a legacy western one, rightward.
    const north = spawnEdge === 'north';
    const along = north ? width : height;
    const mid = spawnLane * C + C / 2;
    const far = north ? pxW : pxH;
    /** Approach space to canvas: `d` across the lane, `a` along the edge. */
    const px = (d: number, a: number): [number, number] => (north ? [a, d] : [d, a]);

    ctx.strokeStyle = INK;
    ctx.lineWidth = hair * 1.4;
    ctx.setLineDash([C * 0.3, C * 0.3]);
    ctx.beginPath();
    for (const edge of [spawnLane * C, (spawnLane + 1) * C]) {
      ctx.moveTo(...px(edge, 0));
      ctx.lineTo(...px(edge, far));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = INK;
    for (let i = 1; i < along; i += 3) {
      const a = i * C + C / 2;
      ctx.beginPath();
      ctx.moveTo(...px(mid - C * 0.22, a - C * 0.22));
      ctx.lineTo(...px(mid + C * 0.26, a));
      ctx.lineTo(...px(mid - C * 0.22, a + C * 0.22));
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- marginalia ---------------------------------------------------------
  // A map with labels on it is what the fiction wants, and a caption in the
  // margin is native to a comic page rather than clutter on it.
  if (opts.title) {
    const size = Math.round(C * 0.36);
    ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.textBaseline = 'alphabetic';
    const label = opts.title.toUpperCase();
    const w = ctx.measureText(label).width;
    ctx.fillStyle = PAPER;
    ctx.fillRect(C * 0.4, pxH - C * 1.5, w + C * 0.5, size + C * 0.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = hair * 2;
    ctx.strokeRect(C * 0.4, pxH - C * 1.5, w + C * 0.5, size + C * 0.4);
    ctx.fillStyle = INK;
    ctx.fillText(label, C * 0.65, pxH - C * 1.5 + size + C * 0.1);
  }

  // ---- the panel border ---------------------------------------------------
  // The board is a panel on the page, and a comic panel has a heavy edge.
  ctx.strokeStyle = css(COLORS.oliveDark);
  ctx.lineWidth = C * 0.16;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, pxW - ctx.lineWidth, pxH - ctx.lineWidth);
}
