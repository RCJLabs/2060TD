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
