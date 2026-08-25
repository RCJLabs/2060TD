import { audio } from './audio';
import { setHapticsEnabled } from './haptics';
import { applyPalette } from './palette';

/**
 * Device-local preferences (M6): the mixer and the colorblind-safe hostile
 * palette. Deliberately NOT part of the save file — they follow the device,
 * not the campaign.
 */
export interface Settings {
  /** 0..1. Music and effects ride separate buses, so they mix separately. */
  music: number;
  sfx: number;
  colorblind: boolean;
  /**
   * Whether the phone answers the finger. On by default and absent from every
   * save written before v1.26, which is why it reads `!== false` rather than
   * `=== true`: an existing player should get the feature, not have to find it.
   */
  haptics: boolean;
}

/** Old name on purpose — see meta/save.ts: a key is an address, not a label. */
const KEY = 'lastline_settings_v1';

/**
 * The steps a tap cycles through. A slider needs a widget the touch kit does
 * not have; five stops on a button is the same control in one row.
 */
export const VOLUME_STEPS = [0, 0.25, 0.5, 0.75, 1];

export function nextVolume(level: number): number {
  const index = VOLUME_STEPS.findIndex((v) => v >= level - 0.001);
  return VOLUME_STEPS[(index + 1) % VOLUME_STEPS.length] ?? 0;
}

export function volumeLabel(level: number): string {
  return level <= 0 ? 'OFF' : `${Math.round(level * 100)}%`;
}

const clamp01 = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings> & { mute?: boolean };
      // Before v1.8 there was one SOUND switch. Someone who turned it off
      // wanted silence, and gets silence — not a surprise soundtrack.
      if (parsed.music === undefined && parsed.sfx === undefined) {
        const silent = parsed.mute === true;
        return {
          music: silent ? 0 : DEFAULTS.music,
          sfx: silent ? 0 : DEFAULTS.sfx,
          colorblind: parsed.colorblind === true,
          haptics: parsed.haptics !== false,
        };
      }
      return {
        music: clamp01(parsed.music, DEFAULTS.music),
        sfx: clamp01(parsed.sfx, DEFAULTS.sfx),
        colorblind: parsed.colorblind === true,
        haptics: parsed.haptics !== false,
      };
    }
  } catch {
    // storage unavailable: defaults
  }
  return { ...DEFAULTS };
}

/** Effects at full, music under them — it is a bed, not a soundtrack. */
const DEFAULTS: Settings = { music: 0.5, sfx: 1, colorblind: false, haptics: true };

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: settings live for the session only
  }
}

/** Push the settings into the systems they steer. */
export function applySettings(settings: Settings): void {
  audio.setSfxVolume(settings.sfx);
  audio.setMusicVolume(settings.music);
  applyPalette(settings.colorblind);
  setHapticsEnabled(settings.haptics);
}
