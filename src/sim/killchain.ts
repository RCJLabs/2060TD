/**
 * The kill chain (v1.41) — what taking a command post actually IS.
 *
 * For twenty-two milestones the post was an HP sponge. `DAMAGE_MULT` discounts
 * ranged fire hard against `structure` and `hqDps` only fires at adjacency, so
 * the only thing that ever ended a raid was a unit that survived to touch the
 * post. Everything else in the roster was escort, and `npm run balance --chain`
 * measured exactly how little escort buys:
 *
 *     faction     BRCH  GUNS  CHRG  BURN   stalls at
 *     USA           30    98    92    84   BURN   (-8)
 *     China         36    98    90    86   CHARGE (-9)
 *     Russia        12    99    97    79   BURN  (-18)
 *     KPA           70    98    66    63   CHARGE (-32)
 *     UN             5    97    84    78   CHARGE (-13)
 *
 * There was no chain. Covering guns died in 97-99% of raids, so suppression was
 * a formality; two of China's three unit kinds moved NOTHING at any stage.
 *
 * ## The model
 *
 * The post's HP bar stops being a health bar and becomes a **progress bar
 * through a demolition job**. Four stages, and — this is the whole design —
 * each one is gated on a DIFFERENT stat, so no unit is good at all four:
 *
 *     stage     bar            what moves it                 who is good at it
 *     BREACH    1.00 -> 0.65   wallDps at the perimeter      sappers (60-80)
 *                              and fire support              vs heavies (22-35)
 *     SUPPRESS  gate at 0.65   every covering gun down       AT teams, IFVs
 *     CHARGE    0.65 -> 0.40   hqDps, but only with a crew   cheap infantry,
 *                              of `chargeCrew` bodies        per manpower
 *     BURN      0.40 -> 0.00   a clock, while the ground     durable units,
 *                              is held; it backs off when    and the medic who
 *                              it is not                     keeps them alive
 *
 * Read down the "who" column: that is the roster every faction already ships,
 * finally being asked for. A sapper is 2x a tank per unit and 8x per manpower
 * at BREACH. A Javelin team is 3x a tank per manpower at SUPPRESS. A rifle
 * squad is 3-4x a tank per manpower at CHARGE. The tank wins BURN, which is
 * one stage out of four rather than all of them.
 *
 * ## Why a crew minimum, and not just a rate
 *
 * The rate alone does not kill the carry. A single heavy that survives will
 * grind ANY rate down eventually, and today it does — 125 seconds of adjacency
 * at a level-3 post, which it has. `chargeCrew` is the one rule that makes the
 * solo run impossible rather than slow: one body cannot work a demolition
 * charge on a hardened post and provide its own security at the same time.
 * It is fiction and mechanism agreeing, which is the cheapest kind of rule.
 *
 * ## What each version is
 *
 * A version is a MODEL, frozen forever. Version 0 is the sponge, so every
 * archived replay re-fights the battle it recorded, and a config that never
 * names a version takes the untouched code path byte for byte. Same discipline
 * as `TERRAIN_VERSION` and `COMBAT_CURRENT`.
 *
 * Nothing here draws from an RNG. The chain is accounting, not chance — the
 * roll already lives in `src/sim/combat.ts` and one source of variance per
 * battle is enough.
 */

/** The sponge: every config written before v1.41. */
export const CHAIN_NONE = 0;

/** v1.41's model, frozen: it deadlocks, and `CHAIN_STALL_SECONDS` says how. */
export const CHAIN_BREACH = 1;

/**
 * v1.41.1's model, frozen: it deadlocks too, in a way its own fix could not
 * see. See `latchOpen`.
 */
export const CHAIN_SPENT = 2;

/** The shipped model. New configs name this; nothing else should. */
export const CHAIN_CURRENT = 3;
/**
 * A CANDIDATE, not current (M34): version 3, plus an assault that goes after
 * the guns covering its post instead of standing on it. See
 * `ChainModel.engageCover`. It becomes current only if the measurements that
 * motivated it say it should.
 */
export const CHAIN_ENGAGE = 4;

/** Where a raid has got to. `down` means the post has fallen. */
export type ChainStage = 'breach' | 'suppress' | 'charge' | 'burn' | 'down';

/** In the order they must be passed. `down` is the outcome, not a stage. */
export const CHAIN_ORDER: ChainStage[] = ['breach', 'suppress', 'charge', 'burn'];

/**
 * What a stage is called where a player reads it.
 *
 * Here rather than in a scene because both the live sitrep and the after-action
 * report name the same four things, and a second copy of this list is one
 * content change away from disagreeing with the first.
 */
export const CHAIN_STAGE_NAME: Record<ChainStage, string> = {
  breach: 'BREACH',
  suppress: 'SUPPRESS',
  charge: 'CHARGE',
  burn: 'BURN',
  down: 'POST DOWN',
};

/** The stage an assault that completed `done` of them stalled at. */
export function chainStalledAt(done: number): string {
  return CHAIN_STAGE_NAME[CHAIN_ORDER[done] ?? 'down'];
}

export interface ChainModel {
  readonly version: number;
  /** Human-readable, for the harness tables. */
  readonly label: string;
  /**
   * False takes the engine down the pre-v1.41 path untouched: `hqDps` at
   * adjacency, fire support finishes the job, no stages and no crew.
   */
  readonly staged: boolean;
  /** Bar fraction at which BREACH is done and the gate comes up. */
  readonly breachTo: number;
  /** Bar fraction at which the charge is set and the fuse lights. */
  readonly chargeTo: number;
  /**
   * Cells from the post's centre inside which a live gun covers it.
   *
   * Measured centre to centre, and deliberately NOT a line-of-sight test:
   * "no LoS anywhere" was decided at M2 and this milestone does not reopen it.
   */
  readonly coverRadius: number;
  /** Bodies that must be on the post's perimeter to work the charge. */
  readonly chargeCrew: number;
  /** Seconds the fuse takes to consume the BURN share, while held. */
  readonly burnSeconds: number;
  /**
   * How fast the burn backs off when nobody holds the ground, relative to how
   * fast it advances. Backing off rather than resetting: losing the last
   * holder should cost the attacker ground, not the whole raid.
   */
  readonly burnDecay: number;
  /**
   * Seconds of a COMPLETELY static board — the bar unmoved, nothing destroyed,
   * nobody killed — with somebody still on the post, after which the assault
   * is spent and its holders withdraw. 0 disables the rule.
   *
   * This exists because v1.41 shipped a hang. The crew minimum means a lone
   * attacker can never take a post; if every gun that could reach it is
   * already dead, it also never dies, and a wave ends only when the attackers
   * do. Measured on the reference sieges: 0% of battles deadlocked on the
   * sponge and 18% on `CHAIN_BREACH`, every one of them a single unit in state
   * `assaulting` with the bar pinned at the breach floor. In a live siege that
   * is a player watching one immortal tank stand on their command post until
   * the tick cap.
   *
   * It has two halves, and the second only appeared once the first was fixed.
   * A LONE AIRCRAFT deadlocks identically, for a reason this model introduced
   * itself: "an aircraft is not a body on the ground" keeps it out of the
   * holder count, so a clock gated on holders never started for the one
   * attacker that is hardest to shoot down. The engine's quorum therefore
   * counts everyone who reached the objective, flying or not, while the crew
   * minimum still counts only boots.
   *
   * The trigger is deliberately the whole board rather than the bar alone. A
   * bar pinned at the suppression gate while the rest of the force works its
   * way through the covering guns is an assault in progress, and withdrawing
   * its holders would punish a slow attack instead of a dead one. Requiring
   * that NOTHING has happened — no damage to the post, no structure or wall
   * down, no attacker killed — is a deadlock signature rather than a
   * stopwatch.
   */
  readonly stallSeconds: number;
  /**
   * Once BREACH has been completed, does the post STAY a valid target for
   * ranged fire, however much it is later repaired?
   *
   * False re-reads the live bar every tick, which is what v1.41 and v1.41.1
   * do and what a repair aura turns into a livelock.
   */
  readonly latchOpen: boolean;
  /**
   * While the post is gated at SUPPRESS, does an attacker standing on it with
   * no covering gun in its own reach go and get one? (M34)
   *
   * The chain's own design line is "a gun that can reach the post covers it,
   * and the answer is to kill the gun" — and through version 3 nothing makes an
   * attacker do that. An assault on a covered post keeps whatever guns it
   * happened to kill on the way in, stands on the post, and if the last
   * covering guns are out of reach of the cell it is standing on, it stands
   * there until `stallSeconds` wipes it. On the shipped board that decides
   * almost nothing: 43.7% of the defence matrix's defender wins include a stall
   * wipe-out, and every one of them fired with nobody else alive and removed
   * at most one unit on the ground — cleanup, not a stuck crew. A board with
   * bigger cells crosses the knife-edge for real: at 10x15 four tanks on one
   * perimeter cell sat 0.24 cells out of range of the gun that kept them off
   * the post, for 90 seconds, twice. Hunting the guns is not neutral on the
   * shipped board either: it takes contested MID and LATE levels the standing
   * crews lost.
   *
   * False is every version before this field existed.
   */
  readonly engageCover: boolean;
}

const sponge: ChainModel = {
  version: CHAIN_NONE,
  label: 'the post is a sponge',
  staged: false,
  breachTo: 1,
  chargeTo: 0,
  coverRadius: 0,
  chargeCrew: 1,
  burnSeconds: 1,
  burnDecay: 0,
  stallSeconds: 0,
  latchOpen: false,
  engageCover: false,
};

/**
 * v1.41's model, with every number measured rather than chosen.
 *
 * Only two of the bar's three shares are difficulty at all: BREACH is
 * `1 - breachTo` of demolition work and CHARGE is `breachTo - chargeTo` of
 * objective work, while BURN's share only sets the rate that empties it in
 * `burnSeconds` — so the burn's difficulty is the clock and the holding, and
 * its share is how much of the bar is left to watch go down.
 *
 * What the sweep said, over the five reference expeditions across 4 tiers x 8
 * archetypes x 2 variants (clear rate, then the per-faction spread):
 *
 *     coverRadius 6, shares .35/.25, burn 25    49.4%   39 63 28 56 61
 *     coverRadius 4                             61.3%   67 63 59 56 61
 *     coverRadius 3                             64.1%   70 63 70 56 61
 *     coverRadius 4, shares .30/.15, burn 20    62.5%   66 66 61 56 64
 *     coverRadius 3, shares .30/.15, burn 20    65.6%   69 66 73 56 64
 *     ...and the same with chargeCrew 1         66.6%   73 73 61 58 67
 *     (the sponge, for comparison)              76.9%   83 81 81 58 81
 *
 * Three readings:
 *
 * - **A radius of 6 is a different gate than it sounds.** It asks for 3.2
 *   guns dead on average; 4 asks for 1.22 and 3 for 0.53. Six puts the whole
 *   inner base in the set and costs Russia 31 points more than anyone else,
 *   which is a shape tax rather than a stage.
 * - **The crew minimum is worth four points of clear and is kept anyway.**
 *   Dropping it to 1 is the single largest gain on the board, and it is the
 *   one rule that makes a solo heavy impossible rather than slow. Buying back
 *   clear rate by reopening the defect the milestone exists to close would be
 *   a poor trade.
 * - **The chain is a parity tool.** The sponge spreads the five factions
 *   across 25 points; this spreads them across 10. Asking for four different
 *   capabilities suits five different rosters better than asking for one.
 */
const theBreach: ChainModel = {
  version: CHAIN_BREACH,
  label: 'breach, suppress, charge, burn',
  staged: true,
  breachTo: 0.7,
  chargeTo: 0.55,
  coverRadius: 4,
  chargeCrew: 2,
  burnSeconds: 20,
  burnDecay: 0.5,
  // No stall rule, which is the defect this version is frozen with.
  stallSeconds: 0,
  latchOpen: false,
  engageCover: false,
};

/**
 * v1.42: the same four stages, and an assault that can be spent.
 *
 * A new version rather than an edit, because v1.41 SHIPPED. The freeze exists
 * so an archived replay re-fights the battle it recorded, and the moment a
 * build reaches a player that stops being a formality — the previous
 * correction to this model was edited in place precisely because nothing had
 * shipped yet, and that argument is no longer available.
 */
const spentAssault: ChainModel = {
  ...theBreach,
  version: CHAIN_SPENT,
  label: 'breach, suppress, charge, burn; a spent assault withdraws',
  stallSeconds: 90,
  latchOpen: false,
};

/**
 * The third deadlock, and the one that says why a rule needs a LATCH.
 *
 * M22 stopped three tanks shelling an immovable bar by dropping the opened
 * post from the target list, and wrote that as a live comparison: the post
 * takes fire while `hp > breachTo * maxHp`. A repaired post crosses back over
 * that line. Measured in M23 Phase 2, on UN LATE (CC3) level 4 — the
 * sustainment faction, repairing its own command post — a lone `wz10` stood
 * off and shelled a bar that oscillated between 0.7031 and 0.7094 of maximum
 * for THIRTY THOUSAND ticks: damaged to the floor, healed a hair above it,
 * re-acquired, damaged again.
 *
 * v1.41.1's spent-assault rule cannot see it, three times over. The unit is
 * `engaging` rather than `assaulting`, so it never counts at the post and the
 * clock never starts; the clock's kill sweep only takes units that are
 * assaulting; and the board fingerprint the clock watches contains the bar,
 * which the repair aura is moving every tick. A rule written against "nobody
 * is making progress" was defeated by something making a tiny amount of it,
 * forever.
 *
 * So the breach latches. Once the post has been opened it stays open to the
 * target list however much it is later repaired, which is also the honest
 * reading: a hole in the wall does not un-hole because somebody patched the
 * paint. The post can still be healed, and healing it still costs the
 * attacker time at BURN — it just cannot re-arm itself as a target.
 */
const latched: ChainModel = {
  ...spentAssault,
  version: CHAIN_CURRENT,
  label: 'breach, suppress, charge, burn; a breach stays open',
  latchOpen: true,
};

const huntTheCover: ChainModel = {
  ...latched,
  version: CHAIN_ENGAGE,
  label: 'breach, suppress, charge, burn; a covered post sends its crew after the guns',
  engageCover: true,
};

/** The version registry. A version is frozen: a new model is a new number. */
export const CHAIN_MODELS: Record<number, ChainModel> = {
  [CHAIN_NONE]: sponge,
  [CHAIN_BREACH]: theBreach,
  [CHAIN_SPENT]: spentAssault,
  [CHAIN_CURRENT]: latched,
  [CHAIN_ENGAGE]: huntTheCover,
};

/**
 * An unknown version reads as the sponge rather than throwing: a save or a
 * code written by a newer build has to open on an older one, not take the
 * vault down with it.
 */
export function chainModelFor(version: number | undefined): ChainModel {
  return CHAIN_MODELS[version ?? CHAIN_NONE] ?? sponge;
}
