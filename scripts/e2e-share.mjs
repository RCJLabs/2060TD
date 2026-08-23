/**
 * Share codes end to end (v1.2): copy your own base out of the game, paste it
 * back in as a challenge, and fight it. The text box is real DOM over the
 * canvas, so this drives it with real typing rather than a game-side hook.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5185;
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const labels = () => page.evaluate(() => window.lastline.buttons().map((b) => b.label));
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  const tap = async (needle, settleMs = 900) => {
    for (let i = 0; i < 24; i++) {
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
  const has = async (needle) => (await labels()).some((l) => l.toUpperCase().includes(needle));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  // A campaign far enough along that the Front Line is unlocked.
  await tap('NEW WAR', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  await page.evaluate(() => {
    const raw = localStorage.getItem('lastline_save_v1');
    const save = JSON.parse(raw);
    const town = save.town;
    town.supplies = 20000;
    town.fuel = 8000;
    town.unlocked = [...new Set([...town.unlocked, 'frontline', 'autocannon', 'aa', 'barracks'])];
    town.army = { ranger: 6, engineer: 3, javelin: 3 };
    for (let y = 4; y < 18; y++) town.walls.push({ cell: y * 32 + 22, kind: 'wall' });
    localStorage.setItem('lastline_save_v1', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);
  await tap('CONTINUE', 1800);

  // Share: the code comes out of a read-only text box.
  await tap('WAR', 600);
  check('the WAR tab offers a share code', await has('SHARE MY BASE'), (await labels()).slice(5, 12).join(', '));
  await tap('SHARE MY BASE', 900);
  const code = await page.evaluate(() => document.querySelector('textarea')?.value ?? '');
  check('a code is produced', code.length > 40 && /^[A-Za-z0-9\-_]+$/.test(code), `${code.length} chars`);
  await page.screenshot({ path: 'screenshots/e2e-sharecode.png' });
  await page.click('text=CLOSE');
  await wait(500);

  // Paste something broken first: it must be refused, in words.
  await tap('RAID A CODE', 900);
  await page.fill('textarea', `${code.slice(0, 30)}zz`);
  await page.click('text=SCOUT IT');
  await wait(600);
  const stillOpen = await page.evaluate(() => document.querySelector('textarea') !== null);
  const status = await page.evaluate(
    () => document.querySelector('[data-role="status"]')?.textContent ?? '',
  );
  check('a damaged code is refused with a reason', stillOpen && status.length > 0, status);

  // Now the real thing.
  await page.fill('textarea', code);
  await page.click('text=SCOUT IT');
  await wait(1800);
  const gone = await page.evaluate(() => document.querySelector('textarea') === null);
  check('a good code closes the box and opens the planner', gone && (await has('MUSTER')), (await labels()).slice(0, 6).join(', '));
  // The CHALLENGE line is a heading, not a button, so prove it by absence:
  // a duel has no target to cycle and no recon to buy.
  check('the duel is off the ladder', !(await has('TARGET 1/')), (await labels()).slice(3, 9).join(', '));
  check('there is nothing to scout', !(await has('SCOUT TARGET')));
  await page.screenshot({ path: 'screenshots/e2e-challenge.png' });

  // Send a squad and make sure it resolves.
  await tap('SQUADS', 600);
  for (let i = 0; i < 3; i++) await tap('+ RANGER', 400);
  await tap('LAUNCH RAID', 2500);
  check('the duel resolves', (await has('RETURN TO BASE')) || (await has('WATCH REPLAY')), (await labels()).join(', '));

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} share check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nSHARE OK: code out, code in, duel fought.');
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
