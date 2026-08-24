import { MAP_H, MAP_W, type GeneratedBase } from '../content/bases';
import { BUILDABLE_KINDS } from '../content/buildings';
import { FACTION_IDS, type FactionId } from '../content/factions';
import type { CellIndex, LayoutStructure, LayoutWall } from '../sim/types';
import type { TownState } from './town';
import {
  checksum,
  fromBase64Url,
  readVarint,
  toBase64Url,
  writeVarint,
  type Cursor,
  type CodeError,
} from './codec';

/** Share codes and replay codes fail the same handful of ways. */
export type ShareError = CodeError;

/**
 * Share codes (v1.2): a base as a string you can paste to a friend.
 *
 * No server exists and none is wanted, so the code carries everything a raid
 * needs and nothing it does not: the faction, the command post's level, a
 * name, the emplacements, and the wire. Economy, army, research and campaign
 * progress stay home — a raider fights the layout, not the ledger.
 *
 * The format is a hand-packed byte string rather than JSON because a code has
 * to survive being pasted into a chat window: ~120 walls and ~20 structures
 * come out around 300 characters. Codes are versioned and checksummed, so a
 * truncated paste is rejected instead of loading a half base.
 */

/** Bumped only when the byte layout changes; old codes are then refused. */
const FORMAT = 1;

/**
 * Kind → byte, fixed forever. Appending is safe; reordering or removing is
 * not, because it would silently reinterpret every code already shared.
 */
const SHARE_KINDS: string[] = ['cc', 'wall', ...BUILDABLE_KINDS];
const KIND_BYTE = new Map(SHARE_KINDS.map((kind, i) => [kind, i]));

/** What a code decodes to: enough to build a raid, and who to blame for it. */
export interface SharedBase {
  faction: FactionId;
  name: string;
  ccOrigin: CellIndex;
  ccLevel: number;
  walls: LayoutWall[];
  structures: LayoutStructure[];
  /** The ground the owner defends on (v1.19). */
  terrainSeed: number;
}

/**
 * The ground for a base whose code predates terrain.
 *
 * A share code is not a record of a battle — it is a BASE, and a base has to
 * sit on something. So rather than flattening old codes, the seed is derived
 * from the layout itself: both players compute the same number from the same
 * walls and buildings, so a code pasted from a year ago still fights on real
 * ground, and both sides fight on the SAME real ground, which is the only
 * property a duel actually needs.
 *
 * (Replay codes answer this the opposite way — see replaycode.ts. A record
 * must not change; a base may be put on a hill.)
 */
export function terrainSeedForLayout(base: Omit<SharedBase, 'terrainSeed'>): number {
  let hash = 0x811c9dc5;
  const eat = (n: number): void => {
    hash = Math.imul(hash ^ (n & 0xff), 0x01000193) >>> 0;
    hash = Math.imul(hash ^ ((n >>> 8) & 0xff), 0x01000193) >>> 0;
  };
  eat(base.ccOrigin);
  eat(base.ccLevel);
  for (const w of base.walls) eat(w.cell);
  for (const st of base.structures) {
    eat(st.cell);
    eat(st.level ?? 1);
  }
  return hash >>> 0;
}

const MAX_NAME = 24;

/** Trim a base name to something that fits a code and a headline. */
export function cleanName(raw: string): string {
  return raw.replace(/[^\x20-\x7e]/g, '').trim().slice(0, MAX_NAME) || 'UNNAMED POST';
}

/**
 * Pack a town's defensive layout. Structures under construction ship at the
 * level they will be, because a code is a boast, not a status report — but
 * wrecks are left out entirely: a raider should not be handed a hole.
 */
export function encodeBase(town: TownState, name: string): string {
  const payload: number[] = [FORMAT, FACTION_IDS.indexOf(town.faction)];

  const cc = town.structures.find((s) => s.kind === 'cc');
  const ccOrigin = cc?.cell ?? 11 * MAP_W + 27;
  payload.push(Math.min(3, Math.max(1, cc?.level ?? 1)));
  writeVarint(payload, ccOrigin);

  const label = cleanName(name);
  payload.push(label.length);
  for (const ch of label) payload.push(ch.charCodeAt(0) & 0xff);

  const structures = town.structures.filter(
    (s) => s.kind !== 'cc' && !s.wrecked && KIND_BYTE.has(s.kind),
  );
  writeVarint(payload, structures.length);
  for (const s of structures) {
    payload.push(KIND_BYTE.get(s.kind)!);
    writeVarint(payload, s.cell);
    payload.push(Math.min(3, Math.max(1, s.level)));
  }

  // Walls group by kind and then delta-encode: a straight line, horizontal or
  // vertical, becomes one repeated small delta and costs a byte per segment.
  const byKind = new Map<string, number[]>();
  for (const wall of town.walls) {
    if (!KIND_BYTE.has(wall.kind)) continue;
    const list = byKind.get(wall.kind) ?? [];
    list.push(wall.cell);
    byKind.set(wall.kind, list);
  }
  writeVarint(payload, byKind.size);
  for (const [kind, cells] of byKind) {
    payload.push(KIND_BYTE.get(kind)!);
    cells.sort((a, b) => a - b);
    writeVarint(payload, cells.length);
    let previous = 0;
    for (const cell of cells) {
      writeVarint(payload, cell - previous);
      previous = cell;
    }
  }

  // The ground, appended (v1.19). Old codes end before this and derive their
  // seed from the layout instead — see terrainSeedForLayout.
  writeVarint(payload, (town.terrainSeed ?? 0) >>> 0);

  const sum = checksum(payload);
  payload.push(sum & 0xff, (sum >> 8) & 0xff);
  return toBase64Url(payload);
}

export type DecodeResult =
  | { ok: true; base: SharedBase }
  | { ok: false; error: ShareError };

const inMap = (cell: number): boolean => cell >= 0 && cell < MAP_W * MAP_H;

/** Read a code back, refusing anything that is not exactly what we wrote. */
export function decodeBase(raw: string): DecodeResult {
  const text = raw.trim().replace(/\s+/g, '');
  if (!text) return { ok: false, error: 'empty' };

  const bytes = fromBase64Url(text);
  if (!bytes) return { ok: false, error: 'characters' };
  if (bytes.length < 8) return { ok: false, error: 'truncated' };

  const body = bytes.slice(0, -2);
  const expected = bytes[bytes.length - 2]! | (bytes[bytes.length - 1]! << 8);
  if (checksum(body) !== expected) return { ok: false, error: 'checksum' };

  const cur: Cursor = { bytes: body, at: 0 };
  const byte = (): number | null => (cur.at < cur.bytes.length ? cur.bytes[cur.at++]! : null);

  if (byte() !== FORMAT) return { ok: false, error: 'version' };
  const factionIndex = byte();
  if (factionIndex === null || !FACTION_IDS[factionIndex]) return { ok: false, error: 'content' };
  const faction = FACTION_IDS[factionIndex]!;

  const ccLevel = byte();
  const ccOrigin = readVarint(cur);
  if (ccLevel === null || ccLevel < 1 || ccLevel > 3) return { ok: false, error: 'content' };
  if (ccOrigin === null || !inMap(ccOrigin)) return { ok: false, error: 'content' };

  const nameLength = byte();
  if (nameLength === null || nameLength > MAX_NAME) return { ok: false, error: 'content' };
  let name = '';
  for (let i = 0; i < nameLength; i++) {
    const ch = byte();
    if (ch === null) return { ok: false, error: 'truncated' };
    name += String.fromCharCode(ch);
  }

  const structureCount = readVarint(cur);
  if (structureCount === null || structureCount > 200) return { ok: false, error: 'content' };
  const structures: LayoutStructure[] = [];
  for (let i = 0; i < structureCount; i++) {
    const kindByte = byte();
    const cell = readVarint(cur);
    const level = byte();
    if (kindByte === null || cell === null || level === null) return { ok: false, error: 'truncated' };
    const kind = SHARE_KINDS[kindByte];
    if (!kind || !inMap(cell) || level < 1 || level > 3) return { ok: false, error: 'content' };
    structures.push({ cell, kind, level });
  }

  const groupCount = readVarint(cur);
  if (groupCount === null || groupCount > SHARE_KINDS.length) return { ok: false, error: 'content' };
  const walls: LayoutWall[] = [];
  for (let g = 0; g < groupCount; g++) {
    const kindByte = byte();
    const count = readVarint(cur);
    if (kindByte === null || count === null) return { ok: false, error: 'truncated' };
    const kind = SHARE_KINDS[kindByte];
    if (!kind || count > MAP_W * MAP_H) return { ok: false, error: 'content' };
    let cell = 0;
    for (let i = 0; i < count; i++) {
      const delta = readVarint(cur);
      if (delta === null) return { ok: false, error: 'truncated' };
      cell += delta;
      if (!inMap(cell)) return { ok: false, error: 'content' };
      walls.push({ cell, kind });
    }
  }
  // A code written since v1.19 names its ground; anything older derives it.
  let terrainSeed: number | null = null;
  if (cur.at < cur.bytes.length) {
    terrainSeed = readVarint(cur);
    if (terrainSeed === null) return { ok: false, error: 'truncated' };
  }
  if (cur.at !== cur.bytes.length) return { ok: false, error: 'content' };

  const base = { faction, name: cleanName(name), ccOrigin, ccLevel, walls, structures };
  return {
    ok: true,
    base: {
      ...base,
      terrainSeed: terrainSeed && terrainSeed > 0 ? terrainSeed : terrainSeedForLayout(base),
    },
  };
}

/**
 * A decoded code as a raid target. Tier 0 marks it as a challenge rather than
 * a rung on the ladder — nothing about the Front Line moves for these.
 */
export function baseFromShare(shared: SharedBase): GeneratedBase {
  return {
    tier: 0,
    variant: 0,
    name: shared.name,
    ccOrigin: shared.ccOrigin,
    ccLevel: shared.ccLevel,
    walls: shared.walls,
    structures: shared.structures,
    // A friend's base is whatever they built; it is not one of the ladder's
    // shapes, and nothing reads the archetype for a duel.
    archetype: 'compound',
    terrainSeed: shared.terrainSeed,
  };
}

/** Short stable id for a code, so one friend's base cannot be farmed. */
export function codeFingerprint(code: string): string {
  return checksum([...code].map((c) => c.charCodeAt(0) & 0xff)).toString(36);
}
