import { DESTROY, POST_UPDATE, SHUTDOWN, type Scene } from '../stage';
import type { Ink } from '../ink';
import type { Layout, Rect } from '../layout';
import { popModal, pushModal } from '../modal';
import { COLORS, css as hex } from '../palette';
import { textSources, type TextRect } from '../seam';
import { DISPLAY_FAMILY, DISPLAY_SCALE, MONO_FAMILY } from '../tokens';
import { domButton, type DomButton } from './button';
import { inkCanvas } from './ink';
import { css, cssColor, cssRect, deviceRect, dpr, place, uiLayer } from './layer';

/** The styles a caller may add to overlay text: what the callers use, and no more. */
export interface TextExtra {
  lineSpacing?: number;
  align?: 'left' | 'center' | 'right';
  fontStyle?: string;
}

/** A block of overlay text, as a caller holds it: where it landed, and a way to change it. */
export interface OverlayText {
  readonly y: number;
  readonly height: number;
  setText(value: string): unknown;
}

/** An overlay button, as a caller holds it. */
export interface OverlayButton {
  setActive(active: boolean): void;
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  setLabel(text: string): void;
  setSub(text: string): void;
  setFont(size: number): void;
  destroy(): void;
}

/**
 * What a screen can do with an overlay (M30): the calls every briefing,
 * report, log and menu is built from, and nothing of how they are drawn.
 */
export interface OverlayApi {
  /** Content area for flowed rows, in device px. */
  readonly card: Rect;
  flow(height: number, gapAfter?: number): Rect;
  text(rect: Rect, value: string, size: number, color?: number, extra?: TextExtra): OverlayText;
  centered(rect: Rect, value: string, size: number, color?: number, extra?: TextExtra): OverlayText;
  paragraph(
    value: string,
    size: number,
    color?: number,
    opts?: { gapAfter?: number; width?: number; minHeight?: number; center?: boolean; lineSpacing?: number },
  ): OverlayText;
  chart(values: number[], height: number, opts?: { color?: number; latest?: number; gapAfter?: number }): Rect;
  sketch(size: number, draw: (g: Ink, x: number, y: number, size: number) => void, opts?: { gapAfter?: number }): Rect;
  band(height: number, draw: (g: Ink, rect: Rect) => void, gapAfter?: number): Rect;
  button(rect: Rect, label: string, onTap: () => void, opts?: { align?: 'left' | 'center'; sub?: string }): OverlayButton;
  flowButton(
    label: string,
    onTap: () => void,
    opts?: {
      align?: 'left' | 'center';
      sub?: string;
      width?: number;
      gapAfter?: number;
      font?: number;
      icon?: (g: Ink, x: number, y: number, size: number) => void;
    },
  ): OverlayButton;
  footer(label: string, onTap: () => void, index?: number, of?: number): OverlayButton;
  readonly scrollable: boolean;
  close(): void;
}

export interface OverlayOptions {
  title?: string;
  subtitle?: string;
  scrim?: number;
  depth?: number;
}

/** A full-screen overlay over this scene. */
export function createOverlay(scene: Scene, layout: Layout, opts: OverlayOptions = {}): OverlayApi {
  return new DomOverlay(scene, layout, opts);
}

/**
 * Full-screen overlays (briefings, research, logs, the faction pick) as one
 * responsive component (M30): a scrim, a card sized to the viewport, a
 * scrolling body and a fixed footer, drawn as elements over the canvas.
 *
 * Content is laid out by vertical flow rather than hardcoded coordinates, so
 * the same overlay reads on a phone and a monitor, and the positions a caller
 * is handed are device px like the rest of the layout: a caller that places a
 * button beside a paragraph reads the paragraph's `y`.
 *
 * It replaced a canvas overlay with the same API and geometry, and what
 * changed is everything that kit had to build by hand. The body scrolls
 * natively, with the platform's own momentum and overscroll, so the drag, the
 * fling and the wheel handler are gone. Text is real text a screen reader can
 * reach. And a press on a button is the browser's.
 */
export class DomOverlay implements OverlayApi {
  private readonly layout: Layout;
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly buttons: DomButton[] = [];
  private readonly depth: number;
  private readonly texts: () => TextRect[];

  readonly card: Rect;
  private cursor = 0;
  private contentH = 0;
  private closed = false;

  constructor(scene: Scene, layout: Layout, opts: OverlayOptions = {}) {
    this.layout = layout;
    this.depth = opts.depth ?? 60;
    const { width, height, pad, font } = layout;

    // Phones use nearly the whole screen; wide screens get a centred card.
    const cardW = Math.min(width - pad * 2, layout.px(layout.compact ? 9999 : 760));
    const cardX = Math.round((width - cardW) / 2);
    const margin = layout.compact ? pad : layout.px(28);

    // The scrim is the root: it covers the canvas and takes every press that
    // misses the card, which is what swallowing taps meant on the canvas.
    this.root = document.createElement('div');
    this.root.dataset['ui'] = 'overlay';
    this.root.style.cssText = `position:fixed;pointer-events:auto;z-index:${this.depth};touch-action:none`;
    this.root.style.background = cssColor(0x000000, opts.scrim ?? 0.86);
    place(this.root, cssRect({ x: 0, y: 0, w: width, h: height }));
    uiLayer().appendChild(this.root);

    const at = (el: HTMLElement, rect: Rect): HTMLElement => {
      el.style.position = 'absolute';
      el.style.left = `${css(rect.x)}px`;
      el.style.top = `${css(rect.y)}px`;
      el.style.width = `${css(rect.w)}px`;
      el.style.height = `${css(rect.h)}px`;
      this.root.appendChild(el);
      return el;
    };

    // The sheet the overlay is printed on: the page under the card, a pad wider.
    const sheetX = Math.max(0, cardX - pad);
    const sheetY = Math.max(0, margin - pad);
    const sheetW = Math.min(width, cardW + pad * 2);
    const sheet = at(document.createElement('div'), {
      x: sheetX,
      y: sheetY,
      w: sheetW,
      h: Math.max(0, height - sheetY * 2),
    });
    sheet.style.boxSizing = 'border-box';
    sheet.style.background = hex(COLORS.bgField);
    sheet.style.border = `${css(Math.max(3, layout.px(2.5)))}px solid ${hex(COLORS.oliveDark)}`;

    // The masthead: a filled bar with the title knocked out of it, sized
    // after the title and subtitle have been measured.
    const bar = opts.title ? at(document.createElement('div'), { x: sheetX, y: sheetY, w: sheetW, h: 0 }) : null;
    if (bar) bar.style.background = hex(COLORS.oliveDark);

    let y = margin;
    const heading = (value: string, size: number, color: number, face: 'display' | 'mono'): number => {
      const el = document.createElement('div');
      const text = document.createElement('span');
      text.dataset['text'] = '';
      text.textContent = value;
      el.appendChild(text);
      el.style.cssText = [
        'position:absolute',
        `left:${css(cardX)}px`,
        `top:${css(y)}px`,
        `width:${css(cardW)}px`,
        'text-align:center',
        'white-space:pre-wrap',
        `color:${hex(color)}`,
        face === 'display'
          ? `font-family:${DISPLAY_FAMILY};font-weight:800;font-size:${css(Math.round(size * DISPLAY_SCALE))}px`
          : `font-family:${MONO_FAMILY};font-size:${css(size)}px`,
      ].join(';');
      this.root.appendChild(el);
      return el.getBoundingClientRect().height * dpr();
    };
    if (opts.title) y += heading(opts.title, font.title, COLORS.bgField, 'display') + Math.round(pad * 0.6);
    if (opts.subtitle) y += heading(opts.subtitle, font.tiny, bar ? COLORS.bgField : COLORS.inkDim, 'mono') + pad;
    if (bar) bar.style.height = `${css(Math.max(0, y - Math.round(pad * 0.5) - sheetY))}px`;

    const footerH = layout.rowH + pad * 2;
    this.card = { x: cardX, y, w: cardW, h: Math.max(layout.rowH, height - y - footerH - margin) };

    this.body = at(document.createElement('div'), this.card) as HTMLDivElement;
    this.body.style.overflowX = 'hidden';
    this.body.style.overflowY = 'auto';
    this.body.style.overscrollBehavior = 'contain';
    this.body.style.touchAction = 'pan-y';
    this.body.style.scrollbarWidth = 'none';
    this.content = document.createElement('div');
    this.content.style.cssText = 'position:relative;width:100%';
    this.body.appendChild(this.content);

    this.texts = () => {
      if (this.closed) return [];
      const out: TextRect[] = [];
      for (const el of this.root.querySelectorAll<HTMLElement>('[data-text]')) {
        const text = el.textContent ?? '';
        if (text.length === 0 || el.offsetParent === null) continue;
        out.push({ text, ...deviceRect(el), depth: this.depth + 1, onBoard: false });
      }
      return out;
    };
    textSources.add(this.texts);

    pushModal();
    // A scene change can drop an overlay without anyone closing it.
    scene.events.once(SHUTDOWN, () => this.close());
    scene.events.once(DESTROY, () => this.close());
    // Content is flowed by the caller right after this returns; centre it
    // vertically on the next frame if it does not fill the card.
    scene.events.once(POST_UPDATE, () => this.settle());
  }

  /** See `Overlay.settle`: centre short content, but not by more than two rows. */
  private settle(): void {
    if (this.closed) return;
    const slack = this.card.h - this.contentH;
    if (slack > this.layout.gap) {
      this.content.style.top = `${css(Math.min(Math.round(slack / 2), this.layout.rowH * 2))}px`;
    }
  }

  /** Grow the scrolling content to hold everything flowed into it. */
  private grow(): void {
    this.content.style.height = `${css(this.contentH)}px`;
  }

  /** A child of the scrolling body, at a device-px rect in the card's frame. */
  private inBody<T extends HTMLElement>(el: T, rect: Rect, height = true): T {
    el.style.position = 'absolute';
    el.style.left = `${css(rect.x - this.card.x)}px`;
    el.style.top = `${css(rect.y - this.card.y)}px`;
    el.style.width = `${css(rect.w)}px`;
    if (height) el.style.height = `${css(rect.h)}px`;
    this.content.appendChild(el);
    return el;
  }

  flow(height: number, gapAfter = this.layout.gap): Rect {
    const rect = { x: this.card.x, y: this.card.y + this.cursor, w: this.card.w, h: height };
    this.cursor += height + gapAfter;
    this.contentH = this.cursor;
    this.grow();
    return rect;
  }

  private block(rect: Rect, value: string, size: number, color: number, extra: TextExtra, align: string): OverlayText {
    const el = document.createElement('div');
    const text = document.createElement('span');
    text.dataset['text'] = '';
    text.textContent = value;
    el.appendChild(text);
    const lineSpacing = extra.lineSpacing ?? 0;
    el.style.cssText = [
      `font-family:${MONO_FAMILY}`,
      `font-size:${css(size)}px`,
      `line-height:${css(Math.round(size * 1.2) + lineSpacing)}px`,
      `color:${hex(color)}`,
      `text-align:${extra.align ?? align}`,
      'white-space:pre-wrap',
      'overflow-wrap:anywhere',
      extra.fontStyle ? `font-weight:${extra.fontStyle === 'bold' ? 700 : extra.fontStyle}` : '',
    ].join(';');
    this.inBody(el, rect, false);
    const y = rect.y;
    return {
      y,
      get height() {
        return el.getBoundingClientRect().height * dpr();
      },
      setText(next: string) {
        text.textContent = next;
        return this;
      },
    };
  }

  text(rect: Rect, value: string, size: number, color = COLORS.ink, extra: TextExtra = {}): OverlayText {
    return this.block(rect, value, size, color, extra, 'left');
  }

  centered(rect: Rect, value: string, size: number, color = COLORS.ink, extra: TextExtra = {}): OverlayText {
    return this.block(rect, value, size, color, extra, 'center');
  }

  /** See `Overlay.paragraph`: flows by the height the text ACTUALLY renders at. */
  paragraph(
    value: string,
    size: number,
    color = COLORS.ink,
    opts: { gapAfter?: number; width?: number; minHeight?: number; center?: boolean; lineSpacing?: number } = {},
  ): OverlayText {
    const width = opts.width ?? this.card.w;
    const x = opts.center ? this.card.x + Math.round((this.card.w - width) / 2) : this.card.x;
    const rect = { x, y: this.card.y + this.cursor, w: width, h: 0 };
    const extra = { lineSpacing: opts.lineSpacing ?? Math.round(size * 0.3) };
    const t = opts.center ? this.centered(rect, value, size, color, extra) : this.text(rect, value, size, color, extra);
    this.cursor += Math.max(t.height, opts.minHeight ?? 0) + (opts.gapAfter ?? this.layout.gap);
    this.contentH = this.cursor;
    this.grow();
    return t;
  }

  /**
   * A canvas in the body for a caller to draw into, with a margin all round
   * so a stroke on the edge of the box is not cut in half by the canvas edge.
   */
  private drawing(rect: Rect, draw: (ink: Ink, margin: number) => void): void {
    const margin = Math.max(2, Math.round(Math.min(rect.w, rect.h) * 0.08));
    const { canvas, ink } = inkCanvas(rect.w + margin * 2, rect.h + margin * 2, dpr());
    canvas.style.pointerEvents = 'none';
    this.inBody(canvas, { x: rect.x - margin, y: rect.y - margin, w: rect.w + margin * 2, h: rect.h + margin * 2 });
    draw(ink, margin);
  }

  /** See `Overlay.chart`. */
  chart(values: number[], height: number, opts: { color?: number; latest?: number; gapAfter?: number } = {}): Rect {
    const rect = this.flow(height, opts.gapAfter);
    this.drawing(rect, (g, m) => {
      const base = m + height;
      g.lineStyle(1, COLORS.inkDim, 0.35);
      g.lineBetween(m, base + 0.5, m + rect.w, base + 0.5);
      if (values.length === 0) return;
      const slot = Math.min(rect.w / values.length, this.layout.px(12));
      const bar = Math.max(1, Math.floor(slot) - 1);
      values.forEach((value, i) => {
        const h = Math.max(1, Math.round(value * (height - 2)));
        const last = i === values.length - 1;
        g.fillStyle(last ? (opts.latest ?? COLORS.ink) : (opts.color ?? COLORS.olive), last ? 1 : 0.8);
        g.fillRect(Math.round(m + i * slot), base - h, bar, h);
      });
    });
    return rect;
  }

  /** See `Overlay.sketch`. */
  sketch(size: number, draw: (g: Ink, x: number, y: number, size: number) => void, opts: { gapAfter?: number } = {}): Rect {
    const rect = this.flow(size, opts.gapAfter);
    const box = { x: rect.x + Math.round((rect.w - size) / 2), y: rect.y, w: size, h: size };
    this.drawing(box, (g, m) => draw(g, m, m, size));
    return rect;
  }

  /** See `Overlay.band`. */
  band(height: number, draw: (g: Ink, rect: Rect) => void, gapAfter?: number): Rect {
    const rect = this.flow(height, gapAfter);
    this.drawing(rect, (g, m) => draw(g, { x: m, y: m, w: rect.w, h: height }));
    return rect;
  }

  private makeButton(
    host: HTMLElement,
    rect: Rect,
    label: string,
    onTap: () => void,
    opts: { align?: 'left' | 'center'; sub?: string },
    inBody: boolean,
  ): DomButton {
    const b = domButton(host, label, onTap, {
      align: opts.align ?? 'center',
      ...(opts.sub !== undefined ? { sub: opts.sub } : {}),
      font: this.layout.font.body,
      edgeGrace: true,
      ...(inBody ? { clipTo: this.body } : {}),
    });
    if (inBody) b.setRect(rect.x - this.card.x, rect.y - this.card.y, rect.w, rect.h);
    else b.setRect(rect.x, rect.y, rect.w, rect.h);
    this.buttons.push(b);
    return b;
  }

  /** Button inside the scrolling body. */
  button(rect: Rect, label: string, onTap: () => void, opts: { align?: 'left' | 'center'; sub?: string } = {}): OverlayButton {
    return this.makeButton(this.content, rect, label, onTap, opts, true);
  }

  /** See `Overlay.flowButton`: flows by the height its wrapped label renders at. */
  flowButton(
    label: string,
    onTap: () => void,
    opts: {
      align?: 'left' | 'center';
      sub?: string;
      width?: number;
      gapAfter?: number;
      font?: number;
      icon?: (g: Ink, x: number, y: number, size: number) => void;
    } = {},
  ): OverlayButton {
    const size = opts.font ?? this.layout.font.body;
    const width = Math.min(this.card.w, opts.width ?? this.card.w);
    const x = this.card.x + Math.round((this.card.w - width) / 2);
    const y = this.card.y + this.cursor;
    const b = this.makeButton(this.content, { x, y, w: width, h: this.layout.rowH }, label, onTap, {
      align: opts.align ?? 'center',
      ...(opts.sub !== undefined ? { sub: opts.sub } : {}),
    }, true);
    const padX = Math.round(size * 1.1);
    const subW = b.subWidth();
    const box = opts.icon ? Math.round(this.layout.rowH * 0.72) : 0;
    const iconW = box > 0 ? box + padX : 0;
    b.setIndent(iconW);
    b.setWrap(Math.max(size * 4, width - padX * 2 - iconW - (subW > 0 ? subW + padX : 0)));
    const h = Math.max(this.layout.rowH, b.labelHeight() + Math.round(size * 1.1));
    b.setRect(x - this.card.x, y - this.card.y, width, h);
    if (opts.icon) {
      // Inside the button, so the icon is part of what a finger presses.
      const margin = Math.max(2, Math.round(box * 0.08));
      const { canvas, ink } = inkCanvas(box + margin * 2, box + margin * 2, dpr());
      canvas.style.cssText += `;position:absolute;pointer-events:none;left:${css(padX - margin)}px;top:${css(
        Math.round((h - box) / 2) - margin,
      )}px`;
      b.el.appendChild(canvas);
      opts.icon(ink, margin, margin, box);
    }
    this.cursor += h + (opts.gapAfter ?? this.layout.gap);
    this.contentH = this.cursor;
    this.grow();
    return b;
  }

  /** Button pinned below the card — always reachable, never scrolls away. */
  footer(label: string, onTap: () => void, index = 0, of = 1): OverlayButton {
    const { pad, rowH, width } = this.layout;
    const totalW = Math.min(width - pad * 2, this.card.w);
    const each = Math.floor((totalW - pad * (of - 1)) / of);
    const x = Math.round((width - totalW) / 2) + index * (each + pad);
    const y = this.card.y + this.card.h + pad;
    const b = this.makeButton(this.root, { x, y, w: each, h: rowH }, label, onTap, { align: 'center' }, false);
    // A footer has nothing behind it to scroll, so a vertical drag is not a pan.
    b.el.style.touchAction = 'manipulation';
    return b;
  }

  /** True when the content is taller than the card (a scroll hint is due). */
  get scrollable(): boolean {
    return this.contentH > this.card.h;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    popModal();
    textSources.delete(this.texts);
    for (const b of this.buttons) b.destroy();
    this.root.remove();
  }
}
