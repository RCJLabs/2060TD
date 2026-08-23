/**
 * The first-contact coach (v1.5). Two things worth proving and neither is
 * provable from a unit test: that the coach actually reaches the screen on a
 * first battle and advances through its script, and that the one-shot screens
 * are genuinely one-shot — a second visit must be silent.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5221;
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
};
const VIEWPORT = VIEWPORTS[process.env.VIEWPORT] ? process.env.VIEWPORT : 'desktop';

/** One recognisable fragment per step of content/tutorial.ts FIRST_SIEGE. */
const STEP_MARKS = [
  'not decoration',
  'Lay wall',
  'Contact.',
  'Kills pay Command Points',
  'Spend some',
  'gone when the siege ends',
  'Sector held',
];

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

  const texts = () => page.evaluate(() => window.lastline.texts());
  const labels = () => page.evaluate(() => window.lastline.buttons().map((b) => b.label));
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  const tap = async (needle, settleMs = 900) => {
    for (let i = 0; i < 24; i++) {
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
  const saying = async () => {
    const all = (await texts()).join(' | ');
    return STEP_MARKS.filter((m) => all.includes(m));
  };

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  // ---- a first war, and its first battle ------------------------------------------
  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  await tap('OPS', 600);
  await tap('MISSION 1', 1500);
  await wait(2600); // the briefing reveals a line every 350ms
  await tap('COMMENCE', 2500);

  if (process.env.DEBUG) {
    console.log('LABELS:', JSON.stringify(await labels()));
    console.log('TEXTS:', JSON.stringify(await texts()).slice(0, 1200));
  }
  const opening = await saying();
  check('the coach meets a first-time commander', opening.length > 0, opening.join(' / '));
  await page.screenshot({ path: `screenshots/e2e-coach-${VIEWPORT}.png` });

  // Start the assault and let the script run. Each step serves a dwell first,
  // so this samples across the whole opening sequence rather than one frame.
  await tap('START ASSAULT', 800);
  const seen = new Set(opening);
  // Long enough for the opening steps plus the wave that banks the first
  // Command Points: the CP lesson is the one that must actually land.
  for (let i = 0; i < 55 && !seen.has('gone when the siege ends'); i++) {
    for (const m of await saying()) seen.add(m);
    await wait(800);
  }
  check(
    'and walks it through the script',
    seen.size >= 3,
    `${seen.size} steps seen: ${[...seen].join(' / ')}`,
  );
  check(
    'starting with the maze rule',
    seen.has('not decoration'),
    [...seen].join(' / '),
  );
  check(
    'and reaching the Command Point budget',
    seen.has('Kills pay Command Points'),
    [...seen].join(' / '),
  );

  const spent = await page.evaluate(() => {
    const raw = localStorage.getItem('lastline_save_v1');
    return raw ? (JSON.parse(raw).town.seen ?? []) : null;
  });
  check('and spends its one shot', Array.isArray(spent) && spent.includes('siege1'), String(spent));

  // ---- the planner briefing, once ---------------------------------------------------
  await page.evaluate(() => {
    const raw = localStorage.getItem('lastline_save_v1');
    const save = JSON.parse(raw);
    const town = save.town;
    town.supplies = 20000;
    town.fuel = 8000;
    town.unlocked = [...new Set([...town.unlocked, 'frontline', 'barracks'])];
    town.army = { ranger: 4 };
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);
  await tap('WAR', 700);
  await tap('FRONT LINE', 2000);

  const briefed = (await texts()).join(' | ');
  check(
    'the planner explains itself on first arrival',
    briefed.includes('A raid is planned, not driven') && (await labels()).includes('UNDERSTOOD'),
    briefed.slice(0, 90),
  );
  await page.screenshot({ path: `screenshots/e2e-planner-${VIEWPORT}.png` });
  await tap('UNDERSTOOD', 900);
  check('and closes', !(await texts()).join(' | ').includes('A raid is planned'));

  // ESC rather than the row: on a phone that row is below the drawer fold.
  await page.keyboard.press('Escape');
  await wait(1800);
  await tap('WAR', 700);
  await tap('FRONT LINE', 2000);
  check(
    'and never explains itself again',
    !(await texts()).join(' | ').includes('A raid is planned, not driven'),
    (await labels()).slice(0, 6).join(', '),
  );

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} coach check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nCOACH OK: taught once, on the first battle, and never again.');
  }
} finally {
  // A stray dev server from an interrupted run leaves this pid invalid; a
  // cleanup failure must not masquerade as a test result.
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
