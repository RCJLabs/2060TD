/**
 * Prestige (M28 Phase 3): what retiring a war pays, and what the pay buys.
 *
 * A war never ends on its own. The commander retires it, and it banks MERIT
 * for what it achieved: the rungs its front reached, the campaign's missions,
 * the war won. Merit belongs to the commander, not the war, and buys head
 * starts that every later war opens with, whichever slot and army it is.
 *
 * A head start moves a war further along its opening and nothing else. No
 * battle multiplier comes from here, so the ladder, the citadel and the last
 * stand keep the tuning they were measured with, and a ghost raid or a replay
 * is the same battle whoever fights it.
 */

export type HeadStartId = 'chest' | 'opening' | 'quartermasters' | 'staff';

export interface HeadStartLevel {
  /** Merit to buy this level, once the one below it is bought. */
  price: number;
  /** What the level gives, in the words the War College uses. */
  detail: string;
}

export interface HeadStartTrack {
  id: HeadStartId;
  name: string;
  /** What the track is, before any level of it. */
  blurb: string;
  levels: readonly HeadStartLevel[];
}

/** Opening stores, by level: paid when the war chooses its commitment. */
export const WAR_CHEST: readonly { supplies: number; fuel: number; intel: number }[] = [
  { supplies: 2000, fuel: 400, intel: 100 },
  { supplies: 5000, fuel: 1000, intel: 250 },
  { supplies: 10000, fuel: 2000, intel: 500 },
];

/**
 * The campaign's first requisitions, granted from the start, by level: what
 * every army's opening missions unlock, in the order they unlock it. The
 * missions stay to be fought for their pay; only the waiting goes.
 */
export const OPENING_UNLOCKS: readonly (readonly string[])[] = [
  ['storageBunker', 'depmg', 'foxhole', 'claymore', 'hesco'],
  ['storageBunker', 'depmg', 'foxhole', 'claymore', 'hesco', 'fuelDepot', 'cc2', 'generator'],
  [
    'storageBunker',
    'depmg',
    'foxhole',
    'claymore',
    'hesco',
    'fuelDepot',
    'cc2',
    'generator',
    'autocannon',
    'engBay',
    'barracks',
    'frontline',
    'radar',
  ],
];

/** Deliveries on top of the depots' output, as a share of it, for the war's first hours. */
export const QUARTERMASTER_BONUS: readonly number[] = [0.5, 1, 1.5];
export const QUARTERMASTER_HOURS = 72;

/** What research timers are multiplied by. */
export const STAFF_FACTOR: readonly number[] = [0.75, 0.5, 0.25];

/**
 * Every track's three levels cost the same, and all twelve about three won
 * wars: the first won war of an army banks 160 to 205 merit.
 */
const PRICES = [15, 35, 70] as const;

export const HEAD_STARTS: readonly HeadStartTrack[] = [
  {
    id: 'chest',
    name: 'WAR CHEST',
    blurb: 'Bigger opening stores',
    levels: WAR_CHEST.map((c, i) => ({
      price: PRICES[i]!,
      detail: `+${c.supplies.toLocaleString('en-US')} supplies, +${c.fuel.toLocaleString('en-US')} fuel, +${c.intel} intel`,
    })),
  },
  {
    id: 'opening',
    name: 'THE OPENING',
    blurb: "The campaign's first requisitions from day one",
    levels: [
      { price: PRICES[0], detail: 'storage and the field defences' },
      { price: PRICES[1], detail: 'and the fuel depot, the generator and CC2' },
      { price: PRICES[2], detail: 'and the Front Line, barracks, engineering bay, autocannon and Signals Station' },
    ],
  },
  {
    id: 'quartermasters',
    name: 'QUARTERMASTERS',
    blurb: `Deliveries for the war's first ${QUARTERMASTER_HOURS} hours`,
    levels: QUARTERMASTER_BONUS.map((b, i) => ({
      price: PRICES[i]!,
      detail: `+${Math.round(b * 100)}% of the depots' supplies and fuel`,
    })),
  },
  {
    id: 'staff',
    name: 'STAFF COLLEGE',
    blurb: 'Shorter research',
    levels: STAFF_FACTOR.map((f, i) => ({
      price: PRICES[i]!,
      detail: `research timers ${Math.round((1 - f) * 100)}% shorter`,
    })),
  },
];

export const HEAD_START_BY_ID = Object.fromEntries(HEAD_STARTS.map((t) => [t.id, t])) as Record<
  HeadStartId,
  HeadStartTrack
>;

export const HEAD_START_IDS: readonly HeadStartId[] = HEAD_STARTS.map((t) => t.id);

/** Every level of every track, bought. */
export const MERIT_TO_MAX = HEAD_STARTS.reduce((n, t) => n + t.levels.reduce((m, l) => m + l.price, 0), 0);

// ---- merit -------------------------------------------------------------------------

/**
 * The campaign completed. The armies' campaigns are six missions long, or
 * nine for the USA, so each mission pays its share of this.
 */
export const MERIT_CAMPAIGN = 9;
/** The war won: the citadel fallen. */
export const MERIT_WAR_WON = 30;
/** More, the first time an army wins a war. */
export const MERIT_FIRST_WIN = 30;
/** A HARD war's merit, multiplied. */
export const MERIT_HARD = 1.25;

/**
 * What a front that reached `rung` pays: each rung past the first pays its
 * number less one. A deep war pays more for each day than a short one, so a
 * war retired early and started again is never the better trade.
 */
export const rungMerit = (rung: number): number => {
  const r = Math.max(1, Math.floor(rung));
  return (r * (r - 1)) / 2;
};

/** What `done` of a campaign's `length` missions pay, rounded to whole merit. */
export const campaignMerit = (done: number, length: number): number =>
  length > 0 ? Math.round((MERIT_CAMPAIGN * Math.min(done, length)) / length) : 0;
