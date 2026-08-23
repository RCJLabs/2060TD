import type { AttackerMods, DefenderMods } from '../sim/types';
import { DAY_MS, LADDER_EPOCH } from './leagues';

/**
 * Field conditions (M7): the rotating event on the Front Line. One is in
 * force at a time and they turn over on a fixed daily schedule derived from
 * LADDER_EPOCH — no server, no stored rotation, no way for two saves to
 * disagree about what today is.
 *
 * A condition is a trade, never a straight buff: the easy days pay less
 * standing and less loot, the ugly days pay more. That keeps the rotation a
 * decision — fight today, or wait for a day that suits the army you have.
 *
 * Conditions apply to the Front Line ladder only. Campaign missions are
 * authored, skirmishes are practice, and code duels are somebody else's
 * snapshot — none of them are the front.
 */

export type ConditionId =
  | 'clearline'
  | 'hardrain'
  | 'dugin'
  | 'fuelcrisis'
  | 'blackout'
  | 'attrition';

export interface Condition {
  id: ConditionId;
  label: string;
  /** One line of radio-log framing for the planner. */
  blurb: string;
  /**
   * Terse mechanical summary, and what the day pays. The planner draws them
   * as one row, joined; panel rows wrap since v1.13, so the length cap the
   * suite still enforces is about READING, not about the drawer's width.
   * Prose belongs in `blurb`, which has an overlay to itself.
   */
  effect: string;
  pay: string;
  /** Applied to YOUR raiding units. */
  attacker?: AttackerMods;
  /** Applied to the TARGET's guns and walls. */
  defender?: DefenderMods;
  /** Ladder loot multipliers. */
  loot: { supplies: number; fuel: number };
  /** Standing multiplier on a cleared post. */
  standing: number;
  /**
   * Signals is down: the target cannot be scouted at any price, so the raid
   * is planned against fog. Nothing else in the game blocks scouting, which
   * is exactly why this one is worth waiting out — or worth the risk.
   */
  blackout?: boolean;
}

/**
 * Six conditions, rotating daily. Six and not seven on purpose: a seven-day
 * cycle would pin every condition to the same weekday forever, and the
 * weekend players would only ever see one front.
 */
export const CONDITIONS: Condition[] = [
  {
    id: 'clearline',
    label: 'CLEAR LINE',
    blurb: 'Nothing on the wire. Ordinary day at the ordinary end of a war.',
    effect: 'NO MODIFIERS',
    pay: 'PAYS PAR',
    loot: { supplies: 1, fuel: 1 },
    standing: 1,
  },
  {
    id: 'hardrain',
    label: 'HARD RAIN',
    blurb: 'Three days of it. Their revetments are sliding into the ditches.',
    effect: 'WALLS −30% · GUNS −25%',
    pay: 'PAYS 0.85×',
    defender: { wallHp: 0.7, weaponDamage: 0.75 },
    loot: { supplies: 0.85, fuel: 0.85 },
    standing: 0.85,
  },
  {
    id: 'dugin',
    label: 'DUG IN',
    blurb: 'They had a week to work and they used all of it. Expect concrete.',
    effect: 'WALLS +45% · GUNS +20%',
    pay: 'PAYS 1.45× · LOOT ×1.4',
    defender: { wallHp: 1.45, weaponDamage: 1.2 },
    loot: { supplies: 1.4, fuel: 1.4 },
    standing: 1.45,
  },
  {
    id: 'fuelcrisis',
    label: 'FUEL CRISIS',
    blurb: 'Tanks are running on fumes and promises. Whatever you take, take fuel.',
    effect: 'YOUR HP −10% · DMG −15%',
    pay: 'PAYS 1.3× · FUEL ×1.8',
    attacker: { hp: 0.9, damage: 0.85 },
    loot: { supplies: 1, fuel: 1.8 },
    standing: 1.3,
  },
  {
    id: 'blackout',
    label: 'BLACKOUT',
    blurb: 'Signals is dark on both sides. You go in blind — so do their gunners.',
    effect: 'NO SCOUTING, NO PRICE',
    pay: 'PAYS 1.25×',
    loot: { supplies: 1.05, fuel: 1.05 },
    standing: 1.25,
    blackout: true,
  },
  {
    id: 'attrition',
    label: 'ATTRITION',
    blurb: 'Both sides pushed their veterans forward. It will be quick and it will be expensive.',
    effect: 'YOUR DMG +25% · GUNS +50%',
    pay: 'PAYS 1.3× · LOOT ×1.25',
    attacker: { damage: 1.25 },
    defender: { weaponDamage: 1.5 },
    loot: { supplies: 1.25, fuel: 1.25 },
    standing: 1.3,
  },
];

export const CONDITION_BY_ID: Record<ConditionId, Condition> = Object.fromEntries(
  CONDITIONS.map((c) => [c.id, c]),
) as Record<ConditionId, Condition>;

/** One condition per day, counted from the ladder epoch. */
export const CONDITION_MS = DAY_MS;

/** Floor division that stays correct for clocks set before the epoch. */
function slotAt(now: number): number {
  return Math.floor((now - LADDER_EPOCH) / CONDITION_MS);
}

export function conditionAt(now: number): Condition {
  const slot = slotAt(now);
  const index = ((slot % CONDITIONS.length) + CONDITIONS.length) % CONDITIONS.length;
  return CONDITIONS[index]!;
}

/** When the current condition lifts (epoch ms). */
export function conditionEndsAt(now: number): number {
  return LADDER_EPOCH + (slotAt(now) + 1) * CONDITION_MS;
}

export function conditionAfter(now: number): Condition {
  return conditionAt(conditionEndsAt(now));
}
