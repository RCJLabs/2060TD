import { entry, series } from './missions';
import type { MissionDef } from './campaign';

/**
 * EASTERN TIDE — the China campaign (M5, v0.3). The other side of the same
 * war: you hold a beachhead on the Washington coast while the USA counter-
 * attacks with fewer, better soldiers and much better hardware.
 *
 * Same terse radio register as Landfall; nobody in this war gets to enjoy it.
 * EAST WIND is group command; the player is TIDE ACTUAL.
 */
export const EASTERN_TIDE: MissionDef[] = [
  {
    id: 'ct1',
    index: 0,
    codename: 'BEACHHEAD',
    briefing: [
      'EAST WIND TO TIDE ACTUAL — the landing held. Barely.',
      'You have one pier, one HQ, and a treeline full of mobilized Guard units',
      'working up the nerve to push you back into the sea.',
      'Wall the approaches. Site the machine guns. Hold what was paid for.',
      'EAST WIND OUT.',
    ],
    objective: 'Survive the first counterprobe. The HQ stands or nothing does.',
    debriefVictory: [
      'AFTER ACTION — the probe died in the wire.',
      'Stores pits authorized. The fleet cannot resupply you forever; bank everything.',
    ],
    debriefDefeat: ['AFTER ACTION — the beachhead folded. The next wave lands on the same sand.'],
    waves: [{ entries: series(0, 55, 5, 'guardsman', [8, 12, 16]) }],
    siegeOverrides: { suppliesPerWave: 60, startingCp: 0 },
    unlocks: ['storageBunker'],
    unlockNote: 'REQUISITION: STORES PIT',
    reward: { supplies: 250, fuel: 0 },
    bonus: { id: 'ccAbove90', label: 'DRY BOOTS — HQ above 90%' },
  },
  {
    id: 'ct2',
    index: 1,
    codename: 'COUNTERATTACK',
    briefing: [
      'EAST WIND TO TIDE — Rangers this time, behind the Guard screen.',
      'They move in small teams and they do not waste rounds.',
      'Command Points released: your kills buy field works mid-fight.',
      'Meet quality with quantity, and quantity with concrete.',
    ],
    objective: 'Break two waves. Spend Command Points like ammunition.',
    debriefVictory: [
      'AFTER ACTION — the Rangers pulled back with less than they came with.',
      'Type 67 MG teams and fighting pits authorized for field deployment.',
    ],
    debriefDefeat: ['AFTER ACTION — small teams, small gaps, large consequences.'],
    waves: [
      { entries: series(0, 45, 6, 'guardsman', [6, 12, 18]) },
      {
        entries: [
          ...series(0, 40, 4, 'guardsman', [4, 10, 20]),
          ...series(180, 50, 3, 'ranger', [10, 12, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 70 },
    unlocks: ['depmg', 'foxhole'],
    unlockNote: 'REQUISITION: TYPE 67 MG TEAM, FIGHTING PIT',
    reward: { supplies: 300, fuel: 0 },
    bonus: { id: 'fewWallsLost', label: 'HOLD THE WIRE — lose 3 walls or fewer' },
  },
  {
    id: 'ct3',
    index: 2,
    codename: 'DEMOLITION TEAMS',
    briefing: [
      'EAST WIND TO TIDE — combat engineers in the assault echelon.',
      'American demolition teams treat your walls as a schedule, not a barrier.',
      'Mine the gaps you leave on purpose. Cover the walls you cannot afford to lose.',
      'A fuel allotment ships when this position proves it can hold one.',
    ],
    objective: 'Stop the demolition teams before the maze stops mattering.',
    debriefVictory: [
      'AFTER ACTION — breach teams neutralized at the wall line.',
      'POMZ fields and gabion walls authorized. Fuel bowsers inbound;',
      'HQ expansion (level 2) cleared by group engineering.',
    ],
    debriefDefeat: ['AFTER ACTION — they came through the wall on schedule. Adjust the schedule.'],
    waves: [
      {
        entries: [
          entry(0, 'engineer', 12),
          ...series(50, 45, 6, 'guardsman', [6, 12, 18]),
        ],
      },
      {
        entries: [
          ...series(0, 80, 2, 'engineer', [8, 16]),
          ...series(100, 50, 4, 'ranger', [10, 14]),
        ],
      },
      {
        entries: [
          ...series(0, 40, 6, 'guardsman', [4, 8, 16, 20]),
          entry(200, 'engineer', 12),
          ...series(260, 55, 3, 'ranger', [8, 12, 16]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 80 },
    unlocks: ['claymore', 'hesco', 'fuelDepot', 'cc2'],
    unlockNote: 'REQUISITION: POMZ FIELD, GABION WALL, FUEL PARK · HQ LEVEL 2',
    reward: { supplies: 380, fuel: 60 },
    bonus: { id: 'fewWallsLost', label: 'HOLD THE MAZE — lose 3 walls or fewer' },
  },
  {
    id: 'ct4',
    index: 3,
    codename: 'JAVELIN RAIN',
    briefing: [
      'EAST WIND TO TIDE — missile teams on the ridgeline.',
      'Javelin crews will stand off and delete your emplacements one by one.',
      'Kill the launcher teams fast, or dig your guns out of the ash.',
      'Hold, and group command releases the HJ-8 crates — and something larger:',
      'LIMITED COUNTER-RAID AUTHORITY. Their firebases are on your map now.',
    ],
    objective: 'Kill the Javelin teams before they dismantle your defenses.',
    debriefVictory: [
      'AFTER ACTION — launcher crews broken before the third volley.',
      'HJ-8 posts and an engineer detachment authorized. Raise a barracks.',
      'The Front Line is yours to probe, TIDE ACTUAL.',
    ],
    debriefDefeat: ['AFTER ACTION — four hundred meters is a weapon. Respect it.'],
    waves: [
      {
        entries: [
          ...series(0, 60, 2, 'javelin', [10, 14]),
          ...series(60, 45, 4, 'guardsman', [8, 16]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'javelin', [8, 12, 16]),
          ...series(90, 45, 5, 'ranger', [6, 12, 18]),
        ],
      },
      {
        entries: [
          ...series(0, 50, 4, 'javelin', [6, 10, 14, 18]),
          ...series(120, 70, 2, 'engineer', [8, 16]),
          ...series(200, 45, 4, 'ranger', [10, 12, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 90 },
    unlocks: ['autocannon', 'engBay', 'barracks', 'frontline'],
    unlockNote: 'REQUISITION: HJ-8 POST, ENGINEERS, BARRACKS · FRONT LINE OPEN',
    reward: { supplies: 480, fuel: 90 },
    bonus: { id: 'noStructuresLost', label: 'GUNS INTACT — no structures lost' },
  },
  {
    id: 'ct5',
    index: 4,
    codename: 'ARMOR SPEARHEAD',
    briefing: [
      'EAST WIND TO TIDE — gun trucks first, then the real thing.',
      'An Abrams platoon is feeling for the beachhead\'s soft edge.',
      'Small arms are a noise complaint to that armor. Shaped charges kill it.',
      'HJ-8s forward. Mortars registered. Nothing crosses the wire on treads.',
    ],
    objective: 'Stop the armored spearhead. Shaped charges kill tanks.',
    debriefVictory: [
      'AFTER ACTION — two hulls burning at the gate, the rest withdrew.',
      'PP-87 mortar pits and MLRS ripple tasking authorized.',
    ],
    debriefDefeat: ['AFTER ACTION — armor does not negotiate with machine guns.'],
    waves: [
      {
        entries: [
          ...series(0, 55, 2, 'humvee', [10, 14]),
          ...series(70, 45, 5, 'guardsman', [6, 12, 18]),
        ],
      },
      {
        entries: [
          entry(0, 'abrams', 12),
          ...series(80, 55, 2, 'humvee', [8, 16]),
          ...series(140, 45, 4, 'ranger', [10, 14]),
        ],
      },
      {
        entries: [
          ...series(0, 100, 2, 'abrams', [10, 14]),
          ...series(70, 55, 2, 'humvee', [8, 16]),
          ...series(160, 55, 3, 'javelin', [10, 12, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 100, startingCp: 50 },
    unlocks: ['mortar', 'a10'],
    unlockNote: 'REQUISITION: PP-87 MORTAR, TYPE 89 MLRS TASKING',
    reward: { supplies: 620, fuel: 140 },
    bonus: { id: 'noStructuresLost', label: 'ARMOR STOPPED COLD — no structures lost' },
  },
  {
    id: 'ct6',
    index: 5,
    codename: 'THE TIDE BREAKS',
    briefing: [
      'EAST WIND TO TIDE — this is the counteroffensive.',
      'Everything the corridor can spare is coming to push you into the surf:',
      'Guard screens, Ranger companies, missile teams, engineers, and armor.',
      'If the beachhead holds tonight, the front stabilizes and the war changes shape.',
      'If it falls, everyone who landed here landed for nothing.',
      'Hold the sand.',
    ],
    objective: 'Break the counteroffensive. Everything they have.',
    debriefVictory: [
      'AFTER ACTION — the counteroffensive is wreckage from the wire to the ridge.',
      'EAST WIND TO ALL STATIONS: the beachhead is permanent.',
      'Saturation batteries, HQ level 3, and the vehicle park are yours.',
      'The Front Line runs both ways now. (v0.3)',
    ],
    debriefDefeat: ['AFTER ACTION — the tide broke. It cannot end on this beach.'],
    waves: [
      {
        entries: [
          ...series(0, 35, 8, 'guardsman', [4, 8, 12, 16, 20]),
          ...series(220, 50, 3, 'ranger', [10, 14]),
        ],
      },
      {
        entries: [
          ...series(0, 70, 3, 'engineer', [8, 12, 16]),
          ...series(80, 45, 4, 'ranger', [6, 12, 18]),
          ...series(220, 55, 3, 'javelin', [10, 12, 14]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'humvee', [8, 12, 16]),
          ...series(90, 35, 6, 'guardsman', [4, 6, 18, 20]),
          ...series(240, 55, 3, 'javelin', [8, 16]),
        ],
      },
      {
        entries: [
          ...series(0, 110, 2, 'abrams', [10, 14]),
          entry(170, 'humvee', 12),
          ...series(220, 45, 5, 'ranger', [6, 10, 14, 18]),
          ...series(340, 70, 2, 'engineer', [8, 16]),
          ...series(430, 120, 2, 'abrams', [12, 10]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 120, startingCp: 60 },
    unlocks: ['arty', 'cc3', 'motorpool'],
    unlockNote: 'REQUISITION: PLZ-05 SATURATION · HQ LEVEL 3 · VEHICLE PARK',
    reward: { supplies: 1100, fuel: 280 },
    bonus: { id: 'ccAbove90', label: 'THE SAND HELD — HQ above 90%' },
  },
];
