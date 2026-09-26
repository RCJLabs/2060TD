import { Scene } from '../stage';
import { music } from '../music';
import { campaignFor, FACTION_IDS, flavorFor } from '../../content/factions';
import { drawFactionMark } from '../glyphs';
import { leagueOf } from '../../meta/ladder';
import { wonDay } from '../../meta/record';
import {
  activeSlot,
  clearSlot,
  readSlot,
  setActiveSlot,
  SLOT_COUNT,
} from '../../meta/save';
import { tick } from '../../meta/town';
import { layoutOf, onLayoutChange, type Layout } from '../layout';
import type { Ink } from '../ink';
import { COLORS } from '../palette';
import { buildSettings } from '../settingsOverlay';
import { createOverlay, type OverlayApi } from '../dom/overlay';
import { HEAD_STARTS } from '../../content/prestige';
import {
  buy,
  buyError,
  loadCareer,
  meritOf,
  nextLevel,
  ordinal,
  retire,
  saveCareer,
  type Retirement,
} from '../../meta/career';
import { officerLine, paintRetirement } from '../careerView';

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
export class MenuScene extends Scene {
  private layout!: Layout;
  private page: OverlayApi | null = null;
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
  private builder: (() => OverlayApi) | null = null;

  private show(build: () => OverlayApi): void {
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

  /**
   * First tap arms, second tap inside the window retires the war in the slot
   * (M28 Phase 3): it banks its merit and sends its best officer to the
   * reserve, as RETIRE THE WAR does inside it, and the slot is emptied.
   */
  private eraseSlot(slot: number): void {
    if (this.wipeArmedSlot !== slot || Date.now() > this.wipeArmedUntil) {
      this.wipeArmedSlot = slot;
      this.wipeArmedUntil = Date.now() + 4000;
      this.rebuild();
      return;
    }
    const town = readSlot(slot);
    const career = loadCareer();
    const retired = town ? retire(career, town, Date.now()) : null;
    if (retired) saveCareer(career);
    clearSlot(slot);
    this.wipeArmedSlot = 0;
    this.wipeArmedUntil = 0;
    this.eraseMode = false;
    if (retired) this.show(() => this.buildRetired(retired, career.merit));
    else this.rebuild();
  }

  /** A war retired from the menu (M28 Phase 3): what it banked. */
  private buildRetired(r: Retirement, merit: number): OverlayApi {
    const days = Math.max(1, Math.floor((r.war.ended - r.war.began) / 86_400_000) + 1);
    const ov = createOverlay(this, this.layout, {
      scrim: 1,
      title: 'THE WAR IS RETIRED',
      subtitle: `${flavorFor(r.war.faction).faction} · DAY ${days}${r.war.wonDay !== null ? ` · WON ON DAY ${r.war.wonDay}` : ''}`,
    });
    paintRetirement(ov, this.layout, r, merit);
    ov.footer('BACK', () => this.show(() => this.buildMenu()));
    return ov;
  }

  /**
   * The War College (M28 Phase 3): the commander's merit, the head starts it
   * buys, the officers waiting in the reserve and the wars retired.
   */
  private buildCollege(): OverlayApi {
    const career = loadCareer();
    const ov = createOverlay(this, this.layout, {
      scrim: 1,
      title: 'WAR COLLEGE',
      subtitle: `${career.merit} MERIT IN HAND · ${career.earned} EARNED IN ALL`,
    });
    const { font, gap } = this.layout;
    const line = (text: string, color: number = COLORS.ink, gapAfter = Math.round(gap / 2)): void => {
      ov.paragraph(text, font.body, color, { gapAfter });
    };
    const heading = (text: string): void => {
      ov.text(ov.flow(Math.round(font.label * 1.4), Math.round(gap / 2)), text, font.label, COLORS.intel, {
        fontStyle: 'bold',
      });
    };
    line(
      'A war retired banks merit for what it achieved: RETIRE THE WAR on its SYS tab, or RETIRE A WAR ' +
        'here. Head starts open every war begun after they are bought, in any slot, as any army, and ' +
        'change no battle.',
      COLORS.inkDim,
      gap,
    );
    heading('HEAD STARTS');
    for (const track of HEAD_STARTS) {
      const level = career.bought[track.id];
      const next = nextLevel(career, track.id);
      line(
        `${track.name} · LV ${level}/${track.levels.length} — ${track.blurb}\n` +
          (level > 0 ? `NOW: ${track.levels[level - 1]!.detail}` : 'NOT BOUGHT') +
          (next ? `\nNEXT: ${next.detail}` : ''),
        level > 0 ? COLORS.ink : COLORS.inkDim,
      );
      const button = ov.flowButton(
        next ? `BUY LV ${level + 1}` : 'ALL THREE BOUGHT',
        () => {
          if (buy(career, track.id)) {
            saveCareer(career);
            this.show(() => this.buildCollege());
          }
        },
        { sub: next ? `${next.price} MERIT` : '', gapAfter: gap },
      );
      if (buyError(career, track.id) !== null) button.setEnabled(false);
    }
    heading('THE RESERVE');
    const waiting = FACTION_IDS.flatMap((f) => (career.reserve[f] ? [[f, career.reserve[f]!] as const] : []));
    if (waiting.length === 0) {
      line('Nobody is waiting. A war retired sends its most experienced living officer here.', COLORS.inkDim);
    }
    for (const [faction, officer] of waiting) {
      line(`${officerLine(officer)} — waits for your next ${flavorFor(faction).short} war`);
    }
    heading('THE HONOUR ROLL');
    if (career.wars.length === 0) line('No war has been retired yet.', COLORS.inkDim);
    for (const w of career.wars) {
      const days = Math.max(1, Math.floor((w.ended - w.began) / 86_400_000) + 1);
      line(
        `${flavorFor(w.faction).short} · ${days} day${days === 1 ? '' : 's'} · the ${ordinal(w.rung)} rung` +
          (w.wonDay !== null ? ` · WON DAY ${w.wonDay}` : '') +
          (w.hard ? ' · HARD' : '') +
          ` · ${w.merit} MERIT`,
        COLORS.inkDim,
      );
    }
    ov.footer('BACK', () => this.show(() => this.buildMenu()));
    return ov;
  }

  private buildMenu(): OverlayApi {
    const now = Date.now();
    const career = loadCareer();
    // The masthead is pinned now, and that reverses a v1.4 decision. It was
    // flowed inside the card because a title floating over a dark scrim left
    // a hole between itself and the buttons — but the masthead is a filled
    // slab spanning the sheet since the ink pass, and a slab is an anchor
    // rather than a hole. The front door was the last screen still reading
    // like a text document with three buttons under it.
    const ov = createOverlay(this, this.layout, {
      scrim: 1,
      title: '2060TD',
      subtitle:
        'An alternate history. 2027. A coordinated offensive — China, Russia, North Korea — ' +
        'strikes the American mainland and UN forces worldwide. The fiction depicts militaries ' +
        'and machines, not peoples.',
    });
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
      opts: {
        align?: 'left' | 'center';
        sub?: string;
        icon?: (g: Ink, x: number, y: number, size: number) => void;
      } = {},
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

    // Three wars side by side, so trying another faction never costs you the
    // one you have. Slot 1 is the original single-slot file.
    const wars = Array.from({ length: SLOT_COUNT }, (_, i) => ({
      slot: i + 1,
      town: readSlot(i + 1),
    }));
    const fought = wars.filter((w) => w.town !== null);
    if (fought.length === 0) {
      // The five marks, in a row, on the same column the buttons use — a
      // strip laid across the whole card floats free of everything under it.
      // Names go in the sentence rather than under the marks: five captions
      // at badge size is a second row of type where the point was to have
      // fewer, and the marks are introduced properly on the picker anyway.
      const markBox = Math.round(this.layout.rowH * 0.95);
      ov.band(
        markBox,
        (g, rect) => {
          // The column, or the card when the card is narrower. Spread across
          // the full column on a 360px phone, the outer two marks were drawn
          // half off the sheet: the buttons clamp to the card, this did not.
          const span = Math.min(rect.w, menuWidth);
          const left = rect.x + Math.round((rect.w - span) / 2);
          const step = span / FACTION_IDS.length;
          FACTION_IDS.forEach((faction, i) => {
            drawFactionMark(g, faction, left + step * (i + 0.5) - markBox / 2, rect.y, markBox);
          });
        },
        gap,
      );
      prose(
        `Five commands are hiring: ${FACTION_IDS.map((f) => flavorFor(f).short).join(', ')}.`,
        font.body,
        COLORS.ink,
        air,
      );
    }

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
        armed ? `TAP AGAIN — RETIRES WAR ${slot}` : `${slot} · ${flavorFor(town.faction).faction}`,
        () => (this.eraseMode ? this.eraseSlot(slot) : this.enterWar(slot)),
        {
          align: 'left',
          // The short band form: a slot row already carries a faction name,
          // and PLA EXPEDITIONARY FORCE plus IRREGULARS does not fit a phone.
          // A war won says so, with the day (M25 Phase 4b).
          sub: this.eraseMode
            ? `RETIRE · +${meritOf(town, career).total} MERIT`
            : `${wonDay(town) !== null ? `WON DAY ${wonDay(town)} · ` : ''}T${town.frontline.tier} · ${leagueOf(town).short}`,
          // Whose war this is, before the name is read. Five armies are told
          // apart by shape here for the same reason they are on the board:
          // the page has one colour and it is not spent on identity.
          icon: (g, x, y, size) => drawFactionMark(g, town.faction, x, y, size),
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

    // The commander's career (M28 Phase 3): merit, head starts, the reserve.
    if (!this.eraseMode) {
      menuButton('WAR COLLEGE', () => this.show(() => this.buildCollege()), {
        align: 'left',
        sub: `${career.merit} MERIT`,
      });
    }
    if (fought.length > 0) {
      menuButton(this.eraseMode ? 'CANCEL' : 'RETIRE A WAR', () => {
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
