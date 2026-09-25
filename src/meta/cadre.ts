import {
  dealOfficer,
  gradeFor,
  officerEdge,
  OFFICER_XP_CAP,
  type FallenOfficer,
  type Officer,
} from '../content/officers';
import { FACTION_IDS } from '../content/factions';
import {
  lessonOf,
  newSquadRecords,
  normalizeOfficer,
  rankMult,
  RANK_BY_ID,
  SQUAD_SLOTS,
  type SquadRecord,
} from '../content/veterancy';
import type { Doctrine } from '../sim/types';
import { warLog, type TownState } from './town';

/**
 * The cadre (M28 Phase 1): the squads' officers, promoted, fought and fallen.
 *
 * A squad earns an officer the first time it reaches LINE, and loses them when
 * it is wiped out. In between the officer banks every raid they come back from,
 * whatever the squad lost on it, and the squad fights at its rank times the
 * officer's edge on the doctrine it is sent in on. The edge is stamped on the
 * wave at launch through `squadVet`, as the rank always was, so a replay
 * re-fights the raid with the officer who went out on it.
 */

export interface CadreState {
  /** Officers this war has promoted: what the next deal is dealt from. */
  promoted: number;
  /** The fallen, newest first. */
  fallen: FallenOfficer[];
}

/** How many of the fallen the service record keeps by name. */
export const FALLEN_CAP = 24;

export function cadreOf(town: TownState): CadreState {
  if (!town.cadre) town.cadre = { promoted: 0, fallen: [] };
  return town.cadre;
}

/**
 * The town's three standing formations, created on demand. Every caller wants
 * SQUAD_SLOTS records back, so a file that predates veterancy gets them here
 * rather than making each reader check.
 */
export function squadRoster(town: TownState): SquadRecord[] {
  if (!Array.isArray(town.squads) || town.squads.length !== SQUAD_SLOTS) {
    town.squads = newSquadRecords();
  }
  return town.squads;
}

/** Who commands a squad, if anybody does. */
export const officerOf = (town: TownState, slot: number): Officer | undefined => squadRoster(town)[slot]?.officer;

/**
 * The multiplier a formation's units fight at when sent in on `doctrine`: its
 * rank, times its officer's edge on that doctrine. Kept to the thousandth, the
 * precision a replay code holds, so a battle and its code are the same battle.
 */
export function squadVet(town: TownState, slot: number, doctrine: Doctrine): number {
  const record = squadRoster(town)[slot];
  return Math.round(rankMult(record?.xp ?? 0) * officerEdge(record?.officer, doctrine) * 1000) / 1000;
}

/**
 * What each squad would fight at on each doctrine, as the squads stand now:
 * kept for a raid at its launch, so a what-if about it (M29) can give a
 * changed doctrine the edge its officer had then, whoever has fallen since.
 */
export function edgeAtLaunch(town: TownState): (slot: number, doctrine: Doctrine) => number {
  const held = squadRoster(town).map((r) => ({ xp: r.xp, officer: r.officer ? { ...r.officer } : undefined }));
  return (slot, doctrine) => {
    const record = held[slot];
    return Math.round(rankMult(record?.xp ?? 0) * officerEdge(record?.officer, doctrine) * 1000) / 1000;
  };
}

/** What a raid did to the cadre, for its result to say. */
export interface CadreNews {
  /** Officers who took command, by the squad they took. */
  promoted: { slot: number; officer: Officer }[];
  /** Officers who went up a grade. */
  graded: { slot: number; officer: Officer }[];
  /** Officers who fell with their squads. */
  fell: FallenOfficer[];
}

export const noNews = (): CadreNews => ({ promoted: [], graded: [], fell: [] });

/** The deal's seed: when the war began, whose it is, and how many it has promoted. */
function dealSeed(town: TownState, promoted: number): number {
  const began = Math.floor(warLog(town).startedAt / 1000) >>> 0;
  return (began ^ Math.imul(promoted + 1, 0x9e3779b1) ^ Math.imul(FACTION_IDS.indexOf(town.faction) + 1, 0x85ebca6b)) >>> 0;
}

/**
 * Put an officer over every squad at LINE or better that has none: after a
 * raid, and when a war saved before officers is loaded. Returns who was
 * promoted.
 */
export function promoteDue(town: TownState, now: number): { slot: number; officer: Officer }[] {
  const roster = squadRoster(town);
  const promoted: { slot: number; officer: Officer }[] = [];
  roster.forEach((record, slot) => {
    if (record.officer || record.xp < RANK_BY_ID.line.at) return;
    // The cadre is made by its first promotion, not by being asked about.
    const cadre = cadreOf(town);
    // Nobody alive, and nobody the record still remembers falling.
    const taken = [...roster.flatMap((r) => (r.officer ? [r.officer.name] : [])), ...cadre.fallen.map((f) => f.name)];
    const { name, doctrine } = dealOfficer(town.faction, dealSeed(town, cadre.promoted), taken);
    const officer: Officer = { name, doctrine, xp: 0, raids: 0, clears: 0, since: now };
    roster[slot] = { ...record, officer };
    cadre.promoted++;
    promoted.push({ slot, officer });
  });
  return promoted;
}

/**
 * Fold a raid into the officers of the squads that fought it, before their
 * men's records: a squad that came back without a man loses its officer to
 * the fallen, and one that brought anybody home banks the raid's whole lesson
 * for its officer, who is one of those who came back.
 */
export function officersAfterRaid(
  town: TownState,
  squads: readonly { slot: number; deployed: number; returned: number }[],
  tier: number,
  met: boolean,
  where: string,
  now: number,
): Pick<CadreNews, 'graded' | 'fell'> {
  const roster = squadRoster(town);
  const news: Pick<CadreNews, 'graded' | 'fell'> = { graded: [], fell: [] };
  for (const ret of squads) {
    const record = roster[ret.slot];
    const officer = record?.officer;
    if (!record || !officer || ret.deployed <= 0) continue;
    if (ret.returned === 0) {
      const fallen: FallenOfficer = {
        name: officer.name,
        doctrine: officer.doctrine,
        xp: officer.xp,
        slot: ret.slot,
        raids: officer.raids + 1,
        clears: officer.clears + (met ? 1 : 0),
        since: officer.since,
        fell: now,
        where,
      };
      const cadre = cadreOf(town);
      cadre.fallen.unshift(fallen);
      cadre.fallen.length = Math.min(cadre.fallen.length, FALLEN_CAP);
      roster[ret.slot] = { xp: record.xp, raids: record.raids, clears: record.clears, lost: record.lost };
      news.fell.push(fallen);
      continue;
    }
    const before = gradeFor(officer.xp).id;
    const next: Officer = {
      ...officer,
      xp: Math.min(OFFICER_XP_CAP, Math.round(officer.xp + lessonOf(tier, met))),
      raids: officer.raids + 1,
      clears: officer.clears + (met ? 1 : 0),
    };
    roster[ret.slot] = { ...record, officer: next };
    if (gradeFor(next.xp).id !== before) news.graded.push({ slot: ret.slot, officer: next });
  }
  return news;
}

const isFallen = (raw: unknown): FallenOfficer | null => {
  const officer = normalizeOfficer(raw);
  if (!officer) return null;
  const f = raw as Partial<FallenOfficer>;
  const whole = (v: unknown, cap: number): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= cap ? v : null;
  const slot = whole(f.slot, SQUAD_SLOTS - 1);
  const fell = whole(f.fell, Number.MAX_SAFE_INTEGER);
  if (slot === null || fell === null || typeof f.where !== 'string') return null;
  return { ...officer, slot, fell, where: f.where.slice(0, 40) };
};

/** The cadre read back off disk. Absent stays absent: a war that has promoted nobody has none. */
export function normalizeCadre(raw: unknown): CadreState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const c = raw as Partial<CadreState>;
  const promoted =
    typeof c.promoted === 'number' && Number.isInteger(c.promoted) && c.promoted >= 0 ? c.promoted : 0;
  const fallen = Array.isArray(c.fallen)
    ? c.fallen.map(isFallen).filter((f): f is FallenOfficer => f !== null).slice(0, FALLEN_CAP)
    : [];
  return { promoted, fallen };
}
