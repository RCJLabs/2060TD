import Phaser from 'phaser';
import { COLORS, css } from './palette';

export interface Button {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setActive(active: boolean): void;
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  setLabel(text: string): void;
}

export function mono(
  size: number,
  color: number = COLORS.ink,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: 'monospace', fontSize: `${size}px`, color: css(color), ...extra };
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onClick: () => void,
): Button {
  const bg = scene.add
    .rectangle(x, y, width, height, COLORS.bgField)
    .setOrigin(0, 0)
    .setStrokeStyle(1, COLORS.gridLine)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(x + 10, y + height / 2, text, mono(12))
    .setOrigin(0, 0.5);

  let active = false;
  let enabled = true;
  const restingColor = () => (active ? COLORS.oliveDark : COLORS.bgField);
  const refresh = () => {
    bg.setFillStyle(restingColor());
    bg.setStrokeStyle(1, active ? COLORS.olive : COLORS.gridLine);
    label.setColor(css(enabled ? COLORS.ink : COLORS.inkDim));
  };

  bg.on('pointerover', () => {
    if (enabled) bg.setFillStyle(active ? COLORS.olive : COLORS.gridLine);
  });
  bg.on('pointerout', refresh);
  bg.on(
    'pointerdown',
    (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (!enabled) return;
      onClick();
      refresh();
    },
  );

  refresh();
  return {
    bg,
    label,
    setActive(value: boolean) {
      active = value;
      refresh();
    },
    setEnabled(value: boolean) {
      enabled = value;
      refresh();
    },
    setVisible(visible: boolean) {
      bg.setVisible(visible);
      label.setVisible(visible);
      if (visible) refresh();
    },
    setLabel(value: string) {
      label.setText(value);
    },
  };
}
