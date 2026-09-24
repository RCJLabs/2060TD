/**
 * The UI's tokens that are not layout (M30): the two faces, and the two
 * thresholds that decide what a press was.
 *
 * They lived in `ui.ts` until the DOM kit needed them too. Neither kit owns
 * them, and the DOM one must not import the canvas one it is replacing, so
 * they live here, with no Phaser in the file.
 */

/**
 * The two faces, and the split between them is the whole type system.
 *
 * DISPLAY is a condensed grotesque and carries every LABEL: a row's name, a
 * button, a tab, a heading, a masthead. It is what a comic sets its captions
 * and its shouting in, and it is where the ink direction's character comes
 * from — the mockups are set in it, and the game read like a terminal until
 * it arrived.
 *
 * MONO carries every FIGURE: costs, counts, timers, hashes, share codes, and
 * prose. A column of numbers has to line up, and a code has to be read a
 * character at a time.
 *
 * Both are inlined, so neither costs a request — see fonts.css.
 */
export const MONO_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';
export const DISPLAY_FAMILY =
  '"Barlow Condensed", ui-sans-serif, system-ui, "Arial Narrow", sans-serif';

/**
 * A label, in the display face.
 *
 * Sized UP against `mono` at the same token, because a condensed face at the
 * same pixel height reads noticeably smaller — narrower letters and a shorter
 * apparent width for the same string. The multiplier is what makes a row
 * label and the figure beside it look like the same size, which is the only
 * thing the two faces have to agree on.
 */
export const DISPLAY_SCALE = 1.22;

/** Travel (device px) past which a press counts as a drag, not a tap. */
export const DRAG_SLOP = 16;

/**
 * How long a press has to last to become a hold, in ms.
 *
 * 480 rather than the 500 most platforms use: this fires while the finger is
 * still down and is confirmed by a buzz, so the cost of being slightly eager
 * is a haptic the player did not want, while the cost of being slow is a
 * gesture that feels broken. Well clear of the ~150ms a deliberate tap takes.
 */
export const HOLD_MS = 480;
