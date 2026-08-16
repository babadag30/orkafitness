/* Orka EMS Fitness — randevu penceresi
   Kaynak: v0.5 §16 — PROVISIONAL: ufuk 14 gün, kapanış seanstan 2 saat önce */

import { allow, deny, ReasonCode } from '../core/result.mjs';
import { toEpoch, minutesBetween, DAY } from '../core/time.mjs';

/**
 * Seans, randevu alınabilir zaman aralığında mı?
 *
 * @param {object} p
 * @param {number|string|Date} p.sessionStartsAt
 * @param {number|string|Date} p.now
 * @param {object} p.policy
 */
export function validateBookingWindow({ sessionStartsAt, now, policy }) {
  const start = toEpoch(sessionStartsAt);
  const t = toEpoch(now);
  const cfg = policy.bookingWindow;

  const minutesLeft = minutesBetween(t, start);
  if (minutesLeft < cfg.cutoffMinutesBeforeStart) {
    return deny(ReasonCode.BOOKING_TOO_LATE, {
      internalReason:
        `Seansa ${Math.round(minutesLeft)} dk kaldı, sınır ${cfg.cutoffMinutesBeforeStart} dk`,
      adminMessage:
        `Randevu penceresi kapandı: seansa ${Math.round(minutesLeft)} dakika kaldı (sınır ${cfg.cutoffMinutesBeforeStart} dk).`,
      metadata: { minutesLeft, cutoffMinutes: cfg.cutoffMinutesBeforeStart }
    });
  }

  const horizonEnd = t + cfg.horizonDays * DAY;
  if (start > horizonEnd) {
    return deny(ReasonCode.BOOKING_TOO_EARLY, {
      internalReason: `Seans ufkun ötesinde (ufuk ${cfg.horizonDays} gün)`,
      adminMessage: `Bu tarih ${cfg.horizonDays} günlük randevu ufkunun dışında.`,
      metadata: { horizonDays: cfg.horizonDays, horizonEndsAt: horizonEnd }
    });
  }

  return allow({ minutesLeft });
}

/** Seans yönetici tarafından kapatılmış mı? */
export function validateSlotOpen({ slot }) {
  if (slot?.closed === true) {
    return deny(ReasonCode.SLOT_CLOSED, {
      internalReason: `Seans kapalı: ${slot.closedReason ?? 'sebep belirtilmemiş'}`,
      adminMessage: `Bu seans kapatılmış${slot.closedReason ? ` — ${slot.closedReason}` : ''}.`,
      metadata: { closedReason: slot.closedReason ?? null }
    });
  }
  return allow();
}
