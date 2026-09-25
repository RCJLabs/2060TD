/**
 * The factions' signatures (M26): one rule each, the verb GDD §4 gave the
 * faction and the game never built, so the five wars are different games on
 * the same map rather than one game with five price lists.
 *
 *     faction  signature          where it acts
 *     USA      Rapid Response     "few, expensive, excellent": field defences
 *                                 with more HP and damage at a higher price,
 *                                 and half the CP back for one that lives
 *                                 through its wave (the sim)
 *     China    Production Surge   training costs half for half an hour
 *                                 after a battle fought (the town)
 *     Russia   Overbuilt          a fallen emplacement burns on as a hulk,
 *                                 and its concrete is trimmed by as much as
 *                                 the hulk gives back (the sim)
 *     UN       Mandate            one doctrine buff picked for each defence
 *                                 (the mods every town battle carries)
 *     KPA      the tunnel         unchanged: its best raid goes under the maze
 *
 * The sim's two ride the config with their numbers (`Signature`), and the
 * Mandate rides the mods research already sets, so a replay re-fights under
 * the rule it was fought under after a re-tune moves these. The surge is town
 * state, a time on the save.
 *
 * Phase 1 builds them and measures them in the harness. None has a line of UI
 * yet, and a hulk drawn as a live gun or a refund nobody can see is a rule
 * nobody can play, so none is fought in the game until Phase 3 gives it one:
 * `signaturesLive` is off, and only the instruments and the tests turn it on.
 */
import type { DefenderMods, Signature } from '../sim/types';
import type { FactionId } from './factions';

/** Rapid Response (USA): the share of its CP price a field defence pays back for living through its wave. */
export const RAPID_RESPONSE_REFUND = 0.5;

/**
 * Rapid Response's kit (USA, M26 Phase 3): each field defence 30% more HP and
 * damage, at twice the CP, and half of that back if it lives through its wave.
 * The refund alone measured inside the noise even at the full price back; the
 * five field kits are one kit, so what fits the USA is a kit of its own.
 *
 * Sized against THE HOLD: at 1.5 times the stats it took the USA past Russia
 * at CC3, the reading Russia leads, and widened the gap. At 1.3 it adds 2.35
 * levels to the CC2 base and 1.00 to the CC3, spending on the approach, inside
 * the room the leaders leave. The price barely moves it there, since a
 * commander who stops at six a wave rarely runs short of CP; it is what makes
 * a survivor worth keeping: a field defence that lives through its wave has
 * cost what the standard one does.
 */
export const RAPID_RESPONSE_KIT = { scale: 1.3, price: 2 } as const;

/** Overbuilt (Russia): how long a fallen emplacement burns on, and at what fraction of itself. */
export const OVERBUILT_HULK = { seconds: 15, strength: 0.25 } as const;

/**
 * Overbuilt's offset (Russia, M26 Phase 3): its emplacements' HP, trimmed by
 * as much as the hulks give back. Russia already leads the defence tables at
 * CC3, and parity is held, so a hulk that added anything there would widen
 * the gap; the concrete goes into the burning instead.
 *
 * Swept at 20 seeds: untrimmed, the hulk adds up to 2.00 levels where Russia
 * leads; at 0.875 it adds between -0.45 and +0.15 on every reading, within the
 * noise, so Russia defends as well as it did, and differently.
 */
export const OVERBUILT_TRIM = 0.875;

/**
 * Production Surge (China): for how long after a battle fought training is
 * cheaper, and what it costs then. A price and not a speed: a unit trains in
 * eight to sixty seconds, so a raid's losses refill in under a minute either
 * way, and what limits a refill is what it costs (Phase 1 measured double
 * speed and found the week at war unchanged).
 */
export const PRODUCTION_SURGE = { minutes: 30, price: 0.5 } as const;

/** The UN's three mandates, one picked for each defence. */
export type MandateId = 'works' | 'deployment' | 'shield';
export const MANDATE_IDS: readonly MandateId[] = ['works', 'deployment', 'shield'];

export interface Mandate {
  id: MandateId;
  name: string;
  /** What it does, in the words the offer uses. */
  detail: string;
  /** How it reaches the sim: research's own multipliers, the post's, and the field defences' HP. */
  mods: Pick<DefenderMods, 'wallHp' | 'cpCost' | 'postHp' | 'fieldHp'>;
}

export const MANDATES: Readonly<Record<MandateId, Mandate>> = {
  works: {
    id: 'works',
    name: 'DEFENSIVE WORKS',
    detail: 'walls 30% sturdier',
    mods: { wallHp: 1.3 },
  },
  // Cheaper and lighter (M26 Phase 3). A cut in price alone added 1.3 to 1.75
  // levels to the UN's CC2 base spending CP, the reading it already leads by
  // five, at any size from 5% off to 25%; lighter field defences pay for it.
  deployment: {
    id: 'deployment',
    name: 'RAPID DEPLOYMENT',
    detail: 'field defences, HESCOs and fire missions 25% cheaper; field defences 20% lighter',
    mods: { cpCost: 0.75, fieldHp: 0.8 },
  },
  shield: {
    id: 'shield',
    name: 'HUMANITARIAN SHIELD',
    detail: 'the post 30% harder to take',
    mods: { postHp: 1.3 },
  },
};

/**
 * The mandate a town that never chose one fights under (M26 Phase 3): the
 * shield, the one mandate that measured a little better on almost every
 * reading and worse on none. Defensive works ranges from nearly a level
 * better to nearly three worse, spending CP at CC2, so it is a choice for a
 * commander who knows their maze, not a default.
 */
export const DEFAULT_MANDATE: MandateId = 'shield';

export const isMandateId = (v: unknown): v is MandateId =>
  typeof v === 'string' && (MANDATE_IDS as readonly string[]).includes(v);

/** The faction's sim rule, with its numbers; none for a faction whose signature is not the sim's. */
export function signatureFor(faction: FactionId): Signature | undefined {
  if (faction === 'usa') return { refund: RAPID_RESPONSE_REFUND, elite: { ...RAPID_RESPONSE_KIT } };
  if (faction === 'russia') return { hulk: { ...OVERBUILT_HULK } };
  return undefined;
}

/** The faction's rule's own defender mods (M26 Phase 3): Russia's trim; none for the others. */
export function signatureModsFor(faction: FactionId): Pick<DefenderMods, 'emplacementHp'> {
  return faction === 'russia' ? { emplacementHp: OVERBUILT_TRIM } : {};
}

let live = false;

/** Whether the signatures are fought in the game. Off until Phase 3; see the file's note. */
export const signaturesLive = (): boolean => live;

/** For the instruments and the tests, which measure the game with the signatures in it. */
export function setSignaturesLive(on: boolean): void {
  live = on;
}
