/* Orka EMS Fitness — randevu kuralları motoru
   Kaynak: v0.5 §5, §8, §12, §22, §23

   Üç giriş noktası var: tek EMS, çift EMS, Fitness. Üçü de aynı alt
   doğrulayıcıları çağırır — hiçbir kural iki yerde ayrı yazılmaz.

   Motor veritabanına yazmaz. İzin verdiğinde bir "plan" döndürür:
   yazılacak randevu, katılımcılar ve defter kayıtları. Phase 2'de kalıcılık
   katmanı bu planı tek transaction içinde uygular. v0.5 §22'nin
   "kısmi başarı yasak" kuralı böylece yapısal hâle gelir — plan ya tümüyle
   uygulanır ya hiç. */

import {
  ServiceType, BookingMode, ParticipantRole,
  AttendanceStatus, AppointmentStatus, LedgerEventType
} from '../core/types.mjs';
import { allow, deny, ReasonCode } from '../core/result.mjs';
import { toEpoch, endOf } from '../core/time.mjs';
import { computeOccupancy, hasMemberConflict } from './occupancy.mjs';
import { validateStudioCapacity } from '../policies/capacity.policy.mjs';
import { validateMemberEntitlement } from '../policies/entitlement.policy.mjs';
import { validateBookingWindow, validateSlotOpen } from '../policies/booking-window.policy.mjs';
import { resolveLinkedPartner } from '../policies/partner.policy.mjs';
import { createEntry } from '../ledger/ledger.mjs';

/* ------------------------------------------------------------------ */
/* Bağlam yardımcıları                                                  */
/* ------------------------------------------------------------------ */

const get = (mapOrObj, key) =>
  mapOrObj instanceof Map ? mapOrObj.get(key) : mapOrObj?.[key];

const memberOf = (ctx, id) => get(ctx.members, id) ?? null;
const packageOf = (ctx, id) => get(ctx.packages, id) ?? null;
const ledgerOf = (ctx, id) => get(ctx.ledgers, id) ?? [];

/** Hedef seansın zaman aralığı. */
function windowOf(ctx) {
  const startsAt = toEpoch(ctx.slot.startsAt);
  return {
    startsAt,
    endsAt: ctx.slot.endsAt != null
      ? toEpoch(ctx.slot.endsAt)
      : endOf({ startsAt }, ctx.policy)
  };
}

function occupancyOf(ctx) {
  return computeOccupancy({
    appointments: ctx.appointments ?? [],
    window: windowOf(ctx),
    policy: ctx.policy,
    excludeAppointmentId: ctx.excludeAppointmentId ?? null
  });
}

/** Üyenin var olduğunu ve aktif olduğunu doğrular. */
function validateMemberActive(member, memberId) {
  if (!member) {
    return deny(ReasonCode.MEMBER_INACTIVE, {
      internalReason: `Üye bulunamadı: ${memberId}`,
      adminMessage: 'Üye kaydı bulunamadı.',
      metadata: { memberId }
    });
  }
  if (member.active !== true) {
    return deny(ReasonCode.MEMBER_INACTIVE, {
      internalReason: `Üye pasif: ${memberId}`,
      adminMessage: `${member.name ?? memberId} pasif durumda.`,
      metadata: { memberId }
    });
  }
  return allow();
}

function validateNoTimeConflict(occupancy, member, memberId) {
  if (!hasMemberConflict(occupancy, memberId)) return allow();
  return deny(ReasonCode.MEMBER_TIME_CONFLICT, {
    internalReason: `Üyenin bu aralıkta başka randevusu var: ${memberId}`,
    adminMessage: `${member?.name ?? memberId} bu saatte zaten kayıtlı.`,
    metadata: { memberId }
  });
}

/**
 * Üye, seans ve zaman penceresi kontrolleri — üç akışta da aynı.
 * Kısa devre yapar: ilk red döner.
 */
function preflight({ ctx, memberId, occupancy }) {
  const member = memberOf(ctx, memberId);

  const active = validateMemberActive(member, memberId);
  if (!active.allowed) return active;

  const open = validateSlotOpen({ slot: ctx.slot });
  if (!open.allowed) return open;

  const window = validateBookingWindow({
    sessionStartsAt: ctx.slot.startsAt, now: ctx.now, policy: ctx.policy
  });
  if (!window.allowed) return window;

  const conflict = validateNoTimeConflict(occupancy, member, memberId);
  if (!conflict.allowed) return conflict;

  return allow({ member });
}

/* ------------------------------------------------------------------ */
/* Plan üretimi                                                         */
/* ------------------------------------------------------------------ */

function buildPlan({ ctx, serviceType, bookingMode, participants, consumesEntitlement }) {
  const w = windowOf(ctx);
  const exclusive = bookingMode === BookingMode.COUPLE && ctx.policy.couple.exclusiveStudio === true;

  const appointment = {
    serviceType,
    bookingMode,
    startsAt: w.startsAt,
    endsAt: w.endsAt,
    status: AppointmentStatus.ACTIVE,
    // Münhasırlık randevuya YAZILIR. Politika sonradan değişse bile
    // geçmiş randevular kendi kurallarıyla yorumlanmaya devam eder.
    exclusiveStudio: exclusive,
    idempotencyKey: ctx.idempotencyKey ?? null,
    createdBy: ctx.actorId ?? null
  };

  const parts = participants.map(p => ({
    memberId: p.memberId,
    participantRole: p.role,
    attendanceStatus: AttendanceStatus.SCHEDULED
  }));

  const ledgerEntries = consumesEntitlement
    ? participants.map(p => createEntry({
        type: LedgerEventType.BOOKING_RESERVED,
        memberId: p.memberId,
        memberPackageId: packageOf(ctx, p.memberId)?.id ?? null,
        sessionStartsAt: w.startsAt,
        recordedAt: toEpoch(ctx.now),
        actorId: ctx.actorId ?? null,
        reason: 'Randevu oluşturuldu'
      }))
    : [];

  return { appointment, participants: parts, ledgerEntries };
}

/* ------------------------------------------------------------------ */
/* Tek kişilik EMS                                                      */
/* ------------------------------------------------------------------ */

export function canBookSingleEMS({ memberId, ctx }) {
  const occupancy = occupancyOf(ctx);

  const pre = preflight({ ctx, memberId, occupancy });
  if (!pre.allowed) return pre;

  const capacity = validateStudioCapacity({
    occupancy,
    serviceType: ServiceType.EMS,
    bookingMode: BookingMode.SINGLE,
    policy: ctx.policy
  });
  if (!capacity.allowed) return capacity;

  const entitlement = validateMemberEntitlement({
    member: memberOf(ctx, memberId),
    memberPackage: packageOf(ctx, memberId),
    ledger: ledgerOf(ctx, memberId),
    sessionStartsAt: ctx.slot.startsAt,
    policy: ctx.policy
  });
  if (!entitlement.allowed) return entitlement;

  return allow({
    ...entitlement.metadata,
    occupancy: { ems: occupancy.emsPeople, fitness: occupancy.fitnessPeople },
    plan: buildPlan({
      ctx,
      serviceType: ServiceType.EMS,
      bookingMode: BookingMode.SINGLE,
      participants: [{ memberId, role: ParticipantRole.PRIMARY }],
      consumesEntitlement: true
    })
  });
}

/* ------------------------------------------------------------------ */
/* Çift EMS — münhasır stüdyo seansı                                    */
/* ------------------------------------------------------------------ */

export function canBookCoupleEMS({ initiatorMemberId, ctx }) {
  const occupancy = occupancyOf(ctx);

  // 1) Başlatan üye
  const pre = preflight({ ctx, memberId: initiatorMemberId, occupancy });
  if (!pre.allowed) return pre;

  // 2) Partner çözümlemesi — üye serbestçe kişi seçemez (v0.5 §6)
  const resolved = resolveLinkedPartner({
    memberId: initiatorMemberId,
    links: ctx.links ?? [],
    members: ctx.members
  });
  if (!resolved.allowed) return resolved;

  const partnerId = resolved.metadata.partnerId;
  const partner = resolved.metadata.partner;

  // 3) Partnerin zaman çakışması — çiftin tamamını reddeder
  const partnerConflict = validateNoTimeConflict(occupancy, partner, partnerId);
  if (!partnerConflict.allowed) {
    return deny(ReasonCode.MEMBER_TIME_CONFLICT, {
      internalReason: `Partnerin bu aralıkta randevusu var: ${partnerId}`,
      adminMessage: `${partner.name ?? partnerId} bu saatte zaten kayıtlı; çift seansı açılamaz.`,
      metadata: { memberId: partnerId, blockedBy: 'PARTNER' }
    });
  }

  // 4) Münhasırlık ve kapasite (v0.5 §5, §12)
  const capacity = validateStudioCapacity({
    occupancy,
    serviceType: ServiceType.EMS,
    bookingMode: BookingMode.COUPLE,
    policy: ctx.policy
  });
  if (!capacity.allowed) return capacity;

  // 5) İki üyenin hakkı AYRI AYRI kontrol edilir (v0.5 §8).
  //    Biri geçemezse çiftin tamamı reddedilir — kısmi rezervasyon yok.
  const participants = [
    { memberId: initiatorMemberId, role: ParticipantRole.PRIMARY },
    { memberId: partnerId, role: ParticipantRole.PARTNER }
  ];

  for (const p of participants) {
    const r = validateMemberEntitlement({
      member: memberOf(ctx, p.memberId),
      memberPackage: packageOf(ctx, p.memberId),
      ledger: ledgerOf(ctx, p.memberId),
      sessionStartsAt: ctx.slot.startsAt,
      policy: ctx.policy
    });
    if (!r.allowed) {
      // Partner takılırsa sebep, üyeye "partnerin uygun değil" diye döner;
      // ayrıntı yöneticide kalır (v0.5 §17).
      if (p.role === ParticipantRole.PARTNER) {
        return deny(ReasonCode.PARTNER_NOT_ELIGIBLE, {
          internalReason: `Partner hak kontrolünden geçemedi: ${r.reasonCode} (${r.internalReason})`,
          adminMessage: r.adminMessage,
          overridable: r.overridable,
          metadata: { ...r.metadata, partnerId, underlyingReasonCode: r.reasonCode }
        });
      }
      return r;
    }
  }

  return allow({
    partnerId,
    exclusive: ctx.policy.couple.exclusiveStudio === true,
    plan: buildPlan({
      ctx,
      serviceType: ServiceType.EMS,
      bookingMode: BookingMode.COUPLE,
      participants,
      consumesEntitlement: true
    })
  });
}

/* ------------------------------------------------------------------ */
/* Fitness — EMS hak sisteminden tamamen bağımsız                       */
/* ------------------------------------------------------------------ */

export function canBookFitness({ memberId, ctx }) {
  const occupancy = occupancyOf(ctx);

  const pre = preflight({ ctx, memberId, occupancy });
  if (!pre.allowed) return pre;

  const capacity = validateStudioCapacity({
    occupancy,
    serviceType: ServiceType.FITNESS,
    bookingMode: BookingMode.SINGLE,
    policy: ctx.policy
  });
  if (!capacity.allowed) return capacity;

  // Bilerek: validateMemberEntitlement çağrılmaz ve defter kaydı üretilmez.
  // v0.5 §15 — Fitness EMS kredisi tüketmez, haftalık limiti etkilemez.
  return allow({
    occupancy: { ems: occupancy.emsPeople, fitness: occupancy.fitnessPeople },
    plan: buildPlan({
      ctx,
      serviceType: ServiceType.FITNESS,
      bookingMode: BookingMode.SINGLE,
      participants: [{ memberId, role: ParticipantRole.PRIMARY }],
      consumesEntitlement: false
    })
  });
}

/* ------------------------------------------------------------------ */
/* Tek giriş noktası                                                    */
/* ------------------------------------------------------------------ */

export function canBook({ memberId, serviceType, bookingMode = BookingMode.SINGLE, ctx }) {
  if (serviceType === ServiceType.FITNESS) {
    if (bookingMode === BookingMode.COUPLE) {
      throw new Error('Fitness için çift modu tanımlı değil (v0.5 §3)');
    }
    return canBookFitness({ memberId, ctx });
  }
  return bookingMode === BookingMode.COUPLE
    ? canBookCoupleEMS({ initiatorMemberId: memberId, ctx })
    : canBookSingleEMS({ memberId, ctx });
}

/**
 * Taşıma. v0.5 §21 — hedef seans için tüm doğrulama yeniden çalışır.
 * Taşınan randevunun kendisi doluluk hesabından çıkarılır; aksi hâlde
 * randevu kendi kendisiyle çakışırdı.
 */
export function validateReschedule({ appointment, targetSlot, ctx }) {
  const moved = {
    ...ctx,
    slot: targetSlot,
    excludeAppointmentId: appointment.id
  };

  const primary = (appointment.participants ?? [])
    .find(p => p.participantRole === ParticipantRole.PRIMARY)
    ?? appointment.participants?.[0];

  if (!primary) {
    return deny(ReasonCode.MEMBER_INACTIVE, {
      internalReason: 'Randevuda katılımcı yok',
      adminMessage: 'Bu randevunun katılımcısı bulunamadı.'
    });
  }

  return canBook({
    memberId: primary.memberId,
    serviceType: appointment.serviceType,
    bookingMode: appointment.bookingMode,
    ctx: moved
  });
}
