/**
 * What does "the board fits a phone" actually mean, in pixels? (M34 #1)
 *
 * Reads the LIVE layout — the real one, with the scene's own status band and
 * primary button — at the viewports the E2E suite already uses, and answers
 * two questions for any board shape:
 *
 *   CELL   CSS px one grid square is drawn at when the whole board is in view.
 *          The board camera takes its fit zoom from `boardFull`, the rect a
 *          SHUT drawer would leave, so that is what this divides.
 *   SEEN   how much of that fitted board is still visible with the drawer at
 *          its resting height. The drawer slides OVER the map (v1.40), so a
 *          cell can be big enough and still be under the sheet.
 *
 * Before any of its numbers are trusted it checks itself: for today's 20x30
 * board, CELL must agree with what the siege's board camera is actually
 * drawing, read from `lastline.camera()`. If the instrument and the camera
 * disagree, the instrument is wrong and nothing below it means anything.
 *
 *   node scripts/measure-fit.mjs
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5246;
const TOUCH = 44; // the game's own row height, and Apple's floor
const VIEWPORTS = {
  'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
  'small-portrait': { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true },
  'phone-landscape': { width: 915, height: 412, deviceScaleFactor: 3, isMobile: true },
  'tablet-portrait': { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true },
  'tablet-landscape': { width: 1180, height: 820, deviceScaleFactor: 2, isMobile: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
};
const SCENES = { town: '?demo=town', siege: '?demo=1', raid: '?demo=raid' };
const SHAPES = [
  [20, 30], [16, 24], [14, 21], [12, 18], [10, 15], [8, 12],
  [12, 15], [10, 13], [9, 14],
];

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const deadline = Date.now() + 30000;
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

  const rows = [];
  let checked = false;
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const { isMobile, ...size } = vp;
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.deviceScaleFactor,
      hasTouch: isMobile,
      isMobile,
    });
    for (const [scene, query] of Object.entries(SCENES)) {
      await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'networkidle' });
      let snap = null;
      for (let i = 0; i < 40 && !snap; i++) {
        await wait(150);
        snap = await page.evaluate(() => {
          const api = window.lastline;
          const l = api.layout ? api.layout() : null;
          if (!l) return null;
          const cam = api.camera ? api.camera() : null;
          const css = (r) => ({ w: r.w / l.dpr, h: r.h / l.dpr });
          return {
            mode: l.mode,
            board: css(l.board),
            full: css(l.boardFull ?? l.board),
            camCell: cam ? (cam.zoom * 32) / l.dpr : null,
            grid: api.grid ? api.grid() : null,
          };
        });
      }
      if (!snap) {
        rows.push({ vpName, scene, error: 'no layout' });
        continue;
      }
      rows.push({ vpName, scene, ...snap });
    }
    await page.close();
  }
  await browser.close();

  // ---- self-check: the instrument against the camera ------------------------
  // The siege opens at fit view on the whole board, so on today's 20x30 its
  // camera cell and this instrument's CELL must be the same number.
  console.log('SELF-CHECK — instrument CELL vs the live siege camera, 20x30:');
  let worst = 0;
  for (const r of rows.filter((x) => x.scene === 'siege' && !x.error)) {
    const mine = Math.min(r.full.w / 20, r.full.h / 30);
    const cam = r.camCell;
    const off = cam ? Math.abs(mine - cam) / cam : NaN;
    worst = Math.max(worst, Number.isFinite(off) ? off : 1);
    console.log(
      `  ${r.vpName.padEnd(17)} instrument ${mine.toFixed(1).padStart(5)}  camera ${
        cam ? cam.toFixed(1).padStart(5) : '  n/a'
      }  ${Number.isFinite(off) ? `${(off * 100).toFixed(1)}% off` : ''}`,
    );
  }
  checked = worst < 0.05;
  console.log(checked ? '  OK — within 5% everywhere.\n' : '  DISAGREES — do not trust the tables below.\n');

  // ---- the board region itself ---------------------------------------------
  console.log('BOARD REGION (CSS px) — boardFull = drawer shut; board = drawer at rest');
  for (const r of rows) {
    if (r.error) {
      console.log(`  ${r.vpName.padEnd(17)} ${r.scene.padEnd(6)} ${r.error}`);
      continue;
    }
    const aspect = (r.full.w / r.full.h).toFixed(2);
    console.log(
      `  ${r.vpName.padEnd(17)} ${r.scene.padEnd(6)} full ${Math.round(r.full.w)}x${Math.round(
        r.full.h,
      )} (w/h ${aspect})   at rest ${Math.round(r.board.w)}x${Math.round(r.board.h)}`,
    );
  }

  // ---- the question: what fits? --------------------------------------------
  console.log(`\nLARGEST GRID WITH A ${TOUCH}px CELL AND NO ZOOM (from boardFull)`);
  for (const r of rows.filter((x) => !x.error)) {
    const cols = Math.floor(r.full.w / TOUCH);
    const rws = Math.floor(r.full.h / TOUCH);
    console.log(`  ${r.vpName.padEnd(17)} ${r.scene.padEnd(6)} ${cols} x ${rws}`);
  }

  console.log('\nCELL (CSS px at fit)  /  SEEN (% of the fitted board above a resting drawer)');
  const header = SHAPES.map(([c, h]) => `${c}x${h}`.padStart(11)).join('');
  console.log(`  ${''.padEnd(24)}${header}`);
  for (const r of rows.filter((x) => !x.error)) {
    const cells = SHAPES.map(([c, h]) => {
      const cell = Math.min(r.full.w / c, r.full.h / h);
      const fittedH = cell * h;
      const seen = Math.min(1, r.board.h / fittedH);
      const mark = cell >= TOUCH ? '*' : ' ';
      return `${cell.toFixed(0).padStart(3)}${mark}/${String(Math.round(seen * 100)).padStart(3)}%`.padStart(11);
    });
    console.log(`  ${`${r.vpName} ${r.scene}`.padEnd(24)}${cells.join('')}`);
  }
  console.log(`\n  * = cell at or above ${TOUCH}px, touchable without zooming`);
  if (!checked) process.exitCode = 1;
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
