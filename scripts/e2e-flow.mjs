/**
 * E2E smoke of the v0.1 first-run flow: intro → difficulty pick → town →
 * SPACE → briefing → SPACE ×2 (skip reveal, commence) → mission siege.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`);
      if (res.ok) break;
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
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push((e && e.stack) ? e.stack : String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await wait(2000);
  await page.screenshot({ path: 'screenshots/e2e-intro.png' });

  // Pick STANDARD (left button at ~cx-250..cx-20, y 520..560; canvas is
  // letterboxed inside 1300×800 — click via canvas coords scaled by FIT).
  // The canvas fills 1300×(1300*768/1280)=780 → offsetY (800-780)/2 = 10, scale 1300/1280.
  const scale = 1300 / 1280;
  const cx = (1280 + 256) / 2 / 1; // game cx in game px... game width is 1280
  const gx = 768 / 2; // unused
  const clickGame = async (x, y) => page.mouse.click(x * scale, y * scale + 10);
  await clickGame(1280 / 2 - 250 + 115, 520 + 20); // STANDARD
  await wait(800);
  await page.screenshot({ path: 'screenshots/e2e-town-fresh.png' });

  await page.keyboard.press('Space'); // MISSION 1 → briefing
  await wait(1200);
  await page.screenshot({ path: 'screenshots/e2e-briefing.png' });

  await page.keyboard.press('Space'); // skip reveal
  await wait(300);
  await page.keyboard.press('Space'); // commence
  await wait(2000);
  await page.screenshot({ path: 'screenshots/e2e-mission.png' });

  await browser.close();
  if (errors.length) {
    console.error('ERRORS:');
    for (const e of errors) console.error(' ', e);
    process.exitCode = 1;
  } else {
    console.log('E2E OK: intro → difficulty → town → briefing → mission siege, no page errors.');
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
