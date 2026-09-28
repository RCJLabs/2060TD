import { waveModifierOf } from '../sim/read';
import { createRng, rollRange, type Rng } from '../sim/rng';
import type { Doctrine, SiegeDef, WaveDef, WaveEntry, WaveModifier, WaveMods } from '../sim/types';
import { series } from './missions';

/**
 * The pre-campaign assault ladder (M2): a deterministic difficulty generator.
 * Level 1 is a three-wave probing attack; grenadiers arrive at level 2, armor
 * and the Type 99 at level 3; from there counts scale up without mercy.
 *
 * `startingSupplies` is a placeholder — the town launcher substitutes the
 * player's actual stockpile when the battle begins.
 */

const scaleCount = (base: number, level: number, growth: number): number =>
  Math.max(1, Math.round(base * (1 + growth * (level - 1))));

/**
 * How much a level adds, and why it is so much smaller than it used to be.
 *
 * M23 Phase 3a measured the CONTESTED BAND — the range of attacker strength
 * over which a defence row lands somewhere between winning every seed and
 * losing every seed — at roughly 0.7x to 1.0x, about 43% wide. It then
 * measured what a level actually cost: +67% and +58% at the bottom of the
 * ladder against +9% at the top. A step bigger than the band jumps clean over
 * it, which is why 93% of defence rows were step functions with one contested
 * level or none, and why the single row that ramped was the one whose flip
 * happened to land in the flat part.
 *
 * You cannot fix that inside six levels. A 6-rung ladder spanning this
 * difficulty range has a floor of +33% per rung even when perfectly uniform,
 * and holding the mean while flattening forces level 1 up by 54% — which is
 * not a probing attack any more. So the ladder is LONGER instead: +9% per
 * level with new waves ramping in gently, giving a worst step of +25%,
 * comfortably inside the band, with level 1 untouched at its original size
 * and the old level 6 arriving at level 11.
 *
 * `assaultLevel` was never capped, so nothing in the meta had to change for
 * this — only saved towns, which are rescaled on load by `rescaleLadder`.
 *
 * +7% since M34, from +9%: see `LADDER`, which moved with it.
 */
const LADDER_GROWTH = 0.07;

/**
 * The ladder's rates, named together so a sweep can hold two and move one
 * (`npm run balance -- --retune`). Nothing but the balance harness passes
 * anything other than `LADDER`.
 *
 * Re-tuned for the 10x15 board (M34), whose kill chain sends a crew stuck on
 * a covered post after the guns covering it. That makes each heavy a bigger
 * step than it was on 20x30: a heavy that reaches the post now kills what
 * holds it shut. On the shipped ladder the third heavy, at level 7, took MID
 * from holding every seed to holding one or none for three factions in five,
 * and the rows fell 1.13 levels sooner than v1.44's on average.
 *
 * Twelve ladders were priced against where v1.44's rows first held under half.
 * A heavy every four levels instead of two, with each level adding 7%
 * instead of 9%, came closest: a mean shift of −0.07 levels, every row
 * within one of v1.44's, and none rising. The heavy cadence alone left MID a
 * level short, and slower growth alone barely moved it. Rotors were not the
 * problem, and they stay every two levels.
 */
export interface Ladder {
  /** What each level adds to every wave's counts: `LADDER_GROWTH`. */
  readonly growth: number;
  /** Levels between heavies, from the first at level 3. */
  readonly heavyEvery: number;
  /** Levels between rotors, from the first at level 4. */
  readonly rotorEvery: number;
}

export const LADDER: Ladder = { growth: LADDER_GROWTH, heavyEvery: 4, rotorEvery: 2 };

/**
 * A newly unlocked wave arrives at a FRACTION of its strength and grows in.
 *
 * `scaleCount` is a gentle +18% per level, but that was never what a level
 * actually cost: waves 4, 5 and 6 unlock at levels 2, 3 and 4 and arrived at
 * full size, so the real steps were +67%, +58% and +29% in units fielded
 * against +9-19% once the ladder runs out of waves to add. M23 Phase 3a
 * measured the contested band — where a defence row lands between 5% and 95%
 * rather than at one end — at roughly 0.7x to 1.0x of attacker strength, about
 * 43% wide. A 58% step jumps clean over it, which is why 93% of defence rows
 * were step functions and the single row that ramped was the one whose flip
 * landed in the flat part of the ladder.
 *
 * So the wave still ARRIVES on schedule — the lesson it teaches is the reason
 * it exists, and delaying it would cost the ladder its shape — but it arrives
 * at 40% and reaches full strength two levels later. The teaching order is
 * untouched; only the size of the step changes.
 */
const waveRamp = (level: number, unlockLevel: number): number =>
  Math.min(1, 0.15 + 0.1 * (level - unlockLevel));

/**
 * An `assaultLevel` from before the ladder was lengthened, in new levels.
 *
 * Derived from the curves rather than chosen: the smallest new level whose
 * assault is at least as large as the old one's was.
 *
 *     old  1   2   3   4    5    6
 *     new  1   4   7   9   10   11
 *
 * Past the table it keeps the same slope, so a town deep into the old ladder
 * does not suddenly find level 12 easier than the level 6 it just beat.
 */
const RESCALE = [1, 1, 4, 7, 9, 10, 11];

export function rescaleLadder(oldLevel: number): number {
  if (oldLevel <= 1) return 1;
  if (oldLevel < RESCALE.length) return RESCALE[oldLevel]!;
  return RESCALE[RESCALE.length - 1]! + (oldLevel - (RESCALE.length - 1)) * 2;
}

/** Wave-role → attacker kind, per enemy faction (China attacks by default). */
export interface AssaultRoster {
  swarm: string;
  line: string;
  breacher: string;
  ranged: string;
  lightVehicle: string;
  heavy: string;
  /** v1.0: the rotors that make a wall irrelevant. */
  gunship: string;
}

export const CHINA_ASSAULT_ROSTER: AssaultRoster = {
  swarm: 'militia',
  line: 'rifle',
  breacher: 'sapper',
  ranged: 'grenadier',
  lightVehicle: 'zbd',
  heavy: 'type99',
  gunship: 'wz10',
};

export const USA_ASSAULT_ROSTER: AssaultRoster = {
  swarm: 'guardsman',
  line: 'ranger',
  breacher: 'engineer',
  ranged: 'javelin',
  lightVehicle: 'humvee',
  heavy: 'abrams',
  gunship: 'reaper',
};

/**
 * One body of men in a wave, as the script writes it: `n` of `kind` from tick
 * `from`, one every `step` ticks, cycling through `cols` on the entry line.
 */
interface Group {
  from: number;
  step: number;
  n: number;
  kind: string;
  cols: number[];
}

const group = (from: number, step: number, n: number, kind: string, cols: number[]): Group => ({
  from,
  step,
  n,
  kind,
  cols,
});

/**
 * The ladder's script: what each wave fields at a level, group by group. Laid
 * out on the 20-cell entry line of the physical approach, about its middle.
 */
function scriptOf(level: number, roster: AssaultRoster, ladder: Ladder): Group[][] {
  const n = (base: number) => scaleCount(base, level, ladder.growth);
  const waves: Group[][] = [];

  // Wave 1 — probe: a swarm trickle with a line tail.
  waves.push([group(0, 40, n(6), roster.swarm, [7, 10, 13]), group(300, 40, n(1), roster.line, [10])]);

  // Wave 2 — the breach lesson: a breacher leads, the swarm pours through.
  waves.push([
    group(0, 0, 1, roster.breacher, [10]),
    group(60, 36, n(7), roster.swarm, [3, 7, 13, 17]),
    group(260, 40, n(2), roster.line, [10]),
  ]);

  // Wave 3 — infantry push with flanking breachers.
  waves.push([
    group(0, 40, n(5), roster.line, [7, 10, 13]),
    group(160, 60, n(2), roster.breacher, [3, 17]),
    ...(level >= 2 ? [group(240, 60, n(1), roster.ranged, [10])] : []),
  ]);

  // Wave 4 (level 2+) — suppression: standoff fire behind a screen.
  if (level >= 2) {
    const r = (base: number) => Math.max(1, Math.round(n(base) * waveRamp(level, 2)));
    waves.push([
      group(0, 20, r(4), roster.swarm, [3, 5]),
      group(0, 20, r(4), roster.swarm, [15, 17]),
      group(220, 50, r(2), roster.ranged, [8, 12]),
      ...(level >= 3 ? [group(380, 40, r(1), roster.lightVehicle, [10])] : []),
    ]);
  }

  // Wave 5 (level 3+) — the armored hammer.
  if (level >= 3) {
    const tanks = 1 + Math.floor((level - 3) / ladder.heavyEvery);
    const r = (base: number) => Math.max(1, Math.round(n(base) * waveRamp(level, 3)));
    waves.push([
      group(0, 40, r(2), roster.lightVehicle, [7, 13]),
      group(80, 40, r(4), roster.line, [5, 10, 15]),
      group(280, 50, r(2), roster.ranged, [8, 12]),
      group(380, 40, r(2), roster.breacher, [7, 13]),
      group(480, 80, tanks, roster.heavy, [10, 8, 12]),
    ]);
  }

  // Wave 6 (level 4+) — the sky. Rotors ignore the maze entirely, so a line
  // with no mount that can elevate simply watches them work.
  if (level >= 4) {
    const rotors = 1 + Math.floor((level - 4) / ladder.rotorEvery);
    const r = (base: number) => Math.max(1, Math.round(n(base) * waveRamp(level, 4)));
    waves.push([
      group(0, 40, r(3), roster.line, [5, 10, 15]),
      group(120, 70, rotors, roster.gunship, [7, 13, 10]),
      group(300, 50, r(2), roster.ranged, [8, 12]),
      ...(level >= 6 ? [group(420, 90, rotors, roster.gunship, [10, 8])] : []),
    ]);
  }
  return waves;
}

/** A wave exactly as the script writes it. */
const scripted = (groups: Group[]): WaveDef => ({
  entries: groups.flatMap((g) => series(g.from, g.step, g.n, g.kind, g.cols)),
});

/**
 * What the enemy can do to a wave (M35 Phase 1), and what each costs it.
 *
 * Every modifier is PRICED: the wave keeps `count` of each kind it fields in
 * numbers (see `IN_NUMBERS`), so a wave that makes the defence's life harder
 * in one way is lighter in another and weighs about what the script's wave
 * did. Each was priced on every wave after the first of the script, and each
 * lands within a point of the plain wave (`npm run balance -- --compose`).
 * The sim reads `mods` while the wave fights and each entry's `vet` on the
 * men; the read names the modifier from those, so nothing else needs to know
 * it by name.
 */
export interface ModifierDef {
  /** What the sim reads while the wave fights. */
  mods?: WaveMods;
  /** Veterancy on the kinds the wave fields in numbers: health and damage. */
  vet?: number;
  /** The share of each kind fielded in numbers the wave keeps, at least one. */
  count: number;
}

export const MODIFIERS: Readonly<Record<WaveModifier, ModifierDef>> = {
  /** The defence's guns see nine tenths as far. */
  night: { mods: { range: 0.9 }, count: 0.8 },
  /** No power can be cast, by the commander or by standing orders. */
  jammed: { mods: { jammed: true }, count: 0.9 },
  /** Quicker and lighter: less time under the guns, a little less to kill. */
  fast: { mods: { speed: 1.4, hp: 0.95 }, count: 1 },
  /** Fewer, and each one harder to kill and harder hitting. */
  veterans: { vet: 1.3, count: 0.65 },
};

export { waveModifierOf, type WaveModifier };

/**
 * How the enemy composes a wave (M35 Phase 1). All of it is drawn from the
 * battle's seed, so a siege is the same siege every time it is replayed.
 *
 * Each wave picks an AXIS — one of the three lanes of the entry line, both
 * flanks at once, or the script's broad front — and each group follows it or,
 * now and then, goes its own way down a single lane. The first wave is always
 * an assault on the post, for the same reason the script opens with a probe;
 * after that each wave draws one purpose for all its men. From level 3, a
 * wave after the first may carry one modifier. Groups start a little earlier
 * or later than the script says; the first group of a wave still leads.
 */
const COMPOSE_SALT = 0x5ea5e;
const AXES: readonly (readonly [Axis, number])[] = [
  ['west', 0.2],
  ['centre', 0.2],
  ['east', 0.2],
  ['flanks', 0.15],
  ['broad', 0.25],
];
const DOCTRINES: readonly (readonly [Doctrine, number])[] = [
  ['assault', 0.5],
  ['hunt', 0.25],
  ['raze', 0.25],
];
const MODIFIER_ORDER: readonly WaveModifier[] = ['night', 'jammed', 'fast', 'veterans'];
/** How often a group goes where the wave does. */
const AXIS_SHARE = 0.7;
/** How often a wave after the first, from level 3, carries a modifier. */
const MODIFIER_CHANCE = 0.3;
/** How far a group's start may move, as a share of where the script puts it. */
const TIMING = 0.25;

type Lane = 'west' | 'centre' | 'east';
type Axis = Lane | 'flanks' | 'broad';
const LANES: readonly Lane[] = ['west', 'centre', 'east'];

/**
 * Where a lane lies on the 20-cell entry line: its middle, and how far either
 * side of it a group spreads. Each lane maps onto its own third of the board's
 * edge, so the read says the lane the men really come down.
 */
const LANE_LINE: Readonly<Record<Lane, { mid: number; spread: number }>> = {
  west: { mid: 3, spread: 2 },
  centre: { mid: 10, spread: 3 },
  east: { mid: 16, spread: 2 },
};

/** The script's column moved into a lane, keeping its place in the spread. */
function laneCol(lane: Lane, col: number): number {
  const { mid, spread } = LANE_LINE[lane];
  // The script lays its columns about the middle of the line, 3 to 17.
  const offset = Math.round(((col - 10) * spread) / 7);
  return mid + Math.max(-spread, Math.min(spread, offset));
}

function draw<T>(rng: Rng, table: readonly (readonly [T, number])[]): T {
  let r = rng();
  for (const [value, weight] of table) {
    if (r < weight) return value;
    r -= weight;
  }
  return table[table.length - 1]![0];
}

/**
 * Which parts of a plan the composer draws. Every part, always, but for the
 * balance tool, which prices each alone (`--compose`): the draws are made
 * whatever is kept, so a plan with one part is that part of the full plan.
 */
export interface ComposeParts {
  lanes: boolean;
  doctrines: boolean;
  timing: boolean;
  modifiers: boolean;
}

const EVERY_PART: ComposeParts = { lanes: true, doctrines: true, timing: true, modifiers: true };

function composeWave(groups: Group[], index: number, level: number, rng: Rng, parts: ComposeParts): WaveDef {
  const drawn: Doctrine = index === 0 ? 'assault' : draw(rng, DOCTRINES);
  const doctrine = parts.doctrines ? drawn : 'assault';
  const axis = draw(rng, AXES);
  const chosen =
    index >= 1 && level >= 3 && rng() < MODIFIER_CHANCE
      ? MODIFIER_ORDER[Math.floor(rng() * MODIFIER_ORDER.length)]!
      : undefined;
  const modifier = parts.modifiers ? chosen : undefined;
  const entries: WaveEntry[] = [];
  for (const g of groups) {
    const drawnWay: Axis = rng() < AXIS_SHARE ? axis : LANES[Math.floor(rng() * LANES.length)]!;
    const way: Axis = parts.lanes ? drawnWay : 'broad';
    const shift = rollRange(rng, -TIMING, TIMING);
    const from = parts.timing ? Math.round(g.from * (1 + shift)) : g.from;
    for (let i = 0; i < g.n; i++) {
      const col = g.cols[i % g.cols.length]!;
      const lane: Lane | null = way === 'broad' ? null : way === 'flanks' ? (i % 2 === 0 ? 'west' : 'east') : way;
      entries.push({
        atTick: from + i * g.step,
        kind: g.kind,
        col: lane ? laneCol(lane, col) : col,
        ...(doctrine !== 'assault' ? { doctrine } : {}),
      });
    }
  }
  // In the order a replay code reads a wave back, so the sim spawns men who
  // arrive on the same tick in the same order in the battle and in its replay.
  entries.sort((a, b) => a.atTick - b.atTick || a.kind.localeCompare(b.kind));
  return modifier ? modifyWave({ entries }, modifier) : { entries };
}

/**
 * A wave with a modifier on it, priced: the modifier's share kept of each
 * kind the wave fields in numbers, those made veterans if that is the
 * modifier, and what the sim reads while it fights. The composer's, and the
 * balance tool's for pricing a modifier on the script's own waves, at its
 * price or a candidate's.
 */
export function modifyWave(wave: WaveDef, modifier: WaveModifier, def: ModifierDef = MODIFIERS[modifier]): WaveDef {
  const counts = new Map<string, number>();
  for (const e of wave.entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  let entries = thin(wave.entries, def.count, counts);
  if (def.vet !== undefined) {
    const vet = def.vet;
    entries = entries.map((e) => ((counts.get(e.kind) ?? 0) >= IN_NUMBERS ? { ...e, vet } : e));
  }
  return def.mods ? { entries, mods: { ...def.mods } } : { entries };
}

/**
 * How many of a kind a wave fields before a modifier's price touches it.
 *
 * The heavies and rotors a wave sends one or two at a time are what decide
 * it, and a share of two rounds to one or to two with nothing between: the
 * first pricing found veterans at 75% kept three points HARDER than the
 * script and at 70% kept thirteen points EASIER, because at 70% a wave's pair
 * of tanks rounds to one. So those come as the script sends them, plain, and
 * the price is paid by the kinds that come in numbers, where a share is a
 * share.
 */
const IN_NUMBERS = 3;

/**
 * Keep `share` of each kind the wave fields in numbers, spread evenly through
 * the wave's time so a thinned wave is as long as the one it was. A kind it
 * sends one or two of is left whole: see `IN_NUMBERS`.
 */
function thin(entries: WaveEntry[], share: number, counts: ReadonlyMap<string, number>): WaveEntry[] {
  if (share >= 1) return entries;
  const byKind = new Map<string, WaveEntry[]>();
  for (const e of entries) {
    if ((counts.get(e.kind) ?? 0) < IN_NUMBERS) continue;
    const list = byKind.get(e.kind);
    if (list) list.push(e);
    else byKind.set(e.kind, [e]);
  }
  const drop = new Set<WaveEntry>();
  for (const list of byKind.values()) {
    const inTime = [...list].sort((a, b) => a.atTick - b.atTick);
    const m = Math.max(1, Math.round(inTime.length * share));
    const keep = new Set<WaveEntry>();
    for (let i = 0; i < m; i++) keep.add(inTime[Math.floor((i * inTime.length) / m)]!);
    for (const e of inTime) if (!keep.has(e)) drop.add(e);
  }
  return entries.filter((e) => !drop.has(e));
}

/**
 * The assault at `level`: the ladder's script, or with a `seed` (M35 Phase 1)
 * the enemy's own plan of it — the same units in the same waves, with the
 * lane, the purpose, the timing and the modifier its own.
 *
 * Without a seed this is the script exactly as it was, which the campaign's
 * tests, the balance tool's `--classic` baseline and every replay code from
 * before M35 read.
 */
export function buildAssault(
  level: number,
  roster: AssaultRoster = CHINA_ASSAULT_ROSTER,
  ladder: Ladder = LADDER,
  seed?: number,
  parts: ComposeParts = EVERY_PART,
): SiegeDef {
  const script = scriptOf(level, roster, ladder);
  let waves: WaveDef[];
  if (seed === undefined) waves = script.map(scripted);
  else {
    const rng = createRng(seed ^ COMPOSE_SALT);
    waves = script.map((groups, index) => composeWave(groups, index, level, rng, parts));
  }

  const tierName =
    level >= 5 ? 'ARMORED OFFENSIVE' : level >= 3 ? 'COMBINED ASSAULT' : 'PROBING ATTACK';

  return {
    name: `LEVEL ${level} — ${tierName}`,
    startingSupplies: 0, // substituted with the town stockpile at launch
    suppliesPerWave: 100 + 25 * level,
    startingCp: Math.min(40 + 5 * (level - 1), 80),
    cpCap: 150,
    cpPerSecond: 1.2,
    prepSeconds: 25,
    repairCostPerHp: 0.04,
    waves,
  };
}

/** Bonus loot for holding the sector, on top of per-wave supply awards. */
export function assaultLoot(level: number): { supplies: number; fuel: number } {
  return { supplies: 250 + 150 * level, fuel: 60 + 40 * level };
}

/**
 * Offline probe raids: the first two waves of a soft-scaled assault, with no
 * defender economy — permanent defenses fight it alone (GDD §2.3). With a
 * seed, the first two waves of the enemy's plan (M35 Phase 1).
 */
export function probeAssault(
  level: number,
  roster: AssaultRoster = CHINA_ASSAULT_ROSTER,
  seed?: number,
): SiegeDef {
  const base = buildAssault(Math.max(1, level), roster, LADDER, seed);
  return {
    ...base,
    name: `PROBE — LEVEL ${level}`,
    waves: base.waves.slice(0, 2),
    startingCp: 0,
    cpPerSecond: 0,
    suppliesPerWave: 0,
  };
}
