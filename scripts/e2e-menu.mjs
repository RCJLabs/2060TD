/**
 * The front-end loop: main menu → new war → settings → back to the menu →
 * resume. From v1.4 that menu is three war slots, so this also proves the
 * thing slots exist for: starting a second war must not cost you the first.
 * Everything is addressed by label through `window.lastline`, so it runs on
 * any viewport.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5187;
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
};
const VIEWPORT = VIEWPORTS[process.env.VIEWPORT] ? process.env.VIEWPORT : 'desktop';

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

  // Slot state lives in the right-aligned sub (NEW WAR / T3 · VANGUARD / ERASE),
  // so the harness reads both halves of a row.
  const labels = () =>
    page.evaluate(() =>
      window.lastline.buttons().map((b) => `${b.label}${b.sub ? ` ${b.sub}` : ''}`),
    );
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr } : null;
    }, needle.toUpperCase());
  const tap = async (needle, settleMs = 900) => {
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
  const has = async (needle) => (await labels()).some((l) => l.toUpperCase().includes(needle));
  /**
   * Every button label, checked against its own box: centred vertically, and
   * inside it horizontally.
   *
   * Both halves have failed in this project. A top-origin label is only
   * centred by the code that measures it, so a button nobody laid out again
   * after construction drew its text flush against the top of the box. And an
   * unwrapped label centred in a box narrower than itself does not clip — it
   * runs off BOTH edges of a phone. Neither shows up in a label-based
   * assertion, because the text is all still there and still findable.
   */
  const misfits = () =>
    page.evaluate(() => {
      const api = window.lastline;
      const rects = api.textRects();
      const bad = [];
      for (const b of api.buttons()) {
        const t = rects.find((r) => r.text === b.label);
        if (!t) continue;
        const offset = Math.abs(b.y + b.h / 2 - (t.y + t.h / 2)) / api.dpr;
        const spill =
          Math.max(0, b.x - t.x, t.x + t.w - (b.x + b.w)) / api.dpr;
        if (offset > 3 || spill > 1) {
          bad.push(`${b.label} (off ${Math.round(offset)}px, spill ${Math.round(spill)}px)`);
        }
      }
      return bad;
    });
  /** Nothing drawn by the top layer may leave the screen sideways. */
  const offscreen = () =>
    page.evaluate(() => {
      const api = window.lastline;
      const top = Math.max(...api.textRects().map((r) => r.depth));
      return api
        .textRects()
        .filter((r) => r.depth === top)
        .filter((r) => r.x / api.dpr < -1 || (r.x + r.w) / api.dpr > window.innerWidth + 1)
        .map((r) => `${r.text.slice(0, 30)} @${Math.round(r.x / api.dpr)}`);
    });
  /**
   * Wait for a row rather than assuming a fixed settle is enough. A town does
   * real work on its first frames — offline probes, accrual, a banner — and on
   * a loaded machine the pause after starting a war is not always the town
   * being drawn. That is how this harness flaked once.
   */
  const hasSoon = async (needle, tries = 16) => {
    for (let i = 0; i < tries; i++) {
      if (await has(needle)) return true;
      await wait(250);
    }
    return false;
  };

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);

  check('a fresh boot lands on the menu', await has('NEW WAR'), (await labels()).join(', '));
  check(
    'with three empty slots',
    (await has('1 · EMPTY')) && (await has('2 · EMPTY')) && (await has('3 · EMPTY')),
    (await labels()).join(', '),
  );
  check('and nothing to erase', !(await has('ERASE A WAR')));
  {
    const bad = await misfits();
    check('every menu row holds its label square in its box', bad.length === 0, bad.join(' ; '));
    const out = await offscreen();
    check('and nothing on the front door runs off the screen', out.length === 0, out.join(' ; '));
  }

  // Settings, straight from the front door.
  await tap('SETTINGS');
  check('the menu opens settings', await has('EFFECTS'), (await labels()).join(', '));
  check('with a mixer, not one switch', await has('MUSIC'), (await labels()).join(', '));
  {
    // Settings rows are plain overlay buttons — laid out once at construction
    // and never again. They are the case a row that only centres itself when
    // something re-lays it out gets wrong, so this is where that is checked.
    const bad = await misfits();
    check('settings rows hold their labels square in the box', bad.length === 0, bad.join(' ; '));
  }
  // Five stops on a button: walk it all the way round and back to where it was.
  const level = () => labels().then((l) => l.find((x) => x.startsWith('MUSIC')));
  const start = await level();
  const walked = [start];
  for (let i = 0; i < 5; i++) {
    await tap('MUSIC', 500);
    walked.push(await level());
  }
  check(
    'the mixer steps through its stops and wraps',
    new Set(walked).size === 5 && walked[5] === start,
    walked.join(' → '),
  );
  check('the menu settings offer no MAIN MENU link', !(await has('MAIN MENU')));
  await tap('CLOSE');
  check('closing returns to the menu', await has('NEW WAR'));

  // Into the first war, in slot 1.
  await tap('1 · EMPTY', 1200);
  {
    // The faction picker is where the long labels live: a faction name plus an
    // operation name is a phrase, and on a phone it has to wrap or leave.
    const bad = await misfits();
    check('the faction picker holds its labels too', bad.length === 0, bad.join(' ; '));
    const out = await offscreen();
    check('and keeps every command on the screen', out.length === 0, out.join(' ; '));
  }
  await tap('UNITED STATES', 1200);
  {
    const bad = await misfits();
    check('so does the commitment screen', bad.length === 0, bad.join(' ; '));
  }
  await tap('STANDARD', 1800);
  check('the town is up', await has('SUPPLY DEPOT'), (await labels()).slice(5, 8).join(', '));

  // Settings from inside, then the way home.
  await tap('SYS', 600);
  await tap('SETTINGS', 900);
  check('the same settings screen opens in-game', await has('COLORBLIND'));
  check('in-game settings offer the way back', await has('MAIN MENU'));
  check('and the campaign file', await has('EXPORT SAVE'));

  // Export has to work in two kinds of page, and until v1.17.1 it only worked
  // in one: the artifact viewer grants a page no download permission, so the
  // anchor was clicked and nothing happened, silently. Both routes are checked
  // here, and both are checked by their OUTCOME — the row says what became of
  // the file, which is the part that was missing.
  const exportLabel = async () =>
    (await labels()).find((l) => /EXPORT|SAVED —/.test(l.toUpperCase())) ?? '';
  await page.evaluate(() => {
    // Swallow the real download so the run does not leave a file behind, and
    // record that the anchor route was actually taken.
    window.__saved = [];
    const make = document.createElement.bind(document);
    document.createElement = (tag) => {
      const el = make(tag);
      if (tag === 'a') {
        el.click = () => window.__saved.push(el.download);
      }
      return el;
    };
  });
  await tap('EXPORT SAVE', 900);
  const anchored = await page.evaluate(() => window.__saved);
  check(
    'an ordinary browser gets the file through a download link',
    anchored.length === 1 && anchored[0] === '2060td-save.json',
    anchored.join(', '),
  );
  check(
    'and the row says the file went',
    /SAVED — 2060TD-SAVE\.JSON/.test((await exportLabel()).toUpperCase()),
    await exportLabel(),
  );

  // Now stand in for the viewer: a host that serves the save capability must be
  // used instead of the link, and a refusal must read as a refusal.
  await tap('CLOSE', 700);
  await page.evaluate(() => {
    window.__offered = [];
    window.__decline = false;
    window.claude = {
      use: (name) =>
        Promise.resolve(
          name === 'downloads'
            ? {
                save: (req) => {
                  window.__offered.push(req.filename);
                  return window.__decline
                    ? Promise.reject({ code: 'declined' })
                    : Promise.resolve({ status: 'saved' });
                },
              }
            : null,
        ),
    };
  });
  await tap('SETTINGS', 900);
  await tap('EXPORT SAVE', 900);
  const offered = await page.evaluate(() => window.__offered);
  const stillAnchored = await page.evaluate(() => window.__saved.length);
  check(
    'a viewer that can save files is used instead of the link',
    offered.length === 1 && offered[0] === '2060td-save.json' && stillAnchored === 1,
    `offered ${offered.join(', ')} · anchor clicks ${stillAnchored}`,
  );
  await tap('CLOSE', 700);
  await page.evaluate(() => {
    window.__decline = true;
  });
  await tap('SETTINGS', 900);
  await tap('EXPORT SAVE', 900);
  check(
    'and a viewer that says no reads as cancelled, not as saved',
    /CANCELLED/.test((await exportLabel()).toUpperCase()),
    await exportLabel(),
  );
  await page.evaluate(() => {
    delete window.claude;
  });
  await tap('CLOSE', 700);

  await tap('MAIN MENU', 1500);
  check('the SYS tab walks back to the menu', await has('3 · EMPTY'), (await labels()).join(', '));
  check('war 1 is now on the board', await has('1 · UNITED STATES'));
  check('and there is something to erase', await has('ERASE A WAR'));

  // A second war, in a second slot. This is the whole point of slots.
  await tap('2 · EMPTY', 1200);
  await tap('PLA EXPEDITIONARY FORCE', 1200);
  await tap('STANDARD', 1800);
  // 'SUPPLY POINT' for the PLA, 'SUPPLY DEPOT' for the USA — the building
  // names are faction flavour, which is itself proof this is another war.
  check(
    'the second war starts fresh',
    await hasSoon('SUPPLY'),
    (await labels()).slice(5, 8).join(', '),
  );
  await tap('SYS', 600);
  await tap('MAIN MENU', 1500);
  check(
    'both wars are on the board at once',
    (await has('1 · UNITED STATES')) && (await has('2 · PLA EXPEDITIONARY FORCE')),
    (await labels()).join(', '),
  );
  await page.screenshot({ path: `screenshots/e2e-menu-${VIEWPORT}.png` });

  await tap('1 · UNITED STATES', 1800);
  check('and the first one resumes', await has('SUPPLY DEPOT'));
  const faction = await page.evaluate(() =>
    window.lastline.texts().find((t) => t.includes('UNITED STATES')),
  );
  check('as the war it was', faction !== undefined, faction ?? 'no faction line');
  await tap('SYS', 600);
  await tap('MAIN MENU', 1500);

  // Erasing takes two taps and takes exactly one war.
  await tap('ERASE A WAR', 700);
  check('erase mode marks the wars', await has('ERASE'), (await labels()).join(', '));
  await tap('2 · PLA', 700);
  check('the first tap only arms it', await has('TAP AGAIN'), (await labels()).join(', '));
  await tap('TAP AGAIN', 900);
  check(
    'the second tap takes that war and only that war',
    (await has('2 · EMPTY')) && (await has('1 · UNITED STATES')),
    (await labels()).join(', '),
  );

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} menu check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nMENU OK: front door, settings from both sides, and the walk back.');
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
