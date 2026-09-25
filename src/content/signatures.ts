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
 * Phase 1 built them dormant, since a hulk drawn as a live gun or a refund
 * nobody can see is a rule nobody can play. Phase 3 gave each its line of UI
 * (the hulk burns, the refund is lettered on the board, the mandate is picked
 * in the WAR tab and the defence offers, the surge's clock runs on the
 * training lines) and switched them on. `signaturesLive` stays, so the
 * instruments can measure the game without them.
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
  /** The name at the width of a panel row's tag. */
  short: string;
  /** What it does, in the words the offer uses. */
  detail: string;
  /** How it reaches the sim: research's own multipliers, the post's, and the field defences' HP. */
  mods: Pick<DefenderMods, 'wallHp' | 'cpCost' | 'postHp' | 'fieldHp'>;
}

export const MANDATES: Readonly<Record<MandateId, Mandate>> = {
  works: {
    id: 'works',
    name: 'DEFENSIVE WORKS',
    short: 'WORKS',
    detail: 'walls 30% sturdier',
    mods: { wallHp: 1.3 },
  },
  // Cheaper and lighter (M26 Phase 3). A cut in price alone added 1.3 to 1.75
  // levels to the UN's CC2 base spending CP, the reading it already leads by
  // five, at any size from 5% off to 25%; lighter field defences pay for it.
  deployment: {
    id: 'deployment',
    name: 'RAPID DEPLOYMENT',
    short: 'DEPLOY',
    detail: 'field defences, HESCOs and fire missions 25% cheaper; field defences 20% lighter',
    mods: { cpCost: 0.75, fieldHp: 0.8 },
  },
  shield: {
    id: 'shield',
    name: 'HUMANITARIAN SHIELD',
    short: 'SHIELD',
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

let live = true;

/** Whether the signatures are fought in the game: on since M26 Phase 3; see the file's note. */
export const signaturesLive = (): boolean => live;

/**
 * For the instruments and the tests, which measure the game with and without
 * the signatures. Returns what it was, for the caller to put back.
 */
export function setSignaturesLive(on: boolean): boolean {
  const was = live;
  live = on;
  return was;
}

/**
 * What a battle carries of its faction's rule (M26): the sim's rule with its
 * numbers, and the defender mods on top of what research set: the UN's
 * mandate multiplied into research's walls and prices, the post's HP, the
 * lighter field defences and Russia's trim. Nothing of the rule while the
 * signatures are off.
 *
 * The game's `battleConfig` builds every town battle's from this, and the
 * balance harness its defence battles', so the battle the harness measures is
 * the one the game fights.
 */
export function battleRules(
  faction: FactionId,
  research: Pick<DefenderMods, 'wallHp' | 'weaponDamage' | 'cpCost' | 'postHp'>,
  mandateId: MandateId | undefined,
): { signature?: Signature; defender?: DefenderMods } {
  const signature = live ? signatureFor(faction) : undefined;
  const mandate: Mandate['mods'] = live && faction === 'un' ? MANDATES[mandateId ?? DEFAULT_MANDATE].mods : {};
  const kit = live ? signatureModsFor(faction) : {};
  // Rounded to the thousandth a replay code keeps, so a product of two
  // multipliers re-fights as exactly the number it was fought with.
  const milli = (v: number): number => Math.round(v * 1000) / 1000;
  const weaponDamage = research.weaponDamage ?? 1;
  const wallHp = mandate.wallHp !== undefined ? milli((research.wallHp ?? 1) * mandate.wallHp) : (research.wallHp ?? 1);
  const cpCost = mandate.cpCost !== undefined ? milli((research.cpCost ?? 1) * mandate.cpCost) : (research.cpCost ?? 1);
  // The post's health: the UN's mandate, and FORTIFY's capstone (M28 Phase 2).
  const postHp = milli((mandate.postHp ?? 1) * (research.postHp ?? 1));
  // The rules' own mods, where a rule has one: the post's HP, the trim.
  const extra = {
    ...(postHp !== 1 ? { postHp } : {}),
    ...(mandate.fieldHp !== undefined ? { fieldHp: mandate.fieldHp } : {}),
    ...(kit.emplacementHp !== undefined ? { emplacementHp: kit.emplacementHp } : {}),
  };
  const defender =
    wallHp !== 1 || weaponDamage !== 1 || cpCost !== 1
      ? { wallHp, weaponDamage, cpCost, ...extra }
      : Object.keys(extra).length > 0
        ? extra
        : undefined;
  return { ...(signature ? { signature } : {}), ...(defender ? { defender } : {}) };
}
