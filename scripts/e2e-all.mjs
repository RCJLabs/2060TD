/**
 * The gate, as one command: every harness in sequence, and an honest verdict.
 *
 * Two rules came out of the v1.41.2 gate, where two full batches on the same
 * commit failed different harnesses and none failed twice:
 *
 * - **Run them with nothing else going.** The contention is easy to cause by
 *   accident; a single harness re-run alongside a batch starved it.
 * - **A harness failing in a batch is evidence of neither a regression nor a
 *   flake until it has been re-run by itself.** So this does that, once, and
 *   reports the distinction rather than hiding it.
 *
 * v1.42 converted sixteen harnesses from fixed sleeps to polling for the UI to
 * stop changing, which is what most of the flakes were. The six gesture-driven
 * ones keep their sleeps on purpose: their waits are part of the test (a list
 * has to still be COASTING when the next touch lands), so a settle-poll there
 * would produce false passes rather than fewer false failures.
 *
 * Exit code is 0 only when every harness passed — a flake is reported loudly
 * and still passes the gate, a real failure does not.
 */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn('node', [`scripts/${file}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ ok: code === 0, out }));
  });

const files = readdirSync('scripts')
  .filter((f) => f.startsWith('e2e-') && f.endsWith('.mjs') && f !== 'e2e-all.mjs')
  .sort();

const flakes = [];
const failures = [];
for (const file of files) {
  process.stdout.write(`${file.padEnd(26)} `);
  const first = await run(file);
  if (first.ok) {
    console.log('PASS');
    continue;
  }
  // Not a verdict yet. Re-run it alone before calling it anything.
  process.stdout.write('retry… ');
  const second = await run(file);
  if (second.ok) {
    console.log('FLAKE (passed alone)');
    flakes.push(file);
    // What the first attempt said. A flake that leaves nothing behind cannot
    // be told from a real failure that happens to be rare, and the next run
    // is no help: it passed.
    const said = first.out.split('\n').filter((line) => !/^ok\b/.test(line)).slice(-12);
    console.log(said.map((line) => `    | ${line}`).join('\n'));
  } else {
    console.log('FAIL');
    failures.push(file);
    console.log(second.out.split('\n').slice(-12).join('\n'));
  }
}

console.log(`\n${files.length - flakes.length - failures.length}/${files.length} clean` +
  (flakes.length ? `, ${flakes.length} flaked: ${flakes.join(', ')}` : '') +
  (failures.length ? `, ${failures.length} FAILED: ${failures.join(', ')}` : ''));
if (failures.length) process.exit(1);
