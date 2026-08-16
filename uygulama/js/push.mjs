/* Orka EMS Fitness — Web Push (işletme sahibi demosu)

   iPhone'da çalışması için üç şart var:
     1) Uygulama ana ekrandan (standalone) açılmış olmalı — Safari sekmesinde değil
     2) Bildirim izni KULLANICI HAREKETİ ile istenmeli (sayfa yüklenirken değil)
     3) Push, sunucudan VAPID ile gönderilmeli

   VAPID ÖZEL ANAHTARI buraya asla girmez. Yalnızca açık anahtar kullanılır ve
   o da sunucudan alınır — böylece anahtar döndüğünde istemci kodu değişmez. */

import * as Sync from './sync.mjs';

export const State = {
  UNSUPPORTED: 'UNSUPPORTED',       // tarayıcı/cihaz desteklemiyor
  NEEDS_INSTALL: 'NEEDS_INSTALL',   // iOS: önce ana ekrana eklenmeli
  DENIED: 'DENIED',                 // kullanıcı reddetmiş
  OFF: 'OFF',                       // destekleniyor ama açılmamış
  ON: 'ON',                         // abone
  NOT_CONFIGURED: 'NOT_CONFIGURED'  // sunucuda VAPID yok
};

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

const supported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** urlBase64 → Uint8Array (applicationServerKey biçimi) */
function toKey(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

let cachedVapid = null;
async function vapidPublicKey() {
  if (cachedVapid !== null) return cachedVapid;
  const h = await Sync.health().catch(() => ({}));
  cachedVapid = h?.vapidPublicKey ?? null;
  return cachedVapid;
}

/** Kullanıcıya gösterilecek durum. Yan etkisi yok, izin İSTEMEZ. */
export async function status() {
  if (!supported()) {
    // iOS'ta Safari sekmesinde PushManager yoktur; ana ekrana eklenince gelir.
    return isIOS() && !isStandalone() ? State.NEEDS_INSTALL : State.UNSUPPORTED;
  }
  if (Notification.permission === 'denied') return State.DENIED;
  if (!(await vapidPublicKey())) return State.NOT_CONFIGURED;

  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? State.ON : State.OFF;
}

/**
 * Bildirimleri açar. YALNIZCA kullanıcı dokunuşundan çağrılmalı.
 * @returns {{ok:boolean, state:string, message:string}}
 */
export async function enable(memberId) {
  if (!supported()) {
    return isIOS() && !isStandalone()
      ? { ok: false, state: State.NEEDS_INSTALL,
          message: 'Önce Paylaş → Ana Ekrana Ekle ile uygulamayı yükle, sonra ana ekrandan aç.' }
      : { ok: false, state: State.UNSUPPORTED, message: 'Bu cihaz bildirimleri desteklemiyor.' };
  }

  const key = await vapidPublicKey();
  if (!key) {
    return { ok: false, state: State.NOT_CONFIGURED,
             message: 'Bildirim sunucusu henüz yapılandırılmadı.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, state: State.DENIED,
             message: 'Bildirim izni verilmedi. Ayarlar’dan açabilirsin.' };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey(key)
    });
  }

  const r = await Sync.subscribePush(memberId, sub.toJSON());
  if (!r?.ok) {
    return { ok: false, state: State.OFF, message: 'Abonelik kaydedilemedi. Tekrar dene.' };
  }
  return { ok: true, state: State.ON, message: 'Bildirimler açıldı.' };
}

/** Aboneliği kapatır. Demo sıfırlama bunu ÇAĞIRMAZ (v0.5 §25). */
export async function disable() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return { ok: true };
  await Sync.unsubscribePush(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  return { ok: true };
}

/** Kurulumu doğrulamak için tek bildirim gönderir. */
export const test = (memberId) => Sync.testPush(memberId);

export const LABEL = {
  [State.ON]: 'Bildirimler açık',
  [State.OFF]: 'Bildirim izni gerekli',
  [State.DENIED]: 'Bildirimler kapalı',
  [State.NEEDS_INSTALL]: 'Ana ekrana ekle',
  [State.UNSUPPORTED]: 'Bu cihaz desteklemiyor',
  [State.NOT_CONFIGURED]: 'Sunucu hazırlanıyor'
};
