import { describe, expect, it } from 'vitest';
import { generateBase } from '../src/content/bases';
import { baseKitFor, raidCatalogFor, trainableFor } from '../src/content/factions';
import {
  GARRISON_GUN_TRADE,
  GARRISON_RESERVE_KINDS,
  garrisonById,
  garrisonFor,
  isGarrisonId,
} from '../src/content/garrison';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';
import { Engine } from '../src/sim/engine';
import type { SimConfig } from '../src/sim/types';

/**
 * The garrison and the gun trade (v1.20) — two fixes for two different faults,
 * guarded separately because they are separately reversible.
 *
 * v1.19 had both. A base with every wall stripped out was EASIER to hold than
 * the same base fortified — the wall line was worth -5.2 TO THE ATTACKER —
 * and separately, nothing in a raid charged for time, so route length and
 * breaching bought the defender nothing at all.
 *
 * `GARRISON_GUN_TRADE` fixes the first and the garrison fixes the second, and
 * it took an isolating control to see that. The first draft of this file
 * moved both at once and PASSED with the garrison deleted, which is exactly
 * the failure it was written to catch. Every test below moves one thing.
 */

const PLAN: SquadPlan[] = [
  { units: { abrams: 1, ranger: 1 }, sector: 'W1', doctrine: 'assault' },
  { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt' },
  { units: { ranger: 2, engineer: 1, humvee: 1 }, sector: 'S1', doctrine: 'raze' },
];
const KIT = baseKitFor('usa');
const CATALOG = raidCatalogFor('usa');
const TRAINABLE = trainableFor('usa');
const seedOf = (a: number, b: number, c: number): number =>
  (a * 7919 + b * 104729 + c * 1299709) >>> 0;

const squads = (): SquadPlan[] => PLAN.map((s, at) => ({ ...s, slot: at }));

/** Mean clear rate over the ladder, with the config bent by `tweak`. */
function clearRate(tweak: (c: SimConfig) => SimConfig, seeds = 8): number {
  let cleared = 0;
  let runs = 0;
  for (const tier of [1, 2, 3, 4, 5]) {
    for (let variant = 0; variant < 3; variant++) {
      const base = generateBase(tier, variant, KIT);
      for (let i = 0; i < seeds; i++) {
        const config = tweak(raidConfig(base, squads(), seedOf(tier, variant, i), TRAINABLE));
        if (resolveRaid(config, squads(), tier, CATALOG).cleared) cleared++;
        runs++;
      }
    }
  }
  return (cleared / runs) * 100;
}

const strip = (c: SimConfig): SimConfig => ({ ...c, layout: { ...c.layout!, walls: [] } });

describe('the garrison holds the base', () => {
  it('is wired into every raid, cold, at the rate a siege runs on', () => {
    const base = generateBase(3, 0, KIT);
    const config = raidConfig(base, squads(), 1, TRAINABLE);
    expect(config.garrison).toBeDefined();
    // Asleep when you cross the line: arriving early means arriving before
    // the reserve exists at all.
    expect(config.siege?.startingCp).toBe(0);
    expect(config.siege?.cpPerSecond).toBeGreaterThan(0);
    expect(config.siege?.cpCap).toBeGreaterThan(config.siege!.startingCp);
  });

  it('can actually build what its doctrine calls for', () => {
    // The bug this pins: raid catalogs hold what a base is MADE of, and the
    // reserve kinds live in the DEFENDER's catalog. A doctrine naming a kind
    // the catalog lacks fails silently — the garrison spends the whole battle
    // wanting to act and never once managing it.
    const config = raidConfig(generateBase(3, 0, KIT), squads(), 1, TRAINABLE);
    for (const rule of config.garrison!.rules) {
      expect(CATALOG.structures[rule.kind], `catalog is missing '${rule.kind}'`).toBeDefined();
      expect(CATALOG.structures[rule.kind]!.cpCost).toBeGreaterThan(0);
    }
    for (const kind of GARRISON_RESERVE_KINDS) {
      expect(CATALOG.structures[kind], `reserve is missing '${kind}'`).toBeDefined();
    }
  });

  it('spends Command Points to do it, and stops at its ceiling', () => {
    const base = generateBase(4, 1, KIT);
    const config = raidConfig(base, squads(), 99, TRAINABLE);
    const engine = new Engine(config, CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 6000) {
      engine.step();
    }
    expect(engine.ordersExecuted).toBeGreaterThan(0); // it did something
    expect(engine.ordersExecuted).toBeLessThanOrEqual(config.garrison!.maxActions!);
    expect(engine.stats.cpSpent).toBeGreaterThan(0); // and paid for it
  });

  it('never acts for the side the player is holding', () => {
    // `garrison` is the AI's book and `standingOrders` is the player's; the
    // two must never both be in force, or a defending player would find their
    // own base being reinforced by somebody else's doctrine.
    const config = raidConfig(generateBase(2, 0, KIT), squads(), 5, TRAINABLE);
    const asDefender: SimConfig = { ...config, playerSide: 'defender' };
    const engine = new Engine(asDefender, CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    for (let i = 0; i < 1200; i++) engine.step();
    expect(engine.ordersExecuted).toBe(0);
    expect(engine.garrisonReadiness()).toBeNull(); // no standingOrders either
  });

  it('refuses to call fire missions, because they would land on its own base', () => {
    // Not a matter of taste: `resolvePowers` reads `attackerSide` to decide
    // whether an impact hits units or structures, so a garrison barrage would
    // shell the post it is defending.
    const base = generateBase(3, 2, KIT);
    const config: SimConfig = {
      ...raidConfig(base, squads(), 7, TRAINABLE),
      garrison: {
        id: 'standto',
        maxActions: 6,
        rules: [
          { cpAtLeast: 1, action: 'power', kind: 'a10', target: 'densest', cooldownTicks: 20 },
        ],
      },
    };
    const engine = new Engine(config, CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    const before = engine.structures.length;
    for (let i = 0; i < 1600; i++) engine.step();
    expect(engine.ordersExecuted).toBe(0);
    // Nothing of the base's own was blown up by its own duty officer.
    expect(engine.structures.length).toBeLessThanOrEqual(before);
  });

  it('reports readiness the HUD can count down from', () => {
    const config = raidConfig(generateBase(3, 0, KIT), squads(), 3, TRAINABLE);
    const engine = new Engine(config, CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    engine.step();
    const cold = engine.garrisonReadiness();
    expect(cold).not.toBeNull();
    expect(cold!.committed).toBe(0);
    expect(cold!.ceiling).toBe(config.garrison!.maxActions);
    // Cold, the pool is below the cheapest order and climbing towards it.
    expect(cold!.nextAt).not.toBeNull();
    expect(cold!.cp).toBeLessThan(cold!.nextAt!);
    for (let i = 0; i < 400; i++) engine.step();
    expect(engine.garrisonReadiness()!.cp).toBeGreaterThan(cold!.cp);
  });

  it('announces each reserve as it lands', () => {
    const config = raidConfig(generateBase(4, 1, KIT), squads(), 99, TRAINABLE);
    const engine = new Engine(config, CATALOG);
    engine.enqueue({ tick: 0, type: 'startAssault' });
    let announced = 0;
    while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 6000) {
      for (const event of engine.step()) if (event.type === 'garrisonDeployed') announced++;
    }
    expect(announced).toBe(engine.ordersExecuted);
  });
});

/** Standing gun damage forced to a value, with everything else left alone. */
const guns = (mult: number) => (c: SimConfig): SimConfig => ({
  ...c,
  mods: { ...c.mods, defender: { ...c.mods?.defender, weaponDamage: mult } },
});
/** No watch and no economy — but the guns are left exactly as passed in. */
const noWatch = (c: SimConfig): SimConfig => ({
  ...c,
  garrison: undefined,
  siege: { ...c.siege!, cpPerSecond: 0, cpCap: 1 },
});

describe('what the wall line is worth', () => {
  /**
   * The headline finding, guarded — and guarded with ONE variable moving.
   *
   * An earlier version of this test moved the garrison and the gun trade
   * together and passed with the garrison deleted, which is precisely the
   * failure it existed to catch. The wall line is earned by
   * `GARRISON_GUN_TRADE`, not by the garrison, and the three cases below say
   * so by holding the watch off and moving only the guns.
   */
  it('was negative at v1.19 gun strength and is positive after the trade', () => {
    const oldWalls = clearRate((c) => noWatch(guns(1)(c)));
    const oldBare = clearRate((c) => noWatch(guns(1)(strip(c))));
    // v1.19: taking every wall away made the base EASIER to hold.
    expect(oldBare).toBeLessThan(oldWalls);

    const cutWalls = clearRate((c) => noWatch(guns(GARRISON_GUN_TRADE)(c)));
    const cutBare = clearRate((c) => noWatch(guns(GARRISON_GUN_TRADE)(strip(c))));
    // The gun trade alone, with no garrison anywhere near it, flips the sign.
    expect(cutBare).toBeGreaterThan(cutWalls);
  }, 30_000);

  it('is still positive in the configuration that actually ships', () => {
    expect(clearRate(strip)).toBeGreaterThan(clearRate((c) => c));
  }, 30_000);

  it('is bought with gun coverage rather than added on top', () => {
    // A change nobody pays for is a difficulty spike wearing a design's
    // clothes. Shipped against v1.19 exactly, the clear rate must barely move.
    const now = clearRate((c) => c);
    const before = clearRate((c) => noWatch(guns(1)(c)));
    expect(Math.abs(now - before)).toBeLessThan(9); // the band conditions are held to
  }, 30_000);

  it('charges the trade on every raid and composes with the weather', () => {
    const base = generateBase(2, 0, KIT);
    const plain = raidConfig(base, squads(), 11, TRAINABLE);
    expect(plain.mods?.defender?.weaponDamage).toBeCloseTo(GARRISON_GUN_TRADE, 6);
    const stormy = raidConfig(base, squads(), 11, TRAINABLE, {
      condition: {
        id: 'test',
        label: 'TEST',
        blurb: '',
        defender: { weaponDamage: 1.25 },
      } as never,
    });
    expect(stormy.mods?.defender?.weaponDamage).toBeCloseTo(1.25 * GARRISON_GUN_TRADE, 6);
  });
});

describe('what the garrison is worth', () => {
  /** The same three squads, launched together or trickled in `d` seconds apart. */
  const stagger = (d: number): SquadPlan[] =>
    PLAN.map((s, at) => ({ ...s, slot: at, delay: d * at }));

  /** Orders the watch got off, summed over a slice of the ladder. */
  function ordersUnder(plan: SquadPlan[]): number {
    let total = 0;
    for (const tier of [2, 3, 4]) {
      for (let variant = 0; variant < 3; variant++) {
        const base = generateBase(tier, variant, KIT);
        for (let i = 0; i < 4; i++) {
          const config = raidConfig(base, plan, seedOf(tier, variant, i), TRAINABLE);
          const engine = new Engine(config, CATALOG);
          engine.enqueue({ tick: 0, type: 'startAssault' });
          while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 6000) {
            engine.step();
          }
          total += engine.ordersExecuted;
        }
      }
    }
    return total;
  }

  /**
   * The claim the garrison actually earns: TIME costs something now.
   *
   * A wall can only ever spend the attacker's time, and before v1.20 a raid
   * had no economy, no reinforcement and no deadline — so dawdling was free
   * and the fortification layer had nothing to charge against. The wall-line
   * tests above deliberately do NOT stand in for this one: they are earned by
   * `GARRISON_GUN_TRADE`, and an earlier draft of this file proved that by
   * passing with the garrison deleted.
   *
   * Measured as the mechanism rather than as a clear rate, because the
   * outcome swing needs about 1200 battles a cell to rise out of the noise
   * and the mechanism needs 36. Over the ladder the balance harness reads the
   * outcome too — `npm run balance -- --garrison`.
   */
  it('gets more orders off against a slow approach than a fast one', () => {
    const fast = ordersUnder(stagger(0));
    const slow = ordersUnder(stagger(40));
    expect(fast).toBeGreaterThan(0); // it is doing something in both
    expect(slow).toBeGreaterThan(fast);
  });
});

describe('a garrison travels with the battle', () => {
  it('is the same watch for the same base every time', () => {
    const base = generateBase(3, 1, KIT);
    expect(garrisonFor(base.archetype, base.tier)).toEqual(
      garrisonFor(base.archetype, base.tier),
    );
  });

  it('round-trips through a replay code without a FORMAT bump', () => {
    const base = generateBase(3, 1, KIT);
    const config = raidConfig(base, squads(), 4242, TRAINABLE);
    const code = encodeReplay({
      kind: 'raid',
      faction: 'usa',
      title: base.name,
      won: true,
      config,
    });
    const back = decodeReplay(code);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.replay.config.garrison).toEqual(config.garrison);
    // And the battle it decodes to is the battle that was encoded.
    expect(resolveRaid(back.replay.config, squads(), 3, CATALOG).ticks).toBe(
      resolveRaid(config, squads(), 3, CATALOG).ticks,
    );
  });

  it('re-fights an unmanned base when the code predates the watch', () => {
    // A replay is a RECORD. A code written before v1.20 has no garrison block
    // and must keep re-fighting the diorama it was recorded against.
    const base = generateBase(2, 0, KIT);
    const config: SimConfig = { ...raidConfig(base, squads(), 8, TRAINABLE) };
    delete config.garrison;
    const back = decodeReplay(
      encodeReplay({ kind: 'raid', faction: 'usa', title: base.name, won: false, config }),
    );
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.replay.config.garrison).toBeUndefined();
  });

  it('rebuilds its rules from the reader, never from the code', () => {
    expect(isGarrisonId('standto')).toBe(true);
    expect(isGarrisonId('nonsense')).toBe(false);
    const rebuilt = garrisonById('redoubt', 4);
    expect(rebuilt.id).toBe('redoubt');
    expect(rebuilt.maxActions).toBe(4);
    expect(rebuilt.rules.length).toBeGreaterThan(0);
  });
});

describe('a rule can ask what it is shooting at', () => {
  /** A raid flown in: the plans the balance harness uses for its AIR rows. */
  const AIR: SquadPlan[] = [
    { units: { reaper: 2 }, sector: 'W1', doctrine: 'hunt', slot: 0 },
    { units: { reaper: 2 }, sector: 'N1', doctrine: 'assault', slot: 1 },
    { units: { ranger: 2, engineer: 1 }, sector: 'S1', doctrine: 'raze', slot: 2 },
  ];

  /** How many of `kind` the garrison managed to stand up. */
  function deployed(plan: SquadPlan[], kind: string): number {
    let total = 0;
    for (const tier of [2, 3, 4]) {
      for (let variant = 0; variant < 3; variant++) {
        const base = generateBase(tier, variant, KIT);
        for (let i = 0; i < 3; i++) {
          const config = raidConfig(base, plan, seedOf(tier, variant, i), TRAINABLE);
          const engine = new Engine(config, CATALOG);
          engine.enqueue({ tick: 0, type: 'startAssault' });
          while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 6000) {
            for (const event of engine.step()) {
              if (event.type === 'garrisonDeployed' && event.kind === kind) total++;
            }
          }
        }
      }
    }
    return total;
  }

  /**
   * The bug this exists to prevent: an AA order that fires against a purely
   * ground raid burns one of two-to-four actions on a gun with nothing to
   * shoot. `manpads` sat in the reserve unused for a whole release rather
   * than ship that, and this test is what lets it be used now.
   */
  it('holds the AA order until there is something in the air', () => {
    expect(deployed(squads(), 'manpads')).toBe(0);
    expect(deployed(AIR, 'manpads')).toBeGreaterThan(0);
  });

  it('still answers a ground push with guns rather than AA', () => {
    // The ground orders must not have been crowded out by the new rule.
    const guns = deployed(squads(), 'depmg') + deployed(squads(), 'claymore');
    expect(guns).toBeGreaterThan(0);
  });
});
