import type { PowerDef, StructureProfile, WallDef } from '../sim/types';
import { ECONOMY_STRUCTURES } from './buildings';
import type { TrainMeta } from './usaUnits';

/**
 * North Korea as a PLAYABLE faction (v0.6): the Silent Tunnels kit.
 *
 * Signature: EXPENDABLE. Everything on the KPA side is cheap, quick, and
 * weak — sentry nests at two-thirds the price and two-thirds the concrete,
 * rock barricades that breach fast, the softest command post in the war.
 * The kit wants quantity and traps, not a line that holds by itself. Two
 * asymmetries pay for the fragility: the Koksan gun pit outranges every
 * other emplacement in the game (slow, small shells, huge reach — with a
 * real dead zone up close), and on offense raid squads can insert through
 * TUNNELS and surface inside the enemy wire (see meta/warfare.ts). The
 * power roles are saturation rocketry: an MRL lane and the KN-09 salvo —
 * many shells, wide scatter.
 */

const rename = (profile: StructureProfile, name: string): StructureProfile => ({
  ...profile,
  name,
});

export const NK_TOWN_STRUCTURES: Record<string, StructureProfile> = {
  cc: {
    kind: 'cc',
    name: 'Tunnel Complex HQ',
    maxHp: 1350,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 2000 }, { maxHp: 2700 }],
  },

  // ---- emplacements (role-keyed) ---------------------------------------------
  m2nest: {
    kind: 'm2nest',
    name: 'Sentry Nest',
    maxHp: 240,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 50,
    weapon: { damageType: 'smallArms', damage: 10, shotsPerSecond: 3.2, range: 4.2 },
    levels: [
      { maxHp: 300, weapon: { damageType: 'smallArms', damage: 12, shotsPerSecond: 3.2, range: 4.2 } },
      { maxHp: 370, weapon: { damageType: 'smallArms', damage: 15, shotsPerSecond: 3.2, range: 4.2 } },
    ],
  },
  autocannon: {
    kind: 'autocannon',
    name: 'Bulsae ATGM Nest',
    maxHp: 300,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 95,
    weapon: { damageType: 'shaped', damage: 46, shotsPerSecond: 0.5, range: 5.2 },
    levels: [
      { maxHp: 380, weapon: { damageType: 'shaped', damage: 58, shotsPerSecond: 0.5, range: 5.2 } },
      { maxHp: 470, weapon: { damageType: 'shaped', damage: 72, shotsPerSecond: 0.5, range: 5.2 } },
    ],
  },
  manpads: {
    kind: 'manpads',
    name: 'HT-16PGJ Team',
    maxHp: 90,
    footprint: 1,
    blocks: false,
    targetable: true,
    cpCost: 16,
    // Two men and a tube: no help at all against the ground, and the only
    // thing a commander can put up once the rotors are already inbound.
    weapon: { damageType: 'flak', damage: 40, shotsPerSecond: 0.7, range: 4.6, targets: 'air' },
  },
  aa: {
    kind: 'aa',
    name: 'ZPU-4 Quad Mount',
    maxHp: 170,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 70,
    // Expendable doctrine in the sky: aimed by eye, priced to be built in pairs.
    weapon: { damageType: 'flak', damage: 17, shotsPerSecond: 2.6, range: 4.8, targets: 'both' },
    levels: [
      { maxHp: 215, weapon: { damageType: 'flak', damage: 22, shotsPerSecond: 2.6, range: 4.8, targets: 'both' } },
      { maxHp: 270, weapon: { damageType: 'flak', damage: 27, shotsPerSecond: 2.8, range: 4.6, targets: 'both' } },
    ],
  },
  mortar: {
    kind: 'mortar',
    name: 'Koksan Gun Pit',
    maxHp: 240,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 115,
    weapon: {
      damageType: 'explosive',
      damage: 38,
      shotsPerSecond: 1 / 4.2,
      range: 10.5,
      minRange: 3.5,
      splashRadius: 1.7,
      flightSeconds: 1.4,
    },
    levels: [
      {
        maxHp: 300,
        weapon: {
          damageType: 'explosive', damage: 48, shotsPerSecond: 1 / 4.2,
          range: 10.5, minRange: 3.5, splashRadius: 1.7, flightSeconds: 1.4,
        },
      },
      {
        maxHp: 380,
        weapon: {
          damageType: 'explosive', damage: 60, shotsPerSecond: 1 / 4.2,
          range: 11, minRange: 3.5, splashRadius: 1.8, flightSeconds: 1.4,
        },
      },
    ],
  },

  // ---- field defenses (battle layer) ---------------------------------------------
  depmg: {
    kind: 'depmg',
    name: 'Ambush Team',
    maxHp: 120,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 20,
    weapon: { damageType: 'smallArms', damage: 9, shotsPerSecond: 3.2, range: 3.6 },
  },
  foxhole: {
    kind: 'foxhole',
    name: 'Spider Hole',
    maxHp: 150,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 16,
    weapon: { damageType: 'smallArms', damage: 6, shotsPerSecond: 2.5, range: 3.2 },
  },
  claymore: {
    kind: 'claymore',
    name: 'Directional Mine',
    maxHp: 10,
    footprint: 1,
    blocks: false,
    targetable: false,
    cpCost: 12,
    trigger: { radius: 0.8, damage: 100, damageType: 'explosive', splashRadius: 1.3 },
  },

  // ---- economy: same shapes and numbers, enclave identities -----------------------
  supplyDepot: rename(ECONOMY_STRUCTURES['supplyDepot']!, 'Supply Cache'),
  fuelDepot: rename(ECONOMY_STRUCTURES['fuelDepot']!, 'Fuel Cache'),
  storageBunker: rename(ECONOMY_STRUCTURES['storageBunker']!, 'Buried Depot'),
  engBay: rename(ECONOMY_STRUCTURES['engBay']!, 'Tunnel Corps Post'),
  radar: rename(ECONOMY_STRUCTURES['radar']!, 'RGB Listening Post'),
  barracks: rename(ECONOMY_STRUCTURES['barracks']!, 'Light Infantry School'),
  motorpool: rename(ECONOMY_STRUCTURES['motorpool']!, 'Armor Cave'),
  airfield: rename(ECONOMY_STRUCTURES['airfield']!, 'Camouflaged Airstrip'),
};

/** Cheap even at the wall line: stacked rock and sandbags, breached fast. */
export const NK_TOWN_WALLS: Record<string, WallDef> = {
  wall: { kind: 'wall', name: 'Rock Barricade', hp: 145, supplyCost: 8 },
  gate: { kind: 'gate', name: 'Timber Gate', hp: 80, supplyCost: 11, gateCpCost: 2 },
  hesco: { kind: 'hesco', name: 'Sandbag Rampart', hp: 300, cpCost: 8 },
};

export const NK_TOWN_POWERS: Record<string, PowerDef> = {
  a10: {
    type: 'strafe',
    kind: 'a10',
    name: 'MRL Fire Lane',
    short: 'MRL Lane',
    cpCost: 40,
    cooldownSeconds: 40,
    delayTicks: 14,
    pulses: 7,
    pulseSpacingTicks: 3,
    pulseDamage: 18,
    damageType: 'explosive',
    halfLength: 6.5,
    halfWidth: 0.9,
  },
  arty: {
    type: 'barrage',
    kind: 'arty',
    name: 'KN-09 Rocket Salvo',
    short: 'KN-09 Salvo',
    cpCost: 55,
    cooldownSeconds: 60,
    delayTicks: 40,
    shells: 8,
    shellSpacingTicks: 6,
    shellDamage: 55,
    damageType: 'explosive',
    splashRadius: 1.8,
    scatter: 2.8,
  },
};

/**
 * The KPA raid army: the cheapest manpower in the war, priced to be lost.
 * Nothing here wins a stand-up fight — it wins by arriving through tunnels
 * where the maze isn't.
 */
export const NK_TRAINABLE: TrainMeta[] = [
  { kind: 'nkrifle', name: 'Light Infantry Squad', short: 'INF', supplies: 25, fuel: 0, seconds: 7, manpower: 1, facility: 'barracks' },
  { kind: 'infiltrator', name: 'Infiltration Team', short: 'SOF', supplies: 45, fuel: 0, seconds: 10, manpower: 1, facility: 'barracks' },
  { kind: 'tunneler', name: 'Tunnel Sapper Team', short: 'TUN', supplies: 90, fuel: 0, seconds: 18, manpower: 2, facility: 'barracks' },
  { kind: 'rpg7', name: 'RPG-7 Team', short: 'RPG', supplies: 100, fuel: 10, seconds: 20, manpower: 2, facility: 'barracks' },
  { kind: 'chonma', name: 'Chonma-ho MBT', short: 'CHM', supplies: 260, fuel: 80, seconds: 44, manpower: 5, facility: 'motorpool' },
  { kind: 'an2', name: 'AN-2 Colt', short: 'AN2', supplies: 150, fuel: 70, seconds: 30, manpower: 3, facility: 'airfield' },
];
