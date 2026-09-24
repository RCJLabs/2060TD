import type { Ink, InkPoint } from '../ink';
import { GameObject } from './objects';

// Opcodes. A command is its opcode followed by its numbers, flat, the way
// Phaser keeps a Graphics command buffer: no object per call, so a layer
// redrawn every frame costs the numbers it pushes and nothing else.
const FILL_STYLE = 0;
const LINE_STYLE = 1;
const FILL_RECT = 2;
const STROKE_RECT = 3;
const FILL_CIRCLE = 4;
const STROKE_CIRCLE = 5;
const FILL_TRIANGLE = 6;
/** Followed by a point count, then that many x, y pairs. */
const FILL_POINTS = 7;
/** Followed by close (0/1), a point count, then the pairs. */
const STROKE_POINTS = 8;
const LINE_BETWEEN = 9;
const BEGIN_PATH = 10;
const MOVE_TO = 11;
const LINE_TO = 12;
const ARC = 13;
const CLOSE_PATH = 14;
const STROKE_PATH = 15;
const FILL_PATH = 16;
const STROKE_ELLIPSE = 17;
const FILL_ELLIPSE = 18;
const SAVE = 19;
const RESTORE = 20;
const TRANSLATE = 21;
const ROTATE = 22;
const SCALE = 23;

const TAU = Math.PI * 2;

const hexCache = new Map<number, string>();

/** `#rrggbb` for a 0xRRGGBB colour, remembered: a frame asks for the same few hundreds of times. */
function hex(color: number): string {
  let s = hexCache.get(color);
  if (s === undefined) {
    s = `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
    hexCache.set(color, s);
  }
  return s;
}

/**
 * A retained list of drawing commands (M30 Phase 3): the board's layers.
 *
 * The same calls Phaser's `Graphics` takes, recorded as they are made and
 * drawn onto the canvas every frame until `clear`. A static layer is drawn
 * once and replayed; a dynamic one is cleared and redrawn each frame.
 *
 * One rule is Phaser's and not the canvas's, and it is the one `CanvasInk`
 * keeps too: a path built by `beginPath`, `moveTo` and `lineTo` lives apart
 * from the one-shot shapes, so a circle drawn while a path is being built
 * leaves the path alone. The path is kept as steps and traced afresh when it
 * is stroked or filled.
 */
export class Graphics extends GameObject implements Ink {
  readonly type = 'Graphics';
  /** The commands, flat. Read by the tests; nothing else should. */
  readonly commands: number[] = [];

  clear(): this {
    this.commands.length = 0;
    return this;
  }

  fillStyle(color: number, alpha = 1): this {
    this.commands.push(FILL_STYLE, color, alpha);
    return this;
  }

  lineStyle(lineWidth: number, color: number, alpha = 1): this {
    this.commands.push(LINE_STYLE, lineWidth, color, alpha);
    return this;
  }

  fillRect(x: number, y: number, width: number, height: number): this {
    this.commands.push(FILL_RECT, x, y, width, height);
    return this;
  }

  strokeRect(x: number, y: number, width: number, height: number): this {
    this.commands.push(STROKE_RECT, x, y, width, height);
    return this;
  }

  fillCircle(x: number, y: number, radius: number): this {
    this.commands.push(FILL_CIRCLE, x, y, radius);
    return this;
  }

  strokeCircle(x: number, y: number, radius: number): this {
    this.commands.push(STROKE_CIRCLE, x, y, radius);
    return this;
  }

  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this {
    this.commands.push(FILL_TRIANGLE, x0, y0, x1, y1, x2, y2);
    return this;
  }

  fillPoints(points: InkPoint[], _closeShape = false, _closePath = false, endIndex = points.length): this {
    const end = Math.min(endIndex, points.length);
    this.commands.push(FILL_POINTS, end);
    for (let i = 0; i < end; i++) this.commands.push(points[i]!.x, points[i]!.y);
    return this;
  }

  strokePoints(points: InkPoint[], closeShape = false, _closePath = false, endIndex = points.length): this {
    const end = Math.min(endIndex, points.length);
    this.commands.push(STROKE_POINTS, closeShape ? 1 : 0, end);
    for (let i = 0; i < end; i++) this.commands.push(points[i]!.x, points[i]!.y);
    return this;
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    this.commands.push(LINE_BETWEEN, x1, y1, x2, y2);
    return this;
  }

  beginPath(): this {
    this.commands.push(BEGIN_PATH);
    return this;
  }

  moveTo(x: number, y: number): this {
    this.commands.push(MOVE_TO, x, y);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.commands.push(LINE_TO, x, y);
    return this;
  }

  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise = false): this {
    this.commands.push(ARC, x, y, radius, startAngle, endAngle, anticlockwise ? 1 : 0);
    return this;
  }

  closePath(): this {
    this.commands.push(CLOSE_PATH);
    return this;
  }

  strokePath(): this {
    this.commands.push(STROKE_PATH);
    return this;
  }

  fillPath(): this {
    this.commands.push(FILL_PATH);
    return this;
  }

  /** An ellipse centred on `x, y`, `width` by `height` across, as Phaser takes it. */
  strokeEllipse(x: number, y: number, width: number, height: number): this {
    this.commands.push(STROKE_ELLIPSE, x, y, width, height);
    return this;
  }

  fillEllipse(x: number, y: number, width: number, height: number): this {
    this.commands.push(FILL_ELLIPSE, x, y, width, height);
    return this;
  }

  save(): this {
    this.commands.push(SAVE);
    return this;
  }

  restore(): this {
    this.commands.push(RESTORE);
    return this;
  }

  translateCanvas(x: number, y: number): this {
    this.commands.push(TRANSLATE, x, y);
    return this;
  }

  rotateCanvas(radians: number): this {
    this.commands.push(ROTATE, radians);
    return this;
  }

  scaleCanvas(x: number, y: number): this {
    this.commands.push(SCALE, x, y);
    return this;
  }

  render(ctx: CanvasRenderingContext2D, parentAlpha: number): void {
    const alpha = parentAlpha * this.alpha;
    const cmd = this.commands;
    if (!this.visible || alpha <= 0 || cmd.length === 0) return;
    ctx.save();
    this.transform(ctx);

    let fillColor = 0;
    let fillAlpha = 1;
    let lineColor = 0;
    let lineAlpha = 1;
    let lineWidth = 1;
    // What the context was last set to, so a run of shapes in one style sets
    // it once. A `RESTORE` rewinds the context, so it forgets.
    let setFill = '';
    let setStroke = '';
    let setAlpha = -1;
    let setWidth = -1;
    let depth = 0;
    const path: number[] = [];

    const useFill = (): void => {
      const s = hex(fillColor);
      if (s !== setFill) ctx.fillStyle = setFill = s;
      const a = alpha * fillAlpha;
      if (a !== setAlpha) ctx.globalAlpha = setAlpha = a;
    };
    const useStroke = (): void => {
      const s = hex(lineColor);
      if (s !== setStroke) ctx.strokeStyle = setStroke = s;
      const a = alpha * lineAlpha;
      if (a !== setAlpha) ctx.globalAlpha = setAlpha = a;
      if (lineWidth !== setWidth) ctx.lineWidth = setWidth = lineWidth;
    };
    const tracePath = (): void => {
      ctx.beginPath();
      for (let j = 0; j < path.length; ) {
        switch (path[j++]) {
          case MOVE_TO:
            ctx.moveTo(path[j++]!, path[j++]!);
            break;
          case LINE_TO:
            ctx.lineTo(path[j++]!, path[j++]!);
            break;
          case ARC:
            ctx.arc(path[j++]!, path[j++]!, path[j++]!, path[j++]!, path[j++]!, path[j++]! === 1);
            break;
          default:
            ctx.closePath();
        }
      }
    };
    const tracePoints = (from: number, count: number, close: boolean): void => {
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const x = cmd[from + k * 2]!;
        const y = cmd[from + k * 2 + 1]!;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (close) ctx.closePath();
    };

    for (let i = 0; i < cmd.length; ) {
      switch (cmd[i++]) {
        case FILL_STYLE:
          fillColor = cmd[i++]!;
          fillAlpha = cmd[i++]!;
          break;
        case LINE_STYLE:
          lineWidth = cmd[i++]!;
          lineColor = cmd[i++]!;
          lineAlpha = cmd[i++]!;
          break;
        case FILL_RECT:
          useFill();
          ctx.fillRect(cmd[i++]!, cmd[i++]!, cmd[i++]!, cmd[i++]!);
          break;
        case STROKE_RECT:
          useStroke();
          ctx.strokeRect(cmd[i++]!, cmd[i++]!, cmd[i++]!, cmd[i++]!);
          break;
        case FILL_CIRCLE:
          useFill();
          ctx.beginPath();
          ctx.arc(cmd[i++]!, cmd[i++]!, cmd[i++]!, 0, TAU);
          ctx.fill();
          break;
        case STROKE_CIRCLE:
          useStroke();
          ctx.beginPath();
          ctx.arc(cmd[i++]!, cmd[i++]!, cmd[i++]!, 0, TAU);
          ctx.stroke();
          break;
        case FILL_TRIANGLE:
          useFill();
          ctx.beginPath();
          ctx.moveTo(cmd[i++]!, cmd[i++]!);
          ctx.lineTo(cmd[i++]!, cmd[i++]!);
          ctx.lineTo(cmd[i++]!, cmd[i++]!);
          ctx.closePath();
          ctx.fill();
          break;
        case FILL_POINTS: {
          const count = cmd[i++]!;
          if (count >= 2) {
            useFill();
            tracePoints(i, count, true);
            ctx.fill();
          }
          i += count * 2;
          break;
        }
        case STROKE_POINTS: {
          const close = cmd[i++]! === 1;
          const count = cmd[i++]!;
          if (count >= 2) {
            useStroke();
            tracePoints(i, count, close);
            ctx.stroke();
          }
          i += count * 2;
          break;
        }
        case LINE_BETWEEN:
          useStroke();
          ctx.beginPath();
          ctx.moveTo(cmd[i++]!, cmd[i++]!);
          ctx.lineTo(cmd[i++]!, cmd[i++]!);
          ctx.stroke();
          break;
        case BEGIN_PATH:
          path.length = 0;
          break;
        case MOVE_TO:
        case LINE_TO:
          path.push(cmd[i - 1]!, cmd[i++]!, cmd[i++]!);
          break;
        case ARC:
          path.push(ARC, cmd[i++]!, cmd[i++]!, cmd[i++]!, cmd[i++]!, cmd[i++]!, cmd[i++]!);
          break;
        case CLOSE_PATH:
          path.push(CLOSE_PATH);
          break;
        case STROKE_PATH:
          useStroke();
          tracePath();
          ctx.stroke();
          break;
        case FILL_PATH:
          useFill();
          tracePath();
          ctx.fill();
          break;
        case STROKE_ELLIPSE:
          useStroke();
          ctx.beginPath();
          ctx.ellipse(cmd[i++]!, cmd[i++]!, cmd[i++]! / 2, cmd[i++]! / 2, 0, 0, TAU);
          ctx.stroke();
          break;
        case FILL_ELLIPSE:
          useFill();
          ctx.beginPath();
          ctx.ellipse(cmd[i++]!, cmd[i++]!, cmd[i++]! / 2, cmd[i++]! / 2, 0, 0, TAU);
          ctx.fill();
          break;
        case SAVE:
          ctx.save();
          depth++;
          break;
        case RESTORE:
          if (depth > 0) {
            ctx.restore();
            depth--;
            setFill = setStroke = '';
            setAlpha = setWidth = -1;
          }
          break;
        case TRANSLATE:
          ctx.translate(cmd[i++]!, cmd[i++]!);
          break;
        case ROTATE:
          ctx.rotate(cmd[i++]!);
          break;
        case SCALE:
          ctx.scale(cmd[i++]!, cmd[i++]!);
          break;
        default:
          throw new Error(`Graphics: bad opcode at ${i - 1}`);
      }
    }
    // A caller that saved more than it restored leaves nothing behind it.
    while (depth-- > 0) ctx.restore();
    ctx.restore();
  }
}
