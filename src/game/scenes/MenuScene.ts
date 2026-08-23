import Phaser from 'phaser';
import { music } from '../music';
import { campaignFor, flavorFor } from '../../content/factions';
import { leagueOf } from '../../meta/ladder';
import {
  activeSlot,
  clearSlot,
  readSlot,
  setActiveSlot,
  SLOT_COUNT,
} from '../../meta/save';
import { tick } from '../../meta/town';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
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
  /** Second tap confirms: erasing a war is destructive and has no undo. */
  private wipeArmedUntil = 0;
  private wipeArmedSlot = 0;
  /** The slot list doubles as the erase list while this is on. */
  private eraseMode = false;

  constructor() {
    super('menu');
  }

  create(): void {
    music.play('quiet');
    this.layout = layoutOf(this);
    this.wipeArmedUntil = 0;
    this.wipeArmedSlot = 0;
    this.eraseMode = false;
    this.show(() => this.buildMenu());
    onLayoutChange(this, () => {
      this.layout = layoutOf(this);
      this.rebuild();
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.enterWar(activeSlot()));
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

  /** Open the war in `slot`. TownScene loads it fresh from that slot. */
  private enterWar(slot: number): void {
    setActiveSlot(slot);
    this.page?.close();
    this.page = null;
    this.scene.start('town', {});
  }

  /** An empty slot: claim it and let TownScene run its own faction pick. */
  private startWar(slot: number): void {
    setActiveSlot(slot);
    clearSlot(slot); // a pre-faction-pick husk is not a war, but it is a file
    this.enterWar(slot);
  }

  /** First tap arms, second tap inside the window erases. */
  private eraseSlot(slot: number): void {
    if (this.wipeArmedSlot !== slot || Date.now() > this.wipeArmedUntil) {
      this.wipeArmedSlot = slot;
      this.wipeArmedUntil = Date.now() + 4000;
      this.rebuild();
      return;
    }
    clearSlot(slot);
    this.wipeArmedSlot = 0;
    this.wipeArmedUntil = 0;
    this.eraseMode = false;
    this.rebuild();
  }

  private buildMenu(): Overlay {
    const now = Date.now();
    // No overlay title here: the hero flows inside the card with everything
    // else, so the whole composition centres as one block instead of leaving
    // a hole between a pinned title and the buttons.
    const ov = new Overlay(this, this.layout, { scrim: 1 });
    const { gap, font, compact, px } = this.layout;

    // One column for the whole menu, not a monitor-wide stretch.
    const menuWidth = px(420);
    const menuGap = Math.round(gap * 0.8);
    /**
     * A menu row that grows to hold its own label. Every one of these carries
     * a faction name the content layer is free to lengthen, so the height is
     * measured rather than reserved — PLA EXPEDITIONARY FORCE on a phone is
     * two lines, and a one-line reservation put it through the row below.
     */
    const menuButton = (
      label: string,
      onTap: () => void,
      opts: { align?: 'left' | 'center'; sub?: string } = {},
    ) => ov.flowButton(label, onTap, { ...opts, width: menuWidth, gapAfter: menuGap });
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

    prose('2060TD', font.hero, COLORS.ink, air, px(560));
    prose(
      'An alternate history. 2027. A coordinated offensive — China, Russia, ' +
        'North Korea — strikes the American mainland and UN forces worldwide. ' +
        'The fiction depicts militaries and machines, not peoples.',
      font.tiny,
      COLORS.inkDim,
      Math.round(air * 1.6),
      px(560),
    );

    // Three wars side by side, so trying another faction never costs you the
    // one you have. Slot 1 is the original single-slot file.
    const wars = Array.from({ length: SLOT_COUNT }, (_, i) => ({
      slot: i + 1,
      town: readSlot(i + 1),
    }));
    const fought = wars.filter((w) => w.town !== null);
    if (fought.length === 0) prose('Five commands are hiring.', font.body, COLORS.ink, air);

    for (const { slot, town } of wars) {
      if (!town) {
        const row = menuButton(`${slot} · EMPTY`, () => this.startWar(slot), {
          align: 'left',
          sub: this.eraseMode ? '' : 'NEW WAR',
        });
        if (this.eraseMode) row.setEnabled(false);
        continue;
      }
      // Ticked for display only — nothing is written back, so standing decay
      // and offline accrual read true without the menu resolving anyone's war.
      tick(town, now);
      const armed = this.wipeArmedSlot === slot && now <= this.wipeArmedUntil;
      menuButton(
        armed ? `TAP AGAIN — ERASES WAR ${slot}` : `${slot} · ${flavorFor(town.faction).faction}`,
        () => (this.eraseMode ? this.eraseSlot(slot) : this.enterWar(slot)),
        {
          align: 'left',
          // The short band form: a slot row already carries a faction name,
          // and PLA EXPEDITIONARY FORCE plus IRREGULARS does not fit a phone.
          sub: this.eraseMode ? 'ERASE' : `T${town.frontline.tier} · ${leagueOf(town).short}`,
        },
      );
    }

    // Detail for the war you would resume: the slot rows have no room for it,
    // and printing it three times would bury the choice it is meant to help.
    const current = wars.find((w) => w.slot === activeSlot() && w.town);
    if (current?.town && !this.eraseMode) {
      const next = campaignFor(current.town.faction)[current.town.campaign.next];
      // On a narrow screen the join becomes a line break, so the wrap lands
      // between the two facts instead of through the middle of one.
      const join = compact ? '\n' : ' · ';
      prose(
        `WAR ${current.slot}: ${next ? `NEXT M${next.index + 1} ${next.codename}` : 'CAMPAIGN COMPLETE'}` +
          `${join}${current.town.frontline.standing} PTS · ${current.town.victories} VICTORIES`,
        font.tiny,
        COLORS.inkDim,
        air,
      );
    } else {
      ov.flow(0, Math.round(air / 2));
    }

    if (fought.length > 0) {
      menuButton(this.eraseMode ? 'CANCEL' : 'ERASE A WAR', () => {
        this.eraseMode = !this.eraseMode;
        this.wipeArmedSlot = 0;
        this.wipeArmedUntil = 0;
        this.rebuild();
      });
    }
    menuButton('SETTINGS', () => this.showSettings());
    menuButton('TRAINING RANGE', () => {
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
