import { describe, expect, it } from 'vitest';
import { generateBase } from '../src/content/bases';
import { FACTION_IDS } from '../src/content/factions';
import {
  earnXp,
  nextRank,
  newSquadRecord,
  newSquadRecords,
  normalizeSquads,
  rankFor,
  rankMult,
  rankProgress,
  recordRaid,
  squadName,
  RANKS,
  SQUAD_SLOTS,
  XP_CAP,
} from '../src/content/veterancy';
import { deserialize, serialize } from '../src/meta/save';
import { newTown, unlockAll, type TownState } from '../src/meta/town';
import {
  applyRaidResult,
  raidConfig,
  raidWave,
  resolveRaid,
  squadRoster,
  squadVet,
  type SquadPlan,
} from '../src/meta/warfare';
import { RAID_CATALOG } from '../src/content/catalog';

const T0 = Date.UTC(2026, 5, 1, 12);

describe('rank table', () => {
  it('climbs from green to cadre with rising floors and multipliers', () => {
    expect(RANKS.map((r) => r.id)).toEqual(['green', 'line', 'veteran', 'cadre']);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]!.at).toBeGreaterThan(RANKS[i - 1]!.at);
      expect(RANKS[i]!.mult).toBeGreaterThan(RANKS[i - 1]!.mult);
    }
    expect(RANKS[0]!.mult).toBe(1); // green is the baseline, not a penalty
  });

  it('keeps the top bonus small enough to be an edge, not a substitute', () => {
    expect(RANKS[RANKS.length - 1]!.mult).toBeLessThanOrEqual(1.2);
  });

  it('keeps its abbreviations short and its prose brief', () => {
    for (const rank of RANKS) {
      // `short` sits beside a launch time in a row's sub: an abbreviation.
      expect(rank.short.length).toBeLessThanOrEqual(3);
      // `tag` is prose. Rows wrap since v1.13, so this is editorial.
      expect(rank.tag.length).toBeLessThanOrEqual(64);
    }
  });

  it('reads a rank off any experience, and never below green', () => {
    expect(rankFor(0).id).toBe('green');
    expect(rankFor(-50).id).toBe('green');
    expect(rankFor(39).id).toBe('green');
    expect(rankFor(40).id).toBe('line');
    expect(rankFor(219).id).toBe('veteran');
    expect(rankFor(1e9).id).toBe('cadre');
    expect(rankMult(0)).toBe(1);
  });

  it('points at the next rank until there is not one', () => {
    expect(nextRank(0)?.id).toBe('line');
    expect(nextRank(120)?.id).toBe('cadre');
    expect(nextRank(XP_CAP)).toBeNull();
    expect(rankProgress(0)).toBe(0);
    expect(rankProgress(XP_CAP)).toBe(1);
    expect(rankProgress(75)).toBeGreaterThan(0.4);
    expect(rankProgress(75)).toBeLessThan(0.6);
  });
});

describe('experience', () => {
  it('banks the whole lesson when the squad comes back whole', () => {
    const xp = earnXp(0, { deployed: 8, returned: 8, tier: 3, cleared: true });
    expect(xp).toBe(Math.round(3 * 6 * 1.5));
  });

  it('pays a clear better than a repulse', () => {
    const held = earnXp(0, { deployed: 8, returned: 8, tier: 3, cleared: false });
    const took = earnXp(0, { deployed: 8, returned: 8, tier: 3, cleared: true });
    expect(took).toBeGreaterThan(held);
  });

  it('takes experience out with the men who did not come back', () => {
    // Half the formation lost: half of what it knew went with them.
    const before = 200;
    const after = earnXp(before, { deployed: 8, returned: 4, tier: 1, cleared: false });
    expect(after).toBeLessThan(before / 2 + 6); // the survivors' share of the lesson only
    expect(after).toBeGreaterThan(before / 2 - 1);
  });

  it('resets a wiped formation to green', () => {
    expect(earnXp(290, { deployed: 6, returned: 0, tier: 5, cleared: true })).toBe(0);
    expect(rankFor(0).id).toBe('green');
  });

  it('caps experience a little above cadre', () => {
    let xp = 0;
    for (let i = 0; i < 200; i++) {
      xp = earnXp(xp, { deployed: 10, returned: 10, tier: 5, cleared: true });
    }
    expect(xp).toBe(XP_CAP);
    expect(rankFor(xp).id).toBe('cadre');
  });

  it('treats a squad that stayed home as untouched', () => {
    expect(earnXp(120, { deployed: 0, returned: 0, tier: 4, cleared: true })).toBe(120);
  });

  it('climbs to cadre in a plausible number of clean raids, not one', () => {
    let xp = 0;
    let raids = 0;
    while (rankFor(xp).id !== 'cadre' && raids < 100) {
      xp = earnXp(xp, { deployed: 8, returned: 8, tier: 3, cleared: true });
      raids++;
    }
    expect(raids).toBeGreaterThan(4);
    expect(raids).toBeLessThan(20);
  });
});

describe('the standing record', () => {
  it('counts raids, clears and the dead', () => {
    let rec = newSquadRecord();
    rec = recordRaid(rec, { deployed: 8, returned: 6, tier: 2, cleared: true });
    rec = recordRaid(rec, { deployed: 6, returned: 2, tier: 2, cleared: false });
    expect(rec.raids).toBe(2);
    expect(rec.clears).toBe(1);
    expect(rec.lost).toBe(6);
  });

  it('leaves the record of a formation that stayed home alone', () => {
    const rec = { xp: 90, raids: 3, clears: 1, lost: 4 };
    expect(recordRaid(rec, { deployed: 0, returned: 0, tier: 3, cleared: true })).toBe(rec);
  });

  it('never lets the all-time loss count fall', () => {
    let rec = newSquadRecord();
    let lost = 0;
    for (let i = 0; i < 10; i++) {
      rec = recordRaid(rec, { deployed: 8, returned: i % 3, tier: 2, cleared: false });
      expect(rec.lost).toBeGreaterThanOrEqual(lost);
      lost = rec.lost;
    }
  });
});

describe('call signs', () => {
  it('names three distinct formations for every faction', () => {
    for (const faction of FACTION_IDS) {
      const names = [0, 1, 2].map((slot) => squadName(faction, slot));
      expect(new Set(names).size).toBe(SQUAD_SLOTS);
      for (const name of names) {
        // A call sign that needs two lines is not a call sign.
        expect(name.length).toBeLessThanOrEqual(8);
        expect(name).toBe(name.toUpperCase());
      }
    }
  });

  it('clamps an out-of-range slot instead of returning nothing', () => {
    expect(squadName('usa', -1)).toBe(squadName('usa', 0));
    expect(squadName('usa', 99)).toBe(squadName('usa', SQUAD_SLOTS - 1));
  });
});

describe('normalizing a roster off disk', () => {
  it('gives three green squads to a file that has none', () => {
    const squads = normalizeSquads(undefined);
    expect(squads).toHaveLength(SQUAD_SLOTS);
    expect(squads.every((s) => s.xp === 0 && s.raids === 0)).toBe(true);
  });

  it('repairs junk rather than rejecting the save', () => {
    const squads = normalizeSquads([
      { xp: 'lots', raids: -4, clears: null, lost: 3.7 },
      { xp: 1e9 },
      'nope',
      { xp: 50 }, // a fourth formation is not a thing; it is dropped
    ]);
    expect(squads).toHaveLength(SQUAD_SLOTS);
    expect(squads[0]).toEqual({ xp: 0, raids: 0, clears: 0, lost: 4 });
    expect(squads[1]!.xp).toBe(XP_CAP);
    expect(squads[2]).toEqual(newSquadRecord());
  });

  it('survives a save round trip', () => {
    const town = newTown(T0);
    squadRoster(town)[1] = { xp: 150, raids: 9, clears: 4, lost: 11 };
    const back = deserialize(serialize(town))!;
    expect(back.squads).toHaveLength(SQUAD_SLOTS);
    expect(back.squads![0]).toEqual(newSquadRecord());
    expect(back.squads![1]).toEqual({ xp: 150, raids: 9, clears: 4, lost: 11 });
    expect(rankFor(back.squads![1]!.xp).id).toBe('veteran');
  });

  it('reads three green squads out of a file written before veterancy', () => {
    const town = newTown(T0) as TownState & { squads?: unknown };
    delete town.squads;
    const back = deserialize(serialize(town as TownState))!;
    expect(back.squads).toEqual(newSquadRecords());
  });
});

describe('veterancy in the sim', () => {
  const planFor = (vet?: number): SquadPlan[] => [
    {
      units: { ranger: 6, abrams: 2 },
      sector: 'W1',
      doctrine: 'assault',
      slot: 0,
      ...(vet !== undefined ? { vet } : {}),
    },
  ];

  it('stamps every entry with the formation that sent it', () => {
    const wave = raidWave([
      { units: { ranger: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
      { units: { ranger: 3 }, sector: 'N1', doctrine: 'hunt', slot: 2 },
    ]);
    expect(wave.entries.filter((e) => e.squad === 0)).toHaveLength(2);
    expect(wave.entries.filter((e) => e.squad === 2)).toHaveLength(3);
    expect(wave.entries.every((e) => e.vet === undefined)).toBe(true);
  });

  it('keeps a formation identity when an empty squad is dropped from the plan', () => {
    // The launcher filters empties out. Without the explicit slot, SQD3 would
    // come home as SQD2 and inherit a stranger's experience.
    const wave = raidWave([{ units: { ranger: 2 }, sector: 'S1', doctrine: 'raze', slot: 2 }]);
    expect(wave.entries.every((e) => e.squad === 2)).toBe(true);
  });

  it('carries the multiplier into the config so a replay re-fights the same squad', () => {
    const base = generateBase(2, 0);
    const config = raidConfig(base, planFor(1.15), 11);
    const entries = config.siege!.waves[0]!.entries;
    expect(entries.every((e) => e.vet === 1.15)).toBe(true);
  });

  it('brings more men home at the margin, which is what the rank is for', () => {
    // Measured, not assumed: one battle is noise, so sweep a thin plan against
    // a tier that can actually stop it. Green brings ~21% of a 5R1A push back
    // at T4; cadre brings ~33%. The edge pays in survivors, so it protects the
    // experience that earned it.
    const survivalAt = (vet: number): number => {
      let back = 0;
      let sent = 0;
      for (let variant = 0; variant < 3; variant++) {
        const base = generateBase(4, variant);
        for (let seed = 1; seed <= 12; seed++) {
          const p: SquadPlan[] = [
            { units: { ranger: 5, abrams: 1 }, sector: 'W1', doctrine: 'assault', slot: 0, vet },
          ];
          const res = resolveRaid(raidConfig(base, p, seed * 7919), p, 4, RAID_CATALOG);
          back += res.squads[0]!.returned;
          sent += res.squads[0]!.deployed;
        }
      }
      return back / sent;
    };
    const green = survivalAt(1);
    const cadre = survivalAt(1.15);
    expect(cadre).toBeGreaterThan(green);
    // An edge, not a different game: the top rank is worth a few men, not a win.
    expect(cadre - green).toBeLessThan(0.3);
  });

  it('reports what each formation sent and what came back', () => {
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [
      { units: { ranger: 4 }, sector: 'W1', doctrine: 'assault', slot: 0 },
      { units: { ranger: 3 }, sector: 'E1', doctrine: 'hunt', slot: 1 },
    ];
    const res = resolveRaid(raidConfig(base, plan, 5), plan, 1, RAID_CATALOG);
    expect(res.squads.map((s) => s.slot)).toEqual([0, 1]);
    expect(res.squads[0]!.deployed).toBe(4);
    expect(res.squads[1]!.deployed).toBe(3);
    for (const ret of res.squads) {
      expect(ret.returned).toBeGreaterThanOrEqual(0);
      expect(ret.returned).toBeLessThanOrEqual(ret.deployed);
    }
    const totalBack = res.squads.reduce((a, s) => a + s.returned, 0);
    expect(totalBack).toBe(Object.values(res.survivors).reduce((a, b) => a + b, 0));
  });

  it('omits formations that stayed home', () => {
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [
      { units: { ranger: 4 }, sector: 'W1', doctrine: 'assault', slot: 0 },
      { units: {}, sector: 'E1', doctrine: 'hunt', slot: 1 },
    ];
    const res = resolveRaid(raidConfig(base, plan, 5), plan, 1, RAID_CATALOG);
    expect(res.squads).toHaveLength(1);
    expect(res.squads[0]!.slot).toBe(0);
  });
});

describe('veterancy in the town', () => {
  const armed = (): TownState => {
    const town = unlockAll(newTown(T0));
    town.army = { ranger: 12, abrams: 4 };
    return town;
  };

  it('starts every war with three green formations', () => {
    const town = armed();
    expect(squadRoster(town)).toHaveLength(SQUAD_SLOTS);
    expect(squadVet(town, 0)).toBe(1);
    expect(squadVet(town, 2)).toBe(1);
  });

  it('writes the record of the raid onto the formations that fought it', () => {
    const town = armed();
    const base = generateBase(1, 0);
    const plan: SquadPlan[] = [
      { units: { ranger: 6, abrams: 2 }, sector: 'W1', doctrine: 'assault', slot: 0 },
    ];
    const config = raidConfig(base, plan, 3);
    const res = resolveRaid(config, plan, 1, RAID_CATALOG);
    applyRaidResult(town, base, res, config, T0 + 1000);

    const roster = squadRoster(town);
    expect(roster[0]!.raids).toBe(1);
    expect(roster[0]!.lost).toBe(8 - res.squads[0]!.returned);
    expect(roster[0]!.clears).toBe(res.cleared ? 1 : 0);
    // The two that stayed home have no file yet.
    expect(roster[1]).toEqual(newSquadRecord());
    expect(roster[2]).toEqual(newSquadRecord());
  });

  it('promotes a formation that keeps coming back, and the sim feels it', () => {
    const town = armed();
    const roster = squadRoster(town);
    for (let i = 0; i < 6; i++) {
      roster[1] = recordRaid(roster[1]!, { deployed: 8, returned: 8, tier: 3, cleared: true });
    }
    expect(rankFor(roster[1]!.xp).id).not.toBe('green');
    expect(squadVet(town, 1)).toBeGreaterThan(1);
    expect(squadVet(town, 0)).toBe(1); // rank is per formation, not per army
  });

  it('counts a duel as a tier-1 fight, not a free one', () => {
    const town = armed();
    const base = { ...generateBase(1, 0), tier: 0 };
    const plan: SquadPlan[] = [
      { units: { ranger: 4 }, sector: 'W1', doctrine: 'assault', slot: 0 },
    ];
    const config = raidConfig(base, plan, 9);
    const res = resolveRaid(config, plan, 1, RAID_CATALOG);
    applyRaidResult(town, base, res, config, T0 + 2000, { fingerprint: 'abc' });
    expect(squadRoster(town)[0]!.raids).toBe(1);
  });
});
