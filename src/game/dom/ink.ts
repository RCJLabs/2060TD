import type { Ink, InkPoint } from '../ink';
import { css } from '../palette';

type PathStep =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'line'; x: number; y: number }
  | { kind: 'arc'; x: number; y: number; r: number; a0: number; a1: number; ccw: boolean }
  | { kind: 'close' };

/**
 * The glyphs' Graphics calls, drawn into a 2D canvas (M30).
 *
 * A DOM row that shows a silhouette gets a small `<canvas>` and one of these,
 * and the row's icon function draws into it exactly as it draws onto the
 * board. Coordinates are the canvas's own pixels, which the kit sizes at the
 * device's resolution, so a glyph is laid out in the same device px it always
 * was.
 *
 * The one semantic that needs care is the PATH. Phaser keeps a path built by
 * `beginPath`/`moveTo`/`lineTo` apart from its one-shot shapes, so a
 * `fillCircle` in the middle of building one leaves it alone. A canvas has a
 * single current path, and a circle drawn with it would erase the caller's.
 * So the path is recorded here and replayed on `strokePath`, and every shape
 * starts a path of its own.
 */
export class CanvasInk implements Ink {
  private fillCss = '#000000';
  private fillAlpha = 1;
  private lineCss = '#000000';
  private lineAlpha = 1;
  private lineWidth = 1;
  private path: PathStep[] = [];

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  fillStyle(color: number, alpha = 1): this {
    this.fillCss = css(color);
    this.fillAlpha = alpha;
    return this;
  }

  lineStyle(lineWidth: number, color: number, alpha = 1): this {
    this.lineWidth = lineWidth;
    this.lineCss = css(color);
    this.lineAlpha = alpha;
    return this;
  }

  private asFill(): CanvasRenderingContext2D {
    this.ctx.globalAlpha = this.fillAlpha;
    this.ctx.fillStyle = this.fillCss;
    return this.ctx;
  }

  private asStroke(): CanvasRenderingContext2D {
    this.ctx.globalAlpha = this.lineAlpha;
    this.ctx.strokeStyle = this.lineCss;
    this.ctx.lineWidth = this.lineWidth;
    return this.ctx;
  }

  fillRect(x: number, y: number, width: number, height: number): this {
    this.asFill().fillRect(x, y, width, height);
    return this;
  }

  strokeRect(x: number, y: number, width: number, height: number): this {
    this.asStroke().strokeRect(x, y, width, height);
    return this;
  }

  fillCircle(x: number, y: number, radius: number): this {
    const c = this.asFill();
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fill();
    return this;
  }

  strokeCircle(x: number, y: number, radius: number): this {
    const c = this.asStroke();
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.stroke();
    return this;
  }

  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this {
    const c = this.asFill();
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.lineTo(x2, y2);
    c.closePath();
    c.fill();
    return this;
  }

  fillPoints(points: InkPoint[], _closeShape = false, _closePath = false, endIndex = points.length): this {
    const end = Math.min(endIndex, points.length);
    if (end < 2) return this;
    const c = this.asFill();
    c.beginPath();
    c.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < end; i++) c.lineTo(points[i]!.x, points[i]!.y);
    c.closePath();
    c.fill();
    return this;
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    const c = this.asStroke();
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    return this;
  }

  beginPath(): this {
    this.path = [];
    return this;
  }

  moveTo(x: number, y: number): this {
    this.path.push({ kind: 'move', x, y });
    return this;
  }

  lineTo(x: number, y: number): this {
    this.path.push({ kind: 'line', x, y });
    return this;
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false): this {
    this.path.push({ kind: 'arc', x, y, r: radius, a0: startAngle, a1: endAngle, ccw: anticlockwise });
    return this;
  }

  closePath(): this {
    this.path.push({ kind: 'close' });
    return this;
  }

  private tracePath(c: CanvasRenderingContext2D): void {
    c.beginPath();
    for (const step of this.path) {
      if (step.kind === 'move') c.moveTo(step.x, step.y);
      else if (step.kind === 'line') c.lineTo(step.x, step.y);
      else if (step.kind === 'arc') c.arc(step.x, step.y, step.r, step.a0, step.a1, step.ccw);
      else c.closePath();
    }
  }

  strokePath(): this {
    const c = this.asStroke();
    this.tracePath(c);
    c.stroke();
    return this;
  }

  fillPath(): this {
    const c = this.asFill();
    this.tracePath(c);
    c.fill();
    return this;
  }

  save(): this {
    this.ctx.save();
    return this;
  }

  restore(): this {
    this.ctx.restore();
    return this;
  }

  translateCanvas(x: number, y: number): this {
    this.ctx.translate(x, y);
    return this;
  }

  rotateCanvas(radians: number): this {
    this.ctx.rotate(radians);
    return this;
  }

  clear(): this {
    const c = this.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.restore();
    this.path = [];
    this.fillCss = this.lineCss = '#000000';
    this.fillAlpha = this.lineAlpha = this.lineWidth = 1;
    return this;
  }
}

/**
 * A canvas `size` device px square (or `w` x `h`), shown at CSS size, with the
 * ink that draws into it.
 */
export function inkCanvas(w: number, h: number, dpr: number): { canvas: HTMLCanvasElement; ink: CanvasInk } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  return { canvas, ink: new CanvasInk(ctx) };
}
