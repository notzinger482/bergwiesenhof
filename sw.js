// Service Worker: hält die App komplett offline verfügbar.
// Bei jeder neuen Version VERSION hochzählen – dann lädt das Tablet die neuen Dateien (im WLAN).
const VERSION = 'bwh-3.5.2';
const DATEIEN = ['./', 'index.html', 'app.css', 'defaults.js', 'logic.js', 'store.js', 'docs.js', 'app.js', 'views2.js', 'vordrucke.js', 'genusspaket.webp',
  'manifest.webmanifest', 'logo.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  // cache: 'reload' – Dateien frisch vom Server holen, nicht aus dem Browser-Cache (sonst landen alte Dateien im neuen Speicher)
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(DATEIEN.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
self.addEventListener('message', e => { if (e.data === 'jetztAktualisieren') self.skipWaiting(); });
