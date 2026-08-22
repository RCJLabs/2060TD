/**
 * Shared simulation types.
 *
 * The sim is pure TypeScript with no Phaser imports. Everything that affects
 * gameplay flows through here. Content (unit stats, structures, waves) lives
 * in src/content as data conforming to these shapes.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Flat cell index: y * width + x. */
export type CellIndex = number;

// ---- combat model -----------------------------------------------------------

export type ArmorClass = 'none' | 'light' | 'heavy' | 'structure';
export type DamageType = 'smallArms' | 'kinetic' | 'explosive' | 'shaped';

/** damage multiplier = DAMAGE_MULT[damageType][armorClass] (content/damage.ts) */
export type DamageTable = Record<DamageType, Record<ArmorClass, number>>;

export interface Weapon {
  damageType: DamageType;
  damage: number;
  shotsPerSecond: number;
  /** Acquisition range in cells (center to center). */
  range: number;
  /** Targets closer than this are untouchable (mortars). */
  minRange?: number;
  /** Impact splash radius in cells; omit for single-target. */
  splashRadius?: number;
  /** Seconds of shell flight; omit for hitscan. */
  flightSeconds?: number;
}

// ---- profiles -----------------------------------------------------------------

export interface AttackerProfile {
  kind: string;
  name: string;
  maxHp: number;
  /** Cells per second. */
  speed: number;
  armor: ArmorClass;
  /**
   * Demolition damage per second vs walls and blocking structures in the
   * attacker's path. 0 = cannot break through anything.
   */
  wallDps: number;
  /** Melee damage per second vs the Command Center once at its perimeter. */
  hqDps: number;
  /** Command Points awarded to the defender for the kill. */
  cpValue: number;
  /** Optional ranged weapon, used against defensive structures and the CC. */
  weapon?: Weapon;
  /** ± fraction rolled onto speed at spawn via the seeded PRNG. */
  speedJitter: number;
}

export interface StructureProfile {
  kind: string;
  name: string;
  maxHp: number;
  /** Grid footprint edge length: 1 (1×1) or 2 (2×2 — CC and economy buildings). */
  footprint: 1 | 2;
  /** Blocks movement (attackers demolish it to pass). Claymores don't. */
  blocks: boolean;
  /** Can be targeted by attacker weapons. Claymores are concealed. */
  targetable: boolean;
  weapon?: Weapon;
  /** Proximity mine behavior (claymore). */
  trigger?: { radius: number; damage: number; damageType: DamageType; splashRadius: number };
  /** Cost in Supplies — buildable during setup/prep phases. */
  supplyCost?: number;
  /** Cost in Command Points — deployable during combat (field defenses). */
  cpCost?: number;
  /**
   * Stat overrides per upgrade level: levels[0] applies at level 2, etc.
   * Overrides merge onto the base profile (see Engine.resolveProfile).
   */
  levels?: Partial<Pick<StructureProfile, 'maxHp' | 'weapon' | 'trigger'>>[];
}

export interface WallDef {
  kind: string;
  name: string;
  hp: number;
  /** Buildable in setup/prep for Supplies. */
  supplyCost?: number;
  /** Deployable mid-combat for CP (HESCO barricades). */
  cpCost?: number;
}

// ---- powers ---------------------------------------------------------------------

export interface StrafePower {
  type: 'strafe';
  kind: string;
  name: string;
  cpCost: number;
  cooldownSeconds: number;
  delayTicks: number;
  pulses: number;
  pulseSpacingTicks: number;
  pulseDamage: number;
  damageType: DamageType;
  /** Strip half-extents in cells; the strafe runs along +x through the target. */
  halfLength: number;
  halfWidth: number;
}

export interface BarragePower {
  type: 'barrage';
  kind: string;
  name: string;
  cpCost: number;
  cooldownSeconds: number;
  delayTicks: number;
  shells: number;
  shellSpacingTicks: number;
  shellDamage: number;
  damageType: DamageType;
  splashRadius: number;
  /** Max scatter distance from the target point, rolled via the seeded PRNG. */
  scatter: number;
}

export type PowerDef = StrafePower | BarragePower;

// ---- content catalog ---------------------------------------------------------------

export interface Catalog {
  attackers: Record<string, AttackerProfile>;
  structures: Record<string, StructureProfile>;
  walls: Record<string, WallDef>;
  powers: Record<string, PowerDef>;
  damage: DamageTable;
}

// ---- siege definition ---------------------------------------------------------------

/**
 * Attacker behavior program:
 * - assault: path to the Command Center and take it down (default)
 * - hunt: destroy armed defensive structures first, then the CC
 * - raze: destroy the economy first, then the CC
 */
export type Doctrine = 'assault' | 'hunt' | 'raze';

export interface WaveEntry {
  /** Tick offset from the start of the wave. */
  atTick: number;
  /** Attacker kind (catalog key). */
  kind: string;
  /** Spawn row in the entry column. */
  row: number;
  /**
   * Spawn column override — infiltration tunnels open INSIDE the map.
   * Omit for the regular western entry strip.
   */
  col?: number;
  /** Behavior program; defaults to assault. */
  doctrine?: Doctrine;
}

export interface WaveDef {
  entries: WaveEntry[];
}

export interface SiegeDef {
  name: string;
  startingSupplies: number;
  suppliesPerWave: number;
  startingCp: number;
  cpCap: number;
  cpPerSecond: number;
  prepSeconds: number;
  /** Fraction of missing HP charged as Supplies by Repair All (e.g. 0.04). */
  repairCostPerHp: number;
  waves: WaveDef[];
}

/** A pre-existing wall injected at battle start (from the persistent town). */
export interface LayoutWall {
  cell: CellIndex;
  kind: string;
}

/** A pre-existing structure injected at battle start (from the persistent town). */
export interface LayoutStructure {
  cell: CellIndex;
  kind: string;
  level?: number;
  /** Starting HP fraction (under-construction scaffolding arrives damaged). */
  hpFraction?: number;
  /** Inert structures don't fire or trigger (still under construction). */
  inert?: boolean;
}

export interface SimConfig {
  width: number;
  height: number;
  seed: number;
  /** Top-left cell of the 2×2 Command Center footprint. */
  ccOrigin: CellIndex;
  /** Command Center upgrade level (scales its HP). Default 1. */
  ccLevel?: number;
  /** Column reserved for attacker entry; nothing can be built there. */
  spawnColumn: number;
  /** Omit for sandbox mode: free placement, manual spawns, no waves. */
  siege?: SiegeDef;
  /** The persistent town, placed free of charge before the battle starts. */
  layout?: { walls: LayoutWall[]; structures: LayoutStructure[] };
  /**
   * Ammunition stock per power kind. When present, each cast consumes one
   * charge and casts without a remaining charge are rejected. Absent =
   * unlimited (M1 standalone battles, sandbox).
   */
  powerCharges?: Record<string, number>;
  /**
   * Max total count per structure kind (layout included) and max wall count,
   * from the town's Command Center gating. Absent = unlimited. Kind entries
   * also apply to wall kinds (a 0 entry locks HESCOs, for example).
   */
  buildLimits?: { structures?: Record<string, number>; walls?: number };
  /**
   * Cells the player may not build on during this battle (tunnel mouths).
   * Town-layout injection ignores this — pre-existing walls stand.
   */
  reservedCells?: CellIndex[];
}

export type Phase = 'sandbox' | 'setup' | 'combat' | 'prep' | 'victory' | 'defeat';

// ---- commands ----------------------------------------------------------------------

export type Command =
  | { tick: number; type: 'placeWall'; cell: CellIndex; kind: string }
  | { tick: number; type: 'removeWall'; cell: CellIndex }
  | { tick: number; type: 'placeStructure'; cell: CellIndex; kind: string; level?: number }
  | { tick: number; type: 'removeStructure'; cell: CellIndex }
  | { tick: number; type: 'spawnAttacker'; cell: CellIndex; kind: string; doctrine?: Doctrine }
  | { tick: number; type: 'startAssault' }
  | { tick: number; type: 'skipPrep' }
  | { tick: number; type: 'repairAll' }
  | { tick: number; type: 'castPower'; kind: string; target: Vec2 };

// ---- events -------------------------------------------------------------------------

export type SimEvent =
  | { type: 'attackerSpawned'; id: number }
  | { type: 'attackerDied'; id: number; at: Vec2 }
  | { type: 'shot'; from: Vec2; to: Vec2; damageType: DamageType }
  | { type: 'aoe'; at: Vec2; radius: number }
  | { type: 'strafePulse'; x0: number; x1: number; y: number }
  | { type: 'wallDestroyed'; cell: CellIndex }
  | { type: 'structureDestroyed'; id: number; kind: string; at: Vec2 }
  | { type: 'powerCast'; kind: string; at: Vec2 }
  | { type: 'assaultStarted' }
  | { type: 'waveStarted'; index: number }
  | { type: 'prepStarted'; index: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface SimStats {
  spawned: number;
  kills: number;
  wallsBuilt: number;
  wallsLost: number;
  structuresLost: number;
  suppliesSpent: number;
  cpSpent: number;
  /** Supplies recovered from unspent CP at victory (2 Supplies per CP). */
  salvage: number;
}
