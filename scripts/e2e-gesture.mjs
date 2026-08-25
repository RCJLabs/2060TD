/**
 * Gesture ownership: one finger moves one thing.
 *
 * v1.22 shipped a bug the whole harness suite was blind to. A drag that
 * starts on the map and wanders into the drawer was adopted by BOTH: the
 * board kept panning (its POINTER_DOWN gate had already passed) and the
 * panel latched the same gesture mid-flight, because it tested where the
 * finger IS rather than where it went DOWN. Nothing was pressed and no text
 * changed, so no existing check could see it — the only way to catch it is
 * to read both viewports across a single gesture.
 *
 * The rule these checks encode: a gesture belongs to whichever region it
 * started in, for its whole life, in both directions and for the wheel too.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5236;
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
  const errors = [];
  const runs = [
    { name: 'portrait', viewport: { width: 412, height: 915 } },
    { name: 'landscape', viewport: { width: 915, height: 412 } },
  ];

  for (const run of runs) {
    const page = await browser.newPage({
      ...run,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
      });
    /** A drag that ends dead: the finger holds still before it lifts, so the
     * flick is zero and the list stops exactly where it was put. */
    const settleDrag = async (fromX, fromY, toX, toY, steps = 10) => {
      await touch('touchStart', fromX, fromY);
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps);
        await wait(16);
      }
      // A touchmove that does not move is suppressed by the browser, so the
      // hold has to jitter a pixel to be delivered at all — without that the
      // finger looks like it never slowed down and the flick fires anyway.
      for (let i = 0; i < 8; i++) {
        await touch('touchMove', toX + (i % 2), toY + (i % 2));
        await wait(16);
      }
      await touch('touchEnd', toX, toY);
      await wait(400);
    };
    const drag = async (fromX, fromY, toX, toY, steps = 10) => {
      await touch('touchStart', fromX, fromY);
      for (let i = 1; i <= steps; i++) {
        await touch(
          'touchMove',
          fromX + ((toX - fromX) * i) / steps,
          fromY + ((toY - fromY) * i) / steps,
        );
        await wait(16);
      }
      await touch('touchEnd', toX, toY);
      // Long enough for the drawer's flick to coast to a stop: a check that
      // reads a viewport while it is still moving measures the last gesture.
      await wait(900);
    };

    /** Both viewports at once, in CSS px, with the rects to aim at. */
    const state = () =>
      page.evaluate(() => {
        const api = window.lastline;
        const d = api.dpr;
        const cam = api.camera();
        const list = api.scroll();
        const box = (r) => ({ x: r.x / d, y: r.y / d, w: r.w / d, h: r.h / d });
        return {
          board: cam ? { zoom: cam.zoom, cx: cam.cx, cy: cam.cy, rect: box(cam.rect) } : null,
          list: list
            ? { scrollY: list.scrollY / d, max: list.max / d, fling: list.fling, rect: box(list.rect) }
            : null,
        };
      });
    const boardMoved = (a, b) =>
      Math.round(Math.abs(a.board.cx - b.board.cx) + Math.abs(a.board.cy - b.board.cy));
    const listMoved = (a, b) => Math.round(Math.abs(a.list.scrollY - b.list.scrollY));

    await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
    await wait(2500);

    const geo = await state();
    if (!geo.board || !geo.list) {
      check(`${run.name}: both viewports report`, false, 'no board or no drawer on screen');
      await page.close();
      continue;
    }
    const B = geo.board.rect;
    const L = geo.list.rect;
    check(
      `${run.name}: the board and the drawer do not overlap`,
      B.x + B.w <= L.x + 0.5 || L.x + L.w <= B.x + 0.5 || B.y + B.h <= L.y + 0.5 || L.y + L.h <= B.y + 0.5,
      `board ${Math.round(B.x)},${Math.round(B.y)} ${Math.round(B.w)}x${Math.round(B.h)} · list ${Math.round(L.x)},${Math.round(L.y)} ${Math.round(L.w)}x${Math.round(L.h)}`,
    );

    // Aim points well inside each rect, and a path from one into the other.
    const bMid = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
    const lMid = { x: L.x + L.w / 2, y: L.y + L.h / 2 };

    /**
     * Park the list off both of its stops.
     *
     * A list already pinned at the top cannot scroll further up, so a check
     * that reads zero movement there is passing for the wrong reason — this
     * one did, and only reverting the fix showed it. Every gesture below is
     * measured from ground the list can move off in either direction.
     */
    // Chromium delivers one `wheel` call as several events across frames, so
    // a sample taken too soon reads the tail of it as the next check's start.
    const wheelAt = async (x, y, dy, settle = 450) => {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, dy);
      await wait(settle);
    };

    let parks = 0;
    const park = async () => {
      // Home to the top, then step back down to the middle — with the wheel,
      // which moves the list directly and leaves no flick behind. Parking by
      // dragging costs a second a leg and hands the next check a list that is
      // still coasting, which is the very thing under test.
      await wheelAt(lMid.x, lMid.y, -6000);
      for (let i = 0; i < 10; i++) {
        const { scrollY, max } = (await state()).list;
        if (scrollY > max * 0.2 && scrollY < max * 0.8) break;
        await wheelAt(lMid.x, lMid.y, 300, 250);
      }
      const { scrollY, max } = (await state()).list;
      parks++;
      check(
        `${run.name}: the drawer parks off both stops (${parks})`,
        scrollY > 10 && scrollY < max - 10,
        `scrollY ${Math.round(scrollY)} of ${Math.round(max)}`,
      );
    };

    // 1. Board → drawer. The board may keep panning; the drawer must not move.
    await park();
    let before = await state();
    await drag(bMid.x, bMid.y, lMid.x, lMid.y);
    let after = await state();
    check(
      `${run.name}: a drag off the board never scrolls the drawer`,
      listMoved(before, after) === 0,
      `list moved ${listMoved(before, after)}px, board moved ${boardMoved(before, after)}px`,
    );

    // 2. Drawer → board. The drawer may keep scrolling; the board must not pan.
    await park();
    before = await state();
    await drag(lMid.x, lMid.y, bMid.x, bMid.y);
    after = await state();
    check(
      `${run.name}: a drag out of the drawer never pans the board`,
      boardMoved(before, after) === 0,
      `board moved ${boardMoved(before, after)}px, list moved ${listMoved(before, after)}px`,
    );

    // 3. The wheel, both ways. One region answers, the other stays put.
    await park();
    before = await state();
    await wheelAt(lMid.x, lMid.y, 200);
    after = await state();
    check(
      `${run.name}: the wheel over the drawer does not zoom the board`,
      Math.abs(after.board.zoom - before.board.zoom) < 1e-6 && boardMoved(before, after) === 0,
      `zoom ${before.board.zoom.toFixed(3)} → ${after.board.zoom.toFixed(3)}, list moved ${listMoved(before, after)}px`,
    );

    await park();
    before = await state();
    await wheelAt(bMid.x, bMid.y, 200);
    after = await state();
    check(
      `${run.name}: the wheel over the board does not scroll the drawer`,
      listMoved(before, after) === 0,
      `list moved ${listMoved(before, after)}px, zoom ${before.board.zoom.toFixed(3)} → ${after.board.zoom.toFixed(3)}`,
    );

    // 4. And each region still answers its own gesture — a guard that blocked
    // everything would pass all four checks above and break the game.

    await park();
    before = await state();
    await drag(lMid.x, lMid.y + L.h * 0.3, lMid.x, lMid.y - L.h * 0.3);
    after = await state();
    check(
      `${run.name}: a drag inside the drawer still scrolls it`,
      listMoved(before, after) > 10,
      `list moved ${listMoved(before, after)}px`,
    );

    // At fit zoom the whole map is on screen and a pan has nowhere to go, so
    // zoom in first — otherwise this control passes for the wrong reason.
    for (let i = 0; i < 6; i++) await wheelAt(bMid.x, bMid.y, -120);
    before = await state();
    await drag(bMid.x + B.w * 0.2, bMid.y, bMid.x - B.w * 0.2, bMid.y);
    after = await state();
    check(
      `${run.name}: a drag inside the board still pans it`,
      boardMoved(before, after) > 1,
      `board moved ${boardMoved(before, after)}px, zoom ${after.board.zoom.toFixed(2)}`,
    );

    // 5. A flick that is still coasting belongs to the gesture that threw it:
    // put the next gesture on the map and the drawer stops. Left running, the
    // drawer keeps moving under a drag that belongs to the map, which is the
    // same complaint from a different direction.
    //
    // On its own page, and touch only. A `page.mouse` call anywhere earlier in
    // a session makes the browser synthesize compatibility mouse events off
    // each touch release, and those kill the flick before this can read it —
    // the check would then pass with nothing to catch. Verified by watching
    // the same throw coast for 190px on a touch-only page and die instantly
    // on one the mouse had visited.
    //
    // Landscape only, and that is a limit of the harness rather than of the
    // rule. In portrait the browser trails a synthetic zero-distance touchmove
    // after the lift for long enough that the smoothed speed decays under the
    // flick threshold, so the throw never coasts and there is nothing to
    // catch — the throw lands at exactly the finger distance, 138 of 138.
    // A check that cannot create its own precondition is not a check, so it
    // runs where it can: the same revert fails it here, at 8px of drawer
    // movement under a drag that belongs to the map.
    if (run.name !== 'landscape') {
      await page.close();
      continue;
    }
    const fresh = await browser.newPage({ ...run, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    fresh.on('pageerror', (e) => errors.push(String(e)));
    const fcdp = await fresh.context().newCDPSession(fresh);
    const ftouch = (type, x, y) =>
      fcdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 8, radiusY: 8, force: 1 }],
      });
    const fstate = () =>
      fresh.evaluate(() => {
        const api = window.lastline;
        const list = api.scroll();
        return list ? { scrollY: list.scrollY / api.dpr, fling: list.fling } : null;
      });
    await fresh.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
    await wait(2500);

    // A fast drag with a clean lift, from a list at its top stop. Short, so
    // that throw plus coast stays inside the range: a flick that reaches the
    // far stop is zeroed there, and then this check passes with or without
    // anything catching it.
    //
    // Retried, because synthesized touch is a race the page can lose. The
    // flick speed is a smoothed `velocity * 0.6 + dy * 0.4` over the moves
    // that actually arrive, so a single dropped touchmove near the lift both
    // shortens the travel and drops the speed under the threshold — measured
    // one throw in three landing at 102px and no fling where the other two
    // landed 121px and 33.2. That is the harness missing its own precondition,
    // not the drawer refusing to coast, and a check that fails a third of the
    // time teaches people to ignore it. Three independent throws, and a real
    // regression still fails all three: the revert this exists to catch zeroes
    // the fling on every one.
    const throwOnce = async () => {
      await ftouch('touchStart', lMid.x, lMid.y + L.h * 0.18);
      for (let i = 1; i <= 5; i++) {
        await ftouch('touchMove', lMid.x, lMid.y + L.h * 0.18 - (L.h * 0.36 * i) / 5);
        await wait(16);
      }
      await ftouch('touchEnd', lMid.x, lMid.y - L.h * 0.18);
      return fstate();
    };
    let thrown = await throwOnce();
    for (let attempt = 1; attempt < 3 && !(thrown && Math.abs(thrown.fling) > 1); attempt++) {
      // Back to the top stop so the next throw has the same room to run. A
      // reload rather than a scroll call: the list has no seam to set its
      // position, and the page must stay touch-only — one `page.mouse` call
      // anywhere here makes the browser synthesize compat mouse events off
      // every touch release, which kill the flick this is trying to measure.
      await fresh.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
      await wait(2500);
      thrown = await throwOnce();
    }
    check(
      `${run.name}: the throw leaves the drawer coasting`,
      thrown !== null && Math.abs(thrown.fling) > 1,
      `fling ${thrown ? thrown.fling.toFixed(1) : 'no drawer'}, scrollY ${Math.round(thrown?.scrollY ?? -1)}`,
    );

    // Now drag the map while it is still coasting. By the end of that drag the
    // drawer must be stopped, and must stay stopped.
    await ftouch('touchStart', bMid.x, bMid.y);
    for (let i = 1; i <= 4; i++) {
      await ftouch('touchMove', bMid.x - (B.w * 0.2 * i) / 4, bMid.y);
      await wait(16);
    }
    await ftouch('touchEnd', bMid.x - B.w * 0.2, bMid.y);
    const atEnd = await fstate();
    await wait(600);
    const later = await fstate();
    check(
      `${run.name}: a drag on the map catches the drawer's flick`,
      atEnd !== null && later !== null && atEnd.fling === 0 && Math.round(Math.abs(later.scrollY - atEnd.scrollY)) === 0,
      `fling ${atEnd?.fling.toFixed(1)} when the map drag ends, list moved ${Math.round(Math.abs((later?.scrollY ?? 0) - (atEnd?.scrollY ?? 0)))}px after`,
    );
    await fresh.close();
    await page.close();
  }

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} gesture check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nGESTURE OK: one finger moves one thing, both ways.');
  }
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
