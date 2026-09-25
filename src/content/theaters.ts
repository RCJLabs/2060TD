/**
 * The theaters (M25 Phase 1): the Front Line as a place.
 *
 * Until M25 the Front Line was one number, a rung with three posts dealt for
 * it. Each faction's war now runs from its own base, which was already a real
 * place, toward the enemy's stronghold along a real road, and the five fit
 * together. The USA pushes north up Highway 101 from Coos Bay to the PLA
 * beachhead at Grays Harbor, which is China's base, and China pushes east from
 * it toward Joint Base Lewis-McChord. The UN comes west from Tacoma to the same
 * beachhead. Russia goes up the Iditarod from Nome toward Fairbanks, and the
 * KPA down the Redwood Coast from Humboldt Bay toward Santa Rosa.
 *
 * A theater is twelve towns and the stronghold, a thirteenth column, and the
 * column is the tier: tiers became distance from the front. Each column is
 * three sectors, one per lane, and each lane is one of the three bands the
 * deal cuts a rung into (`archetypeFor`: slot 0 the heavy fight, slot 1 the
 * middle one, slot 2 the one you can take today). So a lane has a character,
 * and a sector's post is exactly the post the ladder dealt for that slot:
 * nothing here reaches a battle.
 */
import { TARGETS_PER_TIER } from './bases';
import type { FactionId } from './factions';
import { DAY_MS, DECAY_GRACE_MS } from './leagues';

export interface Lane {
  name: string;
  /** Which of a rung's dealt posts this lane holds: the deal's band, 0 the heavy fight. */
  slot: number;
}

export interface Theater {
  /** What the ground is called. */
  name: string;
  /** The base the war is fought from: column 0. */
  home: string;
  /** The towns in order out from the base, column 1 first. */
  towns: string[];
  /** The enemy's stronghold: the column after the last town. */
  stronghold: string;
  /** The three lanes, left to right as the map draws them. */
  lanes: [Lane, Lane, Lane];
}

/** The deal's bands, by slot, as the map names them. */
export const BAND_NAMES = ['HEAVY', 'MIDDLE', 'LIGHT'] as const;

const THEATERS: Record<FactionId, Theater> = {
  usa: {
    name: 'THE OREGON COAST',
    home: 'COOS BAY',
    towns: [
      'REEDSPORT',
      'FLORENCE',
      'YACHATS',
      'NEWPORT',
      'LINCOLN CITY',
      'TILLAMOOK',
      'CANNON BEACH',
      'ASTORIA',
      'LONG BEACH',
      'SOUTH BEND',
      'RAYMOND',
      'ABERDEEN',
    ],
    stronghold: 'GRAYS HARBOR',
    lanes: [
      { name: 'THE BEACHES', slot: 1 },
      { name: 'HIGHWAY 101', slot: 0 },
      { name: 'THE COAST RANGE', slot: 2 },
    ],
  },
  china: {
    name: 'THE CHEHALIS VALLEY',
    home: 'GRAYS HARBOR',
    towns: [
      'MONTESANO',
      'BRADY',
      'SATSOP',
      'ELMA',
      'MCCLEARY',
      'SUMMIT LAKE',
      'MUD BAY',
      'OLYMPIA',
      'TUMWATER',
      'LACEY',
      'NISQUALLY',
      'DUPONT',
    ],
    stronghold: 'JOINT BASE LEWIS-MCCHORD',
    lanes: [
      { name: 'THE CHEHALIS RIVER', slot: 1 },
      { name: 'ROUTE 8', slot: 0 },
      { name: 'THE BLACK HILLS', slot: 2 },
    ],
  },
  russia: {
    name: 'THE YUKON ROUTE',
    home: 'NOME',
    towns: [
      'SOLOMON',
      'WHITE MOUNTAIN',
      'GOLOVIN',
      'ELIM',
      'KOYUK',
      'SHAKTOOLIK',
      'UNALAKLEET',
      'KALTAG',
      'GALENA',
      'RUBY',
      'TANANA',
      'NENANA',
    ],
    stronghold: 'FAIRBANKS',
    lanes: [
      { name: 'THE SEA ICE', slot: 1 },
      { name: 'THE IDITAROD TRAIL', slot: 0 },
      { name: 'THE RIDGES', slot: 2 },
    ],
  },
  nk: {
    name: 'THE REDWOOD COAST',
    home: 'HUMBOLDT BAY',
    towns: [
      'FORTUNA',
      'SCOTIA',
      'REDCREST',
      'MYERS FLAT',
      'GARBERVILLE',
      'LEGGETT',
      'LAYTONVILLE',
      'WILLITS',
      'UKIAH',
      'HOPLAND',
      'CLOVERDALE',
      'HEALDSBURG',
    ],
    stronghold: 'SANTA ROSA',
    lanes: [
      { name: 'THE LOST COAST', slot: 2 },
      { name: 'HIGHWAY 101', slot: 0 },
      { name: 'THE EEL RIVER', slot: 1 },
    ],
  },
  un: {
    name: 'THE SOUTH SOUND',
    home: 'TACOMA',
    towns: [
      'LAKEWOOD',
      'DUPONT',
      'NISQUALLY',
      'LACEY',
      'OLYMPIA',
      'MUD BAY',
      'SUMMIT LAKE',
      'MCCLEARY',
      'ELMA',
      'SATSOP',
      'MONTESANO',
      'ABERDEEN',
    ],
    stronghold: 'GRAYS HARBOR',
    lanes: [
      { name: 'PUGET SOUND', slot: 1 },
      { name: 'THE I-5 CORRIDOR', slot: 0 },
      { name: 'THE BLACK HILLS', slot: 2 },
    ],
  },
};

export function theaterFor(faction: FactionId): Theater {
  return THEATERS[faction];
}

/** The stronghold's column: the tier after the last town. */
export const strongholdTier = (t: Theater): number => t.towns.length + 1;

/**
 * What the column at `tier` is called: the base at 0, a town, the stronghold,
 * and past it the stronghold's rear, which the ladder goes on into.
 */
export function columnName(t: Theater, tier: number): string {
  if (tier <= 0) return t.home;
  if (tier <= t.towns.length) return t.towns[tier - 1]!;
  const past = tier - strongholdTier(t);
  return past === 0 ? t.stronghold : `${t.stronghold} REAR ${past}`;
}

/** The lane that holds a rung's dealt post `variant`. */
export function laneFor(t: Theater, variant: number): Lane {
  const slot = ((variant % TARGETS_PER_TIER) + TARGETS_PER_TIER) % TARGETS_PER_TIER;
  return t.lanes.find((l) => l.slot === slot)!;
}

// ---- the enemy strikes back (M25 Phase 2) ----------------------------------------

/**
 * How long the front must be quiet before the enemy strikes back: standing
 * decay's grace, so one clock tells a commander both things. Quiet means no
 * raid, no counterattack and no defence fought in person, the actions that
 * reset `frontline.activeAt`.
 */
export const QUIET_MS = DECAY_GRACE_MS;
/** A quiet spell's later strikes land this far apart. */
export const STRIKE_INTERVAL_MS = DAY_MS;
/** The most sectors one quiet spell costs. Fewer than a town has, so one absence cannot push the front back from a town that was whole. */
export const STRIKES_PER_QUIET = 2;
/** The order the enemy comes down the lanes: its main road, the heavy lane, first. */
export const STRIKE_ORDER: readonly number[] = [0, 1, 2];

// ---- the supply line (M25 Phase 3) -------------------------------------------------

/**
 * Supplies an hour each sector held behind the front takes, for each rung of
 * its town's distance from home: a whole town at the fifth rung takes 75. A
 * line grows with the square of its depth, which is what makes a front deeper
 * than its town can feed an overextended one.
 */
export const SUPPLY_PER_RUNG = 5;
/** How long a wholly unfed front holds before the enemy retakes a sector; half fed, twice as long. */
export const HUNGER_MS = DAY_MS;

// ---- the last stand (M25 Phase 4c) ------------------------------------------------

/**
 * The assault that marches on a commander's capital, by faction and the level
 * of the town's command post: the lowest level at which that faction's
 * reference town of that size, its permanent defences left to themselves,
 * holds the whole assault within fifteen points of half the time, or failing
 * that the level it holds nearest half (`npm run balance -- --laststand`). So
 * what the commander does decides it. By faction, because each fights a
 * different enemy's assault: Russia's CC3 town holds three quarters of level
 * 16, where the KPA's holds none of level 12. A CC1 town's band is one level
 * wide, the same for all five.
 *
 * Read with each faction's own rule in the battle (M26 Phase 3b), as the game
 * fights it. That moved one: Russia's CC3, from 18. Its town holds 75% to 95%
 * of every level from 13 to 18 and almost none of 19, so no level is near
 * half, and the one nearest it, at 75%, is 16 under its rule rather than 18.
 */
export const LAST_STAND_LEVEL: Readonly<Record<FactionId, Readonly<Record<number, number>>>> = {
  usa: { 1: 3, 2: 8, 3: 12 },
  china: { 1: 3, 2: 7, 3: 11 },
  russia: { 1: 3, 2: 9, 3: 16 },
  nk: { 1: 3, 2: 7, 3: 10 },
  un: { 1: 3, 2: 7, 3: 11 },
};
