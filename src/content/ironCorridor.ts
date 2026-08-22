import { entry, series } from './missions';
import type { MissionDef } from './campaign';

/**
 * IRON CORRIDOR — the Russia campaign (v0.5). The northern front of the same
 * war: Russian Ground Forces hold the Nome railhead — the Alaskan end of the
 * ice-road land bridge — while the US counteroffensive comes up the corridor
 * in the dark and the cold.
 *
 * Same terse radio register. URAL is army command; the player is KREPOST
 * ACTUAL — "fortress", which is also the doctrine: everything overbuilt,
 * nothing retreats.
 */
export const IRON_CORRIDOR: MissionDef[] = [
  {
    id: 'ic1',
    index: 0,
    codename: 'THE RAILHEAD',
    briefing: [
      'URAL TO KREPOST ACTUAL — the corridor lives while the railhead lives.',
      'American Guard units are feeling for you through the whiteout.',
      'Pour the concrete. Site the PKM bunkers. Let them bleed on the slabs.',
      'Winter is on our side. Nothing else out here is.',
      'URAL OUT.',
    ],
    objective: 'Hold the railhead through the first probe. The bunker stands or nothing does.',
    debriefVictory: [
      'AFTER ACTION — the probe froze where it stopped.',
      'Deep bunkers authorized. Bury everything the railhead delivers.',
    ],
    debriefDefeat: ['AFTER ACTION — the railhead fell. The corridor starves behind it.'],
    waves: [{ entries: series(0, 55, 5, 'guardsman', [7, 12, 17]) }],
    siegeOverrides: { suppliesPerWave: 60, startingCp: 0 },
    unlocks: ['storageBunker'],
    unlockNote: 'REQUISITION: DEEP BUNKER',
    reward: { supplies: 250, fuel: 0 },
    bonus: { id: 'ccAbove90', label: 'CONCRETE HOLDS — bunker above 90%' },
  },
  {
    id: 'ic2',
    index: 1,
    codename: 'WHITEOUT',
    briefing: [
      'URAL TO KREPOST — Rangers moving under the storm, small teams, good rifles.',
      'They will come out of the snow at two hundred meters.',
      'Command Points released: your kills buy field works mid-fight.',
      'Dig the trenches deep. The storm hides them; it hides you better.',
    ],
    objective: 'Break two waves in the whiteout. Spend Command Points like ammunition.',
    debriefVictory: [
      'AFTER ACTION — the storm lifted on wire and bodies.',
      'PKM teams and trench sections authorized for field deployment.',
    ],
    debriefDefeat: ['AFTER ACTION — they were inside the wire before anyone fired.'],
    waves: [
      { entries: series(0, 45, 6, 'guardsman', [5, 12, 19]) },
      {
        entries: [
          ...series(0, 40, 4, 'guardsman', [4, 9, 20]),
          ...series(170, 50, 3, 'ranger', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 70 },
    unlocks: ['depmg', 'foxhole'],
    unlockNote: 'REQUISITION: PKM TEAM, TRENCH SECTION',
    reward: { supplies: 300, fuel: 0 },
    bonus: { id: 'fewWallsLost', label: 'THE LINE HOLDS — lose 3 walls or fewer' },
  },
  {
    id: 'ic3',
    index: 2,
    codename: 'SAPPERS ON THE ICE',
    briefing: [
      'URAL TO KREPOST — combat engineers in the assault echelon.',
      'American breach teams rate your slabs at forty seconds apiece.',
      'Mine the lanes you leave open. MON-50s do not feel the cold.',
      'Hold, and the fuel trains run: POL point and bunker expansion cleared.',
    ],
    objective: 'Stop the breach teams before the slab line stops mattering.',
    debriefVictory: [
      'AFTER ACTION — breach teams neutralized at the wall line.',
      'MON-50 fields and earth berms authorized. Fuel trains inbound;',
      'command bunker expansion (level 2) cleared by army engineering.',
    ],
    debriefDefeat: ['AFTER ACTION — forty seconds a slab. They kept their schedule.'],
    waves: [
      {
        entries: [
          entry(0, 'engineer', 12),
          ...series(50, 45, 6, 'guardsman', [5, 12, 19]),
        ],
      },
      {
        entries: [
          ...series(0, 80, 2, 'engineer', [7, 17]),
          ...series(100, 50, 4, 'ranger', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 40, 6, 'guardsman', [4, 8, 16, 20]),
          entry(190, 'engineer', 12),
          ...series(250, 55, 3, 'ranger', [7, 12, 17]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 80 },
    unlocks: ['claymore', 'hesco', 'fuelDepot', 'cc2'],
    unlockNote: 'REQUISITION: MON-50 FIELD, EARTH BERM, POL POINT · BUNKER LEVEL 2',
    reward: { supplies: 380, fuel: 60 },
    bonus: { id: 'fewWallsLost', label: 'FORTY SECONDS DENIED — lose 3 walls or fewer' },
  },
  {
    id: 'ic4',
    index: 3,
    codename: 'RIDGELINE MISSILES',
    briefing: [
      'URAL TO KREPOST — Javelin crews on the Kigluaik ridge.',
      'They will stand off and dismantle your bunkers one launch at a time.',
      'Concrete does not stop a top-attack. Killing the crew does.',
      'Hold, and the 2A72 crates ship — with signals equipment and',
      'LIMITED COUNTER-RAID AUTHORITY. Their firebases go on your map.',
    ],
    objective: 'Kill the Javelin teams before they dismantle the bunker line.',
    debriefVictory: [
      'AFTER ACTION — launcher crews broken on the ridge.',
      'Cannon bunkers, engineer battalion, and conscript barracks authorized.',
      'GRU signals post cleared. The Front Line runs both directions, KREPOST.',
    ],
    debriefDefeat: ['AFTER ACTION — the bunkers died in order, oldest first.'],
    waves: [
      {
        entries: [
          ...series(0, 60, 2, 'javelin', [9, 15]),
          ...series(60, 45, 4, 'guardsman', [7, 17]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'javelin', [7, 12, 17]),
          ...series(90, 45, 5, 'ranger', [5, 12, 19]),
        ],
      },
      {
        entries: [
          ...series(0, 50, 4, 'javelin', [5, 9, 15, 19]),
          ...series(120, 70, 2, 'engineer', [7, 17]),
          ...series(200, 45, 4, 'ranger', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 90 },
    unlocks: ['autocannon', 'engBay', 'barracks', 'frontline', 'radar'],
    unlockNote: 'REQUISITION: 2A72 BUNKER, ENGINEERS, BARRACKS, SIGNALS · FRONT LINE OPEN',
    reward: { supplies: 480, fuel: 90 },
    bonus: { id: 'noStructuresLost', label: 'BUNKERS INTACT — no structures lost' },
  },
  {
    id: 'ic5',
    index: 4,
    codename: 'STEEL ON STEEL',
    briefing: [
      'URAL TO KREPOST — gun trucks probing the ice road, armor behind them.',
      'An Abrams platoon means to open the corridor the direct way.',
      'Your cannon bunkers shoot tungsten. Their armor votes last.',
      'Registered mortars on the road. Nothing reaches the railhead on treads.',
    ],
    objective: 'Stop the armored push on the ice road.',
    debriefVictory: [
      'AFTER ACTION — two hulls burning on the ice, the rest withdrew.',
      'Podnos mortar pits and Grad rocket tasking authorized.',
    ],
    debriefDefeat: ['AFTER ACTION — the road held their weight. That was the problem.'],
    waves: [
      {
        entries: [
          ...series(0, 55, 2, 'humvee', [9, 15]),
          ...series(70, 45, 5, 'guardsman', [5, 12, 19]),
        ],
      },
      {
        entries: [
          entry(0, 'abrams', 12),
          ...series(80, 55, 2, 'humvee', [7, 17]),
          ...series(140, 45, 4, 'ranger', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 100, 2, 'abrams', [9, 15]),
          ...series(70, 55, 2, 'humvee', [7, 17]),
          ...series(160, 55, 3, 'javelin', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 100, startingCp: 50 },
    unlocks: ['mortar', 'a10'],
    unlockNote: 'REQUISITION: PODNOS MORTAR, GRAD ROCKET TASKING',
    reward: { supplies: 620, fuel: 140 },
    bonus: { id: 'noStructuresLost', label: 'TUNGSTEN ANSWERS — no structures lost' },
  },
  {
    id: 'ic6',
    index: 5,
    codename: 'THE CORRIDOR HOLDS',
    briefing: [
      'URAL TO KREPOST — this is the counteroffensive.',
      'Guard screens, Ranger companies, missile crews, engineers, armor —',
      'everything the theater can spare, aimed at one railhead. Yours.',
      'If the corridor holds tonight, the northern front is permanent.',
      'If it falls, every train that ever ran here ran for nothing.',
      'Hold the concrete.',
    ],
    objective: 'Break the counteroffensive. Everything they have.',
    debriefVictory: [
      'AFTER ACTION — the counteroffensive is wreckage from the wire to the ridge.',
      'URAL TO ALL STATIONS: the corridor is permanent.',
      'Thermobaric batteries, bunker level 3, and the tank park are yours.',
      'The Front Line runs both ways now. (v0.5)',
    ],
    debriefDefeat: ['AFTER ACTION — the corridor broke. It cannot end on this ice.'],
    waves: [
      {
        entries: [
          ...series(0, 35, 8, 'guardsman', [4, 8, 12, 16, 20]),
          ...series(220, 50, 3, 'ranger', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 70, 3, 'engineer', [7, 12, 17]),
          ...series(80, 45, 4, 'ranger', [5, 12, 19]),
          ...series(220, 55, 3, 'javelin', [9, 12, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'humvee', [7, 12, 17]),
          ...series(90, 35, 6, 'guardsman', [4, 6, 18, 20]),
          ...series(240, 55, 3, 'javelin', [7, 17]),
        ],
      },
      {
        entries: [
          ...series(0, 110, 2, 'abrams', [9, 15]),
          entry(170, 'humvee', 12),
          ...series(220, 45, 5, 'ranger', [5, 9, 15, 19]),
          ...series(340, 70, 2, 'engineer', [7, 17]),
          ...series(430, 120, 2, 'abrams', [12, 9]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 120, startingCp: 60 },
    unlocks: ['arty', 'cc3', 'motorpool'],
    unlockNote: 'REQUISITION: TOS-1A SALVO · BUNKER LEVEL 3 · TANK PARK',
    reward: { supplies: 1100, fuel: 280 },
    bonus: { id: 'ccAbove90', label: 'THE CONCRETE HELD — bunker above 90%' },
  },
];
