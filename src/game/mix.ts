/**
 * The positional mix (M31 Phase 3): where a battle sound sits, from where it
 * happened and the view it is watched through.
 *
 * Left and right follow the view, not the board, so a sound on screen is heard
 * on the side it is seen, and it never goes hard into one ear: the edge of the
 * view is as far as a sound travels. A sound off the edge of a zoomed-in view
 * is quieter the further off it is, down to a floor, so an assault the camera
 * is not on is still heard, only from further away.
 *
 * Pure, so it is tested without an audio context. The kit applies MONO AUDIO
 * itself, so callers place every sound the same way.
 */

/** What the camera is looking at, in world pixels: its centre and half its extent. */
export interface View {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

/** Where a sound sits: -1 (left) to 1 (right), and a level from 0 to 1. */
export interface Placement {
  pan: number;
  gain: number;
}

/** How far toward one ear the edge of the view puts a sound. */
export const PAN_WIDTH = 0.7;
/** The quietest a sound off the edge of the view gets. */
export const OFFSCREEN_FLOOR = 0.35;

/** Place a sound at world point (x, y), as heard through `view`. */
export function placeSound(x: number, y: number, view: View | null): Placement {
  if (!view || !(view.halfW > 0) || !(view.halfH > 0)) return { pan: 0, gain: 1 };
  const dx = x - view.cx;
  const dy = y - view.cy;
  const pan = Math.max(-1, Math.min(1, dx / view.halfW)) * PAN_WIDTH;
  // How far past the edge of the view, in half-views, across and down.
  const beyond =
    Math.max(0, Math.abs(dx) - view.halfW) / view.halfW + Math.max(0, Math.abs(dy) - view.halfH) / view.halfH;
  return { pan: pan === 0 ? 0 : pan, gain: Math.max(OFFSCREEN_FLOOR, 1 / (1 + beyond)) };
}

export type Side = 'left' | 'centre' | 'right';

/** Which side a pan is heard on, for the record the harness reads. */
export function sideOf(pan: number): Side {
  return pan < -0.15 ? 'left' : pan > 0.15 ? 'right' : 'centre';
}
