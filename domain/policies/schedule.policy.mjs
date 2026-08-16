/* Orka EMS Fitness — çalışma saatleri ve seans ızgarası
   Kaynak: v0.5 §16, eski PRD §4

   DEMO/PROVISIONAL: Pzt–Cmt 08:00–23:30, Paz 10:00–22:00.
   25 dk seans + 5 dk tampon = 30 dk kadans.

   Bu değerler policy.schedule altında; işletme sahibi yarın saatleri
   değiştirirse motorun geri kalanına dokunulmaz. */

import { DAY, MINUTE, startOfLocalDay, toEpoch } from '../core/time.mjs';

/** Yerel gün numarası (0 = Pazar). */
function localDayOfWeek(value, offsetMinutes) {
  return new Date(toEpoch(value) + offsetMinutes * MINUTE).getUTCDay();
}

/** Verilen günün çalışma penceresi. Kapalıysa null. */
export function hoursForDate(dateValue, policy) {
  const off = policy.locale.timezoneOffsetMinutes;
  const cfg = policy.schedule.hours[localDayOfWeek(dateValue, off)];
  return cfg && cfg.open && cfg.close ? cfg : null;
}

const hhmmToMin = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};

export const minToHHMM = (min) =>
  String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

/**
 * Bir günün seans başlangıçları — mutlak an listesi.
 * Son seansın bitişi kapanışı geçemez.
 */
export function slotsForDate(dateValue, policy) {
  const cfg = hoursForDate(dateValue, policy);
  if (!cfg) return [];

  const off = policy.locale.timezoneOffsetMinutes;
  const dayStart = startOfLocalDay(dateValue, off);
  const open = hhmmToMin(cfg.open);
  const close = hhmmToMin(cfg.close);
  const duration = policy.session.durationMinutes;
  const cadence = duration + policy.session.bufferMinutes;

  const out = [];
  for (let t = open; t + duration <= close; t += cadence) {
    out.push(dayStart + t * MINUTE);
  }
  return out;
}

/** Stüdyo o gün açık mı? */
export const isOpenOn = (dateValue, policy) => slotsForDate(dateValue, policy).length > 0;

/** Randevu ufkundaki günler — takvim ekranı bunu kullanır. */
export function bookableDays(now, policy) {
  const off = policy.locale.timezoneOffsetMinutes;
  const start = startOfLocalDay(now, off);
  const out = [];
  for (let i = 0; i <= policy.bookingWindow.horizonDays; i++) {
    const d = start + i * DAY;
    out.push({ startsAt: d, open: isOpenOn(d, policy) });
  }
  return out;
}
