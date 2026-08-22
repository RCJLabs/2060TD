import type { AttackerProfile } from '../sim/types';

/**
 * Russia — Armor & Artillery (GDD §4.3). The M3 campaign teaser: a T-72
 * detachment probes the coast in ARMOR PROBE. The full faction arrives at M7.
 */
export const RU_ATTACKERS: Record<string, AttackerProfile> = {
  t72: {
    kind: 't72',
    name: 'T-72B3',
    maxHp: 420,
    speed: 1.5,
    armor: 'heavy',
    wallDps: 25,
    hqDps: 20,
    cpValue: 12,
    weapon: {
      damageType: 'kinetic',
      damage: 40,
      shotsPerSecond: 0.5,
      range: 3.8,
    },
    speedJitter: 0.04,
  },
};
