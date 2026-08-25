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

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSET: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };
let probe: HTMLElement | null = null;

/**
 * How much of the viewport the hardware is sitting on, in CSS px.
 *
 * `index.html` has asked for `viewport-fit=cover` since v0.9, which extends
 * the page UNDER the notch and the home indicator — correct only if something
 * then insets the UI, and until v1.26 nothing did. So the status line was
 * drawn behind the notch and the tab strip behind the home indicator, on every
 * phone that has them.
 *
 * There is no way to read `env(safe-area-inset-*)` from script directly: it is
 * a CSS environment variable, not a property. The way to get at it is to put
 * the value on something and measure that something, which is what the probe
 * below is — an empty, invisible div whose padding IS the inset. Read from
 * `getComputedStyle`, so it reports the resolved pixel value rather than the
 * expression.
 *
 * Returns zeroes off a phone and on any browser that does not implement the
 * variables, which is the correct answer there rather than a fallback.
 */
export function safeAreaInsets(): SafeArea {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return NO_INSET;
  if (!probe) {
    probe = document.createElement('div');
    // Fixed and zero-sized so it costs no layout and can never be seen or hit.
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  const read = (value: string): number => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  return {
    top: read(style.paddingTop),
    right: read(style.paddingRight),
    bottom: read(style.paddingBottom),
    left: read(style.paddingLeft),
  };
}

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
  // Create the probe up front so the first layout has real insets rather than
  // zeroes it would have to be recomputed out of a frame later.
  safeAreaInsets();
  registerServiceWorker();
}

/**
 * Register the offline worker — in a PRODUCTION build served over http(s),
 * and nowhere else.
 *
 * Both guards earn their place. In dev a worker would cache the Vite dev
 * server and hand stale modules to the next edit, and it would do the same to
 * the twenty E2E harnesses that drive that server. Off http(s) — the
 * single-file build opened from a `file://` URL, which is how the artifact is
 * shared — `register` throws rather than returning a rejected promise on some
 * engines, so the check has to come first.
 *
 * Failure is silent by design: a game that will not cache is a game that
 * needs a connection, not a game that is broken.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
