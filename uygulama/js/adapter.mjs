/* Orka EMS Fitness — domain ↔ demo deposu köprüsü

   TEK SORUMLULUĞU: demo deposundaki veriyi domain motorunun beklediği
   bağlama çevirmek ve motorun kararını geri vermek.

   Burada ve arayüzde HİÇBİR iş kuralı yoktur. Kapasite, hak, münhasırlık,
   partner uygunluğu, randevu penceresi ve iptal kuralları yalnızca
   domain/ altında yaşar (v0.5 §23). */

import {
  DEMO_POLICY, ServiceType, BookingMode, Actor,
  canBookSingleEMS, canBookCoupleEMS, canBookFitness,
  validateCancellation, convertCoupleToSingle, recordLateCancel, validateReschedule,
  resolveLinkedPartner, entitlementSummary,
  slotsForDate, isOpenOn, bookableDays,
  computeOccupancy, isExclusive
} from '../../domain/index.mjs';
import * as Store from './store.mjs';

export const POLICY = DEMO_POLICY;

/** Demo deposunu domain bağlamına çevirir. */
export function ctx(extra = {}) {
  const s = Store.get();
  return {
    now: Date.now(),
    policy: POLICY,
    members: s.members,
    packages: Object.fromEntries(Object.entries(s.packages)),
    ledgers: s.ledgers,
    links: s.links,
    appointments: s.appointments,
    slot: { startsAt: Date.now() },
    ...extra
  };
}

/** Belirli bir saat için bağlam — kapalı seans bilgisi de eklenir. */
function slotCtx(startsAt, extra = {}) {
  const c = Store.closureAt(startsAt);
  return ctx({
    slot: { startsAt, closed: !!c, closedReason: c?.reason ?? null },
    ...extra
  });
}

/* ------------------------------------------------------------------ */
/* Randevu alma                                                         */
/* ------------------------------------------------------------------ */

/** Servis ve moda göre doğru motor fonksiyonunu çağırır. */
export function check({ memberId, serviceType, bookingMode, startsAt }) {
  const c = slotCtx(startsAt);
  if (serviceType === ServiceType.FITNESS) return canBookFitness({ memberId, ctx: c });
  return bookingMode === BookingMode.COUPLE
    ? canBookCoupleEMS({ initiatorMemberId: memberId, ctx: c })
    : canBookSingleEMS({ memberId, ctx: c });
}

/** Doğrular ve izin verilirse planı tek blokta uygular. */
export function book({ memberId, serviceType, bookingMode, startsAt, actorRole = 'MEMBER' }) {
  const r = check({ memberId, serviceType, bookingMode, startsAt });
  if (!r.allowed) return { ok: false, result: r };

  const memberIds = r.metadata.plan.participants.map(p => p.memberId);
  const appt = Store.applyPlan(r.metadata.plan, {
    type: 'BOOK_APPOINTMENT',
    startsAt, serviceType, bookingMode, actorRole, memberIds,
    memberNames: memberIds.map(id => Store.member(id)?.name.split(' ')[0]).filter(Boolean)
  });
  return { ok: true, result: r, appointment: appt };
}

/**
 * Bir günün saat ızgarası. Her saat için motora sorulur; arayüz yalnızca
 * "uygun / dolu / kapalı" görür (v0.5 §17). Ham sebep kodu üyeye gitmez.
 */
export function daySlots({ memberId, serviceType, bookingMode, dayStartsAt }) {
  const now = Date.now();
  return slotsForDate(dayStartsAt, POLICY).map(startsAt => {
    const r = check({ memberId, serviceType, bookingMode, startsAt });
    const closed = !!Store.closureAt(startsAt);
    const past = startsAt < now;
    return {
      startsAt,
      allowed: r.allowed,
      state: r.allowed ? 'UYGUN' : (closed ? 'KAPALI' : past ? 'GEÇTİ' : 'DOLU'),
      reasonCode: r.reasonCode,
      memberMessage: r.memberMessage,
      adminMessage: r.adminMessage
    };
  });
}

export const days = () => bookableDays(Date.now(), POLICY);
export const dayOpen = (d) => isOpenOn(d, POLICY);
export const slotsOfDay = (d) => slotsForDate(d, POLICY);

/* ------------------------------------------------------------------ */
/* Partner ve kullanım özeti                                            */
/* ------------------------------------------------------------------ */

export function partner(memberId) {
  const s = Store.get();
  const r = resolveLinkedPartner({ memberId, links: s.links, members: s.members });
  return r.allowed ? r.metadata.partner : null;
}

/** "Bu hafta 1/2 · Paket 5/8" için. EMS paketi yoksa null. */
export function usage(memberId) {
  const s = Store.get();
  const pkg = s.packages[memberId];
  if (!pkg) return null;
  return entitlementSummary({
    memberPackage: pkg, ledger: s.ledgers[memberId] ?? [], at: Date.now(), policy: POLICY
  });
}

/* ------------------------------------------------------------------ */
/* İptal ve yönetici işlemleri                                          */
/* ------------------------------------------------------------------ */

export function checkCancel({ appointment, memberId, actor = Actor.MEMBER }) {
  return validateCancellation({
    appointment, requestedByMemberId: memberId, actor,
    ctx: slotCtx(appointment.startsAt)
  });
}

export function cancel({ appointment, memberId, actor = Actor.MEMBER }) {
  const r = checkCancel({ appointment, memberId, actor });
  if (!r.allowed) return { ok: false, result: r };
  Store.applyPlan(r.metadata.plan, {
    type: 'CANCEL_APPOINTMENT',
    appointmentId: appointment.id,
    startsAt: appointment.startsAt,
    serviceType: appointment.serviceType,
    bookingMode: appointment.bookingMode,
    actorRole: actor,
    // Yönetici iptalinde üyeye bildirim gider; üye kendi iptalinde gitmez.
    memberIds: actor === Actor.ADMIN ? appointment.participants.map(p => p.memberId) : []
  });
  return { ok: true, result: r };
}

export function coupleToSingle({ appointment, removeMemberId }) {
  const r = convertCoupleToSingle({
    appointment, removeMemberId, ctx: slotCtx(appointment.startsAt)
  });
  if (!r.allowed) return { ok: false, result: r };
  Store.applyPlan(r.metadata.plan, {
    type: 'COUPLE_TO_SINGLE', appointmentId: appointment.id, removeMemberId
  });
  return { ok: true, result: r };
}

export function lateCancel({ appointment, memberId }) {
  const r = recordLateCancel({ appointment, memberId, ctx: slotCtx(appointment.startsAt) });
  if (!r.allowed) return { ok: false, result: r };
  Store.applyPlan(r.metadata.plan, {
    type: 'RECORD_LATE_CANCEL', appointmentId: appointment.id, memberId
  });
  return { ok: true, result: r };
}

/** Taşıma doğrulaması — sürükle-bırak ve yapıştır AYNI yolu kullanır. */
export function checkMove({ appointment, targetStartsAt }) {
  const c = Store.closureAt(targetStartsAt);
  return validateReschedule({
    appointment,
    targetSlot: { startsAt: targetStartsAt, closed: !!c, closedReason: c?.reason ?? null },
    ctx: ctx()
  });
}

export function move({ appointment, targetStartsAt }) {
  const r = checkMove({ appointment, targetStartsAt });
  if (!r.allowed) return { ok: false, result: r };
  Store.moveAppointment(appointment.id, targetStartsAt);
  return { ok: true, result: r };
}

/* ------------------------------------------------------------------ */
/* Yönetici takvimi                                                     */
/* ------------------------------------------------------------------ */

export function occupancyAt(startsAt) {
  return computeOccupancy({
    appointments: Store.get().appointments,
    window: { startsAt },
    policy: POLICY
  });
}

export const exclusive = (appt) => isExclusive(appt, POLICY);
