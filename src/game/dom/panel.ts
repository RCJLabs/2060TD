import Phaser from 'phaser';
import { haptic } from '../haptics';
import { DRAWER_FULL, snapDrawer, type DrawerState, type Layout } from '../layout';
import { COLORS, css as hex } from '../palette';
import type { CarryPointer, PanelApi, PanelRow, PanelTab } from '../rows';
import { panelProbes, textSources, type PanelProbe, type TextRect } from '../seam';
import { DISPLAY_FAMILY, DISPLAY_SCALE, DRAG_SLOP, MONO_FAMILY } from '../tokens';
import { domButton, type DomButton } from './button';
import { CanvasInk } from './ink';
import { css, cssRect, deviceRect, devicePoint, dpr, place, uiLayer } from './layer';

/** The panel border weight, as the button draws it. */
const EDGE = 2;

interface Heading {
  el: HTMLDivElement;
  text: HTMLSpanElement;
  rule: HTMLDivElement;
}

interface Slot {
  button: DomButton;
  /** The silhouette's box inside the row: what a finger lands on to carry it. */
  grab: HTMLDivElement;
  canvas: HTMLCanvasElement;
  ink: CanvasInk;
  /** What the icon was last drawn for, so an unchanged row is not redrawn. */
  drawn: string;
}

/**
 * The panel, in the DOM (M30): the rail in landscape, the drawer in portrait.
 *
 * `Panel`'s geometry from the same `Layout`, and its rows from the same data,
 * so a scene hands this the rows it hands the canvas panel. The list scrolls
 * natively: the platform's own momentum, its own overscroll, and its own
 * rule that a finger put down on a coasting list stops it. Most of what the
 * canvas panel spends six hundred lines on is that.
 *
 * What the browser does NOT do, and this does by hand:
 *
 * - **A finger that stops a coast is spent.** The browser stops the list and
 *   still delivers the press to the row under the finger; the row that slid
 *   there is not the row anybody was reaching for.
 * - **A sideways swipe in portrait changes tab**, decided once per press.
 * - **A drag that starts on a row's silhouette carries it onto the board.**
 *   The silhouette opts out of native scrolling, so its drags come here; while
 *   the finger is still in the list it scrolls it by hand, and once it leaves
 *   toward the board the row's `onPick` gets a `CarryPointer` the board can
 *   follow — the board would otherwise never hear a touch that began on a DOM
 *   row move again.
 * - **The handle** drags the drawer, and a tap on it toggles.
 *
 * Rows are handed over every frame and diffed. The two-pass layout — wrap and
 * measure, then place — only runs when something a row shows has changed, and
 * an icon is only redrawn when its row has.
 */
export class DomPanel implements PanelApi, PanelProbe {
  onDrawerToggle?: () => void;
  onDrawerShare?: (share: DrawerState) => void;

  private readonly scene: Phaser.Scene;
  private readonly tabs: PanelTab[];
  private readonly root: HTMLDivElement;
  private readonly bgTop: HTMLDivElement;
  private readonly bgBottom: HTMLDivElement;
  private readonly statusBg: HTMLDivElement;
  private readonly edge: HTMLDivElement;
  private readonly handle: HTMLDivElement;
  private readonly grip: HTMLDivElement;
  private readonly title: HTMLSpanElement;
  private readonly status: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly texts: () => TextRect[];

  private tabButtons: DomButton[] = [];
  private slots: Slot[] = [];
  private headings: Heading[] = [];
  private taps: Array<(() => void) | undefined> = [];
  private holds: Array<(() => void) | undefined> = [];
  private picks: Array<((pointer: CarryPointer) => boolean) | undefined> = [];
  private rows: PanelRow[] = [];
  private layout: Layout | null = null;
  private activeTab: string;
  /** What the rows looked like when they were last laid out. */
  private signature = '';
  private dead = false;

  /** Scroll bookkeeping, for the probe and for catching a coast. */
  private lastScrollTop = 0;
  private fling = 0;
  /** When the list last moved with no finger on it: a coast, however brief. */
  private coastAt = -Infinity;
  private fingers = new Set<number>();

  /** The press this panel is judging: which way it is going, and from where. */
  private press: {
    id: number;
    x: number;
    y: number;
    lastY: number;
    axis: 'none' | 'x' | 'y';
    mouse: boolean;
    /** Landed on a silhouette, which the browser does not scroll for. */
    grabbed: boolean;
    /** The row slot to offer the carry to, or -1 once offered (or never). */
    pick: number;
    downTime: number;
  } | null = null;
  /** A carry in progress: the board's handlers for the press it adopted. */
  private carry: { id: number; move: (x: number, y: number) => void; up: (x: number, y: number) => void } | null =
    null;
  private handlePress: { id: number; y: number; from: number } | null = null;

  constructor(scene: Phaser.Scene, _container: unknown, tabs: PanelTab[]) {
    this.scene = scene;
    this.tabs = tabs;
    this.activeTab = tabs[0]?.id ?? '';

    this.root = document.createElement('div');
    this.root.dataset['ui'] = 'panel';
    this.root.style.cssText = 'position:fixed;pointer-events:none;z-index:20';
    uiLayer().appendChild(this.root);

    const div = (css: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;${css}`;
      this.root.appendChild(el);
      return el;
    };
    // The ground, in two pieces with the primary band left open between them:
    // until the scenes' free buttons move to the DOM (1d), the band's CONFIRM
    // and LAUNCH are drawn on the canvas beneath, and a solid sheet would
    // cover them.
    this.bgTop = div(`pointer-events:auto;background:${hex(COLORS.bgPanel)}`);
    this.bgBottom = div(`pointer-events:auto;background:${hex(COLORS.bgPanel)}`);
    this.statusBg = div(`pointer-events:auto;background:${hex(COLORS.bgPanel)}`);
    this.edge = div(`background:${hex(COLORS.oliveDark)}`);
    this.handle = div(`pointer-events:auto;touch-action:none;cursor:grab;background:${hex(COLORS.bgPanel)}`);
    this.grip = document.createElement('div');
    this.grip.style.cssText = `position:absolute;background:${hex(COLORS.oliveDark)}`;
    this.handle.appendChild(this.grip);

    const titleBox = div('white-space:nowrap;overflow:hidden');
    this.title = document.createElement('span');
    this.title.dataset['text'] = '';
    this.title.style.cssText = `font-family:${DISPLAY_FAMILY};font-weight:800;color:${hex(COLORS.ink)}`;
    this.title.textContent = '2060TD';
    titleBox.appendChild(this.title);
    this.titleBox = titleBox;
    this.status = div(`font-family:${MONO_FAMILY};white-space:pre;color:${hex(COLORS.ink)}`);
    this.status.dataset['text'] = '';

    this.list = div(
      'pointer-events:auto;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;' +
        'touch-action:pan-y;scrollbar-width:none',
    );
    this.content = document.createElement('div');
    this.content.style.cssText = 'position:relative;width:100%';
    this.list.appendChild(this.content);
    this.hint = div(`background:${hex(COLORS.oliveDark)};opacity:0.6;display:none`);

    this.bindHandle();
    this.bindList();

    this.texts = () => (this.dead || !this.layout ? [] : this.visibleTexts());
    textSources.add(this.texts);
    panelProbes.add(this);

    const step = (): void => this.step();
    scene.events.on(Phaser.Scenes.Events.UPDATE, step);
    const stop = (): void => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, step);
      this.destroy();
    };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    scene.events.once(Phaser.Scenes.Events.DESTROY, stop);
  }

  private readonly titleBox: HTMLDivElement;

  // ---- the probe, for the harness -------------------------------------------

  liveLayout(): Layout | null {
    return !this.dead && this.scene.sys.isActive() ? this.layout : null;
  }

  probe(): { scrollY: number; max: number; fling: number; rect: { x: number; y: number; w: number; h: number } } | null {
    if (this.dead || !this.scene.sys.isActive() || !this.layout) return null;
    const d = dpr();
    return {
      scrollY: this.list.scrollTop * d,
      max: Math.max(0, this.list.scrollHeight - this.list.clientHeight) * d,
      fling: this.fling,
      rect: { ...this.layout.list },
    };
  }

  get tab(): string {
    return this.activeTab;
  }

  setTab(id: string): void {
    // Re-tapping the open tab collapses the drawer.
    if (this.activeTab === id) {
      this.onDrawerToggle?.();
      return;
    }
    this.activeTab = id;
    this.list.scrollTop = 0;
    for (const [i, t] of this.tabs.entries()) this.tabButtons[i]?.setActive(t.id === id);
  }

  setStatus(title: string, lines: string[]): void {
    const l = this.layout;
    // Monospace: clip the headline to the columns the strip actually has.
    const room = l ? Math.floor((l.status.w - l.pad * 2) / (l.font.label * 0.62)) : title.length;
    const clipped = title.length > room && room > 2 ? `${title.slice(0, room - 1)}…` : title;
    if (this.title.textContent !== clipped) this.title.textContent = clipped;
    const body = lines.join('\n');
    if (this.status.textContent !== body) this.status.textContent = body;
  }

  applyLayout(layout: Layout): void {
    this.layout = layout;
    const { panel, status, tabs, list, handle, primary, pad, font } = layout;
    place(this.root, cssRect({ x: 0, y: 0, w: layout.width, h: layout.height }));
    const at = (el: HTMLElement, x: number, y: number, w: number, h: number): void => {
      el.style.left = `${css(x)}px`;
      el.style.top = `${css(y)}px`;
      el.style.width = `${css(Math.max(0, w))}px`;
      el.style.height = `${css(Math.max(0, h))}px`;
    };

    if (primary.h > 0) {
      at(this.bgTop, panel.x, panel.y, panel.w, primary.y - panel.y);
      at(this.bgBottom, panel.x, primary.y + primary.h, panel.w, panel.y + panel.h - primary.y - primary.h);
      this.bgBottom.style.display = '';
    } else {
      at(this.bgTop, panel.x, panel.y, panel.w, panel.h);
      this.bgBottom.style.display = 'none';
    }
    at(this.statusBg, status.x, status.y, status.w, status.h);

    const grabbable = handle.w > 0 && handle.h > 0;
    this.handle.style.display = grabbable ? '' : 'none';
    at(this.handle, handle.x, handle.y, handle.w, handle.h);
    const gripW = Math.min(handle.w * 0.25, layout.px(44));
    const gripH = Math.max(2, layout.px(4));
    at(this.grip, (handle.w - gripW) / 2, (handle.h - gripH) / 2, gripW, gripH);
    const rule = Math.max(3, layout.px(2.5));
    if (layout.mode === 'portrait') at(this.edge, panel.x, panel.y, panel.w, rule);
    else at(this.edge, panel.x, 0, rule, panel.h);

    const top = status.y + Math.round(pad * 0.6);
    at(this.titleBox, status.x + pad, top, status.w - pad * 2, Math.round(font.label * DISPLAY_SCALE * 1.3));
    this.title.style.fontSize = `${css(Math.round(font.label * DISPLAY_SCALE))}px`;
    at(this.status, status.x + pad, top + font.label + Math.round(pad * 0.4), status.w - pad * 2, status.h);
    this.status.style.fontSize = `${css(font.tiny)}px`;
    this.status.style.lineHeight = `${css(Math.round(font.tiny * 1.2) + 3)}px`;
    // Portrait keeps the status strip to one line; the rail can afford three.
    this.status.style.display = layout.mode === 'landscape' || status.h > font.label * 3 ? '' : 'none';

    // Tab strip: equal columns across the tab rect.
    const tabW = Math.floor((tabs.w - pad * 2 - layout.gap * (this.tabs.length - 1)) / this.tabs.length);
    for (const [i, t] of this.tabs.entries()) {
      const x = tabs.x + pad + i * (tabW + layout.gap);
      const y = tabs.y + Math.round(layout.gap / 2);
      if (!this.tabButtons[i]) {
        const index = i;
        const b = domButton(this.root, t.label, () => this.setTab(this.tabs[index]!.id), {
          align: 'center',
          font: font.tiny,
          quiet: true,
        });
        b.setActive(t.id === this.activeTab);
        b.el.style.touchAction = 'manipulation';
        this.tabButtons[i] = b;
      }
      this.tabButtons[i]!.setRect(x, y, tabW, tabs.h - layout.gap);
      this.tabButtons[i]!.setFont(font.tiny);
    }

    at(this.list, list.x, list.y, list.w, list.h);
    this.signature = ''; // a new geometry is a new layout, whatever the rows say
    this.relayout();
  }

  setRows(rows: PanelRow[]): void {
    this.rows = rows;
    this.relayout();
  }

  // ---- the rows -------------------------------------------------------------

  /** Everything a row SHOWS. The callbacks change every frame and do not count. */
  private rowsSignature(): string {
    let sig = this.activeTab;
    for (const r of this.rows) {
      sig += `\u0001${r.id}\u0002${r.label}\u0002${r.sub ?? ''}\u0002${r.enabled === false ? 0 : 1}${r.active ? 1 : 0}${
        r.heading ? 1 : 0
      }${r.icon ? 1 : 0}${r.onPick ? 1 : 0}`;
    }
    return sig;
  }

  private heading(i: number): Heading {
    let h = this.headings[i];
    if (!h) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;white-space:normal';
      const text = document.createElement('span');
      text.dataset['text'] = '';
      text.style.cssText = `font-family:${DISPLAY_FAMILY};font-weight:600;color:${hex(COLORS.ink)}`;
      el.appendChild(text);
      const rule = document.createElement('div');
      rule.style.cssText = `position:absolute;background:${hex(COLORS.oliveDark)}`;
      this.content.appendChild(el);
      this.content.appendChild(rule);
      h = { el, text, rule };
      this.headings[i] = h;
    }
    return h;
  }

  private slot(i: number, font: number): Slot {
    let s = this.slots[i];
    if (!s) {
      const button = domButton(this.content, '', () => this.taps[i]?.(), {
        font,
        sub: '',
        onHold: () => this.holds[i]?.(),
        clipTo: this.list,
      });
      const grab = document.createElement('div');
      // The silhouette opts out of native scrolling, so a drag that starts on
      // it reaches `bindList` instead of the browser. See the class comment.
      grab.style.cssText = 'position:absolute;left:0;top:0;height:100%;touch-action:none;display:none';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;pointer-events:none';
      grab.appendChild(canvas);
      button.el.appendChild(grab);
      grab.addEventListener('pointerdown', () => {
        if (!this.press) return;
        this.press.grabbed = true;
        if (this.picks[i]) this.press.pick = i;
      });
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      s = { button, grab, canvas, ink: new CanvasInk(ctx), drawn: '' };
      this.slots[i] = s;
    }
    return s;
  }

  /**
   * Lay the rows out: wrap and measure, then place a line at a time. See
   * `Panel.relayoutRows` for why heights are measured and never predicted.
   */
  private relayout(): void {
    const l = this.layout;
    if (!l || this.dead) return;
    const sig = this.rowsSignature();
    // Rows change every frame as far as identity goes; what they SHOW rarely
    // does. The callbacks are rebound either way.
    let slotIndex = 0;
    for (const row of this.rows) {
      if (row.heading) continue;
      this.taps[slotIndex] = row.onTap;
      this.holds[slotIndex] = row.onHold;
      this.picks[slotIndex] = row.onPick;
      slotIndex++;
    }
    if (sig === this.signature) return;
    this.signature = sig;

    const { list, rowH, gap, pad, font, cols } = l;
    const colW = Math.floor((list.w - pad * 2 - gap * (cols - 1)) / cols);
    const headingW = list.w - pad * 2;

    // ---- pass one: text in, height out ----
    const placed: { row: PanelRow; slot: number; height: number }[] = [];
    let s = 0;
    let h = 0;
    for (const row of this.rows) {
      if (row.heading) {
        const head = this.heading(h);
        head.text.style.fontSize = `${css(Math.round(font.tiny * DISPLAY_SCALE))}px`;
        head.text.style.letterSpacing = `${css(1.4)}px`;
        head.el.style.width = `${css(headingW)}px`;
        head.el.style.display = '';
        const label = row.sub ? `${row.label} · ${row.sub}` : row.label;
        if (head.text.textContent !== label) head.text.textContent = label;
        const textH = head.text.getBoundingClientRect().height * dpr();
        placed.push({ row, slot: h, height: Math.max(rowH, textH + Math.round(font.tiny * 0.7)) });
        h++;
        continue;
      }
      const slot = this.slot(s, font.body);
      const b = slot.button;
      b.setFont(font.body);
      b.setSub(row.sub ?? '');
      const padX = Math.round(font.body * 1.1);
      const subW = b.subWidth();
      const iconW = row.icon ? Math.round(rowH * 0.72) + pad : 0;
      b.setIndent(iconW);
      b.setWrap(Math.max(font.body * 4, colW - padX * 2 - iconW - (subW > 0 ? subW + padX : 0)));
      b.setLabel(row.label);
      b.setEnabled(row.enabled !== false);
      b.setActive(row.active === true);
      b.setVisible(true);
      placed.push({ row, slot: s, height: Math.max(rowH, b.labelHeight() + Math.round(font.body * 1.1)) });
      s++;
    }

    // ---- pass two: place, a line at a time ----
    let y = pad;
    let index = 0;
    while (index < placed.length) {
      const first = placed[index]!;
      const span = first.row.heading ? [first] : placed.slice(index, index + cols).filter((p) => !p.row.heading);
      const lineH = Math.max(...span.map((p) => p.height));
      span.forEach((entry, col) => {
        if (entry.row.heading) {
          const head = this.headings[entry.slot]!;
          const box = head.text.getBoundingClientRect();
          const textH = box.height * dpr();
          const textW = box.width * dpr();
          const top = y + Math.round((lineH - textH) / 2);
          head.el.style.left = `${css(pad)}px`;
          head.el.style.top = `${css(top)}px`;
          const from = pad + textW + gap;
          const to = list.w - pad;
          const wrapped = textH > font.tiny * DISPLAY_SCALE * 1.6;
          const ruleH = Math.max(2, Math.round(font.tiny * 0.14));
          head.rule.style.left = `${css(from)}px`;
          head.rule.style.top = `${css(top + Math.round(textH / 2) - 1)}px`;
          head.rule.style.width = `${css(Math.max(0, to - from))}px`;
          head.rule.style.height = `${css(ruleH)}px`;
          head.rule.style.display = !wrapped && to - from > font.tiny * 1.5 ? '' : 'none';
          return;
        }
        const slot = this.slots[entry.slot]!;
        const x = pad + col * (colW + gap);
        slot.button.setRect(x, y, colW, lineH);
        this.drawIcon(slot, entry.row, lineH, rowH, pad);
      });
      y += lineH + gap;
      index += span.length;
    }

    for (let i = s; i < this.slots.length; i++) this.slots[i]!.button.setVisible(false);
    for (let i = h; i < this.headings.length; i++) {
      this.headings[i]!.el.style.display = 'none';
      this.headings[i]!.rule.style.display = 'none';
    }
    const contentH = y + pad - gap;
    this.content.style.height = `${css(contentH)}px`;
    this.updateHint();
  }

  /** The row's silhouette, redrawn only when the row it shows has changed. */
  private drawIcon(slot: Slot, row: PanelRow, lineH: number, rowH: number, pad: number): void {
    if (!row.icon) {
      slot.grab.style.display = 'none';
      slot.drawn = '';
      return;
    }
    const box = Math.round(Math.min(lineH, rowH) * 0.72);
    const margin = Math.max(2, Math.round(box * 0.08));
    const size = box + margin * 2;
    // The grab area is the silhouette plus its padding, full row height: the
    // drawn glyph is a picture, not a target.
    slot.grab.style.display = '';
    slot.grab.style.width = `${css(box + pad * 2 - EDGE)}px`;
    slot.grab.style.touchAction = row.onPick ? 'none' : 'pan-y';
    const left = pad - EDGE - margin;
    const top = Math.round((lineH - box) / 2) - EDGE - margin;
    slot.canvas.style.left = `${css(left)}px`;
    slot.canvas.style.top = `${css(top)}px`;
    const key = `${row.id}|${row.label}|${row.sub ?? ''}|${row.enabled === false ? 0 : 1}|${row.active ? 1 : 0}|${box}`;
    if (slot.drawn === key) return;
    slot.drawn = key;
    if (slot.canvas.width !== size || slot.canvas.height !== size) {
      slot.canvas.width = size;
      slot.canvas.height = size;
      slot.canvas.style.width = `${css(size)}px`;
      slot.canvas.style.height = `${css(size)}px`;
    }
    slot.ink.clear();
    row.icon(slot.ink, margin, margin, box, row.active === true);
  }

  private updateHint(): void {
    const l = this.layout;
    if (!l) return;
    const { list } = l;
    const d = dpr();
    const contentH = this.list.scrollHeight * d;
    const max = contentH - list.h;
    if (max <= 1) {
      this.hint.style.display = 'none';
      return;
    }
    const trackH = list.h - l.pad * 2;
    const thumbH = Math.max(l.px(24), (list.h / contentH) * trackH);
    const t = Math.min(1, (this.list.scrollTop * d) / max);
    this.hint.style.display = '';
    this.hint.style.left = `${css(list.x + list.w - l.px(5))}px`;
    this.hint.style.top = `${css(list.y + l.pad + t * (trackH - thumbH))}px`;
    this.hint.style.width = `${css(Math.max(3, l.px(2)))}px`;
    this.hint.style.height = `${css(thumbH)}px`;
  }

  // ---- gestures ---------------------------------------------------------------

  private bindHandle(): void {
    const room = (): number => {
      const l = this.layout;
      if (!l || l.mode !== 'portrait') return 0;
      return Math.max(1, l.height - l.safe.top - l.safe.bottom);
    };
    const share = (): number => {
      const l = this.layout;
      return l && l.mode === 'portrait' ? l.drawerH / room() : 0;
    };
    this.handle.addEventListener('pointerdown', (e) => {
      if (!this.layout || this.layout.mode !== 'portrait') return;
      e.preventDefault();
      try {
        this.handle.setPointerCapture(e.pointerId);
      } catch {
        // Released wherever it lands either way.
      }
      this.handlePress = { id: e.pointerId, y: e.clientY, from: share() };
      haptic('tap');
    });
    this.handle.addEventListener('pointermove', (e) => {
      const p = this.handlePress;
      if (!p || p.id !== e.pointerId) return;
      const r = room();
      if (r <= 0) return;
      // Up is a bigger drawer: the handle moves with the finger.
      const moved = (p.from * r - (e.clientY - p.y) * dpr()) / r;
      this.onDrawerShare?.(Math.min(DRAWER_FULL, Math.max(0, moved)));
    });
    const release = (e: PointerEvent): void => {
      const p = this.handlePress;
      if (!p || p.id !== e.pointerId) return;
      this.handlePress = null;
      const travelled = Math.abs(e.clientY - p.y) * dpr();
      // A press that never moved is a tap, and a tap on the handle toggles.
      if (travelled <= DRAG_SLOP) {
        this.onDrawerToggle?.();
        return;
      }
      const r = room();
      const at = r > 0 ? p.from - ((e.clientY - p.y) * dpr()) / r : p.from;
      this.onDrawerShare?.(snapDrawer(Math.min(DRAWER_FULL, Math.max(0, at)), this.layout?.rest ?? 0));
      haptic('tap');
    };
    this.handle.addEventListener('pointerup', release);
    this.handle.addEventListener('pointercancel', release);
  }

  private bindList(): void {
    const list = this.list;
    list.addEventListener('scroll', () => this.updateHint(), { passive: true });

    // Capture phase: this sees every press in the list before the row does.
    list.addEventListener(
      'pointerdown',
      (e) => {
        // A finger on a coasting list stops it — the browser does that — and
        // is spent doing so. The row never hears the press.
        //
        // "Coasting" is read from the recent past, not the present: the
        // browser stops the coast the instant the touch arrives, before the
        // page sees the press, and a frame can pass in between. Reading the
        // live speed saw a list already at rest, and the finger that caught a
        // flick on BARRACKS armed it.
        const coasting =
          this.fling > 0.5 || (this.fingers.size === 0 && performance.now() - this.coastAt < 120);
        if (e.pointerType !== 'mouse') this.fingers.add(e.pointerId);
        if (coasting) {
          this.fling = 0;
          e.stopPropagation();
          this.press = null;
          return;
        }
        this.press = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          lastY: e.clientY,
          axis: 'none',
          mouse: e.pointerType === 'mouse',
          grabbed: false,
          pick: -1,
          downTime: performance.now(),
        };
      },
      { capture: true },
    );

    list.addEventListener('pointermove', (e) => {
      const carry = this.carry;
      if (carry && carry.id === e.pointerId) {
        const at = devicePoint(e.clientX, e.clientY);
        carry.move(at.x, at.y);
        return;
      }
      const p = this.press;
      if (!p || p.id !== e.pointerId || !this.layout) return;
      const d = dpr();
      const dy = e.clientY - p.lastY;
      p.lastY = e.clientY;
      const slop = Math.max(DRAG_SLOP, this.layout.px(6));
      if (p.axis === 'none') {
        const totalX = Math.abs(e.clientX - p.x) * d;
        const totalY = Math.abs(e.clientY - p.y) * d;
        if (Math.max(totalX, totalY) <= slop) return;
        // Sideways only means "next tab" in portrait; in landscape a sideways
        // drag across the rail is a drag onto the map.
        const sideways = this.layout.mode === 'portrait' && totalX > totalY * 1.4 && !p.grabbed;
        p.axis = sideways ? 'x' : 'y';
      }
      if (p.axis === 'x') return;
      // Carried out of the list and onto the map: offered once the finger has
      // actually LEFT the list on the board's side.
      if (p.pick >= 0 && this.towardBoard(e)) {
        const pick = this.picks[p.pick];
        const slot = this.slots[p.pick];
        p.pick = -1;
        if (pick) {
          const at = devicePoint(e.clientX, e.clientY);
          const board: { move?: (x: number, y: number) => void; up?: (x: number, y: number) => void } = {};
          const pointer: CarryPointer = {
            x: at.x,
            y: at.y,
            downTime: p.downTime,
            isDown: true,
            follow: (move, up) => {
              board.move = move;
              board.up = up;
            },
          };
          if (pick(pointer)) {
            // Ownership MOVES: the row's press is spent, the list stops, and
            // every later move of this finger is the board's.
            slot?.button.cancelPress();
            this.press = null;
            if (board.move && board.up) this.carry = { id: e.pointerId, move: board.move, up: board.up };
            return;
          }
        }
      }
      // A drag the browser is not scrolling for us: a mouse, or a press that
      // started on a silhouette (which opts out of native scrolling). While
      // the finger is still in the list a carry is a scroll, so a pick-up that
      // changes its mind costs a few px of scroll and nothing else.
      if (p.mouse || p.grabbed) list.scrollTop -= dy;
    });

    const end = (e: PointerEvent): void => {
      this.fingers.delete(e.pointerId);
      const carry = this.carry;
      if (carry && carry.id === e.pointerId) {
        this.carry = null;
        const at = devicePoint(e.clientX, e.clientY);
        carry.up(at.x, at.y);
        return;
      }
      const p = this.press;
      if (!p || p.id !== e.pointerId || !this.layout) return;
      this.press = null;
      if (p.axis !== 'x' || e.type === 'pointercancel') return;
      const swipe = (e.clientX - p.x) * dpr();
      const far = Math.max(this.layout.px(48), this.layout.list.w * 0.14);
      if (Math.abs(swipe) >= far) this.stepTab(swipe < 0 ? 1 : -1);
    };
    list.addEventListener('pointerup', end);
    list.addEventListener('pointercancel', end);
  }

  /** Has the finger left the list on the side the board is on? */
  private towardBoard(e: PointerEvent): boolean {
    const l = this.layout;
    if (!l) return false;
    const at = devicePoint(e.clientX, e.clientY);
    return l.mode === 'portrait' ? at.y < l.list.y : at.x < l.list.x;
  }

  /** Move `by` tabs along the strip, clamped at the ends (see `Panel.stepTab`). */
  private stepTab(by: number): void {
    const at = this.tabs.findIndex((t) => t.id === this.activeTab);
    if (at < 0) return;
    const next = Math.min(this.tabs.length - 1, Math.max(0, at + by));
    if (next === at) return;
    this.setTab(this.tabs[next]!.id);
    haptic('tap');
  }

  /** Per frame: how fast the list is coasting, for the probe and the catch. */
  private step(): void {
    const top = this.list.scrollTop;
    const moved = Math.abs(top - this.lastScrollTop) * dpr();
    this.lastScrollTop = top;
    this.fling = this.fingers.size === 0 && !this.press ? moved : 0;
    if (this.fling > 0.5) this.coastAt = performance.now();
  }

  /** Every panel text a player can see: the list's only while inside the list. */
  private visibleTexts(): TextRect[] {
    const out: TextRect[] = [];
    const clip = deviceRect(this.list);
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-text]')) {
      const text = el.textContent ?? '';
      if (text.length === 0 || el.offsetParent === null) continue;
      const r = deviceRect(el);
      if (this.list.contains(el) && (r.y + r.h <= clip.y || r.y >= clip.y + clip.h)) continue;
      out.push({ text, ...r, depth: 0, onBoard: false });
    }
    return out;
  }

  private destroy(): void {
    if (this.dead) return;
    this.dead = true;
    textSources.delete(this.texts);
    panelProbes.delete(this);
    for (const b of this.tabButtons) b.destroy();
    for (const s of this.slots) s.button.destroy();
    this.root.remove();
  }
}
