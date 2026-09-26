/**
 * Veterancy (v1.9): the raid planner's three slots are three named formations
 * with records, and the battle report says who came back.
 *
 * The interesting assertion is the last one. Rank is only worth anything if
 * the player can see it move, so this launches a real raid on the demo save
 * and reads the per-squad line out of the report — the number the whole
 * feature exists to make expensive.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5206;
/**
 * The showcase's ground is made from the moment it loads, and a barracks sited
 * in its river is not built: so on some loads the showcase has no barracks,
 * and nothing to fit a specialisation at. The clock is pinned to a moment
 * whose showcase has one, which also makes every raid below the same battle.
 */
const AT = Date.UTC(2026, 0, 7, 9);
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
  /**
   * Wait for the UI to STOP CHANGING rather than for a fixed number of
   * milliseconds. Every harness used to tap and then sleep a constant, which is
   * a bet that the machine is not busy — and under load it is a bet the suite
   * loses: five different harnesses have failed in a batch and passed alone.
   * Two identical snapshots in a row means the scene has settled, so this is
   * also FASTER than the sleep it replaces in the common case.
   */
  const settle = async (budgetMs = 2500) => {
    const deadline = Date.now() + budgetMs;
    let prev = null;
    let stable = 0;
    while (Date.now() < deadline) {
      const now = await page
        .evaluate(() => {
          const api = window.lastline;
          return JSON.stringify([api.buttons().map((b) => b.label), api.texts()]);
        })
        .catch(() => null);
      if (now !== null && now === prev) {
        if (++stable >= 2) return true;
      } else {
        stable = 0;
        prev = now;
      }
      await wait(60);
    }
    return false;
  };
  const tap = async (needle, settleMs = 700) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const hit = await find(needle);
      if (hit && hit.y > 6 && hit.y < vh - 6) {
        await page.mouse.click(hit.x, hit.y);
        // The caller's number is a PATIENCE HINT now, not a duration.
        await settle(Math.max(2500, settleMs * 3));
        return true;
      }
      if (attempt > 0 && !(await dragList(-vh * 0.3))) await wait(250);
    }
    throw new Error(`no button matching "${needle}" on ${process.env.VIEWPORT ?? 'desktop'}`);
  };
  /** The sub of the first button whose label holds `needle`. */
  const subOf = async (needle) =>
    page.evaluate(
      (text) => window.lastline.buttons().find((b) => b.label.toUpperCase().includes(text))?.sub ?? '',
      needle.toUpperCase(),
    );
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copyHas = async (needle) =>
    (await texts()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });
  await page.clock.setFixedTime(new Date(AT));
  await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
  await wait(2500);

  // ---- the slots are formations -------------------------------------------------
  await tap('SQUADS', 700);
  const rows = (await labels()).map((l) => l.toUpperCase());
  const named = ['HAMMER', 'RONIN', 'TALON'].filter((n) => rows.some((l) => l.startsWith(n)));
  check(
    'the three raid slots carry USA call signs, not SQD1/2/3',
    named.length === 3,
    named.join(' · ') || rows.slice(0, 4).join(' | '),
  );
  check(
    'no slot still reads as a numbered squad',
    !rows.some((l) => /^SQD\d/.test(l)),
    '',
  );
  const hammer = await rowLike('HAMMER');
  check('and each one shows its rank', /\bGRN\b/.test(hammer), hammer);

  // ---- the record --------------------------------------------------------------
  const rankRow = await rowLike('RANK:');
  check('the orders block names the formation and its rank', /GREEN/.test(rankRow), rankRow);
  await tap('RANK:', 900);
  check('tapping it opens the file', await copyHas('EXPERIENCE'), '');
  check('which explains what losses cost', await copyHas('EXPERIENCE LIVES IN THE MEN'), '');
  await page.screenshot({ path: `screenshots/e2e-vet-record${isMobile ? '-phone' : ''}.png` });
  await tap('CLOSE', 700);
  check('and closes again', !(await copyHas('EXPERIENCE LIVES IN THE MEN')), '');

  // ---- the officers (M28) -------------------------------------------------------
  // HAMMER is still green, so nobody commands it; the showcase gives RONIN,
  // at LINE, a captain best on HUNT, the doctrine RONIN goes in on.
  check('a green squad says how an officer is made', await copyHas('NO OFFICER'), '');
  await tap('RONIN', 700);
  const officerRow = await rowLike('OFFICER:');
  check(
    'a squad at LINE has an officer in its orders, and what they are best at',
    /OFFICER: CPT [A-Z]\. [A-Z]+ · BEST ON HUNT/.test(officerRow),
    officerRow,
  );
  const onIt = await subOf('OFFICER:');
  check('on the officer’s own doctrine the squad gets the whole edge', /ON IT \+7%/.test(onIt), onIt);
  await tap('DOCTRINE:', 500);
  const offIt = await subOf('OFFICER:');
  check('and a third of it on other orders', /OFF IT \+2%/.test(offIt), offIt);
  await tap('DOCTRINE:', 500);
  await tap('DOCTRINE:', 500);
  const ronin = await subOf('RONIN');
  check('the squad row carries the officer’s grade', /\bCPT\b/.test(ronin), ronin);
  await tap('OFFICER:', 900);
  check('tapping the officer opens the squad’s file with theirs in it', await copyHas('RAIDS LED'), '');
  check('which says how an officer is lost', await copyHas('FALLS WITH A SQUAD THAT IS WIPED OUT'), '');
  await page.screenshot({ path: `screenshots/e2e-vet-officer${isMobile ? '-phone' : ''}.png` });
  await tap('CLOSE', 700);
  await tap('HAMMER', 700);

  // ---- the panel wraps rather than truncating (v1.13) ----------------------------
  // A squad row carries a name, an entry, a doctrine and a composition, and the
  // composition grows with every kind sent. It used to be cut off with an
  // ellipsis worked out from a character count; now the row grows instead.
  //
  // WHAT THIS NO LONGER CHECKS, AND WHY.
  //
  // Until v1.37 this block also asserted that the row GREW — that a squad
  // loaded with every kind wrapped onto a second line and the row got taller.
  // It passed for four releases because the longest label this screen can
  // produce, 36 characters, happened to overrun a desktop rail. Setting
  // labels in a condensed face bought about a fifth of their width back and
  // the same string now fits on one line, at every viewport down to 380 px
  // and with every kind the muster offers loaded.
  //
  // Nothing about the wrap is broken; the fixture had been relying on a
  // coincidence of string length, and would have gone on passing through a
  // real regression for as long as some roster somewhere stayed long enough.
  // Narrowing the window does not help, because a narrower rail drops to one
  // column and the row gets WIDER. So the assertion is gone rather than
  // contorted, and the loss is recorded rather than papered over: the
  // measure-then-place path in `Panel.relayoutRows` is now covered by the two
  // checks below (nothing truncated, nothing outside its row) and by reading
  // the screenshots, not by a positive test that it can grow.
  const rowShape = async () =>
    page.evaluate(() => {
      const api = window.lastline;
      const b = api.buttons().find((x) => /ASLT|HUNT|RAZE/.test(x.label));
      if (!b) return null;
      const t = api.textRects().find((r) => r.text === b.label);
      return {
        label: b.label,
        rowH: Math.round(b.h),
        textH: t ? Math.round(t.h) : -1,
        overflowY: t ? Math.round(t.y + t.h - (b.y + b.h)) : 0,
        overflowX: t ? Math.round(t.x + t.w - (b.x + b.w)) : 0,
      };
    });
  const empty = await rowShape();
  // The LABEL alone, not label-plus-sub: a muster row's sub is its remaining
  // free count, which changes the moment the row is tapped, so a needle built
  // from the pair stops matching the button it was read from.
  const kinds = await page.evaluate(() =>
    window
      .lastline.buttons()
      .map((b) => b.label)
      .filter((l) => l.startsWith('+ ')),
  );
  check('the muster offers something to load the squad with', kinds.length >= 5, `${kinds.length} kinds`);
  for (const kind of kinds) await tap(kind, 220);
  await wait(400);
  const loaded = await rowShape();
  check(
    'a long squad row is not cut off with an ellipsis',
    loaded !== null && !loaded.label.includes('\u2026'),
    loaded?.label ?? '(no row)',
  );
  check(
    'the row is at least as tall as the label it measured',
    loaded !== null && empty !== null && loaded.rowH >= loaded.textH && empty.rowH >= empty.textH,
    `row ${loaded?.rowH} >= text ${loaded?.textH} px across ${kinds.length} kinds`,
  );
  check(
    'and the label stays inside its own row',
    loaded !== null && loaded.overflowY <= 1 && loaded.overflowX <= 1,
    `y+${loaded?.overflowY} x+${loaded?.overflowX}`,
  );
  await tap('CLEAR SQUAD', 400);

  // ---- the armoury (M28 Phase 4) -------------------------------------------------
  // Each unit a choice of two specialisations, for good, paid in supplies and a
  // fitting at the facility that trains it. The clock is held still, so the
  // fitting's countdown is a number this can read, and then moved past it.
  const supplies = async () => {
    const line = (await texts()).find((t) => /SUP \d+/.test(t)) ?? '';
    return Number((/SUP (\d+)/.exec(line) ?? [])[1] ?? NaN);
  };
  await tap('MUSTER', 700);
  const offer = await subOf('BODY ARMOUR');
  check('under the training lines, each unit offers its pair with the price', offer === '600S 2H', offer);
  check('and says what each side does', /BODY ARMOUR — \+\d+% health, 10% slower/.test(await rowLike('BODY ARMOUR')), await rowLike('BODY ARMOUR'));
  const before = await supplies();
  await tap('BODY ARMOUR', 700);
  check('the first tap only says what the choice closes', await copyHas('FOR GOOD: ASSAULT KIT CLOSES'), '');
  check('and asks for a second', /AGAIN TO FIT/.test(await subOf('BODY ARMOUR')), await subOf('BODY ARMOUR'));
  check('nothing is spent on the first tap', (await supplies()) === before, `${before} -> ${await supplies()}`);
  await tap('BODY ARMOUR', 700);
  const fitting = (await texts()).find((t) => /RANGER SQUAD: BODY ARMOUR/.test(t)) ?? '';
  check('the second fits it, and the row counts the fitting down', /FITTING · 2:00:00/.test(fitting), fitting);
  check('and the pair is closed for good', (await find('ASSAULT KIT')) === null && (await find('BODY ARMOUR')) === null, '');
  check('paid for in supplies', before - (await supplies()) === 600, `${before} -> ${await supplies()}`);
  await page.screenshot({ path: `screenshots/e2e-vet-armoury${isMobile ? '-phone' : ''}.png` });
  await page.clock.setFixedTime(new Date(AT + 2 * 3_600_000 + 5_000));
  await settle();
  const fitted = (await texts()).find((t) => /RANGER SQUAD: BODY ARMOUR/.test(t)) ?? '';
  check('two hours on, it is fitted', /· FITTED$/.test(fitted), fitted);
  await tap('SQUADS', 700);

  // ---- the report names who came back -------------------------------------------
  await tap('+ RANGER', 300);
  await tap('+ RANGER', 300);
  await tap('+ RANGER', 300);
  await tap('+ M1 ABRAMS', 500);
  await page.keyboard.press('Space'); // LAUNCH
  await wait(2500);
  // The planner panel is still drawn behind the report, and its rows name all
  // three formations — so scope the assertion to the report's own squad lines
  // (the ones shaped "N/M back") rather than to everything on screen.
  const squadLines = (await texts())
    .flatMap((t) => t.split('\n'))
    .filter((line) => /\d+\/\d+ back/i.test(line))
    .map((line) => line.trim());
  check(
    'the battle report says how many of the formation walked back',
    squadLines.length === 1 && /^HAMMER\s+\d+\/4 back/.test(squadLines[0]),
    squadLines.join(' ; ') || '(no squad line in the report)',
  );
  check(
    'and it carries the rank the raid was fought at',
    /·\s*(GRN|LN|VET|CDR)/.test(squadLines[0] ?? ''),
    '',
  );
  // The rangers went out in the armour fitted above, and the report says so.
  check('and the specialisation the rangers went out fitted with', await copyHas('Fitted: RGR BODY ARMOUR'), '');
  await page.screenshot({ path: `screenshots/e2e-vet-report${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`VETERANCY FAILURES: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('VETERANCY OK: named formations, a readable file, and a loss line with names in it.');
  }
} finally {
  // A cleanup failure must not masquerade as a test result.
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
