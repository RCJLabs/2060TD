/**
 * The contact sheet: every silhouette in the game, side by side (v1.29).
 *
 * A set of counters can only be judged as a SET. Thirty-four units drawn one
 * at a time each looked fine and the roster still resolved to nine shapes,
 * four of them plain discs — which is not something you can see from inside a
 * battle, where two kinds are ever on screen at once.
 *
 * The glyphs are pure functions of an `Ink` (src/game/ink.ts), so this hands
 * them the `CanvasInk` a drawer row draws with: the same code, the same
 * numbers, the same back end as the row. Until M30 it stood a shim of its own
 * in for Phaser's Graphics. Rendered in the browser rather than through a
 * native canvas binding, because Vite already transpiles the module on demand
 * and Playwright is already here — no new dependency to draw a picture of the
 * drawing code.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5261;
const OUT = process.argv.find((a) => a.startsWith('--out='))?.slice(6) ?? 'screenshots/glyphs.png';
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
  const page = await browser.newPage({ viewport: { width: 960, height: 1200 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });

  const size = await page.evaluate(async () => {
    const { drawAttackerGlyph } = await import('/src/game/glyphs.ts');
    const { COLORS } = await import('/src/game/palette.ts');
    const { CanvasInk } = await import('/src/game/dom/ink.ts');
    const KINDS =
      'militia guardsman conscript rifle ranger motorrifle nkrifle peacekeeper sapper engineer demoteam tunneler unsapper grenadier javelin rpg rpg7 nlaw infiltrator unmedic humvee zbd btr vab abrams type99 t72 chonma leo1 reaper an2 wz10 ka52 nh90'.split(
        ' ',
      );
    const css = (n) => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;

    // Three sizes, because the set has to work at all of them: a drawer row,
    // a counter on the board at fit zoom, and the spec card's hero.
    // The REAL sizes, not round numbers: a drawer row hands the glyph
    // `box / ATTACKER_GLYPH_SPAN` ~= 46, the board draws at CELL=32 times the
    // fit zoom, and the spec card's hero is 72 / SPAN ~= 105. A sheet drawn at
    // sizes the game never uses flatters shapes that fall apart in a row.
    const SIZES = [46, 32, 105];
    const COLS = 5;
    const CW = 190;
    const CH = 150;
    const rows = Math.ceil(KINDS.length / COLS);
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    // The game is still running behind the sheet. Its DOM layer puts itself
    // back over the page at the next resize, so it is hidden outright, and its
    // rows draw icons into canvases of their own, so this one goes by name.
    document.head.insertAdjacentHTML('beforeend', '<style>#ui { display: none !important; }</style>');
    const canvas = document.createElement('canvas');
    canvas.id = 'sheet';
    canvas.width = COLS * CW;
    canvas.height = rows * CH + 44;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const ink = new CanvasInk(ctx);
    // The GROUND, not a guess at it. `COLORS.paper` does not exist, and
    // `css(undefined)` is black — so the first three passes of this sheet were
    // judged against a background the game never draws, which flatters a cream
    // knockout enormously and hides a dark wing completely.
    ctx.fillStyle = css(COLORS.bgField);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = css(COLORS.marg);
    ctx.font = 'bold 15px monospace';
    ctx.fillText(
      `2060TD — ${KINDS.length} silhouettes at row 46 / board 32 / card 105 px — TOP yours, BOTTOM theirs`,
      12,
      26,
    );

    // The two halves used to be map-ground and drawer-panel, because the
    // drawer was dark and a knockout tuned for paper was wrong on it. The
    // drawer is paper now, so that comparison is gone and a more useful one
    // takes its place: the SAME counter as yours and as theirs, on the same
    // ground. A pad carries the allegiance in the ink direction, so the two
    // have to be told apart at row size or the channel does not work.

    KINDS.forEach((kind, i) => {
      const cx = (i % COLS) * CW;
      const cy = Math.floor(i / COLS) * CH + 44;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(17,17,17,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, CW - 1, CH - 1);
      const theirs = cy >= 44 + Math.ceil(KINDS.length / COLS / 2) * CH;
      let x = cx + 22;
      for (const cell of SIZES) {
        ctx.save();
        drawAttackerGlyph(ink, kind, x, cy + 66, cell, {
          friendly: !theirs,
          facing: 0,
          wallDps: 0,
        });
        ctx.restore();
        x += cell * 0.75 + 20;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(COLORS.marg);
      ctx.font = '12px monospace';
      ctx.fillText(kind, cx + 8, cy + CH - 10);
    });
    return { w: canvas.width, h: canvas.height };
  });

  mkdirSync('screenshots', { recursive: true });
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.locator('#sheet').screenshot({ path: OUT });
  if (errors.length) console.error('page errors:', errors.join('\n'));
  console.log(`wrote ${OUT} — ${size.w}×${size.h}`);
  await browser.close();
} finally {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
