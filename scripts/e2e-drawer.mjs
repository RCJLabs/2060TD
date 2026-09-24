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
 *
 * M34 added the resting detent — the drawer opens onto exactly the room the
 * board leaves, so the whole map is in view — and the check that a dragged
 * handle stays under the finger dragging it, which it did not.
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

  /**
   * The drawer as the player sees it: rects in CSS px, plus where the map is
   * looking.
   *
   * `cell` is the size one grid square is drawn at — the number the whole
   * portrait rework is about — and `bottomWorld` is the world Y at the board's
   * bottom edge, the ground the drawer rises towards. Both come from the live
   * camera rather than from anything the layout believes.
   */
  const shape = async () => {
    const raw = await page.evaluate(() => {
      const api = window.lastline;
      const l = api.layout ? api.layout() : null;
      const cam = api.camera ? api.camera() : null;
      return l ? { dpr: api.dpr, board: l.board, list: l.list, handle: l.handle, cam } : null;
    });
    if (!raw) return null;
    const to = (r) => ({ x: r.x / raw.dpr, y: r.y / raw.dpr, w: r.w / raw.dpr, h: r.h / raw.dpr });
    const cam = raw.cam;
    return {
      board: to(raw.board),
      list: to(raw.list),
      handle: to(raw.handle),
      // 32 world px per cell, drawn at `zoom`, shown at 1/dpr CSS px per device px.
      cell: cam ? (cam.zoom * 32) / raw.dpr : 0,
      topWorld: cam ? cam.cy - cam.rect.h / cam.zoom / 2 : 0,
      bottomWorld: cam ? cam.cy + cam.rect.h / cam.zoom / 2 : 0,
    };
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

  // ---- at rest, the whole board is in view (M34) --------------------------
  //
  // The drawer used to open onto 42% of the screen whatever the board needed,
  // which on this phone left 19 of 30 rows in view under a sheet that was mostly
  // empty list. It rests on exactly what the world leaves now. Read off the
  // live CAMERA, not the layout: what the map shows is what the player sees,
  // and a layout that believes it made room proves nothing about the view.
  const grid = await page.evaluate(() => window.lastline.grid?.() ?? null);
  const worldH = (grid?.rows ?? 0) * 32;
  check(
    'at rest the drawer leaves the whole board in view',
    grid !== null && start.topWorld <= 0.5 && start.bottomWorld >= worldH - 0.5,
    `world rows ${(start.topWorld / 32).toFixed(2)} to ${(start.bottomWorld / 32).toFixed(2)} of ${grid?.rows}`,
  );
  check(
    'and still shows a list, not just a handle',
    start.list.h >= 88,
    `list ${start.list.h.toFixed(0)}px`,
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

  // ---- a dragged handle stays under the finger (M34) ----------------------
  //
  // Held, not released, because a release snaps to a detent and a snapped
  // drawer is right however far off the drag was. Until M34 the handle read
  // its starting height in one unit and replayed it in another: it jumped on
  // the first pixel and then ran a sixth ahead of the finger.
  {
    const from = start.handle.y + start.handle.h / 2;
    const x = start.handle.x + start.handle.w / 2;
    const scrollBefore = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
    await touch('touchStart', x, from);
    for (let i = 1; i <= 8; i++) {
      await touch('touchMove', x, from - (120 * i) / 8);
      await wait(16);
    }
    await wait(120);
    const held = await shape();
    await touch('touchEnd', x, from - 120);
    await wait(500);
    const moved = start.handle.y - held.handle.y;
    check(
      'a dragged handle stays under the finger',
      Math.abs(moved - 120) <= 2,
      `finger moved 120px, the handle ${moved.toFixed(0)}px`,
    );
    // One finger, one thing. A handle drag grows the drawer, and the list's
    // top slides up past the finger doing it: the list used to read that as a
    // press that had landed on it, and scrolled and flung under every drag.
    const scrollAfter = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
    check(
      'and the list under it does not scroll',
      scrollBefore >= 0 && Math.abs(scrollAfter - scrollBefore) < 1,
      `scrollY ${Math.round(scrollBefore)} → ${Math.round(scrollAfter)}`,
    );
    // Rest is a detent like the others, from above as well as from below. On
    // this phone 120px up from rest is past halfway to HALF, so that release
    // landed on HALF, and 180px back down is nearer rest again.
    const up = await shape();
    const back = await drag(180);
    check(
      'and a release nearer rest than half lands on rest',
      up.list.h > start.list.h + 100 && Math.abs(back.list.h - start.list.h) < 2,
      `list ${start.list.h.toFixed(0)} → ${up.list.h.toFixed(0)} → ${back.list.h.toFixed(0)}px`,
    );
  }

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

  // ---- but the MAP does not move (v1.40) ---------------------------------
  //
  // The drawer is a sheet sliding over the board, not a lever that zooms the
  // world. Until this release the board's fit zoom was measured against the
  // rect the drawer had left it, so every drag rescaled the map under the
  // finger — and on a phone that is not a cosmetic wobble: at the half
  // detent it cost a 360px screen 40% of its cell size, which is the whole
  // difference between a silhouette that reads and one that does not.
  //
  // Both halves matter. Zoom alone would pass on a build that held the scale
  // and slid the ground instead, so the world point at the board's BOTTOM
  // edge is pinned as well — the map slides up exactly as far as the drawer
  // rises, which is what keeps a base at the foot of the board on screen
  // while its build drawer is open.
  check(
    'and the map keeps its scale while the drawer moves',
    Math.abs(grown.cell - start.cell) < 0.25,
    `cell ${start.cell.toFixed(1)} → ${grown.cell.toFixed(1)}px`,
  );
  check(
    'and the ground at the drawer edge stays on screen',
    Math.abs(grown.bottomWorld - start.bottomWorld) < 6,
    `foot of view ${start.bottomWorld.toFixed(0)} → ${grown.bottomWorld.toFixed(0)} world px`,
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
  check(
    'and brings it back to rest, not to half',
    Math.abs(tapped.list.h - start.list.h) < 2,
    `list ${tapped.list.h.toFixed(0)}px, at rest ${start.list.h.toFixed(0)}px`,
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
  const tapLabel = async (label) => {
    const b = await page.evaluate((want) => {
      const a = window.lastline;
      const hit = a.buttons().find((x) => x.label === want && x.w > 0 && x.h > 0);
      return hit ? { x: (hit.x + hit.w / 2) / a.dpr, y: (hit.y + hit.h / 2) / a.dpr } : null;
    }, label);
    if (!b) return false;
    await touch('touchStart', b.x, b.y);
    await touch('touchEnd', b.x, b.y);
    await wait(500);
    return true;
  };

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
    // This is also what pinned the press-identity fix in the canvas kit's
    // button, and it holds the DOM one to the same rule: a button whose press
    // ended without a scene-level up used to keep believing it was held, and
    // the next up ANYWHERE fired it — measured two gestures and five seconds
    // later, on a row the finger had long left. The hold is the
    // reliable way to reach that state, because opening a card puts a scrim
    // under the finger and the release over it is the one that completed
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

  // The coast needs a list tall enough to coast through and land in, which a
  // resting drawer is not on a phone this tall: its whole list is a header and
  // two rows. So this runs at HALF, where a player reading a long list would
  // put it.
  {
    const L = await page.evaluate(() => {
      const a = window.lastline;
      const l = a.layout();
      return { sh: (l.height - l.safe.top - l.safe.bottom) / a.dpr, drawer: l.drawerH / a.dpr };
    });
    await drag(-(0.42 * L.sh - L.drawer));
  }

  // Back to the top, so the coast passes through rows the town can afford.
  // A press on a DISABLED row is not a press at all — it returns before the
  // button takes ownership — so a check that lands on one proves nothing, and
  // this one landed on an unaffordable AIRFIELD until it was pinned down.
  //
  // And then it is TRIED, up to four times, rather than pinned (M30). Where a
  // coasting list is when the finger lands depends on whose physics are
  // coasting it — the canvas panel's decay when this was written, the
  // platform's own momentum since, which moves the list differently — and the
  // landing spot that suited one put the other on a locked SIGNALS STATION
  // every time. A locked row says nothing about either, so an attempt that lands on
  // one is lifted and tried again elsewhere. Only the attempt that lands on a
  // row that can be pressed is judged.
  let coasting = 0;
  let flickBox = null;
  let cx = 0;
  let cy = 0;
  let landed = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await touch('touchEnd', cx, cy);
      await wait(600);
    }
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
    flickBox = await shape();
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
    coasting = 0;
    for (let n = 0; n < 40 && coasting <= 0.5; n++) {
      coasting = await page.evaluate(() => Math.abs(window.lastline.scroll()?.fling ?? 0));
      if (coasting <= 0.5) await wait(16);
    }

    // Now put a finger down on a row and hold it still, the way a thumb does.
    // The point is computed from the box measured BEFORE the flick, so there is
    // no round-trip between seeing the coast and landing on it. Each attempt
    // lands somewhere else in the list: a coast is as repeatable as the
    // physics under it, so landing on the same spot again lands on the same
    // locked row again. The spread is wider than the longest run of locked
    // rows, so one of the four has to find a row that can be pressed.
    cx = flickBox.list.x + flickBox.list.w / 2;
    cy = flickBox.list.y + flickBox.list.h * [0.4, 0.55, 0.3, 0.7][attempt];
    await touch('touchStart', cx, cy);
    await wait(250);
    landed = await page.evaluate(
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
    if (coasting > 0.5 && landed?.enabled && !landed.active) break;
  }
  check('the flick leaves the list coasting', coasting > 0.5, `fling ${coasting.toFixed(1)}`);
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

  // ---- carrying a row onto the map ----------------------------------------
  //
  // Placing used to be two taps: arm the tool in the drawer, then aim on the
  // board. A drag that starts on the row's SILHOUETTE and ends on the map
  // does both in one stroke.
  //
  // The silhouette rather than the row, and that is the whole design: in
  // portrait the drawer sits BELOW the board, so dragging a row onto the map
  // and scrolling the list are the same stroke in the same direction. A
  // dedicated grab area is the only thing that tells them apart — which is
  // why this check drives the icon's x and the one after it drives the label's.
  const dropTab = await page.evaluate(() => window.lastline.tab?.() ?? null);
  check('the build tab is showing', dropTab === 'build', dropTab ?? 'none');

  const confirmUp = () =>
    page.evaluate(() => window.lastline.buttons().some((b) => b.label === 'CONFIRM'));
  check('nothing is aimed yet', !(await confirmUp()), '');

  const carry = async (fromLeftEdge) => {
    const at = await shape();
    const row = await page.evaluate(() => {
      const a = window.lastline;
      const L = a.layout();
      const hit = a
        .buttons()
        .filter((b) => b.y >= L.list.y && b.y + b.h <= L.list.y + L.list.h && b.enabled)
        .sort((p, q) => p.y - q.y)[0];
      return hit
        ? { x: hit.x / a.dpr, y: (hit.y + hit.h / 2) / a.dpr, w: hit.w / a.dpr, label: hit.label }
        : null;
    });
    if (!row) return null;
    // The silhouette sits at the row's left edge; the label is well clear of it.
    const sx = fromLeftEdge ? row.x + 14 : row.x + row.w * 0.6;
    const sy = row.y;
    const ty = at.board.y + at.board.h * 0.45;
    await touch('touchStart', sx, sy);
    for (let i = 1; i <= 10; i++) {
      await touch('touchMove', sx, sy + ((ty - sy) * i) / 10);
      await wait(16);
    }
    await touch('touchEnd', sx, ty);
    await wait(700);
    return row.label;
  };

  const carried = await carry(true);
  check('there is a row to carry', carried !== null, carried ?? 'none');
  check(
    'dragging a silhouette onto the map arms and aims in one stroke',
    await confirmUp(),
    `${carried} → ${(await confirmUp()) ? 'CONFIRM up' : 'nothing aimed'}`,
  );
  // And it did not ALSO leave the list scrolled somewhere else or fire a tap:
  // the press moved to the board, it was not shared with the drawer.
  await tapLabel('CANCEL');
  check('and cancelling puts it back', !(await confirmUp()), '');

  // The other half of the design: the same stroke from the row's LABEL is a
  // scroll, not a pick-up. Without this the check above would pass on a build
  // that made the whole row draggable, which is the version that cannot tell
  // a scroll from a carry.
  const scrollBefore = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
  await carry(false);
  check(
    'but the same drag from the label scrolls instead',
    !(await confirmUp()) &&
      (await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1)) !== scrollBefore,
    `${(await confirmUp()) ? 'aimed' : 'not aimed'}, scrollY ${scrollBefore} → ${await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1)}`,
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
