/**
 * E2E smoke of the first-run flow: intro → faction pick → difficulty pick →
 * town → MISSION 1 → briefing → commence → mission siege. Run with
 * FACTION=china to smoke the Eastern Tide side, VIEWPORT=phone-portrait
 * (see VIEWPORTS) to smoke a different screen.
 *
 * Taps are addressed by button label through `window.lastline.buttons()`, so
 * the harness survives the responsive layout: nothing here knows a pixel.
 *
 * Uses ?demo=flow so headless Chromium gets the setTimeout game loop (any
 * demo value forces it) while every scene still runs its real, non-demo path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const FACTION = ['china', 'russia', 'nk', 'un'].includes(process.env.FACTION)
  ? process.env.FACTION
  : 'usa';

export const VIEWPORTS = {
  'phone-portrait': { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true },
  'phone-landscape': { width: 915, height: 412, deviceScaleFactor: 3, isMobile: true },
  'small-portrait': { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true },
  'tablet-portrait': { width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true },
  'tablet-landscape': { width: 1180, height: 820, deviceScaleFactor: 2, isMobile: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
};
const VIEWPORT = VIEWPORTS[process.env.VIEWPORT] ? process.env.VIEWPORT : 'desktop';

const FACTION_LABEL = {
  usa: 'UNITED STATES',
  china: 'PLA EXPEDITIONARY FORCE',
  russia: 'RUSSIAN GROUND FORCES',
  nk: "KOREAN PEOPLE'S ARMY",
  un: 'UN COALITION',
};

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const { isMobile, ...viewportSize } = VIEWPORTS[VIEWPORT];
  const page = await browser.newPage({
    viewport: { width: viewportSize.width, height: viewportSize.height },
    deviceScaleFactor: viewportSize.deviceScaleFactor,
    hasTouch: isMobile,
    isMobile,
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e && e.stack ? e.stack : String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  mkdirSync('screenshots', { recursive: true });
  const tag = VIEWPORT === 'desktop' ? FACTION : `${FACTION}-${VIEWPORT}`;
  /**
   * Screenshot, and assert the two-camera rig is intact: an object outside
   * both layers is drawn twice (once at board zoom), which is always a bug.
   */
  const shot = async (name) => {
    const strays = await page.evaluate(() => window.lastline?.strays?.() ?? []);
    if (strays.length) errors.push(`${name}: objects outside both camera layers: ${strays.join(', ')}`);
    await page.screenshot({ path: `screenshots/e2e-${tag}-${name}.png` });
  };

  /** Centre of the first visible button whose label contains `needle`. */
  const findButton = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      if (!api) return null;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      if (!hit) return null;
      return {
        x: (hit.x + hit.w / 2) / api.dpr,
        y: (hit.y + hit.h / 2) / api.dpr,
        label: hit.label,
        enabled: hit.enabled,
      };
    }, needle.toUpperCase());

  const vw = viewportSize.width;
  const vh = viewportSize.height;

  /** Drag the scrolling list under `x` so an off-screen row comes into view. */
  const scrollToward = async (x, targetY) => {
    const from = Math.min(vh - 30, Math.max(30, vh * 0.6));
    const dy = Math.max(-vh * 0.4, Math.min(vh * 0.4, vh / 2 - targetY));
    await page.mouse.move(x, from);
    await page.mouse.down();
    await page.mouse.move(x, from + dy, { steps: 12 });
    await page.mouse.up();
    await wait(250);
  };

  const tap = async (needle, settleMs = 900) => {
    for (let attempt = 0; attempt < 24; attempt++) {
      const hit = await findButton(needle);
      if (hit) {
        if (hit.y < 6 || hit.y > vh - 6) {
          await scrollToward(Math.min(vw - 6, Math.max(6, hit.x)), hit.y);
          continue;
        }
        await page.mouse.click(hit.x, hit.y);
        await wait(settleMs);
        return hit;
      }
      await wait(250);
    }
    throw new Error(`no button matching "${needle}" on ${VIEWPORT}`);
  };

  await page.goto(`http://localhost:${PORT}/?demo=flow`, { waitUntil: 'networkidle' });
  await wait(2500);
  await shot('intro');

  await tap(FACTION_LABEL[FACTION]);
  await shot('difficulty');

  await tap('STANDARD', 1500);
  await shot('town-fresh');

  await tap('OPS', 500); // the campaign lives on the OPS tab
  await shot('town-ops');
  await tap('MISSION 1', 1500);
  await shot('briefing');

  await wait(2600); // the transmission reveals a line every 350ms
  await tap('COMMENCE', 2500);
  await shot('mission');

  await browser.close();
  if (errors.length) {
    console.error('ERRORS:');
    for (const e of errors) console.error(' ', e);
    process.exitCode = 1;
  } else {
    console.log(
      `E2E OK (${FACTION} @ ${VIEWPORT}): intro → faction → difficulty → town → briefing → mission siege, no page errors.`,
    );
  }
} finally {
  process.kill(-vite.pid, 'SIGTERM');
}
