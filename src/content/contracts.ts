import { DAY_MS, LADDER_EPOCH } from './leagues';

/**
 * Daily contracts (v1.12): three standing orders a day, from the same fixed
 * epoch the field-condition rotation uses. No server, no stored schedule, no
 * way for two saves to disagree about what today asks for.
 *
 * One of each CATEGORY every day — an offensive task, a defensive one, and
 * something to do at home — so the day always has something for whatever the
 * commander happens to be doing. Three separate pools of different sizes (5,
 * 4 and 6) mean the exact triple does not come round again for sixty days;
 * one pool of fifteen would repeat every fifteen and pin each contract to the
 * same weekday forever.
 *
 * Contracts pay SUPPLIES, FUEL and INTEL, never standing. Standing is the one
 * number that falls on its own, and a daily faucet of it would quietly undo
 * the decay the whole board is built around. An errand should pay wages.
 */

/** What a contract counts. Each one has exactly one place it is bumped. */
export type ContractMetric =
  // offense — all folded from a resolved raid
  | 'postsTaken'
  | 'structuresRazed'
  | 'raidLoot'
  | 'deepPost'
  // defense — probes, counterattacks and sieges you actually fought
  | 'probesHeld'
  | 'countersHeld'
  | 'siegesWon'
  // the home front
  | 'built'
  | 'trained'
  | 'walls'
  | 'scouted';

export type ContractCategory = 'offense' | 'defense' | 'home';

export interface Contract {
  id: string;
  /** Panel heading. Rows wrap, so the cap in the suite is editorial. */
  label: string;
  /** What it actually asks, in the radio-log voice. */
  brief: string;
  category: ContractCategory;
  metric: ContractMetric;
  goal: number;
  /** Base payout, before the league multiplier. */
  pay: { supplies: number; fuel: number; intel: number };
}

const OFFENSE: Contract[] = [
  {
    id: 'posts',
    label: 'TAKE TWO POSTS',
    brief: 'Two command posts on the ground before the day is out. Any tier.',
    category: 'offense',
    metric: 'postsTaken',
    goal: 2,
    pay: { supplies: 600, fuel: 120, intel: 20 },
  },
  {
    id: 'raze',
    label: 'RAZE TWELVE',
    brief: 'Twelve structures flattened across however many raids it takes.',
    category: 'offense',
    metric: 'structuresRazed',
    goal: 12,
    pay: { supplies: 500, fuel: 160, intel: 15 },
  },
  {
    id: 'haul',
    label: 'HAUL 1500 SUPPLIES',
    brief: 'Fifteen hundred Supplies out of enemy depots and back to yours.',
    category: 'offense',
    metric: 'raidLoot',
    goal: 1500,
    pay: { supplies: 300, fuel: 200, intel: 25 },
  },
  {
    id: 'deep',
    label: 'TAKE A TIER-3 POST',
    brief: 'One post at tier three or deeper. Bring enough people.',
    category: 'offense',
    metric: 'deepPost',
    goal: 1,
    pay: { supplies: 800, fuel: 200, intel: 30 },
  },
  {
    id: 'pressure',
    label: 'RAZE TWENTY',
    brief: 'Twenty structures. A day of demolition, not a single clean raid.',
    category: 'offense',
    metric: 'structuresRazed',
    goal: 20,
    pay: { supplies: 900, fuel: 220, intel: 25 },
  },
];

const DEFENSE: Contract[] = [
  {
    id: 'hold',
    label: 'HOLD TWO PROBES',
    brief: 'Turn back two probes while you are away. The wire does the work.',
    category: 'defense',
    metric: 'probesHeld',
    goal: 2,
    pay: { supplies: 400, fuel: 100, intel: 20 },
  },
  {
    id: 'counter',
    label: 'BREAK A COUNTERATTACK',
    brief: 'The ladder reaches back. Be standing when it does.',
    category: 'defense',
    metric: 'countersHeld',
    goal: 1,
    pay: { supplies: 700, fuel: 180, intel: 25 },
  },
  {
    id: 'siege',
    label: 'WIN A SIEGE',
    brief: 'One battle fought at home and won. Campaign or assault.',
    category: 'defense',
    metric: 'siegesWon',
    goal: 1,
    pay: { supplies: 500, fuel: 120, intel: 20 },
  },
  {
    id: 'garrison',
    label: 'HOLD FOUR PROBES',
    brief: 'Four probes turned back. A garrison that earns its supplies.',
    category: 'defense',
    metric: 'probesHeld',
    goal: 4,
    pay: { supplies: 800, fuel: 200, intel: 35 },
  },
];

const HOME: Contract[] = [
  {
    id: 'break',
    label: 'BREAK GROUND TWICE',
    brief: 'Two new buildings started. Started counts — concrete takes time.',
    category: 'home',
    metric: 'built',
    goal: 2,
    pay: { supplies: 350, fuel: 80, intel: 20 },
  },
  {
    id: 'muster',
    label: 'TRAIN SIX',
    brief: 'Six replacements into the training lines.',
    category: 'home',
    metric: 'trained',
    goal: 6,
    pay: { supplies: 400, fuel: 100, intel: 20 },
  },
  {
    id: 'wire',
    label: 'LAY TWENTY WALL',
    brief: 'Twenty segments of wire. The maze is the defense.',
    category: 'home',
    metric: 'walls',
    goal: 20,
    pay: { supplies: 300, fuel: 60, intel: 15 },
  },
  {
    id: 'recon',
    label: 'SCOUT TWO TARGETS',
    brief: 'Two layouts bought and read before anyone is committed.',
    category: 'home',
    metric: 'scouted',
    goal: 2,
    pay: { supplies: 250, fuel: 80, intel: 40 },
  },
  {
    id: 'lines',
    label: 'TRAIN TWELVE',
    brief: 'Twelve into the lines. Somebody has to replace the last twelve.',
    category: 'home',
    metric: 'trained',
    goal: 12,
    pay: { supplies: 700, fuel: 160, intel: 30 },
  },
  {
    id: 'expand',
    label: 'BREAK GROUND FOUR TIMES',
    brief: 'Four foundations poured. A base that is still growing.',
    category: 'home',
    metric: 'built',
    goal: 4,
    pay: { supplies: 650, fuel: 140, intel: 30 },
  },
];

/** Every contract, for lookups and for the tests that keep the pools honest. */
export const CONTRACTS: Contract[] = [...OFFENSE, ...DEFENSE, ...HOME];
export const CONTRACT_BY_ID: Record<string, Contract> = Object.fromEntries(
  CONTRACTS.map((c) => [c.id, c]),
);

/** How many run at once. One per category, every day. */
export const CONTRACTS_PER_DAY = 3;

/** Which day of the rotation an instant falls on. */
export const contractDay = (now: number): number =>
  Math.floor((now - LADDER_EPOCH) / DAY_MS);

const pick = (pool: Contract[], day: number): Contract =>
  pool[((day % pool.length) + pool.length) % pool.length]!;

/** Today's three, in category order: offense, defense, home. */
export function contractsAt(now: number): Contract[] {
  const day = contractDay(now);
  return [pick(OFFENSE, day), pick(DEFENSE, day), pick(HOME, day)];
}

/** When today's orders lapse and the next three are posted (epoch ms). */
export const contractsEndAt = (now: number): number =>
  LADDER_EPOCH + (contractDay(now) + 1) * DAY_MS;

export const contractsAfter = (now: number): Contract[] =>
  contractsAt(contractsEndAt(now));
