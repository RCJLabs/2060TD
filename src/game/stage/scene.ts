import { Camera } from './camera';
import { Emitter } from './emitter';
import { Graphics } from './graphics';
import type { InputManager } from './input';
import { SceneInput } from './input';
import { Container, GameObject, Image, Text, type ImageSource, type TextStyle } from './objects';

/** A scene's events, in the order a frame fires them: UPDATE, the scene's own `update`, POST_UPDATE. */
export const UPDATE = 'update';
export const POST_UPDATE = 'postupdate';
/** The scene is stopping: everything it drew is about to be destroyed. */
export const SHUTDOWN = 'shutdown';
/** The game is going away. Nothing in the game does that, but a listener may still ask. */
export const DESTROY = 'destroy';
/** The canvas changed size. */
export const RESIZE = 'resize';

/** The objects a scene draws directly, in draw order. */
export class DisplayList {
  readonly list: GameObject[] = [];

  add(obj: GameObject): GameObject {
    obj.detach();
    this.list.push(obj);
    obj.owner = this.list;
    return obj;
  }

  /** Take everything off, destroying it unless told otherwise. */
  removeAll(destroy = true): void {
    for (const obj of [...this.list]) {
      if (destroy) obj.destroy();
      else obj.detach();
    }
  }
}

/** `scene.add`: make an object and put it on the scene's display list. */
class Factory {
  constructor(private readonly scene: Scene) {}

  graphics(): Graphics {
    return this.scene.children.add(new Graphics()) as Graphics;
  }

  container(x = 0, y = 0): Container {
    return this.scene.children.add(new Container().setPosition(x, y)) as Container;
  }

  text(x: number, y: number, text: string, style: TextStyle = {}): Text {
    return this.scene.children.add(new Text(x, y, text, style)) as Text;
  }

  image(x: number, y: number, source: ImageSource): Image {
    return this.scene.children.add(new Image(source, x, y)) as Image;
  }
}

/** The canvas's size, resize notices and fullscreen: one per game, shared by every scene. */
export class ScaleManager extends Emitter {
  readonly gameSize = { width: 0, height: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly fullscreenTarget: HTMLElement,
  ) {
    super();
  }

  /** The drawing buffer, in device px. Fires RESIZE. */
  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    this.canvas.width = w;
    this.canvas.height = h;
    this.gameSize.width = w;
    this.gameSize.height = h;
    this.fit();
    this.emit(RESIZE, this.gameSize);
  }

  /** How the buffer is shown: CSS px per device px. */
  zoom = 1;

  setZoom(zoom: number): void {
    this.zoom = zoom;
    this.fit();
  }

  private fit(): void {
    this.canvas.style.width = `${this.gameSize.width * this.zoom}px`;
    this.canvas.style.height = `${this.gameSize.height * this.zoom}px`;
  }

  get isFullscreen(): boolean {
    return typeof document !== 'undefined' && document.fullscreenElement !== null;
  }

  startFullscreen(): void {
    void this.fullscreenTarget.requestFullscreen?.().catch(() => undefined);
  }

  stopFullscreen(): void {
    if (this.isFullscreen) void document.exitFullscreen().catch(() => undefined);
  }
}

/** What a scene asks of the scene manager: its own key, and where to go next. */
export interface SceneControl {
  readonly key: string;
  start(key: string, data?: unknown): void;
  restart(data?: unknown): void;
}

/** The runtime a scene is booted into: the game's shared parts. */
export interface SceneHost {
  readonly scale: ScaleManager;
  readonly input: InputManager;
  start(key: string, data?: unknown): void;
  restart(scene: Scene, data?: unknown): void;
}

/**
 * A screen of the game (M30 Phase 3): the front door, the town, a siege.
 *
 * Its life is Phaser's, because every scene was written for it. `init(data)`
 * and `create(data)` run when it starts, if it has them; `update(time, delta)`
 * runs every frame between an UPDATE event and a POST_UPDATE one; and when it
 * stops, SHUTDOWN fires, everything on its display list is destroyed and its
 * input listeners go. Its `events` listeners stay, as they did: a scene that
 * restarts is the same object, and the pieces that listen for SHUTDOWN take
 * themselves off.
 */
export abstract class Scene {
  readonly events = new Emitter();
  readonly children = new DisplayList();
  readonly add = new Factory(this);
  readonly time = {
    get now(): number {
      return performance.now();
    },
  };
  readonly sys = {
    isActive: (): boolean => this.running,
  };
  readonly scene: SceneControl;
  cameras: { main: Camera } = { main: new Camera(1, 1) };
  input!: SceneInput;
  scale!: ScaleManager;
  private host: SceneHost | null = null;
  private running = false;

  constructor(readonly key: string) {
    this.scene = {
      key,
      start: (next, data) => this.host?.start(next, data),
      restart: (data) => this.host?.restart(this, data),
    };
  }

  /** Every frame, between UPDATE and POST_UPDATE. */
  update(_time: number, _delta: number): void {}

  /** Wire the scene to its game. Once, before it first starts. */
  boot(host: SceneHost): void {
    this.host = host;
    this.scale = host.scale;
    this.input = new SceneInput(host.input);
  }

  /** Called by the game: start with this data. */
  run(data: unknown, width: number, height: number): void {
    this.cameras = { main: new Camera(width, height) };
    this.running = true;
    const hooks = this as unknown as { init?: (d: unknown) => void; create?: (d: unknown) => void };
    hooks.init?.(data);
    hooks.create?.(data);
  }

  /** Called by the game: one frame. */
  step(time: number, delta: number): void {
    this.events.emit(UPDATE, time, delta);
    this.update(time, delta);
    this.events.emit(POST_UPDATE, time, delta);
  }

  /** Called by the game: stop. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.events.emit(SHUTDOWN, this);
    this.children.removeAll(true);
    this.input.removeAllListeners();
    this.input.keyboard.removeAllListeners();
  }

  /** Draw the display list through the main camera. */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.children.list.length === 0) return;
    ctx.save();
    this.cameras.main.apply(ctx);
    for (const obj of this.children.list) obj.render(ctx, 1);
    ctx.restore();
  }
}
