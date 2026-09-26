/**
 * M24 Phase 1: where a player's time and supply actually go.
 *
 * Every instrument before this one pointed at a battle. This one points at
 * the town, and reads it off the real town functions — `caps`, `ratesPerHour`,
 * `tick`, `place`, `upgrade`, `startResearch` — rather than off a model of them,
 * so what it says about the economy is what the game does.
 *
 * STAGES has no player in it: a Command Center level with its whole allowance
 * built, and what that town makes, keeps and costs. A PLAYED FORTNIGHT has one:
 * a commander who checks in at a fixed cadence and buys production, then
 * storage, intel, the Command Center and the rest, the cheapest first within
 * each, with every resource that moves booked to where it came from and where
 * it went. WHAT A DEFENCE COSTS (M24 Phase 2) puts the war back in: what a
 * siege pays against what it breaks, both in hours of the stage's production.
 * Since M24 Phase 4 the commander also builds the works that convert supplies
 * and buys the research graph, the top of which costs supplies and fuel.
 */
import { assaultLoot, buildAssault } from '../content/assaults';
import { generateBase, lootFor } from '../content/bases';
import { BUILDABLE_KINDS, CC_GATING, OFFLINE_CAP_HOURS } from '../content/buildings';
import { CONTRACTS, CONTRACTS_PER_DAY, contractsAt } from '../content/contracts';
import { creditContracts } from '../meta/contracts';
import {
  baseKitFor,
  defenseCatalogFor,
  enemyRosterFor,
  townMetaFor,
  type FactionId,
} from '../content/factions';
import { LADDER_EPOCH } from '../content/leagues';
import { effectsOf, TECH_BRANCHES, TECHS, techsOpenTo, type TechBranch } from '../content/research';
import type { HeadStartId } from '../content/prestige';
import { applyHeadStart, newCareer } from '../meta/career';
import type { LadderSettlement } from '../meta/ladder';
import {
  accrue,
  canPlace,
  canResearch,
  caps,
  countOf,
  cumulativeCost,
  gating as gatingOf,
  isUnlocked,
  newTown,
  outcomeFromEngine,
  place,
  baseRatesPerHour,
  conversionPerHour,
  productionPerHour,
  trainingDiscount,
  yardOutput,
  repairCost,
  siegeConfig,
  startResearch,
  tick,
  townCc,
  unlockAll,
  upgrade,
  upgradeError,
  TOWN_GRID,
  type TownState,
} from '../meta/town';
import { Engine } from '../sim/engine';
import { referenceBases, type ReferenceBase } from './referenceBases';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const RESOURCES = ['supplies', 'fuel', 'intel'] as const;
type Resource = (typeof RESOURCES)[number];
export type Amounts = Record<Resource, number>;
export const zero = (): Amounts => ({ supplies: 0, fuel: 0, intel: 0 });

const pad = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s);
const k = (n: number): string => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(0)}k` : `${Math.round(n)}`);
const pct = (part: number, whole: number): string => (whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : '—');

/** The order a commander who wants a bigger town buys in (see `buyOne`). */
const TIERS: string[][] = [
  ['supplyDepot', 'fuelDepot'],
  ['storageBunker'],
  ['radar'],
  ['cc'],
  [
    'engBay',
    'generator',
    'refinery',
    'bureau',
    'm2nest',
    'autocannon',
    'mortar',
    'aa',
    'barracks',
    'motorpool',
    'airfield',
  ],
];

/** Where a purchase is booked. */
const CATEGORY: Record<string, string> = {
  cc: 'command center',
  supplyDepot: 'production',
  fuelDepot: 'production',
  radar: 'production',
  storageBunker: 'storage',
  generator: 'production',
  refinery: 'works',
  bureau: 'works',
  engBay: 'facilities',
  barracks: 'facilities',
  motorpool: 'facilities',
  airfield: 'facilities',
  m2nest: 'defences',
  autocannon: 'defences',
  mortar: 'defences',
  aa: 'defences',
};

/**
 * A town at `cc` with that stage's whole allowance built, every piece at the
 * stage's top level. Cells are left off the board on purpose: nothing read
 * from it here asks where anything stands.
 */
export function builtOut(faction: FactionId, cc: number): TownState {
  const town = unlockAll(newTown(LADDER_EPOCH, faction));
  const gate = CC_GATING[cc - 1]!;
  town.structures = [{ id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: cc, wrecked: false }];
  let id = 2;
  for (const kind of BUILDABLE_KINDS) {
    const meta = townMetaFor(faction)[kind]!;
    const level = Math.min(gate.maxStructureLevel, meta.levels.length);
    for (let i = 0; i < (gate.counts[kind] ?? 0); i++) {
      town.structures.push({ id, kind, cell: -id, level, wrecked: false });
      id++;
    }
  }
  town.nextId = id;
  return town;
}

/** What a town's buildings cost to put up, the Command Center's upgrades included. */
function worth(town: TownState): { supplies: number; fuel: number } {
  let supplies = 0;
  let fuel = 0;
  for (const s of town.structures) {
    const c = cumulativeCost(town, s.kind, s.level);
    supplies += c.supplies;
    fuel += c.fuel;
  }
  return { supplies, fuel };
}

/** Everything a stage allows, bought: every kind at its count and every piece at the stage's top level. */
function isBuiltOut(town: TownState, cc: number): boolean {
  const gate = CC_GATING[cc - 1]!;
  if (townCc(town).level < cc) return false;
  for (const kind of BUILDABLE_KINDS) {
    if (countOf(town, kind) < (gate.counts[kind] ?? 0)) return false;
  }
  const top = (kind: string): number => Math.min(gate.maxStructureLevel, townMetaFor(town.faction)[kind]!.levels.length);
  return town.structures.every(
    (s) => s.kind === 'cc' || (s.level >= top(s.kind) && s.buildEndsAt === undefined && !s.wrecked),
  );
}

// ---- STAGES ----------------------------------------------------------------------

function stageTable(faction: FactionId): string[] {
  const lines = [
    `STAGES — ${faction.toUpperCase()}: a Command Center level with its whole allowance built, every piece at the stage's top level`,
    'STAGE | MAKES AN HOUR      | STORES               | FULL FROM EMPTY (h) | 8 HOURS MAKE   | 8 HOURS KEEP (S F) | BUILD-OUT FROM THE STAGE BEFORE',
  ];
  let before = worth(unlockAll(newTown(LADDER_EPOCH, faction)));
  let beforeRate: Amounts | null = null;
  for (let cc = 1; cc <= 3; cc++) {
    const town = builtOut(faction, cc);
    // The stage's rate before the yard (M24 Phase 3): its buildings stand off
    // the board here, where nothing is powered or beside anything.
    const rate = baseRatesPerHour(town);
    const cap = caps(town);
    const full = RESOURCES.map((r) => (rate[r] > 0 ? (cap[r] / rate[r]).toFixed(1) : '—'));
    const made8 = { supplies: rate.supplies * 8, fuel: rate.fuel * 8 };
    const kept =
      `${pct(Math.min(cap.supplies, made8.supplies), made8.supplies)} ` +
      `${pct(Math.min(cap.fuel, made8.fuel), made8.fuel)}`;
    const now = worth(town);
    const cost = { supplies: now.supplies - before.supplies, fuel: now.fuel - before.fuel };
    // In hours of the production the stage before it had, fully built: what
    // saving for this stage takes. The first stage has no stage before it, so
    // it is priced in its own.
    const paying = beforeRate ?? rate;
    const hours = Math.max(cost.supplies / Math.max(1, paying.supplies), cost.fuel / Math.max(1, paying.fuel));
    lines.push(
      `CC${cc}   | ${pad(`${rate.supplies} S ${rate.fuel} F ${rate.intel} I`, 18)} | ` +
        `${pad(`${cap.supplies} S ${cap.fuel} F ${cap.intel} I`, 20)} | ` +
        `${pad(full.join(' / '), 19)} | ${pad(`${k(made8.supplies)} S ${k(made8.fuel)} F`, 14)} | ` +
        `${pad(kept, 18)} | ${k(cost.supplies)} S ${k(cost.fuel)} F, ${hours.toFixed(1)} h of ` +
        `${beforeRate ? `CC${cc - 1}'s` : 'its own'} production`,
    );
    before = now;
    beforeRate = rate;
  }

  // What the battles pay, in hours of each stage's production. A siege pays
  // for every wave it holds and a bonus for holding the lot; Phase 1 read the
  // bonus alone, which is under half of it. Salvage, the CP left unspent at the
  // end, is left out: it is whatever the commander did not use.
  const contractDay =
    (CONTRACTS.reduce((sum, c) => sum + c.pay.supplies, 0) / CONTRACTS.length) * CONTRACTS_PER_DAY;
  const siege = (level: number): number => {
    const def = buildAssault(level, enemyRosterFor(faction));
    return assaultLoot(level).supplies + def.waves.length * def.suppliesPerWave;
  };
  const raid = (tier: number): number => {
    const base = generateBase(tier, 0, baseKitFor(faction), undefined, faction);
    let loot = lootFor('cc', tier).supplies;
    for (const s of base.structures) loot += lootFor(s.kind, tier).supplies;
    return loot;
  };
  const pays: [string, number][] = [
    ['a siege held at level 3', siege(3)],
    ['a siege held at level 8', siege(8)],
    ['a siege held at level 15', siege(15)],
    ['a day of three orders, on average', contractDay],
    ['a tier-1 post razed to the ground', raid(1)],
    ['a tier-5 post razed to the ground', raid(5)],
  ];
  lines.push('');
  lines.push("WHAT THE BATTLES PAY, in supplies and in hours of each stage's supply production");
  lines.push(`${pad('', 36)} | SUPPLIES |   CC1 |   CC2 |   CC3`);
  const rates = [1, 2, 3].map((cc) => baseRatesPerHour(builtOut(faction, cc)).supplies);
  for (const [label, supplies] of pays) {
    lines.push(
      `${pad(label, 36)} | ${pad(k(supplies), 8)} | ` + rates.map((r) => pad((supplies / r).toFixed(1), 5)).join(' | '),
    );
  }
  return lines;
}

// ---- WHAT A DEFENCE COSTS -------------------------------------------------------------

/**
 * A reference defence as a town: the post at the base's level, and the guns
 * and walls where the balance harness draws them, with nothing in the store.
 */
export function referenceTown(base: ReferenceBase, faction: FactionId): TownState {
  const town = unlockAll(newTown(LADDER_EPOCH, faction));
  town.structures = [{ id: 1, kind: 'cc', cell: TOWN_GRID.ccOrigin, level: base.ccLevel, wrecked: false }];
  let id = 2;
  for (const s of base.structures) {
    town.structures.push({ id: id++, kind: s.kind, cell: s.cell, level: s.level ?? 1, wrecked: false });
  }
  town.nextId = id;
  town.walls = base.walls.map((w) => ({ ...w }));
  town.supplies = 0;
  town.fuel = 0;
  return town;
}

export interface Fought {
  held: boolean;
  /** What the battle's own supply line paid, its waves and salvage, and the bonus on a hold. */
  pay: { supplies: number; fuel: number };
  /** What putting back everything it wrecked costs. */
  wrecks: { supplies: number; fuel: number };
  /** The part of that which was buildings rather than guns (M24 Phase 3). */
  yardWrecks: { supplies: number; fuel: number };
}

const GUN_KINDS = new Set(['m2nest', 'autocannon', 'mortar', 'aa']);

/**
 * One siege against a reference town, fought as the town fights one — through
 * `siegeConfig` — with nobody acting, which is the harness's bare row, and on
 * the flat ground the harness fights on, so the levels line up with the
 * defence tables in docs/BALANCE.md. Priced as `foldBattle` and
 * `applySiegeResult` price it: the battle's own supplies come home, a hold
 * adds the bonus, and everything that did not come out of it is a wreck at the
 * town's own repair price.
 */
export function fightSiege(town: TownState, level: number, seed: number): Fought {
  town.assaultLevel = level;
  const config = siegeConfig(town, seed);
  delete config.terrainSeed;
  delete config.terrainVersion;
  const engine = new Engine(config, defenseCatalogFor(town.faction));
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) engine.step();
  const outcome = outcomeFromEngine(engine);
  const standing = new Set(outcome.survivors.map((s) => s.cell));
  // Wrecked as `foldBattle` wrecks them, then priced, so a repair is priced
  // against what is still standing beside it: an Engineering Bay the battle
  // took with it halves nothing. Put back afterwards; the town is reused.
  const broke = town.structures.filter((s) => s.kind !== 'cc' && !s.wrecked && !standing.has(s.cell));
  for (const s of broke) s.wrecked = true;
  const wrecks = { supplies: 0, fuel: 0 };
  const yardWrecks = { supplies: 0, fuel: 0 };
  for (const s of broke) {
    const cost = repairCost(town, s);
    wrecks.supplies += cost.supplies;
    wrecks.fuel += cost.fuel;
    if (!GUN_KINDS.has(s.kind)) {
      yardWrecks.supplies += cost.supplies;
      yardWrecks.fuel += cost.fuel;
    }
  }
  for (const s of broke) s.wrecked = false;
  const bonus = outcome.victory ? assaultLoot(level) : { supplies: 0, fuel: 0 };
  return {
    held: outcome.victory,
    pay: { supplies: outcome.supplies + bonus.supplies, fuel: bonus.fuel },
    wrecks,
    yardWrecks,
  };
}

/**
 * WHAT A DEFENCE COSTS (M24 Phase 2): each reference defence fought through
 * its band, from the last level it holds every time to the first it never
 * holds, with what a hold pays and what the battle wrecks, in supplies and in
 * hours of that stage's production.
 *
 * Guns only: the harness's defences have no depots on the board, and where a
 * player puts theirs is theirs to decide. So a real town's bill is this one
 * plus whatever of its economy stood in the way.
 */
function defenceTable(faction: FactionId, seeds = 12): string[] {
  const lines = [
    `WHAT A DEFENCE COSTS — ${faction.toUpperCase()}: the reference defences through their band, ` +
      `nobody acting, ${seeds} seeds a level; S+F, then hours of the stage's supply production`,
  ];
  const sf = (a: { supplies: number; fuel: number }): string => `${Math.round(a.supplies)}+${Math.round(a.fuel)}`;
  for (const base of referenceBases()) {
    const town = referenceTown(base, faction);
    const perHour = baseRatesPerHour(builtOut(faction, base.ccLevel)).supplies;
    const flattened = { supplies: 0, fuel: 0 };
    for (const s of town.structures) {
      if (s.kind === 'cc') continue;
      const cost = repairCost(town, s);
      flattened.supplies += cost.supplies;
      flattened.fuel += cost.fuel;
    }
    lines.push('');
    lines.push(
      `${base.name}: ${town.structures.length - 1} guns; every one of them wrecked is ${sf(flattened)} ` +
        `to repair, ${(flattened.supplies / perHour).toFixed(1)} h of CC${base.ccLevel}'s production`,
    );
    lines.push('LEVEL | HELD | A HOLD PAYS | ITS WRECKS | NET, IN HOURS | A LOSS PAYS | ITS WRECKS');
    let pending: string | null = null;
    for (let level = 1; level <= 30; level++) {
      const held: Fought[] = [];
      const lost: Fought[] = [];
      for (let i = 0; i < seeds; i++) {
        const fought = fightSiege(town, level, (level * 7919 + i * 104_729 + base.ccLevel) >>> 0);
        (fought.held ? held : lost).push(fought);
      }
      const mean = (xs: Fought[], pick: (f: Fought) => { supplies: number; fuel: number }) => ({
        supplies: xs.reduce((n, f) => n + pick(f).supplies, 0) / Math.max(1, xs.length),
        fuel: xs.reduce((n, f) => n + pick(f).fuel, 0) / Math.max(1, xs.length),
      });
      const holdPay = mean(held, (f) => f.pay);
      const holdWrecks = mean(held, (f) => f.wrecks);
      const lossPay = mean(lost, (f) => f.pay);
      const lossWrecks = mean(lost, (f) => f.wrecks);
      const row =
        `${pad(String(level), 5)} | ${pad(pct(held.length, seeds), 4)} | ` +
        `${pad(held.length ? sf(holdPay) : '—', 11)} | ${pad(held.length ? sf(holdWrecks) : '—', 10)} | ` +
        `${pad(held.length ? `${((holdPay.supplies - holdWrecks.supplies) / perHour).toFixed(1)}` : '—', 13)} | ` +
        `${pad(lost.length ? sf(lossPay) : '—', 11)} | ${lost.length ? sf(lossWrecks) : '—'}`;
      if (held.length === seeds) {
        // Only the last level it holds every time is worth a row.
        pending = row;
        continue;
      }
      if (pending) lines.push(pending);
      pending = null;
      lines.push(row);
      if (held.length === 0) break;
    }
  }
  lines.push('');
  lines.push(
    'A loss also costs 15% of what is in the store (DEFEAT_LOSS_FRACTION). A hold with nobody acting ' +
      'banks every CP it earned as salvage, which a commander spends.',
  );
  return lines;
}

// ---- A PLAYED FORTNIGHT ---------------------------------------------------------------

/** What `advanceBooked` books of the time that passes. */
export interface Accruals {
  /** What the depots made, whether or not anything kept it. */
  made: Amounts;
  /** What reached the stockpile. */
  banked: Amounts;
  /** Made while storage was full. */
  atCap: Amounts;
  /** Made past the eight hours an absence accrues for. */
  pastOffline: Amounts;
  /** Supplies the converters took, and the fuel and intel they made of them. */
  converted: Amounts;
  /** What a season closing paid, which `tick` pays on top of the cap. */
  placements: Amounts;
  /** Supplies the line to the front took (M25 Phase 3). */
  front: number;
  /** The quartermasters' deliveries (M28 Phase 3), before any cap: income that is not production. */
  delivered: Amounts;
}

interface Ledger extends Accruals {
  contracts: Amounts;
  spent: Record<string, { supplies: number; fuel: number }>;
  /** What research cost, in all three. */
  research: Amounts;
}

export interface Run {
  sessionsPerDay: number;
  ledger: Ledger;
  /** Days from the first session to each milestone, or null if it never came. */
  milestones: Record<string, number | null>;
  /** When the last thing was bought, in days. */
  lastPurchase: number;
  /**
   * Supplies made with nothing left to buy: the town built out, and every tech
   * its doctrine can buy researched or in progress.
   */
  idleMade: number;
  /** Supplies made once the town was built out, research or not: Phase 3's reading. */
  builtOutMade: number;
}

/** Board cells nearest the post first: where a commander puts buildings. */
function cellsByDistance(): number[] {
  const { width, height, ccOrigin } = TOWN_GRID;
  const cx = ccOrigin % width;
  const cy = Math.floor(ccOrigin / width);
  const cells = Array.from({ length: width * height }, (_, i) => i);
  const d = (i: number): number => (((i % width) - cx) ** 2 + (Math.floor(i / width) - cy) ** 2) * 1000 + i;
  return cells.sort((a, b) => d(a) - d(b));
}

/**
 * The legal cell where `kind` makes the town the most (see `yardValue`),
 * nearest the post among equals. It stands a level-1 building there and asks,
 * which is what the ghost shows a player before they commit.
 */
function bestCell(town: TownState, kind: string, cells: number[]): number | undefined {
  let best: number | undefined;
  let bestValue = -Infinity;
  const id = town.nextId;
  for (const cell of cells) {
    if (canPlace(town, kind, cell) !== null) continue;
    town.structures.push({ id, kind, cell, level: 1, wrecked: false });
    const value = yardValue(town);
    town.structures.pop();
    if (value > bestValue + 1e-9) {
      best = cell;
      bestValue = value;
    }
  }
  return best;
}

/**
 * Where a commander puts what they buy. NAIVE is the first free cell nearest
 * the post, which is what the fortnight has always done. YARD (M24 Phase 3)
 * takes the free cell that makes the town the most — power and neighbours
 * counted — and the nearest one among equals, so a building the yard does not
 * read still goes where it always went.
 */
export type Placement = 'naive' | 'yard';

/**
 * What the town makes, in depot-equivalents: each resource over what one
 * level-1 producer of it makes, so a point of intel counts for as much as a
 * point of supplies. A facility beside its partner depot is worth a sliver on
 * top, which only ever breaks a tie.
 */
export function yardValue(town: TownState): number {
  // What the producers make, and not what reaches the store: a converter takes
  // from the one to make the other, and its cell decides only its power.
  const rate = productionPerHour(town);
  const meta = townMetaFor(town.faction);
  let value =
    rate.supplies / meta['supplyDepot']!.generatesSupplies![0]! +
    rate.fuel / meta['fuelDepot']!.generatesFuel![0]! +
    rate.intel / meta['radar']!.generatesIntel![0]!;
  for (const s of town.structures) {
    // A converter at full power counts as a depot's worth, out of power half.
    if (meta[s.kind]?.converts) value += yardOutput(town, s);
    if (trainingDiscount(town, s) > 0) value += 0.01;
  }
  return value;
}

/**
 * Advance a town to `now` through the real `tick`, booking what it did. The
 * stores it should reach come from `accrue`, which is what `tick` applies, and
 * the converters' part of them is booked apart from what the producers made.
 * Anything else `tick` pays is a season placement.
 */
export function advanceBooked(town: TownState, now: number, books: Accruals): LadderSettlement {
  const elapsed = Math.max(0, now - town.lastSeen);
  const counted = Math.min(elapsed, OFFLINE_CAP_HOURS * HOUR);
  const rate = productionPerHour(town);
  const gained = accrue(town, counted);
  const expected = zero();
  for (const r of RESOURCES) {
    const made = (rate[r] * elapsed) / HOUR;
    const gain = (rate[r] * counted) / HOUR;
    const held = town[r];
    books.made[r] += made;
    books.pastOffline[r] += made - gain;
    const banked = gained[r] - held;
    books.banked[r] += banked;
    if (r === 'supplies') books.front += gained.fed;
    // Lost to a full store: what came in and was neither kept nor handed on
    // to a converter. Supplies go into the works and fuel and intel come out.
    const taken = gained.converted[r];
    books.converted[r] += taken;
    // The line to the front is fed out of supplies before anything is banked.
    const fed = r === 'supplies' ? gained.fed : 0;
    // The quartermasters' deliveries come in beside production (M28 Phase 3).
    const delivered = r === 'intel' ? 0 : gained.delivered[r];
    books.delivered[r] += delivered;
    books.atCap[r] += (r === 'supplies' ? gain - taken - fed : gain + taken) + delivered - banked;
    expected[r] = gained[r];
  }
  const settled = tick(town, now);
  // Anything else `tick` paid is a season placement; nothing else pays there,
  // and nothing in it takes away.
  for (const r of RESOURCES) {
    const extra = town[r] - expected[r];
    if (extra < -1e-6) throw new Error(`the economy instrument lost track of ${r}: ${town[r]} against ${expected[r]}`);
    if (extra > 1e-6) books.placements[r] += extra;
  }
  return settled;
}

export function playFortnight(
  faction: FactionId,
  cadenceHours: number,
  days: number,
  sessionMinutes: number,
  placement: Placement = 'naive',
  /**
   * What its research commits to (M28 Phase 2). LOGISTICS unless told: the
   * doctrine a commander buying the cheapest first commits to.
   */
  doctrine: TechBranch = 'logistics',
  /** The head starts it opens with (M28 Phase 3), by level; none unless told. */
  headStart: Partial<Record<HeadStartId, number>> = {},
): Run {
  const ledger: Ledger = {
    made: zero(),
    banked: zero(),
    atCap: zero(),
    delivered: zero(),
    pastOffline: zero(),
    converted: zero(),
    contracts: zero(),
    placements: zero(),
    front: 0,
    spent: {},
    research: zero(),
  };
  const start = LADDER_EPOCH + 7 * HOUR;
  const town = unlockAll(newTown(start, faction));
  // The head start, as a war given it when it chose its commitment. THE
  // OPENING grants nothing here: this town has every requisition already.
  const career = newCareer();
  for (const [id, level] of Object.entries(headStart)) career.bought[id as HeadStartId] = level ?? 0;
  applyHeadStart(town, career, start);
  const cells = cellsByDistance();
  const unplaceable = new Set<string>();
  const milestones: Record<string, number | null> = {
    'CC2': null,
    'CC3': null,
    'CC3 built out': null,
    'the nine': null,
    'the doctrine': null,
  };
  const open = techsOpenTo(doctrine);
  const nine = TECHS.filter((t) => t.tier <= 3).map((t) => t.id);
  let lastPurchase = 0;
  /** Supplies made with nothing left to buy, and made after the build-out. */
  let idleMade = 0;
  let builtOutMade = 0;
  const nothingToBuy = (): boolean =>
    milestones['CC3 built out'] !== null &&
    open.every((t) => town.research.completed.includes(t.id) || town.research.active?.id === t.id);
  const book = (kind: string, cost: { supplies: number; fuel: number }): void => {
    const bin = (ledger.spent[CATEGORY[kind] ?? kind] ??= { supplies: 0, fuel: 0 });
    bin.supplies += cost.supplies;
    bin.fuel += cost.fuel;
  };

  const advance = (now: number): void => {
    advanceBooked(town, now, ledger);
  };

  /**
   * One purchase, and the contract pay it earned; false when the commander is
   * saving, or has nothing left to buy.
   *
   * They buy in tiers, the way a commander who wants a bigger town would:
   * production first, then the storage to hold it, then the intel that pays
   * for research, then the Command Center that raises every allowance, then
   * everything else. Within a tier the cheapest thing goes first, and a tier
   * with anything still to buy is saved for rather than skipped. The first
   * cut of this bought the cheapest thing anywhere, and spent the starting
   * stock on the CC2 upgrade and two nests before it owned a depot, so it
   * produced nothing for a fortnight.
   */
  const buyOne = (now: number): 'bought' | 'saving' | 'done' => {
    const meta = townMetaFor(faction);
    const top = (kind: string): number => Math.min(gatingOf(town).maxStructureLevel, meta[kind]!.levels.length);
    for (const tier of TIERS) {
      let pending = false;
      const options: { cost: { supplies: number; fuel: number }; kind: string; act: () => boolean }[] = [];
      for (const kind of tier) {
        // The works wait on their research, which is not a thing to save for.
        if (kind !== 'cc' && !isUnlocked(town, kind)) continue;
        if (kind === 'cc') {
          const cc = townCc(town);
          const why = upgradeError(town, cc);
          if (why === 'max' || why === 'locked') continue;
          pending = true;
          if (why === null) {
            options.push({ cost: meta.cc!.levels[cc.level]!, kind, act: () => upgrade(town, cc.id, now) });
          }
          continue;
        }
        if (!unplaceable.has(kind) && countOf(town, kind) < (gatingOf(town).counts[kind] ?? 0)) {
          pending = true;
          const cost = meta[kind]!.levels[0]!;
          if (town.supplies >= cost.supplies && town.fuel >= cost.fuel) {
            // No room left for it on the board: not buyable, now or later.
            const cell = placement === 'naive' ? cells.find((c) => canPlace(town, kind, c) === null) : bestCell(town, kind, cells);
            if (cell === undefined) unplaceable.add(kind);
            else options.push({ cost, kind, act: () => place(town, kind, cell, now) });
          }
        }
        for (const st of town.structures) {
          if (st.kind !== kind || st.wrecked || st.level >= top(kind)) continue;
          pending = true;
          if (upgradeError(town, st) === null) {
            options.push({ cost: meta[kind]!.levels[st.level]!, kind, act: () => upgrade(town, st.id, now) });
          }
        }
      }
      if (options.length > 0) {
        options.sort((a, b) => a.cost.supplies + a.cost.fuel - (b.cost.supplies + b.cost.fuel));
        const pick = options[0]!;
        const held = { supplies: town.supplies, fuel: town.fuel, intel: town.intel };
        if (!pick.act()) throw new Error(`the economy instrument could not buy ${pick.kind}`);
        book(pick.kind, pick.cost);
        // Whatever arrived beyond the price is the day's orders paying out.
        ledger.contracts.supplies += town.supplies - (held.supplies - pick.cost.supplies);
        ledger.contracts.fuel += town.fuel - (held.fuel - pick.cost.fuel);
        ledger.contracts.intel += town.intel - held.intel;
        lastPurchase = now;
        return 'bought';
      }
      // Something in this tier is still to buy: save for it.
      if (pending) return 'saving';
    }
    return 'done';
  };

  /**
   * The next project, cheapest in intel first. A tech that costs supplies or
   * fuel — the doctrine's three — waits until there is nothing left to build:
   * a commander who wants a bigger town buys the town first.
   */
  const research = (now: number, builtOut: boolean): void => {
    if (town.research.active) return;
    const next = [...open]
      .filter((t) => builtOut || (!t.supplies && !t.fuel))
      .sort((a, b) => a.intel - b.intel || (a.supplies ?? 0) - (b.supplies ?? 0))
      .find((t) => canResearch(town, t.id) === null);
    if (!next || !startResearch(town, next.id, now)) return;
    const cost = { supplies: next.supplies ?? 0, fuel: next.fuel ?? 0 };
    ledger.research.intel += next.intel;
    ledger.research.supplies += cost.supplies;
    ledger.research.fuel += cost.fuel;
    if (cost.supplies > 0 || cost.fuel > 0) book('research', cost);
    lastPurchase = now;
  };

  const waking = 16 * HOUR;
  const perDay = Math.max(1, Math.floor(waking / (cadenceHours * HOUR)) + 1);
  for (let day = 0; day < days; day++) {
    for (let session = 0; session < perDay; session++) {
      const at = start + day * DAY + Math.min(waking, session * cadenceHours * HOUR);
      for (let m = 0; m < sessionMinutes; m++) {
        const now = at + m * MIN;
        const madeBefore = ledger.made.supplies;
        const idle = nothingToBuy();
        const built = milestones['CC3 built out'] !== null;
        advance(now);
        if (idle) idleMade += ledger.made.supplies - madeBefore;
        if (built) builtOutMade += ledger.made.supplies - madeBefore;
        let state = buyOne(now);
        while (state === 'bought') state = buyOne(now);
        research(now, state === 'done');
        const t = (now - start) / DAY;
        const mark = (name: string, ok: boolean): void => {
          if (ok && milestones[name] === null) milestones[name] = t;
        };
        mark('CC2', townCc(town).level >= 2 && townCc(town).buildEndsAt === undefined);
        mark('CC3', townCc(town).level >= 3 && townCc(town).buildEndsAt === undefined);
        mark('CC3 built out', isBuiltOut(town, 3));
        mark('the nine', nine.every((id) => town.research.completed.includes(id)));
        mark('the doctrine', open.every((t) => town.research.completed.includes(t.id)));
      }
    }
  }
  return {
    sessionsPerDay: perDay,
    ledger,
    milestones,
    lastPurchase: (lastPurchase - start) / DAY,
    idleMade,
    builtOutMade,
  };
}

function fortnightTable(faction: FactionId, days = 14, sessionMinutes = 10): string[] {
  const cadences = [0.5, 1, 2, 4, 8, 24];
  const runs = cadences.map((h) => ({ h, run: playFortnight(faction, h, days, sessionMinutes) }));
  const when = (d: number | null): string => (d === null ? 'never' : d < 1 ? `${(d * 24).toFixed(0)} h` : `${d.toFixed(1)} d`);
  const lines = [
    `A PLAYED FORTNIGHT — ${faction.toUpperCase()}: ${days} days, a ${sessionMinutes}-minute session at a fixed ` +
      `cadence from 07:00 to 23:00, buying production, then storage, intel, the Command Center and the rest, ` +
      `then research, committed to LOGISTICS`,
    'EVERY  | SESSIONS | CC2 BY | CC3 BY | ALL BOUGHT | THE NINE | THE DOCTRINE | SUPPLIES MADE | BANKED | CONVERTED | ' +
      'LOST FULL | LOST PAST 8H | MADE AFTER THE BUILD-OUT | MADE WITH NOTHING TO BUY',
  ];
  for (const { h, run } of runs) {
    const m = run.milestones;
    const L = run.ledger;
    lines.push(
      `${pad(h < 1 ? `${h * 60} min` : `${h} h`, 6)} | ${pad(String(run.sessionsPerDay), 8)} | ` +
        `${pad(when(m['CC2']!), 6)} | ${pad(when(m['CC3']!), 6)} | ${pad(when(m['CC3 built out']!), 10)} | ` +
        `${pad(when(m['the nine']!), 8)} | ${pad(when(m['the doctrine']!), 12)} | ${pad(k(L.made.supplies), 13)} | ` +
        `${pad(pct(L.banked.supplies, L.made.supplies), 6)} | ${pad(pct(L.converted.supplies, L.made.supplies), 9)} | ` +
        `${pad(pct(L.atCap.supplies, L.made.supplies), 9)} | ` +
        `${pad(pct(L.pastOffline.supplies, L.made.supplies), 12)} | ${pad(pct(run.builtOutMade, L.made.supplies), 24)} | ` +
        `${pct(run.idleMade, L.made.supplies)}`,
    );
  }
  // Where it went, for one cadence a player might keep.
  const typical = runs.find((r) => r.h === 2)!.run;
  const spent = Object.entries(typical.ledger.spent).sort((a, b) => b[1].supplies - a[1].supplies);
  const total = spent.reduce((sum, [, v]) => sum + v.supplies, 0);
  lines.push('');
  const R = typical.ledger.research;
  const C = typical.ledger.converted;
  lines.push(
    `WHERE IT WENT, a session every 2 h: ${k(total)} supplies spent, the last purchase ${when(typical.lastPurchase)} in; ` +
      `research ${k(R.intel)} intel, ${k(R.supplies)} supplies, ${k(R.fuel)} fuel; the works took ${k(C.supplies)} ` +
      `supplies for ${k(C.fuel)} fuel and ${k(C.intel)} intel; ${k(typical.ledger.contracts.supplies)} supplies from ` +
      `the day's orders for building`,
  );
  for (const [category, v] of spent) {
    lines.push(`  ${pad(category, 14)} ${pad(k(v.supplies), 6)} S ${pad(k(v.fuel), 6)} F  ${pct(v.supplies, total)}`);
  }
  return lines;
}

/**
 * What a full store keeps of a payout, through the real functions: a built-out
 * CC3 town at its cap is paid a day's orders, then the game goes on for one
 * frame. `tick` says pay lands on top of the cap, as raid loot and a season
 * placement do; this reads what is still there a frame later.
 */
function overflowTable(faction: FactionId): string[] {
  const town = builtOut(faction, 3);
  const at = LADDER_EPOCH + 7 * HOUR;
  town.lastSeen = at;
  const cap = caps(town);
  town.supplies = cap.supplies;
  town.fuel = cap.fuel;
  town.intel = cap.intel;
  let paid = 0;
  for (const c of contractsAt(at)) {
    creditContracts(town, c.metric, c.goal, at);
  }
  paid = town.supplies - cap.supplies;
  const landed = town.supplies;
  tick(town, at + 16);
  return [
    `A FULL STORE, PAID: a CC3 town at its cap of ${k(cap.supplies)} supplies finishes a day's orders ` +
      `(+${k(paid)} S) and holds ${k(landed)}; one frame later it holds ${k(town.supplies)}, and ` +
      `${pct(Math.max(0, landed - town.supplies), paid)} of the pay is gone.`,
  ];
}

/**
 * THE WORKS (M24 Phase 4): what each stage's converters take and make an hour
 * at the stage's top level, powered, against what its producers make before
 * the yard. What they take is their price while the supply store is filling;
 * on a full one it is production that would have been lost.
 */
function worksTable(faction: FactionId): string[] {
  const meta = townMetaFor(faction);
  const lines = [
    `THE WORKS — ${faction.toUpperCase()}: each stage's converters at its top level, powered, against its producers`,
    'STAGE | PRODUCERS MAKE AN HOUR | REFINERY S → F | BUREAU S → I | THE WORKS TAKE | THEY ADD | WITH STRATEGIC RESERVE',
  ];
  for (let cc = 1; cc <= 3; cc++) {
    const gate = CC_GATING[cc - 1]!;
    const rate = baseRatesPerHour(builtOut(faction, cc));
    const works = (kind: string): { input: number; output: number } => {
      const c = meta[kind]!.converts!;
      const n = gate.counts[kind] ?? 0;
      const i = Math.min(gate.maxStructureLevel, c.input.length) - 1;
      return { input: c.input[i]! * n, output: c.output[i]! * n };
    };
    const refinery = works('refinery');
    const bureau = works('bureau');
    const take = refinery.input + bureau.input;
    const producers = `${rate.supplies} S ${rate.fuel} F ${rate.intel} I`;
    if (take === 0) {
      lines.push(`CC${cc}   | ${pad(producers, 22)} | none`);
      continue;
    }
    const adds = (k: number): string =>
      `+${pct(refinery.output * k, rate.fuel)} fuel, +${pct(bureau.output * k, rate.intel)} intel`;
    lines.push(
      `CC${cc}   | ${pad(producers, 22)} | ${pad(`${refinery.input} → ${refinery.output}`, 14)} | ` +
        `${pad(`${bureau.input} → ${bureau.output}`, 12)} | ${pad(`${take} S, ${pct(take, rate.supplies)}`, 14)} | ` +
        `${pad(adds(1), 22)} | ${adds(1.25)}`,
    );
  }
  return lines;
}

/**
 * THE DOCTRINES (M28 Phase 2): what each gives a built-out CC3 town, and when
 * the played fortnight's commander has it. Every war buys the nine; the rows
 * differ only in the three techs past them, and only LOGISTICS's three touch
 * the economy's rates. The town stands off the board, as the stages do, so
 * this is the rate before the yard; the works run on what it makes.
 */
function doctrineTable(faction: FactionId): string[] {
  const nine = TECHS.filter((t) => t.tier <= 3).map((t) => t.id);
  const rows: { label: string; ids: string[]; doctrine?: TechBranch }[] = [
    { label: 'THE NINE', ids: nine },
    ...TECH_BRANCHES.map((b) => ({ label: b.toUpperCase(), ids: techsOpenTo(b).map((t) => t.id), doctrine: b })),
  ];
  const when = (d: number | null | undefined): string =>
    d === undefined ? '—' : d === null ? 'never' : `${d.toFixed(1)} d`;
  const lines = [
    `THE DOCTRINES — ${faction.toUpperCase()}: a built-out CC3 town with the nine and each doctrine's three, ` +
      `and the played fortnight's commander committed to each, a session every 2 h`,
    'DOCTRINE  | MAKES AN HOUR      | THE WORKS MAKE | STORES S/F    | REPAIRS | THE DOCTRINE BY | ITS THREE COST',
  ];
  for (const row of rows) {
    const town = builtOut(faction, 3);
    town.research.completed = row.ids;
    const rate = baseRatesPerHour(town);
    const works = conversionPerHour(town, rate.supplies);
    const cap = caps(town);
    const top = TECHS.filter((t) => t.branch === row.doctrine && t.tier > 3);
    const cost = top.reduce((sum, t) => ({ s: sum.s + (t.supplies ?? 0), f: sum.f + (t.fuel ?? 0) }), { s: 0, f: 0 });
    const by = row.doctrine ? playFortnight(faction, 2, 14, 10, 'naive', row.doctrine).milestones['the doctrine'] : undefined;
    lines.push(
      `${row.label.padEnd(9)} | ${pad(`${rate.supplies} S ${rate.fuel} F ${rate.intel} I`, 18)} | ` +
        `${pad(`${works.fuel} F ${works.intel} I`, 14)} | ${pad(`${cap.supplies} / ${cap.fuel}`, 13)} | ` +
        `${pad(`x${effectsOf(row.ids).repairs}`, 7)} | ${pad(when(by), 15)} | ` +
        (row.doctrine ? `${k(cost.s)} S ${k(cost.f)} F` : '—'),
    );
  }
  return lines;
}

/**
 * M28 Phase 3: what each head start does to the played fortnight, a session
 * every two hours. The fortnight's town has every requisition from the start,
 * so THE OPENING, which grants requisitions, has nothing to show here.
 */
export function headStartTable(faction: FactionId = 'usa'): string[] {
  const when = (d: number | null | undefined): string =>
    d === null || d === undefined ? 'never' : d < 1 ? `${(d * 24).toFixed(0)} h` : `${d.toFixed(1)} d`;
  const rows: { label: string; levels: Partial<Record<HeadStartId, number>> }[] = [{ label: 'NONE', levels: {} }];
  for (const id of ['chest', 'quartermasters', 'staff'] as const) {
    for (let level = 1; level <= 3; level++) {
      rows.push({ label: `${id.toUpperCase()} ${'I'.repeat(level)}`, levels: { [id]: level } });
    }
  }
  rows.push({ label: 'ALL THREE AT III', levels: { chest: 3, quartermasters: 3, staff: 3 } });
  const lines = [
    `HEAD STARTS — ${faction.toUpperCase()}: the played fortnight, a session every 2 h, with each head start it can show`,
    'HEAD START         | CC2 BY | CC3 BY | ALL BOUGHT | THE NINE | THE DOCTRINE | SUPPLIES MADE',
  ];
  for (const row of rows) {
    const run = playFortnight(faction, 2, 14, 10, 'naive', 'logistics', row.levels);
    const m = run.milestones;
    lines.push(
      `${row.label.padEnd(18)} | ${pad(when(m['CC2']), 6)} | ${pad(when(m['CC3']), 6)} | ` +
        `${pad(when(m['CC3 built out']), 10)} | ${pad(when(m['the nine']), 8)} | ${pad(when(m['the doctrine']), 12)} | ` +
        `${k(run.ledger.made.supplies + run.ledger.delivered.supplies)}`,
    );
  }
  return lines;
}

export function economyTable(faction: FactionId = 'usa'): string {
  return [
    ...stageTable(faction),
    '',
    ...worksTable(faction),
    '',
    ...doctrineTable(faction),
    '',
    ...defenceTable(faction),
    '',
    ...overflowTable(faction),
    '',
    ...fortnightTable(faction),
  ].join('\n');
}
