/**
 * THE YARD (M24 Phase 3): what where things stand is worth.
 *
 * Power and adjacency make a layout an economic decision as well as a maze
 * one, and on a 10x15 board the two want the same cells. This measures both
 * halves of that. Each stage's reference defence stands, as the balance
 * harness draws it, and the stage's whole economy allowance is laid out
 * behind it three ways — nearest the post, at random, and by a search for the
 * best yard — and scored off the real `productionPerHour`. Then the best yard is
 * fought through the defence's band, for what its buildings do to the maze
 * and what it loses to wrecks on a hold; and the played fortnight is run with
 * a commander who places for the yard beside one who does not.
 *
 * On flat ground, as the harness fights: a river is a different board, and
 * the question is what the rules are worth, not what one seed's ground is.
 */
import { BUILDABLE_KINDS, CC_GATING } from '../content/buildings';
import { townMetaFor, type FactionId } from '../content/factions';
import {
  baseRatesPerHour,
  productionPerHour,
  trainingDiscount,
  TOWN_GRID,
  type TownState,
} from '../meta/town';
import { createRng, type Rng } from '../sim/rng';
import { fightSiege, playFortnight, referenceTown, yardValue, type Fought } from './economy';
import { referenceBases, type ReferenceBase } from './referenceBases';

const GUNS = new Set(['m2nest', 'autocannon', 'mortar', 'aa']);
const pad = (s: string, n: number): string => (s.length >= n ? s : ' '.repeat(n - s.length) + s);
const pct = (x: number): string => `${Math.round(x * 100)}%`;

interface Piece {
  kind: string;
  level: number;
}

/** A stage's whole economy allowance, at the stage's top level: everything but the guns. */
function allowance(faction: FactionId, cc: number): Piece[] {
  const gate = CC_GATING[cc - 1]!;
  const out: Piece[] = [];
  for (const kind of BUILDABLE_KINDS) {
    if (GUNS.has(kind)) continue;
    const level = Math.min(gate.maxStructureLevel, townMetaFor(faction)[kind]!.levels.length);
    for (let i = 0; i < (gate.counts[kind] ?? 0); i++) out.push({ kind, level });
  }
  return out;
}

/**
 * One reference defence with a stage's economy stood on it, the pieces last in
 * `structures` so a layout can be moved by rewriting their cells.
 */
class Yard {
  readonly town: TownState;
  readonly first: number;
  readonly free: number[];
  private readonly base: { supplies: number; fuel: number; intel: number };

  constructor(
    readonly ref: ReferenceBase,
    faction: FactionId,
    readonly pieces: Piece[],
  ) {
    this.town = referenceTown(ref, faction);
    this.first = this.town.structures.length;
    let id = this.town.nextId;
    for (const p of pieces) this.town.structures.push({ id: id++, kind: p.kind, cell: -1, level: p.level, wrecked: false });
    this.town.nextId = id;
    const { width, height, ccOrigin } = TOWN_GRID;
    const taken = new Set<number>([ccOrigin, ...ref.walls.map((w) => w.cell), ...ref.structures.map((s) => s.cell)]);
    this.free = [];
    // Row 0 is the lane the attack comes in on: nothing builds there.
    for (let c = width; c < width * height; c++) if (!taken.has(c)) this.free.push(c);
    this.base = baseRatesPerHour(this.town);
  }

  get cells(): number[] {
    return this.town.structures.slice(this.first).map((s) => s.cell);
  }

  set cells(cells: number[]) {
    cells.forEach((cell, i) => (this.town.structures[this.first + i]!.cell = cell));
  }

  /**
   * Each resource the stage's producers make, as a share of what they make
   * before the yard. What the converters make of it is not the yard's doing.
   */
  shares(): { supplies: number; fuel: number; intel: number | null } {
    const rate = productionPerHour(this.town);
    return {
      supplies: rate.supplies / this.base.supplies,
      fuel: rate.fuel / this.base.fuel,
      intel: this.base.intel > 0 ? rate.intel / this.base.intel : null,
    };
  }

  /**
   * What the search climbs: the town's output in depot-equivalents (see
   * `yardValue`) over what it makes before the yard, so every building counts
   * for its own output and a lone radar cannot outweigh four depots. Facilities
   * beside their depot add the sliver `yardValue` gives them, which only ever
   * breaks a tie.
   */
  score(): number {
    return yardValue(this.town) / this.baseValue;
  }

  private get baseValue(): number {
    const meta = townMetaFor(this.town.faction);
    // A converter counts as one at full power in `yardValue`, so its base is one.
    const works = this.pieces.filter((p) => meta[p.kind]?.converts).length;
    return (
      this.base.supplies / meta['supplyDepot']!.generatesSupplies![0]! +
      this.base.fuel / meta['fuelDepot']!.generatesFuel![0]! +
      this.base.intel / meta['radar']!.generatesIntel![0]! +
      works
    );
  }

  /**
   * The cells behind the defence: below its deepest line of wire, where the
   * attack arrives only after the whole maze. What a commander who does not
   * want a repair bill for every siege keeps the economy to.
   */
  behindTheLines(): number[] {
    const { width } = TOWN_GRID;
    const deepest = Math.max(...this.ref.walls.map((w) => Math.floor(w.cell / width)));
    return this.free.filter((c) => Math.floor(c / width) > deepest);
  }

  /**
   * Can the attack still walk to the post without breaking anything? The
   * harness's reference bases all leave it a way, and a yard that closed it
   * would be fighting a different battle, not keeping the same one richer.
   */
  openWay(): boolean {
    const { width, height, ccOrigin } = TOWN_GRID;
    const blocked = new Set<number>(this.ref.walls.map((w) => w.cell));
    for (const s of this.town.structures) blocked.add(s.cell);
    const goal = new Set([ccOrigin - width, ccOrigin + width, ccOrigin - 1, ccOrigin + 1]);
    const seen = new Set<number>();
    const queue: number[] = [];
    for (let c = 0; c < width; c++) {
      seen.add(c);
      queue.push(c);
    }
    while (queue.length > 0) {
      const c = queue.shift()!;
      if (goal.has(c)) return true;
      const x = c % width;
      const y = Math.floor(c / width);
      for (const n of [y > 0 ? c - width : -1, y < height - 1 ? c + width : -1, x > 0 ? c - 1 : -1, x < width - 1 ? c + 1 : -1]) {
        if (n < 0 || seen.has(n) || blocked.has(n)) continue;
        seen.add(n);
        queue.push(n);
      }
    }
    return false;
  }

  /** Facilities with their partner depot beside them. */
  partnered(): number {
    return this.town.structures.slice(this.first).filter((s) => trainingDiscount(this.town, s) > 0).length;
  }

  /** The yard as a map: the defence in lower case, the economy in capitals. */
  map(): string[] {
    const { width, height, ccOrigin } = TOWN_GRID;
    const glyph: Record<string, string> = {
      supplyDepot: 'S',
      fuelDepot: 'F',
      storageBunker: 'B',
      generator: 'G',
      refinery: 'P',
      bureau: 'I',
      engBay: 'E',
      radar: 'R',
      barracks: 'K',
      motorpool: 'M',
      airfield: 'A',
    };
    const at = new Map<number, string>();
    for (const w of this.ref.walls) at.set(w.cell, '#');
    for (const s of this.ref.structures) at.set(s.cell, 'g');
    for (const s of this.town.structures.slice(this.first)) at.set(s.cell, glyph[s.kind] ?? '?');
    at.set(ccOrigin, 'C');
    const rows: string[] = [];
    for (let y = 0; y < height; y++) {
      let row = '';
      for (let x = 0; x < width; x++) row += at.get(y * width + x) ?? (y === 0 ? '~' : '.');
      rows.push(row);
    }
    return rows;
  }
}

/** Every piece on the free cell nearest the post that keeps the way open, in allowance order. */
function naive(yard: Yard): void {
  const { width, ccOrigin } = TOWN_GRID;
  const cx = ccOrigin % width;
  const cy = Math.floor(ccOrigin / width);
  const byDistance = [...yard.free].sort((a, b) => {
    const d = (c: number) => ((c % width) - cx) ** 2 + (Math.floor(c / width) - cy) ** 2;
    return d(a) - d(b) || a - b;
  });
  const cells = yard.cells.map(() => -1);
  const used = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    for (const cell of byDistance) {
      if (used.has(cell)) continue;
      cells[i] = cell;
      yard.cells = cells;
      if (yard.openWay()) {
        used.add(cell);
        break;
      }
      cells[i] = -1;
    }
  }
  yard.cells = cells;
}

/**
 * Every piece on a random cell of `region`, redrawn while it would close the
 * way. False when the region ran out of room for a piece.
 */
function scatter(yard: Yard, rng: Rng, region: number[] = yard.free): boolean {
  const cells = yard.cells.map(() => -1);
  const used = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    for (let tries = 0; tries < 400; tries++) {
      const cell = region[Math.floor(rng() * region.length)]!;
      if (used.has(cell)) continue;
      cells[i] = cell;
      yard.cells = cells;
      if (yard.openWay()) {
        used.add(cell);
        break;
      }
      cells[i] = -1;
    }
  }
  yard.cells = cells;
  return cells.every((c) => c >= 0);
}

/**
 * A search for the best yard: annealed moves and swaps from a random start,
 * restarted, keeping the best it saw. Swaps cannot close the way, since they
 * leave the same cells taken; a move is refused if it would.
 */
function search(yard: Yard, rng: Rng, region: number[] = yard.free, restarts = 4, steps = 5000): number[] | null {
  let best: number[] | null = null;
  let bestScore = -Infinity;
  for (let r = 0; r < restarts; r++) {
    if (!scatter(yard, rng, region)) continue;
    let cells = yard.cells;
    let score = yard.score();
    for (let step = 0; step < steps; step++) {
      const temperature = 0.04 * (1 - step / steps) + 1e-4;
      const trial = [...cells];
      const i = Math.floor(rng() * trial.length);
      if (rng() < 0.6) {
        const cell = region[Math.floor(rng() * region.length)]!;
        if (trial.includes(cell)) continue;
        trial[i] = cell;
        yard.cells = trial;
        if (!yard.openWay()) {
          yard.cells = cells;
          continue;
        }
      } else {
        const j = Math.floor(rng() * trial.length);
        if (yard.pieces[i]!.kind === yard.pieces[j]!.kind) continue;
        [trial[i], trial[j]] = [trial[j]!, trial[i]!];
        yard.cells = trial;
      }
      const next = yard.score();
      if (next >= score || rng() < Math.exp((next - score) / temperature)) {
        cells = trial;
        score = next;
        if (score > bestScore + 1e-9) {
          bestScore = score;
          best = [...cells];
        }
      } else {
        yard.cells = cells;
      }
    }
  }
  if (best) yard.cells = best;
  return best;
}

const shareText = (s: { supplies: number; fuel: number; intel: number | null }): string =>
  `${pad(pct(s.supplies), 4)} ${pad(pct(s.fuel), 4)} ${pad(s.intel === null ? '—' : pct(s.intel), 4)}`;

export function yardTable(faction: FactionId = 'usa'): string {
  const lines = [
    `THE YARD — ${faction.toUpperCase()}: each stage's economy laid out on its reference defence, flat ground; ` +
      'output as a share of the rate before the yard (S F I)',
    'STAGE | CELLS: FREE, BEHIND THE LINES | PIECES | NEAREST THE POST | RANDOM ANYWHERE, MEDIAN (10TH-90TH) | ' +
      'BEST BEHIND THE LINES | BEST ANYWHERE',
  ];
  const maps: string[][] = [];
  const found: { yard: Yard; nearest: number[]; behind: number[] | null; anywhere: number[] | null }[] = [];
  for (const ref of referenceBases()) {
    const cc = ref.ccLevel;
    const yard = new Yard(ref, faction, allowance(faction, cc));
    const rng = createRng((0x9a5d + cc * 7919) >>> 0);
    naive(yard);
    const nearestCells = yard.cells;
    const nearest = yard.shares();
    const randoms: number[] = [];
    for (let i = 0; i < 200; i++) {
      scatter(yard, rng);
      randoms.push(yard.score());
    }
    randoms.sort((a, b) => a - b);
    const q = (p: number): number => randoms[Math.min(randoms.length - 1, Math.floor(p * randoms.length))]!;
    const region = yard.behindTheLines();
    const behind = search(yard, rng, region);
    const behindShares = behind ? yard.shares() : null;
    const partneredBehind = behind ? yard.partnered() : 0;
    if (behind) maps.push([`${ref.name}, best behind the lines:`, ...yard.map()]);
    const anywhere = search(yard, rng);
    const anywhereShares = anywhere ? yard.shares() : null;
    const facilities = yard.pieces.filter((p) => ['barracks', 'motorpool', 'airfield'].includes(p.kind)).length;
    lines.push(
      `CC${cc}   | ${pad(`${yard.free.length}, ${region.length}`, 29)} | ${pad(String(yard.pieces.length), 6)} | ` +
        `${pad(shareText(nearest), 16)} | ${pad(`${pct(q(0.5))} (${pct(q(0.1))}-${pct(q(0.9))})`, 36)} | ` +
        `${pad(behindShares ? `${shareText(behindShares)}, ${partneredBehind}/${facilities} F` : 'no room', 21)} | ` +
        `${anywhereShares ? shareText(anywhereShares) : '—'}`,
    );
    found.push({ yard, nearest: nearestCells, behind, anywhere });
  }
  lines.push('(RANDOM and the bests are the mean in depot-equivalents; n/m F: facilities beside their depot)');
  lines.push('');
  lines.push('THE BEST YARDS BEHIND THE LINES — # wire, g guns, C the post; S supply, F fuel, B bunker,');
  lines.push('G generator, P refinery, I intel bureau, R signals, E engineering, K barracks, M motor pool, A airfield');
  const width = TOWN_GRID.width + 4;
  const rows = Math.max(...maps.map((m) => m.length));
  for (let r = 0; r < rows; r++) {
    lines.push(maps.map((m) => (r === 0 ? m[r]! : `  ${m[r] ?? ''}`).padEnd(r === 0 ? 0 : width)).join(r === 0 ? '   ' : ''));
  }

  // The maze: what each best yard does to what the defence holds, and what
  // its own buildings cost to repair on a hold.
  lines.push('');
  lines.push(
    'THE YARD IN THE MAZE — held %: the defence alone → with its economy nearest the post → its best yard ' +
      "behind the lines → its best yard anywhere, nobody acting, 12 seeds; (the yard's own wrecks on a hold, S)",
  );
  for (const { yard, nearest, behind, anywhere } of found) {
    const bare = referenceTown(yard.ref, faction);
    const row: string[] = [];
    for (const level of bandOf(bare)) {
      const alone = fightMany(bare, level);
      const cells = (layout: number[] | null): string => {
        if (!layout) return '—';
        yard.cells = layout;
        const fought = fightMany(yard.town, level);
        const wrecks = fought.held.length
          ? Math.round(fought.held.reduce((n, f) => n + yardWreckBill(f), 0) / fought.held.length)
          : null;
        return `${pct(fought.held.length / fought.n)}${wrecks === null ? '' : ` (${wrecks})`}`;
      };
      row.push(
        `L${level} ${pct(alone.held.length / alone.n)} → ${cells(nearest)} → ${cells(behind)} → ${cells(anywhere)}`,
      );
    }
    lines.push(`${yard.ref.name}:`);
    for (const r of row) lines.push(`  ${r}`);
  }

  // The fortnight, placed for the yard and not.
  lines.push('');
  lines.push('A PLAYED FORTNIGHT BY PLACEMENT — nearest the post, against the cell that makes the most');
  lines.push('EVERY | NEAREST: ALL BOUGHT, SUPPLIES MADE | FOR THE YARD: ALL BOUGHT, SUPPLIES MADE');
  const when = (d: number | null): string =>
    d === null ? 'never' : d < 1 ? `${(d * 24).toFixed(0)} h` : `${d.toFixed(1)} d`;
  for (const hours of [2, 8, 24]) {
    const a = playFortnight(faction, hours, 14, 10, 'naive');
    const b = playFortnight(faction, hours, 14, 10, 'yard');
    const k = (n: number) => `${Math.round(n / 1000)}k`;
    lines.push(
      `${pad(`${hours} h`, 5)} | ${pad(`${when(a.milestones['CC3 built out']!)}, ${k(a.ledger.made.supplies)}`, 32)} | ` +
        `${when(b.milestones['CC3 built out']!)}, ${k(b.ledger.made.supplies)}`,
    );
  }
  return lines.join('\n');
}

/** Levels from the last one a defence holds every time to the first it never holds, a few seeds each. */
function bandOf(town: TownState): number[] {
  const out: number[] = [];
  let lastAll = 1;
  for (let level = 1; level <= 30; level++) {
    const { held, n } = fightMany(town, level, 6);
    if (held.length === n) {
      lastAll = level;
      continue;
    }
    if (out.length === 0) out.push(lastAll);
    out.push(level);
    if (held.length === 0) break;
  }
  // Every other level across the band, so the table stays a line long.
  return out.filter((_, i) => i === 0 || i === out.length - 1 || i % 2 === 0);
}

function fightMany(town: TownState, level: number, seeds = 12): { held: Fought[]; n: number } {
  const held: Fought[] = [];
  for (let i = 0; i < seeds; i++) {
    const f = fightSiege(town, level, (level * 7919 + i * 104_729 + 17) >>> 0);
    if (f.held) held.push(f);
  }
  return { held, n: seeds };
}

/** The part of a hold's wreck bill that was the yard's buildings rather than its guns. */
function yardWreckBill(fought: Fought): number {
  return fought.yardWrecks.supplies;
}
