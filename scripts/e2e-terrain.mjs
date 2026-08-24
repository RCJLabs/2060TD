/**
 * The ground (v1.19): terrain you can see, and cannot build in.
 *
 * The sim suite proves the field itself — determinism, the invariants, what
 * water and canopy and height do to a battle. What only a browser can prove
 * is that the ground reached the SCREEN and reached the INPUT: that the sheet
 * renders without stranding an object outside both cameras, that a river cell
 * refuses a building, and that the dry cell beside it still takes one.
 *
 * So this one taps the MAP rather than the drawer, which is what the
 * `lastline.cell()` seam is for.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5233;
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
    // The town's BUILD tab is the longest list in the game — every structure,
    // then the wall line under them — so this seeker gets a longer leash than
    // the ones that only ever walk a planner.
    for (const dy of [-vh * 0.18, vh * 0.18]) {
      for (let attempt = 0; attempt < 30; attempt++) {
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
    // A seed whose river runs through the BASE, not merely through the map.
    // The town opens framed on the yard, so a river on the far side is a
    // river the harness cannot reach — `cell()` correctly reports those cells
    // as off screen, and the test fails for camera reasons rather than
    // terrain ones. Picking the seed is the point: the harness needs a known
    // wet cell where the player is actually looking.
    save.town.terrainSeed = 1;
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);

  const savedWalls = () =>
    page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
      return save.town.walls ?? [];
    });
  const tapCell = async (col, row, settleMs = 500) => {
    const at = await page.evaluate(
      ([c, r]) => {
        const api = window.lastline;
        const hit = api.cell(c, r);
        return hit ? { x: hit.x / api.dpr, y: hit.y / api.dpr } : null;
      },
      [col, row],
    );
    if (!at) return false;
    await page.mouse.click(at.x, at.y);
    await wait(settleMs);
    return true;
  };
  const CHROME = 5; // the five tabs (the zoom keys went in v1.21)
  const openTab = async (name) => {
    await tap(name, 700);
    if ((await labels()).length <= CHROME) await tap(name, 700);
  };
  /**
   * Widen to the whole sheet.
   *
   * The town opens framed on the BASE, and the river on this seed runs down
   * the far side of the map — so every wet cell is off screen and `cell()`
   * correctly reports it as unreachable. The FIT VIEW button names the state
   * it will switch TO, so tapping it while it offers WHOLE MAP is what gets
   * the rest of the sheet in view.
   */
  const showWholeMap = async () => {
    for (let i = 0; i < 3; i++) {
      const label = (await labels()).find((l) => l.toUpperCase().startsWith('FIT VIEW'));
      if (!label) return;
      if (!label.toUpperCase().includes('WHOLE MAP')) return;
      await tap('FIT VIEW', 700);
    }
  };

  // ---- the sheet is on the board, not loose in the scene --------------------------
  // The ground is the first texture this codebase has ever had, and a texture
  // added to the scene root instead of the world container renders TWICE —
  // once per camera. That is the failure boardStrays() exists to catch.
  const strays = await page.evaluate(() => window.lastline.strays());
  check('the sheet rides the board layer, not the scene root', strays.length === 0, strays.join(', '));

  // ---- water refuses a building, dry ground beside it takes one -------------------
  // Ask the sim which cells are wet rather than hard-coding them: the seed is
  // pinned, but the generator is allowed to improve, and a harness that
  // encodes one generator's output fails for the wrong reason later.
  const wet = await page.evaluate(() => {
    const api = window.lastline;
    const out = [];
    // Search the frame the town opens on, not the whole sheet.
    for (let row = 6; row <= 17 && out.length < 6; row++) {
      for (let col = 19; col <= 29; col++) {
        if (api.wet && api.wet(col, row)) {
          out.push([col, row]);
          break;
        }
      }
    }
    return out;
  });
  check('the sheet under this war actually has water on it', wet.length > 0, JSON.stringify(wet));

  await openTab('BUILD');
  await tap('BUILD WALL', 500);
  await showWholeMap();

  let refused = null;
  let tapped = 0;
  let builtOnWater = null;
  for (const [col, row] of wet) {
    const before = (await savedWalls()).length;
    if (!(await tapCell(col, row, 500))) continue;
    tapped++;
    if ((await savedWalls()).length === before) {
      refused = [col, row];
      break;
    }
    builtOnWater = [col, row];
  }
  check(
    'a river cell refuses a wall',
    refused !== null,
    refused
      ? `tapped ${refused} and nothing was laid`
      : builtOnWater
        ? `a wall WENT DOWN in the river at ${builtOnWater}`
        : `none of the ${wet.length} wet cells were reachable on screen`,
  );
  check('and the taps actually reached the map', tapped > 0, `${tapped} of ${wet.length} landed`);

  // The ban has to be specific, or "nothing built" would pass for a broken
  // build tool rather than for terrain.
  let laid = null;
  if (refused) {
    for (let dx = 2; dx <= 6 && !laid; dx++) {
      for (const dy of [0, -1, 1]) {
        const col = refused[0] + dx;
        const row = refused[1] + dy;
        const before = (await savedWalls()).length;
        if (!(await tapCell(col, row, 500))) continue;
        if ((await savedWalls()).length > before) {
          laid = [col, row];
          break;
        }
      }
    }
  }
  check('and dry ground a few cells over takes one', laid !== null, laid ? `at ${laid}` : 'none');

  await page.screenshot({ path: `screenshots/e2e-terrain-town${isMobile ? '-phone' : ''}.png` });

  // ---- and the ground survives contact --------------------------------------------
  await openTab('OPS');
  await tap('MISSION 1', 1600);
  await wait(2600); // the briefing reveals a line every 350ms
  await tap('COMMENCE', 2600);
  const inBattle = await page.evaluate(() => window.lastline.strays());
  check('the battle sheet is on the board layer too', inBattle.length === 0, inBattle.join(', '));
  await page.keyboard.press('Space');
  for (let i = 0; i < 3; i++) await page.keyboard.press('S'); // speed ×8

  /**
   * Wait for a CONDITION rather than for a stopwatch.
   *
   * This check used to sleep four seconds and then ask whether the word WAVE
   * was on screen. That is not the claim in its own name, and it failed on a
   * loaded machine for reasons that had nothing to do with terrain — the
   * briefing and the commence step ahead of it are also fixed sleeps, so a
   * slow box simply had not reached the battle yet.
   */
  const until = async (fn, deadlineMs) => {
    const stop = Date.now() + deadlineMs;
    for (;;) {
      if (await fn()) return true;
      if (Date.now() > stop) return false;
      await wait(120);
    }
  };
  const phaseLine = async () =>
    (await texts()).find((t) => /WAVE \d+\/\d+|PREP —|SECTOR HELD|CC DESTROYED/.test(t)) ?? '';

  check(
    'the assault reaches its first wave',
    await until(async () => /WAVE \d+\/\d+|SECTOR HELD|CC DESTROYED/.test(await phaseLine()), 20000),
    await phaseLine(),
  );
  // The real claim. A force that cannot cross the water never finishes wave
  // one, so the battle sits on WAVE 1 — CONTACT until the harness gives up.
  // Anything past it (prep for the next wave, a later wave, or an outcome)
  // means they got there and died, which is the whole point.
  // 120s, sized from measurement rather than taste: the same battle on the
  // same box was watched resolving in 20s on one run and 50s on the next,
  // because the speed-up does not always take. A deadline near the fast case
  // is a coin flip, and this one only ever waits the full two minutes when
  // something is actually wrong.
  check(
    'nobody is stranded on the far bank — the first wave resolves',
    await until(
      async () => /PREP —|WAVE [2-9]\/|SECTOR HELD|CC DESTROYED/.test(await phaseLine()),
      120000,
    ),
    await phaseLine(),
  );
  await page.screenshot({ path: `screenshots/e2e-terrain-siege${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} terrain check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nTERRAIN OK: the sheet renders on the board, and the river refuses a wall.');
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
