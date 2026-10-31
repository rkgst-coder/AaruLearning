/* Hero Academy service worker — network-first so updates arrive, cache fallback for offline */
const CACHE = 'hero-academy-v3.6.0';
const AUDIO = 'hero-audio-v1'; // survives app updates so downloaded voice clips are kept
const ASSETS = ['./', './index.html', './parent.html', './manifest.webmanifest', './parent.webmanifest', './icon-192.png', './icon-512.png', './parent-192.png', './parent-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // never touch Apps Script calls
  /* v3.6: voice clips never change once made -> cache first (instant + works offline). The manifest stays network-first. */
  if (url.pathname.includes('/audio/') && !url.pathname.endsWith('.json')) {
    e.respondWith(caches.open(AUDIO).then(ac => ac.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.status === 200) { const copy = r.clone(); ac.put(e.request, copy).catch(() => {}); }
      return r;
    }))));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
