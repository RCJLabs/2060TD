import type { ChainModel } from './killchain';
import type {
  AttackerProfile,
  Catalog,
  PowerDef,
  StructureProfile,
  Weapon,
} from './types';

/**
 * How big a cell is (M34).
 *
 * The catalog is written in PHYSICAL units — the ones every range, speed and
 * radius in the game has always been measured in, which until M34 were also
 * cells. `SimConfig.cellSize` says how many of those units one cell of THIS
 * board is, and the engine divides the catalog by it once, at construction.
 *
 * So a 10x15 board at `cellSize: 2` is the same ground as a 20x30 one, drawn
 * with cells twice the size: a gun that reached 9 reaches 4.5 cells, a squad
 * that walked 2.2 cells a second walks 1.1, and it crosses the board in exactly
 * the same number of seconds. That is the whole design of M34 — a similarity
 * transform, not a redesign — and the one thing it cannot carry across is a
 * thing that was already one cell, because there is no half a cell to shrink
 * it to.
 *
 * Absent means 1, and at 1 this returns the catalog it was given: not a copy
 * that happens to be equal, the same object. A battle recorded before M34
 * re-fights on exactly the numbers it was fought on, and that is structural
 * rather than a coincidence of arithmetic.
 */
export const CELL_SIZE_DEFAULT = 1;

/**
 * Every field in a catalog that is a DISTANCE, by where it lives.
 *
 * Kept as data rather than left implicit in the code below, because a
 * classification test walks the whole catalog and fails on any numeric field
 * that is in neither this list nor the list of things that are not distances.
 * A radius added to a profile next year without being listed here would be a
 * gun that reaches twice as far on the small board, and nothing else would
 * notice.
 */
export const DISTANCE_FIELDS = {
  weapon: ['range', 'minRange', 'splashRadius'],
  attacker: ['speed'],
  heal: ['radius'],
  trigger: ['radius', 'splashRadius'],
  aura: ['radius'],
  strafe: ['halfLength', 'halfWidth'],
  barrage: ['splashRadius', 'scatter'],
  chain: ['coverRadius'],
} as const;

/** A cell size the engine will honour: finite and positive, else 1. */
export function cellSizeOf(raw: number | undefined): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : CELL_SIZE_DEFAULT;
}

/**
 * A footprint on a board of this cell size. A 2x2 on the half-size board is
 * exactly one cell; a 1x1 cannot go below one.
 */
export function scaleFootprint(footprint: 1 | 2, cellSize: number): 1 | 2 {
  return Math.max(1, Math.min(2, Math.round(footprint / cellSize))) as 1 | 2;
}

function scaleWeapon(weapon: Weapon, s: number): Weapon {
  return {
    ...weapon,
    range: weapon.range / s,
    ...(weapon.minRange !== undefined ? { minRange: weapon.minRange / s } : {}),
    ...(weapon.splashRadius !== undefined ? { splashRadius: weapon.splashRadius / s } : {}),
  };
}

function scaleTrigger(
  trigger: NonNullable<StructureProfile['trigger']>,
  s: number,
): NonNullable<StructureProfile['trigger']> {
  return { ...trigger, radius: trigger.radius / s, splashRadius: trigger.splashRadius / s };
}

function scaleAura(
  aura: NonNullable<StructureProfile['aura']>,
  s: number,
): NonNullable<StructureProfile['aura']> {
  return { ...aura, radius: aura.radius / s };
}

function scaleAttacker(profile: AttackerProfile, s: number): AttackerProfile {
  return {
    ...profile,
    speed: profile.speed / s,
    ...(profile.weapon ? { weapon: scaleWeapon(profile.weapon, s) } : {}),
    ...(profile.heal ? { heal: { ...profile.heal, radius: profile.heal.radius / s } } : {}),
  };
}

function scaleStructure(profile: StructureProfile, s: number): StructureProfile {
  return {
    ...profile,
    footprint: scaleFootprint(profile.footprint, s),
    ...(profile.weapon ? { weapon: scaleWeapon(profile.weapon, s) } : {}),
    ...(profile.trigger ? { trigger: scaleTrigger(profile.trigger, s) } : {}),
    ...(profile.aura ? { aura: scaleAura(profile.aura, s) } : {}),
    // Level overrides merge SHALLOWLY onto the base (`resolveProfile`), so a
    // level's weapon replaces the base weapon outright. Scale them in their own
    // right, or an upgraded gun keeps the reach it had on the big board.
    ...(profile.levels
      ? {
          levels: profile.levels.map((level) => ({
            ...level,
            ...(level.weapon ? { weapon: scaleWeapon(level.weapon, s) } : {}),
            ...(level.trigger ? { trigger: scaleTrigger(level.trigger, s) } : {}),
            ...(level.aura ? { aura: scaleAura(level.aura, s) } : {}),
          })),
        }
      : {}),
  };
}

function scalePower(power: PowerDef, s: number): PowerDef {
  return power.type === 'strafe'
    ? { ...power, halfLength: power.halfLength / s, halfWidth: power.halfWidth / s }
    : { ...power, splashRadius: power.splashRadius / s, scatter: power.scatter / s };
}

const mapValues = <T>(record: Record<string, T>, fn: (value: T) => T): Record<string, T> =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fn(value)]));

/** The catalog, in cells of this size. At 1, the catalog itself. */
export function scaleCatalog(catalog: Catalog, cellSize: number): Catalog {
  const s = cellSizeOf(cellSize);
  if (s === CELL_SIZE_DEFAULT) return catalog;
  return {
    ...catalog,
    attackers: mapValues(catalog.attackers, (a) => scaleAttacker(a, s)),
    structures: mapValues(catalog.structures, (st) => scaleStructure(st, s)),
    powers: mapValues(catalog.powers, (p) => scalePower(p, s)),
  };
}

/** The kill chain, in cells of this size. At 1, the model itself. */
export function scaleChain(model: ChainModel, cellSize: number): ChainModel {
  const s = cellSizeOf(cellSize);
  if (s === CELL_SIZE_DEFAULT) return model;
  return { ...model, coverRadius: model.coverRadius / s };
}
