/**
 * Gates (v1.17): the one thing in this game that edits the maze mid-fight.
 *
 * The unit tests prove the sim: closed is a wall, open is a hole, and A*
 * re-costs the moment it swings. What only a browser can prove is that the
 * lever is reachable — that a gate can be built in the yard, found on the
 * battlefield, and worked with a finger for CP while the shooting is going on.
 * So this one taps the MAP, not just the drawer, which is what the new
 * `lastline.cell()` seam is for.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5212;
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
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);

  // Tap a board cell by grid position — the seam that makes a map lever
  // testable at all.
  const tapCell = async (col, row, settleMs = 500) => {
    const at = await page.evaluate(
      ([c, r]) => {
        const api = window.lastline;
        const hit = api.cell(c, r);
        return hit ? { x: hit.x / api.dpr, y: hit.y / api.dpr } : null;
      },
      [col, row],
    );
    if (!at) throw new Error(`cell ${col},${row} is not on screen`);
    await page.mouse.click(at.x, at.y);
    await wait(settleMs);
    return true;
  };
  /**
   * Frame the board before reaching for a cell. The siege fits the whole map;
   * the town frames the base, which is a tighter view — so the town side of
   * this harness works in cells it can actually see rather than pretending the
   * whole grid is on screen.
   */
  const fitBoard = async () => {
    if ((await labels()).some((l) => l.toUpperCase().startsWith('FIT VIEW'))) {
      await tap('FIT VIEW', 700);
    }
  };
  /** The first candidate cell that is both on screen and free. */
  const layOn = async (candidates) => {
    await fitBoard();
    for (const [col, row] of candidates) {
      const before = (await savedWalls()).length;
      const at = await page.evaluate(
        ([c, r]) => {
          const api = window.lastline;
          const hit = api.cell(c, r);
          return hit ? { x: hit.x / api.dpr, y: hit.y / api.dpr } : null;
        },
        [col, row],
      );
      if (!at) continue;
      await page.mouse.click(at.x, at.y);
      await wait(600);
      if ((await savedWalls()).length > before) return [col, row];
    }
    return null;
  };
  const savedWalls = () =>
    page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
      return save.town.walls ?? [];
    });
  /**
   * Open a tab and make sure the drawer is actually showing rows.
   *
   * Re-tapping the tab that is already open COLLAPSES the drawer — the phone
   * gesture that hands the screen back to the battlefield. The town opens on
   * BUILD, so a harness that taps BUILD to "make sure" closes the thing it
   * came for, and every row it then looks for is missing rather than hidden.
   */
  const CHROME = 5; // the five tabs (the zoom keys went in v1.21)
  const openTab = async (name) => {
    await tap(name, 700);
    if ((await labels()).length <= CHROME) await tap(name, 700);
  };
  const rowLike = async (needle) => {
    await reveal(needle);
    return (await labels()).find((l) => l.toUpperCase().startsWith(needle.toUpperCase())) ?? '';
  };

  // ---- a gate is something you build in the yard ----------------------------------
  await openTab('BUILD');
  const gateRow = await rowLike('BUILD VEHICLE GATE');
  check('the wall line offers a gate, priced in segments', /2 SEG/.test(gateRow), gateRow);
  check('and says what a swing costs', /\d+CP\/SWING/.test(gateRow), gateRow);
  const wallRow = await rowLike('BUILD WALL');
  const segBefore = /(\d+)\/(\d+)/.exec(wallRow);

  await tapRow('BUILD VEHICLE GATE', 500);
  const laid = await layOn([
    [21, 8],
    [22, 8],
    [21, 16],
    [22, 16],
    [20, 9],
  ]);
  check('a gate goes down on the map', laid !== null, laid ? `at ${laid}` : 'no free cell in view');
  const walls = await savedWalls();
  check(
    'tapping the map lays a gate, and the save says so',
    walls.some((w) => w.kind === 'gate'),
    JSON.stringify(walls.slice(0, 3)),
  );
  const segAfter = /(\d+)\/(\d+)/.exec(await rowLike('BUILD WALL'));
  check(
    'and it spends two segments of the wall allowance, not one',
    segBefore !== null && segAfter !== null && Number(segAfter[1]) - Number(segBefore[1]) === 2,
    `${segBefore?.[1]} → ${segAfter?.[1]}`,
  );
  await page.screenshot({ path: `screenshots/e2e-gates-town${isMobile ? '-phone' : ''}.png` });

  // ---- and a lever you work in the fight -------------------------------------------
  await openTab('OPS');
  await tap('MISSION 1', 1600);
  await wait(2600); // the briefing reveals a line every 350ms
  await tap('COMMENCE', 2600);

  // Build one on the battlefield during setup, where the assault has to meet it.
  await tapRow('VEHICLE GATE', 600);
  await fitBoard();
  let built = null;
  for (const cell of [[10, 11], [11, 11], [10, 12]]) {
    try {
      await tapCell(cell[0], cell[1], 600);
      built = cell;
      break;
    } catch {
      /* that cell is off screen; try the next */
    }
  }
  await page.keyboard.press('Space'); // start the assault
  await wait(2000);

  const gateLever = async () => rowLike('WORK THE GATES');
  check('the fight offers the lever, and only now', /SHUT/.test(await gateLever()), await gateLever());
  const shutOf = (row) => {
    const hit = /(\d+)\/(\d+) SHUT/.exec(row.toUpperCase());
    return hit ? [Number(hit[1]), Number(hit[2])] : null;
  };
  const before = shutOf(await gateLever());
  check('with every gate standing shut', before !== null && before[0] === before[1], await gateLever());

  // Wait for the budget. A swing is priced in CP and CP accrues while the
  // shooting goes on, so the lever opens for business a few seconds into the
  // wave — which is the design, not a delay to paper over. Run the clock up so
  // the harness is not sitting through it in real time.
  for (let i = 0; i < 3; i++) await page.keyboard.press('S'); // speed ×8
  let armed = false;
  for (let i = 0; i < 40; i++) {
    const ready = await page.evaluate(() => {
      const row = window.lastline.buttons().find((b) => b.label.toUpperCase().includes('WORK THE GATES'));
      return row?.enabled === true;
    });
    if (ready) {
      armed = true;
      break;
    }
    await wait(400);
  }
  check('the lever opens for business once the CP is there', armed, await gateLever());
  await tapRow('WORK THE GATES', 500);
  // Find the gate the way a player does: by looking at the wall line. Both the
  // one carried in from the yard and the one built in setup are out there.
  const gateCells = [[21, 8], [10, 11], ...built ? [built] : []];
  let worked = null;
  for (const [col, row] of gateCells) {
    const at = await page.evaluate(
      ([c, r]) => {
        const api = window.lastline;
        const hit = api.cell(c, r);
        return hit ? { x: hit.x / api.dpr, y: hit.y / api.dpr } : null;
      },
      [col, row],
    );
    if (!at) continue;
    await page.mouse.click(at.x, at.y);
    await wait(800);
    const now = shutOf(await gateLever());
    if (now !== null && before !== null && now[0] === before[0] - 1) {
      worked = [col, row];
      break;
    }
  }
  const after = shutOf(await gateLever());
  check(
    'and a tap on the gate itself swings it open',
    worked !== null,
    `${before?.[0]}/${before?.[1]} → ${after?.[0]}/${after?.[1]}`,
  );
  await page.screenshot({ path: `screenshots/e2e-gates-siege${isMobile ? '-phone' : ''}.png` });

  if (worked) {
    // The tool stays armed, so the same tap swings it back — a gate is a lever,
    // not a one-way demolition.
    const at = await page.evaluate(
      ([c, r]) => {
        const api = window.lastline;
        const hit = api.cell(c, r);
        return { x: hit.x / api.dpr, y: hit.y / api.dpr };
      },
      worked,
    );
    await page.mouse.click(at.x, at.y);
    await wait(800);
    const shut = shutOf(await gateLever());
    check(
      'and another shuts it again',
      shut !== null && before !== null && shut[0] === before[0],
      `${after?.[0]} → ${shut?.[0]}`,
    );
  }

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} gate check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nGATES OK: built in the yard, found on the field, worked with a finger.');
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
