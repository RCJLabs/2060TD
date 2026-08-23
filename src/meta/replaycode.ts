import { FACTION_IDS, type FactionId } from '../content/factions';
import { standingOrdersFor, isStandingOrdersId } from '../content/standingOrders';
import type {
  AutoPowerRule,
  CellIndex,
  Doctrine,
  LayoutStructure,
  LayoutWall,
  SimConfig,
  WaveDef,
  WaveEntry,
} from '../sim/types';
import {
  checksum,
  fromBase64Url,
  readVarint,
  toBase64Url,
  writeVarint,
  type CodeError,
  type Cursor,
} from './codec';

/**
 * Replay codes (v1.11): a whole battle as a string you can paste.
 *
 * The sim is deterministic, so a battle IS its config — no frame log, no
 * recording, nothing to desync. Re-running the config reproduces the fight
 * exactly, which is why the vault and the code can both be "just the config"
 * and why a code is verifiable: encode, decode, run both, compare state
 * hashes. The tests do precisely that.
 *
 * ONLY HANDS-OFF BATTLES. Raids, duels and offline probes resolve from their
 * config alone. A live siege does not: the commander's placements during the
 * fight are commands, and the config never held them. Recording those would
 * mean a command log and a second replay path, which is not what this is.
 *
 * Kind names go in a DICTIONARY rather than a fixed byte table. Share codes
 * use a fixed table and carry a warning about never reordering it; this game
 * adds units and buildings every release across five factions, so a code that
 * names its own kinds is the format that survives that. It costs about ten
 * bytes per distinct kind and a config uses a dozen.
 */

/** Bumped only when the byte layout changes; old codes are then refused. */
const FORMAT = 1;

export type ReplayKind = 'raid' | 'duel' | 'probe';
const REPLAY_KINDS: ReplayKind[] = ['raid', 'duel', 'probe'];

const DOCTRINES: Doctrine[] = ['assault', 'hunt', 'raze'];
const POWER_TARGETS: AutoPowerRule['target'][] = ['cc', 'guns'];

/** What a replay code decodes to: the battle, and what to call it. */
export interface Replay {
  kind: ReplayKind;
  faction: FactionId;
  /** Headline for the viewer — the post's name, or the probe's level. */
  title: string;
  /** Did the side the code is FROM win it? Flavour for the list, not sim. */
  won: boolean;
  config: SimConfig;
}

const MAX_TITLE = 28;

/**
 * Strings are UTF-8, unlike share codes, which are a byte per ASCII character.
 *
 * The difference is deliberate: a share code names a base the PLAYER typed,
 * where stripping the odd exotic character is harmless. A replay code names
 * generated content — posts are quoted with curly quotes and probes titled
 * with an em dash — so a byte-per-char format would quietly rename every
 * battle in the vault. Two bytes for a quote mark is the cheaper mistake.
 */
export function cleanTitle(raw: string): string {
  return raw.trim().slice(0, MAX_TITLE) || 'UNNAMED BATTLE';
}

// ---- a dictionary of kind names ----------------------------------------------------

class Dictionary {
  private readonly index = new Map<string, number>();
  readonly names: string[] = [];

  id(name: string): number {
    const found = this.index.get(name);
    if (found !== undefined) return found;
    const next = this.names.length;
    this.index.set(name, next);
    this.names.push(name);
    return next;
  }
}

/** Fixed-point for the handful of fractional multipliers a config carries. */
const MILLI = 1000;
const putMilli = (out: number[], value: number | undefined, fallback = 1): void =>
  writeVarint(out, Math.round((value ?? fallback) * MILLI));
const getMilli = (cur: Cursor): number | null => {
  const raw = readVarint(cur);
  return raw === null ? null : raw / MILLI;
};

// ---- encode ------------------------------------------------------------------------

const UTF8 = new TextEncoder();
const FROM_UTF8 = new TextDecoder();

function putString(out: number[], value: string): void {
  const bytes = UTF8.encode(value.slice(0, 255));
  writeVarint(out, bytes.length);
  for (const byte of bytes) out.push(byte);
}

function putStructures(out: number[], dict: Dictionary, list: LayoutStructure[]): void {
  writeVarint(out, list.length);
  for (const s of list) {
    writeVarint(out, dict.id(s.kind));
    writeVarint(out, s.cell);
    out.push(Math.max(1, Math.min(9, s.level ?? 1)));
    // Under-construction scaffolding arrives damaged and inert; both matter
    // to the fight, so both ride along in one byte each.
    out.push(Math.round(Math.max(0, Math.min(1, s.hpFraction ?? 1)) * 255));
    out.push(s.inert === true ? 1 : 0);
  }
}

/**
 * Grouped by kind, then delta-encoded: a straight wall line becomes a run of
 * identical small deltas, one byte each.
 *
 * This does NOT preserve the order walls were listed in — grouping and sorting
 * is the whole saving. The engine keys walls by cell, so order carries no
 * meaning; the state-hash tests are what prove that rather than the claim.
 */
function putWalls(out: number[], dict: Dictionary, list: LayoutWall[]): void {
  const byKind = new Map<string, number[]>();
  for (const wall of list) {
    const cells = byKind.get(wall.kind) ?? [];
    cells.push(wall.cell);
    byKind.set(wall.kind, cells);
  }
  writeVarint(out, byKind.size);
  for (const [kind, cells] of byKind) {
    writeVarint(out, dict.id(kind));
    cells.sort((a, b) => a - b);
    writeVarint(out, cells.length);
    let previous = 0;
    for (const cell of cells) {
      writeVarint(out, cell - previous);
      previous = cell;
    }
  }
}

function putWave(out: number[], dict: Dictionary, wave: WaveDef): void {
  // Entries group by kind too, and atTick is delta-encoded within a group:
  // a wave is a handful of kinds arriving on a regular cadence.
  const byKind = new Map<string, WaveEntry[]>();
  for (const entry of wave.entries) {
    const list = byKind.get(entry.kind) ?? [];
    list.push(entry);
    byKind.set(entry.kind, list);
  }
  writeVarint(out, byKind.size);
  for (const [kind, entries] of byKind) {
    writeVarint(out, dict.id(kind));
    writeVarint(out, entries.length);
    entries.sort((a, b) => a.atTick - b.atTick);
    let previous = 0;
    for (const e of entries) {
      writeVarint(out, e.atTick - previous);
      previous = e.atTick;
      writeVarint(out, e.row);
      // col is optional (the regular western strip); +1 so absent is 0.
      writeVarint(out, e.col === undefined ? 0 : e.col + 1);
      out.push(DOCTRINES.indexOf(e.doctrine ?? 'assault'));
      writeVarint(out, (e.squad ?? -1) + 1);
      putMilli(out, e.vet);
    }
  }
}

function putRecord(out: number[], dict: Dictionary, record: Record<string, number>): void {
  const pairs = Object.entries(record);
  writeVarint(out, pairs.length);
  for (const [kind, value] of pairs) {
    writeVarint(out, dict.id(kind));
    writeVarint(out, Math.max(0, Math.round(value)));
  }
}

/**
 * Pack a battle. The dictionary is built while walking the config and written
 * in front of it, so the reader can resolve names before it needs them.
 */
export function encodeReplay(replay: Replay): string {
  const dict = new Dictionary();
  const body: number[] = [];
  const c = replay.config;

  writeVarint(body, c.width);
  writeVarint(body, c.height);
  writeVarint(body, c.seed >>> 0);
  writeVarint(body, c.ccOrigin);
  body.push(Math.max(1, Math.min(9, c.ccLevel ?? 1)));
  writeVarint(body, c.spawnColumn);
  body.push(c.playerSide === 'attacker' ? 1 : 0);

  const mods = c.mods;
  body.push(mods ? 1 : 0);
  if (mods) {
    putMilli(body, mods.attacker?.hp);
    putMilli(body, mods.attacker?.damage);
    putMilli(body, mods.defender?.weaponDamage);
    putMilli(body, mods.defender?.wallHp);
    putMilli(body, mods.defender?.cpCost);
  }

  const layout = c.layout;
  body.push(layout ? 1 : 0);
  if (layout) {
    putStructures(body, dict, layout.structures);
    putWalls(body, dict, layout.walls);
  }

  const siege = c.siege;
  body.push(siege ? 1 : 0);
  if (siege) {
    putString(body, siege.name);
    writeVarint(body, siege.startingSupplies);
    writeVarint(body, siege.suppliesPerWave);
    writeVarint(body, siege.startingCp);
    writeVarint(body, siege.cpCap);
    putMilli(body, siege.cpPerSecond, 0);
    writeVarint(body, siege.prepSeconds);
    putMilli(body, siege.repairCostPerHp, 0);
    writeVarint(body, siege.waves.length);
    for (const wave of siege.waves) putWave(body, dict, wave);
  }

  putRecord(body, dict, c.powerCharges ?? {});

  const auto = c.autoPowers ?? [];
  writeVarint(body, auto.length);
  for (const rule of auto) {
    writeVarint(body, dict.id(rule.kind));
    writeVarint(body, Math.max(0, Math.round(rule.atSeconds)));
    body.push(POWER_TARGETS.indexOf(rule.target));
  }

  const reserved = c.reservedCells ?? [];
  writeVarint(body, reserved.length);
  for (const cell of reserved) writeVarint(body, cell);

  // Standing orders ride as their preset id: the rules are content, rebuilt
  // by the reader, so a code never carries a policy table that could drift
  // out of step with the game it is pasted into.
  putString(body, c.standingOrders?.id ?? '');

  // Header, dictionary, then the body — the reader needs the names first.
  const head: number[] = [FORMAT, REPLAY_KINDS.indexOf(replay.kind)];
  head.push(Math.max(0, FACTION_IDS.indexOf(replay.faction)));
  head.push(replay.won ? 1 : 0);
  putString(head, cleanTitle(replay.title));
  writeVarint(head, dict.names.length);
  for (const name of dict.names) putString(head, name);

  const payload = [...head, ...body];
  const sum = checksum(payload);
  payload.push(sum & 0xff, (sum >> 8) & 0xff);
  return toBase64Url(payload);
}

// ---- decode ------------------------------------------------------------------------

export type ReplayDecode =
  | { ok: true; replay: Replay }
  | { ok: false; error: CodeError };

const bad = (error: CodeError): ReplayDecode => ({ ok: false, error });

function getString(cur: Cursor): string | null {
  const length = readVarint(cur);
  if (length === null || length > 1024) return null;
  if (cur.at + length > cur.bytes.length) return null;
  const bytes = Uint8Array.from(cur.bytes.slice(cur.at, cur.at + length));
  cur.at += length;
  return FROM_UTF8.decode(bytes);
}

/**
 * Read a code back, refusing anything that is not exactly what we wrote.
 *
 * Every length is checked against a ceiling before it is trusted: a mangled
 * paste that survives the checksum must not be able to ask for a hundred
 * million wall cells.
 */
export function decodeReplay(raw: string): ReplayDecode {
  const text = raw.trim().replace(/\s+/g, '');
  if (!text) return bad('empty');
  const bytes = fromBase64Url(text);
  if (!bytes) return bad('characters');
  if (bytes.length < 12) return bad('truncated');

  const body = bytes.slice(0, -2);
  const expected = bytes[bytes.length - 2]! | (bytes[bytes.length - 1]! << 8);
  if (checksum(body) !== expected) return bad('checksum');

  const cur: Cursor = { bytes: body, at: 0 };
  if (body[cur.at++] !== FORMAT) return bad('version');
  const kind = REPLAY_KINDS[body[cur.at++]!];
  const faction = FACTION_IDS[body[cur.at++]!];
  const wonByte = body[cur.at++];
  if (!kind || !faction || wonByte === undefined) return bad('content');
  const title = getString(cur);
  if (title === null) return bad('truncated');

  const dictCount = readVarint(cur);
  if (dictCount === null || dictCount > 256) return bad('content');
  const dict: string[] = [];
  for (let i = 0; i < dictCount; i++) {
    const name = getString(cur);
    if (name === null) return bad('truncated');
    dict.push(name);
  }
  const kindOf = (id: number | null): string | null =>
    id === null || id < 0 || id >= dict.length ? null : dict[id]!;

  const width = readVarint(cur);
  const height = readVarint(cur);
  const seed = readVarint(cur);
  const ccOrigin = readVarint(cur);
  if (width === null || height === null || seed === null || ccOrigin === null) {
    return bad('truncated');
  }
  if (width < 4 || width > 256 || height < 4 || height > 256) return bad('content');
  const cells = width * height;
  if (ccOrigin >= cells) return bad('content');
  const ccLevel = body[cur.at++];
  const spawnColumn = readVarint(cur);
  const attackerSide = body[cur.at++];
  if (ccLevel === undefined || spawnColumn === null || attackerSide === undefined) {
    return bad('truncated');
  }

  const config: SimConfig = {
    width,
    height,
    seed,
    ccOrigin,
    ccLevel,
    spawnColumn,
    ...(attackerSide === 1 ? { playerSide: 'attacker' as const } : {}),
  };

  if (body[cur.at++] === 1) {
    const hp = getMilli(cur);
    const damage = getMilli(cur);
    const weaponDamage = getMilli(cur);
    const wallHp = getMilli(cur);
    const cpCost = getMilli(cur);
    if (hp === null || damage === null || weaponDamage === null || wallHp === null || cpCost === null) {
      return bad('truncated');
    }
    // Identity halves are dropped again, so a decoded config is byte-for-byte
    // the shape the encoder was handed rather than a fatter equivalent.
    const attacker = hp === 1 && damage === 1 ? undefined : { hp, damage };
    const defender =
      weaponDamage === 1 && wallHp === 1 && cpCost === 1
        ? undefined
        : { weaponDamage, wallHp, cpCost };
    if (attacker || defender) {
      config.mods = { ...(attacker ? { attacker } : {}), ...(defender ? { defender } : {}) };
    }
  }

  if (body[cur.at++] === 1) {
    const structureCount = readVarint(cur);
    if (structureCount === null || structureCount > cells) return bad('content');
    const structures: LayoutStructure[] = [];
    for (let i = 0; i < structureCount; i++) {
      const kindName = kindOf(readVarint(cur));
      const cell = readVarint(cur);
      const level = body[cur.at++];
      const hpByte = body[cur.at++];
      const inert = body[cur.at++];
      if (kindName === null || cell === null || level === undefined) return bad('truncated');
      if (hpByte === undefined || inert === undefined) return bad('truncated');
      if (cell >= cells) return bad('content');
      structures.push({
        kind: kindName,
        cell,
        level,
        ...(hpByte < 255 ? { hpFraction: hpByte / 255 } : {}),
        ...(inert === 1 ? { inert: true } : {}),
      });
    }
    const groups = readVarint(cur);
    if (groups === null || groups > 64) return bad('content');
    const walls: LayoutWall[] = [];
    for (let g = 0; g < groups; g++) {
      const kindName = kindOf(readVarint(cur));
      const count = readVarint(cur);
      if (kindName === null || count === null || count > cells) return bad('content');
      let previous = 0;
      for (let i = 0; i < count; i++) {
        const delta = readVarint(cur);
        if (delta === null) return bad('truncated');
        previous += delta;
        if (previous >= cells) return bad('content');
        walls.push({ cell: previous, kind: kindName });
      }
    }
    config.layout = { walls, structures };
  }

  if (body[cur.at++] === 1) {
    const name = getString(cur);
    const startingSupplies = readVarint(cur);
    const suppliesPerWave = readVarint(cur);
    const startingCp = readVarint(cur);
    const cpCap = readVarint(cur);
    const cpPerSecond = getMilli(cur);
    const prepSeconds = readVarint(cur);
    const repairCostPerHp = getMilli(cur);
    const waveCount = readVarint(cur);
    if (
      name === null ||
      startingSupplies === null ||
      suppliesPerWave === null ||
      startingCp === null ||
      cpCap === null ||
      cpPerSecond === null ||
      prepSeconds === null ||
      repairCostPerHp === null ||
      waveCount === null
    ) {
      return bad('truncated');
    }
    if (waveCount > 64) return bad('content');
    const waves: WaveDef[] = [];
    for (let w = 0; w < waveCount; w++) {
      const groups = readVarint(cur);
      if (groups === null || groups > 64) return bad('content');
      const entries: WaveEntry[] = [];
      for (let g = 0; g < groups; g++) {
        const kindName = kindOf(readVarint(cur));
        const count = readVarint(cur);
        if (kindName === null || count === null || count > 4096) return bad('content');
        let previous = 0;
        for (let i = 0; i < count; i++) {
          const delta = readVarint(cur);
          const row = readVarint(cur);
          const colPlus = readVarint(cur);
          const doctrine = DOCTRINES[body[cur.at++]!];
          const squadPlus = readVarint(cur);
          const vet = getMilli(cur);
          if (delta === null || row === null || colPlus === null) return bad('truncated');
          if (!doctrine || squadPlus === null || vet === null) return bad('truncated');
          if (row >= height || colPlus > width) return bad('content');
          previous += delta;
          entries.push({
            atTick: previous,
            kind: kindName,
            row,
            ...(colPlus > 0 ? { col: colPlus - 1 } : {}),
            doctrine,
            ...(squadPlus > 0 ? { squad: squadPlus - 1 } : {}),
            ...(vet !== 1 ? { vet } : {}),
          });
        }
      }
      entries.sort((a, b) => a.atTick - b.atTick || a.kind.localeCompare(b.kind));
      waves.push({ entries });
    }
    config.siege = {
      name,
      startingSupplies,
      suppliesPerWave,
      startingCp,
      cpCap,
      cpPerSecond,
      prepSeconds,
      repairCostPerHp,
      waves,
    };
  }

  const chargeCount = readVarint(cur);
  if (chargeCount === null || chargeCount > 64) return bad('content');
  if (chargeCount > 0) {
    const charges: Record<string, number> = {};
    for (let i = 0; i < chargeCount; i++) {
      const kindName = kindOf(readVarint(cur));
      const value = readVarint(cur);
      if (kindName === null || value === null) return bad('truncated');
      charges[kindName] = value;
    }
    config.powerCharges = charges;
  }

  const autoCount = readVarint(cur);
  if (autoCount === null || autoCount > 64) return bad('content');
  if (autoCount > 0) {
    const rules: AutoPowerRule[] = [];
    for (let i = 0; i < autoCount; i++) {
      const kindName = kindOf(readVarint(cur));
      const atSeconds = readVarint(cur);
      const target = POWER_TARGETS[body[cur.at++]!];
      if (kindName === null || atSeconds === null || !target) return bad('truncated');
      rules.push({ kind: kindName, atSeconds, target });
    }
    config.autoPowers = rules;
  }

  const reservedCount = readVarint(cur);
  if (reservedCount === null || reservedCount > 64) return bad('content');
  if (reservedCount > 0) {
    const reserved: CellIndex[] = [];
    for (let i = 0; i < reservedCount; i++) {
      const cell = readVarint(cur);
      if (cell === null) return bad('truncated');
      if (cell >= cells) return bad('content');
      reserved.push(cell);
    }
    config.reservedCells = reserved;
  }

  const orders = getString(cur);
  if (orders === null) return bad('truncated');
  if (orders !== '') {
    if (!isStandingOrdersId(orders)) return bad('content');
    config.standingOrders = standingOrdersFor(orders);
  }

  return {
    ok: true,
    replay: { kind, faction, title, won: wonByte === 1, config },
  };
}

/** A short, stable handle for a code — the vault lists battles by it. */
export function replayFingerprint(code: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < code.length; i++) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, '0').slice(0, 7);
}
