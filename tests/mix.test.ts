import { afterEach, describe, expect, it, vi } from 'vitest';
import { OFFSCREEN_FLOOR, PAN_WIDTH, placeSound, sideOf, type View } from '../src/game/mix';
import { loadSettings, saveSettings } from '../src/game/settings';

/**
 * The positional mix (M31 Phase 3): a battle sound placed by where it happened
 * across the view it is watched through.
 */

/** A 320-wide board seen whole: centre (160, 240), 160 either side. */
const whole: View = { cx: 160, cy: 240, halfW: 160, halfH: 240 };

describe('where a sound sits', () => {
  it('in the middle when it happens in the middle, and on its side when it does not', () => {
    expect(placeSound(160, 240, whole).pan).toBe(0);
    expect(placeSound(40, 240, whole).pan).toBeLessThan(0);
    expect(placeSound(280, 240, whole).pan).toBeGreaterThan(0);
    // Symmetric about the centre.
    expect(placeSound(100, 240, whole).pan).toBeCloseTo(-placeSound(220, 240, whole).pan, 9);
  });

  it('never hard in one ear: the edge of the view is as far as it goes', () => {
    expect(placeSound(0, 240, whole).pan).toBeCloseTo(-PAN_WIDTH, 9);
    expect(placeSound(320, 240, whole).pan).toBeCloseTo(PAN_WIDTH, 9);
    expect(placeSound(-900, 240, whole).pan).toBeCloseTo(-PAN_WIDTH, 9);
    expect(PAN_WIDTH).toBeLessThan(1);
  });

  it('at full level anywhere in view, quieter off its edge, and never gone', () => {
    expect(placeSound(10, 10, whole).gain).toBe(1);
    const zoomed: View = { cx: 160, cy: 240, halfW: 60, halfH: 90 };
    const justOff = placeSound(160 + 60 + 30, 240, zoomed).gain;
    const farOff = placeSound(160 + 60 + 200, 240, zoomed).gain;
    expect(justOff).toBeLessThan(1);
    expect(farOff).toBeLessThan(justOff);
    expect(farOff).toBeGreaterThanOrEqual(OFFSCREEN_FLOOR);
    // Above and below count too, not only left and right.
    expect(placeSound(160, 240 + 90 + 60, zoomed).gain).toBeLessThan(1);
  });

  it('with no view to go by, in the middle at full level', () => {
    expect(placeSound(10, 400, null)).toEqual({ pan: 0, gain: 1 });
  });

  it('counts a sound as left, centre or right for the harness', () => {
    expect(sideOf(-0.5)).toBe('left');
    expect(sideOf(0.05)).toBe('centre');
    expect(sideOf(0.4)).toBe('right');
  });
});

describe('MONO AUDIO', () => {
  afterEach(() => vi.unstubAllGlobals());

  const withStorage = () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    return store;
  };

  it('is off by default, and off for every settings file written before it existed', () => {
    const store = withStorage();
    expect(loadSettings().mono).toBe(false);
    store.set('lastline_settings_v1', JSON.stringify({ music: 0.5, sfx: 1, colorblind: false, haptics: true }));
    expect(loadSettings().mono).toBe(false);
  });

  it('is kept once switched on', () => {
    withStorage();
    saveSettings({ ...loadSettings(), mono: true });
    expect(loadSettings().mono).toBe(true);
  });
});
