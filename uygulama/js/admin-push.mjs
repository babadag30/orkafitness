/* Orka EMS Fitness — yöneticinin üyeye manuel bildirim göndermesi

   Gönderim TAMAMEN sunucuda yapılır (demo-admin Edge Function).
   Tarayıcıda VAPID özel anahtarı, service_role anahtarı ya da başka bir sır yok.

   YETKİLENDİRME — demo sınırı:
   Otomatik randevu bildirimlerinin metnini sunucu üretir, istemci belirleyemez.
   Manuel bildirimde metni yönetici yazıyor; bu çok daha hassas olduğu için ayrı
   bir işlevde ve sunucuda tutulan bir sırla korunuyor. Sır kodda değil; yönetici
   bir kez elle giriyor ve yalnızca sessionStorage'da kalıyor (sekme kapanınca gider).
   Üretimde bunun yerine gerçek sunucu tarafı ADMIN RBAC gelecek. */

const URL = 'https://apahxdkdsvpoejrphkzd.supabase.co/functions/v1/demo-admin';
const PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwYWh4ZGtkc3Zwb2VqcnBoa3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTIxOTAsImV4cCI6MjEwMjQyODE5MH0.oBJ5kzRYyPCWmIjQlLxiwNfTIYAhPt3ykLQ2K61pqJo';

const KEY_STORE = 'orka.demo.adminKey';

/* Sınırlar ve doğrulama saf modülde — testler oradan çalışır, sunucu da
   aynı değerleri uygular. */
export { TITLE_MAX, BODY_MAX, validateNotification, fill } from './notification-rules.mjs';
import { fill as fillText } from './notification-rules.mjs';

export const getKey = () => sessionStorage.getItem(KEY_STORE) ?? '';
export const setKey = (k) => sessionStorage.setItem(KEY_STORE, String(k ?? '').trim());
export const clearKey = () => sessionStorage.removeItem(KEY_STORE);
export const hasKey = () => !!getKey();

async function call(action, payload = {}) {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, adminKey: getKey(), ...payload })
    });
    const json = await res.json().catch(() => ({}));
    return { httpStatus: res.status, ...json };
  } catch (e) {
    return { ok: false, error: 'Sunucuya ulaşılamadı. Bağlantını kontrol et.' };
  }
}

export const verifyKey = () => call('verifyKey');
export const memberPushStatus = (memberId) => call('memberPushStatus', { memberId });
export const manualLog = () => call('manualLog');

export const send = ({ memberId, template, title, message }) =>
  call('sendMemberNotification', { memberId, template, title, message, actor: 'demo-admin' });

/* ------------------------------------------------------------------ */
/* Şablonlar                                                            */
/* ------------------------------------------------------------------ */

/** `{ad}` gönderim öncesi üyenin adıyla değiştirilir. */
export const TEMPLATES = [
  {
    id: 'APPOINTMENT_REMINDER',
    label: 'Randevu Hatırlatma',
    title: 'Randevu hatırlatması',
    body: '{ad}, yaklaşan EMS randevunu hatırlatmak istedik. Görüşmek üzere!'
  },
  {
    id: 'PAYMENT_REMINDER',
    label: 'Ödeme Hatırlatma',
    title: 'Ödeme hatırlatması',
    body: '{ad}, ödeme durumunla ilgili stüdyomuzla iletişime geçebilirsin.'
  },
  {
    id: 'PACKAGE_REMINDER',
    label: 'Paket Hatırlatma',
    title: 'Paket durumu',
    body: '{ad}, EMS paketinin süresi yaklaşıyor. Yenilemek için bize ulaşabilirsin.'
  },
  {
    id: 'STUDIO_ANNOUNCEMENT',
    label: 'Stüdyo Duyurusu',
    title: 'Stüdyo duyurusu',
    body: 'Değerli üyemiz, çalışma saatlerimizle ilgili bir güncelleme var. Detaylar için bize ulaşabilirsin.'
  },
  {
    id: 'CUSTOM',
    label: 'Özel Mesaj',
    title: 'Orka EMS Fitness',
    body: ''
  }
];

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES.at(-1);


