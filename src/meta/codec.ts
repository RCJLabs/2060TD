/**
 * The wire format both code kinds are built on (v1.11).
 *
 * Share codes (v1.2) invented this: URL- and chat-safe base64, LEB128 varints
 * so small numbers cost one byte, and a two-byte checksum so a truncated
 * paste is refused rather than half-loaded. Replay codes need exactly the
 * same primitives, so they live here rather than being written twice.
 */

import type { UnitMods } from '../sim/types';

/** How a paste can fail. Every code kind fails the same handful of ways. */
export type CodeError =
  | 'empty'
  | 'characters'
  | 'truncated'
  | 'checksum'
  | 'version'
  | 'content';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

/** URL- and chat-safe base64: no padding, no characters that get escaped. */
export function toBase64Url(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    if (b === undefined) break;
    out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    if (c === undefined) break;
    out += B64[c & 63]!;
  }
  return out;
}

export function fromBase64Url(text: string): number[] | null {
  const bytes: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of text) {
    const value = B64_INDEX.get(ch);
    if (value === undefined) return null;
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return bytes;
}

/** LEB128: small numbers cost one byte, which is what wall deltas are. */
export function writeVarint(out: number[], value: number): void {
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
}

export interface Cursor {
  bytes: number[];
  at: number;
}

export function readVarint(cur: Cursor): number | null {
  let result = 0;
  let shift = 0;
  for (;;) {
    if (cur.at >= cur.bytes.length || shift > 28) return null;
    const byte = cur.bytes[cur.at++]!;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return result >>> 0;
    shift += 7;
  }
}

/** FNV-1a over the payload; two bytes is plenty to catch a mangled paste. */
export function checksum(bytes: number[]): number {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash & 0xffff;
}

/** Fixed-point for the handful of fractional multipliers a code carries. */
const MILLI = 1000;

export const putMilli = (out: number[], value: number | undefined, fallback = 1): void =>
  writeVarint(out, Math.round((value ?? fallback) * MILLI));

export const getMilli = (cur: Cursor): number | null => {
  const raw = readVarint(cur);
  return raw === null ? null : raw / MILLI;
};

const UTF8 = new TextEncoder();
const FROM_UTF8 = new TextDecoder();

/**
 * A string as its UTF-8 bytes behind a length. Replay codes name generated
 * content (curly quotes, em dashes), so a byte per character would rename it.
 */
export function putString(out: number[], value: string): void {
  const bytes = UTF8.encode(value.slice(0, 255));
  writeVarint(out, bytes.length);
  for (const byte of bytes) out.push(byte);
}

export function getString(cur: Cursor): string | null {
  const length = readVarint(cur);
  if (length === null || length > 1024) return null;
  if (cur.at + length > cur.bytes.length) return null;
  const bytes = Uint8Array.from(cur.bytes.slice(cur.at, cur.at + length));
  cur.at += length;
  return FROM_UTF8.decode(bytes);
}

// ---- specialisations ---------------------------------------------------------------

/**
 * A war's specialisations (M28 Phase 4), as the replay and ghost codes both
 * carry them: how many kinds, then each kind's name (named as its code names
 * kinds), a bit for each field it changes, in this order, and those fields to
 * the thousandth.
 */
const UNIT_MOD_FIELDS = ['hp', 'damage', 'speed', 'range', 'wall', 'heal'] as const;
const UNIT_MOD_BITS = (1 << UNIT_MOD_FIELDS.length) - 1;
/** More kinds than any army trains, and a bound on a mangled paste. */
const MAX_UNIT_MOD_KINDS = 32;

/**
 * Specialisations as a code carries them: each field to the thousandth, a
 * field of 1 and a kind left with nothing dropped, the kinds in name order.
 * So one army's fittings are one run of bytes however the object holding
 * them was built, and a battle fought with them is the one its code
 * re-fights. Undefined when nothing is left, which is how a code with none
 * reads back.
 */
export function canonicalUnitMods(
  mods: Readonly<Record<string, UnitMods>> | undefined,
): Record<string, UnitMods> | undefined {
  if (!mods) return undefined;
  const out: Record<string, UnitMods> = {};
  for (const kind of Object.keys(mods).sort()) {
    const kept: UnitMods = {};
    for (const field of UNIT_MOD_FIELDS) {
      const value = mods[kind]?.[field];
      if (value === undefined) continue;
      const milli = Math.round(value * MILLI) / MILLI;
      if (milli !== 1) kept[field] = milli;
    }
    if (Object.keys(kept).length > 0) out[kind] = kept;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Write `canonicalUnitMods`'s result, each kind named by `putKind`. */
export function putUnitMods(
  out: number[],
  mods: Readonly<Record<string, UnitMods>>,
  putKind: (kind: string) => void,
): void {
  const kinds = Object.keys(mods);
  writeVarint(out, kinds.length);
  for (const kind of kinds) {
    const m = mods[kind]!;
    putKind(kind);
    out.push(UNIT_MOD_FIELDS.reduce((mask, field, bit) => (m[field] !== undefined ? mask | (1 << bit) : mask), 0));
    for (const field of UNIT_MOD_FIELDS) {
      const value = m[field];
      if (value === undefined) continue;
      if (!(value > 0) || !Number.isFinite(value)) {
        throw new Error(`a specialisation multiplies ${kind}'s ${field} by more than nothing, not ${value}`);
      }
      putMilli(out, value);
    }
  }
}

/**
 * Read specialisations back, refusing anything `putUnitMods` would not have
 * written: kinds out of name order or named twice, a kind changing nothing,
 * a field of 0 or 1. A field this reader does not know is one it cannot
 * fight, so that code is newer than the reader, not damaged.
 */
export function getUnitMods(cur: Cursor, getKind: () => string | null): Record<string, UnitMods> | CodeError {
  const count = readVarint(cur);
  if (count === null) return 'truncated';
  if (count < 1 || count > MAX_UNIT_MOD_KINDS) return 'content';
  const out: Record<string, UnitMods> = {};
  let last = '';
  for (let i = 0; i < count; i++) {
    const kind = getKind();
    const mask = cur.bytes[cur.at++];
    if (kind === null || mask === undefined) return 'truncated';
    if ((mask & ~UNIT_MOD_BITS) !== 0) return 'version';
    if (mask === 0 || (i > 0 && kind <= last)) return 'content';
    last = kind;
    const m: UnitMods = {};
    for (let bit = 0; bit < UNIT_MOD_FIELDS.length; bit++) {
      if ((mask & (1 << bit)) === 0) continue;
      const value = getMilli(cur);
      if (value === null) return 'truncated';
      if (value === 0 || value === 1) return 'content';
      m[UNIT_MOD_FIELDS[bit]!] = value;
    }
    out[kind] = m;
  }
  return out;
}
