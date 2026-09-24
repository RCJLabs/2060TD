import Phaser from 'phaser';
import { isBoardWorld } from './BoardView';
import type { Layout } from './layout';
import { buttonProbes, domTextRects, panelProbes, type ButtonProbe, type TextRect } from './seam';

/**
 * The harness's side of the test seam: what `window.lastline` answers with.
 *
 * Everything the UI registers lives in `seam.ts`, which stays free of Phaser
 * so the DOM kit can register without importing it. Reading those registries
 * back needs Phaser for one thing, the text still drawn on the board, so the
 * reading side lives here.
 */

/**
 * Test seam: every visible string on screen, in draw order. Buttons are
 * addressable by label, but a report, a banner or an overlay body is not a
 * button — this is how the headless harness reads the copy the player reads.
 */
export function liveTexts(scenes: Phaser.Scene[]): string[] {
  const found: string[] = [];
  const walk = (items: Phaser.GameObjects.GameObject[]): void => {
    for (const item of items) {
      if (item instanceof Phaser.GameObjects.Container) {
        if (item.visible) walk(item.list);
        continue;
      }
      if (item instanceof Phaser.GameObjects.Text && item.visible && item.text.length > 0) {
        found.push(item.text);
      }
    }
  };
  for (const scene of scenes) walk(scene.children.list);
  // The DOM layer draws over the whole canvas, so its text comes last.
  for (const t of domTextRects()) found.push(t.text);
  return found;
}

/** Every visible string with the rectangle it occupies. See `TextRect`. */
export function liveTextRects(scenes: Phaser.Scene[]): TextRect[] {
  const found: TextRect[] = [];
  const walk = (items: Phaser.GameObjects.GameObject[], onBoard: boolean): void => {
    for (const item of items) {
      if (item instanceof Phaser.GameObjects.Container) {
        if (item.visible) walk(item.list, onBoard || isBoardWorld(item));
        continue;
      }
      if (item instanceof Phaser.GameObjects.Text && item.visible && item.text.length > 0) {
        const b = item.getBounds();
        // Depth comes along so a harness can scope to the modal layer: an
        // overlay line and a panel row behind the scrim are not an overlap.
        found.push({
          text: item.text,
          x: b.x,
          y: b.y,
          w: b.width,
          h: b.height,
          depth: item.depth,
          onBoard,
        });
      }
    }
  };
  for (const scene of scenes) walk(scene.children.list, false);
  found.push(...domTextRects());
  return found;
}

/**
 * Every button currently on screen. The E2E harness taps by label instead of
 * by hard-coded pixels — the layout moves between phones, the labels don't.
 */
export function liveButtons(): ButtonProbe[] {
  const out: ButtonProbe[] = [];
  for (const probe of buttonProbes) {
    const { visible, dead, ...rest } = probe();
    // Scene restarts destroy buttons without going through destroy() — drop
    // those probes here so a stale rect is never reported as tappable.
    if (dead) buttonProbes.delete(probe);
    else if (visible) out.push(rest);
  }
  return out;
}

/**
 * The layout a live panel is actually laid out with.
 *
 * NOT `layoutOf(scene)`, which is what the seam did first and which recomputes
 * a layout from defaults — so it reported a half-open drawer however the real
 * one was sitting, and a harness measuring the drawer measured a constant.
 * The panel stores what it was given; that is the only copy that is true.
 */
export function panelLayout(): Layout | null {
  for (const panel of panelProbes) {
    const live = panel.liveLayout();
    if (live) return live;
  }
  return null;
}

/** Test seam: which tab a live panel is showing. */
export function panelTab(): string | null {
  for (const panel of panelProbes) {
    if (panel.liveLayout()) return panel.tab;
  }
  return null;
}

export function panelScroll(): {
  scrollY: number;
  max: number;
  /** Speed the flick is still coasting at; 0 when the list is at rest. */
  fling: number;
  rect: { x: number; y: number; w: number; h: number };
} | null {
  for (const panel of panelProbes) {
    const at = panel.probe();
    if (at) return at;
  }
  return null;
}
