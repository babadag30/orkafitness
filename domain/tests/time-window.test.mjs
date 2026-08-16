/* v0.5 §16 (randevu penceresi), §21 (taşıma) ve üye zaman çakışması */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceType, BookingMode, ReasonCode,
  canBookSingleEMS, canBookFitness, canBookCoupleEMS, validateReschedule
} from '../index.mjs';
import { soloWorld, coupleWorld, makeWorld, SLOT, NOW } from './_fixtures.mjs';

test('üye kendi randevusuyla çakışamaz', () => {
  const w = soloWorld().booking({ service: ServiceType.FITNESS, memberIds: ['ahmet'] });
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.MEMBER_TIME_CONFLICT);
});

test('zaman çakışması yönetici tarafından aşılamaz', () => {
  const w = soloWorld().booking({ service: ServiceType.FITNESS, memberIds: ['ahmet'] });
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.overridable, false);
});

test('partnerin çakışması çiftin tamamını reddeder', () => {
  const other = '2026-09-04T10:00:00+03:00';
  const w = coupleWorld().member('mert')
    .booking({ service: ServiceType.FITNESS, memberIds: ['ayse'], startsAt: other });
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.MEMBER_TIME_CONFLICT);
  assert.equal(r.metadata.blockedBy, 'PARTNER');
});

test('kapatılmış seans reddedilir', () => {
  const w = soloWorld();
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: Date.parse(SLOT), closed: true, closedReason: 'Ekipman bakımı' } })
  });
  assert.equal(r.reasonCode, ReasonCode.SLOT_CLOSED);
  assert.match(r.adminMessage, /Ekipman bakımı/);
});

test('seansa 2 saatten az kaldıysa randevu kapanır', () => {
  const w = soloWorld();
  const start = Date.parse('2026-09-01T10:00:00+03:00');
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: start }, now: start - 90 * 60_000 })
  });
  assert.equal(r.reasonCode, ReasonCode.BOOKING_TOO_LATE);
});

test('tam 2 saat kala randevu hâlâ açıktır (sınır)', () => {
  const w = soloWorld();
  const start = Date.parse('2026-09-01T14:00:00+03:00');
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: start }, now: start - 120 * 60_000 })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('14 günlük ufkun ötesi reddedilir', () => {
  const w = soloWorld();
  const r = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ slot: { startsAt: Date.parse(NOW) + 15 * 86_400_000 } })
  });
  assert.equal(r.reasonCode, ReasonCode.BOOKING_TOO_EARLY);
});

/* --- taşıma (v0.5 §21) --- */

test('taşıma hedef seans için tüm doğrulamayı yeniden çalıştırır', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3, '2026-09-05T10:00:00+03:00', 'e');
  w.booking({ service: ServiceType.EMS, memberIds: ['ahmet'], startsAt: SLOT });
  const appt = w.appointments.at(-1);

  const r = validateReschedule({
    appointment: appt,
    targetSlot: { startsAt: Date.parse('2026-09-05T10:00:00+03:00') },
    ctx: w.ctx()
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.EMS_CAPACITY_FULL);
});

test('taşınan randevu kendi kendisiyle çakışmaz', () => {
  const w = soloWorld().booking({ service: ServiceType.EMS, memberIds: ['ahmet'], startsAt: SLOT });
  const appt = w.appointments.at(-1);

  // Aynı saate taşımak: randevunun kendisi hesaptan çıkarılmalı
  const r = validateReschedule({
    appointment: appt,
    targetSlot: { startsAt: Date.parse(SLOT) },
    ctx: w.ctx()
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('çift taşınırken hedefin tamamen boş olması gerekir', () => {
  const target = '2026-09-05T10:00:00+03:00';
  const w = coupleWorld().member('mert')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'], startsAt: SLOT })
    .booking({ service: ServiceType.FITNESS, memberIds: ['mert'], startsAt: target });
  const appt = w.appointments[0];

  const r = validateReschedule({
    appointment: appt,
    targetSlot: { startsAt: Date.parse(target) },
    ctx: w.ctx()
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.COUPLE_REQUIRES_EMPTY_SLOT);
});

test('iptal edilmiş katılımcı yer tutmaz', () => {
  const w = makeWorld().member('ahmet').pkg('ahmet').member('x0').member('x1').member('x2');
  w.booking({ service: ServiceType.EMS, memberIds: ['x0'] });
  w.booking({ service: ServiceType.EMS, memberIds: ['x1'] });
  w.booking({ service: ServiceType.EMS, memberIds: ['x2'] });
  // Üçüncüsü iptal → yer açılır
  w.appointments[2].participants[0].attendanceStatus = 'MEMBER_CANCELLED';

  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('geç iptal eden katılımcı varsayılan olarak yerini korur', () => {
  // Bu bir varsayım, onaylanmış kural değil — policy.occupancy ile değişebilir.
  const w = makeWorld().member('ahmet').pkg('ahmet').member('x0').member('x1').member('x2');
  for (const m of ['x0', 'x1', 'x2']) w.booking({ service: ServiceType.EMS, memberIds: [m] });
  w.appointments[2].participants[0].attendanceStatus = 'LATE_CANCEL';

  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true);        // EMS 3 + Fitness 1 = 4, hâlâ sığar
  const ems = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(ems.reasonCode, ReasonCode.EMS_CAPACITY_FULL);
});
