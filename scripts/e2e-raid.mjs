/**
 * E2E smoke of the v0.2 offense loop: raid planner → assign units → launch →
 * result overlay → watch replay. Runs on ?demo=raid (showcase town).
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
  await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
  await wait(2000);

  const scale = 1300 / 1280;
  const clickGame = (x, y) => page.mouse.click(x * scale, y * scale + 10);

  // Assign 3 rangers + 1 abrams to squad 1, then a javelin to squad 2.
  await clickGame(1055, 444); // +R
  await clickGame(1055, 444);
  await clickGame(1055, 444);
  await clickGame(1240, 444); // +A
  await clickGame(1150, 369); // select SQD2
  await clickGame(1145, 444); // +J
  await wait(300);
  await page.screenshot({ path: 'screenshots/e2e-raid-plan.png' });

  await page.keyboard.press('Space'); // LAUNCH
  await wait(1500);
  await page.screenshot({ path: 'screenshots/e2e-raid-result.png' });

  await clickGame(505, 437); // WATCH REPLAY
  await wait(4000);
  await page.screenshot({ path: 'screenshots/e2e-raid-replay.png' });

  await browser.close();
  if (errors.length) {
    console.error('ERRORS:');
    for (const e of errors) console.error(' ', e);
    process.exitCode = 1;
  } else {
    console.log('E2E OK: plan → launch → result → replay, no page errors.');
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
