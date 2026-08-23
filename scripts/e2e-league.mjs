/**
 * The board (v1.3): league standing on the WAR tab, the standing overlay, and
 * the daily field condition on the raid planner — including the one day that
 * takes recon off the table entirely.
 *
 * The rotation is a function of the clock, so this drives the clock:
 * page.clock.setFixedTime pins Date without touching Phaser's own timers,
 * which lets the harness walk a whole rotation in one run and assert the
 * BLACKOUT day from what the game says, not from a date copied into a test.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5203;
/** Monday 5 Jan 2026 00:00 UTC — LADDER_EPOCH in content/leagues.ts. */
const EPOCH = Date.UTC(2026, 0, 5);
const DAY = 24 * 3_600_000;
/** Conditions rotate daily; walking one full pool proves the schedule. */
const POOL = 6;

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
  const VIEWPORTS = {
    desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
    'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
  };
  const { isMobile, ...size } = VIEWPORTS[process.env.VIEWPORT] ?? VIEWPORTS.desktop;
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.deviceScaleFactor,
    hasTouch: isMobile,
    isMobile,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const labels = () =>
    page.evaluate(() => window.lastline.buttons().map((b) => `${b.label} ${b.sub ?? ''}`.trim()));
  const texts = () => page.evaluate(() => window.lastline.texts());
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  const tap = async (needle, settleMs = 800) => {
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
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  /** Panel headings are drawn as text, not buttons — read them from the copy. */
  const copyLike = async (needle) =>
    (await texts()).find((t) => t.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copyHas = async (needle) =>
    (await texts()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });

  // ---- the board on the WAR tab -------------------------------------------------
  await page.clock.setFixedTime(new Date(EPOCH + 2 * DAY + 9 * 3_600_000));
  await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
  await wait(2500);

  await tap('WAR', 600);
  const band = await rowLike('PTS');
  check('the WAR tab carries a league standing', /VANGUARD/.test(band) && /465/.test(band), band);
  const today = await rowLike('TODAY —');
  check("and today's field condition", today.startsWith('TODAY —'), today);

  await tap('TODAY', 900);
  const overlay = await texts();
  const joined = overlay.join(' | ');
  check(
    'the standing overlay reports the band, the peak and the season',
    (await copyHas('STANDING 465')) && (await copyHas('PEAK')) && (await copyHas('SEASON')),
    joined.length > 0 ? `${overlay.length} strings on screen` : 'nothing drawn',
  );
  check(
    'it says what silence costs',
    (await copyHas('DECAY STARTS IN')) || (await copyHas('BLEEDING')),
    '',
  );
  check('and what today does', await copyHas('NEXT UP:'), '');
  await page.screenshot({ path: `screenshots/e2e-league${isMobile ? '-phone' : ''}.png` });
  await tap('CLOSE', 600);
  check('the overlay closes', !(await copyHas('NEXT UP:')), '');

  // ---- the rotation on the raid planner ------------------------------------------
  const seen = [];
  let darkShot = false;
  for (let day = 0; day < POOL; day++) {
    await page.clock.setFixedTime(new Date(EPOCH + day * DAY + 9 * 3_600_000));
    await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
    await wait(2200);
    // Target 3 of 3 is the unsurveyed one in the demo save; the tab is also
    // called TARGET, so cycle by the row that carries its own count.
    await tap('TARGET 1/', 500);
    await tap('TARGET 2/', 500);
    const heading = await copyLike('TODAY —');
    const rows = (await labels()).map((l) => l.toUpperCase());
    // Under BLACKOUT the row stops offering a price and says why instead.
    const dark = rows.some((l) => l.includes('SIGNALS DOWN'));
    const offered = rows.some((l) => l.includes('SCOUT TARGET'));
    seen.push({ label: heading.replace('TODAY — ', '').trim(), dark, offered });
    if (dark && !darkShot) {
      await page.screenshot({ path: `screenshots/e2e-blackout${isMobile ? '-phone' : ''}.png` });
      darkShot = true;
    }
  }

  const distinct = new Set(seen.map((s) => s.label));
  check(
    `the rotation walks ${POOL} distinct days before repeating`,
    distinct.size === POOL,
    [...distinct].join(', '),
  );
  const blackouts = seen.filter((s) => s.label === 'BLACKOUT');
  check('exactly one of them is BLACKOUT', blackouts.length === 1, `${blackouts.length}`);
  check(
    'recon is refused on that day and only on that day',
    seen.length === POOL &&
      seen.every((s) =>
        s.label === 'BLACKOUT' ? s.dark && !s.offered : !s.dark && s.offered,
      ),
    seen.map((s) => `${s.label}${s.dark ? ' (dark)' : ''}`).join(' · '),
  );

  await browser.close();
  if (errors.length) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`LEAGUE FAILURES: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('LEAGUE OK: standing on the board, the rotation on the front.');
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
