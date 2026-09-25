/**
 * The factions' signatures (M26): one rule each, the verb GDD §4 gave the
 * faction and the game never built, so the five wars are different games on
 * the same map rather than one game with five price lists.
 *
 *     faction  signature          where it acts
 *     USA      Rapid Response     a field defence that lives through its wave
 *                                 pays back half its CP (the sim, wave's end)
 *     China    Production Surge   training runs at double speed for half an
 *                                 hour after a battle fought (the town)
 *     Russia   Overbuilt          a fallen emplacement burns on as a hulk
 *                                 (the sim, at a structure's death)
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

/** Overbuilt (Russia): how long a fallen emplacement burns on, and at what fraction of itself. */
export const OVERBUILT_HULK = { seconds: 15, strength: 0.25 } as const;

/** Production Surge (China): minutes of faster training after a battle fought, and how much faster. */
export const PRODUCTION_SURGE = { minutes: 30, speed: 2 } as const;

/** The UN's three mandates, one picked for each defence. */
export type MandateId = 'works' | 'deployment' | 'shield';
export const MANDATE_IDS: readonly MandateId[] = ['works', 'deployment', 'shield'];

export interface Mandate {
  id: MandateId;
  name: string;
  /** What it does, in the words the offer uses. */
  detail: string;
  /** How it reaches the sim: research's own multipliers, and the post's. */
  mods: Pick<DefenderMods, 'wallHp' | 'cpCost' | 'postHp'>;
}

export const MANDATES: Readonly<Record<MandateId, Mandate>> = {
  works: {
    id: 'works',
    name: 'DEFENSIVE WORKS',
    detail: 'walls 30% sturdier',
    mods: { wallHp: 1.3 },
  },
  deployment: {
    id: 'deployment',
    name: 'RAPID DEPLOYMENT',
    detail: 'field defences, HESCOs and fire missions 25% cheaper in CP',
    mods: { cpCost: 0.75 },
  },
  shield: {
    id: 'shield',
    name: 'HUMANITARIAN SHIELD',
    detail: 'the post 30% harder to take',
    mods: { postHp: 1.3 },
  },
};

/** The mandate a town that never chose one fights under. */
export const DEFAULT_MANDATE: MandateId = 'works';

export const isMandateId = (v: unknown): v is MandateId =>
  typeof v === 'string' && (MANDATE_IDS as readonly string[]).includes(v);

/** The faction's sim rule, with its numbers; none for a faction whose signature is not the sim's. */
export function signatureFor(faction: FactionId): Signature | undefined {
  if (faction === 'usa') return { refund: RAPID_RESPONSE_REFUND };
  if (faction === 'russia') return { hulk: { ...OVERBUILT_HULK } };
  return undefined;
}

let live = false;

/** Whether the signatures are fought in the game. Off until Phase 3; see the file's note. */
export const signaturesLive = (): boolean => live;

/** For the instruments and the tests, which measure the game with the signatures in it. */
export function setSignaturesLive(on: boolean): void {
  live = on;
}
