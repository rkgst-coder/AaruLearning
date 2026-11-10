/* Hero Academy service worker — network-first so updates arrive, cache fallback for offline */
const CACHE = 'hero-academy-v3.8.1';
const AUDIO = 'hero-audio-v1'; // survives app updates so downloaded voice clips are kept
const ASSETS = ['./', './index.html', './parent.html', './manifest.webmanifest', './parent.webmanifest', './icon-192.png', './icon-512.png', './parent-192.png', './parent-512.png'];
const NET_WAIT = 4000; // v3.8.1: on weak Wi-Fi do not wait for ever — after 4 s the saved copy opens (the fresh copy is still saved for next time)

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
  const isPage = e.request.mode === 'navigate';
  /* v3.8.1: only good answers are saved; only a page request may fall back to index.html (a missing .json or icon must fail, not turn into HTML) */
  const net = fetch(e.request).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); }
    return r;
  });
  const saved = () => caches.match(e.request).then(r => r || (isPage ? caches.match('./index.html') : undefined));
  e.respondWith(new Promise((resolve, reject) => {
    let settled = false;
    const done = r => { if (!settled && r) { settled = true; resolve(r); return true; } return false; };
    const timer = setTimeout(() => saved().then(done), NET_WAIT);
    net.then(r => { clearTimeout(timer); if (!r.ok && isPage) saved().then(c => done(c || r)); else done(r); })
       .catch(() => { clearTimeout(timer); saved().then(r => { if (!done(r) && !settled) { settled = true; reject(new TypeError('offline and not saved')); } }); });
  }));
  e.waitUntil(net.catch(() => {}));
});
