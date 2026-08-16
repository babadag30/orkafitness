/* v0.5 §4 — normal stüdyo kapasitesi
   EMS ≤ 3 · Fitness ≤ 2 · toplam ≤ 4 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceType, ReasonCode } from '../index.mjs';
import { canBookSingleEMS, canBookFitness } from '../index.mjs';
import { soloWorld } from './_fixtures.mjs';

test('EMS: 2 kişi varken 3. kişi kabul edilir', () => {
  const w = soloWorld().fill(ServiceType.EMS, 2);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true);
});

test('EMS: 3 kişi varken 4. kişi reddedilir', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.EMS_CAPACITY_FULL);
});

test('Fitness: 1 kişi varken 2. kişi kabul edilir', () => {
  const w = soloWorld().fill(ServiceType.FITNESS, 1);
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true);
});

test('Fitness: 2 kişi varken 3. kişi reddedilir', () => {
  const w = soloWorld().fill(ServiceType.FITNESS, 2);
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.FITNESS_CAPACITY_FULL);
});

test('EMS 2 + Fitness 2 kabul edilir (toplam 4)', () => {
  const w = soloWorld()
    .fill(ServiceType.EMS, 2, undefined, 'e')
    .fill(ServiceType.FITNESS, 1, undefined, 'f');
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('EMS 3 + Fitness 1 kabul edilir (toplam 4)', () => {
  const w = soloWorld().fill(ServiceType.EMS, 3, undefined, 'e');
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
});

test('EMS 3 + Fitness 2 reddedilir (toplam 5 > 4)', () => {
  const w = soloWorld()
    .fill(ServiceType.EMS, 3, undefined, 'e')
    .fill(ServiceType.FITNESS, 1, undefined, 'f');
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.STUDIO_CAPACITY_FULL);
  assert.equal(r.metadata.total, 4);
});

test('toplam sınır, servis sınırından önce dolabilir', () => {
  // EMS 3 + Fitness 1 = 4. EMS kotasında yer yok ama Fitness kotasında var;
  // reddin sebebi toplam kapasite olmalı, Fitness kapasitesi değil.
  const w = soloWorld()
    .fill(ServiceType.EMS, 3, undefined, 'e')
    .fill(ServiceType.FITNESS, 1, undefined, 'f');
  const r = canBookFitness({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.reasonCode, ReasonCode.STUDIO_CAPACITY_FULL);
});

test('boş seans her iki servise de açık', () => {
  const w = soloWorld();
  assert.equal(canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() }).allowed, true);
  assert.equal(canBookFitness({ memberId: 'ahmet', ctx: w.ctx() }).allowed, true);
});
