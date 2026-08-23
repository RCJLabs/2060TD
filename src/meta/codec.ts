/**
 * The wire format both code kinds are built on (v1.11).
 *
 * Share codes (v1.2) invented this: URL- and chat-safe base64, LEB128 varints
 * so small numbers cost one byte, and a two-byte checksum so a truncated
 * paste is refused rather than half-loaded. Replay codes need exactly the
 * same primitives, so they live here rather than being written twice.
 */

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
