import Phaser from 'phaser';
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

    ov.text(ov.flow(Math.round(font.tiny * 1.5), Math.round(gap / 2)), 'INCOMING TRANSMISSION', font.tiny, COLORS.signal);
    const logRect = ov.flow(Math.round(font.body * 1.9 * mission.briefing.length));
    this.logText = ov.text(logRect, '', font.body, COLORS.ink, {
      lineSpacing: Math.round(font.body * 0.6),
    });
    this.refreshLog();

    ov.text(ov.flow(Math.round(font.tiny * 1.5), Math.round(gap / 2)), 'OBJECTIVE', font.tiny, COLORS.inkDim);
    ov.text(ov.flow(Math.round(font.body * 2.4)), mission.objective, font.body, COLORS.intel);
    if (mission.bonus) {
      ov.text(ov.flow(Math.round(font.tiny * 1.5), Math.round(gap / 2)), 'BONUS (+50% REWARD)', font.tiny, COLORS.inkDim);
      ov.text(ov.flow(Math.round(font.body * 1.8)), mission.bonus.label, font.body, COLORS.olive);
    }
    ov.text(
      ov.flow(Math.round(font.tiny * 3.4)),
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
