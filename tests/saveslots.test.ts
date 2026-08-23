import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeSlot,
  clearSave,
  clearSlot,
  loadTown,
  readSlot,
  resetSlotCache,
  saveSlot,
  saveTown,
  serialize,
  setActiveSlot,
  slotKey,
  downloadSave,
  SAVE_FILENAME,
  SAVE_KEY,
  SLOT_COUNT,
} from '../src/meta/save';
import { newTown, type TownState } from '../src/meta/town';
import type { FactionId } from '../src/content/factions';

const T0 = Date.UTC(2026, 2, 10, 12);

/** Minimal localStorage, since the meta layer is tested outside a browser. */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>)['localStorage'] = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

/** A town only counts as a war once a faction and difficulty are chosen. */
const war = (faction: FactionId = 'usa'): TownState => {
  const town = newTown(T0, faction);
  town.campaign.difficulty = 'standard';
  return town;
};

let store: Map<string, string>;
beforeEach(() => {
  store = installStorage();
  resetSlotCache();
});

describe('save slots', () => {
  it('keeps slot 1 on the original key, so nobody loses a war to the upgrade', () => {
    expect(slotKey(1)).toBe(SAVE_KEY);
    expect(slotKey(2)).not.toBe(SAVE_KEY);
    expect(slotKey(3)).not.toBe(slotKey(2));

    // A file written before slots existed is simply war 1.
    store.set(SAVE_KEY, serialize(war('russia')));
    expect(readSlot(1)?.faction).toBe('russia');
  });

  it('holds three wars at once without them touching each other', () => {
    saveSlot(1, war('usa'));
    saveSlot(2, war('china'));
    saveSlot(3, war('nk'));

    expect(readSlot(1)?.faction).toBe('usa');
    expect(readSlot(2)?.faction).toBe('china');
    expect(readSlot(3)?.faction).toBe('nk');

    clearSlot(2);
    expect(readSlot(2)).toBeNull();
    expect(readSlot(1)?.faction).toBe('usa'); // the neighbours are untouched
    expect(readSlot(3)?.faction).toBe('nk');
  });

  it('reads an unstarted run as an empty slot, not as a war', () => {
    // TownScene saves as soon as it has a town, so abandoning the faction
    // pick leaves a difficulty-less husk behind. That is not a war.
    const husk = newTown(T0);
    expect(husk.campaign.difficulty).toBeNull();
    saveSlot(2, husk);
    expect(store.has(slotKey(2))).toBe(true);
    expect(readSlot(2)).toBeNull();
  });

  it('survives junk in a slot instead of throwing on the menu', () => {
    store.set(slotKey(3), 'not json at all');
    expect(readSlot(3)).toBeNull();
  });

  it('remembers which war is open, and refuses a slot that does not exist', () => {
    expect(activeSlot()).toBe(1); // nothing stored yet
    setActiveSlot(2);
    expect(activeSlot()).toBe(2);

    resetSlotCache(); // as if the page had been reloaded
    expect(activeSlot()).toBe(2);

    setActiveSlot(99);
    expect(activeSlot()).toBe(SLOT_COUNT);
    setActiveSlot(-4);
    expect(activeSlot()).toBe(1);
    setActiveSlot(Number.NaN);
    expect(activeSlot()).toBe(1);
  });

  it('sends the unqualified save/load calls to whichever war is open', () => {
    saveSlot(1, war('usa'));
    setActiveSlot(3);

    // Slot 3 is empty, so the open war is a fresh town, not slot 1's.
    expect(loadTown(T0).campaign.difficulty).toBeNull();

    const china = war('china');
    china.supplies = 4242;
    saveTown(china);
    expect(readSlot(3)?.supplies).toBe(4242);
    expect(readSlot(1)?.faction).toBe('usa');

    clearSave();
    expect(readSlot(3)).toBeNull();
    expect(readSlot(1)?.faction).toBe('usa'); // clearSave is not a wipe-all
  });

  it('plays on without persistence when storage is unavailable', () => {
    (globalThis as Record<string, unknown>)['localStorage'] = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    resetSlotCache();
    expect(activeSlot()).toBe(1);
    expect(() => setActiveSlot(2)).not.toThrow();
    expect(readSlot(1)).toBeNull();
    expect(() => saveTown(war())).not.toThrow();
    expect(loadTown(T0).campaign.difficulty).toBeNull(); // a fresh town
  });
});

/**
 * Exporting the campaign file (v1.17.1). The game runs in two kinds of page and
 * only one of them can be handed a file by a link: the claude.ai artifact
 * viewer grants a page no download permission at all, so the anchor route is
 * silently inert there. These cover the fork, including the outcomes the old
 * version could not tell apart — a save, a refusal, and a dead link.
 */
describe('exporting the campaign file', () => {
  const town = () => newTown(T0, 'usa');
  /** A minimal document that records the anchor an export would have clicked. */
  function installDocument(): { clicks: { href: string; download: string }[] } {
    const clicks: { href: string; download: string }[] = [];
    (globalThis as Record<string, unknown>)['document'] = {
      createElement: () => {
        const a = { href: '', download: '', click: () => clicks.push({ href: a.href, download: a.download }) };
        return a;
      },
    };
    (globalThis as Record<string, unknown>)['Blob'] = class {
      constructor(public parts: string[]) {}
    };
    (globalThis as Record<string, unknown>)['URL'] = {
      createObjectURL: () => 'blob:save',
      revokeObjectURL: () => undefined,
    };
    return { clicks };
  }
  const clearHost = () => {
    delete (globalThis as Record<string, unknown>)['claude'];
    delete (globalThis as Record<string, unknown>)['document'];
  };

  beforeEach(clearHost);

  it('falls back to a download link in an ordinary browser', async () => {
    const { clicks } = installDocument();
    await expect(downloadSave(town())).resolves.toBe('saved');
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.download).toBe(SAVE_FILENAME);
    clearHost();
  });

  it('goes through the viewer when the page has been granted saves', async () => {
    installDocument();
    const offered: { filename: string; data: string }[] = [];
    (globalThis as Record<string, unknown>)['claude'] = {
      use: (name: string) =>
        Promise.resolve(
          name === 'downloads'
            ? {
                save: (r: { filename: string; data: string }) => {
                  offered.push(r);
                  return Promise.resolve({ status: 'saved' });
                },
              }
            : null,
        ),
    };
    await expect(downloadSave(town())).resolves.toBe('saved');
    expect(offered).toHaveLength(1);
    expect(offered[0]!.filename).toBe(SAVE_FILENAME);
    // What is offered is the save itself, readable back as one.
    expect(JSON.parse(offered[0]!.data)).toMatchObject({ town: { version: 6 } });
    clearHost();
  });

  it('tells a refusal apart from a failure', async () => {
    installDocument();
    const refuse = (code: string) => {
      (globalThis as Record<string, unknown>)['claude'] = {
        use: () => Promise.resolve({ save: () => Promise.reject({ code }) }),
      };
      return downloadSave(town());
    };
    await expect(refuse('declined')).resolves.toBe('declined');
    await expect(refuse('rate_limited')).resolves.toBe('declined');
    await expect(refuse('too_large')).resolves.toBe('unavailable');
    clearHost();
  });

  it('uses the anchor when the viewer serves no saves at all', async () => {
    // use() resolving null is the documented "not served here" answer, and it
    // is indistinguishable from not granted — so the page just takes the other
    // road rather than trying to work out which.
    const { clicks } = installDocument();
    (globalThis as Record<string, unknown>)['claude'] = { use: () => Promise.resolve(null) };
    await expect(downloadSave(town())).resolves.toBe('saved');
    expect(clicks).toHaveLength(1);
    clearHost();
  });

  it('carries the game\'s name, not the save key\'s', async () => {
    // SAVE_KEY is an address and keeps its old name forever; a FILENAME is a
    // label on something the player will look at in a folder.
    expect(SAVE_FILENAME).toContain('2060td');
    expect(SAVE_KEY).toContain('lastline');
  });
});
