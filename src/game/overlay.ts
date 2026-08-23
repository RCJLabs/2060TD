import Phaser from 'phaser';
import type { Layout, Rect } from './layout';
import { popModal, pushModal } from './modal';
import { COLORS } from './palette';
import { DRAG_SLOP, makeButton, mono, type Button } from './ui';

/**
 * Full-screen overlays (briefings, research, logs, the faction pick) as one
 * responsive component: a scrim, a card sized to the viewport, a scrolling
 * body, and a fixed footer. Content is laid out by vertical flow rather than
 * hardcoded coordinates, so the same overlay reads on a phone and a monitor.
 */
export class Overlay {
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

  constructor(
    scene: Phaser.Scene,
    layout: Layout,
    opts: {
      title?: string;
      subtitle?: string;
      scrim?: number;
      depth?: number;
      /** Pass a scene's HUD container, or the board camera draws the overlay
       * a second time at board zoom. */
      container?: Phaser.GameObjects.Container;
    } = {},
  ) {
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

    let y = margin;
    if (opts.title) {
      const title = scene.add
        .text(cardX + cardW / 2, y, opts.title, mono(font.title, COLORS.ink, { fontStyle: 'bold', align: 'center' }))
        .setOrigin(0.5, 0)
        .setDepth(this.depth + 1);
      this.objects.push(this.own(title));
      y += title.height + Math.round(pad * 0.6);
    }
    if (opts.subtitle) {
      const sub = scene.add
        .text(cardX + cardW / 2, y, opts.subtitle, {
          ...mono(font.tiny, COLORS.inkDim, { align: 'center' }),
          wordWrap: { width: cardW },
        })
        .setOrigin(0.5, 0)
        .setDepth(this.depth + 1);
      this.objects.push(this.own(sub));
      y += sub.height + pad;
    }

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

  /** Short content reads better centred than pinned under the subtitle. */
  private settle(): void {
    if (this.closed) return;
    const slack = this.card.h - this.contentH;
    if (slack > this.layout.gap) this.body.y += Math.round(slack / 2);
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
    extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
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
    extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
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
    });
    b.bg.setDepth(this.depth + 1);
    b.label.setDepth(this.depth + 1);
    this.buttons.push(b);
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
