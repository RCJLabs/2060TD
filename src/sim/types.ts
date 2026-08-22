/**
 * Shared simulation types.
 *
 * The sim is pure TypeScript with no Phaser imports. Everything that affects
 * gameplay flows through here: profiles are embedded in spawn/place commands
 * so the engine stays content-agnostic until the content registry lands (M1).
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Flat cell index: y * width + x. */
export type CellIndex = number;

export interface RunnerProfile {
  kind: string;
  maxHp: number;
  /** Movement speed in cells per second. */
  speed: number;
  /** Damage per second vs walls. 0 = walls are impassable to this unit. */
  wallDps: number;
  /** ± fraction rolled onto speed at spawn via the seeded PRNG. */
  speedJitter: number;
}

export interface TurretProfile {
  kind: string;
  /** Acquisition range in cells, measured from turret cell center. */
  range: number;
  damage: number;
  shotsPerSecond: number;
}

export interface SimConfig {
  width: number;
  height: number;
  seed: number;
  /** HP of a freshly built wall segment. */
  wallHp: number;
  /** The Command Center cell attackers path toward. */
  hqCell: CellIndex;
  /** Column reserved for attacker entry; nothing can be built there. */
  spawnColumn: number;
}

export type Command =
  | { tick: number; type: 'placeWall'; cell: CellIndex }
  | { tick: number; type: 'removeWall'; cell: CellIndex }
  | { tick: number; type: 'placeTurret'; cell: CellIndex; profile: TurretProfile }
  | { tick: number; type: 'spawnRunner'; cell: CellIndex; profile: RunnerProfile };

export type SimEvent =
  | { type: 'shot'; turretId: number; runnerId: number; from: Vec2; to: Vec2 }
  | { type: 'runnerDied'; runnerId: number; at: Vec2 }
  | { type: 'runnerLeaked'; runnerId: number }
  | { type: 'runnerSpawned'; runnerId: number }
  | { type: 'wallDestroyed'; cell: CellIndex };

export interface SimStats {
  spawned: number;
  kills: number;
  leaks: number;
  wallsBuilt: number;
  wallsLost: number;
}
