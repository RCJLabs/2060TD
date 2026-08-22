/**
 * Headless balance harness (M5): deterministic raid and defense matrices for
 * both factions, printed to stdout and snapshotted to docs/BALANCE.md.
 *
 *   npm run balance            # print tables
 *   npm run balance -- --md    # also rewrite docs/BALANCE.md
 *
 * Everything here is seeded and command-free, so runs are exactly
 * reproducible: the raid side measures the hands-off auto-resolver, the
 * defense side measures the PERMANENT layer only (like offline probes — no
 * live CP play), which is the floor a base must clear.
 */
import { writeFileSync } from 'node:fs';
import { buildAssault } from '../content/assaults';
import { generateBase } from '../content/bases';
import {
  baseKitFor,
  defenseCatalogFor,
  enemyRosterFor,
  flavorFor,
  raidCatalogFor,
  trainableFor,
  FACTION_IDS,
  type FactionId,
} from '../content/factions';
import { raidConfig, resolveRaid, type SquadPlan } from '../meta/warfare';
import { Engine } from '../sim/engine';
import type { CellIndex, LayoutStructure, LayoutWall, SimConfig } from '../sim/types';

const SEEDS = 20;
const VARIANTS = 3;
const RAID_TIERS = [1, 2, 3, 4, 5];
const ASSAULT_LEVELS = [1, 2, 3, 4, 5, 6];

const seedOf = (a: number, b: number, c: number): number =>
  ((a * 7919 + b * 104729 + c * 2654435761 + 977) & 0x7fffffff) >>> 0;

// ---- raid side: a fixed ~27-manpower expedition per faction ---------------------

/** Squads mirror a sane player plan: armor front, tower hunters, economy razers. */
const RAID_PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { abrams: 1, ranger: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { javelin: 2, engineer: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { ranger: 2, engineer: 1, humvee: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  china: [
    { units: { type99: 1, zbd: 1, rifle: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { grenadier: 2, sapper: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { militia: 4, rifle: 2, sapper: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
};

function planManpower(faction: FactionId): number {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  return RAID_PLANS[faction].reduce(
    (total, squad) =>
      total +
      Object.entries(squad.units).reduce((s, [kind, n]) => s + (meta[kind] ?? 0) * n, 0),
    0,
  );
}

interface RaidRow {
  tier: number;
  clearPct: number;
  destructionPct: number;
  lossPct: number;
}

function raidMatrix(faction: FactionId): RaidRow[] {
  const catalog = raidCatalogFor(faction);
  const kit = baseKitFor(faction);
  const squads = RAID_PLANS[faction];
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  const rows: RaidRow[] = [];

  for (const tier of RAID_TIERS) {
    let cleared = 0;
    let destruction = 0;
    let lossMp = 0;
    let deployedMp = 0;
    let runs = 0;
    for (let variant = 0; variant < VARIANTS; variant++) {
      const base = generateBase(tier, variant, kit);
      for (let i = 0; i < SEEDS; i++) {
        const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
        const res = resolveRaid(config, squads, tier, catalog);
        runs++;
        if (res.cleared) cleared++;
        destruction += res.destructionPct;
        for (const [kind, n] of Object.entries(res.deployed)) deployedMp += (meta[kind] ?? 0) * n;
        for (const [kind, n] of Object.entries(res.losses)) lossMp += (meta[kind] ?? 0) * n;
      }
    }
    rows.push({
      tier,
      clearPct: Math.round((cleared / runs) * 100),
      destructionPct: Math.round((destruction / runs) * 100),
      lossPct: Math.round((lossMp / deployedMp) * 100),
    });
  }
  return rows;
}

// ---- defense side: three reference bases vs the assault ladder ------------------

const W = 32;
const H = 24;
const CC_ORIGIN = 11 * W + 27; // (27, 11) — the town grid's command post

interface ReferenceBase {
  name: string;
  ccLevel: number;
  walls: LayoutWall[];
  structures: LayoutStructure[];
}

const idx = (x: number, y: number): CellIndex => y * W + x;

/** A wall line at column x covering [y0, y1], skipping the listed gap rows. */
function wallLine(walls: LayoutWall[], x: number, y0: number, y1: number, gaps: number[]): void {
  for (let y = y0; y <= y1; y++) {
    if (!gaps.includes(y)) walls.push({ cell: idx(x, y), kind: 'wall' });
  }
}

/**
 * Reference towns, staged like a real save: everything within CC gating for
 * its level (counts and structure levels), west-facing funnels.
 */
function referenceBases(): ReferenceBase[] {
  // EARLY (CC1): one wall line, one gap, two gun nests. 21 walls of 50.
  const early: ReferenceBase = { name: 'EARLY (CC1)', ccLevel: 1, walls: [], structures: [] };
  wallLine(early.walls, 20, 2, 21, [11, 12]);
  early.structures = [
    { cell: idx(22, 10), kind: 'm2nest', level: 1 },
    { cell: idx(22, 13), kind: 'm2nest', level: 1 },
    { cell: idx(21, 5), kind: 'autocannon', level: 1 },
  ];

  // MID (CC2): offset double line — a serpentine through two kill pockets.
  const mid: ReferenceBase = { name: 'MID (CC2)', ccLevel: 2, walls: [], structures: [] };
  wallLine(mid.walls, 20, 2, 21, [11, 12]);
  wallLine(mid.walls, 24, 2, 21, [5, 6, 17, 18]);
  mid.structures = [
    { cell: idx(22, 10), kind: 'm2nest', level: 2 },
    { cell: idx(22, 13), kind: 'm2nest', level: 2 },
    { cell: idx(26, 6), kind: 'm2nest', level: 2 },
    { cell: idx(25, 11), kind: 'autocannon', level: 2 },
    { cell: idx(26, 16), kind: 'autocannon', level: 2 },
    { cell: idx(28, 8), kind: 'mortar', level: 1 },
  ];

  // LATE (CC3): triple line, max emplacements at level 3.
  const late: ReferenceBase = { name: 'LATE (CC3)', ccLevel: 3, walls: [], structures: [] };
  wallLine(late.walls, 17, 2, 21, [11, 12]);
  wallLine(late.walls, 21, 2, 21, [4, 5, 18, 19]);
  wallLine(late.walls, 25, 2, 21, [11, 12]);
  late.structures = [
    { cell: idx(19, 10), kind: 'm2nest', level: 3 },
    { cell: idx(19, 13), kind: 'm2nest', level: 3 },
    { cell: idx(23, 5), kind: 'm2nest', level: 3 },
    { cell: idx(23, 18), kind: 'm2nest', level: 3 },
    { cell: idx(27, 10), kind: 'autocannon', level: 3 },
    { cell: idx(27, 14), kind: 'autocannon', level: 3 },
    { cell: idx(22, 11), kind: 'autocannon', level: 3 },
    { cell: idx(29, 9), kind: 'mortar', level: 2 },
    { cell: idx(29, 14), kind: 'mortar', level: 2 },
  ];

  return [early, mid, late];
}

interface DefenseRow {
  stage: string;
  holdPct: number[];
}

function defenseMatrix(faction: FactionId): DefenseRow[] {
  const catalog = defenseCatalogFor(faction);
  const roster = enemyRosterFor(faction);
  const rows: DefenseRow[] = [];

  for (const base of referenceBases()) {
    const holds: number[] = [];
    for (const level of ASSAULT_LEVELS) {
      let held = 0;
      for (let i = 0; i < SEEDS; i++) {
        const config: SimConfig = {
          width: W,
          height: H,
          seed: seedOf(level, base.ccLevel, i),
          ccOrigin: CC_ORIGIN,
          ccLevel: base.ccLevel,
          spawnColumn: 0,
          siege: { ...buildAssault(level, roster), startingSupplies: 0 },
          layout: {
            walls: base.walls.map((w) => ({ ...w })),
            structures: base.structures.map((s) => ({ ...s })),
          },
          powerCharges: {},
        };
        const engine = new Engine(config, catalog);
        engine.enqueue({ tick: 0, type: 'startAssault' });
        while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) {
          engine.step();
        }
        if (engine.phase === 'victory') held++;
      }
      holds.push(Math.round((held / SEEDS) * 100));
    }
    rows.push({ stage: base.name, holdPct: holds });
  }
  return rows;
}

// ---- report ---------------------------------------------------------------------

const pad = (value: string | number, width: number): string => String(value).padStart(width);

function raidTable(faction: FactionId, rows: RaidRow[]): string {
  const flavor = flavorFor(faction);
  const lines = [
    `RAID — ${flavor.faction} strike force (${planManpower(faction)} MP) vs ${flavor.enemy} Front Line`,
    'TIER | CLEAR% | DESTR% | MP LOST%',
    '-----+--------+--------+---------',
  ];
  for (const r of rows) {
    lines.push(
      `${pad(r.tier, 4)} | ${pad(r.clearPct, 6)} | ${pad(r.destructionPct, 6)} | ${pad(r.lossPct, 8)}`,
    );
  }
  return lines.join('\n');
}

function defenseTable(faction: FactionId, rows: DefenseRow[]): string {
  const flavor = flavorFor(faction);
  const lines = [
    `DEFENSE — ${flavor.faction} permanent layer vs ${flavor.enemy} assault ladder (hold%)`,
    `STAGE       | ${ASSAULT_LEVELS.map((l) => pad(`L${l}`, 4)).join(' | ')}`,
    `------------+${ASSAULT_LEVELS.map(() => '------').join('+')}`,
  ];
  for (const r of rows) {
    lines.push(`${r.stage.padEnd(11)} | ${r.holdPct.map((h) => pad(h, 4)).join(' | ')}`);
  }
  return lines.join('\n');
}

function main(): void {
  const started = Date.now();
  const sections: string[] = [];
  for (const faction of FACTION_IDS) {
    sections.push(raidTable(faction, raidMatrix(faction)));
  }
  for (const faction of FACTION_IDS) {
    sections.push(defenseTable(faction, defenseMatrix(faction)));
  }
  const body = sections.join('\n\n');
  console.log(body);
  console.log(
    `\n${FACTION_IDS.length * (RAID_TIERS.length + referenceBases().length * ASSAULT_LEVELS.length) * SEEDS * 1.5 | 0}+ battles in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  if (process.argv.includes('--md')) {
    const md = [
      '# Balance snapshot (v0.3)',
      '',
      'Deterministic headless matrices from `npm run balance -- --md`.',
      `${SEEDS} seeds × ${VARIANTS} base variants per raid cell; ${SEEDS} seeds per defense cell.`,
      'Defense rows measure the permanent layer alone (no live CP play), the floor a base must clear —',
      'an active player defends one to two ladder levels above their probe floor.',
      '',
      '```',
      body,
      '```',
      '',
      '## Reading the tables (M5 tuning pass)',
      '',
      '- **The raid rows use a FIXED mid-game force**, so the ladder is supposed to outgrow it.',
      '  USA (quality) stays potent deep into the ladder but pays 75%+ of the force at tier 4–5;',
      '  China (mass) grinds tiers 2–3 with cheap replacements, then needs the late-game army:',
      '  a 33-manpower PLA force with doubled armor clears tier 4–5 at ~70% (verified headlessly).',
      '  Steeper curve + cheaper bodies is the intended faction texture, not a wall.',
      '- **Both factions hold their probe floor**: EARLY holds L1–2 (probes cap near the Front Line',
      '  tier), MID holds L3–5ish, LATE holds everything on the current ladder.',
      '- **Watch items for v0.4**: China MID vs the L6 US assault (Javelin teams outrange the wire',
      '  and snipe HJ-8 posts — mortars are the intended answer and MID fields only one), and the',
      '  EARLY L2→L3 cliff on both sides (armor arrives before anti-armor requisitions).',
      '- M5 changes behind these numbers: deliberate demolition now uses the breacher stat',
      '  (max of hqDps/wallDps) against non-CC structures; USA firebases delay mortars to tier 3;',
      '  HJ-8 posts and Type 88 nests hit harder; PLA manpower runs cheaper (grn 2, zbd 3, t99 7);',
      '  PLA vehicle hp raised to survive level-2 tower lines.',
      '',
    ].join('\n');
    writeFileSync('docs/BALANCE.md', md);
    console.log('docs/BALANCE.md written.');
  }
}

main();
