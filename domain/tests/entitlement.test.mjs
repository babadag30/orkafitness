/* v0.5 §8, §9 — EMS hakkı: 8 kredi, 28 günlük döngü, 7 günlük kovada en fazla 2 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReasonCode, LedgerEventType, DEFAULT_POLICY,
  canBookSingleEMS, canBookCoupleEMS, projectEntitlement, resolveBucket
} from '../index.mjs';
import { soloWorld, coupleWorld, SLOT, SLOT_SAME_BUCKET, SLOT_NEXT_BUCKET, PACKAGE_START } from './_fixtures.mjs';

const at = (iso) => ({ slot: { startsAt: Date.parse(iso) } });
/** Uzak tarihli seanslarda "now"u da ilerletir; aksi hâlde 14 günlük ufka takılır. */
const atLate = (iso) => ({ ...at(iso), now: Date.parse('2026-09-20T09:00:00+03:00') });

test('8 kredinin tamamı kullanıldığında 9. randevu reddedilir', () => {
  const w = soloWorld();
  // 8 rezervasyon, farklı kovalara dağıtılmış ki haftalık limite takılmasın
  const days = [0, 1, 7, 8, 14, 15, 21, 22];
  for (const d of days) {
    const t = Date.parse(PACKAGE_START) + d * 86_400_000;
    w.reserve('ahmet', t);
  }
  const projection = projectEntitlement({
    ledger: w.ledgers.get('ahmet'), memberPackage: w.packages.get('ahmet'), policy: DEFAULT_POLICY
  });
  assert.equal(projection.remaining, 0);

  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(atLate('2026-09-24T10:00:00+03:00')) });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PACKAGE_EXHAUSTED);
});

test('7 kredi kullanılmışsa 8. randevu kabul edilir (sınır)', () => {
  const w = soloWorld();
  const days = [0, 1, 7, 8, 14, 15, 21];
  for (const d of days) w.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(atLate('2026-09-24T10:00:00+03:00')) });
  assert.equal(r.allowed, true, r.internalReason);
});

test('aynı kovada 1 kullanım varken 2. kabul edilir', () => {
  const w = soloWorld().reserve('ahmet', Date.parse(SLOT));
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(at(SLOT_SAME_BUCKET)) });
  assert.equal(r.allowed, true, r.internalReason);
});

test('aynı kovada 2 kullanım varken 3. reddedilir', () => {
  const w = soloWorld()
    .reserve('ahmet', Date.parse(SLOT))
    .reserve('ahmet', Date.parse(SLOT_SAME_BUCKET));
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(at('2026-09-06T10:00:00+03:00')) });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.WEEKLY_LIMIT_REACHED);
  assert.equal(r.metadata.used, 2);
});

test('kullanılmayan hak sonraki kovaya devretmez', () => {
  // 0. kovada hiç kullanım yok. 1. kovada yine üst sınır 2'dir, 4 değil.
  const w = soloWorld()
    .reserve('ahmet', Date.parse(SLOT_NEXT_BUCKET))
    .reserve('ahmet', Date.parse('2026-09-10T10:00:00+03:00'));
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(at('2026-09-11T10:00:00+03:00')) });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.WEEKLY_LIMIT_REACHED);
});

test('farklı kovalardaki kullanımlar birbirini etkilemez', () => {
  const w = soloWorld()
    .reserve('ahmet', Date.parse(SLOT))
    .reserve('ahmet', Date.parse(SLOT_SAME_BUCKET));
  // 0. kova dolu ama 1. kova boş
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(at(SLOT_NEXT_BUCKET)) });
  assert.equal(r.allowed, true, r.internalReason);
});

test('paket başlangıç sınırı: ilk gün dönem içindedir', () => {
  const w = soloWorld();
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(at('2026-09-01T20:00:00+03:00')) });
  assert.equal(r.allowed, true, r.internalReason);
});

test('paket bitiş sınırı: 28. gün içeride, 29. gün dışarıda', () => {
  const w = soloWorld();
  const inside = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ ...at('2026-09-28T10:00:00+03:00'), now: Date.parse('2026-09-20T09:00:00+03:00') })
  });
  assert.equal(inside.allowed, true, inside.internalReason);

  const outside = canBookSingleEMS({
    memberId: 'ahmet',
    ctx: w.ctx({ ...at('2026-09-29T10:00:00+03:00'), now: Date.parse('2026-09-20T09:00:00+03:00') })
  });
  assert.equal(outside.allowed, false);
  assert.equal(outside.reasonCode, ReasonCode.PACKAGE_PERIOD_MISMATCH);
});

test('iptal edilen randevu hem krediyi hem kova yerini geri verir', () => {
  const w = soloWorld()
    .reserve('ahmet', Date.parse(SLOT))
    .reserve('ahmet', Date.parse(SLOT_SAME_BUCKET))
    .entry('ahmet', LedgerEventType.MEMBER_CANCEL_RELEASED, Date.parse(SLOT));
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx(at('2026-09-06T10:00:00+03:00')) });
  assert.equal(r.allowed, true, r.internalReason);
});

test('katılım kaydı krediyi ikinci kez düşmez', () => {
  const w = soloWorld()
    .reserve('ahmet', Date.parse(SLOT))
    .entry('ahmet', LedgerEventType.ATTENDED_CONSUMED, Date.parse(SLOT));
  const p = projectEntitlement({
    ledger: w.ledgers.get('ahmet'), memberPackage: w.packages.get('ahmet'), policy: DEFAULT_POLICY
  });
  assert.equal(p.remaining, 7);
});

test('gelmedi kaydı hakkı yakar, iade etmez', () => {
  const w = soloWorld()
    .reserve('ahmet', Date.parse(SLOT))
    .entry('ahmet', LedgerEventType.NO_SHOW_CONSUMED, Date.parse(SLOT));
  const p = projectEntitlement({
    ledger: w.ledgers.get('ahmet'), memberPackage: w.packages.get('ahmet'), policy: DEFAULT_POLICY
  });
  assert.equal(p.remaining, 7);
});

test('paketi olmayan üye EMS alamaz', () => {
  const w = soloWorld();
  w.packages.delete('ahmet');
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PACKAGE_MISSING);
});

test('pasif paket EMS randevusunu engeller', () => {
  const w = soloWorld();
  w.packages.get('ahmet').active = false;
  const r = canBookSingleEMS({ memberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PACKAGE_INACTIVE);
});

/* --- çift seansı: iki üye de ayrı ayrı kontrol edilir (v0.5 §8) --- */

test('çift: iki üye de uygunsa kabul', () => {
  const w = coupleWorld();
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, true, r.internalReason);
  assert.equal(r.metadata.plan.ledgerEntries.length, 2);
});

test('çift: partnerin hakkı bittiyse çiftin tamamı reddedilir', () => {
  const w = coupleWorld();
  const days = [0, 1, 7, 8, 14, 15, 21, 22];
  for (const d of days) w.reserve('ayse', Date.parse(PACKAGE_START) + d * 86_400_000);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_NOT_ELIGIBLE);
  assert.equal(r.metadata.underlyingReasonCode, ReasonCode.PACKAGE_EXHAUSTED);
});

test('çift: partnerin haftalık limiti dolduysa çift reddedilir', () => {
  const w = coupleWorld()
    .reserve('ayse', Date.parse(SLOT_SAME_BUCKET))
    .reserve('ayse', Date.parse('2026-09-06T10:00:00+03:00'));
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PARTNER_NOT_ELIGIBLE);
  assert.equal(r.metadata.underlyingReasonCode, ReasonCode.WEEKLY_LIMIT_REACHED);
});

test('çift: başlatanın hakkı bittiyse kendi sebebiyle reddedilir', () => {
  const w = coupleWorld();
  const days = [0, 1, 7, 8, 14, 15, 21, 22];
  for (const d of days) w.reserve('ahmet', Date.parse(PACKAGE_START) + d * 86_400_000);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.reasonCode, ReasonCode.PACKAGE_EXHAUSTED);
});

test('çift reddedilirse hiçbir katılımcı için plan üretilmez (kısmi rezervasyon yok)', () => {
  const w = coupleWorld();
  const days = [0, 1, 7, 8, 14, 15, 21, 22];
  for (const d of days) w.reserve('ayse', Date.parse(PACKAGE_START) + d * 86_400_000);
  const r = canBookCoupleEMS({ initiatorMemberId: 'ahmet', ctx: w.ctx() });
  assert.equal(r.allowed, false);
  assert.equal(r.metadata.plan, undefined);
});

test('kova kimliği stratejiyi taşır — karışma olmaz', () => {
  const w = soloWorld();
  const b = resolveBucket(w.packages.get('ahmet'), Date.parse(SLOT), DEFAULT_POLICY);
  assert.equal(b.index, 0);
  assert.match(b.key, /pkg7:0$/);
});
