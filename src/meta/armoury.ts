import { trainMetaFor } from '../content/factions';
import {
  FIT_HOURS,
  fitCost,
  pairFor,
  ROLE_OF,
  specialisationById,
  unitModsFor,
} from '../content/specialisations';
import type { TrainMeta } from '../content/usaUnits';
import type { UnitMods } from '../sim/types';
import type { FittedSpec, TownState } from './town';

/**
 * The armoury (M28 Phase 4): a war's unit specialisations.
 *
 * Each kind of unit a war trains may be given one specialisation of its pair,
 * for good. It is paid for in supplies and fuel and fitted at the facility
 * that trains the unit, one fitting at a time at each kind of facility, and
 * once its time is up it serves every unit of the kind, trained or to come,
 * in every battle research reaches: raids, duels, ghosts and their replays.
 */

const HOUR = 3600 * 1000;

export type FitError =
  /** Not this army's unit, or not one of its pair. */
  | 'unknown'
  /** This kind has already chosen. */
  | 'chosen'
  /** No working facility of the kind that trains it. */
  | 'facility'
  /** That kind of facility is already fitting something. */
  | 'busy'
  /** Not enough supplies or fuel. */
  | 'cost'
  | null;

const working = (town: TownState, facility: TrainMeta['facility']): boolean =>
  town.structures.some(
    (s) => s.kind === facility && !s.wrecked && (s.buildEndsAt === undefined || s.upgradingTo !== undefined),
  );

/** What the kind of facility `facility` is fitting at `now`, if anything. */
export function fitting(
  town: TownState,
  facility: TrainMeta['facility'],
  now: number,
): { kind: string; id: string; readyAt: number } | null {
  const metas = trainMetaFor(town.faction);
  for (const [kind, spec] of Object.entries(town.specs ?? {})) {
    if (spec.readyAt > now && metas[kind]?.facility === facility) return { kind, id: spec.id, readyAt: spec.readyAt };
  }
  return null;
}

/** Why `kind` cannot be given specialisation `id` at `now`, or null if it can. */
export function fitError(town: TownState, kind: string, id: string, now: number): FitError {
  const meta = trainMetaFor(town.faction)[kind];
  const pair = pairFor(kind);
  if (!meta || !pair || !pair.some((s) => s.id === id)) return 'unknown';
  if (town.specs?.[kind]) return 'chosen';
  if (!working(town, meta.facility)) return 'facility';
  if (fitting(town, meta.facility, now)) return 'busy';
  const cost = fitCost(meta);
  if (town.supplies < cost.supplies || town.fuel < cost.fuel) return 'cost';
  return null;
}

/** Choose `id` for `kind` and start fitting it. False, and nothing spent, if it cannot be. */
export function beginFit(town: TownState, kind: string, id: string, now: number): boolean {
  if (fitError(town, kind, id, now) !== null) return false;
  const meta = trainMetaFor(town.faction)[kind]!;
  const cost = fitCost(meta);
  town.supplies -= cost.supplies;
  town.fuel -= cost.fuel;
  town.specs = { ...(town.specs ?? {}), [kind]: { id, readyAt: now + FIT_HOURS[meta.facility] * HOUR } };
  return true;
}

/** When `kind`'s fitting is (or was) done, if it has chosen. */
export function fitReadyAt(town: TownState, kind: string): number | undefined {
  return town.specs?.[kind]?.readyAt;
}

/** Every specialisation fitted by `now`, by unit kind. */
export function fittedSpecs(town: TownState, now: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [kind, spec] of Object.entries(town.specs ?? {})) if (spec.readyAt <= now) out[kind] = spec.id;
  return out;
}

/** What a battle fought at `now` is told about this army's specialisations. */
export function unitModsOf(town: TownState, now: number): Record<string, UnitMods> | undefined {
  return unitModsFor(fittedSpecs(town, now));
}

/**
 * A save's specialisations, keeping only what was ever on offer: a known id,
 * of the pair of the kind it is filed under, with a real time. Undefined when
 * none survive, as on every war saved before them.
 */
export function normalizeSpecs(raw: unknown): Record<string, FittedSpec> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, FittedSpec> = {};
  for (const [kind, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const { id, readyAt } = value as { id?: unknown; readyAt?: unknown };
    if (typeof id !== 'string' || typeof readyAt !== 'number' || !Number.isFinite(readyAt)) continue;
    const spec = specialisationById(id);
    if (!spec || ROLE_OF[kind] !== spec.role) continue;
    out[kind] = { id, readyAt };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
