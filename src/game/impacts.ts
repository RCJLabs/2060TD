import type { ArmorClass, SimEvent } from '../sim/types';
import type { SfxName } from './audio';
import type { Haptic } from './haptics';

/**
 * The impact vocabulary (M31 Phase 1): every moment of a battle worth
 * interrupting the page for, and what each one looks, sounds and feels like.
 *
 * Four families. A HIT is a round landing, a shell or a gun run going off,
 * or a wall or the post being worn down. A KILL is a unit dying, weighed by
 * what it was. A BREACH is a wall gone, and a LOSS is a building gone.
 * Everything else the board shows is a notice, not an impact: a call for
 * fire, a reserve standing up, a refund. Notices keep their own marks, and
 * never an impact's. Each impact has one mark and one
 * sound, and the renderer plays an impact only through this table, so a mark
 * cannot be written without its sound or a sound without its mark. The type
 * checker holds every mark to one the renderer draws and every sound to one
 * the kit makes.
 *
 * Breaches and losses are also felt: the board jolts a little (never under
 * the device's reduced-motion setting) and, in a live battle, the phone
 * buzzes. Nothing here reaches the sim: a replay plays the same battle with
 * the same impacts, only without the buzz.
 */

/** Every mark the battle renderer draws. Its effects are these and nothing else. */
export const EFFECT_KINDS = [
  'tracer',
  'boom',
  'boomVehicle',
  'boomAir',
  'wallBoom',
  'structBoom',
  'chip',
  'postHit',
  'aoe',
  'strafe',
  'muster',
  'smoke',
  'reticle',
  'flash',
  'shout',
] as const;

export type EffectKind = (typeof EFFECT_KINDS)[number];

export type ImpactFamily = 'hit' | 'kill' | 'breach' | 'loss';

export type ImpactKind =
  | 'hit'
  | 'hitHeavy'
  | 'blast'
  | 'strafe'
  | 'wear'
  | 'postHit'
  | 'killInfantry'
  | 'killVehicle'
  | 'killAir'
  | 'breach'
  | 'loss';

export interface Impact {
  family: ImpactFamily;
  /** The mark it leaves, and how long the mark holds, in seconds. */
  mark: EffectKind;
  life: number;
  /** The sound it makes. */
  sound: SfxName;
  /** How far the board jolts, in cells. Breaches and losses only. */
  jolt?: number;
  /** The phone's buzz, in a live battle only. Breaches and losses only. */
  haptic?: Haptic;
}

export const IMPACTS: Readonly<Record<ImpactKind, Impact>> = {
  // A round lands: the tracer and the star where it lands, and its crack.
  hit: { family: 'hit', mark: 'tracer', life: 0.1, sound: 'shot' },
  hitHeavy: { family: 'hit', mark: 'tracer', life: 0.1, sound: 'shotHeavy' },
  // A shell, a charge or a mine going off: the ring where it landed, and the blast.
  blast: { family: 'hit', mark: 'aoe', life: 0.45, sound: 'explosion' },
  // A gun run's pass: speed lines down the line it rakes.
  strafe: { family: 'hit', mark: 'strafe', life: 0.3, sound: 'explosion' },
  // A wall being broken, which the sim reports as health draining.
  wear: { family: 'hit', mark: 'chip', life: 0.22, sound: 'chip' },
  // The post under attack: the one hit the accent is spent on.
  postHit: { family: 'hit', mark: 'postHit', life: 0.32, sound: 'postHit' },
  killInfantry: { family: 'kill', mark: 'boom', life: 0.35, sound: 'killInfantry' },
  killVehicle: { family: 'kill', mark: 'boomVehicle', life: 0.5, sound: 'killVehicle' },
  killAir: { family: 'kill', mark: 'boomAir', life: 0.6, sound: 'killAir' },
  breach: { family: 'breach', mark: 'wallBoom', life: 0.7, sound: 'wallBreak', jolt: 0.1, haptic: 'breach' },
  loss: { family: 'loss', mark: 'structBoom', life: 0.9, sound: 'structureDown', jolt: 0.16, haptic: 'loss' },
};

export const IMPACT_KINDS = Object.keys(IMPACTS) as ImpactKind[];

// ---- what a kill was -------------------------------------------------------------

export type KillWeight = 'infantry' | 'vehicle' | 'air';

/** What died, by its armour: soft targets are infantry, armour is a vehicle, and aircraft fly. */
export function killWeight(armor: ArmorClass | undefined): KillWeight {
  if (armor === 'air') return 'air';
  if (armor === 'light' || armor === 'heavy' || armor === 'structure') return 'vehicle';
  return 'infantry';
}

export const KILL_IMPACT: Readonly<Record<KillWeight, ImpactKind>> = {
  infantry: 'killInfantry',
  vehicle: 'killVehicle',
  air: 'killAir',
};

/** What a sim event plays, when it is an impact at all. */
export function eventImpact(event: SimEvent): ImpactKind | null {
  switch (event.type) {
    case 'shot':
      return event.damageType === 'explosive' || event.damageType === 'shaped' ? 'hitHeavy' : 'hit';
    case 'aoe':
      return 'blast';
    case 'strafePulse':
      return 'strafe';
    case 'attackerDied':
      return KILL_IMPACT[killWeight(event.armor)];
    case 'wallDestroyed':
      return 'breach';
    case 'structureDestroyed':
      return 'loss';
    default:
      return null;
  }
}

// ---- wear ------------------------------------------------------------------------

/** How often one worn wall may be marked, in seconds: about twice a second. */
export const WEAR_GAP = 0.45;
/** How often the post under attack may be marked. */
export const POST_GAP = 0.5;
/** The phone buzzes no oftener than this, in seconds: a volley of breaches is one buzz. */
export const BUZZ_GAP = 0.3;

/**
 * Health read between frames, for the damage the sim reports as no event: a
 * wall being broken, the post under attack. A target is marked when its
 * health has fallen since the frame before and it has not been marked within
 * `gap` seconds. The first reading of a target only learns its health.
 */
export class WearWatch<K> {
  private readonly hp = new Map<K, number>();
  private readonly marked = new Map<K, number>();

  constructor(private readonly gap: number) {}

  /** Report a target's health at `t` seconds; true when it should be marked now. */
  wore(key: K, hp: number, t: number): boolean {
    const before = this.hp.get(key);
    this.hp.set(key, hp);
    if (before === undefined || hp >= before) return false;
    if (t - (this.marked.get(key) ?? Number.NEGATIVE_INFINITY) < this.gap) return false;
    this.marked.set(key, t);
    return true;
  }

  /** Forget every target not in `alive`: a wall that has gone is not worn any more. */
  keep(alive: ReadonlySet<K>): void {
    for (const key of this.hp.keys()) {
      if (!alive.has(key)) {
        this.hp.delete(key);
        this.marked.delete(key);
      }
    }
  }

  clear(): void {
    this.hp.clear();
    this.marked.clear();
  }
}

// ---- the record the harness reads -----------------------------------------------

const played = new Map<ImpactKind, number>();

/** Count an impact played. The renderer calls this, once an impact's mark and sound are both out. */
export function notePlayed(kind: ImpactKind): void {
  played.set(kind, (played.get(kind) ?? 0) + 1);
}

/** Every impact played since the page loaded, by kind. */
export function playedImpacts(): Partial<Record<ImpactKind, number>> {
  return Object.fromEntries(played) as Partial<Record<ImpactKind, number>>;
}

/**
 * The impacts played whose sound was never made, given the sounds the kit
 * made. Empty whenever the page can make sound at all: an impact's first
 * sound is never held back by the kit's rate limit.
 */
export function silentImpacts(sounds: Partial<Record<SfxName, number>>): ImpactKind[] {
  return [...played.keys()].filter((kind) => (sounds[IMPACTS[kind].sound] ?? 0) === 0);
}
