/* Orka EMS Fitness — seans doluluğu
   Kaynak: v0.5 §4 (kapasite), §5 (çift münhasırlığı), §12 (çapraz servis politikası)

   Doluluk, randevu listesinden türetilir. Hiçbir yerde "şu saatte kaç kişi var"
   diye ayrıca tutulan bir sayaç yok; sayaç tutmak, iptal/taşıma sonrası
   tutarsızlığın en yaygın kaynağıdır.

   Kesişim (overlap) ile çalışır, tam saat eşitliğiyle değil. Bu, v0.5 §25'teki
   "Fitness seans süresi farklı olabilir" açık kararına şimdiden hazırlıklı olmayı sağlar. */

import { ServiceType, BookingMode, AppointmentStatus } from '../core/types.mjs';
import { overlaps, toEpoch, endOf } from '../core/time.mjs';

/** Randevu münhasır mı? Kayıtta yazılıysa ona, yoksa moda ve politikaya bakılır. */
export function isExclusive(appointment, policy) {
  if (typeof appointment.exclusiveStudio === 'boolean') return appointment.exclusiveStudio;
  return appointment.bookingMode === BookingMode.COUPLE && policy.couple.exclusiveStudio === true;
}

/** Katılımcı hâlâ yer tutuyor mu? */
export function occupiesSeat(participant, policy) {
  return !policy.occupancy.releasingStatuses.includes(participant.attendanceStatus);
}

/**
 * Verilen zaman aralığıyla kesişen doluluk tablosu.
 *
 * @param {object} p
 * @param {Array} p.appointments randevular (katılımcılarıyla birlikte)
 * @param {object} p.window { startsAt, endsAt }
 * @param {object} p.policy
 * @param {string} [p.excludeAppointmentId] taşıma sırasında randevunun kendisi sayılmaz
 *
 * @returns {{
 *   emsPeople:number, fitnessPeople:number, totalPeople:number,
 *   exclusiveAppointment:object|null,
 *   memberIds:Set<string>,
 *   overlapping:Array
 * }}
 */
export function computeOccupancy({ appointments = [], window, policy, excludeAppointmentId = null }) {
  const wStart = toEpoch(window.startsAt);
  const wEnd = window.endsAt != null
    ? toEpoch(window.endsAt)
    : wStart + policy.session.durationMinutes * 60_000;

  let emsPeople = 0;
  let fitnessPeople = 0;
  let exclusiveAppointment = null;
  const memberIds = new Set();
  const overlapping = [];

  for (const appt of appointments) {
    if (appt.id != null && appt.id === excludeAppointmentId) continue;
    if (appt.status === AppointmentStatus.CANCELLED) continue;
    if (!overlaps(appt.startsAt, endOf(appt, policy), wStart, wEnd)) continue;

    const live = (appt.participants ?? []).filter(p => occupiesSeat(p, policy));
    if (live.length === 0) continue;

    overlapping.push(appt);
    for (const p of live) memberIds.add(p.memberId);

    if (appt.serviceType === ServiceType.EMS) emsPeople += live.length;
    else fitnessPeople += live.length;

    if (isExclusive(appt, policy)) exclusiveAppointment = appt;
  }

  return {
    emsPeople,
    fitnessPeople,
    totalPeople: emsPeople + fitnessPeople,
    exclusiveAppointment,
    memberIds,
    overlapping
  };
}

/** Bir üyenin bu aralıkta başka randevusu var mı? */
export function hasMemberConflict(occupancy, memberId) {
  return occupancy.memberIds.has(memberId);
}
