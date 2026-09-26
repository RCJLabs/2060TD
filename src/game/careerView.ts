import { flavorFor, type FactionId } from '../content/factions';
import { gradeFor, type Officer } from '../content/officers';
import { HEAD_START_BY_ID } from '../content/prestige';
import { squadName } from '../content/veterancy';
import type { HeadStartNews, Retirement } from '../meta/career';
import type { OverlayApi } from './dom/overlay';
import type { Layout } from './layout';
import { COLORS } from './palette';

/**
 * The career's words (M28 Phase 3), shared by the war and the menu: a war
 * retired from either says the same thing, and a head start is named the same
 * way wherever a war begins.
 */

/** An officer as a sentence names them: grade, name and doctrine. */
export const officerLine = (o: Officer): string =>
  `${gradeFor(o.xp).short} ${o.name} (${o.doctrine.toUpperCase()}, ${o.raids} raid${o.raids === 1 ? '' : 's'})`;

/** The retirement card's body: what the war achieved, what it banked, and who went to the reserve. */
export function paintRetirement(ov: OverlayApi, layout: Layout, r: Retirement, merit: number): void {
  const { font, gap } = layout;
  const line = (text: string, color: number = COLORS.ink, size = font.body): void => {
    ov.paragraph(text, size, color, { gapAfter: Math.round(gap / 2) });
  };
  for (const l of r.breakdown.lines) line(`${l.label} · ${l.merit}`, COLORS.inkDim);
  line(
    r.before > 0
      ? `+${r.paid} MERIT. It was retired before and paid ${r.before} then: this is what it has earned since.`
      : `+${r.paid} MERIT`,
    COLORS.ink,
    font.title,
  );
  line(`${merit} MERIT in hand, to spend at the WAR COLLEGE on the menu.`, COLORS.inkDim);
  const army = flavorFor(r.war.faction).short;
  if (r.officer) {
    line(
      `${officerLine(r.officer)} goes to the reserve, and will command the first squad of your next ${army} war.`,
    );
  } else if (r.kept) {
    line(`${officerLine(r.kept)} stays in the reserve: nobody in this war had more experience.`, COLORS.inkDim);
  }
}

/** What a war's head start gave it, a line a gift. Empty for a war with none. */
export function headStartLines(news: HeadStartNews, faction: FactionId): string[] {
  const lines: string[] = [];
  if (news.chest) {
    const c = news.chest;
    lines.push(
      `WAR CHEST: +${c.supplies.toLocaleString('en-US')} supplies, +${c.fuel.toLocaleString('en-US')} fuel, +${c.intel} intel`,
    );
  }
  if (news.opening) {
    const said = HEAD_START_BY_ID.opening.levels
      .slice(0, news.opening.level)
      .map((l) => l.detail)
      .join(', ');
    lines.push(`THE OPENING: requisitioned from day one: ${said}`);
  }
  if (news.quartermasters) {
    const q = news.quartermasters;
    lines.push(`QUARTERMASTERS: +${Math.round(q.bonus * 100)}% on the depots' supplies and fuel for ${q.hours} hours`);
  }
  if (news.staff !== undefined) lines.push(`STAFF COLLEGE: research timers ${Math.round((1 - news.staff) * 100)}% shorter`);
  if (news.officer) lines.push(`${officerLine(news.officer)} takes command of ${squadName(faction, 0)}`);
  return lines;
}
