/**
 * The drawer's grab handle (v1.27).
 *
 * Through v1.26 the only way to collapse the portrait drawer was to re-tap the
 * ACTIVE tab — a real gesture with nothing on screen to suggest it, which is
 * as good as no gesture at all. The handle replaces that with something you
 * can see and drag, and the drawer's height stopped being a boolean so a drag
 * has intermediate values to land on.
 *
 * Driven through CDP touch rather than `page.mouse`, because the handle shares
 * a screen with a list that scrolls and a board that pans, and the interesting
 * failures are all about which of the three claims a finger. A mouse cannot
 * express those.
 *
 * What the drawer is at is read from the LAYOUT rather than from a field on a
 * scene: `list.h` and the board's height are what the player actually sees, and
 * a state variable that agrees with itself while the rects disagree is exactly
 * the bug worth catching.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5243;
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

  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
    });

  await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
  await wait(2600);

  /** The drawer as the player sees it: rects, in CSS px. */
  const shape = async () => {
    const raw = await page.evaluate(() => {
      const api = window.lastline;
      const l = api.layout ? api.layout() : null;
      return l ? { dpr: api.dpr, board: l.board, list: l.list, handle: l.handle } : null;
    });
    if (!raw) return null;
    const to = (r) => ({ x: r.x / raw.dpr, y: r.y / raw.dpr, w: r.w / raw.dpr, h: r.h / raw.dpr });
    return { board: to(raw.board), list: to(raw.list), handle: to(raw.handle) };
  };

  const start = await shape();
  check('the drawer has a grab handle', start !== null && start.handle.h > 0, JSON.stringify(start?.handle));
  if (!start) throw new Error('no layout');

  // The handle is a target like any other: a thumb has to be able to hit it.
  check(
    'and the handle is tall enough to catch a thumb',
    start.handle.h >= 18,
    `${start.handle.h.toFixed(0)}px tall, ${start.handle.w.toFixed(0)} wide`,
  );

  const grabAt = () => ({
    x: start.handle.x + start.handle.w / 2,
    y: 0, // filled per-use from the CURRENT handle position
  });

  const drag = async (dy, steps = 8) => {
    const now = await shape();
    const at = grabAt();
    at.y = now.handle.y + now.handle.h / 2;
    await touch('touchStart', at.x, at.y);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', at.x, at.y + (dy * i) / steps);
      await wait(16);
    }
    await touch('touchEnd', at.x, at.y + dy);
    await wait(500);
    return shape();
  };

  // ---- dragging up grows the drawer and shrinks the board -----------------
  const grown = await drag(-260);
  check(
    'dragging the handle up grows the drawer',
    grown.list.h > start.list.h + 20,
    `list ${start.list.h.toFixed(0)} → ${grown.list.h.toFixed(0)}px`,
  );
  check(
    'and the board gives up exactly that room',
    grown.board.h < start.board.h - 20,
    `board ${start.board.h.toFixed(0)} → ${grown.board.h.toFixed(0)}px`,
  );

  // ---- and it lands on a detent, not wherever the finger stopped ----------
  //
  // The obvious check — two drags of the same length ending at the same height
  // — is wrong, and was wrong here first: two equal drags from DIFFERENT
  // starting heights legitimately land on different detents, so it failed on
  // correct behaviour. The honest property is that a nudge too small to reach
  // the next detent comes back to exactly where it began. Without a snap the
  // drawer would simply sit wherever the nudge left it.
  const before = await shape();
  const nudged = await drag(-34);
  check(
    'a nudge too small to reach the next detent springs back',
    Math.abs(nudged.list.h - before.list.h) < 2,
    `${before.list.h.toFixed(0)}px → ${nudged.list.h.toFixed(0)}px`,
  );

  // The board never disappears, however hard the drawer is pulled up: this is
  // a map game, and a drag that covers the board is a way to lose the thing
  // you are playing on. Measured at 22px before the floor existed. Dragged
  // FAR past any detent so the result is the clamp rather than a snap.
  const grownFully = await drag(-900);
  check(
    'and pulling it all the way up still leaves a board',
    grownFully.board.h > 90,
    `board ${grownFully.board.h.toFixed(0)}px`,
  );

  const shut = await drag(900);
  check(
    'and dragging down all the way hands the screen to the board',
    shut.list.h < 4 && shut.board.h > start.board.h + 100,
    `list ${shut.list.h.toFixed(0)}px, board ${shut.board.h.toFixed(0)}px`,
  );

  // ---- a tap on the handle toggles ---------------------------------------
  const closed = await shape();
  const tapAt = { x: closed.handle.x + closed.handle.w / 2, y: closed.handle.y + closed.handle.h / 2 };
  await touch('touchStart', tapAt.x, tapAt.y);
  await touch('touchEnd', tapAt.x, tapAt.y);
  await wait(500);
  const tapped = await shape();
  check(
    'a tap on the handle brings a shut drawer back',
    tapped.list.h > closed.list.h + 20,
    `list ${closed.list.h.toFixed(0)} → ${tapped.list.h.toFixed(0)}px`,
  );

  // ---- the handle does not eat the list's scroll --------------------------
  // The failure this guards against is the one that has bitten this project
  // twice: one finger driving two things. A drag that starts on a ROW must
  // scroll the list and leave the drawer's height alone.
  const settled = await shape();
  const rowY = settled.list.y + settled.list.h * 0.6;
  const rowX = settled.list.x + settled.list.w / 2;
  await touch('touchStart', rowX, rowY);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', rowX, rowY - (90 * i) / 6);
    await wait(16);
  }
  await touch('touchEnd', rowX, rowY - 90);
  await wait(600);
  const afterScroll = await shape();
  const scrolled = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
  check(
    'a drag on a row scrolls the list',
    scrolled > 5,
    `scrollY ${Math.round(scrolled)}`,
  );
  check(
    'and leaves the drawer where it was',
    Math.abs(afterScroll.list.h - settled.list.h) < 2,
    `list ${settled.list.h.toFixed(0)} → ${afterScroll.list.h.toFixed(0)}px`,
  );

  check('no page errors', errors.length === 0, errors[0] ?? '');
  await browser.close();
} finally {
  try {
    process.kill(-vite.pid);
  } catch {
    /* already gone */
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} drawer check(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nthe drawer behaves like a drawer.');
