/* v0.5 §5, §11, §12 — çift seansı münhasır stüdyo seansıdır */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceType, BookingMode, ReasonCode } from '../index.mjs';
import { canBookCoupleEMS, canBookSingleEMS, canBookFitness } from '../index.mjs';
import { coupleWorld, SLOT } from './_fixtures.mjs';

test('boş seans + uygun çift → kabul', () => {
  const w = coupleWorld();
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
  assert.equal(r.metadata.partnerId, 'ayse');
  assert.equal(r.metadata.plan.appointment.exclusiveStudio, true);
  assert.equal(r.metadata.plan.participants.length, 2);
});

test('seansta 1 EMS varsa çift reddedilir', () => {
  const w = coupleWorld().fill(ServiceType.EMS, 1);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.COUPLE_REQUIRES_EMPTY_SLOT);
});

test('seansta 1 Fitness varsa çift reddedilir', () => {
  const w = coupleWorld().fill(ServiceType.FITNESS, 1);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.COUPLE_REQUIRES_EMPTY_SLOT);
});

test('kapasitede yer olsa bile kısmen dolu seansa çift giremez', () => {
  // v0.5 §11: normal EMS için uygun olan saat, çift için uygun değildir.
  const w = coupleWorld().fill(ServiceType.EMS, 1);
  assert.equal(canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() }).allowed, true);
  assert.equal(canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() }).allowed, false);
});

test('çift varken yeni EMS reddedilir', () => {
  const w = coupleWorld()
    .member('mert').pkg('mert')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = canBookSingleEMS({ memberId: 'mert', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.EXCLUSIVE_COUPLE_CONFLICT);
});

test('çift varken yeni Fitness reddedilir', () => {
  const w = coupleWorld()
    .member('mert')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = canBookFitness({ memberId: 'mert', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.EXCLUSIVE_COUPLE_CONFLICT);
});

test('aynı saate ikinci çift reddedilir', () => {
  const w = coupleWorld()
    .member('mert').member('elif').pkg('mert').pkg('elif').link('mert', 'elif')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = canBookCoupleEMS({ initiatorMemberId: 'mert', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.EXCLUSIVE_COUPLE_CONFLICT);
});

test('münhasır çakışma yönetici tarafından aşılamaz', () => {
  const w = coupleWorld().member('mert').pkg('mert')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = canBookSingleEMS({ memberId: 'mert', ctx: w.ctx() });
  assert.equal(r.overridable, false);
});

test('çift, iptal edilmiş bir randevunun bulunduğu saate girebilir', () => {
  const w = coupleWorld().member('mert')
    .booking({ service: ServiceType.EMS, memberIds: ['mert'], status: 'CANCELLED' });
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('çift seansı yalnızca kesişen saatleri kapatır', () => {
  const other = '2026-09-04T12:00:00+03:00';
  const w = coupleWorld().member('mert').pkg('mert')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'], startsAt: SLOT });
  const r = canBookSingleEMS({
    memberId: 'mert',
    ctx: w.ctx({ slot: { startsAt: Date.parse(other) } })
  });
  assert.equal(r.allowed, true, r.internalReason);
});
