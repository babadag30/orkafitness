/* Orka EMS Fitness — EMS hak defteri
   Kaynak: v0.5 §8

   Değiştirilebilir bir `remainingSessions` sayacı yok. Bakiye her zaman
   olayların toplamından türetilir. Böylece "bu hak nereye gitti" sorusunun
   cevabı her zaman kayıtta durur.

   Kritik ayrıntı: her kayıt iki zaman taşır.
     sessionStartsAt → hangi seansa ait (haftalık kova bundan hesaplanır)
     recordedAt      → ne zaman yazıldı (denetim izi)
   İkisini ayırmazsak, bugün iptal edilen gelecek haftaki bir randevu
   yanlış kovadan düşülür. */

import { LedgerEventType, LEDGER_DELTA, BUCKET_RELEASING_EVENTS } from '../core/types.mjs';
import { toEpoch } from '../core/time.mjs';
import { resolveBucket } from '../policies/cycle.policy.mjs';

/**
 * Defter kaydı üretir. Saf fonksiyon — yan etkisi yok, kalıcılık çağıranın işi.
 *
 * @param {object} p
 * @param {string} p.type LedgerEventType üyesi
 * @param {string} p.memberId
 * @param {string} p.memberPackageId
 * @param {number|string|Date} p.sessionStartsAt ilgili seansın başlangıcı
 * @param {number} [p.delta] yalnızca MANUAL_ADJUSTMENT için zorunlu
 */
export function createEntry(p) {
  const known = Object.hasOwn(LEDGER_DELTA, p.type);
  if (!known && p.type !== LedgerEventType.MANUAL_ADJUSTMENT) {
    throw new Error(`Bilinmeyen defter olayı: ${p.type}`);
  }
  if (p.type === LedgerEventType.MANUAL_ADJUSTMENT && typeof p.delta !== 'number') {
    throw new Error('MANUAL_ADJUSTMENT için delta zorunludur');
  }

  return Object.freeze({
    id: p.id ?? null,
    type: p.type,
    delta: p.type === LedgerEventType.MANUAL_ADJUSTMENT ? p.delta : LEDGER_DELTA[p.type],
    memberId: p.memberId,
    memberPackageId: p.memberPackageId,
    appointmentId: p.appointmentId ?? null,
    participantId: p.participantId ?? null,
    sessionStartsAt: p.sessionStartsAt != null ? toEpoch(p.sessionStartsAt) : null,
    recordedAt: p.recordedAt != null ? toEpoch(p.recordedAt) : null,
    actorId: p.actorId ?? null,
    reason: p.reason ?? null
  });
}

/**
 * Defterden anlık durumu türetir.
 *
 * @returns {{
 *   totalCredits:number, used:number, remaining:number,
 *   reservedCount:number, bucketUsage:Map<string,number>, entryCount:number
 * }}
 */
export function projectEntitlement({ ledger = [], memberPackage, policy }) {
  const total = memberPackage?.totalCredits ?? policy.entitlement.totalCredits;

  let deltaSum = 0;
  let reservedCount = 0;
  const bucketUsage = new Map();

  for (const e of ledger) {
    if (memberPackage && e.memberPackageId !== memberPackage.id) continue;

    deltaSum += e.delta;
    if (e.type === LedgerEventType.BOOKING_RESERVED) reservedCount += 1;

    // Kova sayacı: rezervasyon +1, iade -1. Sayım seansın tarihine göre yapılır.
    if (e.sessionStartsAt != null && memberPackage) {
      const isReserve = e.type === LedgerEventType.BOOKING_RESERVED;
      const isRelease = BUCKET_RELEASING_EVENTS.includes(e.type);
      if (isReserve || isRelease) {
        const b = resolveBucket(memberPackage, e.sessionStartsAt, policy);
        bucketUsage.set(b.key, (bucketUsage.get(b.key) ?? 0) + (isReserve ? 1 : -1));
      }
    }
  }

  return {
    totalCredits: total,
    used: -deltaSum,
    remaining: total + deltaSum,
    reservedCount,
    bucketUsage,
    entryCount: ledger.length
  };
}

/** Belirli bir seans tarihinin düştüğü kovada kaç kullanım var. */
export function bucketUsageFor({ ledger, memberPackage, sessionStartsAt, policy }) {
  const projection = projectEntitlement({ ledger, memberPackage, policy });
  const bucket = resolveBucket(memberPackage, sessionStartsAt, policy);
  return {
    bucket,
    used: projection.bucketUsage.get(bucket.key) ?? 0
  };
}

/**
 * Bir paket döneminde kaç self-servis iptal kullanıldı. v0.5 §13.
 * Yalnızca üyenin kendi iptalleri sayılır; yönetici iptali hakkı yakmaz.
 */
export function cancellationsUsed({ ledger = [], memberPackage }) {
  return ledger.filter(e =>
    e.type === LedgerEventType.MEMBER_CANCEL_RELEASED &&
    (!memberPackage || e.memberPackageId === memberPackage.id)
  ).length;
}
