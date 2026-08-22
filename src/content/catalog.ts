import type { Catalog } from '../sim/types';
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
