/**
 * The defence what-if (M35 Phase 3): the siege as fought beside the same siege
 * with one order changed.
 *
 * Two cards. The first lists the orders the siege was given, each with its
 * time and what it was; a tap on one opens the second, which drops that order
 * or moves it ten seconds either way. The changed siege is fought on its own
 * dice and over the rolls, twenty-odd battles in all, a slice at a time so the
 * screen stays alive, and the answer is set under the changes when it is in.
 */
import {
  ORDER_SHIFT_SECONDS,
  withOrderChange,
  type OrderChange,
  type OrderEntry,
  type SiegeCounterfactual,
  type SiegeResult,
  type SiegeWhatIf,
} from '../meta/siegerecord';
import { WHAT_IF_ROLLS } from '../meta/counterfactual';
import { TICKS_PER_SECOND } from '../sim/engine';
import type { Catalog } from '../sim/types';
import { createOverlay, type OverlayApi } from './dom/overlay';
import type { Layout } from './layout';
import { COLORS } from './palette';
import type { Scene } from './stage';

const seconds = (ticks: number): string => `T+${Math.round(ticks / TICKS_PER_SECOND)}s`;
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** An order in words, as both cards and the footage it plays name it. */
export function describeOrder(entry: OrderEntry, catalog: Catalog): string {
  const name = (entry.kind === null
    ? 'IT'
    : (catalog.structures[entry.kind]?.name ?? catalog.powers[entry.kind]?.name ?? catalog.walls[entry.kind]?.name ?? entry.kind)
  ).toUpperCase();
  switch (entry.cmd.type) {
    case 'placeStructure':
      return `${name} PLACED`;
    case 'removeStructure':
      return `${name} TAKEN DOWN`;
    case 'sellStructure':
      return `${name} SOLD`;
    case 'moveStructure':
      return `${name} MOVED`;
    case 'upgradeStructure':
      return `${name} UPGRADED`;
    case 'castPower':
      return `${name} CALLED`;
    case 'toggleGate':
      return 'GATE WORKED';
    case 'repairAll':
      return 'REPAIRS ORDERED';
    default:
      return entry.cmd.type.toUpperCase();
  }
}

export interface SiegeOrdersCardOptions {
  layout: Layout;
  title: string;
  catalog: Catalog;
  orders: readonly OrderEntry[];
  onPick: (entry: OrderEntry) => void;
  onBack: () => void;
}

/** The orders the siege was given, to pick the one to change. */
export function buildSiegeOrdersCard(scene: Scene, opts: SiegeOrdersCardOptions): OverlayApi {
  const { layout } = opts;
  const ov = createOverlay(scene, layout, { title: 'WHAT IF', subtitle: opts.title });
  const { font, gap } = layout;
  if (opts.orders.length === 0) {
    ov.paragraph('No orders to change: the town fought this siege on its own.', font.body, COLORS.ink, { gapAfter: gap });
  } else {
    ov.paragraph(
      `Pick one order, and fight the siege again without it, or with it ${ORDER_SHIFT_SECONDS} seconds sooner or later: the same waves, the same dice.`,
      font.tiny,
      COLORS.inkDim,
      { gapAfter: gap },
    );
    for (const entry of opts.orders) {
      ov.flowButton(describeOrder(entry, opts.catalog), () => opts.onPick(entry), {
        align: 'left',
        sub: seconds(entry.cmd.tick),
        gapAfter: Math.round(gap / 2),
      });
    }
  }
  ov.footer('BACK', opts.onBack, 0, 1);
  return ov;
}

export interface SiegeWhatIfCardOptions {
  layout: Layout;
  title: string;
  catalog: Catalog;
  counterfactual: SiegeCounterfactual;
  entry: OrderEntry;
  /** What was already asked of this siege: an answer is not fought twice. */
  answers: Map<string, SiegeWhatIf>;
  /** Watch the changed siege; `what` says the change in words. */
  onWatch: (answer: SiegeWhatIf, what: string) => void;
  /** Back to the list of orders. */
  onOrders: () => void;
}

const CHANGE_LABEL: Record<OrderChange, string> = {
  without: 'WITHOUT IT',
  sooner: `${ORDER_SHIFT_SECONDS}s SOONER`,
  later: `${ORDER_SHIFT_SECONDS}s LATER`,
};

const CHANGE_WORDS: Record<OrderChange, string> = {
  without: 'Without it',
  sooner: `${ORDER_SHIFT_SECONDS}s sooner`,
  later: `${ORDER_SHIFT_SECONDS}s later`,
};

/** One order, and what dropping or moving it would have done. */
export function buildSiegeWhatIfCard(scene: Scene, opts: SiegeWhatIfCardOptions): OverlayApi {
  const { layout, entry, counterfactual: cf } = opts;
  const what = describeOrder(entry, opts.catalog);
  const ov = createOverlay(scene, layout, { title: 'WHAT IF', subtitle: `${seconds(entry.cmd.tick)} — ${what}` });
  const { font, gap } = layout;
  const moved = (change: OrderChange): number =>
    change === 'without' ? entry.cmd.tick : withOrderChange([entry.cmd], { index: 0, change })[0]!.tick;

  ov.paragraph(
    'The same siege, fought again with this one order changed: the same waves, the same dice.',
    font.tiny,
    COLORS.inkDim,
    { gapAfter: gap },
  );

  const ended = (r: SiegeResult): string => {
    const lost = `${plural(r.buildings, 'structure')} lost`;
    if (!r.held) return `broke through at ${seconds(r.ticks)}, ${lost}`;
    return `held, the post ${r.low >= 1 ? 'untouched' : `down to ${Math.round(r.low * 100)}%`}, ${lost}`;
  };
  const answerText = (a: SiegeWhatIf): string => {
    const change = a.change.change;
    const lines = [`As fought: ${ended(a.fought)}.`, `${CHANGE_WORDS[change]}: ${ended(a.changed)}.`];
    if (a.took === false) {
      lines.push(`At ${seconds(moved(change))} the order could not be carried out, and was refused, as it would have been.`);
    }
    lines.push(
      '',
      `Over ${WHAT_IF_ROLLS} more rolls of the dice:`,
      `As fought, it held ${a.rolls.fought} times in ${WHAT_IF_ROLLS}.`,
      `With the change, it held ${a.rolls.changed} times in ${WHAT_IF_ROLLS}.`,
    );
    return lines.join('\n');
  };

  const rows = new Map<OrderChange, ReturnType<OverlayApi['flowButton']>>();
  for (const change of ['without', 'sooner', 'later'] as const) {
    const row = ov.flowButton(CHANGE_LABEL[change], () => ask(change), {
      align: 'left',
      sub: change === 'without' ? '' : seconds(moved(change)),
      gapAfter: Math.round(gap / 2),
    });
    // A move that goes nowhere (an order at the first tick, taken sooner) is no change.
    if (moved(change) === entry.cmd.tick && change !== 'without') row.setEnabled(false);
    rows.set(change, row);
  }
  ov.flow(gap, 0);
  // The block is laid out for the longest answer there can be, so none runs past it.
  const worstEnd = 'held, the post down to 100%, 888 structures lost';
  const worst = [
    `As fought: ${worstEnd}.`,
    `${CHANGE_WORDS.without}: ${worstEnd}.`,
    'At T+9999s the order could not be carried out, and was refused, as it would have been.',
    '',
    `Over ${WHAT_IF_ROLLS} more rolls of the dice:`,
    `As fought, it held ${WHAT_IF_ROLLS} times in ${WHAT_IF_ROLLS}.`,
    `With the change, it held ${WHAT_IF_ROLLS} times in ${WHAT_IF_ROLLS}.`,
  ].join('\n');
  const answer = ov.paragraph(worst, font.body, COLORS.ink);
  answer.setText('Pick a change, and the siege is fought again with it.');

  let current: SiegeWhatIf | null = null;
  let job = 0;
  const watch = ov.footer(
    'WATCH IT',
    () => {
      if (!current) return;
      const change = current.change.change;
      opts.onWatch(current, change === 'without' ? `WITHOUT ${what} AT ${seconds(entry.cmd.tick)}` : `${what} AT ${seconds(moved(change))}`);
    },
    0,
    2,
  );
  watch.setEnabled(false);
  ov.footer('ORDERS', opts.onOrders, 1, 2);

  function show(a: SiegeWhatIf): void {
    current = a;
    answer.setText(answerText(a));
    watch.setEnabled(true);
  }

  function ask(change: OrderChange): void {
    for (const [c, row] of rows) row.setActive(c === change);
    const key = `${entry.index}:${change}`;
    const kept = opts.answers.get(key);
    job++;
    if (kept) {
      show(kept);
      return;
    }
    current = null;
    watch.setEnabled(false);
    const mine = job;
    const total = cf.battlesToFight;
    const run = cf.fights({ index: entry.index, change });
    let fought = 0;
    answer.setText(`Fighting it again: 0 of ${total}.`);
    // A slice of battles, then the screen's turn: a phone fights a siege in a
    // fraction of a second, and twenty of them in one go would freeze it.
    const slice = (): void => {
      if (mine !== job || !ov.open) return;
      const until = performance.now() + 12;
      for (;;) {
        const step = run.next();
        if (step.done) {
          opts.answers.set(key, step.value);
          show(step.value);
          return;
        }
        fought++;
        if (performance.now() >= until) break;
      }
      answer.setText(`Fighting it again: ${fought} of ${total}.`);
      setTimeout(slice, 0);
    };
    setTimeout(slice, 0);
  }

  return ov;
}
