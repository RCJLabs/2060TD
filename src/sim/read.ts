import type { WaveEntry, WaveModifier, WaveMods } from './types';

/**
 * The read of a wave (M35 Phase 1): the name of what the enemy did to it, and
 * the lanes of the entry edge it comes in on. The engine reads a wave with
 * these, and the scene marks the board with the same lanes.
 */

export type { WaveModifier };

/**
 * Which third of an entry edge `along` cells long a cell lies in, west to
 * east (or north to south on a western edge). By the cell's middle, so a
 * ten-cell edge splits three, four and three.
 */
export function laneAlong(along: number, span: number): 0 | 1 | 2 {
  return Math.min(2, Math.floor(((along + 0.5) * 3) / span)) as 0 | 1 | 2;
}

/**
 * The modifier a wave carries, if any (M35 Phase 1). The sim never reads the
 * name: it reads a wave's `mods` and each entry's `vet`. The name is what the
 * read of the wave shows, found from what the wave carries so that a replayed
 * wave reads exactly as the one that was fought. A composed wave carries one
 * modifier at most; this names the first it finds.
 */
export function waveModifierOf(wave: {
  entries: readonly WaveEntry[];
  mods?: WaveMods | undefined;
}): WaveModifier | undefined {
  const mods = wave.mods;
  if (mods?.range !== undefined) return 'night';
  if (mods?.jammed) return 'jammed';
  if (mods?.speed !== undefined || mods?.hp !== undefined) return 'fast';
  if (wave.entries.some((e) => (e.vet ?? 1) > 1)) return 'veterans';
  return undefined;
}
