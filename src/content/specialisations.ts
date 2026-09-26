import type { UnitMods } from '../sim/types';
import type { TrainMeta } from './usaUnits';

/**
 * Unit upgrade paths (M28 Phase 4): a choice of two specialisations for every
 * unit a commander trains.
 *
 * Every trainable unit of every army fills a role, and every role has two
 * specialisations. A war picks one of the pair for each kind of unit, for
 * good, and pays for it in supplies, fuel and a fitting at the facility that
 * trains the unit. A fitted specialisation serves every unit of its kind, the
 * ones already trained and the ones to come.
 *
 * The pairs trade one kind of better for another: armour or firepower for
 * most, armour or speed for the swarm, damage to walls or speed for the
 * breacher, damage or range for an anti-armour team, healing or armour for a
 * medic. The battle is told the numbers, not the names (see `UnitMods`), so a
 * replay re-fights what was fitted, whatever this table says later.
 */

export type Role = 'line' | 'swarm' | 'breacher' | 'ranged' | 'lightVehicle' | 'heavy' | 'gunship' | 'medic';

export const ROLES: readonly Role[] = [
  'line',
  'swarm',
  'breacher',
  'ranged',
  'lightVehicle',
  'heavy',
  'gunship',
  'medic',
];

/** What each army's trainable units are for. */
export const ROLE_OF: Readonly<Record<string, Role>> = {
  // USA
  ranger: 'line',
  engineer: 'breacher',
  javelin: 'ranged',
  humvee: 'lightVehicle',
  abrams: 'heavy',
  reaper: 'gunship',
  // China
  militia: 'swarm',
  rifle: 'line',
  sapper: 'breacher',
  grenadier: 'ranged',
  zbd: 'lightVehicle',
  type99: 'heavy',
  wz10: 'gunship',
  // Russia
  conscript: 'swarm',
  motorrifle: 'line',
  demoteam: 'breacher',
  rpg: 'ranged',
  btr: 'lightVehicle',
  t72: 'heavy',
  ka52: 'gunship',
  // KPA
  nkrifle: 'line',
  infiltrator: 'swarm',
  tunneler: 'breacher',
  rpg7: 'ranged',
  chonma: 'heavy',
  an2: 'gunship',
  // UN
  peacekeeper: 'line',
  unmedic: 'medic',
  unsapper: 'breacher',
  nlaw: 'ranged',
  vab: 'lightVehicle',
  leo1: 'heavy',
  nh90: 'gunship',
};

export interface Specialisation {
  id: string;
  role: Role;
  name: string;
  /** What it does, in the planner's words. */
  detail: string;
  /** What the battle is told. */
  mods: UnitMods;
}

/** Armour: more health, a little slower. */
const armour = (id: string, role: Role, name: string, hp: number): Specialisation => ({
  id,
  role,
  name,
  detail: `+${Math.round((hp - 1) * 100)}% health, 10% slower`,
  mods: { hp, speed: 0.9 },
});

/** Firepower: more damage from everything it hits with. */
const firepower = (id: string, role: Role, name: string, damage: number): Specialisation => ({
  id,
  role,
  name,
  detail: `+${Math.round((damage - 1) * 100)}% damage`,
  mods: { damage },
});

/** Legs: faster. */
const speed = (id: string, role: Role, name: string, by: number): Specialisation => ({
  id,
  role,
  name,
  detail: `${Math.round((by - 1) * 100)}% faster`,
  mods: { speed: by },
});

/**
 * The pairs, as measured (`npm run balance -- --specs`). Guessed first at
 * +25-30%, the whole set was worth up to one and a half times the STRIKE
 * branch's first two tiers, and armour, range and the pylons won most of
 * their pairs outright. At these numbers each army's whole set, on the
 * better side of every pair, is worth 0.74 to 1.06 times those two tiers,
 * and neither side of any role's pair wins on every plan that fields it.
 * Infantry armour is the smaller number because it measured worth far more
 * than infantry firepower. A gunship's armour costs it no speed: with the
 * slowdown too, it bought half of what the pylons did.
 */
export const SPECIALISATIONS: Readonly<Record<Role, readonly [Specialisation, Specialisation]>> = {
  line: [armour('line-armour', 'line', 'BODY ARMOUR', 1.15), firepower('line-assault', 'line', 'ASSAULT KIT', 1.35)],
  swarm: [armour('swarm-vests', 'swarm', 'FLAK VESTS', 1.2), speed('swarm-runners', 'swarm', 'RUNNERS', 1.15)],
  breacher: [
    {
      id: 'breacher-charges',
      role: 'breacher',
      name: 'SHAPED CHARGES',
      detail: '+25% damage to walls',
      mods: { wall: 1.25 },
    },
    speed('breacher-light', 'breacher', 'LIGHT KIT', 1.15),
  ],
  ranged: [
    firepower('ranged-tandem', 'ranged', 'TANDEM WARHEADS', 1.2),
    { id: 'ranged-sights', role: 'ranged', name: 'LONG SIGHTS', detail: '+10% range', mods: { range: 1.1 } },
  ],
  lightVehicle: [
    armour('light-slat', 'lightVehicle', 'SLAT ARMOUR', 1.2),
    firepower('light-upgun', 'lightVehicle', 'UP-GUNNED', 1.2),
  ],
  heavy: [armour('heavy-reactive', 'heavy', 'REACTIVE ARMOUR', 1.2), firepower('heavy-autoloader', 'heavy', 'AUTOLOADER', 1.2)],
  gunship: [
    { id: 'gunship-belly', role: 'gunship', name: 'ARMOURED BELLY', detail: '+25% health', mods: { hp: 1.25 } },
    firepower('gunship-pylons', 'gunship', 'EXTRA PYLONS', 1.15),
  ],
  medic: [
    { id: 'medic-surgery', role: 'medic', name: 'FIELD SURGERY', detail: '+30% healing', mods: { heal: 1.3 } },
    armour('medic-plates', 'medic', 'PLATE CARRIERS', 1.2),
  ],
};

const BY_ID: Readonly<Record<string, Specialisation>> = Object.fromEntries(
  ROLES.flatMap((role) => SPECIALISATIONS[role].map((s) => [s.id, s] as const)),
);

export function specialisationById(id: string): Specialisation | undefined {
  return BY_ID[id];
}

/** The two specialisations a kind of unit chooses between, if it has a role. */
export function pairFor(kind: string): readonly [Specialisation, Specialisation] | undefined {
  const role = ROLE_OF[kind];
  return role ? SPECIALISATIONS[role] : undefined;
}

/** Hours a specialisation takes to fit, by the facility that trains the unit. */
export const FIT_HOURS: Readonly<Record<TrainMeta['facility'], number>> = {
  barracks: 2,
  motorpool: 3,
  airfield: 4,
};

/**
 * What fitting a specialisation costs: ten times the unit's training price,
 * to the nearest fifty. Every army's full set comes to about one late tier of
 * research, which is the surplus a war has from its first days on.
 */
export function fitCost(meta: Pick<TrainMeta, 'supplies' | 'fuel'>): { supplies: number; fuel: number } {
  const round = (n: number): number => Math.round((n * 10) / 50) * 50;
  return { supplies: round(meta.supplies), fuel: round(meta.fuel) };
}

/**
 * What the battle is told about an army's fitted specialisations: each kind's
 * multipliers. A kind with no role, an id this table does not know, or an id
 * of another role's pair is left out, so an old or edited save cannot put
 * anything in a battle that was never on offer. Undefined when nothing is left.
 */
export function unitModsFor(fitted: Readonly<Record<string, string>>): Record<string, UnitMods> | undefined {
  const out: Record<string, UnitMods> = {};
  for (const [kind, id] of Object.entries(fitted)) {
    const spec = BY_ID[id];
    if (!spec || ROLE_OF[kind] !== spec.role) continue;
    out[kind] = spec.mods;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
