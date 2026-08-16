/* Manuel yönetici bildirimi — içerik kuralları ve yetkilendirme sınırı.

   İki katman test edilir:
   1) Saf doğrulama (her zaman çalışır)
   2) Canlı Edge Function sınırı (ağ yoksa atlanır) */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNotification, fill, TITLE_MAX, BODY_MAX, TEMPLATE_IDS
} from '../js/notification-rules.mjs';

const base = { template: 'CUSTOM', title: 'Başlık', message: 'Mesaj', deviceCount: 1 };

/* ---------- içerik kuralları ---------- */

test('aktif aboneliği olan üyeye gönderim geçerlidir', () => {
  const r = validateNotification(base);
  assert.equal(r.ok, true);
  assert.equal(r.title, 'Başlık');
});

test('aboneliği olmayan üye temiz şekilde reddedilir', () => {
  const r = validateNotification({ ...base, deviceCount: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.field, 'devices');
  assert.match(r.error, /bildirim izni vermemiş/);
});

test('birden fazla cihaz gönderimi engellemez', () => {
  assert.equal(validateNotification({ ...base, deviceCount: 3 }).ok, true);
});

test('boş mesaj reddedilir', () => {
  assert.equal(validateNotification({ ...base, message: '' }).ok, false);
  assert.equal(validateNotification({ ...base, message: '   ' }).field, 'message');
});

test('boş başlık reddedilir', () => {
  assert.equal(validateNotification({ ...base, title: '  ' }).field, 'title');
});

test('özel mesaj uzunluk sınırına tabidir', () => {
  assert.equal(validateNotification({ ...base, message: 'a'.repeat(BODY_MAX) }).ok, true);
  const over = validateNotification({ ...base, message: 'a'.repeat(BODY_MAX + 1) });
  assert.equal(over.ok, false);
  assert.equal(over.field, 'message');
});

test('başlık uzunluk sınırına tabidir', () => {
  assert.equal(validateNotification({ ...base, title: 'a'.repeat(TITLE_MAX) }).ok, true);
  assert.equal(validateNotification({ ...base, title: 'a'.repeat(TITLE_MAX + 1) }).field, 'title');
});

test('bilinmeyen şablon reddedilir', () => {
  assert.equal(validateNotification({ ...base, template: 'UYDURMA' }).field, 'template');
});

test('beş şablon tanımlı', () => {
  assert.equal(TEMPLATE_IDS.length, 5);
  assert.ok(TEMPLATE_IDS.includes('CUSTOM'));
  assert.ok(TEMPLATE_IDS.includes('PAYMENT_REMINDER'));
});

test('şablon metni üyenin adıyla doldurulur', () => {
  assert.equal(fill('{ad}, ödeme hatırlatması', 'Ahmet Yıldız'), 'Ahmet, ödeme hatırlatması');
  assert.equal(fill('{ad} merhaba', ''), 'Merhaba merhaba');
  assert.equal(fill('yer tutucusuz', 'Ahmet'), 'yer tutucusuz');
});

test('metnin başındaki/sonundaki boşluk kırpılır', () => {
  const r = validateNotification({ ...base, title: '  Duyuru  ', message: '  Merhaba  ' });
  assert.equal(r.title, 'Duyuru');
  assert.equal(r.message, 'Merhaba');
});

/* ---------- yetkilendirme sınırı (canlı) ---------- */

const FN = 'https://apahxdkdsvpoejrphkzd.supabase.co/functions/v1/demo-admin';
const ANON = process.env.ORKA_DEMO_ANON ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwYWh4ZGtkc3Zwb2VqcnBoa3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTIxOTAsImV4cCI6MjEwMjQyODE5MH0.oBJ5kzRYyPCWmIjQlLxiwNfTIYAhPt3ykLQ2K61pqJo';

async function callAdmin(payload, withAuth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (withAuth) headers.Authorization = `Bearer ${ANON}`;
  const res = await fetch(FN, { method: 'POST', headers, body: JSON.stringify(payload) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const live = async (t, fn) => {
  try { await fn(); }
  catch (e) {
    if (String(e).match(/fetch failed|ENOTFOUND|network/i)) return t.skip('ağ yok');
    throw e;
  }
};

test('anahtarsız manuel gönderim reddedilir', (t) => live(t, async () => {
  const r = await callAdmin({
    action: 'sendMemberNotification', memberId: 'm-ahmet',
    template: 'CUSTOM', title: 'x', message: 'y'
  });
  assert.notEqual(r.status, 200, 'anahtarsız istek 200 dönmemeli');
  assert.ok(['UNAUTHORIZED', 'NOT_CONFIGURED'].includes(r.body.reason), r.body.reason);
}));

test('yanlış anahtarla manuel gönderim reddedilir', (t) => live(t, async () => {
  const r = await callAdmin({
    action: 'sendMemberNotification', adminKey: 'kesinlikle-yanlis-anahtar',
    memberId: 'm-ahmet', template: 'CUSTOM', title: 'x', message: 'y'
  });
  assert.notEqual(r.status, 200);
}));

test('üye durumu sorgusu da anahtar ister', (t) => live(t, async () => {
  const r = await callAdmin({ action: 'memberPushStatus', memberId: 'm-ahmet' });
  assert.notEqual(r.status, 200);
}));

test('Supabase anon anahtarı olmadan işlev çağrılamaz', (t) => live(t, async () => {
  const r = await callAdmin({ action: 'verifyKey' }, false);
  assert.equal(r.status, 401);
}));

/* ---------- otomatik yol bozulmamalı ---------- */

test('otomatik bildirim altyapısı ayakta', (t) => live(t, async () => {
  const res = await fetch('https://apahxdkdsvpoejrphkzd.supabase.co/functions/v1/demo-api', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'health' })
  });
  const b = await res.json();
  assert.equal(b.ok, true);
  assert.equal(b.vapidConfigured, true, 'VAPID yapılandırması kaybolmuş');
}));

/* ---------- yapısal: manuel bildirim paylaşılan durumu değiştirmez ---------- */

test('manuel bildirim modülü paylaşılan duruma hiç dokunmaz', async () => {
  const src = await (await import('node:fs/promises')).readFile(
    new URL('../js/admin-push.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\/store\.mjs'/, 'store.mjs import edilmemeli');
  assert.doesNotMatch(src, /applyPlan|moveAppointment|addPayment|toggleClosure/,
    'randevu/durum mutasyonu çağrılmamalı');
});

test('manuel bildirim istemcide sır taşımaz', async () => {
  const raw = await (await import('node:fs/promises')).readFile(
    new URL('../js/admin-push.mjs', import.meta.url), 'utf8');
  // Yorumlar çıkarılır: sırrın YOKLUĞUNU anlatan açıklama metni eşleşmesin.
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /service_role|SERVICE_ROLE|VAPID_PRIVATE|sb_secret/,
    'istemci KODUNDA gizli anahtar olmamalı');
  // Yalnızca yayınlanabilir anahtar bulunmalı
  assert.match(code, /PUBLISHABLE_KEY/);
});
