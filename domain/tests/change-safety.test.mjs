/* v0.5 §0, §24 — iş kuralı değişikliği ucuz olmalı

   Bu dosyanın amacı davranışı doğrulamak değil, DEĞİŞTİRİLEBİLİRLİĞİ kanıtlamak.
   Her test bir kuralı yalnızca politika yamasıyla değiştirir; motor koduna
   dokunulmaz. Yarın işletme sahibi bir sayı değiştirdiğinde yapılacak iş
   burada görünen kadardır. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceType, BookingMode, CycleStrategy, BucketStrategy, ReasonCode,
  DEFAULT_POLICY, withPolicy,
  canBookSingleEMS, canBookFitness, canBookCoupleEMS, resolveBucket
} from '../index.mjs';
import { soloWorld, coupleWorld, makeWorld, PACKAGE_START, SLOT } from './_fixtures.mjs';

test('EMS kapasitesi 3 → 4 yapılabilir', () => {
  const base = soloWorld().fill(ServiceType.EMS, 3);
  assert.equal(canBookSingleEMS({ memberId: 'ahmet', ctx: base.ctx() }).reasonCode,
    ReasonCode.EMS_CAPACITY_FULL);

  const policy = withPolicy({ capacity: { ems: 4, total: 5 } });
  const relaxed = soloWorld({ policy }).fill(ServiceType.EMS, 3);
  assert.equal(canBookSingleEMS({ memberId: 'ahmet', ctx: relaxed.ctx() }).allowed, true);
});

test('Fitness kapasitesi 2 → 1 yapılabilir', () => {
  const policy = withPolicy({ capacity: { fitness: 1 } });
  const w = soloWorld({ policy }).fill(ServiceType.FITNESS, 1);
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.reasonCode, ReasonCode.FITNESS_CAPACITY_FULL);
});

test('toplam kapasite 4 → 5 yapılabilir', () => {
  const world = (policy) => makeWorld({ policy })
    .member('ahmet').pkg('ahmet')
    .fill(ServiceType.EMS, 3, undefined, 'e')
    .fill(ServiceType.FITNESS, 1, undefined, 'f');

  assert.equal(canBookFitness({ memberId: 'ahmet', ctx: world(DEFAULT_POLICY).ctx() }).reasonCode,
    ReasonCode.STUDIO_CAPACITY_FULL);

  const policy = withPolicy({ capacity: { total: 5 } });
  assert.equal(canBookFitness({ memberId: 'ahmet', ctx: world(policy).ctx() }).allowed, true);
});

test('çift münhasırlığı kapatılabilir — çift 2 EMS koltuğuna dönüşür', () => {
  const policy = withPolicy({ couple: { exclusiveStudio: false, requiresEmptySlot: false } });

  // Münhasırlık kapalıyken 1 kişilik dolu seansa çift girebilir (2+1 = 3 ≤ 3)
  const w = coupleWorld({ policy }).fill(ServiceType.EMS, 1);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
  assert.equal(r.metadata.plan.appointment.exclusiveStudio, false);

  // Ama kapasite hâlâ geçerli: 2 kişi varken çift (2 koltuk) sığmaz
  const full = coupleWorld({ policy }).fill(ServiceType.EMS, 2);
  assert.equal(canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: full.ctx() }).reasonCode,
    ReasonCode.EMS_CAPACITY_FULL);
});

test('"boş seans şartı" tek başına gevşetilebilir', () => {
  const policy = withPolicy({ couple: { requiresEmptySlot: false } });
  const w = coupleWorld({ policy }).fill(ServiceType.EMS, 1);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
  // Münhasırlık açık kaldığı için randevu yine stüdyoyu kapatır
  assert.equal(r.metadata.plan.appointment.exclusiveStudio, true);
});

test('paket kredisi 8 → 4 indirilebilir', () => {
  const days = [0, 1, 7, 8];                       // iki kova, ikisi de dolu
  const target = { slot: { startsAt: Date.parse('2026-09-15T10:00:00+03:00') },
                   now: Date.parse('2026-09-14T09:00:00+03:00') };

  const base = soloWorld();
  for (const d of days) base.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  assert.equal(canBookSingleEMS({ memberId: 'ahmet', ctx: base.ctx(target) }).allowed, true);

  const policy = withPolicy({ entitlement: { totalCredits: 4 } });
  const tight = soloWorld({ policy });
  for (const d of days) tight.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: tight.ctx({ ...target, policy }) });
  assert.equal(r.reasonCode, ReasonCode.PACKAGE_EXHAUSTED);
});

test('8 kredi · 28 gün · haftada 2 birbirini tam doyurur — kredi tek başına artırılamaz', () => {
  // 4 kova × kova başına 2 = 8. Kredi 12'ye çıkarılsa bile fazlası kullanılamaz;
  // bağlayıcı kısıt haftalık limittir. İşletme sahibine sorulacak konu.
  const policy = withPolicy({ entitlement: { totalCredits: 12 } });
  const w = soloWorld({ policy });
  for (const d of [0, 1, 7, 8, 14, 15, 21, 22]) {
    w.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  }
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: Date.parse('2026-09-24T10:00:00+03:00') },
                 now: Date.parse('2026-09-20T09:00:00+03:00'), policy })
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.WEEKLY_LIMIT_REACHED);

  // Haftalık limit de artırılırsa fazladan kredi kullanılabilir hâle gelir.
  const both = withPolicy({ entitlement: { totalCredits: 12, maxPerBucket: 3 } });
  const w2 = soloWorld({ policy: both });
  for (const d of [0, 1, 7, 8, 14, 15, 21, 22]) {
    w2.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  }
  const r2 = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w2.ctx({ slot: { startsAt: Date.parse('2026-09-24T10:00:00+03:00') },
                  now: Date.parse('2026-09-20T09:00:00+03:00'), policy: both })
  });
  assert.equal(r2.allowed, true, r2.internalReason);
});

test('haftalık limit 2 → 3 yapılabilir', () => {
  const policy = withPolicy({ entitlement: { maxPerBucket: 3 } });
  const w = soloWorld({ policy })
    .reserve('ahmet', Date.parse(SLOT))
    .reserve('ahmet', Date.parse('2026-09-05T10:00:00+03:00'));
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: Date.parse('2026-09-06T10:00:00+03:00') }, policy })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('kova stratejisi 7 günlük paket kovasından takvim haftasına çevrilebilir', () => {
  const pkg = { id: 'p1', startsAt: Date.parse(PACKAGE_START) };

  const a = resolveBucket(pkg, Date.parse(SLOT), DEFAULT_POLICY);
  assert.equal(a.strategy, BucketStrategy.PACKAGE_7_DAY_BUCKET);

  const policy = withPolicy({ entitlement: { bucketStrategy: BucketStrategy.CALENDAR_WEEK } });
  const b = resolveBucket(pkg, Date.parse(SLOT), policy);
  assert.equal(b.strategy, BucketStrategy.CALENDAR_WEEK);
  assert.notEqual(a.key, b.key);   // kimlikler karışmaz
});

test('kova stratejisi değişince hafta sınırı da değişir', () => {
  const pkg = { id: 'p1', startsAt: Date.parse(PACKAGE_START) };   // 1 Eylül 2026, Salı
  const policy = withPolicy({ entitlement: { bucketStrategy: BucketStrategy.CALENDAR_WEEK } });

  // Paket kovasında 1 ve 7 Eylül aynı kovada (0. hafta)
  const pkgA = resolveBucket(pkg, Date.parse('2026-09-01T10:00:00+03:00'), DEFAULT_POLICY);
  const pkgB = resolveBucket(pkg, Date.parse('2026-09-07T10:00:00+03:00'), DEFAULT_POLICY);
  assert.equal(pkgA.key, pkgB.key);

  // Takvim haftasında 7 Eylül Pazartesi → yeni hafta
  const calA = resolveBucket(pkg, Date.parse('2026-09-01T10:00:00+03:00'), policy);
  const calB = resolveBucket(pkg, Date.parse('2026-09-07T10:00:00+03:00'), policy);
  assert.notEqual(calA.key, calB.key);
});

test('döngü stratejisi 28 günden takvim ayına çevrilebilir', () => {
  const policy = withPolicy({ entitlement: { cycleStrategy: CycleStrategy.CALENDAR_MONTH } });
  const w = soloWorld({ policy });
  // 30 Eylül, 28 günlük döngüde dışarıda kalırdı; takvim ayında içeride
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: Date.parse('2026-09-30T10:00:00+03:00') },
                 now: Date.parse('2026-09-20T09:00:00+03:00'), policy })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('iptal süresi 24 → 12 saate indirilebilir', () => {
  const policy = withPolicy({ cancellation: { ems: { cutoffHours: 12 } } });
  assert.equal(policy.cancellation.ems.cutoffHours, 12);
  assert.equal(policy.cancellation.ems.allowancePerCycle, 1);   // diğer alanlar korunur
});

test('randevu ufku ve kapanış süresi ayarlanabilir', () => {
  const policy = withPolicy({ bookingWindow: { horizonDays: 30, cutoffMinutesBeforeStart: 30 } });
  const w = soloWorld({ policy });
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: Date.parse('2026-09-20T10:00:00+03:00') }, policy })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('geç iptalde yerin açılması tek satırla değiştirilebilir', () => {
  const policy = withPolicy({
    occupancy: { releasingStatuses: ['MEMBER_CANCELLED', 'ADMIN_CANCELLED', 'LATE_CANCEL'] }
  });
  const w = makeWorld({ policy }).member('ahmet').pkg('ahmet');
  for (const m of ['x0', 'x1', 'x2']) { w.member(m); w.booking({ service: ServiceType.EMS, memberIds: [m] }); }
  w.appointments[2].participants[0].attendanceStatus = 'LATE_CANCEL';

  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('withPolicy varsayılanı değiştirmez', () => {
  withPolicy({ capacity: { ems: 99 } });
  assert.equal(DEFAULT_POLICY.capacity.ems, 3);
});

test('varsayılan politika donmuştur', () => {
  assert.throws(() => { DEFAULT_POLICY.capacity.ems = 9; }, TypeError);
});
