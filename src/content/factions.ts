import type { Catalog } from '../sim/types';
import { CHINA_ASSAULT_ROSTER, USA_ASSAULT_ROSTER, type AssaultRoster } from './assaults';
import { CHINA_BASE_KIT, USA_BASE_KIT, type BaseKit } from './bases';
import { BLUE_LINE } from './blueLine';
import { ECONOMY_STRUCTURES, TOWN_META, type TownBuildingMeta } from './buildings';
import { CAMPAIGN, type MissionDef } from './campaign';
import { M1_CATALOG, RAID_CATALOG } from './catalog';
import { CHINA_ATTACKERS } from './china';
import { CHINA_BASE, CHINA_WALLS } from './chinaBase';
import {
  CHINA_TOWN_POWERS,
  CHINA_TOWN_STRUCTURES,
  CHINA_TOWN_WALLS,
  CHINA_TRAINABLE,
} from './chinaFaction';
import { DAMAGE_MULT } from './damage';
import { EASTERN_TIDE } from './easternTide';
import { IRON_CORRIDOR } from './ironCorridor';
import { NK_ATTACKERS } from './nk';
import {
  NK_TOWN_POWERS,
  NK_TOWN_STRUCTURES,
  NK_TOWN_WALLS,
  NK_TRAINABLE,
} from './nkFaction';
import { RU_ATTACKERS } from './russia';
import { SILENT_TUNNELS } from './silentTunnels';
import { UN_ATTACKERS } from './un';
import {
  UN_TOWN_POWERS,
  UN_TOWN_STRUCTURES,
  UN_TOWN_WALLS,
  UN_TRAINABLE,
} from './unFaction';
import {
  RUSSIA_TOWN_POWERS,
  RUSSIA_TOWN_STRUCTURES,
  RUSSIA_TOWN_WALLS,
  RUSSIA_TRAINABLE,
} from './russiaFaction';
import { USA_STRUCTURES, USA_WALLS } from './usa';
import { TRAINABLE, USA_UNITS, type TrainMeta } from './usaUnits';

/**
 * The faction indirection layer (M5+). Everything downstream — town, warfare,
 * scenes — asks these functions instead of importing faction content
 * directly. Kinds are ROLE ids shared across factions ('m2nest' = basic gun
 * nest, 'autocannon' = anti-armor post, 'a10' = strafe tasking…), so gating,
 * unlock keys, saves, and UI plumbing are faction-agnostic; only the profiles
 * behind the kinds change.
 *
 * The war is symmetric: whoever you are, the OTHER side's roster besieges
 * your town, and your raids hit bases built from the OTHER side's kit.
 * China and Russia both fight the USA; the USA fights the PLA front.
 */
export type FactionId = 'usa' | 'china' | 'russia' | 'nk' | 'un';

export const FACTION_IDS: FactionId[] = ['usa', 'china', 'russia', 'nk', 'un'];

/** What the player's town fights with, per faction (attackers = the enemy). */
const CHINA_DEFENSE_CATALOG: Catalog = {
  attackers: USA_UNITS,
  structures: CHINA_TOWN_STRUCTURES,
  walls: CHINA_TOWN_WALLS,
  powers: CHINA_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

const RUSSIA_DEFENSE_CATALOG: Catalog = {
  attackers: USA_UNITS,
  structures: RUSSIA_TOWN_STRUCTURES,
  walls: RUSSIA_TOWN_WALLS,
  powers: RUSSIA_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

const NK_DEFENSE_CATALOG: Catalog = {
  attackers: USA_UNITS,
  structures: NK_TOWN_STRUCTURES,
  walls: NK_TOWN_WALLS,
  powers: NK_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

/** The UN fights the China front, like the USA: PLA besiegers, PLA targets. */
const UN_DEFENSE_CATALOG: Catalog = {
  attackers: CHINA_ATTACKERS,
  structures: UN_TOWN_STRUCTURES,
  walls: UN_TOWN_WALLS,
  powers: UN_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

/** Raid tables: the faction's army assaults the enemy's bases, with its own
 * batteries available as pre-planned fire support. */
const CHINA_RAID_CATALOG: Catalog = {
  attackers: CHINA_ATTACKERS,
  structures: { ...USA_STRUCTURES, ...ECONOMY_STRUCTURES },
  walls: USA_WALLS,
  powers: CHINA_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

const RUSSIA_RAID_CATALOG: Catalog = {
  attackers: RU_ATTACKERS,
  structures: { ...USA_STRUCTURES, ...ECONOMY_STRUCTURES },
  walls: USA_WALLS,
  powers: RUSSIA_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

const NK_RAID_CATALOG: Catalog = {
  attackers: NK_ATTACKERS,
  structures: { ...USA_STRUCTURES, ...ECONOMY_STRUCTURES },
  walls: USA_WALLS,
  powers: NK_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

const UN_RAID_CATALOG: Catalog = {
  attackers: UN_ATTACKERS,
  structures: CHINA_BASE,
  walls: CHINA_WALLS,
  powers: UN_TOWN_POWERS,
  damage: DAMAGE_MULT,
};

const DEFENSE_CATALOGS: Record<FactionId, Catalog> = {
  usa: M1_CATALOG,
  china: CHINA_DEFENSE_CATALOG,
  russia: RUSSIA_DEFENSE_CATALOG,
  nk: NK_DEFENSE_CATALOG,
  un: UN_DEFENSE_CATALOG,
};

const RAID_CATALOGS: Record<FactionId, Catalog> = {
  usa: RAID_CATALOG,
  china: CHINA_RAID_CATALOG,
  russia: RUSSIA_RAID_CATALOG,
  nk: NK_RAID_CATALOG,
  un: UN_RAID_CATALOG,
};

export function defenseCatalogFor(faction: FactionId): Catalog {
  return DEFENSE_CATALOGS[faction];
}

export function raidCatalogFor(faction: FactionId): Catalog {
  return RAID_CATALOGS[faction];
}

/** The kit enemy Front Line bases are generated from (the OTHER side's kit).
 * USA and UN fight the China front; everyone else raids US firebases. */
export function baseKitFor(faction: FactionId): BaseKit {
  return faction === 'usa' || faction === 'un' ? CHINA_BASE_KIT : USA_BASE_KIT;
}

/** The roster that besieges this faction's town (the OTHER side's army). */
export function enemyRosterFor(faction: FactionId): AssaultRoster {
  return faction === 'usa' || faction === 'un' ? CHINA_ASSAULT_ROSTER : USA_ASSAULT_ROSTER;
}

const CAMPAIGNS: Record<FactionId, MissionDef[]> = {
  usa: CAMPAIGN,
  china: EASTERN_TIDE,
  russia: IRON_CORRIDOR,
  nk: SILENT_TUNNELS,
  un: BLUE_LINE,
};

export function campaignFor(faction: FactionId): MissionDef[] {
  return CAMPAIGNS[faction];
}

const TRAINABLES: Record<FactionId, TrainMeta[]> = {
  usa: TRAINABLE,
  china: CHINA_TRAINABLE,
  russia: RUSSIA_TRAINABLE,
  nk: NK_TRAINABLE,
  un: UN_TRAINABLE,
};

export function trainableFor(faction: FactionId): TrainMeta[] {
  return TRAINABLES[faction];
}

const TRAIN_META_BY_FACTION: Record<FactionId, Record<string, TrainMeta>> = {
  usa: Object.fromEntries(TRAINABLE.map((t) => [t.kind, t])),
  china: Object.fromEntries(CHINA_TRAINABLE.map((t) => [t.kind, t])),
  russia: Object.fromEntries(RUSSIA_TRAINABLE.map((t) => [t.kind, t])),
  nk: Object.fromEntries(NK_TRAINABLE.map((t) => [t.kind, t])),
  un: Object.fromEntries(UN_TRAINABLE.map((t) => [t.kind, t])),
};

export function trainMetaFor(faction: FactionId): Record<string, TrainMeta> {
  return TRAIN_META_BY_FACTION[faction];
}

// ---- town meta: names always follow the faction; Russia also pays Overbuilt ------

function renameMeta(
  names: Record<string, { name: string }>,
  transform?: (meta: TownBuildingMeta) => TownBuildingMeta,
): Record<string, TownBuildingMeta> {
  return Object.fromEntries(
    Object.entries(TOWN_META).map(([kind, meta]) => {
      const named = { ...meta, name: names[kind]?.name ?? meta.name };
      return [kind, transform ? transform(named) : named];
    }),
  );
}

/** Overbuilt (Russia): more concrete per structure — costs ~15% more Supplies
 * and Fuel (rounded to fives) and takes 30% longer to build. HP lives in the
 * structure profiles; wreck repairs are pricier via wreckRepairFractionFor. */
const OVERBUILT_COST = (v: number): number => (v === 0 ? 0 : Math.round((v * 1.15) / 5) * 5);
const overbuilt = (meta: TownBuildingMeta): TownBuildingMeta => ({
  ...meta,
  levels: meta.levels.map((level) => ({
    supplies: OVERBUILT_COST(level.supplies),
    fuel: OVERBUILT_COST(level.fuel),
    seconds: Math.round(level.seconds * 1.3),
  })),
});

/** Expendable (NK): nothing is precious — town builds cost ~10% less and go
 * up ~15% faster. The kit's low HP is the price; tunnels are the payoff. */
const EXPENDABLE_COST = (v: number): number => (v === 0 ? 0 : Math.max(5, Math.round((v * 0.9) / 5) * 5));
const expendable = (meta: TownBuildingMeta): TownBuildingMeta => ({
  ...meta,
  levels: meta.levels.map((level) => ({
    supplies: EXPENDABLE_COST(level.supplies),
    fuel: EXPENDABLE_COST(level.fuel),
    seconds: Math.round(level.seconds * 0.85),
  })),
});

const TOWN_METAS: Record<FactionId, Record<string, TownBuildingMeta>> = {
  usa: TOWN_META,
  china: renameMeta(CHINA_TOWN_STRUCTURES),
  russia: renameMeta(RUSSIA_TOWN_STRUCTURES, overbuilt),
  nk: renameMeta(NK_TOWN_STRUCTURES, expendable),
  un: renameMeta(UN_TOWN_STRUCTURES), // baseline logistics — the discipline is in the kit
};

export function townMetaFor(faction: FactionId): Record<string, TownBuildingMeta> {
  return TOWN_METAS[faction];
}

/** Fraction of cumulative cost charged to repair a wreck. Russia's concrete
 * is cheap to trust and dear to rebuild; nothing the KPA loses was dear;
 * the UN's engineer corps restores anything for less than anyone. */
export function wreckRepairFractionFor(faction: FactionId): number {
  if (faction === 'russia') return 0.42;
  if (faction === 'nk') return 0.25;
  if (faction === 'un') return 0.2;
  return 0.3;
}

/** Tunnel insertion on raids is KPA doctrine — nobody else digs. */
export function canTunnel(faction: FactionId): boolean {
  return faction === 'nk';
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
  /** Two-line situation text on the difficulty screen. */
  situation: string;
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
    situation:
      'You hold a headland town on the Oregon coast: the last supply\ncorridor on Highway 101. Build the base. Hold the line.',
    heldLine: 'The perimeter held. Coos Bay stays on the map.',
    brokeLine: 'The line broke. Survivors are falling back inland.',
  },
  china: {
    faction: 'PLA EXPEDITIONARY FORCE',
    operation: 'OPERATION EASTERN TIDE — GRAYS HARBOR BEACHHEAD',
    base: 'BEACHHEAD BASE — GRAYS HARBOR',
    enemy: 'US ARMY',
    pitch: 'Mass, saturation, and shaped charges. Hold the sand against the counterattack.',
    situation:
      'You hold the beachhead at Grays Harbor: one pier, one HQ, and\nthe whole US Army working up the ridge. Hold the sand.',
    heldLine: 'The wire held. The beachhead stays on the map.',
    brokeLine: 'The line broke. What is left is backing into the surf.',
  },
  russia: {
    faction: 'RUSSIAN GROUND FORCES',
    operation: 'OPERATION IRON CORRIDOR — NOME RAILHEAD',
    base: 'CORRIDOR BASE — NOME RAILHEAD',
    enemy: 'US ARMY',
    pitch: 'Concrete, armor, and thermobarics. Everything overbuilt; nothing retreats.',
    situation:
      'You hold the Nome railhead: the Alaskan end of the ice-road\ncorridor. Builds run slow and heavy here. Hold the concrete.',
    heldLine: 'The concrete held. The corridor stays open.',
    brokeLine: 'The line broke. The trains stop somewhere colder tonight.',
  },
  nk: {
    faction: 'KOREAN PEOPLE\'S ARMY',
    operation: 'OPERATION SILENT TUNNELS — HUMBOLDT ENCLAVE',
    base: 'ENCLAVE BASE — HUMBOLDT BAY',
    enemy: 'US ARMY',
    pitch: 'Cheap guns, long artillery, deep holes. Raid through tunnels, not gates.',
    situation:
      'You hold the Humboldt Bay enclave: a sealift harbor dug into\nthe redwood coast. Everything is cheap and buried. Hold the ground.',
    heldLine: 'The ground held. The enclave stays on the map.',
    brokeLine: 'The line broke. What is left is going underground.',
  },
  un: {
    faction: 'UN COALITION',
    operation: 'OPERATION BLUE LINE — TACOMA CORRIDOR',
    base: 'CORRIDOR BASE — PORT OF TACOMA',
    enemy: 'PLA',
    pitch: 'Mid-pack guns, medics, and engineers. Nothing that falls stays down.',
    situation:
      'You hold the Tacoma evacuation corridor: the port, the rail\nspur, and the last open miles of I-5. Twelve flags. One line.',
    heldLine: 'The corridor held. The convoys sail full.',
    brokeLine: 'The line broke. The convoys sail light tonight.',
  },
};

export function flavorFor(faction: FactionId): FactionFlavor {
  return FLAVOR[faction];
}
