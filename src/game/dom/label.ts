import type Phaser from 'phaser';
import { COLORS, css as hex } from '../palette';
import { MONO_FAMILY } from '../tokens';
import { css, sceneHost } from './layer';

/** How a scene label is set: the handful of text styles the scenes use over the board. */
export interface LabelStyle {
  /** Font size in device px. */
  size: number;
  color?: number;
  bold?: boolean;
  align?: 'left' | 'center';
  /** A ground behind the text, and the room around it, in device px. */
  background?: number;
  padX?: number;
  padY?: number;
  /** Extra space between lines, in device px. */
  lineSpacing?: number;
  /** Which point of the text sits on its position: 0 left/top, 0.5 centre. */
  originX?: number;
  originY?: number;
}

/**
 * A line of text a scene puts over the board: a banner, a hint, HOLDING, the
 * recon notice, the replay's verdict. What the scenes call on it, and no more.
 */
export interface SceneLabel {
  setText(text: string): SceneLabel;
  setVisible(visible: boolean): SceneLabel;
  /** Where the label's origin sits, in device px. */
  setPosition(x: number, y: number): SceneLabel;
  setFontSize(size: number): SceneLabel;
  /** Wrap inside this width, in device px. */
  setWordWrapWidth(width: number): SceneLabel;
}

/**
 * A scene label (M30): real text, in a scene's host, which reports it to the
 * harness like any other text on screen and takes it down with the scene.
 */
export function createLabel(scene: Phaser.Scene, text: string, style: LabelStyle): SceneLabel {
  const el = document.createElement('div');
  el.dataset['text'] = '';
  el.textContent = text;
  const ox = style.originX ?? 0;
  const oy = style.originY ?? 0;
  el.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    // Lines as written, and no wrapping until a width is given, as a canvas
    // text sets them. The host is a point at the canvas's origin, so a label
    // left to wrap wraps against nothing: v1.46-v1.47 set the raid's recon
    // notice and its hints one word to a line.
    'white-space:pre',
    `transform:translate(${-ox * 100}%,${-oy * 100}%)`,
    `font-family:${MONO_FAMILY}`,
    `color:${hex(style.color ?? COLORS.ink)}`,
    `text-align:${style.align ?? 'left'}`,
    style.bold ? 'font-weight:700' : '',
    style.background !== undefined ? `background:${hex(style.background)}` : '',
  ].join(';');
  const size = (s: number): void => {
    el.style.fontSize = `${css(s)}px`;
    el.style.lineHeight = `${css(Math.round(s * 1.2) + (style.lineSpacing ?? 0))}px`;
  };
  size(style.size);
  if (style.padX !== undefined || style.padY !== undefined) {
    el.style.padding = `${css(style.padY ?? 0)}px ${css(style.padX ?? 0)}px`;
  }
  // Reported to the harness by the host it hangs from (see `sceneHost`).
  sceneHost(scene).appendChild(el);

  const label: SceneLabel = {
    setText(value) {
      if (el.textContent !== value) el.textContent = value;
      return label;
    },
    setVisible(visible) {
      el.style.display = visible ? '' : 'none';
      return label;
    },
    setPosition(x, y) {
      el.style.left = `${css(x)}px`;
      el.style.top = `${css(y)}px`;
      return label;
    },
    setFontSize(s) {
      size(s);
      return label;
    },
    setWordWrapWidth(width) {
      el.style.width = `${css(width)}px`;
      el.style.whiteSpace = 'pre-wrap';
      return label;
    },
  };
  return label;
}
