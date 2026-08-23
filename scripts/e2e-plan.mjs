/**
 * Reopening the last plan (v1.16). GDD 5.6 promised "the plan is saved with the
 * replay, so you can iterate on a failed plan directly"; the planner used to
 * open on three empty formations every time.
 *
 * This runs the whole loop on a REAL save rather than the demo town, because
 * the claim is about what survives a battle and a trip through localStorage:
 * write a plan nobody would arrive at by accident, fight it, walk home, walk
 * back — and find it still there, trimmed to the men who came back.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5210;
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
  const copyHas = async (needle) =>
    (await texts())
      .flatMap((t) => t.split('\n'))
      .some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  // A war far enough along to raid. The plan has to survive a real save, so
  // this is a war in a slot, not the showcase town.
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
    town.army = { ranger: 6, engineer: 2, javelin: 2, abrams: 1 };
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);

  const openPlanner = async () => {
    await tap('WAR', 700); // the front is on the war tab, not the build tab
    await tap('FRONT LINE', 1700);
    // First arrival gets the coach screen, whose scrim swallows taps meant for
    // the panel underneath. It lands a beat after the scene does, so this waits
    // for it rather than assuming one settle was enough.
    for (let i = 0; i < 8; i++) {
      const rows = (await labels()).map((l) => l.toUpperCase());
      if (rows.includes('UNDERSTOOD')) {
        await tap('UNDERSTOOD', 900);
        break;
      }
      if (rows.some((l) => l.startsWith('SQUADS'))) break;
      await wait(300);
    }
    await tap('SQUADS', 700);
  };
  const rowLike = async (needle) => {
    await reveal(needle);
    return (await labels()).find((l) => l.toUpperCase().startsWith(needle.toUpperCase())) ?? '';
  };
  const squadRows = async () => {
    await reveal('HAMMER');
    return (await labels()).filter((l) => /^(HAMMER|RONIN|TALON)\b/.test(l.toUpperCase()));
  };

  await openPlanner();
  check('the planner opens on empty formations the first time', 
    (await squadRows()).every((r) => /EMPTY/.test(r.toUpperCase())),
    (await squadRows()).join(' | '));

  // ---- write a plan nobody arrives at by accident ---------------------------------
  await tapRow('ENTRY:', 400);
  await tapRow('DOCTRINE:', 400);
  for (let i = 0; i < 4; i++) await tapRow('DELAY:', 320); // 0 → 30s
  const wroteEntry = await rowLike('ENTRY:');
  const wroteDoctrine = await rowLike('DOCTRINE:');
  const wroteDelay = await rowLike('DELAY:');
  check(
    'the lead formation takes a shape of its own',
    !/W1\b/.test(wroteEntry) && /T\+30S/.test(wroteDelay.toUpperCase()),
    `${wroteEntry} · ${wroteDoctrine} · ${wroteDelay}`,
  );
  for (let i = 0; i < 4; i++) await tapRow('+ RANGER', 240);
  await tapRow('+ M1 ABRAMS', 400);
  const wroteRows = await squadRows();
  check(
    'and it is loaded while the other two stay home',
    !/EMPTY/.test(wroteRows[0] ?? '') && /EMPTY/.test(wroteRows[1] ?? '') && /EMPTY/.test(wroteRows[2] ?? ''),
    wroteRows.join(' | '),
  );
  await page.screenshot({ path: `screenshots/e2e-plan-written${isMobile ? '-phone' : ''}.png` });

  // ---- fight it, walk home, walk back ---------------------------------------------
  await page.keyboard.press('Space'); // LAUNCH
  await wait(2600);
  check('the raid resolves', await copyHas('COMMAND POST'), '');
  await page.keyboard.press('Escape'); // RETURN TO BASE
  await wait(2200);
  await openPlanner();

  const backEntry = await rowLike('ENTRY:');
  const backDoctrine = await rowLike('DOCTRINE:');
  const backDelay = await rowLike('DELAY:');
  check('the entry comes back', backEntry === wroteEntry, `${wroteEntry} → ${backEntry}`);
  check('the doctrine comes back', backDoctrine === wroteDoctrine, `${wroteDoctrine} → ${backDoctrine}`);
  check('the ordered clock comes back', backDelay === wroteDelay, `${wroteDelay} → ${backDelay}`);
  const backRows = await squadRows();
  check(
    'the formation that went out is loaded again, and only that one',
    !/EMPTY/.test(backRows[0] ?? '') && /EMPTY/.test(backRows[1] ?? '') && /EMPTY/.test(backRows[2] ?? ''),
    backRows.join(' | '),
  );

  // The men are today's, not the ones the plan was written with. A raid spends
  // people, so what refills the shape is capped by the yard.
  const held = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    return save.town.army;
  });
  const planned = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    return save.town.lastPlan;
  });
  check('the plan itself is on disk, all three slots', Array.isArray(planned) && planned.length === 3,
    JSON.stringify(planned?.[0] ?? null));
  const shown = /(\d+)R/.exec((backRows[0] ?? '').toUpperCase());
  check(
    'and the rangers it fields are ones that actually came home',
    shown !== null && Number(shown[1]) <= (held.ranger ?? 0),
    `plan shows ${shown?.[1]}R, yard holds ${held.ranger ?? 0}`,
  );
  await page.screenshot({ path: `screenshots/e2e-plan-reopened${isMobile ? '-phone' : ''}.png` });

  // ---- and it can be thrown away ---------------------------------------------------
  await tapRow('NEW PLAN', 600);
  const wiped = await squadRows();
  check(
    'NEW PLAN wipes all three formations',
    wiped.length === 3 && wiped.every((r) => /EMPTY/.test(r.toUpperCase())),
    wiped.join(' | '),
  );
  check('and puts the lead formation back on T+0', /T\+0S/.test((await rowLike('DELAY:')).toUpperCase()),
    await rowLike('DELAY:'));

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} plan check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nPLAN OK: written, fought, and still there when you walk back in.');
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
