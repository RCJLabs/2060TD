import Phaser from 'phaser';

/**
 * The boot card lives in index.html so it paints before any of this exists.
 * This is only the other half: taking it down once there are real pixels
 * behind it, and never leaving it up if something went wrong on the way.
 */
export function dismissBootCard(game: Phaser.Game): void {
  const card = document.getElementById('boot');
  if (!card) return;

  const clearFailureTimer = (): void => {
    const globals = window as unknown as Record<string, unknown>;
    const timer = globals['__bootTimer'];
    if (typeof timer === 'number') clearTimeout(timer);
    globals['__bootTimer'] = undefined;
  };

  const hide = (): void => {
    clearFailureTimer();
    if (card.classList.contains('gone')) return;
    card.classList.add('gone');
    // Removed rather than left transparent: it covers the whole viewport, and
    // a stale full-screen layer over a touch game is a bug waiting to happen.
    setTimeout(() => card.remove(), 400);
  };

  // POST_RENDER rather than READY: the card comes down when there is
  // something behind it, not when the engine says it is willing to draw.
  game.events.once(Phaser.Core.Events.POST_RENDER, hide);
  // Belt and braces — a renderer that never posts a frame must not leave the
  // card sitting on top of a game the player can already hear and tap.
  setTimeout(hide, 8000);
}
