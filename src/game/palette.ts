/**
 * The "map table" palette (GDD §6.1): muted military-ops tones with sparse
 * alarm accents. Every color in the game comes from here.
 */
export const COLORS = {
  bgField: 0x171a17,
  bgPanel: 0x20241f,
  gridLine: 0x262b24,
  olive: 0x6b7f43,
  oliveDark: 0x4a5a33,
  sand: 0xc2b280,
  sandDark: 0x8a7f5c,
  steel: 0x7d8a8f,
  alarm: 0xc0392b,
  signal: 0xd35400,
  intel: 0x4a7fa5,
  ink: 0xd8d5c7,
  inkDim: 0x8a8878,
  tracer: 0xf5e6a8,
  tracerKinetic: 0xffe28a,
  tracerExplosive: 0xff9a5c,
  crimson: 0xa83232,
  crimsonDark: 0x7c2424,
  nkSlate: 0x5c6670,
  ruRust: 0x8c5a2b,
} as const;

/** CSS hex string for a palette color (for text styles and DOM). */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
