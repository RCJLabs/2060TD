import type { Ink } from './ink';
import type { DrawerState, Layout } from './layout';

/**
 * What a panel is made of, whichever kit draws it (M30).
 *
 * These lived in `ui.ts` with the canvas `Panel`. The DOM panel draws the same
 * rows from the same data, and must not import the kit it is replacing, so the
 * shapes live here and both kits read them. No Phaser in the file: a row's
 * icon draws with `Ink`, and a row picked up and carried onto the board hands
 * over a `CarryPointer`, both of which a Phaser object satisfies as it stands.
 */

/**
 * A press, as the board needs it to take over a carry (v1.29): where the
 * finger is in device px, whether it is still down, and which press it is.
 *
 * A Phaser pointer is one. A DOM press is not, and a touch that starts on a
 * DOM row belongs to that row — the board never hears it move. So a DOM carry
 * hands over one of these with `follow`, and the board subscribes to it
 * rather than to Phaser's input events.
 */
export interface CarryPointer {
  x: number;
  y: number;
  downTime: number;
  isDown: boolean;
  /**
   * Present on a press the board cannot hear for itself. Called once, by the
   * board, when it adopts the press: `move` for every move and `up` for the
   * release, both in device px.
   */
  follow?: (move: (x: number, y: number) => void, up: (x: number, y: number) => void) => void;
}

export interface PanelRow {
  id: string;
  label: string;
  /** Right-aligned detail: cost, count, timer. */
  sub?: string;
  enabled?: boolean;
  active?: boolean;
  onTap?: () => void;
  /**
   * The row's second action, on a long press (v1.27) — see
   * `ButtonOptions.onHold`. Rows are pooled, so this is looked up by slot at
   * fire time rather than bound into the button: the row a slot carries
   * changes on every rebuild.
   */
  onHold?: () => void;
  /**
   * This row can be picked up and carried onto the map (v1.29).
   *
   * Called when a drag starts on the row's SILHOUETTE and leaves the list.
   * Return true to take the gesture: the panel then gives up its own drag, so
   * the finger is moving one thing and not two.
   *
   * The silhouette rather than the whole row, because in portrait the drawer
   * sits BELOW the board — dragging a row onto the map and scrolling the list
   * are the same stroke in the same direction, and no amount of slop or
   * velocity tells them apart. A dedicated grab area does, and the obvious
   * one is the picture of the thing being carried.
   */
  onPick?: (pointer: CarryPointer) => boolean;
  /** A full-width heading instead of a button. */
  heading?: boolean;
  /**
   * The thing this row IS, drawn into the row's left edge.
   *
   * The game has had a silhouette for every structure and every unit since
   * v1.19 and drew them only on the board, so the drawer stayed a spreadsheet:
   * `SUPPLY DEPOT .......... 150S 2/3` is a table cell, and a list of them is
   * scanned by reading rather than by looking. The callback gets something to
   * draw with, already cleared and positioned, plus the box it may draw in, so
   * a caller reuses `drawStructureGlyph`/`drawAttackerGlyph` rather than
   * inventing a second set of shapes that would drift from the board's.
   *
   * The canvas kit calls it on every rebuild, which is every frame, and the
   * DOM kit whenever the row changes — keep it to drawing.
   */
  icon?: (
    g: Ink,
    x: number,
    y: number,
    size: number,
    /**
     * This row is a KNOCKOUT — solid ink with a paper label — so the icon has
     * to invert with it.
     *
     * The parameter exists because inverting the drawer made the old answer
     * wrong in silence. Every supplier hard-coded `onDark: true` back when the
     * rail was dark, which on a paper row draws a white silhouette on white
     * and leaves only its grey trim behind. Nothing fails; the icon is just
     * not there. Only the row knows which state it is in, so only the row can
     * answer this.
     */
    onDark: boolean,
  ) => void;
}

export interface PanelTab {
  id: string;
  label: string;
}

/**
 * What every panel can do, whichever kit draws it: exactly what the five
 * scenes that have one ask of it.
 */
export interface PanelApi {
  readonly tab: string;
  setTab(id: string): void;
  /** Header line plus the status block under it. */
  setStatus(title: string, lines: string[]): void;
  /** Replace the row list. Cheap to call every frame. */
  setRows(rows: PanelRow[]): void;
  applyLayout(layout: Layout): void;
  /** Portrait only: the active tab was tapped again, or the handle was. */
  onDrawerToggle?: () => void;
  /** Live drawer share during a handle drag, and the snapped detent on release. */
  onDrawerShare?: (share: DrawerState) => void;
}
