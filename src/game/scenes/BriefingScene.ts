import Phaser from 'phaser';
import { music } from '../music';
import type { MissionDef } from '../../content/campaign';
import { campaignFor, flavorFor, type FactionId } from '../../content/factions';
import type { SimConfig } from '../../sim/types';
import { audio } from '../audio';
import { COLORS } from '../palette';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
import { Overlay } from '../overlay';

export interface BriefingData {
  mission: MissionDef;
  /** Fully-built battle config; this scene only displays and forwards it. */
  config: SimConfig;
  faction: FactionId;
  /** Forwarded to the siege: run the first-contact coach (v1.5). */
  coach?: boolean;
}

/**
 * The radio log before the storm: mission briefing revealed line by line,
 * objective, bonus objective, and the launch decision.
 */
export class BriefingScene extends Phaser.Scene {
  private briefing!: BriefingData;
  private revealed = 0;
  private revealTimer = 0;
  private logText!: Phaser.GameObjects.Text;
  private layout!: Layout;
  private page: Overlay | null = null;
  private done = false;

  constructor() {
    super('briefing');
  }

  init(data: BriefingData): void {
    this.briefing = data;
    this.revealed = 0;
    this.revealTimer = 0;
    this.done = false;
  }

  create(): void {
    music.play('quiet');
    this.layout = layoutOf(this);
    this.buildPage();
    onLayoutChange(this, () => {
      this.layout = layoutOf(this);
      this.buildPage();
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', () => {
      if (this.revealed < this.briefing.mission.briefing.length) {
        this.revealed = this.briefing.mission.briefing.length; // skip the reveal
        this.refreshLog();
      } else {
        this.launch();
      }
    });
    kb?.on('keydown-ESC', () => this.scene.start('town', {}));
  }

  private launch(): void {
    if (this.done) return;
    this.done = true;
    this.scene.start('siege', {
      config: this.briefing.config,
      fromTown: true,
      battle: { type: 'mission', missionId: this.briefing.mission.id },
      faction: this.briefing.faction ?? 'usa',
      ...(this.briefing.coach ? { coach: true } : {}),
    });
  }

  /** The briefing page, re-flowed for whatever viewport we are on. */
  private buildPage(): void {
    const { mission } = this.briefing;
    const faction = this.briefing.faction ?? 'usa';
    this.page?.close();
    const ov = new Overlay(this, this.layout, {
      title: mission.codename,
      subtitle:
        `MISSION ${mission.index + 1} OF ${campaignFor(faction).length} · ` +
        flavorFor(faction).operation,
      scrim: 1,
    });
    this.page = ov;
    const { font, rowH, gap } = this.layout;

    /**
     * Every block here is measured, never reserved.
     *
     * The old layout gave each one a height worked out from a line COUNT —
     * 1.9 lines per briefing entry, 2.4 for the objective, 1.8 for the bonus.
     * On a phone every one of those lines wraps to two or three, so each block
     * overflowed its reservation and the next one drew straight through it:
     * OBJECTIVE landed on top of the last line of the transmission, the bonus
     * landed on the objective, and AEGIS OUT landed on both.
     */
    const heading = (text: string): void => {
      ov.paragraph(text, font.tiny, COLORS.inkDim, { gapAfter: Math.round(gap / 2) });
    };
    ov.paragraph('INCOMING TRANSMISSION', font.tiny, COLORS.signal, {
      gapAfter: Math.round(gap / 2),
    });
    /**
     * The transmission reveals a line at a time, so its height GROWS while the
     * page is up. Lay it out at the size it will finish at and then blank it
     * back: the space below is reserved for the whole message from the first
     * frame, and nothing under it moves as the lines crackle in.
     */
    this.logText = ov.paragraph(mission.briefing.join('\n'), font.body, COLORS.ink, {
      lineSpacing: Math.round(font.body * 0.6),
    });
    this.refreshLog();

    heading('OBJECTIVE');
    ov.paragraph(mission.objective, font.body, COLORS.intel);
    if (mission.bonus) {
      heading('BONUS (+50% REWARD)');
      ov.paragraph(mission.bonus.label, font.body, COLORS.olive);
    }
    ov.paragraph(
      `REWARD: ${mission.reward.supplies} SUPPLIES` +
        (mission.reward.fuel > 0 ? ` + ${mission.reward.fuel} FUEL` : '') +
        (mission.unlockNote ? `\nON VICTORY — ${mission.unlockNote}` : ''),
      font.tiny,
      COLORS.inkDim,
      { lineSpacing: Math.round(font.tiny * 0.5) },
    );

    ov.footer('RETURN TO BASE', () => this.scene.start('town', {}), 0, 2);
    ov.footer('COMMENCE', () => this.launch(), 1, 2);
    void rowH;
  }

  private refreshLog(): void {
    this.logText.setText(this.briefing.mission.briefing.slice(0, this.revealed).join('\n'));
  }

  override update(_time: number, deltaMs: number): void {
    if (this.revealed >= this.briefing.mission.briefing.length) return;
    this.revealTimer += deltaMs;
    if (this.revealTimer >= 350) {
      this.revealTimer = 0;
      this.revealed++;
      this.refreshLog();
      audio.sfx('radio'); // each line crackles in
    }
  }
}
