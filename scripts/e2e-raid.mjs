/**
 * E2E of the offense loop: raid planner → assign units → launch → result
 * overlay → watch replay. Runs on ?demo=raid (showcase town).
 *
 * REWRITTEN (v1.21) because it was passing without doing anything. It clicked
 * fixed pixel coordinates and its only assertion was "no page errors", so
 * every time the panel moved it went on quietly launching raids with ZERO
 * units assigned — a green tick for a flow that never happened. Found while
 * writing `e2e-garrison.mjs`, which taps by label.
 *
 * Everything here is addressed by label and every step asserts the state it
 * was supposed to produce. A harness that cannot fail is not a test.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
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
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e && e.stack ? e.stack : String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
  await wait(2000);

  const texts = () => page.evaluate(() => window.lastline.texts());
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      if (!api) return null;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit
        ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr, on: hit.enabled }
        : null;
    }, needle.toUpperCase());
  const tap = async (needle, settleMs = 350) => {
    const hit = await find(needle);
    if (!hit) return false;
    await page.mouse.click(hit.x, hit.y);
    await wait(settleMs);
    return true;
  };
  /** Wait for a condition rather than for a stopwatch. */
  const until = async (fn, deadlineMs) => {
    const stop = Date.now() + deadlineMs;
    for (;;) {
      if (await fn()) return true;
      if (Date.now() > stop) return false;
      await wait(120);
    }
  };
  const copy = async (re) => (await texts()).find((t) => re.test(t)) ?? '';
  /** How many units the planner says are committed. */
  const mustered = async () => {
    const hit = /·\s*(\d+)\s*UNITS/i.exec(await copy(/LAUNCH RAID/i));
    return hit ? Number(hit[1]) : null;
  };

  // ---- muster a force ------------------------------------------------------
  // Assignment lives on SQUADS. MUSTER is the training tab and its rows are
  // inert here, which is the trap the old pixel coordinates fell into.
  check('the planner opens on a target', (await copy(/TARGET GRID/i)) !== '', await copy(/TARGET GRID/i));
  check('nothing is committed yet', (await mustered()) === 0, `${await mustered()} units`);

  // The mission is the first decision (v1.24), and it has to be a real one:
  // the row has to cycle, and the quota has to be read off the post rather
  // than being a fixed number — a base with five emplacements and one with
  // three cannot be asked for the same count.
  const mission = () => copy(/TAKE THE POST|SPIKE THE GUNS|RAID THE STORES/i);
  const opening = await mission();
  check('the planner names what the raid is for', opening !== '', opening);
  await tap(opening.split('\n')[0] || 'TAKE THE POST', 300);
  const second = await mission();
  check('and the mission can be changed', second !== opening, `${opening} → ${second}`);
  const quota = /(\d+)\s*of\s*(\d+)/i.exec(await copy(/\d+ of \d+/));
  check(
    'and a lesser mission asks for a share of what the post holds',
    quota !== null && Number(quota[1]) > 0 && Number(quota[1]) < Number(quota[2]),
    quota ? `${quota[1]} of ${quota[2]}` : 'no quota shown',
  );
  // Back to taking the post, so the rest of the run measures what it always did.
  for (let i = 0; i < 3 && !/TAKE THE POST/i.test(await mission()); i++) {
    await tap((await mission()).split('\n')[0], 300);
  }

  await tap('SQUADS', 600);
  for (let i = 0; i < 3; i++) await tap('+ RANGER SQUAD', 200);
  await tap('+ M1 ABRAMS', 200);
  await tap('+ JAVELIN TEAM', 200);

  const committed = await mustered();
  check('assigning units actually commits them', committed !== null && committed > 0, `${committed} units`);
  await page.screenshot({ path: 'screenshots/e2e-raid-plan.png' });

  // ---- launch it -----------------------------------------------------------
  // ENABLED, not merely present: the button exists at zero units too, it is
  // just refused, and a check that only asks whether it is on screen would
  // wave an empty raid through exactly as the old harness did.
  const launch = await find('LAUNCH RAID');
  check('LAUNCH is live once a force exists', launch !== null && launch.on === true, '');
  await tap('LAUNCH RAID', 1800);
  const resolved = await until(
    async () => /COMMAND POST DESTROYED|RAID REPELLED/i.test(await copy(/COMMAND POST|RAID REPELLED/i)),
    30000,
  );
  check('the raid resolves into a report', resolved, await copy(/COMMAND POST|RAID REPELLED/i));
  // The report has to account for the force that went in, or the resolution
  // ran on something other than the plan.
  check(
    'and the report accounts for the force',
    /Losses:|Destruction:/i.test((await texts()).join('\n')),
    '',
  );
  await page.screenshot({ path: 'screenshots/e2e-raid-result.png' });

  // ---- and the footage plays ----------------------------------------------
  const offered = await tap('WATCH REPLAY', 1500);
  check('the report offers the footage', offered, '');
  // Gated on the tap: without it, a planner still showing a launch countdown
  // could satisfy the clock pattern and call the replay proven.
  const playing =
    offered && (await until(async () => /REPLAY —/i.test((await texts()).join('\n')), 15000));
  check('the replay runs a clock', playing, await copy(/T\+\d+s/i));
  await page.screenshot({ path: 'screenshots/e2e-raid-replay.png' });

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures++;
  }
  if (failures) {
    console.error(`\n${failures} raid check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nRAID OK: a real force planned, launched, reported and replayed.');
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
