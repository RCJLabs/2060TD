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
  /** Wrap the label to this width in device px; null leaves it on one line. */
  setWrap(width: number | null): void;
  /** Measured height of the label block — what a wrapping list sizes rows by. */
  labelHeight(): number;
  /** Measured width of the sub, so a label can be wrapped clear of it. */
  subWidth(): number;
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
  /**
   * Accept a press that ends just off the button's edge (v1.17.2).
   *
   * Only for buttons with nothing behind them to scroll — overlay rows and
   * footers. A row inside the drawer must NOT take this, or a scroll drag that
   * happens to end in the gap between two rows would count as a tap on the row
   * it started from.
   */
  edgeGrace?: boolean;
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
  let fontSize = opts.font ?? Math.max(11, Math.round(height * 0.42));
  const padX = Math.round(fontSize * 1.1);

  const bg = scene.add
    .rectangle(x, y, width, height, COLORS.bgField)
    .setOrigin(0, 0)
    .setStrokeStyle(1, COLORS.gridLine)
    .setInteractive({ useHandCursor: true });
  // Origin is TOP-left, not middle-left: a label that wraps is a block of
  // unknown height, and a block is centred by measuring it, not by pinning
  // its middle to the row's middle and hoping it is one line tall.
  const label = scene.add
    .text(align === 'center' ? x + width / 2 : x + padX, y, text, mono(fontSize))
    .setOrigin(align === 'center' ? 0.5 : 0, 0);
  const sub =
    opts.sub !== undefined
      ? scene.add
          .text(x + width - padX, y, opts.sub, mono(fontSize, COLORS.inkDim))
          .setOrigin(1, 0)
      : undefined;
  /**
   * The rect the label is currently centred inside. A top-origin label has to
   * be placed by measuring, and it has to be RE-placed every time something
   * changes its height — a new label, a new font size, a new wrap width. The
   * button used to be centred only by setRect, which meant a button nobody
   * laid out again after construction (every overlay button: the menu, the
   * faction picker) drew its text flush against the top of its own box.
   */
  const rect = { x, y, w: width, h: height };
  const place = (): void => {
    const pad = Math.round(fontSize * 1.1);
    const top = rect.y + Math.max(0, Math.round((rect.h - label.height) / 2));
    label.setPosition(align === 'center' ? rect.x + rect.w / 2 : rect.x + pad, top);
    sub?.setPosition(rect.x + rect.w - pad, top);
  };
  place();
  if (opts.container) {
    opts.container.add(bg);
    opts.container.add(label);
    if (sub) opts.container.add(sub);
  }

  let active = false;
  let enabled = true;
  /** Painted as held down. Cleared as soon as the finger leaves the rect. */
  let pressed = false;
  /**
   * This button owns the pointer press that is currently down — which is NOT
   * the same as being painted pressed, and conflating the two is what ate the
   * tap. On touch, sliding off a button fires `pointerout`, which correctly
   * un-highlights it; the old code also threw away the fact that the press
   * had started here, so the release had nothing left to act on and the tap
   * vanished. Every button keeps the highlight and the ownership separate now.
   */
  let holding = false;
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
    // Un-highlight, but stay the owner of the press: a thumb that rolls off
    // the edge of the button it is holding has not changed its mind.
    if (!pressed) return;
    pressed = false;
    refresh();
  });
  bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation();
    audio.unlock(); // first gesture wakes the audio context
    music.resume(); // …and the score, which asked before it was allowed
    if (!enabled) return;
    holding = true;
    pressed = true; // visible press state matters more without a hover cursor
    refresh();
  });
  const release = (p: Phaser.Input.Pointer, outside: boolean): void => {
    if (!enabled || !holding) return;
    holding = false;
    if (pressed) {
      pressed = false;
      refresh();
    }
    // A press that travelled was a scroll or a pan across this button, not a
    // tap on it — every list in the game is drag-scrollable.
    if (p.getDistance() > DRAG_SLOP) {
      // …unless the finger simply rolled off the edge of the thing it is
      // holding down, on a button that has nothing behind it to scroll. A
      // footer sits one row tall at the bottom of a phone, which is exactly
      // where a thumb pivots: the press starts on the button, ends a few
      // millimetres past it, and used to be discarded in silence. Grace scales
      // with the button, so it means the same physical slack at any density.
      if (!outside || !opts.edgeGrace) return;
      const grace = bg.height;
      const box = bg.getBounds();
      const near =
        p.x >= box.x - grace &&
        p.x <= box.x + box.width + grace &&
        p.y >= box.y - grace &&
        p.y <= box.y + box.height + grace;
      if (!near || p.getDistance() > grace * 1.5) return;
    }
    if (!opts.quiet) audio.sfx('click');
    onClick();
  };
  bg.on('pointerup', (p: Phaser.Input.Pointer, _x: number, _y: number, ev?: Phaser.Types.Input.EventData) => {
    ev?.stopPropagation();
    release(p, false);
  });
  /**
   * A touch released OFF the button's own rectangle never reaches the object
   * at all — Phaser delivers per-object `pointerup` only while the pointer is
   * over the object, and `pointerout` does not fire for touch, which has no
   * hover. So the scene's own pointerup is the only place that release can be
   * seen, and until v1.17.2 nothing saw it: the button stayed painted in its
   * pressed state for good, having swallowed a tap that never happened. A
   * green button that does nothing is what a frozen game looks like.
   *
   * `pressed` is already false when the object's own handler ran, so this
   * cannot double-fire.
   */
  const sceneRelease = (p: Phaser.Input.Pointer): void => {
    if (holding && alive()) release(p, true);
  };
  const sceneCancel = (): void => {
    holding = false;
    if (!pressed) return;
    pressed = false;
    if (alive()) refresh();
  };
  scene.input.on('pointerup', sceneRelease);
  // Released outside the canvas entirely, or taken over by the browser.
  scene.input.on('pointerupoutside', sceneCancel);
  scene.input.on('gameout', sceneCancel);

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
      if (label.text === value) return;
      label.setText(value);
      place(); // a new label is a new height
    },
    setSub(value: string) {
      if (sub && sub.text !== value) sub.setText(value);
    },
    setRect(nx: number, ny: number, nw: number, nh: number) {
      bg.setPosition(nx, ny).setSize(nw, nh);
      rect.x = nx;
      rect.y = ny;
      rect.w = nw;
      rect.h = nh;
      // Pad comes from the FONT, not the row's own height: a three-line row
      // gets the same inset as a one-line one.
      place();
    },
    setFont(size: number) {
      if (fontSize === size) return;
      fontSize = size;
      label.setFontSize(size);
      sub?.setFontSize(size);
      place();
    },
    /**
     * Wrap the label inside `width` device px, or null to leave it on one
     * line. The height the label reports afterwards is what the caller sizes
     * the row from — measured, never predicted from a character count.
     */
    setWrap(width: number | null) {
      const wrap = label.style.wordWrapWidth ?? null;
      if (wrap === width) return;
      if (width === null) label.setWordWrapWidth(undefined as unknown as number);
      else label.setWordWrapWidth(width);
      place(); // wrapping changes the line count, which changes the height
    },
    /** Height of the label block as it currently renders. */
    labelHeight() {
      return label.height;
    },
    /** Width the sub takes, so the label can be wrapped clear of it. */
    subWidth() {
      return sub && sub.text.length > 0 ? sub.width : 0;
    },
    destroy() {
      liveProbes.delete(probe);
      scene.input.off('pointerup', sceneRelease);
      scene.input.off('pointerupoutside', sceneCancel);
      scene.input.off('gameout', sceneCancel);
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
    this.titleText = scene.add.text(0, 0, '2060TD', mono(14, COLORS.ink, { fontStyle: 'bold' }));
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

  /**
   * Lay the rows out, wrapping anything too long for its column (v1.13).
   *
   * Rows used to be one line each, truncated with an ellipsis worked out from
   * a monospace character width. That cost the game real copy: two systems
   * grew a second field just to keep a heading short, and four content tables
   * carry a 26-character cap enforced by tests. Wrapping retires all of it.
   *
   * Heights are MEASURED, in two passes. The first sets every label's text
   * and wrap width and reads back the height it actually renders at; the
   * second places the rows now that each line's tallest row is known. A
   * predicted height would be the same guess that put this project's overlay
   * bugs on screen twice — and here it would be worse, because a row that is
   * short by a line does not overlap prose, it overlaps a tap target.
   */
  private relayoutRows(): void {
    if (!this.layout) return;
    const { list, rowH, gap, pad, font, cols } = this.layout;
    const colW = Math.floor((list.w - pad * 2 - gap * (cols - 1)) / cols);
    const headingW = list.w - pad * 2;

    // ---- pass one: text in, height out --------------------------------------
    interface Placed {
      row: PanelRow;
      /** Pool slot for a button row, or heading slot for a heading. */
      slot: number;
      height: number;
    }
    const placed: Placed[] = [];
    let poolIndex = 0;
    let headingIndex = 0;

    for (const row of this.rows) {
      if (row.heading) {
        let text = this.headings[headingIndex];
        if (!text) {
          text = this.scene.add.text(0, 0, '', mono(font.tiny, COLORS.inkDim));
          this.rowRoot.add(text);
          this.headings[headingIndex] = text;
        }
        text.setFontSize(font.tiny);
        text.setWordWrapWidth(headingW);
        if (text.text !== row.label) text.setText(row.label);
        placed.push({
          row,
          slot: headingIndex,
          height: Math.max(rowH, text.height + Math.round(font.tiny * 0.7)),
        });
        headingIndex++;
        continue;
      }

      let button = this.pool[poolIndex];
      if (!button) {
        const slot = poolIndex;
        button = makeButton(this.scene, 0, 0, colW, rowH, row.label, () => this.tapRow(slot), {
          font: font.body,
          sub: '',
          container: this.rowRoot,
        });
        this.pool[poolIndex] = button;
      }
      button.setFont(font.body);
      button.setSub(row.sub ?? '');
      // The sub owns its corner for the whole block, not just the first line.
      // Wrapping the label under it would read as two columns that collide.
      const padX = Math.round(font.body * 1.1);
      const subW = button.subWidth();
      button.setWrap(Math.max(font.body * 4, colW - padX * 2 - (subW > 0 ? subW + padX : 0)));
      button.setLabel(row.label);
      button.setEnabled(row.enabled !== false);
      button.setActive(row.active === true);
      this.taps[poolIndex] = row.onTap;
      placed.push({
        row,
        slot: poolIndex,
        height: Math.max(rowH, button.labelHeight() + Math.round(font.body * 1.1)),
      });
      poolIndex++;
    }

    // ---- pass two: place, a line at a time ----------------------------------
    let y = list.y + pad - this.scrollY;
    let index = 0;
    while (index < placed.length) {
      const first = placed[index]!;
      // A heading always owns its line; buttons fill the columns.
      const span = first.row.heading
        ? [first]
        : placed.slice(index, index + cols).filter((p) => !p.row.heading);
      const lineH = Math.max(...span.map((p) => p.height));

      span.forEach((entry, col) => {
        if (entry.row.heading) {
          const text = this.headings[entry.slot]!;
          text
            .setPosition(list.x + pad, y + Math.round((lineH - text.height) / 2))
            .setVisible(y + lineH > list.y && y < list.y + list.h);
          return;
        }
        const button = this.pool[entry.slot]!;
        const x = list.x + pad + col * (colW + gap);
        button.setRect(x, y, colW, lineH);
        // The mask hides scrolled-away rows but does not un-tap them: a row
        // parked under the status strip would still take a press. Rows leave
        // the display when clear of the list, and stop taking input as soon
        // as their middle does.
        button.setVisible(y + lineH > list.y && y < list.y + list.h);
        const middle = y + lineH / 2;
        if (button.bg.input) {
          button.bg.input.enabled = middle >= list.y && middle <= list.y + list.h;
        }
      });

      y += lineH + gap;
      index += span.length;
    }

    for (let i = poolIndex; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
    for (let i = headingIndex; i < this.headings.length; i++) this.headings[i]!.setVisible(false);

    this.contentH = y - (list.y - this.scrollY) + pad - gap;
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
