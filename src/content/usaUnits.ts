import type { AttackerProfile } from '../sim/types';

/**
 * USA — the counterattack roster (M4, v0.2). These are "attackers" in sim
 * terms: they raid Chinese Front Line bases. Losses are permanent; survivors
 * come home.
 *
 * All numbers provisional until the balance harness (M5).
 */
export const USA_UNITS: Record<string, AttackerProfile> = {
  // Wave filler for China's campaign — mobilized National Guard. Not trainable.
  guardsman: {
    kind: 'guardsman',
    name: 'Guard Rifle Squad',
    maxHp: 55,
    speed: 2.5,
    armor: 'none',
    wallDps: 3,
    hqDps: 10,
    cpValue: 2,
    speedJitter: 0.07,
  },
  ranger: {
    kind: 'ranger',
    name: 'Ranger Squad',
    maxHp: 95,
    speed: 2.4,
    armor: 'none',
    wallDps: 18,
    hqDps: 22,
    cpValue: 3,
    speedJitter: 0.06,
  },
  engineer: {
    kind: 'engineer',
    name: 'Combat Engineer',
    maxHp: 80,
    speed: 2.3,
    armor: 'none',
    wallDps: 70,
    hqDps: 15,
    cpValue: 3,
    speedJitter: 0.06,
  },
  javelin: {
    kind: 'javelin',
    name: 'Javelin Team',
    maxHp: 70,
    speed: 2.1,
    armor: 'none',
    wallDps: 6,
    hqDps: 10,
    cpValue: 4,
    weapon: { damageType: 'shaped', damage: 45, shotsPerSecond: 0.5, range: 4.0 },
    speedJitter: 0.06,
  },
  humvee: {
    kind: 'humvee',
    name: 'Humvee CROWS',
    maxHp: 220,
    speed: 3.1,
    armor: 'light',
    wallDps: 12,
    hqDps: 15,
    cpValue: 5,
    weapon: { damageType: 'kinetic', damage: 14, shotsPerSecond: 2.0, range: 3.0 },
    speedJitter: 0.05,
  },
  abrams: {
    kind: 'abrams',
    name: 'M1 Abrams',
    maxHp: 700,
    speed: 1.3,
    armor: 'heavy',
    wallDps: 35,
    hqDps: 30,
    cpValue: 14,
    weapon: { damageType: 'explosive', damage: 60, shotsPerSecond: 0.5, range: 4.0 },
    speedJitter: 0.03,
  },
};

export interface TrainMeta {
  kind: string;
  name: string;
  short: string;
  supplies: number;
  fuel: number;
  seconds: number;
  manpower: number;
  /** Which building trains it. */
  facility: 'barracks' | 'motorpool';
}

export const TRAINABLE: TrainMeta[] = [
  { kind: 'ranger', name: 'Ranger Squad', short: 'RGR', supplies: 60, fuel: 0, seconds: 12, manpower: 2, facility: 'barracks' },
  { kind: 'engineer', name: 'Combat Engineer', short: 'ENG', supplies: 90, fuel: 0, seconds: 16, manpower: 2, facility: 'barracks' },
  { kind: 'javelin', name: 'Javelin Team', short: 'JAV', supplies: 130, fuel: 20, seconds: 22, manpower: 3, facility: 'barracks' },
  { kind: 'humvee', name: 'Humvee CROWS', short: 'HMV', supplies: 160, fuel: 50, seconds: 30, manpower: 3, facility: 'motorpool' },
  { kind: 'abrams', name: 'M1 Abrams', short: 'ABR', supplies: 420, fuel: 130, seconds: 60, manpower: 8, facility: 'motorpool' },
];

export const TRAIN_META: Record<string, TrainMeta> = Object.fromEntries(
  TRAINABLE.map((t) => [t.kind, t]),
);

/** Base manpower plus per-facility-level bonuses. */
export function manpowerCap(barracksLevels: number, motorpoolLevels: number): number {
  return 6 + 5 * barracksLevels + 6 * motorpoolLevels;
}
