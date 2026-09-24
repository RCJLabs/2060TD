/**
 * What a build costs a phone: its download, its boot, and a frame of play
 * (M30 Phase 3).
 *
 *   npm run build && npm run perf           # measure dist/
 *   node scripts/perf.mjs <dist> [label]     # measure another build
 *
 * Headless Chromium at a phone's size, served by `vite preview`, each figure
 * the median of several runs, once at full speed and once with the CPU slowed
 * 4x — roughly a mid-range phone. The network is local, so the boot is what
 * the page costs to parse and run, not to fetch; the download column is what
 * it costs to fetch.
 *
 * Frame figures are a demo running for five seconds. This container draws in
 * software, so what a GPU would do fast is slow here for both builds alike:
 * compare builds with this, and do not read the fps as a phone's.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const DIST = process.argv[2] ?? 'dist';
const LABEL = process.argv[3] ?? DIST;
const PORT = 5230 + Math.floor(Math.random() * 60);
const RUNS = 5;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

/** Every file the page loads: the HTML and whatever it pulls from assets/. */
function download() {
  const files = [join(DIST, 'index.html'), ...readdirSync(join(DIST, 'assets')).map((f) => join(DIST, 'assets', f))];
  let raw = 0;
  let gz = 0;
  for (const f of files) {
    if (!statSync(f).isFile() || !/\.(html|js|css)$/.test(f)) continue;
    const body = readFileSync(f);
    raw += body.length;
    gz += gzipSync(body, { level: 9 }).length;
  }
  return { raw, gz };
}

const server = spawn('npx', ['vite', 'preview', '--outDir', DIST, '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});

try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
    } catch {
      /* not up yet */
    }
    await wait(300);
  }
  const browser = await chromium
    .launch({ executablePath: '/opt/pw-browsers/chromium' })
    .catch(() => chromium.launch());
  const phone = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

  const boot = async (rate) => {
    const times = [];
    for (let run = 0; run < RUNS; run++) {
      const ctx = await browser.newContext(phone);
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      const t0 = Date.now();
      await page.goto(`http://localhost:${PORT}/`);
      await page.waitForFunction(
        () => !document.getElementById('boot') || document.getElementById('boot').classList.contains('gone'),
        null,
        { timeout: 60000 },
      );
      times.push(Date.now() - t0);
      await ctx.close();
    }
    return median(times);
  };

  const frames = async (query, rate) => {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(`http://localhost:${PORT}/?${query}`);
    await wait(3000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const metric = async () =>
      Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    await page.evaluate(() => {
      window.__frames = 0;
      const tick = () => {
        window.__frames++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const a = await metric();
    const f0 = await page.evaluate(() => window.__frames);
    await wait(5000);
    const b = await metric();
    const f1 = await page.evaluate(() => window.__frames);
    await ctx.close();
    const n = Math.max(1, f1 - f0);
    return {
      fps: n / 5,
      task: ((b.TaskDuration - a.TaskDuration) * 1000) / n,
      script: ((b.ScriptDuration - a.ScriptDuration) * 1000) / n,
    };
  };

  const d = download();
  console.log(`PERF — ${LABEL}`);
  console.log(`download   ${(d.raw / 1024).toFixed(0)} kB, ${(d.gz / 1024).toFixed(0)} kB gzipped`);
  for (const rate of [1, 4]) {
    console.log(`boot x${rate}    ${await boot(rate)} ms to the first frame (median of ${RUNS})`);
  }
  for (const query of ['demo=1', 'demo=town']) {
    for (const rate of [1, 4]) {
      const f = await frames(query, rate);
      console.log(
        `${query.padEnd(10)} x${rate}  ${f.fps.toFixed(0)} fps · ${f.task.toFixed(1)} ms of main thread a frame, ` +
          `${f.script.toFixed(1)} of it script`,
      );
    }
  }
  await browser.close();
} finally {
  process.kill(-server.pid);
}
