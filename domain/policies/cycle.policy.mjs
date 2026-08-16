/* Orka EMS Fitness — paket döngüsü ve haftalık kova hesabı
   Kaynak: v0.5 §9

   Bugünkü çalışan model: 28 günlük döngü, dört adet 7 günlük kova, kova başına 2 seans.
   Ama bu bir strateji seçimi — işletme yarın takvim ayına geçmek isterse
   yalnızca policy.entitlement.cycleStrategy değişir, motorun geri kalanı durur.

   Bu dosya v0.5 §24'ün "package cycle strategy değiştirilebilir bir boundary'de"
   maddesinin karşılığıdır. */

import { CycleStrategy, BucketStrategy } from '../core/types.mjs';
import {
  DAY, toEpoch, addDays,
  startOfLocalDay, startOfLocalWeek, startOfLocalMonth, startOfNextLocalMonth
} from '../core/time.mjs';

/**
 * Paketin geçerli olduğu dönem aralığı.
 * @returns {{ startsAt:number, endsAt:number, strategy:string }}
 *          endsAt hariç tutulur (yarı açık aralık).
 */
export function resolveCycle(memberPackage, policy, at = memberPackage.startsAt) {
  const off = policy.locale.timezoneOffsetMinutes;
  const cfg = policy.entitlement;
  const packStart = startOfLocalDay(memberPackage.startsAt, off);

  switch (cfg.cycleStrategy) {
    case CycleStrategy.FIXED_28_DAY:
      return {
        strategy: cfg.cycleStrategy,
        startsAt: packStart,
        endsAt: addDays(packStart, cfg.cycleDays)
      };

    case CycleStrategy.CALENDAR_MONTH: {
      // Dönem, paketin içinde bulunduğu takvim ayıdır.
      const ref = toEpoch(at);
      return {
        strategy: cfg.cycleStrategy,
        startsAt: startOfLocalMonth(ref, off),
        endsAt: startOfNextLocalMonth(ref, off)
      };
    }

    default:
      throw new Error(`Bilinmeyen cycleStrategy: ${cfg.cycleStrategy}`);
  }
}

/** Seans, paketin dönemi içinde mi? */
export function isWithinCycle(memberPackage, sessionStartsAt, policy) {
  const t = toEpoch(sessionStartsAt);
  const cycle = resolveCycle(memberPackage, policy, t);
  return t >= cycle.startsAt && t < cycle.endsAt;
}

/**
 * Seansın hangi haftalık kovaya düştüğü.
 * Kova kimliği metindir; farklı stratejiler farklı kimlik üretir ve
 * yanlışlıkla karışmaları mümkün olmaz.
 *
 * @returns {{ key:string, index:number, startsAt:number, endsAt:number, strategy:string }}
 */
export function resolveBucket(memberPackage, sessionStartsAt, policy) {
  const off = policy.locale.timezoneOffsetMinutes;
  const cfg = policy.entitlement;
  const t = toEpoch(sessionStartsAt);

  switch (cfg.bucketStrategy) {
    case BucketStrategy.PACKAGE_7_DAY_BUCKET: {
      // Kovalar paketin başlangıç gününden itibaren sayılır.
      const packStart = startOfLocalDay(memberPackage.startsAt, off);
      const index = Math.floor((t - packStart) / (cfg.bucketDays * DAY));
      const startsAt = packStart + index * cfg.bucketDays * DAY;
      return {
        strategy: cfg.bucketStrategy,
        key: `${memberPackage.id}:pkg7:${index}`,
        index,
        startsAt,
        endsAt: startsAt + cfg.bucketDays * DAY
      };
    }

    case BucketStrategy.CALENDAR_WEEK: {
      // Kovalar takvim haftasıdır; paketin başlangıcından bağımsız.
      const startsAt = startOfLocalWeek(t, off, policy.locale.weekStartsOn);
      const index = Math.round(startsAt / DAY);
      return {
        strategy: cfg.bucketStrategy,
        key: `cal:${startsAt}`,
        index,
        startsAt,
        endsAt: startsAt + 7 * DAY
      };
    }

    default:
      throw new Error(`Bilinmeyen bucketStrategy: ${cfg.bucketStrategy}`);
  }
}
