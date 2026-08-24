/**
 * The map-table palette (GDD §6.1): a buff topographic sheet laid on a dark
 * table, with your defences drawn onto it in ink.
 *
 * The whole direction rests on one measured rule, and it is about AREA rather
 * than value alone:
 *
 *   Ground that covers area — paper, road, water, woodland — sits between
 *   L* 63 and 83. Everything you own that covers area sits between L* 21 and
 *   35. Nothing occupies the gap, which is why a silhouette reads instantly
 *   over the busiest part of the sheet.
 *
 * Ground MARKS are allowed to go darker (the index contour is L* 46), because
 * a hairline covering no area cannot compete with a filled shape. Alarm
 * accents are the deliberate exception: the tracer sits at L* 76, squarely
 * inside the ground band, and is unmissable anyway because it earns its read
 * from hue and a paper knockout rather than from lightness.
 *
 * The UI is not on the sheet. Panels, buttons and text stay dark — they are
 * the table the map is lying on, which is why `bgPanel` and `ink` did not
 * move when the board did.
 *
 * Mutable on purpose: the colorblind-safe mode swaps the hostile family at
 * boot/toggle (scenes read COLORS at draw time, so a restart repaints all).
 */
export const COLORS = {
  // ---- the sheet ----------------------------------------------------------
  /** Sheet ground. Everything else is measured against it. L* 83. */
  bgField: 0xd9cdb4,
  /** A shade up from the paper: knockout halos and the inside of a gate. */
  paperWarm: 0xe2d8c2,
  /** Every 10 m, hairline. L* 57. */
  contour: 0xa88253,
  /** Every 50 m, heavier, carries its figure. Dark, but a hairline. L* 46. */
  contourIndex: 0x8a6538,
  /** Watercourse. Lightened and desaturated after the first pass shouted. */
  water: 0x93aaba,
  /** The bank line under the water ribbon. */
  waterDeep: 0x6e8c9e,
  /** Woodland tint, laid at low alpha over the paper. */
  wood: 0x8ca06a,
  /** Canopy stipple, scattered inside the wood mask. */
  woodEdge: 0x6f8050,
  /** Road casing — the brightest thing on the ground, and still not an accent. */
  roadCase: 0xf0eadb,
  /** Road fill. */
  roadFill: 0xc9bfa6,
  /** Kilometre grid. Present, never counted. */
  gridLine: 0x7c7a6e,
  /** Marginalia: sheet name, scale bar, grid references, contour figures. */
  marg: 0x5a5346,

  // ---- what you own -------------------------------------------------------
  /** Structure ink. The darkest thing on the board. L* 21. */
  oliveDark: 0x2e3626,
  /** Structure ink, one step up — panels and detail inside a silhouette. */
  olive: 0x3e4a32,
  /** Wall line. */
  sandDark: 0x39422f,
  /** Hesco: the lightest thing you own, and still darker than any ground. L* 35. */
  sand: 0x4b563c,
  /** Neutral machinery. */
  steel: 0x4a5560,

  // ---- the other side -----------------------------------------------------
  crimson: 0x7a2b24,
  crimsonDark: 0x5a1e19,

  // ---- accents, and the table the sheet lies on ---------------------------
  alarm: 0xc0392b,
  signal: 0xd35400,
  intel: 0x4a7fa5,
  tracer: 0xe8b44a,
  tracerKinetic: 0xffe28a,
  tracerExplosive: 0xff9a5c,
  /** UI panel ground. Not on the sheet — this is the table. */
  bgPanel: 0x20241f,
  /** UI text, on those dark panels. */
  ink: 0xd8d5c7,
  inkDim: 0x8a8878,

  // ---- faction cameos -----------------------------------------------------
  nkSlate: 0x4a535c,
  ruRust: 0x6b4520,
  unBlue: 0x3f6bab,
};

const HOSTILE_DEFAULT = { crimson: 0x7a2b24, crimsonDark: 0x5a1e19 };
/** Violet separates from olive on the blue channel — readable for red-green
 * color vision deficiency, where crimson-vs-olive collapses to brown. */
const HOSTILE_COLORBLIND = { crimson: 0x5b3d86, crimsonDark: 0x3f2a5e };

/** Swap the hostile color family (colorblind-safe accents). */
export function applyPalette(colorblind: boolean): void {
  Object.assign(COLORS, colorblind ? HOSTILE_COLORBLIND : HOSTILE_DEFAULT);
}

/** CSS hex string for a palette color (for text styles and DOM). */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
