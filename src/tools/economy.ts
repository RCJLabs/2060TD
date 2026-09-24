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
import { TECHS } from '../content/research';
import {
  canPlace,
  canResearch,
  caps,
  countOf,
  cumulativeCost,
  gating as gatingOf,
  newTown,
  outcomeFromEngine,
  place,
  ratesPerHour,
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
const RESOURCES = ['supplies', 'fuel', 'intel'] as const;
type Resource = (typeof RESOURCES)[number];
type Amounts = Record<Resource, number>;
const zero = (): Amounts => ({ supplies: 0, fuel: 0, intel: 0 });

const pad = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s);
const k = (n: number): string => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(0)}k` : `${Math.round(n)}`);
const pct = (part: number, whole: number): string => (whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : '—');

/** The order a commander who wants a bigger town buys in (see `buyOne`). */
const TIERS: string[][] = [
  ['supplyDepot', 'fuelDepot'],
  ['storageBunker'],
  ['radar'],
  ['cc'],
  ['engBay', 'm2nest', 'autocannon', 'mortar', 'aa', 'barracks', 'motorpool', 'airfield'],
];

/** Where a purchase is booked. */
const CATEGORY: Record<string, string> = {
  cc: 'command center',
  supplyDepot: 'production',
  fuelDepot: 'production',
  radar: 'production',
  storageBunker: 'storage',
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
function builtOut(faction: FactionId, cc: number): TownState {
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
    const rate = ratesPerHour(town);
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
  const rates = [1, 2, 3].map((cc) => ratesPerHour(builtOut(faction, cc)).supplies);
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
function referenceTown(base: ReferenceBase, faction: FactionId): TownState {
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

interface Fought {
  held: boolean;
  /** What the battle's own supply line paid, its waves and salvage, and the bonus on a hold. */
  pay: { supplies: number; fuel: number };
  /** What putting back everything it wrecked costs. */
  wrecks: { supplies: number; fuel: number };
}

/**
 * One siege against a reference town, fought as the town fights one — through
 * `siegeConfig` — with nobody acting, which is the harness's bare row, and on
 * the flat ground the harness fights on, so the levels line up with the
 * defence tables in docs/BALANCE.md. Priced as `foldBattle` and
 * `applySiegeResult` price it: the battle's own supplies come home, a hold
 * adds the bonus, and everything that did not come out of it is a wreck at the
 * town's own repair price.
 */
function fightSiege(town: TownState, level: number, seed: number): Fought {
  town.assaultLevel = level;
  const config = siegeConfig(town, seed);
  delete config.terrainSeed;
  delete config.terrainVersion;
  const engine = new Engine(config, defenseCatalogFor(town.faction));
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) engine.step();
  const outcome = outcomeFromEngine(engine);
  const standing = new Set(outcome.survivors.map((s) => s.cell));
  const wrecks = { supplies: 0, fuel: 0 };
  for (const s of town.structures) {
    if (s.kind === 'cc' || standing.has(s.cell)) continue;
    const cost = repairCost(town, s);
    wrecks.supplies += cost.supplies;
    wrecks.fuel += cost.fuel;
  }
  const bonus = outcome.victory ? assaultLoot(level) : { supplies: 0, fuel: 0 };
  return {
    held: outcome.victory,
    pay: { supplies: outcome.supplies + bonus.supplies, fuel: bonus.fuel },
    wrecks,
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
    const perHour = ratesPerHour(builtOut(faction, base.ccLevel)).supplies;
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

interface Ledger {
  /** What the depots made, whether or not anything kept it. */
  made: Amounts;
  /** What reached the stockpile. */
  banked: Amounts;
  /** Made while storage was full. */
  atCap: Amounts;
  /** Made past the eight hours an absence accrues for. */
  pastOffline: Amounts;
  contracts: Amounts;
  /** What a season closing paid, which `tick` pays on top of the cap. */
  placements: Amounts;
  spent: Record<string, { supplies: number; fuel: number }>;
  research: number;
}

interface Run {
  sessionsPerDay: number;
  ledger: Ledger;
  /** Days from the first session to each milestone, or null if it never came. */
  milestones: Record<string, number | null>;
  /** When the last thing was bought, in days. */
  lastPurchase: number;
  /** Supplies made once everything was bought, with nothing left to spend them on. */
  idleMade: number;
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

function playFortnight(faction: FactionId, cadenceHours: number, days: number, sessionMinutes: number): Run {
  const ledger: Ledger = {
    made: zero(),
    banked: zero(),
    atCap: zero(),
    pastOffline: zero(),
    contracts: zero(),
    placements: zero(),
    spent: {},
    research: 0,
  };
  const start = LADDER_EPOCH + 7 * HOUR;
  const town = unlockAll(newTown(start, faction));
  const cells = cellsByDistance();
  const unplaceable = new Set<string>();
  const milestones: Record<string, number | null> = {
    'CC2': null,
    'CC3': null,
    'CC3 built out': null,
    'all research': null,
  };
  let lastPurchase = 0;
  /** Supplies made after everything was bought. */
  let idleMade = 0;
  const book = (kind: string, cost: { supplies: number; fuel: number }): void => {
    const bin = (ledger.spent[CATEGORY[kind] ?? kind] ??= { supplies: 0, fuel: 0 });
    bin.supplies += cost.supplies;
    bin.fuel += cost.fuel;
  };

  /** Advance to `now` through the real `tick`, booking what it did. */
  const advance = (now: number): void => {
    const elapsed = Math.max(0, now - town.lastSeen);
    const counted = Math.min(elapsed, OFFLINE_CAP_HOURS * HOUR);
    const rate = ratesPerHour(town);
    const cap = caps(town);
    const expected = zero();
    for (const r of RESOURCES) {
      const made = (rate[r] * elapsed) / HOUR;
      const gain = (rate[r] * counted) / HOUR;
      const held = town[r];
      ledger.made[r] += made;
      ledger.pastOffline[r] += made - gain;
      // As `tick` does it: fill to the cap, and keep whatever was above it.
      const after = elapsed > 0 ? Math.max(held, Math.min(cap[r], held + gain)) : held;
      const banked = after - held;
      ledger.banked[r] += banked;
      ledger.atCap[r] += gain - banked;
      expected[r] = after;
    }
    tick(town, now);
    // Anything else `tick` paid is a season placement; nothing else pays there,
    // and nothing in it takes away.
    for (const r of RESOURCES) {
      const extra = town[r] - expected[r];
      if (extra < -1e-6) throw new Error(`the economy instrument lost track of ${r}: ${town[r]} against ${expected[r]}`);
      if (extra > 1e-6) ledger.placements[r] += extra;
    }
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
  const buyOne = (now: number): boolean => {
    const meta = townMetaFor(faction);
    const top = (kind: string): number => Math.min(gatingOf(town).maxStructureLevel, meta[kind]!.levels.length);
    for (const tier of TIERS) {
      let pending = false;
      const options: { cost: { supplies: number; fuel: number }; kind: string; act: () => boolean }[] = [];
      for (const kind of tier) {
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
            const cell = cells.find((c) => canPlace(town, kind, c) === null);
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
        return true;
      }
      // Something in this tier is still to buy: save for it.
      if (pending) return false;
    }
    return false;
  };

  const research = (now: number): void => {
    if (town.research.active) return;
    const next = [...TECHS].sort((a, b) => a.intel - b.intel).find((t) => canResearch(town, t.id) === null);
    if (!next) return;
    if (startResearch(town, next.id, now)) ledger.research += next.intel;
  };

  const waking = 16 * HOUR;
  const perDay = Math.max(1, Math.floor(waking / (cadenceHours * HOUR)) + 1);
  for (let day = 0; day < days; day++) {
    for (let session = 0; session < perDay; session++) {
      const at = start + day * DAY + Math.min(waking, session * cadenceHours * HOUR);
      for (let m = 0; m < sessionMinutes; m++) {
        const now = at + m * MIN;
        const madeBefore = ledger.made.supplies;
        advance(now);
        if (milestones['CC3 built out'] !== null) idleMade += ledger.made.supplies - madeBefore;
        while (buyOne(now)) {
          /* spend what can be spent */
        }
        research(now);
        const t = (now - start) / DAY;
        const mark = (name: string, ok: boolean): void => {
          if (ok && milestones[name] === null) milestones[name] = t;
        };
        mark('CC2', townCc(town).level >= 2 && townCc(town).buildEndsAt === undefined);
        mark('CC3', townCc(town).level >= 3 && townCc(town).buildEndsAt === undefined);
        mark('CC3 built out', isBuiltOut(town, 3));
        mark('all research', town.research.completed.length === TECHS.length);
      }
    }
  }
  return {
    sessionsPerDay: perDay,
    ledger,
    milestones,
    lastPurchase: (lastPurchase - start) / DAY,
    idleMade,
  };
}

function fortnightTable(faction: FactionId, days = 14, sessionMinutes = 10): string[] {
  const cadences = [0.5, 1, 2, 4, 8, 24];
  const runs = cadences.map((h) => ({ h, run: playFortnight(faction, h, days, sessionMinutes) }));
  const when = (d: number | null): string => (d === null ? 'never' : d < 1 ? `${(d * 24).toFixed(0)} h` : `${d.toFixed(1)} d`);
  const lines = [
    `A PLAYED FORTNIGHT — ${faction.toUpperCase()}: ${days} days, a ${sessionMinutes}-minute session at a fixed ` +
      `cadence from 07:00 to 23:00, buying production, then storage, intel, the Command Center and the rest`,
    'EVERY  | SESSIONS | CC2 BY | CC3 BY | ALL BOUGHT | ALL RESEARCH | SUPPLIES MADE | BANKED | LOST FULL | LOST PAST 8H | MADE WITH NOTHING TO BUY',
  ];
  for (const { h, run } of runs) {
    const m = run.milestones;
    const L = run.ledger;
    lines.push(
      `${pad(h < 1 ? `${h * 60} min` : `${h} h`, 6)} | ${pad(String(run.sessionsPerDay), 8)} | ` +
        `${pad(when(m['CC2']!), 6)} | ${pad(when(m['CC3']!), 6)} | ${pad(when(m['CC3 built out']!), 10)} | ` +
        `${pad(when(m['all research']!), 12)} | ${pad(k(L.made.supplies), 13)} | ` +
        `${pad(pct(L.banked.supplies, L.made.supplies), 6)} | ${pad(pct(L.atCap.supplies, L.made.supplies), 9)} | ` +
        `${pad(pct(L.pastOffline.supplies, L.made.supplies), 12)} | ${pct(run.idleMade, L.made.supplies)}`,
    );
  }
  // Where it went, for one cadence a player might keep.
  const typical = runs.find((r) => r.h === 2)!.run;
  const spent = Object.entries(typical.ledger.spent).sort((a, b) => b[1].supplies - a[1].supplies);
  const total = spent.reduce((sum, [, v]) => sum + v.supplies, 0);
  lines.push('');
  lines.push(
    `WHERE IT WENT, a session every 2 h: ${k(total)} supplies spent, the last purchase ${when(typical.lastPurchase)} in; ` +
      `${typical.ledger.research} intel on all nine techs; ${k(typical.ledger.contracts.supplies)} supplies from the ` +
      `day's orders for building`,
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

export function economyTable(faction: FactionId = 'usa'): string {
  return [
    ...stageTable(faction),
    '',
    ...defenceTable(faction),
    '',
    ...overflowTable(faction),
    '',
    ...fortnightTable(faction),
  ].join('\n');
}
