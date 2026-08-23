/**
 * The boot card and the single-file build.
 *
 * Two things neither a unit test nor the other harnesses can see. First: the
 * card has to be on screen at the FIRST paint, before 420KB of engine has been
 * fetched and booted — that is the whole point of it, and the only way to know
 * is to look early. Second: the artifact ships as one inlined HTML file, and
 * until now nothing anywhere proved that file even boots.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const PORT = 5231;
const SINGLE = resolve('dist-single/2060td.html');
const EMBED = resolve('dist-single/embed.html');

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
  if (!existsSync(SINGLE)) {
    console.log('building the single-file bundle first…');
    execFileSync('npm', ['run', 'build:single'], { stdio: 'ignore' });
  }

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
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  const card = () =>
    page.evaluate(() => {
      const el = document.getElementById('boot');
      if (!el) return null;
      return {
        text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        gone: el.classList.contains('gone'),
        covers: el.getBoundingClientRect().height > window.innerHeight * 0.8,
      };
    });
  const booted = () => page.evaluate(() => document.querySelectorAll('canvas').length > 0);

  mkdirSync('screenshots', { recursive: true });

  // ---- the card is up before the engine is ------------------------------------------
  // Throttle to a phone on mobile data, which is the condition the card exists
  // for. On localhost the engine arrives faster than a screenshot renders, so
  // an unthrottled check would pass while proving nothing — and this is closer
  // to the truth than delaying a request would be.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1000 * 1024) / 8, // 1 Mbit/s
    uploadThroughput: (1000 * 1024) / 8,
  });
  // 'commit', not 'domcontentloaded': a module script is deferred, and
  // DOMContentLoaded waits for deferred scripts to EXECUTE — so waiting for it
  // means waiting for the very thing this check is meant to happen before.
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'commit' });
  await wait(400); // long enough to parse the HTML, far short of the module
  // Through CDP rather than page.screenshot: Playwright waits for webfonts
  // before it will capture, and on a throttled connection that never lands
  // inside the timeout. Nothing here uses a webfont anyway.
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('screenshots/e2e-boot.png', Buffer.from(shot.data, 'base64'));
  if (process.env.DEBUG) {
    console.log('STATE:', JSON.stringify(await page.evaluate(() => ({
      ready: document.readyState,
      html: document.documentElement.outerHTML.length,
      hasBoot: !!document.getElementById('boot'),
      bodyIds: [...document.body.children].map((c) => c.id || c.tagName),
      canvases: document.querySelectorAll('canvas').length,
    }))));
  }
  const first = await card();
  check('the boot card is painted before the game is', first !== null, JSON.stringify(first));
  check('it says what this is', (first?.text ?? '').includes('2060TD'), first?.text);
  check('and it covers the screen', first?.covers === true);
  check('while the engine is still in flight', (await booted()) === false);

  // ---- and comes down once there are pixels behind it --------------------------------
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await wait(4000);
  check('the game boots', await booted());
  check('and the card is taken off the page entirely', (await card()) === null, JSON.stringify(await card()));

  // ---- the artifact build is a real, working game ------------------------------------
  // Statically, because there is nothing to wait for: the artifact's script is
  // inline, so it executes as the parser reaches it and the card is gone
  // before anything can look. That absence of a gap is the point.
  const markup = readFileSync(SINGLE, 'utf8');
  check(
    'the single-file build carries the same card',
    markup.includes('id="boot"') && markup.includes('2060TD'),
    `${(markup.length / 1024 / 1024).toFixed(2)}MB`,
  );
  await page.goto(`file://${SINGLE}`, { waitUntil: 'commit' });
  await wait(5000);
  check('and boots with no second request', await booted());
  check('and clears its card too', (await card()) === null);
  const labels = await page.evaluate(() => window.lastline?.buttons().map((b) => b.label) ?? []);
  check(
    'and reaches a menu you can play from',
    labels.some((l) => l.includes('EMPTY') || l.includes('·')),
    labels.join(', ') || 'no buttons',
  );

  // ---- and so does the shell-less page the artifact host actually gets -------------
  await page.goto(`file://${EMBED}`, { waitUntil: 'commit' });
  await wait(5000);
  const embedLabels = await page.evaluate(() => window.lastline?.buttons().map((b) => b.label) ?? []);
  check(
    'the shell-less embed page boots the same game',
    (await booted()) && embedLabels.some((l) => l.includes('EMPTY')),
    embedLabels.join(', ') || 'no buttons',
  );
  check('and clears its card as well', (await card()) === null);

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures.push('page errors');
  }
  if (failures.length) {
    console.error(`\n${failures.length} boot check(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nBOOT OK: card first, game second, and the single file works standalone.');
  }
} finally {
  // A stray dev server from an interrupted run leaves this pid invalid; that
  // is not worth masking the real failure with an ESRCH stack trace.
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
