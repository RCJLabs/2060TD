/**
 * The front-end loop (v1.1): main menu → new war → settings → back to the
 * menu → continue. Everything is addressed by label through
 * `window.lastline`, so it runs on any viewport.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5187;
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
};
const VIEWPORT = VIEWPORTS[process.env.VIEWPORT] ? process.env.VIEWPORT : 'desktop';

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
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
  const { isMobile, ...size } = VIEWPORTS[VIEWPORT];
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.deviceScaleFactor,
    hasTouch: isMobile,
    isMobile,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const labels = () => page.evaluate(() => window.lastline.buttons().map((b) => b.label));
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  const tap = async (needle, settleMs = 900) => {
    for (let i = 0; i < 20; i++) {
      const hit = await find(needle);
      if (hit) {
        await page.mouse.click(hit.x, hit.y);
        await wait(settleMs);
        return true;
      }
      await wait(250);
    }
    throw new Error(`no button matching "${needle}"`);
  };
  const has = async (needle) => (await labels()).some((l) => l.toUpperCase().includes(needle));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  check('a fresh boot lands on the menu', await has('NEW WAR'), (await labels()).join(', '));
  check('with no campaign there is nothing to continue', !(await has('CONTINUE')));

  // Settings, straight from the front door.
  await tap('SETTINGS');
  check('the menu opens settings', await has('SOUND'), (await labels()).join(', '));
  const before = (await labels()).find((l) => l.startsWith('SOUND'));
  await tap('SOUND');
  const after = (await labels()).find((l) => l.startsWith('SOUND'));
  check('a toggle flips and the page redraws', before !== after, `${before} → ${after}`);
  await tap('SOUND'); // put it back
  check('the menu settings offer no MAIN MENU link', !(await has('MAIN MENU')));
  await tap('CLOSE');
  check('closing returns to the menu', await has('NEW WAR'));

  // Into the war.
  await tap('NEW WAR', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  check('the town is up', await has('SUPPLY DEPOT'), (await labels()).slice(5, 8).join(', '));

  // Settings from inside, then the way home.
  await tap('SYS', 600);
  await tap('SETTINGS', 900);
  check('the same settings screen opens in-game', await has('COLORBLIND'));
  check('in-game settings offer the way back', await has('MAIN MENU'));
  check('and the campaign file', await has('EXPORT SAVE'));
  await tap('CLOSE', 700);

  await tap('MAIN MENU', 1500);
  check('the SYS tab walks back to the menu', await has('NEW WAR'), (await labels()).join(', '));
  check('the campaign is now offered', await has('CONTINUE THE WAR'));
  await page.screenshot({ path: `screenshots/e2e-menu-${VIEWPORT}.png` });

  await tap('CONTINUE', 1800);
  check('continue resumes the town', await has('SUPPLY DEPOT'));

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} menu check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nMENU OK: front door, settings from both sides, and the walk back.');
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
