import { describe, expect, it } from 'vitest';
import { generateBase } from '../src/content/bases';
import {
  conditionAfter,
  conditionAt,
  conditionEndsAt,
  CONDITIONS,
  CONDITION_BY_ID,
  CONDITION_MS,
  type ConditionId,
} from '../src/content/conditions';
import { DAY_MS, LADDER_EPOCH } from '../src/content/leagues';
import { trainableFor } from '../src/content/factions';
import { GARRISON_GUN_TRADE } from '../src/content/garrison';
import { scoutingBlocked } from '../src/meta/ladder';
import { newTown, unlockAll, type TownState } from '../src/meta/town';
import {
  isScouted,
  raidConfig,
  resolveRaid,
  scoutTarget,
  type SquadPlan,
} from '../src/meta/warfare';

const T0 = Date.UTC(2026, 2, 10, 12);

const devTown = (): TownState => {
  const town = unlockAll(newTown(T0));
  town.intel = 10_000;
  return town;
};

describe('the rotation', () => {
  it('turns over once a day, on a schedule anyone can compute', () => {
    expect(CONDITION_MS).toBe(DAY_MS);
    const today = conditionAt(T0);
    expect(conditionAt(T0 + 60_000)).toBe(today); // same day, same front
    expect(conditionAt(T0 + DAY_MS)).toBe(conditionAfter(T0));
    expect(conditionAt(conditionEndsAt(T0))).toBe(conditionAfter(T0));
    expect(conditionEndsAt(T0) - T0).toBeLessThanOrEqual(DAY_MS);
    expect(conditionEndsAt(T0)).toBeGreaterThan(T0);
  });

  it('walks the whole pool before repeating, and never lands on a weekday cycle', () => {
    const walk: ConditionId[] = [];
    for (let day = 0; day < CONDITIONS.length; day++) {
      walk.push(conditionAt(LADDER_EPOCH + day * DAY_MS).id);
    }
    expect(new Set(walk).size).toBe(CONDITIONS.length);
    expect(conditionAt(LADDER_EPOCH + CONDITIONS.length * DAY_MS).id).toBe(walk[0]);
    // A seven-long pool would pin every condition to one weekday forever.
    expect(CONDITIONS.length).not.toBe(7);
  });

  it('survives a clock set before the epoch', () => {
    for (const back of [1, 5, 400]) {
      const when = LADDER_EPOCH - back * DAY_MS;
      const condition = conditionAt(when);
      expect(CONDITIONS).toContain(condition);
      expect(conditionEndsAt(when)).toBeGreaterThan(when);
    }
  });
});

describe('the trade', () => {
  it('never offers a free lunch: the easy days pay less', () => {
    /**
     * Measured clear% against the reference strike force, easiest first —
     * see `npm run balance -- --conditions`. BLACKOUT reads as neutral there
     * because the harness always fights with the layout in hand; its real
     * cost is planning blind, which no headless matrix can see.
     */
    const byDifficulty: ConditionId[] = [
      'hardrain', 'clearline', 'blackout', 'attrition', 'fuelcrisis', 'dugin',
    ];
    expect(new Set(byDifficulty).size).toBe(CONDITIONS.length);
    for (let i = 1; i < byDifficulty.length; i++) {
      const harder = CONDITION_BY_ID[byDifficulty[i]!];
      const easier = CONDITION_BY_ID[byDifficulty[i - 1]!];
      expect(
        harder.standing,
        `${harder.label} is harder than ${easier.label} and must not pay less`,
      ).toBeGreaterThanOrEqual(easier.standing);
    }
  });

  it('keeps every multiplier sane and every day described', () => {
    for (const condition of CONDITIONS) {
      expect(condition.standing).toBeGreaterThan(0);
      expect(condition.loot.supplies).toBeGreaterThan(0);
      expect(condition.loot.fuel).toBeGreaterThan(0);
      expect(condition.effect.length).toBeGreaterThan(4);
      expect(condition.blurb.length).toBeGreaterThan(10);
      // Panel rows wrap since v1.13, so this cap is no longer about the
      // drawer's width — it is editorial. A summary the player has to READ is
      // not a summary, and the prose belongs in `blurb`, which has an
      // overlay to itself.
      expect(condition.effect.length, condition.effect).toBeLessThanOrEqual(64);
      expect(condition.pay.length, condition.pay).toBeLessThanOrEqual(64);
      expect(CONDITION_BY_ID[condition.id]).toBe(condition);
    }
    // Exactly one neutral day, and it is the one with no modifiers at all.
    const neutral = CONDITIONS.filter((c) => !c.attacker && !c.defender && !c.blackout);
    expect(neutral).toHaveLength(1);
    expect(neutral[0]!.standing).toBe(1);
  });
});

describe('conditions in the battle', () => {
  const plan: SquadPlan[] = [
    { units: { abrams: 2, ranger: 3 }, sector: 'W1', doctrine: 'assault' },
  ];

  it('lands the day on the target and stacks the weather onto research', () => {
    const base = generateBase(2, 0);
    const dugIn = CONDITION_BY_ID.dugin;
    const config = raidConfig(base, plan, 7, trainableFor('usa'), {
      mods: { hp: 1.1, damage: 1.2 },
      condition: CONDITION_BY_ID.fuelcrisis,
    });
    // Research and the weather multiply; they do not overwrite each other.
    expect(config.mods?.attacker?.hp).toBeCloseTo(1.1 * 0.9, 6);
    expect(config.mods?.attacker?.damage).toBeCloseTo(1.2 * 0.85, 6);

    const hard = raidConfig(base, plan, 7, trainableFor('usa'), { condition: dugIn });
    expect(hard.mods?.defender?.wallHp).toBe(dugIn.defender?.wallHp);
    // The day's weather multiplies onto the garrison's standing trade (v1.20)
    // rather than replacing it: a post that is DUG IN still paid a fifth of
    // its gun coverage for the reserve it is about to spend.
    expect(hard.mods?.defender?.weaponDamage).toBeCloseTo(
      (dugIn.defender?.weaponDamage ?? 1) * GARRISON_GUN_TRADE,
      6,
    );
    expect(hard.mods?.attacker).toBeUndefined(); // DUG IN does nothing to your units
  });

  it('leaves a plain raid byte-identical to one with no rotation at all', () => {
    const base = generateBase(2, 1);
    const bare = raidConfig(base, plan, 11, trainableFor('usa'), {});
    const clear = raidConfig(base, plan, 11, trainableFor('usa'), {
      condition: CONDITION_BY_ID.clearline,
    });
    expect(clear).toEqual(bare);
    // Not `undefined` any more: since v1.20 every raided post carries the
    // garrison's price on its guns, whatever the rotation is doing. A CLEAR
    // LINE day is still the identity — it just is not the identity of NOTHING.
    expect(bare.mods?.attacker).toBeUndefined();
    expect(bare.mods?.defender).toEqual({
      weaponDamage: GARRISON_GUN_TRADE,
      wallHp: 1,
      cpCost: 1,
    });
  });

  it('changes the battle, not just the paperwork', () => {
    // One seed of one base is noise: a condition is a multiplier, so it shows
    // up in the average the way the balance harness reads it, not in a single
    // fight that happened to break the same way.
    const force: SquadPlan[] = [
      { units: { abrams: 1, ranger: 1 }, sector: 'W1', doctrine: 'assault' },
      { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt' },
      { units: { ranger: 2, engineer: 1, humvee: 1 }, sector: 'S1', doctrine: 'raze' },
    ];
    const meanDestruction = (id: ConditionId | null): number => {
      let total = 0;
      let runs = 0;
      // Forced shapes, not the deal (v1.21). DUG IN thickens WALLS and guns,
      // so it can only be seen on a base that has some — and which shapes a
      // rung deals now depends on the faction, which this test is not about.
      // Taking whatever the deal offered is how this broke: the T4 draw came
      // up light on wire and a +45% wall multiplier changed nothing at all.
      for (const shape of ['compound', 'corridor', 'keep'] as const) {
        const base = generateBase(4, 0, undefined, shape);
        for (let seed = 0; seed < 6; seed++) {
          const config = raidConfig(base, force, 4242 + seed * 7919, trainableFor('usa'), {
            ...(id ? { condition: CONDITION_BY_ID[id] } : {}),
          });
          total += resolveRaid(config, force, 4).destructionPct;
          runs++;
        }
      }
      return total / runs;
    };

    const bare = meanDestruction(null);
    expect(meanDestruction(null)).toBe(bare); // deterministic, condition or not
    expect(meanDestruction('clearline')).toBe(bare);
    expect(meanDestruction('dugin')).toBeLessThan(bare);
    expect(meanDestruction('hardrain')).toBeGreaterThan(bare);
  });

  it('scales the loot the wreckage is worth', () => {
    const base = generateBase(2, 0);
    const config = raidConfig(base, plan, 31, trainableFor('usa'), {});
    const flat = resolveRaid(config, plan, 2);
    const rich = resolveRaid(config, plan, 2, undefined, { supplies: 2, fuel: 3 });
    expect(rich.destroyed).toEqual(flat.destroyed); // the battle is untouched
    expect(rich.loot.supplies).toBe(Math.round(flat.loot.supplies * 2));
    expect(rich.loot.fuel).toBe(Math.round(flat.loot.fuel * 3));
  });
});

describe('blackout', () => {
  const blackoutDay = (): number => {
    for (let day = 0; day < CONDITIONS.length; day++) {
      const when = LADDER_EPOCH + day * DAY_MS;
      if (conditionAt(when).blackout) return when;
    }
    throw new Error('no blackout in the rotation');
  };

  it('refuses recon at any price, and only on its own day', () => {
    const dark = blackoutDay();
    expect(scoutingBlocked(dark)).toBe(true);
    expect(scoutingBlocked(dark + DAY_MS)).toBe(false);

    const town = devTown();
    town.frontline.tier = 2;
    const intel = town.intel;
    expect(scoutTarget(town, 2, 0, dark)).toBe(false);
    expect(isScouted(town, 2, 0)).toBe(false);
    expect(town.intel).toBe(intel); // a refused buy costs nothing

    expect(scoutTarget(town, 2, 0, dark + DAY_MS)).toBe(true);
    expect(isScouted(town, 2, 0)).toBe(true);
    expect(town.intel).toBeLessThan(intel);
  });

  it('still honours a layout bought before the lights went out', () => {
    const dark = blackoutDay();
    const town = devTown();
    town.frontline.tier = 1;
    expect(scoutTarget(town, 1, 0, dark - DAY_MS)).toBe(true);
    // Yesterday's picture does not go dark with today's signals.
    expect(scoutTarget(town, 1, 0, dark)).toBe(true);
    expect(isScouted(town, 1, 0)).toBe(true);
  });

  it('carries no sim modifiers — the fog IS the condition', () => {
    const blackout = CONDITIONS.find((c) => c.blackout)!;
    expect(blackout.attacker).toBeUndefined();
    expect(blackout.defender).toBeUndefined();
  });
});
