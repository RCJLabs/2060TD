import Phaser from 'phaser';
import type { Layout, Rect } from './layout';
import { modalOpen } from './modal';
import type { CarryPointer } from './rows';

/** A point in device px: all a hit test needs of a pointer. */
type At = { x: number; y: number };

/**
 * The battlefield viewport (v0.9): a camera confined to the layout's board
 * rect, with pinch-zoom, drag-pan and double-tap-to-fit.
 *
 * Everything the board draws goes in `world`. Until M30 a second camera drew
 * the HUD from a second container, at screen scale over the board; the HUD
 * is the page's since v1.46, and the second camera went in v1.48 with the
 * canvas UI kit that was the only thing it drew.
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

/** Live board rigs, so the harness can catch objects outside the board. */
const rigs = new Set<BoardView>();

/**
 * Scene objects outside the board's world layer.
 *
 * The canvas draws the board and nothing else (M30), so anything on it
 * belongs in `world`. A loose object is a HUD piece drawn on the canvas by
 * mistake, or a board piece the text probe would file as screen text. When
 * a second camera drew the HUD, a loose object was also drawn twice. The E2E
 * harness asserts this list is empty on every screen.
 */
export function boardStrays(): string[] {
  const out: string[] = [];
  for (const rig of rigs) {
    const scene = rig.scene;
    if (!scene.sys.isActive()) continue;
    for (const object of scene.children.list) {
      if (object === rig.world) continue;
      const text = (object as Partial<Phaser.GameObjects.Text>).text;
      out.push(`${scene.scene.key}:${object.type}${text ? `("${text.slice(0, 24)}")` : ''}`);
    }
  }
  return out;
}

/**
 * Screen position (device px) of a board cell on the live rig, or null when no
 * board is on screen or that cell is scrolled out of the board's rectangle.
 *
 * The E2E harness has always addressed the UI by label and never the map, which
 * is fine while every decision is a row in the drawer. A gate is not: it is a
 * thing at a place, and the only honest way to prove the lever works is to
 * press the one the player would press.
 */
export function boardCellAt(col: number, row: number): { x: number; y: number } | null {
  for (const rig of rigs) {
    if (!rig.scene.sys.isActive()) continue;
    const at = rig.screenOf(col, row);
    if (at) return at;
  }
  return null;
}

/**
 * Is a board cell under water on the live rig?
 *
 * The companion to `boardCellAt`. Terrain arrived in v1.19 and brought a rule
 * the player meets by tapping — you cannot build in a river — and the only
 * honest way to test that is to tap a wet cell and a dry one. The harness
 * cannot work out which is which on its own (the sim is not in its process),
 * so the board answers.
 */
export function boardWetAt(col: number, row: number): boolean {
  for (const rig of rigs) {
    if (!rig.scene.sys.isActive() || !rig.passable) continue;
    return !rig.passable(col, row);
  }
  return false;
}

/**
 * Is this container a board's world layer?
 *
 * The one thing `liveTextRects` needs to tell map marginalia from HUD text,
 * and it lives here because `rigs` is the only place that knows which
 * containers are board layers.
 */
export function isBoardWorld(container: Phaser.GameObjects.Container): boolean {
  for (const rig of rigs) if (rig.world === container) return true;
  return false;
}

/**
 * The live board's size in cells, or null when no board is on screen.
 *
 * The harnesses address the map by cell and used to carry their own copy of
 * the grid's dimensions. When the world turned portrait in v1.40 five of them
 * scanned a board that was not there — and failed with "no free cell in view",
 * which reads like a layout bug and was arithmetic. A test should not hold an
 * opinion about the size of the thing it is testing.
 */
export function boardGrid(): { cols: number; rows: number } | null {
  for (const rig of rigs) {
    if (!rig.scene.sys.isActive()) continue;
    return { cols: rig.cols, rows: rig.rows };
  }
  return null;
}

/**
 * Live board camera state (device px), or null when no board is on screen.
 *
 * The double-scroll bug of v1.22 was invisible to every harness we had: a
 * gesture that pans the map AND scrolls the drawer leaves no button pressed
 * and no text changed, so the only way to see it is to read both viewports
 * before and after one gesture. This is the map half; `panelScroll` is the
 * other.
 */
export function boardCamera(): {
  zoom: number;
  cx: number;
  cy: number;
  rect: { x: number; y: number; w: number; h: number };
} | null {
  for (const rig of rigs) {
    if (!rig.scene.sys.isActive()) continue;
    return rig.probe();
  }
  return null;
}

export class BoardView {
  readonly world: Phaser.GameObjects.Container;
  /**
   * Set by a scene that has ground under it, so `boardWetAt` can answer. Left
   * unset by scenes with no terrain, which then report every cell as dry.
   */
  passable?: (col: number, row: number) => boolean;
  readonly camera: Phaser.Cameras.Scene2D.Camera;

  readonly scene: Phaser.Scene;
  private readonly opts: BoardOptions;
  private rect: Rect = { x: 0, y: 0, w: 1, h: 1 };
  /**
   * The rect a shut drawer would leave — what the fit zoom is measured
   * against. See `Layout.boardFull`.
   */
  private full: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private centerX = 0;
  private centerY = 0;
  private zoom = 1;
  private fitZoom = 1;

  // gesture state
  private dragging = false;
  /**
   * `downTime` of the press that owns the current pan; -1 when idle.
   *
   * `dragging` alone is not enough. The pointer-up that ends a drag over the
   * drawer is swallowed by the row under the finger, so `end` never runs and
   * the flag stays raised — and the NEXT gesture, wherever it starts, pans
   * the map as well as scrolling the list. One finger has to move one thing,
   * so the pan is bound to the press that opened it and no other.
   */
  private dragPress = -1;
  private pinching = false;
  private movedBy = 0;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;
  private pinchMidX = 0;
  private pinchMidY = 0;
  /** Board-edge auto-pan while a paint drag is running (device px/frame). */
  private edgePan = { x: 0, y: 0 };
  private lastTapAt = 0;
  private tapHandler: ((col: number, row: number) => void) | null = null;
  private dragHandler: ((col: number, row: number) => void) | null = null;
  private slop = TAP_SLOP;

  constructor(scene: Phaser.Scene, opts: BoardOptions) {
    this.scene = scene;
    this.opts = opts;
    this.world = scene.add.container(0, 0);
    this.camera = scene.cameras.main;

    this.bindInput();
    // The edge auto-pan needs a heartbeat; the scene's own update is it.
    const drive = (): void => {
      if (this.edgePan.x === 0 && this.edgePan.y === 0) return;
      this.centerX += this.edgePan.x / this.zoom;
      this.centerY += this.edgePan.y / this.zoom;
      this.apply();
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, drive);
    rigs.add(this);
    const forget = (): void => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, drive);
      rigs.delete(this);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, forget);
    scene.events.once(Phaser.Scenes.Events.DESTROY, forget);
  }

  get cols(): number {
    return this.opts.cols;
  }

  get rows(): number {
    return this.opts.rows;
  }

  get worldWidth(): number {
    return this.opts.cols * this.opts.cell;
  }

  get worldHeight(): number {
    return this.opts.rows * this.opts.cell;
  }

  /**
   * Zoom is a GESTURE, not a widget (v1.21).
   *
   * There used to be a +/- pair parked mid-right. They cost two permanent
   * holes in the board — the two places on the map you could not tap because
   * a button was sitting on them — to duplicate something every pointer
   * already does: pinch on touch, wheel on a mouse, both anchored on the
   * point under the fingers rather than on the middle of the screen, which is
   * what you actually want when you are aiming at a corner of the base.
   */

  /**
   * Point the board camera at the layout's board rect and refit.
   *
   * The VIEWPORT comes from `board` and the FIT ZOOM from `boardFull`, which
   * are the same rect except while a portrait drawer is open. Keeping them
   * apart is what makes the drawer a sheet sliding over the map rather than a
   * lever that zooms the world out: a half-open drawer used to cost a 360px
   * phone 40% of its cell size, and on a portrait world that is the whole
   * difference between a silhouette you can read and one you cannot.
   */
  applyLayout(layout: Layout, keepView = false): void {
    this.slop = Math.round(TAP_SLOP * layout.dpr);
    const wasH = this.rect.h;
    const wasZoom = this.zoom;
    this.rect = layout.board;
    this.full = layout.boardFull;
    this.camera.setViewport(this.rect.x, this.rect.y, Math.max(1, this.rect.w), Math.max(1, this.rect.h));
    const previous = this.fitZoom;
    this.fitZoom = Math.min(this.full.w / this.worldWidth, this.full.h / this.worldHeight);
    if (!keepView || this.zoom <= 0) {
      this.fit();
      return;
    }
    // A shorter viewport at the same zoom shows less ground, and `centerOn`
    // would take that out of both ends — so the map creeps under a drawer that
    // is only sliding over it. The view holds one edge instead, and which one
    // is not arbitrary: the drawer rises from the BOTTOM, and on a portrait
    // board the command post sits at the bottom too. Holding the bottom edge
    // means the map slides up with the drawer and your base stays on screen;
    // holding the top would slide the base behind the sheet, which is the one
    // thing you are looking at while the build drawer is open.
    if (wasH > 0 && wasZoom > 0 && this.rect.h !== wasH) {
      this.centerY += (wasH - this.rect.h) / (2 * wasZoom);
    }
    // Preserve the operator's zoom *relative* to fit across an orientation
    // flip, so a rotated phone doesn't jump to a different magnification.
    const ratio = previous > 0 ? this.zoom / previous : 1;
    this.setZoom(this.fitZoom * ratio);
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

  /**
   * Frame the whole grid.
   *
   * Centred on the world, at the zoom that fits it into a SHUT drawer's rect.
   * With the drawer open that leaves some of the map behind the sheet, which
   * is the honest answer: a double-tap means "show me the board at board
   * scale", and the way to see the rest is to push the drawer down.
   */
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

  /** Test seam: where the camera is looking, for `boardCamera`. */
  probe(): { zoom: number; cx: number; cy: number; rect: Rect } {
    return { zoom: this.zoom, cx: this.centerX, cy: this.centerY, rect: { ...this.rect } };
  }

  private inBoard(pointer: At): boolean {
    // A modal owns every gesture: the board must not pan under a briefing.
    if (modalOpen()) return false;
    return (
      pointer.x >= this.rect.x &&
      pointer.x <= this.rect.x + this.rect.w &&
      pointer.y >= this.rect.y &&
      pointer.y <= this.rect.y + this.rect.h
    );
  }

  /**
   * The world point under a screen point, from the rig's own centre, zoom and
   * rect — never the camera's, for an anchor read straight after a zoom.
   *
   * Phaser rebuilds a camera's matrix at the next render, so `getWorldPoint`
   * called between `setZoom` and that render mixes the new zoom with the old
   * transform. Both zoom gestures anchored themselves that way: every notch
   * of the wheel slid the view toward the far corner of the world, not the
   * point under the cursor. On the 20x30 world six notches did not reach the
   * corner. On M34's 10x15 they pinned the camera in it, and the drag that
   * should have panned the zoomed board had nowhere left to go.
   */
  private worldAt(x: number, y: number): { x: number; y: number } {
    return {
      x: this.centerX + (x - (this.rect.x + this.rect.w / 2)) / this.zoom,
      y: this.centerY + (y - (this.rect.y + this.rect.h / 2)) / this.zoom,
    };
  }

  /** Grid cell under a pointer, or null when it is off the board/grid. */
  cellAt(pointer: At): { col: number; row: number } | null {
    if (!this.inBoard(pointer)) return null;
    const p = this.camera.getWorldPoint(pointer.x, pointer.y);
    const col = Math.floor(p.x / this.opts.cell);
    const row = Math.floor(p.y / this.opts.cell);
    if (col < 0 || row < 0 || col >= this.opts.cols || row >= this.opts.rows) return null;
    return { col, row };
  }

  /** Inverse of cellAt: where a cell's centre sits on screen, or null when it
   * is outside the board's own rectangle. */
  screenOf(col: number, row: number): { x: number; y: number } | null {
    const world = { x: (col + 0.5) * this.opts.cell, y: (row + 0.5) * this.opts.cell };
    const view = this.camera.worldView;
    const x = this.camera.x + ((world.x - view.x) / view.width) * this.camera.width;
    const y = this.camera.y + ((world.y - view.y) / view.height) * this.camera.height;
    if (x < this.rect.x || x > this.rect.x + this.rect.w) return null;
    if (y < this.rect.y || y > this.rect.y + this.rect.h) return null;
    return { x, y };
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
  /**
   * When true a press tracks the finger and places on RELEASE (build tools).
   *
   * A fingertip is wider than a cell and sits on top of the one it is aiming
   * at. Placing on touch-down means committing blind; tracking the drag lets
   * the ghost move under the finger until it is over the right square, and the
   * lift is the decision. Same gesture the wall tools use, with the commit
   * moved to the end.
   */
  placeMode = false;
  private placeHandler: ((col: number, row: number) => void) | null = null;
  private lastPlaceCell: { col: number; row: number } | null = null;

  /** Fires once, on release, with the cell the finger ended over. */
  onPlace(handler: (col: number, row: number) => void): void {
    this.placeHandler = handler;
  }

  /**
   * Take over a press that began somewhere else — a row dragged out of the
   * drawer and onto the map (v1.29).
   *
   * The board refuses any press that did not start inside it, which is the
   * rule that keeps one finger moving one thing and is not up for
   * negotiation. This is the single sanctioned exception: the panel calls it
   * only after it has given the press up itself, so ownership MOVES rather
   * than being shared. Bound to `downTime` like every other gesture here, so
   * the adopted press is as identifiable as one that started on the board.
   *
   * Only meaningful in `placeMode`: what is being carried is a ghost, and the
   * lift is the decision. Refused otherwise rather than silently starting a
   * pan the player did not ask for.
   */
  adopt(pointer: CarryPointer): boolean {
    if (!this.placeMode || this.pinching) return false;
    this.dragging = true;
    this.dragPress = pointer.downTime;
    this.movedBy = 0;
    this.downAt = this.scene.time.now;
    this.downX = pointer.x;
    this.downY = pointer.y;
    this.lastX = pointer.x;
    this.lastY = pointer.y;
    // Seed the ghost immediately: the finger is already over the board when
    // this is called, so waiting for the next move would leave a frame with a
    // tool armed and nothing under it.
    this.lastPlaceCell = this.cellAt(pointer);
    // A press the board cannot hear for itself — one that began on a DOM row,
    // whose touch belongs to that row until it lifts — is FOLLOWED instead of
    // listened for (M30): the panel reports its moves and its lift, and they
    // go through the same drag and release a press on the board does.
    pointer.follow?.(
      (x, y) => this.followMove(pointer.downTime, x, y),
      (x, y) => this.followEnd(pointer.downTime, x, y),
    );
    return true;
  }

  /**
   * One step of a drag with a tool in hand: paint the cell, or move the ghost,
   * and scroll the board when the finger reaches its edge — so a wall line, or
   * a building, can be carried off the screen it started on.
   */
  private toolDrag(pointer: At): void {
    const cell = this.cellAt(pointer);
    if (cell && this.paintMode) this.dragHandler?.(cell.col, cell.row);
    if (cell && this.placeMode) this.lastPlaceCell = cell;
    const margin = Math.min(this.rect.w, this.rect.h) * 0.12;
    const speed = 12;
    this.edgePan.x =
      pointer.x < this.rect.x + margin ? -speed : pointer.x > this.rect.x + this.rect.w - margin ? speed : 0;
    this.edgePan.y =
      pointer.y < this.rect.y + margin ? -speed : pointer.y > this.rect.y + this.rect.h - margin ? speed : 0;
  }

  /** A followed press moved (see `adopt`). */
  private followMove(press: number, x: number, y: number): void {
    if (!this.dragging || this.dragPress !== press) return;
    if (modalOpen()) {
      this.dragging = false;
      this.dragPress = -1;
      return;
    }
    this.movedBy += Math.abs(x - this.lastX) + Math.abs(y - this.lastY);
    this.lastX = x;
    this.lastY = y;
    if (this.placeMode) this.toolDrag({ x, y });
  }

  /** A followed press lifted: the placement is decided where it landed. */
  private followEnd(press: number, x: number, y: number): void {
    this.edgePan.x = 0;
    this.edgePan.y = 0;
    if (!this.dragging || this.dragPress !== press) return;
    this.dragging = false;
    this.dragPress = -1;
    if (!this.placeMode) return;
    const cell = this.cellAt({ x, y }) ?? this.lastPlaceCell;
    this.lastPlaceCell = null;
    if (cell) this.placeHandler?.(cell.col, cell.row);
  }

  private bindInput(): void {
    const input = this.scene.input;

    input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      if (!this.inBoard(pointer)) return;
      const [p1, p2] = [input.pointer1, input.pointer2];
      if (p1?.isDown && p2?.isDown) {
        this.pinching = true;
        this.dragging = false;
        this.pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.pinchMidX = (p1.x + p2.x) / 2;
        this.pinchMidY = (p1.y + p2.y) / 2;
        return;
      }
      this.dragging = true;
      this.dragPress = pointer.downTime;
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
      if (this.placeMode) this.lastPlaceCell = this.cellAt(pointer);
    });

    input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (modalOpen()) {
        this.dragging = false;
        this.dragPress = -1;
        this.pinching = false;
        return;
      }
      const [p1, p2] = [input.pointer1, input.pointer2];
      if (p1?.isDown && p2?.isDown) {
        // Pinch: scale by the change in finger separation, anchored so the
        // world point under the midpoint stays put.
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        if (this.pinchDist > 0 && dist > 0) {
          const before = this.worldAt(midX, midY);
          this.setZoom(this.zoom * (dist / this.pinchDist));
          const after = this.worldAt(midX, midY);
          this.centerX += before.x - after.x;
          this.centerY += before.y - after.y;
          this.apply();
        }
        // Two fingers moving TOGETHER pan, at any zoom and in any mode — which
        // is the only way to reach the far side of the map while a build tool
        // is armed, because one finger is painting. Without it a third of the
        // grid was unbuildable on a phone: the camera froze the moment you
        // picked up a wall.
        if (this.pinchMidX !== 0 || this.pinchMidY !== 0) {
          this.centerX -= (midX - this.pinchMidX) / this.zoom;
          this.centerY -= (midY - this.pinchMidY) / this.zoom;
          this.apply();
        }
        this.pinchMidX = midX;
        this.pinchMidY = midY;
        this.pinchDist = dist;
        this.pinching = true;
        this.dragging = false;
        return;
      }
      if (!this.dragging || !pointer.isDown) return;
      // A press this pan never accepted — one that started in the drawer, or
      // one that followed an up the drawer ate — moves the list, not the map.
      if (this.dragPress !== pointer.downTime) {
        this.dragging = false;
        this.dragPress = -1;
        this.edgePan.x = 0;
        this.edgePan.y = 0;
        return;
      }
      const dx = pointer.x - this.lastX;
      const dy = pointer.y - this.lastY;
      this.movedBy += Math.abs(dx) + Math.abs(dy);
      this.lastX = pointer.x;
      this.lastY = pointer.y;
      if (this.paintMode || this.placeMode) {
        this.toolDrag(pointer);
        return;
      }
      this.edgePan.x = 0;
      this.edgePan.y = 0;
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
        this.pinchMidX = 0;
        this.pinchMidY = 0;
      }
      this.edgePan.x = 0;
      this.edgePan.y = 0;
      if (!this.dragging) return;
      this.dragging = false;
      this.dragPress = -1;
      // A double tap reframes the whole grid, and that has to work with a tool
      // in hand — losing your bearings is exactly when you reach for it.
      if (wasPinching) return;
      if (this.placeMode) {
        const cell = this.cellAt(pointer) ?? this.lastPlaceCell;
        this.lastPlaceCell = null;
        if (cell) this.placeHandler?.(cell.col, cell.row);
        return;
      }
      if (this.paintMode) {
        const quickPaint = this.scene.time.now - this.downAt < TAP_MS;
        const stillPaint =
          Math.abs(pointer.x - this.downX) + Math.abs(pointer.y - this.downY) <= this.slop;
        if (quickPaint && stillPaint) {
          const now = this.scene.time.now;
          if (now - this.lastTapAt < DOUBLE_TAP_MS) {
            this.lastTapAt = 0;
            this.fit();
          } else {
            this.lastTapAt = now;
          }
        }
        return;
      }
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
        const before = this.worldAt(pointer.x, pointer.y);
        this.setZoom(this.zoom * (dy > 0 ? 0.9 : 1.1));
        const after = this.worldAt(pointer.x, pointer.y);
        this.centerX += before.x - after.x;
        this.centerY += before.y - after.y;
        this.apply();
      },
    );
  }
}
