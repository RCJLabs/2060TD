/**
 * The launcher icons, generated.
 *
 * They were hand-made binaries until v1.39, which is exactly the kind of
 * asset that drifts: the ink pass repainted every pixel inside the canvas and
 * left four PNGs on a home screen still olive-on-cream from v1.19, with
 * nothing in the repo that could have told you. Now one drawing function
 * produces all four, so the next direction change is a re-run.
 *
 * The mark is the game's own: a four-point star — a map rose, and the only
 * shape on the board that is neither a building nor a counter — knocked
 * through by a square, which is the command post. Drawn in the page's values:
 * paper ground, a heavy ink panel border, solid ink star, paper knockout.
 *
 * Chromium rather than a native image library, for the same reason
 * `zoom.mjs` uses it: Playwright is already a dependency, a canvas is exactly
 * the right tool, and there is nothing new to install.
 *
 *   npm run icons
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PAPER = '#ffffff';
const INK = '#111111';

/**
 * Every icon this project ships, and how much of the tile the mark may use.
 *
 * A maskable icon is cropped to a circle by the launcher, so its content has
 * to sit inside the inner 80% — the safe zone — or Android shaves the points
 * off the star. That is the whole reason it is a separate file rather than
 * the same one at a second size.
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, safe: 1, border: true },
  { file: 'icon-512.png', size: 512, safe: 1, border: true },
  { file: 'apple-touch-icon.png', size: 180, safe: 1, border: true },
  { file: 'icon-maskable-512.png', size: 512, safe: 0.62, border: false },
];

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}
const page = await browser.newPage();
await page.setContent('<body style="margin:0"><canvas id="c"></canvas></body>');
mkdirSync('public', { recursive: true });

for (const icon of ICONS) {
  await page.evaluate(
    ({ size, safe, border, paper, ink }) => {
      const c = document.getElementById('c');
      c.width = size;
      c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, size, size);

      // The panel border every other surface in this game has. A maskable
      // tile skips it: the launcher crops the edge off, so a border there is
      // a ring that is only partly there.
      if (border) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = size * 0.075;
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
      }

      const mid = size / 2;
      const out = size * 0.42 * safe;
      const waist = out * 0.28;
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(mid, mid - out);
      ctx.lineTo(mid + waist, mid - waist);
      ctx.lineTo(mid + out, mid);
      ctx.lineTo(mid + waist, mid + waist);
      ctx.lineTo(mid, mid + out);
      ctx.lineTo(mid - waist, mid + waist);
      ctx.lineTo(mid - out, mid);
      ctx.lineTo(mid - waist, mid - waist);
      ctx.closePath();
      ctx.fill();

      // The post, knocked out of the middle of the rose.
      const post = out * 0.38;
      ctx.fillStyle = paper;
      ctx.fillRect(mid - post / 2, mid - post / 2, post, post);
    },
    { size: icon.size, safe: icon.safe, border: icon.border, paper: PAPER, ink: INK },
  );
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.locator('canvas').screenshot({ path: `public/${icon.file}` });
  console.log(`public/${icon.file} — ${icon.size}x${icon.size}`);
}

await browser.close();
