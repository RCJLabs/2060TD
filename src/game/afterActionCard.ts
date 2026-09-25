/**
 * The after-action report as a card (M29 Phase 1): what killed the force,
 * what each squad did and lost, and when the kill chain fell.
 *
 * One card for both places a raid is looked back on, the result of the raid
 * just fought and a raid watched again, so the two cannot read differently.
 * It is handed the report (`meta/afteraction.ts`) and the names to read it
 * in, and draws nothing that is not in the report. Where it happened is the
 * heat map's (Phase 2), which ON THE MAP opens, and what one change would
 * have done is the what-if card's (Phase 3), which WHAT IF opens.
 */
import type { FactionId } from '../content/factions';
import { squadName } from '../content/veterancy';
import type { AfterAction, SquadActivity } from '../meta/afteraction';
import { CHAIN_ORDER, CHAIN_STAGE_NAME, chainStalledAt } from '../sim/killchain';
import { TICKS_PER_SECOND } from '../sim/engine';
import type { Catalog } from '../sim/types';
import { createOverlay, type OverlayApi } from './dom/overlay';
import type { Layout } from './layout';
import { COLORS } from './palette';
import { DAMAGE_NAMES } from './spec';
import type { Scene } from './stage';

/** What a squad was doing, in the words a debrief uses, in the order a raid goes in. */
const ACTIVITY: readonly [SquadActivity, string][] = [
  ['moving', 'on the move'],
  ['breaking', 'cutting the wire'],
  ['engaging', 'in the fight'],
  ['assaulting', 'at the post'],
  ['stuck', 'stuck'],
  ['pinned', 'pinned down'],
];

export interface AfterActionCardOptions {
  layout: Layout;
  /** The base the raid went for. */
  title: string;
  faction: FactionId;
  /** The raid's catalog: the enemy's structures, to name what killed the men. */
  catalog: Catalog;
  /** A unit kind's short name, as the muster writes it. */
  unit: (kind: string) => string;
  /** Whether the battle was fought on the kill chain (it names stages only if so). */
  chain: boolean;
  /** Show where it happened (Phase 2): the replay's heat map, at the battle's end. */
  onMap?: () => void;
  /** Fight it again with one thing changed (Phase 3); absent where the raid's plan cannot be proven. */
  onWhatIf?: () => void;
  onClose: () => void;
}

const seconds = (ticks: number): string => `${Math.round(ticks / TICKS_PER_SECOND)}s`;

export function buildAfterActionCard(scene: Scene, report: AfterAction, opts: AfterActionCardOptions): OverlayApi {
  const { layout, catalog } = opts;
  const ov = createOverlay(scene, layout, { title: 'AFTER ACTION', subtitle: opts.title });
  const { font, gap } = layout;
  const heading = (text: string): void => {
    ov.flow(gap, 0);
    ov.paragraph(text, font.label, COLORS.signal, { gapAfter: Math.round(gap / 2) });
  };
  const nameOf = (by: string | null): string =>
    by === null ? 'UNKNOWN' : (catalog.structures[by]?.name ?? catalog.powers[by]?.name ?? by).toUpperCase();

  heading('WHAT KILLED THEM');
  ov.paragraph(
    report.killers.length === 0
      ? 'Nothing did: every man who went in came out.'
      : report.killers
          .map(
            (k) =>
              `${nameOf(k.by)} — ${k.kills}` + (k.damageType ? ` (${DAMAGE_NAMES[k.damageType]})` : ''),
          )
          .join('\n'),
    font.body,
    COLORS.ink,
    { gapAfter: gap },
  );

  heading('THE SQUADS');
  for (const squad of report.squads) {
    const lost = Object.entries(squad.lost)
      .map(([kind, n]) => `${n} ${opts.unit(kind)}`)
      .join(', ');
    const by = Object.entries(squad.killedBy)
      .sort((a, b) => b[1] - a[1])
      .map(([killer, n]) => `${nameOf(killer === 'unknown' ? null : killer)} ${n}`)
      .join(', ');
    const time = ACTIVITY.filter(([activity]) => Math.round(squad.seconds[activity]) > 0)
      .map(([activity, words]) => `${Math.round(squad.seconds[activity])}s ${words}`)
      .join(' · ');
    const lines = [
      lost ? `Lost ${lost}: ${by}` : 'Lost nobody.',
      ...(time ? [time] : []),
      ...(squad.late > 0 ? [`${squad.late} still on the way in when it ended`] : []),
    ];
    ov.paragraph(`${squadName(opts.faction, squad.slot)} — ${squad.back} of ${squad.sent} back`, font.body, COLORS.ink, {
      gapAfter: Math.round(gap / 3),
    });
    ov.paragraph(lines.join('\n'), font.body, COLORS.inkDim, { gapAfter: gap });
  }

  if (opts.chain) {
    heading('THE CHAIN');
    const fell = report.stages.map((tick, i) => `${CHAIN_STAGE_NAME[CHAIN_ORDER[i]!]} T+${seconds(tick)}`);
    const since = report.stages.length > 0 ? report.stages[report.stages.length - 1]! : 0;
    const stall = report.cleared
      ? []
      : [
          report.withdrew
            ? 'Withdrew on the objective.'
            : `Stalled at ${chainStalledAt(report.stages.length)} for ${seconds(report.ticks - since)}.`,
        ];
    ov.paragraph([fell.length > 0 ? fell.join(' · ') : 'Never breached.', ...stall].join('\n'), font.body, COLORS.ink, {
      gapAfter: gap,
    });
  }

  const footers: [string, () => void][] = [
    ...(opts.onMap ? [['ON THE MAP', opts.onMap] as [string, () => void]] : []),
    ...(opts.onWhatIf ? [['WHAT IF', opts.onWhatIf] as [string, () => void]] : []),
    ['CLOSE', opts.onClose],
  ];
  footers.forEach(([label, onTap], i) => ov.footer(label, onTap, i, footers.length));
  return ov;
}
