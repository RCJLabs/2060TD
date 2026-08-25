/**
 * The drawer's grab handle and the tab swipe (v1.27-8).
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

  // ---- swiping across the list changes tab -------------------------------
  //
  // The axis lock is the whole feature. A list that scrolls one way and swipes
  // the other has to decide once, early, which a finger meant — so these check
  // both directions AND that each leaves the other alone.
  const swipe = async (dx) => {
    const at = await shape();
    const y = at.list.y + at.list.h * 0.5;
    const x = at.list.x + at.list.w * (dx < 0 ? 0.75 : 0.25);
    await touch('touchStart', x, y);
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', x + (dx * i) / 8, y);
      await wait(16);
    }
    await touch('touchEnd', x + dx, y);
    await wait(500);
  };

  const firstTab = await page.evaluate(() => window.lastline.tab?.() ?? null);
  check('the panel reports its tab', firstTab !== null, firstTab ?? 'no seam');
  await swipe(-160);
  const afterLeft = await page.evaluate(() => window.lastline.tab?.() ?? null);
  check(
    'a swipe left moves to the next tab',
    afterLeft !== null && afterLeft !== firstTab,
    `${firstTab} → ${afterLeft}`,
  );
  await swipe(160);
  const afterRight = await page.evaluate(() => window.lastline.tab?.() ?? null);
  check(
    'and a swipe right comes back',
    // Paired with the outward leg on purpose: `afterRight === firstTab` is
    // satisfied by nothing having happened at all, which is how this passed
    // while the swipe was being dropped.
    afterLeft !== firstTab && afterRight === firstTab,
    `${afterLeft} → ${afterRight}`,
  );

  // The lock, from the other side: a scroll must scroll and must NOT change
  // tab.
  //
  // Deliberately DIAGONAL, and that is the whole value of this check. A
  // perfectly vertical drag has dx = 0, so it cannot change tab whether the
  // axis lock exists or not — the check passed against a build with no lock
  // at all, which makes it worth nothing. A thumb dragging down a phone
  // drifts sideways, and 70px of drift is past the swipe threshold: this
  // fails the moment the tie-break stops favouring the scroll.
  const beforeScroll = await page.evaluate(() => window.lastline.tab?.() ?? null);
  const scrollWas = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
  const box = await shape();
  const vy = box.list.y + box.list.h * 0.6;
  const vx = box.list.x + box.list.w * 0.7;
  await touch('touchStart', vx, vy);
  for (let i = 1; i <= 8; i++) {
    // Drifting LEFT, so a build that loses the lock lands on a tab that
    // exists: drifting right off the FIRST tab clamps, and the check would
    // then only fail on its scroll half.
    await touch('touchMove', vx - (70 * i) / 8, vy - (140 * i) / 8);
    await wait(16);
  }
  await touch('touchEnd', vx - 70, vy - 140);
  await wait(600);
  const tabAfter = await page.evaluate(() => window.lastline.tab?.() ?? null);
  const scrollNow = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
  check(
    'a drag that drifts sideways still scrolls and keeps its tab',
    tabAfter === beforeScroll && scrollNow !== scrollWas,
    `${beforeScroll} → ${tabAfter}, scrollY ${Math.round(scrollWas)} → ${Math.round(scrollNow)}`,
  );

  // ---- a row's second action -----------------------------------------------
  //
  // A build row's tap picks the tool; its HOLD says what the thing does. Both
  // are driven here because the interesting failure is the pair: a hold that
  // also fires the tap would select a tool the player only asked to read
  // about, and a tap that waits for the hold timer would make the whole list
  // feel slow.
  const cardOpen = () =>
    page.evaluate(() => window.lastline.buttons().some((b) => b.label === 'CLOSE'));

  const at = await shape();
  // The first BUILD row, found by its rect rather than by counting: rows
  // scroll, and an index is wrong the moment the list has moved.
  const rowOf = async (label) => {
    const b = await page.evaluate((want) => {
      const hit = window.lastline
        .buttons()
        .find((x) => x.label === want && x.w > 0 && x.h > 0);
      return hit ? { x: hit.x, y: hit.y, w: hit.w, h: hit.h, dpr: window.lastline.dpr } : null;
    }, label);
    return b ? { x: (b.x + b.w / 2) / b.dpr, y: (b.y + b.h / 2) / b.dpr } : null;
  };

  // Back to the top of the list, so the row under the finger is a BUILD row
  // and not whatever the earlier checks scrolled to. Dragged rather than set
  // through a seam: there is no seam that moves the scroll, and inventing one
  // for a harness would test a path the player never takes.
  for (let n = 0; n < 4; n++) {
    const topY = at.list.y + at.list.h * 0.3;
    const topX = at.list.x + at.list.w / 2;
    await touch('touchStart', topX, topY);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', topX, topY + (160 * i) / 6);
      await wait(16);
    }
    await touch('touchEnd', topX, topY + 160);
    await wait(200);
  }
  await wait(600);

  const firstRow = await page.evaluate(() => {
    const dpr = window.lastline.dpr;
    const l = window.lastline.layout();
    // Topmost row INSIDE the list, by geometry. The button pool is a Set in
    // creation order, which is not the order they are drawn in once rows have
    // been recycled — reading [0] would pick whichever slot happened to be
    // built first.
    const rows = window.lastline
      .buttons()
      .filter((b) => b.y >= l.list.y && b.y + b.h <= l.list.y + l.list.h && b.label !== '')
      .sort((a, b) => a.y - b.y);
    if (rows.length === 0) return null;
    const r = rows[0];
    return { x: (r.x + r.w / 2) / dpr, y: (r.y + r.h / 2) / dpr, label: r.label };
  });
  check('there is a build row to press', firstRow !== null, firstRow?.label ?? 'none');

  if (firstRow) {
    // A tap: down, up, no waiting. Must NOT open the card.
    await touch('touchStart', firstRow.x, firstRow.y);
    await touch('touchEnd', firstRow.x, firstRow.y);
    await wait(400);
    check('a tap on a row does not open its card', !(await cardOpen()), firstRow.label);

    // A hold: down, stay still past the threshold, then up.
    const armedBefore = await page.evaluate(
      (want) => window.lastline.buttons().some((b) => b.label === want && b.active),
      firstRow.label,
    );
    await touch('touchStart', firstRow.x, firstRow.y);
    await wait(900);
    const openedWhileDown = await cardOpen();
    await touch('touchEnd', firstRow.x, firstRow.y);
    await wait(400);
    check(
      'holding a row opens its card',
      openedWhileDown && (await cardOpen()),
      `${firstRow.label} — ${openedWhileDown ? 'opened under the finger' : 'nothing while held'}`,
    );
    // Fired under the finger, not on the lift: a long press that only resolves
    // when you let go gives no way to tell it worked, and the player lifts.
    check('and it opens while the finger is still down', openedWhileDown, '');

    // The card carries the numbers that were nowhere on screen before: HP, a
    // price, and — for anything that shoots or produces — what it actually
    // does. `NOT BUILDABLE` is called out by name because that is what the
    // card said over a supply depot when it read only the sim profile, and a
    // card that lies about a price is worse than no card.
    const spec = await page.evaluate(() => window.lastline.texts().join(' | '));
    check(
      'and the card prices the thing and says what it does',
      /\d+ HP/.test(spec) && /\d+S/.test(spec) && !/NOT BUILDABLE/.test(spec),
      spec.slice(spec.indexOf('BUILD | BASE') + 30, spec.indexOf('BUILD | BASE') + 260),
    );

    // The other half of "a press is one thing or the other": the hold must not
    // ALSO have fired the tap. Compared against the state BEFORE the hold
    // rather than asserted false, because the tap check above already armed
    // this row — and comparing catches the failure in both directions, since
    // selecting an armed tool a second time toggles it back off.
    const armedAfter = await page.evaluate(
      (want) => window.lastline.buttons().some((b) => b.label === want && b.active),
      firstRow.label,
    );
    // This is also what pins the press-identity fix in `makeButton`: a button
    // whose press ended without a scene-level up used to keep believing it was
    // held, and the next up ANYWHERE fired it — measured two gestures and five
    // seconds later, on a row the finger had long left. The hold is the
    // reliable way to reach that state, because opening a card puts a scrim
    // under the finger and the release over it is the one that completes
    // Phaser's up pass. Reverting the fix fails this line every time; a check
    // driven through a board tap did not, because the board swallows its own
    // release.
    check(
      'and the hold does not also fire the tap',
      armedAfter === armedBefore,
      `armed ${armedBefore} → ${armedAfter}`,
    );

    const close = await rowOf('CLOSE');
    if (close) {
      await touch('touchStart', close.x, close.y);
      await touch('touchEnd', close.x, close.y);
      await wait(500);
    }
    check('and it closes again', !(await cardOpen()), '');
  }

  // ---- a finger on a coasting list stops it, and spends itself doing so ----
  //
  // Two halves, and the check is worthless without both. The list has to
  // stop — `stopFling` used to run only on the first MOVE of a press, so a
  // thumb put down on a flick never caught it and the rows kept sliding. And
  // the press has to be SPENT: stopping the scroll while still letting the
  // release through would be worse than not stopping it, because the row
  // that slid under the thumb is not the row anybody was reaching for.
  //
  // Disarmed first so "did a row fire" is readable: with a build tool already
  // armed, a row firing toggles it OFF and looks like nothing happened.
  const armedNow = await page.evaluate(() => {
    const a = window.lastline;
    const L = a.layout();
    const b = a
      .buttons()
      .find((x) => x.active && x.y >= L.list.y && x.y + x.h <= L.list.y + L.list.h);
    return b ? { x: (b.x + b.w / 2) / a.dpr, y: (b.y + b.h / 2) / a.dpr, label: b.label } : null;
  });
  if (armedNow) {
    await touch('touchStart', armedNow.x, armedNow.y);
    await touch('touchEnd', armedNow.x, armedNow.y);
    await wait(500);
  }
  const anyArmedRow = () =>
    page.evaluate(() => {
      const a = window.lastline;
      const L = a.layout();
      return a
        .buttons()
        .filter((b) => b.active && b.y >= L.list.y && b.y + b.h <= L.list.y + L.list.h)
        .map((b) => b.label);
    });
  check('no row is armed before the flick', (await anyArmedRow()).length === 0, '');

  // Back to the top, so the coast passes through rows the town can afford.
  // A press on a DISABLED row is not a press at all — it returns before the
  // button takes ownership — so a check that lands on one proves nothing, and
  // this one landed on an unaffordable AIRFIELD until it was pinned down.
  const topBox = await shape();
  for (let n = 0; n < 6; n++) {
    const ty = topBox.list.y + topBox.list.h * 0.3;
    const tx = topBox.list.x + topBox.list.w / 2;
    await touch('touchStart', tx, ty);
    for (let i = 1; i <= 6; i++) {
      await touch('touchMove', tx, ty + (180 * i) / 6);
      await wait(16);
    }
    await touch('touchEnd', tx, ty + 180);
    await wait(200);
  }
  await wait(700);

  // A flick: fast, so the list is still coasting when the finger returns.
  const flickBox = await shape();
  const fx = flickBox.list.x + flickBox.list.w / 2;
  const fy = flickBox.list.y + flickBox.list.h * 0.75;
  await touch('touchStart', fx, fy);
  for (let i = 1; i <= 5; i++) {
    await touch('touchMove', fx, fy - (150 * i) / 5);
    await wait(8);
  }
  await touch('touchEnd', fx, fy - 150);
  // POLLED, not sampled at a fixed delay. A single read 60ms after the lift
  // caught a slow frame about one run in three and reported no coast at all —
  // the same shape as the `e2e-gates` flake, where a harness waited a flat
  // 800ms and hoped. The finger has to land WHILE the list is moving, so wait
  // for the coast to exist and then go straight in.
  let coasting = 0;
  for (let n = 0; n < 40 && coasting <= 0.5; n++) {
    coasting = await page.evaluate(() => Math.abs(window.lastline.scroll()?.fling ?? 0));
    if (coasting <= 0.5) await wait(16);
  }
  check('the flick leaves the list coasting', coasting > 0.5, `fling ${coasting.toFixed(1)}`);

  // Now put a finger down on a row and hold it still, the way a thumb does.
  // The point is computed from the box measured BEFORE the flick, so there is
  // no round-trip between seeing the coast and landing on it.
  const cx = flickBox.list.x + flickBox.list.w / 2;
  const cy = flickBox.list.y + flickBox.list.h * 0.4;
  await touch('touchStart', cx, cy);
  await wait(250);
  const landed = await page.evaluate(
    (pt) => {
      const a = window.lastline;
      const d = a.dpr;
      const b = a
        .buttons()
        .find(
          (x) =>
            pt.x * d >= x.x && pt.x * d <= x.x + x.w && pt.y * d >= x.y && pt.y * d <= x.y + x.h,
        );
      return b ? { label: b.label, enabled: b.enabled, active: b.active } : null;
    },
    { x: cx, y: cy },
  );
  const stoppedAt = await page.evaluate(() => ({
    fling: Math.abs(window.lastline.scroll()?.fling ?? 0),
    scrollY: window.lastline.scroll()?.scrollY ?? -1,
  }));
  check(
    'the finger landed on a row that can actually be pressed',
    landed !== null && landed.enabled && !landed.active,
    landed ? `${landed.label} enabled=${landed.enabled} active=${landed.active}` : 'nothing',
  );
  await touch('touchEnd', cx, cy);
  await wait(600);
  const after = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
  check(
    'a finger on a coasting list stops it dead',
    stoppedAt.fling === 0 && Math.abs(after - stoppedAt.scrollY) < 2,
    `fling ${stoppedAt.fling.toFixed(1)}, scrollY ${Math.round(stoppedAt.scrollY)} → ${Math.round(after)}`,
  );
  const firedIt = await page.evaluate(
    (want) => window.lastline.buttons().some((b) => b.label === want && b.active),
    landed?.label ?? '',
  );
  check(
    'and that finger does not also fire the row it landed on',
    landed !== null && !firedIt,
    landed ? `${landed.label} armed=${firedIt}` : 'no row',
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
