/**
 * Mobile shell (v0.6.1): everything a phone needs that the scenes don't
 * know about. Pure DOM, no Phaser imports — it runs beside the game and
 * ships in the same bundle, so the Pages site and the single-file build
 * both get it for free.
 *
 * - Touch CSS hardening: no long-press callouts, no overscroll bounce,
 *   no tap highlights on the canvas.
 * Since v0.9 the game lays itself out for portrait as readily as landscape,
 * so there is no rotate nag, and fullscreen moved into the game's own SYS
 * tab rather than floating a DOM button over the HUD.
 */

export function initMobileShell(): void {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    html, body { overscroll-behavior: none; }
    #app, #app canvas {
      touch-action: none;
      -webkit-tap-highlight-color: transparent;
      -webkit-touch-callout: none;
      user-select: none;
      -webkit-user-select: none;
    }
  `;
  document.head.appendChild(style);

}
