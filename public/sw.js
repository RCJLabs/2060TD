/**
 * The service worker (v1.26) — what makes 2060TD work with no signal.
 *
 * There is no build-time precache list here on purpose. Vite hashes every
 * asset filename, so any list written by hand is wrong the moment the bundle
 * is rebuilt, and generating one needs a plugin this project does not have.
 * Runtime caching gets the same result with nothing to keep in step: the first
 * load fills the cache with exactly what the app asked for, and every load
 * after it is served from disk.
 *
 * Two strategies, chosen by what the URL promises:
 *
 * - **Hashed assets** (`assets/index-DjZpPO5E.js`) are immutable BY NAME. A
 *   change produces a different filename, so cache-first can never serve a
 *   stale one and the 1.5MB engine chunk is fetched once per release rather
 *   than once per launch.
 * - **Everything else** — the navigation itself, the manifest, the icons —
 *   is network-first with a cache fallback. A deploy is picked up on the next
 *   online launch, and a launch with no signal still opens the last one that
 *   worked. Cache-first here would pin a player to whatever version they
 *   happened to install.
 *
 * The game keeps its save in localStorage, which the worker never touches: a
 * cache eviction must never cost somebody their campaign.
 */

const VERSION = 'v1.28';
const CACHE = `2060td-${VERSION}`;

/**
 * The shell, plus whatever the shell loads — discovered rather than listed.
 *
 * Caching only the shell at install looks right and fails the only test that
 * matters. A worker registers on `load`, which is AFTER the page has already
 * fetched its script chunks, so those requests were never intercepted and
 * never cached: the first visit ends with an offline-capable `index.html` and
 * no engine to run. Reloading once online would fix it, and quietly requires
 * the player to have opened the game twice before it works on a train.
 *
 * So install reads `index.html` and takes the asset URLs out of it. The
 * surface is narrow and it is our own Vite output — `<script src>` and
 * `<link rel=modulepreload href>`, both pointing into `assets/` with a hash —
 * so a regex is enough here where it would not be for HTML in general.
 */
async function precache() {
  const cache = await caches.open(CACHE);
  const shell = ['./', './index.html', './manifest.webmanifest'];
  const found = new Set();
  try {
    const res = await fetch('./index.html', { cache: 'reload' });
    if (res.ok) {
      const html = await res.text();
      for (const match of html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)) {
        found.add(match[1]);
      }
    }
  } catch {
    /* offline at install: the shell alone is still worth having */
  }
  // One at a time rather than `addAll`, which rejects the whole batch if any
  // single entry fails — one missing icon should not cost the engine chunk.
  await Promise.all(
    [...shell, ...found].map((url) =>
      cache.add(url).catch(() => undefined),
    ),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))),
      )
      // Claim immediately so the first launch after an install is already
      // offline-capable, rather than the one after that.
      .then(() => self.clients.claim()),
  );
});

/** Hashed by Vite: `name-8charhash.ext`, and therefore safe to keep forever. */
const immutable = (url) => /\/assets\/.+-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only GET, and only this origin. A POST is never idempotent enough to
  // replay from a cache, and another origin's response is not ours to keep.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (immutable(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        // A navigation that missed falls back to the shell, so a deep link
        // opened offline gets the game rather than the browser's error page.
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
