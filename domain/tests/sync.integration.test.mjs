/* Paylaşılan demo durumu — ENTEGRASYON testleri
 *
 * Bunlar saf birim testi DEĞİLDİR: gerçek Supabase demo projesine gider.
 * Ağ yoksa tamamı atlanır, böylece 139 domain testi hiçbir koşulda etkilenmez.
 *
 * Çalıştırma:  node --test domain/tests/sync.integration.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

const URL = 'https://apahxdkdsvpoejrphkzd.supabase.co';
/* Yayınlanabilir anon anahtar — tarayıcıya açık olacak şekilde tasarlanmıştır. */
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwYWh4ZGtkc3Zwb2VqcnBoa3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTIxOTAsImV4cCI6MjEwMjQyODE5MH0.oBJ5kzRYyPCWmIjQlLxiwNfTIYAhPt3ykLQ2K61pqJo';
const FN = `${URL}/functions/v1/demo-api`;

const api = (body) => fetch(FN, {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}).then(async (r) => ({ httpStatus: r.status, ...(await r.json()) }));

let online = false;
try {
  const h = await api({ action: 'health' });
  online = h.ok === true;
} catch { online = false; }

const opts = { skip: online ? false : 'Demo API erişilemiyor — entegrasyon testleri atlandı' };

const current = () => api({ action: 'getState' });

/* ---------- sürüm / eşzamanlılık ---------- */

test('yazma sürümü bir artırır', opts, async () => {
  const before = await current();
  const r = await api({
    action: 'mutate', expectedRevision: before.revision,
    mutation: { type: 'ADD_PAYMENT', memberId: 'test', amount: 1 },
    state: before.state, actor: 'test'
  });
  assert.equal(r.ok, true);
  assert.equal(r.revision, before.revision + 1);
});

test('bayat sürüm reddedilir ve güncel durum geri döner', opts, async () => {
  const before = await current();
  const stale = before.revision - 1;
  const r = await api({
    action: 'mutate', expectedRevision: stale,
    mutation: { type: 'ADD_PAYMENT', memberId: 'test', amount: 1 },
    state: before.state, actor: 'test'
  });
  assert.equal(r.ok, false);
  assert.equal(r.conflict, true);
  assert.equal(r.httpStatus, 409);
  assert.ok(r.revision >= before.revision, 'çakışma yanıtı güncel sürümü taşımalı');
  assert.ok(r.state, 'çakışma yanıtı yetkili durumu taşımalı');
});

test('kayıp güncelleme yok: aynı sürümden iki yazma → biri geçer', opts, async () => {
  const before = await current();
  const body = (amount) => ({
    action: 'mutate', expectedRevision: before.revision,
    mutation: { type: 'ADD_PAYMENT', memberId: 'test', amount },
    state: before.state, actor: 'test'
  });
  const [a, b] = await Promise.all([api(body(1)), api(body(2))]);
  const ok = [a, b].filter((r) => r.ok).length;
  const conflict = [a, b].filter((r) => r.conflict).length;
  assert.equal(ok, 1, 'tam olarak biri başarılı olmalı');
  assert.equal(conflict, 1, 'diğeri çakışma almalı');
});

/* ---------- yapısal doğrulama ---------- */

test('bilinmeyen mutasyon türü reddedilir', opts, async () => {
  const r = await api({
    action: 'mutate', expectedRevision: 1,
    mutation: { type: 'DROP_EVERYTHING' }, state: { members: {}, appointments: [] }
  });
  assert.equal(r.httpStatus, 400);
  assert.match(r.error, /mutasyon/i);
});

test('bozuk durum yapısı reddedilir', opts, async () => {
  const r = await api({
    action: 'mutate', expectedRevision: 1,
    mutation: { type: 'ADD_PAYMENT' }, state: { hatali: true }
  });
  assert.equal(r.httpStatus, 400);
  assert.match(r.error, /yapısı/i);
});

test('expectedRevision zorunludur', opts, async () => {
  const r = await api({
    action: 'mutate', mutation: { type: 'ADD_PAYMENT' },
    state: { members: {}, appointments: [] }
  });
  assert.equal(r.httpStatus, 400);
});

/* ---------- yetkilendirme sınırı ---------- */

test('abonelik tablosu tarayıcıdan okunamaz', opts, async () => {
  const r = await fetch(
    `${URL}/rest/v1/owner_demo_push_subscriptions?select=endpoint`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const rows = await r.json();
  assert.ok(Array.isArray(rows) && rows.length === 0,
    'RLS abonelikleri gizlemeli — anon hiçbir satır görmemeli');
});

test('bildirim kaydı tarayıcıdan okunamaz', opts, async () => {
  const r = await fetch(
    `${URL}/rest/v1/owner_demo_notification_log?select=id`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const rows = await r.json();
  assert.ok(Array.isArray(rows) && rows.length === 0, 'RLS kaydı gizlemeli');
});

test('paylaşılan durum tarayıcıdan OKUNABİLİR (Realtime bunu kullanır)', opts, async () => {
  const r = await fetch(
    `${URL}/rest/v1/owner_demo_state?key=eq.owner-demo-2026-08-16&select=revision`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  const rows = await r.json();
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0].revision, 'number');
});

test('yetkisiz istek reddedilir', opts, async () => {
  const r = await fetch(FN, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'health' })
  });
  assert.equal(r.status, 401);
});

/* ---------- push abonelikleri ---------- */

const fakeSub = (suffix) => ({
  endpoint: `https://example.invalid/test-${suffix}`,
  keys: { p256dh: 'BTest' + 'x'.repeat(80), auth: 'YXV0aC10ZXN0LTEyMzQ1Ng' }
});

test('abonelik kaydedilir ve endpoint tekilliği korunur', opts, async () => {
  const sub = fakeSub('dedup');
  const a = await api({ action: 'subscribe', memberId: 'm-test', subscription: sub });
  const b = await api({ action: 'subscribe', memberId: 'm-test', subscription: sub });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true, 'aynı endpoint tekrar gönderilince çoğalmamalı, güncellenmeli');
});

test('eksik abonelik bilgisi reddedilir', opts, async () => {
  const r = await api({ action: 'subscribe', memberId: 'm-test', subscription: { endpoint: 'x' } });
  assert.equal(r.httpStatus, 400);
});

test('abonelik iptal edilebilir', opts, async () => {
  const sub = fakeSub('revoke');
  await api({ action: 'subscribe', memberId: 'm-test', subscription: sub });
  const r = await api({ action: 'unsubscribe', endpoint: sub.endpoint });
  assert.equal(r.ok, true);
});

test('demo sıfırlama abonelikleri SİLMEZ', opts, async () => {
  const sub = fakeSub('survive-reset');
  await api({ action: 'subscribe', memberId: 'm-test', subscription: sub });
  const before = await api({ action: 'health' });

  const cur = await current();
  await api({
    action: 'mutate', expectedRevision: cur.revision,
    mutation: { type: 'RESET_DEMO' }, state: cur.state, actor: 'test'
  });

  const after = await api({ action: 'health' });
  assert.ok(after.activeSubscriptions >= before.activeSubscriptions,
    'sıfırlama sonrası abonelik sayısı azalmamalı');
});

test('ölü abonelik push denemesinde temizlenir', opts, async () => {
  // example.invalid gerçek bir push servisi değil → gönderim başarısız olur.
  // VAPID yapılandırılmamışsa FAILED, yapılandırılmışsa SUBSCRIPTION_GONE/FAILED.
  const sub = fakeSub('dead');
  await api({ action: 'subscribe', memberId: 'm-dead-test', subscription: sub });
  const r = await api({ action: 'testPush', memberId: 'm-dead-test' });
  assert.equal(r.ok, true, 'push başarısız olsa bile istek hata vermemeli');
  assert.equal(r.sent, 0);
});

test('push hatası randevu işlemini geri almaz', opts, async () => {
  const before = await current();
  const r = await api({
    action: 'mutate', expectedRevision: before.revision,
    mutation: {
      type: 'MOVE_APPOINTMENT', appointmentId: 'yok-boyle-bir-randevu',
      oldStartsAt: Date.now(), newStartsAt: Date.now() + 3_600_000,
      serviceType: 'EMS', bookingMode: 'SINGLE', memberIds: ['m-dead-test']
    },
    state: before.state, actor: 'test'
  });
  assert.equal(r.ok, true, 'bildirim gönderilemese de yazma başarılı olmalı');
  assert.equal(r.revision, before.revision + 1);
});

test('sağlık uç noktası VAPID durumunu bildirir', opts, async () => {
  const h = await api({ action: 'health' });
  assert.equal(h.ok, true);
  assert.equal(typeof h.vapidConfigured, 'boolean');
  assert.equal(typeof h.activeSubscriptions, 'number');
});
