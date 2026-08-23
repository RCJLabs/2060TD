import { entry, series } from './missions';
import type { MissionDef } from './campaign';

/**
 * BLUE LINE — the UN Coalition campaign (v0.7). The same war, seen from
 * the mandate: a multinational brigade holds the Tacoma evacuation
 * corridor — the port, the rail spur, and the last open miles of I-5 —
 * while the PLA push comes north and the civilians go the other way.
 *
 * Same terse radio register. AEGIS is UN theater command; the player is
 * CORRIDOR ACTUAL. The doctrine is in the kit: nothing here is the best
 * gun on the coast, and nothing that falls stays down.
 */
export const BLUE_LINE: MissionDef[] = [
  {
    id: 'bl1',
    index: 0,
    codename: 'THE CORRIDOR',
    briefing: [
      'AEGIS TO CORRIDOR ACTUAL — the evacuation runs while the corridor runs.',
      'PLA militia are probing the Tacoma perimeter to see who answers.',
      'You answer. Norwegian engineers pour the T-walls; put MG posts on them.',
      'Twelve nations are holding this line. Hold it like all twelve are watching.',
      'AEGIS OUT.',
    ],
    objective: 'Hold the corridor through the first probe. The command post stands or nothing does.',
    debriefVictory: [
      'AFTER ACTION — the probe stopped at the wire and stayed there.',
      'Container yards authorized. What the convoys deliver, keep behind concrete.',
    ],
    debriefDefeat: ['AFTER ACTION — the corridor fell. The evacuation walks from here.'],
    waves: [{ entries: series(0, 50, 6, 'militia', [7, 12, 17]) }],
    siegeOverrides: { suppliesPerWave: 60, startingCp: 0 },
    unlocks: ['storageBunker'],
    unlockNote: 'REQUISITION: CONTAINER YARD',
    reward: { supplies: 250, fuel: 0 },
    bonus: { id: 'ccAbove90', label: 'THE MANDATE HOLDS — CP above 90%' },
  },
  {
    id: 'bl2',
    index: 1,
    codename: 'RULES OF ENGAGEMENT',
    briefing: [
      'AEGIS TO CORRIDOR — regulars behind the militia screen this time.',
      'The Security Council released your rules of engagement an hour ago:',
      'weapons free inside the wire. Command Points authorized — your kills',
      'fund field works mid-fight. Spend them; restraint is for the far side',
      'of the wall.',
    ],
    objective: 'Break two waves under the new rules. Spend Command Points like ammunition.',
    debriefVictory: [
      'AFTER ACTION — the screen broke against the sections. The corridor holds.',
      'Peacekeeper sections and engineer revetments authorized for field deployment.',
      'The revetments repair what stands near them. Build accordingly.',
    ],
    debriefDefeat: ['AFTER ACTION — they were through before the rules mattered.'],
    waves: [
      { entries: series(0, 42, 7, 'militia', [5, 12, 19]) },
      {
        entries: [
          ...series(0, 38, 5, 'militia', [4, 9, 20]),
          ...series(180, 45, 3, 'rifle', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 70 },
    unlocks: ['depmg', 'foxhole'],
    unlockNote: 'REQUISITION: PEACEKEEPER SECTION, ENGINEER REVETMENT',
    reward: { supplies: 300, fuel: 0 },
    bonus: { id: 'fewWallsLost', label: 'TWELVE FLAGS STANDING — lose 3 walls or fewer' },
  },
  {
    id: 'bl3',
    index: 2,
    codename: 'SAPPERS AT THE WIRE',
    briefing: [
      'AEGIS TO CORRIDOR — combat engineers in the assault echelon.',
      'PLA sapper teams rate your T-walls at under a minute apiece.',
      'Mine the lanes behind the concrete. A charge on a tripwire holds',
      'its sector better than a squad that blinks.',
      'Hold, and the fuel convoys roll: fuel point and HQ expansion cleared.',
    ],
    objective: 'Stop the sapper teams before the wall line stops mattering.',
    debriefVictory: [
      'AFTER ACTION — breach teams neutralized in the mined lanes.',
      'Wire & charge fields and HESCO ramparts authorized. Fuel points inbound;',
      'command post expansion (level 2) cleared by theater engineering.',
    ],
    debriefDefeat: ['AFTER ACTION — under a minute a wall. They kept their schedule.'],
    waves: [
      {
        entries: [
          entry(0, 'sapper', 12),
          ...series(50, 42, 6, 'militia', [5, 12, 19]),
        ],
      },
      {
        entries: [
          ...series(0, 80, 2, 'sapper', [8, 16]),
          ...series(100, 45, 4, 'rifle', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 38, 6, 'militia', [4, 8, 16, 20]),
          entry(180, 'sapper', 12),
          ...series(240, 50, 3, 'rifle', [7, 12, 17]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 80 },
    unlocks: ['claymore', 'hesco', 'fuelDepot', 'cc2'],
    unlockNote: 'REQUISITION: WIRE & CHARGE, HESCO RAMPART, FUEL POINT · CP LEVEL 2',
    reward: { supplies: 380, fuel: 60 },
    bonus: { id: 'fewWallsLost', label: 'THE WIRE HELD — lose 3 walls or fewer' },
  },
  {
    id: 'bl4',
    index: 3,
    codename: 'GRENADIER LINE',
    briefing: [
      'AEGIS TO CORRIDOR — grenadier companies on the ridge east of the port.',
      'They will stand off and dismantle your posts one salvo at a time.',
      'Concrete does not stop a grenade arc. Killing the crew does.',
      'Hold, and the Milan crates clear customs — with signals equipment and',
      'LIMITED COUNTER-RAID AUTHORITY. Their firebases go on your map.',
    ],
    objective: 'Kill the grenadier lines before they dismantle the posts.',
    debriefVictory: [
      'AFTER ACTION — grenadier companies broken on the ridge.',
      'Milan posts, the Engineer Corps HQ, and the multinational barracks',
      'authorized. Signals & liaison cleared. The Front Line runs both',
      'directions now, CORRIDOR.',
    ],
    debriefDefeat: ['AFTER ACTION — the posts died in order, oldest first.'],
    waves: [
      {
        entries: [
          ...series(0, 60, 2, 'grenadier', [9, 15]),
          ...series(60, 42, 4, 'militia', [7, 17]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'grenadier', [7, 12, 17]),
          ...series(90, 45, 5, 'rifle', [5, 12, 19]),
        ],
      },
      {
        entries: [
          ...series(0, 50, 4, 'grenadier', [5, 9, 15, 19]),
          ...series(120, 70, 2, 'sapper', [8, 16]),
          ...series(200, 45, 4, 'rifle', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 90 },
    unlocks: ['autocannon', 'engBay', 'barracks', 'frontline', 'radar'],
    unlockNote: 'REQUISITION: MILAN POST, ENGINEER CORPS, BARRACKS, SIGNALS · FRONT LINE OPEN',
    reward: { supplies: 480, fuel: 90 },
    bonus: { id: 'noStructuresLost', label: 'POSTS INTACT — no structures lost' },
  },
  {
    id: 'bl5',
    index: 4,
    codename: 'ARMOR ON THE FIVE',
    briefing: [
      'AEGIS TO CORRIDOR — IFVs on Interstate 5, main battle tanks behind them.',
      'A Type 99 platoon means to open the evacuation route the direct way.',
      'Milan crews answer armor. Keep the revetments close behind the posts —',
      'what their guns break, your engineers rebuild while it is still firing.',
      'Nothing reaches the port on treads.',
    ],
    objective: 'Stop the armored push on the interstate.',
    debriefVictory: [
      'AFTER ACTION — two hulls burning on the Five, the rest withdrew.',
      'AMOS mortar pits and Gripen gun passes authorized.',
    ],
    debriefDefeat: ['AFTER ACTION — the road held their weight. That was the problem.'],
    waves: [
      {
        entries: [
          ...series(0, 55, 2, 'zbd', [9, 15]),
          ...series(70, 42, 5, 'militia', [5, 12, 19]),
        ],
      },
      {
        entries: [
          entry(0, 'type99', 12),
          ...series(80, 55, 2, 'zbd', [7, 17]),
          ...series(140, 45, 4, 'rifle', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 100, 2, 'type99', [9, 15]),
          ...series(70, 55, 2, 'zbd', [7, 17]),
          ...series(160, 55, 3, 'grenadier', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 100, startingCp: 50 },
    unlocks: ['mortar', 'a10'],
    unlockNote: 'REQUISITION: AMOS PIT, GRIPEN GUN PASS',
    reward: { supplies: 620, fuel: 140 },
    bonus: { id: 'noStructuresLost', label: 'THE FIVE IS CLOSED — no structures lost' },
  },
  {
    id: 'bl6',
    index: 5,
    codename: 'THE MANDATE HOLDS',
    briefing: [
      'AEGIS TO CORRIDOR — this is the push. Everything they have, at the port.',
      'Militia screens, rifle battalions, sapper companies, grenadier lines,',
      'armor on the interstate. The last convoys sail at dawn.',
      'If the corridor holds tonight, the mandate is permanent and the coast',
      'keeps a door in it. If it falls, twelve flags come down together.',
      'Hold the line. All of it.',
    ],
    objective: 'Break the push. The last convoys are still loading.',
    debriefVictory: [
      'AFTER ACTION — the push is wreckage from the interstate to the waterline.',
      'The convoys sailed full. AEGIS TO ALL STATIONS: the mandate is permanent.',
      '105mm batteries, command post level 3, and the vehicle compound are yours.',
      'The Front Line runs both ways now. (v0.7)',
    ],
    debriefDefeat: ['AFTER ACTION — the corridor broke at dawn. The convoys sailed light.'],
    waves: [
      {
        entries: [
          ...series(0, 32, 9, 'militia', [4, 8, 12, 16, 20]),
          ...series(220, 45, 3, 'rifle', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 70, 3, 'sapper', [7, 12, 17]),
          ...series(80, 45, 4, 'rifle', [5, 12, 19]),
          ...series(220, 55, 3, 'grenadier', [9, 12, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'zbd', [7, 12, 17]),
          ...series(90, 35, 6, 'militia', [4, 6, 18, 20]),
          ...series(240, 55, 3, 'grenadier', [7, 17]),
        ],
      },
      {
        entries: [
          ...series(0, 110, 2, 'type99', [9, 15]),
          entry(170, 'zbd', 12),
          ...series(220, 45, 5, 'rifle', [5, 9, 15, 19]),
          ...series(340, 70, 2, 'sapper', [7, 17]),
          ...series(430, 120, 2, 'type99', [12, 9]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 120, startingCp: 60 },
    unlocks: ['arty', 'cc3', 'motorpool'],
    unlockNote: 'REQUISITION: 105MM BATTERY · CP LEVEL 3 · VEHICLE COMPOUND',
    reward: { supplies: 1100, fuel: 280 },
    bonus: { id: 'ccAbove90', label: 'TWELVE FLAGS AT DAWN — CP above 90%' },
  },
];
