# Orka EMS Fitness — Domain katmanı (Phase 1)

İş kurallarının tek doğruluk kaynağı. Framework yok, tarayıcı yok, veritabanı
yok, ağ çağrısı yok — yalnızca saf fonksiyonlar.

Kaynak sözleşme: [`../docs/ORKA_PWA_V0_5_WORKING_PRODUCT_SPEC.md`](../docs/ORKA_PWA_V0_5_WORKING_PRODUCT_SPEC.md)

## Çalıştırma

```bash
node --test domain/tests/*.test.mjs
```

Bağımlılık yok, `package.json` yok, derleme adımı yok.

## Dosya düzeni

```
domain/
├── config/policy.default.mjs      TÜM iş kuralı değerleri — tek yer
├── core/
│   ├── types.mjs                  sabitler, durum kümeleri, defter deltaları
│   ├── result.mjs                 RuleResult sözleşmesi + sebep kodları + mesaj kataloğu
│   └── time.mjs                   zaman aritmetiği (mutlak an + sabit stüdyo kayması)
├── policies/
│   ├── capacity.policy.mjs        kapasite ve münhasırlık — v0.5 §4, §5, §12
│   ├── cycle.policy.mjs           paket döngüsü ve haftalık kova stratejileri — §9
│   ├── entitlement.policy.mjs     EMS hak kontrolü — §8
│   ├── partner.policy.mjs         partner çözümleme ve bağ doğrulama — §6
│   ├── booking-window.policy.mjs  ufuk ve kapanış — §16
│   └── cancellation.policy.mjs    iptal + karara bağlanmamış çift politikası — §13
├── ledger/ledger.mjs              append-only hak defteri — §8
├── engine/
│   ├── occupancy.mjs              randevulardan doluluk türetme
│   └── booking.engine.mjs         canBookSingleEMS / canBookCoupleEMS / canBookFitness
├── index.mjs                      tek giriş noktası
└── tests/                         116 test
```

## Üç tasarım kararı

**1. Motor yazmaz, plan üretir.** `canBook*` izin verdiğinde
`metadata.plan` içinde yazılacak randevu, katılımcılar ve defter kayıtları döner.
Phase 2'de kalıcılık katmanı bu planı tek transaction'da uygular. v0.5 §22'nin
"kısmi başarı yasak" kuralı böylece yapısal olur — çift randevusunda iki üyenin
hak kaydı ya birlikte yazılır ya hiç.

**2. Bakiye sayaç değil, projeksiyon.** `remaining = totalCredits + Σ delta`.
Rezervasyon −1, iade +1, katılım/gelmedi 0 (zaten düşülmüştü). Her defter kaydı
iki zaman taşır: `sessionStartsAt` (hangi haftaya sayılacağı) ve `recordedAt`
(ne zaman yazıldığı). Bu ayrım olmadan bugün iptal edilen gelecek haftaki bir
randevu yanlış kovadan düşerdi.

**3. Üye mesajı ile yönetici mesajı ayrı üretilir.** `memberMessage` hiçbir
zaman kapasite sayısı içermez; sayılar yalnızca `adminMessage` ve `metadata`
alanlarına girer. v0.5 §17 uyumu tesadüfe değil yapıya bağlı.

## Kapasite kararı — tek dal

```
kesişen münhasır çift var mı?          → hepsini reddet
istek EMS ÇİFT mi (ve münhasırlık açık)? → seans tamamen boş olmalı
diğer her durum                         → EMS ≤ 3 · Fitness ≤ 2 · toplam ≤ 4
```

Bu üç satır yalnızca `capacity.policy.mjs` içinde var. Arayüz kendi hesabını
yapmaz, sonucu gösterir.

## Eski `uygulama/js/rules.js` ile eşleşme

Eski motor bu fazda **değiştirilmedi**; canlı PWA aynen çalışmaya devam ediyor.
Kavramsal karşılıklar:

| Eski `rules.js` | Yeni karşılığı | Durum |
|---|---|---|
| `CFG` + `configure()` | `config/policy.default.mjs` + `withPolicy()` | **Genişletildi** — fikir doğruydu, kapsamı büyüdü |
| `status(occ, service, mode)` → GREEN/ORANGE/RED | `validateStudioCapacity()` → RuleResult | **Değişti** — turuncu onay akışı kaldırıldı (v0.5 §18) |
| `CAP = {EMS:3, FITNESS:1, TOTAL:3}` | `capacity = {ems:3, fitness:2, total:4}` | **Değişti** — Fitness 1→2, toplam 3→4 (v0.5 §4) |
| `exclusiveCouple` bayrağı | `appointment.exclusiveStudio` + münhasırlık dalı | **Korundu ve güçlendirildi** |
| `canCancel(date, time, now)` | `validateCancellation()` | **Genişletildi** — 4h→24h, iptal hakkı, yönetici override |
| `slotsForDate()` | Phase 2'ye taşınacak | **Bekliyor** — ızgara üretimi sunucuya ait |
| `greenAlternatives()` | Karşılığı yok | **Kaldırıldı** — turuncu akışla birlikte |
| `endTime()` | `time.mjs` → `endOf()` | Korundu |
| Tek `memberId` üzerine kurulu `booking` | `Appointment` + `AppointmentParticipant` | **Yeniden tasarlandı** (v0.5 §7) |
| Hak/paket kavramı yok | `EntitlementLedger` + `MemberPackage` | **Yeni** |

Eski motorda korunmaya değer bulunan asıl fikir, kuralların arayüzden ayrı bir
modülde toplanmış olmasıydı. O yaklaşım büyütülerek devam ettirildi.

## Entegrasyon henüz yapılmadı

Bu katman hiçbir yerden çağrılmıyor. Canlı PWA hâlâ `uygulama/js/rules.js`
kullanıyor. Bağlama işi Phase 2'nin (sunucu) ve Phase 3'ün (arayüz) konusu.
