import {
  contractDay,
  contractsAt,
  CONTRACTS_PER_DAY,
  type Contract,
  type ContractMetric,
} from '../content/contracts';
import { leagueOf } from './ladder';
import type { TownState } from './town';

/**
 * Daily contracts, town side (v1.12).
 *
 * The three orders in force are a function of the clock, so nothing about
 * WHICH contracts exist is stored — only how far along today's are. The day
 * index is stored with them, so opening the game on a new day silently posts
 * new orders instead of crediting yesterday's progress against them.
 *
 * A completed contract PAYS ITSELF, immediately, rather than waiting to be
 * claimed. This is a game built to be left alone for a day: a reward that
 * expires because nobody tapped it punishes exactly the play pattern the rest
 * of the design encourages. The screen is there to read what today asks, not
 * to collect a debt.
 */

/** What a finished contract actually paid. */
export interface ContractPay {
  supplies: number;
  fuel: number;
  intel: number;
}

export interface ContractState {
  /** Day index (since LADDER_EPOCH) these orders belong to. */
  day: number;
  /** Progress per contract, in the order contractsAt returns them. */
  progress: number[];
  /** Which have already paid out. */
  paid: boolean[];
  /**
   * What each one paid, or null if it has not. Stored rather than recomputed
   * because the rate is the commander's BAND at the moment of payment, and a
   * raid that finishes a contract can move the band in the same breath — a
   * screen that recomputed the figure would sometimes print a number nobody
   * was ever paid.
   */
  pay: (ContractPay | null)[];
}

const fresh = (day: number): ContractState => ({
  day,
  progress: Array.from({ length: CONTRACTS_PER_DAY }, () => 0),
  paid: Array.from({ length: CONTRACTS_PER_DAY }, () => false),
  pay: Array.from({ length: CONTRACTS_PER_DAY }, () => null),
});

/**
 * Today's orders and today's progress, rolled over if the day turned.
 *
 * Yesterday's progress is not carried: a contract is a day's work, and
 * half-finishing one at 23:50 does not put you halfway through tomorrow's.
 */
export function contractState(town: TownState, now: number): ContractState {
  const day = contractDay(now);
  const held = town.contracts;
  if (!held || held.day !== day) {
    town.contracts = fresh(day);
    return town.contracts;
  }
  return held;
}

/** What a contract pays this commander: the base, at their band's rate. */
export function contractPay(town: TownState, contract: Contract): ContractPay {
  // Goals are flat, so a tier-5 commander runs the same errand a tier-1 one
  // does. The band multiplier is what keeps it worth their afternoon.
  const rate = leagueOf(town).loot;
  return {
    supplies: Math.round(contract.pay.supplies * rate),
    fuel: Math.round(contract.pay.fuel * rate),
    intel: Math.round(contract.pay.intel * rate),
  };
}

/** One contract finished and paid. */
export interface ContractPayout {
  contract: Contract;
  pay: ContractPay;
}

/**
 * Credit progress against today's orders and pay out anything that finishes.
 *
 * Every metric has exactly one call site, which is the point: a contract that
 * counted the same event from two places would drift, and nothing in the save
 * could tell you which count was right.
 */
export function creditContracts(
  town: TownState,
  metric: ContractMetric,
  amount: number,
  now: number,
): ContractPayout[] {
  if (amount <= 0) return [];
  const state = contractState(town, now);
  const today = contractsAt(now);
  const paid: ContractPayout[] = [];

  today.forEach((contract, i) => {
    if (contract.metric !== metric || state.paid[i]) return;
    const at = Math.min(contract.goal, (state.progress[i] ?? 0) + amount);
    state.progress[i] = at;
    if (at < contract.goal) return;
    state.paid[i] = true;
    const pay = contractPay(town, contract);
    state.pay[i] = pay;
    town.supplies += pay.supplies;
    town.fuel += pay.fuel;
    town.intel += pay.intel;
    paid.push({ contract, pay });
  });
  return paid;
}

/** How many of today's three are done. */
export function contractsDone(town: TownState, now: number): number {
  return contractState(town, now).paid.filter(Boolean).length;
}

/** Repair a contract block off disk; junk becomes a clean sheet for today. */
export function normalizeContracts(raw: unknown, now: number): ContractState {
  const day = contractDay(now);
  if (!raw || typeof raw !== 'object') return fresh(day);
  const held = raw as Partial<ContractState>;
  if (typeof held.day !== 'number' || !Number.isFinite(held.day)) return fresh(day);
  // Orders from another day are not repaired, they are replaced — which is
  // also what happens on any ordinary read, so this is the same rule.
  if (Math.round(held.day) !== day) return fresh(day);
  const state = fresh(day);
  const num = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  for (let i = 0; i < CONTRACTS_PER_DAY; i++) {
    state.progress[i] = num(Array.isArray(held.progress) ? held.progress[i] : undefined);
    state.paid[i] = Array.isArray(held.paid) && held.paid[i] === true;
    const pay = Array.isArray(held.pay) ? held.pay[i] : undefined;
    state.pay[i] =
      state.paid[i] && pay && typeof pay === 'object'
        ? { supplies: num(pay.supplies), fuel: num(pay.fuel), intel: num(pay.intel) }
        : null;
  }
  return state;
}
