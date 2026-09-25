/**
 * The last stand (M25 Phase 4c): the enemy at your capital.
 *
 * The strikes push a quiet front back a town at a time, and until now they
 * stopped at the first town, since behind it there is nothing but the base
 * and the base is never taken. Now, when a quiet spell's strike finds the
 * front already at the first town, in a war whose front was once deeper, the
 * enemy marches on the capital instead. It takes long neglect to get here:
 * from the sixth rung, fifteen sectors lost and a strike more, eight quiet
 * spells with nothing retaken.
 *
 * It is offered as a live defence is, with the same window, and answered the
 * same two ways. Defend it in person, with the town's siege economy; or leave
 * it to the garrison, which fights the whole assault under the standing
 * orders, not a probe's two waves, and can lose. An offer walked away from is
 * left to the garrison. Held, the enemy is thrown back from the gates, with a
 * skirmish's loot at its level and standing. Lost, the capital is sacked:
 * every building that fell is wrecked, as in any played siege, a larger share
 * of the stockpile goes than a defeat takes, and standing with it. It cannot
 * end the war, which goes on from the first town.
 *
 * Its level is the town's own: the middle of the band where the permanent
 * defences of a town its size, left to themselves, hold the whole assault
 * some of the time (`LAST_STAND_LEVEL`), so what the commander does decides
 * it.
 */
import { assaultLoot } from '../content/assaults';
import { defenseCatalogFor } from '../content/factions';
import { LAST_STAND_HELD, LAST_STAND_LOST } from '../content/leagues';
import { standingOrdersFor } from '../content/standingOrders';
import { LAST_STAND_LEVEL } from '../content/theaters';
import { Engine } from '../sim/engine';
import type { SimConfig } from '../sim/types';
import { awardStanding } from './ladder';
import {
  applyLastStandResult,
  lastStandConfig,
  outcomeFromEngine,
  surge,
  townCc,
  warLog,
  type DefenseLogEntry,
  type FrontlineState,
  type LastStand,
  type SiegeOutcome,
  type TownState,
} from './town';
import { recordBattle } from './vault';
import { DEFENSE_LOG_CAP, DEFENSE_OFFER_MS, PROBE_SHIELD_MS } from './warfare';

/** The battle's seed, from the moment the march was sounded. */
const marchSeed = (at: number): number => (Math.floor(at / 60_000) * 2654435761 + 104729) >>> 0;

/** A battle the garrison fights to its end, however long the whole assault runs. */
const HEADLESS_TICKS = 40_000;

/**
 * The enemy can march: the front is at the first town, the war's front was
 * once deeper, and no march is already waiting on an answer.
 */
export function canMarch(town: TownState): boolean {
  const fl = town.frontline;
  return fl.tier <= 1 && (fl.deepest ?? fl.tier) > 1 && fl.lastStand === undefined;
}

/** The last stand's level, by the town's faction and command post. */
export function lastStandLevel(town: TownState): number {
  const levels = LAST_STAND_LEVEL[town.faction];
  return levels[townCc(town).level] ?? levels[1]!;
}

/**
 * Sound the march at `at`, found by a charge at `now`: the offer's window
 * opens at the charge, since a march sounded while nobody was there is
 * announced when they come back.
 */
export function marchOnCapital(town: TownState, at: number, now: number): LastStand {
  const stand: LastStand = {
    at,
    level: lastStandLevel(town),
    seed: marchSeed(at),
    expiresAt: Math.max(at, now) + DEFENSE_OFFER_MS,
  };
  town.frontline.lastStand = stand;
  return stand;
}

/** What holding it pays: a skirmish's loot at its level, the whole of it. */
export const lastStandBounty = (level: number): { supplies: number; fuel: number } => assaultLoot(level);

/** The battle behind a march, or null when none is waiting. */
export function standConfig(town: TownState): SimConfig | null {
  const stand = town.frontline.lastStand;
  return stand ? lastStandConfig(town, stand.level, stand.seed) : null;
}

/**
 * Commit to fighting it in person. The march stays on the board with its
 * window shut, as a claimed live defence does, so closing the game mid-battle
 * leaves it to the garrison on the next load rather than making it vanish.
 */
export function claimLastStand(town: TownState): LastStand | null {
  const stand = town.frontline.lastStand;
  if (!stand) return null;
  town.frontline.lastStand = { ...stand, expiresAt: stand.at };
  return stand;
}

/** What a last stand did, for the banner and the log. */
export interface LastStandResult {
  level: number;
  held: boolean;
  /** Fought in person, not by the garrison. */
  live: boolean;
  suppliesLost: number;
  fuelLost: number;
  bounty: { supplies: number; fuel: number };
}

/**
 * Fold a finished last stand into the town, fought in person (`live`) or by
 * the garrison: the siege's economics (`applyLastStandResult`), then the
 * record, the board and the log. A defence fought in person counts as the
 * commander playing, and restarts the quiet clock; one the garrison fought
 * does not, as an offline probe does not.
 */
export function applyLastStand(
  town: TownState,
  stand: LastStand,
  outcome: SiegeOutcome,
  config: SimConfig,
  now: number,
  live: boolean,
): LastStandResult {
  delete town.frontline.lastStand;
  const bounty = lastStandBounty(stand.level);
  const cost = applyLastStandResult(town, outcome, bounty, now);
  // The commander's battle surges the lines (M26); the garrison's does not.
  if (live) surge(town, now);
  const log = warLog(town);
  if (outcome.victory) {
    log.lastStandsHeld++;
  } else {
    log.sacks++;
    log.sackedAt = stand.at;
    town.shieldUntil = now + PROBE_SHIELD_MS;
  }
  const entry: DefenseLogEntry = {
    at: stand.at,
    level: stand.level,
    held: outcome.victory,
    suppliesLost: cost.suppliesLost,
    fuelLost: cost.fuelLost,
    ...(outcome.stats.ccKillerKind ? { killer: outcome.stats.ccKillerKind } : {}),
    ...(config.standingOrders ? { orders: config.standingOrders.id } : {}),
    ...(live ? { live: true } : {}),
    lastStand: true,
    config,
  };
  town.defenseLog.unshift(entry);
  town.defenseLog.length = Math.min(town.defenseLog.length, DEFENSE_LOG_CAP);
  if (!live) {
    // The garrison's battle is kept, as a probe's is: the sack is watchable.
    recordBattle(town, {
      kind: 'probe',
      faction: town.faction,
      title: `LAST STAND — LEVEL ${stand.level}`,
      won: outcome.victory,
      at: stand.at,
      detail: outcome.victory ? 'the garrison held the capital' : 'SACKED',
      config,
    });
  }
  awardStanding(town, outcome.victory ? LAST_STAND_HELD : LAST_STAND_LOST, now, live);
  return { level: stand.level, held: outcome.victory, live, ...cost, bounty };
}

/**
 * The garrison fights it: the whole assault, headless, under the standing
 * orders, the town's siege economy behind them as it would be behind the
 * commander.
 */
function garrisonFights(town: TownState, stand: LastStand, now: number): LastStandResult {
  const orders = standingOrdersFor(town.standingOrders);
  const config: SimConfig = {
    ...lastStandConfig(town, stand.level, stand.seed),
    ...(orders ? { standingOrders: orders } : {}),
  };
  const engine = new Engine(config, defenseCatalogFor(town.faction));
  engine.enqueue({ tick: 0, type: 'startAssault' });
  while (engine.phase !== 'victory' && engine.phase !== 'defeat' && engine.tick < HEADLESS_TICKS) {
    engine.step();
  }
  return applyLastStand(town, stand, outcomeFromEngine(engine), config, now, false);
}

/** Leave it to the garrison: it is fought now. */
export function declineLastStand(town: TownState, now: number): LastStandResult | null {
  const stand = town.frontline.lastStand;
  if (!stand) return null;
  return garrisonFights(town, stand, now);
}

/**
 * A march whose window has shut, walked away from or claimed and abandoned,
 * is fought by the garrison: on the next load, or the frame the window shuts
 * with the game open. Null when nothing is due.
 */
export function resolveLapsedLastStand(town: TownState, now: number): LastStandResult | null {
  const stand = town.frontline.lastStand;
  if (!stand || now < stand.expiresAt) return null;
  return garrisonFights(town, stand, now);
}

/**
 * Repair the two fields off disk. The deepest rung is kept only as a whole
 * rung past the front's own; a file from before has none, and cannot be
 * marched on until its front has been pushed back after the update. A march
 * is kept only whole: four finite numbers and a level that is a level.
 */
export function normalizeLastStand(fl: FrontlineState): void {
  const deepest: unknown = fl.deepest;
  if (deepest !== undefined && !(typeof deepest === 'number' && Number.isInteger(deepest) && deepest > fl.tier)) {
    delete fl.deepest;
  }
  const raw: unknown = fl.lastStand;
  if (raw === undefined) return;
  const s = raw as Record<string, unknown>;
  const whole =
    raw !== null &&
    typeof raw === 'object' &&
    ['at', 'level', 'seed', 'expiresAt'].every((k) => typeof s[k] === 'number' && Number.isFinite(s[k])) &&
    Number.isInteger(s['level']) &&
    (s['level'] as number) >= 1;
  if (!whole) delete fl.lastStand;
}
