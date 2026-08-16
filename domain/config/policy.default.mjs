/* Orka EMS Fitness — iş kuralı değerleri
   Kaynak: v0.5 §4 (kapasite), §5 (çift), §9 (paket döngüsü), §13 (iptal), §16 (pencere)

   BU DOSYA, İŞLETME KURALLARININ TEK YERİ.

   v0.5 §0 ve §24'ün mühendislik hedefi şu: işletme sahibi yarın bir kuralı
   değiştirdiğinde yalnızca burası ve ilgili testler değişsin. Motor kodunda
   hiçbir sayı yok — hepsi buradan okunur.

   PROVISIONAL işaretli değerler işletme onayı bekliyor (v0.5 §25).
   UNRESOLVED işaretli alanlar karara bağlanmadı; motor bunları tahmin etmez. */

import { CycleStrategy, BucketStrategy, UNRESOLVED } from '../core/types.mjs';

export const DEFAULT_POLICY = Object.freeze({

  /** v0.5 §4 — ONAYLANMIŞ. Eski demodaki toplam 3 kuralının yerini aldı. */
  capacity: Object.freeze({
    ems: 3,
    fitness: 2,
    total: 4
  }),

  /** v0.5 §5 — ONAYLANMIŞ. Çift seansı stüdyoyu tek başına kaplar. */
  couple: Object.freeze({
    size: 2,
    // false yapılırsa çift, normal 2 EMS koltuğuna dönüşür (§24 değişebilirlik sınırı)
    exclusiveStudio: true,
    // false yapılırsa çift kısmen dolu seansa da girebilir
    requiresEmptySlot: true
  }),

  /** v0.5 §8, §9 — PROVISIONAL. Yalnızca EMS için geçerli. */
  entitlement: Object.freeze({
    totalCredits: 8,
    cycleStrategy: CycleStrategy.FIXED_28_DAY,
    cycleDays: 28,
    bucketStrategy: BucketStrategy.PACKAGE_7_DAY_BUCKET,
    bucketDays: 7,
    maxPerBucket: 2,
    // Kullanılmayan haftalık hak devretmez (v0.5 §9)
    bucketRollover: false
  }),

  /** v0.5 §16 — PROVISIONAL. */
  bookingWindow: Object.freeze({
    horizonDays: 14,
    cutoffMinutesBeforeStart: 120
  }),

  /**
   * Hangi katılımcı durumları fiziksel yeri boşaltır.
   *
   * LATE_CANCEL bilerek listede DEĞİL: geç iptal hakkı yakar ve stüdyo o yeri
   * pratikte dolduramaz. Ama bu bir varsayım, onaylanmış kural değil —
   * işletme "geç iptalde yer açılsın" derse listeye eklemek yeterli.
   * İşletme sorusu olarak rapora taşındı.
   */
  occupancy: Object.freeze({
    releasingStatuses: Object.freeze(['MEMBER_CANCELLED', 'ADMIN_CANCELLED'])
  }),

  /** v0.5 §13. */
  cancellation: Object.freeze({
    ems: Object.freeze({
      cutoffHours: 24,              // ONAYLANMIŞ
      allowancePerCycle: 1,         // ONAYLANMIŞ
      releasesEntitlement: true     // PROVISIONAL — geçerli iptal hakkı iade eder
    }),
    fitness: Object.freeze({
      cutoffHours: 24,              // PROVISIONAL
      allowancePerCycle: null       // null = sınırsız; Fitness'ın EMS hakkı yok
    }),
    /**
     * v0.5 §13 — AÇIK KARAR. Üçü de bilerek UNRESOLVED.
     * Motor bu alanlardan birine ihtiyaç duyduğunda tahmin etmez;
     * POLICY_UNRESOLVED döndürüp kararı işletmeye bırakır.
     */
    couple: Object.freeze({
      // 'CANCEL_WHOLE' | 'CANCEL_PARTICIPANT_ONLY'
      scope: UNRESOLVED,
      // 'INITIATOR_ONLY' | 'BOTH_MEMBERS'
      allowanceCharge: UNRESOLVED,
      // true | false — yönetici çifti tek kişilik seansa çevirebilir mi
      adminCanConvertToSingle: UNRESOLVED
    })
  }),

  /** Seans süresi. */
  session: Object.freeze({
    durationMinutes: 25,
    bufferMinutes: 5
  }),

  /**
   * Çalışma saatleri — PROVISIONAL, v0.2'den beri onay bekliyor.
   * 0 = Pazar. null/eksik gün = kapalı.
   */
  schedule: Object.freeze({
    hours: Object.freeze({
      0: Object.freeze({ open: '10:00', close: '22:00' }),
      1: Object.freeze({ open: '08:00', close: '23:30' }),
      2: Object.freeze({ open: '08:00', close: '23:30' }),
      3: Object.freeze({ open: '08:00', close: '23:30' }),
      4: Object.freeze({ open: '08:00', close: '23:30' }),
      5: Object.freeze({ open: '08:00', close: '23:30' }),
      6: Object.freeze({ open: '08:00', close: '23:30' })
    })
  }),

  /**
   * Takvim anlamı gereken hesaplar için stüdyo saati.
   * Türkiye 2016'dan beri kalıcı UTC+3 ve yaz saati yok — sabit kayma doğru sonuç verir.
   */
  locale: Object.freeze({
    timezoneOffsetMinutes: 180,
    weekStartsOn: 1               // 1 = Pazartesi
  }),

  /** v0.5 §19 — PROVISIONAL, varsayılan KAPALI. */
  billing: Object.freeze({
    blockBookingWhenOverdue: false
  })
});

/**
 * Politikayı derin kopyalayıp üstüne yama uygular.
 * Testler ve yönetici Ayarlar ekranı bunu kullanır; DEFAULT_POLICY donmuş kalır.
 *
 * @example withPolicy({ capacity: { ems: 4 } })  // yalnızca ems değişir
 */
export function withPolicy(patch = {}, base = DEFAULT_POLICY) {
  const merge = (a, b) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b ?? {})) {
      out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? merge(a?.[k] ?? {}, v) : v;
    }
    return out;
  };
  return Object.freeze(merge(base, patch));
}
