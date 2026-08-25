import { describe, expect, it } from 'vitest';
import { ARCHETYPES, generateBase } from '../src/content/bases';
import { baseKitFor, raidCatalogFor, trainableFor } from '../src/content/factions';
import {
  OBJECTIVES,
  OBJECTIVE_FLOOR,
  isObjectiveId,
  objectiveAvailable,
  quotaFor,
} from '../src/meta/objectives';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { RAID_MAX_TICKS, raidConfig, resolveRaid, type SquadPlan } from '../src/meta/warfare';

/**
 * What a raid came for (v1.24).
 *
 * The contract has two halves that pull against each other, the same shape as
 * the combat-variance one: a lesser objective has to actually end the raid
 * early and pay for itself in men, and a config that names no objective has to
 * fight exactly the raid it fought before.
 */

const CATALOG = raidCatalogFor('usa');
const KIT = baseKitFor('usa');
const seedOf = (i: number): number => ((i * 2654435761 + 977) & 0x7fffffff) >>> 0;

const hunters = (): SquadPlan[] => [
  { units: { abrams: 1, ranger: 1 }, sector: 'W1', doctrine: 'hunt', slot: 0 },
  { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt', slot: 1 },
  { units: { ranger: 2, humvee: 1 }, sector: 'S1', doctrine: 'hunt', slot: 2 },
];
const home = (r: { squads: { returned: number }[] }): number =>
  r.squads.reduce((a, s) => a + s.returned, 0);

describe('a quota is a share of what the base is holding', () => {
  it('scales with the post and never asks for more than it has', () => {
    // Proportional, because a flat count is impossible on a small base and
    // free on a large one.
    expect(quotaFor('guns', 10)).toBe(7); // round(10 * 0.65)
    expect(quotaFor('guns', 6)).toBe(4);
    expect(quotaFor('stores', 4)).toBe(3);
    // Floored, so a lightly-held post does not hand one out for nothing…
    expect(quotaFor('guns', 2)).toBe(OBJECTIVE_FLOOR);
    // …and capped, so it can never exceed what is standing.
    for (let standing = 0; standing <= 12; standing++) {
      expect(quotaFor('guns', standing)).toBeLessThanOrEqual(standing);
    }
    // The command post is not a quota at all.
    expect(quotaFor('post', 9)).toBe(0);
  });

  it('and a post that cannot offer one does not offer it', () => {
    expect(objectiveAvailable('guns', OBJECTIVE_FLOOR)).toBe(true);
    expect(objectiveAvailable('guns', OBJECTIVE_FLOOR - 1)).toBe(false);
    expect(objectiveAvailable('stores', 0)).toBe(false);
    // Taking the post is always on the table: every base has one.
    expect(objectiveAvailable('post', 0)).toBe(true);
  });

  it('and only the three are objectives', () => {
    expect(isObjectiveId('post')).toBe(true);
    expect(isObjectiveId('guns')).toBe(true);
    expect(isObjectiveId('stores')).toBe(true);
    expect(isObjectiveId('constructor')).toBe(false);
    expect(isObjectiveId('raze')).toBe(false);
    expect(isObjectiveId(undefined)).toBe(false);
    expect(Object.keys(OBJECTIVES)).toHaveLength(3);
  });
});

describe('a raid stops when it has what it came for', () => {
  it('and a config that names nothing fights the raid it always fought', () => {
    const base = generateBase(3, 0, KIT, 'compound', 'usa');
    const squads = hunters();
    const config = raidConfig(base, squads, seedOf(1), trainableFor('usa'));
    const bare = resolveRaid(config, squads, 3, CATALOG);
    const named = resolveRaid({ ...config, objective: 'post' }, squads, 3, CATALOG);
    // Liveness: a battle that never happened would agree about everything.
    expect(bare.ticks, 'nothing was fought').toBeGreaterThan(50);
    expect(bare.objective).toBe('post');
    expect(bare.ticks).toBe(named.ticks);
    expect(bare.cleared).toBe(named.cleared);
    expect(bare.destructionPct).toBe(named.destructionPct);
    expect(bare.withdrew).toBe(false);
  });

  it('and an unreachable quota just fights to the usual ending', () => {
    // A post with nothing to raid cannot be raided; the raid runs its course
    // rather than ending instantly or hanging.
    const base = generateBase(1, 0, KIT, 'camp', 'usa');
    const squads = hunters();
    const config = raidConfig(base, squads, seedOf(2), trainableFor('usa'));
    const res = resolveRaid({ ...config, objective: 'stores' }, squads, 1, CATALOG);
    if (res.quota === 0) {
      expect(res.withdrew).toBe(false);
      expect(res.objectiveMet).toBe(false);
    }
    expect(res.ticks).toBeLessThanOrEqual(RAID_MAX_TICKS);
  });

  it('and pulling out on the quota brings the men back', () => {
    // The measured trade, over 96 raids across three tiers and eight shapes:
    // when the guns objective is met, the raid ends at 653 ticks instead of
    // 1692 and 3.00 men walk back instead of 1.54. That is the whole point of
    // letting a raid come for less — you keep the army you spent.
    const squads = hunters();
    let met = 0;
    let runs = 0;
    let tPost = 0;
    let tGuns = 0;
    let hPost = 0;
    let hGuns = 0;
    for (const tier of [2, 3, 4]) {
      for (const arch of ARCHETYPES) {
        const base = generateBase(tier, 0, KIT, arch.id, 'usa');
        for (let i = 0; i < 4; i++) {
          const config = raidConfig(base, squads, seedOf(i), trainableFor('usa'));
          const post = resolveRaid({ ...config, objective: 'post' }, squads, tier, CATALOG);
          const guns = resolveRaid({ ...config, objective: 'guns' }, squads, tier, CATALOG);
          runs++;
          if (!guns.objectiveMet) continue;
          met++;
          expect(guns.withdrew, 'met the objective without withdrawing').toBe(true);
          expect(guns.progress).toBeGreaterThanOrEqual(guns.quota);
          expect(guns.ticks).toBeLessThan(post.ticks);
          tPost += post.ticks;
          tGuns += guns.ticks;
          hPost += home(post);
          hGuns += home(guns);
        }
      }
    }
    // Liveness again: an objective nothing ever meets would pass every
    // assertion in the loop above by never entering it.
    expect(met / runs, `guns objective met in ${met}/${runs}`).toBeGreaterThan(0.25);
    expect(tGuns / met, 'withdrawing did not shorten the raid').toBeLessThan(tPost / met);
    expect(
      hGuns / met,
      `home: post ${(hPost / met).toFixed(2)} vs guns ${(hGuns / met).toFixed(2)}`,
    ).toBeGreaterThan((hPost / met) * 1.3);
  });
});

describe('a replay stops where the raid stopped', () => {
  const roundTrip = (config: Parameters<typeof encodeReplay>[0]['config']) => {
    const back = decodeReplay(
      encodeReplay({ kind: 'raid', faction: 'usa', title: 'T', won: true, config }),
    );
    expect(back.ok).toBe(true);
    return back.ok ? back.replay.config : null;
  };

  it('carries the objective, and re-fights the identical raid', () => {
    // Search for a raid that actually withdraws rather than pinning a seed:
    // a hand-picked fixture that stops qualifying turns this into a test of
    // nothing, and the first one tried here did exactly that.
    const squads = hunters();
    let config: ReturnType<typeof raidConfig> | null = null;
    let before: ReturnType<typeof resolveRaid> | null = null;
    outer: for (const arch of ARCHETYPES) {
      for (let i = 0; i < 6; i++) {
        const base = generateBase(3, 0, KIT, arch.id, 'usa');
        const candidate = {
          ...raidConfig(base, squads, seedOf(i), trainableFor('usa')),
          objective: 'guns',
        };
        const res = resolveRaid(candidate, squads, 3, CATALOG);
        if (res.withdrew) {
          config = candidate;
          before = res;
          break outer;
        }
      }
    }
    expect(config, 'no raid in the fixture space ever withdrew').not.toBeNull();
    if (!config || !before) return;
    const back = roundTrip(config);
    expect(back?.objective).toBe('guns');
    const after = resolveRaid(back!, squads, 3, CATALOG);
    expect(after.ticks).toBe(before.ticks);
    expect(after.withdrew).toBe(true);
    expect(after.progress).toBe(before.progress);
  });

  it('and a code that names no objective fights on to the old ending', () => {
    // A replay is a RECORD. Nothing written before v1.24 knew about missions,
    // and those battles ran until the post fell or the clock did.
    const base = generateBase(3, 0, KIT, 'compound', 'usa');
    const squads = hunters();
    const config = raidConfig(base, squads, seedOf(3), trainableFor('usa'));
    delete (config as { objective?: string }).objective;
    const back = roundTrip(config);
    expect(back?.objective).toBeUndefined();
    const after = resolveRaid(back!, squads, 3, CATALOG);
    expect(after.withdrew).toBe(false);
    expect(after.objective).toBe('post');
    expect(after.ticks).toBe(resolveRaid(config, squads, 3, CATALOG).ticks);
  });

  it('and the objective survives alongside the combat block', () => {
    // The two optional blocks are written in a fixed order and each forces the
    // ones before it; a mission with no combat model and a combat model with
    // no mission both have to come back intact.
    const base = generateBase(2, 0, KIT, 'keep', 'usa');
    const squads = hunters();
    const bare = raidConfig(base, squads, seedOf(4), trainableFor('usa'));
    const noCombat = { ...bare, objective: 'stores' };
    delete (noCombat as { combatVersion?: number }).combatVersion;
    expect(roundTrip(noCombat)?.objective).toBe('stores');
    expect(roundTrip(noCombat)?.combatVersion).toBeUndefined();

    const both = { ...bare, objective: 'stores', combatSeed: 4242 };
    const back = roundTrip(both);
    expect(back?.objective).toBe('stores');
    expect(back?.combatVersion).toBe(bare.combatVersion);
    expect(back?.combatSeed).toBe(4242);
  });
});
