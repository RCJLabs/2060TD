import { campaignFor, type FactionId } from '../content/factions';
import { LEAGUES, seasonAt } from '../content/leagues';
import { PLACEMENT_CAP } from './ladder';
import { isStandingOrdersId } from '../content/standingOrders';
import { newTown, unlockAll, type TownState } from './town';

/**
 * Versioned save persistence: localStorage autosave plus export/import as a
 * JSON file. Schema 1 (M2, pre-campaign) saves migrate forward on load.
 */

export const SAVE_KEY = 'lastline_save_v1';
export const SCHEMA = 6;

export function serialize(town: TownState): string {
  return JSON.stringify({ schema: SCHEMA, savedAt: town.lastSeen, town });
}

/** Schema 1 towns predate the campaign: grant everything they already had. */
function migrateV1(legacy: Record<string, unknown>): Record<string, unknown> | null {
  if (legacy['version'] !== 1) return null;
  const town = {
    ...legacy,
    version: 2,
    campaign: { next: 0, completed: [], difficulty: 'standard', bonuses: [] },
    unlocked: [],
  };
  unlockAll(town as unknown as TownState);
  return town;
}

/** Schema 2 towns predate the Front Line: empty army, tier 1, clean log. */
function migrateV2(legacy: Record<string, unknown>): Record<string, unknown> | null {
  if (legacy['version'] !== 2) return null;
  return {
    ...legacy,
    version: 3,
    army: {},
    frontline: { tier: 1, wins: 0, totalWins: 0, pendingCounterattack: false, scouted: [] },
    defenseLog: [],
    shieldUntil: 0,
    lastRaid: null,
  };
}

/** Schema 3 towns predate factions: everyone was fighting the USA war. */
function migrateV3(legacy: Record<string, unknown>): Record<string, unknown> | null {
  if (legacy['version'] !== 3) return null;
  return { ...legacy, version: 4, faction: 'usa' };
}

/**
 * Schema 4 towns predate Intel and research. Beyond the new fields, missions
 * cleared before v0.4 must re-grant their unlocks — the campaigns gained new
 * requisition keys (the Signals Station) that old saves never received.
 */
function migrateV4(legacy: Record<string, unknown>): Record<string, unknown> | null {
  if (legacy['version'] !== 4) return null;
  const town: Record<string, unknown> = {
    ...legacy,
    version: 5,
    intel: 0,
    research: { completed: [], active: null },
  };
  const faction: FactionId = town['faction'] === 'china' ? 'china' : 'usa';
  const completed = Array.isArray(town['campaign'])
    ? []
    : ((town['campaign'] as { completed?: string[] })?.completed ?? []);
  const unlocked = new Set(Array.isArray(town['unlocked']) ? (town['unlocked'] as string[]) : []);
  for (const mission of campaignFor(faction)) {
    if (completed.includes(mission.id)) {
      for (const key of mission.unlocks) unlocked.add(key);
    }
  }
  town['unlocked'] = [...unlocked];
  return town;
}

/**
 * Schema 5 towns predate leagues. A save with a war behind it should not be
 * dropped at the bottom of a board it has been fighting on for weeks, so the
 * standing is seeded from the rungs it has already cleared — generously, but
 * capped well below the top band, which still has to be earned on the clock.
 */
function migrateV5(legacy: Record<string, unknown>): Record<string, unknown> | null {
  if (legacy['version'] !== 5) return null;
  const at = typeof legacy['lastSeen'] === 'number' ? (legacy['lastSeen'] as number) : 0;
  const frontline = (legacy['frontline'] ?? {}) as Record<string, unknown>;
  const totalWins = typeof frontline['totalWins'] === 'number' ? frontline['totalWins'] : 0;
  const seeded = Math.min(LEAGUES[2]!.floor, Math.max(0, Math.round(totalWins * 12)));
  return {
    ...legacy,
    version: 6,
    frontline: {
      ...frontline,
      standing: seeded,
      peak: seeded,
      season: seasonAt(at),
      settledAt: at,
      activeAt: at,
      placements: [],
    },
  };
}

/**
 * A hand-edited or half-written file can arrive with the league block missing
 * or nonsensical. Standing is the one number that ticks down on its own, so a
 * junk timestamp in here would either freeze it or wipe it: repair the block
 * rather than reject a save over it.
 */
function normalizeLadder(town: TownState): void {
  const fl = town.frontline;
  const at = Number.isFinite(town.lastSeen) ? town.lastSeen : 0;
  const num = (value: unknown, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  fl.standing = Math.max(0, Math.round(num(fl.standing, 0)));
  fl.peak = Math.max(fl.standing, Math.round(num(fl.peak, fl.standing)));
  fl.season = Math.round(num(fl.season, seasonAt(at)));
  fl.settledAt = num(fl.settledAt, at);
  fl.activeAt = num(fl.activeAt, at);
  fl.placements = Array.isArray(fl.placements)
    ? fl.placements
        .filter((p) => p !== null && typeof p === 'object' && typeof p.season === 'number')
        .slice(0, PLACEMENT_CAP)
    : [];
}

export function deserialize(json: string): TownState | null {
  try {
    const data = JSON.parse(json) as { schema?: number; town?: TownState };
    if (!data.town) return null;

    // Walk the migration chain by the town's own version field.
    let raw = data.town as unknown as Record<string, unknown>;
    if (raw['version'] === 1) raw = migrateV1(raw) ?? raw;
    if (raw['version'] === 2) raw = migrateV2(raw) ?? raw;
    if (raw['version'] === 3) raw = migrateV3(raw) ?? raw;
    if (raw['version'] === 4) raw = migrateV4(raw) ?? raw;
    if (raw['version'] === 5) raw = migrateV5(raw) ?? raw;
    if (raw['version'] !== 6) return null;
    const town = raw as unknown as TownState;

    if (
      town.faction !== 'usa' &&
      town.faction !== 'china' &&
      town.faction !== 'russia' &&
      town.faction !== 'nk' &&
      town.faction !== 'un'
    ) {
      town.faction = 'usa';
    }
    if (typeof town.intel !== 'number' || !Number.isFinite(town.intel)) town.intel = 0;
    if (!town.research) town.research = { completed: [], active: null };
    if (!isStandingOrdersId(town.standingOrders)) town.standingOrders = null;
    // The duel ledger arrived in v1.2; older files simply have not fought one.
    town.duels = Array.isArray(town.duels)
      ? town.duels.filter((d: unknown): d is string => typeof d === 'string').slice(-50)
      : [];
    if (!Array.isArray(town.structures) || !Array.isArray(town.walls)) return null;
    if (!town.structures.some((s) => s.kind === 'cc')) return null;
    if (!town.campaign || !Array.isArray(town.unlocked)) return null;
    if (!town.frontline || typeof town.army !== 'object') return null;
    normalizeLadder(town);
    return town;
  } catch {
    return null;
  }
}

export function loadTown(now: number): TownState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const town = deserialize(raw);
      if (town) return town;
    }
  } catch {
    // storage unavailable (headless, privacy mode): fall through to a new town
  }
  return newTown(now);
}

export function saveTown(town: TownState): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(town));
  } catch {
    // storage unavailable: play on without persistence
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/** Browser-only: hands the player their save as a downloaded JSON file. */
export function downloadSave(town: TownState): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([serialize(town)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'lastline-save.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Browser-only: file-picker import. Resolves null if unreadable/invalid. */
export function pickAndImportSave(): Promise<TownState | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(deserialize(String(reader.result ?? '')));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}
