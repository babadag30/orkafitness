/* Orka EMS Fitness — servis çalışanı (işletme sahibi önizlemesi)

   Sürüm bilerek "demo" ön ekli: önizleme kendi kaynağında (preview URL)
   çalışır ve üretimdeki orka-v7 önbelleğine hiçbir şekilde dokunmaz. */

const VERSION = 'orka-demo-8';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css?v=demo8',
  './js/main.mjs?v=demo8',
  './assets/logo.png',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-64.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(SHELL).catch(() => { /* kısmi önbellek yeterli */ }))
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

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  // Kendi dosyalarımız — domain/ modülleri dahil: önce ağ, kopmuşsa önbellek.
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

/* ------------------------------------------------------------------ */
/* Web Push                                                             */
/* ------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }

  const title = d.title || 'Orka EMS Fitness';
  const options = {
    body: d.body || '',
    icon: './icons/icon-192.png',
    badge: './icons/favicon-64.png',
    // Aynı randevu için tekrar gelen bildirim üst üste yığılmaz
    tag: d.tag || 'orka',
    renotify: true,
    data: { targetUrl: d.targetUrl || './index.html#/appointments', type: d.type || null }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.targetUrl || './index.html#/appointments';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Açık bir Orka penceresi varsa onu öne al — yeni sekme açma
    for (const c of all) {
      if (c.url.includes('/uygulama/')) {
        await c.focus();
        try { c.postMessage({ type: 'NAVIGATE', target }); } catch { /* önemli değil */ }
        return;
      }
    }
    // Yoksa ana ekran uygulamasını aç
    await self.clients.openWindow(new URL(target, self.registration.scope).href);
  })());
});

self.addEventListener('pushsubscriptionchange', (event) => {
  // Abonelik döndüğünde istemci yeniden abone olur; burada sessizce geçiyoruz.
  event.waitUntil(Promise.resolve());
});
