/* Orka EMS Fitness — EMS hak kontrolü
   Kaynak: v0.5 §8 (defter), §9 (döngü ve kova), §15 (Fitness hak tüketmez)

   Yalnızca EMS içindir. Fitness bu dosyaya hiç uğramaz — v0.5 §3 ve §15'in
   "Fitness EMS hak sisteminden bağımsızdır" kuralı, Fitness akışının bu modülü
   hiç çağırmamasıyla yapısal olarak garanti edilir. */

import { allow, deny, ReasonCode } from '../core/result.mjs';
import { toEpoch } from '../core/time.mjs';
import { isWithinCycle, resolveCycle } from './cycle.policy.mjs';
import { projectEntitlement, bucketUsageFor } from '../ledger/ledger.mjs';

/**
 * Tek bir üyenin, belirli bir seans tarihi için EMS hakkını doğrular.
 * Çift seansında bu fonksiyon iki üye için ayrı ayrı çağrılır (v0.5 §8).
 *
 * @param {object} p
 * @param {object} p.member
 * @param {object} p.memberPackage
 * @param {Array}  p.ledger üyenin defter kayıtları
 * @param {number|string|Date} p.sessionStartsAt
 * @param {object} p.policy
 */
export function validateMemberEntitlement({ member, memberPackage, ledger = [], sessionStartsAt, policy }) {
  if (!member || member.active !== true) {
    return deny(ReasonCode.MEMBER_INACTIVE, {
      internalReason: `Üye pasif (member=${member?.id ?? '?'})`,
      adminMessage: 'Üyelik pasif durumda.',
      metadata: { memberId: member?.id ?? null }
    });
  }

  if (!memberPackage) {
    return deny(ReasonCode.PACKAGE_MISSING, {
      internalReason: `Üyenin EMS paketi yok (member=${member.id})`,
      adminMessage: `${member.name ?? member.id} için tanımlı bir EMS paketi yok.`,
      metadata: { memberId: member.id }
    });
  }

  if (memberPackage.active !== true) {
    return deny(ReasonCode.PACKAGE_INACTIVE, {
      internalReason: `Paket pasif (package=${memberPackage.id})`,
      adminMessage: 'EMS paketi pasif durumda.',
      metadata: { memberId: member.id, packageId: memberPackage.id }
    });
  }

  if (!isWithinCycle(memberPackage, sessionStartsAt, policy)) {
    const cycle = resolveCycle(memberPackage, policy, toEpoch(sessionStartsAt));
    return deny(ReasonCode.PACKAGE_PERIOD_MISMATCH, {
      internalReason: `Seans paket dönemi dışında (session=${toEpoch(sessionStartsAt)})`,
      adminMessage: 'Seçilen tarih üyenin paket dönemi dışında kalıyor.',
      metadata: {
        memberId: member.id,
        cycleStartsAt: cycle.startsAt,
        cycleEndsAt: cycle.endsAt,
        sessionStartsAt: toEpoch(sessionStartsAt)
      }
    });
  }

  const projection = projectEntitlement({ ledger, memberPackage, policy });
  if (projection.remaining <= 0) {
    return deny(ReasonCode.PACKAGE_EXHAUSTED, {
      internalReason: `Hak kalmadı (kalan=${projection.remaining})`,
      adminMessage: `${member.name ?? member.id}: paketteki ${projection.totalCredits} seansın tamamı kullanılmış.`,
      metadata: {
        memberId: member.id,
        remaining: projection.remaining,
        totalCredits: projection.totalCredits
      }
    });
  }

  const { bucket, used } = bucketUsageFor({ ledger, memberPackage, sessionStartsAt, policy });
  if (used >= policy.entitlement.maxPerBucket) {
    return deny(ReasonCode.WEEKLY_LIMIT_REACHED, {
      internalReason: `Kova dolu (${used}/${policy.entitlement.maxPerBucket}, bucket=${bucket.key})`,
      adminMessage:
        `${member.name ?? member.id}: bu haftaki EMS hakkı dolu (${used}/${policy.entitlement.maxPerBucket}).`,
      metadata: {
        memberId: member.id,
        bucketKey: bucket.key,
        bucketIndex: bucket.index,
        bucketStartsAt: bucket.startsAt,
        bucketEndsAt: bucket.endsAt,
        used,
        maxPerBucket: policy.entitlement.maxPerBucket
      }
    });
  }

  return allow({
    memberId: member.id,
    remaining: projection.remaining,
    bucketKey: bucket.key,
    bucketUsed: used
  });
}

/** Üyeye gösterilecek özet. v0.5 §17 — ham defter matematiği sızmaz. */
export function entitlementSummary({ memberPackage, ledger = [], at, policy }) {
  const projection = projectEntitlement({ ledger, memberPackage, policy });
  const { bucket, used } = bucketUsageFor({
    ledger, memberPackage, sessionStartsAt: at ?? Date.now(), policy
  });
  return {
    packageUsed: projection.totalCredits - projection.remaining,
    packageTotal: projection.totalCredits,
    bucketUsed: used,
    bucketLimit: policy.entitlement.maxPerBucket,
    bucketEndsAt: bucket.endsAt
  };
}
