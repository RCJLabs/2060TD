/**
 * The single-file build: dist-single/index.html plus its one chunk, folded
 * into one self-contained HTML document.
 *
 * It reads the real built index.html rather than carrying a hand-written copy
 * of the page — the boot card, the styles and the viewport meta then cannot
 * drift from what the deployed site serves, which is exactly what a
 * hand-maintained wrapper does the moment either side changes.
 *
 *   npm run build:single && node scripts/single-file.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.argv[2] ?? 'dist-single';
const html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8');

const chunks = readdirSync(join(OUT_DIR, 'assets')).filter((f) => f.endsWith('.js'));
if (chunks.length !== 1) {
  throw new Error(
    `expected exactly one chunk to inline, found ${chunks.length}: ${chunks.join(', ')}. ` +
      'The game builds to one chunk; a second one means something imported a dependency.',
  );
}
const code = readFileSync(join(OUT_DIR, 'assets', chunks[0]), 'utf8');

// Replace the module tag with the module itself. `$` is literal in the
// replacement, or a hash containing `$&` would splice the whole match back in.
const tag = /<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/;
if (!tag.test(html)) throw new Error('no module script tag found in the built index.html');
let inlined = html.replace(tag, () => `<script type="module">\n${code}\n</script>`);

/**
 * The stylesheet, folded in the same way.
 *
 * There was nothing to fold until the display face arrived: the page carried
 * its few rules inline and Vite emitted no CSS at all. It emits one now, with
 * two woff2 weights inside it as data URIs — so a build that inlines only the
 * script produces a file that still fetches something, and the one promise
 * this artifact makes is that it does not. Asserted below rather than
 * trusted, because the failure is silent: the page loads, the game runs, and
 * every label is drawn in the fallback.
 */
const sheets = readdirSync(join(OUT_DIR, 'assets')).filter((f) => f.endsWith('.css'));
for (const sheet of sheets) {
  const css = readFileSync(join(OUT_DIR, 'assets', sheet), 'utf8');
  // Found by scanning the tags rather than by building a regex out of the
  // filename: a Vite hash is arbitrary text going into a pattern, and the
  // first attempt at this shipped a mangled character class that threw.
  const link = [...inlined.matchAll(/<link\b[^>]*>/g)].find((m) => m[0].includes(sheet));
  if (!link) throw new Error(`no link tag found for ${sheet}`);
  inlined = inlined.replace(link[0], () => `<style>\n${css}\n</style>`);
}
if (/<link[^>]*rel="stylesheet"/i.test(inlined)) {
  throw new Error('a stylesheet link survived inlining — the single file would still fetch it');
}
if (/(src|href)="\.\/assets\//.test(inlined)) {
  throw new Error('an ./assets reference survived inlining — the single file is not self-contained');
}

const out = join(OUT_DIR, '2060td.html');
writeFileSync(out, inlined);
console.log(`${out} — ${(inlined.length / 1024 / 1024).toFixed(2)}MB, one file, no requests.`);

/**
 * The same page with the document shell taken off, for hosts that supply
 * their own <html>/<head>/<body> and reject the tags. Derived here rather
 * than trimmed by hand for the same reason the file above is: two copies of a
 * page drift the moment either changes.
 */
const headInner = /<head>([\s\S]*?)<\/head>/.exec(inlined);
const bodyInner = /<body>([\s\S]*?)<\/body>/.exec(inlined);
if (!headInner || !bodyInner) throw new Error('could not find <head>/<body> in the built page');
const fragment = `${headInner[1]
  // The host provides these; a second copy inside a body is invalid.
  .replace(/<meta charset[^>]*>/gi, '')
  .replace(/<meta\s+name="viewport"[\s\S]*?>/gi, '')
  .replace(/<link rel="icon"[^>]*>/gi, '')
  .trim()}\n${bodyInner[1].trim()}\n`;

const frag = join(OUT_DIR, 'embed.html');
writeFileSync(frag, fragment);
console.log(`${frag} — ${(fragment.length / 1024 / 1024).toFixed(2)}MB, same page, no shell.`);
