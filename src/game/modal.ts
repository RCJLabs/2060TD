/**
 * Modal bookkeeping (v0.9).
 *
 * Full-screen overlays swallow taps with an interactive scrim, but the board
 * camera and the panel's drag-scroll listen at the *scene* level, where a
 * scrim cannot stop them. They consult this instead, so a swipe meant for a
 * briefing never also scrolls the drawer or pans the map behind it.
 */
let open = 0;

export function pushModal(): void {
  open++;
}

export function popModal(): void {
  open = Math.max(0, open - 1);
}

export function modalOpen(): boolean {
  return open > 0;
}
