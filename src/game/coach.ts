import Phaser from 'phaser';
import { CoachRunner, type CoachState, type CoachStep } from '../content/tutorial';
import type { Layout } from './layout';
import { COLORS, css } from './palette';
import { mono } from './ui';

/**
 * The in-battle coach: one line at a time, on a plate over the board.
 *
 * All the timing rules live in CoachRunner (content/tutorial.ts), which is
 * pure and tested. This is only the plate: where it sits, what it says, and
 * turning a tap into "I have read it".
 */
export class Coach {
  private readonly runner: CoachRunner;
  private readonly plate: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  /** The tab the current step asked for, until someone takes it. */
  private pendingTab: string | null = null;

  constructor(
    scene: Phaser.Scene,
    private layout: Layout,
    container: Phaser.GameObjects.Container,
    script: CoachStep[],
  ) {
    this.runner = new CoachRunner(script);
    this.plate = scene.add
      .rectangle(0, 0, 10, 10, COLORS.bgPanel, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, COLORS.signal)
      .setInteractive({ useHandCursor: true });
    this.text = scene.add
      .text(0, 0, '', mono(layout.font.tiny, COLORS.signal, { align: 'center' }))
      .setOrigin(0.5, 0);
    container.add([this.plate, this.text]);
    this.plate.on(
      'pointerup',
      (_p: unknown, _x: number, _y: number, ev?: { stopPropagation(): void }) => {
        ev?.stopPropagation();
        this.runner.skipDwell();
      },
    );
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
    this.text.setFontSize(layout.font.tiny);
    this.place();
  }

  private showStep(): void {
    const step = this.runner.step;
    if (!step) {
      this.retire();
      return;
    }
    this.pendingTab = step.tab ?? null;
    this.text.setText(step.text);
    this.place();
  }

  private place(): void {
    if (this.runner.done) return;
    const { board, pad, font } = this.layout;
    const w = Math.min(board.w - pad * 2, this.layout.px(520));
    const x = board.x + Math.round((board.w - w) / 2);
    const y = board.y + pad;
    this.text.setWordWrapWidth(w - pad * 2);
    this.text.setLineSpacing(Math.round(font.tiny * 0.45));
    this.text.setColor(css(COLORS.signal));
    this.text.setPosition(x + w / 2, y + pad);
    const h = Math.round(this.text.height + pad * 2);
    this.plate.setPosition(x, y).setSize(w, h);
    this.plate.setStrokeStyle(1, COLORS.signal);
    this.plate.input?.hitArea?.setTo(0, 0, w, h);
  }

  private retire(): void {
    this.plate.setVisible(false).disableInteractive();
    this.text.setVisible(false);
  }

  destroy(): void {
    this.retire();
    this.plate.destroy();
    this.text.destroy();
  }
}
