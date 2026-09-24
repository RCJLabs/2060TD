import type { Layout } from './layout';

/**
 * The test seam's registries (M30): where the UI says what it is showing.
 *
 * Every harness addresses the UI through `window.lastline`: buttons by label
 * and rect, text by content and rect. Until M30 the canvas kit drew all of
 * it, and its registries lived inside it. The DOM kit had to answer the same
 * questions from the same lists while both kits shipped, so the lists moved
 * here, and `probe.ts` reads them back for the harness.
 *
 * Plain data and no stage, so a component registers without importing it.
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

/** Every live button. */
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

/**
 * A panel as the harness reads it: the layout it was last given, the tab it is
 * showing, and how far its list is scrolled — or null when its scene is not
 * running. Every panel registers here.
 */
export interface PanelProbe {
  liveLayout(): Layout | null;
  readonly tab: string;
  probe(): {
    scrollY: number;
    max: number;
    /** Speed the list is still coasting at; 0 when it is at rest. */
    fling: number;
    rect: { x: number; y: number; w: number; h: number };
  } | null;
}

export const panelProbes = new Set<PanelProbe>();
