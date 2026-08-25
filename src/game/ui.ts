import Phaser from 'phaser';
import { audio } from './audio';
import { haptic } from './haptics';
import { music } from './music';
import { DRAWER_FULL, snapDrawer, type Layout, type Rect } from './layout';
import { modalOpen } from './modal';
import { COLORS, css } from './palette';

/**
 * Touch-first UI kit (v0.9). Buttons take real thumb-sized rects and their
 * type comes from the layout tokens, so the same code renders a 27px desktop
 * row and a 44px phone row without a scale hack.
 */

export interface Button {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  setActive(active: boolean): void;
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  setLabel(text: string): void;
  setSub(text: string): void;
  setRect(x: number, y: number, w: number, h: number): void;
  /**
   * Restrict the tappable area to the intersection with `clip`, in device px.
   * Null clears it. For a row scrolling under a strip: the mask hides the part
   * that has left, and this stops it taking the press.
   */
  setHitClip(clip: { x: number; y: number; w: number; h: number } | null): void;
  /** Extra left inset for the label, in device px — room for a row's icon. */
  setIndent(px: number): void;
  setFont(size: number): void;
  /** Wrap the label to this width in device px; null leaves it on one line. */
  setWrap(width: number | null): void;
  /** Measured height of the label block — what a wrapping list sizes rows by. */
  labelHeight(): number;
  /** Measured width of the sub, so a label can be wrapped clear of it. */
  subWidth(): number;
  /**
   * Give up the press this button is holding, without firing anything.
   *
   * For the tap that catches a coasting list: on every phone, the finger you
   * put down to stop a flick stops it and does NOT activate what it landed
   * on. Stopping the scroll and letting the release through would be worse
   * than not stopping it, because the row the player was reaching for is not
   * the row that slid under their thumb.
   */
  cancelPress(): void;
  destroy(): void;
}

/** The terminal face. System monospace keeps the look with no web font. */
export const MONO_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

export function mono(
  size: number,
  color: number = COLORS.ink,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: MONO_FAMILY, fontSize: `${Math.round(size)}px`, color: css(color), ...extra };
}

/** Travel (device px) past which a press counts as a drag, not a tap. */
export const DRAG_SLOP = 16;

/**
 * How long a press has to last to become a hold, in ms.
 *
 * 480 rather than the 500 most platforms use: this fires while the finger is
 * still down and is confirmed by a buzz, so the cost of being slightly eager
 * is a haptic the player did not want, while the cost of being slow is a
 * gesture that feels broken. Well clear of the ~150ms a deliberate tap takes.
 */
const HOLD_MS = 480;

export interface ButtonOptions {
  /** Font size in device px; defaults to a size derived from the height. */
  font?: number;
  align?: 'left' | 'center';
  /** Right-aligned secondary text (costs, counts). */
  sub?: string;
  /** Parent container — required when the scene partitions world vs UI. */
  container?: Phaser.GameObjects.Container;
  /** Suppress the click sound (tab strips click a lot). */
  quiet?: boolean;
  /**
   * Accept a press that ends just off the button's edge (v1.17.2).
   *
   * Only for buttons with nothing behind them to scroll — overlay rows and
   * footers. A row inside the drawer must NOT take this, or a scroll drag that
   * happens to end in the gap between two rows would count as a tap on the row
   * it started from.
   */
  edgeGrace?: boolean;
  /**
   * The row's SECOND action, on a long press (v1.27).
   *
   * A phone has one button and no right mouse button, so anything a control
   * can do beyond its main action has to come from the press itself. A hold
   * is the one gesture available that costs no screen: no chevron, no "…"
   * affordance, no second row.
   *
   * It is deliberately reserved for things that do not change state. A hold
   * that spent resources would be a trap, because the gesture is discovered
   * by accident — a thumb resting on a row while the player reads it is a
   * long press, and the only safe thing to find there is information.
   *
   * Firing this CANCELS the tap: a press is one thing or the other.
   */
  onHold?: () => void;
}

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

const liveProbes = new Set<() => ButtonProbe & { visible: boolean; dead: boolean }>();

/**
 * Every button currently on screen. The E2E harness taps by label instead of
 * by hard-coded pixels — the layout moves between phones, the labels don't.
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
  return found;
}

/**
 * Every visible text with the rectangle it actually occupies, in device px.
 *
 * The seam exists because this project has now shipped the same bug twice:
 * a block laid out from a GUESSED line count, drawn over by the block after
 * it once the text wrapped. Labels alone cannot catch that — a harness has
 * to be able to ask where things landed.
 */
export function liveTextRects(
  scenes: Phaser.Scene[],
): { text: string; x: number; y: number; w: number; h: number; depth: number }[] {
  const found: { text: string; x: number; y: number; w: number; h: number; depth: number }[] = [];
  const walk = (items: Phaser.GameObjects.GameObject[]): void => {
    for (const item of items) {
      if (item instanceof Phaser.GameObjects.Container) {
        if (item.visible) walk(item.list);
        continue;
      }
      if (item instanceof Phaser.GameObjects.Text && item.visible && item.text.length > 0) {
        const b = item.getBounds();
        // Depth comes along so a harness can scope to the modal layer: an
        // overlay line and a panel row behind the scrim are not an overlap.
        found.push({ text: item.text, x: b.x, y: b.y, w: b.width, h: b.height, depth: item.depth });
      }
    }
  };
  for (const scene of scenes) walk(scene.children.list);
  return found;
}

export function liveButtons(): ButtonProbe[] {
  const out: ButtonProbe[] = [];
  for (const probe of liveProbes) {
    const { visible, dead, ...rest } = probe();
    // Scene restarts destroy buttons without going through destroy() — drop
    // those probes here so a stale rect is never reported as tappable.
    if (dead) liveProbes.delete(probe);
    else if (visible) out.push(rest);
  }
  return out;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Button {
  const align = opts.align ?? 'left';
  let fontSize = opts.font ?? Math.max(11, Math.round(height * 0.42));
  const padX = Math.round(fontSize * 1.1);

  const bg = scene.add
    .rectangle(x, y, width, height, COLORS.bgControl)
    .setOrigin(0, 0)
    .setStrokeStyle(1, COLORS.gridLine)
    .setInteractive({ useHandCursor: true });
  // Origin is TOP-left, not middle-left: a label that wraps is a block of
  // unknown height, and a block is centred by measuring it, not by pinning
  // its middle to the row's middle and hoping it is one line tall.
  const label = scene.add
    .text(align === 'center' ? x + width / 2 : x + padX, y, text, mono(fontSize))
    .setOrigin(align === 'center' ? 0.5 : 0, 0);
  const sub =
    opts.sub !== undefined
      ? scene.add
          .text(x + width - padX, y, opts.sub, mono(fontSize, COLORS.inkDim))
          .setOrigin(1, 0)
      : undefined;
  /**
   * The rect the label is currently centred inside. A top-origin label has to
   * be placed by measuring, and it has to be RE-placed every time something
   * changes its height — a new label, a new font size, a new wrap width. The
   * button used to be centred only by setRect, which meant a button nobody
   * laid out again after construction (every overlay button: the menu, the
   * faction picker) drew its text flush against the top of its own box.
   */
  const rect = { x, y, w: width, h: height };
  let indent = 0;
  const place = (): void => {
    const pad = Math.round(fontSize * 1.1);
    const top = rect.y + Math.max(0, Math.round((rect.h - label.height) / 2));
    // The indent shifts a left-aligned label clear of whatever is drawn in the
    // row's left edge. A centred label ignores it: a tab strip has no icon
    // column, and offsetting the centre would just look like a mistake.
    label.setPosition(
      align === 'center' ? rect.x + rect.w / 2 : rect.x + pad + indent,
      top,
    );
    sub?.setPosition(rect.x + rect.w - pad, top);
  };
  place();

  /**
   * The tappable area, which is NOT always the drawn area.
   *
   * `setSize` on a Rectangle does not resize the hit area Phaser built at
   * `setInteractive` time, and a row scrolling past the end of its list is
   * masked but still live. Both are the same fix: recompute the hit rectangle
   * in LOCAL coordinates — origin is top-left, so local (0,0) is rect (x,y) —
   * and intersect it with the clip when there is one. An empty intersection
   * disables input rather than leaving a zero-sized rectangle, which Phaser
   * still counts as a hit along its edges.
   *
   * This owns `input.enabled` on GEOMETRY alone. A greyed-out button keeps a
   * live hit area — the handlers test `enabled` themselves — so folding the
   * two together here would quietly make every unaffordable row untappable.
   */
  let clip: { x: number; y: number; w: number; h: number } | null = null;
  const applyClip = (): void => {
    const input = bg.input;
    if (!input) return;
    const area = input.hitArea as Phaser.Geom.Rectangle | undefined;
    if (!area || typeof area.setTo !== 'function') return;
    if (!clip) {
      area.setTo(0, 0, rect.w, rect.h);
      input.enabled = true;
      return;
    }
    const left = Math.max(rect.x, clip.x);
    const top = Math.max(rect.y, clip.y);
    const right = Math.min(rect.x + rect.w, clip.x + clip.w);
    const bottom = Math.min(rect.y + rect.h, clip.y + clip.h);
    if (right <= left || bottom <= top) {
      area.setTo(0, 0, 0, 0);
      input.enabled = false;
      return;
    }
    area.setTo(left - rect.x, top - rect.y, right - left, bottom - top);
    input.enabled = true;
  };

  if (opts.container) {
    opts.container.add(bg);
    opts.container.add(label);
    if (sub) opts.container.add(sub);
  }

  let active = false;
  let enabled = true;
  /** Painted as held down. Cleared as soon as the finger leaves the rect. */
  let pressed = false;
  /**
   * This button owns the pointer press that is currently down — which is NOT
   * the same as being painted pressed, and conflating the two is what ate the
   * tap. On touch, sliding off a button fires `pointerout`, which correctly
   * un-highlights it; the old code also threw away the fact that the press
   * had started here, so the release had nothing left to act on and the tap
   * vanished. Every button keeps the highlight and the ownership separate now.
   */
  let holding = false;
  /**
   * `downTime` of the press `holding` refers to; -1 when idle.
   *
   * Ownership is not enough on its own, because the release that would clear
   * it is not guaranteed to arrive. Phaser emits a plugin-level up only when
   * its pass over the objects under the finger runs to the end, and a drag
   * that starts on a list row frequently ends without one — so that row keeps
   * `holding` set. The next plugin-level up ANYWHERE then found a button that
   * still believed it was held, measured the NEW pointer's travel (zero, it
   * was a tap somewhere else), and fired the old row's action: scroll the
   * drawer starting on a row, tap the board, and the row you pushed off from
   * activates. Measured at ~5 seconds and two gestures apart.
   *
   * Matching the press by identity makes a stale flag inert rather than
   * dangerous — the press it names is over, and no later pointer can claim it.
   */
  let heldPress = -1;
  const alive = () => bg.active && label.active;
  const refresh = () => {
    // Pointer events can trail in after a click handler destroyed the button.
    if (!alive()) return;
    const fill = pressed ? COLORS.olive : active ? COLORS.oliveDark : COLORS.bgControl;
    bg.setFillStyle(fill);
    bg.setStrokeStyle(1, active ? COLORS.olive : COLORS.gridLine);
    label.setColor(css(enabled ? COLORS.ink : COLORS.inkDim));
    sub?.setColor(css(enabled ? COLORS.inkDim : COLORS.gridLine));
  };

  /**
   * The long press.
   *
   * Armed on the down and read back once, at the threshold, rather than
   * tracked through a move handler: `getDistance()` already carries the whole
   * travel since the press began, so one look at it answers "was this finger
   * still?" without this button subscribing to every pointer move in the
   * scene — of which a drawer full of rows would otherwise have sixty.
   *
   * A press that has travelled past the drag slop by then was a scroll or a
   * swipe passing over the row, and gets nothing.
   */
  let hold: Phaser.Time.TimerEvent | undefined;
  const disarm = (): void => {
    hold?.remove();
    hold = undefined;
  };
  const arm = (p: Phaser.Input.Pointer): void => {
    disarm();
    if (!opts.onHold) return;
    hold = scene.time.delayedCall(HOLD_MS, () => {
      hold = undefined;
      if (!holding || !alive() || !p.isDown) return;
      if (p.getDistance() > DRAG_SLOP) return;
      // The tap is spent: a press is one thing or the other, and a release
      // that also fired the row's main action would build the thing the
      // player asked to read about.
      holding = false;
      heldPress = -1;
      if (pressed) {
        pressed = false;
        refresh();
      }
      // `land` rather than `tap`: the tap already buzzed on the down, and a
      // hold that answers with the same pulse is indistinguishable from it.
      // What arrives here arrived without being asked for by a tap, which is
      // what that pattern is for.
      haptic('land');
      opts.onHold?.();
    });
  };

  bg.on('pointerover', () => {
    if (enabled && alive() && !pressed) bg.setFillStyle(active ? COLORS.olive : COLORS.gridLine);
  });
  bg.on('pointerout', () => {
    // Un-highlight, but stay the owner of the press: a thumb that rolls off
    // the edge of the button it is holding has not changed its mind.
    if (!pressed) return;
    pressed = false;
    refresh();
  });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation();
    audio.unlock(); // first gesture wakes the audio context
    music.resume(); // …and the score, which asked before it was allowed
    if (!enabled) {
      // A control that will not do what you asked says so with a rhythm a
      // thumb can tell from success — two pulses, not a longer one. Fired on
      // the DOWN, because a disabled button never reaches a release.
      haptic('deny');
      return;
    }
    // On the down, not the release: an acknowledgement that arrives after the
    // action has already happened is not an acknowledgement. This is the only
    // haptic most presses will ever produce, so it is the lightest one there
    // is — anything heavier becomes noise at the rate a drawer gets tapped.
    haptic('tap');
    holding = true;
    heldPress = _p.downTime;
    pressed = true; // visible press state matters more without a hover cursor
    refresh();
    arm(_p);
  });
  const release = (p: Phaser.Input.Pointer, outside: boolean): void => {
    disarm();
    if (!enabled || !holding || p.downTime !== heldPress) return;
    holding = false;
    heldPress = -1;
    if (pressed) {
      pressed = false;
      refresh();
    }
    // A press that travelled was a scroll or a pan across this button, not a
    // tap on it — every list in the game is drag-scrollable.
    if (p.getDistance() > DRAG_SLOP) {
      // …unless the finger simply rolled off the edge of the thing it is
      // holding down, on a button that has nothing behind it to scroll. A
      // footer sits one row tall at the bottom of a phone, which is exactly
      // where a thumb pivots: the press starts on the button, ends a few
      // millimetres past it, and used to be discarded in silence. Grace scales
      // with the button, so it means the same physical slack at any density.
      if (!outside || !opts.edgeGrace) return;
      const grace = bg.height;
      const box = bg.getBounds();
      const near =
        p.x >= box.x - grace &&
        p.x <= box.x + box.width + grace &&
        p.y >= box.y - grace &&
        p.y <= box.y + box.height + grace;
      if (!near || p.getDistance() > grace * 1.5) return;
    }
    if (!opts.quiet) audio.sfx('click');
    onClick();
  };
  bg.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation();
    release(p, false);
  });
  /**
   * A touch released OFF the button's own rectangle never reaches the object
   * at all — Phaser delivers per-object `pointerup` only while the pointer is
   * over the object, and `pointerout` does not fire for touch, which has no
   * hover. So the scene's own pointerup is the only place that release can be
   * seen, and until v1.17.2 nothing saw it: the button stayed painted in its
   * pressed state for good, having swallowed a tap that never happened. A
   * green button that does nothing is what a frozen game looks like.
   *
   * `pressed` is already false when the object's own handler ran, so this
   * cannot double-fire.
   */
  const sceneRelease = (p: Phaser.Input.Pointer): void => {
    if (holding && p.downTime === heldPress && alive()) release(p, true);
  };
  const sceneCancel = (): void => {
    disarm();
    holding = false;
    heldPress = -1;
    if (!pressed) return;
    pressed = false;
    if (alive()) refresh();
  };
  scene.input.on('pointerup', sceneRelease);
  // Released outside the canvas entirely, or taken over by the browser.
  scene.input.on('pointerupoutside', sceneCancel);
  scene.input.on('gameout', sceneCancel);

  refresh();
  const probe = () => {
    // World-space bounds: scrolling containers move buttons without touching
    // their local x/y, and the harness taps where the finger would land.
    const box = bg.getBounds();
    // Reported CLIPPED, because the question a harness asks of this is "where
    // can a finger land", and for a row scrolled half out of its list the drawn
    // box and the live box are different rectangles. Reporting the drawn one
    // made `e2e-mobile` measure overlaps that no longer exist and miss ones
    // that do.
    let { x, y } = box;
    let w = box.width;
    let h = box.height;
    if (clip) {
      const left = Math.max(x, clip.x);
      const top = Math.max(y, clip.y);
      const right = Math.min(x + w, clip.x + clip.w);
      const bottom = Math.min(y + h, clip.y + clip.h);
      x = left;
      y = top;
      w = Math.max(0, right - left);
      h = Math.max(0, bottom - top);
    }
    return {
      label: label.text,
      sub: sub?.text ?? '',
      x,
      y,
      w,
      h,
      // The DRAWN box as well as the live one. They answer different
      // questions and an audit that conflates them is wrong twice: "is this
      // target big enough" is about the design and must read the full box,
      // while "do two targets overlap" is about the finger and must read the
      // clipped one. A row half-scrolled out of a list is a legitimate sliver
      // to tap, not an undersized button.
      full: { x: box.x, y: box.y, w: box.width, h: box.height },
      enabled,
      // Selected state, as the player sees it: the armed build tool, the tab
      // the drawer is showing. A harness that could only read labels and
      // rectangles had to infer "which one is chosen" from what changed
      // elsewhere on screen, and `e2e-drawer` had a helper that read this
      // field before it existed — silently matching nothing.
      active,
      visible: bg.visible && bg.active && w > 0 && h > 0,
      dead: bg.scene === undefined,
    };
  };
  liveProbes.add(probe);

  return {
    bg,
    label,
    ...(sub ? { sub } : {}),
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      refresh();
    },
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      refresh();
    },
    setVisible(visible: boolean) {
      bg.setVisible(visible);
      label.setVisible(visible);
      sub?.setVisible(visible);
      if (visible) refresh();
    },
    setLabel(value: string) {
      if (label.text === value) return;
      label.setText(value);
      place(); // a new label is a new height
    },
    setSub(value: string) {
      if (sub && sub.text !== value) sub.setText(value);
    },
    setRect(nx: number, ny: number, nw: number, nh: number) {
      bg.setPosition(nx, ny).setSize(nw, nh);
      rect.x = nx;
      rect.y = ny;
      rect.w = nw;
      rect.h = nh;
      // Pad comes from the FONT, not the row's own height: a three-line row
      // gets the same inset as a one-line one.
      place();
      applyClip();
    },
    setHitClip(next) {
      clip = next;
      applyClip();
    },
    setIndent(px: number) {
      if (indent === px) return;
      indent = px;
      place();
    },
    setFont(size: number) {
      if (fontSize === size) return;
      fontSize = size;
      label.setFontSize(size);
      sub?.setFontSize(size);
      place();
    },
    /**
     * Wrap the label inside `width` device px, or null to leave it on one
     * line. The height the label reports afterwards is what the caller sizes
     * the row from — measured, never predicted from a character count.
     */
    setWrap(width: number | null) {
      const wrap = label.style.wordWrapWidth ?? null;
      if (wrap === width) return;
      if (width === null) label.setWordWrapWidth(undefined as unknown as number);
      else label.setWordWrapWidth(width);
      place(); // wrapping changes the line count, which changes the height
    },
    /** Height of the label block as it currently renders. */
    labelHeight() {
      return label.height;
    },
    /** Width the sub takes, so the label can be wrapped clear of it. */
    subWidth() {
      return sub && sub.text.length > 0 ? sub.width : 0;
    },
    cancelPress() {
      sceneCancel();
    },
    destroy() {
      disarm();
      liveProbes.delete(probe);
      scene.input.off('pointerup', sceneRelease);
      scene.input.off('pointerupoutside', sceneCancel);
      scene.input.off('gameout', sceneCancel);
      bg.destroy();
      label.destroy();
      sub?.destroy();
    },
  };
}

// ---- the responsive panel -------------------------------------------------

export interface PanelRow {
  id: string;
  label: string;
  /** Right-aligned detail: cost, count, timer. */
  sub?: string;
  enabled?: boolean;
  active?: boolean;
  onTap?: () => void;
  /**
   * The row's second action, on a long press (v1.27) — see
   * `ButtonOptions.onHold`. Rows are pooled, so this is looked up by slot at
   * fire time rather than bound into the button: the row a slot carries
   * changes on every rebuild.
   */
  onHold?: () => void;
  /** A full-width heading instead of a button. */
  heading?: boolean;
  /**
   * The thing this row IS, drawn into the row's left edge.
   *
   * The game has had a silhouette for every structure and every unit since
   * v1.19 and drew them only on the board, so the drawer stayed a spreadsheet:
   * `SUPPLY DEPOT .......... 150S 2/3` is a table cell, and a list of them is
   * scanned by reading rather than by looking. The callback gets a Graphics
   * that has already been cleared and positioned, plus the box it may draw in,
   * so a caller reuses `drawStructureGlyph`/`drawAttackerGlyph` rather than
   * inventing a second set of shapes that would drift from the board's.
   *
   * Called on every rebuild, which is every frame — keep it to drawing.
   */
  icon?: (g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) => void;
}

export interface PanelTab {
  id: string;
  label: string;
}

/**
 * The panel: a right rail in landscape, a collapsible bottom drawer in
 * portrait. Rows are data — scenes hand over a fresh list each frame and the
 * panel diffs it against a pooled set of buttons, so scrolling, re-layout and
 * orientation flips need no bookkeeping from the caller.
 */
/** Live panels, so the harness can read the drawer's scroll offset. */
const livePanels = new Set<Panel>();

/**
 * Live drawer scroll offset and list rect (device px), or null when no panel
 * is on screen. The companion to `boardCamera`: together they are what a
 * double-scroll check reads before and after one gesture.
 */
/**
 * The layout a live panel is actually laid out with.
 *
 * NOT `layoutOf(scene)`, which is what the seam did first and which recomputes
 * a layout from defaults — so it reported a half-open drawer however the real
 * one was sitting, and a harness measuring the drawer measured a constant.
 * The panel stores what it was given; that is the only copy that is true.
 */
export function panelLayout(): Layout | null {
  for (const panel of livePanels) {
    const live = panel.liveLayout();
    if (live) return live;
  }
  return null;
}

/** Test seam: which tab a live panel is showing. */
export function panelTab(): string | null {
  for (const panel of livePanels) {
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
  for (const panel of livePanels) {
    const at = panel.probe();
    if (at) return at;
  }
  return null;
}

export class Panel {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly rowRoot: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly edge: Phaser.GameObjects.Rectangle;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly statusBg: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly scrollHint: Phaser.GameObjects.Rectangle;
  private maskShape!: Phaser.GameObjects.Graphics;
  /**
   * The drawer's grab handle: a hit strip with a grip pill drawn on it.
   *
   * Two objects rather than one because the target and the mark are different
   * sizes on purpose — the pill reads at about 40px wide so it looks like
   * something to pinch, while the strip it lives on spans the panel and is
   * tall enough to actually catch a thumb.
   */
  private handleHit!: Phaser.GameObjects.Rectangle;
  private handleGrip!: Phaser.GameObjects.Rectangle;
  /** Live drag: the press that owns the handle, and where the drawer started. */
  private handlePress = -1;
  private handleFrom = 0;

  private tabButtons: Button[] = [];
  private pool: Button[] = [];
  /** What each pooled row slot currently does. */
  private taps: Array<(() => void) | undefined> = [];
  private holds: Array<(() => void) | undefined> = [];
  private headings: Phaser.GameObjects.Text[] = [];
  /**
   * One Graphics per row slot, pooled alongside the buttons and parented into
   * `rowRoot` so an icon scrolls, masks and dies with the row it belongs to.
   */
  private icons: Phaser.GameObjects.Graphics[] = [];
  private rows: PanelRow[] = [];
  private layout!: Layout;
  private activeTab: string;
  private scrollY = 0;
  private contentH = 0;
  /** `downTime` of the press that owns the current drag; -1 when idle. */
  private dragPress = -1;
  private dragMoved = 0;
  private lastPointerY = 0;
  /**
   * Which way this press turned out to be going.
   *
   * A list that scrolls vertically and swipes horizontally has to decide, once
   * and early, which of the two a finger meant — and then ignore the other axis
   * for the rest of that press. Without the lock a diagonal drag scrolls AND
   * changes tab, which is the one-finger-two-things failure this file keeps
   * coming back to.
   */
  private dragAxis: 'none' | 'x' | 'y' = 'none';
  /**
   * How far a horizontal press has travelled, kept for the release to read.
   *
   * Recorded during the MOVE rather than measured at the up, because the
   * release cannot be trusted to still own the press: a final move arrives
   * with `isDown` already false, which calls `releaseDrag` and clears
   * `dragPress` before POINTER_UP ever runs. Reading the swipe from the
   * pointer at that point found a press that no longer matched, and every
   * swipe was silently dropped.
   */
  private swipeDX = 0;
  /** Smoothed finger speed, and the decaying flick it becomes on release. */
  private velocity = 0;
  private fling = 0;
  /** `downTime` of the last press `catchFling` has already judged; -1 idle. */
  private seenPress = -1;
  private onTabChange?: (id: string) => void;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    private readonly tabs: PanelTab[],
  ) {
    this.scene = scene;
    this.root = container;
    this.activeTab = tabs[0]?.id ?? '';

    this.bg = scene.add.rectangle(0, 0, 10, 10, COLORS.bgPanel).setOrigin(0, 0);
    // In portrait the status strip sits ABOVE the board rather than inside
    // the drawer, so it needs its own ground. It used to get away without one
    // because the board was dark too; over a paper sheet, pale status text on
    // nothing at all is unreadable.
    this.statusBg = scene.add.rectangle(0, 0, 10, 10, COLORS.bgPanel).setOrigin(0, 0);
    this.edge = scene.add.rectangle(0, 0, 10, 2, COLORS.gridLine).setOrigin(0, 0);
    this.handleHit = scene.add
      .rectangle(0, 0, 10, 10, COLORS.bgPanel)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.handleGrip = scene.add.rectangle(0, 0, 10, 4, COLORS.gridLine).setOrigin(0, 0);
    this.bindHandle();
    this.titleText = scene.add.text(0, 0, '2060TD', mono(14, COLORS.ink, { fontStyle: 'bold' }));
    this.statusText = scene.add.text(0, 0, '', mono(11, COLORS.inkDim, { lineSpacing: 3 }));
    this.scrollHint = scene.add.rectangle(0, 0, 3, 30, COLORS.gridLine).setOrigin(0, 0).setAlpha(0.6);
    this.rowRoot = scene.add.container(0, 0);
    container.add([
      this.bg,
      this.statusBg,
      this.edge,
      this.handleHit,
      this.handleGrip,
      this.titleText,
      this.statusText,
      this.scrollHint,
      this.rowRoot,
    ]);

    this.bindScroll();
    livePanels.add(this);
    const forget = (): void => {
      livePanels.delete(this);
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, forget);
    scene.events.once(Phaser.Scenes.Events.DESTROY, forget);
  }

  /**
   * The handle's gesture: drag to resize, release to snap, tap to toggle.
   *
   * Its own press rather than a shared one. The drawer's height IS the
   * layout, so a drag here re-lays-out the scene on every move — which is
   * only affordable because the handle is a strip nothing else competes for.
   * Trying to drive this from the list's scroll gesture would put a resize
   * and a scroll on the same finger, which is the double-scroll bug wearing a
   * different hat.
   *
   * The press is identified by `downTime`, the same way BoardView and the list
   * tell one press from the next: a touch release can synthesise a compat
   * mouse event, and without an owner check the drawer would take a second,
   * phantom drag from a gesture that already ended.
   */
  private bindHandle(): void {
    const input = this.scene.input;
    this.handleHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.layout || this.layout.mode !== 'portrait') return;
      this.handlePress = p.downTime;
      this.handleFrom = this.drawerShare();
      haptic('tap');
    });
    input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      if (this.handlePress !== p.downTime || !p.isDown || !this.layout) return;
      const room = this.dragRoom();
      if (room <= 0) return;
      // Up is a bigger drawer: the handle moves with the finger, so dragging
      // toward the top of the screen grows what is below it.
      const moved = (this.handleFrom * room - (p.y - p.downY)) / room;
      this.onDrawerShare?.(Math.min(DRAWER_FULL, Math.max(0, moved)));
    });
    const release = (p: Phaser.Input.Pointer): void => {
      if (this.handlePress !== p.downTime) return;
      this.handlePress = -1;
      const travelled = Math.abs(p.y - p.downY);
      // A press that never moved is a TAP, and a tap on the handle toggles —
      // the same thing re-tapping the active tab has always done, now with
      // something on screen that suggests it.
      if (travelled <= DRAG_SLOP) {
        this.onDrawerToggle?.();
        return;
      }
      const room = this.dragRoom();
      const at = room > 0 ? this.handleFrom - (p.y - p.downY) / room : this.handleFrom;
      this.onDrawerShare?.(snapDrawer(Math.min(DRAWER_FULL, Math.max(0, at))));
      haptic('tap');
    };
    input.on(Phaser.Input.Events.POINTER_UP, release);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
  }

  /** Height the drawer can travel through, in device px. */
  private dragRoom(): number {
    const l = this.layout;
    if (!l || l.mode !== 'portrait') return 0;
    return Math.max(1, l.height - l.safe.top - l.safe.bottom - l.status.h - l.tabs.h - l.handle.h);
  }

  /** What share the drawer is currently at, derived from the rects. */
  private drawerShare(): number {
    const l = this.layout;
    if (!l || l.mode !== 'portrait') return 0;
    return (l.list.h + l.gap) / this.dragRoom();
  }

  /** Live drawer share during a drag, and the snapped one on release. */
  onDrawerShare?: (share: number) => void;

  /** Test seam: the layout this panel was last given, for `panelLayout`. */
  liveLayout(): Layout | null {
    return this.scene.sys.isActive() ? this.layout : null;
  }

  /** Test seam: how far the list is scrolled, for `panelScroll`. */
  probe(): { scrollY: number; max: number; fling: number; rect: Rect } | null {
    if (!this.scene.sys.isActive() || !this.layout) return null;
    return {
      scrollY: this.scrollY,
      max: Math.max(0, this.contentH - this.layout.list.h),
      fling: this.fling,
      rect: { ...this.layout.list },
    };
  }

  get tab(): string {
    return this.activeTab;
  }

  setTab(id: string): void {
    // Re-tapping the open tab collapses the drawer — the phone gesture that
    // hands the whole screen back to the battlefield.
    if (this.activeTab === id) {
      this.onDrawerToggle?.();
      return;
    }
    this.activeTab = id;
    this.scrollY = 0;
    for (const [i, t] of this.tabs.entries()) this.tabButtons[i]?.setActive(t.id === id);
    this.onTabChange?.(id);
  }

  onTab(handler: (id: string) => void): void {
    this.onTabChange = handler;
  }

  /** Portrait only: the active tab was tapped again. */
  onDrawerToggle?: () => void;

  /** Header line plus the status block under it. */
  setStatus(title: string, lines: string[]): void {
    // Monospace again: clip the headline to the columns the strip actually has.
    const room = this.layout
      ? Math.floor((this.layout.status.w - this.layout.pad * 2) / (this.layout.font.label * 0.62))
      : title.length;
    const clipped = title.length > room && room > 2 ? `${title.slice(0, room - 1)}…` : title;
    if (this.titleText.text !== clipped) this.titleText.setText(clipped);
    const body = lines.join('\n');
    if (this.statusText.text !== body) this.statusText.setText(body);
  }

  applyLayout(layout: Layout): void {
    this.layout = layout;
    const { panel, status, tabs, list, pad, font } = layout;

    this.bg.setPosition(panel.x, panel.y).setSize(panel.w, panel.h);
    this.statusBg.setPosition(status.x, status.y).setSize(status.w, status.h);
    // The handle: a full-width strip to catch a thumb, with a short grip pill
    // centred on it so it reads as something to pinch rather than a divider.
    const { handle } = layout;
    const grabbable = handle.w > 0 && handle.h > 0;
    this.handleHit.setVisible(grabbable).setPosition(handle.x, handle.y).setSize(handle.w, handle.h);
    if (this.handleHit.input) {
      (this.handleHit.input.hitArea as Phaser.Geom.Rectangle).setTo(0, 0, handle.w, handle.h);
    }
    const gripW = Math.min(handle.w * 0.25, layout.px(44));
    const gripH = Math.max(2, layout.px(4));
    this.handleGrip
      .setVisible(grabbable)
      .setPosition(handle.x + (handle.w - gripW) / 2, handle.y + (handle.h - gripH) / 2)
      .setSize(gripW, gripH);
    if (layout.mode === 'portrait') {
      this.edge.setPosition(panel.x, panel.y).setSize(panel.w, Math.max(2, layout.px(1)));
    } else {
      this.edge.setPosition(panel.x, 0).setSize(Math.max(2, layout.px(1)), panel.h);
    }

    this.titleText.setPosition(status.x + pad, status.y + Math.round(pad * 0.6)).setFontSize(font.label);
    this.statusText
      .setPosition(status.x + pad, status.y + Math.round(pad * 0.6) + font.label + Math.round(pad * 0.4))
      .setFontSize(font.tiny);
    // Portrait keeps the status strip to one line; the rail can afford three.
    this.statusText.setVisible(layout.mode === 'landscape' || status.h > font.label * 3);

    // Tab strip: equal columns across the tab rect.
    const tabW = Math.floor((tabs.w - pad * 2 - layout.gap * (this.tabs.length - 1)) / this.tabs.length);
    for (const [i, t] of this.tabs.entries()) {
      const x = tabs.x + pad + i * (tabW + layout.gap);
      const y = tabs.y + Math.round(layout.gap / 2);
      const h = tabs.h - layout.gap;
      if (!this.tabButtons[i]) {
        const index = i;
        this.tabButtons[i] = makeButton(this.scene, x, y, tabW, h, t.label, () => this.setTab(this.tabs[index]!.id), {
          align: 'center',
          font: font.tiny,
          container: this.root,
          quiet: true,
        });
        this.tabButtons[i]!.setActive(t.id === this.activeTab);
      }
      this.tabButtons[i]!.setRect(x, y, tabW, h);
      this.tabButtons[i]!.setFont(font.tiny);
    }

    // Clip rows to the list area.
    this.maskShape?.destroy();
    this.maskShape = this.scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(list.x, list.y, list.w, list.h);
    this.rowRoot.setMask(this.maskShape.createGeometryMask());
    this.rowRoot.setPosition(0, 0);
    this.scrollHint.setSize(Math.max(3, layout.px(2)), 0);
    this.relayoutRows();
  }

  /** Replace the row list. Cheap to call every frame. */
  setRows(rows: PanelRow[]): void {
    this.rows = rows;
    this.relayoutRows();
  }

  /**
   * Lay the rows out, wrapping anything too long for its column (v1.13).
   *
   * Rows used to be one line each, truncated with an ellipsis worked out from
   * a monospace character width. That cost the game real copy: two systems
   * grew a second field just to keep a heading short, and four content tables
   * carry a 26-character cap enforced by tests. Wrapping retires all of it.
   *
   * Heights are MEASURED, in two passes. The first sets every label's text
   * and wrap width and reads back the height it actually renders at; the
   * second places the rows now that each line's tallest row is known. A
   * predicted height would be the same guess that put this project's overlay
   * bugs on screen twice — and here it would be worse, because a row that is
   * short by a line does not overlap prose, it overlaps a tap target.
   */
  private relayoutRows(): void {
    if (!this.layout) return;
    const { list, rowH, gap, pad, font, cols } = this.layout;
    const colW = Math.floor((list.w - pad * 2 - gap * (cols - 1)) / cols);
    const headingW = list.w - pad * 2;

    // ---- pass one: text in, height out --------------------------------------
    interface Placed {
      row: PanelRow;
      /** Pool slot for a button row, or heading slot for a heading. */
      slot: number;
      height: number;
    }
    const placed: Placed[] = [];
    let poolIndex = 0;
    let headingIndex = 0;

    for (const row of this.rows) {
      if (row.heading) {
        let text = this.headings[headingIndex];
        if (!text) {
          text = this.scene.add.text(0, 0, '', mono(font.tiny, COLORS.inkDim));
          this.rowRoot.add(text);
          this.headings[headingIndex] = text;
        }
        text.setFontSize(font.tiny);
        text.setWordWrapWidth(headingW);
        if (text.text !== row.label) text.setText(row.label);
        placed.push({
          row,
          slot: headingIndex,
          height: Math.max(rowH, text.height + Math.round(font.tiny * 0.7)),
        });
        headingIndex++;
        continue;
      }

      let button = this.pool[poolIndex];
      if (!button) {
        const slot = poolIndex;
        button = makeButton(this.scene, 0, 0, colW, rowH, row.label, () => this.tapRow(slot), {
          font: font.body,
          sub: '',
          container: this.rowRoot,
          onHold: () => this.holdRow(slot),
        });
        this.pool[poolIndex] = button;
      }
      button.setFont(font.body);
      button.setSub(row.sub ?? '');
      // The sub owns its corner for the whole block, not just the first line.
      // Wrapping the label under it would read as two columns that collide.
      const padX = Math.round(font.body * 1.1);
      const subW = button.subWidth();
      // A row with a silhouette gives up the width the silhouette occupies —
      // from BOTH the label's start and its wrap width, or a long name wraps
      // under the icon instead of beside it.
      const iconW = row.icon ? Math.round(rowH * 0.72) + pad : 0;
      button.setIndent(iconW);
      button.setWrap(
        Math.max(font.body * 4, colW - padX * 2 - iconW - (subW > 0 ? subW + padX : 0)),
      );
      button.setLabel(row.label);
      button.setEnabled(row.enabled !== false);
      button.setActive(row.active === true);
      this.taps[poolIndex] = row.onTap;
      this.holds[poolIndex] = row.onHold;
      placed.push({
        row,
        slot: poolIndex,
        height: Math.max(rowH, button.labelHeight() + Math.round(font.body * 1.1)),
      });
      poolIndex++;
    }

    // ---- pass two: place, a line at a time ----------------------------------
    let y = list.y + pad - this.scrollY;
    let index = 0;
    while (index < placed.length) {
      const first = placed[index]!;
      // A heading always owns its line; buttons fill the columns.
      const span = first.row.heading
        ? [first]
        : placed.slice(index, index + cols).filter((p) => !p.row.heading);
      const lineH = Math.max(...span.map((p) => p.height));

      span.forEach((entry, col) => {
        if (entry.row.heading) {
          const text = this.headings[entry.slot]!;
          text
            .setPosition(list.x + pad, y + Math.round((lineH - text.height) / 2))
            .setVisible(y + lineH > list.y && y < list.y + list.h);
          return;
        }
        const button = this.pool[entry.slot]!;
        const x = list.x + pad + col * (colW + gap);
        button.setRect(x, y, colW, lineH);
        // The mask hides scrolled-away rows but does not un-tap them: a row
        // parked under the status strip would still take a press. Rows leave
        // the display when clear of the list, and their hit area is clipped
        // to the list so the part that has scrolled out cannot be pressed.
        //
        // Clipped, not toggled on the midpoint (v1.26). The midpoint test kept
        // a row live until half of it had left, so up to half a row of hit area
        // sat OUTSIDE the list, over the tab strip below it — `e2e-mobile`
        // measured the last row and a navigation tab overlapping by 0.0px. A
        // thumb aimed at the row changed tab instead, which is a mis-tap across
        // a mode boundary and the worst kind there is.
        const onScreen = y + lineH > list.y && y < list.y + list.h;
        button.setVisible(onScreen);
        button.setHitClip(list);

        // The silhouette, in a square box at the row's left edge. Drawn AFTER
        // the button so it lands on top of the row's own fill, and cleared
        // every rebuild because a pooled slot shows a different row each frame.
        const icon = this.iconFor(entry.slot);
        icon.clear();
        icon.setVisible(onScreen && entry.row.icon !== undefined);
        if (onScreen && entry.row.icon) {
          const box = Math.round(Math.min(lineH, rowH) * 0.72);
          entry.row.icon(icon, x + pad, y + Math.round((lineH - box) / 2), box);
        }
      });

      y += lineH + gap;
      index += span.length;
    }

    for (let i = poolIndex; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
    for (let i = headingIndex; i < this.headings.length; i++) this.headings[i]!.setVisible(false);
    for (let i = poolIndex; i < this.icons.length; i++) this.icons[i]!.setVisible(false);

    this.contentH = y - (list.y - this.scrollY) + pad - gap;
    this.clampScroll();
    this.updateScrollHint();
  }

  private clampScroll(): void {
    const max = Math.max(0, this.contentH - this.layout.list.h);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, max);
  }

  private updateScrollHint(): void {
    const { list } = this.layout;
    const max = Math.max(0, this.contentH - list.h);
    if (max <= 0) {
      this.scrollHint.setVisible(false);
      return;
    }
    const trackH = list.h - this.layout.pad * 2;
    const thumbH = Math.max(this.layout.px(24), (list.h / this.contentH) * trackH);
    const t = this.scrollY / max;
    this.scrollHint
      .setVisible(true)
      .setPosition(list.x + list.w - this.layout.px(5), list.y + this.layout.pad + t * (trackH - thumbH))
      .setSize(Math.max(3, this.layout.px(2)), thumbH);
  }

  private inList(pointer: Phaser.Input.Pointer): boolean {
    return this.inListAt(pointer.x, pointer.y);
  }

  /**
   * Is a point inside the scrolling list?
   *
   * A drag is judged on where the finger went DOWN, never on where it is now.
   * Testing the live position let a pan that started on the map get adopted
   * by the drawer the moment it crossed the boundary — so one gesture moved
   * both, and it moved the list by the whole distance back to a press that
   * happened somewhere else entirely.
   */
  private inListAt(x: number, y: number): boolean {
    const { list } = this.layout ?? {};
    if (!list) return false;
    return x >= list.x && x <= list.x + list.w && y >= list.y && y <= list.y + list.h;
  }

  /** Run the action currently bound to a pooled row slot. */
  /**
   * The Graphics for a row slot, made on demand.
   *
   * Parented into `rowRoot` so it inherits the list's mask and scroll offset —
   * an icon drawn straight onto the scene would sit still while its row moved
   * and would paint over the tab strip on the way past.
   */
  private iconFor(slot: number): Phaser.GameObjects.Graphics {
    let g = this.icons[slot];
    if (!g) {
      g = this.scene.add.graphics();
      this.rowRoot.add(g);
      this.icons[slot] = g;
    }
    return g;
  }

  private holdRow(slot: number): void {
    this.holds[slot]?.();
  }

  private tapRow(slot: number): void {
    this.taps[slot]?.();
  }

  /**
   * Drag-to-scroll, with a flick. The rows are interactive buttons, and a
   * button press stops Phaser emitting the scene-level pointer down/up at
   * all — so a drag both starts and ends from what the pointer itself
   * reports, never from an event a row can swallow. Without that, the up
   * that ends one swipe goes missing and the next touch is measured against
   * a stale anchor, which snaps the list across its whole range.
   */
  private bindScroll(): void {
    const input = this.scene.input;

    input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      const modal = modalOpen();
      if (modal) {
        // A modal that opens mid-gesture ENDS the gesture, it does not
        // complete it: a swipe interrupted by a dialog must not also change
        // tab underneath the dialog.
        this.dragAxis = 'none';
        this.swipeDX = 0;
      }
      if (!pointer.isDown || modal) {
        this.releaseDrag();
        return;
      }
      if (this.dragPress !== pointer.downTime) {
        // A press this drag has not seen before: a new gesture starts here,
        // anchored on where the finger actually landed.
        //
        // It also catches the flick, wherever it landed: a throw that is still
        // coasting belongs to the gesture that threw it, and letting it run on
        // means the drawer is still moving while the next drag pans the map —
        // one finger moving two things, which is the rule this whole file is
        // about. The catch is on the first MOVE and not on the press, because
        // a touch release can synthesize a compatibility mouse-down: stopping
        // on the press kills every flick at the moment of the lift.
        this.stopFling();
        if (!this.inListAt(pointer.downX, pointer.downY)) return;
        this.dragPress = pointer.downTime;
        this.dragMoved = 0;
        this.dragAxis = 'none';
        this.swipeDX = 0;
        this.lastPointerY = pointer.downY;
      }
      const dy = pointer.y - this.lastPointerY;
      this.lastPointerY = pointer.y;
      this.dragMoved += Math.abs(dy);
      const slop = Math.max(DRAG_SLOP, this.layout?.px(6) ?? 6);
      // Which way is this going? Decided once, from the travel since the press
      // began rather than since the last frame — a per-frame comparison flips
      // axis on any wobble. Vertical wins ties and near-ties: scrolling is what
      // a list is for, and a swipe that has to be deliberate is better than a
      // scroll that keeps changing tab.
      if (this.dragAxis === 'none') {
        const totalX = Math.abs(pointer.x - pointer.downX);
        const totalY = Math.abs(pointer.y - pointer.downY);
        if (Math.max(totalX, totalY) <= slop) return;
        // Sideways only means "next tab" in PORTRAIT. In landscape the panel
        // is a vertical rail down the right edge with its tabs stacked at the
        // bottom, and a horizontal drag across it is a drag OFF the rail and
        // onto the map — which is what `e2e-gesture` drives, and what this
        // stole the first time it shipped: dragging out of the rail changed
        // tab and emptied the list under the finger.
        const sideways = this.layout?.mode === 'portrait' && totalX > totalY * 1.4;
        this.dragAxis = sideways ? 'x' : 'y';
      }
      if (this.dragAxis === 'x') {
        this.swipeDX = pointer.x - pointer.downX;
        return;
      }
      // Hold off until the travel also cancels the row's tap, so a gesture is
      // unambiguously one or the other.
      if (this.dragMoved <= slop) return;
      this.velocity = this.velocity * 0.6 + dy * 0.4;
      this.scrollBy(-dy);
    });

    const release = (): void => this.releaseDrag();
    input.on(Phaser.Input.Events.POINTER_UP, release);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (modalOpen() || !this.inList(pointer)) return;
        this.scrollBy(dy);
      },
    );

    // The up that ends a drag is usually swallowed by the row under the
    // thumb, so the release is detected here too — and the flick coasts.
    const step = (): void => this.stepScroll();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, step);
    const stop = (): void => {
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    };
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, stop);
  }

  /**
   * Move `by` tabs along the strip, clamped at the ends.
   *
   * Clamped rather than wrapped: the strip is a row of five in a visible
   * order, and a swipe that jumps from the last to the first contradicts what
   * the strip shows. `setTab` is not used because re-selecting the ACTIVE tab
   * is the drawer toggle — a swipe into the end of the strip would collapse
   * the drawer instead of doing nothing.
   */
  private stepTab(by: number): void {
    const at = this.tabs.findIndex((t) => t.id === this.activeTab);
    if (at < 0) return;
    const next = Math.min(this.tabs.length - 1, Math.max(0, at + by));
    if (next === at) return;
    this.setTab(this.tabs[next]!.id);
    haptic('tap');
  }

  /** Stop the list dead, wherever it is: a new gesture owns the screen now. */
  private stopFling(): void {
    this.velocity = 0;
    this.fling = 0;
  }

  /**
   * End the drag: hand whatever speed it had to the flick, and commit the
   * swipe if that is what the press turned out to be.
   *
   * The swipe is settled HERE rather than in the POINTER_UP handler, which
   * was where it went first and where it was silently dropped every time.
   * Phaser only emits a plugin-level up once its pass over the objects under
   * the finger runs to the end, and a list whose rows recycle mid-gesture
   * aborts that pass — measured, the up arrived for some releases on this
   * panel and not others. `releaseDrag` is the one path all three routes
   * converge on: the up when it comes, the move that arrives with `isDown`
   * already false, and the UPDATE sweep that catches the rest.
   */
  private releaseDrag(): void {
    if (this.dragPress < 0) return;
    this.dragPress = -1;
    // Read from the distance recorded during the drag, so a swipe can still
    // be abandoned by bringing the finger back the way a page swipe anywhere
    // else can. The threshold is a thumb-width or a seventh of the list,
    // whichever is larger, so it means the same gesture on any screen.
    if (this.dragAxis === 'x') {
      const far = Math.max(this.layout?.px(48) ?? 48, (this.layout?.list.w ?? 0) * 0.14);
      if (Math.abs(this.swipeDX) >= far) this.stepTab(this.swipeDX < 0 ? 1 : -1);
    }
    this.dragAxis = 'none';
    this.swipeDX = 0;
    this.fling = Math.abs(this.velocity) > 1 ? -this.velocity : 0;
    this.velocity = 0;
  }

  /**
   * A finger put down on a coasting list stops it — and spends itself doing so.
   *
   * Every phone works this way and this one did not: `stopFling` ran on the
   * first pointer MOVE of a new press, so a press that never moved never
   * caught the flick. Rows kept sliding under the thumb put down to stop
   * them, and the release fired whatever had slid into place.
   *
   * Checked per frame rather than from a POINTER_DOWN handler, for two
   * reasons. A press that lands on a row never reaches a scene-level down at
   * all — `makeButton` calls `stopPropagation`, which aborts Phaser's down
   * pass — and that is where nearly every press in a list lands. And a
   * handler is what the first attempt at this used, years of comment ago: a
   * touch release synthesises a compatibility mouse-down, so stopping on the
   * press killed every flick at the moment of the lift.
   *
   * `wasTouch` is what makes it safe now. Touch events set it, mouse events
   * clear it, so the synthetic mouse-down that follows a lift is
   * distinguishable from a finger. A mouse-only machine has no synthetic
   * events and is let through unconditionally; a hybrid gives up only
   * "click without moving stops the coast", and a mouse that moves at all
   * takes the MOVE path anyway.
   */
  private catchFling(): void {
    // Nothing coasting, nothing to catch — and this early-out is also what
    // keeps the rest from running during a drag, where zeroing anything
    // would eat the flick the drag is busy building.
    if (this.fling === 0) return;
    const p = this.scene.input.activePointer;
    if (!p.isDown || p.downTime === this.seenPress) return;
    this.seenPress = p.downTime;
    if (!p.wasTouch && this.scene.sys.game.device.input.touch) return;
    if (!this.inListAt(p.downX, p.downY)) return;
    this.stopFling();
    // The press is spent. Rows only — the tab strip is not what the finger
    // came down on, and a tab that stopped responding after a flick would be
    // a worse bug than the one this fixes.
    for (const button of this.pool) button.cancelPress();
  }

  private stepScroll(): void {
    this.catchFling();
    if (this.dragPress >= 0) {
      if (this.scene.input.activePointer.isDown) return;
      this.releaseDrag();
    }
    if (Math.abs(this.fling) < 0.5) return;
    const before = this.scrollY;
    this.scrollBy(this.fling);
    // Stop dead at the ends rather than grinding against the clamp.
    this.fling = this.scrollY === before ? 0 : this.fling * 0.88;
  }

  private scrollBy(delta: number): void {
    this.scrollY += delta;
    this.clampScroll();
    this.relayoutRows();
  }
}
