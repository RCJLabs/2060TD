import Phaser from 'phaser';
import { DomOverlay } from './dom/overlay';
import { domUi } from './dom/flag';
import type { Ink } from './ink';
import type { Layout, Rect } from './layout';
import { popModal, pushModal } from './modal';
import { COLORS } from './palette';
import { display, DRAG_SLOP, makeButton, mono, type Button } from './ui';

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
 * What every overlay can do, whichever kit draws it (M30).
 *
 * The canvas `Overlay` and the DOM one both implement this, and callers get
 * one from `createOverlay`, so a screen is written once and drawn by whichever
 * kit the flag names.
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
  /** Pass a scene's HUD container, or the board camera draws the overlay
   * a second time at board zoom. The DOM kit has no cameras and ignores it. */
  container?: Phaser.GameObjects.Container;
}

/** An overlay from whichever kit the flag names. */
export function createOverlay(scene: Phaser.Scene, layout: Layout, opts: OverlayOptions = {}): OverlayApi {
  if (domUi()) return new DomOverlay(scene, layout, opts);
  return new Overlay(scene, layout, opts);
}

/**
 * Full-screen overlays (briefings, research, logs, the faction pick) as one
 * responsive component: a scrim, a card sized to the viewport, a scrolling
 * body, and a fixed footer. Content is laid out by vertical flow rather than
 * hardcoded coordinates, so the same overlay reads on a phone and a monitor.
 */
export class Overlay implements OverlayApi {
  private readonly scene: Phaser.Scene;
  private readonly layout: Layout;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly buttons: Button[] = [];
  private readonly body: Phaser.GameObjects.Container;
  private readonly mask: Phaser.GameObjects.Graphics;
  private readonly depth: number;
  /** HUD container, when the scene splits board and HUD across cameras. */
  private readonly host: Phaser.GameObjects.Container | undefined;

  /** Content area for flowed rows (scrolls when it overflows). */
  readonly card: Rect;
  private cursor = 0;
  private scrollY = 0;
  private contentH = 0;
  /** `downTime` of the press that owns the current drag; -1 when idle. */
  private dragPress = -1;
  private dragMoved = 0;
  private lastY = 0;
  private velocity = 0;
  private fling = 0;
  private closed = false;
  private closeHandler?: () => void;

  constructor(scene: Phaser.Scene, layout: Layout, opts: OverlayOptions = {}) {
    this.scene = scene;
    this.layout = layout;
    this.depth = opts.depth ?? 60;
    this.host = opts.container;
    const { width, height, pad, font } = layout;

    // Phones use nearly the whole screen; wide screens get a centred card.
    const cardW = Math.min(width - pad * 2, layout.px(layout.compact ? 9999 : 760));
    const cardX = Math.round((width - cardW) / 2);
    const margin = layout.compact ? pad : layout.px(28);

    this.objects.push(
      this.own(
        scene.add
          .rectangle(0, 0, width, height, 0x000000, opts.scrim ?? 0.86)
          .setOrigin(0)
          .setDepth(this.depth)
          .setInteractive(), // swallow taps meant for the scene underneath
      ),
    );

    /**
     * The sheet the overlay is printed on.
     *
     * v1.19 did not need one: the scrim was dark, the type was cream, and an
     * overlay was a dark card on a darker screen. The ink direction inverts
     * the type, so without a paper ground behind it every briefing, report
     * and menu would be #111 on an 86% black scrim — invisible, and invisible
     * in a way no label-based harness can see, because the text objects are
     * all still there and still report their strings.
     *
     * It is also what the style wants anyway: the page dims and one panel
     * comes forward, inside the same heavy border every other panel has.
     */
    const sheetX = Math.max(0, cardX - pad);
    const sheetY = Math.max(0, margin - pad);
    this.objects.push(
      this.own(
        scene.add
          .rectangle(
            sheetX,
            sheetY,
            Math.min(width, cardW + pad * 2),
            Math.max(0, height - sheetY * 2),
            COLORS.bgField,
          )
          .setOrigin(0)
          .setStrokeStyle(Math.max(3, layout.px(2.5)), COLORS.oliveDark)
          .setDepth(this.depth),
      ),
    );

    /**
     * The masthead: a filled bar with the title knocked out of it.
     *
     * Every panel on this page already inverts to say "this one" — a chosen
     * row, an open tab, the primary action. A titled overlay is the same
     * statement at page scale, and it is also the one thing that stopped the
     * front door reading as a text document with three buttons on it.
     *
     * Created before the title so it sits under it, sized after, because its
     * height is whatever the title and subtitle actually measured.
     */
    const bar = opts.title
      ? scene.add
          .rectangle(sheetX, sheetY, Math.min(width, cardW + pad * 2), 0, COLORS.oliveDark)
          .setOrigin(0)
          .setDepth(this.depth)
      : undefined;
    if (bar) this.objects.push(this.own(bar));

    let y = margin;
    if (opts.title) {
      const title = scene.add
        .text(cardX + cardW / 2, y, opts.title, display(font.title, COLORS.bgField, { fontStyle: '800', align: 'center' }))
        .setOrigin(0.5, 0)
        .setDepth(this.depth + 1);
      this.objects.push(this.own(title));
      y += title.height + Math.round(pad * 0.6);
    }
    if (opts.subtitle) {
      const sub = scene.add
        .text(cardX + cardW / 2, y, opts.subtitle, {
          ...mono(font.tiny, bar ? COLORS.bgField : COLORS.inkDim, { align: 'center' }),
          wordWrap: { width: cardW },
        })
        .setOrigin(0.5, 0)
        .setDepth(this.depth + 1);
      this.objects.push(this.own(sub));
      y += sub.height + pad;
    }
    // The bar closes just above where the body starts, so the rule between
    // masthead and content is the bar's own edge rather than a second line.
    bar?.setSize(bar.width, Math.max(0, y - Math.round(pad * 0.5) - sheetY));

    const footerH = layout.rowH + pad * 2;
    this.card = { x: cardX, y, w: cardW, h: Math.max(layout.rowH, height - y - footerH - margin) };

    this.body = scene.add.container(0, 0).setDepth(this.depth + 1);
    this.mask = scene.make.graphics({});
    this.mask.fillStyle(0xffffff);
    this.mask.fillRect(this.card.x, this.card.y, this.card.w, this.card.h);
    this.body.setMask(this.mask.createGeometryMask());
    this.objects.push(this.own(this.body));

    this.bindScroll();
    pushModal();
    // A scene change can drop an overlay without anyone closing it; unwind
    // the modal count there rather than leaving the board deaf.
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.close());
    scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.close());
    // Content is flowed by the caller right after this returns; centre it
    // vertically on the next frame if it does not fill the card.
    scene.events.once(Phaser.Scenes.Events.POST_UPDATE, () => this.settle());
  }

  /**
   * Short content reads better centred than pinned under the subtitle — but
   * only up to a point.
   *
   * Half the slack is right on a phone, where a card is barely taller than
   * what is in it. On a monitor the slack can be most of the screen, and half
   * of THAT drops the content so far from the masthead that the two stop
   * reading as one composition: the front door came out as a black bar, a
   * field of white, and then some buttons. The cap keeps the centring where
   * it helps and stops it where it only makes a hole.
   */
  private settle(): void {
    if (this.closed) return;
    const slack = this.card.h - this.contentH;
    if (slack > this.layout.gap) {
      this.body.y += Math.min(Math.round(slack / 2), this.layout.rowH * 2);
    }
  }

  /** Adopt a loose object into the HUD container, when there is one. */
  private own<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.host?.add(object);
    return object;
  }

  /** Allocate the next horizontal band of the card. */
  flow(height: number, gapAfter = this.layout.gap): Rect {
    const rect = { x: this.card.x, y: this.card.y + this.cursor - this.scrollY, w: this.card.w, h: height };
    this.cursor += height + gapAfter;
    this.contentH = this.cursor;
    return rect;
  }

  /** Text inside the scrolling body. */
  text(
    rect: Rect,
    value: string,
    size: number,
    color = COLORS.ink,
    extra: TextExtra = {},
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(rect.x, rect.y, value, {
        ...mono(size, color, extra),
        wordWrap: { width: rect.w },
      })
      .setDepth(this.depth + 1);
    this.body.add(t);
    return t;
  }

  /** Centred text inside the scrolling body. */
  centered(
    rect: Rect,
    value: string,
    size: number,
    color = COLORS.ink,
    extra: TextExtra = {},
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(rect.x + rect.w / 2, rect.y, value, {
        ...mono(size, color, { align: 'center', ...extra }),
        wordWrap: { width: rect.w },
      })
      .setOrigin(0.5, 0)
      .setDepth(this.depth + 1);
    this.body.add(t);
    return t;
  }

  /**
   * A block of prose that flows by the height it ACTUALLY renders at.
   *
   * flow() reserves space up front, which only works when the caller can
   * count the lines — and wrapped text cannot be counted in advance. On a
   * narrow phone one logical line becomes three, the reservation is short by
   * two, and the next block draws straight over this one. Measuring after the
   * fact is the only honest way to lay out wrapped copy.
   */
  paragraph(
    value: string,
    size: number,
    color = COLORS.ink,
    opts: {
      gapAfter?: number;
      width?: number;
      minHeight?: number;
      center?: boolean;
      lineSpacing?: number;
    } = {},
  ): Phaser.GameObjects.Text {
    const width = opts.width ?? this.card.w;
    // A centred block narrower than the card is a column: centre the column
    // too. Left-aligned blocks stay pinned to the card edge, which is what a
    // list entry with a button beside it needs.
    const x = opts.center ? this.card.x + Math.round((this.card.w - width) / 2) : this.card.x;
    const rect = { x, y: this.card.y + this.cursor - this.scrollY, w: width, h: 0 };
    const extra = { lineSpacing: opts.lineSpacing ?? Math.round(size * 0.3) };
    const t = opts.center
      ? this.centered(rect, value, size, color, extra)
      : this.text(rect, value, size, color, extra);
    this.cursor += Math.max(t.height, opts.minHeight ?? 0) + (opts.gapAfter ?? this.layout.gap);
    this.contentH = this.cursor;
    return t;
  }

  /**
   * A bar chart inside the scrolling body: values already normalized to 0..1,
   * oldest first. Drawn rather than spelled out in block characters, because a
   * text sparkline is at the mercy of whichever monospace font the device
   * actually has — and this one has to read the same on a phone.
   *
   * The newest bar is drawn brighter: on a chart of a number that decays, the
   * question is always "where am I NOW against where I have been".
   */
  chart(
    values: number[],
    height: number,
    opts: { color?: number; latest?: number; gapAfter?: number } = {},
  ): Rect {
    const rect = this.flow(height, opts.gapAfter);
    const g = this.scene.add.graphics().setDepth(this.depth + 1);
    this.body.add(g);
    const base = rect.y + height;
    g.lineStyle(1, COLORS.inkDim, 0.35);
    g.lineBetween(rect.x, base + 0.5, rect.x + rect.w, base + 0.5);
    if (values.length === 0) return rect;
    // Bars are capped, not stretched to fill. A war two days old has two days
    // of standing, and a chart that spreads them across the whole card would
    // claim a month of history it does not have.
    const slot = Math.min(rect.w / values.length, this.layout.px(12));
    const bar = Math.max(1, Math.floor(slot) - 1);
    values.forEach((value, i) => {
      // Every sample gets at least a pixel: a day at zero standing is a day
      // that happened, and a gap would read as no data.
      const h = Math.max(1, Math.round(value * (height - 2)));
      const last = i === values.length - 1;
      g.fillStyle(last ? (opts.latest ?? COLORS.ink) : (opts.color ?? COLORS.olive), last ? 1 : 0.8);
      g.fillRect(Math.round(rect.x + i * slot), base - h, bar, h);
    });
    return rect;
  }

  /**
   * A band of the card the caller draws into directly.
   *
   * Every other method here spells something out; this one exists because a
   * card about a THING should show the thing. The Graphics is parented into
   * the scrolling body, so a silhouette scrolls and dies with the card, and
   * the callback gets the same (x, y, size) contract `PanelRow.icon` does —
   * one drawing function serves the row, the board and the card, which is
   * what keeps them from drifting into three different shapes.
   */
  sketch(
    size: number,
    draw: (g: Ink, x: number, y: number, size: number) => void,
    opts: { gapAfter?: number } = {},
  ): Rect {
    const rect = this.flow(size, opts.gapAfter);
    const g = this.scene.add.graphics().setDepth(this.depth + 1);
    this.body.add(g);
    draw(g, rect.x + Math.round((rect.w - size) / 2), rect.y, size);
    return rect;
  }

  /**
   * A full-width band of the card the caller draws into directly.
   *
   * `sketch` centres a SQUARE box, which is right for showing one thing and
   * wrong for a strip of them. This hands over the whole rect, so a caller
   * can lay out across the card and still get the scrolling, masking and
   * lifetime the body provides.
   */
  band(height: number, draw: (g: Ink, rect: Rect) => void, gapAfter?: number): Rect {
    const rect = this.flow(height, gapAfter);
    const g = this.scene.add.graphics().setDepth(this.depth + 1);
    this.body.add(g);
    draw(g, rect);
    return rect;
  }

  /** Button inside the scrolling body. */
  button(
    rect: Rect,
    label: string,
    onTap: () => void,
    opts: { align?: 'left' | 'center'; sub?: string } = {},
  ): Button {
    const b = makeButton(this.scene, rect.x, rect.y, rect.w, rect.h, label, onTap, {
      align: opts.align ?? 'center',
      ...(opts.sub !== undefined ? { sub: opts.sub } : {}),
      font: this.layout.font.body,
      container: this.body,
      edgeGrace: true,
    });
    b.bg.setDepth(this.depth + 1);
    b.label.setDepth(this.depth + 1);
    this.buttons.push(b);
    return b;
  }

  /**
   * A button that flows by the height it ACTUALLY renders at, wrapping its
   * label inside the card.
   *
   * Same argument as paragraph(), with more at stake. A block reserved by a
   * guessed line count is a block the next one draws over — and on a button
   * what gets overlapped is a tap target, not prose. Worse, an unwrapped
   * label centred in a box narrower than itself does not overflow politely:
   * it runs off BOTH edges of a phone, which is exactly what the faction
   * picker did to every name longer than "UNITED STATES".
   */
  flowButton(
    label: string,
    onTap: () => void,
    opts: {
      align?: 'left' | 'center';
      sub?: string;
      width?: number;
      gapAfter?: number;
      font?: number;
      /**
       * The thing this row IS, drawn into its left edge — same contract as
       * `PanelRow.icon`, so one drawing function serves the drawer, the board
       * and an overlay without three sets of shapes drifting apart.
       */
      icon?: (g: Ink, x: number, y: number, size: number) => void;
    } = {},
  ): Button {
    const size = opts.font ?? this.layout.font.body;
    const width = Math.min(this.card.w, opts.width ?? this.card.w);
    const x = this.card.x + Math.round((this.card.w - width) / 2);
    const y = this.card.y + this.cursor - this.scrollY;
    const b = this.button({ x, y, w: width, h: this.layout.rowH }, label, onTap, {
      align: opts.align ?? 'center',
      ...(opts.sub !== undefined ? { sub: opts.sub } : {}),
    });
    // Two passes, like the drawer: wrap first so the label reports the height
    // it will really draw at, then size the row around what it reported.
    const padX = Math.round(size * 1.1);
    const subW = b.subWidth();
    const box = opts.icon ? Math.round(this.layout.rowH * 0.72) : 0;
    const iconW = box > 0 ? box + padX : 0;
    b.setIndent(iconW);
    b.setWrap(Math.max(size * 4, width - padX * 2 - iconW - (subW > 0 ? subW + padX : 0)));
    const h = Math.max(this.layout.rowH, b.labelHeight() + Math.round(size * 1.1));
    b.setRect(x, y, width, h);
    if (opts.icon) {
      const g = this.scene.add.graphics().setDepth(this.depth + 1);
      this.body.add(g);
      opts.icon(g, x + padX, y + Math.round((h - box) / 2), box);
    }
    this.cursor += h + (opts.gapAfter ?? this.layout.gap);
    this.contentH = this.cursor;
    return b;
  }

  /** Button pinned below the card — always reachable, never scrolls away. */
  footer(label: string, onTap: () => void, index = 0, of = 1): Button {
    const { pad, rowH, width } = this.layout;
    const totalW = Math.min(width - pad * 2, this.card.w);
    const each = Math.floor((totalW - pad * (of - 1)) / of);
    const x = Math.round((width - totalW) / 2) + index * (each + pad);
    const y = this.card.y + this.card.h + pad;
    const b = makeButton(this.scene, x, y, each, rowH, label, onTap, {
      align: 'center',
      font: this.layout.font.body,
      // A footer is the bottom-most thing on a phone. A thumb pressing it
      // rolls; the press must survive that.
      edgeGrace: true,
      ...(this.host ? { container: this.host } : {}),
    });
    b.bg.setDepth(this.depth + 1);
    b.label.setDepth(this.depth + 1);
    this.buttons.push(b);
    return b;
  }

  private bindScroll(): void {
    const input = this.scene.input;
    const inCard = (p: Phaser.Input.Pointer): boolean =>
      p.x >= this.card.x &&
      p.x <= this.card.x + this.card.w &&
      p.y >= this.card.y &&
      p.y <= this.card.y + this.card.h;

    // A press that lands on one of the card's buttons stops the scene-level
    // pointer down/up from being emitted at all, so the drag is tracked from
    // what the pointer reports: a press this drag has not seen is a new
    // gesture, anchored on where the finger landed.
    const move = (p: Phaser.Input.Pointer): void => {
      if (this.closed) return;
      if (!p.isDown) {
        up();
        return;
      }
      if (this.dragPress !== p.downTime) {
        if (!inCard(p)) return;
        this.dragPress = p.downTime;
        this.dragMoved = 0;
        this.velocity = 0;
        this.fling = 0;
        this.lastY = p.downY;
      }
      const dy = p.y - this.lastY;
      this.lastY = p.y;
      this.dragMoved += Math.abs(dy);
      if (this.dragMoved <= Math.max(DRAG_SLOP, this.layout.px(6))) return;
      this.velocity = this.velocity * 0.6 + dy * 0.4;
      this.scrollBy(-dy);
    };
    const up = (): void => {
      if (this.dragPress < 0) return;
      this.dragPress = -1;
      this.fling = Math.abs(this.velocity) > 1 ? -this.velocity : 0;
      this.velocity = 0;
    };
    // The up is usually swallowed by whatever button sits under the thumb.
    const step = (): void => {
      if (this.closed) return;
      if (this.dragPress >= 0) {
        if (this.scene.input.activePointer.isDown) return;
        up();
      }
      if (Math.abs(this.fling) < 0.5) return;
      const before = this.scrollY;
      this.scrollBy(this.fling);
      this.fling = this.scrollY === before ? 0 : this.fling * 0.88;
    };
    const wheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => {
      if (this.closed || !inCard(p)) return;
      this.scrollBy(dy);
    };
    input.on(Phaser.Input.Events.POINTER_MOVE, move);
    input.on(Phaser.Input.Events.POINTER_UP, up);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
    input.on(Phaser.Input.Events.POINTER_WHEEL, wheel);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, step);
    this.closeHandler = () => {
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, step);
      input.off(Phaser.Input.Events.POINTER_MOVE, move);
      input.off(Phaser.Input.Events.POINTER_UP, up);
      input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, up);
      input.off(Phaser.Input.Events.POINTER_WHEEL, wheel);
    };
  }

  private scrollBy(delta: number): void {
    const max = Math.max(0, this.contentH - this.card.h);
    const next = Phaser.Math.Clamp(this.scrollY + delta, 0, max);
    if (next === this.scrollY) return;
    const shift = this.scrollY - next;
    this.scrollY = next;
    this.body.y += shift;
  }

  /** True when the content is taller than the card (a scroll hint is due). */
  get scrollable(): boolean {
    return this.contentH > this.card.h;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    popModal();
    this.closeHandler?.();
    for (const b of this.buttons) b.destroy();
    this.mask.destroy();
    for (const o of this.objects) o.destroy();
  }
}
