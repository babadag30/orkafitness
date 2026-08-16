/* İŞLETME SAHİBİ DEMOSU politikası — 17 Ağustos 2026

   Bu testler NİHAİ iş kuralını değil, demo için alınmış geçici kararları
   doğrular. Kararlar değişirse burası da değişecek; amaç davranışın
   politikadan geldiğini ve arayüze sızmadığını göstermek. */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceType, BookingMode, Actor, ReasonCode, LedgerEventType,
  AttendanceStatus, AppointmentStatus,
  DEMO_POLICY, DEFAULT_POLICY, UNRESOLVED, withPolicy,
  validateCancellation, convertCoupleToSingle, recordLateCancel,
  canBookFitness, canBookSingleEMS, projectEntitlement,
  slotsForDate, isOpenOn, bookableDays
} from '../index.mjs';
import { makeWorld, coupleWorld, soloWorld } from './_fixtures.mjs';

const NOW = Date.parse('2026-09-01T09:00:00+03:00');
const IN_48H = NOW + 48 * 3_600_000;
const IN_6H = NOW + 6 * 3_600_000;

function coupleAppt(w, startsAt = IN_48H) {
  w.booking({
    service: ServiceType.EMS, mode: BookingMode.COUPLE,
    startsAt, memberIds: ['ahmet', 'ayse']
  });
  return w.appointments.at(-1);
}

/* --- çift iptali: demo kararı --- */

test('demo politikası çift iptali kararlarını dolduruyor', () => {
  assert.equal(DEMO_POLICY.cancellation.couple.scope, 'CANCEL_WHOLE');
  assert.equal(DEMO_POLICY.cancellation.couple.allowanceCharge, 'INITIATOR_ONLY');
  assert.equal(DEMO_POLICY.cancellation.couple.adminCanConvertToSingle, true);
  // Varsayılan politika hâlâ karara bağlanmamış durumda kalmalı
  assert.equal(DEFAULT_POLICY.cancellation.couple.scope, UNRESOLVED);
});

test('geçerli çift iptali İKİ üyenin de hakkını iade eder', () => {
  const w = coupleWorld({ policy: DEMO_POLICY });
  const a = coupleAppt(w);
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.allowed, true, r.internalReason);
  assert.equal(r.metadata.plan.ledgerEntries.length, 2);
  for (const e of r.metadata.plan.ledgerEntries) {
    assert.equal(e.type, LedgerEventType.MEMBER_CANCEL_RELEASED);
    assert.equal(e.delta, +1);
  }
});

test('iptal hakkı YALNIZCA iptali başlatan üyeden düşer', () => {
  const w = coupleWorld({ policy: DEMO_POLICY });
  const a = coupleAppt(w);
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ayse',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.deepEqual(r.metadata.plan.allowanceChargedTo, ['ayse']);
});

test('çift iptali randevunun tamamını kapsar', () => {
  const w = coupleWorld({ policy: DEMO_POLICY });
  const a = coupleAppt(w);
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.metadata.scope, 'WHOLE_APPOINTMENT');
  assert.equal(r.metadata.plan.participants.length, 2);
  assert.equal(r.metadata.plan.appointment.status, AppointmentStatus.CANCELLED);
});

test('her iki partner de iptali başlatabilir', () => {
  for (const who of ['ahmet', 'ayse']) {
    const w = coupleWorld({ policy: DEMO_POLICY });
    const a = coupleAppt(w);
    const r = validateCancellation({
      appointment: a, requestedByMemberId: who,
      actor: Actor.MEMBER, ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
    });
    assert.equal(r.allowed, true, `${who}: ${r.internalReason}`);
  }
});

test('24 saat içinde çift iptali yine engellenir', () => {
  const w = coupleWorld({ policy: DEMO_POLICY });
  const a = coupleAppt(w, IN_6H);
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.reasonCode, ReasonCode.CANCEL_TOO_LATE);
});

/* --- çift → tek dönüşümü --- */

test('yönetici çifti tek kişilik seansa çevirebilir', () => {
  const w = coupleWorld({ policy: DEMO_POLICY });
  const a = coupleAppt(w);
  const r = convertCoupleToSingle({
    appointment: a, removeMemberId: 'ayse', ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.allowed, true, r.internalReason);
  assert.equal(r.metadata.remainingMemberId, 'ahmet');
  assert.equal(r.metadata.plan.appointment.bookingMode, BookingMode.SINGLE);
  assert.equal(r.metadata.plan.appointment.exclusiveStudio, false);
});

test('dönüşümde yalnızca çıkarılan üyenin hakkı iade edilir', () => {
  const w = coupleWorld({ policy: DEMO_POLICY });
  const a = coupleAppt(w);
  const r = convertCoupleToSingle({
    appointment: a, removeMemberId: 'ayse', ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.metadata.plan.ledgerEntries.length, 1);
  assert.equal(r.metadata.plan.ledgerEntries[0].memberId, 'ayse');
  assert.equal(r.metadata.plan.ledgerEntries[0].delta, +1);
  assert.deepEqual(r.metadata.plan.allowanceChargedTo, []);
});

test('dönüşüm sonrası saat normal kapasiteye döner', () => {
  const w = coupleWorld({ policy: DEMO_POLICY }).member('mert').pkg('mert');
  const a = coupleAppt(w, Date.parse('2026-09-04T10:00:00+03:00'));

  // Dönüşümden önce: münhasır, üçüncü kişi giremez
  const before = canBookSingleEMS({ memberId: 'mert', ctx: w.ctx({ now: NOW, policy: DEMO_POLICY }) });
  assert.equal(before.reasonCode, ReasonCode.EXCLUSIVE_COUPLE_CONFLICT);

  // Planı uygula
  const r = convertCoupleToSingle({
    appointment: a, removeMemberId: 'ayse', ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  a.bookingMode = r.metadata.plan.appointment.bookingMode;
  a.exclusiveStudio = r.metadata.plan.appointment.exclusiveStudio;
  a.participants = a.participants.filter(p => p.memberId !== 'ayse');

  const after = canBookSingleEMS({ memberId: 'mert', ctx: w.ctx({ now: NOW, policy: DEMO_POLICY }) });
  assert.equal(after.allowed, true, after.internalReason);
});

test('varsayılan politikada dönüşüm karara bağlanmamıştır', () => {
  const w = coupleWorld();
  const a = coupleAppt(w);
  const r = convertCoupleToSingle({ appointment: a, removeMemberId: 'ayse', ctx: w.ctx({ now: NOW }) });
  assert.equal(r.reasonCode, ReasonCode.POLICY_UNRESOLVED);
});

/* --- geç iptal: hak yanar, yer açılır --- */

test('geç iptal hakkı iade etmez', () => {
  const w = soloWorld({ policy: DEMO_POLICY }).reserve('ahmet', IN_48H);
  w.booking({ service: ServiceType.EMS, startsAt: IN_48H, memberIds: ['ahmet'] });
  const a = w.appointments.at(-1);

  const r = recordLateCancel({ appointment: a, memberId: 'ahmet', ctx: w.ctx({ now: NOW, policy: DEMO_POLICY }) });
  assert.equal(r.allowed, true);
  assert.equal(r.metadata.entitlementRestored, false);
  assert.equal(r.metadata.plan.ledgerEntries[0].type, LedgerEventType.LATE_CANCEL_CONSUMED);
  assert.equal(r.metadata.plan.ledgerEntries[0].delta, 0);

  for (const e of r.metadata.plan.ledgerEntries) w.ledgers.get('ahmet').push(e);
  const p = projectEntitlement({
    ledger: w.ledgers.get('ahmet'), memberPackage: w.packages.get('ahmet'), policy: DEMO_POLICY
  });
  assert.equal(p.remaining, 7);   // hak yandı
});

test('geç iptal fiziksel yeri açar', () => {
  const w = makeWorld({ policy: DEMO_POLICY }).member('ahmet').pkg('ahmet');
  for (const m of ['x0', 'x1', 'x2']) { w.member(m); w.booking({ service: ServiceType.EMS, memberIds: [m] }); }

  const dolu = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx({ policy: DEMO_POLICY }) });
  assert.equal(dolu.reasonCode, ReasonCode.EMS_CAPACITY_FULL);

  w.appointments[2].participants[0].attendanceStatus = AttendanceStatus.LATE_CANCEL;
  const acik = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx({ policy: DEMO_POLICY }) });
  assert.equal(acik.allowed, true, acik.internalReason);
});

test('geç iptal üyenin kendi iptal yolunu açmaz', () => {
  const w = soloWorld({ policy: DEMO_POLICY });
  w.booking({ service: ServiceType.EMS, startsAt: IN_6H, memberIds: ['ahmet'] });
  const r = validateCancellation({
    appointment: w.appointments.at(-1), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.reasonCode, ReasonCode.CANCEL_TOO_LATE);
});

/* --- Fitness erişimi --- */

test('fitnessAccess false → Fitness reddedilir', () => {
  const w = makeWorld({ policy: DEMO_POLICY }).member('deniz', { fitnessAccess: false });
  const r = canBookFitness({ memberId: 'deniz', ctx: w.ctx({ policy: DEMO_POLICY }) });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.FITNESS_ACCESS_REQUIRED);
});

test('fitnessAccess true → kapasite varsa Fitness alınabilir', () => {
  const w = makeWorld({ policy: DEMO_POLICY }).member('deniz', { fitnessAccess: true });
  const r = canBookFitness({ memberId: 'deniz', ctx: w.ctx({ policy: DEMO_POLICY }) });
  assert.equal(r.allowed, true, r.internalReason);
});

test('Fitness erişimi EMS randevusunu etkilemez', () => {
  const w = makeWorld({ policy: DEMO_POLICY }).member('deniz', { fitnessAccess: false }).pkg('deniz');
  const r = canBookSingleEMS({ memberId: 'deniz', ctx: w.ctx({ policy: DEMO_POLICY }) });
  assert.equal(r.allowed, true, r.internalReason);
});

/* --- çalışma saatleri --- */

test('Pazartesi 08:00–23:30 → 31 seans', () => {
  const pzt = Date.parse('2026-08-17T00:00:00+03:00');   // Pazartesi
  assert.equal(slotsForDate(pzt, DEMO_POLICY).length, 31);
});

test('Pazar 10:00–22:00 → 24 seans', () => {
  const paz = Date.parse('2026-08-16T00:00:00+03:00');   // Pazar
  assert.equal(slotsForDate(paz, DEMO_POLICY).length, 24);
});

test('son seansın bitişi kapanışı geçmez', () => {
  const pzt = Date.parse('2026-08-17T00:00:00+03:00');
  const son = slotsForDate(pzt, DEMO_POLICY).at(-1);
  const bitis = son + DEMO_POLICY.session.durationMinutes * 60_000;
  const kapanis = Date.parse('2026-08-17T23:30:00+03:00');
  assert.ok(bitis <= kapanis, `bitiş ${new Date(bitis).toISOString()} > kapanış`);
});

test('randevu ufku 15 gün listeler (bugün dahil)', () => {
  const days = bookableDays(NOW, DEMO_POLICY);
  assert.equal(days.length, 15);
  assert.ok(days.every(d => d.open));   // haftanın her günü açık
});

test('gün kapatılırsa seans üretilmez', () => {
  const kapali = withPolicy({ schedule: { hours: { 0: { open: null, close: null } } } }, DEMO_POLICY);
  const paz = Date.parse('2026-08-16T00:00:00+03:00');
  assert.equal(isOpenOn(paz, kapali), false);
  assert.equal(slotsForDate(paz, kapali).length, 0);
});

/* --- taşıma: randevu kendi hakkını iki kez saymamalı --- */

test('taşınan randevu kendi hak kaydını iki kez saymaz', async () => {
  const { validateReschedule, createEntry, LedgerEventType } = await import('../index.mjs');
  const w = soloWorld({ policy: DEMO_POLICY });
  const start = Date.parse('2026-09-04T10:00:00+03:00');
  const target = Date.parse('2026-09-05T10:00:00+03:00');

  w.booking({ service: ServiceType.EMS, startsAt: start, memberIds: ['ahmet'] });
  const appt = w.appointments.at(-1);

  // Haftalık kotayı dolduran iki rezervasyon: biri BU randevuya ait
  w.ledgers.get('ahmet').push(createEntry({
    type: LedgerEventType.BOOKING_RESERVED, memberId: 'ahmet',
    memberPackageId: w.packages.get('ahmet').id,
    appointmentId: appt.id, sessionStartsAt: start, recordedAt: NOW
  }));
  w.reserve('ahmet', Date.parse('2026-09-03T10:00:00+03:00'));

  const r = validateReschedule({
    appointment: appt,
    targetSlot: { startsAt: target },
    ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('taşımada BAŞKA randevuların hakkı sayılmaya devam eder', async () => {
  const { validateReschedule, createEntry, LedgerEventType } = await import('../index.mjs');
  const w = soloWorld({ policy: DEMO_POLICY });
  const start = Date.parse('2026-09-04T10:00:00+03:00');

  w.booking({ service: ServiceType.EMS, startsAt: start, memberIds: ['ahmet'] });
  const appt = w.appointments.at(-1);
  w.ledgers.get('ahmet').push(createEntry({
    type: LedgerEventType.BOOKING_RESERVED, memberId: 'ahmet',
    memberPackageId: w.packages.get('ahmet').id,
    appointmentId: appt.id, sessionStartsAt: start, recordedAt: NOW
  }));
  // Aynı kovada BAŞKA iki randevu → kota dolu
  w.reserve('ahmet', Date.parse('2026-09-03T10:00:00+03:00'));
  w.reserve('ahmet', Date.parse('2026-09-02T10:00:00+03:00'));

  const r = validateReschedule({
    appointment: appt,
    targetSlot: { startsAt: Date.parse('2026-09-05T10:00:00+03:00') },
    ctx: w.ctx({ now: NOW, policy: DEMO_POLICY })
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.WEEKLY_LIMIT_REACHED);
});
