import type { Doctrine, WaveModifier, WaveMods, WaveRead } from '../sim/types';

/**
 * The read of the next wave as the INTEL tab words it (M35 Phase 1).
 *
 * Every commander sees what is coming and down which lane, and what the enemy
 * has done to the wave. A Signals Station standing and working adds when each
 * group arrives and what it is going for, so a wave that burns the station
 * blinds the rest of the siege.
 */

/** Whether the read is whole: a station up, one lost in this siege, or never one. */
export type Signals = 'up' | 'down' | 'none';

export interface IntelLine {
  id: string;
  text: string;
}

const LANES = ['WEST', 'CENTRE', 'EAST'] as const;

const PURPOSES: Readonly<Record<Doctrine, string>> = {
  assault: 'THE POST',
  hunt: 'THE GUNS',
  raze: 'THE ECONOMY',
};

const percent = (x: number): number => Math.round(x * 100);

/** What each modifier does, in the numbers this wave carries. */
function modifierText(modifier: WaveModifier, mods: WaveMods | undefined): string {
  switch (modifier) {
    case 'night':
      return `NIGHT — YOUR GUNS REACH ${percent(mods?.range ?? 1)}%`;
    case 'jammed':
      return 'NET JAMMED — NO POWERS THIS WAVE';
    case 'fast': {
      const speed = percent((mods?.speed ?? 1) - 1);
      const hp = percent(1 - (mods?.hp ?? 1));
      return `FAST COLUMN — SPEED +${speed}% · HEALTH −${hp}%`;
    }
    case 'veterans':
      return 'VETERANS — FEWER, AND TOUGHER';
  }
}

export function readLines(read: WaveRead, signals: Signals, nameOf: (kind: string) => string): IntelLine[] {
  const lines: IntelLine[] = [];
  if (read.modifier) lines.push({ id: 'mod', text: modifierText(read.modifier, read.mods) });
  read.groups.forEach((g, i) => {
    const what = `${LANES[g.lane]}  ${g.count}× ${nameOf(g.kind).toUpperCase()}`;
    lines.push({
      id: `g${i}`,
      text: signals === 'up' ? `${what} · +${g.arrives}s → ${PURPOSES[g.doctrine]}` : what,
    });
  });
  if (signals === 'none') lines.push({ id: 'sig', text: 'NO SIGNALS STATION — TIMES AND TARGETS UNKNOWN' });
  if (signals === 'down') lines.push({ id: 'sig', text: 'SIGNALS DOWN — TIMES AND TARGETS UNKNOWN' });
  return lines;
}

/**
 * The read's signals, from the battle's buildings and whether the town brought
 * a station into it. A wrecked station, or one still going up, stands on the
 * board and reads nothing.
 */
export function signalsOf(
  structures: readonly { profile: { kind: string }; hp: number; inert: boolean }[],
  hadStation: boolean,
): Signals {
  if (structures.some((s) => s.profile.kind === 'radar' && s.hp > 0 && !s.inert)) return 'up';
  return hadStation ? 'down' : 'none';
}
