/**
 * A camera (M30 Phase 3): the rect of the canvas it draws into, the point of
 * the world at that rect's centre, and a zoom about that centre.
 *
 * It answers in Phaser's terms because the board was written against them:
 * `setViewport`, `setZoom`, `centerOn`, `getWorldPoint` and `worldView`, all
 * in device px. The difference is that this one keeps no matrix to go stale.
 * Phaser rebuilt its camera matrix at the next render, so a world point read
 * between a zoom and that render mixed the new zoom with the old transform,
 * and `BoardView.worldAt` exists to step around it. Here every answer is
 * computed from the camera's state as it is.
 */
export class Camera {
  x = 0;
  y = 0;
  width: number;
  height: number;
  zoom = 1;
  /** The world point at the centre of the viewport. */
  midX: number;
  midY: number;
  /** Set once the scene places the viewport itself; a resize then leaves it be. */
  customViewport = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.midX = width / 2;
    this.midY = height / 2;
  }

  setViewport(x: number, y: number, width: number, height: number): this {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.customViewport = true;
    return this;
  }

  /** Follow the canvas: what a camera the scene never placed does on a resize. */
  setSize(width: number, height: number): this {
    this.width = width;
    this.height = height;
    return this;
  }

  setZoom(zoom: number): this {
    this.zoom = zoom;
    return this;
  }

  centerOn(x: number, y: number): this {
    this.midX = x;
    this.midY = y;
    return this;
  }

  /** The rect of the world in view. */
  get worldView(): { x: number; y: number; width: number; height: number } {
    const width = this.width / this.zoom;
    const height = this.height / this.zoom;
    return { x: this.midX - width / 2, y: this.midY - height / 2, width, height };
  }

  /** The world point under a canvas point. */
  getWorldPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: this.midX + (x - (this.x + this.width / 2)) / this.zoom,
      y: this.midY + (y - (this.y + this.height / 2)) / this.zoom,
    };
  }

  /** Clip to the viewport and map the world onto it. */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.clip();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.midX, -this.midY);
  }
}
