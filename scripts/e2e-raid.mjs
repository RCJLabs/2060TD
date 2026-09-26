/**
 * E2E of the offense loop: raid planner → assign units → launch → result
 * overlay → report → what-if, taken into the plan → watch replay → its heat
 * map → a what-if's footage → the planner, which keeps the last raid on the
 * post and reopens the plan with the change. Runs on ?demo=raid (showcase town).
 *
 * REWRITTEN (v1.21) because it was passing without doing anything. It clicked
 * fixed pixel coordinates and its only assertion was "no page errors", so
 * every time the panel moved it went on quietly launching raids with ZERO
 * units assigned — a green tick for a flow that never happened. Found while
 * writing `e2e-garrison.mjs`, which taps by label.
 *
 * Everything here is addressed by label and every step asserts the state it
 * was supposed to produce. A harness that cannot fail is not a test.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 5199;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
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
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e && e.stack ? e.stack : String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  mkdirSync('screenshots', { recursive: true });
  await page.goto(`http://localhost:${PORT}/?demo=raid`, { waitUntil: 'networkidle' });
  await wait(2000);

  const texts = () => page.evaluate(() => window.lastline.texts());
  const find = (needle) =>
    page.evaluate((text) => {
      const api = window.lastline;
      if (!api) return null;
      const hit = api.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit
        ? { x: (hit.x + hit.w / 2) / api.dpr, y: (hit.y + hit.h / 2) / api.dpr, on: hit.enabled }
        : null;
    }, needle.toUpperCase());
  /**
   * Wait for the UI to STOP CHANGING rather than for a fixed number of
   * milliseconds. Every harness used to tap and then sleep a constant, which is
   * a bet that the machine is not busy — and under load it is a bet the suite
   * loses: five different harnesses have failed in a batch and passed alone.
   * Two identical snapshots in a row means the scene has settled, so this is
   * also FASTER than the sleep it replaces in the common case.
   */
  const settle = async (budgetMs = 2500) => {
    const deadline = Date.now() + budgetMs;
    let prev = null;
    let stable = 0;
    while (Date.now() < deadline) {
      const now = await page
        .evaluate(() => {
          const api = window.lastline;
          return JSON.stringify([api.buttons().map((b) => b.label), api.texts()]);
        })
        .catch(() => null);
      if (now !== null && now === prev) {
        if (++stable >= 2) return true;
      } else {
        stable = 0;
        prev = now;
      }
      await wait(60);
    }
    return false;
  };
  const tap = async (needle, settleMs = 350) => {
    const hit = await find(needle);
    if (!hit) return false;
    await page.mouse.click(hit.x, hit.y);
    // The caller's number is a PATIENCE HINT now, not a duration.
    await settle(Math.max(2500, settleMs * 3));
    return true;
  };
  /** Wait for a condition rather than for a stopwatch. */
  const until = async (fn, deadlineMs) => {
    const stop = Date.now() + deadlineMs;
    for (;;) {
      if (await fn()) return true;
      if (Date.now() > stop) return false;
      await wait(120);
    }
  };
  const copy = async (re) => (await texts()).find((t) => re.test(t)) ?? '';
  /** A button's state by label: whether it is lit, and its sub-line. */
  const buttonState = (needle) =>
    page.evaluate((text) => {
      const hit = window.lastline.buttons().find((b) => b.label.toUpperCase().includes(text));
      return hit ? { label: hit.label, sub: hit.sub, active: hit.active, enabled: hit.enabled } : null;
    }, needle.toUpperCase());
  /**
   * The rect of the first text matching `re`, or null. A label over the board
   * is set on its own lines, and one left to wrap against its host, which is
   * a point, sets a word to a line: taller than it is wide. v1.46 and v1.47
   * shipped the recon notice that way and no text check could see it.
   */
  const rectOf = (re) =>
    page.evaluate(
      (src) => window.lastline.textRects().find((t) => new RegExp(src).test(t.text)) ?? null,
      re.source,
    );
  const setAsWritten = (r) => r !== null && r.w > r.h * 2;
  /** How many units the planner says are committed. */
  const mustered = async () => {
    const hit = /·\s*(\d+)\s*UNITS/i.exec(await copy(/LAUNCH RAID/i));
    return hit ? Number(hit[1]) : null;
  };

  // ---- muster a force ------------------------------------------------------
  // Assignment lives on SQUADS. MUSTER is the training tab and its rows are
  // inert here, which is the trap the old pixel coordinates fell into.
  check('the planner opens on a target', (await copy(/TARGET GRID/i)) !== '', await copy(/TARGET GRID/i));
  check('nothing is committed yet', (await mustered()) === 0, `${await mustered()} units`);

  // ---- the last raid on the post (M29 Phase 2) ------------------------------
  // The showcase has raided this post once already, and the planner opens on
  // where that raid bled: a cross for each man it lost, a shade where it was
  // hit. The row says how many fell, and turns the marks off and on.
  const opened = await buttonState('THE LAST RAID HERE');
  const openedFell = /(\d+) FELL/.exec(opened?.sub ?? '');
  check(
    'the post opens with the last raid on it marked',
    opened?.active === true && openedFell !== null && Number(openedFell[1]) > 0,
    opened ? opened.sub : 'no row',
  );
  await page.screenshot({ path: 'screenshots/e2e-raid-ghost.png' });
  await tap('THE LAST RAID HERE', 300);
  const hidden = await buttonState('THE LAST RAID HERE');
  await tap('THE LAST RAID HERE', 300);
  const shown = await buttonState('THE LAST RAID HERE');
  check('and its row turns the marks off and on again', hidden?.active === false && shown?.active === true, '');

  // The air read (v1.34). The deal picks a rung's three targets against GROUND
  // difficulty, so what the same target is worth FLOWN is the thing the panel
  // never said. Two things have to hold: it says one of the three bands, and it
  // is a read of THIS target rather than a constant — so cycling the three has
  // to move the flak figure at least once. A constant passes the first check
  // and fails the second, which is the point of having both.
  const airLine = async () => ((await texts()).find((t) => /^AIR — /.test(t)) ?? '').split(' · ')[0];
  const flak = async () => {
    // Read the figure off the AIR heading itself rather than the whole panel:
    // "AIR — HEAVY FLAK · 153 ON THE APPROACH". Scanning every text for a
    // number next to a word made this check depend on wording it does not own.
    const hit = /·\s*(\d+)\s/.exec((await texts()).find((t) => /^AIR — /.test(t)) ?? '');
    return hit ? Number(hit[1]) : null;
  };
  const firstAir = await airLine();
  check(
    'the target says what it is worth flying at',
    /^AIR — (CLEAR RUN|CONTESTED|HEAVY FLAK)$/.test(firstAir),
    firstAir || '(no air read)',
  );
  const flaks = [await flak()];
  // One of the demo's three targets is unscouted, and says so over the board.
  let recon = await rectOf(/RECON REQUIRED/);
  for (let i = 0; i < 2; i++) {
    await tap('TARGET ');
    flaks.push(await flak());
    recon ??= await rectOf(/RECON REQUIRED/);
  }
  check(
    'an unscouted target says so over the board, on its own two lines',
    setAsWritten(recon),
    recon ? `${Math.round(recon.w)}x${Math.round(recon.h)}` : 'no recon notice on any of the three',
  );
  await tap('TARGET '); // back to the first
  check(
    'the read is of the target, not a constant',
    new Set(flaks.filter((f) => f !== null)).size > 1,
    `flak across the three targets: ${flaks.join('/')}`,
  );

  // The mission is the first decision (v1.24), and it has to be a real one:
  // the row has to cycle, and the quota has to be read off the post rather
  // than being a fixed number — a base with five emplacements and one with
  // three cannot be asked for the same count.
  const mission = () => copy(/TAKE THE POST|SPIKE THE GUNS|RAID THE STORES/i);
  const opening = await mission();
  check('the planner names what the raid is for', opening !== '', opening);
  await tap(opening.split('\n')[0] || 'TAKE THE POST', 300);
  const second = await mission();
  check('and the mission can be changed', second !== opening, `${opening} → ${second}`);
  const quota = /(\d+)\s*of\s*(\d+)/i.exec(await copy(/\d+ of \d+/));
  check(
    'and a lesser mission asks for a share of what the post holds',
    quota !== null && Number(quota[1]) > 0 && Number(quota[1]) < Number(quota[2]),
    quota ? `${quota[1]} of ${quota[2]}` : 'no quota shown',
  );
  // Back to taking the post, so the rest of the run measures what it always did.
  for (let i = 0; i < 3 && !/TAKE THE POST/i.test(await mission()); i++) {
    await tap((await mission()).split('\n')[0], 300);
  }

  // ---- a muster row's secondary action (v1.29) -----------------------------
  //
  // Until now the planner said `M1 ABRAMS ×1 · 420S+130F 60s` and nothing
  // about what an Abrams can get through, how fast it crosses the ground, or
  // what losing one pays the defender in Command Points. A long press opens
  // the card.
  //
  // Driven on MUSTER on purpose: this harness's own comment records that its
  // rows are INERT in the demo town, and a disabled control used to refuse
  // the press before it could become a hold. Reading about a unit you cannot
  // train yet is exactly when you want to — so a row that will not act must
  // still answer.
  //
  // Held with the mouse rather than a touch, which is also the point: the
  // gesture is not touch-only, and a desktop player gets the same card.
  await tap('MUSTER', 400);
  const abrams = await find('M1 ABRAMS');
  check('the muster lists a unit to ask about', abrams !== null, abrams ? `enabled=${abrams.on}` : 'none');
  if (abrams) {
    await page.mouse.move(abrams.x, abrams.y);
    await page.mouse.down();
    await wait(900);
    const cardUp = await until(async () => (await find('CLOSE')) !== null, 1500);
    await page.mouse.up();
    await wait(300);
    check('holding it opens its card', cardUp, cardUp ? '' : 'no card appeared');
    const card = (await texts()).join(' | ');
    // The three facts that were in the content files and on no screen: what it
    // can break, how fast it moves, and what it is worth to the enemy dead.
    check(
      'and the card says what it breaks, how fast it moves and what it is worth',
      /DPS vs THE COMMAND CENTER/.test(card) &&
        /CELLS\/s/.test(card) &&
        /WORTH \d+ CP TO THE DEFENDER/.test(card),
      (/WORTH \d+ CP TO THE DEFENDER/.exec(card) ?? ['not shown'])[0],
    );
    await tap('CLOSE', 400);
    check('and it closes again', (await find('CLOSE')) === null, '');
  }

  await tap('SQUADS', 600);
  for (let i = 0; i < 3; i++) await tap('+ RANGER SQUAD', 200);
  await tap('+ M1 ABRAMS', 200);
  await tap('+ JAVELIN TEAM', 200);

  const committed = await mustered();
  check('assigning units actually commits them', committed !== null && committed > 0, `${committed} units`);
  await page.screenshot({ path: 'screenshots/e2e-raid-plan.png' });

  // ---- launch it -----------------------------------------------------------
  // ENABLED, not merely present: the button exists at zero units too, it is
  // just refused, and a check that only asks whether it is on screen would
  // wave an empty raid through exactly as the old harness did.
  const launch = await find('LAUNCH RAID');
  check('LAUNCH is live once a force exists', launch !== null && launch.on === true, '');
  await tap('LAUNCH RAID', 1800);
  const resolved = await until(
    async () => /COMMAND POST DESTROYED|RAID REPELLED/i.test(await copy(/COMMAND POST|RAID REPELLED/i)),
    30000,
  );
  check('the raid resolves into a report', resolved, await copy(/COMMAND POST|RAID REPELLED/i));
  // The report has to account for the force that went in, or the resolution
  // ran on something other than the plan.
  check(
    'and the report accounts for the force',
    /Losses:|Destruction:/i.test((await texts()).join('\n')),
    '',
  );
  await page.screenshot({ path: 'screenshots/e2e-raid-result.png' });

  // ---- the after-action report (M29) ----------------------------------------
  // The raid fought again for what the result leaves out: what killed the
  // force, what each squad did, when the chain fell. It closes back onto the
  // result, which is where WATCH REPLAY lives.
  const reported = await tap('REPORT', 1200);
  check('the result offers the after-action report', reported, '');
  const card = (await texts()).join('\n');
  check(
    'and the report names what killed them, the squads and the chain',
    /WHAT KILLED THEM/.test(card) && /THE SQUADS/.test(card) && /THE CHAIN/.test(card),
    card.replace(/\s+/g, ' ').slice(0, 120),
  );
  check('and every squad that went in has a line', /\d+ of \d+ back/.test(card), '');
  // Where it happened is the heat map's (Phase 2), and the card leads to it.
  check('and it leads to the map', (await find('ON THE MAP')) !== null, '');
  await page.screenshot({ path: 'screenshots/e2e-raid-report.png' });

  // ---- the what-if (M29 Phase 3) --------------------------------------------
  // The same raid fought again with one thing changed, on its own dice and
  // over ten more rolls, as soon as a row picks the change.
  const asked = await tap('WHAT IF', 1200);
  const firstAnswer = await copy(/As fought:/);
  check(
    'the report asks what one change would have done',
    asked && /With .*:/.test(firstAnswer) && /more rolls of the dice/.test(firstAnswer),
    firstAnswer.split('\n')[1] ?? 'no answer',
  );
  // One more, one fewer, then the entry sector: HAMMER in by the first other.
  await tap('CHANGE —', 400);
  await tap('CHANGE —', 400);
  const moved = await copy(/As fought:/);
  check(
    'and every row that moves fights it again',
    moved !== firstAnswer && /in by N1/.test(moved),
    moved.split('\n')[1] ?? 'no answer',
  );
  await page.screenshot({ path: 'screenshots/e2e-raid-whatif.png' });
  // INTO THE PLAN makes that one change to the plan the planner reopens with.
  await tap('INTO THE PLAN', 600);
  const taken = await buttonState('IN THE PLAN');
  check('and the change can be taken into the plan', taken !== null && taken.enabled === false, '');
  await tap('BACK', 800);
  check('BACK goes back to the report', /WHAT KILLED THEM/.test((await texts()).join('\n')), '');
  await tap('CLOSE', 800);
  check(
    'closing it goes back to the result',
    /COMMAND POST DESTROYED|RAID REPELLED/i.test(await copy(/COMMAND POST|RAID REPELLED/i)),
    '',
  );

  // ---- and the footage plays ----------------------------------------------
  const offered = await tap('WATCH REPLAY', 1500);
  check('the report offers the footage', offered, '');
  // Gated on the tap: without it, a planner still showing a launch countdown
  // could satisfy the clock pattern and call the replay proven.
  const playing =
    offered && (await until(async () => /REPLAY —/i.test((await texts()).join('\n')), 15000));
  check('the replay runs a clock', playing, await copy(/T\+\d+s/i));
  // Footage of a fight sounds like one (M31 Phase 3): the battle score, not
  // the quiet bed, following the threat to the post it shows.
  const replayScore = await page.evaluate(() => window.lastline.score());
  check(
    'and plays the battle score, following the raid',
    replayScore.mood === 'battle' && Object.keys(replayScore.visited).length > 0,
    `${replayScore.mood} ${JSON.stringify(replayScore.visited)}`,
  );
  // The heat map (M29 Phase 2) is drawn from the first frame of the footage.
  const heat = await buttonState('HEAT MAP');
  check('the footage draws its heat map from the start', heat?.active === true, heat ? '' : 'no HEAT MAP row');
  await page.screenshot({ path: 'screenshots/e2e-raid-replay.png' });
  // The footage carries the same report, fought from the config it is playing.
  const again = await tap('AFTER ACTION REPORT', 1200);
  check(
    'the footage offers the same report',
    again && /WHAT KILLED THEM/.test((await texts()).join('\n')),
    '',
  );
  check('and asks its what-ifs too', (await find('WHAT IF')) !== null, '');
  // ON THE MAP closes the card onto the end of the footage, and the footage
  // ends on a verdict, set as written across the top of the board.
  const scarsBefore = await page.evaluate(() => window.lastline.scars());
  const mapped = await tap('ON THE MAP', 1200);
  const verdictRe = /COMMAND POST DESTROYED|RAID REPELLED|WITHDRAWN/;
  const ended = mapped && (await until(async () => (await rectOf(verdictRe)) !== null, 15000));
  // The jump to the end plays nothing, but paints every scar the rest of the
  // raid left, so the board it lands on is the one the battle left (M31).
  const scarsAfter = await page.evaluate(() => window.lastline.scars());
  const scarCount = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  check(
    'and the board it lands on keeps what the raid left',
    scarCount(scarsAfter) > scarCount(scarsBefore),
    `${JSON.stringify(scarsBefore)} → ${JSON.stringify(scarsAfter)}`,
  );
  const verdict = await rectOf(verdictRe);
  check(
    'ON THE MAP goes to the end of the footage, its verdict set as written',
    ended && setAsWritten(verdict),
    verdict ? `${verdict.text.split('\n')[0]} ${Math.round(verdict.w)}x${Math.round(verdict.h)}` : 'no verdict',
  );
  // Every man the footage saw fall is marked where he fell.
  const marked = /WHERE EACH MAN FELL \((\d+)\)/.exec(await copy(/WHERE EACH MAN FELL/));
  const killed = /KILLS\s+(\d+)/.exec(await copy(/KILLS\s+\d+/));
  check(
    'and every man who fell is on the map',
    marked !== null && killed !== null && marked[1] === killed[1],
    `${marked?.[1] ?? '?'} marked of ${killed?.[1] ?? '?'} killed`,
  );
  await page.screenshot({ path: 'screenshots/e2e-raid-heat.png' });

  // ---- the footage of a what-if (M29 Phase 3) --------------------------------
  // WATCH IT plays the raid with the change. Its report asks no what-if of its
  // own: a what-if is one change from the raid as fought, never two.
  await tap('AFTER ACTION REPORT', 1200);
  await tap('WHAT IF', 1200);
  const watching = await tap('WATCH IT', 1500);
  const changedPlays =
    watching && (await until(async () => /REPLAY — WHAT IF:/.test((await texts()).join('\n')), 15000));
  check('WATCH IT plays the raid with the change', changedPlays, await copy(/REPLAY — /));
  await tap('AFTER ACTION REPORT', 1200);
  check(
    'and its report asks no what-if of its own',
    /WHAT KILLED THEM/.test((await texts()).join('\n')) && (await find('WHAT IF')) === null,
    '',
  );
  await tap('CLOSE', 600);

  // ---- and the planner remembers (M29 Phase 2) -----------------------------
  // Back on the post, the last raid on it is drawn over it, and says how many
  // it lost: the same men the footage marked.
  await tap('BACK', 1500);
  await until(async () => (await buttonState('THE LAST RAID HERE')) !== null, 10000);
  const ghost = await buttonState('THE LAST RAID HERE');
  check(
    'back at the planner, the post carries the last raid on it',
    ghost?.active === true && ghost.sub === `${marked?.[1]} FELL`,
    ghost ? `${ghost.sub}${ghost.active ? '' : ', off'}` : 'no row',
  );
  await page.screenshot({ path: 'screenshots/e2e-raid-planner-heat.png' });
  // And the plan reopens with the what-if taken into it.
  await tap('SQUADS', 600);
  check('and the plan reopens with the change taken into it', (await find('HAMMER N1')) !== null, '');

  await browser.close();
  if (errors.length) {
    console.error('page errors:');
    for (const e of errors) console.error(' ', e);
    failures++;
  }
  if (failures) {
    console.error(`\n${failures} raid check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log('\nRAID OK: a real force planned, launched, reported, replayed, mapped and asked what if.');
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
