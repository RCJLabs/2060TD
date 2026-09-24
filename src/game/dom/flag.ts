/**
 * The DOM UI (M30), behind a flag until every harness passes both ways.
 *
 * `?ui=dom` turns it on for one visit and `?ui=canvas` forces it off. With
 * neither, `VITE_UI=dom` at dev-server start turns it on for every page that
 * server hands out, which is how `VITE_UI=dom npm run e2e` runs the whole gate
 * against it without any harness knowing.
 *
 * Read once: a component that asked twice and got two answers would build
 * half a screen in each kit.
 */
let cached: boolean | null = null;

export function domUi(): boolean {
  if (cached !== null) return cached;
  let param: string | null = null;
  try {
    param = new URLSearchParams(window.location.search).get('ui');
  } catch {
    // No window: the unit suite, which only ever builds the canvas kit.
  }
  cached = param === 'dom' ? true : param === 'canvas' ? false : import.meta.env.VITE_UI === 'dom';
  return cached;
}
