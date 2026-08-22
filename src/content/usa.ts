import type { PowerDef, StructureProfile, WallDef } from '../sim/types';

/**
 * USA — Quality & Response. The M1 defensive kit (GDD §4.1).
 *
 * Two build layers:
 * - supplyCost items are the PERMANENT layer, built in setup/prep phases
 * - cpCost items are the BATTLE layer (field defenses), deployed live mid-wave
 *
 * All numbers provisional until the balance harness (M5).
 */

export const USA_STRUCTURES: Record<string, StructureProfile> = {
  // The stake. 2×2, hard-blocked footprint; attackers assault its perimeter.
  cc: {
    kind: 'cc',
    name: 'Command Center',
    maxHp: 1500,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 2200 }, { maxHp: 3000 }],
  },

  // ---- emplacements (permanent layer, Supplies) ------------------------------
  m2nest: {
    kind: 'm2nest',
    name: 'M2 MG Nest',
    maxHp: 250,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 60,
    weapon: { damageType: 'smallArms', damage: 10, shotsPerSecond: 3.0, range: 4.5 },
    levels: [
      { maxHp: 320, weapon: { damageType: 'smallArms', damage: 13, shotsPerSecond: 3.0, range: 4.5 } },
      { maxHp: 400, weapon: { damageType: 'smallArms', damage: 17, shotsPerSecond: 3.0, range: 4.5 } },
    ],
  },
  autocannon: {
    kind: 'autocannon',
    name: '25mm Autocannon',
    maxHp: 300,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 100,
    weapon: { damageType: 'kinetic', damage: 22, shotsPerSecond: 1.6, range: 5.5 },
    levels: [
      { maxHp: 380, weapon: { damageType: 'kinetic', damage: 29, shotsPerSecond: 1.6, range: 5.5 } },
      { maxHp: 470, weapon: { damageType: 'kinetic', damage: 37, shotsPerSecond: 1.6, range: 5.5 } },
    ],
  },
  mortar: {
    kind: 'mortar',
    name: '120mm Mortar Pit',
    maxHp: 200,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 120,
    weapon: {
      damageType: 'explosive',
      damage: 35,
      shotsPerSecond: 1 / 3.5,
      range: 9,
      minRange: 3,
      splashRadius: 1.6,
      flightSeconds: 1.2,
    },
    levels: [
      {
        maxHp: 260,
        weapon: {
          damageType: 'explosive',
          damage: 46,
          shotsPerSecond: 1 / 3.5,
          range: 9,
          minRange: 3,
          splashRadius: 1.6,
          flightSeconds: 1.2,
        },
      },
      {
        maxHp: 330,
        weapon: {
          damageType: 'explosive',
          damage: 58,
          shotsPerSecond: 1 / 3.5,
          range: 9.5,
          minRange: 3,
          splashRadius: 1.7,
          flightSeconds: 1.2,
        },
      },
    ],
  },

  // ---- field defenses (battle layer, CP) ---------------------------------------
  depmg: {
    kind: 'depmg',
    name: 'Deployable MG',
    maxHp: 120,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 25,
    weapon: { damageType: 'smallArms', damage: 8, shotsPerSecond: 3.0, range: 4.0 },
  },
  foxhole: {
    kind: 'foxhole',
    name: 'Rifle Foxhole',
    maxHp: 180,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 20,
    weapon: { damageType: 'smallArms', damage: 7, shotsPerSecond: 2.5, range: 3.5 },
  },
  claymore: {
    kind: 'claymore',
    name: 'Claymore Field',
    maxHp: 10,
    footprint: 1,
    blocks: false,
    targetable: false,
    cpCost: 15,
    trigger: { radius: 0.8, damage: 90, damageType: 'explosive', splashRadius: 1.5 },
  },
};

export const USA_WALLS: Record<string, WallDef> = {
  wall: { kind: 'wall', name: 'Wall Segment', hp: 150, supplyCost: 10 },
  hesco: { kind: 'hesco', name: 'HESCO Barricade', hp: 350, cpCost: 10 },
};

export const USA_POWERS: Record<string, PowerDef> = {
  a10: {
    type: 'strafe',
    kind: 'a10',
    name: 'A-10 Gun Run',
    cpCost: 45,
    cooldownSeconds: 45,
    delayTicks: 10,
    pulses: 4,
    pulseSpacingTicks: 4,
    pulseDamage: 35,
    damageType: 'kinetic',
    halfLength: 4.5,
    halfWidth: 0.9,
  },
  arty: {
    type: 'barrage',
    kind: 'arty',
    name: '155mm Fire Mission',
    cpCost: 60,
    cooldownSeconds: 60,
    delayTicks: 30,
    shells: 5,
    shellSpacingTicks: 8,
    shellDamage: 70,
    damageType: 'explosive',
    splashRadius: 1.4,
    scatter: 2.2,
  },
};
