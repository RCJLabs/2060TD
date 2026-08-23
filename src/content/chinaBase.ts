import type { StructureProfile, WallDef } from '../sim/types';

/**
 * China's Front Line base kit (M4): what USA raids attack. In sim terms
 * these are the "structures" of a raid battle. Levels scale with tier.
 *
 * Design intents:
 * - Type 88 HMG shreds infantry, tickles armor
 * - QLZ auto-grenade punishes clustered squads
 * - HJ-8 ATGM is the Abrams answer — outranges every US weapon
 */
export const CHINA_BASE: Record<string, StructureProfile> = {
  // Engine contract: the base's stake is always kind 'cc'.
  cc: {
    kind: 'cc',
    name: 'Forward Command Post',
    maxHp: 1100,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 1600 }, { maxHp: 2100 }],
  },

  hmgTower: {
    kind: 'hmgTower',
    name: 'Type 88 HMG Tower',
    maxHp: 260,
    footprint: 1,
    blocks: true,
    targetable: true,
    weapon: { damageType: 'smallArms', damage: 11, shotsPerSecond: 3.0, range: 4.5 },
    levels: [
      { maxHp: 330, weapon: { damageType: 'smallArms', damage: 14, shotsPerSecond: 3.0, range: 4.5 } },
      { maxHp: 410, weapon: { damageType: 'smallArms', damage: 18, shotsPerSecond: 3.0, range: 4.5 } },
    ],
  },
  qlzTower: {
    kind: 'qlzTower',
    name: 'QLZ-04 Grenade Tower',
    maxHp: 240,
    footprint: 1,
    blocks: true,
    targetable: true,
    weapon: {
      damageType: 'explosive',
      damage: 20,
      shotsPerSecond: 0.9,
      range: 4.0,
      splashRadius: 1.2,
      flightSeconds: 0.8,
    },
    levels: [
      {
        maxHp: 300,
        weapon: {
          damageType: 'explosive',
          damage: 26,
          shotsPerSecond: 0.9,
          range: 4.2,
          splashRadius: 1.25,
          flightSeconds: 0.8,
        },
      },
      {
        maxHp: 380,
        weapon: {
          damageType: 'explosive',
          damage: 33,
          shotsPerSecond: 0.9,
          range: 4.4,
          splashRadius: 1.3,
          flightSeconds: 0.8,
        },
      },
    ],
  },
  atgmTower: {
    kind: 'atgmTower',
    name: 'HJ-8 ATGM Tower',
    maxHp: 280,
    footprint: 1,
    blocks: true,
    targetable: true,
    weapon: { damageType: 'shaped', damage: 60, shotsPerSecond: 0.35, range: 5.5 },
    levels: [
      { maxHp: 350, weapon: { damageType: 'shaped', damage: 76, shotsPerSecond: 0.35, range: 5.5 } },
      { maxHp: 430, weapon: { damageType: 'shaped', damage: 94, shotsPerSecond: 0.35, range: 5.7 } },
    ],
  },

  // v1.0: the compound's flak mount. A raid flown on rotors has to plan
  // around these the way a ground raid plans around the ATGM towers.
  aa: {
    kind: 'aa',
    name: 'PGZ-95 Flak',
    maxHp: 260,
    footprint: 1,
    blocks: true,
    targetable: true,
    weapon: { damageType: 'flak', damage: 26, shotsPerSecond: 2.2, range: 6.0, targets: 'both' },
    levels: [
      { maxHp: 330, weapon: { damageType: 'flak', damage: 33, shotsPerSecond: 2.2, range: 6.0, targets: 'both' } },
      { maxHp: 410, weapon: { damageType: 'flak', damage: 41, shotsPerSecond: 2.4, range: 6.3, targets: 'both' } },
    ],
  },
  aaSite: {
    kind: 'aaSite',
    name: 'HQ-17 Launcher',
    maxHp: 250,
    footprint: 1,
    blocks: true,
    targetable: true,
    // Compound air cover: quick to cycle, blind to everything on foot.
    weapon: { damageType: 'flak', damage: 44, shotsPerSecond: 1.1, range: 6.6, targets: 'air' },
    levels: [
      { maxHp: 315, weapon: { damageType: 'flak', damage: 56, shotsPerSecond: 1.1, range: 6.6, targets: 'air' } },
      { maxHp: 390, weapon: { damageType: 'flak', damage: 70, shotsPerSecond: 1.2, range: 6.9, targets: 'air' } },
    ],
  },
  supplyCache: {
    kind: 'supplyCache',
    name: 'Supply Cache',
    maxHp: 320,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 400 }, { maxHp: 500 }],
  },
  fuelDump: {
    kind: 'fuelDump',
    name: 'Fuel Dump',
    maxHp: 320,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 400 }, { maxHp: 500 }],
  },
};

export const CHINA_WALLS: Record<string, WallDef> = {
  wall: { kind: 'wall', name: 'Compound Wall', hp: 140, supplyCost: 10 },
  gate: { kind: 'gate', name: 'Compound Gate', hp: 80, supplyCost: 14, gateCpCost: 3 },
};
