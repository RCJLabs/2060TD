/**
 * Magnify a region of a screenshot, nearest-neighbour.
 *
 * A screenshot read at 1:1 tells you the composition and hides everything at
 * counter scale, which is where this project's art bugs live — the ink pass
 * shipped a grey rotor ring, a grey shadow and a health bar with an invisible
 * trough, and all three were invisible at page size and obvious at 8x.
 *
 * Chromium rather than a native image library: Playwright is already a
 * dependency and a canvas `drawImage` with smoothing off is exactly the
 * nearest-neighbour blit this wants, with nothing new to install.
 *
 *   node scripts/zoom.mjs screenshots/demo.png out.png 150 440 90 60 10
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const [src, out, x, y, w, h, scale = '4'] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts/zoom.mjs <src.png> <out.png> [x y w h [scale]]');
  process.exit(2);
}

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}
const page = await browser.newPage();
await page.setContent('<body style="margin:0"><canvas id="c"></canvas></body>');
const size = await page.evaluate(
  async ({ b64, x, y, w, h, s }) => {
    const img = new Image();
    await new Promise((r) => {
      img.onload = r;
      img.src = 'data:image/png;base64,' + b64;
    });
    const sx = x ?? 0;
    const sy = y ?? 0;
    const sw = w ?? img.width;
    const sh = h ?? img.height;
    const c = document.getElementById('c');
    c.width = Math.round(sw * s);
    c.height = Math.round(sh * s);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    // `setViewportSize` wants width/height, not w/h — and it is the only
    // thing downstream that reads this, so name it the way it is consumed.
    return { width: c.width, height: c.height };
  },
  {
    b64: readFileSync(src).toString('base64'),
    x: x === undefined ? null : +x,
    y: y === undefined ? null : +y,
    w: w === undefined ? null : +w,
    h: h === undefined ? null : +h,
    s: +scale,
  },
);
await page.setViewportSize(size);
await page.locator('canvas').screenshot({ path: out });
await browser.close();
console.log(`wrote ${out} — ${size.width}x${size.height}`);
