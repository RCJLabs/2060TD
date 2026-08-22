/**
 * The research tree (M6, v0.4): nine doctrines in three branches, paid in
 * Intel from the Signals Station and researched one at a time.
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
  /** Position within the branch; tier n requires tier n-1. */
  tier: 1 | 2 | 3;
  name: string;
  desc: string;
  intel: number;
  seconds: number;
}

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
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(
  TECHS.map((t) => [t.id, t]),
);

/** The tech that must be completed first, or null for tier 1. */
export function techPrereq(tech: TechDef): string | null {
  if (tech.tier === 1) return null;
  const prev = TECHS.find((t) => t.branch === tech.branch && t.tier === tech.tier - 1);
  return prev ? prev.id : null;
}

/** Aggregated multipliers for a set of completed tech ids. */
export interface ResearchEffects {
  wallHp: number;
  weaponDamage: number;
  cpCost: number;
  unitHp: number;
  unitDamage: number;
  trainTime: number;
  storage: number;
  scoutCost: number;
  rates: number;
}

export function effectsOf(completed: string[]): ResearchEffects {
  const has = (id: string) => completed.includes(id);
  return {
    wallHp: has('fortify1') ? 1.15 : 1,
    weaponDamage: has('fortify2') ? 1.12 : 1,
    cpCost: has('fortify3') ? 0.8 : 1,
    unitHp: has('strike1') ? 1.12 : 1,
    unitDamage: has('strike2') ? 1.12 : 1,
    trainTime: has('strike3') ? 0.75 : 1,
    storage: has('logistics1') ? 1.2 : 1,
    scoutCost: has('logistics2') ? 0.6 : 1,
    rates: has('logistics3') ? 1.15 : 1,
  };
}
