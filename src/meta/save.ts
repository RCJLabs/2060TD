import { newTown, unlockAll, type TownState } from './town';

/**
 * Versioned save persistence: localStorage autosave plus export/import as a
 * JSON file. Schema 1 (M2, pre-campaign) saves migrate forward on load.
 */

export const SAVE_KEY = 'lastline_save_v1';
export const SCHEMA = 3;

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
function migrateV2(legacy: Record<string, unknown>): TownState | null {
  if (legacy['version'] !== 2) return null;
  return {
    ...legacy,
    version: 3,
    army: {},
    frontline: { tier: 1, wins: 0, totalWins: 0, pendingCounterattack: false, scouted: [] },
    defenseLog: [],
    shieldUntil: 0,
    lastRaid: null,
  } as unknown as TownState;
}

export function deserialize(json: string): TownState | null {
  try {
    const data = JSON.parse(json) as { schema?: number; town?: TownState };
    if (!data.town) return null;

    let raw: Record<string, unknown> | null = data.town as unknown as Record<string, unknown>;
    if (data.schema === 1) raw = migrateV1(raw);
    let town: TownState | null = null;
    if (raw && (raw['version'] === 2 || data.schema === 2)) {
      town = migrateV2(raw);
    } else if (raw && raw['version'] === 3 && data.schema === SCHEMA) {
      town = raw as unknown as TownState;
    }
    if (!town) return null;

    if (!Array.isArray(town.structures) || !Array.isArray(town.walls)) return null;
    if (!town.structures.some((s) => s.kind === 'cc')) return null;
    if (!town.campaign || !Array.isArray(town.unlocked)) return null;
    if (!town.frontline || typeof town.army !== 'object') return null;
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
