/**
 * The research tree (M6, v0.4): doctrines in three branches, paid in Intel
 * from the Signals Station and researched one at a time.
 *
 * Nine of them, three straight ladders, until M24 Phase 4 made it a graph: a
 * fourth and fifth tier on each branch, and each of those needs a tech from
 * another branch as well as its own. They cost supplies and fuel as well as
 * intel, and take hours — they are what the surplus is for once the town is
 * built.
 *
 * Since M28 Phase 2 the top of the graph is the war's DOCTRINE: every war buys
 * the nine lower techs, but the first tier-4 tech it starts commits it to that
 * branch for good, and tier 4 and above of the other two are closed to it. In
 * return the branch it chose has a sixth tier, a capstone only its doctrine can
 * buy. Every war of a faction ended with the same research; now it ends with
 * one of three.
 *
 * Effects fold into battles as deterministic multipliers carried INSIDE the
 * SimConfig (see sim/types DefenderMods/AttackerMods), so replays of old
 * battles keep their original math. Meta-side effects (storage, rates,
 * training time, scouting cost) are applied where the numbers live.
 */

export type TechBranch = 'fortify' | 'strike' | 'logistics';

export interface TechDef {
  id: string;
  branch: TechBranch;
  /**
   * Position within the branch; tier n requires tier n-1, and from 4 up more
   * (`requires`). Tier 6 is the capstone (M28 Phase 2).
   */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  desc: string;
  intel: number;
  /** What it costs besides intel (M24 Phase 4). Absent on the first nine. */
  supplies?: number;
  fuel?: number;
  seconds: number;
  /**
   * Its prerequisites, where the branch's own ladder is not the whole of them:
   * the graph's tiers 4 and 5 each need a tech from another branch too.
   */
  requires?: string[];
}

const HOUR = 3600;

/** The tier from which a tech is doctrine (M28 Phase 2): starting one commits the war. */
export const DOCTRINE_TIER = 4;

/** Is this tech past the nine: one only the war's doctrine may buy? */
export const isDoctrineTech = (tech: TechDef): boolean => tech.tier >= DOCTRINE_TIER;

export const TECHS: TechDef[] = [
  // ---- FORTIFY — the defense doctrine ------------------------------------------
  {
    id: 'fortify1',
    branch: 'fortify',
    tier: 1,
    name: 'Reinforced Revetments',
    desc: 'Walls +15% HP',
    intel: 60,
    seconds: 90,
  },
  {
    id: 'fortify2',
    branch: 'fortify',
    tier: 2,
    name: 'Interlocking Fire',
    desc: 'Emplacement & field weapon damage +12%',
    intel: 110,
    seconds: 180,
  },
  {
    id: 'fortify3',
    branch: 'fortify',
    tier: 3,
    name: 'Rapid Entrenchment',
    desc: 'Field defenses & powers cost 20% less CP',
    intel: 170,
    seconds: 300,
  },
  {
    id: 'fortify4',
    branch: 'fortify',
    tier: 4,
    name: 'Layered Defence',
    desc: 'Walls +15% more HP · weapons +8% more',
    intel: 400,
    supplies: 8000,
    fuel: 1500,
    seconds: 4 * HOUR,
    requires: ['fortify3', 'logistics2'],
  },
  {
    id: 'fortify5',
    branch: 'fortify',
    tier: 5,
    name: 'Kill Zones',
    desc: 'Weapons +10% more · CP 10% cheaper again',
    intel: 600,
    supplies: 14000,
    fuel: 3000,
    seconds: 10 * HOUR,
    requires: ['fortify4', 'strike3'],
  },
  {
    id: 'fortify6',
    branch: 'fortify',
    tier: 6,
    name: 'The Last Line',
    desc: 'Command post +25% HP · weapons +8% more',
    intel: 600,
    supplies: 16000,
    fuel: 4000,
    seconds: 16 * HOUR,
    requires: ['fortify5', 'logistics3'],
  },
  // ---- STRIKE — the raid doctrine ------------------------------------------------
  {
    id: 'strike1',
    branch: 'strike',
    tier: 1,
    name: 'Combat Conditioning',
    desc: 'Raid units +12% HP',
    intel: 60,
    seconds: 90,
  },
  {
    id: 'strike2',
    branch: 'strike',
    tier: 2,
    name: 'Marksmanship Doctrine',
    desc: 'Raid unit damage +12%',
    intel: 110,
    seconds: 180,
  },
  {
    id: 'strike3',
    branch: 'strike',
    tier: 3,
    name: 'Rapid Mobilization',
    desc: 'Training time −25%',
    intel: 170,
    seconds: 300,
  },
  {
    id: 'strike4',
    branch: 'strike',
    tier: 4,
    name: 'Veteran Cadres',
    desc: 'Raid units +12% more HP',
    intel: 400,
    supplies: 8000,
    fuel: 2000,
    seconds: 4 * HOUR,
    requires: ['strike3', 'fortify2'],
  },
  {
    id: 'strike5',
    branch: 'strike',
    tier: 5,
    name: 'Deep Strike',
    desc: 'Raid unit damage +12% more · +1 charge of each ordnance',
    intel: 600,
    supplies: 14000,
    fuel: 4000,
    seconds: 10 * HOUR,
    requires: ['strike4', 'logistics3'],
  },
  {
    id: 'strike6',
    branch: 'strike',
    tier: 6,
    name: 'Shock Doctrine',
    desc: 'Raid units +10% more HP · +10% more damage',
    intel: 600,
    supplies: 16000,
    fuel: 4500,
    seconds: 16 * HOUR,
    requires: ['strike5', 'fortify3'],
  },
  // ---- LOGISTICS — the economy doctrine --------------------------------------------
  {
    id: 'logistics1',
    branch: 'logistics',
    tier: 1,
    name: 'Deep Stockpiles',
    desc: 'Supplies & Fuel storage +20%',
    intel: 50,
    seconds: 75,
  },
  {
    id: 'logistics2',
    branch: 'logistics',
    tier: 2,
    name: 'Signals Intercepts',
    desc: 'Scouting costs 40% less Intel',
    intel: 100,
    seconds: 150,
  },
  {
    id: 'logistics3',
    branch: 'logistics',
    tier: 3,
    name: 'Forward Logistics',
    desc: 'Supplies & Fuel generation +15%',
    intel: 160,
    seconds: 270,
  },
  {
    id: 'logistics4',
    branch: 'logistics',
    tier: 4,
    name: 'Field Engineering',
    desc: 'Wreck repairs 30% cheaper',
    intel: 400,
    supplies: 6000,
    fuel: 1000,
    seconds: 4 * HOUR,
    requires: ['logistics3', 'fortify2'],
  },
  {
    id: 'logistics5',
    branch: 'logistics',
    tier: 5,
    name: 'Strategic Reserve',
    desc: 'Converters make 25% more · storage +20% more',
    intel: 600,
    supplies: 12000,
    fuel: 2500,
    seconds: 10 * HOUR,
    requires: ['logistics4', 'strike2'],
  },
  {
    id: 'logistics6',
    branch: 'logistics',
    tier: 6,
    name: 'War Economy',
    desc: 'Supplies & Fuel generation +20% more · converters +25% more',
    intel: 600,
    supplies: 14000,
    fuel: 3000,
    seconds: 16 * HOUR,
    requires: ['logistics5', 'strike3'],
  },
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(
  TECHS.map((t) => [t.id, t]),
);

/** The branches in board order, which is also the order a tie is settled in. */
export const TECH_BRANCHES: TechBranch[] = ['fortify', 'strike', 'logistics'];

/**
 * The doctrine a war's research shows (M28 Phase 2), for a save written
 * before a doctrine was kept: the branch it went furthest past the nine in,
 * counting what it is researching now, and the first of them on a tie. None
 * for a war that has not gone past the nine.
 */
export function doctrineOf(ids: readonly string[]): TechBranch | undefined {
  const depth = (branch: TechBranch): number =>
    ids.filter((id) => TECH_BY_ID[id]?.branch === branch && isDoctrineTech(TECH_BY_ID[id]!)).length;
  let best: TechBranch | undefined;
  for (const branch of TECH_BRANCHES) {
    if (depth(branch) > 0 && (best === undefined || depth(branch) > depth(best))) best = branch;
  }
  return best;
}

/** Every tech a war of this doctrine can buy: the nine, and the top of its own branch. */
export const techsOpenTo = (doctrine: TechBranch): TechDef[] =>
  TECHS.filter((t) => !isDoctrineTech(t) || t.branch === doctrine);

/** Every tech that must be completed first: the one below it in its branch, or its own list. */
export function techPrereqs(tech: TechDef): string[] {
  if (tech.requires) return tech.requires;
  if (tech.tier === 1) return [];
  const prev = TECHS.find((t) => t.branch === tech.branch && t.tier === tech.tier - 1);
  return prev ? [prev.id] : [];
}

/** Aggregated multipliers for a set of completed tech ids. */
export interface ResearchEffects {
  wallHp: number;
  weaponDamage: number;
  cpCost: number;
  /** The command post's health (M28 Phase 2, FORTIFY's capstone). */
  postHp: number;
  unitHp: number;
  unitDamage: number;
  trainTime: number;
  storage: number;
  scoutCost: number;
  rates: number;
  /** What a converter makes from the same supplies (M24 Phase 4). */
  conversion: number;
  /** What a wreck costs to repair, as a share of its price before research. */
  repairs: number;
  /** Charges of each ordnance a town may stock beyond the standing cap. */
  chargeCap: number;
}

/**
 * The graph's tiers add to the branch's multipliers rather than compounding
 * them, and every one is rounded to the thousandth: the battle multipliers
 * ride inside a config, and a replay code carries them to the thousandth, so
 * a value with more places in it would re-fight a different battle.
 */
const milli = (x: number): number => Math.round(x * 1000) / 1000;

export function effectsOf(completed: string[]): ResearchEffects {
  const has = (id: string) => completed.includes(id);
  const add = (...terms: [string, number][]): number =>
    milli(terms.reduce((sum, [id, v]) => sum + (has(id) ? v : 0), 1));
  return {
    wallHp: add(['fortify1', 0.15], ['fortify4', 0.15]),
    weaponDamage: add(['fortify2', 0.12], ['fortify4', 0.08], ['fortify5', 0.1], ['fortify6', 0.08]),
    cpCost: add(['fortify3', -0.2], ['fortify5', -0.1]),
    postHp: add(['fortify6', 0.25]),
    unitHp: add(['strike1', 0.12], ['strike4', 0.12], ['strike6', 0.1]),
    unitDamage: add(['strike2', 0.12], ['strike5', 0.12], ['strike6', 0.1]),
    trainTime: add(['strike3', -0.25]),
    storage: add(['logistics1', 0.2], ['logistics5', 0.2]),
    scoutCost: add(['logistics2', -0.4]),
    rates: add(['logistics3', 0.15], ['logistics6', 0.2]),
    conversion: add(['logistics5', 0.25], ['logistics6', 0.25]),
    repairs: add(['logistics4', -0.3]),
    chargeCap: has('strike5') ? 1 : 0,
  };
}
