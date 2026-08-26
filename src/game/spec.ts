/**
 * The spec card (v1.27) — what a thing in the drawer actually does.
 *
 * ## The gap this closes
 *
 * Until now the build list said `MG NEST · 150S 0/4` and nothing else, and
 * that is the entire information a player had when choosing between four
 * emplacements. Range, rate of fire, what a weapon is good against and what
 * it bounces off were in the content files and nowhere on screen — not in a
 * tooltip, not in a codex, not in the briefing. A tower-defence game whose
 * towers are indistinguishable before you buy one is asking the player to
 * learn the roster by wasting supplies on it.
 *
 * So the card is not a nicety. It is the missing half of a build decision.
 *
 * ## Why a long press
 *
 * A phone has one button. Every other way of offering this costs screen: an
 * info chevron on each row eats the width the cost column needs, a separate
 * codex tab is a place nobody visits, and a tap that opens details instead of
 * selecting the tool would break the fast path for the player who already
 * knows the roster. A hold costs nothing and interrupts nobody.
 *
 * ## Deriving rather than writing
 *
 * Nothing here is authored prose about a structure. Every number is read out
 * of the same catalog the engine fights with, so a balance pass that moves a
 * range moves this card too, and a card can never describe a gun that no
 * longer exists. The soft-counter lines are computed from `DAMAGE_MULT` for
 * the same reason: the table IS the counter system, and a hand-written
 * "strong against infantry" would be a second source of truth that drifts.
 */
import type Phaser from 'phaser';
import type { TownBuildingMeta } from '../content/buildings';
import type { TrainMeta } from '../content/usaUnits';
import type {
  ArmorClass,
  AttackerProfile,
  Catalog,
  StructureProfile,
  WallDef,
  Weapon,
} from '../sim/types';
import type { Layout } from './layout';
import { COLORS } from './palette';
import { Overlay } from './overlay';
import { ATTACKER_GLYPH_SPAN, drawAttackerGlyph, drawStructureGlyph } from './glyphs';

/**
 * What a player calls each armour class. The sim's names are about the model
 * ('none' is the absence of armour); these are about the thing on the board.
 */
const ARMOR_NAMES: Record<ArmorClass, string> = {
  none: 'INFANTRY',
  light: 'LIGHT VEHICLES',
  heavy: 'ARMOUR',
  structure: 'STRUCTURES',
  air: 'AIRCRAFT',
};

/** The classes a DEFENCE ever shoots at: attackers, never buildings. */
const TARGET_CLASSES: ArmorClass[] = ['none', 'light', 'heavy', 'air'];

const DAMAGE_NAMES: Record<Weapon['damageType'], string> = {
  smallArms: 'SMALL ARMS',
  kinetic: 'KINETIC',
  explosive: 'EXPLOSIVE',
  shaped: 'SHAPED CHARGE',
  flak: 'FLAK',
};

/** Trim a float for display: 4 not 4.0, 1.5 not 1.50. */
function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/**
 * Which armour classes this weapon can reach.
 *
 * A weapon's damage row has a number for every class, but the ones it may
 * never fire at are noise: printing "×1.4 vs AIRCRAFT" for an AA mount is the
 * point, and printing "×0.3 vs AIRCRAFT" for a rifle pit that cannot elevate
 * is a lie about a shot it will never take.
 */
function reachable(weapon: Weapon): ArmorClass[] {
  const layer = weapon.targets ?? 'ground';
  if (layer === 'air') return ['air'];
  if (layer === 'both') return TARGET_CLASSES;
  return TARGET_CLASSES.filter((c) => c !== 'air');
}

/** The weapon's own lines: what it fires, how fast, how far. */
function weaponLines(weapon: Weapon, damage: Catalog['damage']): string[] {
  const dps = weapon.damage * weapon.shotsPerSecond;
  const lines = [
    `${DAMAGE_NAMES[weapon.damageType]} · ${num(weapon.damage)} × ${num(weapon.shotsPerSecond)}/s = ${num(Math.round(dps * 10) / 10)} DPS`,
    `RANGE ${num(weapon.range)} CELLS${weapon.minRange ? ` · DEAD ZONE ${num(weapon.minRange)}` : ''}`,
  ];
  const layer = weapon.targets ?? 'ground';
  const reach =
    layer === 'both' ? 'GROUND AND AIR' : layer === 'air' ? 'AIR ONLY' : 'GROUND ONLY';
  const flight = weapon.flightSeconds
    ? ` · LOBBED, ${num(weapon.flightSeconds)}s FLIGHT`
    : '';
  lines.push(
    `${reach}${weapon.splashRadius ? ` · SPLASH ${num(weapon.splashRadius)}` : ''}${flight}`,
  );

  // The soft counters, as effective DPS rather than as a raw multiplier. A
  // multiplier is a number about the table; effective DPS is a number about
  // the fight, and it is the one that makes two guns comparable at a glance.
  const row = damage[weapon.damageType];
  const rank = reachable(weapon)
    .map((armor) => ({ armor, dps: dps * row[armor] }))
    .sort((a, b) => b.dps - a.dps);
  for (const entry of rank) {
    lines.push(`  vs ${ARMOR_NAMES[entry.armor].padEnd(15)}${num(Math.round(entry.dps))} DPS`);
  }
  return lines;
}

export interface SpecOpts {
  layout: Layout;
  catalog: Catalog;
  /**
   * The town's entry for this kind, when it has one.
   *
   * A structure's price is in TWO places and neither is a superset of the
   * other: a field defence carries `supplyCost`/`cpCost` on its sim profile,
   * while everything the yard builds is priced per level in the town meta and
   * has no cost on the profile at all. Reading only the profile made the card
   * announce "NOT BUILDABLE" over a supply depot the player was standing in
   * front of a button to buy. The meta also carries the only answer to what an
   * economy building is FOR — what it produces per minute — which was on no
   * screen in the game.
   */
  meta?: TownBuildingMeta;
  container?: Phaser.GameObjects.Container;
  onClose: () => void;
}

/** `150S+50F · 45s`, the same shorthand the build rows use. */
function priceOf(level: { supplies: number; fuel: number; seconds: number }): string {
  const money = level.fuel > 0 ? `${level.supplies}S+${level.fuel}F` : `${level.supplies}S`;
  return level.seconds > 0 ? `${money} · ${level.seconds}s` : money;
}

/** What this building makes per minute at `level`, if it makes anything. */
function outputAt(meta: TownBuildingMeta | undefined, level: number): string {
  if (!meta) return '';
  const at = (list: number[] | undefined): number | undefined =>
    list ? list[Math.min(level, list.length) - 1] : undefined;
  const parts: string[] = [];
  const supplies = at(meta.generatesSupplies);
  const fuel = at(meta.generatesFuel);
  const intel = at(meta.generatesIntel);
  if (supplies) parts.push(`${supplies} SUP/MIN`);
  if (fuel) parts.push(`${fuel} FUEL/MIN`);
  if (intel) parts.push(`${intel} INT/MIN`);
  const store = meta.storage ? meta.storage[Math.min(level, meta.storage.length) - 1] : undefined;
  if (store && (store.supplies > 0 || store.fuel > 0)) {
    parts.push(`+${store.supplies}/${store.fuel} CAP`);
  }
  const intelCap = at(meta.intelCap);
  if (intelCap) parts.push(`+${intelCap} INT CAP`);
  const speed = at(meta.buildSpeed);
  if (speed) parts.push(`${Math.round(speed * 100)}% FASTER BUILDS`);
  return parts.join(' · ');
}

/**
 * The card for one defensive structure.
 *
 * `level` is the level the player would be building at — always 1 from the
 * build list, but the same card serves a selected structure later, and a card
 * that described level 1 while the player owned a level 3 would be worse than
 * no card.
 */
export function buildStructureSpec(
  scene: Phaser.Scene,
  kind: string,
  opts: SpecOpts,
): Overlay | null {
  const profile: StructureProfile | undefined = opts.catalog.structures[kind];
  if (!profile) return null;
  const { layout } = opts;
  const ov = new Overlay(scene, layout, {
    title: profile.name.toUpperCase(),
    // Opaque, unlike most cards here. The default scrim leaves the drawer
    // readable underneath, and this is the densest card in the game: at 0.86
    // the row boxes behind it drew rectangles straight through the stat
    // block and the silhouette landed on a building. A card somebody READS
    // has nothing behind it worth seeing.
    scrim: 1,
    ...(opts.container ? { container: opts.container } : {}),
  });
  const { font, gap } = layout;

  // The same silhouette the thing will have on the board, at a size that
  // reads: this card is how a player learns to recognise the shape they are
  // about to place, so it has to be THE shape.
  const span = profile.footprint === 2 ? 2 : 1;
  const box = layout.px(72);
  ov.sketch(box, (g, x, y, size) => {
    drawStructureGlyph(g, kind, x + size / 2, y + size / 2, size / (span * 0.9), {
      onDark: true,
    });
  });

  const build = opts.meta?.levels[0];
  const cost = build
    ? priceOf(build)
    : profile.supplyCost !== undefined
      ? `${profile.supplyCost} SUPPLIES`
      : profile.cpCost !== undefined
        ? `${profile.cpCost} CP — DEPLOYED IN COMBAT`
        : 'PLACED BY THE GENERATOR — NOT BUILDABLE';
  const output = outputAt(opts.meta, 1);
  ov.paragraph(
    [
      cost,
      `${profile.maxHp} HP · ${profile.footprint}×${profile.footprint} CELL${profile.footprint === 2 ? 'S' : ''}`,
      output,
      profile.blocks ? 'BLOCKS MOVEMENT' : 'DOES NOT BLOCK',
      profile.targetable ? '' : 'CONCEALED — CANNOT BE SHOT AT',
    ]
      .filter((line) => line.length > 0)
      .join('\n'),
    font.body,
    COLORS.ink,
    { gapAfter: gap * 2 },
  );

  if (profile.weapon) {
    ov.paragraph(weaponLines(profile.weapon, opts.catalog.damage).join('\n'), font.tiny, COLORS.inkDim, {
      gapAfter: gap * 2,
    });
  }
  if (profile.trigger) {
    const t = profile.trigger;
    ov.paragraph(
      `MINE · ${DAMAGE_NAMES[t.damageType]} ${t.damage} DAMAGE\nTRIGGERS AT ${num(t.radius)} CELLS · SPLASH ${num(t.splashRadius)}\nONE USE`,
      font.tiny,
      COLORS.inkDim,
      { gapAfter: gap * 2 },
    );
  }
  if (profile.aura) {
    ov.paragraph(
      `REPAIRS ${num(profile.aura.healPerSecond)} HP/s TO FRIENDLY\nSTRUCTURES AND WALLS WITHIN ${num(profile.aura.radius)} CELLS`,
      font.tiny,
      COLORS.inkDim,
      { gapAfter: gap * 2 },
    );
  }
  if (!profile.weapon && !profile.trigger && !profile.aura) {
    ov.paragraph('UNARMED. IT IS A TARGET, AND WHAT IT COSTS THE\nATTACKER IS THE TIME SPENT KILLING IT.', font.tiny, COLORS.inkDim, {
      gapAfter: gap * 2,
    });
  }

  // What upgrading buys, which is otherwise only discoverable by paying for
  // it twice.
  //
  // The two ladders are indexed differently and lining them up wrong is a
  // silent off-by-one: `profile.levels[i]` is the stat block that applies at
  // level i+2, while `meta.levels[i]` is the cost of REACHING level i+1. So
  // level L reads `profile.levels[L-2]` and `meta.levels[L-1]`.
  const stats = profile.levels ?? [];
  const top = Math.max(stats.length + 1, opts.meta?.levels.length ?? 1);
  if (top > 1) {
    ov.paragraph('UPGRADES', font.tiny, COLORS.ink, { gapAfter: Math.round(gap / 2) });
    for (let level = 2; level <= top; level++) {
      const stat = stats[Math.min(level - 2, stats.length - 1)];
      const hp = stat?.maxHp ?? profile.maxHp;
      const w = stat?.weapon ?? profile.weapon;
      const dps = w ? `${num(Math.round(w.damage * w.shotsPerSecond * 10) / 10)} DPS` : '';
      const price = opts.meta?.levels[level - 1];
      const made = outputAt(opts.meta, level);
      const line = [`L${level}`, `${hp} HP`, dps, price ? priceOf(price) : '', made]
        .filter((part) => part.length > 0)
        .join(' · ');
      ov.paragraph(line, font.tiny, COLORS.inkDim, { gapAfter: Math.round(gap / 2) });
    }
  }

  ov.footer('CLOSE', opts.onClose);
  return ov;
}

/** The card for a wall or a gate: no weapon, but the HP is the whole point. */
export function buildWallSpec(scene: Phaser.Scene, kind: string, opts: SpecOpts): Overlay | null {
  const def: WallDef | undefined = opts.catalog.walls[kind];
  if (!def) return null;
  const { layout } = opts;
  const ov = new Overlay(scene, layout, {
    title: def.name.toUpperCase(),
    scrim: 1,
    ...(opts.container ? { container: opts.container } : {}),
  });
  const { font, gap } = layout;
  const cost =
    def.supplyCost !== undefined
      ? `${def.supplyCost} SUPPLIES PER SEGMENT`
      : def.cpCost !== undefined
        ? `${def.cpCost} CP — DEPLOYED IN COMBAT`
        : 'NOT BUILDABLE';
  ov.paragraph([cost, `${def.hp} HP`].join('\n'), font.body, COLORS.ink, { gapAfter: gap * 2 });
  ov.paragraph(
    def.gateCpCost !== undefined
      ? `A DOOR. ${def.gateCpCost} CP TO SWING IT, EITHER WAY.\n\nOPEN, IT IS A HOLE, AND EVERY ATTACKER RE-PATHS\nTOWARD THE CHEAPEST WAY IN. THAT IS THE USE:\nYOU OPEN A GATE TO PULL AN ASSAULT INTO A\nKILLZONE, AND CLOSE IT TO STRAND WHOEVER CAME\nTHROUGH. IT CARRIES LESS HP THAN A WALL OF THE\nSAME TIER, WHICH IS WHAT IT COSTS YOU THE REST\nOF THE TIME.`
      : 'ATTACKERS BREAK IT OR ROUTE AROUND IT. EITHER\nWAY THEY SPEND TIME UNDER YOUR GUNS, WHICH IS\nTHE ONLY THING A WALL SELLS.',
    font.tiny,
    COLORS.inkDim,
    { gapAfter: gap * 2 },
  );
  ov.footer('CLOSE', opts.onClose);
  return ov;
}

/**
 * The card for one attacker — a unit in the muster.
 *
 * A different set of questions from a structure's, and the difference is the
 * point. Nobody asks how far a rifleman shoots; they ask what he can get
 * through, how long he takes to get there, and what losing him costs. So this
 * leads with the two demolition rates and the walk, and prints the ranged
 * weapon only when the unit has one.
 *
 * `cpValue` is on the card because it is the one number that reads backwards:
 * every unit you send is Command Points you are handing the defender when it
 * dies, and a raid built from cheap bodies pays for the guns that kill them.
 * It was in the content files and nowhere on screen.
 */
export function buildAttackerSpec(
  scene: Phaser.Scene,
  kind: string,
  opts: SpecOpts & { train?: TrainMeta },
): Overlay | null {
  const profile: AttackerProfile | undefined = opts.catalog.attackers[kind];
  if (!profile) return null;
  const { layout } = opts;
  const ov = new Overlay(scene, layout, {
    title: profile.name.toUpperCase(),
    scrim: 1,
    ...(opts.container ? { container: opts.container } : {}),
  });
  const { font, gap } = layout;

  const box = layout.px(72);
  ov.sketch(box, (g, x, y, size) => {
    drawAttackerGlyph(g, kind, x + size / 2, y + size / 2, size / ATTACKER_GLYPH_SPAN, {
      friendly: true,
      onDark: true,
    });
  });

  const train = opts.train;
  const cost = train
    ? priceOf({ supplies: train.supplies, fuel: train.fuel, seconds: train.seconds })
    : 'NOT TRAINABLE';
  ov.paragraph(
    [
      train ? `${cost} · ${train.manpower} MANPOWER` : cost,
      `${profile.maxHp} HP · ${ARMOR_NAMES[profile.armor]} ARMOUR`,
      profile.air ? `FLIES · ${num(profile.speed)} CELLS/s` : `${num(profile.speed)} CELLS/s`,
      // What the defender is paid for killing it. Worth stating plainly:
      // the CP that runs their barrages comes out of your losses.
      `WORTH ${profile.cpValue} CP TO THE DEFENDER`,
    ].join('\n'),
    font.body,
    COLORS.ink,
    { gapAfter: gap * 2 },
  );

  // What it can get through, which is the whole question for an attacker. A
  // zero is stated rather than dropped: "cannot breach" is the fact that
  // decides whether this unit can lead an assault at all.
  ov.paragraph(
    [
      profile.wallDps > 0 ? `${num(profile.wallDps)} DPS vs WALLS` : 'CANNOT BREACH WALLS',
      `${num(profile.hqDps)} DPS vs THE COMMAND CENTER`,
    ].join('\n'),
    font.tiny,
    COLORS.inkDim,
    { gapAfter: gap * 2 },
  );

  if (profile.weapon) {
    // An attacker's gun is used on STRUCTURES, never on other attackers, so
    // the soft-counter ladder a defence card prints would be four rows of
    // numbers this unit can never apply. One row, the one it uses.
    const w = profile.weapon;
    const dps = w.damage * w.shotsPerSecond;
    const vs = dps * opts.catalog.damage[w.damageType].structure;
    ov.paragraph(
      [
        `${DAMAGE_NAMES[w.damageType]} · ${num(w.damage)} × ${num(w.shotsPerSecond)}/s`,
        `RANGE ${num(w.range)} CELLS${w.splashRadius ? ` · SPLASH ${num(w.splashRadius)}` : ''}`,
        `  vs STRUCTURES   ${num(Math.round(vs))} DPS`,
      ].join('\n'),
      font.tiny,
      COLORS.inkDim,
      { gapAfter: gap * 2 },
    );
  }

  if (profile.heal) {
    ov.paragraph(
      `HEALS ${num(profile.heal.perSecond)} HP/s TO OTHER FRIENDLY\nUNITS WITHIN ${num(profile.heal.radius)} CELLS — NEVER ITSELF`,
      font.tiny,
      COLORS.inkDim,
      { gapAfter: gap * 2 },
    );
  }

  ov.footer('CLOSE', opts.onClose);
  return ov;
}
