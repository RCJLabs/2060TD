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

/**
 * How much of the screen the portrait drawer takes, as a share of the safe
 * height. A FRACTION rather than the open/shut boolean it replaced (v1.26),
 * because a drawer you can only toggle is a drawer you cannot drag: the handle
 * needs to report where the finger is on every frame, and "somewhere between
 * half and full" has to be expressible for that to look like anything.
 *
 * The detents are what a release snaps to. SHUT hands the whole screen back to
 * the board, HALF is what every release before this one shipped as "open", and
 * FULL is for reading a long list without fighting the map for room.
 */
export const DRAWER_SHUT = 0;
export const DRAWER_HALF = 0.42;
export const DRAWER_FULL = 0.72;
export const DRAWER_DETENTS = [DRAWER_SHUT, DRAWER_HALF, DRAWER_FULL];

/** The detent a release lands on, by nearest. */
export function snapDrawer(share: number): number {
  let best = DRAWER_DETENTS[0]!;
  for (const detent of DRAWER_DETENTS) {
    if (Math.abs(share - detent) < Math.abs(share - best)) best = detent;
  }
  return best;
}

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
  /**
   * The grab handle above the drawer, in portrait. Zero-sized in landscape,
   * where the panel is a fixed rail and there is nothing to drag.
   */
  handle: Rect;
  /**
   * The band a scene's PRIMARY action sits in, directly above the tab strip
   * and inside the thumb arc. Zero-sized unless the scene asked for one by
   * passing a height — a screen with no single obvious action does not get a
   * bar reserved for one it does not have.
   */
  primary: Rect;
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
 * @param drawer portrait only: the drawer's share of the safe height, 0..1.
 */
export function computeLayout(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  drawer: number = DRAWER_HALF,
  insets: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 },
  primaryH = 0,
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
  let primary: Rect;
  let handle: Rect;
  let cols = 1;
  // The band plus the gutter under it, or nothing at all.
  const primaryBand = primaryH > 0 ? primaryH + gap : 0;

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
    // The handle is on screen even when the drawer is shut — it is the
    // affordance that says the drawer can come back. Before v1.26 the only way
    // to reopen one was to re-tap the active tab, a gesture with nothing on
    // screen to suggest it.
    const handleH = px(22);
    // The board never goes away. This is a map game: a drawer that can cover
    // the whole board turns a drag into a way to lose the thing you are
    // playing on, and a full drag measured the board down to 22px before this
    // floor existed.
    const minBoard = px(120);
    // What is left once the fixed furniture is out, and what the DRAWER may
    // take of it. The board is sized from `available`, not `room` — sizing it
    // from `room` cancels the floor exactly, because `room` has already had
    // the floor subtracted and a full drawer then leaves nothing.
    const available = sh - statusH - tabsH - handleH;
    const room = Math.max(px(140), available - minBoard);
    // The share is of the SAFE HEIGHT, not of `room`. Measuring it against the
    // leftovers looks equivalent and is not: it silently shrank the drawer by
    // 115px the moment the handle took its 44, which cost the SYS tab its last
    // row and broke `e2e-touch`. The handle's height comes out of the board,
    // which had the majority to give.
    const drawerH = drawer <= 0 ? 0 : clamp(Math.round(sh * drawer), px(140), room);
    status = { x: sx, y: sy, w: sw, h: statusH };
    board = { x: sx, y: sy + statusH, w: sw, h: available - drawerH };
    handle = { x: sx, y: board.y + board.h, w: sw, h: handleH };
    // The list stops a gutter short of the tab strip. Flush, the last row a
    // player can see is touching a navigation tab, and a thumb aimed at the row
    // changes tab instead — a mis-tap that crosses a mode boundary, which is
    // worse than any two neighbours inside one strip.
    list = { x: sx, y: handle.y + handleH, w: sw, h: Math.max(0, drawerH - gap - primaryBand) };
    tabs = { x: sx, y: sy + sh - tabsH, w: sw, h: tabsH };
    primary =
      primaryH > 0
        ? { x: sx + pad, y: tabs.y - primaryH - gap, w: sw - pad * 2, h: primaryH }
        : { x: sx, y: tabs.y, w: 0, h: 0 };
    panel = { x: sx, y: handle.y, w: sw, h: handleH + drawerH + tabsH };
    // Wide phones fit two columns of rows; narrow ones stay single-file.
    cols = cssWidth >= 500 ? 2 : 1;
  } else {
    const railW = Math.round(clamp(sw * 0.3, px(258), px(340)));
    // Title plus three resource lines, with breathing room.
    const statusH = px(t.font.label + t.font.tiny * 3 + t.pad * 2.6);
    const tabsH = px(t.tabsH);
    board = { x: sx, y: sy, w: sw - railW, h: sh };
    panel = { x: sx + sw - railW, y: sy, w: railW, h: sh };
    // Nothing to drag in landscape: the rail is a fixed column, and a handle
    // there would be an affordance for a gesture that does nothing.
    handle = { x: panel.x, y: sy, w: 0, h: 0 };
    status = { x: panel.x, y: sy, w: railW, h: statusH };
    // The strip goes at the BOTTOM of the rail, not under the status block
    // (v1.26). A phone held sideways is still held at its bottom corners, and
    // `e2e-mobile` measured the town's tab strip 76% up the screen — the one
    // control you navigate with, out past the reach of the thumb holding the
    // device. Bottom-of-rail also matches portrait's order, so the strip is in
    // the same place relative to the content in both orientations.
    tabs = { x: panel.x, y: sy + sh - tabsH, w: railW, h: tabsH };
    primary =
      primaryH > 0
        ? { x: panel.x + pad, y: tabs.y - primaryH - gap, w: railW - pad * 2, h: primaryH }
        : { x: panel.x, y: tabs.y, w: 0, h: 0 };
    list = {
      x: panel.x,
      y: sy + statusH + gap,
      w: railW,
      h: sh - statusH - tabsH - gap * 2 - primaryBand,
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
    primary,
    handle,
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
export function layoutOf(scene: Phaser.Scene, drawer = DRAWER_HALF, primaryH = 0): Layout {
  const dpr = devicePixelRatioCapped();
  const size = scene.scale.gameSize;
  return computeLayout(
    size.width / dpr,
    size.height / dpr,
    dpr,
    drawer,
    safeAreaInsets(),
    primaryH,
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
