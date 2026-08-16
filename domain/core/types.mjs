/* Orka EMS Fitness — domain sabitleri
   Kaynak: v0.5 §3 (servisler), §7 (katılımcı modeli), §8 (defter), §14 (katılım)

   Burada yalnızca "ne var" tanımlanır; "ne yapılabilir" policies/ altındadır.
   Hiçbir sayı bu dosyada bulunmaz — sayılar config/policy.default.mjs'te. */

/** Stüdyonun sunduğu iki bağımsız hizmet. v0.5 §3. */
export const ServiceType = Object.freeze({
  EMS: 'EMS',
  FITNESS: 'FITNESS'
});

/** Randevunun kaç kişilik olduğu. v0.5 §7. */
export const BookingMode = Object.freeze({
  SINGLE: 'SINGLE',
  COUPLE: 'COUPLE'
});

/** Çift seansında kimin başlattığını izlemek için. v0.5 §7. */
export const ParticipantRole = Object.freeze({
  PRIMARY: 'PRIMARY',
  PARTNER: 'PARTNER'
});

/** Randevunun bütünü. Katılımcı bazlı durum ayrıca tutulur. */
export const AppointmentStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  CANCELLED: 'CANCELLED'
});

/**
 * Katılımcı bazlı durum. v0.5 §14 — çift seansında bir kişi gelip
 * diğeri gelmeyebilir; bu yüzden durum randevuda değil katılımcıda tutulur.
 */
export const AttendanceStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  ATTENDED: 'ATTENDED',
  NO_SHOW: 'NO_SHOW',
  MEMBER_CANCELLED: 'MEMBER_CANCELLED',
  LATE_CANCEL: 'LATE_CANCEL',
  ADMIN_CANCELLED: 'ADMIN_CANCELLED'
});

/** Kontenjan tüketmeyi bırakmış katılımcı durumları. */
export const RELEASED_ATTENDANCE = Object.freeze([
  AttendanceStatus.MEMBER_CANCELLED,
  AttendanceStatus.ADMIN_CANCELLED
]);

/**
 * Defter olayları. v0.5 §8.
 * delta: hak bakiyesine etkisi.
 *   -1 → hak ayrıldı (rezervasyon anında düşer)
 *    0 → ayrılmış hak kesinleşti (zaten düşülmüştü, tekrar düşmez)
 *   +1 → hak iade edildi
 * MANUAL_ADJUSTMENT deltasını kendi taşır.
 */
export const LedgerEventType = Object.freeze({
  BOOKING_RESERVED: 'BOOKING_RESERVED',
  ATTENDED_CONSUMED: 'ATTENDED_CONSUMED',
  NO_SHOW_CONSUMED: 'NO_SHOW_CONSUMED',
  LATE_CANCEL_CONSUMED: 'LATE_CANCEL_CONSUMED',
  MEMBER_CANCEL_RELEASED: 'MEMBER_CANCEL_RELEASED',
  ADMIN_CANCEL_RELEASED: 'ADMIN_CANCEL_RELEASED',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT'
});

export const LEDGER_DELTA = Object.freeze({
  [LedgerEventType.BOOKING_RESERVED]: -1,
  [LedgerEventType.ATTENDED_CONSUMED]: 0,
  [LedgerEventType.NO_SHOW_CONSUMED]: 0,
  [LedgerEventType.LATE_CANCEL_CONSUMED]: 0,
  [LedgerEventType.MEMBER_CANCEL_RELEASED]: +1,
  [LedgerEventType.ADMIN_CANCEL_RELEASED]: +1
  // MANUAL_ADJUSTMENT bilerek yok — deltasını olayın kendisi taşır.
});

/**
 * Haftalık kovadaki yeri serbest bırakan olaylar.
 * İptal edilen bir randevu yalnızca hakkı değil, o haftanın kotasındaki
 * yeri de geri verir; aksi hâlde iptal eden üye haftasını kaybederdi.
 */
export const BUCKET_RELEASING_EVENTS = Object.freeze([
  LedgerEventType.MEMBER_CANCEL_RELEASED,
  LedgerEventType.ADMIN_CANCEL_RELEASED
]);

/** Kuralı kimin adına değerlendirdiğimiz. Aynı kural farklı sonuç verebilir. */
export const Actor = Object.freeze({
  MEMBER: 'MEMBER',
  ADMIN: 'ADMIN'
});

/** Paket döngüsü stratejileri. v0.5 §9 — sonradan değişebilir olmalı. */
export const CycleStrategy = Object.freeze({
  FIXED_28_DAY: 'FIXED_28_DAY',
  CALENDAR_MONTH: 'CALENDAR_MONTH'
});

/** Haftalık kova stratejileri. v0.5 §9. */
export const BucketStrategy = Object.freeze({
  PACKAGE_7_DAY_BUCKET: 'PACKAGE_7_DAY_BUCKET',
  CALENDAR_WEEK: 'CALENDAR_WEEK'
});

/**
 * Karara bağlanmamış politika işareti. v0.5 §13.
 * Bir policy alanı bu değeri taşıyorsa motor tahmin yürütmez;
 * açıkça POLICY_UNRESOLVED döndürüp kararı işletmeye bırakır.
 */
export const UNRESOLVED = 'UNRESOLVED';
