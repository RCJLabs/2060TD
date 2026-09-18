/**
 * Headless smoke test + screenshots: the scripted siege (?demo=1) and the
 * showcase town (?demo=town). Starts a Vite dev server, drives Chromium,
 * saves screenshots/demo.png and screenshots/town.png.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Dev server did not come up at ${url}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch {
    // Version-mismatched browser cache: use the preinstalled binary directly.
    return await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});

try {
  await waitForServer(`http://localhost:${PORT}/`);
  const browser = await launchBrowser();
  mkdirSync('screenshots', { recursive: true });
  const errors = [];

  const PHONE = { width: 412, height: 915, deviceScaleFactor: 3, isMobile: true };

  const shoot = async (query, waitMs, file, device, drive) => {
    const page = device
      ? await browser.newPage({
          viewport: { width: device.width, height: device.height },
          deviceScaleFactor: device.deviceScaleFactor,
          isMobile: true,
          hasTouch: true,
        })
      : await browser.newPage({ viewport: { width: 1300, height: 800 } });
    page.on('pageerror', (err) => errors.push(`${query}: ${String(err)}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`${query}: ${msg.text()}`);
    });
    await page.goto(`http://localhost:${PORT}/?${query}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(waitMs);
    if (drive) await drive(page);
    // The two-camera rig: anything outside both layers renders twice.
    const strays = await page.evaluate(() => window.lastline?.strays?.() ?? []);
    if (strays.length) errors.push(`${query}: outside both camera layers: ${strays.join(', ')}`);
    await page.screenshot({ path: `screenshots/${file}` });
    await page.close();
  };

  await shoot('demo=1', 9000, 'demo.png'); // mid-battle, past the fire mission
  await shoot('demo=town', 3000, 'town.png'); // showcase base
  await shoot('demo=raid', 3000, 'raid.png'); // the Front Line planner
  await shoot('demo=1&faction=china', 9000, 'demo-china.png'); // Eastern Tide battle
  await shoot('demo=raid&faction=china', 3000, 'raid-china.png'); // PLA raids a US firebase
  await shoot('demo=1&faction=russia', 9000, 'demo-russia.png'); // Iron Corridor battle
  await shoot('demo=raid&faction=russia', 3000, 'raid-russia.png'); // RU raids a US firebase
  await shoot('demo=1&faction=nk', 9000, 'demo-nk.png'); // Silent Tunnels battle
  await shoot('demo=raid&faction=nk', 3000, 'raid-nk.png'); // KPA raid with a sited gallery
  await shoot('demo=1&faction=un', 9000, 'demo-un.png'); // Blue Line battle
  await shoot('demo=raid&faction=un', 3000, 'raid-un.png'); // UN raid with medics mustered

  // The two surfaces a label-driven harness cannot judge.
  //
  // The front door and a full-screen overlay are drawn almost entirely by
  // `overlay.ts`, which has its own ground, its own type colours and its own
  // border — and a regression there is INVISIBLE to every E2E check in the
  // suite, because the text objects are all still present and still report
  // their strings. The ink pass shipped exactly that bug for one commit:
  // #111 type on an 86% black scrim, with every harness green.
  const tapLabel = async (page, needle) => {
    for (let i = 0; i < 20; i++) {
      const hit = await page.evaluate((n) => {
        const b = (window.lastline?.buttons?.() ?? []).find((x) =>
          `${x.label} ${x.sub}`.toUpperCase().includes(n),
        );
        return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
      }, needle);
      if (hit) {
        await page.mouse.click(hit.x, hit.y);
        await page.waitForTimeout(800);
        return;
      }
      await page.waitForTimeout(250);
    }
    throw new Error(`no button matching "${needle}"`);
  };
  await shoot('', 2500, 'menu.png');
  await shoot('demo=town', 2500, 'overlay.png', undefined, async (page) => {
    await tapLabel(page, 'WAR');
    await tapLabel(page, 'SERVICE RECORD');
  });

  // Mobile-first: the same three screens as a phone actually renders them.
  await shoot('demo=town', 3000, 'phone-town.png', PHONE);
  await shoot('demo=1', 9000, 'phone-siege.png', PHONE);
  await shoot('demo=raid', 3000, 'phone-raid.png', PHONE);

  await browser.close();

  if (errors.length > 0) {
    console.error('Page errors detected:');
    for (const err of errors) console.error(`  ${err}`);
    process.exitCode = 1;
  } else {
    console.log('OK: demo/town/raid + faction variants written, no page errors.');
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
