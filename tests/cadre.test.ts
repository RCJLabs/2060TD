import { describe, expect, it } from 'vitest';
import { makeResolution } from './helpers';
import { generateBase } from '../src/content/bases';
import { raidCatalogFor, trainableFor, type FactionId } from '../src/content/factions';
import {
  dealOfficer,
  gradeFor,
  GRADES,
  nextGrade,
  officerEdge,
  OFFICER_NAMES,
  type Officer,
} from '../src/content/officers';
import { lessonOf, RANK_BY_ID } from '../src/content/veterancy';
import { cadreOf, FALLEN_CAP, normalizeCadre, officerOf, promoteDue } from '../src/meta/cadre';
import { Counterfactual } from '../src/meta/counterfactual';
import { callsignOf, collectGhost, sendGhost, setCallsign, takeGhost } from '../src/meta/ghost';
import { decodeReplay, encodeReplay } from '../src/meta/replaycode';
import { deserialize, serialize } from '../src/meta/save';
import { baseFromShare, decodeBase, encodeBase } from '../src/meta/sharecode';
import { newTown, type TownState } from '../src/meta/town';
import {
  applyRaidResult,
  raidConfig,
  squadRoster,
  squadVet,
  type RaidResolution,
  type SquadPlan,
} from '../src/meta/warfare';
import type { Doctrine } from '../src/sim/types';

/** M28 Phase 1: the squads' officers. */

const T0 = Date.UTC(2026, 5, 1, 12);
const LINE = RANK_BY_ID.line.at;

const armed = (faction: FactionId = 'usa'): TownState => {
  const town = newTown(T0, faction);
  town.army = { ranger: 30, abrams: 6, javelin: 6, engineer: 6 };
  return town;
};

const officer = (over: Partial<Officer> = {}): Officer => ({
  name: 'REYES',
  doctrine: 'hunt',
  xp: 0,
  raids: 0,
  clears: 0,
  since: T0,
  ...over,
});

/** A raid on a tier-`tier` post, resolved as given rather than fought. */
function raid(
  town: TownState,
  squads: { slot: number; deployed: number; returned: number }[],
  over: Partial<RaidResolution> = {},
  tier = 2,
  now = T0 + 60_000,
) {
  const base = generateBase(tier, 0);
  const plan: SquadPlan[] = squads.map((s) => ({
    units: { ranger: s.deployed },
    sector: 'N1',
    doctrine: 'assault',
    slot: s.slot,
  }));
  const config = raidConfig(base, plan, 1);
  const lost = squads.reduce((n, s) => n + s.deployed - s.returned, 0);
  const res = makeResolution({
    squads,
    losses: lost > 0 ? { ranger: lost } : {},
    cleared: false,
    objectiveMet: false,
    ...over,
  });
  return { news: applyRaidResult(town, base, res, config, now), base };
}

describe('grades and the edge (M28)', () => {
  it('climbs from lieutenant to major, each grade worth more on its doctrine than off it', () => {
    expect(GRADES.map((g) => g.id)).toEqual(['lt', 'cpt', 'maj']);
    for (let i = 0; i < GRADES.length; i++) {
      const g = GRADES[i]!;
      expect(g.on).toBeGreaterThan(g.off);
      expect(g.off).toBeGreaterThan(1);
      if (i > 0) {
        expect(g.at).toBeGreaterThan(GRADES[i - 1]!.at);
        expect(g.on).toBeGreaterThan(GRADES[i - 1]!.on);
      }
    }
    expect(gradeFor(0).id).toBe('lt');
    expect(gradeFor(GRADES[1]!.at).id).toBe('cpt');
    expect(gradeFor(GRADES[2]!.at - 1).id).toBe('cpt');
    expect(nextGrade(GRADES[2]!.at)).toBeNull();
  });

  it('is the grade’s edge on the officer’s doctrine, a third of it on others, and nothing with nobody in command', () => {
    const lt = officer();
    expect(officerEdge(lt, 'hunt')).toBe(GRADES[0]!.on);
    expect(officerEdge(lt, 'assault')).toBe(GRADES[0]!.off);
    expect(officerEdge(undefined, 'hunt')).toBe(1);
    expect(officerEdge(officer({ xp: GRADES[2]!.at }), 'hunt')).toBe(GRADES[2]!.on);
  });

  it('multiplies the rank into what the squad fights at, kept to the thousandth a code holds', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: LINE, raids: 3, clears: 2, lost: 1, officer: officer({ xp: GRADES[1]!.at }) };
    const on = squadVet(town, 0, 'hunt');
    const off = squadVet(town, 0, 'raze');
    expect(on).toBe(Math.round(RANK_BY_ID.line.mult * GRADES[1]!.on * 1000) / 1000);
    expect(off).toBe(Math.round(RANK_BY_ID.line.mult * GRADES[1]!.off * 1000) / 1000);
    expect(on).toBeGreaterThan(off);
    expect(squadVet(town, 1, 'hunt')).toBe(1);
  });
});

describe('the deal (M28)', () => {
  it('deals the same officer for the same seed, from the faction’s names, passing over names in use', () => {
    const a = dealOfficer('china', 12345, []);
    expect(dealOfficer('china', 12345, [])).toEqual(a);
    expect(a.name).toMatch(/^[A-Z]\. [A-Z]+$/);
    expect(OFFICER_NAMES.china).toContain(a.name.slice(3));
    expect(dealOfficer('china', 12345, [a.name]).name).not.toBe(a.name);
    const doctrines = new Set<Doctrine>();
    for (let seed = 0; seed < 40; seed++) doctrines.add(dealOfficer('usa', seed * 7919, []).doctrine);
    expect([...doctrines].sort()).toEqual(['assault', 'hunt', 'raze']);
  });
});

describe('promotion (M28)', () => {
  it('puts nobody over a green squad, and an officer over one at LINE', () => {
    const town = armed();
    squadRoster(town)[0]!.xp = LINE - 1;
    expect(promoteDue(town, T0)).toEqual([]);
    squadRoster(town)[0]!.xp = LINE;
    const promoted = promoteDue(town, T0 + 5);
    expect(promoted.map((p) => p.slot)).toEqual([0]);
    expect(officerOf(town, 0)).toEqual(promoted[0]!.officer);
    expect(officerOf(town, 0)!.since).toBe(T0 + 5);
    expect(cadreOf(town).promoted).toBe(1);
    // Once in command, not promoted again.
    expect(promoteDue(town, T0 + 9)).toEqual([]);
  });

  it('deals a war the same officers however often it is asked, and no two alive share a name', () => {
    const deal = (): Officer[] => {
      const town = armed('russia');
      for (const record of squadRoster(town)) record.xp = LINE;
      promoteDue(town, T0);
      return squadRoster(town).map((r) => r.officer!);
    };
    const first = deal();
    expect(deal()).toEqual(first);
    expect(new Set(first.map((o) => o.name)).size).toBe(3);
  });

  it('does not deal again the name of an officer the record remembers falling', () => {
    const town = armed();
    squadRoster(town)[0]!.xp = LINE;
    const first = promoteDue(town, T0)[0]!.officer.name;
    raid(town, [{ slot: 0, deployed: 3, returned: 0 }]);
    expect(cadreOf(town).fallen[0]!.name).toBe(first);
    squadRoster(town)[0]!.xp = LINE;
    expect(promoteDue(town, T0 + 9)[0]!.officer.name).not.toBe(first);
  });

  it('comes after the raid that lifts a squad to LINE, and says so', () => {
    const town = armed();
    squadRoster(town)[1]!.xp = LINE - 5;
    const { news } = raid(town, [{ slot: 1, deployed: 6, returned: 6 }], { cleared: true, objectiveMet: true });
    expect(squadRoster(town)[1]!.xp).toBeGreaterThanOrEqual(LINE);
    expect(news.promoted.map((p) => p.slot)).toEqual([1]);
    expect(officerOf(town, 1)?.raids).toBe(0);
  });
});

describe('what a raid does to an officer (M28)', () => {
  it('banks the whole lesson for an officer whose squad came back, whatever it lost', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: LINE + 20, raids: 4, clears: 3, lost: 2, officer: officer({ xp: 10 }) };
    raid(town, [{ slot: 0, deployed: 8, returned: 1 }], { cleared: true, objectiveMet: true }, 3);
    const after = officerOf(town, 0)!;
    expect(after.xp).toBe(10 + lessonOf(3, true));
    expect(after.raids).toBe(1);
    expect(after.clears).toBe(1);
    // The men's rank bled away with seven of eight; the officer did not.
    expect(squadRoster(town)[0]!.xp).toBeLessThan(LINE);
  });

  it('keeps his squad’s officer when its rank drops below LINE, and promotes nobody new', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: LINE, raids: 2, clears: 1, lost: 0, officer: officer() };
    const { news } = raid(town, [{ slot: 0, deployed: 8, returned: 2 }]);
    expect(officerOf(town, 0)?.name).toBe('REYES');
    expect(news.promoted).toEqual([]);
    expect(news.fell).toEqual([]);
  });

  it('goes up a grade when the lesson carries him over, and says so', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: LINE, raids: 2, clears: 1, lost: 0, officer: officer({ xp: GRADES[1]!.at - 1 }) };
    const { news } = raid(town, [{ slot: 0, deployed: 4, returned: 4 }], { cleared: true, objectiveMet: true });
    expect(news.graded.map((g) => [g.slot, gradeFor(g.officer.xp).id])).toEqual([[0, 'cpt']]);
  });

  it('falls with a squad wiped out, into the fallen, and the squad earns nobody until LINE again', () => {
    const town = armed();
    squadRoster(town)[2] = { xp: 150, raids: 9, clears: 7, lost: 5, officer: officer({ name: 'OKAFOR', xp: 90, raids: 6 }) };
    const { news, base } = raid(town, [{ slot: 2, deployed: 5, returned: 0 }], {}, 4, T0 + 99_000);
    expect(officerOf(town, 2)).toBeUndefined();
    expect(squadRoster(town)[2]!.xp).toBe(0);
    expect(news.fell).toHaveLength(1);
    const fallen = cadreOf(town).fallen[0]!;
    expect(fallen).toEqual(news.fell[0]);
    expect(fallen).toMatchObject({ name: 'OKAFOR', slot: 2, raids: 7, xp: 90, fell: T0 + 99_000, where: base.name });
    expect(news.promoted).toEqual([]);
  });

  it('counts a duel, whose losses are real', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: 60, raids: 2, clears: 1, lost: 0, officer: officer() };
    const base = { ...generateBase(1, 0), tier: 0 };
    const plan: SquadPlan[] = [{ units: { ranger: 4 }, sector: 'N1', doctrine: 'assault', slot: 0 }];
    const res = makeResolution({ squads: [{ slot: 0, deployed: 4, returned: 0 }], losses: { ranger: 4 }, cleared: false, objectiveMet: false });
    const news = applyRaidResult(town, base, res, raidConfig(base, plan, 1), T0 + 1, { fingerprint: 'x' });
    expect(news.fell.map((f) => f.name)).toEqual(['REYES']);
  });

  it('keeps the newest of the fallen by name', () => {
    const town = armed();
    for (let i = 0; i < FALLEN_CAP + 5; i++) {
      squadRoster(town)[0] = { xp: 50, raids: 1, clears: 0, lost: 0, officer: officer({ name: `N${i}` }) };
      raid(town, [{ slot: 0, deployed: 3, returned: 0 }], {}, 2, T0 + i);
    }
    expect(cadreOf(town).fallen).toHaveLength(FALLEN_CAP);
    expect(cadreOf(town).fallen[0]!.name).toBe(`N${FALLEN_CAP + 4}`);
  });
});

describe('the edge in the battle (M28)', () => {
  it('rides the wave at launch, and the replay code keeps it exactly', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: RANK_BY_ID.veteran.at, raids: 5, clears: 4, lost: 3, officer: officer({ doctrine: 'assault', xp: 70 }) };
    const vet = squadVet(town, 0, 'assault');
    const plan: SquadPlan[] = [{ units: { ranger: 3, abrams: 1 }, sector: 'W1', doctrine: 'assault', slot: 0, vet }];
    const config = raidConfig(generateBase(3, 1), plan, 77, trainableFor('usa'));
    expect(config.siege!.waves[0]!.entries.every((e) => e.vet === vet)).toBe(true);
    const back = decodeReplay(encodeReplay({ kind: 'raid', faction: 'usa', title: 'T', won: true, config }));
    if (!back.ok) throw new Error('the code did not read');
    expect(back.replay.config.siege!.waves[0]!.entries.map((e) => e.vet)).toEqual(
      config.siege!.waves[0]!.entries.map((e) => e.vet),
    );
  });

  it('goes into a ghost as its sender stamps it, and a ghost raid leaves both sides’ officers alone', () => {
    const attacker = armed('usa');
    setCallsign(attacker, 'VIPER 43');
    squadRoster(attacker)[0] = { xp: LINE, raids: 2, clears: 2, lost: 0, officer: officer({ doctrine: 'assault', xp: 70 }) };
    const defender = newTown(T0, 'china');
    setCallsign(defender, 'RED LANTERN');
    squadRoster(defender)[1] = { xp: LINE, raids: 1, clears: 1, lost: 0, officer: officer({ name: 'WANG' }) };
    const read = decodeBase(encodeBase(defender, callsignOf(defender)));
    if (!read.ok) throw new Error('no base');
    const plan: SquadPlan[] = [{ units: { ranger: 6, abrams: 2 }, sector: 'N1', doctrine: 'assault', slot: 0 }];
    const sent = sendGhost(attacker, baseFromShare(read.base), plan, T0 + 1_000);
    if (!sent.ok) throw new Error(sent.error);
    expect(sent.ghost.plan[0]!.vet).toBe(squadVet(attacker, 0, 'assault'));
    const before = structuredClone([squadRoster(attacker), squadRoster(defender), attacker.cadre, defender.cadre]);
    const took = takeGhost(defender, sent.code, T0 + 2_000);
    if (!took.ok) throw new Error(took.error);
    expect(collectGhost(attacker, took.taken.result, T0 + 3_000).ok).toBe(true);
    expect([squadRoster(attacker), squadRoster(defender), attacker.cadre, defender.cadre]).toEqual(before);
  });

  it('gives a what-if that changes a squad’s doctrine the edge its officer would have had', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: LINE, raids: 2, clears: 2, lost: 0, officer: officer({ doctrine: 'hunt', xp: 70 }) };
    const plan: SquadPlan[] = [
      { units: { ranger: 3, abrams: 1 }, sector: 'W1', doctrine: 'assault', slot: 0, vet: squadVet(town, 0, 'assault') },
    ];
    const config = raidConfig(generateBase(3, 1), plan, 5, trainableFor('usa'));
    const edge = (slot: number, doctrine: Doctrine) => squadVet(town, slot, doctrine);
    const cf = Counterfactual.of(config, raidCatalogFor('usa'), trainableFor('usa'), edge)!;
    const answer = cf.whatIf({ slot: 0, kind: 'doctrine', doctrine: 'hunt' });
    expect(answer.config.siege!.waves[0]!.entries.every((e) => e.vet === squadVet(town, 0, 'hunt'))).toBe(true);
    // Without the officers known, a what-if keeps the squad as it was fought.
    const plain = Counterfactual.of(config, raidCatalogFor('usa'), trainableFor('usa'))!;
    const kept = plain.whatIf({ slot: 0, kind: 'doctrine', doctrine: 'hunt' });
    expect(kept.config.siege!.waves[0]!.entries.every((e) => e.vet === plan[0]!.vet)).toBe(true);
  });
});

describe('the cadre in the save (M28)', () => {
  it('keeps the officers and the fallen, and drops what it cannot read', () => {
    const town = armed();
    squadRoster(town)[0] = { xp: 80, raids: 3, clears: 2, lost: 1, officer: officer({ xp: 44 }) };
    squadRoster(town)[2] = { xp: 50, raids: 1, clears: 0, lost: 0, officer: officer({ name: 'SATO' }) };
    raid(town, [{ slot: 2, deployed: 3, returned: 0 }]);
    const back = deserialize(serialize(town))!;
    expect(squadRoster(back)).toEqual(squadRoster(town));
    expect(back.cadre).toEqual(town.cadre);
    expect(normalizeCadre({ promoted: -3, fallen: [{ name: 'X' }, 7] })).toEqual({ promoted: 0, fallen: [] });
    expect(normalizeCadre('junk')).toBeUndefined();
    // An officer that cannot be read is dropped; a squad at LINE is dealt one, as a new war's would be.
    const junk = JSON.parse(serialize(town));
    junk.town.squads[0].officer = { name: 'BAD', doctrine: 'dance' };
    const mended = deserialize(JSON.stringify(junk))!;
    expect(mended.squads![0]!.officer?.name).not.toBe('BAD');
    expect(mended.squads![0]!.officer?.xp).toBe(0);
  });

  it('gives a war saved before officers its officer on load, the same one every load', () => {
    const town = armed('nk');
    squadRoster(town)[1]!.xp = RANK_BY_ID.veteran.at;
    const old = JSON.parse(serialize(town));
    delete old.town.cadre;
    const first = deserialize(JSON.stringify(old))!;
    const again = deserialize(JSON.stringify(old))!;
    expect(officerOf(first, 1)).toBeDefined();
    expect(officerOf(again, 1)).toEqual(officerOf(first, 1));
    expect(officerOf(first, 0)).toBeUndefined();
  });
});
