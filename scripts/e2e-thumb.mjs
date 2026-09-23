/**
 * Thumb Scale's acceptance test (M34): on the narrowest phone the game is
 * played on, with nothing zoomed, a NAMED cell takes a build on the first try.
 *
 * The milestone exists because the 20x30 board drew a cell at 18px on a
 * 360-wide phone, under a fingertip. It did not reach the 44px a thumb wants
 * either — 10 columns on 360px is 36 — and it made that trade on a claim:
 * placement is aim-then-confirm, so a near miss costs a second touch rather
 * than a building. This holds the claim to a real touch.
 *
 * Every harness before this one placed by SCANNING for whatever cell happened
 * to be free and on screen, so none of them could have noticed a build going
 * to the wrong square. This one names the cell first and looks only at the
 * board as the town opens it, at rest, with the whole board in view. It touches
 * once, as a thumb does — off the cell's centre, with a fingertip's contact
 * patch — and confirms with a touch. Then it reads the save for where the
 * building went.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5252;
/** The small Android of `npm run fit`: the width that decides for everyone. */
const PHONE = { width: 360, height: 800, deviceScaleFactor: 3 };
/** The cell, as (col, row) on the town board. Named before anything is looked at. */
const NAMED = [6, 10];
/** A ground seed whose yard is dry (tests/helpers.ts, `CLEAR_YARD_SEED`). */
const DRY_YARD_SEED = 2;

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
    viewport: { width: PHONE.width, height: PHONE.height },
    deviceScaleFactor: PHONE.deviceScaleFactor,
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const cdp = await page.context().newCDPSession(page);
  /** One finger, with a fingertip's contact patch rather than a pixel. */
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 12, radiusY: 12, force: 1 }],
    });
  const touchAt = async (x, y) => {
    await touch('touchStart', x, y);
    await wait(90);
    await touch('touchEnd', x, y);
  };

  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  /** Wait for the UI to stop changing, rather than for a fixed time. */
  const settle = async (budgetMs = 2500) => {
    const until = Date.now() + budgetMs;
    let prev = null;
    let stable = 0;
    while (Date.now() < until) {
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
  const tap = async (needle) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const hit = await find(needle);
      if (hit && hit.y > 6 && hit.y < PHONE.height - 6) {
        await page.mouse.click(hit.x, hit.y);
        await settle();
        return;
      }
      await wait(250);
    }
    throw new Error(`no button matching "${needle}"`);
  };
  const structures = () =>
    page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
      return save.town.structures.map((s) => ({ kind: s.kind, cell: s.cell }));
    });

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · EMPTY');
  await tap('UNITED STATES');
  await tap('STANDARD');
  await page.evaluate((seed) => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    save.town.supplies = 20000;
    save.town.fuel = 8000;
    save.town.terrainSeed = seed;
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  }, DRY_YARD_SEED);
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES');
  await settle();

  // ---- the board as the town opens it: all of it, at a size a thumb can use ----
  const board = await page.evaluate(() => {
    const api = window.lastline;
    const grid = api.grid();
    let seen = 0;
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (api.cell(c, r)) seen++;
    const a = api.cell(0, 0);
    const b = api.cell(1, 0);
    return { ...grid, seen, cell: a && b ? (b.x - a.x) / api.dpr : 0 };
  });
  check(
    'the whole board is in view at rest, nothing zoomed',
    board.seen === board.cols * board.rows,
    `${board.seen} of ${board.cols * board.rows} cells`,
  );
  // 360 / 10 columns, less nothing: the fit instrument's number for this phone.
  check('and a cell is 36px across on a 360-wide phone', board.cell >= 35.5, `${board.cell.toFixed(1)}px`);

  // ---- one touch on the named cell, as a thumb makes it ------------------------
  await tap('SUPPLY DEPOT');
  const target = await page.evaluate(([c, r]) => {
    const api = window.lastline;
    const hit = api.cell(c, r);
    return hit ? { x: hit.x / api.dpr, y: hit.y / api.dpr } : null;
  }, NAMED);
  check('the named cell is on screen', target !== null, `(${NAMED})`);
  const before = await structures();
  if (target) {
    // Not the centre. A thumb does not hit centres, so the touch lands a
    // quarter of a cell off it, down and to the left — inside the cell, and
    // where a centre-only test would never look.
    const off = board.cell / 4;
    await touchAt(target.x - off, target.y + off);
    await settle();
  }
  const aimed = await structures();
  check('the touch aims and builds nothing yet', aimed.length === before.length, '');
  await page.screenshot({ path: 'screenshots/e2e-thumb-aimed.png' });
  const confirm = await find('CONFIRM');
  check('a CONFIRM is there to spend it', confirm !== null, '');
  if (confirm) {
    await touchAt(confirm.x, confirm.y);
    await settle();
  }
  const after = await structures();
  const added = after.filter((s) => !before.some((b) => b.cell === s.cell && b.kind === s.kind));
  const named = NAMED[1] * board.cols + NAMED[0];
  check(
    'and the depot stands on the named cell, first try',
    added.length === 1 && added[0].kind === 'supplyDepot' && added[0].cell === named,
    added.length
      ? added.map((s) => `${s.kind} at (${s.cell % board.cols}, ${Math.floor(s.cell / board.cols)})`).join(', ')
      : 'nothing built',
  );
  await page.screenshot({ path: 'screenshots/e2e-thumb.png' });

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} thumb check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nTHUMB OK: the whole board at rest on a 360-wide phone, and one touch builds on the cell it names.');
  }
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
