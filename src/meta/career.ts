import { campaignFor, FACTION_IDS, flavorFor, type FactionId } from '../content/factions';
import type { Officer } from '../content/officers';
import { normalizeOfficer } from '../content/veterancy';
import {
  campaignMerit,
  HEAD_START_BY_ID,
  HEAD_START_IDS,
  MERIT_FIRST_WIN,
  MERIT_HARD,
  MERIT_WAR_WON,
  OPENING_UNLOCKS,
  QUARTERMASTER_BONUS,
  QUARTERMASTER_HOURS,
  rungMerit,
  STAFF_FACTOR,
  WAR_CHEST,
  type HeadStartId,
  type HeadStartLevel,
} from '../content/prestige';
import { squadRoster } from './cadre';
import { warLog, type HeadStartState, type TownState } from './town';

/**
 * The commander's career (M28 Phase 3): what outlives a war.
 *
 * A war is retired, never finished, and retiring it banks MERIT for what it
 * achieved. The merit is the commander's: one pool on the device, beside the
 * settings and outside every war slot, so a war retired as one army pays for
 * the head start of the next war of any army. The career also keeps the wars
 * retired (the honour roll), the officers waiting for their army's next war,
 * and the armies that have won one.
 */

/** Old-name prefix on purpose, like the save and the settings: a key is an address. */
export const CAREER_KEY = 'lastline_career_v1';

/** How many retired wars the honour roll keeps, newest first. */
export const HONOUR_CAP = 50;

export interface RetiredWar {
  /** The war's identity, its army and when it began: a war can only pay once. */
  id: string;
  faction: FactionId;
  hard: boolean;
  /** When it began and when it was retired (epoch ms). */
  began: number;
  ended: number;
  /** The furthest rung its front reached. */
  rung: number;
  /** Campaign missions completed. */
  missions: number;
  /** The day of the war it was won on, or null. */
  wonDay: number | null;
  /** Merit it has paid, in all. */
  merit: number;
  /** Whether it paid its army's first war won. */
  first: boolean;
}

export interface Career {
  /** Merit in hand. */
  merit: number;
  /** Merit ever banked. */
  earned: number;
  /** Levels bought of each head start, 0 to 3. */
  bought: Record<HeadStartId, number>;
  /** The honour roll, newest first. */
  wars: RetiredWar[];
  /** One officer an army, waiting to command the first squad of its next war. */
  reserve: Partial<Record<FactionId, Officer>>;
  /** The armies that have won a war. */
  winners: FactionId[];
}

const noLevels = (): Record<HeadStartId, number> =>
  Object.fromEntries(HEAD_START_IDS.map((id) => [id, 0])) as Record<HeadStartId, number>;

export const newCareer = (): Career => ({ merit: 0, earned: 0, bought: noLevels(), wars: [], reserve: {}, winners: [] });

const isFaction = (v: unknown): v is FactionId => typeof v === 'string' && (FACTION_IDS as readonly string[]).includes(v);

const whole = (v: unknown, cap = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(cap, Math.floor(v))) : 0;

function normalizeWar(raw: unknown): RetiredWar | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Partial<RetiredWar>;
  if (typeof w.id !== 'string' || !isFaction(w.faction)) return null;
  return {
    id: w.id.slice(0, 64),
    faction: w.faction,
    hard: w.hard === true,
    began: whole(w.began),
    ended: whole(w.ended),
    rung: Math.max(1, whole(w.rung, 999)),
    missions: whole(w.missions, 99),
    wonDay: w.wonDay === null || w.wonDay === undefined ? null : Math.max(1, whole(w.wonDay, 99999)),
    merit: whole(w.merit),
    first: w.first === true,
  };
}

/** The career read back off disk: anything unreadable is what a new commander has. */
export function normalizeCareer(raw: unknown): Career {
  const career = newCareer();
  if (!raw || typeof raw !== 'object') return career;
  const c = raw as Partial<Career>;
  career.merit = whole(c.merit);
  career.earned = Math.max(career.merit, whole(c.earned));
  for (const id of HEAD_START_IDS) {
    career.bought[id] = whole((c.bought as Record<string, unknown> | undefined)?.[id], HEAD_START_BY_ID[id].levels.length);
  }
  career.wars = Array.isArray(c.wars)
    ? c.wars.map(normalizeWar).filter((w): w is RetiredWar => w !== null).slice(0, HONOUR_CAP)
    : [];
  if (c.reserve && typeof c.reserve === 'object') {
    for (const faction of FACTION_IDS) {
      const officer = normalizeOfficer((c.reserve as Record<string, unknown>)[faction]);
      if (officer) career.reserve[faction] = officer;
    }
  }
  career.winners = Array.isArray(c.winners) ? FACTION_IDS.filter((f) => c.winners!.includes(f)) : [];
  return career;
}

export function loadCareer(): Career {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    return normalizeCareer(raw ? JSON.parse(raw) : undefined);
  } catch {
    return newCareer();
  }
}

export function saveCareer(career: Career): void {
  try {
    localStorage.setItem(CAREER_KEY, JSON.stringify(career));
  } catch {
    // storage unavailable: the career lives for the session only
  }
}

// ---- what a war is worth ---------------------------------------------------------

/** A war's identity: its army and when it began. */
export const warIdOf = (town: TownState): string => `${town.faction}:${Math.floor(warLog(town).startedAt)}`;

/** The furthest rung the war's front has reached, where it stands or where it was pushed back from. */
export const furthestRung = (town: TownState): number => Math.max(1, town.frontline.tier, town.frontline.deepest ?? 0);

/** The war is a war: it chose its commitment. A file before that is a husk. */
export const isWar = (town: TownState): boolean => town.campaign.difficulty !== null;

const DAY_MS = 86_400_000;
const dayOf = (town: TownState, at: number): number => Math.max(1, Math.floor((at - warLog(town).startedAt) / DAY_MS) + 1);

export const ordinal = (n: number): string => {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
};

export interface MeritLine {
  label: string;
  merit: number;
}

export interface MeritBreakdown {
  lines: MeritLine[];
  total: number;
  /** It pays its army's first war won. */
  first: boolean;
}

/** What the war would bank if it retired now, line by line. */
export function meritOf(town: TownState, career: Career): MeritBreakdown {
  const fl = town.frontline;
  const prior = career.wars.find((w) => w.id === warIdOf(town));
  const won = fl.wonAt !== undefined;
  // The first win is this war's if it paid it already, or if its army has
  // never won and it has.
  const first = (prior?.first ?? false) || (won && !career.winners.includes(town.faction));
  const rung = furthestRung(town);
  const length = campaignFor(town.faction).length;
  const missions = new Set(town.campaign.completed).size;
  const lines: MeritLine[] = [
    { label: `THE FRONT: the ${ordinal(rung)} rung`, merit: rungMerit(rung) },
    { label: `THE CAMPAIGN: ${Math.min(missions, length)} of ${length} missions`, merit: campaignMerit(missions, length) },
  ];
  if (won) lines.push({ label: `THE WAR WON on day ${dayOf(town, fl.wonAt!)}`, merit: MERIT_WAR_WON });
  if (first) lines.push({ label: `THE FIRST WAR WON AS ${flavorFor(town.faction).short}`, merit: MERIT_FIRST_WIN });
  const subtotal = lines.reduce((n, l) => n + l.merit, 0);
  if (town.campaign.difficulty === 'hard') {
    lines.push({ label: 'HARD: a quarter more', merit: Math.round(subtotal * MERIT_HARD) - subtotal });
  }
  return { lines, total: lines.reduce((n, l) => n + l.merit, 0), first };
}

/** The living officer with the most experience, the first squad's on a tie. */
export function bestOfficer(town: TownState): Officer | undefined {
  let best: Officer | undefined;
  for (const record of squadRoster(town)) {
    if (record.officer && (!best || record.officer.xp > best.xp)) best = record.officer;
  }
  return best;
}

export interface Retirement {
  breakdown: MeritBreakdown;
  /** Merit banked now: all of it, or what the war has earned since it was last retired. */
  paid: number;
  /** Merit the war had paid before, when it had been retired already. */
  before: number;
  /** The officer sent to the reserve. */
  officer?: Officer;
  /** The officer who stayed in the reserve instead, with more experience. */
  kept?: Officer;
  war: RetiredWar;
}

/**
 * Retire the war: bank its merit and send its best living officer to the
 * reserve. The caller clears the slot. A war that has been retired before (a
 * save exported and imported again) pays only what it has earned since, and
 * sends nobody. Null for a file that never became a war.
 */
export function retire(career: Career, town: TownState, now: number): Retirement | null {
  if (!isWar(town)) return null;
  const id = warIdOf(town);
  const prior = career.wars.find((w) => w.id === id);
  const breakdown = meritOf(town, career);
  const before = prior?.merit ?? 0;
  const paid = Math.max(0, breakdown.total - before);
  career.merit += paid;
  career.earned += paid;
  const fl = town.frontline;
  if (fl.wonAt !== undefined && !career.winners.includes(town.faction)) career.winners.push(town.faction);
  const retirement: Retirement = {
    breakdown,
    paid,
    before,
    war: {
      id,
      faction: town.faction,
      hard: town.campaign.difficulty === 'hard',
      began: Math.floor(warLog(town).startedAt),
      ended: now,
      rung: furthestRung(town),
      missions: new Set(town.campaign.completed).size,
      wonDay: fl.wonAt === undefined ? null : dayOf(town, fl.wonAt),
      merit: Math.max(before, breakdown.total),
      first: breakdown.first,
    },
  };
  if (!prior) {
    const officer = bestOfficer(town);
    const waiting = career.reserve[town.faction];
    if (officer && (!waiting || officer.xp > waiting.xp)) {
      career.reserve[town.faction] = { ...officer };
      retirement.officer = { ...officer };
    } else if (officer && waiting) {
      retirement.kept = { ...waiting };
    }
  }
  career.wars = [retirement.war, ...career.wars.filter((w) => w.id !== id)].slice(0, HONOUR_CAP);
  return retirement;
}

// ---- the War College ---------------------------------------------------------------

/** The next level of a head start, or null when all three are bought. */
export function nextLevel(career: Career, id: HeadStartId): HeadStartLevel | null {
  return HEAD_START_BY_ID[id].levels[career.bought[id]] ?? null;
}

export type BuyError = 'max' | 'merit' | null;

export function buyError(career: Career, id: HeadStartId): BuyError {
  const next = nextLevel(career, id);
  if (!next) return 'max';
  return career.merit < next.price ? 'merit' : null;
}

export function buy(career: Career, id: HeadStartId): boolean {
  if (buyError(career, id) !== null) return false;
  career.merit -= nextLevel(career, id)!.price;
  career.bought[id]++;
  return true;
}

// ---- a war's head start -------------------------------------------------------------

/**
 * A war's head start read back off disk. Absent stays absent. One that is
 * there but unreadable was still given, so it is kept, with nothing in it
 * that lasts.
 */
export function normalizeHeadStart(raw: unknown, fallbackAt: number): HeadStartState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const h = raw as Partial<HeadStartState>;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const state: HeadStartState = { at: finite(h.at) && h.at >= 0 ? h.at : fallbackAt };
  const qm = h.quartermasters;
  if (qm && finite(qm.bonus) && qm.bonus > 0 && qm.bonus <= 5 && finite(qm.until)) {
    state.quartermasters = { bonus: qm.bonus, until: qm.until };
  }
  if (finite(h.staff) && h.staff > 0 && h.staff <= 1) state.staff = h.staff;
  return state;
}

/** What a head start gave a war, for the town to say. */
export interface HeadStartNews {
  chest?: { supplies: number; fuel: number; intel: number };
  /** The opening's level, and the requisitions it granted that the war did not have. */
  opening?: { level: number; granted: string[] };
  quartermasters?: { bonus: number; hours: number };
  /** What research timers are multiplied by. */
  staff?: number;
  /** The officer from the reserve who took the first squad. */
  officer?: Officer;
}

/** A head start with nothing in it. */
export const isEmptyHeadStart = (news: HeadStartNews): boolean => Object.keys(news).length === 0;

/**
 * Give a war its head start, once: when it chooses its commitment, which is
 * when a file becomes a war. The stores and the requisitions are paid now;
 * the quartermasters and the staff college stay on the town, as
 * `town.headStart`, whose presence says the head start was given. The army's
 * officer in reserve takes the first squad and leaves the reserve. Null for a
 * war given its head start already.
 */
export function applyHeadStart(town: TownState, career: Career, now: number): HeadStartNews | null {
  if (town.headStart) return null;
  const news: HeadStartNews = {};
  const state: HeadStartState = { at: now };
  const level = (id: HeadStartId): number => career.bought[id];
  if (level('chest') > 0) {
    const chest = WAR_CHEST[level('chest') - 1]!;
    town.supplies += chest.supplies;
    town.fuel += chest.fuel;
    town.intel += chest.intel;
    news.chest = { ...chest };
  }
  if (level('opening') > 0) {
    const granted = OPENING_UNLOCKS[level('opening') - 1]!.filter((key) => !town.unlocked.includes(key));
    town.unlocked.push(...granted);
    news.opening = { level: level('opening'), granted };
  }
  if (level('quartermasters') > 0) {
    const bonus = QUARTERMASTER_BONUS[level('quartermasters') - 1]!;
    state.quartermasters = { bonus, until: now + QUARTERMASTER_HOURS * 3_600_000 };
    news.quartermasters = { bonus, hours: QUARTERMASTER_HOURS };
  }
  if (level('staff') > 0) {
    state.staff = STAFF_FACTOR[level('staff') - 1]!;
    news.staff = state.staff;
  }
  const officer = career.reserve[town.faction];
  if (officer) {
    const roster = squadRoster(town);
    roster[0] = { ...roster[0]!, officer: { ...officer, since: now } };
    delete career.reserve[town.faction];
    news.officer = { ...officer, since: now };
  }
  town.headStart = state;
  return news;
}
