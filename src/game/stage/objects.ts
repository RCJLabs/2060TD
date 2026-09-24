import { Emitter } from './emitter';

/**
 * What the stage draws (M30 Phase 3): a display list of objects, each with a
 * position, scale, rotation, origin and alpha, and the few kinds the board
 * needs — a container, a command list (`Graphics`), an image and text.
 *
 * The names and the defaults follow Phaser's, because every call site in the
 * game was written against Phaser: an `Image` is centred on its position and
 * a `Text` hangs from its top-left, as they were.
 */

export const OBJECT_DESTROY = 'destroy';

/** Anything the display list can hold. */
export abstract class GameObject extends Emitter {
  abstract readonly type: string;
  parentContainer: Container | null = null;
  /** The list this object sits in: a container's, or the scene's root. */
  owner: GameObject[] | null = null;
  visible = true;
  alpha = 1;
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  /** Radians. */
  rotation = 0;
  originX = 0;
  originY = 0;
  depth = 0;
  active = true;

  get angle(): number {
    return (this.rotation * 180) / Math.PI;
  }

  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }

  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }

  setPosition(x: number, y: number = x): this {
    this.x = x;
    this.y = y;
    return this;
  }

  setScale(x: number, y: number = x): this {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }

  /** Degrees, as Phaser takes it. */
  setAngle(degrees: number): this {
    this.rotation = (degrees * Math.PI) / 180;
    return this;
  }

  setRotation(radians: number): this {
    this.rotation = radians;
    return this;
  }

  setOrigin(x: number, y: number = x): this {
    this.originX = x;
    this.originY = y;
    return this;
  }

  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }

  /** Take it off whatever list holds it, without destroying it. */
  detach(): void {
    if (this.owner) {
      const at = this.owner.indexOf(this);
      if (at >= 0) this.owner.splice(at, 1);
    }
    this.owner = null;
    this.parentContainer = null;
  }

  destroy(): void {
    if (!this.active) return;
    this.active = false;
    this.detach();
    this.emit(OBJECT_DESTROY, this);
    this.removeAllListeners();
  }

  /** The object's own transform, applied on top of whatever `ctx` has. */
  protected transform(ctx: CanvasRenderingContext2D): void {
    if (this.x !== 0 || this.y !== 0) ctx.translate(this.x, this.y);
    if (this.rotation !== 0) ctx.rotate(this.rotation);
    if (this.scaleX !== 1 || this.scaleY !== 1) ctx.scale(this.scaleX, this.scaleY);
  }

  protected get identity(): boolean {
    return this.x === 0 && this.y === 0 && this.rotation === 0 && this.scaleX === 1 && this.scaleY === 1;
  }

  abstract render(ctx: CanvasRenderingContext2D, parentAlpha: number): void;
}

/** A list of objects drawn together, under one transform. */
export class Container extends GameObject {
  readonly type = 'Container';
  readonly list: GameObject[] = [];

  add(child: GameObject | GameObject[]): this {
    for (const c of Array.isArray(child) ? child : [child]) this.addAt(c, this.list.length);
    return this;
  }

  addAt(child: GameObject, index: number): this {
    child.detach();
    this.list.splice(Math.max(0, Math.min(index, this.list.length)), 0, child);
    child.owner = this.list;
    child.parentContainer = this;
    return this;
  }

  remove(child: GameObject, destroyChild = false): this {
    if (child.owner === this.list) child.detach();
    if (destroyChild) child.destroy();
    return this;
  }

  override destroy(): void {
    if (!this.active) return;
    for (const child of [...this.list]) child.destroy();
    super.destroy();
  }

  render(ctx: CanvasRenderingContext2D, parentAlpha: number): void {
    if (!this.visible || this.alpha <= 0 || this.list.length === 0) return;
    const alpha = parentAlpha * this.alpha;
    const plain = this.identity;
    if (!plain) {
      ctx.save();
      this.transform(ctx);
    }
    for (const child of this.list) child.render(ctx, alpha);
    if (!plain) ctx.restore();
  }
}

/** Anything a canvas can draw as an image. */
export type ImageSource = HTMLCanvasElement | OffscreenCanvas | HTMLImageElement | ImageBitmap;

/**
 * A picture: the baked sheet. Centred on its position unless told otherwise,
 * as Phaser's is.
 */
export class Image extends GameObject {
  readonly type = 'Image';

  constructor(
    public source: ImageSource,
    x = 0,
    y = 0,
  ) {
    super();
    this.x = x;
    this.y = y;
    this.originX = 0.5;
    this.originY = 0.5;
  }

  get width(): number {
    return this.source.width;
  }

  get height(): number {
    return this.source.height;
  }

  render(ctx: CanvasRenderingContext2D, parentAlpha: number): void {
    const alpha = parentAlpha * this.alpha;
    if (!this.visible || alpha <= 0) return;
    ctx.save();
    this.transform(ctx);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.source, -this.originX * this.width, -this.originY * this.height);
    ctx.restore();
  }
}

/** How a line of `Text` is set: the handful of Phaser's text style keys the game uses. */
export interface TextStyle {
  fontFamily?: string;
  /** `'13px'`, or a number of px. */
  fontSize?: string | number;
  /** `'bold'`, or a weight such as `'800'`. */
  fontStyle?: string;
  color?: string;
  stroke?: string;
  strokeThickness?: number;
  align?: 'left' | 'center' | 'right';
  /** Extra space between lines, in px. */
  lineSpacing?: number;
}

/** How a text's lines are set: the box, each line's width, the baseline and the step between lines. */
interface Layout {
  lines: string[];
  widths: number[];
  width: number;
  height: number;
  ascent: number;
  step: number;
}

let measurer: CanvasRenderingContext2D | null = null;

/** A context to measure text with, made the first time one is needed. */
function measuring(): CanvasRenderingContext2D | null {
  if (measurer) return measurer;
  if (typeof document === 'undefined') return null;
  measurer = document.createElement('canvas').getContext('2d');
  return measurer;
}

/**
 * A font's ascent and descent, as Phaser measured them: the ink of a sample
 * that reaches both extremes. A line is exactly that tall, so text centred on
 * its origin sits where Phaser's did — a line height of 1.2 ems put the raid's
 * sector markers five device px high.
 */
const metrics = new Map<string, { ascent: number; descent: number }>();
function fontMetrics(font: string, size: number): { ascent: number; descent: number } {
  let m = metrics.get(font);
  if (m) return m;
  const ctx = measuring();
  if (!ctx) return { ascent: size * 0.8, descent: size * 0.2 };
  ctx.font = font;
  const probe = ctx.measureText('|MÉqgy');
  m = { ascent: Math.ceil(probe.actualBoundingBoxAscent), descent: Math.ceil(probe.actualBoundingBoxDescent) };
  metrics.set(font, m);
  return m;
}

/**
 * Words on the board: the raid's sector markers and the battle's shouts.
 * Hangs from its top-left unless told otherwise, as Phaser's does.
 *
 * Drawn with `fillText` under the camera's transform every frame rather than
 * baked to a texture, so it stays sharp at every zoom.
 */
export class Text extends GameObject {
  readonly type = 'Text';
  private value: string;
  readonly style: Required<Pick<TextStyle, 'fontFamily' | 'fontStyle' | 'color' | 'align'>> &
    Omit<TextStyle, 'fontFamily' | 'fontStyle' | 'color' | 'align'> & { size: number };
  private measured: Layout | null = null;

  constructor(x: number, y: number, text: string, style: TextStyle = {}) {
    super();
    this.x = x;
    this.y = y;
    this.value = text;
    this.style = {
      fontFamily: style.fontFamily ?? 'monospace',
      fontStyle: style.fontStyle ?? '',
      color: style.color ?? '#000000',
      align: style.align ?? 'left',
      size: parseSize(style.fontSize),
      ...(style.stroke !== undefined ? { stroke: style.stroke } : {}),
      ...(style.strokeThickness !== undefined ? { strokeThickness: style.strokeThickness } : {}),
      ...(style.lineSpacing !== undefined ? { lineSpacing: style.lineSpacing } : {}),
    };
  }

  get text(): string {
    return this.value;
  }

  setText(text: string): this {
    if (text !== this.value) {
      this.value = text;
      this.measured = null;
    }
    return this;
  }

  setFontSize(size: string | number): this {
    const next = parseSize(size);
    if (next !== this.style.size) {
      this.style.size = next;
      this.measured = null;
    }
    return this;
  }

  get font(): string {
    return `${this.style.fontStyle} ${this.style.size}px ${this.style.fontFamily}`.trim();
  }

  /**
   * The unscaled box the text occupies, in its own px, laid out as Phaser laid
   * it out: each line as tall as the font's ascent and descent plus the stroke,
   * `lineSpacing` between lines, and the stroke's width added to every line.
   */
  private measure(): Layout {
    if (this.measured) return this.measured;
    const lines = this.value.split('\n');
    const ctx = measuring();
    const stroke = this.style.strokeThickness ?? 0;
    const spacing = this.style.lineSpacing ?? 0;
    const { ascent, descent } = fontMetrics(this.font, this.style.size);
    let widths: number[];
    if (ctx) {
      ctx.font = this.font;
      widths = lines.map((line) => ctx.measureText(line).width);
    } else {
      // No document (the unit suite): an em-ish estimate is enough to lay out.
      widths = lines.map((line) => line.length * this.style.size * 0.6);
    }
    const lineHeight = ascent + descent + stroke;
    this.measured = {
      lines,
      widths,
      width: Math.max(0, ...widths) + stroke,
      height: lineHeight * lines.length + spacing * (lines.length - 1),
      ascent,
      step: lineHeight + spacing,
    };
    return this.measured;
  }

  get width(): number {
    return this.measure().width;
  }

  get height(): number {
    return this.measure().height;
  }

  /**
   * The box in the world's coordinates: this object's transform and every
   * container's above it, and not the camera's — which is what Phaser's
   * `getBounds` answers, and what the text probe reads.
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    const { width, height } = this.measure();
    const left = -this.originX * width;
    const top = -this.originY * height;
    const corners = [
      [left, top],
      [left + width, top],
      [left, top + height],
      [left + width, top + height],
    ].map(([cx, cy]) => {
      let at = placeIn(this, cx!, cy!);
      for (let node = this.parentContainer; node; node = node.parentContainer) at = placeIn(node, at[0], at[1]);
      return at;
    });
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }

  render(ctx: CanvasRenderingContext2D, parentAlpha: number): void {
    const alpha = parentAlpha * this.alpha;
    if (!this.visible || alpha <= 0 || this.value.length === 0) return;
    const { lines, widths, width, height, ascent, step } = this.measure();
    const stroke = this.style.strokeThickness ?? 0;
    ctx.save();
    this.transform(ctx);
    ctx.globalAlpha = alpha;
    ctx.font = this.font;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const left = -this.originX * width + stroke / 2;
    const top = -this.originY * height + stroke / 2 + ascent;
    const inner = width - stroke;
    if (stroke > 0 && this.style.stroke) {
      ctx.lineWidth = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.style.stroke;
    }
    ctx.fillStyle = this.style.color;
    lines.forEach((line, i) => {
      const w = widths[i]!;
      const dx = this.style.align === 'center' ? (inner - w) / 2 : this.style.align === 'right' ? inner - w : 0;
      const ly = top + i * step;
      if (stroke > 0 && this.style.stroke) ctx.strokeText(line, left + dx, ly);
      ctx.fillText(line, left + dx, ly);
    });
    ctx.restore();
  }
}

/** A point in `node`'s own space, carried out into its parent's by its transform. */
function placeIn(node: GameObject, x: number, y: number): readonly [number, number] {
  const sx = x * node.scaleX;
  const sy = y * node.scaleY;
  const cos = Math.cos(node.rotation);
  const sin = Math.sin(node.rotation);
  return [sx * cos - sy * sin + node.x, sx * sin + sy * cos + node.y];
}

function parseSize(size: string | number | undefined): number {
  if (typeof size === 'number') return size;
  const n = parseFloat(size ?? '16');
  return Number.isFinite(n) ? n : 16;
}
