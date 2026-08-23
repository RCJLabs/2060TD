import Phaser from 'phaser';
import { audio } from './audio';
import { music } from './music';
import type { Layout } from './layout';
import { modalOpen } from './modal';
import { COLORS, css } from './palette';

/**
 * Touch-first UI kit (v0.9). Buttons take real thumb-sized rects and their
 * type comes from the layout tokens, so the same code renders a 27px desktop
 * row and a 44px phone row without a scale hack.
 */

export interface Button {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  setActive(active: boolean): void;
  setEnabled(enabled: boolean): void;
  setVisible(visible: boolean): void;
  setLabel(text: string): void;
  setSub(text: string): void;
  setRect(x: number, y: number, w: number, h: number): void;
  setFont(size: number): void;
  destroy(): void;
}

/** The terminal face. System monospace keeps the look with no web font. */
export const MONO_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';

export function mono(
  size: number,
  color: number = COLORS.ink,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: MONO_FAMILY, fontSize: `${Math.round(size)}px`, color: css(color), ...extra };
}

/** Travel (device px) past which a press counts as a drag, not a tap. */
export const DRAG_SLOP = 16;

export interface ButtonOptions {
  /** Font size in device px; defaults to a size derived from the height. */
  font?: number;
  align?: 'left' | 'center';
  /** Right-aligned secondary text (costs, counts). */
  sub?: string;
  /** Parent container — required when the scene partitions world vs UI. */
  container?: Phaser.GameObjects.Container;
  /** Suppress the click sound (tab strips click a lot). */
  quiet?: boolean;
}

/** A button as the headless harness sees it: label + rect in device px. */
export interface ButtonProbe {
  label: string;
  sub: string;
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
}

const liveProbes = new Set<() => ButtonProbe & { visible: boolean; dead: boolean }>();

/**
 * Every button currently on screen. The E2E harness taps by label instead of
 * by hard-coded pixels — the layout moves between phones, the labels don't.
 */
/**
 * Test seam: every visible string on screen, in draw order. Buttons are
 * addressable by label, but a report, a banner or an overlay body is not a
 * button — this is how the headless harness reads the copy the player reads.
 */
export function liveTexts(scenes: Phaser.Scene[]): string[] {
  const found: string[] = [];
  const walk = (items: Phaser.GameObjects.GameObject[]): void => {
    for (const item of items) {
      if (item instanceof Phaser.GameObjects.Container) {
        if (item.visible) walk(item.list);
        continue;
      }
      if (item instanceof Phaser.GameObjects.Text && item.visible && item.text.length > 0) {
        found.push(item.text);
      }
    }
  };
  for (const scene of scenes) walk(scene.children.list);
  return found;
}

/**
 * Every visible text with the rectangle it actually occupies, in device px.
 *
 * The seam exists because this project has now shipped the same bug twice:
 * a block laid out from a GUESSED line count, drawn over by the block after
 * it once the text wrapped. Labels alone cannot catch that — a harness has
 * to be able to ask where things landed.
 */
export function liveTextRects(
  scenes: Phaser.Scene[],
): { text: string; x: number; y: number; w: number; h: number; depth: number }[] {
  const found: { text: string; x: number; y: number; w: number; h: number; depth: number }[] = [];
  const walk = (items: Phaser.GameObjects.GameObject[]): void => {
    for (const item of items) {
      if (item instanceof Phaser.GameObjects.Container) {
        if (item.visible) walk(item.list);
        continue;
      }
      if (item instanceof Phaser.GameObjects.Text && item.visible && item.text.length > 0) {
        const b = item.getBounds();
        // Depth comes along so a harness can scope to the modal layer: an
        // overlay line and a panel row behind the scrim are not an overlap.
        found.push({ text: item.text, x: b.x, y: b.y, w: b.width, h: b.height, depth: item.depth });
      }
    }
  };
  for (const scene of scenes) walk(scene.children.list);
  return found;
}

export function liveButtons(): ButtonProbe[] {
  const out: ButtonProbe[] = [];
  for (const probe of liveProbes) {
    const { visible, dead, ...rest } = probe();
    // Scene restarts destroy buttons without going through destroy() — drop
    // those probes here so a stale rect is never reported as tappable.
    if (dead) liveProbes.delete(probe);
    else if (visible) out.push(rest);
  }
  return out;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Button {
  const align = opts.align ?? 'left';
  const fontSize = opts.font ?? Math.max(11, Math.round(height * 0.42));
  const padX = Math.round(height * 0.32);

  const bg = scene.add
    .rectangle(x, y, width, height, COLORS.bgField)
    .setOrigin(0, 0)
    .setStrokeStyle(1, COLORS.gridLine)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(align === 'center' ? x + width / 2 : x + padX, y + height / 2, text, mono(fontSize))
    .setOrigin(align === 'center' ? 0.5 : 0, 0.5);
  const sub =
    opts.sub !== undefined
      ? scene.add
          .text(x + width - padX, y + height / 2, opts.sub, mono(fontSize, COLORS.inkDim))
          .setOrigin(1, 0.5)
      : undefined;
  if (opts.container) {
    opts.container.add(bg);
    opts.container.add(label);
    if (sub) opts.container.add(sub);
  }

  let active = false;
  let enabled = true;
  let pressed = false;
  const alive = () => bg.active && label.active;
  const refresh = () => {
    // Pointer events can trail in after a click handler destroyed the button.
    if (!alive()) return;
    const fill = pressed ? COLORS.olive : active ? COLORS.oliveDark : COLORS.bgField;
    bg.setFillStyle(fill);
    bg.setStrokeStyle(1, active ? COLORS.olive : COLORS.gridLine);
    label.setColor(css(enabled ? COLORS.ink : COLORS.inkDim));
    sub?.setColor(css(enabled ? COLORS.inkDim : COLORS.gridLine));
  };

  bg.on('pointerover', () => {
    if (enabled && alive() && !pressed) bg.setFillStyle(active ? COLORS.olive : COLORS.gridLine);
  });
  bg.on('pointerout', () => {
    pressed = false;
    refresh();
  });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation();
    audio.unlock(); // first gesture wakes the audio context
    music.resume(); // …and the score, which asked before it was allowed
    if (!enabled) return;
    pressed = true; // visible press state matters more without a hover cursor
    refresh();
  });
  bg.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation();
    if (!enabled || !pressed) return;
    pressed = false;
    refresh();
    // A press that travelled was a scroll or a pan across this button, not a
    // tap on it — every list in the game is drag-scrollable.
    if (p.getDistance() > DRAG_SLOP) return;
    if (!opts.quiet) audio.sfx('click');
    onClick();
  });

  refresh();
  const probe = () => {
    // World-space bounds: scrolling containers move buttons without touching
    // their local x/y, and the harness taps where the finger would land.
    const box = bg.getBounds();
    return {
      label: label.text,
      sub: sub?.text ?? '',
      x: box.x,
      y: box.y,
      w: box.width,
      h: box.height,
      enabled,
      visible: bg.visible && bg.active,
      dead: bg.scene === undefined,
    };
  };
  liveProbes.add(probe);

  return {
    bg,
    label,
    ...(sub ? { sub } : {}),
    setActive(value: boolean) {
      if (active === value) return;
      active = value;
      refresh();
    },
    setEnabled(value: boolean) {
      if (enabled === value) return;
      enabled = value;
      refresh();
    },
    setVisible(visible: boolean) {
      bg.setVisible(visible);
      label.setVisible(visible);
      sub?.setVisible(visible);
      if (visible) refresh();
    },
    setLabel(value: string) {
      if (label.text !== value) label.setText(value);
    },
    setSub(value: string) {
      if (sub && sub.text !== value) sub.setText(value);
    },
    setRect(nx: number, ny: number, nw: number, nh: number) {
      bg.setPosition(nx, ny).setSize(nw, nh);
      const pad = Math.round(nh * 0.32);
      label.setPosition(align === 'center' ? nx + nw / 2 : nx + pad, ny + nh / 2);
      sub?.setPosition(nx + nw - pad, ny + nh / 2);
    },
    setFont(size: number) {
      label.setFontSize(size);
      sub?.setFontSize(size);
    },
    destroy() {
      liveProbes.delete(probe);
      bg.destroy();
      label.destroy();
      sub?.destroy();
    },
  };
}

// ---- the responsive panel -------------------------------------------------

export interface PanelRow {
  id: string;
  label: string;
  /** Right-aligned detail: cost, count, timer. */
  sub?: string;
  enabled?: boolean;
  active?: boolean;
  onTap?: () => void;
  /** A full-width heading instead of a button. */
  heading?: boolean;
}

export interface PanelTab {
  id: string;
  label: string;
}

/**
 * The panel: a right rail in landscape, a collapsible bottom drawer in
 * portrait. Rows are data — scenes hand over a fresh list each frame and the
 * panel diffs it against a pooled set of buttons, so scrolling, re-layout and
 * orientation flips need no bookkeeping from the caller.
 */
export class Panel {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly rowRoot: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly edge: Phaser.GameObjects.Rectangle;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly scrollHint: Phaser.GameObjects.Rectangle;
  private maskShape!: Phaser.GameObjects.Graphics;

  private tabButtons: Button[] = [];
  private pool: Button[] = [];
  /** What each pooled row slot currently does. */
  private taps: Array<(() => void) | undefined> = [];
  private headings: Phaser.GameObjects.Text[] = [];
  private rows: PanelRow[] = [];
  private layout!: Layout;
  private activeTab: string;
  private scrollY = 0;
  private contentH = 0;
  /** `downTime` of the press that owns the current drag; -1 when idle. */
  private dragPress = -1;
  private dragMoved = 0;
  private lastPointerY = 0;
  /** Smoothed finger speed, and the decaying flick it becomes on release. */
  private velocity = 0;
  private fling = 0;
  private onTabChange?: (id: string) => void;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    private readonly tabs: PanelTab[],
  ) {
    this.scene = scene;
    this.root = container;
    this.activeTab = tabs[0]?.id ?? '';

    this.bg = scene.add.rectangle(0, 0, 10, 10, COLORS.bgPanel).setOrigin(0, 0);
    this.edge = scene.add.rectangle(0, 0, 10, 2, COLORS.gridLine).setOrigin(0, 0);
    this.titleText = scene.add.text(0, 0, 'LAST LINE', mono(14, COLORS.ink, { fontStyle: 'bold' }));
    this.statusText = scene.add.text(0, 0, '', mono(11, COLORS.inkDim, { lineSpacing: 3 }));
    this.scrollHint = scene.add.rectangle(0, 0, 3, 30, COLORS.gridLine).setOrigin(0, 0).setAlpha(0.6);
    this.rowRoot = scene.add.container(0, 0);
    container.add([this.bg, this.edge, this.titleText, this.statusText, this.scrollHint, this.rowRoot]);

    this.bindScroll();
  }

  get tab(): string {
    return this.activeTab;
  }

  setTab(id: string): void {
    // Re-tapping the open tab collapses the drawer — the phone gesture that
    // hands the whole screen back to the battlefield.
    if (this.activeTab === id) {
      this.onDrawerToggle?.();
      return;
    }
    this.activeTab = id;
    this.scrollY = 0;
    for (const [i, t] of this.tabs.entries()) this.tabButtons[i]?.setActive(t.id === id);
    this.onTabChange?.(id);
  }

  onTab(handler: (id: string) => void): void {
    this.onTabChange = handler;
  }

  /** Portrait only: the active tab was tapped again. */
  onDrawerToggle?: () => void;

  /** Header line plus the status block under it. */
  setStatus(title: string, lines: string[]): void {
    // Monospace again: clip the headline to the columns the strip actually has.
    const room = this.layout
      ? Math.floor((this.layout.status.w - this.layout.pad * 2) / (this.layout.font.label * 0.62))
      : title.length;
    const clipped = title.length > room && room > 2 ? `${title.slice(0, room - 1)}…` : title;
    if (this.titleText.text !== clipped) this.titleText.setText(clipped);
    const body = lines.join('\n');
    if (this.statusText.text !== body) this.statusText.setText(body);
  }

  applyLayout(layout: Layout): void {
    this.layout = layout;
    const { panel, status, tabs, list, pad, font } = layout;

    this.bg.setPosition(panel.x, panel.y).setSize(panel.w, panel.h);
    if (layout.mode === 'portrait') {
      this.edge.setPosition(panel.x, panel.y).setSize(panel.w, Math.max(2, layout.px(1)));
    } else {
      this.edge.setPosition(panel.x, 0).setSize(Math.max(2, layout.px(1)), panel.h);
    }

    this.titleText.setPosition(status.x + pad, status.y + Math.round(pad * 0.6)).setFontSize(font.label);
    this.statusText
      .setPosition(status.x + pad, status.y + Math.round(pad * 0.6) + font.label + Math.round(pad * 0.4))
      .setFontSize(font.tiny);
    // Portrait keeps the status strip to one line; the rail can afford three.
    this.statusText.setVisible(layout.mode === 'landscape' || status.h > font.label * 3);

    // Tab strip: equal columns across the tab rect.
    const tabW = Math.floor((tabs.w - pad * 2 - layout.gap * (this.tabs.length - 1)) / this.tabs.length);
    for (const [i, t] of this.tabs.entries()) {
      const x = tabs.x + pad + i * (tabW + layout.gap);
      const y = tabs.y + Math.round(layout.gap / 2);
      const h = tabs.h - layout.gap;
      if (!this.tabButtons[i]) {
        const index = i;
        this.tabButtons[i] = makeButton(this.scene, x, y, tabW, h, t.label, () => this.setTab(this.tabs[index]!.id), {
          align: 'center',
          font: font.tiny,
          container: this.root,
          quiet: true,
        });
        this.tabButtons[i]!.setActive(t.id === this.activeTab);
      }
      this.tabButtons[i]!.setRect(x, y, tabW, h);
      this.tabButtons[i]!.setFont(font.tiny);
    }

    // Clip rows to the list area.
    this.maskShape?.destroy();
    this.maskShape = this.scene.make.graphics({});
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(list.x, list.y, list.w, list.h);
    this.rowRoot.setMask(this.maskShape.createGeometryMask());
    this.rowRoot.setPosition(0, 0);
    this.scrollHint.setSize(Math.max(3, layout.px(2)), 0);
    this.relayoutRows();
  }

  /** Replace the row list. Cheap to call every frame. */
  setRows(rows: PanelRow[]): void {
    this.rows = rows;
    this.relayoutRows();
  }

  private relayoutRows(): void {
    if (!this.layout) return;
    const { list, rowH, gap, pad, font, cols } = this.layout;
    const colW = Math.floor((list.w - pad * 2 - gap * (cols - 1)) / cols);

    let line = 0;
    let colIndex = 0;
    let poolIndex = 0;
    let headingIndex = 0;

    for (const row of this.rows) {
      if (row.heading) {
        if (colIndex !== 0) {
          line++;
          colIndex = 0;
        }
        const y = list.y + pad + line * (rowH + gap) - this.scrollY;
        let text = this.headings[headingIndex];
        if (!text) {
          text = this.scene.add.text(0, 0, '', mono(font.tiny, COLORS.inkDim));
          this.rowRoot.add(text);
          this.headings[headingIndex] = text;
        }
        text
          .setPosition(list.x + pad, y + rowH * 0.35)
          .setFontSize(font.tiny)
          .setVisible(y + rowH > list.y && y < list.y + list.h);
        if (text.text !== row.label) text.setText(row.label);
        headingIndex++;
        line++;
        continue;
      }

      const x = list.x + pad + colIndex * (colW + gap);
      const y = list.y + pad + line * (rowH + gap) - this.scrollY;
      let button = this.pool[poolIndex];
      if (!button) {
        const slot = poolIndex;
        button = makeButton(
          this.scene,
          x,
          y,
          colW,
          rowH,
          row.label,
          () => this.tapRow(slot),
          { font: font.body, sub: '', container: this.rowRoot },
        );
        this.pool[poolIndex] = button;
      }
      button.setRect(x, y, colW, rowH);
      button.setFont(font.body);
      // Monospace: char width tracks the font size, so the room left for the
      // label is arithmetic rather than a measure-and-reflow.
      const charW = font.body * 0.62;
      const padX = rowH * 0.32;
      const subChars = (row.sub ?? '').length;
      const room = Math.floor((colW - padX * 2 - subChars * charW - (subChars ? charW : 0)) / charW);
      button.setLabel(
        room > 2 && row.label.length > room ? `${row.label.slice(0, room - 1)}…` : row.label,
      );
      button.setSub(row.sub ?? '');
      button.setEnabled(row.enabled !== false);
      button.setActive(row.active === true);
      // The mask hides scrolled-away rows but does not un-tap them: a row
      // parked under the status strip would still take a press. Rows leave
      // the display when clear of the list, and stop taking input as soon as
      // their middle does.
      button.setVisible(y + rowH > list.y && y < list.y + list.h);
      const middle = y + rowH / 2;
      if (button.bg.input) {
        button.bg.input.enabled = middle >= list.y && middle <= list.y + list.h;
      }
      // Re-point the handler without rebuilding the button — the pool is
      // reused across tabs, so the row list owns what a slot does.
      this.taps[poolIndex] = row.onTap;
      poolIndex++;

      colIndex++;
      if (colIndex >= cols) {
        colIndex = 0;
        line++;
      }
    }
    if (colIndex !== 0) line++;

    for (let i = poolIndex; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
    for (let i = headingIndex; i < this.headings.length; i++) this.headings[i]!.setVisible(false);

    this.contentH = line * (rowH + gap) + pad * 2;
    this.clampScroll();
    this.updateScrollHint();
  }

  private clampScroll(): void {
    const max = Math.max(0, this.contentH - this.layout.list.h);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, max);
  }

  private updateScrollHint(): void {
    const { list } = this.layout;
    const max = Math.max(0, this.contentH - list.h);
    if (max <= 0) {
      this.scrollHint.setVisible(false);
      return;
    }
    const trackH = list.h - this.layout.pad * 2;
    const thumbH = Math.max(this.layout.px(24), (list.h / this.contentH) * trackH);
    const t = this.scrollY / max;
    this.scrollHint
      .setVisible(true)
      .setPosition(list.x + list.w - this.layout.px(5), list.y + this.layout.pad + t * (trackH - thumbH))
      .setSize(Math.max(3, this.layout.px(2)), thumbH);
  }

  private inList(pointer: Phaser.Input.Pointer): boolean {
    const { list } = this.layout ?? {};
    if (!list) return false;
    return (
      pointer.x >= list.x &&
      pointer.x <= list.x + list.w &&
      pointer.y >= list.y &&
      pointer.y <= list.y + list.h
    );
  }

  /** Run the action currently bound to a pooled row slot. */
  private tapRow(slot: number): void {
    this.taps[slot]?.();
  }

  /**
   * Drag-to-scroll, with a flick. The rows are interactive buttons, and a
   * button press stops Phaser emitting the scene-level pointer down/up at
   * all — so a drag both starts and ends from what the pointer itself
   * reports, never from an event a row can swallow. Without that, the up
   * that ends one swipe goes missing and the next touch is measured against
   * a stale anchor, which snaps the list across its whole range.
   */
  private bindScroll(): void {
    const input = this.scene.input;

    input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || modalOpen()) {
        this.releaseDrag();
        return;
      }
      if (this.dragPress !== pointer.downTime) {
        // A press this drag has not seen before: a new gesture starts here,
        // anchored on where the finger actually landed.
        if (!this.inList(pointer)) return;
        this.dragPress = pointer.downTime;
        this.dragMoved = 0;
        this.velocity = 0;
        this.fling = 0;
        this.lastPointerY = pointer.downY;
      }
      const dy = pointer.y - this.lastPointerY;
      this.lastPointerY = pointer.y;
      this.dragMoved += Math.abs(dy);
      // Hold off until the travel also cancels the row's tap, so a gesture is
      // unambiguously one or the other.
      if (this.dragMoved <= Math.max(DRAG_SLOP, this.layout?.px(6) ?? 6)) return;
      this.velocity = this.velocity * 0.6 + dy * 0.4;
      this.scrollBy(-dy);
    });

    const release = (): void => this.releaseDrag();
    input.on(Phaser.Input.Events.POINTER_UP, release);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (modalOpen() || !this.inList(pointer)) return;
        this.scrollBy(dy);
      },
    );

    // The up that ends a drag is usually swallowed by the row under the
    // thumb, so the release is detected here too — and the flick coasts.
    const step = (): void => this.stepScroll();
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, step);
    const stop = (): void => {
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, step);
    };
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, stop);
  }

  /** End the drag, handing whatever speed it had to the flick. */
  private releaseDrag(): void {
    if (this.dragPress < 0) return;
    this.dragPress = -1;
    this.fling = Math.abs(this.velocity) > 1 ? -this.velocity : 0;
    this.velocity = 0;
  }

  private stepScroll(): void {
    if (this.dragPress >= 0) {
      if (this.scene.input.activePointer.isDown) return;
      this.releaseDrag();
    }
    if (Math.abs(this.fling) < 0.5) return;
    const before = this.scrollY;
    this.scrollBy(this.fling);
    // Stop dead at the ends rather than grinding against the clamp.
    this.fling = this.scrollY === before ? 0 : this.fling * 0.88;
  }

  private scrollBy(delta: number): void {
    this.scrollY += delta;
    this.clampScroll();
    this.relayoutRows();
  }
}
