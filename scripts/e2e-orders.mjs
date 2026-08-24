/**
 * Daily contracts (v1.12): three standing orders a day, filled by playing.
 *
 * The clock is pinned so the harness knows which three are posted, then it
 * fills one for real — laying wire, breaking ground, or whatever the day
 * happens to ask of the yard — and checks the payout landed. What a unit test
 * cannot show is the part that matters here: that the order fills through the
 * ordinary act of playing, and that the town says so when it does.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5210;
/** Monday 5 Jan 2026 00:00 UTC — LADDER_EPOCH in content/leagues.ts. */
const EPOCH = Date.UTC(2026, 0, 5);
const DAY = 24 * 3_600_000;

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
  const vh = size.height;
  const listAnchor = () =>
    page.evaluate(() => {
      const api = window.lastline;
      const all = api.buttons();
      if (!all.length) return null;
      const maxW = Math.max(...all.map((b) => b.w));
      const rows = all.filter((b) => b.w >= maxW - 2).sort((a, b) => a.y - b.y);
      if (!rows.length) return null;
      const row = rows[Math.floor(rows.length / 2)];
      return { x: (row.x + row.w / 2) / api.dpr, y: (row.y + row.h / 2) / api.dpr };
    });
  const cdp = isMobile ? await page.context().newCDPSession(page) : null;
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
    });
  const dragList = async (dy) => {
    const anchor = await listAnchor();
    if (!anchor) return false;
    const to = Math.min(vh - 8, Math.max(8, anchor.y + dy));
    if (cdp) {
      await touch('touchStart', anchor.x, anchor.y);
      for (let i = 1; i <= 10; i++) {
        await touch('touchMove', anchor.x, anchor.y + ((to - anchor.y) * i) / 10);
        await wait(16);
      }
      await touch('touchEnd', anchor.x, to);
    } else {
      await page.mouse.move(anchor.x, anchor.y);
      await page.mouse.down();
      await page.mouse.move(anchor.x, to, { steps: 14 });
      await page.mouse.up();
    }
    await wait(320);
    return true;
  };
  const tap = async (needle, settleMs = 700) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const hit = await find(needle);
      if (hit && hit.y > 6 && hit.y < vh - 6) {
        await page.mouse.click(hit.x, hit.y);
        await wait(settleMs);
        return true;
      }
      if (attempt > 0 && !(await dragList(-vh * 0.3))) await wait(250);
    }
    throw new Error(`no button matching "${needle}"`);
  };
  /**
   * Tap something that is supposed to OPEN something, and check that it did.
   * A single tap can be swallowed while the panel relays itself out, and a
   * harness that assumes otherwise reports a missing overlay as a missing
   * feature. Retrying is the difference between the two.
   */
  const tapOpen = async (needle, expect, tries = 3) => {
    for (let i = 0; i < tries; i++) {
      await tap(needle, 900);
      if ((await copy()).some((l) => expect.test(l))) return true;
    }
    return false;
  };
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copy = async () => (await texts()).flatMap((t) => t.split('\n')).map((l) => l.trim());
  /** Poll until a condition holds, or give up. Never a bare sleep. */
  const until = async (fn, deadlineMs) => {
    const stop = Date.now() + deadlineMs;
    for (;;) {
      if (await fn()) return true;
      if (Date.now() > stop) return false;
      await wait(120);
    }
  };
  const copyHas = async (needle) =>
    (await copy()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));
  const copyLike = async (needle) =>
    (await copy()).find((t) => t.toUpperCase().includes(needle.toUpperCase())) ?? '';

  mkdirSync('screenshots', { recursive: true });
  // Day 2 of the rotation: the yard is asked for wire, which the showcase base
  // has already laid — so this is also a check that ordinary building counts.
  await page.clock.setFixedTime(new Date(EPOCH + 2 * DAY + 10 * 3_600_000));
  await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
  await wait(2500);

  await tap('WAR', 800);
  const row = await rowLike('DAY ORDERS');
  check('the WAR tab posts the day orders', /\d\/3/.test(row), row);

  check('the sheet opens on three priced orders', await tapOpen('DAY ORDERS', /^(PAYS|PAID) \+/), '');
  const wire = await copyLike('WALL');
  check(
    'the showcase base filled the yard order just by being built',
    /FILLED/.test(wire),
    wire,
  );
  check(
    'and it says when the orders lapse',
    await copyHas('NEW ORDERS IN'),
    (await copyLike('NEW ORDERS IN')).slice(0, 60),
  );
  // Scope to the sheet's own pay lines: the WAR tab behind the scrim carries a
  // standing row, and reading that as an order paying standing is a bug in the
  // harness, not in the game.
  const payLines = (await copy()).filter((l) => /^(PAYS|PAID) /.test(l));
  check('every order is priced', payLines.length === 3, payLines.join(' | '));
  check(
    'and none of them pays standing',
    payLines.every((l) => /SUP/.test(l) && /FUEL/.test(l) && /INT/.test(l) && !/PTS/.test(l)),
    payLines[0] ?? '',
  );
  await page.screenshot({ path: `screenshots/e2e-orders${isMobile ? '-phone' : ''}.png` });
  await tap('CLOSE', 700);

  // Now fill one by PLAYING. Day 0 asks the front for two command posts, so
  // this fights two real raids in a real war and watches the order settle.
  await page.clock.setFixedTime(new Date(EPOCH + 10 * 3_600_000));
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    const town = save.town;
    town.supplies = 20000;
    town.fuel = 8000;
    town.intel = 400;
    town.unlocked = [...new Set([...town.unlocked, 'frontline', 'autocannon', 'barracks'])];
    town.army = { ranger: 24, engineer: 6, javelin: 6, abrams: 4 };
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);

  await tap('WAR', 800);
  check('a new war starts with the sheet blank', /0\/3/.test(await rowLike('DAY ORDERS')), '');
  // The HUD says SUPPLIES on a monitor and SUP on a phone; read either.
  const suppliesNow = async () => {
    const line = (await copy()).find((t) => /^SUP(PLIES)?\b/.test(t)) ?? '';
    return Number((line.match(/(\d[\d,]*)/) ?? [])[1]?.replace(/,/g, '') ?? 0);
  };
  const before = await suppliesNow();

  const raid = async () => {
    await tap('FRONT LINE', 1600);
    // First arrival at the planner gets the coach screen; its scrim swallows
    // taps meant for the panel underneath.
    if ((await labels()).some((l) => l.toUpperCase().includes('UNDERSTOOD'))) {
      await tap('UNDERSTOOD', 900);
    } else if ((await labels()).some((l) => l.toUpperCase() === 'CLOSE')) {
      await tap('CLOSE', 900);
    }
    await tap('SQUADS', 700);
    for (let i = 0; i < 5; i++) await tap('+ RANGER', 250);
    await tap('+ M1 ABRAMS', 400);
    await page.keyboard.press('Space');
    // Wait for the REPORT, not for a stopwatch. This used to sleep 2500ms and
    // then ask whether the post had fallen; on a loaded box the raid had not
    // finished resolving, so `took` came back false, the order was never
    // credited, and every check after it failed for a reason that had nothing
    // to do with day orders.
    await until(
      async () => await copyHas('COMMAND POST DESTROYED') || await copyHas('RAID REPELLED'),
      30000,
    );
    const took = await copyHas('COMMAND POST DESTROYED');
    await page.keyboard.press('Escape');
    // And wait to actually be back on the planner before the caller reads it.
    await until(async () => !(await copyHas('COMMAND POST DESTROYED')), 15000);
    await wait(400);
    return took;
  };

  const first = await raid();
  await tap('WAR', 800);
  check('one post is not the whole order', /0\/3/.test(await rowLike('DAY ORDERS')), first ? 'took it' : 'repelled');

  await raid();
  await tap('WAR', 800);
  const filledRow = await rowLike('DAY ORDERS');
  check('the second post fills the order', /1\/3/.test(filledRow), filledRow);
  const after = await suppliesNow();
  check('and it pays on the spot', after > before, `${before} → ${after} SUP`);

  // The banner is still up and also says FILLED, so match the sheet's own
  // line shape rather than the first thing on screen with the word in it.
  await tapOpen('DAY ORDERS', /^TAKE TWO POSTS/);
  const sheetLine = (await copy()).find((l) => /^TAKE TWO POSTS/.test(l)) ?? '';
  check('the sheet marks it filled', /FILLED$/.test(sheetLine), sheetLine || '(no sheet line)');
  check('and records what it paid rather than re-pricing it', await copyHas('PAID +'), '');
  await page.screenshot({ path: `screenshots/e2e-orders-paid${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`ORDERS FAILURES: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('ORDERS OK: three posted, priced, and dated.');
  }
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
