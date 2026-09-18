/**
 * What size is a cell, on the device this game is actually played on?
 *
 * The phone complaint reads as letterboxing and is not. Measured, the world
 * already fills 78–90% of the board rect on every device — the fit is fine.
 * What is wrong is SCALE: 32 cells across a 390 px phone is 12 CSS px each,
 * and a 12 px cell cannot carry a silhouette, a level pip or a finger.
 *
 * Two levers move that number and this measures both, because on a portrait
 * world they bind in turn:
 *
 *   - the GRID, which decides how many cells the short axis is divided into;
 *   - the DRAWER, which on a phone is holding 42% of the height and makes the
 *     board refit every time it moves.
 *
 * An earlier version of this file asserted that the drawer could not matter
 * because "width is what binds". That is true only of the shipped 4:3 world.
 * Turn the world portrait and height binds first, so both columns are printed
 * and neither is taken on faith.
 *
 *   npm run fit                 # the shipped grid
 *   npm run fit -- 20x30 18x28  # candidates, against the same devices
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const CELL = 32; // world px per cell — see the scenes' own CELL
const grids = process.argv.slice(2).filter((a) => /^\d+x\d+$/.test(a));
const asGrid = (g) => {
  const [w, h] = g.split('x').map(Number);
  return { label: g, w, h };
};

/**
 * The viewports that matter, smallest first.
 *
 * Real devices rather than round numbers: the narrowest phone still widely
 * used is 360 CSS px, and it is the one that decides the cell size for
 * everyone, because it is the least room any lever gets to work with.
 */
const DEVICES = [
  ['small Android', 360, 800, 3, true],
  ['iPhone 13', 390, 844, 3, true],
  ['Pixel 7', 412, 915, 2.6, true],
  ['iPhone 15 Pro Max', 430, 932, 3, true],
  ['iPad portrait', 820, 1180, 2, true],
  ['desktop', 1300, 800, 1, false],
];

/** A cell smaller than this cannot carry a silhouette that reads. */
const READABLE = 18;

const PORT = 5296;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
    } catch {
      /* retry */
    }
    if (Date.now() > deadline) throw new Error('no server');
    await wait(300);
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }

  // The board rect is a LAYOUT fact and does not depend on the grid, so it is
  // measured once per device and every candidate is scored against it.
  //
  // The SHUT rect is reconstructed from the same layout rather than measured
  // by driving the handle, because the drawer's height is recoverable exactly:
  // `board.h + list.h + gap + primaryBand` is the whole of `available` in
  // computeLayout, whatever share the drawer is currently holding.
  const rects = [];
  let shipped = null;
  for (const [name, w, h, dpr, mobile] of DEVICES) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: dpr,
      isMobile: mobile,
      hasTouch: mobile,
    });
    await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
    await wait(2600);
    const r = await page.evaluate(() => {
      const l = window.lastline.layout();
      if (!l) return { board: null };
      const grid = window.lastline.grid?.() ?? null;
      const band = l.primary.h > 0 ? l.primary.h + l.gap : 0;
      return {
        board: l.board,
        shutH: l.board.h + l.list.h + l.gap + band,
        mode: l.mode,
        grid,
        dpr: window.lastline.dpr,
      };
    });
    await page.close();
    if (!r.board) throw new Error(`no layout on ${name}`);
    rects.push({
      name,
      mode: r.mode,
      w: r.board.w / r.dpr,
      open: r.board.h / r.dpr,
      shut: r.shutH / r.dpr,
    });
    if (r.grid) shipped = `${r.grid.cols}x${r.grid.rows}`;
  }
  await browser.close();

  // The default candidate is the grid the GAME is on, read off the live board.
  // It was the literal '32x24' until v1.40, which is the same mistake five E2E
  // harnesses made: an instrument holding an opinion about the size of the
  // thing it measures reports on a board that is not there any more, and says
  // nothing about it.
  const CANDIDATES = (grids.length > 0 ? grids : [shipped ?? '32x24']).map(asGrid);

  const mark = (c) => (c >= READABLE ? ' ' : '!');

  for (const grid of CANDIDATES) {
    const cells = grid.w * grid.h;
    const ref = asGrid(shipped ?? '32x24');
    const share = Math.round((cells / (ref.w * ref.h)) * 100);
    console.log(
      `\n${grid.label} — ${cells} cells${grid.label === shipped ? ' (shipped)' : ` (${share}% of the shipped ${shipped})`}, aspect ${(grid.w / grid.h).toFixed(2)}`,
    );
    console.log('  device             board w   cell      rows in view (shut / open)');
    for (const rect of rects) {
      // ONE cell size, because since v1.40 there is only one: the fit zoom is
      // measured against the rect a SHUT drawer leaves and does not change when
      // the drawer moves. Reporting a second, smaller figure for "drawer open"
      // described a board that refits, which is the behaviour this release
      // removed — an instrument is not allowed to keep measuring the old one.
      //
      // What an open drawer costs is VIEW, so that is what the last column is.
      const cell = Math.min(rect.w / (grid.w * CELL), rect.shut / (grid.h * CELL)) * CELL;
      const rows = (h) => Math.min(grid.h, h / cell).toFixed(0);
      console.log(
        `  ${rect.name.padEnd(18)} ${`${Math.round(rect.w)}`.padEnd(9)} ${`${cell.toFixed(1)}px${mark(cell)}`.padEnd(9)} ${rows(rect.shut)} / ${rows(rect.open)} of ${grid.h}`,
      );
    }
  }
  console.log(`\n  ! = under the ${READABLE}px a silhouette needs.\n`);
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
