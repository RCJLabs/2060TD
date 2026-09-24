/**
 * What a glyph draws WITH (M30): the part of Phaser's Graphics the glyphs,
 * row icons and overlay sketches actually use.
 *
 * Every silhouette in the game — a structure, a unit, a faction mark — is one
 * function that draws into whatever it is handed, so the board, a drawer row
 * and an overlay card show the same shape. The DOM kit has no Phaser Graphics
 * to hand it. It hands it a `CanvasInk` (dom/ink.ts), which draws the same
 * calls into a 2D canvas, and this interface is the contract between the two:
 * a Phaser Graphics satisfies it as it stands, and so does the canvas.
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
