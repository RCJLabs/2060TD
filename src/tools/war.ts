/**
 * M24 Phase 4: a week at war.
 *
 * Every economy reading before this one had a commander who never fought. This
 * one fights. A CC3 town, built out, the LATE reference defence standing and
 * its whole economy laid out behind the lines by the yard search, is played
 * for a week of sessions through the real town and warfare functions: it
 * raids the Front Line every session with the harness's force, stands and
 * fights every defence the probes offer and every counterattack its raids
 * earn, repairs what the war wrecks, rebuilds the wire, restocks its fire
 * plan and buys the research graph as the builder does. A second commander
 * climbs the skirmish ladder as well, a skirmish a session until one is lost
 * that day, and a third does not fight at all, so the same town and the same
 * week read three ways.
 *
 * The question is the one 4b was waiting on: whether the war spends the
 * surplus a built town makes, or whether a full store still loses most of it.
 */
import { CHARGE_PRICES } from '../content/buildings';
import { conditionAt } from '../content/conditions';
import {
  defenseCatalogFor,
  raidCatalogFor,
  trainableFor,
  trainMetaFor,
  type FactionId,
} from '../content/factions';
import { LADDER_EPOCH } from '../content/leagues';
import { TECHS } from '../content/research';
import { ladderPayout } from '../meta/ladder';
import {
  applyCounterResult,
  applySiegeResult,
  buyCharge,
  canResearch,
  canTrain,
  caps,
  chargeCapOf,
  counterattackConfig,
  fitTerrainSeed,
  outcomeFromEngine,
  placeWall,
  queueTrain,
  repairAllWrecks,
  repairWreck,
  researchEffects,
  siegeConfig,
  startResearch,
  trainingCost,
  wallAt,
  type SiegeOutcome,
  type TownState,
} from '../meta/town';
import {
  applyLiveDefense,
  applyRaidResult,
  claimLiveDefense,
  declineLiveDefense,
  liveDefenseConfig,
  planDeployment,
  raidConfig,
  resolveRaid,
  runOfflineProbes,
  scoutTarget,
  slotOf,
  squadVet,
  targetFor,
} from '../meta/warfare';
import { Engine } from '../sim/engine';
import type { SimConfig } from '../sim/types';
import { advanceBooked, RESOURCES, zero, type Accruals, type Amounts } from './economy';
import { DOCTRINE_SUPPORT, RAID_PLANS } from './plans';
import { referenceBases } from './referenceBases';
import { bandOf, laidOutTown } from './yard';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Who is playing: nobody fights, the Front Line is raided, or that and the skirmish ladder too. */
export type WarPolicy = 'peace' | 'raids' | 'raids+skirmish';

export interface WarBooks extends Accruals {
  /** Each action's net effect on the three stores, by name. */
  actions: Record<string, Amounts>;
}

export interface WarRun {
  policy: WarPolicy;
  cadenceHours: number;
  sessionsPerDay: number;
  days: number;
  /** The days the books cover, from the town's last session before the week to its last tick. */
  span: number;
  books: WarBooks;
  raids: number;
  cleared: number;
  defences: number;
  defencesHeld: number;
  counters: number;
  countersHeld: number;
  probes: number;
  probesHeld: number;
  skirmishes: number;
  skirmishesHeld: number;
  /** The Front Line rung and the skirmish level at the end of the week. */
  tier: number;
  assaultLevel: number;
  /** Days into the week the graph was finished, or null if it never was. */
  graph: number | null;
}

/**
 * The town the week starts from: the LATE reference defence with its CC3
 * economy behind the lines, on ground the game itself would fit under it, the
 * nine techs done, the stores full, the fire plan stocked and the faction's
 * harness raid force standing. It has climbed the skirmish ladder to the last
 * level its defence holds every time.
 */
export function warTown(faction: FactionId): TownState {
  const late = referenceBases().find((b) => b.ccLevel === 3)!;
  const town = laidOutTown(late, faction);
  if (!town) throw new Error('the CC3 economy does not fit behind the LATE defence');
  town.terrainSeed = fitTerrainSeed(town, LADDER_EPOCH);
  town.research.completed = TECHS.filter((t) => t.tier <= 3).map((t) => t.id);
  for (const squad of RAID_PLANS[faction]) {
    for (const [kind, n] of Object.entries(squad.units)) town.army[kind] = (town.army[kind] ?? 0) + n;
  }
  town.assaultLevel = bandOf(town)[0] ?? 1;
  const cap = caps(town);
  town.supplies = cap.supplies;
  town.fuel = cap.fuel;
  town.intel = cap.intel;
  for (const power of Object.keys(CHARGE_PRICES)) town.charges[power] = chargeCapOf(town);
  return town;
}

/** A town battle fought to its end with nobody acting, as the harness fights one. */
function fight(config: SimConfig, faction: FactionId): SiegeOutcome {
  const engine = new Engine(config, defenseCatalogFor(faction));
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < 40_000) engine.step();
  return outcomeFromEngine(engine);
}

/** The facility of the right kind with room in its queue, cheapest first. */
function facilityFor(town: TownState, kind: string): number | undefined {
  const facility = trainMetaFor(town.faction)[kind]?.facility;
  let best: number | undefined;
  let bestPrice = Infinity;
  for (const s of town.structures) {
    if (s.kind !== facility || canTrain(town, s.id, kind) !== null) continue;
    const cost = trainingCost(town, s.id, kind);
    const price = cost.supplies + cost.fuel;
    if (price < bestPrice) {
      best = s.id;
      bestPrice = price;
    }
  }
  return best;
}

const seedAt = (at: number, k: number): number =>
  ((Math.floor(at / MIN) + k * 7919) * 2654435761) >>> 0;

/**
 * One week, played. Each session: the probes the absence owed, then the time
 * itself; the defence the last probe offers (declined in peace, fought
 * otherwise); a counterattack if one is owed; the raid and the skirmish the
 * policy fights, with the wrecks repaired and the wire rebuilt after every
 * siege; then the losses retrained, the charges restocked and the next tech
 * started, and the rest of the session ticked through minute by minute so
 * the training completes.
 */
export function playWarWeek(
  start: TownState,
  policy: WarPolicy,
  cadenceHours: number,
  days = 7,
  sessionMinutes = 10,
): WarRun {
  const town: TownState = structuredClone(start);
  const faction = town.faction;
  const books: WarBooks = {
    made: zero(),
    banked: zero(),
    atCap: zero(),
    pastOffline: zero(),
    converted: zero(),
    placements: zero(),
    actions: {},
  };
  const waking = 16 * HOUR;
  const perDay = Math.max(1, Math.floor(waking / (cadenceHours * HOUR)) + 1);
  const run: WarRun = {
    policy,
    cadenceHours,
    sessionsPerDay: perDay,
    days,
    span: 0,
    books,
    raids: 0,
    cleared: 0,
    defences: 0,
    defencesHeld: 0,
    counters: 0,
    countersHeld: 0,
    probes: 0,
    probesHeld: 0,
    skirmishes: 0,
    skirmishesHeld: 0,
    tier: 0,
    assaultLevel: 0,
    graph: null,
  };
  const wire = town.walls.map((w) => ({ ...w }));
  const booksFrom = town.lastSeen;
  const plan = RAID_PLANS[faction];
  const wanted = planDeployment(plan);
  const begin = LADDER_EPOCH + 7 * HOUR;
  let variant = 0;
  let lostSkirmishOn = -1;

  /** Run one action and book what it did to the stores. */
  const act = <T>(name: string, fn: () => T): T => {
    const before = { supplies: town.supplies, fuel: town.fuel, intel: town.intel };
    const out = fn();
    const bin = (books.actions[name] ??= zero());
    for (const r of RESOURCES) bin[r] += town[r] - before[r];
    return out;
  };
  /** Every wreck repaired and the wire rebuilt, as far as the stores go. */
  const restore = (at: number): void => {
    act('repairs', () => {
      if (repairAllWrecks(town)) return;
      for (const s of town.structures) if (s.wrecked) repairWreck(town, s.id);
    });
    act('wire', () => {
      for (const w of wire) if (!wallAt(town, w.cell)) placeWall(town, w.cell, at, w.kind);
    });
  };
  /** A siege, booked, and the town put back before anything else is fought. */
  const siege = (name: string, at: number, fn: () => void): void => {
    act(name, fn);
    restore(at);
  };

  for (let day = 0; day < days; day++) {
    for (let session = 0; session < perDay; session++) {
      const at = begin + day * DAY + Math.min(waking, session * cadenceHours * HOUR);
      // Arriving: what the absence owed, then the time itself.
      const probes = act('probes', () => runOfflineProbes(town, at));
      run.probes += probes.length;
      run.probesHeld += probes.filter((p) => p.held).length;
      advanceBooked(town, at, books);

      // The defence the last probe offers: stood and fought, or handed to the
      // garrison, which resolves it as the probe it would have been.
      if (town.pendingDefense) {
        if (policy === 'peace') {
          const entry = act('probes', () => declineLiveDefense(town, at));
          if (entry) {
            run.probes++;
            if (entry.held) run.probesHeld++;
          }
        } else {
          const config = liveDefenseConfig(town)!;
          const pending = claimLiveDefense(town)!;
          const outcome = fight(config, faction);
          siege('defences', at, () =>
            applyLiveDefense(town, { level: pending.level, at: pending.at, config }, outcome, at),
          );
          run.defences++;
          if (outcome.victory) run.defencesHeld++;
        }
      }
      if (town.frontline.pendingCounterattack) {
        const outcome = fight(counterattackConfig(town, seedAt(at, 1)), faction);
        siege('counterattacks', at, () => applyCounterResult(town, outcome, at));
        run.counters++;
        if (outcome.victory) run.countersHeld++;
      }

      // The raid, when the whole force is home and trained.
      const ready = Object.entries(wanted).every(([kind, n]) => (town.army[kind] ?? 0) >= n);
      if (policy !== 'peace' && ready) {
        const tier = town.frontline.tier;
        const v = variant++ % 3;
        act('scouting', () => scoutTarget(town, tier, v, at));
        const base = targetFor(town, v);
        const squads = plan.map((s, i) => {
          const slot = slotOf(s, i);
          return { ...s, slot, vet: squadVet(town, slot) };
        });
        const fx = researchEffects(town);
        const config = raidConfig(base, squads, seedAt(at, 2), trainableFor(faction), {
          objective: 'post',
          ...(fx.unitHp !== 1 || fx.unitDamage !== 1 ? { mods: { hp: fx.unitHp, damage: fx.unitDamage } } : {}),
          autoPowers: DOCTRINE_SUPPORT.autoPowers!.filter((r) => (town.charges[r.kind] ?? 0) > 0),
          powerCharges: { ...town.charges },
          condition: conditionAt(at),
        });
        const res = resolveRaid(config, squads, base.tier, raidCatalogFor(faction), ladderPayout(town, at));
        act('raids', () => applyRaidResult(town, base, res, config, at));
        run.raids++;
        if (res.cleared) run.cleared++;
      }
      // A skirmish at the town's level, climbing while it holds. A loss ends
      // the day's skirmishing: a commander tries a level again tomorrow rather
      // than throwing the town at it all evening.
      if (policy === 'raids+skirmish' && lostSkirmishOn !== day) {
        const outcome = fight(siegeConfig(town, seedAt(at, 3)), faction);
        siege('skirmishes', at, () => applySiegeResult(town, outcome, at));
        run.skirmishes++;
        if (outcome.victory) run.skirmishesHeld++;
        else lostSkirmishOn = day;
      }

      // The losses retrained, and the next project.
      act('training', () => {
        for (const [kind, n] of Object.entries(wanted)) {
          let queued = 0;
          for (const s of town.structures) queued += (s.trainQueue ?? []).filter((k) => k === kind).length;
          for (let short = n - (town.army[kind] ?? 0) - queued; short > 0; short--) {
            const facility = facilityFor(town, kind);
            if (facility === undefined || !queueTrain(town, facility, kind, at)) break;
          }
        }
      });
      restore(at);
      act('charges', () => {
        for (const power of Object.keys(CHARGE_PRICES)) while (buyCharge(town, power)) continue;
      });
      act('research', () => {
        if (town.research.active) return;
        const next = [...TECHS]
          .sort((a, b) => a.intel - b.intel || (a.supplies ?? 0) - (b.supplies ?? 0))
          .find((t) => canResearch(town, t.id) === null);
        if (next) startResearch(town, next.id, at);
      });

      for (let m = 1; m < sessionMinutes; m++) advanceBooked(town, at + m * MIN, books);
      if (run.graph === null && town.research.completed.length === TECHS.length) run.graph = (at - begin) / DAY;
    }
  }
  run.tier = town.frontline.tier;
  run.assaultLevel = town.assaultLevel;
  run.span = (town.lastSeen - booksFrom) / DAY;
  return run;
}

const pad = (s: string | number, n: number): string => String(s).padStart(n);
const k = (n: number): string => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(0)}k` : `${Math.round(n)}`);
const pct = (part: number, whole: number): string => (whole > 0 ? `${((part / whole) * 100).toFixed(0)}%` : '—');
const POLICIES: WarPolicy[] = ['peace', 'raids', 'raids+skirmish'];

/** Everything the war did to the stores, research left out: it is not the war. */
function warNet(books: WarBooks): Amounts {
  const net = zero();
  for (const [name, a] of Object.entries(books.actions)) {
    if (name === 'research') continue;
    for (const r of RESOURCES) net[r] += a[r];
  }
  return net;
}

/**
 * A WEEK AT WAR: the same CC3 town and the same week, played three ways at
 * three cadences, per day. LOST FULL is what a full store lost of what the
 * town made; the war's net is every action but research, so a positive one is
 * a war that pays for itself and adds to the surplus.
 */
export function warTable(faction: FactionId = 'usa'): string {
  const start = warTown(faction);
  const lines = [
    `A WEEK AT WAR — ${faction.toUpperCase()}: CC3 built out, the LATE defence with its economy behind the lines, ` +
      `ten-minute sessions from 07:00 to 23:00, the skirmish ladder climbed to level ${start.assaultLevel}; per day`,
    'EVERY | WHO            | MADE S | LOST FULL S/F/I | LOST PAST 8H | CONVERTED | THE WAR, NET S/F/I | ' +
      'RAIDS CLEARED | RUNG | DEFENCES HELD | SKIRMISHES HELD | LEVEL | GRAPH BY',
  ];
  const when = (d: number | null): string => (d === null ? 'never' : `day ${d.toFixed(1)}`);
  let fullest: WarRun | null = null;
  for (const hours of [2, 8, 24]) {
    for (const policy of POLICIES) {
      const run = playWarWeek(start, policy, hours);
      if (hours === 2 && policy === 'raids+skirmish') fullest = run;
      const B = run.books;
      const net = warNet(B);
      const perDay = (n: number): string => k(n / run.span);
      lines.push(
        `${pad(`${hours} h`, 5)} | ${policy.padEnd(14)} | ${pad(perDay(B.made.supplies), 6)} | ` +
          `${pad(`${pct(B.atCap.supplies, B.made.supplies)}/${pct(B.atCap.fuel, B.made.fuel)}/${pct(B.atCap.intel, B.made.intel)}`, 15)} | ` +
          `${pad(pct(B.pastOffline.supplies, B.made.supplies), 12)} | ` +
          `${pad(pct(B.converted.supplies, B.made.supplies), 9)} | ` +
          `${pad(`${perDay(net.supplies)}/${perDay(net.fuel)}/${perDay(net.intel)}`, 18)} | ` +
          `${pad(policy === 'peace' ? '—' : `${run.cleared}/${run.raids}`, 13)} | ${pad(run.tier, 4)} | ` +
          `${pad(policy === 'peace' ? '—' : `${run.defencesHeld}/${run.defences}`, 13)} | ` +
          `${pad(policy === 'raids+skirmish' ? `${run.skirmishesHeld}/${run.skirmishes}` : '—', 15)} | ` +
          `${pad(run.assaultLevel, 5)} | ${when(run.graph)}`,
      );
    }
  }
  if (fullest) {
    lines.push('');
    lines.push('WHERE IT WENT, raids and skirmishes every 2 h, per day (supplies / fuel / intel):');
    for (const [name, a] of Object.entries(fullest.books.actions)) {
      if (a.supplies === 0 && a.fuel === 0 && a.intel === 0) continue;
      const d = fullest.span;
      lines.push(`  ${name.padEnd(15)} ${pad(k(a.supplies / d), 7)} ${pad(k(a.fuel / d), 7)} ${pad(k(a.intel / d), 6)}`);
    }
  }
  return lines.join('\n');
}
