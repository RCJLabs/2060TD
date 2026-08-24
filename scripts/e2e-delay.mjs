/**
 * Ordered launch delays (v1.15): each formation crosses the line when its
 * commander said, not on a fixed six-second conveyor.
 *
 * The assertion that matters is the last pair. A picker that only changes its
 * own caption is decoration; this walks the picker, reads the number back off
 * the SQUAD ROW (a different row, drawn from the plan rather than from the
 * tap), and then launches the raid to prove the ordered clock reached the
 * battle instead of stopping at the UI.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5208;
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
  /**
   * The drawer only keeps rows it can actually draw, so a row further down the
   * list is not merely off-screen — it does not exist to `buttons()` yet. The
   * only way to reach one is to drag the list itself, starting from a row that
   * IS on screen, which is what the anchor is for.
   */
  const listAnchor = () =>
    page.evaluate(() => {
      const api = window.lastline;
      const all = api.buttons();
      if (!all.length) return null;
      // The drawer's rows are the widest things on screen — wider than the
      // launch button, far wider than a tab. An aspect-ratio filter looked
      // like it worked and did not: at dpr 3 it kept the launch button and
      // dropped every actual row, so the swipe started on the board.
      const maxW = Math.max(...all.map((b) => b.w));
      const rows = all.filter((b) => b.w >= maxW - 2).sort((a, b) => a.y - b.y);
      if (!rows.length) return null;
      // The MIDDLE row, not the last: on a phone the bottom row sits flush
      // against the tab bar, and a swipe that starts there grabs the tabs.
      const row = rows[Math.floor(rows.length / 2)];
      return { x: (row.x + row.w / 2) / api.dpr, y: (row.y + row.h / 2) / api.dpr };
    });
  // A touch-enabled page scrolls the drawer from touch events, not from a
  // mouse drag — a mouse drag on a phone viewport does nothing at all, which
  // is exactly how this harness first failed. Drive the swipe through CDP.
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
      // Hold still before letting go. The drawer has flick physics, and a swipe
      // released at speed carries the list to the bottom — which is fine when
      // the row you want IS at the bottom, and hopeless for a row in the
      // middle, like this one. A stationary finger has no velocity to give.
      await wait(140);
      await touch('touchMove', anchor.x, to);
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
      if (attempt > 0 && !(await dragList(-vh * 0.18))) await wait(250);
    }
    throw new Error(`no button matching "${needle}" on ${process.env.VIEWPORT ?? 'desktop'}`);
  };
  /**
   * Bring a row into existence before reading it. The drawer only keeps the
   * rows it can draw, so a row below the fold is not off-screen — it is absent
   * from `buttons()` entirely, and a read that does not scroll first reports it
   * missing rather than waiting for it.
   *
   * This one searches both ways. Everything else in the suite reaches for a row
   * at the bottom of a list and can afford to only scroll down; this harness
   * walks between the squad rows at the top and the picker below them, and a
   * one-way seeker can only ever reach one of the two.
   */
  const reveal = async (needle) => {
    for (const dy of [-vh * 0.18, vh * 0.18]) {
      for (let attempt = 0; attempt < 14; attempt++) {
        const hit = await find(needle);
        // Not merely present: far enough inside the drawer to be tappable.
        if (hit && hit.y > 40 && hit.y < vh - 40) return true;
        if (!(await dragList(dy))) await wait(250);
      }
    }
    return Boolean(await find(needle));
  };
  const tapRow = async (needle, settleMs = 400) => {
    if (!(await reveal(needle))) throw new Error(`no row matching "${needle}"`);
    return tap(needle, settleMs);
  };
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copyHas = async (needle) =>
    (await texts()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
  await wait(2500);

  await tap('SQUADS', 700);

  // ---- the picker starts where the plan already is ------------------------------
  // A picker whose opening value is not one of its own stops corrects itself on
  // the first tap instead of obeying it. The default plan must be sayable in the
  // picker's own vocabulary.
  const delayRow = async () => (await labels()).find((l) => l.startsWith('DELAY:')) ?? '';

  /**
   * Tap the picker and wait for the CAPTION to move, not for a stopwatch.
   *
   * The old form clicked and slept a fixed 320ms. Alone that was enough for
   * the row to re-render; run straight after another harness, on a loaded
   * machine, it was not — so the read came back with the value from BEFORE
   * the tap and the walk recorded `0 → 6 → 6 → 20`, a duplicate that looked
   * exactly like the picker skipping a stop. The harness was reporting its own
   * timing, not the game's behaviour.
   *
   * Waiting on the state the check needs is both faster in the common case
   * and immune to how busy the box is.
   */
  const stepPicker = async (deadlineMs = 4000) => {
    const before = await delayRow();
    if (!(await reveal('DELAY:'))) throw new Error('no DELAY: row');
    await tap('DELAY:', 0);
    const until = Date.now() + deadlineMs;
    for (;;) {
      const now = await delayRow();
      if (now !== before && now !== '') return now;
      if (Date.now() > until) {
        throw new Error(`picker never moved off "${before}" in ${deadlineMs}ms`);
      }
      await wait(40);
    }
  };
  const secondsOn = (row) => {
    const hit = /T\+(\d+)S/.exec(row.toUpperCase());
    return hit ? Number(hit[1]) : null;
  };
  // The squad rows are the plan's own account of itself: the sub on each row is
  // built from the stored delay, not from the picker. Read them before going
  // looking for the picker — on a phone the two are not on screen together.
  const subs = async () => {
    await reveal('HAMMER');
    return (await labels()).filter((l) => /·\s*T\+\d+S/i.test(l)).map((l) => secondsOn(l));
  };
  const opened = await subs();
  check(
    'the three slots open on a real stagger, 0 / 6 / 12',
    opened.length === 3 && opened[0] === 0 && opened[1] === 6 && opened[2] === 12,
    opened.join(' / '),
  );

  await reveal('DELAY:');
  const opening = await delayRow();
  check('and the picker agrees the lead formation is at T+0', secondsOn(opening) === 0, opening);

  // ---- the picker walks its stops and wraps -------------------------------------
  const walked = [secondsOn(opening)];
  for (let i = 0; i < 7; i++) walked.push(secondsOn(await stepPicker()));
  check(
    'the picker steps through seven stops and comes back round',
    new Set(walked).size === 7 && walked[7] === walked[0],
    walked.join(' → '),
  );

  // ---- the row the player reads follows the row the player taps -----------------
  // Two different rows, one fact. If only the picker moved, the plan did not.
  const ordered = secondsOn(await stepPicker()); // off 0, onto the first real stop
  const after = await subs();
  check(
    'the squad row picks up what the picker was told',
    ordered !== null && ordered > 0 && after[0] === ordered,
    `picker T+${ordered}s · row T+${after[0]}s`,
  );
  check('and the other two formations keep their own orders', after[1] === 6 && after[2] === 12, after.join(' / '));
  await page.screenshot({ path: `screenshots/e2e-delay-plan${isMobile ? '-phone' : ''}.png` });

  // ---- an order given late is a squad that arrives late --------------------------
  // Hold the lead formation to the top of the list, put units in it, and launch.
  // The replay is the raid's own record: if the ordered clock stopped at the UI,
  // the first shot of the battle would not wait for it.
  for (let i = 0; i < 8; i++) {
    await reveal('DELAY:');
    if (secondsOn(await delayRow()) === 60) break;
    await tapRow('DELAY:', 300);
  }
  check('the lead formation can be held a full minute', secondsOn(await delayRow()) === 60, await delayRow());
  const held = await subs();
  check('which the plan records against that slot alone', held[0] === 60 && held[1] === 6, held.join(' / '));

  await tapRow('+ RANGER', 260);
  await tapRow('+ RANGER', 260);
  await tapRow('+ M1 ABRAMS', 400);
  await page.keyboard.press('Space'); // LAUNCH
  await wait(2600);
  // The planner is still drawn behind the report, so scope this to the report's
  // own per-formation lines — the ones shaped "N/M back".
  const back = (await texts())
    .flatMap((t) => t.split('\n'))
    .filter((line) => /\d+\/\d+ back/i.test(line))
    .map((line) => line.trim());
  check(
    'the held formation still fought the raid it was held out of the start of',
    back.length === 1 && /^HAMMER\s+\d+\/3 back/.test(back[0] ?? ''),
    back.join(' ; ') || '(no formation line in the report)',
  );
  await page.screenshot({ path: `screenshots/e2e-delay-report${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} delay check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nDELAY OK: each formation crosses the line when it was told to.');
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
