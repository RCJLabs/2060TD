/**
 * A siege's after-action report as a card (M35 Phase 3): what killed the
 * enemy, what the post went through, what the siege cost and the orders the
 * commander gave.
 *
 * The raid's card (`afterActionCard.ts`) tells a raid in squads; a siege has
 * waves and a commander, and is told in guns and orders instead. It is handed
 * the report (`meta/siegerecord.ts`) and draws nothing that is not in it.
 * Where it happened is the heat map's, which ON THE MAP opens, and what one
 * order changed would have done is the what-if card's, which WHAT IF opens.
 */
import type { SiegeReport } from '../meta/siegerecord';
import { TICKS_PER_SECOND } from '../sim/engine';
import { CHAIN_ORDER, CHAIN_STAGE_NAME } from '../sim/killchain';
import type { Catalog } from '../sim/types';
import { createOverlay, type OverlayApi } from './dom/overlay';
import type { Layout } from './layout';
import { COLORS } from './palette';
import { DAMAGE_NAMES } from './spec';
import type { Scene } from './stage';

export interface SiegeReportCardOptions {
  layout: Layout;
  /** The siege, as the shelf names it. */
  title: string;
  /** The siege's catalog: the town's guns and strikes, and the enemy's men. */
  catalog: Catalog;
  /** Whether the siege was fought on the kill chain (it names stages only if so). */
  chain: boolean;
  /** Show where it happened: the footage's end, heat map and all. */
  onMap?: () => void;
  /** Fight it again with one order changed; absent on a what-if's own footage. */
  onWhatIf?: () => void;
  onClose: () => void;
}

const seconds = (ticks: number): string => `T+${Math.round(ticks / TICKS_PER_SECOND)}s`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export function buildSiegeReportCard(scene: Scene, report: SiegeReport, opts: SiegeReportCardOptions): OverlayApi {
  const { layout, catalog } = opts;
  const ov = createOverlay(scene, layout, { title: 'AFTER ACTION', subtitle: opts.title });
  const { font, gap } = layout;
  const heading = (text: string): void => {
    ov.flow(gap, 0);
    ov.paragraph(text, font.label, COLORS.signal, { gapAfter: Math.round(gap / 2) });
  };
  const body = (text: string): void => {
    ov.paragraph(text, font.body, COLORS.ink, { gapAfter: gap });
  };
  const nameOf = (by: string | null): string =>
    by === null ? 'UNKNOWN' : (catalog.structures[by]?.name ?? catalog.powers[by]?.name ?? by).toUpperCase();
  const { result, orders } = report;

  body(
    `${result.held ? 'HELD' : 'BROKE THROUGH'} at ${seconds(result.ticks)}. ` +
      `${report.kills} of the ${report.spawned} who came were killed.`,
  );

  heading('WHAT KILLED THEM');
  body(
    report.killers.length === 0
      ? 'Nothing did: not one of them fell.'
      : report.killers
          .map((k) => `${nameOf(k.by)} — ${k.kills}` + (k.damageType ? ` (${DAMAGE_NAMES[k.damageType]})` : ''))
          .join('\n'),
  );

  heading('THE POST');
  const post: string[] = [
    !result.held
      ? `Destroyed at ${seconds(result.ticks)}.`
      : result.low >= 1
        ? 'Never touched.'
        : `Down to ${Math.round(result.low * 100)}% at its lowest.`,
  ];
  if (opts.chain) {
    const fell = report.stages.map((tick, i) => `${CHAIN_STAGE_NAME[CHAIN_ORDER[i]!]} ${seconds(tick)}`);
    post.push(fell.length > 0 ? `The chain: ${fell.join(' · ')}` : 'The chain was never breached.');
  }
  if (report.postKiller) {
    post.push(`Killing blow: ${(catalog.attackers[report.postKiller]?.name ?? report.postKiller).toUpperCase()}`);
  }
  body(post.join('\n'));

  heading('WHAT IT COST');
  body(
    [
      `${plural(result.buildings, 'structure')}, ${plural(result.field, 'field defence')} and ${plural(result.walls, 'wall')} lost.`,
      `${report.cp} CP and ${report.supplies} supplies spent.`,
    ].join('\n'),
  );

  heading('THE ORDERS');
  const given = [
    orders.placements > 0 ? `${orders.placements} placed` : '',
    orders.strikes > 0 ? plural(orders.strikes, 'strike') : '',
    orders.moves > 0 ? `${orders.moves} moved` : '',
    orders.sales > 0 ? `${orders.sales} sold` : '',
    orders.upgrades > 0 ? `${orders.upgrades} upgraded` : '',
    orders.gates > 0 ? `the gate worked ${plural(orders.gates, 'time')}` : '',
    orders.repairs > 0 ? plural(orders.repairs, 'repair') : '',
    orders.walls > 0 ? `${plural(orders.walls, 'wall')} laid` : '',
  ].filter((s) => s.length > 0);
  body(given.length > 0 ? given.join(' · ') : 'None: the town fought it on its own.');

  const footers: [string, () => void][] = [
    ...(opts.onMap ? [['ON THE MAP', opts.onMap] as [string, () => void]] : []),
    ...(opts.onWhatIf ? [['WHAT IF', opts.onWhatIf] as [string, () => void]] : []),
    ['CLOSE', opts.onClose],
  ];
  footers.forEach(([label, onTap], i) => ov.footer(label, onTap, i, footers.length));
  return ov;
}
