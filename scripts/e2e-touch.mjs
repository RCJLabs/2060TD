/**
 * Touch-gesture regression suite for the panel drawer and overlays.
 *
 * A finger, unlike a mouse, sends no hover move between gestures — which is
 * how the v0.9 scroll bug hid: the pointer-up that ended a swipe was
 * swallowed by the row under the thumb, and the next touch was measured
 * against a stale anchor, snapping the list back to the top. Playwright's
 * mouse cannot express that, so these checks drive real touch events through
 * CDP.
 *
 * Covers: a swipe scrolls, a second swipe continues rather than jumping, the
 * list reaches its end and comes back, a drag across a row never fires it, a
 * tap does, and a gesture over a modal never reaches the screen beneath it.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5198;
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
  const page = await browser.newPage({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
    });
  const swipe = async (x, fromY, toY, steps = 8) => {
    await touch('touchStart', x, fromY);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', x, fromY + ((toY - fromY) * i) / steps);
      await wait(16);
    }
    await touch('touchEnd', x, toY);
    await wait(320);
  };
  const tap = async (x, y) => {
    await touch('touchStart', x, y);
    await wait(70);
    await touch('touchEnd', x, y);
    await wait(500);
  };
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit
        ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr, label: hit.label }
        : null;
    }, needle.toUpperCase());
  /** Top of a named row in CSS px — the scroll position, observed. */
  const rowTop = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? Math.round(hit.y / api.dpr) : null;
    }, needle.toUpperCase());
  const labelOf = (prefix) =>
    page.evaluate((p) => window.lastline.buttons().find((b) => b.label.startsWith(p))?.label ?? null, prefix);

  await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
  await wait(2500);
  const X = 206;

  // Short swipes, so the row being measured stays on screen throughout.
  const start = await rowTop('SUPPLY DEPOT');
  await swipe(X, 700, 640);
  const afterFirst = await rowTop('SUPPLY DEPOT');
  check(
    'a swipe scrolls the drawer',
    afterFirst !== null && start - afterFirst >= 40,
    `${start} → ${afterFirst}`,
  );

  // The gesture that used to snap the list back to the top: a fresh touch
  // after a release the row under the thumb swallowed.
  //
  // The second swipe is a REAL swipe (60px, like the first) and was 20px
  // until v1.29. Twenty px is under the drag slop plus rounding, so it only
  // ever registered because the FIRST swipe's flick was still coasting and
  // compounded into it — this check was quietly measuring the coast, not the
  // swipe. Once a finger on a coasting list started stopping it, the way it
  // does on every phone, the compounding went away and the check failed on
  // correct behaviour.
  //
  // null means the anchor scrolled off the top, which is still forward: the
  // failure this guards against is the list snapping BACK toward the top.
  await swipe(X, 800, 740);
  const afterSecond = await rowTop('SUPPLY DEPOT');
  check(
    'a second swipe continues instead of jumping',
    afterSecond === null || afterSecond < afterFirst,
    `${afterFirst} → ${afterSecond ?? 'scrolled past'}`,
  );

  for (let i = 0; i < 6; i++) await swipe(X, 820, 560);
  const last = await rowTop('ERASE WALL');
  check('the last row can be reached', last !== null && last < 915, `ERASE WALL at ${last}`);

  for (let i = 0; i < 8; i++) await swipe(X, 560, 820);
  const home = await rowTop('SUPPLY DEPOT');
  check('swiping back reaches the top again', home === start, `${home} vs ${start}`);

  // Tap vs drag, read off a row that reports its own state: ABANDON BASE
  // arms on the first tap, so a tap is visible and costs nothing.
  await tap((await find('SYS')).x, (await find('SYS')).y);
  const atRest = await labelOf('ABANDON');
  const row = await find('ABANDON');
  await swipe(row.x, row.y, row.y - 88);
  check('dragging across a row does not fire it', (await labelOf('ABANDON')) === atRest, atRest);
  const again = (await find('ABANDON')) ?? (await find('TAP AGAIN'));
  await tap(again.x, again.y);
  check(
    'tapping a row still fires it',
    (await labelOf('TAP AGAIN')) !== null,
    (await labelOf('TAP AGAIN')) ?? 'nothing armed',
  );

  // Every row keeps its own label inside its own rectangle (v1.13). Rows used
  // to guarantee this by CUTTING the label with an ellipsis; they guarantee it
  // by wrapping now, and this is the check that says so for every row on
  // screen rather than for the one the last change happened to touch.
  const spill = await page.evaluate(() => {
    const api = window.lastline;
    const rects = api.textRects();
    const worst = [];
    for (const b of api.buttons()) {
      const t = rects.find((r) => r.text === b.label);
      if (!t) continue;
      // A couple of device px of glyph overhang is antialiasing, not a spill.
      const dy = Math.round(t.y + t.h - (b.y + b.h));
      const dx = Math.round(t.x + t.w - (b.x + b.w));
      if (dy > 3 || dx > 3) worst.push(`${b.label.slice(0, 22)} y+${dy} x+${dx}`);
    }
    return { rows: api.buttons().length, worst };
  });
  check(
    'no row label spills out of its row',
    spill.worst.length === 0,
    spill.worst.slice(0, 3).join(' | ') || `${spill.rows} rows, all contained`,
  );
  check('and none of them is cut off with an ellipsis', !(await labelOf('\u2026')), '');

  // A modal owns the gesture: nothing behind it may move.
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);
  const behind = await rowTop('SUPPLY DEPOT');
  await swipe(X, 700, 520);
  check('a swipe over a modal leaves the screen behind it alone', (await rowTop('SUPPLY DEPOT')) === behind, `${behind}`);

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} touch check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nTOUCH OK: drawer scrolling, flick, tap-vs-drag and modal isolation all behave.');
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
