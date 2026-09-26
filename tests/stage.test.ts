import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera, clamp, Container, Emitter, Graphics, Image, keyName, Scene, Text } from '../src/game/stage';
import type { SceneHost } from '../src/game/stage/scene';

/**
 * The stage (M30 Phase 3) is what draws the board now. What can be tested
 * without a screen is tested here: the command lists a layer records, the
 * camera's arithmetic the board's taps and probes are read through, the order
 * a scene's life happens in, and the names keys are bound by. The pixels are
 * the harnesses' job.
 */

describe('the emitter', () => {
  it('a once listener hears once, and one added mid-emit waits for the next', () => {
    const e = new Emitter();
    const heard: string[] = [];
    e.once('x', () => heard.push('once'));
    e.on('x', () => {
      heard.push('on');
      e.on('x', () => heard.push('late'));
    });
    e.emit('x');
    expect(heard).toEqual(['once', 'on']);
    heard.length = 0;
    e.emit('x');
    expect(heard).toEqual(['on', 'late']);
  });

  it('removing one handler leaves the same function added elsewhere alone', () => {
    const e = new Emitter();
    const heard: number[] = [];
    const f = (): void => void heard.push(1);
    e.on('x', f);
    e.once('x', f);
    e.emit('x');
    e.emit('x');
    expect(heard).toEqual([1, 1, 1]);
  });
});

describe('a Graphics layer', () => {
  it('records what it is told, flat, and forgets it on clear', () => {
    const g = new Graphics();
    g.fillStyle(0x112233, 0.5).fillRect(1, 2, 3, 4);
    g.fillPoints([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(g.commands.length).toBeGreaterThan(0);
    expect(g.commands.every((n) => typeof n === 'number')).toBe(true);
    g.clear();
    expect(g.commands).toEqual([]);
  });

  it('copies a point list, so a caller reusing its array does not redraw the past', () => {
    const g = new Graphics();
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ];
    g.fillPoints(pts);
    const before = [...g.commands];
    pts[1]!.x = 99;
    expect(g.commands).toEqual(before);
  });

  it('replays onto a canvas as the calls were made, a path surviving a shape drawn mid-path', () => {
    const calls: string[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop: string) =>
          (...args: unknown[]) => void calls.push(`${prop}(${args.map((a) => (typeof a === 'number' ? Math.round(a * 100) / 100 : a)).join(',')})`),
        set: (_t, prop: string, value: unknown) => {
          calls.push(`${prop}=${String(value)}`);
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    const g = new Graphics();
    g.lineStyle(2, 0xff0000).beginPath().moveTo(0, 0).lineTo(10, 0);
    g.fillStyle(0x0000ff).fillCircle(5, 5, 1);
    g.lineTo(10, 10).strokePath();
    g.render(ctx, 1);
    // The circle is its own path; the stroke traces the whole recorded path
    // afresh, all three points of it.
    const stroke = calls.lastIndexOf('stroke()');
    const traced = calls.slice(calls.lastIndexOf('beginPath()', stroke), stroke);
    expect(traced).toEqual(['beginPath()', 'moveTo(0,0)', 'lineTo(10,0)', 'lineTo(10,10)']);
    expect(calls).toContain('strokeStyle=#ff0000');
    expect(calls).toContain('fillStyle=#0000ff');
    // Balanced: every save the layer made is restored.
    expect(calls.filter((c) => c === 'save()').length).toBe(calls.filter((c) => c === 'restore()').length);
  });
});

describe('the camera', () => {
  it('maps the world onto its viewport about its centre, and back', () => {
    const cam = new Camera(1000, 800);
    cam.setViewport(100, 50, 400, 300).setZoom(2).centerOn(250, 120);
    expect(cam.worldView).toEqual({ x: 150, y: 45, width: 200, height: 150 });
    // The centre of the viewport is the world point it was centred on.
    expect(cam.getWorldPoint(300, 200)).toEqual({ x: 250, y: 120 });
    // A viewport corner is the matching corner of the world view.
    expect(cam.getWorldPoint(100, 50)).toEqual({ x: 150, y: 45 });
    // And the board's own inverse (`screenOf`) agrees with it.
    const view = cam.worldView;
    const sx = cam.x + ((190 - view.x) / view.width) * cam.width;
    const sy = cam.y + ((80 - view.y) / view.height) * cam.height;
    const back = cam.getWorldPoint(sx, sy);
    expect(back.x).toBeCloseTo(190, 9);
    expect(back.y).toBeCloseTo(80, 9);
  });

  it('answers from its state as it is, with no matrix to go stale after a zoom', () => {
    const cam = new Camera(400, 400);
    cam.centerOn(200, 200).setZoom(1);
    const before = cam.getWorldPoint(300, 300);
    cam.setZoom(4);
    const after = cam.getWorldPoint(300, 300);
    expect(before).toEqual({ x: 300, y: 300 });
    expect(after).toEqual({ x: 225, y: 225 });
  });
});

describe('a container', () => {
  it('owns what it holds: adding a child takes it off the list it was on', () => {
    const a = new Container();
    const b = new Container();
    const g = new Graphics();
    a.add(g);
    b.addAt(g, 0);
    expect(a.list).toEqual([]);
    expect(b.list).toEqual([g]);
    expect(g.parentContainer).toBe(b);
  });

  it('takes its children down with it, and each says so', () => {
    const c = new Container();
    const g = new Graphics();
    let heard = 0;
    g.once('destroy', () => heard++);
    c.add(g);
    c.destroy();
    expect(heard).toBe(1);
    expect(c.list).toEqual([]);
  });
});

describe('text on the board', () => {
  it('reports its box in world terms through every container above it', () => {
    const outer = new Container().setPosition(100, 50);
    const t = new Text(10, 20, 'ABCD', { fontSize: 10 }).setOrigin(0.5);
    outer.add(t);
    const b = t.getBounds();
    // Centred on (110, 70) whatever its measured size is.
    expect(b.x + b.width / 2).toBeCloseTo(110, 9);
    expect(b.y + b.height / 2).toBeCloseTo(70, 9);
    t.setScale(2);
    const scaled = t.getBounds();
    expect(scaled.width).toBeCloseTo(b.width * 2, 9);
  });
});

/**
 * Just enough of a 2D context to draw an image into: a matrix that translate,
 * scale, rotate and setTransform move, a save stack, and a log of draws.
 */
function matrixContext(width: number, height: number) {
  type M = { a: number; b: number; c: number; d: number; e: number; f: number };
  let m: M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const stack: M[] = [];
  const draws: { source: unknown; matrix: M; args: number[] }[] = [];
  const ctx = {
    canvas: { width, height },
    globalAlpha: 1,
    imageSmoothingQuality: 'low',
    save: () => void stack.push({ ...m }),
    restore: () => void (m = stack.pop() ?? m),
    translate: (x: number, y: number) => void (m = { ...m, e: m.e + m.a * x + m.c * y, f: m.f + m.b * x + m.d * y }),
    scale: (x: number, y: number) => void (m = { ...m, a: m.a * x, b: m.b * x, c: m.c * y, d: m.d * y }),
    rotate: (r: number) => {
      const [cos, sin] = [Math.cos(r), Math.sin(r)];
      m = {
        ...m,
        a: m.a * cos + m.c * sin,
        b: m.b * cos + m.d * sin,
        c: m.c * cos - m.a * sin,
        d: m.d * cos - m.b * sin,
      };
    },
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void (m = { a, b, c, d, e, f }),
    getTransform: () => ({ ...m }),
    drawImage: (source: unknown, ...args: number[]) => void draws.push({ source, matrix: { ...m }, args }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, draws };
}

describe('an image kept at the scale it is drawn at', () => {
  /** Canvases the image makes for its copy, each with the draws made into it. */
  const made: { width: number; height: number; draws: unknown[][] }[] = [];
  beforeEach(() => {
    made.length = 0;
    vi.stubGlobal('document', {
      createElement: () => {
        const draws: unknown[][] = [];
        const context = { drawImage: (...a: unknown[]) => void draws.push(a) };
        const canvas = { width: 0, height: 0, draws, getContext: () => context };
        made.push(canvas);
        return canvas;
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** The board's sheet: 2x baked, shown at half scale, under a fit zoom and a pan. */
  const sheet = () => new Image({ width: 640, height: 960 } as HTMLCanvasElement).setOrigin(0, 0).setScale(0.5);
  const frame = (img: Image, ctx: CanvasRenderingContext2D, zoom: number, panX = 0.4): void => {
    ctx.save();
    ctx.translate(panX, 116.3);
    ctx.scale(zoom, zoom);
    img.render(ctx, 1);
    ctx.restore();
  };

  it('draws its source until a scale has held, then a copy of what it drew, on a whole pixel', () => {
    const img = sheet().cacheScaled();
    const { ctx, draws } = matrixContext(824, 1830);
    for (let i = 0; i < 4; i++) frame(img, ctx, 2.576);
    expect(draws.slice(0, 2).map((d) => d.source)).toEqual([img.source, img.source]);
    expect(made).toHaveLength(1);
    const copy = made[0]!;
    // The source at the fraction of a pixel it was being drawn at, 0.4 and 0.3,
    // at the scale it was drawn at: the same pixels, made once.
    expect([copy.width, copy.height]).toEqual([Math.ceil(0.4 + 640 * 1.288), Math.ceil(0.3 + 960 * 1.288)]);
    expect(copy.draws).toHaveLength(1);
    const [source, dx, dy, w, h] = copy.draws[0] as [unknown, number, number, number, number];
    expect(source).toBe(img.source);
    [dx, dy, w, h].forEach((v, i) => expect(v).toBeCloseTo([0.4, 0.3, 640 * 1.288, 960 * 1.288][i]!, 9));
    for (const d of draws.slice(2)) {
      expect(d.source).toBe(copy);
      expect(d.matrix).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 116 });
    }
  });

  it('places the copy to the nearest pixel while the board pans, and remakes it once the pan stops', () => {
    const img = sheet().cacheScaled();
    const { ctx, draws } = matrixContext(824, 1830);
    for (let i = 0; i < 3; i++) frame(img, ctx, 2.576);
    const copy = made[0]!;
    draws.length = 0;
    for (const x of [3.1, 5.8, 9.7]) frame(img, ctx, 2.576, x);
    expect(draws.map((d) => d.source)).toEqual([copy, copy, copy]);
    expect(draws.map((d) => d.matrix.e)).toEqual([3, 5, 9]);
    expect(copy.draws).toHaveLength(1);
    for (let i = 0; i < 3; i++) frame(img, ctx, 2.576, 9.7);
    expect(copy.draws).toHaveLength(2);
    expect(copy.draws[1]![1]).toBeCloseTo(0.7, 9);
    expect(draws.at(-1)!.matrix.e).toBe(9);
  });

  it('draws straight through a pinch, and lets go of a copy grown past two canvases', () => {
    const img = sheet().cacheScaled();
    const { ctx, draws } = matrixContext(824, 1830);
    for (let i = 0; i < 3; i++) frame(img, ctx, 2.576);
    const copy = made[0]!;
    draws.length = 0;
    for (const zoom of [2.7, 2.9, 3.1]) frame(img, ctx, zoom);
    expect(draws.every((d) => d.source === img.source)).toBe(true);
    for (let i = 0; i < 3; i++) frame(img, ctx, 12);
    expect(draws.at(-1)!.source).toBe(img.source);
    expect([copy.width, copy.height]).toEqual([0, 0]);
    expect(made).toHaveLength(1);
  });

  it('paints onto its source and its copy alike, so a painted sheet keeps the copy it has', () => {
    // The source is a canvas that can be drawn on, recording each call with
    // the transform it was made under.
    const calls: string[] = [];
    const recording = (name: string) => {
      let m = [1, 0, 0, 1, 0, 0];
      const stack: number[][] = [];
      return {
        save: () => void stack.push(m),
        restore: () => void (m = stack.pop() ?? m),
        setTransform: (...t: number[]) => void (m = t),
        moveTo: (x: number, y: number) => void calls.push(`${name} moveTo ${x},${y} under ${m.map((v) => +v.toFixed(3)).join(',')}`),
      };
    };
    const sourceCtx = recording('source');
    const source = { width: 640, height: 960, getContext: () => sourceCtx } as unknown as HTMLCanvasElement;
    const img = new Image(source).setOrigin(0, 0).setScale(0.5).cacheScaled();
    const draw = (c: CanvasRenderingContext2D): void => c.moveTo(10, 20);
    // Before any copy is made, only the source is painted.
    expect(img.paint(draw)).toBe(true);
    expect(calls).toEqual(['source moveTo 10,20 under 1,0,0,1,0,0']);
    const { ctx } = matrixContext(824, 1830);
    for (let i = 0; i < 4; i++) frame(img, ctx, 2.576);
    expect(made).toHaveLength(1);
    const copyCtx = recording('copy');
    (made[0] as unknown as { getContext: () => unknown }).getContext = () => copyCtx;
    calls.length = 0;
    img.paint(draw);
    // The copy is painted at the scale and the fraction of a pixel it was made at.
    expect(calls).toEqual(['source moveTo 10,20 under 1,0,0,1,0,0', 'copy moveTo 10,20 under 1.288,0,0,1.288,0.4,0.3']);
    // And it is still the copy the image draws: nothing had to be made again.
    for (let i = 0; i < 3; i++) frame(img, ctx, 2.576);
    expect(made).toHaveLength(1);
    expect(made[0]!.draws).toHaveLength(1);
  });

  it('will not paint a source that cannot be drawn on', () => {
    const img = new Image({ width: 64, height: 64 } as HTMLImageElement);
    let painted = false;
    expect(img.paint(() => void (painted = true))).toBe(false);
    expect(painted).toBe(false);
  });

  it('draws a turned image as it is, and makes no copy unless asked', () => {
    const turned = sheet().cacheScaled().setAngle(90);
    const plain = sheet();
    const { ctx, draws } = matrixContext(824, 1830);
    for (let i = 0; i < 4; i++) {
      frame(turned, ctx, 2.576);
      frame(plain, ctx, 2.576);
    }
    expect(draws.every((d) => d.source === turned.source || d.source === plain.source)).toBe(true);
    expect(made).toHaveLength(0);
  });
});

/** A scene with a recorder, booted into a host that only records requests. */
class Probe extends Scene {
  readonly log: string[] = [];
  constructor() {
    super('probe');
    this.events.on('update', () => this.log.push('UPDATE'));
    this.events.on('postupdate', () => this.log.push('POST_UPDATE'));
    this.events.on('shutdown', () => this.log.push('SHUTDOWN'));
  }
  init(data: unknown): void {
    this.log.push(`init:${String(data)}`);
  }
  create(): void {
    this.log.push('create');
    this.add.graphics();
    this.input.on('pointerdown', () => undefined);
  }
  override update(): void {
    this.log.push('update');
  }
}

describe('a scene', () => {
  const host = (): SceneHost & { asked: string[] } => {
    const asked: string[] = [];
    return {
      asked,
      scale: {} as SceneHost['scale'],
      input: {} as SceneHost['input'],
      start: (key) => void asked.push(`start ${key}`),
      restart: (s) => void asked.push(`restart ${s.key}`),
    };
  };

  it('lives in Phaser order: init, create, then UPDATE, update, POST_UPDATE each frame', () => {
    const s = new Probe();
    s.boot(host());
    s.run('D', 100, 100);
    s.step(0, 16);
    expect(s.log).toEqual(['init:D', 'create', 'UPDATE', 'update', 'POST_UPDATE']);
    expect(s.sys.isActive()).toBe(true);
  });

  it('on stopping, says so first, then destroys what it drew and drops its input', () => {
    const s = new Probe();
    s.boot(host());
    s.run(undefined, 100, 100);
    expect(s.children.list.length).toBe(1);
    expect(s.input.listenerCount('pointerdown')).toBe(1);
    s.stop();
    expect(s.log.at(-1)).toBe('SHUTDOWN');
    expect(s.children.list).toEqual([]);
    expect(s.input.listenerCount('pointerdown')).toBe(0);
    expect(s.sys.isActive()).toBe(false);
    // Its own events stay: a restarted scene is the same object.
    expect(s.events.listenerCount('update')).toBe(1);
  });

  it('asks its host to move on rather than moving on itself', () => {
    const h = host();
    const s = new Probe();
    s.boot(h);
    s.scene.start('town', { x: 1 });
    s.scene.restart();
    expect(h.asked).toEqual(['start town', 'restart probe']);
    expect(s.scene.key).toBe('probe');
  });
});

describe('keys by name', () => {
  it('reads the names the scenes bind', () => {
    expect(keyName({ key: ' ', code: 'Space' })).toBe('SPACE');
    expect(keyName({ key: 'Escape', code: 'Escape' })).toBe('ESC');
    expect(keyName({ key: '1', code: 'Digit1' })).toBe('ONE');
    expect(keyName({ key: 'q', code: 'KeyQ' })).toBe('Q');
    expect(keyName({ key: 'Q', code: 'KeyQ' })).toBe('Q');
    expect(keyName({ key: 'Shift', code: 'ShiftLeft' })).toBeNull();
  });

  it('and clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
