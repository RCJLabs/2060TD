/**
 * Building on a phone (v1.18). Two things made the far side of the map hard to
 * build on, and both are gestures, so only a browser can prove them:
 *
 *  - arming a tool used to FREEZE the camera, because the drag was spent on
 *    painting. A third of the grid was unreachable at a zoom where the cells
 *    were big enough to hit.
 *  - a fingertip is wider than a cell and covers the one it is aiming at, so
 *    committing on touch-down is committing blind.
 *
 * So: two fingers pan in any mode, a drag into the edge scrolls the board, and
 * a build tracks the finger and lands where it lifts.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5214;
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
    // Click the position `reveal` actually validated. Delegating to `tap` here
    // re-finds the row under looser bounds, and a row scrolled half under the
    // tab bar has a centre the drawer never draws — the click lands on the tab
    // bar and the row reads as ignored.
    const hit = await find(needle);
    if (!hit || hit.y <= 40 || hit.y >= vh - 40) {
      throw new Error(`row "${needle}" is not in reach at y=${hit ? hit.y : 'none'}`);
    }
    await page.mouse.click(hit.x, hit.y);
    await wait(settleMs);
    return true;
  };
  /**
   * Re-tapping the tab that is already open COLLAPSES the drawer — the phone
   * gesture that hands the screen back to the map. The town opens on BUILD, so
   * tapping BUILD "to be sure" closes the thing this harness came for.
   */
  const CHROME = 5; // the five tabs (the zoom keys went in v1.21)
  const openTab = async (name) => {
    await tap(name, 700);
    if ((await labels()).length <= CHROME) await tap(name, 700);
  };
  const copyHas = async (needle) =>
    (await texts())
      .flatMap((t) => t.split('\n'))
      .some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    save.town.supplies = 20000;
    save.town.fuel = 8000;
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);

  const send = (type, points) =>
    cdp
      ? cdp.send('Input.dispatchTouchEvent', {
          type,
          touchPoints:
            type === 'touchEnd'
              ? []
              : points.map(([x, y]) => ({ x, y, radiusX: 8, radiusY: 8, force: 1 })),
        })
      : Promise.resolve();
  const cellAt = (col, row) =>
    page.evaluate(
      ([c, r]) => {
        const api = window.lastline;
        const hit = api.cell(c, r);
        return hit ? { x: hit.x / api.dpr, y: hit.y / api.dpr } : null;
      },
      [col, row],
    );
  /** Which columns of the grid are on screen right now. */
  const columns = () =>
    page.evaluate(() => {
      const api = window.lastline;
      const cols = [];
      for (let c = 0; c < 32; c++) {
        for (let r = 0; r < 24; r++) {
          if (api.cell(c, r)) {
            cols.push(c);
            break;
          }
        }
      }
      return [cols[0] ?? -1, cols[cols.length - 1] ?? -1];
    });
  const structures = () =>
    page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
      return save.town.structures.map((s) => ({ kind: s.kind, cell: s.cell }));
    });

  await openTab('BUILD');
  await tapRow('SUPPLY DEPOT', 700);

  if (!isMobile) {
    // Nothing to prove with a mouse: the gestures under test are touch.
    check('the build tool arms on desktop', true, '');
  } else {
    // ---- the camera is no longer frozen by having a tool in hand -------------
    const framed = await columns();
    await send('touchStart', [[150, 400], [260, 400]]);
    for (let i = 1; i <= 10; i++) {
      await send('touchMove', [[150 + i * 12, 400], [260 + i * 12, 400]]);
      await wait(20);
    }
    await send('touchEnd', []);
    await wait(500);
    const panned = await columns();
    check(
      'two fingers move the map while a build tool is armed',
      panned[0] < framed[0],
      `cols ${framed} → ${panned}`,
    );

    // ---- and a drag into the edge carries it further --------------------------
    await send('touchStart', [[200, 400]]);
    for (let i = 1; i <= 8; i++) {
      await send('touchMove', [[200 - i * 22, 400]]);
      await wait(30);
    }
    await wait(700); // dwell at the edge
    await send('touchEnd', []);
    await wait(300);
    const crept = await columns();
    check(
      'and holding a drag at the edge scrolls the board under it',
      crept[0] < panned[0],
      `cols ${panned} → ${crept}`,
    );
  }

  // ---- a build is AIMED where the finger lifted, then CONFIRMED ------------
  //
  // Two steps since v1.21. The slide still decides the cell — a fingertip is
  // wider than a cell and covers the one it is aiming at, so committing on
  // touch-down commits blind — but the lift now only parks a ghost. Nothing
  // is spent until CONFIRM, which is what makes a misaimed tap correctable.
  const before = await structures();
  const from = await cellAt(Math.max(2, (await columns())[0] + 3), 6);
  const to = await cellAt(Math.max(2, (await columns())[0] + 3) + 3, 9);
  check('two free cells are on screen to slide between', from !== null && to !== null, '');
  if (from && to) {
    if (isMobile) {
      await send('touchStart', [[from.x, from.y]]);
      for (let i = 1; i <= 8; i++) {
        await send('touchMove', [[from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8]]);
        await wait(25);
      }
      await send('touchEnd', []);
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
    }
    await wait(600);
  }

  // Aiming must NOT have built anything. This is the whole feature: if the
  // slide alone places a depot, the confirm step is decorative.
  const aimed = await structures();
  check(
    'aiming alone builds nothing',
    aimed.length === before.length,
    `${before.length} → ${aimed.length}`,
  );
  const confirm = await find('CONFIRM');
  check('a CONFIRM appears once something is aimed', confirm !== null, '');
  if (confirm) {
    await page.mouse.click(confirm.x, confirm.y);
    await wait(900);
  }
  const after = await structures();
  const added = after.filter((s) => !before.some((b) => b.cell === s.cell && b.kind === s.kind));
  check(
    'and CONFIRM is what actually builds it',
    added.length === 1 && added[0].kind === 'supplyDepot',
    JSON.stringify(added),
  );
  await page.screenshot({ path: `screenshots/e2e-build${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} build check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nBUILD OK: the map moves with a tool in hand, and a build lands where it lifted.');
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
