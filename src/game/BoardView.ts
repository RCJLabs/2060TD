import Phaser from 'phaser';
import type { Layout, Rect } from './layout';
import { makeButton, type Button } from './ui';

/**
 * The battlefield viewport (v0.9): a world camera confined to the layout's
 * board rect, with pinch-zoom, drag-pan and double-tap-to-fit, plus a fixed
 * UI camera for the HUD.
 *
 * Objects are partitioned by container rather than per-object ignore lists:
 * everything the board draws goes in `world`, everything the HUD draws goes
 * in `ui`, and each camera ignores the other's container exactly once.
 *
 * Scenes keep working in grid coordinates — `cellAt()` undoes the camera
 * transform, so a tap means the same thing at any zoom or scroll.
 */
export interface BoardOptions {
  /** Grid size in cells. */
  cols: number;
  rows: number;
  /** Cell edge in world px. */
  cell: number;
}

/** Movement (device px) still counted as a tap rather than a drag. */
const TAP_SLOP = 14;
const TAP_MS = 450;
const DOUBLE_TAP_MS = 320;
/** Floor on how much ground `focusOn` keeps in frame, in cells. */
const MIN_CELLS_IN_VIEW = 12;

/** Live board rigs, so the harness can catch objects outside both layers. */
const rigs = new Set<BoardView>();

/**
 * Scene objects that belong to neither camera layer. The two cameras are
 * partitioned by container, so a loose object is drawn TWICE — once at board
 * zoom, once at HUD scale. That is always a bug; the E2E harness asserts this
 * list is empty on every screen.
 */
export function boardStrays(): string[] {
  const out: string[] = [];
  for (const rig of rigs) {
    const scene = rig.scene;
    if (!scene.sys.isActive()) continue;
    for (const object of scene.children.list) {
      if (object === rig.world || object === rig.ui) continue;
      const text = (object as Partial<Phaser.GameObjects.Text>).text;
      out.push(`${scene.scene.key}:${object.type}${text ? `("${text.slice(0, 24)}")` : ''}`);
    }
  }
  return out;
}

export class BoardView {
  readonly world: Phaser.GameObjects.Container;
  readonly ui: Phaser.GameObjects.Container;
  readonly camera: Phaser.Cameras.Scene2D.Camera;
  readonly uiCamera: Phaser.Cameras.Scene2D.Camera;

  readonly scene: Phaser.Scene;
  private readonly opts: BoardOptions;
  private rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private centerX = 0;
  private centerY = 0;
  private zoom = 1;
  private fitZoom = 1;

  // gesture state
  private dragging = false;
  private pinching = false;
  private movedBy = 0;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;
  private lastTapAt = 0;
  private tapHandler: ((col: number, row: number) => void) | null = null;
  private dragHandler: ((col: number, row: number) => void) | null = null;
  private slop = TAP_SLOP;
  private zoomIn: Button | null = null;
  private zoomOut: Button | null = null;

  constructor(scene: Phaser.Scene, opts: BoardOptions) {
    this.scene = scene;
    this.opts = opts;
    this.world = scene.add.container(0, 0);
    this.ui = scene.add.container(0, 0);

    this.camera = scene.cameras.main;
    this.uiCamera = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
    this.uiCamera.transparent = true;
    // One partition, applied once: cameras never see each other's layer.
    this.camera.ignore(this.ui);
    this.uiCamera.ignore(this.world);

    this.bindInput();
    rigs.add(this);
    const forget = (): void => {
      rigs.delete(this);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, forget);
    scene.events.once(Phaser.Scenes.Events.DESTROY, forget);
  }

  get worldWidth(): number {
    return this.opts.cols * this.opts.cell;
  }

  get worldHeight(): number {
    return this.opts.rows * this.opts.cell;
  }

  /**
   * Zoom about the middle of the board — what the on-screen buttons do.
   * Pinch handles anchored zoom; this is the discoverable version.
   */
  zoomBy(factor: number): void {
    this.setZoom(this.zoom * factor);
  }

  /** The two zoom keys, parked mid-right where a thumb finds them. */
  private layoutZoomKeys(layout: Layout): void {
    const size = Math.round(layout.px(layout.compact ? 44 : 34));
    const gap = Math.round(layout.gap);
    const x = this.rect.x + this.rect.w - layout.pad - size;
    const midY = this.rect.y + this.rect.h / 2;
    if (!this.zoomIn) {
      const make = (label: string, factor: number): Button => {
        const b = makeButton(this.scene, 0, 0, size, size, label, () => this.zoomBy(factor), {
          align: 'center',
          container: this.ui,
          quiet: true,
        });
        b.bg.setAlpha(0.75);
        return b;
      };
      this.zoomIn = make('+', 1.3);
      this.zoomOut = make('\u2212', 1 / 1.3);
    }
    this.zoomIn.setRect(x, Math.round(midY - size - gap / 2), size, size);
    this.zoomOut?.setRect(x, Math.round(midY + gap / 2), size, size);
    this.zoomIn.setFont(layout.font.title);
    this.zoomOut?.setFont(layout.font.title);
  }

  /** Point the board camera at the layout's board rect and refit. */
  applyLayout(layout: Layout, keepView = false): void {
    this.slop = Math.round(TAP_SLOP * layout.dpr);
    this.rect = layout.board;
    this.camera.setViewport(this.rect.x, this.rect.y, Math.max(1, this.rect.w), Math.max(1, this.rect.h));
    this.uiCamera.setViewport(0, 0, layout.width, layout.height);
    this.uiCamera.setSize(layout.width, layout.height);
    this.layoutZoomKeys(layout);
    const previous = this.fitZoom;
    this.fitZoom = Math.min(this.rect.w / this.worldWidth, this.rect.h / this.worldHeight);
    if (!keepView || this.zoom <= 0) {
      this.fit();
    } else {
      // Preserve the operator's zoom *relative* to fit across an orientation
      // flip, so a rotated phone doesn't jump to a different magnification.
      const ratio = previous > 0 ? this.zoom / previous : 1;
      this.setZoom(this.fitZoom * ratio);
    }
  }

  /**
   * Frame a world rectangle (the built-up part of a base, say) instead of
   * the whole empty grid — what a player actually wants to look at.
   */
  focusOn(x: number, y: number, w: number, h: number, padCells = 2): void {
    const pad = padCells * this.opts.cell;
    const rw = Math.max(this.opts.cell, w + pad * 2);
    const rh = Math.max(this.opts.cell, h + pad * 2);
    // Never frame so tight that the ground around it vanishes: a fresh base is
    // one building, and a screen-filling command centre tells you nothing.
    const context =
      Math.min(this.rect.w, this.rect.h) / (MIN_CELLS_IN_VIEW * this.opts.cell);
    const cap = Math.max(this.fitZoom, Math.min(this.fitZoom * 6, context));
    this.zoom = Phaser.Math.Clamp(
      Math.min(this.rect.w / rw, this.rect.h / rh),
      this.fitZoom,
      cap,
    );
    this.centerX = x + w / 2;
    this.centerY = y + h / 2;
    this.apply();
  }

  /** Frame the whole grid. */
  fit(): void {
    this.zoom = this.fitZoom;
    this.centerX = this.worldWidth / 2;
    this.centerY = this.worldHeight / 2;
    this.apply();
  }

  private setZoom(next: number): void {
    const maxZoom = Math.max(this.fitZoom * 6, (this.rect.h / this.opts.cell) > 0 ? 4 : 4);
    this.zoom = Phaser.Math.Clamp(next, this.fitZoom * 0.95, maxZoom);
    this.apply();
  }

  /** Clamp the view to the world and push it to the camera. */
  private apply(): void {
    const halfW = this.rect.w / this.zoom / 2;
    const halfH = this.rect.h / this.zoom / 2;
    this.centerX =
      this.worldWidth <= halfW * 2
        ? this.worldWidth / 2
        : Phaser.Math.Clamp(this.centerX, halfW, this.worldWidth - halfW);
    this.centerY =
      this.worldHeight <= halfH * 2
        ? this.worldHeight / 2
        : Phaser.Math.Clamp(this.centerY, halfH, this.worldHeight - halfH);
    this.camera.setZoom(this.zoom);
    this.camera.centerOn(this.centerX, this.centerY);
  }

  private inBoard(pointer: Phaser.Input.Pointer): boolean {
    return (
      pointer.x >= this.rect.x &&
      pointer.x <= this.rect.x + this.rect.w &&
      pointer.y >= this.rect.y &&
      pointer.y <= this.rect.y + this.rect.h
    );
  }

  /** Grid cell under a pointer, or null when it is off the board/grid. */
  cellAt(pointer: Phaser.Input.Pointer): { col: number; row: number } | null {
    if (!this.inBoard(pointer)) return null;
    const p = this.camera.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(p.x / this.opts.cell);
    const row = Math.floor(p.y / this.opts.cell);
    if (col < 0 || row < 0 || col >= this.opts.cols || row >= this.opts.rows) return null;
    return { col, row };
  }

  /** Fires for a tap on the board that was not a pan or a pinch. */
  onTap(handler: (col: number, row: number) => void): void {
    this.tapHandler = handler;
  }

  /** Fires while a finger paints across cells (walls drag-paint). Only
   * active while `paintMode` is on, so ordinary drags still pan. */
  onPaint(handler: (col: number, row: number) => void): void {
    this.dragHandler = handler;
  }

  /** When true a board drag paints instead of panning (wall tools). */
  paintMode = false;

  private bindInput(): void {
    const input = this.scene.input;

    input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!this.inBoard(pointer)) return;
      const [p1, p2] = [input.pointer1, input.pointer2];
      if (p1?.isDown && p2?.isDown) {
        this.pinching = true;
        this.dragging = false;
        this.pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        return;
      }
      this.dragging = true;
      this.movedBy = 0;
      this.downAt = this.scene.time.now;
      this.downX = pointer.x;
      this.downY = pointer.y;
      this.lastX = pointer.x;
      this.lastY = pointer.y;
      if (this.paintMode) {
        const cell = this.cellAt(pointer);
        if (cell) this.dragHandler?.(cell.col, cell.row);
      }
    });

    input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      const [p1, p2] = [input.pointer1, input.pointer2];
      if (p1?.isDown && p2?.isDown) {
        // Pinch: scale by the change in finger separation, anchored so the
        // world point under the midpoint stays put.
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDist > 0 && dist > 0) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const before = this.camera.getWorldPoint(midX, midY);
          this.setZoom(this.zoom * (dist / this.pinchDist));
          const after = this.camera.getWorldPoint(midX, midY);
          this.centerX += before.x - after.x;
          this.centerY += before.y - after.y;
          this.apply();
        }
        this.pinchDist = dist;
        this.pinching = true;
        this.dragging = false;
        return;
      }
      if (!this.dragging || !pointer.isDown) return;
      const dx = pointer.x - this.lastX;
      const dy = pointer.y - this.lastY;
      this.movedBy += Math.abs(dx) + Math.abs(dy);
      this.lastX = pointer.x;
      this.lastY = pointer.y;
      if (this.paintMode) {
        const cell = this.cellAt(pointer);
        if (cell) this.dragHandler?.(cell.col, cell.row);
        return;
      }
      if (this.movedBy > this.slop) {
        this.centerX -= dx / this.zoom;
        this.centerY -= dy / this.zoom;
        this.apply();
      }
    });

    const end = (pointer: Phaser.Input.Pointer): void => {
      const wasPinching = this.pinching;
      if (!input.pointer1?.isDown && !input.pointer2?.isDown) {
        this.pinching = false;
        this.pinchDist = 0;
      }
      if (!this.dragging) return;
      this.dragging = false;
      if (wasPinching || this.paintMode) return;
      const quick = this.scene.time.now - this.downAt < TAP_MS;
      const still =
        Math.abs(pointer.x - this.downX) + Math.abs(pointer.y - this.downY) <= this.slop;
      if (!quick || !still) return;

      const now = this.scene.time.now;
      if (now - this.lastTapAt < DOUBLE_TAP_MS) {
        this.lastTapAt = 0;
        this.fit(); // double-tap reframes the whole grid
        return;
      }
      this.lastTapAt = now;
      const cell = this.cellAt(pointer);
      if (cell) this.tapHandler?.(cell.col, cell.row);
    };
    input.on(Phaser.Input.Events.POINTER_UP, end);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, end);

    // Desktop: wheel zooms around the cursor.
    input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (!this.inBoard(pointer)) return;
        const before = this.camera.getWorldPoint(pointer.x, pointer.y);
        this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1));
        const after = this.camera.getWorldPoint(pointer.x, pointer.y);
        this.centerX += before.x - after.x;
        this.centerY += before.y - after.y;
        this.apply();
      },
    );
  }
}
