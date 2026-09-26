/**
 * Ghost raids end to end (M27 Phase 1): two commanders in two war slots of
 * one browser. The defender names itself and shares its base; the attacker
 * plans a ghost against it from the entry edge and sends it; the defender's
 * town fights it and hands back the result; the attacker's game fights it
 * again and pays. Both have to agree on how it ended, and neither code can
 * be used twice. Everything goes through the real text boxes.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5255;
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
  const texts = () => page.evaluate(() => window.lastline.texts());
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.enabled && b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  /** Two identical snapshots in a row: the scene has stopped changing. */
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
  const tap = async (needle, patience = 900) => {
    for (let i = 0; i < 24; i++) {
      const hit = await find(needle);
      if (hit) {
        await page.mouse.click(hit.x, hit.y);
        await settle(Math.max(2500, patience * 3));
        return true;
      }
      await wait(250);
    }
    throw new Error(`no button matching "${needle}" in: ${(await labels()).join(', ')}`);
  };
  /** Tap the button whose label is exactly `label`: rows behind a card can share its words. */
  const tapExact = async (label) => {
    const hit = await page.evaluate((text) => {
      const api = window.lastline;
      const b = api.buttons().find((x) => x.enabled && x.label.toUpperCase() === text);
      return b ? { x: (b.x + b.w / 2) / api.dpr, y: (b.y + b.h / 2) / api.dpr } : null;
    }, label.toUpperCase());
    if (!hit) throw new Error(`no button labelled "${label}"`);
    await page.mouse.click(hit.x, hit.y);
    await settle();
  };
  const has = async (needle) => (await labels()).some((l) => l.toUpperCase().includes(needle));
  /** On screen anywhere: a button, or a line of text. */
  const shows = async (needle) =>
    (await has(needle)) || (await texts()).some((t) => t.toUpperCase().includes(needle));
  const showsSoon = async (needle, tries = 16) => {
    for (let i = 0; i < tries; i++) {
      if (await shows(needle)) return true;
      await wait(250);
    }
    return false;
  };
  /** The open text box: its title, its field, what it says under the field. */
  const box = () =>
    page.evaluate(() => {
      const scrim = document.querySelector('[data-ui="textbox"]');
      return scrim
        ? {
            // The card's first line: the box's own heading.
            title: scrim.firstElementChild?.firstElementChild?.textContent ?? '',
            value: scrim.querySelector('textarea')?.value ?? '',
            status: scrim.querySelector('[data-role="status"]')?.textContent ?? '',
          }
        : null;
    });
  const boxButton = async (label) => {
    await page.click(`[data-ui="textbox"] >> text=${label}`);
    await settle(2500);
  };
  const paste = async (row, value, confirm) => {
    await tap(row);
    await page.fill('[data-ui="textbox"] textarea', value);
    await boxButton(confirm);
  };
  const toMenu = async () => {
    await tap('SYS', 600);
    await tap('MAIN MENU', 1500);
  };
  const warTab = async () => {
    await tap('WAR', 600);
    await showsSoon('SHARE MY BASE');
  };

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  // Two wars: an attacker in slot 1, a defender in slot 2.
  await tap('1 · EMPTY', 1200);
  await tap('UNITED STATES', 1200);
  await tap('STANDARD', 1800);
  await toMenu();
  await tap('2 · EMPTY', 1200);
  await tap('PLA EXPEDITIONARY FORCE', 1200);
  await tap('STANDARD', 1800);
  await toMenu();
  await page.evaluate(() => {
    const poke = (key, change) => {
      const save = JSON.parse(localStorage.getItem(key));
      change(save.town);
      localStorage.setItem(key, JSON.stringify(save));
    };
    poke('lastline_save_v1', (town) => {
      town.unlocked = [...new Set([...town.unlocked, 'frontline'])];
      town.army = { ranger: 8, engineer: 2, javelin: 2 };
    });
    poke('lastline_save_v1_s2', (town) => {
      town.supplies = 20000;
      // A wire line across the middle of the 10x15 board, the edge columns open.
      for (let x = 1; x <= 8; x++) town.walls.push({ cell: 9 * 10 + x, kind: 'wall' });
    });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await wait(2500);

  // ---- the defender names itself and shares its base -------------------------
  await tap('2 · PLA', 1800);
  await warTab();
  check('the WAR tab offers a callsign and the ghost rows', (await has('CALLSIGN')) && (await has('SEND A GHOST RAID')) && (await has('TAKE A GHOST CODE')), (await labels()).filter((l) => /CALLSIGN|GHOST|SHARE|CODE/.test(l)).join(', '));
  await paste('CALLSIGN', 'red lantern', 'SET CALLSIGN');
  check('a callsign is chosen, cleaned, and shown', await showsSoon('CALLSIGN — RED LANTERN'), (await labels()).find((l) => l.includes('CALLSIGN')));
  await tap('SHARE MY BASE');
  const shared = await box();
  check('the base is shared under the callsign', shared?.title.includes('RED LANTERN') === true, shared?.title);
  const baseCode = shared?.value ?? '';
  await boxButton('CLOSE');

  // ---- the attacker plans a ghost against it ------------------------------------
  await toMenu();
  await tap('1 · UNITED STATES', 1800);
  await warTab();
  await paste('CALLSIGN', 'VIPER 43', 'SET CALLSIGN');
  await paste('SEND A GHOST RAID', `${baseCode.slice(0, 30)}zz`, 'PLAN IT');
  const refused = await box();
  check('a damaged base code is refused in words', refused !== null && refused.status.length > 0, refused?.status);
  await page.fill('[data-ui="textbox"] textarea', baseCode);
  await boxButton('PLAN IT');
  check('the planner opens in ghost mode', await showsSoon('GHOST RAID · RED LANTERN'), (await texts()).slice(0, 6).join(' | '));
  check('a ghost carries no fire plan', !(await has('FIRE')));
  await tap('SQUADS', 600);
  const entries = new Set();
  for (let i = 0; i < 4; i++) {
    const entry = (await labels()).find((l) => l.startsWith('ENTRY:'));
    if (entry) entries.add(entry.replace('ENTRY: ', ''));
    await tap('ENTRY:', 400);
  }
  check('a town is entered by its north edge only', [...entries].sort().join(',') === 'N1,N2', [...entries].join(','));
  for (let i = 0; i < 4; i++) await tap('+ RANGER', 400);
  await page.screenshot({ path: 'screenshots/e2e-ghost-plan.png' });
  await tap('SEND GHOST RAID', 1500);
  const sent = await box();
  check('the ghost goes out as a code for its target', sent?.title === 'GHOST RAID FOR RED LANTERN' && (sent?.value.length ?? 0) > 60, `${sent?.title} · ${sent?.value.length} chars`);
  const ghostCode = sent?.value ?? '';
  await boxButton('CLOSE');
  await warTab();
  check('the war remembers the ghost it sent', await has('GHOSTS OUT'), (await labels()).filter((l) => l.includes('GHOST')).join(', '));
  await tap('GHOSTS OUT');
  await tapExact('CODE');
  const copied = await box();
  check('a ghost waiting on its result can be copied again', copied?.value === ghostCode, `${copied?.value.length} chars`);
  await boxButton('CLOSE');
  await tapExact('CLOSE');
  const army = await page.evaluate(() => JSON.parse(localStorage.getItem('lastline_save_v1')).town.army);
  check('sending spends no men', army.ranger === 8, JSON.stringify(army));

  // ---- the defender takes it ----------------------------------------------------
  await toMenu();
  await tap('2 · PLA', 1800);
  await warTab();
  await paste('TAKE A GHOST CODE', ghostCode, 'TAKE IT');
  const held = await showsSoon('GHOST RAID HELD', 4);
  const breached = !held && (await showsSoon('GHOST RAID — BREACHED', 4));
  check('the town fights it and says how it went', held || breached, (await texts()).slice(0, 4).join(' | '));
  check('the card names the attacker', await shows('VIPER 43'));
  await page.screenshot({ path: 'screenshots/e2e-ghost-taken.png' });
  await tap('SEND THE RESULT');
  const result = (await box())?.value ?? '';
  check('the result comes out as a code', result.length > 60, `${result.length} chars`);
  await boxButton('CLOSE');
  await tap('WATCH IT', 1500);
  check('the ghost is watchable as a raid on this town', await showsSoon('GHOST RAID FOOTAGE'));
  // A skip to the end plays none of the battle it jumps over, and still
  // leaves its scars (M31): the board it lands on is the one the battle left.
  // Read either side of the skip in one call, so no frame falls between.
  const skipped = await page.evaluate(() => {
    const read = () => ({ played: window.lastline.impacts().played, scars: window.lastline.scars() });
    const before = read();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    return { before, after: read() };
  });
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  check(
    'a skip to the end plays nothing, and keeps what the battle left',
    sum(skipped.after.played) === sum(skipped.before.played) && sum(skipped.after.scars) >= sum(skipped.before.scars),
    `scars ${JSON.stringify(skipped.before.scars)} → ${JSON.stringify(skipped.after.scars)}`,
  );
  await page.waitForTimeout(1500);
  await tap('AFTER ACTION REPORT', 1500);
  check('the ghost has an after-action report', await showsSoon('AFTER ACTION'), (await texts()).slice(0, 3).join(' | '));
  await page.screenshot({ path: 'screenshots/e2e-ghost-report.png' });
  await page.keyboard.press('Escape');
  await settle();
  if (!(await has('WAR'))) await tap('BACK', 1500);
  await warTab();
  await paste('TAKE A GHOST CODE', ghostCode, 'TAKE IT');
  const again = await box();
  check('a ghost is taken once', again !== null && /already fought/i.test(again.status), again?.status);
  await boxButton('CLOSE');
  const defender = await page.evaluate(() => {
    const town = JSON.parse(localStorage.getItem('lastline_save_v1_s2')).town;
    return { log: town.defenseLog[0], supplies: town.supplies, walls: town.walls.length };
  });
  check('the defence log names who hit it', defender.log?.ghost?.callsign === 'VIPER 43', JSON.stringify(defender.log?.ghost));

  // ---- the attacker collects ----------------------------------------------------
  await toMenu();
  await tap('1 · UNITED STATES', 1800);
  await warTab();
  await paste('TAKE A GHOST CODE', result, 'TAKE IT');
  const thrownBack = await showsSoon('GHOST RAID — THROWN BACK', 4);
  const taken = !thrownBack && (await showsSoon('GHOST RAID — POST TAKEN', 4));
  check('the result is fought again and paid', thrownBack || taken, (await texts()).slice(0, 4).join(' | '));
  check('both commanders agree on how it ended', (held && thrownBack) || (breached && taken), `defender ${held ? 'held' : 'breached'}, attacker ${thrownBack ? 'thrown back' : 'took the post'}`);
  await tap('CLOSE');
  check('a paid ghost is no longer waiting', !(await has('GHOSTS OUT')));
  await paste('TAKE A GHOST CODE', result, 'TAKE IT');
  const twice = await box();
  check('a result is paid once', twice !== null && /already been paid/i.test(twice.status), twice?.status);
  await boxButton('CLOSE');

  // ---- a duel on a commander's town comes in by its edge too ------------------
  await paste('RAID A CODE', baseCode, 'SCOUT IT');
  await tap('SQUADS', 600);
  const duelEntries = new Set();
  for (let i = 0; i < 4; i++) {
    const entry = (await labels()).find((l) => l.startsWith('ENTRY:'));
    if (entry) duelEntries.add(entry.replace('ENTRY: ', ''));
    await tap('ENTRY:', 400);
  }
  check('a duel cannot be planned from the south', [...duelEntries].sort().join(',') === 'N1,N2', [...duelEntries].join(','));

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} ghost check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nGHOST OK: named, shared, planned, sent, fought, returned, paid — once each.');
  }
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
