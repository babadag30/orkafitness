/* Orka EMS Fitness — manuel bildirim içerik kuralları (saf)

   Sunucu yine de kendi doğrulamasını yapar — bu modül istemci tarafında
   erken geri bildirim içindir ve testlerin konusu budur.
   Sunucudaki sınırlarla aynı değerleri taşır. */

export const TITLE_MAX = 80;
export const BODY_MAX = 500;

export const TEMPLATE_IDS = Object.freeze([
  'APPOINTMENT_REMINDER', 'PAYMENT_REMINDER', 'PACKAGE_REMINDER',
  'STUDIO_ANNOUNCEMENT', 'CUSTOM'
]);

/** `{ad}` yer tutucusunu üyenin ilk adıyla değiştirir. */
export const fill = (text, memberName) =>
  String(text ?? '').replaceAll('{ad}', String(memberName ?? '').trim().split(' ')[0] || 'Merhaba');

/**
 * Gönderilecek bildirimi doğrular.
 * @returns {{ok:boolean, error?:string, field?:string}}
 */
export function validateNotification({ template, title, message, deviceCount }) {
  if (!TEMPLATE_IDS.includes(template)) {
    return { ok: false, field: 'template', error: 'Geçersiz şablon.' };
  }

  const t = String(title ?? '').trim();
  const m = String(message ?? '').trim();

  if (!t) return { ok: false, field: 'title', error: 'Başlık boş olamaz.' };
  if (t.length > TITLE_MAX) {
    return { ok: false, field: 'title', error: `Başlık en fazla ${TITLE_MAX} karakter olabilir.` };
  }
  if (!m) return { ok: false, field: 'message', error: 'Mesaj boş olamaz.' };
  if (m.length > BODY_MAX) {
    return { ok: false, field: 'message', error: `Mesaj en fazla ${BODY_MAX} karakter olabilir.` };
  }
  if (deviceCount === 0) {
    return { ok: false, field: 'devices', error: 'Bu üye henüz bu cihazında bildirim izni vermemiş.' };
  }

  return { ok: true, title: t, message: m };
}
