import type { SiegeDef, WaveDef, WaveEntry } from '../sim/types';
import { entry, series } from './missions';

/**
 * OPERATION LANDFALL — the USA defense campaign (M3, v0.1).
 *
 * Nine missions fought on the player's persistent base. Tutorialization is
 * the mission design itself: each mission headlines one threat and the
 * victory requisition unlocks the tool that answers the next one.
 *
 * Tone per GDD §6.3: terse radio logs. CASCADE is corps command; the player
 * is COOS BAY ACTUAL.
 */

export type BonusId = 'noStructuresLost' | 'ccAbove90' | 'fewWallsLost';

export interface MissionDef {
  id: string;
  index: number;
  codename: string;
  briefing: string[];
  objective: string;
  debriefVictory: string[];
  debriefDefeat: string[];
  waves: WaveDef[];
  siegeOverrides?: Partial<Omit<SiegeDef, 'waves' | 'name'>>;
  /** Content keys granted on first victory. */
  unlocks: string[];
  unlockNote?: string;
  reward: { supplies: number; fuel: number };
  bonus?: { id: BonusId; label: string };
  /** Tunnel mouths: rendered, reserved, and used by col-spawning entries. */
  tunnels?: { col: number; row: number }[];
}

/** Kinds available from the first minute of a new campaign. */
export const BASELINE_UNLOCKS = ['wall', 'supplyDepot', 'm2nest'];

/** Every progression-gated content key, in campaign order. */
export const ALL_UNLOCK_KEYS = [
  'storageBunker',
  'depmg',
  'foxhole',
  'claymore',
  'hesco',
  'fuelDepot',
  'cc2',
  'autocannon',
  'engBay',
  'barracks',
  'frontline',
  'radar',
  'mortar',
  'a10',
  'arty',
  'cc3',
  'motorpool',
];

const t = (col: number, row: number, atTick: number, kind: string): WaveEntry => ({
  atTick,
  kind,
  row,
  col,
});

export const CAMPAIGN: MissionDef[] = [
  {
    id: 'm1',
    index: 0,
    codename: 'DIG IN',
    briefing: [
      'CASCADE TO COOS BAY ACTUAL — FLASH.',
      'PLA elements ashore at three points south of you.',
      'Your position is now the only supply corridor on Highway 101.',
      'Scouts report a probing force moving up the coast road. Militia. Light.',
      'Wall the approach. Put guns on it. Do not lose the Command Center.',
      'CASCADE OUT.',
    ],
    objective: 'Survive the probe. Keep the Command Center standing.',
    debriefVictory: [
      'AFTER ACTION — the probe broke against the wire.',
      'CASCADE sends regards and a requisition column: storage bunkers authorized.',
      'They will come back with more. Bank everything.',
    ],
    debriefDefeat: [
      'AFTER ACTION — the Command Center burned. Survivors fell back inland.',
      'Rebuild. The corridor is still ours to lose.',
    ],
    waves: [{ entries: series(0, 50, 6, 'militia', [8, 12, 16]) }],
    siegeOverrides: { suppliesPerWave: 60, startingCp: 0 },
    unlocks: ['storageBunker'],
    unlockNote: 'REQUISITION: STORAGE BUNKER',
    reward: { supplies: 250, fuel: 0 },
    bonus: { id: 'ccAbove90', label: 'FLAWLESS PERIMETER — CC above 90%' },
  },
  {
    id: 'm2',
    index: 1,
    codename: 'FIRST BLOOD',
    briefing: [
      'CASCADE TO COOS BAY — regulars this time.',
      'PLA rifle squads behind a militia screen. They will absorb your fire',
      'and walk through the gaps. Your emplacements alone will not hold forever.',
      'Command Points authorized: kills fund field works mid-fight.',
      'Spend them. Hoarding CP is how positions fall.',
    ],
    objective: 'Break two waves. Learn to spend Command Points.',
    debriefVictory: [
      'AFTER ACTION — line held. Riflemen died on the wire like everyone else.',
      'Deployable MGs and rifle foxholes authorized for field deployment.',
    ],
    debriefDefeat: ['AFTER ACTION — position overrun. CASCADE notes the corridor held elsewhere. Barely.'],
    waves: [
      { entries: series(0, 40, 8, 'militia', [6, 12, 18]) },
      {
        entries: [
          ...series(0, 36, 6, 'militia', [4, 10, 20]),
          ...series(200, 45, 3, 'rifle', [10, 12, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 70 },
    unlocks: ['depmg', 'foxhole'],
    unlockNote: 'REQUISITION: DEPLOYABLE MG, RIFLE FOXHOLE',
    reward: { supplies: 300, fuel: 0 },
    bonus: { id: 'fewWallsLost', label: 'HOLD THE WIRE — lose 3 walls or fewer' },
  },
  {
    id: 'm3',
    index: 2,
    codename: 'THE BREACH',
    briefing: [
      'CASCADE TO COOS BAY — intercepted traffic says "engineers forward."',
      'Sapper teams. They do not walk around walls. They walk through them.',
      'Your maze buys time only while it costs them more than a satchel charge.',
      'Cover every wall they will want with a gun that shoots back.',
    ],
    objective: 'Stop the sappers before the maze stops mattering.',
    debriefVictory: [
      'AFTER ACTION — breach teams neutralized in the kill zones.',
      'Claymore fields and HESCO barricades authorized. Mine the gaps you leave.',
    ],
    debriefDefeat: ['AFTER ACTION — they came through the wall, not around it. Adjust.'],
    waves: [
      {
        entries: [
          entry(0, 'sapper', 12),
          ...series(40, 36, 8, 'militia', [6, 12, 18]),
        ],
      },
      {
        entries: [
          ...series(0, 70, 3, 'sapper', [6, 12, 18]),
          ...series(120, 45, 4, 'rifle', [10, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 80 },
    unlocks: ['claymore', 'hesco'],
    unlockNote: 'REQUISITION: CLAYMORE FIELD, HESCO BARRICADE',
    reward: { supplies: 350, fuel: 0 },
    bonus: { id: 'fewWallsLost', label: 'HOLD THE MAZE — lose 3 walls or fewer' },
  },
  {
    id: 'm4',
    index: 3,
    codename: 'CONVOY',
    briefing: [
      'CASCADE TO COOS BAY — a fuel convoy is sheltering inside your wire',
      'until the coast road clears. Every structure standing at end of action',
      'is fuel that reaches the front.',
      'The PLA knows it is there. Expect three pushes.',
      'Nothing gets razed tonight. Nothing.',
    ],
    objective: 'Three waves. Every structure survives, or the fuel burns.',
    debriefVictory: [
      'AFTER ACTION — convoy rolling south at dawn.',
      'They left tankers, pumps, and a promise: fuel depots authorized.',
      'Command Center expansion (level 2) cleared by CASCADE engineering.',
    ],
    debriefDefeat: ['AFTER ACTION — the fuel burned for six hours. The front felt it in a week.'],
    waves: [
      { entries: series(0, 36, 10, 'militia', [4, 8, 16, 20]) },
      {
        entries: [
          ...series(0, 45, 5, 'rifle', [8, 12, 16]),
          ...series(140, 70, 2, 'sapper', [6, 18]),
        ],
      },
      {
        entries: [
          ...series(0, 30, 12, 'militia', [4, 6, 18, 20]),
          ...series(220, 45, 4, 'rifle', [10, 14]),
        ],
      },
    ],
    unlocks: ['fuelDepot', 'cc2'],
    unlockNote: 'REQUISITION: FUEL DEPOT · CC LEVEL 2 CLEARED',
    reward: { supplies: 400, fuel: 60 },
    bonus: { id: 'noStructuresLost', label: 'EVERY TRUCK HOME — no structures lost' },
  },
  {
    id: 'm5',
    index: 4,
    codename: 'SUPPRESSION',
    briefing: [
      'CASCADE TO COOS BAY — grenadier platoons in the treeline.',
      'They stand off and shell whatever shoots. Your field works are the target.',
      'Kill them fast or watch your guns come apart one launcher at a time.',
      'Requisition board says impress them and the 25mm crates ship tonight.',
    ],
    objective: 'Kill the grenadiers before they dismantle your defenses.',
    debriefVictory: [
      'AFTER ACTION — launcher teams broken in the open.',
      '25mm autocannons and an engineering bay authorized. Build faster. Hit harder.',
      'And one more thing: CASCADE grants LIMITED COUNTER-RAID AUTHORITY.',
      'Raise a barracks. The Front Line is yours to probe.',
    ],
    debriefDefeat: ['AFTER ACTION — they took the guns apart from four hundred meters. Range matters.'],
    waves: [
      {
        entries: [
          ...series(0, 60, 2, 'grenadier', [10, 14]),
          ...series(60, 45, 4, 'rifle', [8, 16]),
        ],
      },
      {
        entries: [
          ...series(0, 50, 4, 'grenadier', [8, 12, 16]),
          ...series(100, 30, 10, 'militia', [4, 6, 18, 20]),
        ],
      },
      {
        entries: [
          ...series(0, 45, 5, 'grenadier', [6, 10, 14, 18]),
          ...series(120, 60, 3, 'sapper', [8, 12, 16]),
          ...series(200, 40, 6, 'rifle', [10, 12, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 90 },
    unlocks: ['autocannon', 'engBay', 'barracks', 'frontline', 'radar'],
    unlockNote: 'REQUISITION: 25MM AC, ENG BAY, BARRACKS, SIGNALS · FRONT LINE OPEN',
    reward: { supplies: 500, fuel: 80 },
    bonus: { id: 'noStructuresLost', label: 'GUNS INTACT — no structures lost' },
  },
  {
    id: 'm6',
    index: 5,
    codename: 'INFILTRATION',
    briefing: [
      'CASCADE TO COOS BAY — FLASH FLASH FLASH.',
      'Seismic teams flag digging under your grid square. Korean People\'s Army',
      'special operations. They do not use the front door.',
      'Two suspected tunnel heads INSIDE your perimeter. Marked on your map.',
      'You cannot build on them. You can surround them.',
    ],
    objective: 'Hold against attacks from inside the wire.',
    debriefVictory: [
      'AFTER ACTION — tunnels collapsed with thermite. The teams that surfaced did not go back.',
      'Mortar pits and A-10 tasking authorized. The sky is yours to spend.',
    ],
    debriefDefeat: ['AFTER ACTION — they were behind the guns before the sirens. Refuse the interior.'],
    waves: [
      { entries: series(0, 40, 8, 'militia', [6, 12, 18]) },
      {
        entries: [
          ...[0, 30, 60, 90, 120, 150].map((at, i) =>
            t(i % 2 === 0 ? 18 : 18, i % 2 === 0 ? 7 : 16, at, 'infiltrator'),
          ),
          ...series(60, 40, 4, 'militia', [8, 16]),
        ],
      },
      {
        entries: [
          ...[0, 25, 50, 75, 100, 125, 150, 175].map((at, i) =>
            t(18, i % 2 === 0 ? 7 : 16, at, 'infiltrator'),
          ),
          ...series(80, 70, 2, 'sapper', [10, 14]),
          ...series(160, 45, 4, 'rifle', [8, 12, 16]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 95 },
    unlocks: ['mortar', 'a10'],
    unlockNote: 'REQUISITION: 120MM MORTAR PIT, A-10 TASKING',
    reward: { supplies: 550, fuel: 100 },
    bonus: { id: 'ccAbove90', label: 'NOTHING GOT THROUGH — CC above 90%' },
    tunnels: [
      { col: 18, row: 7 },
      { col: 18, row: 16 },
    ],
  },
  {
    id: 'm7',
    index: 6,
    codename: 'ARMOR PROBE',
    briefing: [
      'CASCADE TO COOS BAY — Russian Pacific elements ashore to your north.',
      'A T-72 detachment is feeling for the corridor\'s soft edge. That is you.',
      'Small arms will not scratch them. Kinetic guns, mines under the treads,',
      'and every A-10 pass you stocked.',
      'Stop the armor here or meet it at the Command Center.',
    ],
    objective: 'Stop the armored probe. Kinetic weapons kill tanks.',
    debriefVictory: [
      'AFTER ACTION — hulls burning in the kill zone. The detachment withdrew north.',
      '155mm fire missions authorized. CC level 3 expansion cleared.',
    ],
    debriefDefeat: ['AFTER ACTION — armor walked through the perimeter like weather. Rearm and dig.'],
    waves: [
      {
        entries: [
          ...series(0, 50, 2, 'zbd', [10, 14]),
          ...series(80, 40, 6, 'rifle', [8, 12, 16]),
        ],
      },
      {
        entries: [
          entry(0, 't72', 12),
          ...series(60, 50, 2, 'zbd', [8, 16]),
          ...series(120, 30, 8, 'militia', [4, 6, 18, 20]),
        ],
      },
      {
        entries: [
          ...series(0, 90, 2, 't72', [10, 14]),
          ...series(60, 50, 3, 'zbd', [8, 12, 16]),
          ...series(160, 50, 3, 'grenadier', [10, 12, 14]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 100, startingCp: 50 },
    unlocks: ['arty', 'cc3', 'motorpool'],
    unlockNote: 'REQUISITION: 155MM MISSION, MOTOR POOL · CC LEVEL 3 CLEARED',
    reward: { supplies: 700, fuel: 150 },
    bonus: { id: 'noStructuresLost', label: 'ARMOR STOPPED COLD — no structures lost' },
  },
  {
    id: 'm8',
    index: 7,
    codename: 'THE LONG NIGHT',
    briefing: [
      'CASCADE TO COOS BAY — everything moved at dusk.',
      'Six pushes on the board. Militia, engineers, launchers, armor, and',
      'a Type 99 signature at the back of the column.',
      'No relief until dawn. Short prep windows. Ration the ordnance.',
      'Hold.',
    ],
    objective: 'Survive six waves. Dawn is the relief.',
    debriefVictory: [
      'AFTER ACTION — dawn came anyway.',
      'CASCADE is calling Coos Bay "the anvil" on the nets now. Resupply inbound.',
    ],
    debriefDefeat: ['AFTER ACTION — the night was longer than the ammunition.'],
    waves: [
      { entries: series(0, 32, 10, 'militia', [4, 8, 12, 16, 20]) },
      {
        entries: [
          ...series(0, 45, 6, 'rifle', [8, 12, 16]),
          ...series(140, 70, 2, 'sapper', [6, 18]),
        ],
      },
      {
        entries: [
          ...series(0, 50, 4, 'grenadier', [8, 12, 16]),
          ...series(80, 30, 8, 'militia', [4, 6, 18, 20]),
        ],
      },
      {
        entries: [
          ...series(0, 60, 2, 'zbd', [10, 14]),
          ...series(60, 40, 6, 'rifle', [8, 12, 16]),
          ...series(160, 35, 6, 'infiltrator', [4, 20]),
        ],
      },
      {
        entries: [
          entry(0, 't72', 12),
          ...series(60, 55, 2, 'zbd', [8, 16]),
          ...series(120, 50, 4, 'grenadier', [6, 10, 14, 18]),
        ],
      },
      {
        entries: [
          entry(0, 'type99', 12),
          ...series(80, 55, 2, 'zbd', [8, 16]),
          ...series(140, 40, 8, 'rifle', [6, 10, 14, 18]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 110, prepSeconds: 18 },
    unlocks: [],
    reward: { supplies: 900, fuel: 200 },
    bonus: { id: 'ccAbove90', label: 'DAWN CAME ANYWAY — CC above 90%' },
  },
  {
    id: 'm9',
    index: 8,
    codename: 'LANDFALL',
    briefing: [
      'CASCADE TO COOS BAY — this is the one.',
      'The PLA is done probing. A combined assault force is forming south of',
      'you: armor, engineers, launchers, and two Type 99s under coalition flags.',
      'If Coos Bay holds, the corridor holds, and the counterattack has a road.',
      'If it falls, the coast falls with it.',
      'Not one step back.',
    ],
    objective: 'Break the landfall assault. Everything they have.',
    debriefVictory: [
      'AFTER ACTION — the assault force is wreckage from the wire to the treeline.',
      'CASCADE TO ALL STATIONS: the corridor is secure. Counterattack order is cut.',
      'COOS BAY ACTUAL — you are going on the offensive. (v0.2)',
    ],
    debriefDefeat: ['AFTER ACTION — the line broke at the water\'s edge. It cannot end here.'],
    waves: [
      {
        entries: [
          ...series(0, 28, 12, 'militia', [4, 8, 12, 16, 20]),
          ...series(200, 45, 4, 'rifle', [10, 14]),
        ],
      },
      {
        entries: [
          ...series(0, 65, 3, 'sapper', [8, 12, 16]),
          ...series(60, 40, 6, 'rifle', [6, 12, 18]),
          ...series(200, 50, 3, 'grenadier', [10, 12, 14]),
        ],
      },
      {
        entries: [
          ...series(0, 55, 3, 'zbd', [8, 12, 16]),
          ...series(80, 28, 10, 'militia', [4, 6, 18, 20]),
          ...series(240, 50, 4, 'grenadier', [8, 16]),
        ],
      },
      {
        entries: [
          ...series(0, 90, 2, 't72', [10, 14]),
          ...series(60, 55, 2, 'zbd', [8, 16]),
          ...series(140, 40, 6, 'rifle', [6, 12, 18]),
        ],
      },
      {
        entries: [
          ...series(0, 100, 2, 'type99', [10, 14]),
          entry(160, 't72', 12),
          ...series(200, 55, 3, 'zbd', [8, 12, 16]),
          ...series(300, 45, 4, 'grenadier', [6, 10, 14, 18]),
          ...series(380, 60, 4, 'sapper', [8, 12, 16, 20]),
        ],
      },
    ],
    siegeOverrides: { suppliesPerWave: 120, startingCp: 60 },
    unlocks: [],
    reward: { supplies: 1200, fuel: 300 },
    bonus: { id: 'noStructuresLost', label: 'NOT ONE STEP BACK — no structures lost' },
  },
];

// ---- difficulty & assembly ---------------------------------------------------------

export type Difficulty = 'standard' | 'hard';

/** Hard mode: +30% of each kind per wave, appended after the wave's tail. */
export function scaleWaves(waves: WaveDef[], mult: number): WaveDef[] {
  if (mult <= 1) return waves;
  return waves.map((wave) => {
    const byKind = new Map<string, WaveEntry[]>();
    for (const e of wave.entries) {
      const list = byKind.get(e.kind) ?? [];
      list.push(e);
      byKind.set(e.kind, list);
    }
    const extras: WaveEntry[] = [];
    const lastTick = Math.max(...wave.entries.map((e) => e.atTick));
    for (const [kind, list] of byKind) {
      const extra = Math.round(list.length * mult) - list.length;
      for (let i = 0; i < extra; i++) {
        const template = list[i % list.length]!;
        extras.push({
          atTick: lastTick + 60 + i * 30,
          kind,
          row: template.row,
          ...(template.col !== undefined ? { col: template.col } : {}),
        });
      }
    }
    return { entries: [...wave.entries, ...extras] };
  });
}

/** The playable siege definition for a mission at a difficulty. */
export function missionSiege(mission: MissionDef, difficulty: Difficulty): SiegeDef {
  return {
    name: `M${mission.index + 1} — ${mission.codename}`,
    startingSupplies: 0, // substituted with the town stockpile at launch
    suppliesPerWave: 90,
    startingCp: 40,
    cpCap: 150,
    cpPerSecond: 1.2,
    prepSeconds: 25,
    repairCostPerHp: 0.04,
    ...mission.siegeOverrides,
    waves: difficulty === 'hard' ? scaleWaves(mission.waves, 1.3) : mission.waves,
  };
}

/** Bonus objective evaluation against the battle outcome. */
export function bonusMet(
  id: BonusId,
  outcome: { stats: { structuresLost: number; wallsLost: number }; ccHpFraction: number },
): boolean {
  switch (id) {
    case 'noStructuresLost':
      return outcome.stats.structuresLost === 0;
    case 'ccAbove90':
      return outcome.ccHpFraction >= 0.9;
    case 'fewWallsLost':
      return outcome.stats.wallsLost <= 3;
  }
}
