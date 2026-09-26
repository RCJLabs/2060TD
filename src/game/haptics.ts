/**
 * Haptics (v1.26).
 *
 * The game had no `navigator.vibrate` call anywhere in it, and that absence is
 * a large part of why it read as ported rather than native. A phone game
 * answers the finger: a tap that lands, a thing that will not go where you put
 * it, a raid that leaves. Without that, every control feels like a picture of
 * a control — the screen changes, but nothing happened to YOU.
 *
 * ## Why patterns rather than durations
 *
 * The Vibration API takes milliseconds, so it is tempting to expose
 * `buzz(ms)`. That produces a codebase where every call site invents its own
 * number and nothing is consistent. These are a vocabulary instead, and
 * the rule for choosing between them is about MEANING, not strength:
 *
 *     tap      something acknowledged the finger
 *     commit   something was spent, built, or launched
 *     deny     the thing you pressed will not do what you asked
 *     land     something arrived that you did not press for
 *     warn     a state you should look up from the drawer for
 *     breach   a wall of yours gave way in a live battle (M31)
 *     loss     a building of yours went in a live battle (M31)
 *
 * `deny` is two short pulses because a single pulse of any length reads as
 * success — the difference a thumb can feel is rhythm, not duration.
 *
 * ## What this deliberately does not do
 *
 * No haptic on every frame of a drag, and none on scroll. Continuous feedback
 * during a gesture drains the motor, and on Android it is audible: a phone on
 * a desk buzzing through a scroll is worse than silence. Discrete events only.
 *
 * ## Support
 *
 * iOS Safari does not implement `navigator.vibrate` at all, so this is a
 * no-op there and must never be the only feedback a control gives — every
 * call site here is paired with something visible. Android Chrome supports it,
 * and only after a user gesture. The battle's two buzzes follow no gesture of
 * their own, so every buzz waits for the page to have been touched once.
 */

export type Haptic = 'tap' | 'commit' | 'deny' | 'land' | 'warn' | 'breach' | 'loss';

/**
 * Millisecond patterns. Kept short on purpose: anything past ~40ms for a
 * single pulse stops reading as a tick and starts reading as a buzz.
 */
const PATTERNS: Record<Haptic, number | number[]> = {
  tap: 10,
  commit: 22,
  deny: [12, 60, 12],
  land: [8, 40, 18],
  warn: [20, 70, 20, 70, 20],
  // The battle's (M31 Phase 1), in a live battle only: a wall gone is one
  // hard pulse, a building gone a heavier one with an echo.
  breach: 30,
  loss: [40, 50, 24],
};

let enabled = true;

/** Follows the device, like the mixer — see `settings.ts`. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function hapticsEnabled(): boolean {
  return enabled;
}

/**
 * Is there a motor to talk to? Checked per call rather than cached: the API
 * is absent on desktop and on iOS, and a cached probe taken during a headless
 * screenshot run would be wrong for the device that later loads the page from
 * the same bundle.
 */
export function hapticsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function'
  );
}

/**
 * Has the page been touched yet? A breach or a lost building buzzes from a
 * battle event rather than a tap (M31), and the scripted siege fights before
 * anyone touches it. Chrome refuses a buzz before the first gesture and logs
 * an error for each one, so none is asked for until then. A browser that does
 * not say is taken at its word that a buzz is allowed.
 */
function touched(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation === undefined || activation.hasBeenActive;
}

/**
 * Fire one. Silent and harmless when unsupported, switched off, or asked for
 * before the page has been touched.
 *
 * Wrapped because `vibrate` throws on some embedded webviews when the page is
 * not visible, and a failed buzz must never take a tap handler down with it.
 */
export function haptic(kind: Haptic): void {
  if (!enabled || !hapticsSupported() || !touched()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* a phone that will not buzz is not an error */
  }
}
