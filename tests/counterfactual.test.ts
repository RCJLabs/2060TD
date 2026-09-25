import { describe, expect, it } from 'vitest';
import { CHINA_BASE_KIT, generateBase, MAP_W } from '../src/content/bases';
import { raidCatalogFor, trainableFor } from '../src/content/factions';
import {
  choicesFor,
  Counterfactual,
  outcomeOf,
  planOf,
  refought,
  storedWithChange,
  withChange,
  WHAT_IF_ROLLS,
  type Change,
} from '../src/meta/counterfactual';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { probeConfig, newTown } from '../src/meta/town';
import { raidConfig, resolveRaid, storePlan, type SquadPlan } from '../src/meta/warfare';
import type { SimConfig } from '../src/sim/types';

/** M29 Phase 3: the raid as fought, and the same raid with one thing changed. */

const USA = trainableFor('usa');
const CATALOG = raidCatalogFor('usa');
const base = generateBase(3, 1, CHINA_BASE_KIT);

const plan = (): SquadPlan[] => [
  { units: { abrams: 1, ranger: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
  { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt', slot: 1, vet: 1.09 },
  { units: { ranger: 3 }, sector: 'S2', doctrine: 'assault', slot: 2, delay: 20 },
];

/** Through the vault and back, as a watched raid comes to the report. */
const decoded = (config: SimConfig): SimConfig => {
  const back = decodeReplay(encodeReplay({ kind: 'raid', faction: 'usa', title: 'T', won: false, config }));
  if (!back.ok) throw new Error('the code did not decode');
  return back.replay.config;
};

const lost = (losses: Record<string, number>): number => Object.values(losses).reduce((a, b) => a + b, 0);

describe('the plan a raid was fought with (M29 Phase 3)', () => {
  const cases: [string, SimConfig][] = [
    ['three squads, a rank and a delay', raidConfig(base, plan(), 11, USA)],
    ['one squad in the third slot', raidConfig(base, [{ units: { ranger: 2 }, sector: 'E2', doctrine: 'raze', slot: 2 }], 3, USA)],
    [
      'squads on the same second',
      raidConfig(
        base,
        plan().map((s) => ({ ...s, delay: 0 })),
        5,
        USA,
      ),
    ],
    [
      'a gallery (NK)',
      raidConfig(
        base,
        [
          { units: { nkrifle: 3, rpg7: 1 }, sector: 'W2', doctrine: 'assault', slot: 0 },
          { units: { infiltrator: 2, tunneler: 1 }, sector: 'N1', doctrine: 'hunt', slot: 1, tunnel: 7 * MAP_W + 5, delay: 12 },
        ],
        9,
        trainableFor('nk'),
      ),
    ],
  ];

  it('is proven by rebuilding the very config it came from', () => {
    for (const [name, config] of cases) {
      const trainable = name.includes('NK') ? trainableFor('nk') : USA;
      const found = planOf(config, trainable);
      expect(found, name).not.toBeNull();
      expect(JSON.stringify(refought(config, found!, trainable)), name).toBe(JSON.stringify(config));
    }
  });

  it('is found on a raid out of the vault too, and fights the same battle there', () => {
    for (const [name, config] of cases) {
      if (name.includes('NK')) continue;
      const vaulted = decoded(config);
      const found = planOf(vaulted, USA);
      expect(found, name).not.toBeNull();
      expect(outcomeOf(refought(vaulted, found!, USA), CATALOG), name).toEqual(outcomeOf(vaulted, CATALOG));
    }
  });

  it('is refused when it cannot be proven: no squads, a man out of place, a gallery unaccounted for', () => {
    expect(planOf(probeConfig(newTown(1_700_000_000_000, 'usa'), 3, 1), USA)).toBeNull();
    const config = raidConfig(base, plan(), 11, USA);
    const moved = structuredClone(config);
    moved.siege!.waves[0]!.entries[3]!.atTick += 1;
    expect(planOf(moved, USA)).toBeNull();
    expect(planOf({ ...config, reservedCells: [7 * MAP_W + 5] }, USA)).toBeNull();
  });
});

describe('one change (M29 Phase 3)', () => {
  const fought = plan();

  it('does the one thing it says, and leaves the plan it was made to alone', () => {
    const before = JSON.stringify(fought);
    const changes: [Change, (p: SquadPlan[]) => unknown, unknown][] = [
      [{ slot: 0, kind: 'more', unit: 'engineer' }, (p) => p[0]!.units, { abrams: 1, ranger: 2, engineer: 1 }],
      [{ slot: 1, kind: 'fewer', unit: 'javelin' }, (p) => p[1]!.units, { javelin: 1, engineer: 1 }],
      [{ slot: 2, kind: 'entry', sector: 'W2' }, (p) => p[2]!.sector, 'W2'],
      [{ slot: 1, kind: 'doctrine', doctrine: 'raze' }, (p) => p[1]!.doctrine, 'raze'],
      [{ slot: 0, kind: 'start', seconds: 30 }, (p) => p[0]!.delay, 30],
    ];
    for (const [change, read, expected] of changes) {
      const changed = withChange(fought, change);
      expect(read(changed), change.kind).toEqual(expected);
      // Everything else as fought.
      const others = changed.filter((s) => s.slot !== change.slot);
      expect(others).toEqual(fought.filter((s) => s.slot !== change.slot));
    }
    expect(JSON.stringify(fought)).toBe(before);
  });

  it('sends a squad home when its last man is taken out of it', () => {
    const lone: SquadPlan[] = [
      { units: { ranger: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
      { units: { abrams: 1 }, sector: 'N1', doctrine: 'assault', slot: 1 },
    ];
    expect(withChange(lone, { slot: 1, kind: 'fewer', unit: 'abrams' }).map((s) => s.slot)).toEqual([0]);
  });

  it('offers every choice but the one fought with, and no sector to a squad that came up a gallery', () => {
    const choices = choicesFor(fought, 1, USA);
    expect(choices.more).toEqual(USA.map((t) => t.kind));
    expect([...choices.fewer].sort()).toEqual(['engineer', 'javelin']);
    expect(choices.entry).not.toContain('N1');
    expect(choices.entry).toHaveLength(7);
    expect(choices.doctrine).toEqual(['assault', 'raze']);
    const nk = planOf(
      raidConfig(
        base,
        [{ units: { infiltrator: 2 }, sector: 'N1', doctrine: 'hunt', slot: 0, tunnel: 7 * MAP_W + 5, delay: 6 }],
        9,
        trainableFor('nk'),
      ),
      trainableFor('nk'),
    )!;
    expect(choicesFor(nk, 0, trainableFor('nk')).entry).toEqual([]);
    expect(choicesFor(nk, 0, trainableFor('nk')).start).not.toContain(6);
  });
});

describe('the what-if (M29 Phase 3)', () => {
  const config = raidConfig(base, plan(), 4242, USA);
  const counterfactual = Counterfactual.of(config, CATALOG, USA)!;
  const change: Change = { slot: 2, kind: 'entry', sector: 'N2' };
  const answer = counterfactual.whatIf(change);

  it('fights both raids as the resolution does', () => {
    const asFought = resolveRaid(config, plan(), 3, CATALOG);
    expect(answer.fought.cleared).toBe(asFought.cleared);
    expect(answer.fought.lost).toBe(lost(asFought.losses));
    expect(answer.fought.ticks).toBe(asFought.ticks);
    const changedPlan = withChange(plan(), change);
    const asChanged = resolveRaid(answer.config, changedPlan, 3, CATALOG);
    expect(answer.changed.cleared).toBe(asChanged.cleared);
    expect(answer.changed.lost).toBe(lost(asChanged.losses));
  });

  it('changes nothing but the wave: the same post, ground, day and dice', () => {
    const { siege: a, ...restA } = answer.config;
    const { siege: b, ...restB } = config;
    expect(restA).toEqual(restB);
    expect({ ...a, waves: [] }).toEqual({ ...b, waves: [] });
    expect(a!.waves).not.toEqual(b!.waves);
  });

  it('fights both plans over the same rolls, the same every time', () => {
    expect(answer.rolls).not.toBeNull();
    const seeds = counterfactual.rollSeeds();
    expect(seeds).toHaveLength(WHAT_IF_ROLLS);
    expect(new Set(seeds).size).toBe(WHAT_IF_ROLLS);
    expect(counterfactual.rollSeeds()).toEqual(seeds);
    for (const rolls of [answer.rolls!.fought, answer.rolls!.changed]) {
      expect(rolls.done).toBeGreaterThanOrEqual(0);
      expect(rolls.done).toBeLessThanOrEqual(WHAT_IF_ROLLS);
    }
    expect(Counterfactual.of(config, CATALOG, USA)!.whatIf(change)).toEqual(answer);
  });

  it('is the one roll there is for a duel, whose dice are fixed', () => {
    const duel = raidConfig(base, plan(), 4242, USA, { combatSeed: 77 });
    const answer = Counterfactual.of(duel, CATALOG, USA)!.whatIf(change);
    expect(answer.rolls).toBeNull();
  });
});

describe('taking a what-if into the plan (M29 Phase 3)', () => {
  it('makes the one change to the plan as launched, and a second replaces the first', () => {
    const fought = storePlan(plan());
    const first = storedWithChange(fought, { slot: 0, kind: 'more', unit: 'engineer' });
    expect(first[0]!.units).toEqual({ abrams: 1, ranger: 2, engineer: 1 });
    const second = storedWithChange(fought, { slot: 2, kind: 'entry', sector: 'W2' });
    expect(second[0]!.units).toEqual({ abrams: 1, ranger: 2 });
    expect(second[2]!.sector).toBe('W2');
    expect(fought[2]!.sector).toBe('S2');
  });
});
