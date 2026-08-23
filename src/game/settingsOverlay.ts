import Phaser from 'phaser';
import { forgetCoach } from '../meta/coach';
import { downloadSave, pickAndImportSave, saveTown, SAVE_FILENAME } from '../meta/save';
import type { TownState } from '../meta/town';
import type { Layout } from './layout';
import { Overlay } from './overlay';
import { COLORS } from './palette';
import {
  applySettings,
  loadSettings,
  nextVolume,
  saveSettings,
  volumeLabel,
} from './settings';

/**
 * One settings screen, opened from the main menu and from inside the war
 * (v1.1). Both entry points build the same overlay so a preference never
 * lives in two places with two labels.
 *
 * Rows show their own state, so a toggle rebuilds the page rather than
 * mutating it — `rebuild` is the caller's own open function, which also
 * keeps its scene bookkeeping (and the re-flow on rotation) correct.
 */
export interface SettingsOptions {
  /** HUD container, for scenes that partition world and UI across cameras. */
  container?: Phaser.GameObjects.Container;
  /** The live campaign, when there is one: enables save export and import. */
  town?: TownState | null;
  /** Called with an imported save so the caller can adopt it. */
  onImport?: (town: TownState) => void;
  /** Re-open this screen (a toggle changed what the rows say). */
  rebuild: () => void;
  close: () => void;
  /** Offered in-game only; the menu is already the menu. */
  toMenu?: () => void;
  /**
   * The palette is baked into everything already drawn, so a scene with a
   * static layer has to redraw itself. Callers that rebuild every frame can
   * leave this out.
   */
  onPaletteChange?: () => void;
}

export function buildSettings(
  scene: Phaser.Scene,
  layout: Layout,
  opts: SettingsOptions,
): Overlay {
  const settings = loadSettings();
  const ov = new Overlay(scene, layout, {
    title: 'SETTINGS',
    subtitle: 'Sound and palette follow this device, not the campaign.',
    scrim: 0.94,
    ...(opts.container ? { container: opts.container } : {}),
  });
  const { rowH, gap, font } = layout;
  const heading = (text: string): void => {
    ov.text(ov.flow(Math.round(font.label * 1.4), Math.round(gap / 2)), text, font.label, COLORS.inkDim);
  };
  const toggle = (label: string, on: boolean, apply: () => void): void => {
    const b = ov.button(ov.flow(rowH), `${label}: ${on ? 'ON' : 'OFF'}`, () => {
      apply();
      opts.rebuild();
    });
    b.setActive(on);
  };

  heading('DEVICE');
  /** Five stops on a button: the touch kit has no slider, and does not need one. */
  const volume = (label: string, key: 'music' | 'sfx'): void => {
    const level = settings[key];
    ov.button(ov.flow(rowH), `${label}: ${volumeLabel(level)}`, () => {
      const next = { ...loadSettings(), [key]: nextVolume(level) };
      saveSettings(next);
      applySettings(next);
      opts.rebuild();
    });
  };
  volume('EFFECTS', 'sfx');
  volume('MUSIC', 'music');
  toggle('COLORBLIND PALETTE', settings.colorblind, () => {
    const next = { ...loadSettings(), colorblind: !settings.colorblind };
    saveSettings(next);
    applySettings(next);
    opts.onPaletteChange?.();
  });
  toggle('FULLSCREEN', scene.scale.isFullscreen, () => {
    if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
    else scene.scale.startFullscreen();
  });

  if (opts.town) {
    const town = opts.town;
    heading('CAMPAIGN FILE');
    // The row says what happened. An export has three outcomes — the file was
    // handed over, the viewer said no, or this page cannot save files at all —
    // and a button that looks identical in all three is how the hosted build
    // came to have a dead EXPORT SAVE nobody noticed.
    const exportRow = ov.button(ov.flow(rowH), 'EXPORT SAVE', () => {
      exportRow.setLabel('EXPORTING…');
      void downloadSave(town).then((result) => {
        exportRow.setLabel(
          result === 'saved'
            ? `SAVED — ${SAVE_FILENAME}`
            : result === 'declined'
              ? 'EXPORT CANCELLED'
              : 'EXPORT UNAVAILABLE HERE',
        );
      });
    });
    ov.button(ov.flow(rowH), 'IMPORT SAVE', () => {
      void pickAndImportSave().then((imported) => {
        if (imported) opts.onImport?.(imported);
      });
    });
    // The coach is one-shot by design, which is exactly why there has to be a
    // way back to it — a first battle is not a good time to be taking notes.
    ov.button(ov.flow(rowH), 'REPLAY BRIEFINGS', () => {
      forgetCoach(town);
      saveTown(town);
      opts.rebuild();
    });
  }

  if (opts.toMenu) {
    const toMenu = opts.toMenu;
    ov.footer('MAIN MENU', () => toMenu(), 0, 2);
    ov.footer('CLOSE', () => opts.close(), 1, 2);
  } else {
    ov.footer('CLOSE', () => opts.close());
  }
  return ov;
}
