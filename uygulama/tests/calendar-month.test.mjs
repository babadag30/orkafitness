/* Ay görünümü tarih matematiği.

   Ay ızgarası saf hesaba dayanır: ayın ilk günü, ay uzunluğu, Pazartesi
   başlangıçlı hafta kaydırması ve gerekli satır sayısı. Yıl dönümü, farklı
   ay uzunlukları ve artık şubat burada kırılır — arayüzde değil. */

import test from 'node:test';
import assert from 'node:assert/strict';
import { monthStart, addMonths, dowOf, startOfDay, fmt, GUN_KISA_PZT } from '../js/ui.mjs';

const DAY = 86_400_000;

/** Stüdyo saatinde bir tarih üretir (yerel makine saat dilimi karışmasın). */
const at = (y, m, d) => Date.UTC(y, m - 1, d, 12) - 180 * 60_000;

/* ---------- ayın başı ---------- */

test('monthStart ayın ilk gününe iner', () => {
  assert.equal(monthStart(at(2026, 8, 17)), monthStart(at(2026, 8, 1)));
  assert.equal(fmt.dayNum(monthStart(at(2026, 8, 17))), 1);
});

test('monthStart gün başlangıcıyla hizalıdır', () => {
  const ms = monthStart(at(2026, 8, 17));
  assert.equal(ms, startOfDay(ms));
});

/* ---------- ay gezinmesi ---------- */

test('addMonths yıl dönümünü kendisi çözer', () => {
  const aralik = monthStart(at(2026, 12, 9));
  const ocak = addMonths(aralik, 1);
  assert.equal(fmt.monthYear(ocak), 'Ocak 2027');

  const geri = addMonths(ocak, -1);
  assert.equal(fmt.monthYear(geri), 'Aralık 2026');
  assert.equal(geri, aralik);
});

test('addMonths farklı ay uzunluklarında ayın 1\'inde kalır', () => {
  // 31 Ocak → Şubat'ta 31. gün yok; taşma olmamalı
  const sonraki = addMonths(at(2026, 1, 31), 1);
  assert.equal(fmt.dayNum(sonraki), 1);
  assert.equal(fmt.monthYear(sonraki), 'Şubat 2026');
});

test('ay uzunluğu iki ay başının farkından doğru çıkar', () => {
  const uzunluk = (y, m) => Math.round((addMonths(monthStart(at(y, m, 1)), 1) - monthStart(at(y, m, 1))) / DAY);
  assert.equal(uzunluk(2026, 8), 31);
  assert.equal(uzunluk(2026, 2), 28);
  assert.equal(uzunluk(2028, 2), 29);   // artık yıl
  assert.equal(uzunluk(2026, 4), 30);
});

/* ---------- Pazartesi başlangıçlı ızgara ---------- */

test('hafta Pazartesi başlar, Pazar son sütundur', () => {
  assert.equal(GUN_KISA_PZT[0], 'Pzt');
  assert.equal(GUN_KISA_PZT[6], 'Paz');
  assert.equal(GUN_KISA_PZT.length, 7);
});

test('ızgara kaydırması Pazar gününü 6. sütuna koyar', () => {
  const lead = (t) => (dowOf(t) + 6) % 7;
  assert.equal(lead(at(2026, 8, 17)), 0);   // Pazartesi
  assert.equal(lead(at(2026, 8, 16)), 6);   // Pazar
  assert.equal(lead(at(2026, 8, 18)), 1);   // Salı
});

test('gerekli satır sayısı ayı tam kapsar', () => {
  const satir = (y, m) => {
    const ms = monthStart(at(y, m, 1));
    const gun = Math.round((addMonths(ms, 1) - ms) / DAY);
    return Math.ceil(((dowOf(ms) + 6) % 7 + gun) / 7);
  };
  // Ağustos 2026: 1 Ağustos Cumartesi → 5 kaydırma + 31 gün = 36 → 6 satır
  assert.equal(satir(2026, 8), 6);
  // Şubat 2027: 1 Şubat Pazartesi → 0 kaydırma + 28 gün = 28 → tam 4 satır
  assert.equal(satir(2027, 2), 4);
});

test('ızgara ayın ilk ve son gününü mutlaka içerir', () => {
  for (const [y, m] of [[2026, 8], [2026, 12], [2028, 2], [2027, 5]]) {
    const ms = monthStart(at(y, m, 1));
    const gun = Math.round((addMonths(ms, 1) - ms) / DAY);
    const lead = (dowOf(ms) + 6) % 7;
    const hucre = Math.ceil((lead + gun) / 7) * 7;
    const ilk = ms - lead * DAY;
    const son = ilk + (hucre - 1) * DAY;
    assert.ok(ilk <= ms, `${y}-${m}: ızgara ayın başından önce başlamalı`);
    assert.ok(son >= ms + (gun - 1) * DAY, `${y}-${m}: ızgara ayın sonunu kapsamalı`);
    assert.equal(hucre % 7, 0, `${y}-${m}: hücre sayısı 7'nin katı olmalı`);
  }
});
