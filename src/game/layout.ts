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

/**
 * Where the drawer RESTS (M34): exactly the room the board leaves under the
 * world, so the whole map is in view with the drawer open.
 *
 * Not a fraction, because the right height is not a share of the screen. It is
 * whatever is left once the world is drawn at its fit zoom, which depends on the
 * world's shape as well as the phone's. So it is a name, resolved by
 * `computeLayout` every time the layout is, and a rotation or a URL bar sliding
 * away re-measures it rather than keeping a height that was right for the old
 * viewport. `Layout.rest` is what it resolved to, as a share, for snapping.
 *
 * Until M34 the drawer opened to HALF, which kept 42% of the height whatever
 * the board needed. `npm run fit` measured 16-19 of 30 rows in view that way
 * on every phone and tablet in its table. The map was a third hidden while the
 * sheet over it was mostly empty list.
 */
export const DRAWER_REST = 'rest';

/** A drawer position: a share of the safe height, or the resting detent. */
export type DrawerState = number | typeof DRAWER_REST;

/** The state a tap on the handle, or on the open tab, toggles to. */
export function toggleDrawer(state: DrawerState): DrawerState {
  return state === DRAWER_SHUT ? DRAWER_REST : DRAWER_SHUT;
}

/**
 * The detent a release lands on, by nearest.
 *
 * `rest` is the resting detent's share for the layout being dragged, since only
 * the layout knows it. REST is listed before HALF, so on a screen tall enough
 * for REST to reach HALF's height a release lands on the one that follows the
 * board.
 */
export function snapDrawer(share: number, rest: number): DrawerState {
  const detents: [DrawerState, number][] = [
    [DRAWER_SHUT, DRAWER_SHUT],
    [DRAWER_REST, rest],
    [DRAWER_HALF, DRAWER_HALF],
    [DRAWER_FULL, DRAWER_FULL],
  ];
  let best = detents[0]!;
  for (const detent of detents) {
    if (Math.abs(share - detent[1]) < Math.abs(share - best[1])) best = detent;
  }
  return best[0];
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
  /**
   * The board rect a SHUT drawer would leave (v1.40).
   *
   * The board camera takes its fit zoom from this and its viewport from
   * `board`, so dragging the drawer slides a sheet over a stationary map
   * instead of zooming the world out from under the finger. Before this the
   * two were the same rect, and a half-open drawer cost a 360px phone 40% of
   * its cell size — the difference between an 18px cell and an 11px one.
   *
   * In landscape it IS `board`: the rail is a fixed column with nothing to
   * drag, so there is no second state to describe.
   */
  boardFull: Rect;
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
  /**
   * The drawer's height in device px, below the handle and above the tabs.
   * Zero when it is shut, and in landscape, where there is no drawer.
   */
  drawerH: number;
  /**
   * The share of the safe height `DRAWER_REST` resolves to on this viewport,
   * for snapping a release. Zero in landscape.
   */
  rest: number;
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
 * @param drawer portrait only: the drawer's share of the safe height, 0..1,
 *               or `DRAWER_REST`.
 * @param aspect the world's width over its height, which is what the resting
 *               detent is sized from. A screen with no board passes nothing,
 *               and its rest is HALF.
 */
export function computeLayout(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  drawer: DrawerState = DRAWER_REST,
  insets: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 },
  primaryH = 0,
  statusLines = 1,
  aspect = 0,
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
  let boardFull: Rect;
  let panel: Rect;
  let status: Rect;
  let tabs: Rect;
  let list: Rect;
  let primary: Rect;
  let handle: Rect;
  let drawerH = 0;
  let rest = 0;
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
    // Sized to what the scene puts in it, the way the landscape rail always
    // has been (v1.40). Portrait used one constant for every screen, so the
    // raid planner — which shows a target line and two resource lines under
    // its title — drew its last line across the top of the map. Never shorter
    // than the constant, so a two-row status is exactly what it was.
    const statusH = Math.max(
      px(t.statusH),
      px(t.font.label + t.font.tiny * statusLines + t.pad * 2.6),
    );
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
    // The smallest drawer that is still a list: two rows, the gutter above the
    // tabs, and the scene's primary band if it asked for one. Below this a
    // drawer is a strip you cannot compare two options in, and the way to hand
    // the board those last pixels is to shut it.
    const floorH = Math.min(room, rowH * 2 + gap * 2 + primaryBand);
    // The resting detent: what the world leaves below itself at the fit zoom.
    // Same arithmetic as `BoardView`'s fit, which is measured against this
    // rect's SHUT height — the world is `sw` wide over its aspect, unless the
    // height binds first, in which case it is all of `available` and there is
    // nothing left to give. Floored so the map is never cut by a rounding: a
    // sub-pixel short, a 30-row board shows 29.99 rows. Never above HALF,
    // which is the most any release before this one kept.
    const worldH = aspect > 0 ? Math.min(available, sw / aspect) : available;
    const halfH = clamp(Math.round(sh * DRAWER_HALF), floorH, room);
    const restH =
      aspect > 0 ? clamp(Math.floor(available - worldH), floorH, halfH) : halfH;
    rest = sh > 0 ? restH / sh : 0;
    // The share is of the SAFE HEIGHT, not of `room`. Measuring it against the
    // leftovers looks equivalent and is not: it silently shrank the drawer by
    // 115px the moment the handle took its 44, which cost the SYS tab its last
    // row and broke `e2e-touch`. The handle's height comes out of the board,
    // which had the majority to give.
    //
    // Floored at `floorH` rather than the flat 140px it was until M34, so a
    // drag that starts at a resting drawer shorter than 140 tracks the finger
    // instead of jumping up to the floor on its first pixel.
    drawerH =
      drawer === DRAWER_REST
        ? restH
        : drawer <= 0
          ? 0
          : clamp(Math.round(sh * drawer), floorH, room);
    status = { x: sx, y: sy, w: sw, h: statusH };
    board = { x: sx, y: sy + statusH, w: sw, h: available - drawerH };
    boardFull = { x: sx, y: sy + statusH, w: sw, h: available };
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
    // A portrait world cannot use a wide landscape board: its height binds
    // first, so every pixel past that is page margin. Letting the rail take a
    // little more of it costs the board nothing measurable and buys the panel
    // a real column of room (v1.40).
    const railW = Math.round(clamp(sw * 0.32, px(258), px(400)));
    // Title plus its lines, with breathing room. Three is the floor rather
    // than the count, so no rail gets shorter than the one shipped.
    const statusH = px(t.font.label + t.font.tiny * Math.max(3, statusLines) + t.pad * 2.6);
    const tabsH = px(t.tabsH);
    board = { x: sx, y: sy, w: sw - railW, h: sh };
    boardFull = board;
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
    boardFull,
    panel,
    status,
    tabs,
    primary,
    handle,
    list,
    drawerH,
    rest,
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

/**
 * Layout for a scene's current canvas size.
 *
 * `aspect` is the scene's world, width over height; see `computeLayout`.
 */
export function layoutOf(
  scene: Phaser.Scene,
  drawer: DrawerState = DRAWER_REST,
  primaryH = 0,
  statusLines = 1,
  aspect = 0,
): Layout {
  const dpr = devicePixelRatioCapped();
  const size = scene.scale.gameSize;
  return computeLayout(
    size.width / dpr,
    size.height / dpr,
    dpr,
    drawer,
    safeAreaInsets(),
    primaryH,
    statusLines,
    aspect,
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
