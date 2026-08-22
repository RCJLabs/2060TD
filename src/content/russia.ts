import type { AttackerProfile } from '../sim/types';

/**
 * Russia — Armor & Artillery (GDD §4.3). Two lives:
 * - the M3 campaign cameo (a T-72 detachment probes the Oregon coast), and
 * - from v0.5, the playable faction's raid army: fewer bodies than the PLA,
 *   heavier than everyone, with the best demolition teams in the war.
 *
 * All numbers ride the balance harness (docs/BALANCE.md).
 */
export const RU_ATTACKERS: Record<string, AttackerProfile> = {
  conscript: {
    kind: 'conscript',
    name: 'Conscript Section',
    maxHp: 45,
    speed: 2.6,
    armor: 'none',
    wallDps: 2,
    hqDps: 9,
    cpValue: 2,
    speedJitter: 0.08,
  },
  motorrifle: {
    kind: 'motorrifle',
    name: 'Motor Rifle Squad',
    maxHp: 100,
    speed: 2.0,
    armor: 'none',
    wallDps: 6,
    hqDps: 14,
    cpValue: 3,
    speedJitter: 0.06,
  },
  demoteam: {
    kind: 'demoteam',
    name: 'UR Demolition Team',
    maxHp: 85,
    speed: 2.1,
    armor: 'none',
    wallDps: 80,
    hqDps: 12,
    cpValue: 4,
    speedJitter: 0.06,
  },
  rpg: {
    kind: 'rpg',
    name: 'RPG-29 Team',
    maxHp: 85,
    speed: 2.0,
    armor: 'none',
    wallDps: 5,
    hqDps: 10,
    cpValue: 4,
    weapon: { damageType: 'shaped', damage: 50, shotsPerSecond: 0.45, range: 4.0 },
    speedJitter: 0.06,
  },
  btr: {
    kind: 'btr',
    name: 'BTR-82A',
    maxHp: 360,
    speed: 1.9,
    armor: 'light',
    wallDps: 14,
    hqDps: 15,
    cpValue: 8,
    weapon: { damageType: 'kinetic', damage: 20, shotsPerSecond: 1.4, range: 3.2 },
    speedJitter: 0.05,
  },
  t72: {
    kind: 't72',
    name: 'T-72B3',
    maxHp: 700,
    speed: 1.5,
    armor: 'heavy',
    wallDps: 32,
    hqDps: 26,
    cpValue: 13,
    weapon: {
      damageType: 'kinetic',
      damage: 45,
      shotsPerSecond: 0.5,
      range: 3.8,
    },
    speedJitter: 0.04,
  },
};
