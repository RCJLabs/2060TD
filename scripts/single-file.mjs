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
      'Build with SINGLE_FILE=1 so the vendor split is off.',
  );
}
const code = readFileSync(join(OUT_DIR, 'assets', chunks[0]), 'utf8');

// Replace the module tag with the module itself. `$` is literal in the
// replacement, or a hash containing `$&` would splice the whole match back in.
const tag = /<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/;
if (!tag.test(html)) throw new Error('no module script tag found in the built index.html');
const inlined = html.replace(tag, () => `<script type="module">\n${code}\n</script>`);

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
