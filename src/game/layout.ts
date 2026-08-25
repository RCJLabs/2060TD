import Phaser from 'phaser';
import { safeAreaInsets, type SafeArea } from './mobile';

/**
 * Responsive layout (v0.9, mobile-first).
 *
 * Everything before this shipped as a fixed 1280×768 canvas scaled to fit,
 * which on a phone meant 10px text rendered at five CSS pixels. The game now
 * sizes its canvas to the real viewport and lays itself out from the rects
 * and tokens computed here.
 *
 * UNITS: the canvas is sized in DEVICE pixels (viewport × capped DPR) and
 * displayed at CSS size via Phaser's `zoom`, so text is crisp on high-DPI
 * screens. Every rect and token below is therefore in device px, derived
 * from CSS-pixel design values through `dpr`. Read `cssWidth`/`cssHeight`
 * when you need to reason about physical screen size.
 */

export type LayoutMode = 'portrait' | 'landscape';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FontScale {
  tiny: number;
  body: number;
  label: number;
  title: number;
  hero: number;
}

export interface Layout {
  /** Canvas size in device px (what Phaser draws into). */
  width: number;
  height: number;
  /** Viewport size in CSS px (what the human sees). */
  cssWidth: number;
  cssHeight: number;
  dpr: number;
  mode: LayoutMode;
  /** Small screen: touch-sized targets and larger type. */
  compact: boolean;
  /** Battlefield viewport — the board camera renders here. */
  board: Rect;
  /** The whole panel (right rail in landscape, bottom drawer in portrait). */
  panel: Rect;
  /** Resource/status strip. */
  status: Rect;
  /** Tab strip. */
  tabs: Rect;
  /** Scrolling row list inside the panel. */
  list: Rect;
  /** Row height, gaps and padding, in device px. */
  rowH: number;
  gap: number;
  pad: number;
  font: FontScale;
  /** Columns of rows the list fits. */
  cols: number;
  /** CSS px → device px, for anything laid out ad hoc. */
  px: (cssValue: number) => number;
  /**
   * What the hardware is sitting on, in DEVICE px — the notch, the home
   * indicator, a punch-hole in landscape. Every rect above is already inset
   * by this; it is exposed so an overlay laid out ad hoc can be too.
   */
  safe: SafeArea;
}

/** Retina is worth it; 3× costs fill rate for no legibility gain. */
export const MAX_DPR = 2;

export function devicePixelRatioCapped(): number {
  const raw = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.min(MAX_DPR, Math.max(1, raw));
}

/** Design tokens in CSS px, before the DPR multiply. */
const COMPACT = {
  rowH: 44,
  // 8, not 6: below about 8px two targets start sharing a fingertip and the
  // wrong one fires. `e2e-mobile` holds the line, and it was 6 through v1.25 —
  // every tab strip in the game was inside the mis-tap band.
  gap: 8,
  pad: 10,
  statusH: 58,
  tabsH: 56,
  font: { tiny: 11, body: 14, label: 13, title: 20, hero: 30 },
};
const ROOMY = {
  rowH: 27,
  gap: 5,
  pad: 12,
  statusH: 74,
  tabsH: 34,
  font: { tiny: 9, body: 12, label: 11, title: 22, hero: 40 },
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Compute the layout for a viewport.
 *
 * @param cssWidth  viewport width in CSS px
 * @param cssHeight viewport height in CSS px
 * @param dpr       capped device pixel ratio
 * @param drawerOpen portrait only: is the bottom drawer expanded?
 */
export function computeLayout(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  drawerOpen = true,
  insets: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 },
): Layout {
  const mode: LayoutMode = cssHeight > cssWidth ? 'portrait' : 'landscape';
  // Phones and small tablets get thumb-sized controls; big screens stay tight.
  const compact = Math.min(cssWidth, cssHeight) < 720;
  const t = compact ? COMPACT : ROOMY;
  const px = (v: number): number => Math.round(v * dpr);

  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);
  const pad = px(t.pad);
  const gap = px(t.gap);
  const rowH = px(t.rowH);
  const font: FontScale = {
    tiny: px(t.font.tiny),
    body: px(t.font.body),
    label: px(t.font.label),
    title: px(t.font.title),
    hero: px(t.font.hero),
  };

  let board: Rect;
  let panel: Rect;
  let status: Rect;
  let tabs: Rect;
  let list: Rect;
  let cols = 1;

  // Everything lays out inside the safe box, not the canvas. `viewport-fit=cover`
  // means the canvas runs under the notch and the home indicator, and a control
  // drawn there is one the hardware is sitting on: unreadable at best, untappable
  // at worst. The board is inset with the rest rather than bled edge-to-edge,
  // because its cells are targets — a tile under the notch cannot be built on.
  const sx = px(insets.left);
  const sy = px(insets.top);
  const sw = width - px(insets.left) - px(insets.right);
  const sh = height - px(insets.top) - px(insets.bottom);

  if (mode === 'portrait') {
    const statusH = px(t.statusH);
    const tabsH = px(t.tabsH);
    // The drawer takes a bounded share of the screen so the board keeps the
    // majority of it; collapsing gives the board nearly the whole viewport.
    const drawerH = drawerOpen ? clamp(Math.round(sh * 0.42), px(200), px(400)) : 0;
    status = { x: sx, y: sy, w: sw, h: statusH };
    board = { x: sx, y: sy + statusH, w: sw, h: sh - statusH - drawerH - tabsH };
    // The list stops a gutter short of the tab strip. Flush, the last row a
    // player can see is touching a navigation tab, and a thumb aimed at the row
    // changes tab instead — a mis-tap that crosses a mode boundary, which is
    // worse than any two neighbours inside one strip.
    list = { x: sx, y: board.y + board.h, w: sw, h: Math.max(0, drawerH - gap) };
    tabs = { x: sx, y: sy + sh - tabsH, w: sw, h: tabsH };
    panel = { x: sx, y: list.y, w: sw, h: drawerH + tabsH };
    // Wide phones fit two columns of rows; narrow ones stay single-file.
    cols = cssWidth >= 500 ? 2 : 1;
  } else {
    const railW = Math.round(clamp(sw * 0.3, px(258), px(340)));
    // Title plus three resource lines, with breathing room.
    const statusH = px(t.font.label + t.font.tiny * 3 + t.pad * 2.6);
    const tabsH = px(t.tabsH);
    board = { x: sx, y: sy, w: sw - railW, h: sh };
    panel = { x: sx + sw - railW, y: sy, w: railW, h: sh };
    status = { x: panel.x, y: sy, w: railW, h: statusH };
    tabs = { x: panel.x, y: sy + statusH, w: railW, h: tabsH };
    // Same gutter in landscape, where the strip is above the list rather than
    // below it.
    list = {
      x: panel.x,
      y: sy + statusH + tabsH + gap,
      w: railW,
      h: sh - statusH - tabsH - gap,
    };
    cols = compact ? 1 : 1;
  }

  return {
    width,
    height,
    cssWidth,
    cssHeight,
    dpr,
    mode,
    compact,
    board,
    panel,
    status,
    tabs,
    list,
    rowH,
    gap,
    pad,
    font,
    cols,
    px,
    safe: {
      top: px(insets.top),
      right: px(insets.right),
      bottom: px(insets.bottom),
      left: px(insets.left),
    },
  };
}

/** Layout for a scene's current canvas size. */
export function layoutOf(scene: Phaser.Scene, drawerOpen = true): Layout {
  const dpr = devicePixelRatioCapped();
  const size = scene.scale.gameSize;
  return computeLayout(
    size.width / dpr,
    size.height / dpr,
    dpr,
    drawerOpen,
    safeAreaInsets(),
  );
}

/**
 * Subscribe a scene to viewport changes. Fires on orientation flips, browser
 * resizes, and the mobile URL bar sliding away. Auto-unsubscribes with the
 * scene so a restarted scene never leaks a stale handler.
 */
export function onLayoutChange(scene: Phaser.Scene, handler: () => void): void {
  const onResize = (): void => handler();
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
  });
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
  });
}
