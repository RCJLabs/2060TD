/**
 * The service record (v1.10): the war's own file, on the WAR tab.
 *
 * Almost every number on this screen is read rather than stored, so what this
 * harness is really checking is that the reading is wired to the right state —
 * and that a page of it lays out without drawing over itself on a phone,
 * which is how the last two overlay bugs in this project shipped.
 *
 * The clock is pinned so DAY N and the standing line are the same every run.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5208;
/** Monday 5 Jan 2026 00:00 UTC — LADDER_EPOCH in content/leagues.ts. */
const EPOCH = Date.UTC(2026, 0, 5);
const DAY = 24 * 3_600_000;

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
  const tap = async (needle, settleMs = 800) => {
    for (let i = 0; i < 20; i++) {
      const hit = await find(needle);
      if (hit) {
        await page.mouse.click(hit.x, hit.y);
        await wait(settleMs);
        return true;
      }
      await wait(250);
    }
    throw new Error(`no button matching "${needle}"`);
  };
  const rowLike = async (needle) =>
    (await labels()).find((l) => l.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const copy = async () => (await texts()).flatMap((t) => t.split('\n')).map((l) => l.trim());
  const copyHas = async (needle) =>
    (await copy()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));
  const copyLike = async (needle) =>
    (await copy()).find((t) => t.toUpperCase().includes(needle.toUpperCase())) ?? '';

  mkdirSync('screenshots', { recursive: true });
  await page.clock.setFixedTime(new Date(EPOCH + 9 * DAY + 11 * 3_600_000));
  await page.goto(`http://localhost:${PORT}/?demo=town`, { waitUntil: 'networkidle' });
  await wait(2500);

  await tap('WAR', 700);
  const row = await rowLike('SERVICE RECORD');
  check('the WAR tab offers the record, and says how long the war is', /DAY \d+/.test(row), row);

  await tap('SERVICE RECORD', 900);
  check('it opens onto the board', await copyHas('THE BOARD'), '');
  const standing = await copyLike('day of standing');
  const standingLine = standing || (await copyLike('days of standing'));
  check(
    'with a standing line that says where it is and where it has been',
    /now \d+/.test(standingLine) && /peak \d+/.test(standingLine),
    standingLine,
  );
  check(
    'and reads the trend rather than leaving it to the eye',
    /CLIMBING|SLIPPING|HOLDING/.test(standingLine),
    '',
  );

  for (const section of ['THE OFFENSE', 'THE DEFENSE', 'THE LONG GAME']) {
    check(`it carries ${section}`, await copyHas(section), '');
  }
  const lost = await copyLike('Men lost');
  check('the offense counts the dead', /Men lost \d+/.test(lost), lost);
  const formation = await copyLike('HAMMER');
  check('and names the formations that took them', /HAMMER/.test(formation), formation);
  const away = await copyLike('While you were away');
  check('the defense counts the war nobody watched', /probe/.test(away), away);

  // The overlay is long, and this project has shipped the same overlap bug
  // twice: a block laid out from a guessed line count, drawn over by the next
  // one once the text wrapped. Ask where the record's own lines actually
  // landed and check that none of them sit on top of another.
  const overlap = await page.evaluate(() => {
    const wanted = [
      'THE BOARD',
      'of standing',
      'Tier ',
      'THE OFFENSE',
      'Raids launched',
      'Men lost',
      'THE DEFENSE',
      'Battles won',
      'While you were away',
      'THE LONG GAME',
      'Missions completed',
    ];
    const all = window.lastline.textRects() ?? [];
    // Scope to the modal layer. The WAR tab behind the scrim has a heading
    // called THE BOARD too, and an overlay line sitting on a panel row it
    // covers is not an overlap — that false positive is what depth is for.
    const top = Math.max(...all.map((r) => r.depth));
    const rects = all
      .filter((r) => r.depth >= top - 1)
      .filter((r) => wanted.some((w) => r.text.includes(w)));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        // A couple of pixels of leading is not an overlap; a shared line is.
        if (dx > 2 && dy > 3) {
          return `"${a.text.slice(0, 24)}" over "${b.text.slice(0, 24)}"`;
        }
      }
    }
    return `${rects.length} lines, none overlapping`;
  });
  check(
    'nothing in the record draws over itself',
    /none overlapping/.test(overlap),
    overlap,
  );

  await page.screenshot({ path: `screenshots/e2e-record${isMobile ? '-phone' : ''}.png` });
  await tap('CLOSE', 700);
  check('and it closes', !(await copyHas('THE LONG GAME')), '');

  await browser.close();
  if (errors.length) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`RECORD FAILURES: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('RECORD OK: the war has a file, and it reads on a phone.');
  }
} finally {
  // A cleanup failure must not masquerade as a test result.
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
