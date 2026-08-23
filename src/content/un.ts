import type { AttackerProfile } from '../sim/types';

/**
 * UN Coalition raid roster (v0.7) — Support & Versatility (GDD §4.5).
 * A mixed multinational force: nothing here is the best at its job, and
 * nothing is the worst. The signature is the Field Medic Team — the only
 * unit in the war that heals other units (sim sustainment aura), which is
 * why UN raids come home with survivors nobody else keeps.
 *
 * All numbers ride the balance harness (docs/BALANCE.md).
 */
export const UN_ATTACKERS: Record<string, AttackerProfile> = {
  peacekeeper: {
    kind: 'peacekeeper',
    name: 'Peacekeeper Squad',
    maxHp: 85,
    speed: 2.2,
    armor: 'none',
    wallDps: 5,
    hqDps: 12,
    cpValue: 3,
    speedJitter: 0.06,
  },
  unmedic: {
    kind: 'unmedic',
    name: 'Field Medic Team',
    maxHp: 70,
    speed: 2.3,
    armor: 'none',
    wallDps: 0,
    hqDps: 4,
    cpValue: 3,
    heal: { perSecond: 22, radius: 3.0 },
    speedJitter: 0.06,
  },
  unsapper: {
    kind: 'unsapper',
    name: 'Engineer Breach Team',
    maxHp: 90,
    speed: 2.1,
    armor: 'none',
    wallDps: 75,
    hqDps: 10,
    cpValue: 4,
    speedJitter: 0.06,
  },
  nlaw: {
    kind: 'nlaw',
    name: 'NLAW Team',
    maxHp: 80,
    speed: 2.0,
    armor: 'none',
    wallDps: 4,
    hqDps: 9,
    cpValue: 3,
    weapon: { damageType: 'shaped', damage: 45, shotsPerSecond: 0.45, range: 3.9 },
    speedJitter: 0.06,
  },
  vab: {
    kind: 'vab',
    name: 'VAB APC',
    maxHp: 340,
    speed: 2.6,
    armor: 'light',
    wallDps: 10,
    hqDps: 12,
    cpValue: 6,
    weapon: { damageType: 'kinetic', damage: 18, shotsPerSecond: 1.5, range: 3.2 },
    speedJitter: 0.05,
  },
  leo1: {
    kind: 'leo1',
    name: 'Leopard 1A5',
    maxHp: 560,
    speed: 1.5,
    armor: 'heavy',
    wallDps: 26,
    hqDps: 22,
    cpValue: 12,
    weapon: { damageType: 'kinetic', damage: 38, shotsPerSecond: 0.5, range: 3.5 },
    speedJitter: 0.05,
  },
  nh90: {
    kind: 'nh90',
    name: 'NH90 Gunship',
    maxHp: 220,
    speed: 2.8,
    armor: 'air',
    wallDps: 0,
    hqDps: 24,
    cpValue: 12,
    air: true,
    // Mid-pack in the air as on the ground, and it comes home more often.
    weapon: { damageType: 'kinetic', damage: 30, shotsPerSecond: 0.9, range: 4.0 },
    speedJitter: 0.05,
  },
};
