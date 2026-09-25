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
  canTunnel,
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
  manpowerCapOf,
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
  postAt,
  type SquadPlan,
} from '../meta/warfare';
import { raidTargetKeys } from '../meta/theater';
import { atCapital, citadelInRange, roadsTaken } from '../meta/capital';
import { CITADEL_SLOT } from '../content/bases';
import { Engine } from '../sim/engine';
import type { SimConfig, StandingOrders } from '../sim/types';
import { advanceBooked, RESOURCES, zero, type Accruals, type Amounts } from './economy';
import {
  CITADEL_BUDGET,
  deepBudget,
  DEFENCE_LINE,
  DOCTRINE_SUPPORT,
  planAtBudget,
  RAID_PLANS,
  tunnelPlanFor,
} from './plans';
import { referenceBases } from './referenceBases';
import { MANDATE_IDS, setSignaturesLive, type MandateId } from '../content/signatures';
import { bandOf, laidOutTown } from './yard';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Who is playing: nobody fights, the Front Line is raided, or that and the skirmish ladder too. */
export type WarPolicy = 'peace' | 'raids' | 'raids+skirmish';

/**
 * How a commander answers ground the enemy retook (M25 Phase 2): 'push' raids
 * the front while any road reaches it and retakes only when none does, and
 * 'hold' retakes everything lost before pushing again.
 */
export type RetakePolicy = 'push' | 'hold';

export interface WarOptions {
  /** Raids a session, each once the last one's losses are retrained. The week at war fights one. */
  raidsPerSession?: number;
  retake?: RetakePolicy;
  /**
   * Which front post: 'cycle' raids the three in turn, as the week at war
   * does, and 'easiest' the lightest band whose road is open, as a commander
   * who reads the deal's bands does.
   */
  front?: 'cycle' | 'easiest';
  /** False stops the enemy's clock, for the same war with nothing retaken. */
  strikes?: boolean;
  /** The rung the front starts at, every town behind it held (M25 Phase 3). The week at war starts at the first. */
  startTier?: number;
  /**
   * The force grows with the front (M25 Phase 4a): the reference shape resized
   * to `deepBudget` for the rung, four men a rung past the fifth, up to what
   * the town can field. The week at war fights the reference force throughout.
   */
  grow?: boolean;
  /**
   * CP in a defence (M26 Phase 2): the orders the commander fights every
   * defence under, the live defence, the counterattack and the skirmish, as
   * its proxy for spending CP by hand. The week at war fights with nobody
   * acting.
   */
  defenceOrders?: StandingOrders;
  /**
   * The UN's mandate (M26 Phase 2): 'best' fights each defence under all
   * three and keeps the best, a commander who reads every attack before it
   * comes; the standing one otherwise.
   */
  mandate?: 'standing' | 'best';
  /** The KPA raids through a tunnel wherever the tunnel planner finds one (M26 Phase 2). */
  tunnel?: boolean;
  /**
   * The training queues kept full while the commander waits for the force to
   * be whole (M26 Phase 2), re-queued minute by minute as a player does. The
   * week at war queues once a raid, and a queue holds five: a raid that costs
   * Russia six BTRs, or the UN seven VABs, at one motor pool leaves the force
   * short at the next raid until the session after.
   */
  keepQueues?: boolean;
}

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
  /** The highest rung it held. */
  peakTier: number;
  /** The day each rung was first reached, by rung (M25 Phase 4a); undefined for a rung never reached. */
  reachedOn: (number | undefined)[];
  /** The day the citadel fell and the war was won (M25 Phase 4b), if it did. */
  wonOn?: number;
  assaultLevel: number;
  /** Sectors the enemy retook, how many the commander took back, and times the front fell back (M25 Phase 2). */
  lost: number;
  retaken: number;
  fellBack: number;
  /** Of the sectors lost, how many a short supply line cost (M25 Phase 3). */
  hungry: number;
  /** Days between sessions: one below a day's cadence. */
  everyDays: number;
  /** Days into the week the graph was finished, or null if it never was. */
  graph: number | null;
  /** Defences the commander fought, and the CP they spent and got back (M26 Phase 2). */
  commanded: number;
  cpSpent: number;
  cpRefunded: number;
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

/** Minutes a commander waits between raids in one session for the losses to be retrained. */
const RAID_TURNAROUND_MIN = 15;

/**
 * What the commander raids next (M25 Phase 2). Pushing cycles the front posts
 * whose roads are open, as the week at war cycled all three, and retakes the
 * loss nearest the front only when no road is open; holding retakes first. At
 * the enemy's capital (Phase 4b) it goes for the citadel once it is in range,
 * and until then only for the roads not yet taken: a second win on one counts
 * for nothing.
 */
function chooseTarget(
  town: TownState,
  retake: RetakePolicy,
  pick: 'cycle' | 'easiest',
  turn: number,
): { tier: number; slot: number } {
  const keys = raidTargetKeys(town);
  let front = keys.filter((k) => k.tier === town.frontline.tier);
  const back = keys.filter((k) => k.tier < town.frontline.tier);
  if (retake === 'hold' && back.length > 0) return back[0]!;
  if (atCapital(town)) {
    const citadel = front.find((k) => k.slot === CITADEL_SLOT);
    if (citadel) return citadel;
    const taken = roadsTaken(town.frontline);
    front = front.filter((k) => !taken.includes(k.slot));
  }
  if (front.length > 0) return pick === 'easiest' ? front[front.length - 1]! : front[turn % front.length]!;
  // No road reaches the front: the loss that is easiest to take back.
  return pick === 'easiest' ? [...back].sort((a, b) => b.slot - a.slot || b.tier - a.tier)[0]! : back[0]!;
}

/** Which of two outcomes of the same defence a commander would rather have. */
function betterDefence(a: SiegeOutcome, b: SiegeOutcome): boolean {
  if (a.victory !== b.victory) return a.victory;
  if (a.ccHpFraction !== b.ccHpFraction) return a.ccHpFraction > b.ccHpFraction;
  return a.stats.structuresLost < b.stats.structuresLost;
}

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
  opts: WarOptions = {},
): WarRun {
  const town: TownState = structuredClone(start);
  const faction = town.faction;
  const raidsPerSession = opts.raidsPerSession ?? 1;
  const retake = opts.retake ?? 'push';
  // Stopped by charging it through the end of time.
  if (opts.strikes === false) town.frontline.pressedAt = Number.POSITIVE_INFINITY;
  if (opts.startTier !== undefined) town.frontline.tier = opts.startTier;
  // A cadence of a day or more is a session every that many days.
  const everyDays = cadenceHours >= 24 ? Math.max(1, Math.round(cadenceHours / 24)) : 1;
  const books: WarBooks = {
    made: zero(),
    banked: zero(),
    atCap: zero(),
    pastOffline: zero(),
    converted: zero(),
    placements: zero(),
    front: 0,
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
    peakTier: town.frontline.tier,
    reachedOn: [],
    assaultLevel: 0,
    lost: 0,
    retaken: 0,
    fellBack: 0,
    hungry: 0,
    everyDays,
    graph: null,
    commanded: 0,
    cpSpent: 0,
    cpRefunded: 0,
  };
  const wire = town.walls.map((w) => ({ ...w }));
  const booksFrom = town.lastSeen;
  /**
   * The force the commander raids with at a rung, and the army it keeps for
   * it: growing, the whole army the citadel is tuned for once it is in range.
   */
  const forceAt = (tier: number): { plan: SquadPlan[]; wanted: Record<string, number> } => {
    const budget = citadelInRange(town) ? CITADEL_BUDGET : deepBudget(faction, tier);
    const plan = opts.grow ? planAtBudget(faction, Math.min(budget, manpowerCapOf(town))) : RAID_PLANS[faction];
    return { plan, wanted: planDeployment(plan) };
  };
  const begin = LADDER_EPOCH + 7 * HOUR;
  let variant = 0;
  let lostSkirmishOn = -1;

  /** Time passing, booked, and whatever ground the enemy took in it counted. */
  const advance = (at: number): void => {
    const settled = advanceBooked(town, at, books);
    run.lost += settled.strikes.length;
    run.fellBack += settled.strikes.filter((s) => s.fellBack).length;
    run.hungry += settled.strikes.filter((s) => s.cause === 'hunger').length;
  };
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
  /**
   * A defence the commander fights: under its CP line when it has one, and
   * for the UN reading every attack, under each mandate in turn with the best
   * kept (held first, then the post's integrity, then the buildings lost).
   */
  const defend = (build: () => SimConfig): { config: SimConfig; outcome: SiegeOutcome } => {
    const standing = town.mandate;
    const mandates: (MandateId | undefined)[] =
      opts.mandate === 'best' && faction === 'un' ? [...MANDATE_IDS] : [standing];
    let best: { config: SimConfig; outcome: SiegeOutcome } | null = null;
    for (const id of mandates) {
      if (id === undefined) delete town.mandate;
      else town.mandate = id;
      const built = build();
      const config = opts.defenceOrders ? { ...built, standingOrders: opts.defenceOrders } : built;
      const outcome = fight(config, faction);
      if (best === null || betterDefence(outcome, best.outcome)) best = { config, outcome };
    }
    if (standing === undefined) delete town.mandate;
    else town.mandate = standing;
    run.commanded++;
    run.cpSpent += best!.outcome.stats.cpSpent;
    run.cpRefunded += best!.outcome.stats.cpRefunded ?? 0;
    return best!;
  };
  /** The force made whole again, as far as the facilities and the stores go. */
  const retrain = (at: number): void => {
    act('training', () => {
      for (const [kind, n] of Object.entries(forceAt(town.frontline.tier).wanted)) {
        let queued = 0;
        for (const s of town.structures) queued += (s.trainQueue ?? []).filter((k) => k === kind).length;
        for (let short = n - (town.army[kind] ?? 0) - queued; short > 0; short--) {
          const facility = facilityFor(town, kind);
          if (facility === undefined || !queueTrain(town, facility, kind, at)) break;
        }
      }
    });
  };

  for (let day = 0; day < days; day++) {
    if (day % everyDays !== 0) continue;
    for (let session = 0; session < perDay; session++) {
      const at = begin + day * DAY + Math.min(waking, session * cadenceHours * HOUR);
      // Arriving: what the absence owed, then the time itself.
      const probes = act('probes', () => runOfflineProbes(town, at));
      run.probes += probes.length;
      run.probesHeld += probes.filter((p) => p.held).length;
      advance(at);

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
          const { config, outcome } = defend(() => liveDefenseConfig(town)!);
          const pending = claimLiveDefense(town)!;
          siege('defences', at, () =>
            applyLiveDefense(town, { level: pending.level, at: pending.at, config }, outcome, at),
          );
          run.defences++;
          if (outcome.victory) run.defencesHeld++;
        }
      }
      const counterattack = (when: number): void => {
        if (!town.frontline.pendingCounterattack) return;
        const { outcome } = defend(() => counterattackConfig(town, seedAt(when, 1)));
        siege('counterattacks', when, () => applyCounterResult(town, outcome, when));
        run.counters++;
        if (outcome.victory) run.countersHeld++;
      };
      counterattack(at);

      // The raids, each when the whole force is home and trained. A second
      // one waits out the first one's retraining, minute by minute.
      let clock = at;
      for (let r = 0; r < raidsPerSession && policy !== 'peace'; r++) {
        // A commander growing the army keeps its training queues full: five a
        // facility, re-queued as each finishes, and before the first raid of
        // a session too when the yard is short. The week at war's commander
        // queues once a raid, and its tables were read that way.
        const yardFull = (): boolean =>
          Object.entries(forceAt(town.frontline.tier).wanted).every(([kind, n]) => (town.army[kind] ?? 0) >= n);
        const keeping = opts.grow || opts.keepQueues;
        if (r > 0 || (keeping && !yardFull())) {
          for (let m = 1; m <= RAID_TURNAROUND_MIN; m++) {
            if (keeping) retrain(clock + (m - 1) * MIN);
            advance(clock + m * MIN);
          }
          clock += RAID_TURNAROUND_MIN * MIN;
          // A counterattack the last raid earned is fought before the next one goes.
          counterattack(clock);
        }
        const { plan, wanted } = forceAt(town.frontline.tier);
        const ready = Object.entries(wanted).every(([kind, n]) => (town.army[kind] ?? 0) >= n);
        if (!ready) break;
        const when = clock;
        const target = chooseTarget(town, retake, opts.front ?? 'cycle', variant++);
        act('scouting', () => scoutTarget(town, target.tier, target.slot, when));
        const base = postAt(town, target.tier, target.slot);
        const retaking = target.tier < town.frontline.tier;
        const dug = opts.tunnel && canTunnel(faction) ? tunnelPlanFor(faction, base, base.tier, plan) : plan;
        const squads = dug.map((s, i) => {
          const slot = slotOf(s, i);
          return { ...s, slot, vet: squadVet(town, slot) };
        });
        const fx = researchEffects(town);
        const config = raidConfig(base, squads, seedAt(when, 2 + r * 5), trainableFor(faction), {
          objective: 'post',
          ...(fx.unitHp !== 1 || fx.unitDamage !== 1 ? { mods: { hp: fx.unitHp, damage: fx.unitDamage } } : {}),
          autoPowers: DOCTRINE_SUPPORT.autoPowers!.filter((rule) => (town.charges[rule.kind] ?? 0) > 0),
          powerCharges: { ...town.charges },
          condition: conditionAt(when),
        });
        const res = resolveRaid(config, squads, base.tier, raidCatalogFor(faction), ladderPayout(town, when));
        act('raids', () => applyRaidResult(town, base, res, config, when));
        run.raids++;
        if (res.cleared) run.cleared++;
        if (res.cleared && retaking) run.retaken++;
        for (let t = run.peakTier + 1; t <= town.frontline.tier; t++) run.reachedOn[t] = (when - begin) / DAY;
        if (run.wonOn === undefined && town.frontline.wonAt !== undefined) run.wonOn = (when - begin) / DAY;
        run.peakTier = Math.max(run.peakTier, town.frontline.tier);
        if (r + 1 < raidsPerSession) retrain(when);
      }
      // A skirmish at the town's level, climbing while it holds. A loss ends
      // the day's skirmishing: a commander tries a level again tomorrow rather
      // than throwing the town at it all evening.
      if (policy === 'raids+skirmish' && lostSkirmishOn !== day) {
        const { outcome } = defend(() => siegeConfig(town, seedAt(at, 3)));
        siege('skirmishes', at, () => applySiegeResult(town, outcome, at));
        run.skirmishes++;
        if (outcome.victory) run.skirmishesHeld++;
        else lostSkirmishOn = day;
      }

      // The losses retrained, and the next project.
      retrain(clock);
      restore(clock);
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

      for (let m = 1; m < sessionMinutes; m++) advance(clock + m * MIN);
      if (run.graph === null && town.research.completed.length === TECHS.length) run.graph = (at - begin) / DAY;
    }
  }
  run.tier = town.frontline.tier;
  run.peakTier = Math.max(run.peakTier, town.frontline.tier);
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

/**
 * M25 Phase 2: what the enemy's strikes cost a commander, by how often they
 * play. The town of the week at war raids the Front Line for four weeks, up
 * to three raids a session, at one, two, three and seven days between
 * sessions: with the enemy's clock stopped, then with it running and each way
 * of answering it.
 */
export function frontTable(faction: FactionId = 'usa', days = 28): string {
  const start = warTown(faction);
  const lines = [
    `THE ENEMY STRIKES BACK — ${faction.toUpperCase()}: the town of the week at war raiding the Front Line for ` +
      `${days} days, up to three raids a session`,
    'EVERY | ENEMY | ANSWER | RAIDS CLEARED | RETAKEN | LOST | FELL BACK | RUNG (PEAK)',
  ];
  for (const every of [1, 2, 3, 7]) {
    const runs: [string, string, WarOptions][] = [
      ['off', '—', { raidsPerSession: 3, front: 'easiest', strikes: false }],
      ['on', 'push', { raidsPerSession: 3, front: 'easiest', retake: 'push' }],
      ['on', 'hold', { raidsPerSession: 3, front: 'easiest', retake: 'hold' }],
    ];
    for (const [enemy, answer, opts] of runs) {
      const run = playWarWeek(start, 'raids', every * 24, days, 10, opts);
      lines.push(
        `${pad(`${every} d`, 5)} | ${enemy.padEnd(5)} | ${answer.padEnd(6)} | ` +
          `${pad(`${run.cleared}/${run.raids}`, 13)} | ${pad(run.retaken, 7)} | ${pad(run.lost, 4)} | ` +
          `${pad(run.fellBack, 9)} | ${pad(`${run.tier} (${run.peakTier})`, 11)}`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * M25 Phase 3: what the supply line takes of the surplus. The week at war's
 * three commanders, from the first rung as the week at war starts and from the
 * eighth, a month or so into a war, every town behind it held: what the depots
 * made, what the line took, what a full store still lost, and whether the line
 * ever went short.
 */
export function supplyTable(faction: FactionId = 'usa'): string {
  const start = warTown(faction);
  const lines = [
    `THE SUPPLY LINE — ${faction.toUpperCase()}: the town of the week at war for a week; per day`,
    'EVERY | WHO            | FROM | MADE S | THE LINE S | LOST FULL S | THE WAR, NET S | RUNG | LOST HUNGRY',
  ];
  for (const hours of [2, 8, 24]) {
    for (const from of [1, 8]) {
      for (const policy of POLICIES) {
        const run = playWarWeek(start, policy, hours, 7, 10, { startTier: from });
        const B = run.books;
        const perDay = (n: number): string => k(n / run.span);
        lines.push(
          `${pad(`${hours} h`, 5)} | ${policy.padEnd(14)} | ${pad(from, 4)} | ${pad(perDay(B.made.supplies), 6)} | ` +
            `${pad(`${perDay(B.front)} ${pct(B.front, B.made.supplies)}`, 10)} | ` +
            `${pad(pct(B.atCap.supplies, B.made.supplies), 11)} | ${pad(perDay(warNet(B).supplies), 14)} | ` +
            `${pad(run.tier, 4)} | ${pad(run.hungry, 11)}`,
        );
      }
    }
  }
  return lines.join('\n');
}

/**
 * M25 Phase 4a: whether the capital can be reached. The town of the week at
 * war raids daily for ten weeks, up to three raids a session at the easiest
 * open post, answering the enemy's strikes by pushing: with the reference force
 * throughout, and with a force that grows four men a rung past the fifth, as
 * the deep rungs are tuned for. The day it first reaches each of the deep
 * rungs, and the stronghold.
 */
export function reachTable(faction: FactionId = 'usa', days = 70): string {
  const start = warTown(faction);
  const tiers = [5, 7, 9, 11, 13];
  const lines = [
    `THE ROAD TO THE CAPITAL — ${faction.toUpperCase()}: the town of the week at war, daily for ${days} days`,
    `FORCE      | ${tiers.map((t) => `T${t}`.padStart(6)).join(' | ')} |    WON | RUNG`,
  ];
  for (const [name, grow] of [
    ['reference', false],
    ['growing', true],
  ] as const) {
    const run = playWarWeek(start, 'raids', 24, days, 10, {
      raidsPerSession: 3,
      front: 'easiest',
      retake: 'push',
      grow,
    });
    const on = (d: number | undefined): string => (d === undefined ? '—' : `day ${Math.round(d)}`);
    lines.push(
      `${name.padEnd(10)} | ${tiers.map((t) => on(run.reachedOn[t]).padStart(6)).join(' | ')} | ` +
        `${on(run.wonOn).padStart(6)} | ${pad(run.tier, 4)}`,
    );
  }
  return lines.join('\n');
}

/**
 * M26 Phase 1: China's Production Surge, off and on.
 *
 * The surge halves the price of training for half an hour after a battle the
 * commander fought. Built first as double speed, it was measured inert: a raid's
 * losses retrain in a median 50 seconds, 30 surged, and a week of three raids
 * a session came out identical either way, because nothing in this economy
 * waits on training time. What limits a refill is what it costs, so this reads
 * the week at war where the price shows: what training costs a day, what the
 * war nets, and whether the cheaper refill buys more raids or a deeper rung.
 */
export function surgeTable(): string {
  const faction: FactionId = 'china';
  const week = (live: boolean, policy: WarPolicy, raidsPerSession: number): WarRun => {
    setSignaturesLive(live);
    try {
      return playWarWeek(warTown(faction), policy, 2, 7, 10, { raidsPerSession });
    } finally {
      setSignaturesLive(false);
    }
  };
  const lines = [
    'PRODUCTION SURGE — China, the week at war (a session every 2 h), training at half price for 30 min after a battle fought',
    'WHO                     | SURGE | TRAINING S/DAY | THE WAR, NET S/F/I | RAIDS/DAY | CLEARED/DAY | RUNG',
  ];
  const cases: [string, WarPolicy, number][] = [
    ['raids', 'raids', 1],
    ['raids, 3 a session', 'raids', 3],
    ['raids+skirmish', 'raids+skirmish', 1],
  ];
  for (const [who, policy, per] of cases) {
    for (const live of [false, true]) {
      const run = week(live, policy, per);
      const perDay = (n: number): string => (n / run.days).toFixed(1);
      const training = run.books.actions['training']?.supplies ?? 0;
      const net = warNet(run.books);
      lines.push(
        `${pad(live ? '' : who, 23)} | ${pad(live ? 'on' : 'off', 5)} | ${pad(k(training / run.days), 14)} | ` +
          `${pad(`${k(net.supplies / run.days)}/${k(net.fuel / run.days)}/${k(net.intel / run.days)}`, 18)} | ` +
          `${pad(perDay(run.raids), 9)} | ${pad(perDay(run.cleared), 11)} | ${pad(run.peakTier, 4)}`,
      );
    }
  }
  return lines.join('\n');
}

// ---- M26 Phase 2: how a turn is spent -----------------------------------------------

/** The shape of a turn: what it fought, what it spent its supplies on, and where they came from. */
interface TurnShape {
  battles: Record<string, number>;
  spent: Record<string, number>;
  earned: Record<string, number>;
}

const TURN_BATTLES = ['raids', 'skirmishes', 'defences', 'counters'] as const;
const TURN_SPENDS = ['repairs', 'wire', 'training', 'charges', 'research'] as const;
const TURN_SOURCES = ['raids', 'skirmishes', 'defences'] as const;
const TURN_KEYS: (keyof TurnShape)[] = ['battles', 'spent', 'earned'];

/** Counts to shares of their total, every key kept. */
function shares(counts: Record<string, number>): Record<string, number> {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, total > 0 ? v / total : 0]));
}

/** A week's turn, as shares. What the defences earned is the live defences, the counterattacks and the probes together. */
function shapeOf(run: WarRun): TurnShape {
  const a = run.books.actions;
  const net = (name: string): number => a[name]?.supplies ?? 0;
  return {
    battles: shares({ raids: run.raids, skirmishes: run.skirmishes, defences: run.defences, counters: run.counters }),
    spent: shares(Object.fromEntries(TURN_SPENDS.map((k) => [k, Math.max(0, -net(k))]))),
    earned: shares({
      raids: Math.max(0, net('raids')),
      skirmishes: Math.max(0, net('skirmishes')),
      defences: Math.max(0, net('defences') + net('counterattacks') + net('probes')),
    }),
  };
}

/** Total-variation distance: the share of one mix that would have to move to match the other. */
function tvDistance(p: Record<string, number>, q: Record<string, number>): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let sum = 0;
  for (const k of keys) sum += Math.abs((p[k] ?? 0) - (q[k] ?? 0));
  return sum / 2;
}

/** How far a faction's turn sits from the mean of the other four's, on one of its three mixes. */
function divergenceOf(shapes: Record<FactionId, TurnShape>, faction: FactionId, key: keyof TurnShape): number {
  const others = (Object.keys(shapes) as FactionId[]).filter((f) => f !== faction);
  const mean: Record<string, number> = {};
  for (const other of others) {
    for (const [k, v] of Object.entries(shapes[other][key])) mean[k] = (mean[k] ?? 0) + v / others.length;
  }
  return tvDistance(shapes[faction][key], mean);
}

/**
 * THE TURN (M26 Phase 2): each faction's week at war, played by one
 * commander, read as the shape of the turn, with the signatures off and on.
 *
 * The commander is the same for all five: up to three raids a session, each
 * once the force is whole; every defence it fights, the live defence, the
 * counterattack and the skirmish, under its faction's CP line at CC3
 * (`DEFENCE_LINE`); the KPA through a tunnel wherever one is found; the UN
 * under the mandate each attack calls for. What differs is what each
 * faction's kit and rule make of it.
 *
 * A turn is read as three mixes, shares of the battles fought, of the
 * supplies spent and of the supplies earned, and a faction's divergence on
 * each is its distance from the mean of the other four: the part of its turn
 * that would have to move to look like theirs.
 */
export function turnTable(days = 7): string {
  const factions = Object.keys(DEFENCE_LINE) as FactionId[];
  const play = (faction: FactionId, live: boolean): WarRun => {
    setSignaturesLive(live);
    try {
      return playWarWeek(warTown(faction), 'raids+skirmish', 2, days, 10, {
        raidsPerSession: 3,
        keepQueues: true,
        defenceOrders: DEFENCE_LINE[faction].orders,
        mandate: 'best',
        tunnel: true,
      });
    } finally {
      setSignaturesLive(false);
    }
  };
  const runs = { off: {} as Record<FactionId, WarRun>, on: {} as Record<FactionId, WarRun> };
  for (const faction of factions) {
    runs.off[faction] = play(faction, false);
    runs.on[faction] = play(faction, true);
  }
  const shapes = {
    off: Object.fromEntries(factions.map((f) => [f, shapeOf(runs.off[f])])) as Record<FactionId, TurnShape>,
    on: Object.fromEntries(factions.map((f) => [f, shapeOf(runs.on[f])])) as Record<FactionId, TurnShape>,
  };
  const pct = (v: number): string => String(Math.round(v * 100));
  const mix = (m: Record<string, number>, keys: readonly string[]): string => keys.map((k) => pct(m[k] ?? 0)).join('/');
  const lines = [
    `THE TURN — each faction's week at war, one commander, a session every 2 h for ${days} days, signatures off and on`,
    'The commander: up to three raids a session, its training queues kept full; in every defence, CP spent on field',
    'defences on the post\'s approach, six a wave; the KPA through a tunnel where one is found; the UN under the',
    'mandate each attack calls for.',
    '',
    'THE SHAPE — shares of the turn, %',
    `FACTION | SIGS | BATTLES raid/skir/def/ctr | SPENT repair/wire/train/chrg/research | EARNED raid/skir/def`,
  ];
  for (const f of factions) {
    for (const sig of ['off', 'on'] as const) {
      const sh = shapes[sig][f];
      lines.push(
        `${pad(sig === 'off' ? f.toUpperCase() : '', 7)} | ${pad(sig, 4)} | ${pad(mix(sh.battles, TURN_BATTLES), 25)} | ` +
          `${pad(mix(sh.spent, TURN_SPENDS), 37)} | ${pad(mix(sh.earned, TURN_SOURCES), 19)}`,
      );
    }
  }
  lines.push('');
  lines.push('WHAT IT GOT — per day unless marked');
  lines.push('FACTION | SIGS | BATTLES/SESSION | CP A DEFENCE (BACK) | DEFENCES HELD | SKIRMISHES HELD | LEVEL | RUNG | THE WAR, NET S/F');
  for (const f of factions) {
    for (const sig of ['off', 'on'] as const) {
      const run = runs[sig][f];
      const sessions = run.sessionsPerDay * run.days;
      const battles = run.raids + run.skirmishes + run.defences + run.counters;
      const net = warNet(run.books);
      lines.push(
        `${pad(sig === 'off' ? f.toUpperCase() : '', 7)} | ${pad(sig, 4)} | ${pad((battles / sessions).toFixed(2), 15)} | ` +
          `${pad(`${(run.cpSpent / Math.max(1, run.commanded)).toFixed(0)} (${(run.cpRefunded / Math.max(1, run.commanded)).toFixed(0)})`, 19)} | ` +
          `${pad(`${run.defencesHeld + run.countersHeld}/${run.defences + run.counters}`, 13)} | ` +
          `${pad(`${run.skirmishesHeld}/${run.skirmishes}`, 15)} | ${pad(run.assaultLevel, 5)} | ${pad(run.peakTier, 4)} | ` +
          `${pad(`${k(net.supplies / run.days)}/${k(net.fuel / run.days)}`, 16)}`,
      );
    }
  }
  lines.push('');
  lines.push('DIVERGENCE — distance from the mean of the other four (0 the same turn, 1 nothing in common)');
  lines.push('FACTION | BATTLES off→on | SPENT off→on | EARNED off→on | MEAN off→on | LARGEST MOVE, off→on');
  for (const f of factions) {
    const d = (sig: 'off' | 'on', key: keyof TurnShape): number => divergenceOf(shapes[sig], f, key);
    const mean = (sig: 'off' | 'on'): number => TURN_KEYS.reduce((sum, key) => sum + d(sig, key), 0) / TURN_KEYS.length;
    const cell = (key: keyof TurnShape): string => `${d('off', key).toFixed(2)} → ${d('on', key).toFixed(2)}`;
    // The share that moved most when the signatures came on.
    let move = { label: '—', delta: 0 };
    for (const key of TURN_KEYS) {
      for (const [cat, on] of Object.entries(shapes.on[f][key])) {
        const delta = on - (shapes.off[f][key][cat] ?? 0);
        if (Math.abs(delta) > Math.abs(move.delta)) move = { label: `${key} ${cat}`, delta };
      }
    }
    lines.push(
      `${pad(f.toUpperCase(), 7)} | ${pad(cell('battles'), 14)} | ${pad(cell('spent'), 12)} | ${pad(cell('earned'), 13)} | ` +
        `${pad(`${mean('off').toFixed(2)} → ${mean('on').toFixed(2)}`, 11)} | ` +
        `${move.label} ${move.delta >= 0 ? '+' : ''}${pct(move.delta)} pts`,
    );
  }
  return lines.join('\n');
}
