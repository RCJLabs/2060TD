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
 *   - the DRAWER, which covers the foot of the board. It held 42% of the height
 *     until M34 and rests on exactly what the world leaves now, so the last
 *     column is how much of the map a player sees without touching anything.
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
  // The same phones as they are actually held (M34). Every row above is the
  // whole screen, which is only what the game gets in fullscreen. From the
  // home screen an iPhone keeps its notch and home bar out of the layout; in a
  // browser tab the address bar and toolbar take a slice off the top and
  // bottom. The heights are the commonly reported inner heights; the insets
  // are the iPhone 13's.
  ['iPhone 13, home screen', 390, 844, 3, true, [47, 0, 34, 0]],
  ['iPhone 13, Safari tab', 390, 664, 3, true],
  ['small Android, Chrome', 360, 656, 3, true],
];

/** A cell smaller than this cannot carry a silhouette that reads. */
const READABLE = 18;
/**
 * A cell smaller than this cannot be hit with a thumb without zooming first
 * (M34). The game's own row height, and Apple's floor. M33 cleared READABLE
 * on every phone; M34's bar is this one, which is a different question — a
 * silhouette you can read is not a cell you can tap.
 */
const TOUCH = 44;

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
  for (const [name, w, h, dpr, mobile, insets] of DEVICES) {
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: dpr,
      isMobile: mobile,
      hasTouch: mobile,
    });
    // Headless Chromium has no notch, so `env(safe-area-inset-*)` is zero. The
    // game reads its insets off one probe element whose padding IS those env()
    // values, and a rule that outranks the probe's inline style hands it the
    // phone's instead. It goes into <head> the moment the parser makes one:
    // an init script runs before there is a document element to put it in,
    // and the first attempt, appended to nothing, measured a notch of zero —
    // which the check below exists to catch.
    if (insets) {
      const [t, r, b, l] = insets;
      await page.addInitScript((css) => {
        const tag = document.createElement('style');
        tag.textContent = css;
        const install = () => {
          if (!document.head) return false;
          document.head.appendChild(tag);
          return true;
        };
        if (!install()) {
          const watch = new MutationObserver(() => {
            if (install()) watch.disconnect();
          });
          watch.observe(document, { childList: true, subtree: true });
        }
      }, `div[style*="safe-area-inset"]{padding:${t}px ${r}px ${b}px ${l}px !important}`);
    }
    await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
    await wait(2600);
    const r = await page.evaluate(() => {
      const l = window.lastline.layout();
      if (!l) return { board: null };
      const grid = window.lastline.grid?.() ?? null;
      return {
        board: l.board,
        // The whole drawer comes back out of the board when it shuts, and the
        // layout says how tall the drawer is. In landscape there is no drawer
        // and `drawerH` is zero, so the rail's list is not mistaken for one,
        // which reported a 1300x800 desktop at 45px a cell and 18 rows of 30.
        shutH: l.board.h + l.drawerH,
        mode: l.mode,
        grid,
        safe: l.safe,
        dpr: window.lastline.dpr,
      };
    });
    await page.close();
    if (!r.board) throw new Error(`no layout on ${name}`);
    if (insets && r.safe.top / r.dpr !== insets[0]) {
      throw new Error(`${name}: asked for a ${insets[0]}px top inset, the game saw ${r.safe.top / r.dpr}`);
    }
    rects.push({
      name,
      mode: r.mode,
      w: r.board.w / r.dpr,
      rest: r.board.h / r.dpr,
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

  const mark = (c) => (c < READABLE ? '!' : c < TOUCH ? '~' : ' ');

  for (const grid of CANDIDATES) {
    const cells = grid.w * grid.h;
    const ref = asGrid(shipped ?? '32x24');
    const share = Math.round((cells / (ref.w * ref.h)) * 100);
    console.log(
      `\n${grid.label} — ${cells} cells${grid.label === shipped ? ' (shipped)' : ` (${share}% of the shipped ${shipped})`}, aspect ${(grid.w / grid.h).toFixed(2)}`,
    );
    console.log('  device                   board w   cell      rows in view (shut / at rest)');
    for (const rect of rects) {
      // ONE cell size, because since v1.40 there is only one: the fit zoom is
      // measured against the rect a SHUT drawer leaves and does not change when
      // the drawer moves. Reporting a second, smaller figure for "drawer open"
      // described a board that refits, which is the behaviour this release
      // removed — an instrument is not allowed to keep measuring the old one.
      //
      // What an open drawer costs is VIEW, so that is what the last column is.
      // Floored rather than rounded: a row the drawer covers half of is not a
      // row in view, and rounding reported a board missing half a row as whole.
      //
      // The resting drawer is sized from the SHIPPED world's shape, so for a
      // candidate grid of another aspect the rest column is only indicative.
      const cell = Math.min(rect.w / (grid.w * CELL), rect.shut / (grid.h * CELL)) * CELL;
      const rows = (h) => Math.floor(Math.min(grid.h, h / cell + 1e-6));
      console.log(
        `  ${rect.name.padEnd(24)} ${`${Math.round(rect.w)}`.padEnd(9)} ${`${cell.toFixed(1)}px${mark(cell)}`.padEnd(9)} ${rows(rect.shut)} / ${rows(rect.rest)} of ${grid.h}`,
      );
    }
  }
  console.log(`\n  ! = under the ${READABLE}px a silhouette needs.`);
  console.log(`  ~ = readable, but under the ${TOUCH}px a thumb needs without zooming.\n`);
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
