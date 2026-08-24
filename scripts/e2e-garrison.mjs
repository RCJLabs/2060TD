/**
 * E2E for the garrison (v1.20): plan a raid, launch it, watch the footage, and
 * prove the watch is ON SCREEN and MOVING.
 *
 * This exists because the garrison's whole justification is that being slow
 * now costs something, and a cost the player cannot see teaches nobody
 * anything. The sim tests prove the base stands guns up; this proves the
 * player is told about it while it happens. A static line that always read
 * "GAR 0/3" would pass a snapshot test and fail the actual requirement, so
 * the harness samples the readout twice and insists it changed.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5234;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (msg) => {
  console.error(`E2E FAIL: ${msg}`);
  process.exitCode = 1;
};

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
  page.on('pageerror', (e) => errors.push(e && e.stack ? e.stack : String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
  await wait(2000);

  const texts = () => page.evaluate(() => window.lastline.texts());
  /** The garrison readout, or null while it is not on screen. */
  const watchLine = async () =>
    (await texts()).find((t) => /\bGARRISON\b|\bGAR \d+\/\d+/.test(t)) ?? null;

  // Addressed by label rather than by pixel. The older raid harness clicks
  // fixed coordinates and only asserts "no page errors", which means it has
  // been launching empty raids without anybody noticing; this one checks the
  // force it mustered before it presses go.
  const findButton = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      if (!api) return null;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      if (!hit) return null;
      return { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr };
    }, needle.toUpperCase());

  const tap = async (needle, settleMs = 400) => {
    const hit = await findButton(needle);
    if (!hit) return false;
    await page.mouse.click(hit.x, hit.y);
    await wait(settleMs);
    return true;
  };

  // Muster a force worth reinforcing against. Assignment lives on SQUADS —
  // MUSTER is the training tab and its rows are inert here.
  await tap('SQUADS', 600);
  for (let i = 0; i < 4; i++) await tap('+ RANGER SQUAD', 200);
  for (let i = 0; i < 2; i++) await tap('+ JAVELIN TEAM', 200);
  await tap('+ M1 ABRAMS', 200);

  const launch = (await texts()).find((t) => /LAUNCH RAID/.test(t)) ?? '';
  if (/· 0 UNITS/.test(launch)) {
    fail(`mustered nothing — the planner still reads "${launch}"`);
  }

  await tap('LAUNCH RAID', 2200);
  await tap('WATCH REPLAY', 1500);

  const first = await watchLine();
  if (first === null) {
    fail(`no garrison readout in the replay HUD. Saw: ${JSON.stringify(await texts())}`);
  } else if (!/\d+\/\d+/.test(first)) {
    fail(`garrison readout carries no tally: ${JSON.stringify(first)}`);
  } else if (!/NEXT IN \d+s|RESERVE SPENT|STANDING TO/.test(first)) {
    fail(`garrison readout says nothing about the next order: ${JSON.stringify(first)}`);
  }
  await page.screenshot({ path: 'screenshots/e2e-garrison-replay.png' });

  // Sample again once the footage has run on. A readout that never moves is a
  // label, not a countdown, and the point of the line is that it counts down.
  await wait(2500);
  const second = await watchLine();
  if (first !== null && second !== null && first === second) {
    fail(`the garrison readout never moved — still ${JSON.stringify(first)} after 2.5s`);
  }
  await page.screenshot({ path: 'screenshots/e2e-garrison-later.png' });

  await browser.close();
  if (errors.length) {
    console.error('ERRORS:');
    for (const e of errors) console.error(' ', e);
    process.exitCode = 1;
  } else if (!process.exitCode) {
    console.log(`E2E OK: the watch is on screen and counting — "${first}" → "${second}".`);
  }
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
