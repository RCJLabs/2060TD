import { describe, expect, it } from 'vitest';
import { yardTown } from './helpers';
import { campaignFor, defenseCatalogFor } from '../src/content/factions';
import {
  applySiegeResult,
  counterattackConfig,
  defenseConfig,
  lastStandConfig,
  missionConfig,
  outcomeFromEngine,
  probeConfig,
  siegeConfig,
  unlockAll,
  type TownState,
} from '../src/meta/town';
import { Engine } from '../src/sim/engine';

/**
 * Powers in a live siege run on one clock (M35 Phase 2): CP and a cooldown.
 * The charges a town stocks with fuel are for raids, where they are the only
 * way to call fire, and a siege leaves them where they were.
 */

const T0 = Date.UTC(2026, 5, 1, 12);

function stocked(): TownState {
  const town = unlockAll(yardTown(T0));
  town.charges = { a10: 2, arty: 1 };
  return town;
}

describe('powers in a live siege', () => {
  it('carry none of the town’s charges, in every battle the commander fights in person', () => {
    const town = stocked();
    const mission = campaignFor(town.faction)[0]!;
    for (const config of [
      siegeConfig(town, 1),
      counterattackConfig(town, 2),
      defenseConfig(town, 5, 3),
      lastStandConfig(town, 8, 4),
      missionConfig(town, mission, 5),
    ]) {
      expect(config.powerCharges, config.siege?.name).toBeUndefined();
    }
    // A probe is fought for an absent commander with no CP to cast with; it
    // keeps the stock it always carried.
    expect(probeConfig(town, 3, 6).powerCharges).toEqual({ a10: 2, arty: 1 });
  });

  it('can be called by a town that has stocked nothing', () => {
    const town = unlockAll(yardTown(T0));
    expect(town.charges).toEqual({ a10: 0, arty: 0 });
    const engine = new Engine(siegeConfig(town, 7), defenseCatalogFor(town.faction));
    engine.enqueue({ tick: 0, type: 'startAssault' });
    engine.step();
    engine.cp = 150;
    expect(engine.canCastPower('a10')).toBe(true);
    expect(engine.powerChargesLeft('a10')).toBeNull();
  });

  it('leave the town’s stock where it was', () => {
    const town = stocked();
    const engine = new Engine(siegeConfig(town, 8), defenseCatalogFor(town.faction));
    engine.enqueue({ tick: 0, type: 'startAssault' });
    engine.step();
    engine.cp = 150;
    engine.command({ type: 'castPower', kind: 'a10', target: { x: 5, y: 4 } });
    const events = engine.step();
    expect(events.some((e) => e.type === 'powerCast')).toBe(true);
    applySiegeResult(town, outcomeFromEngine(engine), T0 + 60_000);
    expect(town.charges).toEqual({ a10: 2, arty: 1 });
  });
});
