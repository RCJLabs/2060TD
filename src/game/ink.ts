/**
 * What a glyph draws WITH (M30): the part of a `Graphics` the glyphs, row
 * icons and overlay sketches actually use.
 *
 * Every silhouette in the game — a structure, a unit, a faction mark — is one
 * function that draws into whatever it is handed, so the board, a drawer row
 * and an overlay card show the same shape. The board hands it the stage's
 * `Graphics`, which records the calls and replays them every frame; a DOM row
 * hands it a `CanvasInk` (dom/ink.ts), which draws them once into its own
 * canvas. This interface is the contract between the two. It was written
 * against Phaser's Graphics, which satisfied it as it stood.
 *
 * Kept to what is called. A method added here is a method the canvas has to
 * implement, and the typechecker is what says which ones those are.
 */
export interface InkPoint {
  x: number;
  y: number;
}

export interface Ink {
  fillStyle(color: number, alpha?: number): this;
  lineStyle(lineWidth: number, color: number, alpha?: number): this;
  fillRect(x: number, y: number, width: number, height: number): this;
  strokeRect(x: number, y: number, width: number, height: number): this;
  fillCircle(x: number, y: number, radius: number): this;
  strokeCircle(x: number, y: number, radius: number): this;
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): this;
  fillPoints(points: InkPoint[], closeShape?: boolean, closePath?: boolean, endIndex?: number): this;
  lineBetween(x1: number, y1: number, x2: number, y2: number): this;
  beginPath(): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    anticlockwise?: boolean,
    overshoot?: number,
  ): this;
  strokePath(): this;
  save(): this;
  restore(): this;
  translateCanvas(x: number, y: number): this;
  rotateCanvas(radians: number): this;
  clear(): this;
}
