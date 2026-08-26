/**
 * The contact sheet: every silhouette in the game, side by side (v1.29).
 *
 * A set of counters can only be judged as a SET. Thirty-four units drawn one
 * at a time each looked fine and the roster still resolved to nine shapes,
 * four of them plain discs — which is not something you can see from inside a
 * battle, where two kinds are ever on screen at once.
 *
 * The glyphs are pure functions of a Phaser Graphics and call only ten of its
 * methods, so this stands a Canvas2D shim in its place: the same code, the
 * same numbers, a different back end. Rendered in the browser rather than
 * through a native canvas binding, because Vite already transpiles the module
 * on demand and Playwright is already here — no new dependency to draw a
 * picture of the drawing code.
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
    const KINDS =
      'militia guardsman conscript rifle ranger motorrifle nkrifle peacekeeper sapper engineer demoteam tunneler unsapper grenadier javelin rpg rpg7 nlaw infiltrator unmedic humvee zbd btr vab abrams type99 t72 chonma leo1 reaper an2 wz10 ka52 nh90'.split(
        ' ',
      );
    const css = (n) => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;

    /** The ten Graphics calls the glyphs make, on a 2D context. */
    const shim = (ctx) => {
      let fill = '#000';
      let alpha = 1;
      let stroke = '#000';
      let strokeAlpha = 1;
      let lineW = 1;
      const api = {
        fillStyle(c, a = 1) { fill = css(c); alpha = a; return api; },
        lineStyle(w, c, a = 1) { lineW = w; stroke = css(c); strokeAlpha = a; return api; },
        fillCircle(x, y, r) {
          ctx.globalAlpha = alpha; ctx.fillStyle = fill;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); return api;
        },
        strokeCircle(x, y, r) {
          ctx.globalAlpha = strokeAlpha; ctx.strokeStyle = stroke; ctx.lineWidth = lineW;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); return api;
        },
        fillRect(x, y, w, h) {
          ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); return api;
        },
        strokeRect(x, y, w, h) {
          ctx.globalAlpha = strokeAlpha; ctx.strokeStyle = stroke; ctx.lineWidth = lineW;
          ctx.strokeRect(x, y, w, h); return api;
        },
        fillPoints(pts) {
          ctx.globalAlpha = alpha; ctx.fillStyle = fill;
          ctx.beginPath();
          pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath(); ctx.fill(); return api;
        },
        lineBetween(x1, y1, x2, y2) {
          ctx.globalAlpha = strokeAlpha; ctx.strokeStyle = stroke; ctx.lineWidth = lineW;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return api;
        },
        save() { ctx.save(); return api; },
        restore() { ctx.restore(); return api; },
        translateCanvas(x, y) { ctx.translate(x, y); return api; },
        rotateCanvas(a) { ctx.rotate(a); return api; },
        clear() { return api; },
      };
      return api;
    };

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
    const canvas = document.createElement('canvas');
    canvas.width = COLS * CW;
    canvas.height = rows * CH + 44;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    // The GROUND, not a guess at it. `COLORS.paper` does not exist, and
    // `css(undefined)` is black — so the first three passes of this sheet were
    // judged against a background the game never draws, which flatters a cream
    // knockout enormously and hides a dark wing completely.
    ctx.fillStyle = css(COLORS.bgField);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = css(COLORS.marg);
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`2060TD — ${KINDS.length} attacker silhouettes at row 46 / board 32 / card 105 px`, 12, 26);

    // Half the sheet on the map ground, half on the drawer's dark panel: the
    // same counter has to read on both, and a knockout tuned for one is
    // usually wrong for the other.
    ctx.fillStyle = css(COLORS.bgPanel);
    ctx.fillRect(0, 44 + Math.ceil(KINDS.length / COLS / 2) * CH, canvas.width, canvas.height);

    KINDS.forEach((kind, i) => {
      const cx = (i % COLS) * CW;
      const cy = Math.floor(i / COLS) * CH + 44;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(90,83,70,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, CW - 1, CH - 1);
      const onPanel = cy >= 44 + Math.ceil(KINDS.length / COLS / 2) * CH;
      let x = cx + 22;
      for (const cell of SIZES) {
        ctx.save();
        drawAttackerGlyph(shim(ctx), kind, x, cy + 66, cell, {
          friendly: true,
          facing: 0,
          wallDps: 0,
          onDark: onPanel,
        });
        ctx.restore();
        x += cell * 0.75 + 20;
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(
        cy >= 44 + Math.ceil(KINDS.length / COLS / 2) * CH ? COLORS.inkDim : COLORS.marg,
      );
      ctx.font = '12px monospace';
      ctx.fillText(kind, cx + 8, cy + CH - 10);
    });
    return { w: canvas.width, h: canvas.height };
  });

  mkdirSync('screenshots', { recursive: true });
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.locator('canvas').screenshot({ path: OUT });
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
