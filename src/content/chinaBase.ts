import type { StructureProfile, WallDef } from '../sim/types';

/**
 * China's Front Line base kit (M4): what USA raids attack. In sim terms
 * these are the "structures" of a raid battle. Levels scale with tier.
 *
 * Design intents:
 * - Type 88 HMG shreds infantry, tickles armor
 * - QLZ auto-grenade punishes clustered squads
 * - HJ-8 ATGM is the Abrams answer — outranges every US weapon
 *
 * RETUNED in v1.21, because two of those three intents were not true of the
 * numbers. The game has exactly two base kits — this one, which the USA and
 * the UN raid, and the USA firebase, which China, Russia and the KPA raid —
 * and running every reference force against BOTH, with forced shapes so the
 * deal could not move it, found this one 34 clear-rate points softer for all
 * five:
 *
 *     force    vs CHINA kit   vs USA kit   gap
 *     USA           92.2         62.1     +30.1
 *     CHINA         93.0         52.7     +40.2
 *     RUSSIA        81.6         50.4     +31.3
 *     NK            48.4         18.8     +29.7
 *     UN            57.4         19.1     +38.3
 *
 * The gap was in two of the three gun slots, and the basic slot — Type 88
 * against the M2 nest — was already even at 0.91x. Weighting each gun by
 * effective damage against the armour the reference plans actually field, and
 * by the ground it covers:
 *
 *     slot           China kit          USA kit           USA kit was
 *     basic          hmg   29.3 @ 4.5   m2nest 26.6 @ 4.5      0.91x
 *     area denial    qlz   20.2 @ 4.0   autocn 30.0 @ 5.5      2.80x
 *     anti-armor     atgm  13.4 @ 5.5   mortar 11.2 @ 9.0      2.00x
 *
 * The generator puts an area-denial gun in every second slot and an anti-armor
 * gun in every third, so three of five guns on a deep base sat at half the
 * other kit's worth. That is also the GDD contradicting itself: §4.2 gives
 * China "rapid-fire anti-swarm emplacements", and the QLZ fired at 0.9/s
 * against a US autocannon's 1.6/s.
 *
 * So both are now what they were described as, and the fix is RATE and REACH
 * rather than damage — a heavier shell would have made them precision weapons,
 * which is the USA kit's identity, not this one's. The settings were swept
 * against the kit-swap table above rather than derived: x2.0 rate / +0.7 reach
 * on the QLZ and x1.8 / +1.3 on the ATGM land within half a point of parity.
 * Nothing a player builds moves — town defences come from a different table.
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
      shotsPerSecond: 1.8,
      range: 4.7,
      splashRadius: 1.2,
      flightSeconds: 0.8,
    },
    levels: [
      {
        maxHp: 300,
        weapon: {
          damageType: 'explosive',
          damage: 26,
          shotsPerSecond: 1.8,
          range: 4.9,
          splashRadius: 1.25,
          flightSeconds: 0.8,
        },
      },
      {
        maxHp: 380,
        weapon: {
          damageType: 'explosive',
          damage: 33,
          shotsPerSecond: 1.8,
          range: 5.1,
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
    weapon: { damageType: 'shaped', damage: 60, shotsPerSecond: 0.63, range: 6.8 },
    levels: [
      { maxHp: 350, weapon: { damageType: 'shaped', damage: 76, shotsPerSecond: 0.63, range: 6.8 } },
      { maxHp: 430, weapon: { damageType: 'shaped', damage: 94, shotsPerSecond: 0.63, range: 7.0 } },
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
