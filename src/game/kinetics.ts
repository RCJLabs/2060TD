/**
 * What the page does instead of particles.
 *
 * A screentone comic has a complete vocabulary for violence and none of it is
 * soft: a hit is a jagged star with a hard outline, a heavy hit throws focus
 * lines at the thing it happened to, and speed is a bundle of straight lines
 * trailing the object rather than a blur. All of it is line work, which is
 * the point — there is no particle system here and there does not need to be
 * one, because the style's own answer is cheaper and reads better at phone
 * size than anything a few dozen fading sprites would do.
 *
 * Two rules the effects here follow, and both are about how a frame ENDS.
 *
 * **Ink does not fade to grey.** Dropping alpha on black gives you the one
 * value this palette forbids on the board, so an effect holds full ink for
 * most of its life and then cuts. `punch()` is that curve: flat at 1, and
 * only the last third of the life is spent going away.
 *
 * **The jag is stable.** A star redrawn with fresh randomness every frame
 * boils, which looks like a bug rather than like drawing. The phase comes
 * from where the effect happened, so the same burst keeps the same silhouette
 * for as long as it is on screen.
 */

import type Phaser from 'phaser';

/**
 * Opacity over an effect's life: full ink, then a late cut.
 *
 * `t` is 0 at birth and 1 at death. Holds 1 until two thirds through.
 */
export function punch(t: number): number {
  return t < 0.66 ? 1 : Math.max(0, 1 - (t - 0.66) / 0.34);
}

/** A stable pseudo-phase for a point, so a burst does not boil. */
export function phaseAt(x: number, y: number): number {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * The star every impact is made of.
 *
 * Alternating long and short spokes with the long ones jittered, which is
 * what separates a drawn burst from a polygon. Fills with whatever style is
 * already set, so a caller can fill it paper and stroke it ink — the
 * two-pass shape the mockups use everywhere.
 */
export function starPoints(
  x: number,
  y: number,
  outer: number,
  inner: number,
  spokes: number,
  phase: number,
): Phaser.Types.Math.Vector2Like[] {
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < spokes * 2; i++) {
    const long = i % 2 === 0;
    // A cheap deterministic wobble per spoke: enough to break the symmetry,
    // never enough to close a gap between two spokes.
    const j = 0.72 + 0.56 * phaseAt(i * 3.1 + phase * 17, phase * 5.7);
    const r = (long ? outer * j : inner) as number;
    const a = (i / (spokes * 2)) * Math.PI * 2 + phase * Math.PI * 2;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}

/**
 * The manga staple: lines converging on the thing that just happened.
 *
 * Drawn OUTWARD from a clear ring around the impact so the burst itself stays
 * readable, in two weights — a heavy set and a lighter set offset between
 * them, which is how the effect reads as drawn rather than as a sunburst
 * gradient. `weight` scales both.
 *
 * Costs `n * 1.5` line commands and replaces what would otherwise be a
 * particle emitter, a texture and a blend mode.
 */
export function focusLines(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  inner: number,
  outer: number,
  n: number,
  phase: number,
  colour: number,
  alpha: number,
  weight: number,
): void {
  g.lineStyle(weight, colour, alpha);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase * Math.PI * 2;
    const far = outer * (0.7 + 0.6 * phaseAt(i * 7.3, phase * 11.1));
    g.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    g.lineTo(x + Math.cos(a) * far, y + Math.sin(a) * far);
  }
  g.strokePath();

  g.lineStyle(Math.max(1, weight * 0.45), colour, alpha * 0.55);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2 + phase * Math.PI * 2;
    const far = outer * (0.55 + 0.5 * phaseAt(i * 3.9 + 2, phase * 4.4));
    g.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
    g.lineTo(x + Math.cos(a) * far, y + Math.sin(a) * far);
  }
  g.strokePath();
}

/**
 * Speed lines: a bundle trailing something moving, perpendicular spread.
 *
 * `angle` is the direction of travel; the lines run back along it, so a
 * caller passes the heading it already has rather than computing a tail.
 */
export function speedLines(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  len: number,
  spread: number,
  n: number,
  colour: number,
  alpha: number,
  weight: number,
): void {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  g.lineStyle(weight, colour, alpha);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1 || 1) - 0.5) * 2 * spread;
    // Longer in the middle of the bundle, which is what gives it a nose.
    const l = len * (0.45 + 0.55 * (1 - Math.abs(off) / (spread || 1)));
    const sx = x + nx * off;
    const sy = y + ny * off;
    g.moveTo(sx - dx * l * 0.15, sy - dy * l * 0.15);
    g.lineTo(sx - dx * l, sy - dy * l);
  }
  g.strokePath();
}
