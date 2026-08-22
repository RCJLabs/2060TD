import type { PowerDef, StructureProfile, WallDef } from '../sim/types';
import { ECONOMY_STRUCTURES } from './buildings';
import type { TrainMeta } from './usaUnits';

/**
 * China as a PLAYABLE faction (M5): the defense kit and army the player gets
 * when they take the other side of the war.
 *
 * The pipeline rule: structure/power KINDS are role ids shared across
 * factions ('m2nest' = basic gun nest role, 'a10' = strafe power role, …) so
 * gating, unlock keys, saves, and UI plumbing never care who you are.
 * Faction identity lives in names, stats, and flavor:
 * - USA counters armor with kinetic autocannons; China counters it with
 *   shaped-charge HJ-8 posts (their enemies bring Abrams, not Type 99s).
 * - China's strafe role is an MLRS ripple; the barrage role is true
 *   saturation — more shells, wider, individually weaker.
 */

const rename = (profile: StructureProfile, name: string): StructureProfile => ({
  ...profile,
  name,
});

export const CHINA_TOWN_STRUCTURES: Record<string, StructureProfile> = {
  cc: {
    kind: 'cc',
    name: 'Beachhead HQ',
    maxHp: 1500,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 2200 }, { maxHp: 3000 }],
  },

  // ---- emplacements (role-keyed) ---------------------------------------------
  m2nest: {
    kind: 'm2nest',
    name: 'Type 88 HMG Nest',
    maxHp: 250,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 60,
    weapon: { damageType: 'smallArms', damage: 10, shotsPerSecond: 3.4, range: 4.5 },
    levels: [
      { maxHp: 320, weapon: { damageType: 'smallArms', damage: 13, shotsPerSecond: 3.4, range: 4.5 } },
      { maxHp: 400, weapon: { damageType: 'smallArms', damage: 16, shotsPerSecond: 3.4, range: 4.5 } },
    ],
  },
  autocannon: {
    kind: 'autocannon',
    name: 'HJ-8 ATGM Post',
    maxHp: 290,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 100,
    weapon: { damageType: 'shaped', damage: 45, shotsPerSecond: 0.5, range: 5.2 },
    levels: [
      { maxHp: 360, weapon: { damageType: 'shaped', damage: 58, shotsPerSecond: 0.5, range: 5.2 } },
      { maxHp: 450, weapon: { damageType: 'shaped', damage: 72, shotsPerSecond: 0.5, range: 5.4 } },
    ],
  },
  mortar: {
    kind: 'mortar',
    name: 'PP-87 Mortar Pit',
    maxHp: 200,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 120,
    weapon: {
      damageType: 'explosive',
      damage: 32,
      shotsPerSecond: 1 / 3.2,
      range: 8.5,
      minRange: 3,
      splashRadius: 1.7,
      flightSeconds: 1.2,
    },
    levels: [
      {
        maxHp: 260,
        weapon: {
          damageType: 'explosive', damage: 42, shotsPerSecond: 1 / 3.2,
          range: 8.5, minRange: 3, splashRadius: 1.7, flightSeconds: 1.2,
        },
      },
      {
        maxHp: 330,
        weapon: {
          damageType: 'explosive', damage: 53, shotsPerSecond: 1 / 3.2,
          range: 9, minRange: 3, splashRadius: 1.8, flightSeconds: 1.2,
        },
      },
    ],
  },

  // ---- field defenses (battle layer) ---------------------------------------------
  depmg: {
    kind: 'depmg',
    name: 'Type 67 MG Team',
    maxHp: 120,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 25,
    weapon: { damageType: 'smallArms', damage: 8, shotsPerSecond: 3.2, range: 4.0 },
  },
  foxhole: {
    kind: 'foxhole',
    name: 'Fighting Pit',
    maxHp: 190,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 20,
    weapon: { damageType: 'smallArms', damage: 7, shotsPerSecond: 2.5, range: 3.5 },
  },
  claymore: {
    kind: 'claymore',
    name: 'POMZ Stake Field',
    maxHp: 10,
    footprint: 1,
    blocks: false,
    targetable: false,
    cpCost: 15,
    trigger: { radius: 0.8, damage: 85, damageType: 'explosive', splashRadius: 1.6 },
  },

  // ---- economy: same shapes and numbers, Chinese identities ------------------------
  supplyDepot: rename(ECONOMY_STRUCTURES['supplyDepot']!, 'Supply Point'),
  fuelDepot: rename(ECONOMY_STRUCTURES['fuelDepot']!, 'Fuel Bowser Park'),
  storageBunker: rename(ECONOMY_STRUCTURES['storageBunker']!, 'Stores Pit'),
  engBay: rename(ECONOMY_STRUCTURES['engBay']!, 'Engineer Corps'),
  radar: rename(ECONOMY_STRUCTURES['radar']!, 'Signals Post'),
  barracks: rename(ECONOMY_STRUCTURES['barracks']!, 'Militia Barracks'),
  motorpool: rename(ECONOMY_STRUCTURES['motorpool']!, 'Vehicle Park'),
};

export const CHINA_TOWN_WALLS: Record<string, WallDef> = {
  wall: { kind: 'wall', name: 'Compound Wall', hp: 150, supplyCost: 10 },
  hesco: { kind: 'hesco', name: 'Gabion Wall', hp: 350, cpCost: 10 },
};

export const CHINA_TOWN_POWERS: Record<string, PowerDef> = {
  a10: {
    type: 'strafe',
    kind: 'a10',
    name: 'Type 89 MLRS Ripple',
    short: 'MLRS Ripple',
    cpCost: 45,
    cooldownSeconds: 45,
    delayTicks: 12,
    pulses: 5,
    pulseSpacingTicks: 4,
    pulseDamage: 26,
    damageType: 'explosive',
    halfLength: 5.0,
    halfWidth: 1.0,
  },
  arty: {
    type: 'barrage',
    kind: 'arty',
    name: 'PLZ-05 Saturation',
    short: 'PLZ-05 Battery',
    cpCost: 60,
    cooldownSeconds: 60,
    delayTicks: 30,
    shells: 8,
    shellSpacingTicks: 6,
    shellDamage: 46,
    damageType: 'explosive',
    splashRadius: 1.3,
    scatter: 3.0,
  },
};

/**
 * China's raid army: the M1 assault roster, now trainable. Manpower runs
 * cheaper than the USA table on purpose — mass is the faction identity, and
 * the same cap must field a visibly bigger force (M5 balance pass).
 */
export const CHINA_TRAINABLE: TrainMeta[] = [
  { kind: 'militia', name: 'Militia Rush', short: 'MIL', supplies: 35, fuel: 0, seconds: 8, manpower: 1, facility: 'barracks' },
  { kind: 'rifle', name: 'PLA Rifle Squad', short: 'RFL', supplies: 70, fuel: 0, seconds: 14, manpower: 2, facility: 'barracks' },
  { kind: 'sapper', name: 'Sapper Team', short: 'SAP', supplies: 95, fuel: 0, seconds: 18, manpower: 2, facility: 'barracks' },
  { kind: 'grenadier', name: 'Grenadier', short: 'GRN', supplies: 120, fuel: 15, seconds: 22, manpower: 2, facility: 'barracks' },
  { kind: 'zbd', name: 'ZBD-04 IFV', short: 'ZBD', supplies: 170, fuel: 55, seconds: 32, manpower: 3, facility: 'motorpool' },
  { kind: 'type99', name: 'Type 99 MBT', short: 'T99', supplies: 400, fuel: 125, seconds: 58, manpower: 7, facility: 'motorpool' },
];
