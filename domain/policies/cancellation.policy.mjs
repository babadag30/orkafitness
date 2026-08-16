/* Orka EMS Fitness — iptal politikası
   Kaynak: v0.5 §13

   ONAYLANMIŞ: EMS self-servis iptal 24 saat, paket dönemi başına 1 hak,
               yönetici aşabilir.
   AÇIK KARAR: çift seansı iptalinin kapsamı ve hak muhasebesi.

   Açık kararlar tahmin edilmiyor. Politika UNRESOLVED taşırken üye bir çift
   seansını iptal etmeye kalkarsa motor POLICY_UNRESOLVED döndürür ve sorunun
   ne olduğunu metadata'da taşır. Böylece "sessizce bir davranış seçilmiş olma"
   ihtimali ortadan kalkar — v0.5 §13'ün açık isteği. */

import {
  ServiceType, BookingMode, AttendanceStatus,
  AppointmentStatus, LedgerEventType, Actor, UNRESOLVED
} from '../core/types.mjs';
import { allow, deny, unresolved, ReasonCode } from '../core/result.mjs';
import { toEpoch, hoursBetween } from '../core/time.mjs';
import { createEntry, cancellationsUsed } from '../ledger/ledger.mjs';

/** Servise göre iptal ayarları. */
const rulesFor = (serviceType, policy) =>
  serviceType === ServiceType.EMS ? policy.cancellation.ems : policy.cancellation.fitness;

/**
 * İptal edilebilir mi?
 *
 * @param {object} p
 * @param {object} p.appointment katılımcılarıyla birlikte
 * @param {string} p.requestedByMemberId iptali başlatan üye (yönetici ise null)
 * @param {string} p.actor Actor.MEMBER | Actor.ADMIN
 * @param {object} p.ctx { now, policy, packages, ledgers, members }
 */
export function validateCancellation({ appointment, requestedByMemberId, actor = Actor.MEMBER, ctx }) {
  const { policy, now } = ctx;

  if (appointment.status === AppointmentStatus.CANCELLED) {
    return deny(ReasonCode.ALREADY_CANCELLED, {
      internalReason: `Randevu zaten iptal: ${appointment.id ?? '?'}`,
      adminMessage: 'Bu randevu zaten iptal edilmiş.'
    });
  }

  const hoursLeft = hoursBetween(now, appointment.startsAt);

  if (hoursLeft < 0 && actor === Actor.MEMBER) {
    return deny(ReasonCode.SESSION_IN_PAST, {
      internalReason: `Seans geçmiş (${hoursLeft.toFixed(1)} saat)`,
      adminMessage: 'Bu seans geçmiş; iptal yerine katılım durumu işaretlenmeli.',
      metadata: { hoursLeft }
    });
  }

  const isCouple = appointment.bookingMode === BookingMode.COUPLE;

  /* --- Yönetici iptali: kural aşılabilir, hak iade edilir (v0.5 §13) --- */
  if (actor === Actor.ADMIN) {
    if (isCouple && policy.cancellation.couple.adminCanConvertToSingle === UNRESOLVED) {
      // Yönetici tüm çifti iptal edebilir; belirsiz olan yalnızca
      // "tek kişilik seansa çevirme" davranışı. Tam iptale izin veriyoruz,
      // dönüştürme talebi ayrı bir işlem olarak karara bağlanacak.
      return allow({
        scope: 'WHOLE_APPOINTMENT',
        note: 'Çiftin tek kişilik seansa dönüştürülmesi henüz karara bağlanmadı; bu işlem tam iptaldir.',
        plan: buildCancellationPlan({ appointment, actor, ctx, chargeAllowanceTo: [] })
      });
    }
    return allow({
      scope: isCouple ? 'WHOLE_APPOINTMENT' : 'PARTICIPANT',
      plan: buildCancellationPlan({ appointment, actor, ctx, chargeAllowanceTo: [] })
    });
  }

  /* --- Üye iptali --- */

  // Çift seansı: kapsam ve hak muhasebesi karara bağlanmadı (v0.5 §13).
  if (isCouple) {
    const c = policy.cancellation.couple;
    if (c.scope === UNRESOLVED || c.allowanceCharge === UNRESOLVED) {
      return unresolved('Çift seansı iptalinin kapsamı ve iptal hakkı muhasebesi', {
        adminMessage:
          'Çift seansını üye kendisi iptal edemiyor: bu davranış henüz karara bağlanmadı. ' +
          'Şimdilik yönetici iptal etmeli.',
        metadata: {
          appointmentId: appointment.id ?? null,
          openQuestions: [
            'Bir partner iptal ederse randevunun tamamı iptal olur mu?',
            'İptal hakkı yalnızca başlatandan mı yoksa iki üyeden de mi düşer?',
            'Yönetici çifti tek kişilik seansa çevirebilir mi?'
          ],
          resolvedBy: 'policy.cancellation.couple'
        }
      });
    }
  }

  const rules = rulesFor(appointment.serviceType, policy);

  if (hoursLeft < rules.cutoffHours) {
    return deny(ReasonCode.CANCEL_TOO_LATE, {
      internalReason: `Seansa ${hoursLeft.toFixed(1)} saat kaldı, sınır ${rules.cutoffHours}`,
      adminMessage:
        `İptal penceresi kapandı: seansa ${hoursLeft.toFixed(1)} saat kaldı (sınır ${rules.cutoffHours} saat).`,
      metadata: { hoursLeft, cutoffHours: rules.cutoffHours }
    });
  }

  // İptal hakkı yalnızca EMS'te var; Fitness'ta allowancePerCycle null (v0.5 §13).
  if (rules.allowancePerCycle != null) {
    const memberPackage = get(ctx.packages, requestedByMemberId);
    const ledger = get(ctx.ledgers, requestedByMemberId) ?? [];
    const used = cancellationsUsed({ ledger, memberPackage });

    if (used >= rules.allowancePerCycle) {
      return deny(ReasonCode.CANCEL_ALLOWANCE_EXHAUSTED, {
        internalReason: `İptal hakkı tükendi (${used}/${rules.allowancePerCycle})`,
        adminMessage:
          `Bu paket döneminde ${used}/${rules.allowancePerCycle} iptal hakkı kullanılmış. Yönetici aşabilir.`,
        metadata: { used, allowance: rules.allowancePerCycle }
      });
    }
  }

  // İptal hakkının kimden düşeceği politikadan gelir (v0.5 §13 sorusu 2).
  const chargeAllowanceTo = isCouple && policy.cancellation.couple.allowanceCharge === 'BOTH_MEMBERS'
    ? (appointment.participants ?? []).map(p => p.memberId)
    : [requestedByMemberId];

  return allow({
    scope: isCouple && policy.cancellation.couple.scope === 'CANCEL_WHOLE'
      ? 'WHOLE_APPOINTMENT'
      : 'PARTICIPANT',
    hoursLeft,
    plan: buildCancellationPlan({ appointment, actor, ctx, chargeAllowanceTo })
  });
}

const get = (mapOrObj, key) => (mapOrObj instanceof Map ? mapOrObj.get(key) : mapOrObj?.[key]);

/**
 * Yönetici, çift seansını tek kişilik EMS seansına çevirir. v0.5 §13 sorusu 3.
 * Kalan üye randevusunu korur; çıkarılan üyenin hakkı iade edilir ve
 * randevu münhasırlığını kaybeder — böylece saat normal kapasiteye geri döner.
 *
 * Politika bunu açıkça izinli hâle getirmediyse motor tahmin yürütmez.
 */
export function convertCoupleToSingle({ appointment, removeMemberId, ctx }) {
  const { policy } = ctx;

  if (policy.cancellation.couple.adminCanConvertToSingle !== true) {
    return unresolved('Yöneticinin çift seansını tek kişilik seansa çevirebilmesi', {
      adminMessage: 'Çifti tek kişilik seansa çevirme davranışı henüz karara bağlanmadı.',
      metadata: { appointmentId: appointment.id ?? null }
    });
  }

  if (appointment.bookingMode !== BookingMode.COUPLE) {
    return deny(ReasonCode.ALREADY_CANCELLED, {
      internalReason: 'Randevu zaten çift değil',
      adminMessage: 'Bu randevu bir çift seansı değil.'
    });
  }

  const staying = (appointment.participants ?? []).filter(p => p.memberId !== removeMemberId);
  const removed = (appointment.participants ?? []).find(p => p.memberId === removeMemberId);

  if (!removed || staying.length !== 1) {
    return deny(ReasonCode.ALREADY_CANCELLED, {
      internalReason: `Çıkarılacak katılımcı bulunamadı: ${removeMemberId}`,
      adminMessage: 'Çıkarılacak üye bu randevuda değil.'
    });
  }

  return allow({
    removedMemberId: removeMemberId,
    remainingMemberId: staying[0].memberId,
    plan: {
      appointment: {
        id: appointment.id ?? null,
        bookingMode: BookingMode.SINGLE,
        // Münhasırlık kalkar → saat normal kapasite kurallarına döner
        exclusiveStudio: false,
        status: AppointmentStatus.ACTIVE
      },
      // Çıkarılan üye iptal edilmiş sayılır, kalan üye randevusunu korur
      participants: [{ memberId: removeMemberId, attendanceStatus: AttendanceStatus.ADMIN_CANCELLED }],
      removeParticipants: [removeMemberId],
      ledgerEntries: [createEntry({
        type: LedgerEventType.ADMIN_CANCEL_RELEASED,
        memberId: removeMemberId,
        memberPackageId: get(ctx.packages, removeMemberId)?.id ?? null,
        appointmentId: appointment.id ?? null,
        sessionStartsAt: toEpoch(appointment.startsAt),
        recordedAt: toEpoch(ctx.now),
        actorId: ctx.actorId ?? null,
        reason: 'Çift seansı tek kişiliğe çevrildi'
      })],
      allowanceChargedTo: []
    }
  });
}

/**
 * Geç iptal. Yönetici kaydeder. v0.5 §13 + demo politikası:
 * hak YANMAYA devam eder (delta 0), ama katılımcı fiziksel yeri bırakır.
 * Kredi tüketimi ile doluluk bilinçli olarak ayrı iki kavram.
 */
export function recordLateCancel({ appointment, memberId, ctx }) {
  const participant = (appointment.participants ?? []).find(p => p.memberId === memberId);
  if (!participant) {
    return deny(ReasonCode.ALREADY_CANCELLED, {
      internalReason: `Katılımcı bulunamadı: ${memberId}`,
      adminMessage: 'Bu üye randevuda değil.'
    });
  }

  const isEMS = appointment.serviceType === ServiceType.EMS;
  return allow({
    entitlementRestored: false,
    occupancyReleased: ctx.policy.occupancy.releasingStatuses.includes(AttendanceStatus.LATE_CANCEL),
    plan: {
      appointment: { id: appointment.id ?? null },
      participants: [{ memberId, attendanceStatus: AttendanceStatus.LATE_CANCEL }],
      // delta 0 — ayrılmış hak kesinleşir, iade edilmez
      ledgerEntries: isEMS ? [createEntry({
        type: LedgerEventType.LATE_CANCEL_CONSUMED,
        memberId,
        memberPackageId: get(ctx.packages, memberId)?.id ?? null,
        appointmentId: appointment.id ?? null,
        sessionStartsAt: toEpoch(appointment.startsAt),
        recordedAt: toEpoch(ctx.now),
        actorId: ctx.actorId ?? null,
        reason: 'Geç iptal'
      })] : [],
      allowanceChargedTo: []
    }
  });
}

/**
 * İptalin yazma planı. Motor uygulamaz; kalıcılık katmanı tek transaction'da uygular.
 * Hak iadesi yalnızca EMS katılımcıları için üretilir (v0.5 §15).
 */
export function buildCancellationPlan({ appointment, actor, ctx, chargeAllowanceTo = [] }) {
  const byMember = actor === Actor.MEMBER;
  const status = byMember ? AttendanceStatus.MEMBER_CANCELLED : AttendanceStatus.ADMIN_CANCELLED;
  const eventType = byMember
    ? LedgerEventType.MEMBER_CANCEL_RELEASED
    : LedgerEventType.ADMIN_CANCEL_RELEASED;

  const participants = (appointment.participants ?? []).map(p => ({
    memberId: p.memberId,
    attendanceStatus: status
  }));

  const ledgerEntries = appointment.serviceType === ServiceType.EMS
    && ctx.policy.cancellation.ems.releasesEntitlement
    ? (appointment.participants ?? []).map(p => createEntry({
        type: eventType,
        memberId: p.memberId,
        memberPackageId: get(ctx.packages, p.memberId)?.id ?? null,
        appointmentId: appointment.id ?? null,
        sessionStartsAt: toEpoch(appointment.startsAt),
        recordedAt: toEpoch(ctx.now),
        actorId: ctx.actorId ?? null,
        reason: byMember ? 'Üye iptali' : 'Yönetici iptali'
      }))
    : [];

  return {
    appointment: { id: appointment.id ?? null, status: AppointmentStatus.CANCELLED },
    participants,
    ledgerEntries,
    // Hangi üyenin iptal hakkı yandı — açık karar netleşince burası dolar.
    allowanceChargedTo: chargeAllowanceTo
  };
}
