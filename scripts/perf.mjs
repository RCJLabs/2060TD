/**
 * What a build costs a phone: its download, its boot, and a frame of play
 * (M30 Phase 3).
 *
 *   npm run build && npm run perf                  # measure dist/
 *   node scripts/perf.mjs <dist> [label]            # measure another build
 *   node scripts/perf.mjs <dist> [label] --no-webgl # ...with WebGL switched off
 *
 * Headless Chromium at a phone's size, served by `vite preview`, each figure
 * the median of several runs, once at full speed and once with the CPU slowed
 * 4x — roughly a mid-range phone. The network is local, so the boot is what
 * the page costs to parse and run, not to fetch; the download column is what
 * it costs to fetch.
 *
 * Frame figures are a demo running for five seconds, the median of three,
 * read from a trace of the page's main thread: every task on it, and in them
 * the script and the canvas's paint, per frame painted. This container has no GPU: Canvas2D
 * rasterises on the CPU, and WebGL runs on SwiftShader, a software emulation
 * of one, which is far slower again. Do not read the fps as a phone's, and
 * compare builds that draw the same way. A build from before v1.49 drew with
 * Phaser, which picks WebGL when it can: `--no-webgl` makes it fall back to
 * its Canvas renderer, which is what to hold the stage against.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';

const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DIST = positional[0] ?? 'dist';
const LABEL = positional[1] ?? DIST;
const NO_WEBGL = process.argv.includes('--no-webgl');
const PORT = 5230 + Math.floor(Math.random() * 60);
const RUNS = 5;
const FRAME_RUNS = 3;
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
  const args = NO_WEBGL ? ['--disable-webgl', '--disable-3d-apis'] : [];
  const browser = await chromium
    .launch({ executablePath: '/opt/pw-browsers/chromium', args })
    .catch(() => chromium.launch({ args }));
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

  /**
   * A frame, from a trace of the renderer's main thread: every task it ran,
   * and within them the script and the canvas's paint. Chrome's own counters
   * missed the paint: a canvas drawn from a timer is painted in a task they
   * did not count, and in this game that is most of a frame.
   */
  const frames = async (query, rate) => {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto(`http://localhost:${PORT}/?${query}`);
    await wait(3000);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await page.evaluate(() => {
      window.__frames = 0;
      const tick = () => {
        window.__frames++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await wait(500);
    // `blink` carries the canvas's paint; the timeline alone leaves it out.
    const categories = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink'];
    await browser.startTracing(page, { categories });
    const f0 = await page.evaluate(() => window.__frames);
    const t0 = Date.now();
    await wait(5000);
    const f1 = await page.evaluate(() => window.__frames);
    const seconds = (Date.now() - t0) / 1000;
    const trace = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
    await ctx.close();
    const main = new Set(
      trace.filter((e) => e.name === 'thread_name' && e.args.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`),
    );
    const total = { task: 0, script: 0, paint: 0, painted: 0 };
    for (const e of trace) {
      if (e.ph !== 'X' || !main.has(`${e.pid}:${e.tid}`)) continue;
      const ms = (e.dur ?? 0) / 1000;
      if (e.name === 'RunTask') total.task += ms;
      else if (e.name === 'FunctionCall') total.script += ms;
      else if (e.name === 'CanvasRenderingContext2D::FinalizeFrame') {
        total.paint += ms;
        total.painted++;
      }
    }
    // A frame is the board's canvas painted. A WebGL board is not painted on
    // this thread, and the few paints there are come from the DOM's small
    // icon canvases, so there a frame is one the page was shown.
    const shown = f1 - f0;
    const webgl = total.painted < shown / 2;
    const n = Math.max(1, webgl ? shown : total.painted);
    return {
      fps: shown / seconds,
      busy: total.task / seconds / 10,
      task: total.task / n,
      script: total.script / n,
      paint: webgl ? 0 : total.paint / n,
      webgl,
    };
  };

  const d = download();
  console.log(`PERF — ${LABEL}${NO_WEBGL ? ' (WebGL off)' : ''}`);
  console.log(`download   ${(d.raw / 1024).toFixed(0)} kB, ${(d.gz / 1024).toFixed(0)} kB gzipped`);
  for (const rate of [1, 4]) {
    console.log(`boot x${rate}    ${await boot(rate)} ms to the first frame (median of ${RUNS})`);
  }
  for (const query of ['demo=1', 'demo=town']) {
    for (const rate of [1, 4]) {
      const runs = [];
      for (let run = 0; run < FRAME_RUNS; run++) runs.push(await frames(query, rate));
      const f = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]));
      console.log(
        `${query.padEnd(10)} x${rate}  ${f.fps.toFixed(0)} fps · ${f.task.toFixed(1)} ms of main thread a frame: ` +
          `${f.script.toFixed(1)} script, ` +
          `${f.webgl ? 'paint elsewhere (WebGL)' : `${f.paint.toFixed(1)} paint`} · main thread ${f.busy.toFixed(0)}% busy`,
      );
    }
  }
  await browser.close();
} finally {
  process.kill(-server.pid);
}
