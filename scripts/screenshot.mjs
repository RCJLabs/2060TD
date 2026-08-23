/**
 * Headless smoke test + screenshots: the scripted siege (?demo=1) and the
 * showcase town (?demo=town). Starts a Vite dev server, drives Chromium,
 * saves screenshots/demo.png and screenshots/town.png.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Dev server did not come up at ${url}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch {
    // Version-mismatched browser cache: use the preinstalled binary directly.
    return await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});

try {
  await waitForServer(`http://localhost:${PORT}/`);
  const browser = await launchBrowser();
  mkdirSync('screenshots', { recursive: true });
  const errors = [];

  const shoot = async (query, waitMs, file) => {
    const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    page.on('pageerror', (err) => errors.push(`${query}: ${String(err)}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`${query}: ${msg.text()}`);
    });
    await page.goto(`http://localhost:${PORT}/?${query}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: `screenshots/${file}` });
    await page.close();
  };

  await shoot('demo=1', 9000, 'demo.png'); // mid-battle, past the fire mission
  await shoot('demo=town', 3000, 'town.png'); // showcase base
  await shoot('demo=raid', 3000, 'raid.png'); // the Front Line planner
  await shoot('demo=1&faction=china', 9000, 'demo-china.png'); // Eastern Tide battle
  await shoot('demo=raid&faction=china', 3000, 'raid-china.png'); // PLA raids a US firebase
  await shoot('demo=1&faction=russia', 9000, 'demo-russia.png'); // Iron Corridor battle
  await shoot('demo=raid&faction=russia', 3000, 'raid-russia.png'); // RU raids a US firebase
  await shoot('demo=1&faction=nk', 9000, 'demo-nk.png'); // Silent Tunnels battle
  await shoot('demo=raid&faction=nk', 3000, 'raid-nk.png'); // KPA raid with a sited gallery

  await browser.close();

  if (errors.length > 0) {
    console.error('Page errors detected:');
    for (const err of errors) console.error(`  ${err}`);
    process.exitCode = 1;
  } else {
    console.log('OK: demo/town/raid + faction variants written, no page errors.');
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
