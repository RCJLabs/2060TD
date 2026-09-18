/**
 * The ink palette (GDD 6.1): a black-and-white graphic novel page, shaded
 * with screentone, with exactly one colour on it.
 *
 * This replaces the buff topographic sheet of v1.19. That direction used hue
 * to carry meaning — green woodland, blue water, olive structures, crimson
 * hostiles — and spent its whole value budget doing it, which is why the
 * silhouettes needed a paper knockout to survive being drawn on top of it.
 *
 * The ink direction spends nothing on hue and gets a far bigger separation
 * for it. There are five values and one accent:
 *
 *   PAPER   #ffffff   the ground, and everything you own
 *   TONE    a dot screen, four densities, laid ON the paper (see tone.ts)
 *   INK     #111111   every line, and everything hostile, filled solid
 *   INK 2   #4a4a4a   secondary copy; still ink, never grey
 *   GREY    #9e9e9e   disabled, and nothing else
 *   ALARM   #e0243c   three or four marks a screen, never decoration
 *
 * The rule that makes it read, and it is about AREA rather than value:
 *
 *   Ground covers area and is never darker than a tone screen, so it is
 *   always at least 60% paper by area. Anything hostile covers area and is
 *   SOLID INK. Anything you own covers area and is BARE PAPER inside an ink
 *   keyline. Nothing on the board is a mid grey, so nothing on the board is
 *   ambiguous, and a phone at 40% brightness in sunlight loses none of it.
 *
* One grey is reserved. `disabled` means "you cannot do this", appears
 * nowhere on the board, and is used for nothing else — which is why a
 * disabled row is legible as disabled without reading a word of it.
 *
 * The UI is ON the page now, not beside it. v1.19 kept panels dark because
 * the board was paper and the UI was "the table it was lying on"; a comic
 * has no table, so `bgPanel` is paper and `ink` is ink, and the rail is
 * drawn as panels at the same line weight as the board.
 *
 * Mutable on purpose: the colorblind-safe mode swaps the accent at
 * boot/toggle (scenes read COLORS at draw time, so a restart repaints all).
 */
export const COLORS = {
  // ---- the page -----------------------------------------------------------
  /** The paper. Everything else is measured against it. */
  bgField: 0xffffff,
  /** Knockout: the inside of a gate, the halo behind a figure on tone. */
  paperWarm: 0xffffff,
  /** Every 10 m, hairline. Ink, but a hairline covers no area. */
  contour: 0x111111,
  /** Every 50 m, heavier, carries its figure. */
  contourIndex: 0x111111,
  /** Watercourse. Drawn as a cross-hatch screen; this is its bank line. */
  water: 0x111111,
  waterDeep: 0x111111,
  /** Woodland. Drawn as a diagonal hatch screen; this is its edge. */
  wood: 0x111111,
  woodEdge: 0x111111,
  /** Road casing — the line that keeps bare paper from bleeding into tone. */
  roadCase: 0x111111,
  /** Road fill. The fastest ground there is, and the brightest. */
  roadFill: 0xffffff,
  /** Kilometre grid. Present, never counted. */
  gridLine: 0x111111,
  /** Marginalia: sheet name, scale bar, grid references, contour figures. */
  marg: 0x111111,

  // ---- what you own -------------------------------------------------------
  /**
   * Structure ink. This is the KEYLINE, not the fill: a building of yours is
   * bare paper with this drawn round it. See `glyphs.ts`.
   */
  oliveDark: 0x111111,
  /** Detail inside a silhouette — a roof panel, a hatch. Light tone. */
  olive: 0xc9c9c9,
  /** Wall line. */
  sandDark: 0x111111,
  /** Hesco fill. Still paper-side of the divide. */
  sand: 0xc9c9c9,
  /** Neutral machinery. */
  steel: 0xc9c9c9,

  // ---- the other side -----------------------------------------------------
  /**
   * Hostile. Solid ink, filled — the darkest thing on the page and the only
   * thing besides a keyline allowed to be. It used to be crimson, and the
   * name survives the direction change because forty call sites read it.
   */
  crimson: 0x111111,
  crimsonDark: 0x111111,

  // ---- the one colour -----------------------------------------------------
  alarm: 0xe0243c,
  signal: 0xe0243c,
  intel: 0x111111,
  tracer: 0xe0243c,
  tracerKinetic: 0x111111,
  tracerExplosive: 0xe0243c,

  // ---- the page, again: the UI is drawn on it -----------------------------
  /** Panel ground. Paper, because the rail is a panel on the same page. */
  bgPanel: 0xffffff,
  /** A control's resting face: buttons, panel rows, the tab bar. */
  bgControl: 0xffffff,
  /** UI text. */
  ink: 0x111111,
  /**
   * Secondary INK — body copy, captions, marginalia. Still reads as ink, not
   * as grey: hierarchy on a printed page comes from size and weight, and a
   * second value this close to the first is all the help it needs.
   */
  inkDim: 0x4a4a4a,
  /**
   * "You cannot do this", and nothing else.
   *
   * The one value in the whole system with a single job. It is lighter than
   * any ink and heavier than any tone, it never appears on the board, and it
   * is why a disabled row reads as disabled before a word of it is read. Do
   * not reach for it because something wants to be quieter — that is `inkDim`.
   */
  disabled: 0x9e9e9e,

  // ---- faction cameos -----------------------------------------------------
  // Three tokens that used to be hues — slate, rust and blue — carrying the
  // few marks a faction owns outright. They are ink now, with one exception:
  // a medic's cross is the most recognisable icon in the game, it belongs to
  // one roster, and it is the one persistent mark that earns the accent.
  nkSlate: 0x111111,
  ruRust: 0x111111,
  unBlue: 0xe0243c,
};

const ACCENT_DEFAULT = { alarm: 0xe0243c, signal: 0xe0243c, tracer: 0xe0243c, tracerExplosive: 0xe0243c };
/**
 * The ink direction is very nearly colorblind-safe by construction: the whole
 * board is black, white and a dot screen, and the ONE hue is a mark rather
 * than a fill. The toggle still earns its place, because a deuteranope
 * reading that mark against ink on paper has only luminance to go on. Blue
 * separates from both ends of the page on a channel every deficiency keeps.
 */
const ACCENT_COLORBLIND = { alarm: 0x1b6ec2, signal: 0x1b6ec2, tracer: 0x1b6ec2, tracerExplosive: 0x1b6ec2 };

/** Swap the accent (colorblind-safe mode). */
export function applyPalette(colorblind: boolean): void {
  Object.assign(COLORS, colorblind ? ACCENT_COLORBLIND : ACCENT_DEFAULT);
}

/** CSS hex string for a palette color (for text styles and DOM). */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
