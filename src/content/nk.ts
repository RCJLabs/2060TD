import type { AttackerProfile } from '../sim/types';

/**
 * North Korea — Asymmetric & Tunnels (GDD §4.4). Two lives:
 * - the M3 campaign teaser: infiltrators surface from tunnel mouths INSIDE
 *   the perimeter during the INFILTRATION mission, and
 * - from v0.6, the playable faction's raid army: the cheapest bodies in the
 *   war, weak head-on, built to arrive where the walls aren't — raid squads
 *   can insert through tunnels and surface inside the enemy base.
 *
 * All numbers ride the balance harness (docs/BALANCE.md).
 */
export const NK_ATTACKERS: Record<string, AttackerProfile> = {
  nkrifle: {
    kind: 'nkrifle',
    name: 'Light Infantry Squad',
    maxHp: 70,
    speed: 2.3,
    armor: 'none',
    wallDps: 4,
    hqDps: 12,
    cpValue: 2,
    speedJitter: 0.07,
  },
  infiltrator: {
    kind: 'infiltrator',
    name: 'NK Infiltrator',
    maxHp: 45,
    speed: 3.4,
    armor: 'none',
    wallDps: 8,
    hqDps: 16,
    cpValue: 4,
    speedJitter: 0.08,
  },
  tunneler: {
    kind: 'tunneler',
    name: 'Tunnel Sapper Team',
    maxHp: 80,
    speed: 2.1,
    armor: 'none',
    wallDps: 70,
    hqDps: 11,
    cpValue: 4,
    speedJitter: 0.06,
  },
  rpg7: {
    kind: 'rpg7',
    name: 'RPG-7 Team',
    maxHp: 70,
    speed: 2.0,
    armor: 'none',
    wallDps: 4,
    hqDps: 9,
    cpValue: 3,
    weapon: { damageType: 'shaped', damage: 60, shotsPerSecond: 0.45, range: 3.8 },
    speedJitter: 0.06,
  },
  chonma: {
    kind: 'chonma',
    name: 'Chonma-ho MBT',
    maxHp: 460,
    speed: 1.6,
    armor: 'heavy',
    wallDps: 22,
    hqDps: 16,
    cpValue: 9,
    weapon: { damageType: 'kinetic', damage: 24, shotsPerSecond: 0.5, range: 3.4 },
    speedJitter: 0.05,
  },
  an2: {
    kind: 'an2',
    name: 'AN-2 Colt',
    maxHp: 90,
    speed: 3.6,
    armor: 'air',
    wallDps: 0,
    hqDps: 20,
    cpValue: 6,
    air: true,
    // A canvas biplane with a bomb rack: cheap, quick, and gone the moment
    // anything with a proximity fuse looks at it.
    weapon: { damageType: 'explosive', damage: 22, shotsPerSecond: 0.7, range: 3.2 },
    speedJitter: 0.08,
  },
};
