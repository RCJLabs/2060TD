import {
  defenseCatalogFor,
  FACTION_IDS,
  raidCatalogFor,
  trainableFor,
  type FactionId,
} from '../content/factions';
import { GHOST_BREACHED, GHOST_FAILED, GHOST_HELD, GHOST_WON } from '../content/leagues';
import { SQUAD_SLOTS } from '../content/veterancy';
import type { Catalog, Doctrine, SimConfig, UnitMods, WaveDef, WaveEntry } from '../sim/types';
import { unitModsOf } from './armoury';
import {
  canonicalUnitMods,
  checksum,
  fromBase64Url,
  getMilli,
  getString,
  getUnitMods,
  putMilli,
  putString,
  putUnitMods,
  readVarint,
  toBase64Url,
  writeVarint,
  type CodeError,
  type Cursor,
} from './codec';
import { awardStanding, dayOf } from './ladder';
import { decodeReplay, type GhostTag, type Replay } from './replaycode';
import { decodeBase, encodeBase } from './sharecode';
import { ghostBattleConfig, researchEffects, warLog, type TownState } from './town';
import { recordBattle } from './vault';
import {
  DEFENSE_LOG_CAP,
  delayOf,
  DOCTRINE_IDS,
  FLAT_PAYOUT,
  planDeployment,
  planUnitCount,
  raidWave,
  resolveRaid,
  SECTOR_IDS,
  slotOf,
  squadVet,
  TOWN_ENTRY_SECTORS,
  type RaidResolution,
  type SectorId,
  type SquadPlan,
} from './warfare';

/**
 * Ghost raids (M27 Phase 1): one commander's plan, fought on another's town.
 *
 * There is no server, so what goes between two commanders is codes. The
 * attacker plans against a base code, as a duel is planned, and sends the plan
 * as a GHOST CODE: a copy of their army, its ranks and research, the dice, who
 * it is for and who it is from. The defender's game fights it against the town
 * as it stands, through its entry edge and under its standing orders, as a
 * probe is fought, and hands back the battle as a RESULT CODE: a replay code
 * of the kind `ghost`. The attacker's game checks the battle is the one it
 * sent, fights it again, and pays by the ending it reaches itself.
 *
 * Nothing is taken from anybody. The ghost is a copy, so the attacker's men
 * stay home, and the defender's town is fought, not damaged: its stores,
 * walls and ordnance are as they were. What moves is standing, both ways, and
 * a win pays the attacker a duel's loot.
 *
 * What the codes can check is the attacker's half of the battle: the men,
 * their seconds, their rank and research, the dice. What they cannot check
 * is the defender's half, a live town nobody else can see, or a commander who
 * writes codes by hand. A day's pay is capped, each way, so neither is worth
 * much; a server that signs results is Phase 2's.
 */

// ---- the callsign ------------------------------------------------------------------

/** How long a callsign may be: every code carries it, and a log line names it. */
export const CALLSIGN_MAX = 16;

const CALLSIGN_WORDS = [
  'ANVIL', 'BADGER', 'COBALT', 'DAGGER', 'EMBER', 'FALCON', 'GRANITE', 'HARBOR',
  'IRONSIDE', 'JACKAL', 'KESTREL', 'LANCER', 'MARLIN', 'NOMAD', 'ONYX', 'PIKE',
  'QUARRY', 'RAVEN', 'SABRE', 'TALON', 'UMBER', 'VIPER', 'WARDEN', 'YUKON', 'ZEPHYR',
];

/**
 * A callsign as a code carries it: capitals, digits, single spaces and
 * hyphens, at most sixteen. Null when fewer than two are left.
 */
export function cleanCallsign(raw: string): string | null {
  const clean = raw
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CALLSIGN_MAX)
    .trim();
  return clean.length >= 2 ? clean : null;
}

/**
 * The callsign a war goes by until its commander chooses one: a word and a
 * number, from when the war began and whose it is. The same every time it is
 * asked, so the codes a war sends this week and next come from one commander.
 */
export function generatedCallsign(town: TownState): string {
  let hash = 0x811c9dc5;
  const eat = (n: number): void => {
    for (let shift = 0; shift < 32; shift += 8) {
      hash = Math.imul(hash ^ ((n >>> shift) & 0xff), 0x01000193) >>> 0;
    }
  };
  eat(Math.floor(warLog(town).startedAt / 1000) >>> 0);
  eat(FACTION_IDS.indexOf(town.faction));
  const word = CALLSIGN_WORDS[hash % CALLSIGN_WORDS.length]!;
  return `${word} ${10 + (Math.floor(hash / CALLSIGN_WORDS.length) % 90)}`;
}

/** The callsign this war goes by: the one chosen, or the one made for it. */
export function callsignOf(town: TownState): string {
  const chosen = town.callsign === undefined ? null : cleanCallsign(town.callsign);
  return chosen ?? generatedCallsign(town);
}

/** Choose a callsign. False, and nothing changed, when nothing of it is usable. */
export function setCallsign(town: TownState, raw: string): boolean {
  const clean = cleanCallsign(raw);
  if (!clean) return false;
  town.callsign = clean;
  return true;
}

// ---- the ghost ---------------------------------------------------------------------

/** The army's research, as a code carries it: to the thousandth. */
export interface GhostMods {
  hp: number;
  damage: number;
}

export interface Ghost {
  /** Who sent it, and so whose army it is. */
  from: { callsign: string; faction: FactionId };
  /** The callsign it is for: the name on the base code it was planned against. */
  to: string;
  /** Which of its sender's ghosts this is. */
  id: number;
  /** The battle's seed, and so its dice. */
  seed: number;
  /** Each squad's men, sector, doctrine, start and rank, in slot order. */
  plan: SquadPlan[];
  mods: GhostMods;
  /**
   * The army's specialisations (M28 Phase 4), by kind, as a code carries
   * them. Absent when nothing was fitted when it went out.
   */
  unitMods?: Record<string, UnitMods>;
  /** The sender's own base as a share code: what SEND ONE BACK raids. */
  base: string;
}

/** The most men a ghost may carry: more than any town can raise, and a bound on the battle. */
export const GHOST_MAX_MEN = 200;

const milli = (value: number): number => Math.round(value * 1000) / 1000;

/** The catalog a ghost is fought on: the defender's town, and the attacker's own units. */
const CATALOGS = new Map<string, Catalog>();
export function ghostCatalog(defender: FactionId, attacker: FactionId): Catalog {
  const key = `${defender}:${attacker}`;
  let catalog = CATALOGS.get(key);
  if (!catalog) {
    const home = defenseCatalogFor(defender);
    catalog = { ...home, attackers: { ...home.attackers, ...raidCatalogFor(attacker).attackers } };
    CATALOGS.set(key, catalog);
  }
  return catalog;
}

/** The wave a ghost is: the one a raid with its plan would get. */
export function ghostWave(ghost: Pick<Ghost, 'from' | 'plan'>): WaveDef {
  return raidWave(ghost.plan, trainableFor(ghost.from.faction));
}

// ---- the ghost code ------------------------------------------------------------------

/**
 * The first byte of every ghost code. Share and replay codes begin with their
 * format, 1, so a ghost pasted where either is expected is refused as a
 * version it is not, and neither is ever read as a ghost.
 */
const GHOST_MAGIC = 0x9d;
/** Bumped only when the byte layout changes; old codes are then refused. */
const GHOST_FORMAT = 1;
/**
 * A ghost whose army was fitted (M28 Phase 4): the specialisations go in
 * beside the research. Written only for a ghost that has them, so a build
 * from before them refuses one as a newer code, and every other ghost is
 * the code it always was.
 */
const GHOST_FITTED = 2;
/**
 * The widest a specialisation's multiplier may read. The table's are well
 * inside it; a ghost's army is fought on somebody else's town, so a code
 * that claims more was not written by the game.
 */
const FIT_RANGE = [0.5, 2] as const;

export function encodeGhost(ghost: Ghost): string {
  const unitMods = canonicalUnitMods(ghost.unitMods);
  const format = unitMods ? GHOST_FITTED : GHOST_FORMAT;
  const body: number[] = [GHOST_MAGIC, format, FACTION_IDS.indexOf(ghost.from.faction)];
  putString(body, ghost.from.callsign);
  putString(body, ghost.to);
  writeVarint(body, ghost.id >>> 0);
  writeVarint(body, ghost.seed >>> 0);
  putMilli(body, ghost.mods.hp);
  putMilli(body, ghost.mods.damage);
  if (unitMods) putUnitMods(body, unitMods, (kind) => putString(body, kind));
  body.push(ghost.plan.length);
  for (const squad of ghost.plan) {
    body.push(squad.slot ?? 0, SECTOR_IDS.indexOf(squad.sector), DOCTRINE_IDS.indexOf(squad.doctrine));
    body.push(squad.delay ?? 0);
    putMilli(body, squad.vet);
    const units = Object.entries(squad.units).filter(([, n]) => n > 0);
    body.push(units.length);
    for (const [kind, count] of units) {
      putString(body, kind);
      writeVarint(body, count);
    }
  }
  // The base goes in as its own bytes rather than its text: a third smaller.
  const base = fromBase64Url(ghost.base) ?? [];
  writeVarint(body, base.length);
  body.push(...base);
  const sum = checksum(body);
  body.push(sum & 0xff, (sum >> 8) & 0xff);
  return toBase64Url(body);
}

export type GhostDecode = { ok: true; ghost: Ghost } | { ok: false; error: CodeError };

/** Read a ghost code back, refusing anything that is not a ghost as one is sent. */
export function decodeGhost(raw: string): GhostDecode {
  const bad = (error: CodeError): GhostDecode => ({ ok: false, error });
  const text = raw.trim().replace(/\s+/g, '');
  if (!text) return bad('empty');
  const bytes = fromBase64Url(text);
  if (!bytes) return bad('characters');
  if (bytes.length < 12) return bad('truncated');
  const body = bytes.slice(0, -2);
  const expected = bytes[bytes.length - 2]! | (bytes[bytes.length - 1]! << 8);
  if (checksum(body) !== expected) return bad('checksum');

  const cur: Cursor = { bytes: body, at: 0 };
  if (body[cur.at++] !== GHOST_MAGIC) return bad('version');
  const format = body[cur.at++];
  if (format !== GHOST_FORMAT && format !== GHOST_FITTED) return bad('version');
  const faction = FACTION_IDS[body[cur.at++]!];
  if (!faction) return bad('content');
  const trainable = new Set(trainableFor(faction).map((t) => t.kind));
  const from = getString(cur);
  const to = getString(cur);
  const id = readVarint(cur);
  const seed = readVarint(cur);
  const hp = getMilli(cur);
  const damage = getMilli(cur);
  if (from === null || to === null || id === null || seed === null) return bad('truncated');
  if (hp === null || damage === null) return bad('truncated');
  let unitMods: Record<string, UnitMods> | undefined;
  if (format === GHOST_FITTED) {
    const read = getUnitMods(cur, () => getString(cur));
    if (typeof read === 'string') return bad(read);
    // The sender's own units, fitted as a specialisation could fit them.
    for (const [kind, m] of Object.entries(read)) {
      if (!trainable.has(kind)) return bad('content');
      if (Object.values(m).some((v) => v < FIT_RANGE[0] || v > FIT_RANGE[1])) return bad('content');
    }
    unitMods = read;
  }
  const squadCount = body[cur.at++];
  if (squadCount === undefined) return bad('truncated');
  // A callsign reads back only as one is written; anything else was not written by the game.
  if (cleanCallsign(from) !== from || cleanCallsign(to) !== to) return bad('content');
  if (squadCount < 1 || squadCount > SQUAD_SLOTS) return bad('content');

  const plan: SquadPlan[] = [];
  let men = 0;
  for (let i = 0; i < squadCount; i++) {
    const slot = body[cur.at++];
    const sector = SECTOR_IDS[body[cur.at++]!];
    const doctrine: Doctrine | undefined = DOCTRINE_IDS[body[cur.at++]!];
    const delay = body[cur.at++];
    const vet = getMilli(cur);
    const kinds = body[cur.at++];
    if (slot === undefined || delay === undefined || vet === null || kinds === undefined) {
      return bad('truncated');
    }
    if (!sector || !doctrine || !TOWN_ENTRY_SECTORS.includes(sector)) return bad('content');
    // In slot order, each slot once: the order a raid's wave is laid out in.
    if (slot >= SQUAD_SLOTS || plan.some((s) => (s.slot ?? 0) >= slot)) return bad('content');
    if (delay > 60 || vet < 0.5 || vet > 3 || kinds < 1) return bad('content');
    const units: Record<string, number> = {};
    for (let k = 0; k < kinds; k++) {
      const kind = getString(cur);
      const count = readVarint(cur);
      if (kind === null || count === null) return bad('truncated');
      if (!trainable.has(kind) || count < 1 || units[kind] !== undefined) return bad('content');
      units[kind] = count;
      men += count;
    }
    plan.push({ units, sector, doctrine, slot, delay, ...(vet !== 1 ? { vet } : {}) });
  }
  if (men > GHOST_MAX_MEN) return bad('content');

  const baseLength = readVarint(cur);
  if (baseLength === null || cur.at + baseLength > body.length) return bad('truncated');
  const base = toBase64Url(body.slice(cur.at, cur.at + baseLength));
  cur.at += baseLength;
  if (cur.at !== body.length) return bad('content');
  if (!decodeBase(base).ok) return bad('content');

  return {
    ok: true,
    ghost: {
      from: { callsign: from, faction },
      to,
      id,
      seed,
      plan,
      mods: { hp, damage },
      ...(unitMods ? { unitMods } : {}),
      base,
    },
  };
}

// ---- the ledger ----------------------------------------------------------------------

/** A ghost this war sent and has not been paid for: what its result is checked against. */
export type SentGhost = Omit<Ghost, 'base'> & { at: number };

export interface GhostLedger {
  /** Sent and not yet collected, newest first. */
  sent: SentGhost[];
  /** Ghosts this war has been paid for, by `ghostKey`, so a result pays once. */
  collected: string[];
  /** Ghosts this town has fought, by `ghostKey`, so none is fought twice. */
  taken: string[];
  /** How many of each today has paid, on the ladder's calendar. */
  paid?: { day: number; taken: number; collected: number };
}

/** Ghosts waiting on a result; the oldest is let go past this. */
export const GHOST_SENT_CAP = 10;
/** How many taken and collected ghosts are remembered. */
const GHOST_MEMORY = 50;
/**
 * How many ghost battles a day move a town's standing and pay, each way.
 * Past it they are fought and filed as before and pay nothing: without a
 * server nothing stops a commander raiding a second war of their own, or
 * writing a result by hand, and this is what either is worth.
 */
export const GHOST_PAID_PER_DAY = 3;

/** Who sent a ghost and which it was: the one name it has on both sides. */
export const ghostKey = (callsign: string, id: number): string => `${callsign}#${id >>> 0}`;

export function ghostLedger(town: TownState): GhostLedger {
  if (!town.ghosts) town.ghosts = { sent: [], collected: [], taken: [] };
  return town.ghosts;
}

/** Whether today still pays one more of `side`, counting it if so. */
function payToday(ledger: GhostLedger, side: 'taken' | 'collected', now: number): boolean {
  const day = dayOf(now);
  if (ledger.paid?.day !== day) ledger.paid = { day, taken: 0, collected: 0 };
  if (ledger.paid[side] >= GHOST_PAID_PER_DAY) return false;
  ledger.paid[side]++;
  return true;
}

/** How many more of `side` today will pay. */
export function paidLeftToday(town: TownState, side: 'taken' | 'collected', now: number): number {
  const paid = town.ghosts?.paid;
  return GHOST_PAID_PER_DAY - (paid?.day === dayOf(now) ? paid[side] : 0);
}

const remember = (list: string[], key: string): void => {
  list.unshift(key);
  list.length = Math.min(list.length, GHOST_MEMORY);
};

// ---- sending one -----------------------------------------------------------------

export type SendError = 'empty' | 'sector' | 'gallery' | 'army' | 'address' | 'self';

/**
 * Send a plan as a ghost: the squads the planner holds, against the base code
 * whose name is the callsign it is for. Nothing leaves the town but the code;
 * the men stay home and are not spent. The ghost is filed as its code reads
 * back, so the result is checked against exactly what the defender fought.
 */
export function sendGhost(
  town: TownState,
  target: { name: string },
  squads: SquadPlan[],
  now: number,
): { ok: true; code: string; ghost: Ghost } | { ok: false; error: SendError } {
  const from = callsignOf(town);
  if (cleanCallsign(target.name) !== target.name) return { ok: false, error: 'address' };
  if (target.name === from) return { ok: false, error: 'self' };
  if (squads.some((s) => s.tunnel !== undefined && planUnitCount([s]) > 0)) {
    return { ok: false, error: 'gallery' };
  }
  const plan = squads
    .map((squad, i) => ({ squad, slot: slotOf(squad, i), delay: delayOf(squad, i) }))
    .filter(({ squad }) => planUnitCount([squad]) > 0)
    .sort((a, b) => a.slot - b.slot)
    .map(
      ({ squad, slot, delay }): SquadPlan => ({
        units: Object.fromEntries(
          Object.entries(squad.units)
            .filter(([, n]) => n > 0)
            .map(([kind, n]) => [kind, Math.round(n)]),
        ),
        sector: squad.sector,
        doctrine: squad.doctrine,
        slot,
        delay: Math.max(0, Math.min(60, Math.round(delay))),
        // The rank and the officer's edge on these orders (M28), as a raid stamps them.
        vet: milli(squadVet(town, slot, squad.doctrine)),
      }),
    );
  if (plan.length === 0) return { ok: false, error: 'empty' };
  if (plan.some((s) => !TOWN_ENTRY_SECTORS.includes(s.sector))) return { ok: false, error: 'sector' };
  const trainable = new Set(trainableFor(town.faction).map((t) => t.kind));
  const deployed = planDeployment(plan);
  const short = Object.entries(deployed).some(
    ([kind, n]) => !trainable.has(kind) || n > (town.army[kind] ?? 0),
  );
  if (short || planUnitCount(plan) > GHOST_MAX_MEN) return { ok: false, error: 'army' };

  const ledger = ghostLedger(town);
  const taken = (id: number): boolean =>
    ledger.sent.some((s) => s.id === id) || ledger.collected.includes(ghostKey(from, id));
  let id = (Math.floor(now / 1000) ^ Math.imul(ledger.sent.length + 1, 0x9e3779b1)) >>> 0;
  while (taken(id)) id = (id + 1) >>> 0;
  const fx = researchEffects(town);
  // What has finished fitting by now goes; a fitting still under way does not.
  const unitMods = unitModsOf(town, now);
  const code = encodeGhost({
    from: { callsign: from, faction: town.faction },
    to: target.name,
    id,
    seed: now >>> 0,
    plan,
    mods: { hp: milli(fx.unitHp), damage: milli(fx.unitDamage) },
    ...(unitMods ? { unitMods } : {}),
    base: encodeBase(town, from),
  });
  const read = decodeGhost(code);
  if (!read.ok) throw new Error(`a ghost code did not read back: ${read.error}`);
  const g = read.ghost;
  ledger.sent.unshift({
    from: g.from,
    to: g.to,
    id: g.id,
    seed: g.seed,
    plan: g.plan,
    mods: g.mods,
    ...(g.unitMods ? { unitMods: g.unitMods } : {}),
    at: now,
  });
  ledger.sent.length = Math.min(ledger.sent.length, GHOST_SENT_CAP);
  return { ok: true, code, ghost: read.ghost };
}

/**
 * A ghost this war sent, as a code again, for a commander who lost the first
 * copy. The same ghost, with the town's base as it is now as the way back:
 * the base is what SEND ONE BACK raids, and nothing checks it.
 */
export function ghostCodeOf(town: TownState, sent: SentGhost): string {
  return encodeGhost({
    from: sent.from,
    to: sent.to,
    id: sent.id,
    seed: sent.seed,
    plan: sent.plan,
    mods: sent.mods,
    ...(sent.unitMods ? { unitMods: sent.unitMods } : {}),
    base: encodeBase(town, callsignOf(town)),
  });
}

// ---- taking one ------------------------------------------------------------------

export type TakeError = CodeError | 'own' | 'address' | 'taken';

export interface TakenGhost {
  ghost: Ghost;
  held: boolean;
  /** What it moved the town's standing by: nothing past today's paid ones. */
  standing: number;
  resolution: RaidResolution;
  /** The battle as fought. */
  config: SimConfig;
  /** The result code: the battle, filed in the vault and sent back to the attacker. */
  result: string;
}

const lostOf = (resolution: RaidResolution): number =>
  Object.values(resolution.losses).reduce((a, b) => a + b, 0);

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/**
 * Fight a ghost on this town, now, as it stands. It goes in the defence log
 * and the vault naming its sender, moves the standing, and hands back the
 * result code. Nothing in the town is spent or damaged: walls chewed and
 * ordnance fired are as they were, because the battle was another
 * commander's plan played out, not an attack that happened.
 */
export function takeGhost(
  town: TownState,
  code: string,
  now: number,
): { ok: true; taken: TakenGhost } | { ok: false; error: TakeError } {
  const read = decodeGhost(code);
  if (!read.ok) return read;
  const ghost = read.ghost;
  const me = callsignOf(town);
  if (ghost.from.callsign === me) return { ok: false, error: 'own' };
  if (ghost.to !== me) return { ok: false, error: 'address' };
  const ledger = ghostLedger(town);
  const key = ghostKey(ghost.from.callsign, ghost.id);
  if (ledger.taken.includes(key)) return { ok: false, error: 'taken' };

  const title = `GHOST — ${ghost.from.callsign}`;
  const config = ghostBattleConfig(town, title, ghostWave(ghost), ghost.mods, ghost.seed, ghost.unitMods);
  const resolution = resolveRaid(config, ghost.plan, 1, ghostCatalog(town.faction, ghost.from.faction), FLAT_PAYOUT);
  const held = !resolution.cleared;
  const standing = payToday(ledger, 'taken', now) ? (held ? GHOST_HELD : GHOST_BREACHED) : 0;
  // The garrison fought it, so it does not count as the commander playing:
  // the same reading a probe gets.
  if (standing !== 0) awardStanding(town, standing, now, false);
  remember(ledger.taken, key);

  town.defenseLog.unshift({
    at: now,
    level: 0,
    held,
    suppliesLost: 0,
    fuelLost: 0,
    ...(config.standingOrders ? { orders: config.standingOrders.id } : {}),
    config,
    ghost: { callsign: ghost.from.callsign, faction: ghost.from.faction },
  });
  town.defenseLog.length = Math.min(town.defenseLog.length, DEFENSE_LOG_CAP);

  const tag: GhostTag = {
    attacker: ghost.from.faction,
    attackerCallsign: ghost.from.callsign,
    defenderCallsign: me,
    id: ghost.id,
  };
  const result = recordBattle(town, {
    kind: 'ghost',
    faction: town.faction,
    title,
    won: held,
    at: now,
    detail: `${held ? 'held' : 'BREACHED'} · ${lostOf(resolution)}/${planUnitCount(ghost.plan)} fell · ${signed(standing)}`,
    config,
    ghost: tag,
  });
  return { ok: true, taken: { ghost, held, standing, resolution, config, result } };
}

// ---- collecting the result -------------------------------------------------------

export type CollectError = CodeError | 'kind' | 'stranger' | 'collected' | 'tampered';

export interface CollectedGhost {
  replay: Replay;
  tag: GhostTag;
  won: boolean;
  standing: number;
  loot: { supplies: number; fuel: number };
  resolution: RaidResolution;
}

/** A wave's men, in an order that does not depend on how it was written. */
function menOf(wave: WaveDef | undefined): string {
  const rows = (wave?.entries ?? []).map((e: WaveEntry) => [
    e.atTick,
    e.squad ?? -1,
    e.kind,
    e.row ?? -1,
    e.col ?? -1,
    e.doctrine ?? 'assault',
    e.vet ?? 1,
  ]);
  rows.sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
    }
    return 0;
  });
  return JSON.stringify(rows);
}

/** Whether two armies were fitted alike, as their codes carry it. */
const sameFit = (a: Record<string, UnitMods> | undefined, b: Record<string, UnitMods> | undefined): boolean =>
  JSON.stringify(canonicalUnitMods(a) ?? null) === JSON.stringify(canonicalUnitMods(b) ?? null);

/**
 * Is this the battle the ghost was? Its half of it, which is the half the
 * attacker can know: the same men on the same seconds at the same rank, the
 * same research and specialisations, the same dice, nothing fired at it from
 * a fire plan, and a fight for the post to the end.
 */
export function isGhostBattle(config: SimConfig, sent: SentGhost): boolean {
  const waves = config.siege?.waves ?? [];
  return (
    waves.length === 1 &&
    menOf(waves[0]) === menOf(ghostWave(sent)) &&
    config.seed === sent.seed &&
    config.combatSeed === undefined &&
    config.objective === undefined &&
    config.autoPowers === undefined &&
    (config.mods?.attacker?.hp ?? 1) === sent.mods.hp &&
    (config.mods?.attacker?.damage ?? 1) === sent.mods.damage &&
    sameFit(config.unitMods, sent.unitMods)
  );
}

/**
 * Collect a result: match it to a ghost this war sent and has not been paid
 * for, check the battle is the one sent, fight it again, and pay by the
 * ending this game reaches, whatever the code says of it.
 */
export function collectGhost(
  town: TownState,
  code: string,
  now: number,
): { ok: true; collected: CollectedGhost } | { ok: false; error: CollectError } {
  const decoded = decodeReplay(code);
  if (!decoded.ok) return decoded;
  const replay = decoded.replay;
  const tag = replay.ghost;
  if (replay.kind !== 'ghost' || !tag) return { ok: false, error: 'kind' };
  const ledger = ghostLedger(town);
  const key = ghostKey(tag.attackerCallsign, tag.id);
  const at = ledger.sent.findIndex(
    (s) =>
      s.id === tag.id &&
      s.from.callsign === tag.attackerCallsign &&
      s.from.faction === tag.attacker &&
      s.to === tag.defenderCallsign,
  );
  if (at < 0) return { ok: false, error: ledger.collected.includes(key) ? 'collected' : 'stranger' };
  const sent = ledger.sent[at]!;
  if (!isGhostBattle(replay.config, sent)) return { ok: false, error: 'tampered' };

  const resolution = resolveRaid(
    replay.config,
    sent.plan,
    1,
    ghostCatalog(replay.faction, tag.attacker),
    FLAT_PAYOUT,
  );
  const won = resolution.cleared;
  const paid = payToday(ledger, 'collected', now);
  const standing = paid ? (won ? GHOST_WON : GHOST_FAILED) : 0;
  const loot = paid && won ? { ...resolution.loot } : { supplies: 0, fuel: 0 };
  if (standing !== 0) awardStanding(town, standing, now);
  town.supplies += loot.supplies;
  town.fuel += loot.fuel;
  ledger.sent.splice(at, 1);
  remember(ledger.collected, key);

  recordBattle(town, {
    kind: 'ghost',
    faction: replay.faction,
    title: `GHOST — ${tag.defenderCallsign}`,
    won,
    at: now,
    detail: `${won ? 'TAKEN' : 'thrown back'} · ${lostOf(resolution)} lost · ${signed(standing)} · +${loot.supplies} SUP`,
    config: replay.config,
    ghost: tag,
  });
  return { ok: true, collected: { replay, tag, won, standing, loot, resolution } };
}

// ---- off disk --------------------------------------------------------------------

const isUint = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 0xffffffff;
const isMult = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 10;

function readPlan(raw: unknown): SquadPlan[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > SQUAD_SLOTS) return null;
  const plan: SquadPlan[] = [];
  for (const item of raw) {
    const s = (item ?? {}) as Partial<SquadPlan>;
    if (!TOWN_ENTRY_SECTORS.includes(s.sector as SectorId) || !DOCTRINE_IDS.includes(s.doctrine as Doctrine)) {
      return null;
    }
    if (!isUint(s.slot) || s.slot >= SQUAD_SLOTS || !isUint(s.delay) || s.delay > 60) return null;
    if (s.vet !== undefined && !isMult(s.vet)) return null;
    if (!s.units || typeof s.units !== 'object') return null;
    const units: Record<string, number> = {};
    for (const [kind, count] of Object.entries(s.units)) {
      if (!isUint(count) || count < 1) return null;
      units[kind] = count;
    }
    if (Object.keys(units).length === 0) return null;
    plan.push({
      units,
      sector: s.sector!,
      doctrine: s.doctrine!,
      slot: s.slot,
      delay: s.delay,
      ...(s.vet !== undefined ? { vet: s.vet } : {}),
    });
  }
  return plan;
}

/**
 * Specialisations off disk: absent stays absent, and anything that is not
 * kinds of multipliers is null, which drops the ghost it came with.
 */
function readFit(raw: unknown): Record<string, UnitMods> | undefined | null {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  for (const m of Object.values(raw)) {
    if (!m || typeof m !== 'object' || Object.values(m).some((v) => !isMult(v))) return null;
  }
  return canonicalUnitMods(raw as Record<string, UnitMods>);
}

function readSent(raw: unknown): SentGhost | null {
  const s = (raw ?? {}) as Partial<SentGhost>;
  const from = s.from as Partial<SentGhost['from']> | undefined;
  if (!from || typeof from.callsign !== 'string' || !FACTION_IDS.includes(from.faction as FactionId)) return null;
  if (typeof s.to !== 'string' || !isUint(s.id) || !isUint(s.seed)) return null;
  if (typeof s.at !== 'number' || !Number.isFinite(s.at)) return null;
  const mods = s.mods as Partial<GhostMods> | undefined;
  if (!mods || !isMult(mods.hp) || !isMult(mods.damage)) return null;
  const plan = readPlan(s.plan);
  if (!plan) return null;
  const unitMods = readFit(s.unitMods);
  if (unitMods === null) return null;
  return {
    from: { callsign: from.callsign, faction: from.faction as FactionId },
    to: s.to,
    id: s.id,
    seed: s.seed,
    plan,
    mods: { hp: mods.hp, damage: mods.damage },
    ...(unitMods ? { unitMods } : {}),
    at: s.at,
  };
}

const readKeys = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string').slice(0, GHOST_MEMORY) : [];

/** The ledger read back off disk, with anything unreadable dropped. Absent stays absent. */
export function normalizeGhosts(raw: unknown): GhostLedger | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ledger = raw as Partial<GhostLedger>;
  const sent = Array.isArray(ledger.sent)
    ? ledger.sent.map(readSent).filter((s): s is SentGhost => s !== null).slice(0, GHOST_SENT_CAP)
    : [];
  const paid = ledger.paid;
  return {
    sent,
    collected: readKeys(ledger.collected),
    taken: readKeys(ledger.taken),
    ...(paid && isUint(paid.day) && isUint(paid.taken) && isUint(paid.collected)
      ? { paid: { day: paid.day, taken: paid.taken, collected: paid.collected } }
      : {}),
  };
}
