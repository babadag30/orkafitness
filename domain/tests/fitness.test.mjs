/* v0.5 §3, §15 — Fitness EMS hak sisteminden tamamen bağımsızdır */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ServiceType, BookingMode, ReasonCode, LedgerEventType, DEFAULT_POLICY,
  canBookFitness, projectEntitlement
} from '../index.mjs';
import { makeWorld, soloWorld, coupleWorld, PACKAGE_START } from './_fixtures.mjs';

test('EMS paketi olmayan üye Fitness alabilir', () => {
  const w = makeWorld().member('deniz');   // paket yok
  const r = canBookFitness({ memberId: 'deniz', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('Fitness randevusu defter kaydı üretmez', () => {
  const w = soloWorld();
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true);
  assert.equal(r.metadata.plan.ledgerEntries.length, 0);
});

test('Fitness EMS kredisini tüketmez', () => {
  const w = soloWorld();
  const before = projectEntitlement({
    ledger: w.ledgers.get('ahmet'), memberPackage: w.packages.get('ahmet'), policy: DEFAULT_POLICY
  }).remaining;

  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  // Plan uygulansa bile deftere yazılacak bir şey yok
  for (const e of r.metadata.plan.ledgerEntries) w.ledgers.get('ahmet').push(e);

  const after = projectEntitlement({
    ledger: w.ledgers.get('ahmet'), memberPackage: w.packages.get('ahmet'), policy: DEFAULT_POLICY
  }).remaining;
  assert.equal(before, 8);
  assert.equal(after, 8);
});

test('EMS haftalık limiti dolu olan üye Fitness alabilir', () => {
  const w = soloWorld()
    .reserve('ahmet', Date.parse(PACKAGE_START) + 3 * 86_400_000)
    .reserve('ahmet', Date.parse(PACKAGE_START) + 4 * 86_400_000);
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('EMS paketi tükenmiş üye Fitness alabilir', () => {
  const w = soloWorld();
  const days = [0, 1, 7, 8, 14, 15, 21, 22];
  for (const d of days) w.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('Fitness kendi kapasitesiyle engellenir', () => {
  const w = soloWorld().fill(ServiceType.FITNESS, 2);
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.reasonCode, ReasonCode.FITNESS_CAPACITY_FULL);
});

test('Fitness toplam kapasiteyle engellenir', () => {
  const w = soloWorld()
    .fill(ServiceType.EMS, 3, undefined, 'e')
    .fill(ServiceType.FITNESS, 1, undefined, 'f');
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.reasonCode, ReasonCode.STUDIO_CAPACITY_FULL);
});

test('Fitness münhasır çift seansıyla engellenir', () => {
  const w = coupleWorld().member('deniz')
    .booking({ service: ServiceType.EMS, mode: BookingMode.COUPLE, memberIds: ['ahmet', 'ayse'] });
  const r = canBookFitness({ memberId: 'deniz', ctx: w.ctx() });
  assert.equal(r.reasonCode, ReasonCode.EXCLUSIVE_COUPLE_CONFLICT);
});

test('pasif üye Fitness alamaz', () => {
  const w = makeWorld().member('deniz', { active: false });
  const r = canBookFitness({ memberId: 'deniz', ctx: w.ctx() });
  assert.equal(r.reasonCode, ReasonCode.MEMBER_INACTIVE);
});

test('Fitness için çift modu tanımsızdır', async () => {
  const { canBook } = await import('../index.mjs');
  const w = makeWorld().member('deniz');
  assert.throws(
    () => canBook({
      memberId: 'deniz', serviceType: ServiceType.FITNESS,
      bookingMode: BookingMode.COUPLE, ctx: w.ctx()
    }),
    /çift modu tanımlı değil/
  );
});
