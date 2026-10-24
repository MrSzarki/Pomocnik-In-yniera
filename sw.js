// Pomocnik Inżyniera — service worker: offline app shell + cached web fonts.
// Bump VERSION whenever any app file changes so phones pick up the update.
const VERSION = 'pi-v1.0.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './pdf.js', './pdf.worker.js'];
const FONT_CACHE = 'pi-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: cache-first so the app keeps its typefaces offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // App page: serve from cache instantly, refresh the cache in the background.
  if (req.mode === 'navigate') {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match('./index.html');
      const net = fetch(req).then((res) => { if (res.ok) c.put('./index.html', res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response('Brak połączenia', { status: 503 });
    }));
    return;
  }
  // Other app files: cache-first.
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
    return res;
  })));
});
