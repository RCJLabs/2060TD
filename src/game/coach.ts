import type Phaser from 'phaser';
import { CoachRunner, type CoachState, type CoachStep } from '../content/tutorial';
import { css as cssPx, cssColor, sceneHost } from './dom/layer';
import type { Layout } from './layout';
import { COLORS, css } from './palette';
import { MONO_FAMILY } from './tokens';

/** Where the plate goes and how it is set, in device px. */
interface PlateBox {
  x: number;
  y: number;
  w: number;
  pad: number;
  size: number;
  lineSpacing: number;
}

/** The plate: it sizes itself around its text. */
interface Plate {
  setText(text: string): void;
  place(box: PlateBox): void;
  retire(): void;
  destroy(): void;
}

/** One element, sized by its own text, and real text to read. */
function makePlate(scene: Phaser.Scene, onTap: () => void): Plate {
  const plate = document.createElement('div');
  plate.dataset['text'] = '';
  plate.dataset['ui'] = 'coach';
  plate.style.cssText = [
    'position:absolute',
    'box-sizing:border-box',
    'pointer-events:auto',
    'cursor:pointer',
    'white-space:pre-wrap',
    'text-align:center',
    `font-family:${MONO_FAMILY}`,
    `background:${cssColor(COLORS.bgPanel, 0.92)}`,
  ].join(';');
  // No compatibility mouse events off a touch on the plate: the plate may be
  // gone by the time they land, and the board is underneath it.
  plate.addEventListener('pointerdown', (e) => e.preventDefault());
  plate.addEventListener('pointerup', () => onTap());
  // The scene's host reports the plate's line to the harness.
  sceneHost(scene).appendChild(plate);
  return {
    setText(value) {
      plate.textContent = value;
    },
    place({ x, y, w, pad, size, lineSpacing }) {
      plate.style.left = `${cssPx(x)}px`;
      plate.style.top = `${cssPx(y)}px`;
      plate.style.width = `${cssPx(w)}px`;
      plate.style.padding = `${cssPx(pad)}px`;
      plate.style.fontSize = `${cssPx(size)}px`;
      plate.style.lineHeight = `${cssPx(Math.round(size * 1.2) + lineSpacing)}px`;
      plate.style.color = css(COLORS.signal);
      plate.style.border = `${cssPx(1)}px solid ${css(COLORS.signal)}`;
    },
    retire() {
      plate.style.display = 'none';
    },
    destroy() {
      plate.remove();
    },
  };
}

/**
 * The in-battle coach: one line at a time, on a plate over the board.
 *
 * All the timing rules live in CoachRunner (content/tutorial.ts), which is
 * pure and tested. This is only the plate: where it sits, what it says, and
 * turning a tap into "I have read it".
 */
export class Coach {
  private readonly runner: CoachRunner;
  private readonly plate: Plate;
  /** The tab the current step asked for, until someone takes it. */
  private pendingTab: string | null = null;

  constructor(
    scene: Phaser.Scene,
    private layout: Layout,
    script: CoachStep[],
  ) {
    this.runner = new CoachRunner(script);
    this.plate = makePlate(scene, () => this.runner.skipDwell());
    this.showStep();
  }

  get done(): boolean {
    return this.runner.done;
  }

  /** The panel tab this step wants opened, once. */
  takeTab(): string | null {
    const tab = this.pendingTab;
    this.pendingTab = null;
    return tab;
  }

  /** Advance the script; true while the simulation should be held. */
  update(state: CoachState, dtSeconds: number): boolean {
    if (this.runner.done) return false;
    const { hold, changed } = this.runner.update(state, dtSeconds);
    if (changed) this.showStep();
    return hold;
  }

  applyLayout(layout: Layout): void {
    this.layout = layout;
    this.place();
  }

  private showStep(): void {
    const step = this.runner.step;
    if (!step) {
      this.retire();
      return;
    }
    this.pendingTab = step.tab ?? null;
    this.plate.setText(step.text);
    this.place();
  }

  private place(): void {
    if (this.runner.done) return;
    const { board, pad, font } = this.layout;
    const w = Math.min(board.w - pad * 2, this.layout.px(520));
    this.plate.place({
      x: board.x + Math.round((board.w - w) / 2),
      y: board.y + pad,
      w,
      pad,
      size: font.tiny,
      lineSpacing: Math.round(font.tiny * 0.45),
    });
  }

  private retire(): void {
    this.plate.retire();
  }

  destroy(): void {
    this.retire();
    this.plate.destroy();
  }
}
