/**
 * The "map table" palette (GDD §6.1): muted military-ops tones with sparse
 * alarm accents. Every color in the game comes from here.
 *
 * Mutable on purpose: the colorblind-safe mode swaps the hostile family at
 * boot/toggle (scenes read COLORS at draw time, so a restart repaints all).
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
};

const HOSTILE_DEFAULT = { crimson: 0xa83232, crimsonDark: 0x7c2424 };
/** Violet separates from olive on the blue channel — readable for red-green
 * color vision deficiency, where crimson-vs-olive collapses to brown. */
const HOSTILE_COLORBLIND = { crimson: 0x8a63c9, crimsonDark: 0x5a3f8c };

/** Swap the hostile color family (colorblind-safe accents). */
export function applyPalette(colorblind: boolean): void {
  Object.assign(COLORS, colorblind ? HOSTILE_COLORBLIND : HOSTILE_DEFAULT);
}

/** CSS hex string for a palette color (for text styles and DOM). */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
