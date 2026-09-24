/**
 * The theater map (M25 Phase 1): the Front Line drawn as the ground it is.
 *
 * The lanes run up the page from the base toward the enemy's stronghold, one
 * row a town, around the front: held ground behind it in tone, the front
 * outlined with the red line the war has been pushed to, enemy ground ahead
 * in thin ink. Under it are the three front posts, each with its lane, band
 * and shape, and a button that opens the raid planner on it.
 *
 * Ink draws no text, so the names are the overlay's own text laid over the
 * band at the rows it drew.
 */
import { ARCHETYPE_BY_ID } from '../content/bases';
import { createOverlay, type OverlayApi } from './dom/overlay';
import { drawFactionMark } from './glyphs';
import type { Ink } from './ink';
import type { Layout } from './layout';
import { COLORS } from './palette';
import type { Scene } from './stage';
import { sectorOf, theaterView, type TheaterRow } from '../meta/theater';
import type { TownState } from '../meta/town';
import { isScouted } from '../meta/warfare';

export interface TheaterMapOpts {
  layout: Layout;
  town: TownState;
  /**
   * Plan a raid on the front post in `variant`'s lane. Absent where no raid
   * can start from here: a counterattack is owed, or this is a demo board.
   */
  onRaid?: (variant: number) => void;
  onClose: () => void;
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
  const rect = ov.band(
    header + rows.length * rowH,
    (g: Ink, r) => {
      labelW = Math.round(r.w * 0.38);
      lanesX = r.x + labelW;
      laneW = (r.w - labelW) / 3;
      const laneMid = (j: number): number => lanesX + laneW * (j + 0.5);

      // The roads first, under the sectors: ink through held ground, a faint
      // line through the enemy's.
      rows.forEach((row, i) => {
        if (i === rows.length - 1) return;
        const y0 = rowY(i, r.y) + rowH - pad;
        const y1 = rowY(i + 1, r.y) + pad;
        const held = row.state === 'held' || row.state === 'front';
        g.lineStyle(held ? 2 : 1, held ? COLORS.ink : COLORS.disabled, 1);
        for (let j = 0; j < 3; j++) g.lineBetween(laneMid(j), y0, laneMid(j), y1);
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
      if (row.state === 'held') {
        g.fillStyle(COLORS.olive, 1);
        g.fillRect(x, y + pad, w, h);
        g.lineStyle(1.5, COLORS.ink, 1);
        g.strokeRect(x, y + pad, w, h);
      } else if (row.state === 'front') {
        g.fillStyle(COLORS.bgPanel, 1);
        g.fillRect(x, y + pad, w, h);
        g.lineStyle(3, COLORS.ink, 1);
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
  // of it centred in its row.
  const middle = Math.round((rowH - Math.round(font.tiny * 1.2)) / 2);
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
    ov.text(
      { x: rect.x, y: rowY(i, rect.y) + middle, w: labelW - gutter, h: rowH },
      row.state === 'home' ? `${row.name} · BASE` : row.name,
      font.tiny,
      color,
      { align: 'right', ...(bold ? { fontStyle: 'bold' } : {}) },
    );
  });
  // Each front sector names its post.
  const frontAt = rows.findIndex((row) => row.state === 'front');
  t.lanes.forEach((lane, j) => {
    const base = sectorOf(town, lane.slot).base;
    ov.centered(
      { x: rect.x + labelW + laneW * j, y: rowY(frontAt, rect.y) + middle, w: laneW, h: rowH },
      ARCHETYPE_BY_ID[base.archetype]?.short ?? base.archetype,
      font.tiny,
      COLORS.ink,
      { fontStyle: 'bold' },
    );
  });

  ov.paragraph(
    'Any three wins at the front take its town, and the next one comes into range. ' +
      'Each lane is a band of the rung: the heavy fight, the middle one, and the one you can take today.',
    font.tiny,
    COLORS.inkDim,
    { gapAfter: gap * 2 },
  );

  // The three front posts, left to right as the map draws their lanes.
  t.lanes.forEach((lane) => {
    const sector = sectorOf(town, lane.slot);
    const shape = ARCHETYPE_BY_ID[sector.base.archetype];
    const scouted = isScouted(town, sector.tier, lane.slot);
    const button = ov.flowButton(
      `${lane.name} — ${sector.town}`,
      () => opts.onRaid?.(lane.slot),
      {
        align: 'left',
        sub: `${sector.band} · ${shape?.short ?? sector.base.archetype}${scouted ? ' · SCOUTED' : ''}`,
      },
    );
    if (!opts.onRaid) button.setEnabled(false);
  });

  ov.footer('CLOSE', opts.onClose);
  return ov;
}
