import type { PowerDef, StructureProfile, WallDef } from '../sim/types';
import { ECONOMY_STRUCTURES } from './buildings';
import type { TrainMeta } from './usaUnits';

/**
 * The UN Coalition as a PLAYABLE faction (v0.7): the Blue Line kit.
 *
 * Signature: SUSTAINMENT. Nothing in this kit hits hardest or reaches
 * furthest — every gun is mid-pack by design (master of none) — but the
 * line refuses to die: the Engineer Revetment and the Engineer Corps HQ
 * carry repair auras (sim `aura`) that rebuild structures and walls while
 * the fight is still on, wreck restoration is the cheapest in the war
 * (see factions.ts), and on offense the Field Medic keeps squads alive.
 * The power roles are disciplined, not massive: a fast gun pass and a
 * precision 105mm battery that lands exactly where it was asked to.
 */

const rename = (profile: StructureProfile, name: string): StructureProfile => ({
  ...profile,
  name,
});

export const UN_TOWN_STRUCTURES: Record<string, StructureProfile> = {
  cc: {
    kind: 'cc',
    name: 'Mandate Command Post',
    maxHp: 1600,
    footprint: 2,
    blocks: true,
    targetable: true,
    levels: [{ maxHp: 2350 }, { maxHp: 3200 }],
  },

  // ---- emplacements (role-keyed) ---------------------------------------------
  m2nest: {
    kind: 'm2nest',
    name: 'Peacekeeper MG Post',
    maxHp: 270,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 65,
    weapon: { damageType: 'smallArms', damage: 10, shotsPerSecond: 3.0, range: 4.5 },
    levels: [
      { maxHp: 345, weapon: { damageType: 'smallArms', damage: 13, shotsPerSecond: 3.0, range: 4.5 } },
      { maxHp: 430, weapon: { damageType: 'smallArms', damage: 16, shotsPerSecond: 3.0, range: 4.5 } },
    ],
  },
  autocannon: {
    kind: 'autocannon',
    name: 'Milan ATGM Post',
    maxHp: 330,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 105,
    weapon: { damageType: 'shaped', damage: 42, shotsPerSecond: 0.5, range: 5.3 },
    levels: [
      { maxHp: 410, weapon: { damageType: 'shaped', damage: 54, shotsPerSecond: 0.5, range: 5.3 } },
      { maxHp: 510, weapon: { damageType: 'shaped', damage: 68, shotsPerSecond: 0.5, range: 5.3 } },
    ],
  },
  manpads: {
    kind: 'manpads',
    name: 'Mistral Team',
    maxHp: 90,
    footprint: 1,
    blocks: false,
    targetable: true,
    cpCost: 22,
    // Two men and a tube: no help at all against the ground, and the only
    // thing a commander can put up once the rotors are already inbound.
    weapon: { damageType: 'flak', damage: 56, shotsPerSecond: 0.7, range: 5.2, targets: 'air' },
  },
  aa: {
    kind: 'aa',
    name: 'Skyguard 35mm',
    maxHp: 250,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 130,
    // Radar-cued twin 35mm: nothing exceptional, and it is always where it should be.
    weapon: { damageType: 'flak', damage: 34, shotsPerSecond: 1.5, range: 6.0, targets: 'both' },
    levels: [
      { maxHp: 315, weapon: { damageType: 'flak', damage: 43, shotsPerSecond: 1.5, range: 6.0, targets: 'both' } },
      { maxHp: 390, weapon: { damageType: 'flak', damage: 54, shotsPerSecond: 1.6, range: 6.3, targets: 'both' } },
    ],
  },
  mortar: {
    kind: 'mortar',
    name: 'AMOS Mortar Pit',
    maxHp: 240,
    footprint: 1,
    blocks: true,
    targetable: true,
    supplyCost: 125,
    weapon: {
      damageType: 'explosive',
      damage: 26,
      shotsPerSecond: 1 / 2.4,
      range: 8,
      minRange: 3,
      splashRadius: 1.5,
      flightSeconds: 1.1,
    },
    levels: [
      {
        maxHp: 300,
        weapon: {
          damageType: 'explosive', damage: 34, shotsPerSecond: 1 / 2.4,
          range: 8, minRange: 3, splashRadius: 1.5, flightSeconds: 1.1,
        },
      },
      {
        maxHp: 380,
        weapon: {
          damageType: 'explosive', damage: 43, shotsPerSecond: 1 / 2.4,
          range: 8.5, minRange: 3, splashRadius: 1.6, flightSeconds: 1.1,
        },
      },
    ],
  },

  // ---- field defenses (battle layer) ---------------------------------------------
  depmg: {
    kind: 'depmg',
    name: 'Peacekeeper Section',
    maxHp: 140,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 24,
    weapon: { damageType: 'smallArms', damage: 8, shotsPerSecond: 3.0, range: 3.8 },
  },
  foxhole: {
    kind: 'foxhole',
    name: 'Engineer Revetment',
    maxHp: 200,
    footprint: 1,
    blocks: true,
    targetable: true,
    cpCost: 22,
    weapon: { damageType: 'smallArms', damage: 5, shotsPerSecond: 2.5, range: 3.0 },
    aura: { healPerSecond: 15, radius: 3.0 },
  },
  claymore: {
    kind: 'claymore',
    name: 'Wire & Charge',
    maxHp: 10,
    footprint: 1,
    blocks: false,
    targetable: false,
    cpCost: 15,
    trigger: { radius: 0.8, damage: 90, damageType: 'explosive', splashRadius: 1.4 },
  },

  // ---- economy: same shapes and numbers, coalition identities ----------------------
  // The Engineer Corps HQ is the exception: it carries the wide repair aura,
  // which makes WHERE you build it the base-planning decision of the faction.
  supplyDepot: rename(ECONOMY_STRUCTURES['supplyDepot']!, 'Logistics Depot'),
  fuelDepot: rename(ECONOMY_STRUCTURES['fuelDepot']!, 'Fuel Point'),
  storageBunker: rename(ECONOMY_STRUCTURES['storageBunker']!, 'Container Yard'),
  engBay: {
    ...ECONOMY_STRUCTURES['engBay']!,
    name: 'Engineer Corps HQ',
    aura: { healPerSecond: 10, radius: 4 },
  },
  radar: rename(ECONOMY_STRUCTURES['radar']!, 'Signals & Liaison Post'),
  barracks: rename(ECONOMY_STRUCTURES['barracks']!, 'Multinational Barracks'),
  motorpool: rename(ECONOMY_STRUCTURES['motorpool']!, 'Vehicle Compound'),
  airfield: rename(ECONOMY_STRUCTURES['airfield']!, 'Coalition Air Wing'),
};

/** Mid-pack at the wall line too: T-walls and true HESCO. */
export const UN_TOWN_WALLS: Record<string, WallDef> = {
  wall: { kind: 'wall', name: 'T-Wall Section', hp: 160, supplyCost: 11 },
  hesco: { kind: 'hesco', name: 'HESCO Rampart', hp: 360, cpCost: 10 },
};

export const UN_TOWN_POWERS: Record<string, PowerDef> = {
  a10: {
    type: 'strafe',
    kind: 'a10',
    name: 'Gripen Gun Pass',
    short: 'Gun Pass',
    cpCost: 48,
    cooldownSeconds: 42,
    delayTicks: 14,
    pulses: 5,
    pulseSpacingTicks: 4,
    pulseDamage: 22,
    damageType: 'explosive',
    halfLength: 5.5,
    halfWidth: 1.0,
  },
  arty: {
    type: 'barrage',
    kind: 'arty',
    name: '105mm Precision Battery',
    short: '105mm Btty',
    cpCost: 58,
    cooldownSeconds: 60,
    delayTicks: 26,
    shells: 6,
    shellSpacingTicks: 7,
    shellDamage: 48,
    damageType: 'explosive',
    splashRadius: 1.5,
    scatter: 0.9,
  },
};

/**
 * The coalition army: a bit of everyone's, priced in the middle, kept
 * alive by the medics. Loss aversion is the doctrine — survivors come
 * home, and with the UN they actually do.
 */
export const UN_TRAINABLE: TrainMeta[] = [
  { kind: 'peacekeeper', name: 'Peacekeeper Squad', short: 'PKR', supplies: 60, fuel: 0, seconds: 12, manpower: 2, facility: 'barracks' },
  { kind: 'unmedic', name: 'Field Medic Team', short: 'MED', supplies: 80, fuel: 0, seconds: 14, manpower: 2, facility: 'barracks' },
  { kind: 'unsapper', name: 'Engineer Breach Team', short: 'ENG', supplies: 100, fuel: 0, seconds: 18, manpower: 2, facility: 'barracks' },
  { kind: 'nlaw', name: 'NLAW Team', short: 'NLW', supplies: 120, fuel: 15, seconds: 22, manpower: 3, facility: 'barracks' },
  { kind: 'vab', name: 'VAB APC', short: 'VAB', supplies: 170, fuel: 50, seconds: 30, manpower: 3, facility: 'motorpool' },
  { kind: 'leo1', name: 'Leopard 1A5', short: 'LEO', supplies: 350, fuel: 110, seconds: 52, manpower: 6, facility: 'motorpool' },
  { kind: 'nh90', name: 'NH90 Gunship', short: 'NH9', supplies: 340, fuel: 180, seconds: 58, manpower: 6, facility: 'airfield' },
];
