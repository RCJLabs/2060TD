/**
 * The what-if card (M29 Phase 3): the raid as fought beside the same raid with
 * one thing changed.
 *
 * Three rows pick the change, each stepping on a tap: the squad, what kind of
 * change, and the change itself. The answer is fought as soon as a row moves,
 * a few dozen milliseconds, and set under them: the two raids on the raid's
 * own dice, then both plans over ten more rolls. It is handed a raid ready to
 * be asked (`Counterfactual`) and the names to answer in.
 */
import type { FactionId } from '../content/factions';
import { squadName } from '../content/veterancy';
import {
  CHANGE_KINDS,
  choicesFor,
  WHAT_IF_ROLLS,
  type Change,
  type ChangeKind,
  type Counterfactual,
  type Outcome,
  type WhatIf,
} from '../meta/counterfactual';
import type { ObjectiveId } from '../meta/objectives';
import type { SectorId } from '../meta/warfare';
import { CHAIN_STAGE_NAME, chainStalledAt } from '../sim/killchain';
import { TICKS_PER_SECOND } from '../sim/engine';
import type { Doctrine } from '../sim/types';
import { createOverlay, type OverlayApi } from './dom/overlay';
import type { Layout } from './layout';
import { COLORS } from './palette';
import type { Scene } from './stage';

export interface WhatIfCardOptions {
  layout: Layout;
  /** The base the raid went for. */
  title: string;
  faction: FactionId;
  counterfactual: Counterfactual;
  /** A unit kind's name, as the muster writes it. */
  unitName: (kind: string) => string;
  objective: ObjectiveId;
  /** Whether the raid was fought on the kill chain (it names stages only if so). */
  chain: boolean;
  /** Watch the changed raid; `what` says the change in words. */
  onWatch: (answer: WhatIf, what: string) => void;
  /** Make this change to the plan the planner reopens with (only for the raid just fought). */
  onPlan?: (change: Change) => void;
  onBack: () => void;
}

const KIND_NAME: Record<ChangeKind, string> = {
  more: 'ONE MORE',
  fewer: 'ONE FEWER',
  entry: 'ENTRY SECTOR',
  doctrine: 'DOCTRINE',
  start: 'START',
};

const DOCTRINE_NAME: Record<Doctrine, string> = { assault: 'ASSAULT', hunt: 'HUNT', raze: 'RAZE' };

/** What a raid that did the job did, by what it came for. */
const DID: Record<ObjectiveId, string> = {
  post: 'took the post',
  guns: 'spiked the guns',
  stores: 'raided the stores',
};

const seconds = (ticks: number): string => `T+${Math.round(ticks / TICKS_PER_SECOND)}s`;

export function buildWhatIfCard(scene: Scene, opts: WhatIfCardOptions): OverlayApi {
  const { layout, counterfactual: cf } = opts;
  const ov = createOverlay(scene, layout, { title: 'WHAT IF', subtitle: opts.title });
  const { font, gap } = layout;
  const squadLabel = (slot: number): string => squadName(opts.faction, slot);

  ov.paragraph(
    'The same raid, fought again with one thing changed: the same post, the same day, the same dice.',
    font.tiny,
    COLORS.inkDim,
    { gapAfter: gap },
  );

  // What the rows are pointing at. Each row steps its own list, and a squad
  // or kind that changes starts the rows below it at their first choice.
  let squadAt = 0;
  let kindAt = 0;
  let valueAt = 0;
  const slots = cf.plan.map((s) => s.slot ?? 0);
  const choices = () => choicesFor(cf.plan, slots[squadAt]!, cf.trainable);
  const kinds = (): ChangeKind[] => CHANGE_KINDS.filter((kind) => choices()[kind].length > 0);
  const kind = (): ChangeKind => kinds()[kindAt]!;
  const values = (): (string | number)[] => choices()[kind()];

  const change = (): Change => {
    const slot = slots[squadAt]!;
    const value = values()[valueAt]!;
    switch (kind()) {
      case 'more':
      case 'fewer':
        return { slot, kind: kind() as 'more' | 'fewer', unit: value as string };
      case 'entry':
        return { slot, kind: 'entry', sector: value as SectorId };
      case 'doctrine':
        return { slot, kind: 'doctrine', doctrine: value as Doctrine };
      case 'start':
        return { slot, kind: 'start', seconds: value as number };
    }
  };

  const valueName = (c: Change): string => {
    switch (c.kind) {
      case 'more':
      case 'fewer':
        return opts.unitName(c.unit).toUpperCase();
      case 'entry':
        return `IN BY ${c.sector}`;
      case 'doctrine':
        return DOCTRINE_NAME[c.doctrine];
      case 'start':
        return `IN AT T+${c.seconds}s`;
    }
  };

  /** The change in words, as the answer and the footage are headed. */
  const describe = (c: Change): string => {
    const squad = squadLabel(c.slot);
    switch (c.kind) {
      case 'more':
        return `one more ${opts.unitName(c.unit)} in ${squad}`;
      case 'fewer':
        return `one ${opts.unitName(c.unit)} fewer in ${squad}`;
      case 'entry':
        return `${squad} in by ${c.sector}`;
      case 'doctrine':
        return `${squad} on ${DOCTRINE_NAME[c.doctrine]}`;
      case 'start':
        return `${squad} in at T+${c.seconds}s`;
    }
  };

  const ended = (o: Outcome): string => {
    const how = o.cleared
      ? 'took the post'
      : o.withdrew
        ? `${DID[opts.objective]} and withdrew`
        : opts.chain
          ? `repelled, stalled at ${chainStalledAt(o.stages)}`
          : 'repelled';
    return `${how}, ${seconds(o.ticks)}, ${o.lost} of ${o.sent} lost`;
  };

  const answerText = (a: WhatIf): string => {
    const lines = [`As fought: ${ended(a.fought)}.`, `With ${describe(a.change)}: ${ended(a.changed)}.`];
    if (a.rolls) {
      const tally = (r: { done: number; lost: number }): string =>
        `${DID[opts.objective]} ${r.done} times in ${WHAT_IF_ROLLS}, ${r.lost.toFixed(1)} lost on average`;
      lines.push('', `Over ${WHAT_IF_ROLLS} more rolls of the dice:`);
      lines.push(`As fought, it ${tally(a.rolls.fought)}.`, `With the change, it ${tally(a.rolls.changed)}.`);
    } else {
      lines.push('', 'A duel’s dice are fixed: this is the only roll there is.');
    }
    return lines.join('\n');
  };

  const squadRow = ov.flowButton('', () => step('squad'), { sub: 'NEXT ▸', align: 'left', gapAfter: Math.round(gap / 2) });
  const kindRow = ov.flowButton('', () => step('kind'), { sub: 'NEXT ▸', align: 'left', gapAfter: Math.round(gap / 2) });
  const valueRow = ov.flowButton('', () => step('value'), { sub: 'NEXT ▸', align: 'left', gapAfter: gap });
  // The answer is set in place as the rows move, so its block is laid out for
  // the longest one there can be, in this card's own font and width: the
  // longest unit and squad names, a stall, and every man lost. Nothing
  // shorter can run past it.
  const longest = (names: string[]): string => names.reduce((a, b) => (b.length > a.length ? b : a), '');
  const worstEnd = `repelled, stalled at ${longest(Object.values(CHAIN_STAGE_NAME))}, T+300s, 88 of 88 lost`;
  const worstDid = longest(Object.values(DID));
  const worst = [
    `As fought: ${worstEnd}.`,
    `With one ${longest(cf.trainable.map((t) => opts.unitName(t.kind)))} fewer in ${longest(slots.map(squadLabel))}: ${worstEnd}.`,
    '',
    `Over ${WHAT_IF_ROLLS} more rolls of the dice:`,
    `As fought, it ${worstDid} ${WHAT_IF_ROLLS} times in ${WHAT_IF_ROLLS}, 88.8 lost on average.`,
    `With the change, it ${worstDid} ${WHAT_IF_ROLLS} times in ${WHAT_IF_ROLLS}, 88.8 lost on average.`,
  ].join('\n');
  const answer = ov.paragraph(worst, font.body, COLORS.ink);

  let current: WhatIf | null = null;
  const plan = opts.onPlan
    ? ov.footer('INTO THE PLAN', () => {
        if (!current) return;
        opts.onPlan!(current.change);
        plan!.setLabel('IN THE PLAN');
        plan!.setEnabled(false);
      }, 1, 3)
    : null;
  ov.footer('WATCH IT', () => current && opts.onWatch(current, describe(current.change)), 0, plan ? 3 : 2);
  ov.footer('BACK', opts.onBack, plan ? 2 : 1, plan ? 3 : 2);

  const refresh = (): void => {
    const c = change();
    squadRow.setLabel(`SQUAD — ${squadLabel(c.slot)}`);
    kindRow.setLabel(`CHANGE — ${KIND_NAME[c.kind]}`);
    valueRow.setLabel(valueName(c));
    current = cf.whatIf(c);
    answer.setText(answerText(current));
    plan?.setLabel('INTO THE PLAN');
    plan?.setEnabled(true);
  };

  function step(row: 'squad' | 'kind' | 'value'): void {
    if (row === 'squad') {
      squadAt = (squadAt + 1) % slots.length;
      kindAt = 0;
      valueAt = 0;
    } else if (row === 'kind') {
      kindAt = (kindAt + 1) % kinds().length;
      valueAt = 0;
    } else {
      valueAt = (valueAt + 1) % values().length;
    }
    refresh();
  }

  refresh();
  return ov;
}
