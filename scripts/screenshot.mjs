/**
 * Headless smoke test + screenshot of the demo battle (?demo=1).
 * Starts a Vite dev server, loads the playground in Chromium, lets the
 * scripted battle run a few seconds, and saves screenshots/demo.png.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const URL = `http://localhost:${PORT}/?demo=1`;

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
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });

  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000); // let the scripted battle develop

  mkdirSync('screenshots', { recursive: true });
  await page.screenshot({ path: 'screenshots/demo.png' });
  await browser.close();

  if (errors.length > 0) {
    console.error('Page errors detected:');
    for (const err of errors) console.error(`  ${err}`);
    process.exitCode = 1;
  } else {
    console.log('OK: screenshots/demo.png written, no page errors.');
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
