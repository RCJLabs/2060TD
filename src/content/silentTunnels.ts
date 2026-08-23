import type { WaveEntry } from '../sim/types';
import { entry, series } from './missions';
import type { MissionDef } from './campaign';

/**
 * SILENT TUNNELS — the North Korea campaign (v0.6). The southern front of
 * the same war: a KPA expeditionary enclave dug into Humboldt Bay under the
 * redwood coast, holding a sealift harbor while the US counteroffensive
 * comes down Highway 101.
 *
 * Same terse radio register. CHOLLIMA is expeditionary command; the player
 * is ENCLAVE ACTUAL. The doctrine is in the name: everything cheap, buried,
 * and expendable — and in the finale the Americans find a gallery of their
 * own to use, so the tunnel faction gets tunneled.
 */

const t = (col: number, row: number, atTick: number, kind: string): WaveEntry => ({
  atTick,
  kind,
  row,
  col,
});

export const SILENT_TUNNELS: MissionDef[] = [
  {
    id: 'st1',
    index: 0,
    codename: 'THE ENCLAVE',
    briefing: [
      'CHOLLIMA TO ENCLAVE ACTUAL — the sealift bought you a harbor. Keep it.',
      'American Guard units are moving down the redwood coast to look at you.',
      'Stack the rock. Site the sentry nests. Nothing we own is precious;',
      'the ground under it is. Dig.',
      'CHOLLIMA OUT.',
    ],
    objective: 'Hold the enclave through the first probe. The HQ stands or nothing does.',
    debriefVictory: [
      'AFTER ACTION — the probe walked into the sentry arcs and stayed there.',
      'Buried depots authorized. Whatever the sealift lands, put it underground.',
    ],
    debriefDefeat: ['AFTER ACTION — the enclave fell. The harbor goes back to them.'],
    waves: [{ entries: series(0, 55, 5, 'guardsman', [7, 12, 17]) }],
    siegeOverrides: { suppliesPerWave: 60, startingCp: 0 },
    unlocks: ['storageBunker'],
    unlockNote: 'REQUISITION: BURIED DEPOT',
    reward: { supplies: 250, fuel: 0 },
    bonus: { id: 'ccAbove90', label: 'THE GROUND HOLDS — HQ above 90%' },
  },
  {
    id: 'st2',
    index: 1,
    codename: 'NO MOON',
    briefing: [
      'CHOLLIMA TO ENCLAVE — Rangers move on the new moon. Tonight is the new moon.',
      'They will be inside two hundred meters before you hear them.',
      'Command Points released: your kills buy field works mid-fight.',
      'Put ambush teams where they think the gaps are. Night fights are close fights.',
    ],
    objective: 'Break two waves in the dark. Spend Command Points like ammunition.',
    debriefVictory: [
      'AFTER ACTION — the Rangers met the ambush line. The night stayed ours.',
      'Ambush teams and spider holes authorized for field deployment.',
    ],
    debriefDefeat: ['AFTER ACTION — they were through the wire before the first flare went up.'],
    waves: [
      { entries: series(0, 45, 6, 'guardsman', [5, 12, 19]) },
      {
        entries: [
          ...series(0, 38, 5, 'guardsman', [4, 9, 20]),
          ...series(180, 50, 3, 'ranger', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 70 },
    unlocks: ['depmg', 'foxhole'],
    unlockNote: 'REQUISITION: AMBUSH TEAM, SPIDER HOLE',
    reward: { supplies: 300, fuel: 0 },
    bonus: { id: 'fewWallsLost', label: 'NOTHING SEEN — lose 3 walls or fewer' },
  },
  {
    id: 'st3',
    index: 2,
    codename: 'BREACHING CHARGES',
    briefing: [
      'CHOLLIMA TO ENCLAVE — combat engineers in the assault echelon.',
      'American breach teams rate your rock barricades at thirty seconds apiece.',
      'Let them be right. Mine the lanes behind the rock — a directional mine',
      'does not care how fast the wall came down.',
      'Hold, and the fuel comes ashore: fuel caches and HQ expansion cleared.',
    ],
    objective: 'Stop the breach teams before the barricade line stops mattering.',
    debriefVictory: [
      'AFTER ACTION — breach teams neutralized in the mined lanes.',
      'Directional mines and sandbag ramparts authorized. Fuel caches inbound;',
      'tunnel complex expansion (level 2) cleared by engineering.',
    ],
    debriefDefeat: ['AFTER ACTION — thirty seconds a barricade. They kept their schedule.'],
    waves: [
      {
        entries: [
          entry(0, 'engineer', 12),
          ...series(50, 45, 6, 'guardsman', [5, 12, 19]),
        ],
      },
      {
        entries: [
          ...series(0, 80, 2, 'engineer', [8, 16]),
          ...series(100, 50, 4, 'ranger', [9, 15]),
        ],
      },
      {
        entries: [
          ...series(0, 40, 6, 'guardsman', [4, 8, 16, 20]),
          entry(180, 'engineer', 12),
          ...series(240, 55, 3, 'ranger', [7, 12, 17]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 80 },
    unlocks: ['claymore', 'hesco', 'fuelDepot', 'cc2'],
    unlockNote: 'REQUISITION: DIRECTIONAL MINE, SANDBAG RAMPART, FUEL CACHE · HQ LEVEL 2',
    reward: { supplies: 380, fuel: 60 },
    bonus: { id: 'fewWallsLost', label: 'THIRTY SECONDS DENIED — lose 3 walls or fewer' },
  },
  {
    id: 'st4',
    index: 3,
    codename: 'FIRE ON THE BLUFFS',
    briefing: [
      'CHOLLIMA TO ENCLAVE — Javelin crews on the bluffs over the bay.',
      'They will stand off and take your nests apart one launch at a time.',
      'Rock does not stop a top-attack. Killing the crew does.',
      'Hold, and the Bulsae crates come up from the harbor — with signals gear',
      'and LIMITED COUNTER-RAID AUTHORITY. Their firebases go on your map.',
    ],
    objective: 'Kill the Javelin teams before they dismantle the nest line.',
    debriefVictory: [
      'AFTER ACTION — launcher crews broken on the bluffs.',
      'Bulsae nests, the tunnel corps, and the infantry school authorized.',
      'Listening post cleared. The Front Line runs both directions, ENCLAVE.',
    ],
    debriefDefeat: ['AFTER ACTION — the nests died in order, oldest first.'],
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
          ...series(120, 70, 2, 'engineer', [8, 16]),
          ...series(200, 45, 4, 'ranger', [9, 12, 15]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 90 },
    unlocks: ['autocannon', 'engBay', 'barracks', 'frontline', 'radar'],
    unlockNote: 'REQUISITION: BULSAE NEST, TUNNEL CORPS, INFANTRY SCHOOL, SIGNALS · FRONT LINE OPEN',
    reward: { supplies: 480, fuel: 90 },
    bonus: { id: 'noStructuresLost', label: 'NESTS INTACT — no structures lost' },
  },
  {
    id: 'st5',
    index: 4,
    codename: 'UP THE 101',
    briefing: [
      'CHOLLIMA TO ENCLAVE — gun trucks on Highway 101, armor behind them.',
      'An Abrams platoon means to open the coast road the direct way.',
      'Bulsae teams answer armor. The Koksan answers everything else,',
      'from further out than they believe possible. Register the road.',
      'Nothing reaches the harbor on treads.',
    ],
    objective: 'Stop the armored push on the coast road.',
    debriefVictory: [
      'AFTER ACTION — two hulls burning on the 101, the rest withdrew.',
      'Koksan gun pits and MRL fire lanes authorized.',
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
    unlockNote: 'REQUISITION: KOKSAN PIT, MRL FIRE LANE',
    reward: { supplies: 620, fuel: 140 },
    bonus: { id: 'noStructuresLost', label: 'THE ROAD IS CLOSED — no structures lost' },
  },
  {
    id: 'st6',
    index: 5,
    codename: 'DAYLIGHT',
    briefing: [
      'CHOLLIMA TO ENCLAVE — this is the counteroffensive.',
      'Guard screens, Ranger companies, missile crews, engineers, armor —',
      'and their sappers found the seaward end of gallery three.',
      'They mean to use our own doors. Two heads INSIDE your wire, marked.',
      'Mine the exits. If the enclave holds until daylight, the southern',
      'front is permanent. Hold the ground — above and below.',
    ],
    objective: 'Break the counteroffensive. Watch the tunnel heads inside the wire.',
    debriefVictory: [
      'AFTER ACTION — the counteroffensive is wreckage from the surf to the bluffs.',
      'The teams that came up gallery three did not go back down it.',
      'CHOLLIMA TO ALL STATIONS: the enclave is permanent.',
      'KN-09 batteries, HQ level 3, and the armor cave are yours.',
      'The Front Line runs both ways now. (v0.6)',
    ],
    debriefDefeat: ['AFTER ACTION — the enclave broke at daylight. It cannot end on this shore.'],
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
        // Gallery three: Rangers surface from the captured tunnel heads.
        entries: [
          ...[0, 30, 60, 90, 120].map((at, i) => t(18, i % 2 === 0 ? 7 : 16, at, 'ranger')),
          ...series(60, 45, 4, 'guardsman', [4, 20]),
          ...series(200, 55, 2, 'javelin', [9, 15]),
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
    unlockNote: 'REQUISITION: KN-09 SALVO · HQ LEVEL 3 · ARMOR CAVE',
    reward: { supplies: 1100, fuel: 280 },
    bonus: { id: 'ccAbove90', label: 'ABOVE AND BELOW — HQ above 90%' },
    tunnels: [
      { col: 18, row: 7 },
      { col: 18, row: 16 },
    ],
  },
];
