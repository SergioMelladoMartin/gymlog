// Offline-first service worker for gymlog.
//
// Strategy:
//  - HTML pages: network-first, cached fallback (so we always get fresh
//    shells when online, but the app still loads offline).
//  - Static assets (_astro/*, fonts, icons): cache-first with background
//    revalidation — the hashed filenames are immutable.
//  - sqlite-wasm binary: cache-first (large, rarely changes).
//  - Google APIs (drive, oauth, userinfo): never cached, always network.
//
// The app itself already persists the user's .fitnotes in OPFS, so once
// this SW has cached the shell, the whole thing works offline except the
// Drive sync which is gated on network anyway.

const CACHE_VERSION = 'gymlog-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

const SHELL_URLS = [
  '/',
  '/login',
  '/calendar',
  '/diary',
  '/exercises',
  '/stats',
  '/day',
  '/exercise',
  '/manifest.webmanifest',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Don't fail the whole install if one asset 404s.
      Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  );
}

function isGoogleApi(url) {
  return (
    url.hostname.endsWith('googleapis.com') ||
    url.hostname.endsWith('google.com') ||
    url.hostname === 'accounts.google.com'
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Google OAuth / Drive API calls.
  if (isGoogleApi(url)) return;

  // Cache-first for immutable static assets.
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone());
          return res;
        } catch {
          return hit ?? Response.error();
        }
      }),
    );
    return;
  }

  // Same-origin HTML / navigation: network-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok && req.mode === 'navigate') {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const hit = await cache.match(req);
          if (hit) return hit;
          const shell = await cache.match('/');
          return shell ?? Response.error();
        }
      })(),
    );
  }
});
