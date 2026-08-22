import type { Catalog } from '../sim/types';
import { CHINA_ASSAULT_ROSTER, USA_ASSAULT_ROSTER, type AssaultRoster } from './assaults';
import { CHINA_BASE_KIT, USA_BASE_KIT, type BaseKit } from './bases';
import { ECONOMY_STRUCTURES, TOWN_META, type TownBuildingMeta } from './buildings';
import { CAMPAIGN, type MissionDef } from './campaign';
import { M1_CATALOG, RAID_CATALOG } from './catalog';
import { CHINA_ATTACKERS } from './china';
import {
  CHINA_TOWN_POWERS,
  CHINA_TOWN_STRUCTURES,
  CHINA_TOWN_WALLS,
  CHINA_TRAINABLE,
} from './chinaFaction';
import { DAMAGE_MULT } from './damage';
import { EASTERN_TIDE } from './easternTide';
import { USA_STRUCTURES, USA_WALLS } from './usa';
import { TRAINABLE, USA_UNITS, type TrainMeta } from './usaUnits';

/**
 * The faction indirection layer (M5). Everything downstream — town, warfare,
 * scenes — asks these functions instead of importing USA/China content
 * directly. Kinds are ROLE ids shared across factions ('m2nest' = basic gun
 * nest, 'autocannon' = anti-armor post, 'a10' = strafe tasking…), so gating,
 * unlock keys, saves, and UI plumbing are faction-agnostic; only the profiles
 * behind the kinds change.
 *
 * The war is symmetric: whoever you are, the OTHER side's roster besieges
 * your town, and your raids hit bases built from the OTHER side's kit.
 */
export type FactionId = 'usa' | 'china';

export const FACTION_IDS: FactionId[] = ['usa', 'china'];

/** What the player's town fights with, per faction (attackers = the enemy). */
const CHINA_DEFENSE_CATALOG: Catalog = {
  attackers: USA_UNITS,
  structures: CHINA_TOWN_STRUCTURES,
  walls: CHINA_TOWN_WALLS,
  powers: CHINA_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

/** China's raid table: PLA rosters assault USA firebases. */
const CHINA_RAID_CATALOG: Catalog = {
  attackers: CHINA_ATTACKERS,
  structures: { ...USA_STRUCTURES, ...ECONOMY_STRUCTURES },
  walls: USA_WALLS,
  powers: {},
  damage: DAMAGE_MULT,
};

export function defenseCatalogFor(faction: FactionId): Catalog {
  return faction === 'china' ? CHINA_DEFENSE_CATALOG : M1_CATALOG;
}

export function raidCatalogFor(faction: FactionId): Catalog {
  return faction === 'china' ? CHINA_RAID_CATALOG : RAID_CATALOG;
}

/** The kit enemy Front Line bases are generated from (the OTHER side's kit). */
export function baseKitFor(faction: FactionId): BaseKit {
  return faction === 'china' ? USA_BASE_KIT : CHINA_BASE_KIT;
}

/** The roster that besieges this faction's town (the OTHER side's army). */
export function enemyRosterFor(faction: FactionId): AssaultRoster {
  return faction === 'china' ? USA_ASSAULT_ROSTER : CHINA_ASSAULT_ROSTER;
}

export function campaignFor(faction: FactionId): MissionDef[] {
  return faction === 'china' ? EASTERN_TIDE : CAMPAIGN;
}

export function trainableFor(faction: FactionId): TrainMeta[] {
  return faction === 'china' ? CHINA_TRAINABLE : TRAINABLE;
}

const TRAIN_META_BY_FACTION: Record<FactionId, Record<string, TrainMeta>> = {
  usa: Object.fromEntries(TRAINABLE.map((t) => [t.kind, t])),
  china: Object.fromEntries(CHINA_TRAINABLE.map((t) => [t.kind, t])),
};

export function trainMetaFor(faction: FactionId): Record<string, TrainMeta> {
  return TRAIN_META_BY_FACTION[faction];
}

/** TOWN_META with per-faction display names; costs/rates/timers are shared. */
const CHINA_TOWN_META: Record<string, TownBuildingMeta> = Object.fromEntries(
  Object.entries(TOWN_META).map(([kind, meta]) => [
    kind,
    { ...meta, name: CHINA_TOWN_STRUCTURES[kind]?.name ?? meta.name },
  ]),
);

export function townMetaFor(faction: FactionId): Record<string, TownBuildingMeta> {
  return faction === 'china' ? CHINA_TOWN_META : TOWN_META;
}

// ---- flavor: the strings that make the same screens read as different wars ------

export interface FactionFlavor {
  /** Player faction display name. */
  faction: string;
  /** Operation banner over sieges and briefings. */
  operation: string;
  /** Town panel location line. */
  base: string;
  /** Enemy label for Front Line targets. */
  enemy: string;
  /** Intro blurb line under the faction pick. */
  pitch: string;
  /** Non-mission siege debrief lines. */
  heldLine: string;
  brokeLine: string;
}

const FLAVOR: Record<FactionId, FactionFlavor> = {
  usa: {
    faction: 'UNITED STATES',
    operation: 'OPERATION LANDFALL — COOS BAY PERIMETER',
    base: 'FORWARD BASE — COOS BAY',
    enemy: 'PLA',
    pitch: 'Fewer soldiers, better hardware. Hold the coast, hit back with quality.',
    heldLine: 'The perimeter held. Coos Bay stays on the map.',
    brokeLine: 'The line broke. Survivors are falling back inland.',
  },
  china: {
    faction: 'PLA EXPEDITIONARY FORCE',
    operation: 'OPERATION EASTERN TIDE — GRAYS HARBOR BEACHHEAD',
    base: 'BEACHHEAD BASE — GRAYS HARBOR',
    enemy: 'US ARMY',
    pitch: 'Mass, saturation, and shaped charges. Hold the sand against the counterattack.',
    heldLine: 'The wire held. The beachhead stays on the map.',
    brokeLine: 'The line broke. What is left is backing into the surf.',
  },
};

export function flavorFor(faction: FactionId): FactionFlavor {
  return FLAVOR[faction];
}
