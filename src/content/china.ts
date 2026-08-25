import type { AttackerProfile } from '../sim/types';

/**
 * China — Mass & Production. The M1 assault roster (GDD §4.2).
 *
 * All numbers provisional until the balance harness (M5). Design intents:
 * - militia are the swarm that tests splash and CP-per-kill economy
 * - sappers are the anti-maze answer (walls cost them almost nothing)
 * - grenadiers outrange nothing but chew field defenses if unescorted
 * - ZBD escorts punish small-arms-only defenses
 * - the Type 99 is the wave-5 wall: kinetic damage or powers, or it walks home
 */
export const CHINA_ATTACKERS: Record<string, AttackerProfile> = {
  militia: {
    kind: 'militia',
    name: 'Militia Rush',
    maxHp: 35,
    speed: 3.0,
    armor: 'none',
    wallDps: 2,
    hqDps: 8,
    cpValue: 2,
    speedJitter: 0.08,
  },
  rifle: {
    kind: 'rifle',
    name: 'PLA Rifle Squad',
    maxHp: 75,
    speed: 2.2,
    armor: 'none',
    wallDps: 4,
    hqDps: 12,
    cpValue: 3,
    speedJitter: 0.06,
  },
  sapper: {
    kind: 'sapper',
    name: 'Sapper Team',
    maxHp: 70,
    speed: 2.4,
    armor: 'none',
    wallDps: 60,
    hqDps: 10,
    cpValue: 4,
    speedJitter: 0.06,
  },
  grenadier: {
    kind: 'grenadier',
    name: 'Grenadier',
    maxHp: 55,
    speed: 2.0,
    armor: 'none',
    wallDps: 4,
    hqDps: 8,
    cpValue: 5,
    weapon: {
      damageType: 'explosive',
      damage: 33,
      shotsPerSecond: 0.8,
      range: 4.0,
    },
    speedJitter: 0.06,
  },
  zbd: {
    kind: 'zbd',
    name: 'ZBD-04 IFV',
    maxHp: 320,
    speed: 1.8,
    armor: 'light',
    wallDps: 15,
    hqDps: 15,
    cpValue: 8,
    weapon: {
      damageType: 'kinetic',
      damage: 18,
      shotsPerSecond: 1.2,
      range: 3.0,
    },
    speedJitter: 0.04,
  },
  type99: {
    kind: 'type99',
    name: 'Type 99 MBT',
    maxHp: 700,
    speed: 1.2,
    armor: 'heavy',
    wallDps: 30,
    hqDps: 20,
    cpValue: 15,
    weapon: {
      damageType: 'explosive',
      damage: 44,
      shotsPerSecond: 0.4,
      range: 4.0,
    },
    speedJitter: 0.03,
  },
  wz10: {
    kind: 'wz10',
    name: 'WZ-10 Gunship',
    maxHp: 210,
    speed: 3.0,
    armor: 'air',
    wallDps: 0,
    hqDps: 26,
    cpValue: 12,
    air: true,
    // Rocket pods: shorter reach than a drone, far more weight of fire.
    weapon: { damageType: 'explosive', damage: 34, shotsPerSecond: 0.8, range: 4.0 },
    speedJitter: 0.05,
  },
};
