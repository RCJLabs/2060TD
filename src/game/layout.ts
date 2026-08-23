import Phaser from 'phaser';

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
  gap: 6,
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

  if (mode === 'portrait') {
    const statusH = px(t.statusH);
    const tabsH = px(t.tabsH);
    // The drawer takes a bounded share of the screen so the board keeps the
    // majority of it; collapsing gives the board nearly the whole viewport.
    const drawerH = drawerOpen
      ? clamp(Math.round(height * 0.42), px(200), px(400))
      : 0;
    status = { x: 0, y: 0, w: width, h: statusH };
    board = { x: 0, y: statusH, w: width, h: height - statusH - drawerH - tabsH };
    list = { x: 0, y: board.y + board.h, w: width, h: drawerH };
    tabs = { x: 0, y: height - tabsH, w: width, h: tabsH };
    panel = { x: 0, y: list.y, w: width, h: drawerH + tabsH };
    // Wide phones fit two columns of rows; narrow ones stay single-file.
    cols = cssWidth >= 500 ? 2 : 1;
  } else {
    const railW = Math.round(clamp(width * 0.3, px(258), px(340)));
    // Title plus three resource lines, with breathing room.
    const statusH = px(t.font.label + t.font.tiny * 3 + t.pad * 2.6);
    const tabsH = px(t.tabsH);
    board = { x: 0, y: 0, w: width - railW, h: height };
    panel = { x: width - railW, y: 0, w: railW, h: height };
    status = { x: panel.x, y: 0, w: railW, h: statusH };
    tabs = { x: panel.x, y: statusH, w: railW, h: tabsH };
    list = { x: panel.x, y: statusH + tabsH, w: railW, h: height - statusH - tabsH };
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
  };
}

/** Layout for a scene's current canvas size. */
export function layoutOf(scene: Phaser.Scene, drawerOpen = true): Layout {
  const dpr = devicePixelRatioCapped();
  const size = scene.scale.gameSize;
  return computeLayout(size.width / dpr, size.height / dpr, dpr, drawerOpen);
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
