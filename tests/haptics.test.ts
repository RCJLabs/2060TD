import { afterEach, describe, expect, it, vi } from 'vitest';
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from '../src/game/haptics';

/**
 * The haptics contract (v1.26).
 *
 * Three things have to hold, and the last two are the ones that would ship a
 * broken build: it has to actually buzz, it has to be silent when the player
 * turned it off, and it has to be silent — not throw — on every platform that
 * does not implement the Vibration API. iOS Safari is that platform, so the
 * no-op path is the one most players will be on.
 */

/**
 * Swap `navigator.vibrate` for the duration of one test.
 *
 * Through `Reflect` rather than `delete`: `Navigator.vibrate` is declared
 * non-optional in lib.dom, so `delete navigator.vibrate` does not typecheck
 * however the value is cast — the optionality is on the base type, not on the
 * intersection. Reflect asks the same question of the object at runtime
 * without asking TypeScript to believe the property is optional.
 */
const withVibrate = (impl?: (pattern: number | number[]) => boolean) => {
  const nav = navigator as unknown as Record<string, unknown>;
  const had = Object.prototype.hasOwnProperty.call(nav, 'vibrate');
  const previous = nav['vibrate'];
  if (impl) Object.defineProperty(nav, 'vibrate', { value: impl, configurable: true });
  else Reflect.deleteProperty(nav, 'vibrate');
  return () => {
    if (had) Object.defineProperty(nav, 'vibrate', { value: previous, configurable: true });
    else Reflect.deleteProperty(nav, 'vibrate');
  };
};

afterEach(() => setHapticsEnabled(true));

describe('haptics', () => {
  it('fires a pattern when there is a motor and the player wants it', () => {
    const calls: (number | number[])[] = [];
    const restore = withVibrate((pattern) => {
      calls.push(pattern);
      return true;
    });
    try {
      expect(hapticsSupported(), 'the stub did not take').toBe(true);
      haptic('tap');
      haptic('commit');
      expect(calls.length, 'nothing was fired').toBe(2);
      // Liveness: two DIFFERENT events must not produce the same buzz, or the
      // vocabulary is one pattern wearing five names.
      expect(JSON.stringify(calls[0])).not.toBe(JSON.stringify(calls[1]));
    } finally {
      restore();
    }
  });

  it('and DENY is a rhythm rather than a longer pulse', () => {
    // A single pulse of any duration reads as success. What a thumb can tell
    // apart is the gap, so refusal has to be more than one pulse.
    const calls: (number | number[])[] = [];
    const restore = withVibrate((pattern) => {
      calls.push(pattern);
      return true;
    });
    try {
      haptic('deny');
      expect(Array.isArray(calls[0]), `deny fired ${JSON.stringify(calls[0])}`).toBe(true);
      expect((calls[0] as number[]).length).toBeGreaterThan(1);
    } finally {
      restore();
    }
  });

  it('stays silent when the player turned it off', () => {
    const vibrate = vi.fn(() => true);
    const restore = withVibrate(vibrate);
    try {
      setHapticsEnabled(false);
      expect(hapticsEnabled()).toBe(false);
      for (const kind of ['tap', 'commit', 'deny', 'land', 'warn'] as const) haptic(kind);
      expect(vibrate, 'a switched-off motor was asked to buzz').not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('and is a no-op, not a crash, where the API does not exist', () => {
    // The iOS path. Every call site pairs this with something visible, so
    // silence here is correct — but a throw would take a tap handler down.
    const restore = withVibrate(undefined);
    try {
      expect(hapticsSupported()).toBe(false);
      expect(() => haptic('commit')).not.toThrow();
    } finally {
      restore();
    }
  });

  it('and survives a motor that throws', () => {
    // Some embedded webviews throw from vibrate() when the page is not
    // visible. A failed buzz must never become a failed tap.
    const restore = withVibrate(() => {
      throw new Error('not visible');
    });
    try {
      expect(() => haptic('warn')).not.toThrow();
    } finally {
      restore();
    }
  });
});
