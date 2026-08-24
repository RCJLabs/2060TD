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
import { GARRISON_GUN_TRADE } from '../content/garrison';
import {
  generateBase,
  ARCHETYPES,
  MAP_W,
  type ArchetypeId,
  type GeneratedBase,
} from '../content/bases';
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
import { CONDITIONS } from '../content/conditions';
import { RANKS } from '../content/veterancy';
import { STANDING_ORDERS } from '../content/standingOrders';
import { Engine } from '../sim/engine';
import type {
  CellIndex,
  DefenderMods,
  LayoutStructure,
  LayoutWall,
  SimConfig,
  StandingOrders,
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
  un: [
    { units: { leo1: 1, peacekeeper: 1, unmedic: 1 }, sector: 'W1', doctrine: 'assault' },
    { units: { nlaw: 2, unmedic: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { peacekeeper: 2, unsapper: 1, vab: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
};

/**
 * The v1.0 air thesis, offense side: roughly the same manpower, flown. Two
 * squads of rotors and a small ground tail, so the run still has something
 * to hold ground while the air layer works.
 */
const AIR_RAID_PLANS: Record<FactionId, SquadPlan[]> = {
  usa: [
    { units: { reaper: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { reaper: 2 }, sector: 'N1', doctrine: 'assault' },
    { units: { ranger: 2, engineer: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  china: [
    { units: { wz10: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { wz10: 2 }, sector: 'N1', doctrine: 'assault' },
    { units: { rifle: 2, sapper: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  russia: [
    { units: { ka52: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { ka52: 1 }, sector: 'N1', doctrine: 'assault' },
    { units: { motorrifle: 2, demoteam: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  nk: [
    { units: { an2: 4 }, sector: 'W1', doctrine: 'hunt' },
    { units: { an2: 4 }, sector: 'N1', doctrine: 'assault' },
    { units: { nkrifle: 3, tunneler: 1 }, sector: 'S1', doctrine: 'raze' },
  ],
  un: [
    { units: { nh90: 2 }, sector: 'W1', doctrine: 'hunt' },
    { units: { nh90: 2 }, sector: 'N1', doctrine: 'assault' },
    { units: { peacekeeper: 2, unsapper: 1 }, sector: 'S1', doctrine: 'raze' },
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

function planManpower(faction: FactionId, plans: SquadPlan[] = RAID_PLANS[faction]): number {
  const meta = Object.fromEntries(trainableFor(faction).map((t) => [t.kind, t.manpower]));
  return plans.reduce(
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

function raidMatrix(
  faction: FactionId,
  support?: RaidSupport,
  tunneled = false,
  plansOverride?: SquadPlan[],
  shape?: ArchetypeId,
): RaidRow[] {
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
      const base = generateBase(tier, variant, kit, shape);
      const squads =
        plansOverride ?? (tunneled ? tunnelPlanFor(faction, base, tier) : RAID_PLANS[faction]);
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

function defenseMatrix(
  faction: FactionId,
  mods?: DefenderMods,
  extraStructures: LayoutStructure[] = [],
  orders?: StandingOrders,
): DefenseRow[] {
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
            structures: [...base.structures, ...extraStructures].map((s) => ({ ...s })),
          },
          // Orders rows fight with a typically-stocked magazine; bare rows
          // stay empty so every pre-v0.8 number is unchanged.
          powerCharges: orders ? { a10: 2, arty: 1 } : {},
          ...(orders ? { standingOrders: orders } : {}),
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

/**
 * The field-condition rotation (M7). A condition is meant to be a trade, so
 * the only number that matters here is the swing against CLEAR LINE: an easy
 * day has to be measurably easier and a hard day measurably harder, or the
 * rotation is flavour text with a loot multiplier stapled on.
 *
 * One faction is enough — conditions are flat multipliers on both sides, so
 * the ordering they produce is the same everywhere; running all five would
 * quadruple the harness for a table that says the same thing five times.
 */
/**
 * The eight ladder shapes measured against the SAME force at the SAME tiers.
 *
 * The point of an archetype is that it asks a different question, not that it
 * asks the same one louder — so what this table has to show is spread. A row
 * that lands on the compound baseline is a shape that is not doing anything,
 * and a row at 0 or 100 across the board is a wall or a walkover rather than a
 * choice. Loot moves with it: the soft shapes carry more economy, so an easy
 * clear pays for itself and a hard one has to be worth the army.
 */
function archetypeTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `ARCHETYPES — ${flavor.faction} strike force (${planManpower(faction)} MP), clear% by tier`,
    `SHAPE        | FROM | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | DESTR% | MP LOST%`,
    `-------------+------+${RAID_TIERS.map(() => '------').join('+')}+-------+--------+---------`,
  ];
  const withDoctrine = new Set<ArchetypeId>(['bunker', 'star', 'depot']);
  for (const arch of ARCHETYPES) {
    const rows = raidMatrix(faction, undefined, false, undefined, arch.id);
    const clears = rows.map((r) => r.clearPct);
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    const destr = rows.reduce((a, r) => a + r.destructionPct, 0) / rows.length;
    const loss = rows.reduce((a, r) => a + r.lossPct, 0) / rows.length;
    lines.push(
      `${arch.name.padEnd(12)} | ${pad(arch.fromTier, 4)} | ${clears.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(destr.toFixed(0), 6)} | ${pad(loss.toFixed(0), 8)}`,
    );
    // The shapes that stop the reference force get a second row with the
    // doctrine ceiling behind them: a shape you have to prepare for is a
    // shape; a shape nothing opens is a wall.
    if (withDoctrine.has(arch.id)) {
      const armed = raidMatrix(faction, DOCTRINE_SUPPORT, false, undefined, arch.id);
      const ac = armed.map((r) => r.clearPct);
      const am = ac.reduce((a, b) => a + b, 0) / ac.length;
      lines.push(
        `  └ prepared | ${pad('', 4)} | ${ac.map((c) => pad(c, 4)).join(' | ')} | ` +
          `${pad(am.toFixed(1), 5)} | ${pad((armed.reduce((a, r) => a + r.destructionPct, 0) / armed.length).toFixed(0), 6)} | ` +
          `${pad((armed.reduce((a, r) => a + r.lossPct, 0) / armed.length).toFixed(0), 8)}`,
      );
    }
  }
  return lines.join('\n');
}

function conditionTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const baseline = raidMatrix(faction).map((r) => r.clearPct);
  const lines = [
    `FIELD CONDITIONS — ${flavor.faction} strike force (${planManpower(faction)} MP), clear% by tier`,
    `CONDITION    | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | vs CLEAR`,
    `-------------+${RAID_TIERS.map(() => '------').join('+')}+-------+---------`,
  ];
  const meanOf = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const flat = meanOf(baseline);
  for (const condition of CONDITIONS) {
    const rows =
      condition.id === 'clearline'
        ? baseline
        : raidMatrix(faction, { condition }).map((r) => r.clearPct);
    const mean = meanOf(rows);
    const delta = mean - flat;
    lines.push(
      `${condition.label.padEnd(12)} | ${rows.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`, 8)}`,
    );
  }
  return lines.join('\n');
}

/**
 * Veterancy (v1.9). The rank multiplier is small on purpose, so the question
 * this table has to answer is not "does it win more" — a reference plan that
 * already clears everything cannot show a 4% edge. It is "does it bring more
 * men home", because that is what veterancy is FOR: the rank pays in
 * survivors, and survivors are what carry the rank forward.
 *
 * The thin plan is deliberate. At the margin a rank is worth a coin flip; with
 * the reference force behind it every row reads 100 and the table says nothing.
 */
/**
 * Ordered launch delays (v1.15). The same force, the same tiers, the same
 * seeds — only the clock differs. The question a picker has to answer before it
 * earns its row: is WHEN a real choice, or is one schedule simply correct?
 */
/**
 * What a gate costs the rest of the time (v1.17).
 *
 * A gate's VALUE is a live decision — you open it to route the assault into a
 * killzone — and a headless harness cannot play that. What it can price is the
 * standing cost, which is the honest half of the trade: a gate is a door, it
 * carries about half a wall's HP, and it sits in the ring whether or not
 * anybody is at the controls. This measures a raid against rings with 0/2/4/8
 * of their segments swapped for gates, closed and unattended — the base as an
 * offline probe finds it.
 */
function gateTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const COUNTS = [0, 4, 12, 24, 48];
  const lines = [
    `GATES — soft spots in a ${flavor.enemy} ring, unattended, vs the ${flavor.faction} reference force`,
    `GATES | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];
  for (const gates of COUNTS) {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction));
        // Deterministic, evenly spread through the ring: the same segments
        // every run, so the only thing that moves between rows is the count.
        if (gates > 0) {
          const step = Math.max(1, Math.floor(base.walls.length / gates));
          for (let g = 0; g < gates; g++) {
            const wall = base.walls[g * step];
            if (wall) wall.kind = 'gate';
          }
        }
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({ ...squad, slot: at }));
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(Math.round((cleared / runs) * 100));
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(gates, 5)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(Math.round((1 - home / sent) * 100), 8)}`,
    );
  }
  return lines.join('\n');
}

/**
 * Is the ground a trade, or a buff wearing a costume? (v1.19)
 *
 * Terrain arrived with a promise attached: it should change WHICH bases are
 * hard rather than making all of them harder or all of them easier. The bar
 * is the same one field conditions have to clear — and the reading is the
 * SPREAD, not the mean. Ground that lifts the clear rate everywhere is a
 * defender nerf; ground that drops it everywhere is a difficulty spike; ground
 * that does different things to different sheets is terrain.
 *
 * Every row is the same reference force against the same archetypes. FLAT is
 * the pre-v1.19 control — the exact battles docs/BALANCE.md was measured on —
 * and the GROUND rows are the same targets with their real terrain under them,
 * split so a sheet's own character shows rather than averaging away.
 */
function terrainTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `TERRAIN — the ${flavor.faction} reference force vs ${flavor.enemy} posts, flat ground vs real`,
    `GROUND      | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];

  /** One row: every (tier, variant, seed), with terrain on or off. */
  const row = (label: string, ground: boolean, pick?: (variant: number) => boolean): void => {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        if (pick && !pick(variant)) continue;
        const base = generateBase(tier, variant, baseKitFor(faction));
        if (!ground) base.terrainSeed = 0; // the flat control
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({ ...squad, slot: at }));
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(label, 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)}`,
    );
  };

  row('FLAT', false);
  row('GROUND', true);
  // Each variant is a different sheet. If terrain is doing its job these
  // three rows disagree with each other more than they disagree with FLAT.
  for (let v = 0; v < VARIANTS; v++) row(`SHEET ${v + 1}`, true, (variant) => variant === v);
  return lines.join('\n');
}

/**
 * v1.20: is the wall line worth building, and WHICH change earned it?
 *
 * The question is not "how hard is a raid" but "does fortifying do anything",
 * and the honest way to ask it is to take the walls away and see whether the
 * base gets easier. Before v1.20 it got HARDER without them.
 *
 * The table is a 2x2 because an earlier read of it was wrong. Moving the
 * garrison and the gun trade together looked like the garrison had flipped
 * the wall line; holding one still at a time shows the trade did it alone,
 * and the watch is very slightly negative on this axis. What the watch earns
 * is the CLOCK, which this table cannot see — for that, stagger the launch
 * and read `--delay`, or the tempo table in tests/garrison.test.ts.
 */
function garrisonTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `GARRISON — the ${flavor.faction} reference force vs ${flavor.enemy} posts`,
    `CONFIG      | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];

  const row = (label: string, watch: boolean, guns: number, walls: boolean): number => {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction));
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({ ...squad, slot: at }));
          const built = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          // One thing at a time: the watch and the guns move independently, so
          // the table can say which of them is doing the work.
          const config: SimConfig = {
            ...built,
            ...(watch
              ? {}
              : { garrison: undefined, siege: { ...built.siege!, cpPerSecond: 0, cpCap: 1 } }),
            mods: {
              ...built.mods,
              defender: { ...built.mods?.defender, weaponDamage: guns },
            },
            ...(walls ? {} : { layout: { ...built.layout!, walls: [] } }),
          };
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(label, 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)}`,
    );
    return mean;
  };

  const cases: [string, boolean, number][] = [
    ['v1.19', false, 1],
    ['GUNS 0.8', false, GARRISON_GUN_TRADE],
    ['WATCH', true, 1],
    ['SHIPPED', true, GARRISON_GUN_TRADE],
  ];
  const worth: string[] = [];
  for (const [label, watch, guns] of cases) {
    const walls = row(`${label} W`, watch, guns, true);
    const bare = row(`${label} —`, watch, guns, false);
    worth.push(`${label} ${(bare - walls >= 0 ? '+' : '')}${(bare - walls).toFixed(1)}`);
  }
  lines.push('');
  // Positive = the wall line defends the base. Negative = it is doing the
  // attacker a favour, which is what it did until v1.20.
  lines.push(`WALL LINE IS WORTH — ${worth.join('  |  ')}  (clear-rate points to the defender)`);
  return lines.join('\n');
}

/**
 * Air against ground (v1.21), and whether the garrison can answer it.
 *
 * Measured after v1.20, air was the dominant doctrine almost everywhere: it
 * cleared as often or better than a ground push for four factions of five and
 * cost far fewer men in all five. The garrison could not answer it at all —
 * `manpads` sat in the reserve with no doctrine calling for it, because a
 * standing-order rule had no way to ask what it would be shooting at.
 *
 * The row to read is the EDGE: air's clear rate minus ground's. It should not
 * be a large positive number, and it should not swing to a large negative one
 * either — air is meant to buy speed and survival (fewer men lost) rather
 * than better odds against a post that expects it.
 */
function airTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const lines = [
    `AIR — the ${flavor.faction} reference force vs ${flavor.enemy} posts, with and without AA`,
    `FORCE       | ${RAID_TIERS.map((t) => pad(`T${t}`, 5)).join(' | ')} |  MEAN | MP LOST%`,
    `------------+${RAID_TIERS.map(() => '-------').join('+')}+-------+---------`,
  ];

  const row = (label: string, plans: SquadPlan[], aa: boolean): number => {
    const clears: number[] = [];
    let sent = 0;
    let home = 0;
    for (const tier of RAID_TIERS) {
      let cleared = 0;
      let runs = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction));
        for (let i = 0; i < SEEDS; i++) {
          const squads = plans.map((squad, at) => ({ ...squad, slot: at }));
          const built = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          // The control strips the AA order back out, which is what every
          // garrison looked like in v1.20.
          const g = built.garrison!;
          const config: SimConfig = aa
            ? built
            : { ...built, garrison: { ...g, rules: g.rules.filter((r) => r.hostiles !== 'air') } };
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
          if (res.cleared) cleared++;
          runs++;
        }
      }
      clears.push(runs > 0 ? Math.round((cleared / runs) * 100) : 0);
    }
    const mean = clears.reduce((a, b) => a + b, 0) / clears.length;
    lines.push(
      `${pad(label, 11)} | ${clears.map((c) => pad(c, 5)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(sent > 0 ? Math.round((1 - home / sent) * 100) : 0, 8)}`,
    );
    return mean;
  };

  const ground = row('GROUND', RAID_PLANS[faction], true);
  const airBare = row('AIR no AA', AIR_RAID_PLANS[faction], false);
  const airAA = row('AIR +AA', AIR_RAID_PLANS[faction], true);
  lines.push('');
  lines.push(
    `AIR'S EDGE OVER GROUND — without AA ${(airBare - ground >= 0 ? '+' : '')}` +
      `${(airBare - ground).toFixed(1)}  |  with AA ${(airAA - ground >= 0 ? '+' : '')}` +
      `${(airAA - ground).toFixed(1)}  (clear-rate points)`,
  );
  return lines.join('\n');
}

function delayTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  const PATTERNS: { name: string; delays: number[] }[] = [
    { name: 'ALL AT ONCE', delays: [0, 0, 0] },
    { name: 'DEFAULT', delays: [0, 6, 12] },
    { name: 'WIDE', delays: [0, 20, 45] },
    { name: 'SEQUENTIAL', delays: [0, 30, 60] },
    { name: 'LEAD LAST', delays: [12, 6, 0] },
  ];
  const lines = [
    `LAUNCH DELAYS — ${flavor.faction} strike force (${planManpower(faction)} MP), men returned% by tier`,
    `PATTERN     | T+       | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | CLEAR% | SECS | SLOT 1/2/3`,
    `------------+----------+${RAID_TIERS.map(() => '------').join('+')}+-------+--------+------+-----------`,
  ];
  for (const pattern of PATTERNS) {
    const back: number[] = [];
    let cleared = 0;
    let runs = 0;
    let ticks = 0;
    const bySlot = [0, 0, 0].map(() => ({ home: 0, sent: 0 }));
    for (const tier of RAID_TIERS) {
      let home = 0;
      let sent = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction));
        for (let i = 0; i < SEEDS; i++) {
          const squads = RAID_PLANS[faction].map((squad, at) => ({
            ...squad,
            slot: at,
            delay: pattern.delays[at] ?? 0,
          }));
          const config = raidConfig(base, squads, seedOf(tier, variant, i), trainableFor(faction));
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
            const seat = bySlot[ret.slot];
            if (seat) {
              seat.home += ret.returned;
              seat.sent += ret.deployed;
            }
          }
          if (res.cleared) cleared++;
          ticks += res.ticks;
          runs++;
        }
      }
      back.push(Math.round((home / sent) * 100));
    }
    const mean = back.reduce((a, b) => a + b, 0) / back.length;
    lines.push(
      `${pattern.name.padEnd(11)} | ${pad(pattern.delays.join('/'), 8)} | ${back.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(Math.round((cleared / runs) * 100), 6)} | ` +
        `${pad((ticks / runs / 20).toFixed(0), 4)} | ` +
        bySlot.map((seat) => pad(Math.round((seat.home / seat.sent) * 100), 3)).join('/'),
    );
  }
  return lines.join('\n');
}

function veterancyTable(faction: FactionId): string {
  const flavor = flavorFor(faction);
  // The reference force, unchanged. An earlier pass tried thinning it to force
  // the clear rate to the margin; that read as "veterancy does nothing" for
  // China and NK, because a swarm cut in half dies at every rank and a
  // multiplier cannot save a unit that was never going to survive the volley.
  // At full strength the signal is monotone for all five.
  const plan = (vet: number): SquadPlan[] =>
    RAID_PLANS[faction].map((squad, i) => ({ ...squad, slot: i, vet }));
  const lines = [
    `VETERANCY — ${flavor.faction} strike force (${planManpower(faction)} MP), men returned% by tier`,
    `RANK    |  ×   | ${RAID_TIERS.map((t) => pad(`T${t}`, 4)).join(' | ')} |  MEAN | CLEAR%`,
    `--------+------+${RAID_TIERS.map(() => '------').join('+')}+-------+-------`,
  ];
  for (const rank of RANKS) {
    const back: number[] = [];
    let cleared = 0;
    let runs = 0;
    for (const tier of RAID_TIERS) {
      let home = 0;
      let sent = 0;
      for (let variant = 0; variant < VARIANTS; variant++) {
        const base = generateBase(tier, variant, baseKitFor(faction));
        for (let i = 0; i < SEEDS; i++) {
          const squads = plan(rank.mult);
          const config = raidConfig(
            base,
            squads,
            seedOf(tier, variant, i),
            trainableFor(faction),
          );
          const res = resolveRaid(config, squads, tier, raidCatalogFor(faction));
          for (const ret of res.squads) {
            home += ret.returned;
            sent += ret.deployed;
          }
          if (res.cleared) cleared++;
          runs++;
        }
      }
      back.push(Math.round((home / sent) * 100));
    }
    const mean = back.reduce((a, b) => a + b, 0) / back.length;
    lines.push(
      `${rank.name.padEnd(7)} | ${pad(rank.mult.toFixed(2), 4)} | ${back.map((c) => pad(c, 4)).join(' | ')} | ` +
        `${pad(mean.toFixed(1), 5)} | ${pad(Math.round((cleared / runs) * 100), 6)}`,
    );
  }
  return lines.join('\n');
}

function main(): void {
  const started = Date.now();
  const sections: string[] = [];
  // Tuning the rotation means running one table twenty times, not the whole
  // harness twenty times: `npm run balance -- --conditions` is that loop.
  if (process.argv.includes('--shapes')) {
    console.log(archetypeTable('usa'));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--conditions')) {
    console.log(conditionTable('usa'));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--terrain')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(terrainTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--air')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(airTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--garrison')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(garrisonTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--gates')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(gateTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--delay')) {
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(delayTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  if (process.argv.includes('--vet')) {
    // `--vet china` retunes against a swarm instead of an elite handful.
    const pick = FACTION_IDS.find((f) => process.argv.includes(f)) ?? 'usa';
    console.log(veterancyTable(pick));
    console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
    return;
  }
  // UN control experiment: the same 27 MP with the medics swapped for rifles.
  const UN_NO_MEDICS: SquadPlan[] = [
    { units: { leo1: 1, peacekeeper: 2 }, sector: 'W1', doctrine: 'assault' },
    { units: { nlaw: 2, peacekeeper: 1 }, sector: 'N1', doctrine: 'hunt' },
    { units: { peacekeeper: 2, unsapper: 1, vab: 1 }, sector: 'S1', doctrine: 'raze' },
  ];
  // UN defense experiment: the Engineer Corps HQ parked behind the post,
  // its repair aura over the CC and the inner guns.
  const UN_ENG_BAY: LayoutStructure[] = [{ cell: idx(29, 11), kind: 'engBay', level: 1 }];
  // Air cover for the reference line: one mount forward of the wall, one over
  // the command post, which is what a player would actually build.
  const AA_COVER: LayoutStructure[] = [
    { cell: idx(24, 11), kind: 'aa', level: 2 },
    { cell: idx(29, 12), kind: 'aa', level: 2 },
  ];

  for (const faction of FACTION_IDS) {
    sections.push(raidTable(faction, raidMatrix(faction)));
    if (faction === 'un') {
      sections.push(
        raidTable(
          faction,
          raidMatrix(faction, undefined, false, UN_NO_MEDICS),
          ' — CONTROL: medics replaced by riflemen',
        ),
      );
    }
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
    // The air thesis: the maze is irrelevant, the mounts are not.
    sections.push(
      raidTable(
        faction,
        raidMatrix(faction, undefined, false, AIR_RAID_PLANS[faction]),
        ' — AIR RAID (rotors + a ground tail)',
      ),
    );
  }
  sections.push(archetypeTable('usa'));
  sections.push(conditionTable('usa'));
  // The ground has to be a trade, and the reading is the SPREAD, not the mean.
  sections.push(terrainTable('usa'));
  // Fortifying has to be worth something, and the 2x2 says which change made
  // it so — a single-column read of this table is what got it wrong once.
  sections.push(garrisonTable('usa'));
  // Air against ground, per faction: the EDGE is the reading, and it is a
  // shadow of the ground-game spread rather than a fault of its own.
  for (const faction of FACTION_IDS) sections.push(airTable(faction));
  // Veterancy pays in survivors, not in wins, so it is measured per faction:
  // the survival column is the whole claim and the swarms have to show it too.
  for (const faction of FACTION_IDS) sections.push(veterancyTable(faction));
  for (const faction of FACTION_IDS) {
    sections.push(defenseTable(faction, defenseMatrix(faction)));
    sections.push(
      defenseTable(
        faction,
        defenseMatrix(faction, undefined, [], STANDING_ORDERS.holdfast),
        ' — HOLDFAST standing orders',
      ),
    );
    // The defense side of the air thesis: the same ladder, with two mounts
    // that can elevate added to the reference line.
    sections.push(
      defenseTable(faction, defenseMatrix(faction, undefined, AA_COVER), ' — WITH AA COVER'),
    );
    if (faction === 'nk') {
      // The weakest floor gets the full preset comparison.
      sections.push(
        defenseTable(
          faction,
          defenseMatrix(faction, undefined, [], STANDING_ORDERS.counterbattery),
          ' — COUNTERBATTERY standing orders',
        ),
      );
      sections.push(
        defenseTable(
          faction,
          defenseMatrix(faction, undefined, [], STANDING_ORDERS.tripwire),
          ' — TRIPWIRE standing orders',
        ),
      );
    }
    if (faction === 'un') {
      sections.push(
        defenseTable(
          faction,
          defenseMatrix(faction, undefined, UN_ENG_BAY),
          ' — Engineer Corps HQ on the line',
        ),
      );
    }
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
      '# Balance snapshot (v1.20)',
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
      '## Reading the tables (v0.8 pass)',
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
      '- **UN (sustainment) is measured against its own control**: the CONTROL row runs the',
      '  same 27 MP with the medics swapped for riflemen. Medics clear the bar where the fight',
      '  is winnable — tier-1 losses drop ~18 points and tier-3 clears gain ~13 — and go quiet',
      '  where the force is simply outgunned (tier 4+): healing at 22/s loses to two guns',
      '  focused, by design. On defense the Engineer Corps HQ row shows the aura the reference',
      '  can see; the Engineer Revetment (CP layer, 15 hp/s over 3 cells) is the live-play',
      '  tool the reference cannot. Every UN gun is deliberately mid-pack; the faction wins',
      '  by still being there in wave three.',
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
      '- **Standing orders (v0.8) are the offline defense doctrines**: the HOLDFAST rows show',
      '  the probe floor when the garrison spends kill-earned CP by policy (a 1-second command',
      '  cadence and a hard per-battle action budget are the handicap; breach-reactive field',
      '  guns are the payoff). HOLDFAST lifts chokepointed MID layouts two to three ladder',
      '  levels and still collapses when outmassed (NK MID L6 stays 0%); COUNTERBATTERY burns',
      '  the real ordnance stock and TRIPWIRE is the budget option — the NK section compares',
      '  all three. Orders cost supplies upkeep per action and every probe replay re-issues',
      '  them from the config.',
      '- **Base archetypes (v1.6) are eight different questions**, and the ARCHETYPES table',
      '  is what keeps them that way: the shapes have to SPREAD, and none of them may be a',
      '  wall at a tier where it is actually offered. The band runs OPEN CAMP 99% (the',
      '  breather) through COMPOUND 94% (the baseline) to BUNKER COMPLEX 71% (33% at the',
      '  tier it first appears). Prepared rows sit under the three hardest so a shape that',
      '  stops the reference force can be shown to open for a force that planned for it.',
      '- **The bunker complex overturned the obvious design.** "Few walls, many guns" was',
      '  built as more guns and a level deeper, and measured 0% clears at tiers 4 AND 5 —',
      '  with the doctrine ceiling behind the force. The cause is structural: with no wall',
      '  line there is no breach to wait for, so every gun engages from the first second.',
      '  An open base is harder at the SAME gun count, which means the multiplier has to',
      '  come down. It ships at 0.65× guns, one level deeper: fewest positions on the',
      '  board, best dug, and the hardest thing on it that can still be taken.',
      '- **Field conditions (v1.3) are trades, not buffs**, and the FIELD CONDITIONS table is',
      '  what enforces that: the pay must rise with the measured difficulty. The rotation lands',
      '  on ±9 points of clear rate around CLEAR LINE — HARD RAIN is the walkover that pays 0.85×,',
      '  DUG IN / FUEL CRISIS / ATTRITION cost 8–10 points and pay 1.3–1.45×. Two readings matter:',
      '  defender weaponDamage is by far the strongest lever (wall HP alone barely moves a fixed',
      '  force, because softer walls just deliver it to the guns sooner), and BLACKOUT reads as',
      '  exactly neutral here BY CONSTRUCTION — it carries no sim modifiers at all. Its cost is',
      '  that no target can be scouted at any price, so the plan is made against fog and NK loses',
      '  tunnels entirely; a headless matrix that always fights with the layout in hand cannot',
      '  price that, which is why its 1.25× is a judgement and is labelled as one.',
      '- **Veterancy (v1.9) pays in survivors, not in wins**, and the VETERANCY tables are',
      '  the proof: from GREEN to CADRE the mean share of the force that walks home rises for',
      '  every faction (USA 28→34, China 12→16, Russia 18→20, NK 12→20, UN 20→27), while the',
      '  clear rate barely moves for three of the five. That is the intended shape — a rank is',
      '  worth a few men, never a win — and it is self-reinforcing by design, because the men',
      '  who come home are the experience. A +15% top-end multiplier is deliberately too small',
      '  to substitute for bringing enough people.',
      '- **The first veterancy table measured the wrong thing.** It thinned the reference force',
      '  to push the clear rate to the margin, which made the swarm factions read as flat: a',
      '  China or NK plan cut in half dies at every rank, and a 15% HP bump cannot save a unit',
      '  that was never going to survive the volley. Measured at full strength the signal is',
      '  monotone for all five. The lesson is general — a multiplier is invisible at the floor',
      '  and at the ceiling, so it has to be measured where the units were already living.',
      '- **The ground (v1.19) is a trade, and the reading is the SPREAD.** Terrain has to change',
      '  WHICH bases are hard rather than making all of them harder — the same bar field',
      '  conditions clear. It does: GROUND lands 6.6 points under FLAT on the mean, inside the',
      '  ±9 band, while the three sheets disagree with each other by forty points. Two of them',
      '  are walkovers for the reference force and one stops it dead at T3 and T5. That is the',
      '  whole point of putting a base somewhere rather than nowhere.',
      '- **The first cut of terrain was a difficulty spike, and the harness said which term did',
      '  it.** GROUND opened at 33 points under FLAT. Switching the elevation multiplier off',
      '  put it at 93.0 against 93.4 — meaning water, cover and movement cost together',
      '  accounted for almost NONE of the drop and elevation accounted for all of it. The',
      '  mockup had proposed +40% reach on the top band; it ships at +15%.',
      '- **That was the third time this project learned the same thing**: a raid is decided',
      '  by GUN COVERAGE, not by route length or wall HP. Field conditions found it (defender',
      '  weaponDamage is by far the strongest lever, wall HP barely moves a fixed force), gates',
      '  found it (48 doors in a ring moved the clear rate by one point, because attackers',
      '  route rather than breach), and terrain found it again. v1.20 went after the cause',
      '  rather than working around it a fourth time — see the GARRISON table above.',
      '- **The cause was that a raid charged nothing for TIME (v1.20).** `raidConfig` set',
      '  cpPerSecond 0 and cpCap 1, so a defending post had no economy, and the standing-orders',
      '  evaluator bailed on the attacker side, so nothing it might have bought could be spent.',
      '  A Front Line base was a diorama. Route length and wall HP can only ever spend the',
      '  attacker’s time, and time was free — so the whole fortification layer was priced at',
      '  zero. It was in fact priced BELOW zero: stripping every wall out of a generated base',
      '  made it EASIER to hold, 86.7 against 81.5, because the maze’s one real effect was',
      '  steering raiders AROUND the guns.',
      '- **Two faults, two fixes, and they had to be separated to be seen.** The GARRISON',
      '  table is a 2x2 for a reason: a first read moved the watch and the gun trade together',
      '  and credited the watch with the wall line. Held still one at a time, GUNS 0.8 alone',
      '  takes the wall line from -5.0 to +8.6 with the clear rate unmoved, and the watch is',
      '  slightly negative on that axis (+6.6 shipped). Weaker guns let attackers live longer',
      '  in the open, so a wall that holds a force in a corridor under fire finally outweighs',
      '  a maze that routes them past the shooting.',
      '- **What the watch earns is the CLOCK, which this table cannot see.** Measured by',
      '  staggering the same three squads instead of launching them together, over 1200 raids',
      '  a cell: a 60-second stagger costs 5.1 points unwatched and 8.3 watched. A concentrated',
      '  push arrives before the reserve exists; a dawdling one walks into guns that were not',
      '  there when it set off. Targeting is the whole of it — ccApproach and breach both',
      '  measured indistinguishable from having no garrison at all, because a last stand at',
      '  the objective comes after the corridor has already been walked for free.',
      '- **The method lesson is the one worth keeping.** A test written against the first,',
      '  wrong read PASSED with the garrison deleted, because it moved two things and asserted',
      '  on the sum. tests/garrison.test.ts now moves one thing per test, and each claim was',
      '  checked to FAIL when its own cause is reverted and to SURVIVE when the other is.',
      '- **The fords are the one thing that came out backwards.** A river with a single bridge',
      '  is a chokepoint worth more than any wall, so two fords were added — and they did not',
      '  move the clear rate at all. What they moved was the butcher’s bill, the wrong way:',
      '  losses rose from 85% to 91% on the hardest sheet, because a force that splits across',
      '  three crossings arrives piecemeal, and piecemeal is how you die. Three doors is worse',
      '  than one if you insist on using all of them.',
      '- **Woodland is a trade because artillery ignores it.** Cover applies to aimed fire and',
      '  not to a barrage or mortar splash: canopy hides a man from a gunner, not from',
      '  something that lands in the trees. That asymmetry is what stops it being a free',
      '  hiding place, and it is what gives the fire-mission layer something to answer.',
      '- **Terrain moved the veterancy fixture onto the floor, which is its own lesson.** The',
      '  survival test measures a thin 5R1A push at tier 4; with ground under it, GREEN and',
      '  CADRE bring home exactly the same men, because a 15% HP bump cannot save a unit that',
      '  was never going to survive the volley. It measures on flat ground now — the same',
      '  correction the first veterancy table needed, for the same reason.',
      '- **Watch items for v0.6**: the EARLY L2→L3 cliff on all sides (armor arrives before',
      '  anti-armor requisitions), China MID vs L5+ (Javelin overwatch), and NK MID vs L4+',
      '  (everything kills sentry nests).',
      '- M7 changes behind these numbers: tunneled squads surface as one push around the mouth',
      '  after an 8s dig (reserved cells carry the mouths into replays), the Bulsae matches the',
      '  HJ-8 trade (46/58/72 at 0.5/s), the Koksan runs a 4.2s cadence with a 3.5 dead zone',
      '  in exchange for 10.5–11 reach, and v0.7 adds sustainment auras: healing is additive,',
      '  capped per target, and deterministic — it out-heals one gun, never two.',
      '',
    ].join('\n');
    writeFileSync('docs/BALANCE.md', md);
    console.log('docs/BALANCE.md written.');
  }
}

main();
