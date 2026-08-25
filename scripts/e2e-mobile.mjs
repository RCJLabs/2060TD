/**
 * The mobile audit (v1.26).
 *
 * The complaint this exists to answer was "it feels like it was ported to
 * mobile", and that is not a thing a screenshot argues about productively.
 * The layout has been mobile-first since v0.9 — a portrait drawer, a landscape
 * rail, 44px rows — so what reads as ported is the INTERACTION, and most of
 * that is measurable:
 *
 * - a target smaller than a fingertip
 * - two targets close enough that the wrong one fires
 * - the thing you came to press, out at the top of a 915px screen
 * - a line of text clipped by the strip drawn over it
 *
 * Every one of those regresses silently and none of them shows up in a unit
 * test, because the UI is immediate-mode Phaser canvas: there is no DOM to
 * query and no CSS box to inspect. What there IS, from earlier harnesses, is
 * `lastline.buttons()` — every live button's rect — and `lastline.textRects()`
 * — every visible string's bounds. Both come back in device px, which is why
 * everything below divides by dpr before judging it: a fingertip is a physical
 * thing, so the only honest unit is CSS px.
 *
 * The numbers are the platform guidelines rather than anything invented here:
 * 44x44 is Apple's minimum touch target, 48dp is Material's, and 8px is the
 * spacing below which adjacent targets start eating each other's taps.
 *
 * REACH is the one that is a judgement, and it is reported rather than failed
 * on. A thumb on a 915px phone arcs comfortably over the bottom third; a
 * primary action above that line is a two-handed action. Where the number
 * lands per scene is what the milestone is for, so this prints it and holds
 * the line once it is good rather than asserting a target nobody has hit yet.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 5241;
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
const note = (name, detail) => console.log(`  ..  ${name} — ${detail}`);

/** Apple HIG minimum; Material asks 48. Anything under this is a mis-tap. */
const MIN_TARGET = 44;
/** Below this, two targets share a fingertip. */
const MIN_GAP = 8;

/**
 * Devices worth holding the line on: the narrowest phone still in use, a
 * current mainstream phone, and the same phone turned sideways. A rule that
 * only holds at one width is a coincidence.
 */
const DEVICES = [
  { name: 'small portrait', viewport: { width: 360, height: 740 }, deviceScaleFactor: 3 },
  { name: 'phone portrait', viewport: { width: 412, height: 915 }, deviceScaleFactor: 3 },
  { name: 'phone landscape', viewport: { width: 915, height: 412 }, deviceScaleFactor: 3 },
];

/**
 * The screens a player actually spends time on, and the one control each is
 * FOR. Reach is meaningless without naming the primary action: every screen
 * has a dozen buttons and only one of them is the reason you opened it.
 */
const SCENES = [
  { demo: 'town', label: 'town', primary: /^BUILD|^CONFIRM|^BASE/ },
  { demo: 'raid', label: 'raid planner', primary: /LAUNCH RAID/ },
];

const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Centre-to-centre gap along whichever axis the two rects are separated on. */
const gapBetween = (a, b) => {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h)));
  // Diagonal neighbours are not a mis-tap risk; only near-aligned pairs are.
  if (dx > 0 && dy > 0) return Infinity;
  return Math.max(dx, dy);
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

  for (const device of DEVICES) {
    for (const scene of SCENES) {
      const where = `${device.name} / ${scene.label}`;
      const page = await browser.newPage({ ...device, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://localhost:${PORT}/?demo=${scene.demo}`, {
        waitUntil: 'networkidle',
      });
      await wait(2600);

      const shot = await page.evaluate(() => {
        const api = window.lastline;
        return {
          dpr: api.dpr,
          buttons: api.buttons(),
          texts: api.textRects(),
          layout: api.layout ? api.layout() : null,
        };
      });

      const { dpr } = shot;
      const toCss = (r) => ({ ...r, x: r.x / dpr, y: r.y / dpr, w: r.w / dpr, h: r.h / dpr });
      const buttons = shot.buttons.map(toCss);
      const vh = device.viewport.height;

      // Liveness: an empty screen passes every rule below for the wrong reason.
      check(`${where}: the screen has controls on it`, buttons.length >= 3, `${buttons.length} buttons`);
      check(`${where}: no page errors`, errors.length === 0, errors[0] ?? '');
      if (buttons.length < 3) {
        await page.close();
        continue;
      }

      // ---- 1. every target takes a fingertip ---------------------------------
      // Measured on the DRAWN box, not the clipped one: a row half-scrolled out
      // of its list is a legitimate sliver to tap, not an undersized control.
      const small = buttons.filter(
        (b) => b.full.w / dpr < MIN_TARGET || b.full.h / dpr < MIN_TARGET,
      );
      check(
        `${where}: every target is at least ${MIN_TARGET}x${MIN_TARGET}`,
        small.length === 0,
        small.length === 0
          ? `${buttons.length} targets, smallest ${Math.min(...buttons.map((b) => Math.min(b.full.w / dpr, b.full.h / dpr))).toFixed(0)}px`
          : small
              .slice(0, 4)
              .map((b) => `"${b.label}" ${(b.full.w / dpr).toFixed(0)}x${(b.full.h / dpr).toFixed(0)}`)
              .join(', ') + (small.length > 4 ? ` (+${small.length - 4})` : ''),
      );

      // ---- 2. targets do not share a fingertip -------------------------------
      const tight = [];
      for (let i = 0; i < buttons.length; i++) {
        for (let j = i + 1; j < buttons.length; j++) {
          const gap = gapBetween(buttons[i], buttons[j]);
          if (gap < MIN_GAP && gap !== Infinity) {
            tight.push(`"${buttons[i].label}"/"${buttons[j].label}" ${gap.toFixed(1)}px`);
          }
        }
      }
      check(
        `${where}: adjacent targets are at least ${MIN_GAP}px apart`,
        tight.length === 0,
        tight.slice(0, 3).join(', ') + (tight.length > 3 ? ` (+${tight.length - 3})` : ''),
      );

      // ---- 3. how far the primary action sits from the thumb -----------------
      const primary = buttons.find((b) => scene.primary.test(b.label));
      if (primary) {
        const centre = primary.y + primary.h / 2;
        const fromBottom = vh - centre;
        const share = ((vh - centre) / vh) * 100;
        note(
          `${where}: REACH "${primary.label}"`,
          `${fromBottom.toFixed(0)}px from the bottom (${share.toFixed(0)}% up the screen)` +
            (share > 33 ? ' — ABOVE THE THUMB ARC' : ''),
        );
      } else {
        note(`${where}: REACH`, 'no primary action matched on this screen');
      }

      // ---- 4. nothing the player needs is cut off ----------------------------
      // The naive version of this check lies. A scrolling list ALWAYS has a
      // partial row at its edge — that is what scrolling looks like mid-way —
      // so flagging every clipped row reports the list working as a defect.
      //
      // Two honest questions instead:
      //   a) static text, outside the scrolling list, that runs past its rect
      //      or off the screen. Always a bug: nothing will ever bring it back.
      //   b) the END of the list, once scrolled all the way down. If the last
      //      row still cannot clear the strip drawn over it, that row is
      //      unreachable however hard the player scrolls.
      const texts = shot.texts.map(toCss);
      const topDepth = Math.max(...texts.map((t) => t.depth));
      const listRect = shot.layout ? toCss(shot.layout.list) : null;
      /**
       * Is this text part of the scrolling region?
       *
       * Not "does it overlap the list rect" — that was the second thing this
       * check got wrong. `textRects()` enumerates MASKED text too, so a row
       * scrolled out of the list is invisible but still reported, sitting
       * below the list rect and therefore counted as static text running off
       * the screen. It is neither static nor on the screen.
       *
       * Scoped by column instead, and anything from the list's top downward:
       * rows scroll DOWN out of a list, so the region to attribute to it is
       * its own x-range from its top edge to the bottom of the world.
       */
      const inList = (t) =>
        listRect !== null &&
        t.y + t.h > listRect.y &&
        t.x + t.w > listRect.x &&
        t.x < listRect.x + listRect.w;

      const staticClipped = texts.filter(
        (t) => t.depth >= topDepth && !inList(t) && t.y + t.h > vh + 0.5,
      );
      check(
        `${where}: no static text runs off the screen`,
        staticClipped.length === 0,
        staticClipped
          .slice(0, 3)
          .map((t) => `"${t.text.slice(0, 30)}"`)
          .join(', ') + (staticClipped.length > 3 ? ` (+${staticClipped.length - 3})` : ''),
      );

      // Drive the list to its stop with the wheel, which the drawer honours and
      // which — unlike a drag — leaves nothing coasting to sample against.
      if (listRect) {
        const cx = listRect.x + listRect.w / 2;
        const cy = listRect.y + listRect.h / 2;
        await page.mouse.move(cx, cy);
        // Wheel until the list actually stops, rather than a fixed number of
        // ticks and a hope. A run that judged the last row from 1120 of 1309
        // was reporting a mid-scroll row as unreachable, which is the whole
        // failure mode this check exists to avoid being.
        let settled = -1;
        for (let round = 0; round < 30; round++) {
          for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 300);
          await wait(220);
          const at = await page.evaluate(() => window.lastline.scroll()?.scrollY ?? -1);
          if (Math.abs(at - settled) < 0.5) break;
          settled = at;
        }
        await wait(400);
        const ended = await page.evaluate(() => {
          const api = window.lastline;
          return { texts: api.textRects(), scroll: api.scroll() };
        });
        const tail = ended.texts.map(toCss);
        const bottom = listRect.y + listRect.h;
        // Only rows that are still DRAWN inside the list can be cut by its edge;
        // one scrolled past it is masked away, not clipped.
        const cut = tail.filter(
          (t) => inList(t) && t.y >= listRect.y - 0.5 && t.y < bottom && t.y + t.h > bottom + 1,
        );
        check(
          `${where}: the last row clears the strip below it`,
          cut.length === 0,
          `at the stop (${Math.round(ended.scroll?.scrollY ?? -1)}/${Math.round(ended.scroll?.max ?? -1)}): ` +
            (cut.length === 0
              ? 'nothing cut'
              : cut
                  .slice(0, 3)
                  .map((t) => `"${t.text.slice(0, 24)}"`)
                  .join(', ')),
        );
      }

      // ---- 5. the safe area is respected -------------------------------------
      // index.html sets viewport-fit=cover, which extends the page UNDER the
      // notch and the home indicator. That is only correct if something then
      // insets the UI. Chromium exposes no notch to simulate, so this checks
      // the plumbing rather than the pixels: the layout has to have read the
      // insets at all.
      if (shot.layout) {
        const inset = shot.layout.safe;
        check(
          `${where}: the layout read the safe-area insets`,
          inset !== undefined && inset !== null,
          inset
            ? `top ${inset.top} bottom ${inset.bottom} left ${inset.left} right ${inset.right}`
            : 'layout.safe is missing — viewport-fit=cover with nothing inset',
        );
      } else {
        check(`${where}: the layout is inspectable`, false, 'lastline.layout() is missing');
      }

      await page.close();
    }
  }

  await browser.close();
} finally {
  try {
    process.kill(-vite.pid);
  } catch {
    /* already gone */
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} mobile check(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nmobile audit clean.');
