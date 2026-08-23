import { describe, expect, it } from 'vitest';
import { generateBase, lootFor, MAP_H, MAP_W } from '../src/content/bases';
import { deserialize, serialize } from '../src/meta/save';
import {
  applyCounterResult,
  armyManpower,
  canTrain,
  manpowerCapOf,
  newTown,
  place,
  queueTrain,
  structureAt,
  tick,
  unlockAll,
  TOWN_GRID,
  type SiegeOutcome,
  type TownState,
} from '../src/meta/town';
import {
  applyRaidResult,
  delayOf,
  isScouted,
  nextDelay,
  planDeployment,
  raidConfig,
  raidWave,
  resolveRaid,
  runOfflineProbes,
  scoutTarget,
  sectorCells,
  DELAY_STEPS,
  SECTOR_IDS,
  SQUAD_DELAY_TICKS,
  TUNNEL_DIG_TICKS,
  type SquadPlan,
} from '../src/meta/warfare';

const T0 = 1_700_000_000_000;
const HOURS = 3_600_000;
const idx = (x: number, y: number) => y * TOWN_GRID.width + x;

const devTown = (): TownState => {
  const town = unlockAll(newTown(T0));
  town.supplies = 50_000;
  town.fuel = 50_000;
  return town;
};

describe('base generator', () => {
  it('is deterministic and keeps every piece on the map', () => {
    for (const tier of [1, 3, 6, 10]) {
      for (let variant = 0; variant < 3; variant++) {
        const a = generateBase(tier, variant);
        expect(a).toEqual(generateBase(tier, variant));
        const cells = new Set<number>();
        const check = (cell: number) => {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(MAP_W * MAP_H);
          expect(cells.has(cell), `overlap at ${cell} (t${tier}v${variant})`).toBe(false);
          cells.add(cell);
        };
        for (const w of a.walls) check(w.cell);
        for (const s of a.structures) {
          check(s.cell);
          const big = ['supplyCache', 'fuelDump'].includes(s.kind);
          if (big) {
            check(s.cell + 1);
            check(s.cell + MAP_W);
            check(s.cell + MAP_W + 1);
          }
        }
      }
    }
  });

  it('scales with tier: more towers, higher levels, richer loot', () => {
    const t1 = generateBase(1, 0);
    const t7 = generateBase(7, 0);
    const towers = (b: typeof t1) =>
      b.structures.filter((s) => s.kind.endsWith('Tower')).length;
    expect(towers(t7)).toBeGreaterThan(towers(t1));
    expect(t7.ccLevel).toBeGreaterThan(t1.ccLevel);
    expect(lootFor('cc', 7).supplies).toBeGreaterThan(lootFor('cc', 1).supplies);
    expect(t7.structures.some((s) => s.kind === 'atgmTower')).toBe(true);
    expect(t1.structures.some((s) => s.kind === 'atgmTower')).toBe(false);
  });
});

describe('ordered launch delays', () => {
  const at = (wave: { entries: { kind: string; atTick: number }[] }, kind: string): number =>
    Math.min(...wave.entries.filter((e) => e.kind === kind).map((e) => e.atTick));

  it('reproduces the old fixed stagger when no delay was ordered', () => {
    // Every plan written before v1.15 omits the field. If the fallback drifted,
    // every stored replay would re-fight a different battle than it recorded.
    const plain: SquadPlan[] = [
      { units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' },
      { units: { javelin: 1 }, sector: 'N1', doctrine: 'hunt' },
      { units: { humvee: 1 }, sector: 'S2', doctrine: 'raze' },
    ];
    plain.forEach((squad, i) => expect(delayOf(squad, i)).toBe((i * SQUAD_DELAY_TICKS) / 20));
    const wave = raidWave(plain);
    expect(at(wave, 'ranger')).toBe(0);
    expect(at(wave, 'javelin')).toBe(SQUAD_DELAY_TICKS);
    expect(at(wave, 'humvee')).toBe(2 * SQUAD_DELAY_TICKS);
  });

  it('puts a squad on the field at the second it was ordered to', () => {
    const wave = raidWave([
      { units: { ranger: 1 }, sector: 'W1', doctrine: 'assault', delay: 30 },
      { units: { javelin: 1 }, sector: 'N1', doctrine: 'hunt', delay: 45 },
    ]);
    expect(at(wave, 'ranger')).toBe(30 * 20);
    expect(at(wave, 'javelin')).toBe(45 * 20);
  });

  it('lets the order invert the slots — the third squad can lead', () => {
    // The point of the picker: slot order is a label, not a schedule.
    const wave = raidWave([
      { units: { ranger: 1 }, sector: 'W1', doctrine: 'assault', slot: 0, delay: 45 },
      { units: { javelin: 1 }, sector: 'N1', doctrine: 'hunt', slot: 1, delay: 20 },
      { units: { humvee: 1 }, sector: 'S2', doctrine: 'raze', slot: 2, delay: 0 },
    ]);
    expect(at(wave, 'humvee')).toBeLessThan(at(wave, 'javelin'));
    expect(at(wave, 'javelin')).toBeLessThan(at(wave, 'ranger'));
    // The names still belong to the slots they were assigned, not to arrival order.
    const humvee = wave.entries.find((e) => e.kind === 'humvee')!;
    expect(humvee.squad).toBe(2);
  });

  it('adds the dig on top of the order for a tunneled squad', () => {
    const wave = raidWave([
      { units: { ranger: 1 }, sector: 'W1', doctrine: 'assault', delay: 0, tunnel: 400 },
    ]);
    // T+0 means the ground opens at zero, not that the squad is already up.
    expect(at(wave, 'ranger')).toBe(TUNNEL_DIG_TICKS);
  });

  it('refuses a delay that would stall the raid past the clock', () => {
    // A hand-edited or corrupted plan must not be able to sit out the battle.
    const wave = raidWave([
      { units: { ranger: 1 }, sector: 'W1', doctrine: 'assault', delay: 9000 },
      { units: { javelin: 1 }, sector: 'N1', doctrine: 'hunt', delay: -30 },
    ]);
    expect(at(wave, 'ranger')).toBe(60 * 20);
    expect(at(wave, 'javelin')).toBe(0);
  });

  it('walks every stop and wraps, starting from the default plan', () => {
    const walked: number[] = [];
    let value = 0;
    for (let i = 0; i < DELAY_STEPS.length; i++) {
      value = nextDelay(value);
      walked.push(value);
    }
    expect(new Set(walked).size).toBe(DELAY_STEPS.length);
    expect(value).toBe(0); // all the way round, back where it started
    // The default stagger is expressible in the picker's own vocabulary.
    for (const seconds of [0, 6, 12]) expect(DELAY_STEPS).toContain(seconds);
    // Anything off the list lands on the first stop rather than nowhere.
    expect(nextDelay(37)).toBe(DELAY_STEPS[0]);
  });

  it('changes the battle: holding a squad back changes the outcome hash', () => {
    const base = generateBase(3, 7);
    const together: SquadPlan[] = [
      { units: { abrams: 2, ranger: 3 }, sector: 'W1', doctrine: 'assault', delay: 0 },
      { units: { abrams: 2, ranger: 3 }, sector: 'N1', doctrine: 'assault', delay: 0 },
    ];
    const staggered = together.map((s, i) => ({ ...s, delay: i === 1 ? 60 : 0 }));
    const a = resolveRaid(raidConfig(base, together, 5), together, base.tier);
    const b = resolveRaid(raidConfig(base, staggered, 5), staggered, base.tier);
    // Same units, same sectors, same seed — only the clock differs, and a raid
    // that lands in two halves is not the raid that lands at once.
    expect(a).not.toEqual(b);
  });
});

describe('raid planning and resolution', () => {
  const squads: SquadPlan[] = [
    { units: { ranger: 3, engineer: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { javelin: 2 }, sector: 'N1', doctrine: 'hunt' },
    { units: { humvee: 1 }, sector: 'S2', doctrine: 'raze' },
  ];

  it('spreads squads across their sectors with delays and doctrines', () => {
    const wave = raidWave(squads);
    expect(wave.entries).toHaveLength(7);
    const rangers = wave.entries.filter((e) => e.kind === 'ranger');
    expect(rangers.every((e) => e.col === 0)).toBe(true); // W1 = west edge
    const javelins = wave.entries.filter((e) => e.kind === 'javelin');
    expect(javelins.every((e) => e.row === 0 && e.doctrine === 'hunt')).toBe(true);
    expect(javelins[0]!.atTick).toBeGreaterThanOrEqual(120); // squad 2 launches later
    for (const id of SECTOR_IDS) expect(sectorCells(id).length).toBeGreaterThan(6);
  });

  it('resolves a heavy raid deterministically and pays loot for the damage', () => {
    const base = generateBase(1, 0);
    const heavy: SquadPlan[] = [
      { units: { abrams: 3, engineer: 2 }, sector: 'W1', doctrine: 'assault' },
      { units: { abrams: 2, ranger: 4 }, sector: 'S1', doctrine: 'hunt' },
    ];
    const config = raidConfig(base, heavy, 99);
    const a = resolveRaid(config, heavy, base.tier);
    const b = resolveRaid(config, heavy, base.tier);
    expect(a).toEqual(b); // same config ⇒ identical battle (the replay contract)

    expect(a.ticks).toBeGreaterThan(0);
    expect(a.destructionPct).toBeGreaterThan(0);
    if (a.cleared) {
      expect(a.destroyed['cc']).toBe(1);
      expect(a.loot.supplies).toBeGreaterThanOrEqual(lootFor('cc', base.tier).supplies);
    }
    // Five Abrams versus tier 1 should not be a wipe.
    const surviving = Object.values(a.survivors).reduce((x, y) => x + y, 0);
    expect(surviving).toBeGreaterThan(0);
  });

  it('folds a raid into the town: losses gone, loot banked, ladder advanced', () => {
    const town = devTown();
    town.supplies = 100;
    town.fuel = 50;
    town.army = { ranger: 5, abrams: 2 };
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [{ units: { ranger: 5, abrams: 2 }, sector: 'W1', doctrine: 'assault' }];
    const config = raidConfig(base, plan, 7);

    applyRaidResult(
      town,
      base,
      {
        cleared: true,
        ticks: 1000,
        deployed: planDeployment(plan),
        survivors: { ranger: 2, abrams: 2 },
        losses: { ranger: 3 },
        destroyed: { cc: 1, supplyCache: 2 },
        loot: { supplies: 300, fuel: 40 },
        destructionPct: 0.5,
        powersUsed: {},
        squads: [{ slot: 0, deployed: 7, returned: 4 }],
      },
      config,
      T0 + 1000,
    );

    expect(town.army['ranger']).toBe(2);
    expect(town.army['abrams']).toBe(2);
    expect(town.supplies).toBe(400);
    expect(town.fuel).toBe(90);
    expect(town.frontline.wins).toBe(1);
    expect(town.frontline.totalWins).toBe(1);
    expect(town.frontline.pendingCounterattack).toBe(false); // second win triggers it
    expect(town.lastRaid?.cleared).toBe(true);
  });

  it('every second cleared post triggers a counterattack; three wins climb a tier', () => {
    const town = devTown();
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [{ units: { ranger: 1 }, sector: 'W1', doctrine: 'assault' }];
    const config = raidConfig(base, plan, 1);
    const win = {
      cleared: true, ticks: 1, deployed: {}, survivors: {}, losses: {},
      destroyed: {}, loot: { supplies: 0, fuel: 0 }, destructionPct: 1, powersUsed: {}, squads: [],
    };
    applyRaidResult(town, base, win, config, T0);
    applyRaidResult(town, base, win, config, T0);
    expect(town.frontline.pendingCounterattack).toBe(true);
    applyRaidResult(town, base, win, config, T0);
    expect(town.frontline.tier).toBe(2);
    expect(town.frontline.wins).toBe(0);
  });

  it('scouting costs intel once and persists', () => {
    const town = devTown();
    town.intel = 100;
    expect(isScouted(town, 1, 0)).toBe(false);
    expect(scoutTarget(town, 1, 0)).toBe(true);
    expect(town.intel).toBe(55); // 100 − (30 + 15×1)
    expect(scoutTarget(town, 1, 0)).toBe(true); // already scouted: free
    expect(town.intel).toBe(55);
  });
});

describe('army training', () => {
  it('trains through the queue, charges resources, and respects manpower', () => {
    const town = devTown();
    place(town, 'barracks', idx(5, 5), T0);
    tick(town, T0 + 31_000); // barracks built
    const barracks = structureAt(town, idx(5, 5))!;

    const suppliesBefore = town.supplies;
    expect(queueTrain(town, barracks.id, 'ranger', T0 + 31_000)).toBe(true);
    expect(queueTrain(town, barracks.id, 'ranger', T0 + 31_000)).toBe(true);
    expect(town.supplies).toBe(suppliesBefore - 120);

    tick(town, T0 + 31_000 + 12_000); // first ranger done
    expect(town.army['ranger']).toBe(1);
    tick(town, T0 + 31_000 + 24_500); // chained second
    expect(town.army['ranger']).toBe(2);
    expect(armyManpower(town)).toBe(4);

    // Manpower cap: 6 base + 5×L1 barracks = 11 → 3 more rangers ok, 4th (10 mp total→ fine)...
    // fill to the cap and verify rejection.
    while (canTrain(town, barracks.id, 'ranger') === null) {
      queueTrain(town, barracks.id, 'ranger', T0 + 60_000);
      tick(town, T0 + 200_000);
    }
    expect(canTrain(town, barracks.id, 'ranger')).toBe('manpower');
    expect(armyManpower(town)).toBeLessThanOrEqual(manpowerCapOf(town));
  });

  it('vehicles need the motor pool (and the motor pool needs CC2)', () => {
    const town = devTown();
    place(town, 'barracks', idx(5, 5), T0);
    tick(town, T0 + 31_000);
    const barracks = structureAt(town, idx(5, 5))!;
    expect(canTrain(town, barracks.id, 'abrams')).toBe('facility');

    expect(place(town, 'motorpool', idx(9, 5), T0 + 31_000)).toBe(false); // CC1 allows none
    town.structures.find((s) => s.kind === 'cc')!.level = 2;
    expect(place(town, 'motorpool', idx(9, 5), T0 + 31_000)).toBe(true);
    tick(town, T0 + 31_000 + 46_000);
    // tick() clamps stores to caps; refill within them for the affordability check.
    town.supplies = 1000;
    town.fuel = 300;
    const pool = structureAt(town, idx(9, 5))!;
    expect(canTrain(town, pool.id, 'abrams')).toBe(null);
  });
});

describe('offline probes', () => {
  it('runs capped probes for long absences, logs replays, and shields after a breach', () => {
    const town = devTown();
    // A real (if modest) defense so probes resolve meaningfully.
    place(town, 'm2nest', idx(25, 11), T0 - HOURS);
    place(town, 'autocannon', idx(25, 13), T0 - HOURS);
    tick(town, T0);
    town.lastSeen = T0;

    const ran = runOfflineProbes(town, T0 + 30 * HOURS); // 10 intervals → capped at 3
    expect(ran.length).toBeGreaterThanOrEqual(1);
    expect(ran.length).toBeLessThanOrEqual(3);
    expect(town.defenseLog.length).toBe(ran.length);
    for (const entry of town.defenseLog) {
      expect(entry.config.siege).toBeDefined(); // replayable
      expect(entry.suppliesLost).toBeGreaterThanOrEqual(0);
    }
    const breached = ran.some((r) => !r.held);
    if (breached) expect(town.shieldUntil).toBeGreaterThan(T0);
  });

  it('short absences and shielded windows run nothing', () => {
    const town = devTown();
    town.lastSeen = T0;
    expect(runOfflineProbes(town, T0 + HOURS)).toEqual([]);
    town.shieldUntil = T0 + 100 * HOURS;
    expect(runOfflineProbes(town, T0 + 50 * HOURS)).toEqual([]);
  });
});

describe('counterattack + save v3', () => {
  it('applyCounterResult clears the pending flag both ways', () => {
    const outcome: SiegeOutcome = {
      victory: true,
      supplies: 500,
      chargesLeft: {},
      walls: [],
      survivors: [],
      stats: {
        spawned: 0, kills: 0, wallsBuilt: 0, wallsLost: 0,
        structuresLost: 0, suppliesSpent: 0, cpSpent: 0, salvage: 0,
      },
      ccHpFraction: 1,
    };
    const town = devTown();
    town.frontline.pendingCounterattack = true;
    applyCounterResult(town, outcome, T0);
    expect(town.frontline.pendingCounterattack).toBe(false);
    expect(town.supplies).toBeGreaterThan(500); // bounty

    const lost = devTown();
    lost.frontline.pendingCounterattack = true;
    applyCounterResult(lost, { ...outcome, victory: false, supplies: 400 }, T0);
    expect(lost.frontline.pendingCounterattack).toBe(false);
    expect(lost.defeats).toBe(1);
  });

  it('v3 saves round-trip with army and frontline intact', () => {
    const town = devTown();
    town.army = { ranger: 3, abrams: 1 };
    town.frontline.tier = 4;
    town.frontline.scouted = ['t4v1'];
    const restored = deserialize(serialize(town));
    expect(restored).toEqual(town);
  });
});
