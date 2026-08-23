import type { PowerDef, StructureProfile, WallDef } from '../sim/types';
import { ECONOMY_STRUCTURES } from './buildings';
import type { TrainMeta } from './usaUnits';

/**
 * Russia as a PLAYABLE faction (v0.5): the Iron Corridor kit.
 *
 * Signature: OVERBUILT. Everything on the Russian side carries more concrete
 * — walls, bunkers, and the command post run ~25–30% more HP than their USA
 * role-equivalents — paid for in the meta layer: town builds cost more and
 * take longer, and wreck repairs are pricier (see factions.ts multipliers).
 * Guns trade reach and finesse for weight: heavier rounds, wider splash,
 * shorter arcs. The power roles are pure artillery doctrine — a Grad line
 * instead of a gun run, and TOS-1A thermobarics that land few, huge blasts.
 */

const rename = (profile: StructureProfile, name: string): StructureProfile => ({
  ...profile,
  name,
});

export const RUSSIA_TOWN_STRUCTURES: Record<string, StructureProfile> = {
  cc: {
    kind: 'cc',
    name: 'Corridor Command Bunker',
    maxHp: 1900,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 2800 }, { maxHp: 3800 }],
  },

  // ---- emplacements (role-keyed) ---------------------------------------------
  m2nest: {
    kind: 'm2nest',
    name: 'PKM Bunker',
    maxHp: 330,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 70,
    weapon: { damageType: 'smallArms', damage: 10, shotsPerSecond: 3.0, range: 4.5 },
    levels: [
      { maxHp: 420, weapon: { damageType: 'smallArms', damage: 13, shotsPerSecond: 3.0, range: 4.5 } },
      { maxHp: 520, weapon: { damageType: 'smallArms', damage: 17, shotsPerSecond: 3.0, range: 4.5 } },
    ],
  },
  autocannon: {
    kind: 'autocannon',
    name: '2A72 Cannon Bunker',
    maxHp: 400,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 110,
    weapon: { damageType: 'kinetic', damage: 26, shotsPerSecond: 1.3, range: 5.0  },
    levels: [
      { maxHp: 500, weapon: { damageType: 'kinetic', damage: 34, shotsPerSecond: 1.3, range: 5.0  } },
      { maxHp: 620, weapon: { damageType: 'kinetic', damage: 43, shotsPerSecond: 1.3, range: 5.0  } },
    ],
  },
  manpads: {
    kind: 'manpads',
    name: 'Igla Team',
    maxHp: 90,
    footprint: 1,
    blocks: false,
    targetable: true,
    cpCost: 26,
    // Two men and a tube: no help at all against the ground, and the only
    // thing a commander can put up once the rotors are already inbound.
    weapon: { damageType: 'flak', damage: 74, shotsPerSecond: 0.7, range: 4.6, targets: 'air' },
  },
  aa: {
    kind: 'aa',
    name: 'ZSU-23 Emplacement',
    maxHp: 380,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 150,
    // Heavy, cheap to feed, half-blind: it kills what flies over it, not past it.
    weapon: { damageType: 'flak', damage: 44, shotsPerSecond: 1.3, range: 4.2, targets: 'both' },
    levels: [
      { maxHp: 480, weapon: { damageType: 'flak', damage: 56, shotsPerSecond: 1.3, range: 4.2, targets: 'both' } },
      { maxHp: 600, weapon: { damageType: 'flak', damage: 70, shotsPerSecond: 1.4, range: 4.5, targets: 'both' } },
    ],
  },
  mortar: {
    kind: 'mortar',
    name: '2B14 Podnos Pit',
    maxHp: 270,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 130,
    weapon: {
      damageType: 'explosive',
      damage: 38,
      shotsPerSecond: 1 / 3.8,
      range: 8.5,
      minRange: 3,
      splashRadius: 1.9,
      flightSeconds: 1.3,
    },
    levels: [
      {
        maxHp: 340,
        weapon: {
          damageType: 'explosive', damage: 50, shotsPerSecond: 1 / 3.8,
          range: 8.5, minRange: 3, splashRadius: 1.9, flightSeconds: 1.3,
        },
      },
      {
        maxHp: 430,
        weapon: {
          damageType: 'explosive', damage: 62, shotsPerSecond: 1 / 3.8,
          range: 9, minRange: 3, splashRadius: 2.0, flightSeconds: 1.3,
        },
      },
    ],
  },

  // ---- field defenses (battle layer) ---------------------------------------------
  depmg: {
    kind: 'depmg',
    name: 'PKM Team',
    maxHp: 150,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 25,
    weapon: { damageType: 'smallArms', damage: 8, shotsPerSecond: 3.0, range: 4.0 },
  },
  foxhole: {
    kind: 'foxhole',
    name: 'Trench Section',
    maxHp: 240,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 22,
    weapon: { damageType: 'smallArms', damage: 7, shotsPerSecond: 2.5, range: 3.5 },
  },
  claymore: {
    kind: 'claymore',
    name: 'MON-50 Field',
    maxHp: 10,
    footprint: 1,
    blocks: false,
    targetable: false,
    cpCost: 16,
    trigger: { radius: 0.8, damage: 95, damageType: 'explosive', splashRadius: 1.5 },
  },

  // ---- economy: same shapes and numbers, corridor identities -----------------------
  supplyDepot: rename(ECONOMY_STRUCTURES['supplyDepot']!, 'Supply Railhead'),
  fuelDepot: rename(ECONOMY_STRUCTURES['fuelDepot']!, 'POL Point'),
  storageBunker: rename(ECONOMY_STRUCTURES['storageBunker']!, 'Deep Bunker'),
  engBay: rename(ECONOMY_STRUCTURES['engBay']!, 'Engineer Battalion'),
  radar: rename(ECONOMY_STRUCTURES['radar']!, 'GRU Signals Post'),
  barracks: rename(ECONOMY_STRUCTURES['barracks']!, 'Conscript Barracks'),
  motorpool: rename(ECONOMY_STRUCTURES['motorpool']!, 'Tank Park'),
  airfield: rename(ECONOMY_STRUCTURES['airfield']!, 'Forward Airstrip'),
};

/** Overbuilt even at the wall line: slabs and berms, dearer per segment. */
export const RUSSIA_TOWN_WALLS: Record<string, WallDef> = {
  wall: { kind: 'wall', name: 'Concrete Slab Wall', hp: 190, supplyCost: 12 },
  gate: { kind: 'gate', name: 'Blast Gate', hp: 105, supplyCost: 17, gateCpCost: 4 },
  hesco: { kind: 'hesco', name: 'Earth Berm', hp: 430, cpCost: 12 },
};

export const RUSSIA_TOWN_POWERS: Record<string, PowerDef> = {
  a10: {
    type: 'strafe',
    kind: 'a10',
    name: 'BM-21 Grad Rocket Line',
    short: 'Grad Line',
    cpCost: 45,
    cooldownSeconds: 45,
    delayTicks: 14,
    pulses: 6,
    pulseSpacingTicks: 4,
    pulseDamage: 24,
    damageType: 'explosive',
    halfLength: 5.5,
    halfWidth: 1.1,
  },
  arty: {
    type: 'barrage',
    kind: 'arty',
    name: 'TOS-1A Thermobaric Salvo',
    short: 'TOS-1A Salvo',
    cpCost: 65,
    cooldownSeconds: 65,
    delayTicks: 32,
    shells: 5,
    shellSpacingTicks: 8,
    shellDamage: 95,
    damageType: 'explosive',
    splashRadius: 2.2,
    scatter: 1.6,
  },
};

/**
 * Russia's raid army: heavier per body than anyone, priced accordingly.
 * Manpower sits between USA elites and PLA mass.
 */
export const RUSSIA_TRAINABLE: TrainMeta[] = [
  { kind: 'conscript', name: 'Conscript Section', short: 'CON', supplies: 30, fuel: 0, seconds: 8, manpower: 1, facility: 'barracks' },
  { kind: 'motorrifle', name: 'Motor Rifle Squad', short: 'MTR', supplies: 80, fuel: 0, seconds: 16, manpower: 2, facility: 'barracks' },
  { kind: 'demoteam', name: 'UR Demolition Team', short: 'DEM', supplies: 110, fuel: 0, seconds: 20, manpower: 2, facility: 'barracks' },
  { kind: 'rpg', name: 'RPG-29 Team', short: 'RPG', supplies: 140, fuel: 15, seconds: 24, manpower: 3, facility: 'barracks' },
  { kind: 'btr', name: 'BTR-82A', short: 'BTR', supplies: 190, fuel: 60, seconds: 34, manpower: 3, facility: 'motorpool' },
  { kind: 't72', name: 'T-72B3', short: 'T72', supplies: 380, fuel: 120, seconds: 56, manpower: 7, facility: 'motorpool' },
  { kind: 'ka52', name: 'Ka-52 Alligator', short: 'KA5', supplies: 430, fuel: 230, seconds: 74, manpower: 7, facility: 'airfield' },
];
