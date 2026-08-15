/* Orka EMS Fitness — service worker
   Uygulama kabuğunu önbelleğe alır, böylece uygulama çevrimdışı da açılır.
   Randevu verisi localStorage'da tutulduğu için çevrimdışı görüntüleme çalışır. */

const VERSION = 'orka-v7';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css?v=7',
  './js/rules.js?v=7',
  './js/store.js?v=7',
  './js/screens.js?v=7',
  './js/admin.js?v=7',
  './js/app.js?v=7',
  './assets/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-64.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Sayfa gezinmeleri: önce ağ, kopmuşsa önbellekteki kabuk
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Google Fonts: önbellekten ver, arka planda tazele
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  // Kendi dosyalarımız: önce ağ, kopmuşsa önbellek.
  // Cache-first bilerek kullanılmadı — kod güncellemelerinin kullanıcıya
  // ulaşması sürüm numarası bumplanmasına bağlı kalıyordu.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
