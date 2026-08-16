/* v0.5 §17 (üyeye ham kapasite gösterme), §23 (ortak sonuç sözleşmesi) */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceType, ReasonCode, allow, deny, unresolved,
  canBookSingleEMS, canBookFitness
} from '../index.mjs';
import { soloWorld } from './_fixtures.mjs';

test('her red bir reasonCode taşır', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.ok(r.reasonCode);
  assert.notEqual(r.reasonCode, ReasonCode.OK);
});

test('üye ve yönetici mesajları farklıdır', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.notEqual(r.memberMessage, r.adminMessage);
});

test('üye mesajı ham kapasite sayısı içermez', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.memberMessage, 'Bu saat dolu.');
  assert.doesNotMatch(r.memberMessage, /\d+\s*\/\s*\d+/);   // "3/3" gibi bir şey olmamalı
  assert.doesNotMatch(r.memberMessage, /EMS|Fitness/);
});

test('yönetici mesajı sayıları taşır', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.match(r.adminMessage, /3\/3/);
});

test('tüm kapasite redlerinde üyeye aynı sade mesaj gider', () => {
  const full = soloWorld().fill(ServiceType.FITNESS, 2);
  const total = soloWorld()
    .fill(ServiceType.EMS, 3, undefined, 'e')
    .fill(ServiceType.FITNESS, 1, undefined, 'f');

  const a = canBookFitness({ memberId: 'ahmet', ctx: full.ctx() });
  const b = canBookFitness({ memberId: 'ahmet', ctx: total.ctx() });
  assert.equal(a.memberMessage, 'Bu saat dolu.');
  assert.equal(b.memberMessage, 'Bu saat dolu.');
  assert.notEqual(a.reasonCode, b.reasonCode);   // sebep farklı, mesaj aynı
});

test('metadata karar ayrıntısını korur', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.metadata.emsPeople, 3);
  assert.equal(r.metadata.capacity, 3);
});

test('aşılabilirlik bilgisi sonuçta taşınır', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.overridable, true);   // yönetici gerekçeyle kapasiteyi aşabilir
});

test('izin verilen sonuç plan taşır', () => {
  const w = soloWorld();
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true);
  assert.ok(r.metadata.plan.appointment);
  assert.equal(r.metadata.plan.participants.length, 1);
  assert.equal(r.metadata.plan.ledgerEntries.length, 1);
});

test('sonuç nesnesi değiştirilemez', () => {
  const r = allow({ a: 1 });
  assert.throws(() => { r.allowed = false; }, TypeError);
});

test('bilinmeyen reasonCode reddedilir', () => {
  assert.throws(() => deny('UYDURMA_KOD', {}), /Bilinmeyen ReasonCode/);
});

test('karara bağlanmamış politika açıkça işaretlenir', () => {
  const r = unresolved('test sorusu');
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.POLICY_UNRESOLVED);
  assert.equal(r.unresolved, true);
  assert.equal(r.overridable, false);
  assert.equal(r.metadata.question, 'test sorusu');
});

test('izin verilen sonuç unresolved değildir', () => {
  assert.equal(allow().unresolved, false);
});
