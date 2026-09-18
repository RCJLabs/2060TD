/**
 * Catch a moment.
 *
 * `npm run screenshot` shoots at a fixed wall-clock time, which is fine for a
 * layout and useless for anything that happens for under a second. The ink
 * pass added lettering, focus lines and speed lines that only exist while a
 * wall is going down — and the only way to look at them was to shoot blindly
 * and hope. This samples a running battle and keeps ONLY the frames where the
 * game is currently saying something that matches a pattern.
 *
 * It reads the same `window.lastline.texts()` seam the E2E harnesses tap, so
 * it needs nothing new in the game to find a moment.
 *
 *   npm run catch -- "KRRAK|WHUMP|BLAM"              # the heavy impacts
 *   npm run catch -- "WAVE 4" --query=demo=1 --for=40
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const pattern = args.find((a) => !a.startsWith('--'));
if (!pattern) {
  console.error('usage: node scripts/catch.mjs "<regex over on-screen text>" [--query=demo=1] [--for=44] [--out=screenshots/catch]');
  process.exit(2);
}
const flag = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const query = flag('query', 'demo=1');
const samples = Number(flag('for', '44'));
const out = flag('out', 'screenshots/catch');

const PORT = 5297;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
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
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  await page.goto(`http://localhost:${PORT}/?${query}`, { waitUntil: 'networkidle' });
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  await wait(4000);

  let kept = 0;
  for (let i = 0; i < samples; i++) {
    const hit = await page.evaluate(
      (src) => (window.lastline?.texts?.() ?? []).some((t) => new RegExp(src).test(t)),
      pattern,
    );
    if (hit) {
      await page.screenshot({ path: `${out}/${String(i).padStart(3, '0')}.png` });
      kept++;
    }
    await wait(300);
  }
  await browser.close();
  console.log(`${out} — ${kept} of ${samples} samples matched /${pattern}/`);
  if (kept === 0) process.exitCode = 1;
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
