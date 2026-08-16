/* Orka EMS Fitness — zaman yardımcıları

   Tasarım kararı: her şey mutlak an (epoch ms) üzerinden hesaplanır.
   Takvim anlamı gereken yerlerde (ayın başı, haftanın pazartesisi) sabit bir
   saat dilimi kayması kullanılır.

   Türkiye 2016'dan beri kalıcı UTC+3'te ve yaz saati uygulamıyor. Bu yüzden
   sabit kayma burada doğru sonuç verir; yaz saati geçişi diye bir kenar durum yok.
   Kayma yine de politika değeri — ileride değişirse tek yerden güncellenir. */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Girdiyi epoch ms'e çevirir. Date, ISO metni ve sayı kabul eder. */
export function toEpoch(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    if (Number.isNaN(t)) throw new Error(`Geçersiz tarih: ${value}`);
    return t;
  }
  throw new Error(`Desteklenmeyen tarih türü: ${typeof value}`);
}

export const toISO = (value) => new Date(toEpoch(value)).toISOString();

/** İki zaman aralığı kesişiyor mu? Uç uca değen aralıklar kesişmez. */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return toEpoch(aStart) < toEpoch(bEnd) && toEpoch(aEnd) > toEpoch(bStart);
}

/** Yerel (stüdyo saati) gün başlangıcı — mutlak an olarak. */
export function startOfLocalDay(value, offsetMinutes) {
  const shifted = toEpoch(value) + offsetMinutes * MINUTE;
  return Math.floor(shifted / DAY) * DAY - offsetMinutes * MINUTE;
}

/** Yerel haftanın başlangıcı. weekStartsOn: 0=Pazar, 1=Pazartesi. */
export function startOfLocalWeek(value, offsetMinutes, weekStartsOn = 1) {
  const dayStart = startOfLocalDay(value, offsetMinutes);
  const dow = new Date(dayStart + offsetMinutes * MINUTE).getUTCDay();
  const back = (dow - weekStartsOn + 7) % 7;
  return dayStart - back * DAY;
}

/** Yerel ayın başlangıcı. */
export function startOfLocalMonth(value, offsetMinutes) {
  const d = new Date(toEpoch(value) + offsetMinutes * MINUTE);
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  return first - offsetMinutes * MINUTE;
}

/** Bir sonraki yerel ayın başlangıcı. */
export function startOfNextLocalMonth(value, offsetMinutes) {
  const d = new Date(toEpoch(value) + offsetMinutes * MINUTE);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return next - offsetMinutes * MINUTE;
}

export const addDays = (value, n) => toEpoch(value) + n * DAY;
export const hoursBetween = (from, to) => (toEpoch(to) - toEpoch(from)) / HOUR;
export const minutesBetween = (from, to) => (toEpoch(to) - toEpoch(from)) / MINUTE;

/** Randevunun bitiş anı. Süre randevuda yoksa politikadan alınır. */
export function endOf(appointment, policy) {
  if (appointment.endsAt != null) return toEpoch(appointment.endsAt);
  return toEpoch(appointment.startsAt) + policy.session.durationMinutes * MINUTE;
}
