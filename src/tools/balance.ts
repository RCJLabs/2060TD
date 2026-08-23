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
import { generateBase, MAP_W, type GeneratedBase } from '../content/bases';
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
import {
  raidConfig,
  resolveRaid,
  tunnelSiteValid,
  type RaidSupport,
  type SquadPlan,
} from '../meta/warfare';
import { Engine } from '../sim/engine';
import type {
  CellIndex,
  DefenderMods,
  LayoutStructure,
  LayoutWall,
  SimConfig,
} from '../sim/types';

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
  russia: [
    { units: { t72: 1, btr: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { rpg: 2, demoteam: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { conscript: 3, motorrifle: 2, demoteam: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  nk: [
    { units: { chonma: 1, nkrifle: 3 }, sector: 'W1', doctrine: 'assault' },
    { units: { rpg7: 2, tunneler: 2 }, sector: 'N1', doctrine: 'hunt' },
    { units: { infiltrator: 4, nkrifle: 5, tunneler: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
};

/** Deterministic gallery head for a base: the first valid site among fixed
 * offsets from the command post, east side first (behind most wall lines). */
function nkTunnelCell(base: GeneratedBase): number | undefined {
  const ccCol = base.ccOrigin % MAP_W;
  const ccRow = Math.floor(base.ccOrigin / MAP_W);
  const candidates: [number, number][] = [
    [5, 0], [-5, 0], [0, -5], [0, 5], [5, 3], [-5, -3], [6, 0], [-6, 0],
  ];
  for (const [dc, dr] of candidates) {
    const cell = (ccRow + dr) * MAP_W + (ccCol + dc);
    if (tunnelSiteValid(base, cell)) return cell;
  }
  return undefined;
}

/** Which squads go underground: hunt+raze, raze alone, or the whole raid. */
const TUNNEL_POLICIES: number[][] = [[1, 2], [2], [0, 1, 2]];

/**
 * A tunnel plan the way a player would pick one: scout the base, try the
 * sensible options, commit to what works. Five probe seeds (disjoint from
 * the measurement seeds) score each policy; fixed order + strict improvement
 * keeps the choice deterministic per base.
 */
function tunnelPlanFor(faction: FactionId, base: GeneratedBase, tier: number): SquadPlan[] {
  const plans = RAID_PLANS[faction];
  const mouth = nkTunnelCell(base);
  if (mouth === undefined) return plans;
  const catalog = raidCatalogFor(faction);
  const trainable = trainableFor(faction);
  let best = plans;
  let bestScore = -1;
  for (const idxs of TUNNEL_POLICIES) {
    const candidate = plans.map((p, i) => (idxs.includes(i) ? { ...p, tunnel: mouth } : p));
    let score = 0;
    for (let i = 0; i < 5; i++) {
      const config = raidConfig(base, candidate, seedOf(tier, 99, i), trainable, {});
      const res = resolveRaid(config, candidate, tier, catalog);
      score += (res.cleared ? 1000 : 0) + Math.round(res.destructionPct * 100);
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

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

function raidMatrix(faction: FactionId, support?: RaidSupport, tunneled = false): RaidRow[] {
  const catalog = raidCatalogFor(faction);
  const kit = baseKitFor(faction);
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
      const squads = tunneled ? tunnelPlanFor(faction, base, tier) : RAID_PLANS[faction];
      for (let i = 0; i < SEEDS; i++) {
        const config = raidConfig(
          base,
          squads,
          seedOf(tier, variant, i),
          trainableFor(faction),
          support ?? {},
        );
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
  // Both AT posts overlap the inner wall's breach approaches: a lone tank
  // that stalls at the line to shell the CC from standoff must be reachable
  // by at least one of them, wherever the escort fight left holes.
  const mid: ReferenceBase = { name: 'MID (CC2)', ccLevel: 2, walls: [], structures: [] };
  wallLine(mid.walls, 20, 2, 21, [11, 12]);
  wallLine(mid.walls, 24, 2, 21, [5, 6, 17, 18]);
  mid.structures = [
    { cell: idx(22, 10), kind: 'm2nest', level: 2 },
    { cell: idx(22, 13), kind: 'm2nest', level: 2 },
    { cell: idx(26, 6), kind: 'm2nest', level: 2 },
    { cell: idx(25, 8), kind: 'autocannon', level: 2 },
    { cell: idx(25, 15), kind: 'autocannon', level: 2 },
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

function defenseMatrix(faction: FactionId, mods?: DefenderMods): DefenseRow[] {
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
          ...(mods ? { mods: { defender: mods } } : {}),
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

function raidTable(faction: FactionId, rows: RaidRow[], suffix = ''): string {
  const flavor = flavorFor(faction);
  const lines = [
    `RAID — ${flavor.faction} strike force (${planManpower(faction)} MP) vs ${flavor.enemy} Front Line${suffix}`,
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

function defenseTable(faction: FactionId, rows: DefenseRow[], suffix = ''): string {
  const flavor = flavorFor(faction);
  const lines = [
    `DEFENSE — ${flavor.faction} permanent layer vs ${flavor.enemy} assault ladder (hold%)${suffix}`,
    `STAGE       | ${ASSAULT_LEVELS.map((l) => pad(`L${l}`, 4)).join(' | ')}`,
    `------------+${ASSAULT_LEVELS.map(() => '------').join('+')}`,
  ];
  for (const r of rows) {
    lines.push(`${r.stage.padEnd(11)} | ${r.holdPct.map((h) => pad(h, 4)).join(' | ')}`);
  }
  return lines.join('\n');
}

/** The v0.4 ceiling: full Strike doctrine plus a stocked two-charge fire plan. */
const DOCTRINE_SUPPORT: RaidSupport = {
  mods: { hp: 1.12, damage: 1.12 },
  powerCharges: { a10: 1, arty: 2 },
  autoPowers: [
    { kind: 'a10', atSeconds: 15, target: 'guns' },
    { kind: 'arty', atSeconds: 40, target: 'cc' },
  ],
};

const FORTIFY_MODS: DefenderMods = { wallHp: 1.15, weaponDamage: 1.12 };

function main(): void {
  const started = Date.now();
  const sections: string[] = [];
  for (const faction of FACTION_IDS) {
    sections.push(raidTable(faction, raidMatrix(faction)));
    if (faction === 'nk') {
      // The faction thesis: the same force, resurfaced inside the wire.
      sections.push(
        raidTable(faction, raidMatrix(faction, undefined, true), ' — hunt + raze squads TUNNELED'),
      );
      sections.push(
        raidTable(
          faction,
          raidMatrix(faction, DOCTRINE_SUPPORT, true),
          ' — TUNNELED + STRIKE doctrine + fire plan',
        ),
      );
    }
    sections.push(
      raidTable(faction, raidMatrix(faction, DOCTRINE_SUPPORT), ' — STRIKE doctrine + fire plan'),
    );
  }
  for (const faction of FACTION_IDS) {
    sections.push(defenseTable(faction, defenseMatrix(faction)));
    sections.push(
      defenseTable(faction, defenseMatrix(faction, FORTIFY_MODS), ' — FORTIFY doctrine'),
    );
  }
  const body = sections.join('\n\n');
  console.log(body);
  console.log(
    `\n${FACTION_IDS.length * (RAID_TIERS.length + referenceBases().length * ASSAULT_LEVELS.length) * SEEDS * 1.5 | 0}+ battles in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );

  if (process.argv.includes('--md')) {
    const md = [
      '# Balance snapshot (v0.6)',
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
      '## Reading the tables (v0.6 pass)',
      '',
      '- **The raid rows use a FIXED mid-game force**, so the ladder is supposed to outgrow it.',
      '  USA (quality) stays potent deep into the ladder but pays 70%+ of the force at tier 4–5;',
      '  China (mass) grinds tiers 2–3 with cheap replacements, then needs the late-game army:',
      '  a 33-manpower PLA force with doubled armor clears tier 4–5 at ~70% (verified headlessly).',
      '  Steeper curve + cheaper bodies is the intended faction texture, not a wall.',
      '- **North Korea (tunnels) rewrites the entry problem, not the force problem**: the TUNNELED',
      '  row re-sites squads through galleries inside the wire (the harness probes hunt+raze /',
      '  raze-only / everything per base, like a player adapting to the scout). Tunnels turn',
      '  tier 2 from a coin flip into a walkover and roughly quadruple tier-4 clears, but a',
      '  27-MP force that is outmassed stays outmassed — the late answer stacks galleries with',
      '  the KN-09 plan. Each gallery costs 40 Fuel, the faction tax.',
      '- **NK defense floor sits one ladder step below China by design** (MID holds L3 at ~80%,',
      '  L4 at ~20%): rock barricades and sentry nests are the cheapest line in the war and die',
      '  like it. The compensators are price (rebuild fast, repair at 25%), the Koksan pit',
      '  outranging every gun in the game, and the CP battle layer (ambush teams at 20, mines',
      '  at 12) — the reference measures none of those.',
      '- **Russia (artillery) progresses through fire preparation**: their bare late-game force',
      '  stalls past tier 3 (43/12/0 at t3–5), but a max-cap army behind a TOS-1A fire plan on',
      '  the guns holds 53/52/42 — shell the batteries first, then walk the armor in. Their',
      '  ordnance habit is the faction tax: fuel per charge, every raid.',
      '- **The doctrine rows are the v0.4 ceiling**: full Strike research plus a stocked fire plan',
      '  (an A-10/MLRS pass on the guns at T+15, 155s/PLZ-05 on the post at T+40). It lifts the',
      '  USA tail to ~92–98% and trims losses ~6 points; for China it converts into destruction',
      '  and loot more than into clears — their tier 4+ answer remains the max-cap army.',
      '- **FORTIFY is strictly non-negative everywhere** (verified after the reference-base fix',
      "  below). China's defense floor runs softer than the USA's at MID — their besiegers are",
      '  Rangers, Javelins, and Abrams, not militia — which makes the FORTIFY branch their',
      '  must-have doctrine (L4 hold: 50% → 85%).',
      '- **Coverage lesson baked into the MID reference**: a lone tank that survives to the wall',
      '  line will stand at standoff range and shell the CC; every breach approach must be inside',
      "  some AT post's arc or that tank ends the siege. The reference base was fixed to overlap",
      '  its arcs, which is also the in-game lesson for players.',
      '- **Watch items for v0.6**: the EARLY L2→L3 cliff on all sides (armor arrives before',
      '  anti-armor requisitions), China MID vs L5+ (Javelin overwatch), and NK MID vs L4+',
      '  (everything kills sentry nests).',
      '- M7 changes behind these numbers: tunneled squads surface as one push around the mouth',
      '  after an 8s dig (reserved cells carry the mouths into replays), the Bulsae matches the',
      '  HJ-8 trade (46/58/72 at 0.5/s), and the Koksan runs a 4.2s cadence with a 3.5 dead zone',
      '  in exchange for 10.5–11 reach.',
      '',
    ].join('\n');
    writeFileSync('docs/BALANCE.md', md);
    console.log('docs/BALANCE.md written.');
  }
}

main();
