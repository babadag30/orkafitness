/* Orka EMS Fitness — RuleResult sözleşmesi
   Kaynak: v0.5 §23 (kural motoru), §17 (üyeye ham kapasite gösterme)

   Kural fonksiyonları boolean döndürmez. Her sonuç, hem üyeye gösterilebilecek
   sade bir mesajı hem de yöneticiye gösterilecek ayrıntılı mesajı taşır.

   §17 uyumu buradan yapısal olarak gelir: memberMessage üretilirken kapasite
   sayıları hiç kullanılmaz, sayılar yalnızca adminMessage ve metadata'ya girer.
   Arayüz yanlış alanı seçmediği sürece üyeye "EMS 2/3" sızması mümkün değil. */

/** Merkezî red sebepleri. Arayüz bu kodlara göre davranır, metne göre değil. */
export const ReasonCode = Object.freeze({
  OK: 'OK',

  // üye / hesap
  MEMBER_INACTIVE: 'MEMBER_INACTIVE',

  // paket ve hak
  PACKAGE_MISSING: 'PACKAGE_MISSING',
  PACKAGE_INACTIVE: 'PACKAGE_INACTIVE',
  PACKAGE_PERIOD_MISMATCH: 'PACKAGE_PERIOD_MISMATCH',
  PACKAGE_EXHAUSTED: 'PACKAGE_EXHAUSTED',
  WEEKLY_LIMIT_REACHED: 'WEEKLY_LIMIT_REACHED',

  // kapasite
  EMS_CAPACITY_FULL: 'EMS_CAPACITY_FULL',
  FITNESS_CAPACITY_FULL: 'FITNESS_CAPACITY_FULL',
  STUDIO_CAPACITY_FULL: 'STUDIO_CAPACITY_FULL',

  // çift seansı
  EXCLUSIVE_COUPLE_CONFLICT: 'EXCLUSIVE_COUPLE_CONFLICT',
  COUPLE_REQUIRES_EMPTY_SLOT: 'COUPLE_REQUIRES_EMPTY_SLOT',

  // partner
  PARTNER_NOT_LINKED: 'PARTNER_NOT_LINKED',
  PARTNER_INACTIVE: 'PARTNER_INACTIVE',
  PARTNER_NOT_ELIGIBLE: 'PARTNER_NOT_ELIGIBLE',
  PARTNER_SELF_LINK: 'PARTNER_SELF_LINK',
  PARTNER_DUPLICATE_LINK: 'PARTNER_DUPLICATE_LINK',
  PARTNER_ALREADY_LINKED: 'PARTNER_ALREADY_LINKED',

  // zaman
  MEMBER_TIME_CONFLICT: 'MEMBER_TIME_CONFLICT',
  SLOT_CLOSED: 'SLOT_CLOSED',
  BOOKING_TOO_EARLY: 'BOOKING_TOO_EARLY',
  BOOKING_TOO_LATE: 'BOOKING_TOO_LATE',

  // iptal
  CANCEL_TOO_LATE: 'CANCEL_TOO_LATE',
  CANCEL_ALLOWANCE_EXHAUSTED: 'CANCEL_ALLOWANCE_EXHAUSTED',
  ALREADY_CANCELLED: 'ALREADY_CANCELLED',
  SESSION_IN_PAST: 'SESSION_IN_PAST',

  // karara bağlanmamış politika — v0.5 §13
  POLICY_UNRESOLVED: 'POLICY_UNRESOLVED'
});

/**
 * Üyeye gösterilecek metinler. Bilinçli olarak sade ve sayısız.
 * v0.5 §17: üye yalnızca "Uygun / Dolu / Kapalı" düzeyinde bilgi görür.
 */
const MEMBER_MESSAGES = Object.freeze({
  [ReasonCode.MEMBER_INACTIVE]: 'Üyeliğin şu anda aktif değil. Stüdyoyla iletişime geç.',
  [ReasonCode.PACKAGE_MISSING]: 'Tanımlı bir EMS paketin yok. Stüdyoyla iletişime geç.',
  [ReasonCode.PACKAGE_INACTIVE]: 'EMS paketin aktif değil. Stüdyoyla iletişime geç.',
  [ReasonCode.PACKAGE_PERIOD_MISMATCH]: 'Bu tarih paket dönemin dışında.',
  [ReasonCode.PACKAGE_EXHAUSTED]: 'Paketindeki EMS seansların tamamını kullandın.',
  [ReasonCode.WEEKLY_LIMIT_REACHED]: 'Bu haftaki EMS hakkını doldurdun.',
  [ReasonCode.EMS_CAPACITY_FULL]: 'Bu saat dolu.',
  [ReasonCode.FITNESS_CAPACITY_FULL]: 'Bu saat dolu.',
  [ReasonCode.STUDIO_CAPACITY_FULL]: 'Bu saat dolu.',
  [ReasonCode.EXCLUSIVE_COUPLE_CONFLICT]: 'Bu saat dolu.',
  [ReasonCode.COUPLE_REQUIRES_EMPTY_SLOT]: 'Bu saat çift seansı için uygun değil.',
  [ReasonCode.PARTNER_NOT_LINKED]: 'Tanımlı bir partnerin yok. Stüdyoyla iletişime geç.',
  [ReasonCode.PARTNER_INACTIVE]: 'Partnerinin üyeliği aktif değil.',
  [ReasonCode.PARTNER_NOT_ELIGIBLE]: 'Partnerin bu seans için uygun değil.',
  [ReasonCode.PARTNER_SELF_LINK]: 'Geçersiz partner seçimi.',
  [ReasonCode.PARTNER_DUPLICATE_LINK]: 'Bu partner zaten tanımlı.',
  [ReasonCode.PARTNER_ALREADY_LINKED]: 'Zaten tanımlı bir partner var.',
  [ReasonCode.MEMBER_TIME_CONFLICT]: 'Bu saatte zaten bir randevun var.',
  [ReasonCode.SLOT_CLOSED]: 'Bu saat kapalı.',
  [ReasonCode.BOOKING_TOO_EARLY]: 'Bu tarih için randevu henüz açılmadı.',
  [ReasonCode.BOOKING_TOO_LATE]: 'Bu seans için randevu kapandı. Stüdyoyla iletişime geç.',
  [ReasonCode.CANCEL_TOO_LATE]: 'İptal süresi doldu. Stüdyoyla iletişime geç.',
  [ReasonCode.CANCEL_ALLOWANCE_EXHAUSTED]: 'Bu paket döneminde iptal hakkını kullandın. Stüdyoyla iletişime geç.',
  [ReasonCode.ALREADY_CANCELLED]: 'Bu randevu zaten iptal edilmiş.',
  [ReasonCode.SESSION_IN_PAST]: 'Bu seans geçmiş.',
  [ReasonCode.POLICY_UNRESOLVED]: 'Bu işlem için stüdyoyla iletişime geçmen gerekiyor.'
});

/** Bu kodlar yönetici tarafından gerekçeyle aşılabilir. v0.5 §21. */
const OVERRIDABLE = Object.freeze(new Set([
  ReasonCode.PACKAGE_EXHAUSTED,
  ReasonCode.WEEKLY_LIMIT_REACHED,
  ReasonCode.EMS_CAPACITY_FULL,
  ReasonCode.FITNESS_CAPACITY_FULL,
  ReasonCode.STUDIO_CAPACITY_FULL,
  ReasonCode.COUPLE_REQUIRES_EMPTY_SLOT,
  ReasonCode.BOOKING_TOO_EARLY,
  ReasonCode.BOOKING_TOO_LATE,
  ReasonCode.CANCEL_TOO_LATE,
  ReasonCode.CANCEL_ALLOWANCE_EXHAUSTED,
  ReasonCode.PACKAGE_PERIOD_MISMATCH
]));

/**
 * Bunlar aşılamaz: ya veri tutarsızlığı yaratır ya da fiziksel olarak imkânsız.
 * EXCLUSIVE_COUPLE_CONFLICT bilerek burada — çift seansına üçüncü kişi eklemek
 * kuralın kendisini anlamsız kılar (v0.5 §5). Yönetici önce çifti taşımalı.
 */
const NEVER_OVERRIDABLE = Object.freeze(new Set([
  ReasonCode.MEMBER_INACTIVE,
  ReasonCode.EXCLUSIVE_COUPLE_CONFLICT,
  ReasonCode.MEMBER_TIME_CONFLICT,
  ReasonCode.PARTNER_NOT_LINKED,
  ReasonCode.PARTNER_SELF_LINK,
  ReasonCode.ALREADY_CANCELLED,
  ReasonCode.SESSION_IN_PAST,
  ReasonCode.POLICY_UNRESOLVED
]));

/** İzin verilen sonuç. */
export function allow(metadata = {}) {
  return Object.freeze({
    allowed: true,
    reasonCode: ReasonCode.OK,
    internalReason: null,
    memberMessage: null,
    adminMessage: null,
    overridable: false,
    unresolved: false,
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Reddedilen sonuç.
 * @param {string} reasonCode ReasonCode üyesi
 * @param {object} opts
 * @param {string} opts.internalReason geliştirici/log metni — kullanıcıya gösterilmez
 * @param {string} [opts.adminMessage] yöneticiye gösterilecek ayrıntılı metin (sayı içerebilir)
 * @param {string} [opts.memberMessage] varsayılan katalog metnini ezmek için
 * @param {object} [opts.metadata] karar ayrıntıları — sayılar burada taşınır
 */
export function deny(reasonCode, opts = {}) {
  const known = Object.hasOwn(MEMBER_MESSAGES, reasonCode);
  if (!known) throw new Error(`Bilinmeyen ReasonCode: ${reasonCode}`);

  const overridable = opts.overridable !== undefined
    ? opts.overridable
    : (OVERRIDABLE.has(reasonCode) && !NEVER_OVERRIDABLE.has(reasonCode));

  return Object.freeze({
    allowed: false,
    reasonCode,
    internalReason: opts.internalReason ?? reasonCode,
    memberMessage: opts.memberMessage ?? MEMBER_MESSAGES[reasonCode],
    adminMessage: opts.adminMessage ?? opts.internalReason ?? MEMBER_MESSAGES[reasonCode],
    overridable,
    unresolved: reasonCode === ReasonCode.POLICY_UNRESOLVED,
    metadata: Object.freeze({ ...(opts.metadata ?? {}) })
  });
}

/**
 * Karara bağlanmamış politika. v0.5 §13.
 * Motor burada tahmin yürütmez; soruyu açıkça geri döndürür.
 */
export function unresolved(question, opts = {}) {
  return deny(ReasonCode.POLICY_UNRESOLVED, {
    internalReason: `Politika kararı bekliyor: ${question}`,
    adminMessage: opts.adminMessage
      ?? `Bu davranış henüz karara bağlanmadı: ${question}`,
    metadata: { question, ...(opts.metadata ?? {}) }
  });
}

/**
 * Kontrolleri sırayla çalıştırır, ilk redde durur.
 * Kontroller tembel (fonksiyon) verilir; böylece gereksiz hesap yapılmaz.
 * @param {Array<() => object>} checks
 */
export function firstDenial(checks) {
  const collected = {};
  for (const check of checks) {
    const r = check();
    if (!r.allowed) return r;
    Object.assign(collected, r.metadata);
  }
  return allow(collected);
}

export const isAllowed = (r) => r.allowed === true;
