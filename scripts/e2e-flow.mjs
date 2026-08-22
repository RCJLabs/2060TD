/**
 * E2E smoke of the first-run flow (v0.3): intro → faction pick → difficulty
 * pick → town → SPACE → briefing → SPACE ×2 (skip reveal, commence) →
 * mission siege. Run with FACTION=china to smoke the Eastern Tide side.
 *
 * Uses ?demo=flow so headless Chromium gets the setTimeout game loop (any
 * demo value forces it) while every scene still runs its real, non-demo path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const FACTION = process.env.FACTION === 'china' ? 'china' : 'usa';
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e && e.stack ? e.stack : String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  mkdirSync('screenshots', { recursive: true });
  const shot = (name) => page.screenshot({ path: `screenshots/e2e-${FACTION}-${name}.png` });

  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);
  await shot('intro');

  // Viewport matches the 1280×768 game exactly, so game px == page px.
  // Faction buttons: 580×42 at cx-290, y = 400 (USA) / 474 (CHINA).
  await page.mouse.click(640, FACTION === 'china' ? 495 : 421);
  await wait(900);
  await shot('difficulty');

  // STANDARD: 230×40 at cx-250, y 460.
  await page.mouse.click(640 - 135, 480);
  await wait(1500);
  await shot('town-fresh');

  await page.keyboard.press('Space'); // MISSION 1 → briefing
  await wait(1500);
  await shot('briefing');

  await page.keyboard.press('Space'); // skip reveal
  await wait(400);
  await page.keyboard.press('Space'); // commence
  await wait(2500);
  await shot('mission');

  await browser.close();
  if (errors.length) {
    console.error('ERRORS:');
    for (const e of errors) console.error(' ', e);
    process.exitCode = 1;
  } else {
    console.log(
      `E2E OK (${FACTION}): intro → faction → difficulty → town → briefing → mission siege, no page errors.`,
    );
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
