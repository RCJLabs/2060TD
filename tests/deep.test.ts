import { describe, expect, it } from 'vitest';
import {
  DEAL_TABLE,
  TARGETS_PER_TIER,
  dealPairFor,
  generateBase,
  type DealPair,
} from '../src/content/bases';
import { baseKitFor, FACTION_IDS } from '../src/content/factions';
import { strongholdTier, theaterFor } from '../src/content/theaters';

/**
 * M25 Phase 4a: the deep rungs are chosen, not inherited.
 *
 * Until Phase 4a the deal ended at rung 5, and every rung past it was rung 5's
 * pairs with the layouts moved on, which `--deep` measured as a climb that
 * spiked past what a built town can field. The rows for rungs 6 to 13 are
 * selected now, by `--deeplayouts`, against a force that grows four men a rung.
 */

const STRONGHOLD = strongholdTier(theaterFor('usa'));

describe('the deep deal', () => {
  it('reaches the enemy stronghold for every faction', () => {
    expect(STRONGHOLD).toBe(13);
    for (const faction of FACTION_IDS) {
      expect(DEAL_TABLE[faction], faction).toHaveLength(STRONGHOLD);
    }
  });

  it('deals three different shapes on every deep rung', () => {
    for (const faction of FACTION_IDS) {
      for (let tier = 6; tier <= STRONGHOLD; tier++) {
        const shapes = Array.from({ length: TARGETS_PER_TIER }, (_, slot) => dealPairFor(tier, slot, faction)![0]);
        expect(new Set(shapes).size, `${faction} T${tier}: ${shapes.join(', ')}`).toBe(TARGETS_PER_TIER);
      }
    }
  });

  it('builds each deep post as its row says', () => {
    for (const faction of FACTION_IDS) {
      for (let tier = 6; tier <= STRONGHOLD; tier++) {
        for (let slot = 0; slot < TARGETS_PER_TIER; slot++) {
          const [shape] = dealPairFor(tier, slot, faction)!;
          const base = generateBase(tier, slot, baseKitFor(faction), undefined, faction);
          expect(base.archetype, `${faction} T${tier} slot ${slot}`).toBe(shape);
          expect(base.tier).toBe(tier);
        }
      }
    }
  });

  it('past the stronghold, keeps its shapes and moves the layouts on', () => {
    for (const faction of FACTION_IDS) {
      const top = DEAL_TABLE[faction]![STRONGHOLD - 1]!;
      for (let past = 1; past <= 3; past++) {
        for (let slot = 0; slot < TARGETS_PER_TIER; slot++) {
          const [shape, layout] = top[slot] as DealPair;
          expect(dealPairFor(STRONGHOLD + past, slot, faction), `${faction} rear ${past}`).toEqual([
            shape,
            layout + past * TARGETS_PER_TIER,
          ]);
        }
      }
    }
  });
});
