import { flavorFor, type FactionId } from '../content/factions';
import type { SimConfig } from '../sim/types';
import {
  cleanTitle,
  decodeReplay,
  encodeReplay,
  type Replay,
  type ReplayKind,
} from './replaycode';
import type { TownState } from './town';

/**
 * The replay vault (v1.11): the last ten battles, kept watchable.
 *
 * Entries are stored as replay CODES rather than configs. That is not a
 * space trick for its own sake — a code is six times smaller than the same
 * config as JSON, but more importantly it makes three problems into one:
 * reading a vault off disk is the same checksummed decode as reading a
 * pasted code, copying a battle to a friend is free because the code is
 * already what is stored, and a corrupted entry is rejected at load rather
 * than crashing a replay three taps later.
 *
 * ONLY HANDS-OFF BATTLES go in. A raid, a duel and an offline probe resolve
 * from their config alone, so re-running it IS the battle. A live siege does
 * not: the commander's placements during the fight are commands the config
 * never held. Storing one would produce a replay of a battle nobody fought.
 */

export const VAULT_CAP = 10;

export interface VaultEntry {
  /** The battle itself. Everything below is a copy, kept so the list is cheap. */
  code: string;
  kind: ReplayKind;
  title: string;
  /** Did the commander win it? */
  won: boolean;
  /** When it was fought (epoch ms). */
  at: number;
  /** One line of outcome the config cannot know: loot, losses, what got in. */
  detail: string;
}

export function vaultOf(town: TownState): VaultEntry[] {
  if (!Array.isArray(town.vault)) town.vault = [];
  return town.vault;
}

/** A battle worth keeping, newest first. Returns the code it was filed under. */
export function recordBattle(
  town: TownState,
  battle: {
    kind: ReplayKind;
    faction: FactionId;
    title: string;
    won: boolean;
    at: number;
    detail: string;
    config: SimConfig;
  },
): string {
  const code = encodeReplay({
    kind: battle.kind,
    faction: battle.faction,
    title: battle.title,
    won: battle.won,
    config: battle.config,
  });
  const vault = vaultOf(town);
  vault.unshift({
    code,
    kind: battle.kind,
    title: cleanTitle(battle.title),
    won: battle.won,
    at: battle.at,
    detail: battle.detail.slice(0, 48),
  });
  vault.length = Math.min(vault.length, VAULT_CAP);
  return code;
}

/** The battle behind an entry, or null if the code no longer reads. */
export function openEntry(entry: VaultEntry): Replay | null {
  const decoded = decodeReplay(entry.code);
  return decoded.ok ? decoded.replay : null;
}

/**
 * Repair a vault off disk.
 *
 * Every entry is decoded here rather than at watch time, so an entry that
 * survives normalization is one the viewer can definitely open. A file that
 * predates the vault simply has none.
 */
export function normalizeVault(raw: unknown): VaultEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: VaultEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Partial<VaultEntry>;
    if (typeof entry.code !== 'string' || entry.code.length === 0) continue;
    const decoded = decodeReplay(entry.code);
    if (!decoded.ok) continue;
    out.push({
      code: entry.code,
      // The code is the authority on what the battle IS; the stored copies
      // are only there to keep the list cheap, so they defer to it.
      kind: decoded.replay.kind,
      title: decoded.replay.title,
      won: decoded.replay.won,
      at:
        typeof entry.at === 'number' && Number.isFinite(entry.at)
          ? Math.max(0, Math.round(entry.at))
          : 0,
      detail: typeof entry.detail === 'string' ? entry.detail.slice(0, 48) : '',
    });
    if (out.length >= VAULT_CAP) break;
  }
  return out;
}

/**
 * File a pasted code. Duplicates are refused rather than stacked — pasting
 * the same battle twice is a paste, not two battles.
 */
export function fileCode(
  town: TownState,
  code: string,
  now: number,
): { ok: true; entry: VaultEntry; replay: Replay } | { ok: false; error: 'code' | 'duplicate' } {
  const decoded = decodeReplay(code);
  if (!decoded.ok) return { ok: false, error: 'code' };
  const vault = vaultOf(town);
  const clean = code.trim().replace(/\s+/g, '');
  if (vault.some((e) => e.code === clean)) return { ok: false, error: 'duplicate' };
  const entry: VaultEntry = {
    code: clean,
    kind: decoded.replay.kind,
    title: decoded.replay.title,
    won: decoded.replay.won,
    at: now,
    // Somebody else's battle: the config cannot say what it cost them, but it
    // does say whose army fought it, which is the useful half.
    detail: `FILED · ${flavorFor(decoded.replay.faction).faction}`,
  };
  vault.unshift(entry);
  vault.length = Math.min(vault.length, VAULT_CAP);
  return { ok: true, entry, replay: decoded.replay };
}
