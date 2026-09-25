/**
 * The theater map (M25): the Front Line drawn as the ground it is.
 *
 * The lanes run up the page from the base toward the enemy's stronghold, one
 * row a town, around the front: held ground behind it in tone, the front
 * outlined with the red line the war has been pushed to, enemy ground ahead
 * in thin ink. Since Phase 2 the enemy strikes back when the front goes
 * quiet, so a sector behind the front can be the enemy's again: it is drawn
 * struck out in red, its road broken, and the front post it cuts off says so.
 * Under the map are the three front posts and any ground to retake, each with
 * a button that opens the raid planner on it. Since Phase 3 each held town
 * says what it takes an hour to hold, and the line says whether the depots
 * feed it.
 *
 * Ink draws no text, so the names are the overlay's own text laid over the
 * band at the rows it drew.
 */
import { ARCHETYPE_BY_ID } from '../content/bases';
import { flavorFor } from '../content/factions';
import { columnName, QUIET_MS, theaterFor } from '../content/theaters';
import { createOverlay, type OverlayApi } from './dom/overlay';
import { drawFactionMark } from './glyphs';
import type { Ink } from './ink';
import type { Layout } from './layout';
import { COLORS } from './palette';
import type { Scene } from './stage';
import { enemyClock } from '../meta/strikes';
import { lineAfterTaking, lineShares, nextHungerAt, supplyLine } from '../meta/supply';
import { retakes, sectorOf, theaterView, type Sector, type TheaterRow } from '../meta/theater';
import { productionPerHour, type TownState } from '../meta/town';
import { isScouted } from '../meta/warfare';

/** A sector a raid can be aimed at: its column and its lane's slot. */
export interface RaidTarget {
  tier: number;
  slot: number;
}

export interface TheaterMapOpts {
  layout: Layout;
  town: TownState;
  now: number;
  /**
   * Plan a raid on a sector. Absent where no raid can start from here: a
   * counterattack is owed, or this is a demo board.
   */
  onRaid?: (target: RaidTarget) => void;
  onClose: () => void;
}

const HOUR = 3_600_000;

/** "20 H", or "3 D" once it runs to days. */
function span(ms: number): string {
  const hours = Math.floor(ms / HOUR);
  return hours >= 48 ? `${Math.floor(hours / 24)} D` : `${hours} H`;
}

/**
 * The enemy's clock as one line: how long the front has been quiet, and what
 * that is about to cost. Null when there is nothing behind the front to lose.
 */
export function clockLine(town: TownState, now: number): { text: string; urgent: boolean } | null {
  if (town.frontline.tier <= 1) return null;
  const clock = enemyClock(town, now);
  const enemy = flavorFor(town.faction).enemy;
  if (clock.next === null) {
    return {
      text: `QUIET ${span(clock.quiet)} · BOTH STRIKES HAVE LANDED — A RAID STARTS THE CLOCK AGAIN`,
      urgent: false,
    };
  }
  const urgent = clock.next - now <= 12 * HOUR;
  if (clock.quiet < QUIET_MS) {
    return { text: `QUIET ${span(clock.quiet)} · THE ${enemy} STRIKES BACK AT ${span(QUIET_MS)}`, urgent };
  }
  return { text: `QUIET ${span(clock.quiet)} · THE ${enemy} STRIKES AGAIN IN ${span(clock.next - now)}`, urgent };
}

/**
 * The supply line as one line (M25 Phase 3): what it takes an hour against
 * what the depots make, and when a short front loses ground. Null when there
 * is nothing behind the front to feed.
 */
export function supplyText(town: TownState, now: number): { text: string; urgent: boolean } | null {
  const need = supplyLine(town.frontline);
  const made = productionPerHour(town).supplies;
  const next = nextHungerAt(town, now, made);
  if (next === null) {
    // Fed, but at the ceiling (Phase 4a): the front's town would take the
    // line past what the depots make, and it holds until they make more.
    const after = lineAfterTaking(town.frontline);
    if (after > made) {
      const front = columnName(theaterFor(town.faction), town.frontline.tier);
      return {
        text:
          `THE DEPOTS CANNOT FEED ${front}: TAKING IT WOULD PUT THE LINE AT ${after} AN HOUR, ` +
          `AND THEY MAKE ${made}. IT HOLDS UNTIL THEY MAKE MORE`,
        urgent: true,
      };
    }
    if (need <= 0) return null;
    return { text: `SUPPLY LINE ${need} AN HOUR OF THE ${made} THE DEPOTS MAKE`, urgent: false };
  }
  const enemy = flavorFor(town.faction).enemy;
  return {
    text:
      `SHORT OF SUPPLY: THE LINE TAKES ${need} AN HOUR AND THE DEPOTS MAKE ${made} — ` +
      `THE ${enemy} RETAKES A SECTOR IN ${span(Math.max(0, next - now))} UNLESS IT IS FED`,
    urgent: true,
  };
}

/** The THEATER row's note: a front short of supply, what is lost behind it, or a strike about to land. */
export function theaterNote(town: TownState, now: number): string {
  if (nextHungerAt(town, now, productionPerHour(town).supplies) !== null) return 'SHORT · [G]';
  const lost = town.frontline.lost?.length ?? 0;
  if (lost > 0) return `${lost} LOST · [G]`;
  const clock = enemyClock(town, now);
  if (clock.next !== null && clock.next - now <= 12 * HOUR) return `STRIKE IN ${span(clock.next - now)} · [G]`;
  return '[G]';
}

export function buildTheaterMap(scene: Scene, opts: TheaterMapOpts): OverlayApi {
  const { layout, town } = opts;
  const view = theaterView(town);
  const t = view.theater;
  const front = view.rows.find((r) => r.state === 'front')!;
  const ov = createOverlay(scene, layout, {
    title: t.name,
    subtitle: `THE FRONT: ${front.name} (T${front.tier}) · ${view.pushes} OF 3 PUSHES TO TAKE IT`,
  });
  const { font, gap } = layout;

  // Deepest first: the band is read from the stronghold down to the base.
  const rows = [...view.rows].reverse();
  const rowH = Math.round(layout.rowH * 1.15);
  const pad = Math.max(2, Math.round(rowH * 0.12));
  const header = rowH;
  let labelW = 0;
  let laneW = 0;
  let lanesX = 0;
  // Three marks for the pushes, between the names and the lanes.
  const pip = Math.max(4, Math.round(rowH * 0.16));
  const gutter = 3 * (pip + 3) + 8;
  const rowY = (i: number, top: number): number => top + header + i * rowH;
  /** A row's sector in the map's lane `j` is the enemy's again. */
  const lostAt = (row: TheaterRow, j: number): boolean => row.lost[t.lanes[j]!.slot] === true;
  const rect = ov.band(
    header + rows.length * rowH,
    (g: Ink, r) => {
      labelW = Math.round(r.w * 0.38);
      lanesX = r.x + labelW;
      laneW = (r.w - labelW) / 3;
      const laneMid = (j: number): number => lanesX + laneW * (j + 0.5);

      // The roads first, under the sectors: ink through held ground, a faint
      // line through the enemy's, and a break wherever a sector was retaken.
      rows.forEach((row, i) => {
        if (i === rows.length - 1) return;
        const below = rows[i + 1]!;
        const y0 = rowY(i, r.y) + rowH - pad;
        const y1 = rowY(i + 1, r.y) + pad;
        for (let j = 0; j < 3; j++) {
          const held =
            (row.state === 'held' || row.state === 'front') && !lostAt(row, j) && !lostAt(below, j);
          g.lineStyle(held ? 2 : 1, held ? COLORS.ink : COLORS.disabled, 1);
          g.lineBetween(laneMid(j), y0, laneMid(j), y1);
        }
      });

      rows.forEach((row, i) => drawRow(g, row, rowY(i, r.y), r.x + r.w));

      // The line the war has been pushed to: the front row's near edge.
      const at = rows.findIndex((row) => row.state === 'front');
      const y = rowY(at, r.y) + rowH;
      g.lineStyle(3, COLORS.signal, 1);
      g.lineBetween(lanesX, y, r.x + r.w, y);
      // The pushes toward taking it, as three marks on the line's left end.
      for (let k = 0; k < 3; k++) {
        const px = lanesX - (3 - k) * (pip + 3) - 4;
        g.lineStyle(1.5, COLORS.signal, 1);
        g.strokeRect(px, y - pip / 2, pip, pip);
        if (k < view.pushes) {
          g.fillStyle(COLORS.signal, 1);
          g.fillRect(px, y - pip / 2, pip, pip);
        }
      }
    },
    gap,
  );

  function drawRow(g: Ink, row: TheaterRow, y: number, right: number): void {
    if (row.state === 'home') {
      // The base is one place, across all three lanes: the faction's mark.
      g.lineStyle(2, COLORS.ink, 1);
      g.strokeRect(lanesX + pad, y + pad, right - lanesX - pad * 2, rowH - pad * 2);
      const mark = rowH - pad * 4;
      drawFactionMark(g, town.faction, lanesX + (right - lanesX) / 2 - mark / 2, y + pad * 2, mark);
      return;
    }
    for (let j = 0; j < 3; j++) {
      const x = lanesX + laneW * j + pad;
      const w = laneW - pad * 2;
      const h = rowH - pad * 2;
      const cut = view.cut[t.lanes[j]!.slot] === true;
      if (row.state === 'held' && lostAt(row, j)) {
        // Retaken by the enemy: struck out in red.
        g.fillStyle(COLORS.bgPanel, 1);
        g.fillRect(x, y + pad, w, h);
        g.lineStyle(2, COLORS.signal, 1);
        g.strokeRect(x, y + pad, w, h);
        g.lineBetween(x, y + pad, x + w, y + pad + h);
        g.lineBetween(x + w, y + pad, x, y + pad + h);
      } else if (row.state === 'held') {
        g.fillStyle(COLORS.olive, 1);
        g.fillRect(x, y + pad, w, h);
        g.lineStyle(1.5, COLORS.ink, 1);
        g.strokeRect(x, y + pad, w, h);
      } else if (row.state === 'front') {
        // A front post whose road is cut is out of reach: drawn faint.
        g.fillStyle(COLORS.bgPanel, 1);
        g.fillRect(x, y + pad, w, h);
        g.lineStyle(cut ? 1.5 : 3, cut ? COLORS.disabled : COLORS.ink, 1);
        g.strokeRect(x, y + pad, w, h);
      } else {
        g.fillStyle(COLORS.bgPanel, 1);
        g.fillRect(x, y + pad, w, h);
        g.lineStyle(1, COLORS.inkDim, 1);
        g.strokeRect(x, y + pad, w, h);
      }
      // The stronghold is walled: a second line inside the first.
      if (row.stronghold) {
        g.lineStyle(1, COLORS.ink, 1);
        g.strokeRect(x + 3, y + pad + 3, w - 6, h - 6);
      }
    }
  }

  // The names, where the band drew their rows. The drawing is in the band's
  // own canvas, offset by its margin; the text is placed on the card, a line
  // of it centred in its row. A held town's name sits over what it takes an
  // hour to hold (Phase 3), the two lines centred together.
  const lineH = Math.round(font.tiny * 1.2);
  const middle = Math.round((rowH - lineH) / 2);
  const upkeep = new Map(lineShares(town.frontline).map((share) => [share.tier, share.perHour]));
  t.lanes.forEach((lane, j) => {
    ov.centered(
      { x: rect.x + labelW + laneW * j, y: rect.y, w: laneW, h: header },
      lane.name,
      font.tiny,
      COLORS.inkDim,
    );
  });
  rows.forEach((row, i) => {
    const color = row.state === 'front' ? COLORS.signal : row.state === 'enemy' ? COLORS.inkDim : COLORS.ink;
    const bold = row.state === 'front' || row.state === 'home' || row.stronghold;
    const cost = row.state === 'held' ? upkeep.get(row.tier) : undefined;
    const top = rowY(i, rect.y) + middle - (cost !== undefined ? Math.round(lineH / 2) : 0);
    ov.text(
      { x: rect.x, y: top, w: labelW - gutter, h: rowH },
      row.state === 'home' ? `${row.name} · BASE` : row.name,
      font.tiny,
      color,
      { align: 'right', ...(bold ? { fontStyle: 'bold' } : {}) },
    );
    if (cost !== undefined) {
      ov.text(
        { x: rect.x, y: top + lineH, w: labelW - gutter, h: lineH },
        `${cost} AN HOUR`,
        font.tiny,
        COLORS.inkDim,
        { align: 'right' },
      );
    }
  });
  // Each front sector names its post, or says that its road is cut.
  const frontAt = rows.findIndex((row) => row.state === 'front');
  t.lanes.forEach((lane, j) => {
    const cut = view.cut[lane.slot] === true;
    const base = sectorOf(town, lane.slot).base;
    ov.centered(
      { x: rect.x + labelW + laneW * j, y: rowY(frontAt, rect.y) + middle, w: laneW, h: rowH },
      cut ? 'CUT' : (ARCHETYPE_BY_ID[base.archetype]?.short ?? base.archetype),
      font.tiny,
      cut ? COLORS.signal : COLORS.ink,
      { fontStyle: 'bold' },
    );
  });

  ov.paragraph(
    'Any three wins at the front take its town, if the depots make enough to hold it. When the ' +
      'front is quiet for 36 hours, the enemy strikes back at the town behind it, cutting a road ' +
      'to the front, and again a day later. A cut road’s front post cannot be raided until the ' +
      'ground is retaken, and if the whole town behind the front falls, the front falls back to ' +
      'it. Every town held takes supplies an hour from what the depots make, more the further it ' +
      'is from home, and a front they cannot feed loses ground until they can.',
    font.tiny,
    COLORS.inkDim,
    { gapAfter: gap },
  );
  const supply = supplyText(town, opts.now);
  const clock = clockLine(town, opts.now);
  if (supply) {
    ov.paragraph(supply.text, font.tiny, supply.urgent ? COLORS.signal : COLORS.ink, {
      gapAfter: clock ? gap : gap * 2,
    });
  }
  if (clock) {
    ov.paragraph(clock.text, font.tiny, clock.urgent ? COLORS.signal : COLORS.ink, { gapAfter: gap * 2 });
  }

  const scoutedTag = (s: Sector): string => (isScouted(town, s.tier, s.lane.slot) ? ' · SCOUTED' : '');
  const shapeOf = (s: Sector): string => ARCHETYPE_BY_ID[s.base.archetype]?.short ?? s.base.archetype;

  // The three front posts, left to right as the map draws their lanes.
  t.lanes.forEach((lane) => {
    const sector = sectorOf(town, lane.slot);
    const open = sector.cutAt === null;
    const button = ov.flowButton(
      `${lane.name} — ${sector.town}`,
      () => opts.onRaid?.({ tier: sector.tier, slot: lane.slot }),
      {
        align: 'left',
        sub: open
          ? `${sector.band} · ${shapeOf(sector)}${scoutedTag(sector)}`
          : `CUT AT ${sector.cutAt}`,
      },
    );
    if (!opts.onRaid || !open) button.setEnabled(false);
  });
  // And the ground to take back, nearest the front first.
  for (const sector of retakes(town)) {
    const button = ov.flowButton(
      `RETAKE ${sector.lane.name} — ${sector.town}`,
      () => opts.onRaid?.({ tier: sector.tier, slot: sector.lane.slot }),
      { align: 'left', sub: `T${sector.tier} · ${sector.band} · ${shapeOf(sector)}${scoutedTag(sector)}` },
    );
    if (!opts.onRaid) button.setEnabled(false);
  }

  ov.footer('CLOSE', opts.onClose);
  return ov;
}
