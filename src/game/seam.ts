/**
 * The test seam's registries (M30), shared by both UI implementations.
 *
 * Every harness addresses the UI through `window.lastline`: buttons by label
 * and rect, text by content and rect. Until M30 only the canvas kit drew UI,
 * so its registries lived inside `ui.ts`. The DOM kit has to answer the same
 * questions from the same lists, or a harness running against it would see a
 * screen with nothing on it. So the lists live here, and neither kit owns them.
 *
 * Plain data and no Phaser, so the DOM kit can register without importing the
 * canvas one.
 */

/** A button as the headless harness sees it: label + rect in device px. */
export interface ButtonProbe {
  label: string;
  sub: string;
  /** Painted as the current choice: the armed tool, the open tab. */
  active: boolean;
  /** The area a finger can actually land on: the drawn box, clipped. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The box as laid out, before any clip — what the design intended. */
  full: { x: number; y: number; w: number; h: number };
  enabled: boolean;
}

/** A probe reads its button's state at call time, like a getter. */
export type LiveProbe = () => ButtonProbe & { visible: boolean; dead: boolean };

/** Every live button, from either kit. */
export const buttonProbes = new Set<LiveProbe>();

/**
 * Every visible text with the rectangle it actually occupies, in device px.
 *
 * The seam exists because this project has now shipped the same bug twice:
 * a block laid out from a GUESSED line count, drawn over by the block after
 * it once the text wrapped. Labels alone cannot catch that — a harness has
 * to be able to ask where things landed.
 */
export interface TextRect {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  /**
   * True for text on the BOARD layer — a sector marker, a map label — which
   * pans and zooms with the world and is expected to leave the screen (v1.40).
   *
   * Without this, "no static text runs off the screen" counted map marginalia
   * as static, and passed only while the board happened to fit the viewport.
   * A portrait world framed on a base does not, so the check started failing
   * on text doing exactly what it is supposed to do.
   */
  onBoard: boolean;
}

/**
 * Every live source of DOM text. Each returns what it is showing right now,
 * so a source that has been taken down simply reports nothing.
 */
export const textSources = new Set<() => TextRect[]>();

/** The DOM text on screen, in the order its sources registered. */
export function domTextRects(): TextRect[] {
  const out: TextRect[] = [];
  for (const source of textSources) out.push(...source());
  return out;
}
