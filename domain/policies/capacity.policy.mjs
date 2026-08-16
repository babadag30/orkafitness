/* Orka EMS Fitness — kapasite ve münhasırlık politikası
   Kaynak: v0.5 §4 (kapasite), §5 (çift münhasırlığı), §12 (çapraz servis politikası)

   TÜM kapasite kararı bu dosyadadır. Arayüz, yönetici paneli ve ileride sunucu
   aynı fonksiyonu çağırır. v0.5 §0'ın "kapasite mantığını UI dosyalarına dağıtma"
   maddesinin karşılığı budur.

   §12'deki sözde-politika birebir uygulanır:

     EĞER kesişen münhasır çift randevusu varsa   → her şeyi reddet
     DEĞİLSE istek EMS ÇİFT ise                   → seans tamamen boş olmalı
     DEĞİLSE                                       → normal kapasite: EMS≤3, Fitness≤2, toplam≤4 */

import { ServiceType, BookingMode } from '../core/types.mjs';
import { allow, deny, ReasonCode } from '../core/result.mjs';

/**
 * Kesişen bir münhasır çift randevusu var mı?
 * Varsa o seansa hiçbir yeni randevu giremez (v0.5 §5).
 */
export function validateNoExclusiveConflict({ occupancy }) {
  const ex = occupancy.exclusiveAppointment;
  if (!ex) return allow();
  return deny(ReasonCode.EXCLUSIVE_COUPLE_CONFLICT, {
    internalReason: `Bu saatte münhasır çift seansı var (appointment=${ex.id ?? '?'})`,
    adminMessage: 'Bu saat özel çift seansına ayrılmış. Yeni randevu için önce çift seansı taşınmalı.',
    metadata: { exclusiveAppointmentId: ex.id ?? null }
  });
}

/**
 * Çift seansı açılabilir mi? Politika "boş seans" şartı koşuyorsa
 * hedef saatte hiç EMS ve hiç Fitness katılımcısı olmamalı (v0.5 §5, §11).
 */
export function validateExclusiveCoupleSlot({ occupancy, policy }) {
  if (!policy.couple.requiresEmptySlot) return allow();

  if (occupancy.emsPeople > 0 || occupancy.fitnessPeople > 0) {
    return deny(ReasonCode.COUPLE_REQUIRES_EMPTY_SLOT, {
      internalReason:
        `Çift seansı boş saat ister; mevcut EMS=${occupancy.emsPeople}, Fitness=${occupancy.fitnessPeople}`,
      adminMessage:
        `Çift seansı yalnızca tamamen boş bir saate açılabilir. Şu an EMS ${occupancy.emsPeople}, Fitness ${occupancy.fitnessPeople} kişi var.`,
      metadata: { emsPeople: occupancy.emsPeople, fitnessPeople: occupancy.fitnessPeople }
    });
  }
  return allow();
}

/**
 * Normal (münhasır olmayan) kapasite kontrolü. v0.5 §4.
 * Üç eşik de ayrı ayrı kontrol edilir ki red sebebi kesin olsun.
 */
export function validateNormalCapacity({ occupancy, serviceType, people, policy }) {
  const cap = policy.capacity;
  const { emsPeople, fitnessPeople } = occupancy;

  if (serviceType === ServiceType.EMS && emsPeople + people > cap.ems) {
    return deny(ReasonCode.EMS_CAPACITY_FULL, {
      internalReason: `EMS ${emsPeople}+${people} > ${cap.ems}`,
      adminMessage: `EMS kontenjanı yetersiz: ${emsPeople}/${cap.ems} dolu, ${people} kişilik yer isteniyor.`,
      metadata: { emsPeople, requested: people, capacity: cap.ems }
    });
  }

  if (serviceType === ServiceType.FITNESS && fitnessPeople + people > cap.fitness) {
    return deny(ReasonCode.FITNESS_CAPACITY_FULL, {
      internalReason: `Fitness ${fitnessPeople}+${people} > ${cap.fitness}`,
      adminMessage: `Fitness kontenjanı yetersiz: ${fitnessPeople}/${cap.fitness} dolu.`,
      metadata: { fitnessPeople, requested: people, capacity: cap.fitness }
    });
  }

  const total = emsPeople + fitnessPeople;
  if (total + people > cap.total) {
    return deny(ReasonCode.STUDIO_CAPACITY_FULL, {
      internalReason: `Toplam ${total}+${people} > ${cap.total}`,
      adminMessage: `Stüdyo toplam kapasitesi dolu: ${total}/${cap.total} (EMS ${emsPeople}, Fitness ${fitnessPeople}).`,
      metadata: { emsPeople, fitnessPeople, total, requested: people, capacity: cap.total }
    });
  }

  return allow({ emsPeople, fitnessPeople, total });
}

/**
 * Kapasite kararının tek giriş noktası. v0.5 §12'nin dallanması burada.
 *
 * @param {object} p
 * @param {object} p.occupancy computeOccupancy çıktısı
 * @param {string} p.serviceType ServiceType
 * @param {string} p.bookingMode BookingMode
 * @param {object} p.policy
 */
export function validateStudioCapacity({ occupancy, serviceType, bookingMode, policy }) {
  // 1) Münhasır çift her şeyin önünde gelir.
  const exclusive = validateNoExclusiveConflict({ occupancy });
  if (!exclusive.allowed) return exclusive;

  const isCouple = bookingMode === BookingMode.COUPLE;
  const people = isCouple ? policy.couple.size : 1;

  // 2) Çift isteniyor ve politika münhasırsa: boş seans şartı.
  if (isCouple && policy.couple.exclusiveStudio) {
    const empty = validateExclusiveCoupleSlot({ occupancy, policy });
    if (!empty.allowed) return empty;
    return allow({ people, exclusive: true });
  }

  // 3) Diğer her durum normal kapasiteye tabi.
  //    Çift, münhasırlık kapalıysa buraya düşer ve 2 EMS koltuğu gibi davranır.
  return validateNormalCapacity({ occupancy, serviceType, people, policy });
}
