import { audio } from './audio';
import { applyPalette } from './palette';

/**
 * Device-local preferences (M6): sound and the colorblind-safe hostile
 * palette. Deliberately NOT part of the save file — they follow the device,
 * not the campaign.
 */
export interface Settings {
  mute: boolean;
  colorblind: boolean;
}

const KEY = 'lastline_settings_v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { mute: parsed.mute === true, colorblind: parsed.colorblind === true };
    }
  } catch {
    // storage unavailable: defaults
  }
  return { mute: false, colorblind: false };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: settings live for the session only
  }
}

/** Push the settings into the systems they steer. */
export function applySettings(settings: Settings): void {
  audio.setMuted(settings.mute);
  applyPalette(settings.colorblind);
}
