/**
 * The career (M28 Phase 3): merit, the War College and a war retired.
 *
 * The loop a returning commander plays: buy a head start with the merit a
 * retired war banked, begin a war and find it opening further along (with the
 * officer the reserve kept), fight it a little way, retire it from inside and
 * find it on the honour roll with its merit banked and its officer back in the
 * reserve. The career is seeded into storage, as a save is; everything after
 * that is tapped.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5258;
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
};
const VIEWPORT = VIEWPORTS[process.env.VIEWPORT] ? process.env.VIEWPORT : 'desktop';
const CAREER_KEY = 'lastline_career_v1';
const SAVE_KEY = 'lastline_save_v1';

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
  const { isMobile, ...size } = VIEWPORTS[VIEWPORT];
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
    page.evaluate(() => window.lastline.buttons().map((b) => `${b.label}${b.sub ? ` ${b.sub}` : ''}`));
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  /** Wait for the UI to stop changing, as every harness here does. */
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
  /** An overlay is longer than a screen on a phone: bring a button into view before asking for it. */
  const scrollTo = (label) =>
    page.evaluate((text) => {
      const hit = [...document.querySelectorAll('[data-ui="overlay"] button')].find((b) =>
        b.textContent.toUpperCase().includes(text),
      );
      hit?.scrollIntoView({ block: 'center' });
      return Boolean(hit);
    }, label.toUpperCase());
  const tap = async (needle, settleMs = 900) => {
    for (let i = 0; i < 20; i++) {
      const hit = await find(needle);
      if (hit) {
        await page.mouse.click(hit.x, hit.y);
        await settle(Math.max(2500, settleMs * 3));
        return true;
      }
      await scrollTo(needle);
      await wait(250);
    }
    throw new Error(`no button matching "${needle}"`);
  };
  const has = async (needle) => (await labels()).some((l) => l.toUpperCase().includes(needle.toUpperCase()));
  const copy = async () =>
    (await page.evaluate(() => window.lastline.texts())).flatMap((t) => t.split('\n')).map((l) => l.trim());
  const copyHas = async (needle) => (await copy()).some((t) => t.toUpperCase().includes(needle.toUpperCase()));
  const copyLike = async (needle) =>
    (await copy()).find((t) => t.toUpperCase().includes(needle.toUpperCase())) ?? '';
  const stored = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2000);

  // ---- a commander with merit in hand and an officer in the reserve ----------
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        merit: 200,
        earned: 200,
        bought: { chest: 0, opening: 0, quartermasters: 0, staff: 0 },
        wars: [],
        reserve: { usa: { name: 'K. BRENNAN', doctrine: 'hunt', xp: 380, raids: 22, clears: 17, since: 0 } },
        winners: [],
      }),
    );
  }, CAREER_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);

  check('the menu offers the War College with the merit in hand', await has('WAR COLLEGE 200 MERIT'), (await labels()).join(', '));
  await tap('WAR COLLEGE', 900);
  check('it says what the commander holds', await copyHas('200 MERIT IN HAND'), '');
  check('and who waits in the reserve', await copyHas('K. BRENNAN'), await copyLike('BRENNAN'));
  await tap('BUY LV 1', 900);
  check('a head start is bought', await copyHas('WAR CHEST · LV 1/3'), await copyLike('WAR CHEST'));
  check('for its price', await copyHas('185 MERIT IN HAND'), '');
  const afterBuy = await stored(CAREER_KEY);
  check('and the career keeps it', afterBuy?.bought?.chest === 1 && afterBuy?.merit === 185, JSON.stringify(afterBuy?.bought));
  await page.screenshot({ path: `screenshots/e2e-career-college${isMobile ? '-phone' : ''}.png` });
  await tap('BACK', 900);

  // ---- a new war opens with it -----------------------------------------------
  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  check('the war opens by naming its head start', await copyHas('HEAD START'), '');
  check('the war chest', await copyHas('WAR CHEST: +2,000 supplies'), await copyLike('WAR CHEST'));
  check('and the officer from the reserve', await copyHas('K. BRENNAN'), await copyLike('BRENNAN'));
  const opened = await stored(SAVE_KEY);
  check('the stores hold it', opened?.town?.supplies >= 2600, String(opened?.town?.supplies));
  check(
    'the officer commands the first squad',
    opened?.town?.squads?.[0]?.officer?.name === 'K. BRENNAN',
    JSON.stringify(opened?.town?.squads?.[0]?.officer?.name),
  );
  check('and has left the reserve', (await stored(CAREER_KEY))?.reserve?.usa === undefined, '');
  await page.screenshot({ path: `screenshots/e2e-career-headstart${isMobile ? '-phone' : ''}.png` });
  await tap('TO WAR', 900);

  // ---- fought a little way, and retired from inside --------------------------
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.town.frontline.tier = 5;
    localStorage.setItem(key, JSON.stringify(save));
  }, SAVE_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2000);
  await tap('1 · UNITED STATES', 1800);
  await tap('SYS', 700);
  check('the SYS tab says what retiring would bank', await has('RETIRE THE WAR +10 MERIT'), (await labels()).join(', '));
  await tap('RETIRE THE WAR', 700);
  check('the first tap only arms it', await has('TAP AGAIN TO RETIRE'), '');
  await tap('TAP AGAIN TO RETIRE', 1200);
  check('the war is retired', await copyHas('THE WAR IS RETIRED'), '');
  check('with its breakdown', await copyHas('THE FRONT: the 5th rung · 10'), await copyLike('THE FRONT'));
  check('and what it banked', await copyHas('+10 MERIT'), '');
  check('its officer goes back to the reserve', await copyHas('goes to the reserve'), await copyLike('reserve'));
  await page.screenshot({ path: `screenshots/e2e-career-retired${isMobile ? '-phone' : ''}.png` });
  const retiredCareer = await stored(CAREER_KEY);
  check(
    'the career banks the merit and keeps the officer',
    retiredCareer?.merit === 195 && retiredCareer?.reserve?.usa?.name === 'K. BRENNAN',
    `${retiredCareer?.merit} · ${retiredCareer?.reserve?.usa?.name}`,
  );
  await tap('TO THE MENU', 1500);
  check('the slot is free for the next war', await has('1 · EMPTY'), (await labels()).join(', '));
  await tap('WAR COLLEGE', 900);
  check('and the war is on the honour roll', await copyHas('USA · 1 day · the 5th rung · 10 MERIT'), await copyLike('USA ·'));
  await tap('BACK', 900);

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} career check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nCAREER OK: merit buys a head start, a war opens with it, and a war retired banks its merit.');
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
