import Phaser from 'phaser';
import type { MissionDef } from '../../content/campaign';
import type { SimConfig } from '../../sim/types';
import { COLORS } from '../palette';
import { mono, makeButton } from '../ui';

export interface BriefingData {
  mission: MissionDef;
  /** Fully-built battle config; this scene only displays and forwards it. */
  config: SimConfig;
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
    const { mission } = this.briefing;
    const width = 1280;
    const cx = width / 2;

    this.add.rectangle(0, 0, width, 768, COLORS.bgField).setOrigin(0);
    this.add.rectangle(140, 60, width - 280, 648, COLORS.bgPanel).setOrigin(0);
    this.add.rectangle(140, 60, width - 280, 2, COLORS.gridLine).setOrigin(0);

    this.add
      .text(cx, 92, `MISSION ${mission.index + 1} OF 9`, mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0);
    this.add
      .text(cx, 112, mission.codename, mono(30, COLORS.ink, { fontStyle: 'bold' }))
      .setOrigin(0.5, 0);
    this.add
      .text(cx, 152, 'OPERATION LANDFALL — COOS BAY PERIMETER', mono(10, COLORS.inkDim))
      .setOrigin(0.5, 0);

    this.add.text(180, 196, 'INCOMING TRANSMISSION', mono(10, COLORS.signal));
    this.logText = this.add.text(180, 216, '', mono(13, COLORS.ink, { lineSpacing: 8 }));

    this.add.text(180, 470, 'OBJECTIVE', mono(10, COLORS.inkDim));
    this.add.text(180, 486, mission.objective, mono(13, COLORS.intel));
    if (mission.bonus) {
      this.add.text(180, 514, 'BONUS (+50% REWARD)', mono(10, COLORS.inkDim));
      this.add.text(180, 530, mission.bonus.label, mono(12, COLORS.olive));
    }
    this.add.text(
      180,
      560,
      `REWARD: ${mission.reward.supplies} SUPPLIES` +
        (mission.reward.fuel > 0 ? ` + ${mission.reward.fuel} FUEL` : '') +
        (mission.unlockNote ? `\nON VICTORY — ${mission.unlockNote}` : ''),
      mono(11, COLORS.inkDim, { lineSpacing: 5 }),
    );

    makeButton(this, cx - 240, 636, 220, 34, 'RETURN TO BASE [ESC]', () =>
      this.scene.start('town', {}),
    );
    makeButton(this, cx + 20, 636, 220, 34, 'COMMENCE [SPACE]', () => this.launch());

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
    });
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
    }
  }
}
