import type { AttackerProfile } from '../sim/types';

/**
 * North Korea — Asymmetric & Tunnels (GDD §4.4). The M3 campaign teaser:
 * infiltrators surface from tunnel mouths INSIDE the perimeter during the
 * INFILTRATION mission. The full faction arrives at M7.
 */
export const NK_ATTACKERS: Record<string, AttackerProfile> = {
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
};
