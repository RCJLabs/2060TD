import { describe, expect, it } from 'vitest';
import { Camera, clamp, Container, Emitter, Graphics, keyName, Scene, Text } from '../src/game/stage';
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
