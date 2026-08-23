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
  /**
   * Sustainment aura (v0.7, UN medics): heals OTHER friendly attackers
   * within radius, hp/second, capped at their max. Never heals itself.
   */
  heal?: { perSecond: number; radius: number };
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
  /**
   * Sustainment aura (v0.7, UN engineering): repairs friendly structures
   * and walls within radius, hp/second, capped at their max. Works through
   * prep and combat alike — the line is rebuilt while it bleeds.
   */
  aura?: { healPerSecond: number; radius: number };
  /** Cost in Supplies — buildable during setup/prep phases. */
  supplyCost?: number;
  /** Cost in Command Points — deployable during combat (field defenses). */
  cpCost?: number;
  /**
   * Stat overrides per upgrade level: levels[0] applies at level 2, etc.
   * Overrides merge onto the base profile (see Engine.resolveProfile).
   */
  levels?: Partial<Pick<StructureProfile, 'maxHp' | 'weapon' | 'trigger' | 'aura'>>[];
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
  /** Compact display name for tight UI slots (buttons); defaults to name. */
  short?: string;
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
  /** Compact display name for tight UI slots (buttons); defaults to name. */
  short?: string;
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

/** Research-driven multipliers for the defending side (the town's tech). */
export interface DefenderMods {
  /** Emplacement/field weapon and trigger damage. */
  weaponDamage?: number;
  /** Wall HP, both layout-injected and newly placed. */
  wallHp?: number;
  /** CP prices (field defenses, HESCOs, powers). */
  cpCost?: number;
}

/** Research-driven multipliers for the attacking side (raid armies). */
export interface AttackerMods {
  /** Unit HP at spawn. */
  hp?: number;
  /** wallDps, hqDps, and weapon damage. */
  damage?: number;
}

/**
 * A pre-planned fire mission for hands-off battles: at `atSeconds` into the
 * assault, cast `kind` at the chosen target class (charges permitting).
 * Rules live in the config so replays re-fire them identically.
 */
export interface AutoPowerRule {
  kind: string;
  atSeconds: number;
  /** cc = the command post; guns = the densest cluster of armed defenses. */
  target: 'cc' | 'guns';
}

/** Where a standing order acts: the latest wall breach, the command post
 * approach, or the densest attacker cluster. */
export type StandingOrderTarget = 'breach' | 'ccApproach' | 'densest';

export interface StandingOrderRule {
  /** Act only while CP is at or above this reserve. */
  cpAtLeast: number;
  /** Deploy a field defense (CP-priced structure kind) or cast a power. */
  action: 'deploy' | 'power';
  /** Role kind: 'depmg' | 'foxhole' | 'claymore' … or 'a10' | 'arty'. */
  kind: string;
  target: StandingOrderTarget;
  /** Act only with at least this many hostiles on the field (default 1). */
  minHostiles?: number;
  /** Ticks between successful firings of this rule. */
  cooldownTicks: number;
}

export interface StandingOrders {
  /** Preset id, carried for logs and replays. */
  id: string;
  /** Evaluated in order on a 1-second command cadence during combat. */
  rules: StandingOrderRule[];
  /**
   * Total actions the garrison may take per battle (the handicap that keeps
   * an unattended defense below a live commander). Omit for unlimited.
   */
  maxActions?: number;
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
  /**
   * Which side the player commands. Defaults to 'defender' (town sieges):
   * powers strike the attacking wave. As 'attacker' (raids): powers strike
   * structures and walls instead, and cost no CP — charges are the budget.
   */
  playerSide?: 'defender' | 'attacker';
  /** Research effects, applied deterministically inside the sim. */
  mods?: { defender?: DefenderMods; attacker?: AttackerMods };
  /** Pre-planned fire missions (hands-off raids). */
  autoPowers?: AutoPowerRule[];
  /**
   * Standing orders (v0.8): a defender CP-spending policy the engine
   * executes during combat — how an unattended base fights back with the
   * Command Points its kills earn. Config-driven like autoPowers, so
   * replays of offline defenses re-issue the same orders identically.
   */
  standingOrders?: StandingOrders;
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
  /** What landed the killing blow on the CC (attacker kind, or 'fire support'). */
  ccKillerKind?: string;
}
