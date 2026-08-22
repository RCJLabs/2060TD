import Phaser from 'phaser';
import { defenseCatalogFor, raidCatalogFor, type FactionId } from '../../content/factions';
import { DT, Engine } from '../../sim/engine';
import type { SimConfig } from '../../sim/types';
import { BattleRenderer } from '../BattleRenderer';
import { COLORS, css } from '../palette';
import { makeButton, mono, type Button } from '../ui';

export interface ReplayData {
  config: SimConfig;
  /** raid = your army hits an enemy base; defense = a probe on your town. */
  kind: 'raid' | 'defense';
  title: string;
  /** Whose war this footage is from (picks the catalogs; default 'usa'). */
  faction?: FactionId;
  /** Scene key to return to (with its restart payload). */
  backTo: 'town' | 'raid';
  backData?: object;
}

/**
 * Deterministic replay viewer: re-runs the exact battle config live, with
 * playback speed, skip-to-end, and no player input. The sim IS the recording.
 */
export class ReplayScene extends Phaser.Scene {
  private replay!: ReplayData;
  private engine!: Engine;
  private battle!: BattleRenderer;
  private accumulator = 0;
  private speedMult = 2;
  private showPaths = true;
  private speedButton!: Button;
  private statusText!: Phaser.GameObjects.Text;
  private endShown = false;

  constructor() {
    super('replay');
  }

  init(data: ReplayData): void {
    this.replay = data;
    this.accumulator = 0;
    this.speedMult = 2;
    this.endShown = false;
  }

  create(): void {
    const faction = this.replay.faction ?? 'usa';
    const catalog =
      this.replay.kind === 'raid' ? raidCatalogFor(faction) : defenseCatalogFor(faction);
    this.engine = new Engine(this.replay.config, catalog);
    this.engine.enqueue({ tick: 0, type: 'startAssault' });
    this.battle = new BattleRenderer(this, this.engine, 32, this.replay.kind === 'raid');

    this.add
      .text(512, 6, `REPLAY — ${this.replay.title}`, mono(11, COLORS.inkDim))
      .setOrigin(0.5, 0)
      .setDepth(5);

    const x0 = 1024;
    const pad = 14;
    const bw = 256 - pad * 2;
    this.add.rectangle(x0, 0, 256, 768, COLORS.bgPanel).setOrigin(0, 0);
    this.add.rectangle(x0, 0, 2, 768, COLORS.gridLine).setOrigin(0, 0);
    this.add.text(x0 + pad, 12, 'AFTER ACTION', mono(17, COLORS.ink, { fontStyle: 'bold' }));
    this.add.text(
      x0 + pad,
      34,
      this.replay.kind === 'raid' ? 'RAID FOOTAGE' : 'DEFENSE FOOTAGE',
      mono(10, COLORS.inkDim),
    );

    this.statusText = this.add.text(x0 + pad, 60, '', mono(12, COLORS.ink, { lineSpacing: 5 }));

    this.speedButton = makeButton(this, x0 + pad, 200, bw, 26, 'SPEED ×2 [S]', () =>
      this.cycleSpeed(),
    );
    makeButton(this, x0 + pad, 232, bw, 26, 'PATHS [P]', () => {
      this.showPaths = !this.showPaths;
    });
    makeButton(this, x0 + pad, 264, bw, 26, 'SKIP TO END [SPACE]', () => this.skipToEnd());
    makeButton(this, x0 + pad, 706, bw, 30, 'BACK [ESC]', () => this.goBack());

    const kb = this.input.keyboard;
    kb?.on('keydown-S', () => this.cycleSpeed());
    kb?.on('keydown-P', () => {
      this.showPaths = !this.showPaths;
    });
    kb?.on('keydown-SPACE', () => this.skipToEnd());
    kb?.on('keydown-ESC', () => this.goBack());
  }

  private cycleSpeed(): void {
    this.speedMult = this.speedMult >= 8 ? 1 : this.speedMult * 2;
    this.speedButton.setLabel(`SPEED ×${this.speedMult} [S]`);
  }

  private ended(): boolean {
    return this.engine.phase === 'victory' || this.engine.phase === 'defeat';
  }

  private skipToEnd(): void {
    let safety = 20_000;
    while (!this.ended() && safety-- > 0) {
      this.battle.consumeEvents(this.engine.step());
    }
  }

  private goBack(): void {
    this.scene.start(this.replay.backTo, this.replay.backData ?? {});
  }

  override update(_time: number, deltaMs: number): void {
    if (!this.ended()) {
      this.accumulator += (deltaMs / 1000) * this.speedMult;
      let safety = 24;
      while (this.accumulator >= DT && safety-- > 0) {
        this.accumulator -= DT;
        this.battle.consumeEvents(this.engine.step());
      }
      if (this.accumulator > DT) this.accumulator = 0;
    } else if (!this.endShown) {
      this.endShown = true;
      const raid = this.replay.kind === 'raid';
      const attackersWon = this.engine.phase === 'defeat'; // the base's CC fell
      const text = raid
        ? attackersWon
          ? 'COMMAND POST DESTROYED'
          : 'RAID REPELLED'
        : attackersWon
          ? 'PERIMETER BREACHED'
          : 'PROBE REPELLED';
      const killer = this.engine.stats.ccKillerKind;
      const cause = attackersWon && killer ? `\nKILLING BLOW: ${killer.toUpperCase()}` : '';
      this.add
        .text(512, 384, text + cause, {
          ...mono(28, attackersWon === raid ? COLORS.olive : COLORS.alarm, {
            fontStyle: 'bold',
            align: 'center',
          }),
          backgroundColor: css(COLORS.bgPanel),
          padding: { x: 16, y: 10 },
        })
        .setOrigin(0.5)
        .setDepth(30);
    }

    const alpha = Phaser.Math.Clamp(this.accumulator / DT, 0, 1);
    this.battle.draw(this.ended() ? 1 : alpha, deltaMs / 1000, { showPaths: this.showPaths });

    const e = this.engine;
    this.statusText.setText(
      [
        `T+${Math.floor(e.tick / 20)}s`,
        `UNITS ALIVE  ${e.attackers.length}`,
        `KILLS        ${e.stats.kills}`,
        `STRUCTURES   -${e.stats.structuresLost}`,
        `WALLS        -${e.stats.wallsLost}`,
        this.ended() ? 'FOOTAGE ENDS' : '',
      ].join('\n'),
    );
  }
}
