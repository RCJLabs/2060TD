import Phaser from 'phaser';
import { campaignFor, flavorFor } from '../../content/factions';
import { leagueOf } from '../../meta/ladder';
import { clearSave, loadTown } from '../../meta/save';
import { tick, type TownState } from '../../meta/town';
import { layoutOf, onLayoutChange, type Layout, type Rect } from '../layout';
import { Overlay } from '../overlay';
import { COLORS } from '../palette';
import { buildSettings } from '../settingsOverlay';

/**
 * The front door (v1.1). Everything before this dropped the player straight
 * into their town, which left no home for settings, no way to start a second
 * war without abandoning the first from inside it, and nowhere to put the
 * alternate-history framing except over the faction pick.
 *
 * The menu reads the save rather than owning it: CONTINUE resumes the town
 * as it stands, NEW WAR clears the file and lets TownScene run its own
 * faction pick, which keeps one code path for starting a campaign.
 */
export class MenuScene extends Phaser.Scene {
  private layout!: Layout;
  private page: Overlay | null = null;
  /** Second tap confirms: NEW WAR over an existing campaign is destructive. */
  private wipeArmedUntil = 0;

  constructor() {
    super('menu');
  }

  create(): void {
    this.layout = layoutOf(this);
    this.wipeArmedUntil = 0;
    this.show(() => this.buildMenu());
    onLayoutChange(this, () => {
      this.layout = layoutOf(this);
      this.rebuild();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.enterWar());
  }

  /**
   * Open a page, remembering how to rebuild it when the viewport changes.
   * Builders RETURN their overlay and this owns it — a builder that quietly
   * kept its own reference would stack a fresh copy on every rebuild.
   */
  private builder: (() => Overlay) | null = null;

  private show(build: () => Overlay): void {
    this.page?.close();
    this.builder = build;
    this.page = build();
  }

  private rebuild(): void {
    if (this.builder) this.show(this.builder);
  }

  /** The saved campaign, or null when the file is empty or pre-faction-pick. */
  private saved(): TownState | null {
    const town = loadTown(Date.now());
    return town.campaign.difficulty === null ? null : town;
  }

  private enterWar(): void {
    this.page?.close();
    this.page = null;
    this.scene.start('town', {});
  }

  private buildMenu(): Overlay {
    const town = this.saved();
    // No overlay title here: the hero flows inside the card with everything
    // else, so the whole composition centres as one block instead of leaving
    // a hole between a pinned title and the buttons.
    const ov = new Overlay(this, this.layout, { scrim: 1 });
    const { rowH, gap, font, compact, px } = this.layout;
    const armed = Date.now() <= this.wipeArmedUntil;

    /** One column for the whole menu, not a monitor-wide stretch. */
    const column = (rect: Rect, max = px(420)): Rect => {
      const w = Math.min(rect.w, max);
      return { ...rect, x: rect.x + Math.round((rect.w - w) / 2), w };
    };
    const menuRow = (): Rect => column(ov.flow(rowH, Math.round(gap * 0.8)));
    /**
     * Deliberate breathing room between blocks. Measuring the text also took
     * away the slack that over-estimated heights used to provide by accident,
     * and on a monitor that slack was the only thing keeping the composition
     * from reading as one squeezed paragraph.
     */
    const air = compact ? gap : Math.round(gap * 2);
    /**
     * Every block here is MEASURED, never estimated. A phone wraps the
     * faction line and the campaign status onto two lines each, and a height
     * guessed from a line count put both of them through the block below.
     */
    const prose = (
      value: string,
      size: number,
      color: number,
      gapAfter: number,
      width = px(420),
    ): void => {
      ov.paragraph(value, size, color, {
        center: true,
        width: Math.min(ov.card.w, width),
        gapAfter,
        lineSpacing: Math.round(size * 0.5),
      });
    };

    prose('LAST LINE', font.hero, COLORS.ink, air, px(560));
    prose(
      'An alternate history. 2027. A coordinated offensive — China, Russia, ' +
        'North Korea — strikes the American mainland and UN forces worldwide. ' +
        'The fiction depicts militaries and machines, not peoples.',
      font.tiny,
      COLORS.inkDim,
      Math.round(air * 1.6),
      px(560),
    );

    if (town) {
      tick(town, Date.now());
      const flavor = flavorFor(town.faction);
      const next = campaignFor(town.faction)[town.campaign.next];
      // On a narrow screen the joins become line breaks, so the wrap lands
      // between the two facts instead of through the middle of one.
      const join = compact ? '\n' : ' · ';
      prose(`${flavor.faction}${join}${flavor.operation.split(' — ')[0]}`, font.body, COLORS.olive, Math.round(gap / 2));
      prose(
        `${next ? `NEXT: M${next.index + 1} ${next.codename}` : 'CAMPAIGN COMPLETE'}${join}` +
          `TIER ${town.frontline.tier} · ${leagueOf(town).label} ${town.frontline.standing} PTS` +
          ` · ${town.victories} VICTORIES`,
        font.tiny,
        COLORS.inkDim,
        air,
      );
      ov.button(menuRow(), 'CONTINUE THE WAR', () => this.enterWar());
    } else {
      prose('Five commands are hiring.', font.body, COLORS.ink, air);
    }

    ov.button(
      menuRow(),
      town && armed ? 'TAP AGAIN — THIS ERASES YOUR WAR' : 'NEW WAR',
      () => {
        if (town && Date.now() > this.wipeArmedUntil) {
          // Destructive, and there is no undo: make them mean it.
          this.wipeArmedUntil = Date.now() + 4000;
          this.rebuild();
          return;
        }
        clearSave();
        this.enterWar();
      },
    );
    ov.button(menuRow(), 'SETTINGS', () => this.showSettings());
    ov.button(menuRow(), 'TRAINING RANGE', () => {
      window.location.search = '?playground=1';
    });

    ov.flow(0, air); // spacer: the closing line is a sign-off, not a fifth button
    prose(
      'Your town is the battlefield: the walls that protect your economy ' +
        'are the maze your enemies fight through.',
      font.tiny,
      COLORS.inkDim,
      0,
      px(560),
    );
    return ov;
  }

  private showSettings(): void {
    this.show(() =>
      buildSettings(this, this.layout, {
        rebuild: () => this.showSettings(),
        close: () => this.show(() => this.buildMenu()),
        // The menu redraws itself from scratch, so a palette flip needs no
        // extra repaint — the next build already uses the new colours.
      }),
    );
  }
}
