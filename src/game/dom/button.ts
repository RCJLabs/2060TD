import type { Scene } from '../stage';
import { audio } from '../audio';
import { haptic } from '../haptics';
import { music } from '../music';
import { COLORS, css as hex } from '../palette';
import { buttonProbes, type LiveProbe } from '../seam';
import { DISPLAY_FAMILY, DISPLAY_SCALE, DRAG_SLOP, HOLD_MS, MONO_FAMILY } from '../tokens';
import { css, deviceRect, dpr, sceneHost } from './layer';

export interface DomButtonOptions {
  /** Font size in device px. */
  font: number;
  align?: 'left' | 'center';
  /** Right-aligned secondary text (costs, counts). */
  sub?: string;
  /** Suppress the click sound (tab strips click a lot). */
  quiet?: boolean;
  /**
   * The one action this screen exists for: LAUNCH, CONFIRM, START ASSAULT.
   *
   * Drawn as a filled slab with a paper label and an alarm edge, so it is
   * the only knocked-out thing on the page that is not a selection. A screen
   * gets one, and a screen with no single obvious action gets none — the
   * layout does not even reserve the band (see layout.ts `primary`).
   */
  emphasis?: 'primary';
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
  /**
   * The scrolling viewport the button lives in. A probe reports the part of
   * the button a finger can reach, and a row scrolled half out of its list is
   * a sliver, not a whole button.
   */
  clipTo?: HTMLElement;
}

/** The button a component holds: its element, and what the component calls on it. */
export interface DomButton {
  readonly el: HTMLButtonElement;
  setActive(active: boolean): void;
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  setLabel(text: string): void;
  setSub(text: string): void;
  /** Place the box, in device px from its host's top-left. */
  setRect(x: number, y: number, w: number, h: number): void;
  /** Extra left inset for the label, in device px — room for a row's icon. */
  setIndent(px: number): void;
  setFont(size: number): void;
  /** Wrap the label to this width in device px; null leaves it on one line. */
  setWrap(width: number | null): void;
  /** Measured height of the label block, in device px. */
  labelHeight(): number;
  /** Measured width of the sub, in device px, or 0 when there is none. */
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

/** The panel border weight. Two device px, like every rule on the page. */
const EDGE = 2;

/**
 * A button (M30): a real `<button>`, sized in device px and drawn in the page's
 * control language.
 *
 * Three states: KNOCKOUT (chosen, pressed or primary: solid ink, paper label),
 * DISABLED (paper inside a grey line) and RESTING (paper inside an ink line).
 * The rules about what a press was came across from the canvas kit this
 * replaced: the acknowledgement buzzes on the down, a press that travelled
 * past the drag slop was a pan and not a tap, a hold that stays put for
 * `HOLD_MS` is information and cancels the tap, and a footer forgives a thumb
 * rolling off its edge.
 *
 * What the DOM gives for nothing is the rest of what that kit spent its length
 * on: a hit area that is the box, a release that arrives wherever the finger
 * lifts (pointer capture), a press the browser takes back when a list scrolls
 * (`pointercancel`), and keyboard activation.
 */
export function domButton(
  host: HTMLElement,
  text: string,
  onTap: () => void,
  opts: DomButtonOptions,
): DomButton {
  const align = opts.align ?? 'left';
  let fontSize = opts.font;
  let indent = 0;
  let enabled = true;
  let active = false;
  /** Painted as held down. */
  let pressed = false;
  let destroyed = false;
  /** The press this button owns: which pointer, where it landed, how far it went. */
  let press: { id: number; x: number; y: number; travel: number } | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;

  const el = document.createElement('button');
  el.type = 'button';
  el.dataset['ui'] = 'button';
  el.style.cssText = [
    'position:absolute',
    'box-sizing:border-box',
    'margin:0',
    'display:flex',
    'align-items:center',
    `justify-content:${align === 'center' ? 'center' : 'flex-start'}`,
    'border-style:solid',
    'border-radius:0',
    'cursor:pointer',
    'pointer-events:auto',
    'overflow:hidden',
    'outline-offset:-4px',
    // A list the button sits in scrolls vertically; a vertical drag starting
    // on the button is the list's, and the browser says so with a cancel.
    'touch-action:pan-y',
  ].join(';');
  const label = document.createElement('span');
  label.dataset['text'] = '';
  label.style.cssText = `font-family:${DISPLAY_FAMILY};font-weight:600;white-space:nowrap;min-width:0;text-align:${align}`;
  label.textContent = text;
  el.appendChild(label);
  const sub = document.createElement('span');
  sub.dataset['text'] = '';
  // Right-aligned. A centred label keeps the centre of the box, as it does on
  // the canvas, so its sub is pinned to the edge rather than flowed after it.
  sub.style.cssText =
    `font-family:${MONO_FAMILY};white-space:nowrap;flex:none;` +
    (align === 'center' ? 'position:absolute;top:50%;transform:translateY(-50%)' : 'margin-left:auto');
  sub.textContent = opts.sub ?? '';
  if (opts.sub !== undefined) el.appendChild(sub);
  host.appendChild(el);

  const style = (): void => {
    const pad = Math.round(fontSize * 1.1);
    el.style.borderWidth = `${css(EDGE)}px`;
    el.style.paddingLeft = `${css(pad + (align === 'center' ? 0 : indent))}px`;
    el.style.paddingRight = `${css(pad)}px`;
    label.style.fontSize = `${css(Math.round(fontSize * DISPLAY_SCALE))}px`;
    // The gap to the sub is the label's, so `subWidth` measures the figure
    // alone — which is what a caller wrapping the label clear of it adds a pad to.
    label.style.marginRight = opts.sub !== undefined && align !== 'center' ? `${css(pad)}px` : '0';
    sub.style.fontSize = `${css(fontSize)}px`;
    if (align === 'center') sub.style.right = `${css(pad)}px`;
  };

  const refresh = (hover = false): void => {
    const primary = opts.emphasis === 'primary' && enabled;
    const knock = active || pressed || primary;
    el.style.background = hex(knock ? COLORS.oliveDark : hover ? COLORS.olive : COLORS.bgControl);
    el.style.borderColor = hex(knock ? COLORS.oliveDark : enabled ? COLORS.oliveDark : COLORS.disabled);
    label.style.color = hex(knock ? COLORS.bgField : enabled ? COLORS.ink : COLORS.disabled);
    sub.style.color = hex(
      knock ? (primary ? COLORS.alarm : COLORS.bgField) : enabled ? COLORS.ink : COLORS.disabled,
    );
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
    el.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  };

  const disarm = (): void => {
    if (holdTimer !== undefined) clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const arm = (): void => {
    disarm();
    if (!opts.onHold) return;
    holdTimer = setTimeout(() => {
      holdTimer = undefined;
      if (!press || destroyed || press.travel > DRAG_SLOP) return;
      // The tap is spent: a press is one thing or the other.
      press = null;
      if (pressed) {
        pressed = false;
        refresh();
      }
      haptic('land');
      opts.onHold?.();
    }, HOLD_MS);
  };
  const cancel = (): void => {
    disarm();
    press = null;
    if (!pressed) return;
    pressed = false;
    if (!destroyed) refresh();
  };
  const fire = (): void => {
    if (!opts.quiet) audio.sfx('click');
    onTap();
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // No compatibility mouse events for this press. A touch is followed by a
    // synthesised mousedown and mouseup at the same spot, and by then the tap
    // may have closed the overlay this button was on — so they land on the
    // canvas underneath and press whatever the canvas has there. The first
    // harness run hit it on a spec card: CLOSE sat over the tab strip, and the
    // ghost pair switched the drawer to OPS. Scrolling is untouched: that is
    // `touch-action`'s business, not the press's.
    e.preventDefault();
    audio.unlock(); // first gesture wakes the audio context
    music.resume(); // …and the score, which asked before it was allowed
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, travel: 0 };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer the browser will not capture still releases here.
    }
    if (!enabled) {
      // Two pulses, on the down, because a disabled button never releases —
      // but a hold still answers "what IS this?".
      haptic('deny');
      arm();
      return;
    }
    haptic('tap');
    pressed = true;
    refresh();
    arm();
  });
  el.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const d = Math.hypot(e.clientX - press.x, e.clientY - press.y) * dpr();
    press.travel = Math.max(press.travel, d);
  });
  el.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const owned = press;
    disarm();
    press = null;
    if (!enabled) return;
    if (pressed) {
      pressed = false;
      refresh();
    }
    const travel = Math.max(owned.travel, Math.hypot(e.clientX - owned.x, e.clientY - owned.y) * dpr());
    if (travel > DRAG_SLOP) {
      // A press that travelled was a pan across this button — unless it simply
      // rolled off the edge of a button with nothing behind it to scroll.
      const box = el.getBoundingClientRect();
      const inside = e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
      if (inside || !opts.edgeGrace) return;
      const grace = box.height;
      const near =
        e.clientX >= box.left - grace &&
        e.clientX <= box.right + grace &&
        e.clientY >= box.top - grace &&
        e.clientY <= box.bottom + grace;
      if (!near || travel > grace * dpr() * 1.5) return;
    }
    fire();
  });
  el.addEventListener('pointercancel', cancel);
  // The keyboard, answered on the key rather than on the click it would turn
  // into. Clicks are ignored altogether: a pointer's is decided by the release
  // above, and a touch whose release closed the page it landed on has its
  // click delivered to whatever the page uncovered — with no pointer detail
  // on it, so reading `detail === 0` as "the keyboard" fired the tab under a
  // spec card's CLOSE, and the drawer changed tab as the card went away.
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!enabled || e.repeat) return;
    fire();
  });
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse' && enabled && !pressed && !active) refresh(true);
  });
  el.addEventListener('pointerleave', () => {
    if (!destroyed) refresh();
  });

  style();
  refresh();

  const probe: LiveProbe = () => {
    const full = deviceRect(el);
    let { x, y, w, h } = full;
    if (opts.clipTo) {
      const clip = deviceRect(opts.clipTo);
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
      label: label.textContent ?? '',
      sub: sub.textContent ?? '',
      x,
      y,
      w,
      h,
      full,
      enabled,
      active,
      visible: el.isConnected && el.style.display !== 'none' && w > 0 && h > 0,
      dead: destroyed || !el.isConnected,
    };
  };
  buttonProbes.add(probe);

  return {
    el,
    setActive(value) {
      if (active === value) return;
      active = value;
      refresh();
    },
    setEnabled(value) {
      if (enabled === value) return;
      enabled = value;
      refresh();
    },
    setVisible(visible) {
      el.style.display = visible ? 'flex' : 'none';
    },
    setLabel(value) {
      if (label.textContent !== value) label.textContent = value;
    },
    setSub(value) {
      if (opts.sub === undefined) return;
      if (sub.textContent !== value) sub.textContent = value;
    },
    setRect(x, y, w, h) {
      el.style.left = `${css(x)}px`;
      el.style.top = `${css(y)}px`;
      el.style.width = `${css(w)}px`;
      el.style.height = `${css(h)}px`;
    },
    setIndent(px) {
      if (indent === px) return;
      indent = px;
      style();
    },
    setFont(size) {
      if (fontSize === size) return;
      fontSize = size;
      style();
    },
    setWrap(width) {
      if (width === null) {
        label.style.whiteSpace = 'nowrap';
        label.style.maxWidth = '';
      } else {
        label.style.whiteSpace = 'normal';
        label.style.maxWidth = `${css(width)}px`;
      }
    },
    labelHeight() {
      return label.getBoundingClientRect().height * dpr();
    },
    subWidth() {
      return opts.sub !== undefined && (sub.textContent ?? '').length > 0
        ? sub.getBoundingClientRect().width * dpr()
        : 0;
    },
    cancelPress: cancel,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      disarm();
      buttonProbes.delete(probe);
      el.remove();
    },
  };
}

/**
 * A button a scene places itself — CONFIRM, LAUNCH, the siege's one primary
 * action — as a scene holds it: what the four of them call, and no more.
 */
export interface FreeButton {
  setActive(active: boolean): void;
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  setLabel(text: string): void;
  setSub(text: string): void;
  /** Place the box, in device px. */
  setRect(x: number, y: number, w: number, h: number): void;
  setFont(size: number): void;
  destroy(): void;
}

/** How a free button is set: a button's options, with a size to fit its height when none is given. */
export type FreeButtonOptions = Partial<Omit<DomButtonOptions, 'clipTo'>>;

/** A free button, in the scene's own host, so it goes when the scene does. */
export function createButton(
  scene: Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onTap: () => void,
  opts: FreeButtonOptions = {},
): FreeButton {
  const b = domButton(sceneHost(scene), text, onTap, {
    ...opts,
    font: opts.font ?? Math.max(11, Math.round(height * 0.42)),
  });
  // A free button has nothing behind it to scroll.
  b.el.style.touchAction = 'manipulation';
  b.setRect(x, y, width, height);
  return b;
}
