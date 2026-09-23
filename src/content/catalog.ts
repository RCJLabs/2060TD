import { scaleFootprint } from '../sim/scale';
import type { Catalog, CellIndex, LayoutStructure, LayoutWall } from '../sim/types';
import { MAP_CELL_SIZE, MAP_W } from './bases';
import { ECONOMY_STRUCTURES } from './buildings';
import { CHINA_ATTACKERS } from './china';
import { CHINA_BASE, CHINA_WALLS } from './chinaBase';
import { DAMAGE_MULT } from './damage';
import { NK_ATTACKERS } from './nk';
import { RU_ATTACKERS } from './russia';
import { USA_POWERS, USA_STRUCTURES, USA_WALLS } from './usa';
import { USA_UNITS } from './usaUnits';

/**
 * The assembled content catalog: USA defends (emplacements, field defenses,
 * economy buildings); the Coalition of the Three attacks (China's roster,
 * plus the NK infiltrator and Russian T-72 campaign cameos). When factions
 * become symmetric (M5), catalogs get built per matchup instead.
 */
export const M1_CATALOG: Catalog = {
  attackers: { ...CHINA_ATTACKERS, ...NK_ATTACKERS, ...RU_ATTACKERS },
  structures: { ...USA_STRUCTURES, ...ECONOMY_STRUCTURES },
  walls: USA_WALLS,
  powers: USA_POWERS,
  damage: DAMAGE_MULT,
};

/** Raids flip the table: USA units attack a Chinese Front Line base. The
 * town's own powers ride along as pre-planned fire support (M6). */
export const RAID_CATALOG: Catalog = {
  attackers: USA_UNITS,
  structures: CHINA_BASE,
  walls: CHINA_WALLS,
  powers: USA_POWERS,
  damage: DAMAGE_MULT,
};

/**
 * How many cells on a side a structure occupies — the ONE place that answers
 * it for the renderer.
 *
 * Presentation used to carry three separate tables of "big kinds", and all
 * three had drifted: `airfield` is footprint 2 in the sim and was missing from
 * every one of them, so it drew at a quarter of the ground it actually
 * reserved. The footprint is a property of the structure, so it is read off
 * the structure.
 */
const ALL_STRUCTURES = { ...M1_CATALOG.structures, ...RAID_CATALOG.structures };

export function footprintOfKind(kind: string, cellSize: number = MAP_CELL_SIZE): 1 | 2 {
  // On a board of bigger cells a 2x2 building is one cell (M34), and the
  // engine fights it at that size — so the board draws it at that size too.
  return scaleFootprint(ALL_STRUCTURES[kind]?.footprint === 2 ? 2 : 1, cellSize);
}

/**
 * Every cell a base stands on — the post, its walls, its buildings — as the
 * engine counts them when it keeps water and woods off them. The same set is
 * what a view of the base has to hand the terrain generator, or it draws
 * ground the battle is not fought on.
 */
export function baseOccupied(base: {
  ccOrigin: CellIndex;
  walls: readonly LayoutWall[];
  structures: readonly LayoutStructure[];
}): CellIndex[] {
  const out: CellIndex[] = [];
  const add = (origin: CellIndex, size: number): void => {
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) out.push(origin + dy * MAP_W + dx);
    }
  };
  add(base.ccOrigin, footprintOfKind('cc'));
  for (const w of base.walls) out.push(w.cell);
  for (const s of base.structures) add(s.cell, footprintOfKind(s.kind));
  return out;
}
