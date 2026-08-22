import type { StructureProfile } from '../sim/types';

/**
 * The USA town layer (M2): economy buildings as siege structures, plus the
 * town metadata the sim doesn't care about — costs, build timers, generation
 * rates, storage, Engineering Bay speed-ups, and Command Center gating.
 *
 * All numbers provisional until the balance harness (M5).
 */

// ---- siege profiles: buildings are big, demolishable obstacles ------------------

export const ECONOMY_STRUCTURES: Record<string, StructureProfile> = {
  supplyDepot: {
    kind: 'supplyDepot',
    name: 'Supply Depot',
    maxHp: 400,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 500 }, { maxHp: 620 }],
  },
  fuelDepot: {
    kind: 'fuelDepot',
    name: 'Fuel Depot',
    maxHp: 400,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 500 }, { maxHp: 620 }],
  },
  storageBunker: {
    kind: 'storageBunker',
    name: 'Storage Bunker',
    maxHp: 600,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 750 }, { maxHp: 900 }],
  },
  engBay: {
    kind: 'engBay',
    name: 'Engineering Bay',
    maxHp: 450,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 550 }, { maxHp: 650 }],
  },
  barracks: {
    kind: 'barracks',
    name: 'Barracks',
    maxHp: 500,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 620 }, { maxHp: 750 }],
  },
  motorpool: {
    kind: 'motorpool',
    name: 'Motor Pool',
    maxHp: 550,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 680 }, { maxHp: 820 }],
  },
  radar: {
    kind: 'radar',
    name: 'Signals Station',
    maxHp: 420,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 520 }, { maxHp: 630 }],
  },
};

// ---- town metadata ---------------------------------------------------------------

export interface LevelCost {
  supplies: number;
  fuel: number;
  /** Base build/upgrade time before Engineering Bay reduction. */
  seconds: number;
}

export interface TownBuildingMeta {
  kind: string;
  name: string;
  /** levels[0] = build cost of level 1; levels[n] = upgrade cost to level n+1. */
  levels: LevelCost[];
  /** Supplies generated per minute at each level. */
  generatesSupplies?: number[];
  /** Fuel generated per minute at each level. */
  generatesFuel?: number[];
  /** Intel generated per minute at each level (Signals Station). */
  generatesIntel?: number[];
  /** Storage cap added at each level. */
  storage?: { supplies: number; fuel: number }[];
  /** Intel cap added at each level. */
  intelCap?: number[];
  /** Build-time reduction fraction at each level (Engineering Bay). */
  buildSpeed?: number[];
}

export const TOWN_META: Record<string, TownBuildingMeta> = {
  cc: {
    kind: 'cc',
    name: 'Command Center',
    levels: [
      { supplies: 0, fuel: 0, seconds: 0 }, // pre-placed
      { supplies: 800, fuel: 200, seconds: 90 },
      { supplies: 2000, fuel: 600, seconds: 240 },
    ],
  },
  supplyDepot: {
    kind: 'supplyDepot',
    name: 'Supply Depot',
    levels: [
      { supplies: 150, fuel: 0, seconds: 15 },
      { supplies: 400, fuel: 50, seconds: 45 },
      { supplies: 900, fuel: 150, seconds: 120 },
    ],
    generatesSupplies: [40, 70, 110],
  },
  fuelDepot: {
    kind: 'fuelDepot',
    name: 'Fuel Depot',
    levels: [
      { supplies: 200, fuel: 0, seconds: 20 },
      { supplies: 500, fuel: 50, seconds: 60 },
      { supplies: 1100, fuel: 200, seconds: 150 },
    ],
    generatesFuel: [8, 14, 22],
  },
  storageBunker: {
    kind: 'storageBunker',
    name: 'Storage Bunker',
    levels: [
      { supplies: 200, fuel: 0, seconds: 20 },
      { supplies: 500, fuel: 0, seconds: 60 },
      { supplies: 1200, fuel: 100, seconds: 150 },
    ],
    storage: [
      { supplies: 1200, fuel: 350 },
      { supplies: 2400, fuel: 700 },
      { supplies: 4200, fuel: 1200 },
    ],
  },
  engBay: {
    kind: 'engBay',
    name: 'Engineering Bay',
    levels: [
      { supplies: 300, fuel: 50, seconds: 30 },
      { supplies: 700, fuel: 150, seconds: 90 },
      { supplies: 1600, fuel: 400, seconds: 200 },
    ],
    buildSpeed: [0.15, 0.25, 0.35],
  },
  barracks: {
    kind: 'barracks',
    name: 'Barracks',
    levels: [
      { supplies: 300, fuel: 0, seconds: 30 },
      { supplies: 700, fuel: 100, seconds: 80 },
      { supplies: 1500, fuel: 300, seconds: 180 },
    ],
  },
  motorpool: {
    kind: 'motorpool',
    name: 'Motor Pool',
    levels: [
      { supplies: 450, fuel: 50, seconds: 45 },
      { supplies: 950, fuel: 200, seconds: 110 },
      { supplies: 2000, fuel: 500, seconds: 220 },
    ],
  },
  radar: {
    kind: 'radar',
    name: 'Signals Station',
    levels: [
      { supplies: 350, fuel: 50, seconds: 35 },
      { supplies: 800, fuel: 150, seconds: 100 },
      { supplies: 1800, fuel: 400, seconds: 210 },
    ],
    generatesIntel: [4, 7, 11],
    intelCap: [150, 300, 500],
  },
  m2nest: {
    kind: 'm2nest',
    name: 'M2 MG Nest',
    levels: [
      { supplies: 60, fuel: 0, seconds: 10 },
      { supplies: 150, fuel: 20, seconds: 20 },
      { supplies: 350, fuel: 60, seconds: 45 },
    ],
  },
  autocannon: {
    kind: 'autocannon',
    name: '25mm Autocannon',
    levels: [
      { supplies: 100, fuel: 0, seconds: 15 },
      { supplies: 250, fuel: 60, seconds: 30 },
      { supplies: 550, fuel: 140, seconds: 60 },
    ],
  },
  mortar: {
    kind: 'mortar',
    name: '120mm Mortar Pit',
    levels: [
      { supplies: 120, fuel: 0, seconds: 15 },
      { supplies: 300, fuel: 80, seconds: 30 },
      { supplies: 650, fuel: 180, seconds: 60 },
    ],
  },
};

/** Kinds the player can construct in town (order = build menu order). */
export const BUILDABLE_KINDS = [
  'supplyDepot',
  'fuelDepot',
  'storageBunker',
  'engBay',
  'radar',
  'barracks',
  'motorpool',
  'm2nest',
  'autocannon',
  'mortar',
] as const;

// ---- Command Center gating ---------------------------------------------------------

export interface CcGating {
  /** Max upgrade level for every structure at this CC level. */
  maxStructureLevel: number;
  /** Max Supplies-wall segments. */
  walls: number;
  /** Max count per structure kind. */
  counts: Record<string, number>;
}

export const CC_GATING: CcGating[] = [
  {
    maxStructureLevel: 1,
    walls: 50,
    counts: {
      supplyDepot: 2, fuelDepot: 1, storageBunker: 1, engBay: 0, radar: 0,
      barracks: 1, motorpool: 0, m2nest: 2, autocannon: 1, mortar: 0,
    },
  },
  {
    maxStructureLevel: 2,
    walls: 80,
    counts: {
      supplyDepot: 3, fuelDepot: 2, storageBunker: 2, engBay: 1, radar: 1,
      barracks: 1, motorpool: 1, m2nest: 3, autocannon: 2, mortar: 1,
    },
  },
  {
    maxStructureLevel: 3,
    walls: 120,
    counts: {
      supplyDepot: 4, fuelDepot: 3, storageBunker: 3, engBay: 1, radar: 1,
      barracks: 2, motorpool: 1, m2nest: 4, autocannon: 3, mortar: 2,
    },
  },
];

/** Baseline caps provided by the Command Center itself, per CC level. */
export const BASE_CAPS = [
  { supplies: 800, fuel: 250, intel: 60 },
  { supplies: 1200, fuel: 350, intel: 100 },
  { supplies: 2000, fuel: 550, intel: 160 },
];

// ---- ordnance & bootstrap -------------------------------------------------------------

/** Fuel price per stocked power charge, and the stock cap per power. */
export const CHARGE_PRICES: Record<string, number> = { a10: 30, arty: 25 };
export const CHARGE_CAP = 3;

export const STARTING_SUPPLIES = 600;
export const STARTING_FUEL = 120;

/** Offline generation accrues for at most this long. */
export const OFFLINE_CAP_HOURS = 8;

/** Repairing a wrecked structure costs this fraction of its cumulative cost. */
export const WRECK_REPAIR_FRACTION = 0.3;

/** Stored resources lost when the Command Center falls. */
export const DEFEAT_LOSS_FRACTION = 0.15;
