/**
 * Which kit draws the UI (M30).
 *
 * The DOM, since v1.46: menus, panels, buttons and text are page elements
 * over a canvas that draws the board and nothing else. The canvas kit stays
 * one release as a way back, while the DOM one meets devices the harnesses
 * never ran on: `?ui=canvas` asks for it on one visit, and `VITE_UI=canvas`
 * when the dev server starts asks for it on every page that server hands
 * out, which is how `VITE_UI=canvas npm run e2e` still runs the whole gate
 * against it. `?ui=dom` is still understood.
 *
 * Read once: a component that asked twice and got two answers would build
 * half a screen in each kit.
 */
let cached: boolean | null = null;

export function domUi(): boolean {
  if (cached !== null) return cached;
  // No window is the unit suite, which builds no UI at all; the canvas answer
  // keeps it from reaching for a document that is not there.
  if (typeof window === 'undefined') return (cached = false);
  const param = new URLSearchParams(window.location.search).get('ui');
  cached = param === 'canvas' ? false : param === 'dom' ? true : import.meta.env.VITE_UI !== 'canvas';
  return cached;
}
