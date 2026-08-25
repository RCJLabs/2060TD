/**
 * The installable-app checks (v1.26).
 *
 * Everything else in this suite drives the Vite dev server, which is exactly
 * where a service worker must NOT be — it would cache dev modules and hand
 * stale ones to the next edit. So these checks serve a real production build
 * over http instead, which is also the only way to get an honest answer: a
 * manifest that parses in dev can still ship with an icon path that 404s once
 * `base: './'` has been resolved against the deployed directory.
 *
 * The check that matters is the last one. A manifest and a registered worker
 * prove intent; only killing the network and reloading proves the game opens
 * on a train.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const PORT = 5242;
const ROOT = 'dist';
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const failures = [];
const check = (name, ok, detail) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await stat(join(ROOT, 'index.html'));
} catch {
  console.error(`no ${ROOT}/index.html — run \`npm run build\` first`);
  process.exit(1);
}

// A plain static server. Serving the built directory rather than proxying
// Vite is the whole point: this has to be the bytes that deploy.
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = normalize(decodeURIComponent(url.pathname));
  if (path.endsWith('/')) path += 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      // No HTTP caching, so anything that survives a reload survived because
      // the SERVICE WORKER kept it — which is the thing under test.
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, resolve));

let browser;
try {
  let launched;
  try {
    launched = await chromium.launch();
  } catch {
    launched = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
  browser = launched;
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

  // ---- the manifest is real, and so is everything it points at ------------
  const href = await page.getAttribute('link[rel="manifest"]', 'href');
  check('the page links a manifest', href !== null, href ?? '');
  const manifest = await page.evaluate(async (at) => {
    const res = await fetch(at);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    try {
      return { json: await res.json() };
    } catch (e) {
      return { error: String(e) };
    }
  }, href ?? './manifest.webmanifest');
  check('and it parses', manifest.json !== undefined, manifest.error ?? '');

  const m = manifest.json ?? {};
  check(
    'and asks to be installed as an app',
    m.display === 'standalone' || m.display === 'fullscreen',
    `display: ${m.display}`,
  );
  check('and names itself', typeof m.name === 'string' && m.name.length > 0, m.name ?? '');
  // A launcher needs a maskable icon or it puts the square one in a circle and
  // crops the corners off.
  const purposes = (m.icons ?? []).map((i) => i.purpose ?? 'any').join(' ');
  check('and ships a maskable icon', purposes.includes('maskable'), purposes);

  const iconResults = await page.evaluate(async (icons) => {
    const out = [];
    for (const icon of icons) {
      const res = await fetch(icon.src);
      out.push({ src: icon.src, ok: res.ok, status: res.status });
    }
    return out;
  }, m.icons ?? []);
  const broken = iconResults.filter((r) => !r.ok);
  check(
    'and every icon it points at resolves',
    iconResults.length > 0 && broken.length === 0,
    broken.length > 0
      ? broken.map((b) => `${b.src} → ${b.status}`).join(', ')
      : `${iconResults.length} icons`,
  );

  // ---- the worker takes control ------------------------------------------
  const active = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    return reg ? (reg.active ? 'active' : 'registered') : 'none';
  });
  check('a service worker takes control', active === 'active', active);
  check('and the page had no errors', errors.length === 0, errors[0] ?? '');

  // ---- and the game opens with the network off ---------------------------
  // Give the worker a moment to have cached the chunks the first load pulled;
  // they arrive through `fetch`, not a precache list.
  await wait(1500);
  await context.setOffline(true);
  const offlineErrors = [];
  page.on('pageerror', (e) => offlineErrors.push(String(e)));
  let reloaded = true;
  try {
    await page.reload({ waitUntil: 'load', timeout: 20000 });
  } catch (e) {
    reloaded = false;
    check('the game reloads with no network', false, String(e).slice(0, 80));
  }
  if (reloaded) {
    await wait(3000);
    // Not "did the HTML come back" — did the GAME come back. The seam every
    // other harness taps is the honest test that the engine chunk was cached
    // too, rather than only the shell.
    const alive = await page.evaluate(() => {
      const api = window.lastline;
      return api ? api.buttons().length : -1;
    });
    check('the game reloads and runs with no network', alive > 0, `${alive} live controls`);
    check('and threw nothing offline', offlineErrors.length === 0, offlineErrors[0] ?? '');
  }
  await context.setOffline(false);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failures.length > 0) {
  console.error(`\n${failures.length} PWA check(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\ninstallable, and it works offline.');
