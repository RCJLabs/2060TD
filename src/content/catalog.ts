import type { Catalog } from '../sim/types';
import { CHINA_ATTACKERS } from './china';
import { DAMAGE_MULT } from './damage';
import { USA_POWERS, USA_STRUCTURES, USA_WALLS } from './usa';

/**
 * The assembled content catalog for the M1 vertical slice: USA defends,
 * China attacks. When factions become symmetric (M5), catalogs get built
 * per matchup instead of this single constant.
 */
export const M1_CATALOG: Catalog = {
  attackers: CHINA_ATTACKERS,
  structures: USA_STRUCTURES,
  walls: USA_WALLS,
  powers: USA_POWERS,
  damage: DAMAGE_MULT,
};
