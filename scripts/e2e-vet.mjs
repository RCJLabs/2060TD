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
  const tap = async (needle, settleMs = 700) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const hit = await find(needle);
      if (hit && hit.y > 6 && hit.y < vh - 6) {
        await page.mouse.click(hit.x, hit.y);
        await wait(settleMs);
        return true;
      }
      if (attempt > 0 && !(await dragList(-vh * 0.3))) await wait(250);
    }
    throw new Error(`no button matching "${needle}" on ${process.env.VIEWPORT ?? 'desktop'}`);
  };
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copyHas = async (needle) =>
    (await texts()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });
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
