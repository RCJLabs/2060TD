/**
 * The replay vault (v1.11): a battle is its config, so a battle is a string.
 *
 * What this proves that a unit test cannot: the round trip survives the whole
 * product. A raid fought in the browser is filed, copied out of the vault as a
 * code, pasted back in, and played — and the viewer opens on it. The unit
 * tests prove the decoded config re-fights to the same state hash; this proves
 * a player can actually get a code out of one machine and into another.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5209;
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
  const copy = async () => (await texts()).flatMap((t) => t.split('\n')).map((l) => l.trim());
  const copyHas = async (needle) =>
    (await copy()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  // A war far enough along to raid: the vault fills from battles, not fixtures.
  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    const town = save.town;
    town.supplies = 20000;
    town.fuel = 8000;
    town.intel = 400;
    town.unlocked = [...new Set([...town.unlocked, 'frontline', 'autocannon', 'barracks'])];
    town.army = { ranger: 8, engineer: 3, javelin: 3, abrams: 2 };
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);

  await tap('WAR', 700);
  check('the vault starts empty', /EMPTY/.test(await rowLike('REPLAY VAULT')), await rowLike('REPLAY VAULT'));

  // Fight a real raid, so the entry is a battle rather than a fixture.
  await tap('FRONT LINE', 1600);
  // First arrival at the planner gets the coach screen (v1.5), and its scrim
  // swallows taps meant for the panel underneath — dismiss it before playing.
  if ((await labels()).some((l) => l.toUpperCase().includes('UNDERSTOOD'))) {
    await tap('UNDERSTOOD', 900);
  } else if ((await labels()).some((l) => l.toUpperCase() === 'CLOSE')) {
    await tap('CLOSE', 900);
  }
  await tap('SQUADS', 700);
  for (let i = 0; i < 4; i++) await tap('+ RANGER', 250);
  await tap('+ M1 ABRAMS', 500);
  await page.keyboard.press('Space'); // LAUNCH
  await wait(2500);
  check('the raid resolves', await copyHas('COMMAND POST'), '');
  await page.keyboard.press('Escape'); // RETURN TO BASE
  await wait(2200);

  await tap('WAR', 700);
  const row = await rowLike('REPLAY VAULT');
  check('the battle is filed on the way home', /1\/10/.test(row), row);

  await tap('REPLAY VAULT', 900);
  check('the vault lists it as a raid', await copyHas('RAID ·'), '');
  check('with the outcome the config cannot know', await copyHas('destroyed'), '');

  // The code IS the entry, so copying it is just reading it back out.
  await page.screenshot({ path: `screenshots/e2e-vault${isMobile ? '-phone' : ''}.png` });
  await tap('COPY CODE', 900);
  const code = await page.evaluate(() => document.querySelector('textarea')?.value ?? '');
  check(
    'a code comes out of the vault',
    code.length > 100 && /^[A-Za-z0-9\-_]+$/.test(code),
    `${code.length} chars`,
  );
  await page.click('text=CLOSE');
  await wait(600);

  // Wipe the vault, then paste the code back: the battle survives the trip.
  await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('lastline_save_v1'));
    save.town.vault = [];
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('1 · UNITED STATES', 1800);
  await tap('WAR', 700);
  check('the wiped vault is empty again', /EMPTY/.test(await rowLike('REPLAY VAULT')), '');

  await tap('REPLAY VAULT', 900);
  await tap('WATCH A CODE', 900);
  // The text box is DOM, so its buttons and its status line are read there.
  await page.fill('textarea', 'this is not a code');
  await page.click('text=WATCH IT');
  await wait(700);
  const stillOpen = await page.evaluate(() => document.querySelector('textarea') !== null);
  const status = await page.evaluate(
    () => document.querySelector('[data-role="status"]')?.textContent ?? '',
  );
  check('a bad paste is refused, in words', stillOpen && status.length > 0, status);

  await page.fill('textarea', code);
  await page.click('text=WATCH IT');
  await wait(2500);
  const gone = await page.evaluate(() => document.querySelector('textarea') === null);
  check('a good paste is accepted', gone, '');
  check(
    'and the viewer opens on the pasted battle',
    (await labels()).some((l) => /SPEED|SKIP|×/i.test(l)),
    (await labels()).slice(0, 6).join(', '),
  );
  await page.screenshot({ path: `screenshots/e2e-vault-replay${isMobile ? '-phone' : ''}.png` });

  await browser.close();
  if (errors.length) {
    console.error('PAGE ERRORS:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`VAULT FAILURES: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('VAULT OK: a battle filed, copied out as a string, and played back in.');
  }
} finally {
  // A cleanup failure must not masquerade as a test result.
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
