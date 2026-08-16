/* v0.5 §13 — iptal politikası ve karara bağlanmamış çift iptali */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceType, BookingMode, Actor, ReasonCode, LedgerEventType,
  AppointmentStatus, AttendanceStatus, UNRESOLVED,
  DEFAULT_POLICY, withPolicy, validateCancellation
} from '../index.mjs';
import { soloWorld, coupleWorld } from './_fixtures.mjs';

const NOW = Date.parse('2026-09-01T09:00:00+03:00');
const IN_48H = NOW + 48 * 3_600_000;
const IN_6H = NOW + 6 * 3_600_000;

function appt(w, { service = ServiceType.EMS, mode = BookingMode.SINGLE, startsAt = IN_48H, memberIds = ['ahmet'] } = {}) {
  w.booking({ service, mode, startsAt, memberIds });
  return w.appointments.at(-1);
}

test('EMS: 48 saat kala üye iptal edebilir', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('EMS: 6 saat kala üye iptal edemez', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w, { startsAt: IN_6H }), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.CANCEL_TOO_LATE);
  assert.equal(r.overridable, true);
});

test('geçerli iptal hakkı geri verir', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  const entries = r.metadata.plan.ledgerEntries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, LedgerEventType.MEMBER_CANCEL_RELEASED);
  assert.equal(entries[0].delta, +1);
});

test('paket dönemi başına 1 iptal hakkı — ikincisi reddedilir', () => {
  const w = soloWorld().entry('ahmet', LedgerEventType.MEMBER_CANCEL_RELEASED, IN_48H);
  const r = validateCancellation({
    appointment: appt(w), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.CANCEL_ALLOWANCE_EXHAUSTED);
  assert.equal(r.metadata.used, 1);
});

test('yönetici iptali süre sınırını aşar', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w, { startsAt: IN_6H }), requestedByMemberId: null,
    actor: Actor.ADMIN, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('yönetici iptali üyenin iptal hakkını yakmaz', () => {
  const w = soloWorld().entry('ahmet', LedgerEventType.MEMBER_CANCEL_RELEASED, IN_48H);
  const r = validateCancellation({
    appointment: appt(w), requestedByMemberId: null,
    actor: Actor.ADMIN, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, true);
  assert.deepEqual(r.metadata.plan.allowanceChargedTo, []);
  assert.equal(r.metadata.plan.ledgerEntries[0].type, LedgerEventType.ADMIN_CANCEL_RELEASED);
});

test('Fitness: iptal hakkı sayacı yoktur', () => {
  const w = soloWorld().entry('ahmet', LedgerEventType.MEMBER_CANCEL_RELEASED, IN_48H);
  const r = validateCancellation({
    appointment: appt(w, { service: ServiceType.FITNESS }), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, true, r.internalReason);
});

test('Fitness iptali defter kaydı üretmez', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w, { service: ServiceType.FITNESS }), requestedByMemberId: 'ahmet',
    actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.metadata.plan.ledgerEntries.length, 0);
});

test('Fitness de 24 saat sınırına tabidir', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w, { service: ServiceType.FITNESS, startsAt: IN_6H }),
    requestedByMemberId: 'ahmet', actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.reasonCode, ReasonCode.CANCEL_TOO_LATE);
});

test('zaten iptal edilmiş randevu tekrar iptal edilemez', () => {
  const w = soloWorld();
  const a = appt(w);
  a.status = AppointmentStatus.CANCELLED;
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ahmet', actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.reasonCode, ReasonCode.ALREADY_CANCELLED);
});

test('geçmiş seansı üye iptal edemez', () => {
  const w = soloWorld();
  const r = validateCancellation({
    appointment: appt(w, { startsAt: NOW - 3_600_000 }),
    requestedByMemberId: 'ahmet', actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.reasonCode, ReasonCode.SESSION_IN_PAST);
});

/* --- AÇIK KARAR: çift iptali (v0.5 §13) --- */

test('çift iptalinde üye için davranış sessizce varsayılmaz', () => {
  const w = coupleWorld();
  const a = appt(w, { mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ahmet', actor: Actor.MEMBER, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.POLICY_UNRESOLVED);
  assert.equal(r.unresolved, true);
  assert.equal(r.metadata.openQuestions.length, 3);
});

test('varsayılan politika çift iptali için UNRESOLVED taşır', () => {
  assert.equal(DEFAULT_POLICY.cancellation.couple.scope, UNRESOLVED);
  assert.equal(DEFAULT_POLICY.cancellation.couple.allowanceCharge, UNRESOLVED);
  assert.equal(DEFAULT_POLICY.cancellation.couple.adminCanConvertToSingle, UNRESOLVED);
});

test('karar verildiğinde çift iptali tek satır politika değişikliğiyle açılır', () => {
  const policy = withPolicy({
    cancellation: { couple: { scope: 'CANCEL_WHOLE', allowanceCharge: 'INITIATOR_ONLY' } }
  });
  const w = coupleWorld({ policy });
  const a = appt(w, { mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = validateCancellation({
    appointment: a, requestedByMemberId: 'ahmet', actor: Actor.MEMBER,
    ctx: w.ctx({ now: NOW, policy })
  });
  assert.equal(r.allowed, true, r.internalReason);
  assert.deepEqual(r.metadata.plan.allowanceChargedTo, ['ahmet']);
  assert.equal(r.metadata.plan.ledgerEntries.length, 2);   // iki üyenin de hakkı iade edilir
});

test('yönetici çift seansını karar beklemeden iptal edebilir', () => {
  const w = coupleWorld();
  const a = appt(w, { mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = validateCancellation({
    appointment: a, requestedByMemberId: null, actor: Actor.ADMIN, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.allowed, true, r.internalReason);
  assert.equal(r.metadata.scope, 'WHOLE_APPOINTMENT');
  assert.match(r.metadata.note, /karara bağlanmadı/);
});

test('iptal planı katılımcı durumlarını doğru işaretler', () => {
  const w = coupleWorld();
  const a = appt(w, { mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = validateCancellation({
    appointment: a, requestedByMemberId: null, actor: Actor.ADMIN, ctx: w.ctx({ now: NOW })
  });
  assert.equal(r.metadata.plan.participants.length, 2);
  for (const p of r.metadata.plan.participants) {
    assert.equal(p.attendanceStatus, AttendanceStatus.ADMIN_CANCELLED);
  }
});
