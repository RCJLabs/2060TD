/**
 * The live-defence offer (v1.43): the last probe of an absence is held back
 * and OFFERED rather than resolved, so the attack that was coming is one you
 * can actually fight — and standing to fight makes them commit the whole rung
 * rather than the two waves they send at an empty yard.
 *
 * The offer's FORMATION is unit-tested: which probe is held, what it costs to
 * walk away, that the live battle is the bigger one, that it survives a save.
 * What a unit test cannot show is the part this harness is for — that a player
 * who opens the game to an inbound attack can find it, read the trade, and
 * take either answer. So the offer is seeded straight into the save and the
 * harness starts where the player does.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5245;

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
  const listAnchor = () =>
    page.evaluate(() => {
      const api = window.lastline;
      const all = api.buttons();
      if (!all.length) return null;
      const maxW = Math.max(...all.map((b) => b.w));
      const rows = all.filter((b) => b.w >= maxW - 2).sort((a, b) => a.y - b.y);
      if (!rows.length) return null;
      const row = rows[Math.floor(rows.length / 2)];
      return { x: (row.x + row.w / 2) / api.dpr, y: (row.y + row.h / 2) / api.dpr };
    });
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
    throw new Error(`no button matching "${needle}"`);
  };
  /**
   * Tap something that is supposed to OPEN something, and check that it did.
   * A single tap can be swallowed while the panel relays itself out, and a
   * harness that assumes otherwise reports a missing overlay as a missing
   * feature. Retrying is the difference between the two.
   */
  const tapOpen = async (needle, expect, tries = 3) => {
    for (let i = 0; i < tries; i++) {
      await tap(needle, 900);
      if ((await copy()).some((l) => expect.test(l))) return true;
    }
    return false;
  };
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copy = async () => (await texts()).flatMap((t) => t.split('\n')).map((l) => l.trim());
  /** Poll until a condition holds, or give up. Never a bare sleep. */
  const until = async (fn, deadlineMs) => {
    const stop = Date.now() + deadlineMs;
    for (;;) {
      if (await fn()) return true;
      if (Date.now() > stop) return false;
      await wait(120);
    }
  };
  const copyHas = async (needle) =>
    (await copy()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));
  const copyLike = async (needle) =>
    (await copy()).find((t) => t.toUpperCase().includes(needle.toUpperCase())) ?? '';
  /**
   * Tap a button by its WHOLE label, preferring the LAST match.
   *
   * Two traps, both hit for real while writing this: the offer's ROW reads
   * "DEFEND — LEVEL 9" and the overlay's footer reads "DEFEND", so a
   * substring match finds the row through the scrim and reopens the overlay
   * it is trying to answer. And the siege's primary button and its
   * after-action footer are BOTH "RETURN TO BASE" — an overlay is built after
   * the HUD it covers, so the last match is the one on top.
   */
  const tapExact = async (label) => {
    const hit = await page.evaluate((want) => {
      const api = window.lastline;
      const all = api.buttons().filter((x) => x.label.toUpperCase() === want);
      const b = all[all.length - 1];
      return b ? { x: (b.x + b.w / 2) / api.dpr, y: (b.y + b.h / 2) / api.dpr } : null;
    }, label.toUpperCase());
    if (!hit) throw new Error(`no button labelled exactly "${label}"`);
    await page.mouse.click(hit.x, hit.y);
    await settle(2500);
  };

  /**
   * Pull the portrait drawer open.
   *
   * On a phone the WAR tab's list is a sheet at half height, and the defence
   * log sits below the fold. `tap` drags the LIST to scroll, which cannot
   * reach a row the sheet is not tall enough to hold — the drawer itself has
   * to come up first, by its grab handle, exactly as a thumb would.
   */
  const openDrawer = async () => {
    const h = await page.evaluate(() => {
      const api = window.lastline;
      const l = api.layout ? api.layout() : null;
      if (!l || !l.handle || !l.handle.h) return null;
      return {
        x: (l.handle.x + l.handle.w / 2) / api.dpr,
        y: (l.handle.y + l.handle.h / 2) / api.dpr,
      };
    });
    if (!h) return false;
    const to = Math.max(8, vh * 0.12);
    if (cdp) {
      await touch('touchStart', h.x, h.y);
      for (let i = 1; i <= 10; i++) await touch('touchMove', h.x, h.y + ((to - h.y) * i) / 10);
      await touch('touchEnd', h.x, to);
    } else {
      await page.mouse.move(h.x, h.y);
      await page.mouse.down();
      await page.mouse.move(h.x, to, { steps: 14 });
      await page.mouse.up();
    }
    await settle(2500);
    return true;
  };

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);

  /** Put an attack on the approach, twenty-five minutes out, and reload. */
  const seedOffer = async (level) => {
    await page.evaluate((lv) => {
      const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
      const town = save.town;
      town.supplies = 4000;
      town.fuel = 900;
      town.unlocked = [...new Set([...town.unlocked, 'frontline', 'autocannon'])];
      // Two guns on the approach. Enough to turn back a small probe, nowhere
      // near enough for a big one — a defeat needs buildings to be memorable
      // about, and a hold needs something doing the holding.
      //
      // Cells of the 10x15 board (grid version 2, M34): three rows in front of
      // the post, either side of its column. A save on any other board would
      // put these somewhere else entirely, so say so rather than drift.
      if (town.gridVersion !== 2) throw new Error(`a grid-version-2 save, not ${town.gridVersion}`);
      for (const cell of [10 * 10 + 3, 10 * 10 + 5]) {
        if (!town.structures.some((st) => st.cell === cell)) {
          town.structures.push({ id: town.nextId++, kind: 'm2nest', cell, level: 1, wrecked: false });
        }
      }
      const now = Date.now();
      town.lastSeen = now;
      town.shieldUntil = 0;
      town.pendingDefense = {
        at: now - 60_000,
        level: lv,
        seed: 987654321,
        expiresAt: now + 25 * 60_000,
      };
      localStorage.setItem('lastline_save_v1', JSON.stringify(save));
    }, level);
    await page.reload({ waitUntil: 'networkidle' });
    await wait(2500);
    await tap('1 · UNITED STATES', 1800);
  };

  await seedOffer(3);
  check(
    'the town opens saying something is inbound',
    await copyHas('INBOUND'),
    (await copyLike('INBOUND')).slice(0, 80),
  );

  await tap('WAR', 800);
  const row = await rowLike('DEFEND');
  check('the WAR tab carries the offer, with its level', /LEVEL 3/.test(row), row);
  check('and says how long it stands', /\d+M|\d+H/.test(row), row);

  check(
    'the offer opens on the trade, not just a yes',
    await tapOpen('DEFEND — LEVEL', /WRECKED/),
    (await copyLike('WRECKED')).slice(0, 90),
  );
  check(
    'and says the two answers are not the same battle',
    await copyHas('THEY COMMIT'),
    (await copyLike('THEY COMMIT')).slice(0, 90),
  );
  // The board tripwire, while an overlay this milestone ADDED is open: any
  // object on the scene root that is not the board rig means something was
  // parented wrong, and a wrongly parented overlay draws a second time at
  // board zoom.
  const strays = await page.evaluate(() => window.lastline.strays());
  check('the offer leaves nothing on the scene root', strays.length === 0, strays.join(', '));
  // And the footer buttons live where a thumb is, not where the title is.
  const footerY = await page.evaluate(() => {
    const api = window.lastline;
    const b = api.buttons().filter((x) => ['DEFEND', 'GARRISON', 'LATER'].includes(x.label.toUpperCase()));
    return b.length === 3 ? Math.min(...b.map((x) => x.y)) / api.dpr : -1;
  });
  check(
    'and its three answers sit in the bottom half of the screen',
    footerY > vh / 2,
    `footer at y=${Math.round(footerY)} of ${vh}`,
  );

  const buttons = await labels();
  check(
    'both answers are on the table, and so is neither',
    ['DEFEND', 'GARRISON', 'LATER'].every((b) => buttons.some((l) => l === b)),
    buttons.filter((l) => l.length < 12).join(' | '),
  );
  await page.screenshot({ path: `screenshots/e2e-defend${isMobile ? '-phone' : ''}.png` });

  // --- the garrison answer ---------------------------------------------------
  await tapExact('GARRISON');
  await until(async () => !(await copyHas('WRECKED')), 8000);
  await tap('WAR', 800);
  check(
    'handing it to the garrison takes the offer off the board',
    !(await rowLike('DEFEND')),
    await rowLike('DEFEND'),
  );
  await openDrawer();
  check(
    'and puts the battle it fought on the log, as a PROBE',
    await tapOpen('DEFENSE LOG', /PROBE LV 3/),
    (await copyLike('PROBE LV 3')).slice(0, 90),
  );
  await tap('CLOSE', 700);

  // --- the other answer ------------------------------------------------------
  // A heavier one this time: two guns hold a level 3, and the half of this
  // feature worth proving end to end is what happens when they do not.
  await seedOffer(9);
  await tap('WAR', 800);
  await tapOpen('DEFEND — LEVEL', /WRECKED/);
  await tapExact('DEFEND');
  const inBattle = await until(
    async () => (await labels()).some((l) => /START ASSAULT/i.test(l)),
    15000,
  );
  check('DEFEND drops you into the battle', inBattle, (await labels()).slice(0, 6).join(' | '));
  check(
    'and it is the attack that was offered, not a fresh one',
    await copyHas('DEFENCE — LEVEL 9'),
    (await copyLike('DEFENCE')).slice(0, 60),
  );
  // The whole point of the bigger battle: there is CP to spend. A probe runs
  // at cpPerSecond 0, which would leave the player watching.
  const cpLine = await copyLike('CP ');
  check('and there is CP to fight it with', /CP\s+[1-9]/.test(cpLine), cpLine.slice(0, 40));
  await page.screenshot({ path: `screenshots/e2e-defend-battle${isMobile ? '-phone' : ''}.png` });

  // Run the clock up rather than sitting through nine levels of waves in real
  // time, then drive the phase button WHENEVER it appears. A rung has a prep
  // phase between every wave, so "tap it a few times and then wait" waits in
  // the wrong place — the lever comes back.
  for (let i = 0; i < 3; i++) await page.keyboard.press('S'); // speed x8
  const finished = await until(async () => {
    const now = await labels();
    if (now.some((l) => /RETURN TO BASE/i.test(l))) return true;
    const phase = now.find((l) => /^(START ASSAULT|SKIP PREP)$/i.test(l));
    if (phase) await tapExact(phase);
    return false;
  }, 300000);
  check('the battle runs to a finish', finished, (await labels()).slice(0, 4).join(' | '));
  await tapExact('RETURN TO BASE');
  await until(async () => await copyHas('LEVEL 9 '), 15000);
  const verdict = await copyLike('LEVEL 9 ');
  check('the town says how it went', /HELD IN PERSON|BROKE THROUGH/.test(verdict), verdict);
  // What a live outcome COSTS is unit-tested, where the battle can be chosen.
  // What this harness is for is that the loop closes: the offer becomes a
  // battle, the battle becomes a verdict, and the verdict is in the currency
  // of the answer the player gave — wrecks for a defeat, a bounty for a hold.
  check(
    /BROKE THROUGH/.test(verdict) ? 'a defeat is counted in buildings' : 'a hold pays the bounty',
    /BROKE THROUGH/.test(verdict) ? /\d+ WRECKED/.test(verdict) : /\+\d+ SUP/.test(verdict),
    verdict,
  );
  await tap('WAR', 800);
  check('and the offer is gone either way', !(await rowLike('DEFEND')), await rowLike('DEFEND'));
  await openDrawer();
  check(
    'the log calls the one you fought DEFENDED, not a probe',
    await tapOpen('DEFENSE LOG', /DEFENDED LV 9/),
    (await copyLike('DEFENDED LV 9')).slice(0, 90),
  );
  await page.screenshot({ path: `screenshots/e2e-defend-after${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`DEFEND FAILURES: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('DEFEND OK: offered, explained, and answerable both ways.');
  }
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
