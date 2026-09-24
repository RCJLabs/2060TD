import { Emitter } from './emitter';
import { InputManager } from './input';
import { ScaleManager, type Scene, type SceneHost } from './scene';

/** Fired on `game.events` after every frame is drawn. */
export const POST_RENDER = 'postrender';

/** The longest frame a scene is told about. A tab away is not a minute of battle. */
const MAX_DELTA_MS = 100;

export type SceneClass = new () => Scene;

export interface GameConfig {
  parent: HTMLElement;
  /** The drawing buffer, in device px. */
  width: number;
  height: number;
  /** CSS px per device px: 1 / devicePixelRatio. */
  zoom: number;
  backgroundColor: string;
  /** The first one starts. */
  scenes: SceneClass[];
  /**
   * Drive the loop from a timer at 60 a second instead of animation frames.
   * Headless browsers throttle animation frames, and the demos exist for them.
   */
  timer?: boolean;
}

/**
 * The game (M30 Phase 3): one canvas, one loop, one scene running at a time.
 *
 * What Phaser did for this game and no more. A scene switch asked for during a
 * frame happens at the start of the next one, as Phaser queued it, so a scene
 * that starts another from inside its own update finishes that update first.
 */
export class Game implements SceneHost {
  readonly canvas: HTMLCanvasElement;
  readonly events = new Emitter();
  readonly scale: ScaleManager;
  readonly input: InputManager;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly registry = new Map<string, Scene>();
  private readonly lastData = new Map<string, unknown>();
  private active: Scene | null = null;
  private pending: { scene: Scene; data: unknown } | null = null;
  private last = 0;
  private readonly background: string;
  private readonly timer: boolean;

  /** `game.scene`: the one query the harness makes of it. */
  readonly scene = {
    getScenes: (activeOnly = true): Scene[] =>
      activeOnly ? (this.active ? [this.active] : []) : [...this.registry.values()],
  };

  constructor(config: GameConfig) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    config.parent.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    this.background = config.backgroundColor;
    this.timer = config.timer === true;
    this.scale = new ScaleManager(this.canvas, config.parent);
    this.scale.setZoom(config.zoom);
    this.scale.resize(config.width, config.height);
    this.input = new InputManager(this.canvas);
    let first: Scene | null = null;
    for (const Cls of config.scenes) {
      const scene = new Cls();
      scene.boot(this);
      this.registry.set(scene.key, scene);
      first ??= scene;
    }
    if (first) this.pending = { scene: first, data: undefined };
    // A camera the scene never placed follows the canvas, as Phaser's did.
    this.scale.on('resize', () => {
      const cam = this.active?.cameras.main;
      if (cam && !cam.customViewport) cam.setSize(this.canvas.width, this.canvas.height);
    });
    // Coming back to a hidden tab is not one enormous frame.
    document.addEventListener('visibilitychange', () => {
      this.last = 0;
    });
    this.schedule();
  }

  start(key: string, data?: unknown): void {
    const scene = this.registry.get(key);
    if (!scene) throw new Error(`no scene '${key}'`);
    this.pending = { scene, data };
  }

  /** Start a scene again, with its last data unless given new. */
  restart(scene: Scene, data?: unknown): void {
    this.pending = { scene, data: data === undefined ? this.lastData.get(scene.key) : data };
  }

  private schedule(): void {
    if (this.timer) setTimeout(() => this.frame(performance.now()), 1000 / 60);
    else requestAnimationFrame((now) => this.frame(now));
  }

  private frame(now: number): void {
    try {
      this.switchScenes();
      const delta = this.last > 0 ? Math.min(MAX_DELTA_MS, Math.max(0, now - this.last)) : 1000 / 60;
      this.last = now;
      this.active?.step(now, delta);
      this.render();
      this.events.emit(POST_RENDER);
    } finally {
      this.schedule();
    }
  }

  private switchScenes(): void {
    const next = this.pending;
    if (!next) return;
    this.pending = null;
    this.active?.stop();
    this.input.target = null;
    this.active = next.scene;
    this.lastData.set(next.scene.key, next.data);
    this.input.target = next.scene.input;
    next.scene.run(next.data, this.canvas.width, this.canvas.height);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.active?.render(ctx);
  }
}
