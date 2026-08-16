/* Orka EMS Fitness — İŞLETME SAHİBİ İNCELEME DEMOSU politikası (17 Ağustos 2026)

   DİKKAT: Buradaki değerler NİHAİ İŞLETME KARARI DEĞİLDİR.
   Yalnızca demonun çalışabilmesi için alınmış geçici çalışma kararlarıdır.
   İşletme sahibi görüşmesinden sonra bu dosya ya güncellenecek ya da silinip
   kararlar DEFAULT_POLICY'ye taşınacak.

   DEFAULT_POLICY'den tek farkı, v0.5 §13'te UNRESOLVED bırakılan üç çift-iptal
   kararının demo için geçici olarak doldurulmuş olması ve geç iptalde fiziksel
   yerin açılması. Diğer her şey Phase 1 ile aynı. */

import { DEFAULT_POLICY, withPolicy } from './policy.default.mjs';

export const DEMO_POLICY = withPolicy({
  cancellation: {
    couple: {
      // Bir partner iptal ederse randevunun tamamı iptal olur.
      scope: 'CANCEL_WHOLE',
      // İptal hakkı YALNIZCA iptali başlatan üyeden düşer.
      allowanceCharge: 'INITIATOR_ONLY',
      // Yönetici çifti tek kişilik EMS seansına çevirebilir.
      adminCanConvertToSingle: true
    }
  },

  /**
   * Geç iptal: hak yanar ama fiziksel yer açılır.
   * Kredi tüketimi ile fiziksel doluluk bilinçli olarak ayrı iki kavram —
   * LATE_CANCEL_CONSUMED deltası 0 olduğu için hak geri gelmez, ama katılımcı
   * yer tutmayı bırakır ve başka üye o saati alabilir.
   */
  occupancy: {
    releasingStatuses: ['MEMBER_CANCELLED', 'ADMIN_CANCELLED', 'LATE_CANCEL']
  }
}, DEFAULT_POLICY);

/** Demo politikasında hangi kararların geçici olduğunu arayüz bu listeden okur. */
export const DEMO_PROVISIONAL_NOTES = Object.freeze([
  'EMS 8 kredi · 28 gün · 4×7 günlük kova · kova başına 2',
  'Çift iptali: tamamı iptal olur, hak yalnızca başlatandan düşer',
  'Yönetici çifti tek kişilik seansa çevirebilir',
  'Geç iptalde hak yanar ama yer açılır',
  'Çalışma saatleri: Pzt–Cmt 08:00–23:30 · Paz 10:00–22:00',
  'Randevu ufku 14 gün · kapanış 2 saat · iptal 24 saat'
]);
